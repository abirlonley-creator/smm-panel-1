import { prisma } from "./lib/prisma";
import { getActiveProvider } from "./lib/provider/adapter";
import { getProviderBalanceRefreshIntervalMs } from "./lib/provider/balance";
import { formatProviderBalance } from "./lib/currency";
import { runSchedulerTick } from "./lib/scheduler/runner";
import { reconcileScheduledOrderStatus } from "./lib/scheduler/scheduled-order-status";
import { runMonitoringTick } from "./lib/monitoring/engine";
import { runScheduledJobsTick } from "./lib/scheduler/job-runner";
import { runEngagementTick } from "./lib/engagement/worker";
import { runDripFeedTick } from "./lib/orders/drip-feed-worker";

interface WorkerStats {
  ticks: number;
  totalStepsProcessed: number;
  totalOrdersSynced: number;
  totalSnapshotsTaken: number;
  totalScheduledJobsProcessed: number;
  lastTickTime: Date | null;
  lastBalanceSync: Date | null;
  currentBalance: number | null;
  currentCurrency: string | null;
}

const stats: WorkerStats = {
  ticks: 0,
  totalStepsProcessed: 0,
  totalOrdersSynced: 0,
  totalSnapshotsTaken: 0,
  totalScheduledJobsProcessed: 0,
  lastTickTime: null,
  lastBalanceSync: null,
  currentBalance: null,
  currentCurrency: null,
};

let isRunning = false;
let shutdownRequested = false;

/**
 * Synchronizes pending/active orders with the external SMM provider.
 */
async function syncActiveOrders(defaultAdapter: any): Promise<number> {
  const activeOrders = await prisma.order.findMany({
    where: {
      OR: [
        {
          status: { in: ["PENDING", "PROCESSING", "SUBMITTED"] },
          providerOrderId: { not: null },
        },
        {
          steps: {
            some: { status: { in: ["PENDING", "PROCESSING", "SUBMITTED", "PARTIAL"] } },
          },
        },
      ],
    },
    include: { steps: { orderBy: { stepNumber: "asc" } }, service: true },
    take: 25,
    orderBy: { updatedAt: "asc" },
  });

  if (activeOrders.length === 0) return 0;

  let syncedCount = 0;

  async function syncOrder(order: (typeof activeOrders)[0]) {
    try {
      const { adapter } = await getActiveProvider(order.userId || undefined);

      if (order.steps.length > 0) {
        try {
          await reconcileScheduledOrderStatus(order.id, adapter);
          syncedCount++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[WORKER] Scheduled order ${order.orderRef} status sync warning: ${msg}`);
        }
        return;
      }

      if (!order.providerOrderId) return;

      const res = await adapter.getOrderStatus(order.providerOrderId);
      if (!res || !res.status) return;

      const rawStatus = (res.status || "").toLowerCase();
      let newStatus = order.status;
      let delivered = order.deliveredQuantity;
      let remaining = order.remainingQuantity;

      if (rawStatus === "completed") {
        newStatus = "COMPLETED";
        delivered = order.requestedQuantity;
        remaining = 0;
      } else if (rawStatus === "in progress" || rawStatus === "processing") {
        newStatus = "PROCESSING";
        if (typeof res.remains === "number") {
          remaining = Math.max(0, res.remains);
          delivered = Math.max(0, order.requestedQuantity - remaining);
        }
      } else if (rawStatus === "partial") {
        newStatus = "PARTIAL";
        if (typeof res.remains === "number") {
          remaining = Math.max(0, res.remains);
          delivered = Math.max(0, order.requestedQuantity - remaining);
        }
      } else if (rawStatus === "canceled" || rawStatus === "cancelled") {
        newStatus = "CANCELLED";
      } else if (rawStatus === "refunded") {
        newStatus = "CANCELLED";
      } else if (rawStatus === "fail" || rawStatus === "failed" || rawStatus === "error") {
        newStatus = "FAILED";
      }

      // Change 14: If upstream returns Partial or Canceled, refund undelivered quantity automatically
      let refundAmount = 0;
      if ((newStatus === "PARTIAL" || newStatus === "CANCELLED") && (order.refundedAmount ?? 0) === 0 && order.userId) {
        const undelivered = Math.max(0, order.requestedQuantity - delivered);
        refundAmount = Number(((undelivered / 1000) * (order.service?.ratePer1000 ?? 0)).toFixed(4));
        if (refundAmount > 0) {
          try {
            const u = await prisma.user.findUnique({ where: { id: order.userId } });
            if (u) {
              const newBal = Number(((u.walletBalance ?? 0) + refundAmount).toFixed(2));
              await prisma.user.update({
                where: { id: u.id },
                data: { walletBalance: newBal },
              });
              await prisma.walletTransaction.create({
                data: {
                  userId: u.id,
                  type: "REFUND",
                  amount: refundAmount,
                  balanceAfter: newBal,
                  referenceId: order.orderRef,
                  description: `Automatic refund for ${undelivered} undelivered units on ${newStatus} order ${order.orderRef}`,
                },
              });
            }
          } catch (rErr) {
            console.error("[WORKER] Failed to execute auto-refund:", rErr);
          }
        }
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: newStatus,
          deliveredQuantity: delivered,
          remainingQuantity: remaining,
          ...(refundAmount > 0 ? { refundedAmount: refundAmount } : {}),
          updatedAt: new Date(),
        },
      });

      syncedCount++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[WORKER] Order ${order.orderRef} status sync warning: ${msg}`);
    }
  }

  // Sync orders concurrently in chunks of 5
  const CHUNK_SIZE = 5;
  for (let i = 0; i < activeOrders.length; i += CHUNK_SIZE) {
    const chunk = activeOrders.slice(i, i + CHUNK_SIZE);
    await Promise.allSettled(chunk.map((o) => syncOrder(o)));
  }

  return syncedCount;
}

/**
 * Synchronizes provider account balance into the database.
 */
async function syncProviderBalance(
  adapter: any,
  configId: string
): Promise<{ balance: number; currency: string } | null> {
  try {
    const bal = await adapter.getBalance();
    if ((prisma as any).userProviderConnection) {
      await (prisma as any).userProviderConnection.updateMany({
        where: { id: configId },
        data: {
          balance: bal.balance,
          currency: bal.currency,
          lastSyncAt: new Date(),
        },
      });
    }
    if ((prisma as any).provider) {
      await (prisma as any).provider.updateMany({
        where: { id: configId },
        data: {
          balance: bal.balance,
          currency: bal.currency,
          lastSyncAt: new Date(),
        },
      });
    }
    return { balance: bal.balance, currency: bal.currency };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[WORKER] Balance sync warning: ${msg}`);
    return null;
  }
}

/**
 * Executes a single complete worker cycle.
 */
export async function executeWorkerCycle(): Promise<{
  stepsProcessed: number;
  ordersSynced: number;
  balance: number | null;
  currency: string | null;
  snapshotsTaken: number;
  monitorsExpired: number;
  scheduledJobsProcessed: number;
}> {
  const { adapter, config } = await getActiveProvider();

  // 1. Run due scheduler steps (job queue processing)
  const schedulerRes = await runSchedulerTick();

  // 1b. Run due persistent future-scheduled orders (Single, Bulk, Combo)
  const scheduledJobsRes = await runScheduledJobsTick();

  // 1c. Run due Full Engagement organic runs (S-curve batches)
  const engagementRes = await runEngagementTick();

  // 1d. Run due Drip Feed random range runs (staggered batches)
  await runDripFeedTick();

  // 2. Sync active order statuses with provider
  const ordersSynced = await syncActiveOrders(adapter);

  // 3. Run Likes Analyze monitoring loop: snapshots, comparisons,
  //    persistent checkpoint scheduling, and adaptive delivery reassessment.
  const monitorRes = await runMonitoringTick();

  // 4. Refresh provider balance on the same configurable interval as the API.
  let currentBal = stats.currentBalance;
  let currentCurrency = stats.currentCurrency;
  const balanceRefreshIntervalMs = getProviderBalanceRefreshIntervalMs(
    process.env.PROVIDER_BALANCE_REFRESH_INTERVAL_MS
  );
  if (
    !stats.lastBalanceSync ||
    Date.now() - stats.lastBalanceSync.getTime() >= balanceRefreshIntervalMs
  ) {
    const bal = await syncProviderBalance(adapter, config.id);
    if (bal !== null) {
      currentBal = bal.balance;
      currentCurrency = bal.currency;
      stats.currentBalance = bal.balance;
      stats.currentCurrency = bal.currency;
      stats.lastBalanceSync = new Date();
    }
  }

  stats.ticks++;
  stats.totalStepsProcessed += schedulerRes.processedSteps;
  stats.totalOrdersSynced += ordersSynced;
  stats.totalSnapshotsTaken += monitorRes.snapshotsTaken;
  stats.totalScheduledJobsProcessed += scheduledJobsRes.processedJobs;
  stats.lastTickTime = new Date();

  try {
    await prisma.workerStatus.upsert({
      where: { id: "singleton" },
      update: {
        lastHeartbeatAt: new Date(),
        status: "RUNNING",
        activeWorkers: 1,
        lastError: null,
      },
      create: {
        id: "singleton",
        lastHeartbeatAt: new Date(),
        status: "RUNNING",
        activeWorkers: 1,
      },
    });
  } catch (err: unknown) {
    // Non-fatal if DB is busy during concurrent operations
  }

  return {
    stepsProcessed: schedulerRes.processedSteps,
    ordersSynced,
    balance: currentBal,
    currency: currentCurrency,
    snapshotsTaken: monitorRes.snapshotsTaken,
    monitorsExpired: monitorRes.sessionsExpired,
    scheduledJobsProcessed: scheduledJobsRes.processedJobs,
  };
}

/**
 * Continuous Daemon runner
 */
async function runDaemon() {
  const intervalMs = parseInt(process.env.WORKER_INTERVAL_MS || "20000", 10);
  console.log("==========================================================");
  console.log(" AuraSMM Continuous Background Worker Daemon");
  console.log(` Status: ACTIVE | Polling Interval: ${intervalMs}ms`);
  console.log(" Features: Delivery Queue • Order Sync • Balance Polling • Likes Analyze Monitoring");
  console.log("==========================================================");

  isRunning = true;

  const cycle = async () => {
    if (shutdownRequested) return;

    try {
      const result = await executeWorkerCycle();
      const ts = new Date().toISOString();
      console.log(
        `[${ts}] [TICK #${stats.ticks}] Processed: ${result.stepsProcessed} steps | Synced: ${result.ordersSynced} orders | Balance: ${formatProviderBalance(result.balance, result.currency)} | Likes Analyze: ${result.snapshotsTaken} snapshots${result.monitorsExpired > 0 ? ` | ${result.monitorsExpired} session(s) expired` : ""}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[WORKER ERROR] ${msg}`);
    }

    if (!shutdownRequested) {
      setTimeout(cycle, intervalMs);
    }
  };

  // Launch initial cycle
  cycle();
}

// Handle termination signals
process.on("SIGINT", async () => {
  console.log("\n[WORKER] Received SIGINT. Gracefully shutting down...");
  shutdownRequested = true;
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n[WORKER] Received SIGTERM. Gracefully shutting down...");
  shutdownRequested = true;
  await prisma.$disconnect();
  process.exit(0);
});

// Start the worker explicitly from the bootstrap entry point. The worker is
// dynamically imported there so `require.main === module` is false in that
// path; relying on this check alone made `npm run worker` exit immediately.
export async function startWorker() {
  const isOnce = process.argv.includes("--once");
  if (isOnce) {
    const res = await executeWorkerCycle();
    console.log("[WORKER] Single execution completed successfully:", res);
    await prisma.$disconnect();
  } else {
    runDaemon();
  }
}

// Preserve direct execution for `tsx src/worker.ts` as well.
if (require.main === module) {
  startWorker().catch((err: unknown) => {
    console.error("[WORKER FATAL ERROR]:", err);
    process.exitCode = 1;
  });
}

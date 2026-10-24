import { prisma } from "../prisma";
import { resolveServiceRouting } from "../provider/registry";
import { MockSMMProvider } from "../provider/adapter";

export interface EngagementTickResult {
  processedRuns: number;
  successfulRuns: number;
  failedRuns: number;
  refundedRuns: number;
  ordersCompleted: number;
}

const MAX_RUN_ATTEMPTS = 3;

/**
 * Executes a scheduler tick over due Full Engagement runs.
 * Atomically claims pending runs to guarantee idempotency across concurrent workers.
 */
export async function runEngagementTick(): Promise<EngagementTickResult> {
  const now = new Date();

  // 1. Fetch due pending runs (scheduledAt <= now)
  const dueRuns = await prisma.engagementRun.findMany({
    where: {
      status: "PENDING",
      scheduledAt: { lte: now },
    },
    include: {
      engagementOrder: {
        include: { user: true },
      },
      service: true,
      provider: true,
    },
    take: 15,
    orderBy: { scheduledAt: "asc" },
  });

  if (dueRuns.length === 0) {
    return { processedRuns: 0, successfulRuns: 0, failedRuns: 0, refundedRuns: 0, ordersCompleted: 0 };
  }

  let processedRuns = 0;
  let successfulRuns = 0;
  let failedRuns = 0;
  let refundedRuns = 0;
  let ordersCompleted = 0;

  for (const run of dueRuns) {
    // 2. Atomic claim: transition PENDING -> PROCESSING
    const claim = await prisma.engagementRun.updateMany({
      where: {
        id: run.id,
        status: "PENDING",
      },
      data: {
        status: "PROCESSING",
        lastAttemptAt: now,
        attempts: { increment: 1 },
      },
    });

    if (claim.count === 0) {
      // Already claimed concurrently by another worker cycle
      continue;
    }

    processedRuns++;
    const order = run.engagementOrder;

    try {
      // 3. Resolve adapter and service mapping
      let adapter: any;
      let targetServiceExtId: string = "101";

      if (run.serviceId) {
        try {
          const routing = await resolveServiceRouting(run.serviceId, run.providerId || undefined);
          adapter = routing.adapter;
          targetServiceExtId = routing.providerServiceId;
        } catch {
          adapter = new MockSMMProvider();
        }
      } else {
        adapter = new MockSMMProvider();
      }

      // 4. Submit batch order to provider
      const providerRes = await adapter.createOrder({
        serviceExternalId: targetServiceExtId,
        targetUrl: order.targetUrl,
        quantity: run.quantity,
      });

      if (providerRes.success && providerRes.providerOrderId) {
        // Success: update run to COMPLETED
        await prisma.engagementRun.update({
          where: { id: run.id },
          data: {
            status: "COMPLETED",
            providerOrderId: providerRes.providerOrderId,
            errorMessage: null,
          },
        });

        successfulRuns++;

        // Increment delivered counter on parent order
        const typeField =
          run.engagementType === "views"
            ? "deliveredViews"
            : run.engagementType === "likes"
            ? "deliveredLikes"
            : run.engagementType === "shares"
            ? "deliveredShares"
            : run.engagementType === "saves"
            ? "deliveredSaves"
            : "deliveredComments";

        await prisma.engagementOrder.update({
          where: { id: order.id },
          data: {
            [typeField]: { increment: run.quantity },
          },
        });
      } else {
        throw new Error(providerRes.error || "Provider rejected run submission");
      }
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[ENGAGEMENT_WORKER] Run ${run.id} attempt failed:`, errMsg);

      const currentAttempts = run.attempts + 1;

      if (currentAttempts >= MAX_RUN_ATTEMPTS) {
        // Permanent failure: refund run cost to user wallet
        failedRuns++;
        refundedRuns++;

        await prisma.$transaction(async (tx) => {
          await tx.engagementRun.update({
            where: { id: run.id },
            data: {
              status: "FAILED",
              errorMessage: errMsg,
            },
          });

          if (order.userId && run.cost > 0) {
            const user = await tx.user.findUnique({
              where: { id: order.userId },
              select: { id: true, walletBalance: true },
            });
            if (user) {
              const newBal = Number(((user.walletBalance ?? 0) + run.cost).toFixed(2));
              await tx.user.update({
                where: { id: user.id },
                data: { walletBalance: newBal },
              });
              await tx.walletTransaction.create({
                data: {
                  userId: user.id,
                  type: "REFUND",
                  amount: run.cost,
                  balanceAfter: newBal,
                  referenceId: order.orderRef,
                  description: `Automatic refund for permanently failed ${run.engagementType} batch on ${order.orderRef}`,
                },
              });
            }
          }
        });
      } else {
        // Retryable: return status to PENDING with backoff delay (2 mins)
        await prisma.engagementRun.update({
          where: { id: run.id },
          data: {
            status: "PENDING",
            scheduledAt: new Date(Date.now() + 2 * 60 * 1000),
            errorMessage: errMsg,
          },
        });
      }
    }

    // 5. Check if parent EngagementOrder is fully settled
    const pendingRemaining = await prisma.engagementRun.count({
      where: {
        engagementOrderId: order.id,
        status: { in: ["PENDING", "PROCESSING"] },
      },
    });

    if (pendingRemaining === 0) {
      const failedCount = await prisma.engagementRun.count({
        where: { engagementOrderId: order.id, status: "FAILED" },
      });
      const finalStatus = failedCount > 0 ? "PARTIAL" : "COMPLETED";

      await prisma.engagementOrder.update({
        where: { id: order.id },
        data: { status: finalStatus },
      });
      ordersCompleted++;
    }
  }

  return {
    processedRuns,
    successfulRuns,
    failedRuns,
    refundedRuns,
    ordersCompleted,
  };
}

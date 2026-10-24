import { prisma } from "../prisma";
import { getActiveProvider } from "../provider/adapter";

export interface DripFeedTickResult {
  processedRuns: number;
  successfulRuns: number;
  failedRuns: number;
  errors: string[];
}

/**
 * Executes due Drip Feed runs:
 * 1. Claims due runs where status = "PENDING" and scheduledAt <= now
 * 2. Idempotent atomic row lock to PROCESSING
 * 3. Submits to provider adapter
 * 4. Retries with backoff on failure (max 3 attempts)
 * 5. Automatically refunds user wallet on permanent run failure
 */
export async function runDripFeedTick(): Promise<DripFeedTickResult> {
  const now = new Date();
  const errors: string[] = [];
  let processedRuns = 0;
  let successfulRuns = 0;
  let failedRuns = 0;

  // Stale threshold to recover jobs stuck in PROCESSING after worker crash
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

  const dueRuns = await prisma.dripFeedRun.findMany({
    where: {
      OR: [
        {
          status: "PENDING",
          scheduledAt: { lte: now },
        },
        {
          status: "PROCESSING",
          updatedAt: { lte: tenMinutesAgo },
        },
      ],
    },
    include: {
      order: {
        include: {
          service: true,
          user: true,
        },
      },
    },
    take: 15,
    orderBy: { scheduledAt: "asc" },
  });

  if (dueRuns.length === 0) {
    return { processedRuns: 0, successfulRuns: 0, failedRuns: 0, errors: [] };
  }

  for (const run of dueRuns) {
    processedRuns++;

    // Atomic claim
    const claim = await prisma.dripFeedRun.updateMany({
      where: {
        id: run.id,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      data: {
        status: "PROCESSING",
        updatedAt: now,
      },
    });

    if (claim.count === 0) {
      continue; // Claimed by concurrent tick
    }

    // Check if parent order cancelled
    if (run.order.status === "CANCELLED") {
      await prisma.dripFeedRun.update({
        where: { id: run.id },
        data: { status: "CANCELLED" },
      });
      continue;
    }

    try {
      const { adapter } = await getActiveProvider(run.order.userId || undefined);
      const targetServiceId = run.order.service.providerServiceId || run.order.service.externalId;

      const submission = await adapter.createOrder({
        serviceExternalId: targetServiceId,
        targetUrl: run.order.targetUrl,
        quantity: run.quantity,
      });

      if (submission.success && submission.providerOrderId) {
        successfulRuns++;

        await prisma.dripFeedRun.update({
          where: { id: run.id },
          data: {
            status: "COMPLETED",
            providerOrderId: submission.providerOrderId,
            errorMessage: null,
          },
        });

        await prisma.order.update({
          where: { id: run.order.id },
          data: {
            submittedQuantity: { increment: run.quantity },
            status: "PROCESSING",
          },
        });

        // Check if all runs are now finished
        const remainingPending = await prisma.dripFeedRun.count({
          where: {
            orderId: run.order.id,
            status: { in: ["PENDING", "PROCESSING"] },
          },
        });

        if (remainingPending === 0) {
          await prisma.order.update({
            where: { id: run.order.id },
            data: { status: "COMPLETED" },
          });
        }
      } else {
        // Provider rejected
        failedRuns++;
        const errMsg = submission.error || "Provider rejected drip feed run";
        errors.push(`Drip feed run ${run.id} failed: ${errMsg}`);

        const nextAttempts = run.attempts + 1;
        const maxRetries = 3;

        if (nextAttempts < maxRetries) {
          const backoffMinutes = nextAttempts * 5;
          const retryTime = new Date(now.getTime() + backoffMinutes * 60 * 1000);

          await prisma.dripFeedRun.update({
            where: { id: run.id },
            data: {
              status: "PENDING",
              attempts: nextAttempts,
              scheduledAt: retryTime,
              errorMessage: `Retry #${nextAttempts}: ${errMsg}`,
            },
          });
        } else {
          // Permanently failed -> trigger wallet refund for this run's quantity
          await prisma.dripFeedRun.update({
            where: { id: run.id },
            data: {
              status: "FAILED",
              attempts: nextAttempts,
              errorMessage: `Permanently failed: ${errMsg}`,
            },
          });

          await prisma.order.update({
            where: { id: run.order.id },
            data: {
              failedQuantity: { increment: run.quantity },
              errorMessage: `Run #${run.runNumber} permanently failed: ${errMsg}`,
            },
          });

          // Refund undelivered cost to wallet
          if (run.order.userId && run.cost > 0) {
            await prisma.$transaction(async (tx) => {
              const updatedUser = await tx.user.update({
                where: { id: run.order.userId! },
                data: { walletBalance: { increment: run.cost } },
              });

              await tx.walletTransaction.create({
                data: {
                  userId: run.order.userId!,
                  type: "REFUND",
                  amount: run.cost,
                  balanceAfter: updatedUser.walletBalance,
                  referenceId: run.id,
                  description: `Refund for failed Drip Feed run #${run.runNumber} (${run.quantity} units)`,
                },
              });
            });
          }
        }
      }
    } catch (err: any) {
      failedRuns++;
      const errMsg = err.message || String(err);
      errors.push(`Drip feed run ${run.id} error: ${errMsg}`);

      const nextAttempts = run.attempts + 1;
      const maxRetries = 3;

      if (nextAttempts < maxRetries) {
        const backoffMinutes = nextAttempts * 5;
        const retryTime = new Date(now.getTime() + backoffMinutes * 60 * 1000);

        await prisma.dripFeedRun.update({
          where: { id: run.id },
          data: {
            status: "PENDING",
            attempts: nextAttempts,
            scheduledAt: retryTime,
            errorMessage: `Retry #${nextAttempts}: ${errMsg}`,
          },
        });
      } else {
        await prisma.dripFeedRun.update({
          where: { id: run.id },
          data: {
            status: "FAILED",
            attempts: nextAttempts,
            errorMessage: `Permanently failed: ${errMsg}`,
          },
        });

        if (run.order.userId && run.cost > 0) {
          await prisma.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
              where: { id: run.order.userId! },
              data: { walletBalance: { increment: run.cost } },
            });

            await tx.walletTransaction.create({
              data: {
                userId: run.order.userId!,
                type: "REFUND",
                amount: run.cost,
                balanceAfter: updatedUser.walletBalance,
                referenceId: run.id,
                description: `Refund for failed Drip Feed run #${run.runNumber} (${run.quantity} units)`,
              },
            });
          });
        }
      }
    }
  }

  return {
    processedRuns,
    successfulRuns,
    failedRuns,
    errors,
  };
}

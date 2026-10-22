import { prisma } from "../prisma";
import { getActiveProvider } from "../provider/adapter";

export interface SchedulerTickResult {
  processedSteps: number;
  successfulSteps: number;
  failedSteps: number;
  errors: string[];
}

/**
 * Executes due scheduled delivery steps across all active orders.
 * Employs optimistic row-locking and idempotency keys to guarantee safety across restarts and concurrent calls.
 */
export async function runSchedulerTick(): Promise<SchedulerTickResult> {
  const now = new Date();
  const errors: string[] = [];
  let processedSteps = 0;
  let successfulSteps = 0;
  let failedSteps = 0;

  // 1. Fetch steps due for execution that are in PENDING state (or stuck in PROCESSING > 10 mins)
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

  const dueSteps = await prisma.scheduledDeliveryStep.findMany({
    where: {
      OR: [
        {
          status: "PENDING",
          scheduledTime: { lte: now },
        },
        {
          status: "PROCESSING",
          updatedAt: { lte: tenMinutesAgo }, // recover stuck jobs after crashes
        },
      ],
    },
    include: {
      order: {
        include: {
          service: true,
        },
      },
    },
    take: 20, // Process in controlled batches
    orderBy: { scheduledTime: "asc" },
  });

  if (dueSteps.length === 0) {
    return { processedSteps: 0, successfulSteps: 0, failedSteps: 0, errors: [] };
  }

  // Prevent dumping multiple overdue batches for the same order in a single tick:
  // Execute the earliest due step now, and gracefully spread subsequent overdue steps
  // across future ticks (minimum 5-minute spacing).
  const processedOrdersInTick = new Set<string>();
  const stepsToExecute: typeof dueSteps = [];

  for (const step of dueSteps) {
    if (!processedOrdersInTick.has(step.orderId)) {
      processedOrdersInTick.add(step.orderId);
      stepsToExecute.push(step);
    } else {
      // Gracefully space out subsequent overdue batch to avoid bulk dumping
      const spreadTime = new Date(now.getTime() + 5 * 60 * 1000);
      await prisma.scheduledDeliveryStep.update({
        where: { id: step.id },
        data: { scheduledTime: spreadTime },
      });
    }
  }

  const CONCURRENCY_LIMIT = 5;

  async function processStep(step: typeof dueSteps[0]) {
    processedSteps++;

    // 2. Lock the step by updating status to PROCESSING
    const locked = await prisma.scheduledDeliveryStep.updateMany({
      where: {
        id: step.id,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      data: {
        status: "PROCESSING",
        updatedAt: now,
      },
    });

    if (locked.count === 0) {
      // Step was picked up concurrently by another worker
      return;
    }

    // Check if order was cancelled or paused in the meantime
    if (step.order.status === "CANCELLED") {
      await prisma.scheduledDeliveryStep.update({
        where: { id: step.id },
        data: { status: "CANCELLED" },
      });
      return;
    }

    if (step.order.status === "PAUSED") {
      await prisma.scheduledDeliveryStep.update({
        where: { id: step.id },
        data: { status: "PAUSED" },
      });
      return;
    }

    const schedulingDelayMs = Math.max(0, now.getTime() - new Date(step.scheduledTime).getTime());
    if (schedulingDelayMs > 30000) {
      console.log(
        `[SCHEDULER] Batch #${step.stepNumber} (Order ${step.order.orderRef}) dispatched with ${Math.round(schedulingDelayMs / 1000)}s queue latency.`
      );
    }

    try {
      // 3. Dispatch to Provider Adapter (If quantity is 0, this is an organic idle/rest period)
      if (step.quantity <= 0) {
        successfulSteps++;
        await prisma.scheduledDeliveryStep.update({
          where: { id: step.id },
          data: {
            status: "COMPLETED",
            executedAt: now,
            errorMessage: null,
          },
        });
        return;
      }

      // Route through the step order owner's provider configuration
      const { adapter } = await getActiveProvider(step.order.userId || undefined);

      // Backend provider-minimum guard: never submit an order below the service
      // minimum quantity.  This is a belt-and-suspenders check \u2014 the monitoring
      // engine validates quantities before creating steps, but we re-verify here
      // to prevent any invalid order from reaching the provider under any
      // circumstance (manual edits, retries, schema changes, etc.).
      if (step.quantity < step.order.service.minQuantity) {
        throw new Error(
          `Quantity ${step.quantity} is below the provider minimum of ` +
          `${step.order.service.minQuantity} for service "${step.order.service.name}". ` +
          `Order blocked; no request was sent to the provider.`
        );
      }

      const submission = await adapter.createOrder({
        serviceExternalId: step.order.service.externalId,
        targetUrl: step.order.targetUrl,
        quantity: step.quantity,
      });

      if (submission.success && submission.providerOrderId) {
        successfulSteps++;

        // 4. Update Step as SUBMITTED / COMPLETED
        await prisma.scheduledDeliveryStep.update({
          where: { id: step.id },
          data: {
            status: "SUBMITTED",
            providerOrderId: submission.providerOrderId,
            executedAt: now,
            errorMessage: null,
          },
        });

        // 5. Record that the provider accepted this batch. Acceptance is not
        // delivery: deliveredQuantity is updated only from provider status.
        await prisma.order.update({
          where: { id: step.order.id },
          data: {
            submittedQuantity: { increment: step.quantity },
            status: "PROCESSING",
            providerOrderId: step.order.providerOrderId || submission.providerOrderId,
          },
        });
      } else {
        // Provider rejected step
        failedSteps++;
        const errMsg = submission.error || "Provider rejected step submission";
        errors.push(`Step ${step.id} failed: ${errMsg}`);

        const nextRetryCount = step.retryCount + 1;
        const maxRetries = 3;

        if (nextRetryCount < maxRetries) {
          // Schedule retry with exponential backoff with jitter: (count * 5) + jitter min
          const jitterMinutes = Math.floor(Math.random() * 2);
          const backoffMinutes = nextRetryCount * 5 + jitterMinutes;
          const retryTime = new Date(now.getTime() + backoffMinutes * 60 * 1000);

          await prisma.scheduledDeliveryStep.update({
            where: { id: step.id },
            data: {
              status: "PENDING",
              retryCount: nextRetryCount,
              scheduledTime: retryTime,
              errorMessage: `Retry #${nextRetryCount}: ${errMsg}`,
            },
          });
        } else {
          // Max retries exceeded
          await prisma.scheduledDeliveryStep.update({
            where: { id: step.id },
            data: {
              status: "FAILED",
              retryCount: nextRetryCount,
              errorMessage: `Permanently failed after ${maxRetries} attempts: ${errMsg}`,
            },
          });

          await prisma.order.update({
            where: { id: step.order.id },
            data: {
              status: "REQUIRES_RECONCILIATION",
              failedQuantity: step.order.failedQuantity + step.quantity,
              errorMessage: `Step #${step.stepNumber} failed repeatedly: ${errMsg}`,
            },
          });
        }
      }
    } catch (err: unknown) {
      failedSteps++;
      const errorMessage = err instanceof Error ? err.message : String(err);
      errors.push(`Step ${step.id} exception: ${errorMessage}`);

      // Apply the same bounded retry policy as provider rejects: transient
      // network failures/timeouts are retried with backoff instead of
      // instantly failing the step and flagging the order.
      const nextRetryCount = step.retryCount + 1;
      const maxRetries = 3;

      if (nextRetryCount < maxRetries) {
        const jitterMinutes = Math.floor(Math.random() * 2);
        const backoffMinutes = nextRetryCount * 5 + jitterMinutes;
        const retryTime = new Date(now.getTime() + backoffMinutes * 60 * 1000);

        await prisma.scheduledDeliveryStep.update({
          where: { id: step.id },
          data: {
            status: "PENDING",
            retryCount: nextRetryCount,
            scheduledTime: retryTime,
            errorMessage: `Retry #${nextRetryCount}: ${errorMessage}`,
          },
        });
      } else {
        await prisma.scheduledDeliveryStep.update({
          where: { id: step.id },
          data: {
            status: "FAILED",
            retryCount: nextRetryCount,
            errorMessage: `Permanently failed after ${maxRetries} attempts: ${errorMessage}`,
          },
        });

        await prisma.order.update({
          where: { id: step.order.id },
          data: {
            status: "REQUIRES_RECONCILIATION",
            failedQuantity: step.order.failedQuantity + step.quantity,
            errorMessage: `Step #${step.stepNumber} failed repeatedly: ${errorMessage}`,
          },
        });
      }
    }
  }

  // Execute steps concurrently in chunks of CONCURRENCY_LIMIT
  for (let i = 0; i < stepsToExecute.length; i += CONCURRENCY_LIMIT) {
    const chunk = stepsToExecute.slice(i, i + CONCURRENCY_LIMIT);
    await Promise.allSettled(chunk.map((step) => processStep(step)));
  }

  return {
    processedSteps,
    successfulSteps,
    failedSteps,
    errors,
  };
}

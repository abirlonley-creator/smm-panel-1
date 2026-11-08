import { prisma } from "@/lib/prisma";
import type { SMMProviderAdapter } from "@/lib/provider/adapter";

/**
 * Reconcile each provider sub-order in a scheduled order and aggregate its real
 * delivery into the parent order. A scheduled order's providerOrderId points to
 * only one batch, so it must never be treated as the status of the whole order.
 */
export async function reconcileScheduledOrderStatus(
  orderId: string,
  adapter: Pick<SMMProviderAdapter, "getMultipleOrdersStatus">
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });

  if (!order) return null;
  if (order.status === "CANCELLED" || order.status === "PAUSED") return order;

  const providerSteps = order.steps.filter((step) => step.providerOrderId);
  const providerIds = providerSteps.map((step) => step.providerOrderId as string);
  const providerStatuses = providerIds.length > 0
    ? await adapter.getMultipleOrdersStatus(providerIds)
    : {};

  let allProviderStatusesKnown = true;
  let hasActiveProviderStep = false;
  let hasPartialStep = false;
  let hasFailedStep = false;
  let hasCancelledStep = false;
  let deliveredFromProvider = 0;

  for (const step of providerSteps) {
    const status = providerStatuses[step.providerOrderId as string];
    if (!status?.success) {
      allProviderStatusesKnown = false;
      hasActiveProviderStep = true;
      continue;
    }

    const remains = typeof status.remains === "number"
      ? Math.max(0, Math.min(step.quantity, status.remains))
      : undefined;
    const reportedDelivered = typeof status.deliveredQuantity === "number"
      ? Math.max(0, Math.min(step.quantity, status.deliveredQuantity))
      : undefined;

    if (status.status === "COMPLETED") {
      deliveredFromProvider += step.quantity;
      if (step.status !== "COMPLETED") {
        await prisma.scheduledDeliveryStep.update({
          where: { id: step.id },
          data: { status: "COMPLETED", errorMessage: null },
        });
      }
    } else if (status.status === "PROCESSING" || status.status === "PENDING") {
      hasActiveProviderStep = true;
      if (reportedDelivered !== undefined) deliveredFromProvider += reportedDelivered;
      else if (remains !== undefined) deliveredFromProvider += step.quantity - remains;
      else allProviderStatusesKnown = false;

      if (step.status !== "SUBMITTED") {
        await prisma.scheduledDeliveryStep.update({
          where: { id: step.id },
          data: { status: "SUBMITTED" },
        });
      }
    } else if (status.status === "PARTIAL") {
      hasPartialStep = true;
      if (reportedDelivered !== undefined) deliveredFromProvider += reportedDelivered;
      else if (remains !== undefined) deliveredFromProvider += step.quantity - remains;
      else allProviderStatusesKnown = false;

      if (step.status !== "PARTIAL") {
        await prisma.scheduledDeliveryStep.update({
          where: { id: step.id },
          data: { status: "PARTIAL" },
        });
      }
    } else if (status.status === "FAILED") {
      hasFailedStep = true;
      if (reportedDelivered !== undefined) deliveredFromProvider += reportedDelivered;
      else if (remains !== undefined) deliveredFromProvider += step.quantity - remains;
      else allProviderStatusesKnown = false;

      if (step.status !== "FAILED") {
        await prisma.scheduledDeliveryStep.update({
          where: { id: step.id },
          data: { status: "FAILED", errorMessage: status.error || null },
        });
      }
    } else if (status.status === "CANCELLED") {
      hasCancelledStep = true;
      if (reportedDelivered !== undefined) deliveredFromProvider += reportedDelivered;
      else if (remains !== undefined) deliveredFromProvider += step.quantity - remains;
      else allProviderStatusesKnown = false;

      if (step.status !== "CANCELLED") {
        await prisma.scheduledDeliveryStep.update({
          where: { id: step.id },
          data: { status: "CANCELLED" },
        });
      }
    } else {
      allProviderStatusesKnown = false;
      hasActiveProviderStep = true;
    }
  }

  const submittedQuantity = providerSteps.reduce((total, step) => total + step.quantity, 0);
  const deliveredQuantity = allProviderStatusesKnown
    ? Math.min(order.requestedQuantity, deliveredFromProvider)
    : order.deliveredQuantity;
  const remainingQuantity = allProviderStatusesKnown
    ? Math.max(0, order.requestedQuantity - deliveredQuantity)
    : order.remainingQuantity;

  const scheduledStatuses = new Map<string, string>();
  for (const step of providerSteps) {
    const providerStatus = providerStatuses[step.providerOrderId as string];
    if (!providerStatus?.success) {
      scheduledStatuses.set(step.id, step.status);
      continue;
    }

    const stepStatus = providerStatus.status;
    scheduledStatuses.set(
      step.id,
      stepStatus === "COMPLETED" || stepStatus === "PARTIAL" ||
      stepStatus === "FAILED" || stepStatus === "CANCELLED"
        ? stepStatus
        : "SUBMITTED"
    );
  }
  const hasUnsubmittedSteps = order.steps.some((step) => {
    const status = scheduledStatuses.get(step.id) || step.status;
    return status === "PENDING" || status === "PROCESSING";
  });

  let orderStatus: string;
  if (hasUnsubmittedSteps) {
    orderStatus = submittedQuantity > 0 ? "PROCESSING" : "SCHEDULED";
  } else if (hasActiveProviderStep || !allProviderStatusesKnown) {
    orderStatus = "PROCESSING";
  } else if (hasFailedStep) {
    orderStatus = "REQUIRES_RECONCILIATION";
  } else if (hasPartialStep || hasCancelledStep || deliveredQuantity < order.requestedQuantity) {
    orderStatus = "PARTIAL";
  } else {
    orderStatus = "COMPLETED";
  }

  return prisma.order.update({
    where: { id: order.id },
    data: {
      status: orderStatus,
      submittedQuantity,
      deliveredQuantity,
      remainingQuantity,
    },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });
}

/**
 * Reconcile each provider sub-order in a drip-feed order and aggregate its real
 * delivery into the parent order. A drip feed order's providerOrderId points to
 * only the first batch, so it must never be treated as the status of the whole order.
 */
export async function reconcileDripFeedOrderStatus(
  orderId: string,
  adapter: Pick<SMMProviderAdapter, "getMultipleOrdersStatus">
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { dripFeedRuns: { orderBy: { runNumber: "asc" } } },
  });

  if (!order || !order.dripFeedRuns || order.dripFeedRuns.length === 0) return order;
  if (order.status === "CANCELLED" || order.status === "PAUSED") return order;

  const providerRuns = order.dripFeedRuns.filter((run) => run.providerOrderId);
  const providerIds = providerRuns.map((run) => run.providerOrderId as string);
  const providerStatuses: Record<string, any> = providerIds.length > 0
    ? await adapter.getMultipleOrdersStatus(providerIds).catch(() => ({}))
    : {};

  let totalDelivered = 0;
  let totalSubmitted = 0;
  let hasActiveRun = false;
  let hasFailedRun = false;
  let hasPartialRun = false;

  for (const run of order.dripFeedRuns) {
    if (run.status === "PENDING") {
      continue;
    }

    if (run.providerOrderId && providerStatuses[run.providerOrderId]?.success) {
      const pStatus = providerStatuses[run.providerOrderId];
      totalSubmitted += run.quantity;

      if (pStatus.status === "COMPLETED") {
        totalDelivered += run.quantity;
        if (run.status !== "COMPLETED") {
          await prisma.dripFeedRun.update({
            where: { id: run.id },
            data: { status: "COMPLETED", errorMessage: null },
          });
        }
      } else if (pStatus.status === "PROCESSING" || pStatus.status === "PENDING" || pStatus.status === "IN_PROGRESS") {
        hasActiveRun = true;
        const remains = typeof pStatus.remains === "number" ? pStatus.remains : run.quantity;
        const deliveredForRun = Math.max(0, run.quantity - remains);
        totalDelivered += deliveredForRun;
      } else if (pStatus.status === "PARTIAL") {
        hasPartialRun = true;
        const remains = typeof pStatus.remains === "number" ? pStatus.remains : 0;
        totalDelivered += Math.max(0, run.quantity - remains);
      } else if (pStatus.status === "FAILED" || pStatus.status === "CANCELLED") {
        hasFailedRun = true;
        if (run.status !== pStatus.status) {
          await prisma.dripFeedRun.update({
            where: { id: run.id },
            data: { status: pStatus.status, errorMessage: pStatus.error || null },
          });
        }
      } else {
        totalDelivered += run.quantity;
      }
    } else {
      if (run.status === "COMPLETED") {
        totalSubmitted += run.quantity;
        totalDelivered += run.quantity;
      } else if (run.status === "PROCESSING" || run.status === "SUBMITTED") {
        totalSubmitted += run.quantity;
        hasActiveRun = true;
      } else if (run.status === "FAILED" || run.status === "CANCELLED") {
        hasFailedRun = true;
      }
    }
  }

  const hasPendingRuns = order.dripFeedRuns.some(
    (run) => run.status === "PENDING" || run.status === "PROCESSING"
  );

  let newOrderStatus: string;
  if (hasPendingRuns) {
    newOrderStatus = totalSubmitted > 0 ? "PROCESSING" : "SCHEDULED";
  } else if (hasActiveRun) {
    newOrderStatus = "PROCESSING";
  } else if (hasFailedRun) {
    newOrderStatus = totalDelivered > 0 ? "PARTIAL" : "FAILED";
  } else if (hasPartialRun || totalDelivered < order.requestedQuantity) {
    newOrderStatus = "PARTIAL";
  } else {
    newOrderStatus = "COMPLETED";
  }

  const deliveredQuantity = Math.min(order.requestedQuantity, totalDelivered);
  const remainingQuantity = Math.max(0, order.requestedQuantity - deliveredQuantity);
  const submittedQuantity = Math.min(order.requestedQuantity, totalSubmitted);

  return prisma.order.update({
    where: { id: order.id },
    data: {
      status: newOrderStatus,
      submittedQuantity,
      deliveredQuantity,
      remainingQuantity,
    },
    include: { dripFeedRuns: { orderBy: { runNumber: "asc" } } },
  });
}

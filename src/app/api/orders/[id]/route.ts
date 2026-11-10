import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveProvider } from "@/lib/provider/adapter";
import { getAuthSession } from "@/lib/auth/session";
import { cancelOrder } from "@/lib/orders/cancellation";
import { normalizeOrderDetail, orderDetailInclude } from "@/lib/orders/order-detail";
import { reconcileScheduledOrderStatus, reconcileDripFeedOrderStatus } from "@/lib/scheduler/scheduled-order-status";

async function findOrderDetailById(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: orderDetailInclude,
  });
  return order ? normalizeOrderDetail(order) : null;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    let order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: params.id },
          { orderRef: params.id },
          { scheduledJobId: params.id },
          { scheduledJob: { jobRef: params.id } },
        ],
      },
      include: {
        ...orderDetailInclude,
        scheduledJob: {
          select: {
            id: true,
            jobRef: true,
            jobType: true,
            status: true,
            scheduledFor: true,
            timezone: true,
            executedAt: true,
            errorMessage: true,
          },
        },
      },
    });

    if (!order) {
      // Check if this ID belongs to a ScheduledOrderJob
      const scheduledJob = await prisma.scheduledOrderJob.findFirst({
        where: {
          OR: [{ id: params.id }, { jobRef: params.id }],
        },
      });

      if (scheduledJob) {
        if (session.role !== "ADMIN" && scheduledJob.userId && scheduledJob.userId !== session.user.id) {
          return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
        }

        // Auto-create the Order record for this scheduled job if missing
        try {
          const payload = JSON.parse(scheduledJob.payload);
          if (scheduledJob.jobType === "SINGLE" && payload.serviceId) {
            const service = await prisma.service.findUnique({ where: { id: payload.serviceId } });
            if (service) {
              const requestedQuantity = Number(payload.requestedQuantity) || service.minQuantity;
              const unitCost = service.ratePer1000 / 1000;
              const totalCost = Number(((requestedQuantity / 1000) * service.ratePer1000).toFixed(4));
              order = await prisma.order.create({
                data: {
                  orderRef: scheduledJob.jobRef,
                  serviceId: service.id,
                  providerId: service.providerId || null,
                  targetUrl: String(payload.targetUrl || ""),
                  requestedQuantity,
                  submittedQuantity: 0,
                  deliveredQuantity: 0,
                  remainingQuantity: requestedQuantity,
                  failedQuantity: 0,
                  unitCost,
                  totalCost,
                  isScheduled: true,
                  scheduleMode: "SCHEDULED",
                  status: scheduledJob.status === "SCHEDULED" ? "SCHEDULED" : "PROCESSING",
                  scheduledJobId: scheduledJob.id,
                  userId: scheduledJob.userId || session.user.id,
                  notes: JSON.stringify({
                    scheduledFor: scheduledJob.scheduledFor.toISOString(),
                    timezone: scheduledJob.timezone,
                    jobRef: scheduledJob.jobRef,
                    serviceName: service.name,
                    platform: service.platform,
                  }),
                },
                include: {
                  ...orderDetailInclude,
                  scheduledJob: {
                    select: {
                      id: true,
                      jobRef: true,
                      jobType: true,
                      status: true,
                      scheduledFor: true,
                      timezone: true,
                      executedAt: true,
                      errorMessage: true,
                    },
                  },
                },
              });
            }
          }
        } catch (createErr) {
          console.error("Failed to auto-create order for scheduled job:", createErr);
        }
      }
    }

    if (!order) {
      // Check if this ID belongs to an EngagementOrder
      const engOrder = await prisma.engagementOrder.findFirst({
        where: {
          OR: [{ id: params.id }, { orderRef: params.id }],
        },
      });

      if (engOrder) {
        if (session.role !== "ADMIN" && engOrder.userId !== session.user.id) {
          return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
        }
        return NextResponse.json({
          success: true,
          isEngagementOrder: true,
          engagementOrderId: engOrder.id,
        });
      }

      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    if (session.role !== "ADMIN" && order.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    // Proactive auto-reconciliation:
    // 1. Drip-feed orders must be reconciled via reconcileDripFeedOrderStatus
    if (order.dripFeedRuns && order.dripFeedRuns.length > 0) {
      try {
        const targetProviderId = order.service?.userProviderId || order.service?.providerId || undefined;
        const { adapter } = await getActiveProvider(order.userId || undefined, targetProviderId);
        await reconcileDripFeedOrderStatus(order.id, adapter);
        const refreshed = await prisma.order.findUnique({
          where: { id: order.id },
          include: orderDetailInclude,
        });
        if (refreshed) {
          return NextResponse.json({ success: true, order: normalizeOrderDetail(refreshed) });
        }
      } catch {
        // Fallback to cached state
      }
    } else if (order.steps && order.steps.length > 0) {
      // 2. Scheduled steps orders must be reconciled via reconcileScheduledOrderStatus
      try {
        const targetProviderId = order.service?.userProviderId || order.service?.providerId || undefined;
        const { adapter } = await getActiveProvider(order.userId || undefined, targetProviderId);
        await reconcileScheduledOrderStatus(order.id, adapter);
        const refreshed = await prisma.order.findUnique({
          where: { id: order.id },
          include: orderDetailInclude,
        });
        if (refreshed) {
          return NextResponse.json({ success: true, order: normalizeOrderDetail(refreshed) });
        }
      } catch {
        // Fallback to cached state
      }
    } else if (order.providerOrderId && !["COMPLETED", "CANCELLED", "FAILED"].includes(order.status)) {
      // 3. Single instant orders (no sub-batches) can directly check the provider order ID
      try {
        const targetProviderId = order.service?.userProviderId || order.service?.providerId || undefined;
        const { adapter } = await getActiveProvider(order.userId || undefined, targetProviderId);

        const statusRes: any = await Promise.race([
          adapter.getOrderStatus(order.providerOrderId),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2500)),
        ]).catch(() => null);

        if (statusRes && statusRes.success) {
          let delivered = order.deliveredQuantity;
          let remains = typeof statusRes.remains === "number" ? statusRes.remains : order.remainingQuantity;

          if (statusRes.status === "COMPLETED") {
            delivered = order.requestedQuantity;
            remains = 0;
          } else if (typeof statusRes.remains === "number") {
            delivered = Math.max(0, order.requestedQuantity - statusRes.remains);
          }

          if (statusRes.status !== order.status || delivered !== order.deliveredQuantity) {
            await prisma.order.update({
              where: { id: order.id },
              data: {
                status: statusRes.status,
                deliveredQuantity: delivered,
                remainingQuantity: remains,
              },
            });

            const refreshed = await prisma.order.findUnique({
              where: { id: order.id },
              include: orderDetailInclude,
            });
            if (refreshed) {
              return NextResponse.json({ success: true, order: normalizeOrderDetail(refreshed) });
            }
          }
        }
      } catch {
        // Graceful fallback to cached state
      }
    }

    return NextResponse.json({ success: true, order: normalizeOrderDetail(order) });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load order" },
      { status: 500 }
    );
  }
}

/**
 * Reconcile provider status
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: params.id }, { orderRef: params.id }],
      },
      include: {
        service: true,
        steps: { orderBy: { stepNumber: "asc" } },
        dripFeedRuns: { orderBy: { runNumber: "asc" } },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    if (session.role !== "ADMIN" && order.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    const targetProviderId = order.service.userProviderId || order.service.providerId || undefined;
    const { adapter } = await getActiveProvider(order.userId || undefined, targetProviderId);

    if (order.steps.length > 0) {
      const reconciled = await reconcileScheduledOrderStatus(order.id, adapter);
      if (!reconciled) {
        return NextResponse.json(
          { success: false, error: "Order not found." },
          { status: 404 }
        );
      }

      const updated = await findOrderDetailById(order.id);
      if (!updated) {
        return NextResponse.json(
          { success: false, error: "Order status was updated but order details could not be loaded." },
          { status: 500 }
        );
      }

      await prisma.auditLog.create({
        data: {
          action: "RECONCILE_ORDER_STATUS",
          actor: "Customer / Admin",
          details: `Reconciled scheduled order ${order.orderRef}: status is now ${reconciled.status}`,
        },
      });

      return NextResponse.json({ success: true, order: updated });
    }

    // Reconcile individual drip feed runs if present
    if (order.dripFeedRuns && order.dripFeedRuns.length > 0) {
      const reconciled = await reconcileDripFeedOrderStatus(order.id, adapter);
      if (!reconciled) {
        return NextResponse.json(
          { success: false, error: "Order not found." },
          { status: 404 }
        );
      }

      const updated = await findOrderDetailById(order.id);
      if (!updated) {
        return NextResponse.json(
          { success: false, error: "Order status was updated but order details could not be loaded." },
          { status: 500 }
        );
      }

      await prisma.auditLog.create({
        data: {
          action: "RECONCILE_ORDER_STATUS",
          actor: "Customer / Admin",
          details: `Reconciled drip-feed order ${order.orderRef}: status is now ${reconciled.status}`,
        },
      });

      return NextResponse.json({ success: true, order: updated });
    }

    if (!order.providerOrderId) {
      const updated = await findOrderDetailById(order.id);
      return NextResponse.json({ success: true, order: updated });
    }

    const statusRes = await adapter.getOrderStatus(order.providerOrderId);

    if (statusRes.success) {
      let delivered = order.deliveredQuantity;
      let remains = typeof statusRes.remains === "number" ? statusRes.remains : order.remainingQuantity;

      if (statusRes.status === "COMPLETED") {
        delivered = order.requestedQuantity;
        remains = 0;
      } else if (typeof statusRes.remains === "number") {
        delivered = Math.max(0, order.requestedQuantity - statusRes.remains);
      }

      // Change 14: If upstream returns Partial or Canceled, calculate undelivered quantity and refund difference automatically
      let refundAmount = 0;
      const isPartialOrCanceled = statusRes.status === "PARTIAL" || statusRes.status === "CANCELLED" || ((statusRes.status as string) === "CANCELED");
      if (isPartialOrCanceled && (order.refundedAmount ?? 0) === 0 && order.userId) {
        const undelivered = Math.max(0, order.requestedQuantity - delivered);
        refundAmount = Number(((undelivered / 1000) * (order.service?.ratePer1000 ?? 0)).toFixed(4));
        if (refundAmount > 0) {
          const user = await prisma.user.findUnique({ where: { id: order.userId } });
          if (user) {
            const newBal = Number(((user.walletBalance ?? 0) + refundAmount).toFixed(2));
            await prisma.user.update({
              where: { id: user.id },
              data: { walletBalance: newBal },
            });
            await prisma.walletTransaction.create({
              data: {
                userId: user.id,
                type: "REFUND",
                amount: refundAmount,
                balanceAfter: newBal,
                referenceId: order.orderRef,
                description: `Automatic refund for ${undelivered} undelivered units on ${statusRes.status} order ${order.orderRef}`,
              },
            });
          }
        }
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: statusRes.status,
          deliveredQuantity: delivered,
          remainingQuantity: remains,
          ...(refundAmount > 0 ? { refundedAmount: refundAmount } : {}),
        },
      });

      const updated = await findOrderDetailById(order.id);
      if (!updated) {
        return NextResponse.json(
          { success: false, error: "Order status was updated but order details could not be loaded." },
          { status: 500 }
        );
      }

      await prisma.auditLog.create({
        data: {
          action: "RECONCILE_ORDER_STATUS",
          actor: "Customer / Admin",
          details: `Reconciled order ${order.orderRef}: status is now ${statusRes.status}${refundAmount > 0 ? ` (Refunded ₹${refundAmount.toFixed(2)})` : ""}`,
        },
      });

      return NextResponse.json({ success: true, order: updated });
    }

    return NextResponse.json(
      {
        success: false,
        error: statusRes.error || "Unable to retrieve status from provider",
      },
      { status: 422 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Reconciliation failed" },
      { status: 500 }
    );
  }
}

/**
 * Cancel order.
 *
 * Growth Planner (scheduled) orders work differently from instant orders:
 * - Each batch is submitted to the provider as a separate step with its own providerOrderId.
 * - The parent order's providerOrderId is just a reference to the first submitted step.
 * - Calling the provider cancel API on an already-delivered step returns "cancel unavailable".
 * - Therefore, for scheduled orders we cancel LOCALLY by marking only PENDING/PAUSED/PROCESSING
 *   future steps as CANCELLED, leaving already-SUBMITTED steps as historical records.
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    // Load the order with step count so we can detect scheduled vs instant
    const order = await prisma.order.findFirst({
      where: { OR: [{ id: params.id }, { orderRef: params.id }] },
      select: {
        id: true,
        orderRef: true,
        status: true,
        providerOrderId: true,
        userId: true,
        isScheduled: true,
        _count: { select: { steps: true } },
      },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    }

    // Ownership check
    if (session.role !== "ADMIN" && order.userId !== session.user!.id) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    }

    if (order.status === "CANCELLED") {
      const detail = await findOrderDetailById(order.id);
      return NextResponse.json({
        success: true,
        order: detail,
        alreadyCancelled: true,
        message: "Order was already cancelled.",
      });
    }

    if (order.status === "COMPLETED") {
      return NextResponse.json(
        { success: false, error: "Order is already completed and cannot be cancelled." },
        { status: 400 }
      );
    }

    // ── Scheduled (Growth Planner) orders ──────────────────────────────────────
    // These orders have multiple delivery steps, each submitted to the provider
    // separately. The parent order's providerOrderId refers to the first submitted
    // batch which may already be delivered. We must NOT call the provider cancel API
    // on that reference — it would return "cancel unavailable". Instead, we cancel
    // all future unsubmitted steps locally and mark the order as CANCELLED.
    const isScheduledOrder = order.isScheduled || order._count.steps > 0;

    if (isScheduledOrder) {
      const cancelled = await prisma.scheduledDeliveryStep.updateMany({
        where: {
          orderId: order.id,
          status: { in: ["PENDING", "PROCESSING", "PAUSED"] },
        },
        data: { status: "CANCELLED" },
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED" },
      });

      await prisma.auditLog.create({
        data: {
          action: "CANCEL_ORDER",
          actor: "User",
          details: `Scheduled order ${order.orderRef} cancelled. ${cancelled.count} future batch(es) cancelled; previously submitted batches preserved as history.`,
        },
      });

      const detail = await findOrderDetailById(order.id);
      return NextResponse.json({
        success: true,
        order: detail,
        message:
          cancelled.count > 0
            ? `Order cancelled. ${cancelled.count} future scheduled batch(es) were cancelled. Already-delivered batches are preserved.`
            : "Order cancelled. All scheduled batches had already been submitted.",
      });
    }

    // ── Instant orders ─────────────────────────────────────────────────────────
    // Use the standard provider cancel flow (provider must acknowledge cancellation).
    const result = await cancelOrder(params.id, {
      findOrder: async () => order,
      getOrderDetail: findOrderDetailById,
      cancelProviderOrder: async (providerOrderId) => {
        const { adapter } = await getActiveProvider(order.userId || undefined);
        return adapter.cancelOrder(providerOrderId);
      },
      persistCancellation: async (orderId) => {
        await prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
      },
      writeAudit: (o) =>
        prisma.auditLog
          .create({
            data: {
              action: "CANCEL_ORDER",
              actor: "User",
              details: `Order ${o.orderRef} was cancelled.`,
            },
          })
          .then(() => undefined),
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to cancel order" },
      { status: 500 }
    );
  }
}

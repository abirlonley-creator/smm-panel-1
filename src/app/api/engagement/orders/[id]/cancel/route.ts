import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { logOrderEvent } from "@/lib/engagement/event-logger";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawId = params.id;

    // Support lookup by cuid id OR orderRef
    let order = await prisma.engagementOrder.findFirst({
      where: {
        OR: [{ id: rawId }, { orderRef: rawId }],
        ...(session.role === "ADMIN" ? {} : { userId: session.user.id }),
      },
      include: {
        runs: {
          include: {
            service: true,
          },
        },
      },
    });

    // If not found directly, check main Order table
    if (!order) {
      const mainOrder = await prisma.order.findFirst({
        where: {
          OR: [{ id: rawId }, { orderRef: rawId }],
          ...(session.role === "ADMIN" ? {} : { userId: session.user.id }),
        },
      });
      if (mainOrder) {
        order = await prisma.engagementOrder.findFirst({
          where: {
            orderRef: mainOrder.orderRef,
            ...(session.role === "ADMIN" ? {} : { userId: session.user.id }),
          },
          include: {
            runs: {
              include: {
                service: true,
              },
            },
          },
        });
      }
    }

    if (!order) {
      return NextResponse.json({ success: false, error: "Engagement order not found" }, { status: 404 });
    }

    if (session.role !== "ADMIN" && order.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: "Forbidden: You do not own this order." }, { status: 403 });
    }

    if (order.status === "CANCELLED") {
      return NextResponse.json({
        success: true,
        alreadyCancelled: true,
        message: "Order has already been cancelled.",
        refundAmount: order.refundedAmount || 0,
      });
    }

    if (order.status === "COMPLETED") {
      return NextResponse.json(
        { success: false, error: "This campaign is already completed and cannot be cancelled." },
        { status: 400 }
      );
    }

    // Identify unsent runs: anything not yet sent upstream (providerOrderId is null)
    // and currently in scheduled, delayed, claimed, sending, or pending state.
    const unsentRuns = order.runs.filter(
      (r) =>
        !r.providerOrderId &&
        ["scheduled", "delayed", "claimed", "sending", "PENDING"].includes(r.status)
    );

    if (unsentRuns.length === 0) {
      await prisma.engagementOrder.update({
        where: { id: order.id },
        data: { status: "COMPLETED" },
      });
      return NextResponse.json({
        success: false,
        error: "All scheduled batches have already been dispatched upstream to delivery networks and cannot be cancelled.",
        refundAmount: 0,
      });
    }

    // Calculate proportional refund for what is left to send
    const directSumCost = unsentRuns.reduce((sum, r) => sum + (r.cost || 0), 0);
    let refundAmount = 0;

    if (directSumCost > 0) {
      refundAmount = Number(directSumCost.toFixed(2));
    } else {
      // Proportional calculation if individual run costs were not stored
      const totalRunsCount = order.runs.length;
      if (totalRunsCount > 0) {
        refundAmount = Number(((unsentRuns.length / totalRunsCount) * order.totalCost).toFixed(2));
      }
    }

    // Safety cap: cannot refund more than totalCost - alreadyRefunded
    const maxRefundable = Math.max(0, Number((order.totalCost - (order.refundedAmount || 0)).toFixed(2)));
    refundAmount = Math.min(refundAmount, maxRefundable);

    const user = order.userId
      ? await prisma.user.findUnique({ where: { id: order.userId }, select: { id: true, walletBalance: true } })
      : null;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark all unsent runs as CANCELLED so backend worker never sends them
      for (const run of unsentRuns) {
        await tx.engagementRun.update({
          where: { id: run.id },
          data: {
            status: "cancelled",
            errorMessage: "Cancelled by user request.",
          },
        });
      }

      // 2. Atomically refund wallet if user exists and refund > 0
      let updatedUser = user;
      if (user && refundAmount > 0) {
        updatedUser = await tx.user.update({
          where: { id: user.id },
          data: {
            walletBalance: { increment: refundAmount },
          },
          select: { id: true, walletBalance: true },
        });

        await tx.walletTransaction.create({
          data: {
            userId: user.id,
            type: "REFUND",
            amount: refundAmount,
            balanceAfter: updatedUser.walletBalance,
            referenceId: order.orderRef,
            description: `Refund for ${unsentRuns.length} remaining unsent batch(es) on ${order.orderRef}`,
          },
        });
      }

      // 3. Mark EngagementOrder as CANCELLED with updated refundedAmount
      const updatedOrder = await tx.engagementOrder.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          refundedAmount: { increment: refundAmount },
        },
      });

      // 4. Synchronize main parent Order entry
      await tx.order.updateMany({
        where: { orderRef: order.orderRef },
        data: {
          status: "CANCELLED",
          remainingQuantity: 0,
        },
      });

      return {
        updatedOrder,
        newBalance: updatedUser?.walletBalance ?? 0,
      };
    });

    // 5. Log Order Event
    await logOrderEvent({
      orderId: order.id,
      eventType: "STATE_CHANGE",
      message: `User cancelled campaign ${order.orderRef}. ${unsentRuns.length} remaining batch(es) cancelled in backend. Refunded ₹${refundAmount.toFixed(2)} to wallet.`,
      metadata: {
        cancelledRuns: unsentRuns.length,
        refundAmount,
        newBalance: result.newBalance,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Order ${order.orderRef} cancelled. Cancelled ${unsentRuns.length} remaining batch(es) in backend and refunded ₹${refundAmount.toFixed(2)} to your wallet.`,
      cancelledRuns: unsentRuns.length,
      refundAmount,
      newBalance: result.newBalance,
    });
  } catch (error: any) {
    console.error("[CANCEL_ENGAGEMENT_ORDER] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to cancel order" },
      { status: 500 }
    );
  }
}

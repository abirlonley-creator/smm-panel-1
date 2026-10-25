import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const order = await prisma.engagementOrder.findUnique({
      where: { id: params.id },
      include: {
        runs: true,
      },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    if (session.role !== "ADMIN" && order.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: `Order is already ${order.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Identify runs eligible to cancel (not yet sent to upstream provider)
    const pendingRuns = order.runs.filter(
      (r) => r.status === "PENDING" || r.status === "scheduled" || r.status === "delayed"
    );
    if (pendingRuns.length === 0) {
      await prisma.engagementOrder.update({
        where: { id: order.id },
        data: { status: "COMPLETED" },
      });
      return NextResponse.json({
        success: true,
        message: "All batches have already been submitted or completed.",
        refundAmount: 0,
      });
    }

    // Calculate undelivered refundable amount
    const refundAmount = Number(
      pendingRuns.reduce((sum, r) => sum + r.cost, 0).toFixed(2)
    );

    const user = order.userId
      ? await prisma.user.findUnique({ where: { id: order.userId }, select: { id: true, walletBalance: true } })
      : null;

    await prisma.$transaction(async (tx) => {
      // 1. Mark undelivered runs as CANCELLED
      for (const run of pendingRuns) {
        await tx.engagementRun.update({
          where: { id: run.id },
          data: { status: "cancelled" },
        });
      }

      // 2. Refund wallet if user exists and refund > 0
      if (user && refundAmount > 0) {
        const newBalance = Number(((user.walletBalance ?? 0) + refundAmount).toFixed(2));

        await tx.user.update({
          where: { id: user.id },
          data: { walletBalance: newBalance },
        });

        await tx.walletTransaction.create({
          data: {
            userId: user.id,
            type: "REFUND",
            amount: refundAmount,
            balanceAfter: newBalance,
            referenceId: order.orderRef,
            description: `Refund for ${pendingRuns.length} cancelled run(s) on ${order.orderRef}`,
          },
        });
      }

      // 3. Update order status
      await tx.engagementOrder.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          refundedAmount: Number(((order.refundedAmount || 0) + refundAmount).toFixed(2)),
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Order ${order.orderRef} cancelled successfully. Refunded ₹${refundAmount.toFixed(2)} for ${pendingRuns.length} undelivered batch(es).`,
      cancelledRuns: pendingRuns.length,
      refundAmount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to cancel order" },
      { status: 500 }
    );
  }
}

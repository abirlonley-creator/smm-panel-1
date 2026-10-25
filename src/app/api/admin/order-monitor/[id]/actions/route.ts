import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { replanRemainingEngagementRuns } from "@/lib/engagement/worker";
import { logOrderEvent } from "@/lib/engagement/event-logger";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = params;
    const body = await request.json();
    const { action, runId, alertId, reason } = body;

    const order = await prisma.engagementOrder.findFirst({
      where: { OR: [{ id }, { orderRef: id }] },
      include: { user: true, runs: true },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    const now = new Date();

    // 1. ACTION: Retry Run
    if (action === "retry_run") {
      if (!runId) {
        return NextResponse.json({ success: false, error: "runId required for retry_run" }, { status: 400 });
      }

      const run = await prisma.engagementRun.findUnique({ where: { id: runId } });
      if (!run) {
        return NextResponse.json({ success: false, error: "Run not found" }, { status: 404 });
      }

      await prisma.engagementRun.update({
        where: { id: run.id },
        data: {
          status: "scheduled",
          scheduledAt: now,
          attempts: 0,
          errorMessage: null,
          errorType: null,
        },
      });

      await logOrderEvent({
        orderId: order.id,
        runId: run.id,
        eventType: "STATE_CHANGE",
        message: `Admin manually re-queued run #${run.runNumber} (${run.engagementType}) for immediate execution.`,
      });

      return NextResponse.json({ success: true, message: `Run #${run.runNumber} re-queued successfully.` });
    }

    // 2. ACTION: Re-plan Remaining
    if (action === "replan_remaining") {
      const replanReason = reason || "Admin manual curve adjustment";
      const replannedCount = await replanRemainingEngagementRuns(order.id, replanReason);

      await logOrderEvent({
        orderId: order.id,
        eventType: "REPLAN",
        message: `Admin triggered curve re-plan: adjusted ${replannedCount} remaining unsent batches. Reason: ${replanReason}`,
      });

      return NextResponse.json({
        success: true,
        message: `Successfully re-planned ${replannedCount} remaining batches.`,
      });
    }

    // 3. ACTION: Refund Undelivered
    if (action === "refund_undelivered") {
      const unsentRuns = order.runs.filter((r) =>
        ["scheduled", "delayed", "failed"].includes(r.status)
      );

      const refundAmount = Number(
        unsentRuns.reduce((sum, r) => sum + r.cost, 0).toFixed(2)
      );

      if (refundAmount <= 0 || !order.userId) {
        return NextResponse.json({
          success: false,
          error: "No refundable undelivered runs found for this order.",
        });
      }

      await prisma.$transaction(async (tx) => {
        // Mark all unsent runs as cancelled
        for (const r of unsentRuns) {
          await tx.engagementRun.update({
            where: { id: r.id },
            data: { status: "cancelled", errorMessage: "Admin cancelled remaining runs with refund" },
          });
        }

        // Credit user wallet
        const user = await tx.user.findUnique({ where: { id: order.userId! } });
        if (user) {
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
              description: `Admin undelivered refund for order ${order.orderRef} (${unsentRuns.length} batches cancelled)`,
            },
          });
        }

        await tx.engagementOrder.update({
          where: { id: order.id },
          data: {
            status: "PARTIAL",
            refundedAmount: { increment: refundAmount },
          },
        });
      });

      await logOrderEvent({
        orderId: order.id,
        eventType: "REFUND",
        message: `Admin cancelled ${unsentRuns.length} undelivered runs and refunded ₹${refundAmount.toFixed(2)} to user wallet.`,
      });

      return NextResponse.json({
        success: true,
        message: `Successfully refunded ₹${refundAmount.toFixed(2)} for ${unsentRuns.length} undelivered runs.`,
      });
    }

    // 4. ACTION: Pause Order
    if (action === "pause_order") {
      const nextStatus = order.status === "PAUSED" ? "PROCESSING" : "PAUSED";
      await prisma.engagementOrder.update({
        where: { id: order.id },
        data: { status: nextStatus },
      });

      await logOrderEvent({
        orderId: order.id,
        eventType: "STATE_CHANGE",
        message: `Admin ${nextStatus === "PAUSED" ? "paused" : "resumed"} order delivery.`,
      });

      return NextResponse.json({
        success: true,
        message: `Order delivery is now ${nextStatus.toLowerCase()}.`,
        status: nextStatus,
      });
    }

    // 5. ACTION: Resolve Alert
    if (action === "resolve_alert") {
      if (!alertId) {
        return NextResponse.json({ success: false, error: "alertId required" }, { status: 400 });
      }

      await prisma.adminAlert.update({
        where: { id: alertId },
        data: {
          status: "resolved",
          resolvedAt: now,
          resolvedBy: session.label || "Admin",
          actionTaken: reason || "Resolved by admin in Order Monitor",
        },
      });

      await logOrderEvent({
        orderId: order.id,
        eventType: "STATE_CHANGE",
        message: `Admin resolved alert [${alertId}].`,
      });

      return NextResponse.json({ success: true, message: "Alert resolved." });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error("[ADMIN-ORDER-ACTIONS] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to execute order action" },
      { status: 500 }
    );
  }
}

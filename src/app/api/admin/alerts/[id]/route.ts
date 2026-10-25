import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const actionSchema = z.object({
  action: z.enum(["resolve", "retry_run", "pause_provider", "refund"]),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const alertId = params.id;

  try {
    const body = await request.json();
    const { action } = actionSchema.parse(body);

    const alert = await prisma.adminAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      return NextResponse.json({ success: false, error: "Alert not found" }, { status: 404 });
    }

    if (action === "resolve") {
      await prisma.adminAlert.update({
        where: { id: alertId },
        data: {
          status: "resolved",
          resolvedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Alert marked as resolved.",
      });
    }

    if (action === "retry_run" && alert.runId) {
      // Requeue the run for immediate execution
      await prisma.engagementRun.update({
        where: { id: alert.runId },
        data: {
          status: "scheduled",
          scheduledAt: new Date(),
          errorMessage: null,
        },
      });

      await prisma.adminAlert.update({
        where: { id: alertId },
        data: {
          status: "retrying",
          retryCount: { increment: 1 },
        },
      });

      return NextResponse.json({
        success: true,
        message: `Run ${alert.runId} requeued for immediate retry.`,
      });
    }

    if (action === "pause_provider" && alert.providerId) {
      await prisma.provider.update({
        where: { id: alert.providerId },
        data: { active: false },
      });

      await prisma.adminAlert.update({
        where: { id: alertId },
        data: {
          status: "resolved",
          resolvedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Provider ${alert.providerName || alert.providerId} has been paused.`,
      });
    }

    if (action === "refund" && alert.orderId) {
      const order = await prisma.engagementOrder.findUnique({
        where: { id: alert.orderId },
        include: { runs: true },
      });

      if (!order || !order.userId) {
        return NextResponse.json({ success: false, error: "Order or user not found for refund" }, { status: 400 });
      }

      // Calculate undelivered portion
      const undeliveredRuns = order.runs.filter((r) => r.status.toLowerCase() !== "completed");
      const refundSum = undeliveredRuns.reduce((acc, r) => acc + (r.cost || 0), 0);

      if (refundSum > 0) {
        await prisma.$transaction(async (tx) => {
          const user = await tx.user.findUnique({ where: { id: order.userId! } });
          if (user) {
            const newBal = Number(((user.walletBalance ?? 0) + refundSum).toFixed(2));
            await tx.user.update({
              where: { id: user.id },
              data: { walletBalance: newBal },
            });
            await tx.walletTransaction.create({
              data: {
                userId: user.id,
                type: "REFUND",
                amount: refundSum,
                balanceAfter: newBal,
                referenceId: order.orderRef,
                description: `Manual admin refund for undelivered batches on ${order.orderRef}`,
              },
            });
          }

          // Mark undelivered runs as CANCELLED
          for (const r of undeliveredRuns) {
            await tx.engagementRun.update({
              where: { id: r.id },
              data: { status: "cancelled", errorMessage: "Admin manual refund" },
            });
          }

          await tx.engagementOrder.update({
            where: { id: order.id },
            data: {
              status: "CANCELLED",
              refundedAmount: { increment: refundSum },
            },
          });
        });
      }

      await prisma.adminAlert.update({
        where: { id: alertId },
        data: {
          status: "resolved",
          resolvedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Refunded ₹${refundSum.toFixed(2)} to user for undelivered runs.`,
      });
    }

    return NextResponse.json({ success: false, error: "Action could not be executed" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to execute alert action" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth/session";

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
        steps: { orderBy: { stepNumber: "asc" } },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order or schedule not found." },
        { status: 404 }
      );
    }

    if (session.role !== "ADMIN" && order.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Order or schedule not found." },
        { status: 404 }
      );
    }

    if (order.status !== "PAUSED") {
      return NextResponse.json(
        { success: false, error: `Order is not paused (current status: ${order.status}).` },
        { status: 400 }
      );
    }

    const pausedSteps = order.steps.filter((s) => s.status === "PAUSED");

    if (pausedSteps.length === 0) {
      return NextResponse.json(
        { success: false, error: "No paused batches found for this schedule." },
        { status: 400 }
      );
    }

    const now = new Date();
    // Check if the first paused step was scheduled in the past
    const firstPausedTime = new Date(pausedSteps[0].scheduledTime);
    const isPast = firstPausedTime.getTime() < now.getTime();

    // If past, re-anchor from now + 1 min, preserving relative interval spacing between steps
    let shiftMs = 0;
    if (isPast) {
      const newFirstStepTime = new Date(now.getTime() + 60 * 1000); // 1 minute from now
      shiftMs = newFirstStepTime.getTime() - firstPausedTime.getTime();
    }

    await prisma.$transaction(async (tx) => {
      for (const step of pausedSteps) {
        const originalTime = new Date(step.scheduledTime);
        const updatedTime = shiftMs > 0 ? new Date(originalTime.getTime() + shiftMs) : originalTime;

        await tx.scheduledDeliveryStep.update({
          where: { id: step.id },
          data: {
            status: "PENDING",
            scheduledTime: updatedTime,
            updatedAt: now,
          },
        });
      }

      const hasSubmitted = order.steps.some((s) => ["SUBMITTED", "COMPLETED"].includes(s.status));
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: hasSubmitted ? "PROCESSING" : "SCHEDULED",
          updatedAt: now,
        },
      });
    });

    const updatedOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        service: true,
        steps: { orderBy: { stepNumber: "asc" } },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "SCHEDULE_RESUMED",
        actor: "User",
        details: `Order ${order.orderRef} resumed (${pausedSteps.length} batches resumed${shiftMs > 0 ? ", timestamps re-anchored" : ""}).`,
      },
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      resumedBatchesCount: pausedSteps.length,
      shiftedIntervals: shiftMs > 0,
      message: `Schedule resumed. ${pausedSteps.length} batches active.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to resume schedule." },
      { status: 500 }
    );
  }
}

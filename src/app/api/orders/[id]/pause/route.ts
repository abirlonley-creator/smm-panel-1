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

    if (["COMPLETED", "CANCELLED", "FAILED"].includes(order.status)) {
      return NextResponse.json(
        { success: false, error: `Cannot pause an order that is ${order.status.toLowerCase()}.` },
        { status: 400 }
      );
    }

    // Atomically pause all PENDING steps (do not interfere with any step currently in PROCESSING)
    const pausedSteps = await prisma.scheduledDeliveryStep.updateMany({
      where: {
        orderId: order.id,
        status: "PENDING",
      },
      data: {
        status: "PAUSED",
      },
    });

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAUSED",
      },
      include: {
        service: true,
        steps: { orderBy: { stepNumber: "asc" } },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "SCHEDULE_PAUSED",
        actor: "User",
        details: `Order ${order.orderRef} paused (${pausedSteps.count} batches paused).`,
      },
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      pausedBatchesCount: pausedSteps.count,
      message: `Schedule successfully paused. ${pausedSteps.count} pending batches held.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to pause schedule." },
      { status: 500 }
    );
  }
}

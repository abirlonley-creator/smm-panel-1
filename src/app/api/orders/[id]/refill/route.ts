import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveProvider } from "@/lib/provider/adapter";
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
      include: { service: true },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    if (session.role !== "ADMIN" && order.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    if (!order.service.refillSupported) {
      return NextResponse.json(
        { success: false, error: "Refills are not supported for this service." },
        { status: 400 }
      );
    }

    if (!order.providerOrderId) {
      return NextResponse.json(
        { success: false, error: "Order has no active provider order reference" },
        { status: 400 }
      );
    }

    const { adapter } = await getActiveProvider(order.userId || undefined);
    const refillRes = await adapter.createRefill(order.providerOrderId);

    if (!refillRes.success) {
      return NextResponse.json(
        { success: false, error: refillRes.error || "Provider rejected refill request" },
        { status: 422 }
      );
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        refillId: refillRes.refillId,
        refillStatus: "Pending",
      },
      include: { service: true, steps: true },
    });

    await prisma.auditLog.create({
      data: {
        action: "ORDER_REFILL_REQUESTED",
        actor: "User",
        details: `Refill #${refillRes.refillId} created for order ${order.orderRef}`,
      },
    });

    return NextResponse.json({
      success: true,
      refillId: refillRes.refillId,
      order: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to submit refill request" },
      { status: 500 }
    );
  }
}

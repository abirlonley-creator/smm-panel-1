import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApiRequest, logApiCall } from "@/lib/api-v2/auth";
import { getEngagementOrderDetails } from "@/lib/engagement/order-service";

export const dynamic = "force-dynamic";

function mapToV2Status(dbStatus: string): "pending" | "in_progress" | "completed" | "cancelled" | "failed" {
  const s = (dbStatus || "").toUpperCase();
  switch (s) {
    case "PENDING":
    case "DRAFT":
    case "SCHEDULED":
      return "pending";
    case "PROCESSING":
    case "SUBMITTED":
    case "PAUSED":
    case "IN_PROGRESS":
      return "in_progress";
    case "COMPLETED":
      return "completed";
    case "CANCELLED":
      return "cancelled";
    case "FAILED":
    case "PARTIAL":
    default:
      return "failed";
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated || !auth.user || !auth.apiKey) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized" },
      { status: auth.statusCode || 401 }
    );
  }

  const orderIdParam = params.id?.trim();
  if (!orderIdParam) {
    return NextResponse.json({ error: "Missing order id" }, { status: 400 });
  }

  try {
    // 1. Check Engagement Orders
    const engOrderDetails = await getEngagementOrderDetails(orderIdParam, auth.user.id);

    if (engOrderDetails) {
      if ((engOrderDetails as any).unauthorized) {
        return NextResponse.json(
          { error: `Unauthorized to view order #${orderIdParam}.` },
          { status: 403 }
        );
      }

      const duration = Date.now() - startTime;
      await logApiCall({
        apiKeyId: auth.apiKey.id,
        userId: auth.user.id,
        keyName: auth.apiKey.name,
        endpoint: `/api/v2/orders/${orderIdParam}`,
        method: "GET",
        statusCode: 200,
        durationMs: duration,
        success: true,
      });

      return NextResponse.json(engOrderDetails, {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Content-Type": "application/json",
        },
      });
    }

    // 2. Fallback check standard Order table
    const searchCond: any[] = [];
    const numId = Number.parseInt(orderIdParam, 10);
    if (!isNaN(numId)) {
      searchCond.push({ numericId: numId });
    }
    searchCond.push({ id: orderIdParam });
    searchCond.push({ orderRef: orderIdParam });

    const order = await prisma.order.findFirst({
      where: {
        OR: searchCond,
      },
      include: {
        service: true,
      },
    });

    if (!order || order.userId !== auth.user.id) {
      await logApiCall({
        apiKeyId: auth.apiKey.id,
        userId: auth.user.id,
        keyName: auth.apiKey.name,
        endpoint: `/api/v2/orders/${orderIdParam}`,
        method: "GET",
        statusCode: 404,
        durationMs: Date.now() - startTime,
        success: false,
        error: "Order not found",
      });

      return NextResponse.json(
        { error: `Order #${orderIdParam} not found.` },
        { status: 404 }
      );
    }

    const serviceIdentifier =
      order.service?.numericId ||
      (!isNaN(Number(order.service?.externalId))
        ? Number(order.service?.externalId)
        : order.serviceId);

    const formattedStatus = mapToV2Status(order.status);

    const responseData = {
      order: order.numericId || order.orderRef,
      service: serviceIdentifier,
      link: order.targetUrl,
      quantity: order.requestedQuantity,
      status: formattedStatus,
      start_count: 0,
      remains: Math.max(0, order.remainingQuantity || order.requestedQuantity - order.deliveredQuantity),
      charge: order.totalCost.toFixed(2),
      currency: "INR",
    };

    const duration = Date.now() - startTime;
    await logApiCall({
      apiKeyId: auth.apiKey.id,
      userId: auth.user.id,
      keyName: auth.apiKey.name,
      endpoint: `/api/v2/orders/${orderIdParam}`,
      method: "GET",
      statusCode: 200,
      durationMs: duration,
      success: true,
    });

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    await logApiCall({
      apiKeyId: auth.apiKey.id,
      userId: auth.user.id,
      keyName: auth.apiKey.name,
      endpoint: `/api/v2/orders/${orderIdParam}`,
      method: "GET",
      statusCode: 500,
      durationMs: duration,
      success: false,
      error: error.message,
    });

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

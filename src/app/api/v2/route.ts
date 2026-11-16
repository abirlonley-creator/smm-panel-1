import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApiRequest, logApiCall } from "@/lib/api-v2/auth";

export const dynamic = "force-dynamic";

function isValidUrl(stringUrl: string): boolean {
  try {
    const url = new URL(stringUrl);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

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

export async function POST(request: Request) {
  const startTime = Date.now();

  // Parse either JSON or Form URL-encoded / Multipart
  let payload: Record<string, any> = {};
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      payload = await request.json();
    } catch {
      payload = {};
    }
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    try {
      const formData = await request.formData();
      formData.forEach((val, key) => {
        payload[key] = val;
      });
    } catch {
      payload = {};
    }
  } else {
    // Attempt URL-encoded fallback
    try {
      const text = await request.text();
      const params = new URLSearchParams(text);
      params.forEach((val, key) => {
        payload[key] = val;
      });
    } catch {
      payload = {};
    }
  }

  const explicitKey = payload.key || payload.api_key;
  const auth = await authenticateApiRequest(request, explicitKey);

  if (!auth.authenticated || !auth.user || !auth.apiKey) {
    return NextResponse.json(
      { error: auth.error || "Incorrect API key" },
      { status: auth.statusCode || 401 }
    );
  }

  const action = String(payload.action || "").trim().toLowerCase();

  // 1. ACTION: services
  if (action === "services") {
    try {
      const services = await prisma.service.findMany({
        where: {
          category: { equals: "Engagement", mode: "insensitive" },
          active: true,
        },
        orderBy: [{ numericId: "asc" }, { createdAt: "asc" }],
      });

      const formatted = services.map((s) => ({
        service: s.numericId || (!isNaN(Number(s.externalId)) ? Number(s.externalId) : s.id),
        category: s.category,
        name: s.name,
        platform: s.platform.toLowerCase(),
        type: s.type.toLowerCase(),
        rate: s.ratePer1000.toFixed(2),
        min: s.minQuantity,
        max: s.maxQuantity,
        description: s.description || `${s.name} on ${s.platform}`,
        status: s.active ? "active" : "inactive",
      }));

      await logApiCall({
        apiKeyId: auth.apiKey.id,
        userId: auth.user.id,
        keyName: auth.apiKey.name,
        endpoint: "/api/v2?action=services",
        method: "POST",
        statusCode: 200,
        durationMs: Date.now() - startTime,
        success: true,
      });

      return NextResponse.json(formatted);
    } catch (err: any) {
      return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
    }
  }

  // 2. ACTION: balance
  if (action === "balance") {
    try {
      const freshUser = await prisma.user.findUnique({
        where: { id: auth.user.id },
        select: { walletBalance: true },
      });
      const bal = freshUser?.walletBalance ?? auth.user.walletBalance ?? 0;

      await logApiCall({
        apiKeyId: auth.apiKey.id,
        userId: auth.user.id,
        keyName: auth.apiKey.name,
        endpoint: "/api/v2?action=balance",
        method: "POST",
        statusCode: 200,
        durationMs: Date.now() - startTime,
        success: true,
      });

      return NextResponse.json({
        balance: bal.toFixed(2),
        currency: "USD",
      });
    } catch (err: any) {
      return NextResponse.json({ error: "Failed to fetch balance" }, { status: 500 });
    }
  }

  // 3. ACTION: add (place order)
  if (action === "add") {
    if (auth.apiKey.permission === "READ_ONLY") {
      await logApiCall({
        apiKeyId: auth.apiKey.id,
        userId: auth.user.id,
        keyName: auth.apiKey.name,
        endpoint: "/api/v2?action=add",
        method: "POST",
        statusCode: 403,
        durationMs: Date.now() - startTime,
        success: false,
        error: "Forbidden: READ_ONLY key",
      });

      return NextResponse.json(
        { error: "Forbidden: This API key has READ_ONLY permissions and cannot place orders." },
        { status: 403 }
      );
    }

    const service = payload.service;
    const link = payload.link;
    const quantity = payload.quantity;

    if (!service) return NextResponse.json({ error: "Missing required field: service" }, { status: 400 });
    if (!link || typeof link !== "string" || !isValidUrl(link.trim())) {
      return NextResponse.json({ error: "Invalid link URL" }, { status: 400 });
    }
    const cleanLink = link.trim();

    const parsedQty = Number.parseInt(String(quantity), 10);
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }

    const serviceSearchCond: any[] = [];
    const numService = Number(service);
    if (!isNaN(numService)) {
      serviceSearchCond.push({ numericId: numService });
      serviceSearchCond.push({ externalId: String(numService) });
    }
    if (typeof service === "string") {
      serviceSearchCond.push({ id: service });
      serviceSearchCond.push({ externalId: service });
    }

    const targetService = await prisma.service.findFirst({
      where: { OR: serviceSearchCond },
    });

    if (!targetService || !targetService.active) {
      return NextResponse.json({ error: `Service '${service}' not found or inactive` }, { status: 400 });
    }

    if (parsedQty < targetService.minQuantity || parsedQty > targetService.maxQuantity) {
      return NextResponse.json(
        { error: `Quantity must be between ${targetService.minQuantity} and ${targetService.maxQuantity}` },
        { status: 400 }
      );
    }

    const charge = Number(((parsedQty / 1000) * targetService.ratePer1000).toFixed(2));

    const freshUser = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { id: true, walletBalance: true },
    });

    if (!freshUser || freshUser.walletBalance < charge) {
      return NextResponse.json(
        { error: `Insufficient balance. Required: $${charge.toFixed(2)}, Available: $${freshUser?.walletBalance?.toFixed(2) ?? "0.00"}` },
        { status: 400 }
      );
    }

    const lastOrder = await prisma.order.findFirst({
      where: { numericId: { not: null } },
      orderBy: { numericId: "desc" },
      select: { numericId: true },
    });

    const nextNumericId =
      lastOrder && typeof lastOrder.numericId === "number" && lastOrder.numericId >= 90000
        ? lastOrder.numericId + 1
        : 90000 + Math.floor(Math.random() * 8000) + 1;

    const orderRef = `ORD-${nextNumericId}`;

    const [updatedUser, newOrder] = await prisma.$transaction([
      prisma.user.update({
        where: { id: freshUser.id },
        data: { walletBalance: { decrement: charge } },
        select: { walletBalance: true },
      }),
      prisma.order.create({
        data: {
          numericId: nextNumericId,
          orderRef,
          serviceId: targetService.id,
          userId: freshUser.id,
          targetUrl: cleanLink,
          requestedQuantity: parsedQty,
          submittedQuantity: parsedQty,
          remainingQuantity: parsedQty,
          deliveredQuantity: 0,
          failedQuantity: 0,
          unitCost: targetService.ratePer1000,
          totalCost: charge,
          status: "PROCESSING",
        },
      }),
      prisma.walletTransaction.create({
        data: {
          userId: freshUser.id,
          type: "DEBIT",
          amount: charge,
          balanceAfter: freshUser.walletBalance - charge,
          referenceId: orderRef,
          description: `API Order #${nextNumericId} - ${targetService.name} (Qty: ${parsedQty})`,
        },
      }),
      prisma.userApiKey.update({
        where: { id: auth.apiKey.id },
        data: { totalOrders: { increment: 1 } },
      }),
    ]);

    await logApiCall({
      apiKeyId: auth.apiKey.id,
      userId: auth.user.id,
      keyName: auth.apiKey.name,
      endpoint: "/api/v2?action=add",
      method: "POST",
      statusCode: 200,
      durationMs: Date.now() - startTime,
      success: true,
    });

    return NextResponse.json({
      order: newOrder.numericId || nextNumericId,
      charge: charge.toFixed(2),
      currency: "USD",
      status: "processing",
    });
  }

  // 4. ACTION: status
  if (action === "status") {
    const orderParam = payload.order;
    if (!orderParam) {
      return NextResponse.json({ error: "Missing required field: order" }, { status: 400 });
    }

    const searchCond: any[] = [];
    const numId = Number.parseInt(String(orderParam), 10);
    if (!isNaN(numId)) {
      searchCond.push({ numericId: numId });
    }
    searchCond.push({ id: String(orderParam) });
    searchCond.push({ orderRef: String(orderParam) });

    const order = await prisma.order.findFirst({
      where: { OR: searchCond },
      include: { service: true },
    });

    if (!order || order.userId !== auth.user.id) {
      return NextResponse.json({ error: `Order #${orderParam} not found` }, { status: 404 });
    }

    const serviceIdentifier =
      order.service?.numericId ||
      (!isNaN(Number(order.service?.externalId))
        ? Number(order.service?.externalId)
        : order.serviceId);

    const formattedStatus = mapToV2Status(order.status);

    await logApiCall({
      apiKeyId: auth.apiKey.id,
      userId: auth.user.id,
      keyName: auth.apiKey.name,
      endpoint: "/api/v2?action=status",
      method: "POST",
      statusCode: 200,
      durationMs: Date.now() - startTime,
      success: true,
    });

    return NextResponse.json({
      order: order.numericId || order.orderRef,
      service: serviceIdentifier,
      link: order.targetUrl,
      quantity: order.requestedQuantity,
      status: formattedStatus,
      start_count: 0,
      remains: Math.max(0, order.remainingQuantity || order.requestedQuantity - order.deliveredQuantity),
      charge: order.totalCost.toFixed(2),
    });
  }

  return NextResponse.json({ error: "Incorrect request: unknown action" }, { status: 400 });
}

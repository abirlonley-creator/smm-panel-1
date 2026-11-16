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

export async function POST(request: Request) {
  const startTime = Date.now();
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated || !auth.user || !auth.apiKey) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized" },
      { status: auth.statusCode || 401 }
    );
  }

  // Permission check: READ_ONLY keys cannot place orders
  if (auth.apiKey.permission === "READ_ONLY") {
    await logApiCall({
      apiKeyId: auth.apiKey.id,
      userId: auth.user.id,
      keyName: auth.apiKey.name,
      endpoint: "/api/v2/orders",
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

  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const { service, link, quantity } = body || {};

    // 1. Validate service parameter
    if (service === undefined || service === null || service === "") {
      return NextResponse.json({ error: "Missing required field: service" }, { status: 400 });
    }

    // 2. Validate link
    if (!link || typeof link !== "string" || !isValidUrl(link.trim())) {
      return NextResponse.json(
        { error: "Invalid link URL. Must be a valid HTTP or HTTPS URL." },
        { status: 400 }
      );
    }
    const cleanLink = link.trim();

    // 3. Validate quantity
    const parsedQty = Number.parseInt(String(quantity), 10);
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      return NextResponse.json(
        { error: "Invalid quantity. Must be a positive integer." },
        { status: 400 }
      );
    }

    // 4. Resolve service from database
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
      where: {
        OR: serviceSearchCond,
      },
    });

    if (!targetService || !targetService.active) {
      return NextResponse.json(
        { error: `Service '${service}' does not exist or is currently inactive.` },
        { status: 400 }
      );
    }

    // 5. Validate quantity against service min / max
    if (parsedQty < targetService.minQuantity || parsedQty > targetService.maxQuantity) {
      return NextResponse.json(
        {
          error: `Quantity ${parsedQty} is out of bounds for service '${targetService.name}'. Must be between ${targetService.minQuantity} and ${targetService.maxQuantity}.`,
        },
        { status: 400 }
      );
    }

    // 6. Calculate charge
    const charge = Number(((parsedQty / 1000) * targetService.ratePer1000).toFixed(2));

    // 7. Balance check & atomic deduction
    const freshUser = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { id: true, walletBalance: true },
    });

    if (!freshUser) {
      return NextResponse.json({ error: "User account not found" }, { status: 404 });
    }

    if (freshUser.walletBalance < charge) {
      return NextResponse.json(
        {
          error: `Insufficient balance. Required: $${charge.toFixed(2)}, Available balance: $${freshUser.walletBalance.toFixed(2)}.`,
        },
        { status: 400 }
      );
    }

    // 8. Generate sequential / unique numeric order ID (e.g. 5-digit number starting at 90000 or timestamp-based)
    // Find highest numericId or use a high offset
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

    // Perform atomic transaction: deduct balance, log transaction, create order
    const [updatedUser, newOrder] = await prisma.$transaction([
      prisma.user.update({
        where: { id: freshUser.id },
        data: {
          walletBalance: { decrement: charge },
        },
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
        data: {
          totalOrders: { increment: 1 },
        },
      }),
    ]);

    const duration = Date.now() - startTime;
    await logApiCall({
      apiKeyId: auth.apiKey.id,
      userId: auth.user.id,
      keyName: auth.apiKey.name,
      endpoint: "/api/v2/orders",
      method: "POST",
      statusCode: 200,
      durationMs: duration,
      success: true,
    });

    return NextResponse.json(
      {
        order: newOrder.numericId || nextNumericId,
        charge: charge.toFixed(2),
        currency: "USD",
        status: "processing",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    const duration = Date.now() - startTime;
    await logApiCall({
      apiKeyId: auth.apiKey.id,
      userId: auth.user.id,
      keyName: auth.apiKey.name,
      endpoint: "/api/v2/orders",
      method: "POST",
      statusCode: 500,
      durationMs: duration,
      success: false,
      error: error.message,
    });

    return NextResponse.json(
      { error: error.message || "Failed to process order" },
      { status: 500 }
    );
  }
}

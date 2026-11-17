import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApiRequest, logApiCall } from "@/lib/api-v2/auth";
import {
  getEngagementServicesCatalog,
  createEngagementOrderInternal,
  getEngagementOrderDetails,
} from "@/lib/engagement/order-service";

export const dynamic = "force-dynamic";

function isValidUrl(stringUrl: string): boolean {
  try {
    const url = new URL(stringUrl);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function mapToClassicStatus(status?: string): string {
  if (!status) return "Pending";
  const s = status.toLowerCase();
  if (s.includes("complet")) return "Completed";
  if (s.includes("progress") || s.includes("process")) return "In progress";
  if (s.includes("cancel")) return "Canceled";
  if (s.includes("fail")) return "Fail";
  return "Pending";
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
      const catalog = await getEngagementServicesCatalog();

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

      return NextResponse.json(catalog);
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
        currency: "INR",
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
    const quantity = payload.quantity ? Number(payload.quantity) : undefined;
    const shuffle = payload.shuffle !== false;

    if (!service) {
      return NextResponse.json({ error: "Missing required parameter: service (e.g. '2k', '5k', '10k', '15k')" }, { status: 400 });
    }
    if (!link || typeof link !== "string" || !isValidUrl(link.trim())) {
      return NextResponse.json({ error: "Invalid link URL. Must be a valid TikTok video URL." }, { status: 400 });
    }
    const cleanLink = link.trim();

    const orderRes = await createEngagementOrderInternal({
      userId: auth.user.id,
      targetUrl: cleanLink,
      serviceOrPreset: service,
      quantity,
      shuffle,
      apiKeyId: auth.apiKey.id,
    });

    if (!orderRes.success) {
      await logApiCall({
        apiKeyId: auth.apiKey.id,
        userId: auth.user.id,
        keyName: auth.apiKey.name,
        endpoint: "/api/v2?action=add",
        method: "POST",
        statusCode: orderRes.statusCode || 400,
        durationMs: Date.now() - startTime,
        success: false,
        error: orderRes.error,
      });

      return NextResponse.json({ error: orderRes.error }, { status: orderRes.statusCode || 400 });
    }

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
      order: orderRes.numericOrder,
      order_ref: orderRes.orderRef,
      preset: orderRes.preset,
      charge: orderRes.charge,
      currency: orderRes.currency,
      status: "processing",
    });
  }

  // 4. ACTION: status (check single order)
  if (action === "status") {
    const orderId = payload.order;
    if (!orderId) {
      return NextResponse.json({ error: "Missing required parameter: order" }, { status: 400 });
    }

    const details = await getEngagementOrderDetails(String(orderId), auth.user.id);
    if (!details) {
      return NextResponse.json({ error: `Order #${orderId} not found` }, { status: 404 });
    }
    if ((details as any).unauthorized) {
      return NextResponse.json({ error: "Unauthorized to view this order" }, { status: 403 });
    }

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
      charge: details.charge,
      start_count: 0,
      status: mapToClassicStatus(details.status),
      remains: details.remains,
      currency: details.currency || "INR",
    });
  }

  // 5. ACTION: orders (multiple orders status)
  if (action === "orders") {
    const ordersParam = payload.orders;
    if (!ordersParam) {
      return NextResponse.json({ error: "Missing required parameter: orders" }, { status: 400 });
    }

    const orderIdList = String(ordersParam)
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const results: Record<string, any> = {};
    for (const ord of orderIdList) {
      const d = await getEngagementOrderDetails(ord, auth.user.id);
      if (d && !(d as any).unauthorized) {
        results[ord] = {
          charge: d.charge,
          start_count: 0,
          status: mapToClassicStatus(d.status),
          remains: d.remains,
          currency: d.currency || "INR",
        };
      } else {
        results[ord] = { error: "Incorrect order ID" };
      }
    }

    await logApiCall({
      apiKeyId: auth.apiKey.id,
      userId: auth.user.id,
      keyName: auth.apiKey.name,
      endpoint: "/api/v2?action=orders",
      method: "POST",
      statusCode: 200,
      durationMs: Date.now() - startTime,
      success: true,
    });

    return NextResponse.json(results);
  }

  return NextResponse.json(
    { error: "Unknown action. Valid actions: services, balance, add, status, orders" },
    { status: 400 }
  );
}

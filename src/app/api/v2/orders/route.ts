import { NextResponse } from "next/server";
import { authenticateApiRequest, logApiCall } from "@/lib/api-v2/auth";
import { createEngagementOrderInternal } from "@/lib/engagement/order-service";
import { getMaintenanceState } from "@/lib/maintenance/maintenance-service";

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

  // Under Update (Maintenance) check: non-admin API keys are paused during updates
  const maintenance = await getMaintenanceState();
  if (maintenance.enabled && auth.user.role !== "ADMIN") {
    await logApiCall({
      apiKeyId: auth.apiKey.id,
      userId: auth.user.id,
      keyName: auth.apiKey.name,
      endpoint: "/api/v2/orders",
      method: "POST",
      statusCode: 503,
      durationMs: Date.now() - startTime,
      success: false,
      error: "Service under maintenance",
    });

    return NextResponse.json(
      { error: "Currently we're updating the platform. Standard API orders are paused during updates." },
      { status: 503 }
    );
  }

  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const { service, link, quantity, shuffle } = body || {};

    // 1. Validate service parameter
    if (service === undefined || service === null || service === "") {
      return NextResponse.json(
        { error: "Missing required field: service. Valid values: TikTok ('2k', '5k', '10k', '15k' / 101-104) or Instagram ('ig_2k', 'ig_5k', 'ig_10k', 'ig_15k' / 201-204)." },
        { status: 400 }
      );
    }

    // 2. Validate link
    if (!link || typeof link !== "string" || !isValidUrl(link.trim())) {
      return NextResponse.json(
        { error: "Invalid link URL. Must be a valid public TikTok video or Instagram reel/post URL." },
        { status: 400 }
      );
    }
    const cleanLink = link.trim();

    // 3. Place Engagement Campaign Order (Supports dynamic organic batch shuffling)
    const result = await createEngagementOrderInternal({
      userId: auth.user.id,
      targetUrl: cleanLink,
      serviceOrPreset: service,
      quantity: quantity ? Number(quantity) : undefined,
      shuffle: shuffle !== false, // Defaults to true (organic dynamic shuffling enabled)
      apiKeyId: auth.apiKey.id,
    });

    if (!result.success) {
      await logApiCall({
        apiKeyId: auth.apiKey.id,
        userId: auth.user.id,
        keyName: auth.apiKey.name,
        endpoint: "/api/v2/orders",
        method: "POST",
        statusCode: result.statusCode || 400,
        durationMs: Date.now() - startTime,
        success: false,
        error: result.error,
      });

      return NextResponse.json(
        { error: result.error || "Failed to place engagement order." },
        { status: result.statusCode || 400 }
      );
    }

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
        order: result.numericOrder,
        order_ref: result.orderRef,
        service: result.service,
        preset: result.preset,
        name: result.name,
        link: cleanLink,
        target_views: result.targetViews,
        target_likes: result.targetLikes,
        batches: result.batchesCount,
        duration: `${result.durationHours} Hours`,
        charge: result.charge,
        currency: result.currency || "INR",
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
      { error: error.message || "Failed to process engagement order" },
      { status: 500 }
    );
  }
}

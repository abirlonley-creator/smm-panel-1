import { NextResponse } from "next/server";
import { authenticateApiRequest, logApiCall } from "@/lib/api-v2/auth";
import { getEngagementServicesCatalog } from "@/lib/engagement/order-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startTime = Date.now();
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated || !auth.user || !auth.apiKey) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized" },
      { status: auth.statusCode || 401 }
    );
  }

  try {
    const services = await getEngagementServicesCatalog();

    const duration = Date.now() - startTime;
    await logApiCall({
      apiKeyId: auth.apiKey.id,
      userId: auth.user.id,
      keyName: auth.apiKey.name,
      endpoint: "/api/v2/services",
      method: "GET",
      statusCode: 200,
      durationMs: duration,
      success: true,
    });

    return NextResponse.json(services, {
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
      endpoint: "/api/v2/services",
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

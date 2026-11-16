import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApiRequest, logApiCall } from "@/lib/api-v2/auth";

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
    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get("category");

    const whereClause: any = {
      active: true,
    };

    if (categoryParam) {
      whereClause.category = { equals: categoryParam, mode: "insensitive" };
    } else {
      // Default: Engagement category services, or all active catalog services if requested
      whereClause.category = { equals: "Engagement", mode: "insensitive" };
    }

    const services = await prisma.service.findMany({
      where: whereClause,
      orderBy: [
        { numericId: "asc" },
        { createdAt: "asc" },
      ],
    });

    const formatted = services.map((s) => {
      // Ensure numeric service ID for universal AI compatibility
      const serviceId =
        typeof s.numericId === "number"
          ? s.numericId
          : !isNaN(Number(s.externalId))
          ? Number(s.externalId)
          : s.id;

      return {
        service: serviceId,
        category: s.category,
        name: s.name,
        platform: s.platform.toLowerCase(),
        type: s.type.toLowerCase(),
        rate: s.ratePer1000.toFixed(2),
        min: s.minQuantity,
        max: s.maxQuantity,
        description: s.description || `${s.name} on ${s.platform}`,
        status: s.active ? "active" : "inactive",
      };
    });

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

    return NextResponse.json(formatted, {
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

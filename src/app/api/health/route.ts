import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveProvider } from "@/lib/provider/adapter";

export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, any> = {};
  let overallHealthy = true;

  // 1. Database Health Check
  try {
    const configCount = await prisma.provider.count();
    checks.database = {
      status: "UP",
      latencyMs: Date.now() - startTime,
      providerConfigsCount: configCount,
    };
  } catch (err: any) {
    overallHealthy = false;
    checks.database = {
      status: "DOWN",
      error: err.message,
    };
  }

  // 2. Active Provider Health Check
  try {
    const { config } = await getActiveProvider();
    const dbConfig = await prisma.provider.findUnique({
      where: { id: config.id },
    }).catch(() => null);
    checks.provider = {
      status: "UP",
      name: config.name,
      isMock: config.isMock,
      apiUrl: config.apiUrl,
      cachedBalance: !config.isMock ? dbConfig?.balance ?? null : null,
      currency: dbConfig?.currency ?? "USD",
      lastSyncAt: dbConfig?.lastSyncAt ?? null,
    };
  } catch (err: any) {
    checks.provider = {
      status: "DEGRADED",
      error: err.message,
    };
  }

  // 3. Queue / Scheduler Health
  try {
    const pendingSteps = await prisma.scheduledDeliveryStep.count({
      where: { status: "PENDING" },
    });
    const totalOrders = await prisma.order.count();
    checks.scheduler = {
      status: "ACTIVE",
      pendingStepsInQueue: pendingSteps,
      totalOrdersStored: totalOrders,
    };
  } catch (err: any) {
    checks.scheduler = {
      status: "DEGRADED",
      error: err.message,
    };
  }

  // 4. System Telemetry
  checks.system = {
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    platform: process.platform,
    timestamp: new Date().toISOString(),
  };

  const responseStatus = overallHealthy ? 200 : 503;

  return NextResponse.json(
    {
      success: overallHealthy,
      status: overallHealthy ? "HEALTHY" : "UNHEALTHY",
      checks,
    },
    {
      status: responseStatus,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { EngagementType } from "@/lib/engagement/planner";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = params;

    const order = await prisma.engagementOrder.findFirst({
      where: {
        OR: [{ id }, { orderRef: id }],
      },
      include: {
        user: { select: { id: true, username: true, walletBalance: true } },
        runs: {
          include: {
            provider: { select: { id: true, name: true } },
            service: { select: { id: true, name: true, externalId: true } },
          },
          orderBy: [{ runNumber: "asc" }, { scheduledAt: "asc" }],
        },
        eventLogs: {
          orderBy: { createdAt: "desc" },
          take: 100,
        },
      },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    // Parse stored JSON curves and plans
    let expectedCurve: any[] = [];
    let statusSamples: any[] = [];
    let planParams: any = null;
    let typeStatuses: any = {};

    try {
      if (order.expectedCurve) expectedCurve = JSON.parse(order.expectedCurve);
      if (order.statusSamples) statusSamples = JSON.parse(order.statusSamples);
      if (order.planParams) planParams = JSON.parse(order.planParams);
      if (order.typeStatuses) typeStatuses = JSON.parse(order.typeStatuses);
    } catch {}

    // Per-Type Summary Metrics calculation
    const types: EngagementType[] = ["views", "likes", "saves", "shares", "comments"];
    const perTypeSummary: Record<string, any> = {};

    for (const t of types) {
      const typeRuns = order.runs.filter((r) => r.engagementType === t);
      if (typeRuns.length === 0) continue;

      const planned = typeRuns.reduce((sum, r) => sum + r.quantity, 0);
      const delivered = typeRuns.reduce((sum, r) => sum + (r.deliveredQuantity ?? (r.status === "confirmed" || r.status === "completed" ? r.quantity : 0)), 0);

      const sentRuns = typeRuns.filter((r) => r.sentAt !== null);
      const avgLateness = sentRuns.length > 0
        ? Math.round(sentRuns.reduce((sum, r) => sum + (r.latenessSeconds || 0), 0) / sentRuns.length)
        : 0;

      const confirmedRuns = typeRuns.filter((r) => r.timeToConfirmMs !== null);
      const avgTimeToCompleteMs = confirmedRuns.length > 0
        ? Math.round(confirmedRuns.reduce((sum, r) => sum + (r.timeToConfirmMs || 0), 0) / confirmedRuns.length)
        : 0;

      const startedRuns = typeRuns.filter((r) => r.timeToStartMs !== null);
      const avgTimeToStartMs = startedRuns.length > 0
        ? Math.round(startedRuns.reduce((sum, r) => sum + (r.timeToStartMs || 0), 0) / startedRuns.length)
        : 0;

      let deviationPct = 0;
      if (planned > 0) {
        deviationPct = Number((((delivered - planned) / planned) * 100).toFixed(1));
      }

      perTypeSummary[t] = {
        engagementType: t,
        planned,
        delivered,
        deviationPct,
        runsCount: typeRuns.length,
        sentCount: sentRuns.length,
        confirmedCount: confirmedRuns.length,
        averageLatenessSeconds: avgLateness,
        averageTimeToStartMs: avgTimeToStartMs,
        averageTimeToCompleteMs: avgTimeToCompleteMs,
        status: typeStatuses[t] || "on_track",
      };
    }

    // Fetch related alerts
    const alerts = await prisma.adminAlert.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "desc" },
    });

    // Detailed Runs Table formatting
    const runsTable = order.runs.map((r) => ({
      id: r.id,
      runNumber: r.runNumber,
      engagementType: r.engagementType,
      provider: r.provider?.name || "Default Provider",
      providerId: r.providerId,
      providerServiceId: r.providerServiceId || r.service?.externalId || "—",
      scheduledAt: r.scheduledAt.toISOString(),
      sentAt: r.sentAt ? r.sentAt.toISOString() : null,
      confirmedAt: r.confirmedAt ? r.confirmedAt.toISOString() : null,
      latenessSeconds: r.latenessSeconds || 0,
      plannedQuantity: r.quantity,
      deliveredQuantity: r.deliveredQuantity ?? (r.status === "confirmed" || r.status === "completed" ? r.quantity : 0),
      plannedCumulative: r.plannedCumulative,
      deliveredCumulative: r.deliveredCumulative,
      timeToStartMs: r.timeToStartMs,
      timeToConfirmMs: r.timeToConfirmMs,
      status: r.status,
      attempts: r.attempts,
      errorType: r.errorType,
      lastError: r.errorMessage,
      providerOrderId: r.providerOrderId,
      cost: r.cost,
      isReplan: r.isReplan,
    }));

    // Event logs formatted with duration and response code
    const eventLogs = order.eventLogs.map((e) => ({
      id: e.id,
      runId: e.runId,
      eventType: e.eventType,
      message: e.message,
      requestSummary: e.requestSummary,
      responseCode: e.responseCode,
      rawResponse: e.rawResponse,
      durationMs: e.durationMs,
      metadata: e.metadata ? JSON.parse(e.metadata) : null,
      createdAt: e.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderRef: order.orderRef,
        userId: order.userId,
        user: order.user?.username || "Guest",
        walletBalance: order.user?.walletBalance ?? 0,
        targetUrl: order.targetUrl,
        platform: order.platform,
        profileId: order.profileId,
        presetKey: order.presetKey,
        durationHours: order.durationHours,
        status: order.status,
        totalCost: order.totalCost,
        refundedAmount: order.refundedAmount,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        deviationStatus: order.deviationStatus,
        behindSince: order.behindSince ? order.behindSince.toISOString() : null,
        replanCount: order.replanCount,
        lastReplanReason: order.lastReplanReason,
        planParams,
        expectedCurve,
        statusSamples,
      },
      perTypeSummary,
      runs: runsTable,
      eventLogs,
      alerts,
    });
  } catch (error: any) {
    console.error("[ADMIN-ORDER-DETAIL] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load order details" },
      { status: 500 }
    );
  }
}

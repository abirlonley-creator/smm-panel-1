import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { recordAdminAlert } from "@/lib/engagement/alert-service";

export const dynamic = "force-dynamic";

function calculateP95(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[index];
}

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const timeframe = url.searchParams.get("timeframe") || "24h";
    const instantThresholdMinutes = Math.max(1, parseInt(url.searchParams.get("instantMinutes") || "5", 10));
    const slowP95ThresholdMinutes = Math.max(1, parseInt(url.searchParams.get("slowThresholdMinutes") || "15", 10));

    const now = new Date();
    let cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    if (timeframe === "7d") cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (timeframe === "30d") cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch all runs executed or attempted within the timeframe
    const runs = await prisma.engagementRun.findMany({
      where: {
        scheduledAt: { gte: cutoff },
        status: { in: ["sent", "confirmed", "completed", "failed", "delayed"] },
      },
      include: {
        provider: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, externalId: true } },
        engagementOrder: { select: { id: true, orderRef: true, platform: true } },
      },
      orderBy: { scheduledAt: "desc" },
      take: 2000,
    });

    // 1. Group runs per service
    interface ServiceAgg {
      providerId: string;
      providerName: string;
      serviceId: string;
      serviceName: string;
      runsSent: number;
      runsConfirmed: number;
      runsFailed: number;
      onTimeCount: number;
      instantDeliveryCount: number;
      latenessList: number[];
      timeToStartList: number[];
      timeToConfirmList: number[];
    }

    const serviceMap = new Map<string, ServiceAgg>();
    const providerMap = new Map<string, ServiceAgg>();

    for (const r of runs) {
      const pId = r.providerId || "default";
      const pName = r.provider?.name || "Standard Provider";
      const sId = r.providerServiceId || r.service?.externalId || "default";
      const sName = r.service?.name || `${r.engagementType.toUpperCase()} Service (${sId})`;

      const serviceKey = `${pId}:${sId}`;

      // Initialize service entry
      if (!serviceMap.has(serviceKey)) {
        serviceMap.set(serviceKey, {
          providerId: pId,
          providerName: pName,
          serviceId: sId,
          serviceName: sName,
          runsSent: 0,
          runsConfirmed: 0,
          runsFailed: 0,
          onTimeCount: 0,
          instantDeliveryCount: 0,
          latenessList: [],
          timeToStartList: [],
          timeToConfirmList: [],
        });
      }

      // Initialize provider entry
      if (!providerMap.has(pId)) {
        providerMap.set(pId, {
          providerId: pId,
          providerName: pName,
          serviceId: "all",
          serviceName: `${pName} (All Services)`,
          runsSent: 0,
          runsConfirmed: 0,
          runsFailed: 0,
          onTimeCount: 0,
          instantDeliveryCount: 0,
          latenessList: [],
          timeToStartList: [],
          timeToConfirmList: [],
        });
      }

      const sAgg = serviceMap.get(serviceKey)!;
      const pAgg = providerMap.get(pId)!;

      const isSent = r.sentAt !== null;
      const isConfirmed = r.status === "confirmed" || r.status === "completed";
      const isFailed = r.status === "failed";
      const lateness = r.latenessSeconds || 0;
      const timeToStart = r.timeToStartMs ? Math.round(r.timeToStartMs / 1000) : lateness;
      const timeToConfirm = r.timeToConfirmMs ? Math.round(r.timeToConfirmMs / 1000) : 0;

      for (const target of [sAgg, pAgg]) {
        target.runsSent++;
        if (isConfirmed) target.runsConfirmed++;
        if (isFailed) target.runsFailed++;
        if (lateness <= 60) target.onTimeCount++;
        if (timeToStart <= instantThresholdMinutes * 60) target.instantDeliveryCount++;
        if (isSent) {
          target.latenessList.push(lateness);
          target.timeToStartList.push(timeToStart);
        }
        if (isConfirmed && timeToConfirm > 0) {
          target.timeToConfirmList.push(timeToConfirm);
        }
      }
    }

    // Format final Service & Provider performance rows
    const formatAggRow = (agg: ServiceAgg) => {
      const sent = agg.runsSent || 1;
      const sentOnTimePct = Math.round((agg.onTimeCount / sent) * 100);
      const instantDeliveryScorePct = Math.round((agg.instantDeliveryCount / sent) * 100);
      const failureRatePct = Number(((agg.runsFailed / sent) * 100).toFixed(1));

      const avgLatenessSeconds = agg.latenessList.length > 0
        ? Math.round(agg.latenessList.reduce((a, b) => a + b, 0) / agg.latenessList.length)
        : 0;
      const p95LatenessSeconds = calculateP95(agg.latenessList);

      const avgTimeToStartSeconds = agg.timeToStartList.length > 0
        ? Math.round(agg.timeToStartList.reduce((a, b) => a + b, 0) / agg.timeToStartList.length)
        : 0;
      const p95TimeToStartSeconds = calculateP95(agg.timeToStartList);

      const avgTimeToCompleteSeconds = agg.timeToConfirmList.length > 0
        ? Math.round(agg.timeToConfirmList.reduce((a, b) => a + b, 0) / agg.timeToConfirmList.length)
        : 0;
      const p95TimeToCompleteSeconds = calculateP95(agg.timeToConfirmList);

      // Status Chip ranking: Fast / OK / Slow / Problem
      let statusChip: "Fast" | "OK" | "Slow" | "Problem" = "Fast";
      if (p95TimeToStartSeconds > 30 * 60 || failureRatePct >= 10) {
        statusChip = "Problem";
      } else if (p95TimeToStartSeconds > slowP95ThresholdMinutes * 60 || failureRatePct >= 5) {
        statusChip = "Slow";
      } else if (p95TimeToStartSeconds > 8 * 60 || failureRatePct >= 2) {
        statusChip = "OK";
      }

      return {
        providerId: agg.providerId,
        providerName: agg.providerName,
        serviceId: agg.serviceId,
        serviceName: agg.serviceName,
        runsSent: agg.runsSent,
        sentOnTimePct,
        instantDeliveryScorePct,
        failureRatePct,
        avgLatenessSeconds,
        p95LatenessSeconds,
        avgTimeToStartSeconds,
        p95TimeToStartSeconds,
        avgTimeToCompleteSeconds,
        p95TimeToCompleteSeconds,
        statusChip,
      };
    }

    const servicesReport = Array.from(serviceMap.values())
      .map(formatAggRow)
      .sort((a, b) => b.p95TimeToStartSeconds - a.p95TimeToStartSeconds);

    const providersReport = Array.from(providerMap.values())
      .map(formatAggRow)
      .sort((a, b) => b.p95TimeToStartSeconds - a.p95TimeToStartSeconds);

    // Auto-flag any service as "Slow" / "Problem" if p95 exceeds threshold
    for (const s of servicesReport) {
      if (s.statusChip === "Slow" || s.statusChip === "Problem") {
        recordAdminAlert({
          severity: s.statusChip === "Problem" ? "high" : "medium",
          type: "service_slow",
          providerId: s.providerId !== "default" ? s.providerId : null,
          providerName: s.providerName,
          serviceId: s.serviceId,
          reason: `Service "${s.serviceName}" flagged as ${s.statusChip}: p95 time-to-start is ${(s.p95TimeToStartSeconds / 60).toFixed(1)}m (threshold: ${slowP95ThresholdMinutes}m, failure rate: ${s.failureRatePct}%).`,
          suggestedAction: "Consider switching platform engagement profile to an alternative service ID.",
        }).catch(() => {});
      }
    }

    // Top 15 slowest recent runs drill-down
    const slowestRecentRuns = [...runs]
      .filter((r) => (r.latenessSeconds || 0) > 60 || (r.timeToStartMs || 0) > 60000)
      .sort((a, b) => (b.timeToStartMs || b.latenessSeconds || 0) - (a.timeToStartMs || a.latenessSeconds || 0))
      .slice(0, 15)
      .map((r) => ({
        runId: r.id,
        orderId: r.engagementOrderId,
        orderRef: r.engagementOrder?.orderRef || r.engagementOrderId,
        platform: r.engagementOrder?.platform || "—",
        runNumber: r.runNumber,
        engagementType: r.engagementType,
        provider: r.provider?.name || "Provider",
        serviceId: r.providerServiceId || r.service?.externalId || "—",
        quantity: r.quantity,
        scheduledAt: r.scheduledAt.toISOString(),
        sentAt: r.sentAt ? r.sentAt.toISOString() : null,
        latenessSeconds: r.latenessSeconds || 0,
        timeToStartSeconds: r.timeToStartMs ? Math.round(r.timeToStartMs / 1000) : r.latenessSeconds || 0,
        status: r.status,
      }));

    return NextResponse.json({
      success: true,
      timeframe,
      instantThresholdMinutes,
      slowP95ThresholdMinutes,
      totalRunsAnalyzed: runs.length,
      services: servicesReport,
      providers: providersReport,
      slowestRuns: slowestRecentRuns,
    });
  } catch (error: any) {
    console.error("[DELIVERY-SPEED-REPORT] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate delivery speed report" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getCalmUserStatusText } from "@/lib/engagement/worker";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const order = await prisma.engagementOrder.findFirst({
      where: {
        OR: [{ id }, { orderRef: id }],
        userId: session.user.id,
      },
      include: {
        runs: {
          orderBy: { scheduledAt: "asc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    // Parse stored artifacts per Change D
    let planParams = null;
    let expectedCurve = [];
    let statusSamples = [];
    let typeStatuses: Record<string, string> = {};
    let enabledTypes = ["views", "likes", "saves", "shares", "comments"];

    try {
      if (order.planParams) planParams = JSON.parse(order.planParams);
    } catch {}
    try {
      if (order.expectedCurve) expectedCurve = JSON.parse(order.expectedCurve);
    } catch {}
    try {
      if (order.statusSamples) statusSamples = JSON.parse(order.statusSamples);
    } catch {}
    try {
      if (order.typeStatuses) typeStatuses = JSON.parse(order.typeStatuses);
    } catch {}
    try {
      if (order.enabledTypes) enabledTypes = JSON.parse(order.enabledTypes);
    } catch {}

    const hasDelayedRuns = order.runs.some((r) => r.status === "delayed");
    const calmStatusText = getCalmUserStatusText(order.deviationStatus, hasDelayedRuns);

    // Compute progress & next run
    const completedRuns = order.runs.filter((r) => r.status === "completed").length;
    const nextPendingRun = order.runs.find((r) => ["scheduled", "delayed"].includes(r.status));

    // Plain words deviation text per type per Change F
    const plainDeviationTexts: Record<string, string> = {};
    const plannedTotals: Record<string, number> = {
      views: order.plannedViews,
      likes: order.plannedLikes,
      saves: order.plannedSaves,
      shares: order.plannedShares,
      comments: order.plannedComments,
    };
    const deliveredTotals: Record<string, number> = {
      views: order.deliveredViews,
      likes: order.deliveredLikes,
      saves: order.deliveredSaves,
      shares: order.deliveredShares,
      comments: order.deliveredComments,
    };

    // Calculate deviation percentage
    const durationMinutes = Math.max(15, Math.round(order.durationHours * 60));
    const elapsedMinutes = Math.max(0, Math.min(durationMinutes, (Date.now() - order.createdAt.getTime()) / 60000));
    
    // Find expected so far
    let expectedSoFar = { views: 0, likes: 0, saves: 0, shares: 0, comments: 0 };
    if (expectedCurve.length > 0) {
      let bestPt = expectedCurve[0];
      for (const pt of expectedCurve) {
        if (pt.minutes <= elapsedMinutes) bestPt = pt;
        else break;
      }
      expectedSoFar = bestPt;
    }

    for (const t of ["views", "likes", "saves", "shares", "comments"]) {
      const planned = plannedTotals[t] || 0;
      const delivered = deliveredTotals[t] || 0;
      const exp = (expectedSoFar as any)[t] || 0;
      if (planned <= 0) {
        plainDeviationTexts[t] = "Not enabled";
        continue;
      }
      const dev = (delivered - exp) / planned;
      const pct = Math.abs(Math.round(dev * 100));
      if (dev >= -0.05 && dev <= 0.05) {
        plainDeviationTexts[t] = `${t.charAt(0).toUpperCase() + t.slice(1)}: On track`;
      } else if (dev < -0.05) {
        plainDeviationTexts[t] = `${t.charAt(0).toUpperCase() + t.slice(1)}: ${pct}% behind plan`;
      } else {
        plainDeviationTexts[t] = `${t.charAt(0).toUpperCase() + t.slice(1)}: ${pct}% ahead of plan`;
      }
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderRef: order.orderRef,
        targetUrl: order.targetUrl,
        platform: order.platform,
        profileId: order.profileId,
        presetKey: order.presetKey,
        baseViews: order.baseViews,
        durationHours: order.durationHours,
        status: order.status,
        deviationStatus: order.deviationStatus,
        typeStatuses,
        calmStatusText,
        plainDeviationTexts,
        totalCost: order.totalCost,
        refundedAmount: order.refundedAmount,
        createdAt: order.createdAt.toISOString(),
        replanCount: order.replanCount,
        lastReplanReason: order.lastReplanReason,
        enabledTypes,
        plannedTotals,
        deliveredTotals,
        completedRuns,
        totalRuns: order.runs.length,
        progressPercent: order.runs.length > 0 ? Math.round((completedRuns / order.runs.length) * 100) : 0,
        nextRunTime: nextPendingRun ? nextPendingRun.scheduledAt.toISOString() : null,
        planParams,
        expectedCurve,
        statusSamples,
        runs: order.runs.map((r) => ({
          id: r.id,
          engagementType: r.engagementType,
          runNumber: r.runNumber,
          scheduledAt: r.scheduledAt.toISOString(),
          sentAt: r.sentAt ? r.sentAt.toISOString() : null,
          quantity: r.quantity,
          plannedCumulative: r.plannedCumulative,
          deliveredQuantity: r.deliveredQuantity ?? (r.status === "completed" ? r.quantity : 0),
          deliveredCumulative: r.deliveredCumulative,
          status: r.status,
          latenessSeconds: r.latenessSeconds ?? 0,
          isReplan: r.isReplan,
          cost: r.cost,
        })),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to load order" }, { status: 500 });
  }
}

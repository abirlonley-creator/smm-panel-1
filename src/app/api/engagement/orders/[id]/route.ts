import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getCalmUserStatusText, checkAndApplyDelayedLikesProtection, runEngagementTick } from "@/lib/engagement/worker";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const rawId = params.id;

    // Search by EngagementOrder ID or orderRef
    let order = await prisma.engagementOrder.findFirst({
      where: {
        OR: [{ id: rawId }, { orderRef: rawId }],
        ...(session.role === "ADMIN" ? {} : { userId: session.user.id }),
      },
      include: {
        runs: {
          orderBy: { scheduledAt: "asc" },
          include: {
            service: { select: { id: true, name: true, ratePer1000: true } },
          },
        },
        eventLogs: {
          orderBy: { createdAt: "desc" },
          take: 60,
        },
      },
    });

    // If not found directly, check if this is an Order.id or Order.orderRef
    if (!order) {
      const mainOrder = await prisma.order.findFirst({
        where: {
          OR: [{ id: rawId }, { orderRef: rawId }],
          ...(session.role === "ADMIN" ? {} : { userId: session.user.id }),
        },
      });

      if (mainOrder) {
        order = await prisma.engagementOrder.findFirst({
          where: {
            orderRef: mainOrder.orderRef,
            ...(session.role === "ADMIN" ? {} : { userId: session.user.id }),
          },
          include: {
            runs: {
              orderBy: { scheduledAt: "asc" },
              include: {
                service: { select: { id: true, name: true, ratePer1000: true } },
              },
            },
            eventLogs: {
              orderBy: { createdAt: "desc" },
              take: 60,
            },
          },
        });
      }
    }

    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    // Parse stored artifacts
    let planParams = null;
    let expectedCurve = [];
    let statusSamples = [];
    let typeStatuses: Record<string, string> = {};
    let enabledTypes = ["views", "likes"];

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

    // Filter views, likes, saves & shares runs
    const viewsRuns = order.runs.filter((r) => r.engagementType === "views");
    const likesRuns = order.runs.filter((r) => r.engagementType === "likes");
    const savesRuns = order.runs.filter((r) => r.engagementType === "saves");
    const sharesRuns = order.runs.filter((r) => r.engagementType === "shares");

    const viewsDelivered = viewsRuns.reduce(
      (sum, r) => sum + (r.deliveredQuantity ?? (r.status === "completed" || r.status === "confirmed" ? r.quantity : 0)),
      0
    );
    const viewsPlanned = order.plannedViews || viewsRuns.reduce((sum, r) => sum + r.quantity, 0);
    const viewsRemaining = Math.max(0, viewsPlanned - viewsDelivered);

    const likesDelivered = likesRuns.reduce(
      (sum, r) => sum + (r.deliveredQuantity ?? (r.status === "completed" || r.status === "confirmed" ? r.quantity : 0)),
      0
    );
    const likesPlanned = order.plannedLikes || likesRuns.reduce((sum, r) => sum + r.quantity, 0);
    const likesRemaining = Math.max(0, likesPlanned - likesDelivered);

    const savesDelivered = savesRuns.reduce(
      (sum, r) => sum + (r.deliveredQuantity ?? (r.status === "completed" || r.status === "confirmed" ? r.quantity : 0)),
      0
    );
    const savesPlanned = order.plannedSaves || savesRuns.reduce((sum, r) => sum + r.quantity, 0);
    const savesRemaining = Math.max(0, savesPlanned - savesDelivered);

    const sharesDelivered = sharesRuns.reduce(
      (sum, r) => sum + (r.deliveredQuantity ?? (r.status === "completed" || r.status === "confirmed" ? r.quantity : 0)),
      0
    );
    const sharesPlanned = order.plannedShares || sharesRuns.reduce((sum, r) => sum + r.quantity, 0);
    const sharesRemaining = Math.max(0, sharesPlanned - sharesDelivered);

    const totalRuns = order.runs.length;
    const completedRuns = order.runs.filter((r) => r.status === "completed" || r.status === "confirmed").length;
    const nextPendingRun = order.runs.find((r) => ["scheduled", "delayed", "pending"].includes(r.status));

    // Progress percentage (combined views + likes + saves + shares progress)
    const totalPlanned = viewsPlanned + likesPlanned + savesPlanned + sharesPlanned;
    const totalDelivered = viewsDelivered + likesDelivered + savesDelivered + sharesDelivered;
    const progressPercent = totalPlanned > 0
      ? Math.min(100, Math.round((totalDelivered / totalPlanned) * 100))
      : 0;

    // Delayed Likes Protection events
    const delayedLikesEvents = order.eventLogs.filter(
      (e) => e.eventType === "REPLAN" || e.message.toLowerCase().includes("delayed likes")
    );

    // Compute plain deviation texts
    const plainDeviationTexts: Record<string, string> = {
      views: `Views: ${viewsDelivered.toLocaleString()} / ${viewsPlanned.toLocaleString()} (${viewsRemaining.toLocaleString()} remaining)`,
      likes: `Likes: ${likesDelivered.toLocaleString()} / ${likesPlanned.toLocaleString()} (${likesRemaining.toLocaleString()} remaining)`,
      saves: `Saves: ${savesDelivered.toLocaleString()} / ${savesPlanned.toLocaleString()} (${savesRemaining.toLocaleString()} remaining)`,
      shares: `Reposts: ${sharesDelivered.toLocaleString()} / ${sharesPlanned.toLocaleString()} (${sharesRemaining.toLocaleString()} remaining)`,
    };

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderRef: order.orderRef,
        targetUrl: order.targetUrl,
        platform: order.platform,
        profileId: order.profileId,
        presetKey: order.presetKey || "TikTok Organic Working Preset",
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
        updatedAt: order.updatedAt.toISOString(),
        replanCount: order.replanCount,
        lastReplanReason: order.lastReplanReason,
        enabledTypes,
        plannedTotals: { views: viewsPlanned, likes: likesPlanned, saves: savesPlanned, shares: sharesPlanned },
        deliveredTotals: { views: viewsDelivered, likes: likesDelivered, saves: savesDelivered, shares: sharesDelivered },
        viewsSummary: {
          planned: viewsPlanned,
          delivered: viewsDelivered,
          remaining: viewsRemaining,
          totalRuns: viewsRuns.length,
          completedRuns: viewsRuns.filter((r) => r.status === "completed" || r.status === "confirmed").length,
          percent: viewsPlanned > 0 ? Math.min(100, Math.round((viewsDelivered / viewsPlanned) * 100)) : 0,
        },
        likesSummary: {
          planned: likesPlanned,
          delivered: likesDelivered,
          remaining: likesRemaining,
          totalRuns: likesRuns.length,
          completedRuns: likesRuns.filter((r) => r.status === "completed" || r.status === "confirmed").length,
          percent: likesPlanned > 0 ? Math.min(100, Math.round((likesDelivered / likesPlanned) * 100)) : 0,
        },
        savesSummary: {
          planned: savesPlanned,
          delivered: savesDelivered,
          remaining: savesRemaining,
          totalRuns: savesRuns.length,
          completedRuns: savesRuns.filter((r) => r.status === "completed" || r.status === "confirmed").length,
          percent: savesPlanned > 0 ? Math.min(100, Math.round((savesDelivered / savesPlanned) * 100)) : 0,
        },
        sharesSummary: {
          planned: sharesPlanned,
          delivered: sharesDelivered,
          remaining: sharesRemaining,
          totalRuns: sharesRuns.length,
          completedRuns: sharesRuns.filter((r) => r.status === "completed" || r.status === "confirmed").length,
          percent: sharesPlanned > 0 ? Math.min(100, Math.round((sharesDelivered / sharesPlanned) * 100)) : 0,
        },
        completedRuns,
        totalRuns,
        progressPercent,
        nextRunTime: nextPendingRun ? nextPendingRun.scheduledAt.toISOString() : null,
        planParams,
        expectedCurve,
        statusSamples,
        runs: order.runs.map((r) => ({
          id: r.id,
          engagementType: r.engagementType,
          serviceName:
            r.service?.name ||
            (r.engagementType === "views"
              ? "TikTok Views"
              : r.engagementType === "likes"
              ? "TikTok Likes"
              : r.engagementType === "saves"
              ? "TikTok Saves"
              : r.engagementType === "shares"
              ? "TikTok Reposts"
              : "TikTok Engagement"),
          providerServiceId: r.providerServiceId,
          runNumber: r.runNumber,
          scheduledAt: r.scheduledAt.toISOString(),
          sentAt: r.sentAt ? r.sentAt.toISOString() : null,
          quantity: r.quantity,
          plannedCumulative: r.plannedCumulative,
          deliveredQuantity: r.deliveredQuantity ?? (r.status === "completed" || r.status === "confirmed" ? r.quantity : 0),
          deliveredCumulative: r.deliveredCumulative,
          status: r.status,
          providerOrderId: r.providerOrderId,
          latenessSeconds: r.latenessSeconds ?? 0,
          isReplan: r.isReplan,
          cost: r.cost,
          errorMessage: r.errorMessage,
        })),
        eventLogs: order.eventLogs.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          message: e.message,
          createdAt: e.createdAt.toISOString(),
        })),
        delayedLikesEvents: delayedLikesEvents.map((e) => ({
          id: e.id,
          message: e.message,
          createdAt: e.createdAt.toISOString(),
        })),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to load order" }, { status: 500 });
  }
}

/**
 * Handle manual actions: Sync with upstream providers, Retry a failed run, Refund a run
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const rawId = params.id;
    const body = await request.json().catch(() => ({}));
    const action = body.action || "sync";

    const order = await prisma.engagementOrder.findFirst({
      where: {
        OR: [{ id: rawId }, { orderRef: rawId }],
        ...(session.role === "ADMIN" ? {} : { userId: session.user.id }),
      },
      include: { runs: true },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    if (action === "sync") {
      // 1. Run smart synchronization check (Delayed Likes Protection)
      const now = new Date();
      await checkAndApplyDelayedLikesProtection(order.id, now).catch(() => {});
      
      // 2. Run engagement worker tick for delivery status updates
      await runEngagementTick().catch(() => {});

      return NextResponse.json({
        success: true,
        message: "Order synchronized with upstream providers and Delayed Likes Protection checked.",
      });
    }

    if (action === "retry_run") {
      const runId = body.runId;
      if (!runId) {
        return NextResponse.json({ success: false, error: "runId is required" }, { status: 400 });
      }

      const run = order.runs.find((r) => r.id === runId);
      if (!run) {
        return NextResponse.json({ success: false, error: "Run not found in this order" }, { status: 404 });
      }

      if (!["failed", "delayed"].includes(run.status)) {
        return NextResponse.json({ success: false, error: `Run cannot be retried from '${run.status}' status` }, { status: 400 });
      }

      // Check if another run for this metric is currently in-flight
      const activeInFlight = order.runs.some(
        (r) => r.id !== run.id && r.engagementType === run.engagementType && ["sending", "sent"].includes(r.status)
      );
      const scheduledAt = activeInFlight
        ? new Date(Date.now() + 5 * 60 * 1000)
        : new Date();

      await prisma.engagementRun.update({
        where: { id: run.id },
        data: {
          status: "scheduled",
          scheduledAt,
          attempts: 0,
          errorMessage: null,
          isReplan: true,
        },
      });

      // Also reset parent order to PROCESSING if it had failed
      if (order.status === "FAILED" || order.status === "PARTIAL" || order.status === "COMPLETED") {
        await prisma.engagementOrder.update({
          where: { id: order.id },
          data: { status: "PROCESSING" },
        });
      }

      return NextResponse.json({
        success: true,
        message: `Run #${run.runNumber} scheduled for ${activeInFlight ? "staggered retry in 5m (waiting for in-flight batch)" : "immediate retry"}.`,
      });
    }

    if (action === "retry_all_failed") {
      const failedRuns = order.runs.filter((r) => r.status === "failed");
      if (failedRuns.length === 0) {
        return NextResponse.json({ success: false, error: "No failed runs to retry" }, { status: 400 });
      }

      const now = Date.now();
      for (let i = 0; i < failedRuns.length; i++) {
        const fr = failedRuns[i];
        await prisma.engagementRun.update({
          where: { id: fr.id },
          data: {
            status: "scheduled",
            scheduledAt: new Date(now + i * 20 * 60 * 1000),
            attempts: 0,
            errorMessage: null,
            isReplan: true,
          },
        });
      }

      await prisma.engagementOrder.update({
        where: { id: order.id },
        data: { status: "PROCESSING" },
      });

      return NextResponse.json({
        success: true,
        message: `${failedRuns.length} failed runs rescheduled safely spaced 20 minutes apart.`,
      });
    }

    if (action === "refund_run") {
      if (session.role !== "ADMIN") {
        return NextResponse.json({ success: false, error: "Only administrators can manually refund runs." }, { status: 403 });
      }

      const runId = body.runId;
      const run = order.runs.find((r) => r.id === runId);
      if (!run) {
        return NextResponse.json({ success: false, error: "Run not found" }, { status: 404 });
      }

      if (run.cost <= 0) {
        return NextResponse.json({ success: false, error: "Run cost is zero, nothing to refund." }, { status: 400 });
      }

      if (!order.userId) {
        return NextResponse.json({ success: false, error: "Order has no associated user account." }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: order.userId! } });
        if (!user) throw new Error("User not found");

        const newBal = Number(((user.walletBalance ?? 0) + run.cost).toFixed(2));
        await tx.user.update({
          where: { id: user.id },
          data: { walletBalance: newBal },
        });

        await tx.walletTransaction.create({
          data: {
            userId: user.id,
            type: "REFUND",
            amount: run.cost,
            balanceAfter: newBal,
            referenceId: order.orderRef,
            description: `Manual admin refund for ${run.engagementType} batch #${run.runNumber} on order ${order.orderRef}`,
          },
        });

        await tx.engagementRun.update({
          where: { id: run.id },
          data: { status: "cancelled", errorMessage: "Manually refunded by admin." },
        });

        await tx.engagementOrder.update({
          where: { id: order.id },
          data: { refundedAmount: { increment: run.cost } },
        });
      });

      return NextResponse.json({
        success: true,
        message: `Refunded ₹${run.cost.toFixed(2)} for batch #${run.runNumber} to user wallet.`,
      });
    }

    return NextResponse.json({ success: false, error: "Unsupported action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to process action" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/likes-analyze/[id]
 * Full monitoring state: session config, snapshot history, persisted
 * checkpoint schedule, linked delivery jobs, budget/quantity usage,
 * and the monitoring audit trail.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthSession(request);
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const session = await prisma.monitoringSession.findUnique({
      where: { id: params.id },
      include: {
        service: true,
        checkpoints: { orderBy: { sequence: "asc" } },
        snapshots: { orderBy: { sequence: "asc" } },
        events: { orderBy: { createdAt: "desc" }, take: 30 },
        order: {
          include: {
            steps: { orderBy: { stepNumber: "asc" } },
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ success: false, error: "Monitoring session not found." }, { status: 404 });
    }

    // Ownership check: non-admins can only view their own sessions
    if (auth.role !== "ADMIN" && session.userId !== auth.user.id) {
      return NextResponse.json({ success: false, error: "Monitoring session not found." }, { status: 404 });
    }
    const submittedSteps = (session.order?.steps || []).filter((s) =>
      ["PROCESSING", "SUBMITTED", "COMPLETED"].includes(s.status)
    );
    const pendingSteps = (session.order?.steps || []).filter((s) =>
      ["PENDING", "PAUSED"].includes(s.status)
    );
    const processingSteps = (session.order?.steps || []).filter((s) => s.status === "PROCESSING");
    const failedSteps = (session.order?.steps || []).filter((s) => s.status === "FAILED");
    const committedSteps = [...submittedSteps, ...pendingSteps, ...processingSteps];

    const unitCost = session.service.ratePer1000 / 1000;
    const spentQuantity = submittedSteps.reduce((a, s) => a + s.quantity, 0);
    const committedQuantity = committedSteps.reduce((a, s) => a + s.quantity, 0);
    const spentAmount = Number((spentQuantity * unitCost).toFixed(4));
    const budgetRemaining = Math.max(0, Number((session.budgetCap - spentAmount).toFixed(4)));
    const quantityRemaining = Math.max(0, session.quantityCap - committedQuantity);

    const freshSnapshots = session.snapshots.filter((s) => s.isFresh);
    const lastFresh = [...freshSnapshots].reverse().find(() => true) || null;

    const uniqueMissed = new Set(session.checkpoints.filter((c) => c.status === "MISSED").map((c) => c.id));

    // Total observed gains from the initial snapshot (if any) to the latest fresh one.
    const initialLikes = session.initialLikes ?? null;
    const initialViews = session.initialViews ?? null;
    const latestFresh = lastFresh;
    const totalLikesGained =
      latestFresh && initialLikes !== null && latestFresh.likes !== null ? Math.max(0, latestFresh.likes - initialLikes) : null;
    const totalViewsGained =
      latestFresh && initialViews !== null && latestFresh.views !== null ? Math.max(0, latestFresh.views - initialViews) : null;

    // Historical engagement ratio: mean of fresh observed ratios.
    const ratios = freshSnapshots
      .map((s) => s.ratio)
      .filter((r): r is number => typeof r === "number" && Number.isFinite(r));

    const warnings: string[] = [];
    if (session.snapshots.some((s) => !s.isFresh) || session.analyticsSource === "NO_APPROVED_ANALYTICS_SOURCE") {
      warnings.push(
        session.analyticsSource === "NO_APPROVED_ANALYTICS_SOURCE"
          ? "No authorized analytics data source is configured; engagement metrics are unavailable."
          : "Some snapshots lack reliable metrics; the affected intervals are marked accordingly."
      );
    }
    if (uniqueMissed.size > 0) warnings.push(`${uniqueMissed.size} monitoring checkpoint(s) were missed and recorded their delay.`);
    for (const s of failedSteps) {
      if (s.errorMessage) warnings.push(`Batch #${s.stepNumber} failed: ${s.errorMessage}`);
    }

    return NextResponse.json({
      success: true,
      session: {
        ...session,
        order: session.order
          ? { ...session.order, steps: session.order.steps }
          : null,
      },
      analytics: {
        totalLikesGained,
        totalViewsGained,
        observedRatio: ratios.length > 0 ? Number((ratios.reduce((a, b) => a + b, 0) / ratios.length).toFixed(5)) : null,
        dataFreshness: {
          freshCount: freshSnapshots.length,
          totalSnapshots: session.snapshots.length,
        },
      },
      budget: {
        cap: session.budgetCap,
        spent: spentAmount,
        remaining: budgetRemaining,
        unitCost,
      },
      quantity: {
        cap: session.quantityCap,
        committed: committedQuantity,
        remaining: quantityRemaining,
        pendingQuantity: pendingSteps.reduce((a, s) => a + s.quantity, 0),
      },
      jobs: {
        pending: pendingSteps,
        inProgress: processingSteps,
        submitted: submittedSteps,
        failed: failedSteps,
      },
      missedCheckpointCount: uniqueMissed.size,
      warnings,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load monitoring session" },
      { status: 500 }
    );
  }
}

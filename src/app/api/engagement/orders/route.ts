import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orders = await prisma.engagementOrder.findMany({
      where: session.role === "ADMIN" ? {} : { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        runs: {
          select: {
            id: true,
            engagementType: true,
            scheduledAt: true,
            quantity: true,
            status: true,
            providerOrderId: true,
            attempts: true,
            errorMessage: true,
            cost: true,
          },
          orderBy: { scheduledAt: "asc" },
        },
      },
      take: 50,
    });

    const now = new Date();

    const formatted = orders.map((o) => {
      const nextPendingRun = o.runs.find(
        (r) => (r.status === "PENDING" || r.status === "scheduled" || r.status === "delayed") && new Date(r.scheduledAt) > now
      );
      const totalRuns = o.runs.length;
      const completedRuns = o.runs.filter(
        (r) => r.status === "COMPLETED" || r.status === "completed" || r.status === "sent"
      ).length;
      const progressPercent = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;
      
      const cancellableRuns = o.runs.filter(
        (r) => r.status === "PENDING" || r.status === "scheduled" || r.status === "delayed"
      );
      const remainingRefundableCost = Number(
        cancellableRuns.reduce((sum, r) => sum + r.cost, 0).toFixed(2)
      );

      const estimatedFinishTime = new Date(
        new Date(o.createdAt).getTime() + o.durationHours * 3600 * 1000
      ).toISOString();

      return {
        id: o.id,
        orderRef: o.orderRef,
        targetUrl: o.targetUrl,
        platform: o.platform,
        profileId: (o as any).profileId,
        presetKey: (o as any).presetKey,
        baseViews: o.baseViews,
        durationHours: o.durationHours,
        status: o.status,
        totalCost: o.totalCost,
        refundedAmount: o.refundedAmount,
        remainingRefundableCost,
        cancellableRunsCount: cancellableRuns.length,
        progressPercent,
        nextRunTime: nextPendingRun ? nextPendingRun.scheduledAt : null,
        estimatedFinishTime,
        enabledTypes: (o as any).enabledTypes || ["views", "likes", "saves", "shares", "comments"],
        sources: {
          views: (o as any).viewsSource || "suggested",
          likes: (o as any).likesSource || "suggested",
          saves: (o as any).savesSource || "suggested",
          shares: (o as any).sharesSource || "suggested",
          comments: (o as any).commentsSource || "suggested",
        },
        breakdown: {
          views: { planned: o.plannedViews, delivered: o.deliveredViews },
          likes: { planned: o.plannedLikes, delivered: o.deliveredLikes },
          shares: { planned: o.plannedShares, delivered: o.deliveredShares },
          saves: { planned: o.plannedSaves, delivered: o.deliveredSaves },
          comments: { planned: o.plannedComments, delivered: o.deliveredComments },
        },
        runsCount: totalRuns,
        completedRuns,
        recentRuns: o.runs.slice(0, 10).map((r) => ({
          id: r.id,
          type: r.engagementType,
          quantity: r.quantity,
          scheduledAt: r.scheduledAt,
          status: r.status,
          attempts: r.attempts,
        })),
        createdAt: o.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      orders: formatted,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch engagement orders" },
      { status: 500 }
    );
  }
}

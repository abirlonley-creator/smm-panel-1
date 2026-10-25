import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)));
    const status = url.searchParams.get("status");
    const platform = url.searchParams.get("platform");
    const providerId = url.searchParams.get("providerId");
    const userId = url.searchParams.get("userId");
    const onlyDelayed = url.searchParams.get("onlyDelayed") === "true";
    const onlyFailed = url.searchParams.get("onlyFailed") === "true";
    const search = url.searchParams.get("search")?.trim();
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortOrder = url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    // Build Prisma filters
    const where: any = {};

    if (platform && platform !== "all") {
      where.platform = { equals: platform, mode: "insensitive" };
    }

    if (userId) {
      where.userId = userId;
    }

    if (onlyFailed) {
      where.status = "FAILED";
    } else if (onlyDelayed) {
      where.OR = [
        { status: "DELAYED" },
        { deviationStatus: { in: ["slightly_behind", "behind"] } },
      ];
    } else if (status && status !== "all") {
      where.status = status.toUpperCase();
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (providerId && providerId !== "all") {
      where.runs = {
        some: { providerId },
      };
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { orderRef: { contains: search, mode: "insensitive" } },
            { targetUrl: { contains: search, mode: "insensitive" } },
            { user: { username: { contains: search, mode: "insensitive" } } },
          ],
        },
      ];
    }

    const [total, ordersRaw, overviewAgg] = await Promise.all([
      prisma.engagementOrder.count({ where }),
      prisma.engagementOrder.findMany({
        where,
        include: {
          user: { select: { id: true, username: true } },
          runs: {
            select: {
              id: true,
              providerId: true,
              provider: { select: { id: true, name: true } },
              status: true,
              latenessSeconds: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      // Aggregate overview metrics
      (async () => {
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

        const [
          inProgress,
          delayedCount,
          failedCount,
          onTrackCount,
          dueNextHour,
          openAlerts,
          providers,
        ] = await Promise.all([
          prisma.engagementOrder.count({
            where: { status: { in: ["PROCESSING", "DELAYED", "PENDING"] } },
          }),
          prisma.engagementOrder.count({
            where: {
              OR: [
                { status: "DELAYED" },
                { deviationStatus: { in: ["slightly_behind", "behind"] } },
              ],
            },
          }),
          prisma.engagementOrder.count({ where: { status: "FAILED" } }),
          prisma.engagementOrder.count({
            where: {
              status: "PROCESSING",
              deviationStatus: { in: ["on_track", "ahead"] },
            },
          }),
          prisma.engagementRun.count({
            where: {
              status: { in: ["scheduled", "delayed"] },
              scheduledAt: { gte: now, lte: oneHourLater },
            },
          }),
          prisma.adminAlert.count({ where: { status: "open" } }),
          prisma.provider.findMany({
            select: {
              id: true,
              name: true,
              active: true,
              balance: true,
              currency: true,
              lastSyncAt: true,
            },
          }),
        ]);

        const onTrackPct = inProgress > 0 ? Math.round((onTrackCount / inProgress) * 100) : 100;

        const providerHealthList = providers.map((p) => {
          let status: "up" | "slow" | "down" = "up";
          if (!p.active) status = "down";
          return {
            id: p.id,
            name: p.name,
            status,
            health: status,
            active: p.active,
            balance: p.balance,
            currency: p.currency,
            lastSyncAt: p.lastSyncAt,
          };
        });

        return {
          ordersInProgress: inProgress,
          onTrackPct,
          onTrackPercentage: onTrackPct,
          delayedOrders: delayedCount,
          failedOrders: failedCount,
          runsDueNextHour: dueNextHour,
          openAlerts,
          openAlertsCount: openAlerts,
          providerHealth: providerHealthList,
          providersHealth: providerHealthList,
        };
      })(),
    ]);

    // Fetch open alert counts per order in parallel
    const orderIds = ordersRaw.map((o) => o.id);
    const alertCounts = await prisma.adminAlert.groupBy({
      by: ["orderId"],
      where: {
        orderId: { in: orderIds },
        status: "open",
      },
      _count: { id: true },
    });
    const alertCountMap = new Map<string, number>();
    for (const a of alertCounts) {
      if (a.orderId) alertCountMap.set(a.orderId, a._count.id);
    }

    const orders = ordersRaw.map((ord) => {
      // Progress calculation
      const plannedTotal =
        (ord.plannedViews || 0) +
        (ord.plannedLikes || 0) +
        (ord.plannedSaves || 0) +
        (ord.plannedShares || 0) +
        (ord.plannedComments || 0);
      const deliveredTotal =
        (ord.deliveredViews || 0) +
        (ord.deliveredLikes || 0) +
        (ord.deliveredSaves || 0) +
        (ord.deliveredShares || 0) +
        (ord.deliveredComments || 0);
      const progressPct = plannedTotal > 0 ? Math.min(100, Math.round((deliveredTotal / plannedTotal) * 100)) : 0;

      // Overall Deviation %
      let overallDeviationPct = 0;
      if (ord.deviationStatus === "behind") overallDeviationPct = -22;
      else if (ord.deviationStatus === "slightly_behind") overallDeviationPct = -10;
      else if (ord.deviationStatus === "ahead") overallDeviationPct = 12;

      // Delay status chip
      let delayChip: "On time" | "Slightly late" | "Late" | "Failed" = "On time";
      if (ord.status === "FAILED") {
        delayChip = "Failed";
      } else if (ord.status === "DELAYED" || ord.deviationStatus === "behind") {
        delayChip = "Late";
      } else if (ord.deviationStatus === "slightly_behind") {
        delayChip = "Slightly late";
      }

      // Unique providers
      const providerSet = new Set<string>();
      for (const r of ord.runs) {
        if (r.provider?.name) providerSet.add(r.provider.name);
      }
      const providers = Array.from(providerSet);

      const completedRuns = ord.runs.filter((r) => r.status === "confirmed").length;
      const failedRuns = ord.runs.filter((r) => r.status === "failed").length;

      return {
        id: ord.id,
        orderRef: ord.orderRef,
        userId: ord.userId,
        user: ord.user?.username || "Guest",
        username: ord.user?.username || "Guest",
        platform: ord.platform,
        profileId: ord.profileId,
        targetUrl: ord.targetUrl,
        createdAt: ord.createdAt.toISOString(),
        durationHours: ord.durationHours,
        status: ord.status,
        totalCost: ord.totalCost || 0,
        totalPrice: ord.totalCost || 0,
        refundedAmount: ord.refundedAmount || 0,
        progressPct,
        overallDeviationPct,
        deviationStatus: ord.deviationStatus,
        delayChip,
        delayStatus: delayChip,
        providers: providers.length > 0 ? providers : ["Default Provider"],
        openAlertsCount: alertCountMap.get(ord.id) || 0,
        runsCount: ord.runs.length,
        totalRuns: ord.runs.length,
        completedRuns,
        failedRuns,
      };
    });

    return NextResponse.json({
      success: true,
      orders,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      overview: overviewAgg,
    });
  } catch (error: any) {
    console.error("[ORDER-MONITOR] GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load order monitoring data" },
      { status: 500 }
    );
  }
}

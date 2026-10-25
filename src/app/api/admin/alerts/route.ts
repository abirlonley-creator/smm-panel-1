import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [alerts, openCount, allRunsToday, providers] = await Promise.all([
      prisma.adminAlert.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.adminAlert.count({
        where: { status: "open" },
      }),
      prisma.engagementRun.findMany({
        where: {
          scheduledAt: { gte: today },
          status: { in: ["completed", "failed", "COMPLETED", "FAILED"] },
        },
        select: {
          status: true,
          latenessSeconds: true,
        },
      }),
      prisma.provider.findMany({
        select: {
          id: true,
          name: true,
          active: true,
          balance: true,
          currency: true,
          lastSyncAt: true,
          isMock: true,
        },
      }),
    ]);

    // Calculate On-Time Percentage & Average Lateness
    let onTimeCount = 0;
    let totalLateness = 0;
    let completedRuns = 0;
    let failedRunsToday = 0;

    for (const r of allRunsToday) {
      const isComplete = r.status.toLowerCase() === "completed";
      const isFailed = r.status.toLowerCase() === "failed";

      if (isFailed) failedRunsToday++;
      if (isComplete) {
        completedRuns++;
        const late = r.latenessSeconds || 0;
        if (late <= 30) onTimeCount++;
        totalLateness += late;
      }
    }

    const onTimePercentage = completedRuns > 0 ? Number(((onTimeCount / completedRuns) * 100).toFixed(1)) : 100.0;
    const avgLatenessSeconds = completedRuns > 0 ? Math.round(totalLateness / completedRuns) : 0;

    return NextResponse.json({
      success: true,
      alerts,
      metrics: {
        openAlertsCount: openCount,
        onTimePercentage,
        avgLatenessSeconds,
        failedRunsToday,
        totalCompletedToday: completedRuns,
        providersStatus: providers.map((p) => ({
          id: p.id,
          name: p.name,
          active: p.active,
          balance: p.balance,
          currency: p.currency,
          lastSyncAt: p.lastSyncAt,
          isMock: p.isMock,
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load alerts" },
      { status: 500 }
    );
  }
}

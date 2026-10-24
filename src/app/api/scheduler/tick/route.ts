import { NextResponse } from "next/server";
import { runSchedulerTick } from "@/lib/scheduler/runner";
import { runMonitoringTick } from "@/lib/monitoring/engine";
import { runScheduledJobsTick } from "@/lib/scheduler/job-runner";
import { runEngagementTick } from "@/lib/engagement/worker";
import { runDripFeedTick } from "@/lib/orders/drip-feed-worker";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Executes a full tick cycle across:
 * 1. Likes Analyze monitoring sessions (claims due checkpoints, captures snapshots, computes view batches)
 * 2. Scheduled delivery steps (submits due view batches to provider)
 * 3. Scheduled order jobs (bulk orders, combo jobs)
 * 4. Full Engagement organic runs (S-curve batches and auto-refunds)
 * 5. Drip Feed random range runs (staggered batches and auto-refunds)
 */
async function executeTickCycle() {
  const monitoringResult = await runMonitoringTick();
  const result = await runSchedulerTick();
  const scheduledJobsResult = await runScheduledJobsTick();
  const engagementResult = await runEngagementTick();
  const dripFeedResult = await runDripFeedTick();
  return {
    success: true,
    timestamp: new Date().toISOString(),
    monitoring: monitoringResult,
    deliverySteps: result,
    scheduledJobs: scheduledJobsResult,
    engagementRuns: engagementResult,
    dripFeedRuns: dripFeedResult,
    ...result,
  };
}

export async function POST() {
  try {
    const data = await executeTickCycle();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[SCHEDULER-TICK] Error running tick:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Scheduler tick encountered an error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/scheduler/tick
 * Runs the tick cycle by default so any external cron service (cron-job.org,
 * GitHub Actions, UptimeRobot, Vercel Cron) can trigger it with a simple GET.
 * Pass ?inspect=true to only view pending step counts without triggering work.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  if (url.searchParams.get("inspect") === "true") {
    try {
      const now = new Date();
      const [dueCount, upcomingCount, failedCount, nextDue] = await Promise.all([
        prisma.scheduledDeliveryStep.count({
          where: { status: "PENDING", scheduledTime: { lte: now } },
        }),
        prisma.scheduledDeliveryStep.count({
          where: { status: "PENDING", scheduledTime: { gt: now } },
        }),
        prisma.scheduledDeliveryStep.count({
          where: { status: "FAILED" },
        }),
        prisma.scheduledDeliveryStep.findFirst({
          where: { status: "PENDING" },
          orderBy: { scheduledTime: "asc" },
          include: { order: { select: { orderRef: true, targetUrl: true } } },
        }),
      ]);

      return NextResponse.json({
        success: true,
        dueCount,
        upcomingCount,
        failedCount,
        nextDueStep: nextDue,
      });
    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: error.message || "Failed to inspect scheduler status" },
        { status: 500 }
      );
    }
  }

  try {
    const data = await executeTickCycle();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[SCHEDULER-TICK] Error running tick via GET:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Scheduler tick encountered an error" },
      { status: 500 }
    );
  }
}

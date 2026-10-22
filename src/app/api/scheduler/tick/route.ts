import { NextResponse } from "next/server";
import { runSchedulerTick } from "@/lib/scheduler/runner";
import { runMonitoringTick } from "@/lib/monitoring/engine";
import { runScheduledJobsTick } from "@/lib/scheduler/job-runner";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const monitoringResult = await runMonitoringTick();
    const result = await runSchedulerTick();
    const scheduledJobsResult = await runScheduledJobsTick();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      monitoring: monitoringResult,
      deliverySteps: result,
      scheduledJobs: scheduledJobsResult,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Scheduler tick encountered an error" },
      { status: 500 }
    );
  }
}

export async function GET() {
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

import { prisma } from "@/lib/prisma";
import { recordAdminAlert } from "./alert-service";
import { logOrderEvent } from "./event-logger";

export interface WatchdogResult {
  heartbeatHealthy: boolean;
  heartbeatAgeSeconds: number;
  stuckRunsRecovered: number;
  missedRunsRecovered: number;
}

/**
 * Executes the Watchdog verification cycle:
 * 1. Verifies worker heartbeat (raises HIGH alert if > 60s stale)
 * 2. Recovers runs stuck in 'claimed' or 'sending' > 2 minutes
 * 3. Discovers missed scheduled runs and queues them immediately with recorded lateness
 */
export async function runWatchdogCycle(): Promise<WatchdogResult> {
  const now = new Date();
  let stuckRecovered = 0;
  let missedRecovered = 0;

  // 1. Heartbeat Check
  let heartbeatHealthy = true;
  let heartbeatAgeSeconds = 0;

  const workerStatus = await prisma.workerStatus.findUnique({
    where: { id: "singleton" },
  });

  if (workerStatus) {
    heartbeatAgeSeconds = Math.max(0, Math.round((now.getTime() - workerStatus.lastHeartbeatAt.getTime()) / 1000));
    if (heartbeatAgeSeconds > 60) {
      heartbeatHealthy = false;
      await recordAdminAlert({
        severity: "high",
        type: "watchdog_heartbeat",
        reason: `Worker heartbeat missing for ${heartbeatAgeSeconds}s (last heartbeat: ${workerStatus.lastHeartbeatAt.toISOString()}). Worker may have crashed.`,
        suggestedAction: "Check worker process logs or restart the worker container / Edge Function cron.",
      });
    }
  } else {
    // Create initial singleton heartbeat record
    await prisma.workerStatus.create({
      data: {
        id: "singleton",
        lastHeartbeatAt: now,
        status: "RUNNING",
      },
    });
  }

  // 2. Stuck Runs Recovery (stuck in 'claimed' or 'sending' longer than 2 minutes)
  const stuckCutoff = new Date(now.getTime() - 2 * 60 * 1000);
  const stuckRuns = await prisma.engagementRun.findMany({
    where: {
      status: { in: ["claimed", "sending"] },
      OR: [
        { lastAttemptAt: { lte: stuckCutoff } },
        { claimedAt: { lte: stuckCutoff } },
      ],
    },
    include: {
      engagementOrder: true,
      provider: true,
    },
    take: 20,
  });

  for (const run of stuckRuns) {
    if (run.providerOrderId) {
      // Order ID already exists: it was sent before interruption. Safely transition to 'sent'.
      await prisma.engagementRun.update({
        where: { id: run.id },
        data: {
          status: "sent",
          sentAt: run.sentAt || now,
        },
      });

      await logOrderEvent({
        orderId: run.engagementOrderId,
        runId: run.id,
        eventType: "WATCHDOG",
        message: `Watchdog recovered stuck run #${run.runNumber}: confirmed existing provider order ID ${run.providerOrderId} as sent.`,
      });
      stuckRecovered++;
    } else {
      // No order ID yet: safely transition to 'delayed' with backoff to prevent double-send
      await prisma.engagementRun.update({
        where: { id: run.id },
        data: {
          status: "delayed",
          scheduledAt: new Date(now.getTime() + 15 * 1000), // Retry in 15 seconds
          errorMessage: "Watchdog recovered run from interrupted send cycle.",
        },
      });

      await recordAdminAlert({
        severity: "medium",
        type: "watchdog_stuck",
        orderId: run.engagementOrderId,
        runId: run.id,
        runNumber: run.runNumber,
        providerId: run.providerId || null,
        providerName: run.provider?.name || null,
        reason: `Run #${run.runNumber} was stuck in "${run.status}" for > 2 minutes without order ID. Reset to delayed for safe retry.`,
        suggestedAction: "Watchdog has reset the run to delayed. Monitor provider connectivity.",
      });

      await logOrderEvent({
        orderId: run.engagementOrderId,
        runId: run.id,
        eventType: "WATCHDOG",
        message: `Watchdog recovered stuck run #${run.runNumber}: reset to delayed without duplicate dispatch.`,
      });
      stuckRecovered++;
    }
  }

  // 3. Missed Runs Detection: runs scheduled > 60s in past that were never claimed
  const missedCutoff = new Date(now.getTime() - 60 * 1000);
  const missedRuns = await prisma.engagementRun.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { lte: missedCutoff },
      claimedAt: null,
    },
    include: {
      engagementOrder: true,
    },
    take: 20,
  });

  for (const missed of missedRuns) {
    const latenessSeconds = Math.max(0, Math.round((now.getTime() - missed.scheduledAt.getTime()) / 1000));
    // Re-schedule immediately without shifting or compressing future runs
    await prisma.engagementRun.update({
      where: { id: missed.id },
      data: {
        scheduledAt: now,
        latenessSeconds,
      },
    });

    await logOrderEvent({
      orderId: missed.engagementOrderId,
      runId: missed.id,
      eventType: "WATCHDOG",
      message: `Watchdog identified missed run #${missed.runNumber} (${latenessSeconds}s late) and queued it for immediate execution.`,
    });
    missedRecovered++;
  }

  return {
    heartbeatHealthy,
    heartbeatAgeSeconds,
    stuckRunsRecovered: stuckRecovered,
    missedRunsRecovered: missedRecovered,
  };
}

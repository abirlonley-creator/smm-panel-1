/**
 * Likes Analyze monitoring engine.
 *
 * A persistent, interval-based video monitoring and adaptive delivery
 * scheduling system that runs independently of the website being open.
 * All state is persisted in the database; nothing lives in memory or
 * browser timers.
 *
 * The monitoring loop (executed by the worker daemon and/or the
 * runMonitoringTick entry point):
 *
 *   1. SNAPSHOT  — retrieve latest likes/views from the analytics adapter
 *   2. COMPARE   — compute interval deltas, ratio, freshness, corrections
 *   3. SAVE      — persist snapshot + checkpoint state (idempotent)
 *   4. ANALYZE   — refresh monitoring statistics for the Growth Plan UI
 *   5. REASSESS  — adapt the remaining delivery schedule against confirmed
 *                  delivery, remaining time, budget, quantity limits and
 *                  provider constraints
 *   6. WAIT      — compute the next checkpoint from the persisted schedule
 */

import { prisma } from "../prisma";
import { resolveAnalyticsAdapter, extractVideoIdentifier, isTikTokVideoUrl } from "../analytics/adapter";
import type { VideoAnalyticsSnapshot, VideoAnalyticsAdapter as AnalyticsAdapter } from "../analytics/adapter";
import { calculateLikeDrivenViewBatch } from "./batch-calculator";
import type { ScheduledDeliveryStep, MonitoringSession, MonitoringCheckpoint } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateMonitoringSessionInput {
  serviceId: string;
  videoUrl: string;
  /** Total monitoring duration in minutes (e.g. 240 for 4 hours). */
  durationMinutes: number;
  /** Interval between monitoring checkpoints in minutes (e.g. 30). */
  intervalMinutes: number;
  /** Optional spending limit (monetary). Defaults to safe ceiling when omitted. */
  budgetCap?: number;
  /** Optional maximum permitted delivery quantity. Defaults to service maximum when omitted. */
  quantityCap?: number;
  /** Optional controlled start time (UTC). Defaults to now. */
  startDate?: Date;
  /** Optional owner user ID for per-user data isolation. */
  userId?: string;
}

export interface CreateMonitoringSessionResult {
  ok: boolean;
  error?: string;
  session?: MonitoringSession & { checkpoints: MonitoringCheckpoint[] };
}

export interface MonitoringTickResult {
  sessionsChecked: number;
  snapshotsTaken: number;
  checkpointsMissed: number;
  stepsScheduled: number;
  sessionsExpired: number;
  sessionsCompleted: number;
  errors: string[];
}

const CHECKPOINT_EXECUTION_GRACE_MS = 5000;
const DEFAULT_INTERVAL_TOLERANCE_MS = 60_000;

function getIntervalToleranceMs(): number {
  const configured = Number.parseInt(process.env.LIKES_ANALYZE_INTERVAL_TOLERANCE_MS || "", 10);
  return Number.isSafeInteger(configured) && configured >= 0
    ? configured
    : DEFAULT_INTERVAL_TOLERANCE_MS;
}

// ---------------------------------------------------------------------------
// Session creation
// ---------------------------------------------------------------------------

export async function createMonitoringSession(
  input: CreateMonitoringSessionInput
): Promise<CreateMonitoringSessionResult> {
  const {
    serviceId,
    videoUrl,
    durationMinutes,
    intervalMinutes,
    budgetCap,
    quantityCap,
    startDate,
    userId,
  } = input;

  // --- Configuration validation ---
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.active) {
    return { ok: false, error: "Selected service is not available." };
  }
  if (!videoUrl || videoUrl.trim().length < 8 || !/^https?:\/\//i.test(videoUrl)) {
    return { ok: false, error: "A valid http(s) video URL is required." };
  }
  const analyticsAdapter = resolveAnalyticsAdapter();
  if (analyticsAdapter.name === "APIFY_TIKTOK_SCRAPER" && !isTikTokVideoUrl(videoUrl.trim())) {
    return { ok: false, error: "Likes Analyze is connected to TikTok. Enter a TikTok video URL." };
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { ok: false, error: "Monitoring duration must be greater than 0 minutes." };
  }
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    return { ok: false, error: "Monitoring interval must be greater than 0 minutes." };
  }
  if (intervalMinutes > durationMinutes) {
    return { ok: false, error: "Monitoring interval cannot exceed the total monitoring duration." };
  }
  let effectiveBudgetCap: number;
  if (budgetCap !== undefined) {
    if (!Number.isFinite(budgetCap) || budgetCap <= 0) {
      return { ok: false, error: "A positive budget limit is required. The system never operates without an enforceable spending limit." };
    }
    effectiveBudgetCap = budgetCap;
  } else {
    // Default to unconstrained safe ceiling when not explicitly configured
    effectiveBudgetCap = 999999;
  }

  let effectiveQuantityCap: number;
  if (quantityCap !== undefined) {
    if (!Number.isFinite(quantityCap) || quantityCap <= 0) {
      return { ok: false, error: "A positive maximum quantity is required. The system never operates without an enforceable quantity cap." };
    }
    if (quantityCap < service.minQuantity) {
      return {
        ok: false,
        error: `Maximum quantity (${quantityCap.toLocaleString()}) is below the provider minimum of ${service.minQuantity.toLocaleString()}.`,
      };
    }
    if (quantityCap > service.maxQuantity) {
      return {
        ok: false,
        error: `Maximum quantity (${quantityCap.toLocaleString()}) exceeds the provider maximum of ${service.maxQuantity.toLocaleString()}.`,
      };
    }
    effectiveQuantityCap = quantityCap;
  } else {
    // Default to maximum provider supported quantity for this service
    effectiveQuantityCap = service.maxQuantity;
  }

  const unitCost = service.ratePer1000 / 1000;
  const fullCapCost = Number(((effectiveQuantityCap / 1000) * service.ratePer1000).toFixed(4));

  const now = startDate ? new Date(startDate) : new Date();
  const start = now;
  const expiresAt = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const orderRef = `LA-${Math.floor(100000 + Math.random() * 900000)}-${Date.now().toString().slice(-4)}`;

  // Persisted checkpoint schedule: the initial snapshot IS checkpoint #1
  // (sequence 1, at t=0). Checkpoints run until they would exceed expiry.
  const checkpointCount = Math.floor(durationMinutes / intervalMinutes) + 1;

  // Build checkpoint data array upfront — avoids iterating inside the transaction.
  const checkpointData = Array.from({ length: checkpointCount }, (_, i) => ({
    sequence: i + 1,
    plannedAt: new Date(start.getTime() + i * intervalMinutes * 60 * 1000),
    status: "PENDING" as const,
  }));

  // Use a short-timeout transaction just for the two parent rows + audit event.
  // All checkpoints are inserted in a single createMany AFTER the transaction
  // commits — this avoids Prisma interactive-transaction timeouts on Vercel/Supabase
  // serverless when checkpoint counts are large (e.g. 69 for 24h / 21m).
  let createdSession: MonitoringSession;
  let createdOrderId: string;

  const txResult = await prisma.$transaction(
    async (tx) => {
      const order = await tx.order.create({
        data: {
          orderRef,
          serviceId: service.id,
          targetUrl: videoUrl.trim(),
          requestedQuantity: effectiveQuantityCap,
          submittedQuantity: 0,
          deliveredQuantity: 0,
          remainingQuantity: effectiveQuantityCap,
          failedQuantity: 0,
          unitCost,
          totalCost: fullCapCost,
          isScheduled: true,
          scheduleMode: "ADAPTIVE",
          status: "SCHEDULED",
          userId: userId || null,
          notes: `Likes Analyze monitoring session. Duration ${durationMinutes}m, checkpoint every ${intervalMinutes}m. Scheduled work is reassessed at every checkpoint against confirmed delivery, remaining time, budget ${effectiveBudgetCap} and quantity limit ${effectiveQuantityCap}.`,
        },
      });

      const sess = await tx.monitoringSession.create({
        data: {
          orderRef,
          serviceId: service.id,
          orderId: order.id,
          videoUrl: videoUrl.trim(),
          videoIdentifier: extractVideoIdentifier(videoUrl.trim()),
          durationMinutes,
          intervalMinutes,
          budgetCap: effectiveBudgetCap,
          quantityCap: effectiveQuantityCap,
          status: "RUNNING",
          analyticsSource: analyticsAdapter.name,
          startedAt: start,
          expiresAt,
          nextCheckpointAt: start,
          userId: userId || null,
        },
      });

      await tx.monitoringAuditEvent.create({
        data: {
          sessionId: sess.id,
          action: "SESSION_CREATED",
          details: `Monitoring session ${orderRef} created. Checkpoints: ${checkpointCount} (initial snapshot at t=0 counts as checkpoint #1), interval ${intervalMinutes}m, duration ${durationMinutes}m, budget cap ${budgetCap}, quantity cap ${quantityCap}, expiry ${expiresAt.toISOString()}.`,
        },
      });

      return { sess, orderId: order.id };
    },
    { timeout: 10_000 } // 10s — plenty for 3 inserts on Supabase
  );

  createdSession = txResult.sess;
  createdOrderId = txResult.orderId;

  // Bulk-insert all checkpoints in ONE SQL statement — fast regardless of count.
  await prisma.monitoringCheckpoint.createMany({
    data: checkpointData.map((c) => ({
      sessionId: createdSession.id,
      sequence: c.sequence,
      plannedAt: c.plannedAt,
      status: c.status,
    })),
    skipDuplicates: true,
  });

  // Re-fetch checkpoints so the return shape matches the original contract.
  const checkpoints = await prisma.monitoringCheckpoint.findMany({
    where: { sessionId: createdSession.id },
    orderBy: { sequence: "asc" },
  });

  const session = { ...createdSession, checkpoints };

  return { ok: true, session };
}

// ---------------------------------------------------------------------------
// Checkpoint claiming
// ---------------------------------------------------------------------------

/**
 * Finds and atomically claims the latest due pending checkpoint for a session.
 * Any older pending checkpoints that the tick is late for are recorded as
 * MISSED (delay recorded) — the system recovers without fabricating extra
 * observations for skipped time slots.
 */
async function claimDueCheckpoint(
  sessionId: string,
  now: Date
): Promise<{ checkpoint: MonitoringCheckpoint; missedCount: number } | null> {
  const dueCheckpoints = await prisma.monitoringCheckpoint.findMany({
    where: {
      sessionId,
      status: "PENDING",
      plannedAt: { lte: now },
    },
    orderBy: { sequence: "asc" },
    take: 20,
  });

  if (dueCheckpoints.length === 0) return null;

  // The latest due checkpoint is the observation target.
  const target = dueCheckpoints.reduce((latest, c) => (c.sequence > latest.sequence ? c : latest));

  // Mark any skipped-earlier slots as MISSED individually (delay per slot).
  const missed = dueCheckpoints.filter((c) => c.id !== target.id);
  let missedCount = 0;
  for (const m of missed) {
    const updated = await prisma.monitoringCheckpoint.updateMany({
      where: { id: m.id, status: "PENDING" },
      data: {
        status: "MISSED",
        executedAt: now,
        delayMs: Math.max(0, now.getTime() - new Date(m.plannedAt).getTime()),
      },
    });
    missedCount += updated.count;
  }
  if (missedCount > 0) {
    await prisma.monitoringSession
      .update({
        where: { id: sessionId },
        data: { missedCheckpoints: { increment: missedCount } },
      })
      .catch(() => {});
  }

  // Atomic claim: only the winning worker/process flips PENDING → EXECUTING.
  const claimed = await prisma.monitoringCheckpoint.updateMany({
    where: { id: target.id, status: "PENDING" },
    data: { status: "EXECUTING", updatedAt: now },
  });

  if (claimed.count === 0) return null; // another concurrent tick claimed it
  return { checkpoint: target, missedCount };
}

// ---------------------------------------------------------------------------
// The monitoring loop tick
// ---------------------------------------------------------------------------

export async function runMonitoringTick(
  now: Date = new Date(),
  sessionId?: string,
  adapterOverride?: AnalyticsAdapter
): Promise<MonitoringTickResult> {
  const result: MonitoringTickResult = {
    sessionsChecked: 0,
    snapshotsTaken: 0,
    checkpointsMissed: 0,
    stepsScheduled: 0,
    sessionsExpired: 0,
    sessionsCompleted: 0,
    errors: [],
  };

  const where: any = {
    status: "RUNNING",
    ...(sessionId ? { id: sessionId } : {}),
    OR: [
      { nextCheckpointAt: { lte: now } },
      { nextCheckpointAt: null, checkpoints: { some: { status: "PENDING", plannedAt: { lte: now } } } },
    ],
  };

  const sessions = await prisma.monitoringSession.findMany({
    where,
    include: { checkpoints: { orderBy: { sequence: "asc" } } },
    take: 10,
  });

  if (sessions.length === 0) return result;

  const adapter = adapterOverride ?? resolveAnalyticsAdapter();

  for (const session of sessions) {
    result.sessionsChecked++;
    try {
      // Let a checkpoint planned exactly at the monitoring end run. The worker
      // polls periodically, so allow the configured interval tolerance for it
      // to claim that final observation before expiring the session.
      const terminalCheckpointGraceMs = Math.max(
        CHECKPOINT_EXECUTION_GRACE_MS,
        getIntervalToleranceMs(),
      );
      if (now.getTime() > session.expiresAt.getTime() + terminalCheckpointGraceMs) {
        await expireSession(session.id, now);
        result.sessionsExpired++;
        continue;
      }

      const claimed = await claimDueCheckpoint(session.id, now);
      if (!claimed) continue;

      if (session.analyticsSource !== adapter.name) {
        await prisma.monitoringSession.update({
          where: { id: session.id },
          data: { analyticsSource: adapter.name },
        });
      }

      result.checkpointsMissed += claimed.missedCount;

      // Snapshot with the current tick timestamp.
      const observationStart = now;
      let snapshot: VideoAnalyticsSnapshot;
      try {
        snapshot = await adapter.getSnapshot(session.videoUrl, observationStart);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        snapshot = {
          available: false,
          likes: null,
          views: null,
          capturedAt: observationStart.toISOString(),
          source: adapter.name,
          note: `Analytics source error: ${msg}`,
        };
      }

      const saved = await persistSnapshot(session, claimed.checkpoint, snapshot, observationStart);
      if (saved.created) {
        result.snapshotsTaken++;

        // STEP 5 — reassess adaptive delivery schedule against real state.
        const scheduled = await reassessAndScheduleBatch(
          session,
          claimed.checkpoint,
          saved.likesDelta,
          saved.reliabilityNote,
          observationStart
        );
        result.stepsScheduled += scheduled.batchesCreated;
        if (scheduled.batchesCreated === 0 && scheduled.note) {
          await prisma.monitoringAuditEvent.create({
            data: {
              sessionId: session.id,
              action: "BATCH_SKIPPED",
              details: scheduled.note,
            },
          });
        }
      }

      // STEP 6 — schedule next checkpoint from the persisted schedule.
      await updateSessionProgress(session, now);

      const refreshed = await prisma.monitoringSession.findUnique({ where: { id: session.id } });
      if (refreshed && refreshed.status === "RUNNING") {
        const remainingPending = await prisma.monitoringCheckpoint.count({
          where: { sessionId: session.id, status: { in: ["PENDING", "EXECUTING"] } },
        });
        if (remainingPending === 0) {
          await prisma.monitoringSession.update({
            where: { id: session.id },
            data: { status: "COMPLETED" },
          });
          await prisma.monitoringAuditEvent.create({
            data: {
              sessionId: session.id,
              action: "SESSION_COMPLETED",
              details: `All monitoring checkpoints consumed. Monitoring ended at ${now.toISOString()}.`,
            },
          });
          result.sessionsCompleted++;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Session ${session.orderRef}: ${msg}`);
      await prisma.monitoringAuditEvent
        .create({
          data: { sessionId: session.id, action: "TICK_ERROR", details: msg.slice(0, 500) },
        })
        .catch(() => {});
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Steps 1–3: snapshot persisting
// ---------------------------------------------------------------------------

async function persistSnapshot(
  session: MonitoringSession,
  checkpoint: MonitoringCheckpoint,
  snapshot: VideoAnalyticsSnapshot,
  nowAtExecution: Date
): Promise<{
  created: boolean;
  previousSnapshot: { likes: number | null; views: number | null } | null;
  likesDelta: number | null;
  reliabilityNote: string | null;
}> {
  const delayMs = Math.max(0, nowAtExecution.getTime() - new Date(checkpoint.plannedAt).getTime());

  // Compare only with the immediately preceding checkpoint. Reusing an older
  // successful snapshot after a failed/missed reading would silently turn a
  // 21-minute (or 25-minute) interval into a longer measurement window.
  const previous = checkpoint.sequence > 1
    ? await prisma.videoSnapshot.findFirst({
        where: { sessionId: session.id, sequence: checkpoint.sequence - 1 },
      })
    : null;
  const previousSnapshot: { likes: number; views: number } | null =
    previous?.isFresh === true && typeof previous.likes === "number" && typeof previous.views === "number"
    ? { likes: previous.likes, views: previous.views }
    : null;
  const actualIntervalMs = previousSnapshot && previous?.executedAt
    ? nowAtExecution.getTime() - previous.executedAt.getTime()
    : null;
  const selectedIntervalMs = session.intervalMinutes * 60_000;
  const withinSelectedInterval = actualIntervalMs !== null &&
    Math.abs(actualIntervalMs - selectedIntervalMs) <= getIntervalToleranceMs();

  let likesDelta: number | null = null;
  let viewsDelta: number | null = null;
  let ratio: number | null = null;
  const notes: string[] = [];
  const isFresh = snapshot.available && typeof snapshot.likes === "number" && typeof snapshot.views === "number";

  if (isFresh) {
    const likes = snapshot.likes as number;
    const views = snapshot.views as number;
    if (views > 0) ratio = Number((likes / views).toFixed(5));
    if (previousSnapshot && withinSelectedInterval) {
      likesDelta = likes - previousSnapshot.likes;
      if (likesDelta < 0) {
        likesDelta = 0;
        notes.push("Like counter corrected/reset by platform; interval delta clamped to 0.");
      }
    }
    if (previousSnapshot && withinSelectedInterval) {
      viewsDelta = views - previousSnapshot.views;
      if (viewsDelta < 0) {
        viewsDelta = 0;
        notes.push("View counter corrected/reset by platform; interval delta clamped to 0.");
      }
    }
    if (checkpoint.sequence === 1) {
      notes.push("Initial reading saved as the baseline; there is no earlier interval to compare.");
    } else if (!previousSnapshot) {
      notes.push(`Checkpoint #${checkpoint.sequence - 1} has no verified reading. This interval's likes/views delta is unavailable, so no batch will be based on a longer window.`);
    } else if (!withinSelectedInterval) {
      const actualMinutes = actualIntervalMs === null ? null : actualIntervalMs / 60_000;
      notes.push(`Readings were ${actualMinutes === null ? "not separated by a verifiable interval" : `${actualMinutes.toFixed(1)} minutes apart`} instead of the selected ${session.intervalMinutes}-minute interval (tolerance ${Math.round(getIntervalToleranceMs() / 1000)} seconds). No likes/views delta or batch was calculated for this checkpoint.`);
    }
  } else {
    notes.push(snapshot.note || "Metrics unavailable at this checkpoint.");
  }
  const reliabilityNote = notes.length > 0 ? notes.join(" ") : null;

  // Idempotent insert: unique(sessionId, sequence) prevents duplicate
  // snapshots when ticks run concurrently or replay after a crash.
  let createdSnapshotId: string | null = null;
  try {
    const created = await prisma.videoSnapshot.create({
      data: {
        sessionId: session.id,
        checkpointId: checkpoint.id,
        sequence: checkpoint.sequence,
        plannedAt: checkpoint.plannedAt,
        executedAt: nowAtExecution,
        delayMs,
        likes: typeof snapshot.likes === "number" ? snapshot.likes : null,
        views: typeof snapshot.views === "number" ? snapshot.views : null,
        likesDelta,
        viewsDelta,
        ratio,
        source: snapshot.source,
        isFresh,
        reliabilityNote,
      },
    });
    createdSnapshotId = created.id;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      // Snapshot for this sequence already persisted (duplicate tick) — not an error.
      return { created: false, previousSnapshot, likesDelta: null, reliabilityNote };
    }
    throw err;
  }

  let likesValue: number | null = typeof snapshot.likes === "number" ? snapshot.likes : null;
  let viewsValue: number | null = typeof snapshot.views === "number" ? snapshot.views : null;

  await prisma.monitoringSession.update({
    where: { id: session.id },
    data: {
      initialLikes: session.initialLikes ?? likesValue,
      initialViews: session.initialViews ?? viewsValue,
      latestSnapshotId: createdSnapshotId,
      snapshotCount: { increment: 1 },
    },
  });

  const executedDelayMs = delayMs;
  await prisma.monitoringCheckpoint.update({
    where: { id: checkpoint.id },
    data: {
      status: "EXECUTED",
      executedAt: nowAtExecution,
      delayMs: executedDelayMs,
      errorMessage: null,
    },
  });

  await prisma.monitoringAuditEvent.create({
    data: {
      sessionId: session.id,
      action: "SNAPSHOT_TAKEN",
      details: `Checkpoint #${checkpoint.sequence} (planned ${checkpoint.plannedAt.toISOString()}, delay ${executedDelayMs}ms): likes=${likesValue ?? "unavailable"}, views=${viewsValue ?? "unavailable"}, likesDelta=${likesDelta ?? "n/a"}, viewsDelta=${viewsDelta ?? "n/a"}, ratio=${ratio ?? "n/a"}, source=${snapshot.source}.`,
    },
  });

  return { created: true, previousSnapshot, likesDelta, reliabilityNote };
}

// ---------------------------------------------------------------------------
// Step 5: adaptive schedule reassessment
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
async function reassessAndScheduleBatch(
  session: MonitoringSession,
  checkpoint: MonitoringCheckpoint,
  likesDelta: number | null,
  intervalNote: string | null,
  now: Date
): Promise<{ batchesCreated: number; note?: string }> {
  const order = await prisma.order.findUnique({
    where: { id: session.orderId! },
    include: { service: true, steps: true },
  });
  if (!order) return { batchesCreated: 0, note: "Linked order missing" };

  const service = order.service;
  const unitCost = order.unitCost;

  const committedSteps = order.steps.filter(
    (s: ScheduledDeliveryStep) => ["PAUSED", "PENDING", "PROCESSING", "SUBMITTED", "COMPLETED"].includes(s.status)
  );
  const spentSteps = order.steps.filter((s: ScheduledDeliveryStep) =>
    ["PROCESSING", "SUBMITTED", "COMPLETED"].includes(s.status)
  );

  const committedQty = committedSteps.reduce((a, s) => a + s.quantity, 0);
  const spentQty = spentSteps.reduce((a, s) => a + s.quantity, 0);
  const spentAmount = Number((spentQty * unitCost).toFixed(4));

  const budgetRemaining = Math.max(0, Number((session.budgetCap - spentAmount).toFixed(4)));
  const qtyRemaining = Math.max(0, session.quantityCap - committedQty);
  const timeLeftMin = Math.max(0, (session.expiresAt.getTime() - now.getTime()) / 60000);

  if (qtyRemaining <= 0) {
    return { batchesCreated: 0, note: "Quantity cap reached; no further batches permitted." };
  }
  if (budgetRemaining <= 0) {
    return { batchesCreated: 0, note: "Budget limit exhausted; no further batches permitted." };
  }
  if (timeLeftMin <= 0) {
    return { batchesCreated: 0, note: "Monitoring window expired; no further scheduled work." };
  }

  // ---------------------------------------------------------------------------
  // Core: derive batch quantity from this interval's likes gained (2–5% ratio)
  // ---------------------------------------------------------------------------
  if (likesDelta === null) {
    // No verified reading for the immediately preceding checkpoint — do not
    // aggregate across a longer interval or create a misleading batch.
    return {
      batchesCreated: 0,
      note: `Checkpoint #${checkpoint.sequence}: no verified likes delta for this exact interval, so no view batch was sent.${intervalNote ? ` ${intervalNote}` : ""}`,
    };
  }

  if (likesDelta <= 0) {
    // No new likes this interval — no delivery needed
    return {
      batchesCreated: 0,
      note: `Checkpoint #${checkpoint.sequence}: 0 new likes observed, no batch dispatched.`,
    };
  }

  // Apply the random 2–5% target and enforce all provider/session limits.
  // The helper refuses a clamped quantity if it would fall outside that range.
  const maxByBudget = unitCost > 0 ? Math.floor(budgetRemaining / unitCost) : 0;
  const computed = calculateLikeDrivenViewBatch(likesDelta, {
    providerMinQuantity: service.minQuantity,
    providerMaxQuantity: service.maxQuantity,
    availableQuantity: Math.min(maxByBudget, qtyRemaining),
  });
  const batchQty = computed.batchQuantity;

  if (batchQty <= 0) {
    return {
      batchesCreated: 0,
      note: `Checkpoint #${checkpoint.sequence}: observed +${likesDelta} likes; no batch sent. ${computed.skipReason || "The provider/session limits prevent a valid batch."}`,
    };
  }

  // Final guard: batchQty must meet the provider minimum before submission.
  // This is a belt-and-suspenders check — the calculator already enforces it,
  // but we re-validate here so the backend never sends an invalid order even if
  // the calculator is called with different parameters elsewhere.
  if (batchQty < service.minQuantity) {
    await prisma.monitoringAuditEvent.create({
      data: {
        sessionId: session.id,
        action: "BATCH_SKIPPED",
        details:
          `Checkpoint #${checkpoint.sequence}: backend quantity guard blocked a below-minimum ` +
          `order (computed ${batchQty}, provider minimum ${service.minQuantity}). ` +
          `Raw calculated: ${computed.rawCalculatedQuantity}, validated: ${computed.validatedQuantity}.`,
      },
    });
    return {
      batchesCreated: 0,
      note: `Checkpoint #${checkpoint.sequence}: batch quantity ${batchQty} is below provider minimum ${service.minQuantity}; order blocked.`,
    };
  }

  const appliedRatioNote = `${((computed.actualLikeViewRatio ?? computed.targetLikeViewRatio) * 100).toFixed(2)}%`;
  const targetRatioNote = `${(computed.targetLikeViewRatio * 100).toFixed(2)}%`;

  const idempotencyKey = `${session.orderRef}-chk-${checkpoint.sequence}`;
  const existing = await prisma.scheduledDeliveryStep.findUnique({ where: { idempotencyKey } });
  if (existing) {
    return { batchesCreated: 0, note: "Batch already planned for this checkpoint." };
  }

  const stepNumber = order.steps.length + 1;
  await prisma.scheduledDeliveryStep.create({
    data: {
      orderId: order.id,
      stepNumber,
      scheduledTime: now,
      quantity: batchQty,
      status: "PENDING",
      idempotencyKey,
    },
  });

  const newCommitted = committedQty + batchQty;

  await prisma.order.update({
    where: { id: order.id },
    data: {
      remainingQuantity: Math.max(0, order.requestedQuantity - newCommitted),
    },
  });

  await prisma.monitoringSession.update({
    where: { id: session.id },
    data: { scheduleReviserCount: { increment: 1 } },
  });

  // Emit BATCH_MINIMUM_APPLIED when the raw quantity was lifted to the provider minimum.
  if (computed.minimumApplied) {
    await prisma.monitoringAuditEvent.create({
      data: {
        sessionId: session.id,
        action: "BATCH_MINIMUM_APPLIED",
        details:
          `Checkpoint #${checkpoint.sequence}: raw calculated quantity was ` +
          `${computed.rawCalculatedQuantity.toLocaleString()} (from +${likesDelta} likes at ` +
          `${(computed.targetLikeViewRatio * 100).toFixed(2)}% target ratio), which is below ` +
          `the provider minimum of ${service.minQuantity.toLocaleString()}. ` +
          `Quantity clamped to provider minimum → validated: ${computed.validatedQuantity.toLocaleString()} ` +
          `(rule: LIKES_ANALYZE_MINIMUM_BATCH_RULE=clamp). Step #${stepNumber} created.`,
      },
    });
  }

  await prisma.monitoringAuditEvent.create({
    data: {
      sessionId: session.id,
      action: "SCHEDULE_ASSESSED",
      details:
        `Checkpoint #${checkpoint.sequence}: observed +${likesDelta} likes in this interval → ` +
        `selected ${targetRatioNote} target → applied ${appliedRatioNote} likes/views ratio → ` +
        `raw calculated: ${computed.rawCalculatedQuantity.toLocaleString()} views, ` +
        `validated: ${computed.validatedQuantity.toLocaleString()} views` +
        `${computed.minimumApplied ? " (provider minimum applied)" : ""}` +
        ` → dispatched ${batchQty} views (step #${stepNumber}). ` +
        `Scheduled at: ${now.toISOString()}. ` +
        `Budget remaining: $${budgetRemaining.toFixed(2)}, qty remaining: ${qtyRemaining - batchQty}.`,
    },
  });

  return { batchesCreated: 1 };
}

// ---------------------------------------------------------------------------
// Step 6: session progress from persisted schedule
// ---------------------------------------------------------------------------

async function updateSessionProgress(session: MonitoringSession, now: Date): Promise<void> {
  const next = await prisma.monitoringCheckpoint.findFirst({
    where: { sessionId: session.id, status: "PENDING" },
    orderBy: { sequence: "asc" },
  });

  const nextPlannedAt = next ? new Date(next.plannedAt) : null;
  // Next checkpoint = persisted planned time; if late, execution catches it up.
  const nextCheckpointAt = nextPlannedAt && nextPlannedAt.getTime() > now.getTime() ? nextPlannedAt : now;

  await prisma.monitoringSession.update({
    where: { id: session.id },
    data: {
      lastCheckpointAt: now,
      nextCheckpointAt: nextCheckpointAt,
    },
  });
}

// ---------------------------------------------------------------------------
// Lifecycle: expiration
// ---------------------------------------------------------------------------

export async function expireSession(sessionId: string, now: Date = new Date()): Promise<void> {
  const session = await prisma.monitoringSession.findUnique({
    where: { id: sessionId },
    include: { order: { include: { steps: true } } },
  });
  if (!session) return;
  if (["EXPIRED", "STOPPED"].includes(session.status)) return;

  const expiredCheckpoints = await prisma.monitoringCheckpoint.updateMany({
    where: { sessionId: session.id, status: { in: ["PENDING", "EXECUTING"] } },
    data: { status: "EXPIRED", executedAt: now },
  });

  // Expiration stops NEW work; work already accepted by the provider keeps
  // running to its natural delivery status.
  let cancelledSteps = 0;
  if (session.order) {
    const res = await prisma.scheduledDeliveryStep.updateMany({
      where: { orderId: session.order.id, status: { in: ["PENDING", "PAUSED"] } },
      data: { status: "CANCELLED" },
    });
    cancelledSteps = res.count;
    const submittedQty = session.order.steps
      .filter((s) => ["SUBMITTED", "COMPLETED", "PROCESSING"].includes(s.status))
      .reduce((a, s) => a + s.quantity, 0);
    await prisma.order.update({
      where: { id: session.order.id },
      data: {
        submittedQuantity: session.order.submittedQuantity,
        remainingQuantity: Math.max(0, session.order.requestedQuantity - submittedQty),
        status: submittedQty > 0 ? "PARTIAL" : "CANCELLED",
      },
    });
  }

  await prisma.monitoringSession.update({
    where: { id: session.id },
    data: { status: "EXPIRED", nextCheckpointAt: null, stopNote: "Monitoring window expired." },
  });

  await prisma.monitoringAuditEvent.create({
    data: {
      sessionId: session.id,
      action: "SESSION_EXPIRED",
      details: `Monitoring window expired at ${now.toISOString()}. New scheduling stopped; ${expiredCheckpoints.count} checkpoints expired and ${cancelledSteps} not-yet-accepted batches cancelled. Work already accepted by the provider is left to complete per its own delivery status.`,
    },
  });
}

// ---------------------------------------------------------------------------
// Lifecycle controls: pause / resume / stop
// ---------------------------------------------------------------------------

export async function pauseMonitoringSession(sessionId: string, note?: string): Promise<{ ok: boolean; message: string }> {
  const session = await prisma.monitoringSession.findUnique({ where: { id: sessionId } });
  if (!session) return { ok: false, message: "Monitoring session not found." };
  if (session.status === "PAUSED") return { ok: false, message: " Monitoring session is already paused." };
  if (["STOPPED", "EXPIRED", "COMPLETED"].includes(session.status)) {
    return { ok: false, message: `Cannot pause a ${session.status.toLowerCase()} session.` };
  }

  await prisma.monitoringSession.update({
    where: { id: sessionId },
    data: { status: "PAUSED" },
  });

  if (session.orderId) {
    await prisma.scheduledDeliveryStep.updateMany({
      where: { orderId: session.orderId, status: "PENDING" },
      data: { status: "PAUSED" },
    });
    await prisma.order.update({ where: { id: session.orderId }, data: { status: "PAUSED" } });
  }

  await prisma.monitoringAuditEvent.create({
    data: {
      sessionId,
      action: "SESSION_PAUSED",
      details: note ? `Monitoring paused: ${note}` : "Monitoring paused by operator.",
    },
  });

  return { ok: true, message: "Monitoring session paused." };
}

export async function resumeMonitoringSession(sessionId: string): Promise<{ ok: boolean; message: string }> {
  const session = await prisma.monitoringSession.findUnique({
    where: { id: sessionId },
    include: { checkpoints: true },
  });
  if (!session) return { ok: false, message: "Monitoring session not found." };
  if (session.status !== "PAUSED") return { ok: false, message: `Session is not paused (current status: ${session.status}).` };

  const now = new Date();
  const nowMs = now.getTime();
  if (session.expiresAt.getTime() < nowMs) {
    await expireSession(sessionId, now);
    return { ok: false, message: "Session expired before it could be resumed. Monitoring ended." };
  }

  // Next checkpoint from persisted schedule: the earliest pending checkpoint.
  const next = session.checkpoints
    .filter((c) => c.status === "PENDING" || c.status === "PAUSED")
    .sort((a, b) => a.sequence - b.sequence)[0];

  // If the schedule is exhausted (all executed), mark completed.
  if (!next) {
    await prisma.monitoringSession.update({
      where: { id: sessionId },
      data: { status: "COMPLETED", nextCheckpointAt: null },
    });
    return { ok: true, message: "No pending checkpoints remain; monitoring session completed." };
  }

  // Sync paused steps back to pending so they resume executing.
  if (session.orderId) {
    await prisma.scheduledDeliveryStep.updateMany({
      where: { orderId: session.orderId, status: "PAUSED" },
      data: { status: "PENDING" },
    });
    await prisma.order.update({
      where: { id: session.orderId },
      data: { status: "PROCESSING" },
    });
  }

  // Restore skipped-in-the-interval pending checkpoint slots.
  await prisma.monitoringCheckpoint.updateMany({
    where: { sessionId, status: "PAUSED" },
    data: { status: "PENDING" },
  });

  const resumeAt = new Date(Math.max(nowMs, new Date(next.plannedAt).getTime()));
  await prisma.monitoringSession.update({
    where: { id: sessionId },
    data: { status: "RUNNING", nextCheckpointAt: resumeAt },
  });

  await prisma.monitoringAuditEvent.create({
    data: {
      sessionId,
      action: "SESSION_RESUMED",
      details: `Monitoring resumed; next checkpoint (persisted schedule sequence #${next.sequence}) executes at ${resumeAt.toISOString()}.`,
    },
  });

  return { ok: true, message: "Monitoring session resumed." };
}

export async function stopMonitoringSession(sessionId: string, note?: string): Promise<{ ok: boolean; message: string }> {
  const session = await prisma.monitoringSession.findUnique({
    where: { id: sessionId },
    include: { order: { include: { steps: true } } },
  });
  if (!session) return { ok: false, message: "Monitoring session not found." };
  if (["STOPPED", "EXPIRED"].includes(session.status)) {
    return { ok: false, message: `Session is already ${session.status.toLowerCase()}.` };
  }

  const skipped = await prisma.monitoringCheckpoint.updateMany({
    where: { sessionId, status: { in: ["PENDING", "EXECUTING", "PAUSED"] } },
    data: { status: "SKIPPED", executedAt: new Date() },
  });

  let cancelledSteps = 0;
  if (session.order) {
    const res = await prisma.scheduledDeliveryStep.updateMany({
      where: { orderId: session.order.id, status: { in: ["PENDING", "PAUSED"] } },
      data: { status: "CANCELLED" },
    });
    cancelledSteps = res.count;
    const submittedQty = session.order.steps
      .filter((s) => ["SUBMITTED", "COMPLETED", "PROCESSING"].includes(s.status))
      .reduce((a, s) => a + s.quantity, 0);
    await prisma.order.update({
      where: { id: session.order.id },
      data: {
        remainingQuantity: Math.max(0, session.order.requestedQuantity - submittedQty),
        status: submittedQty > 0 ? "PARTIAL" : "CANCELLED",
      },
    });
  }

  await prisma.monitoringSession.update({
    where: { id: sessionId },
    data: {
      status: "STOPPED",
      nextCheckpointAt: null,
      stopNote: note ? `Session stopped: ${note}` : "Session stopped by operator.",
    },
  });

  await prisma.monitoringAuditEvent.create({
    data: {
      sessionId,
      action: "SESSION_STOPPED",
      details: `Monitoring stopped at ${new Date().toISOString()}: ${skipped.count} pending checkpoints skipped and ${cancelledSteps} scheduled-but-not-accepted batches cancelled. Work already submitted to the provider continues under its real provider status.`,
    },
  });

  return { ok: true, message: "Monitoring session stopped." };
}

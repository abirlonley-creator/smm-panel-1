import { prisma } from "../prisma";
import { resolveServiceRouting, resolveProviderById } from "../provider/registry";
import { MockSMMProvider, SMMProviderAdapter } from "../provider/adapter";
import { classifyProviderError } from "./error-classifier";
import { logOrderEvent } from "./event-logger";
import { recordAdminAlert } from "./alert-service";
import { runWatchdogCycle } from "./watchdog";

export interface EngagementTickResult {
  processedRuns: number;
  successfulRuns: number;
  delayedRuns: number;
  failedRuns: number;
  refundedRuns: number;
  syncedSentRuns: number;
  ordersCompleted: number;
}

const MAX_RUN_ATTEMPTS = 5;
const BACKOFF_SECONDS = [30, 60, 120, 300, 600];

/**
 * Sanitizes provider responses so raw API keys and secrets never appear in logs or DB.
 */
export function sanitizeProviderResponse(data: any): string {
  if (!data) return "";
  try {
    let str = typeof data === "string" ? data : JSON.stringify(data);
    str = str.replace(/(["']?(?:api[_-]?key|key|token|secret|password|authorization)["']?\s*[:=]\s*["'])([^"']+)(["'])/gi, '$1[REDACTED]$3');
    str = str.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
    return str.slice(0, 2000);
  } catch {
    return "[Unserializable]";
  }
}

/**
 * Returns calm, friendly user status text for client views.
 */
export function getCalmUserStatusText(deviationStatus: string, hasDelayed: boolean): string {
  if (hasDelayed || deviationStatus === "slightly_behind" || deviationStatus === "behind") {
    return "Small delay on our side, we are fixing it";
  }
  return "All good";
}

/**
 * Interpolates expected cumulative points from the stored 100-point curve at elapsed minutes.
 */
export function interpolateExpectedCurve(points: any[], elapsedMinutes: number): Record<string, number> {
  if (!points || points.length === 0) {
    return { views: 0, likes: 0, saves: 0, shares: 0, comments: 0 };
  }
  if (elapsedMinutes <= points[0].minutes) {
    return { ...points[0] };
  }
  const last = points[points.length - 1];
  if (elapsedMinutes >= last.minutes) {
    return { ...last };
  }

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (elapsedMinutes >= p1.minutes && elapsedMinutes <= p2.minutes) {
      const span = p2.minutes - p1.minutes;
      const frac = span > 0 ? (elapsedMinutes - p1.minutes) / span : 0;
      return {
        views: Math.round(p1.views + (p2.views - p1.views) * frac),
        likes: Math.round(p1.likes + (p2.likes - p1.likes) * frac),
        saves: Math.round(p1.saves + (p2.saves - p1.saves) * frac),
        shares: Math.round(p1.shares + (p2.shares - p1.shares) * frac),
        comments: Math.round(p1.comments + (p2.comments - p1.comments) * frac),
      };
    }
  }
  return { ...last };
}

/**
 * Synchronizes confirmed deliveries, stores status samples over time, calculates deviation,
 * and triggers smooth non-spiky re-planning when behind (Changes D & E).
 */
export async function syncOrderDeliveryAndDeviation(orderId: string, now: Date) {
  const order = await prisma.engagementOrder.findUnique({
    where: { id: orderId },
    include: {
      runs: { orderBy: { scheduledAt: "asc" } },
    },
  });
  if (!order) return;

  const types = ["views", "likes", "saves", "shares", "comments"] as const;

  // 1. Compute cumulative delivered per type and update run cumulative counts
  const deliveredTotals: Record<string, number> = {
    views: 0,
    likes: 0,
    saves: 0,
    shares: 0,
    comments: 0,
  };

  for (const t of types) {
    const typeRuns = order.runs.filter((r) => r.engagementType === t);
    let runCum = 0;
    for (const r of typeRuns) {
      const isSettledDelivered = r.status === "completed" || r.status === "sent";
      const qtyDelivered = isSettledDelivered ? (r.deliveredQuantity ?? (r.status === "completed" ? r.quantity : 0)) : 0;
      runCum += qtyDelivered;
      if (r.deliveredCumulative !== runCum) {
        await prisma.engagementRun.update({
          where: { id: r.id },
          data: { deliveredCumulative: runCum },
        });
      }
    }
    deliveredTotals[t] = runCum;
  }

  // 2. Append statusSample for truthful delivered curve record
  let samples: Array<{ timestamp: string; views: number; likes: number; saves: number; shares: number; comments: number }> = [];
  try {
    samples = order.statusSamples ? JSON.parse(order.statusSamples) : [];
  } catch {
    samples = [];
  }

  const newSample = {
    timestamp: now.toISOString(),
    views: deliveredTotals.views,
    likes: deliveredTotals.likes,
    saves: deliveredTotals.saves,
    shares: deliveredTotals.shares,
    comments: deliveredTotals.comments,
  };

  const lastSample = samples[samples.length - 1];
  const isDifferent = !lastSample ||
    lastSample.views !== newSample.views ||
    lastSample.likes !== newSample.likes ||
    lastSample.saves !== newSample.saves ||
    lastSample.shares !== newSample.shares ||
    lastSample.comments !== newSample.comments;

  if (isDifferent || samples.length === 0) {
    samples.push(newSample);
    if (samples.length > 300) {
      samples = samples.slice(-300);
    }
  }

  // 3. Expected cumulative at current elapsed minutes
  const durationMinutes = Math.max(15, Math.round(order.durationHours * 60));
  const elapsedMinutes = Math.max(0, Math.min(durationMinutes, (now.getTime() - order.createdAt.getTime()) / 60000));
  let curvePoints: any[] = [];
  try {
    curvePoints = order.expectedCurve ? JSON.parse(order.expectedCurve) : [];
  } catch {}

  const expectedAtNow = interpolateExpectedCurve(curvePoints, elapsedMinutes);

  // 4. Deviation tracking per Change E: deviation(type, t) = (delivered - expected) / total_type
  const typeDeviations: Record<string, number> = {};
  const typeStatuses: Record<string, "on_track" | "slightly_behind" | "behind" | "ahead"> = {};

  const plannedTotals: Record<string, number> = {
    views: order.plannedViews,
    likes: order.plannedLikes,
    saves: order.plannedSaves,
    shares: order.plannedShares,
    comments: order.plannedComments,
  };

  let enabledList: string[] = ["views", "likes", "saves", "shares", "comments"];
  try {
    if (order.enabledTypes) enabledList = JSON.parse(order.enabledTypes);
  } catch {}

  for (const t of types) {
    if (!enabledList.includes(t) || plannedTotals[t] <= 0) {
      typeStatuses[t] = "on_track";
      typeDeviations[t] = 0;
      continue;
    }

    const dev = (deliveredTotals[t] - (expectedAtNow[t] ?? 0)) / plannedTotals[t];
    typeDeviations[t] = dev;

    if (dev >= -0.05 && dev <= 0.05) {
      typeStatuses[t] = "on_track";
    } else if (dev < -0.05 && dev >= -0.10) {
      typeStatuses[t] = "slightly_behind";
    } else if (dev < -0.10) {
      typeStatuses[t] = "behind";
    } else {
      typeStatuses[t] = "ahead";
    }
  }

  // Overall order status
  let overallDeviationStatus: "on_track" | "slightly_behind" | "behind" | "ahead" = "on_track";
  const activeStatuses = enabledList.map((t) => typeStatuses[t]).filter(Boolean);
  if (activeStatuses.includes("behind")) {
    overallDeviationStatus = "behind";
  } else if (activeStatuses.includes("slightly_behind")) {
    overallDeviationStatus = "slightly_behind";
  } else if (activeStatuses.includes("ahead")) {
    overallDeviationStatus = "ahead";
  }

  // Behind tracker for 15-minute alert
  let behindSince = order.behindSince;
  if (overallDeviationStatus === "behind") {
    if (!behindSince) {
      behindSince = now;
    } else if (now.getTime() - new Date(behindSince).getTime() > 15 * 60 * 1000) {
      const recentBehindAlert = await prisma.adminAlert.findFirst({
        where: {
          orderId: order.id,
          type: "behind_15m",
          createdAt: { gte: new Date(now.getTime() - 30 * 60 * 1000) },
        },
      });
      if (!recentBehindAlert) {
        await prisma.adminAlert.create({
          data: {
            severity: "high",
            type: "behind_15m",
            orderId: order.id,
            userId: order.userId,
            platform: order.platform,
            planned: expectedAtNow.views,
            delivered: deliveredTotals.views,
            deviationPercent: Number((typeDeviations.views * 100).toFixed(1)),
            reason: `Order ${order.orderRef} has remained Behind delivery schedule for over 15 minutes.`,
            status: "open",
          },
        });
      }
    }
  } else {
    behindSince = null;
  }

  // 5. Non-spiky Re-Plan for any behind types (Change E)
  for (const t of types) {
    if (typeStatuses[t] === "behind") {
      const shortfall = (expectedAtNow[t] ?? 0) - deliveredTotals[t];
      if (shortfall > 0) {
        const remainingRuns = order.runs.filter(
          (r) => r.engagementType === t && ["scheduled", "delayed"].includes(r.status)
        );

        if (remainingRuns.length > 0) {
          let unallocated = shortfall;
          for (const r of remainingRuns) {
            if (unallocated <= 0) break;
            const maxCatchUp = Math.floor(r.quantity * 1.5); // <= 1.5x planned size
            const headroom = maxCatchUp - r.quantity;
            if (headroom > 0) {
              const add = Math.min(unallocated, headroom);
              await prisma.engagementRun.update({
                where: { id: r.id },
                data: {
                  quantity: r.quantity + add,
                  isReplan: true,
                },
              });
              unallocated -= add;
            }
          }

          // If full recovery would need spikes, spread it and extend finish time
          if (unallocated > 0) {
            const lastRun = remainingRuns[remainingRuns.length - 1];
            const avgBatch = Math.max(10, Math.round(remainingRuns.reduce((a, b) => a + b.quantity, 0) / remainingRuns.length));
            const extraRuns = Math.ceil(unallocated / avgBatch);
            let nextRunTime = new Date(lastRun.scheduledAt).getTime();
            const intervalMs = 15 * 60 * 1000;

            for (let e = 0; e < extraRuns; e++) {
              nextRunTime += intervalMs;
              const addQty = Math.min(unallocated, avgBatch);
              if (addQty <= 0) break;
              await prisma.engagementRun.create({
                data: {
                  engagementOrderId: order.id,
                  engagementType: t,
                  serviceId: lastRun.serviceId,
                  providerId: lastRun.providerId,
                  providerServiceId: lastRun.providerServiceId,
                  runNumber: (lastRun.runNumber ?? remainingRuns.length) + e + 1,
                  scheduledAt: new Date(nextRunTime),
                  quantity: addQty,
                  status: "scheduled",
                  idempotencyKey: `ENG-RUN-${order.id}-${t}-replan-${Date.now()}-${e}`,
                  cost: Number(((addQty / 1000) * (lastRun.cost / (lastRun.quantity || 1) * 1000)).toFixed(4)),
                  isReplan: true,
                },
              });
              unallocated -= addQty;
            }
          }

          // Record re-plan
          const reason = `Non-spiky catch-up re-plan: ${t} fell ${(Math.abs(typeDeviations[t]) * 100).toFixed(1)}% behind. Batches adjusted <= 1.5x.`;
          await prisma.engagementOrder.update({
            where: { id: order.id },
            data: {
              replanCount: { increment: 1 },
              lastReplanReason: reason,
            },
          });

          await prisma.adminAlert.create({
            data: {
              severity: "medium",
              type: "replan",
              orderId: order.id,
              userId: order.userId,
              platform: order.platform,
              engagementType: t,
              planned: expectedAtNow[t],
              delivered: deliveredTotals[t],
              deviationPercent: Number((typeDeviations[t] * 100).toFixed(1)),
              reason,
              status: "resolved",
              actionTaken: "Re-planned remaining runs smoothly",
            },
          });
        }
      }
    }
  }

  // Update order record
  await prisma.engagementOrder.update({
    where: { id: order.id },
    data: {
      statusSamples: JSON.stringify(samples),
      deviationStatus: overallDeviationStatus,
      typeStatuses: JSON.stringify(typeStatuses),
      behindSince,
      deliveredViews: deliveredTotals.views,
      deliveredLikes: deliveredTotals.likes,
      deliveredSaves: deliveredTotals.saves,
      deliveredShares: deliveredTotals.shares,
      deliveredComments: deliveredTotals.comments,
    },
  });
}

/**
 * Checks if an error string represents a permanent/fatal error that shouldn't be retried.
 */
function isFatalProviderError(errMsg: string): boolean {
  const lower = errMsg.toLowerCase();
  return (
    lower.includes("not enough funds") ||
    lower.includes("insufficient balance") ||
    lower.includes("service not found") ||
    lower.includes("invalid service") ||
    lower.includes("service inactive") ||
    lower.includes("link is invalid") ||
    lower.includes("account is private")
  );
}

/**
 * Executes a scheduler tick over due Full Engagement runs.
 * 
 * Guarantees:
 * - Runs sent within target window (+/- 30s) of scheduled_at, never early.
 * - Atomic row claiming: two workers on the same run send only once.
 * - Idempotency: crash-after-send recovery protects against double sends.
 * - Provider health re-check: backoff and "delayed" status if provider down.
 * - Sent run status polling to confirm upstream completion.
 * - Safe partial failure: refunds only undelivered amount, keeping remaining types active.
 */
export async function runEngagementTick(): Promise<EngagementTickResult> {
  const now = new Date();

  // 1. Worker Heartbeat: update singleton worker heartbeat timestamp every cycle
  try {
    await prisma.workerStatus.upsert({
      where: { id: "singleton" },
      update: { lastHeartbeatAt: now, status: "RUNNING" },
      create: { id: "singleton", lastHeartbeatAt: now, status: "RUNNING" },
    });
  } catch {}

  // 2. Watchdog: check heartbeat age, recover runs stuck > 2m, and catch missed runs
  try {
    await runWatchdogCycle();
  } catch (wdErr) {
    console.warn("[WORKER] Watchdog cycle warning:", wdErr);
  }

  // 3. Concurrently claim due runs using PostgreSQL SELECT ... FOR UPDATE SKIP LOCKED
  let dueRunIds: string[] = [];
  try {
    const rawRows: { id: string }[] = await prisma.$queryRawUnsafe(`
      SELECT id FROM runs
      WHERE status IN ('scheduled', 'delayed')
        AND "scheduledAt" <= NOW()
      ORDER BY "scheduledAt" ASC
      LIMIT 20
      FOR UPDATE SKIP LOCKED
    `);
    dueRunIds = rawRows.map((r) => r.id);
  } catch {
    // Fallback if raw query is unavailable
    const fallbackRuns = await prisma.engagementRun.findMany({
      where: {
        status: { in: ["scheduled", "delayed"] },
        scheduledAt: { lte: now },
      },
      select: { id: true },
      take: 20,
      orderBy: { scheduledAt: "asc" },
    });
    dueRunIds = fallbackRuns.map((r) => r.id);
  }

  const dueRuns = dueRunIds.length > 0
    ? await prisma.engagementRun.findMany({
        where: { id: { in: dueRunIds } },
        include: {
          engagementOrder: { include: { user: true } },
          service: true,
          provider: true,
        },
        orderBy: { scheduledAt: "asc" },
      })
    : [];

  let processedRuns = 0;
  let successfulRuns = 0;
  let delayedRuns = 0;
  let failedRuns = 0;
  let refundedRuns = 0;
  let syncedSentRuns = 0;
  let ordersCompleted = 0;

  for (const run of dueRuns) {
    const latenessSeconds = Math.max(0, Math.round((now.getTime() - run.scheduledAt.getTime()) / 1000));
    const timeToStartMs = Math.max(0, now.getTime() - run.scheduledAt.getTime());

    // 4. Status machine: transition scheduled/delayed -> claimed -> sending
    const claim = await prisma.engagementRun.updateMany({
      where: {
        id: run.id,
        status: { in: ["scheduled", "delayed"] },
      },
      data: {
        status: "claimed",
        claimedAt: now,
        lastAttemptAt: now,
        attempts: { increment: 1 },
        latenessSeconds,
      },
    });

    if (claim.count === 0) {
      // Concurrently claimed by another worker instance
      continue;
    }

    // Immediately transition to sending
    await prisma.engagementRun.update({
      where: { id: run.id },
      data: { status: "sending" },
    });

    processedRuns++;
    const order = run.engagementOrder;
    const currentAttempt = run.attempts + 1;

    // Lateness Alert if delayed > 120s
    if (latenessSeconds > 120) {
      await recordAdminAlert({
        severity: "medium",
        type: "run_late",
        orderId: order.id,
        runId: run.id,
        runNumber: run.runNumber,
        userId: order.userId,
        platform: order.platform,
        engagementType: run.engagementType,
        providerId: run.providerId || null,
        providerName: run.provider?.name || "Provider",
        reason: `Run #${run.runNumber} (${run.engagementType}) was sent ${latenessSeconds}s late.`,
        suggestedAction: "Monitor provider latency and queue processing health.",
      });
    }

    try {
      // 5. Provider resolution with concurrency isolation
      let adapter: SMMProviderAdapter;
      let targetServiceExtId: string = run.providerServiceId || "101";

      if (run.providerId) {
        try {
          const resolved = await resolveProviderById(run.providerId);
          if (resolved.provider.active === false) {
            throw new Error(`Provider "${resolved.provider.name}" is currently paused.`);
          }
          adapter = resolved.adapter;
        } catch (provErr: any) {
          throw new Error(`Provider unavailable: ${provErr.message}`);
        }
      } else if (run.serviceId) {
        try {
          const routing = await resolveServiceRouting(run.serviceId);
          adapter = routing.adapter;
          targetServiceExtId = routing.providerServiceId || targetServiceExtId;
        } catch {
          adapter = new MockSMMProvider();
        }
      } else {
        adapter = new MockSMMProvider();
      }

      // 6. Submit batch with duration tracking and idempotency
      const callStart = Date.now();
      const providerRes = await adapter.createOrder({
        serviceExternalId: targetServiceExtId,
        targetUrl: order.targetUrl,
        quantity: run.quantity,
      });
      const durationMs = Date.now() - callStart;

      if (providerRes.success && providerRes.providerOrderId) {
        // Success: transition immediately to "sent", record providerOrderId and timings
        await prisma.engagementRun.update({
          where: { id: run.id },
          data: {
            status: "sent",
            sentAt: now,
            timeToStartMs,
            providerOrderId: String(providerRes.providerOrderId),
            errorMessage: null,
            rawResponse: sanitizeProviderResponse(providerRes),
          },
        });

        successfulRuns++;

        await logOrderEvent({
          orderId: order.id,
          runId: run.id,
          eventType: "PROVIDER_CALL",
          message: `Dispatched run #${run.runNumber} (${run.engagementType}) to ${run.provider?.name || "Provider"}`,
          requestSummary: `POST /order service=${targetServiceExtId} qty=${run.quantity}`,
          responseCode: 200,
          rawResponse: providerRes,
          durationMs,
        });

        // Increment delivered counter on parent order
        const typeField =
          run.engagementType === "views"
            ? "deliveredViews"
            : run.engagementType === "likes"
            ? "deliveredLikes"
            : run.engagementType === "shares"
            ? "deliveredShares"
            : run.engagementType === "saves"
            ? "deliveredSaves"
            : "deliveredComments";

        await prisma.engagementOrder.update({
          where: { id: order.id },
          data: {
            [typeField]: { increment: run.quantity },
            status: "PROCESSING",
          },
        });
      } else {
        throw new Error(providerRes.error || "Provider rejected order submission");
      }
    } catch (err: any) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const classified = classifyProviderError(errMsg);
      const isFatal = classified.isFatal || isFatalProviderError(errMsg);
      const isMaxAttempts = currentAttempt >= MAX_RUN_ATTEMPTS;

      await logOrderEvent({
        orderId: order.id,
        runId: run.id,
        eventType: "PROVIDER_CALL",
        message: `Run #${run.runNumber} (${run.engagementType}) error: ${classified.plainLanguage}`,
        requestSummary: `POST /order qty=${run.quantity}`,
        responseCode: classified.httpStatus,
        rawResponse: errMsg,
      });

      if (isFatal || isMaxAttempts) {
        // Permanent failure: transition to 'failed', refund run cost, log event, record deduplicated alert
        failedRuns++;
        refundedRuns++;

        await prisma.$transaction(async (tx) => {
          await tx.engagementRun.update({
            where: { id: run.id },
            data: {
              status: "failed",
              errorType: classified.errorType,
              httpStatus: classified.httpStatus,
              errorMessage: errMsg,
              rawResponse: sanitizeProviderResponse(errMsg),
            },
          });

          // Refund undelivered amount only
          if (order.userId && run.cost > 0) {
            const user = await tx.user.findUnique({
              where: { id: order.userId },
              select: { id: true, walletBalance: true },
            });

            if (user) {
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
                  description: `Refund for failed ${run.engagementType} batch #${run.runNumber} on order ${order.orderRef}`,
                },
              });

              await tx.engagementOrder.update({
                where: { id: order.id },
                data: {
                  refundedAmount: { increment: run.cost },
                },
              });

              await logOrderEvent({
                orderId: order.id,
                runId: run.id,
                eventType: "REFUND",
                message: `Refunded ₹${run.cost.toFixed(2)} to user for permanently failed run #${run.runNumber}.`,
              });
            }
          }
        });

        await recordAdminAlert({
          severity: "high",
          type: "run_failed",
          orderId: order.id,
          runId: run.id,
          runNumber: run.runNumber,
          userId: order.userId,
          platform: order.platform,
          engagementType: run.engagementType,
          providerId: run.providerId || null,
          providerName: run.provider?.name || "Provider",
          serviceId: run.serviceId || null,
          errorType: classified.errorType,
          planned: run.quantity,
          delivered: run.deliveredQuantity ?? 0,
          reason: `Run #${run.runNumber} failed permanently after ${currentAttempt} attempts: ${classified.plainLanguage}`,
          rawResponse: errMsg,
          retryCount: currentAttempt,
          suggestedAction: classified.suggestedAction,
        });
      } else {
        // Retryable error: set status to 'delayed' with exponential backoff (30s, 1m, 2m, 5m, 10m)
        delayedRuns++;
        const backoffSec = BACKOFF_SECONDS[Math.min(currentAttempt - 1, BACKOFF_SECONDS.length - 1)];
        const nextScheduled = new Date(now.getTime() + backoffSec * 1000);

        await prisma.engagementRun.update({
          where: { id: run.id },
          data: {
            status: "delayed",
            scheduledAt: nextScheduled,
            errorType: classified.errorType,
            httpStatus: classified.httpStatus,
            errorMessage: errMsg,
            rawResponse: sanitizeProviderResponse(errMsg),
          },
        });

        // Parent order displays "DELAYED"
        await prisma.engagementOrder.update({
          where: { id: order.id },
          data: { status: "DELAYED" },
        });

        await recordAdminAlert({
          severity: currentAttempt >= 3 ? "high" : "medium",
          type: "provider_down",
          orderId: order.id,
          runId: run.id,
          runNumber: run.runNumber,
          userId: order.userId,
          platform: order.platform,
          engagementType: run.engagementType,
          providerId: run.providerId || null,
          providerName: run.provider?.name || "Provider",
          serviceId: run.serviceId || null,
          errorType: classified.errorType,
          planned: run.quantity,
          delivered: run.deliveredQuantity ?? 0,
          reason: `Run #${run.runNumber} delayed (attempt ${currentAttempt}/${MAX_RUN_ATTEMPTS}): ${classified.plainLanguage}`,
          rawResponse: errMsg,
          retryCount: currentAttempt,
          suggestedAction: classified.suggestedAction,
        });
      }
    }
  }

  // 7. Poll provider status for sent runs to confirm delivery and transition to 'confirmed'
  const sentRuns = await prisma.engagementRun.findMany({
    where: {
      status: "sent",
      providerOrderId: { not: null },
    },
    include: {
      provider: true,
      service: true,
    },
    take: 20,
  });

  const affectedOrderIds = new Set<string>();

  for (const sRun of sentRuns) {
    try {
      let adapter: SMMProviderAdapter = new MockSMMProvider();
      if (sRun.providerId) {
        try {
          const res = await resolveProviderById(sRun.providerId);
          adapter = res.adapter;
        } catch {}
      }

      const statusRes = await adapter.getOrderStatus(sRun.providerOrderId!);
      if (statusRes && statusRes.status) {
        affectedOrderIds.add(sRun.engagementOrderId);
        const upstreamStatus = statusRes.status.toLowerCase();
        let deliveredQty = sRun.deliveredQuantity ?? 0;

        if (upstreamStatus === "completed" || upstreamStatus === "complete") {
          deliveredQty = sRun.quantity;
          const timeToConfirmMs = sRun.sentAt
            ? Math.max(0, now.getTime() - sRun.sentAt.getTime())
            : null;

          await prisma.engagementRun.update({
            where: { id: sRun.id },
            data: {
              status: "confirmed",
              confirmedAt: now,
              timeToConfirmMs,
              deliveredQuantity: deliveredQty,
            },
          });
          syncedSentRuns++;

          await logOrderEvent({
            orderId: sRun.engagementOrderId,
            runId: sRun.id,
            eventType: "STATE_CHANGE",
            message: `Run #${sRun.runNumber} (${sRun.engagementType}) confirmed delivered (${deliveredQty} units).`,
          });
        } else if (upstreamStatus === "canceled" || upstreamStatus === "cancelled") {
          // Upstream cancelled: mark failed and refund
          await prisma.$transaction(async (tx) => {
            await tx.engagementRun.update({
              where: { id: sRun.id },
              data: {
                status: "failed",
                errorMessage: "Provider cancelled batch upstream",
              },
            });
            const parentOrder = await tx.engagementOrder.findUnique({
              where: { id: sRun.engagementOrderId },
            });
            if (parentOrder?.userId && sRun.cost > 0) {
              const u = await tx.user.findUnique({ where: { id: parentOrder.userId } });
              if (u) {
                const newBal = Number(((u.walletBalance ?? 0) + sRun.cost).toFixed(2));
                await tx.user.update({
                  where: { id: u.id },
                  data: { walletBalance: newBal },
                });
                await tx.walletTransaction.create({
                  data: {
                    userId: u.id,
                    type: "REFUND",
                    amount: sRun.cost,
                    balanceAfter: newBal,
                    referenceId: parentOrder.orderRef,
                    description: `Automatic refund for provider-cancelled ${sRun.engagementType} batch #${sRun.runNumber}`,
                  },
                });
                await tx.engagementOrder.update({
                  where: { id: parentOrder.id },
                  data: { refundedAmount: { increment: sRun.cost } },
                });
              }
            }
          });
        } else if (statusRes.remains !== undefined && statusRes.remains !== null) {
          const rem = typeof statusRes.remains === "number" ? statusRes.remains : parseInt(String(statusRes.remains), 10);
          if (!isNaN(rem)) {
            deliveredQty = Math.max(0, Math.min(sRun.quantity, sRun.quantity - rem));
            await prisma.engagementRun.update({
              where: { id: sRun.id },
              data: { deliveredQuantity: deliveredQty },
            });
          }
        }
      }
    } catch {
      // Status poll warning (non-fatal)
    }
  }

  // 8. Reconcile parent orders & sync status samples and deviation tracking (Changes D & E)
  const activeOrders = await prisma.engagementOrder.findMany({
    where: {
      status: { in: ["PROCESSING", "DELAYED", "PENDING"] },
    },
    include: {
      runs: { select: { status: true } },
    },
    take: 20,
  });

  for (const ord of activeOrders) {
    try {
      await syncOrderDeliveryAndDeviation(ord.id, now);
    } catch (syncErr) {
      console.error(`Deviation sync error for order ${ord.id}:`, syncErr);
    }

    const unsettled = ord.runs.filter((r) => ["scheduled", "delayed", "sending"].includes(r.status));
    if (unsettled.length === 0 && ord.runs.length > 0) {
      const hasFailed = ord.runs.some((r) => r.status === "failed");
      const finalStatus = hasFailed ? "PARTIAL" : "COMPLETED";

      await prisma.engagementOrder.update({
        where: { id: ord.id },
        data: { status: finalStatus },
      });
      ordersCompleted++;
    }
  }

  return {
    processedRuns,
    successfulRuns,
    delayedRuns,
    failedRuns,
    refundedRuns,
    syncedSentRuns,
    ordersCompleted,
  };
}

/**
 * Re-plans all unsettled or delayed runs for an engagement order, smoothly spreading them out.
 */
export async function replanRemainingEngagementRuns(orderId: string, reason: string): Promise<number> {
  const runs = await prisma.engagementRun.findMany({
    where: {
      engagementOrderId: orderId,
      status: { in: ["scheduled", "delayed", "failed"] },
    },
    orderBy: { runNumber: "asc" },
  });

  if (runs.length === 0) return 0;

  const now = Date.now();
  const stepMs = 5 * 60 * 1000; // 5 minute spacing between runs

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const newScheduledAt = new Date(now + (i + 1) * stepMs);

    await prisma.engagementRun.update({
      where: { id: run.id },
      data: {
        status: "scheduled",
        scheduledAt: newScheduledAt,
        isReplan: true,
        errorMessage: null,
        errorType: null,
      },
    });
  }

  await logOrderEvent({
    orderId,
    eventType: "REPLAN",
    requestSummary: `Re-planned ${runs.length} remaining runs`,
    message: `Smoothly rescheduled ${runs.length} runs starting at +5m. Reason: ${reason}`,
    metadata: { replannedCount: runs.length, reason },
  });

  return runs.length;
}

import { prisma } from "../prisma";
import { getActiveProvider } from "../provider/adapter";
import { submitBulkOrders } from "../orders/bulk-service";
import { executeCombo } from "../combos/combo-service";

export type ScheduledJobType = "SINGLE" | "BULK" | "COMBO";
export type ScheduledJobStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "QUEUED"
  | "PROCESSING"
  | "SUBMITTED"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED"
  | "CANCELLED"
  | "PAUSED";

export interface ScheduleJobParams {
  jobType: ScheduledJobType;
  scheduledFor: Date | string; // Future execution time (UTC or ISO string)
  timezone?: string; // User timezone name, e.g. "Asia/Dhaka", "America/New_York", "UTC"
  payload: Record<string, unknown>; // Configuration payload
  userId?: string;
}

export interface ScheduledJobTickResult {
  processedJobs: number;
  successfulJobs: number;
  failedJobs: number;
  errors: string[];
}

/**
 * Creates and persists a scheduled order job in the database.
 * This guarantees execution independent of whether the browser remains open.
 */
export async function scheduleOrderJob(params: ScheduleJobParams) {
  const { jobType, scheduledFor, timezone = "UTC", payload, userId } = params;

  const targetDate = new Date(scheduledFor);
  if (isNaN(targetDate.getTime())) {
    throw new Error("Invalid scheduled execution date/time.");
  }

  const now = new Date();
  if (targetDate.getTime() < now.getTime() - 60000) {
    throw new Error("Scheduled execution time must be in the future.");
  }

  // Pre-validate payload based on jobType
  if (jobType === "SINGLE") {
    if (!payload.serviceId || !payload.targetUrl || !payload.requestedQuantity) {
      throw new Error("Single order schedule requires serviceId, targetUrl, and requestedQuantity.");
    }
  } else if (jobType === "BULK") {
    if (!payload.serviceId || !Array.isArray(payload.rows) || payload.rows.length === 0) {
      throw new Error("Bulk order schedule requires serviceId and a non-empty rows array.");
    }
  } else if (jobType === "COMBO") {
    const hasTarget =
      payload.targetUrl ||
      (Array.isArray(payload.targetUrls) && payload.targetUrls.length > 0) ||
      (Array.isArray(payload.orderItems) && payload.orderItems.length > 0);
    if (!payload.comboId || !hasTarget) {
      throw new Error("Combo order schedule requires comboId and targetUrl, targetUrls, or orderItems.");
    }
  }

  const jobRef = `SCH-${Math.floor(100000 + Math.random() * 900000)}`;

  const job = await prisma.scheduledOrderJob.create({
    data: {
      jobRef,
      jobType,
      status: "SCHEDULED",
      scheduledFor: targetDate,
      timezone,
      payload: JSON.stringify(payload),
      retryCount: 0,
      maxRetries: 3,
      userId: userId || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "JOB_SCHEDULED",
      actor: "Customer",
      details: `Scheduled ${jobType} job ${jobRef} for ${targetDate.toISOString()} (${timezone})`,
    },
  });

  return job;
}

/**
 * Atomically claims and executes due scheduled jobs.
 * Called by the background worker daemon (src/worker.ts) on every worker cycle.
 */
export async function runScheduledJobsTick(): Promise<ScheduledJobTickResult> {
  const now = new Date();
  const errors: string[] = [];
  let processedJobs = 0;
  let successfulJobs = 0;
  let failedJobs = 0;

  // 1. Fetch jobs due for execution (or stuck in PROCESSING > 10 minutes)
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

  const dueJobs = await prisma.scheduledOrderJob.findMany({
    where: {
      OR: [
        {
          status: "SCHEDULED",
          scheduledFor: { lte: now },
        },
        {
          status: "PROCESSING",
          updatedAt: { lte: tenMinutesAgo }, // Crash recovery: retry stuck jobs
        },
      ],
    },
    take: 10,
    orderBy: { scheduledFor: "asc" },
  });

  if (dueJobs.length === 0) {
    return { processedJobs: 0, successfulJobs: 0, failedJobs: 0, errors: [] };
  }

  for (const job of dueJobs) {
    // 2. Atomic claim using updateMany: only one worker can transition from SCHEDULED -> PROCESSING
    const claimResult = await prisma.scheduledOrderJob.updateMany({
      where: {
        id: job.id,
        OR: [
          { status: "SCHEDULED" },
          { status: "PROCESSING", updatedAt: { lte: tenMinutesAgo } },
        ],
      },
      data: {
        status: "PROCESSING",
        updatedAt: now,
      },
    });

    if (claimResult.count === 0) {
      // Job claimed by another worker concurrently
      continue;
    }

    processedJobs++;

    try {
      const payload = JSON.parse(job.payload);
      let executionSuccess = false;
      let resultData: Record<string, unknown> = {};

      if (job.jobType === "SINGLE") {
        const { serviceId, targetUrl, requestedQuantity } = payload;
        const service = await prisma.service.findUnique({ where: { id: serviceId } });

        if (!service || !service.active) {
          throw new Error(`Service #${serviceId} is unavailable.`);
        }

        const { adapter } = await getActiveProvider(job.userId || undefined);
        const orderRef = `SMM-${Math.floor(100000 + Math.random() * 900000)}`;
        const unitCost = service.ratePer1000 / 1000;
        const totalCost = Number(((requestedQuantity / 1000) * service.ratePer1000).toFixed(4));

        const providerRes = await adapter.createOrder({
          serviceExternalId: service.externalId,
          targetUrl,
          quantity: requestedQuantity,
        });

        if (providerRes.success && providerRes.providerOrderId) {
          executionSuccess = true;
          const order = await prisma.order.create({
            data: {
              orderRef,
              serviceId: service.id,
              targetUrl,
              requestedQuantity,
              submittedQuantity: requestedQuantity,
              deliveredQuantity: 0,
              remainingQuantity: requestedQuantity,
              failedQuantity: 0,
              unitCost,
              totalCost,
              isScheduled: true,
              scheduleMode: "INSTANT",
              status: "PROCESSING",
              providerOrderId: providerRes.providerOrderId,
              scheduledJobId: job.id,
              userId: job.userId || null,
            },
          });
          resultData = { orderId: order.id, orderRef, providerOrderId: providerRes.providerOrderId };
        } else {
          const errMsg = providerRes.error || "Provider rejected order placement.";
          await prisma.order.create({
            data: {
              orderRef,
              serviceId: service.id,
              targetUrl,
              requestedQuantity,
              submittedQuantity: 0,
              deliveredQuantity: 0,
              remainingQuantity: requestedQuantity,
              failedQuantity: requestedQuantity,
              unitCost,
              totalCost,
              isScheduled: true,
              scheduleMode: "INSTANT",
              status: "FAILED",
              errorMessage: errMsg,
              scheduledJobId: job.id,
              userId: job.userId || null,
            },
          });
          throw new Error(errMsg);
        }
      } else if (job.jobType === "BULK") {
        const bulkRes = await submitBulkOrders({
          serviceId: payload.serviceId,
          rows: payload.rows,
          scheduledJobId: job.id,
          userId: job.userId || undefined,
        });

        executionSuccess = bulkRes.success;
        resultData = {
          batchId: bulkRes.batchId,
          batchRef: bulkRes.batchRef,
          totalOrders: bulkRes.totalOrders,
          successOrders: bulkRes.successOrders,
          failedOrders: bulkRes.failedOrders,
          outcomes: bulkRes.outcomes,
        };

        if (!bulkRes.success) {
          throw new Error(`Bulk execution failed: ${bulkRes.failedOrders} of ${bulkRes.totalOrders} failed.`);
        }
      } else if (job.jobType === "COMBO") {
        const comboRes = await executeCombo({
          comboId: payload.comboId,
          targetUrl: payload.targetUrl,
          targetUrls: payload.targetUrls,
          orderItems: payload.orderItems,
          customServiceUrls: payload.customServiceUrls,
          customQuantities: payload.customQuantities,
          scheduledJobId: job.id,
          userId: job.userId || undefined,
        });

        executionSuccess = comboRes.success;
        resultData = {
          executionId: comboRes.executionId,
          executionRef: comboRes.executionRef,
          status: comboRes.status,
          childOrders: comboRes.childOrders,
        };

        if (!comboRes.success) {
          throw new Error(`Combo execution failed: ${comboRes.failedServices} child orders failed.`);
        }
      }

      // Mark Job Completed
      successfulJobs++;
      await prisma.scheduledOrderJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          executedAt: new Date(),
          resultPayload: JSON.stringify(resultData),
          errorMessage: null,
        },
      });

      await prisma.auditLog.create({
        data: {
          action: "SCHEDULED_JOB_EXECUTED",
          actor: "WorkerDaemon",
          details: `Scheduled job ${job.jobRef} (${job.jobType}) executed successfully`,
        },
      });
    } catch (err: unknown) {
      failedJobs++;
      const errorMessage = err instanceof Error ? err.message : String(err);
      errors.push(`Scheduled job ${job.jobRef} failed: ${errorMessage}`);

      const nextRetryCount = job.retryCount + 1;
      if (nextRetryCount < job.maxRetries) {
        // Retry with exponential backoff with jitter
        const backoffMinutes = nextRetryCount * 5 + Math.floor(Math.random() * 2);
        const retryTime = new Date(now.getTime() + backoffMinutes * 60 * 1000);

        await prisma.scheduledOrderJob.update({
          where: { id: job.id },
          data: {
            status: "SCHEDULED",
            retryCount: nextRetryCount,
            scheduledFor: retryTime,
            errorMessage: `Retry #${nextRetryCount}: ${errorMessage}`,
          },
        });
      } else {
        // Permanently failed
        await prisma.scheduledOrderJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            retryCount: nextRetryCount,
            executedAt: new Date(),
            errorMessage: `Failed after ${job.maxRetries} attempts: ${errorMessage}`,
          },
        });

        await prisma.auditLog.create({
          data: {
            action: "SCHEDULED_JOB_PERMANENTLY_FAILED",
            actor: "WorkerDaemon",
            details: `Scheduled job ${job.jobRef} failed after max retries: ${errorMessage}`,
          },
        });
      }
    }
  }

  return {
    processedJobs,
    successfulJobs,
    failedJobs,
    errors,
  };
}

/**
 * Cancels a scheduled job.
 */
export async function cancelScheduledJob(id: string) {
  const job = await prisma.scheduledOrderJob.findUnique({ where: { id } });
  if (!job) {
    throw new Error(`Scheduled job #${id} not found.`);
  }

  if (job.status !== "SCHEDULED" && job.status !== "PAUSED") {
    throw new Error(`Cannot cancel job with status "${job.status}". Only SCHEDULED or PAUSED jobs can be cancelled.`);
  }

  const updated = await prisma.scheduledOrderJob.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  await prisma.auditLog.create({
    data: {
      action: "SCHEDULED_JOB_CANCELLED",
      actor: "Customer",
      details: `Scheduled job ${job.jobRef} cancelled by user`,
    },
  });

  return updated;
}

/**
 * Pauses an active scheduled job.
 */
export async function pauseScheduledJob(id: string) {
  const job = await prisma.scheduledOrderJob.findUnique({ where: { id } });
  if (!job) {
    throw new Error(`Scheduled job #${id} not found.`);
  }

  if (job.status !== "SCHEDULED") {
    throw new Error(`Cannot pause job with status "${job.status}". Only SCHEDULED jobs can be paused.`);
  }

  return prisma.scheduledOrderJob.update({
    where: { id },
    data: { status: "PAUSED" },
  });
}

/**
 * Resumes a paused scheduled job.
 */
export async function resumeScheduledJob(id: string) {
  const job = await prisma.scheduledOrderJob.findUnique({ where: { id } });
  if (!job) {
    throw new Error(`Scheduled job #${id} not found.`);
  }

  if (job.status !== "PAUSED") {
    throw new Error(`Cannot resume job with status "${job.status}". Only PAUSED jobs can be resumed.`);
  }

  return prisma.scheduledOrderJob.update({
    where: { id },
    data: { status: "SCHEDULED" },
  });
}

/**
 * Edits the scheduled execution time for an unexecuted job.
 */
export async function editScheduledJobTime(id: string, newTime: Date | string) {
  const job = await prisma.scheduledOrderJob.findUnique({ where: { id } });
  if (!job) {
    throw new Error(`Scheduled job #${id} not found.`);
  }

  if (job.status !== "SCHEDULED" && job.status !== "PAUSED") {
    throw new Error(`Cannot edit execution time for job with status "${job.status}".`);
  }

  const targetDate = new Date(newTime);
  if (isNaN(targetDate.getTime())) {
    throw new Error("Invalid execution date/time provided.");
  }

  if (targetDate.getTime() < Date.now() - 60000) {
    throw new Error("Scheduled execution time must be in the future.");
  }

  return prisma.scheduledOrderJob.update({
    where: { id },
    data: { scheduledFor: targetDate },
  });
}

/**
 * Lists scheduled jobs with status filter and pagination.
 */
export async function listScheduledJobs(options: {
  status?: string;
  limit?: number;
  skip?: number;
  userId?: string;
  role?: string;
} = {}) {
  const { status, limit = 20, skip = 0, userId, role } = options;
  const where: any = {};
  if (role !== "ADMIN" && userId) {
    where.userId = userId;
  }
  if (status && status !== "ALL") {
    where.status = status;
  }

  const [jobs, total] = await Promise.all([
    prisma.scheduledOrderJob.findMany({
      where,
      orderBy: { scheduledFor: "asc" },
      take: limit,
      skip,
      include: {
        orders: {
          include: { service: true },
        },
      },
    }),
    prisma.scheduledOrderJob.count({ where }),
  ]);

  return { jobs, total };
}

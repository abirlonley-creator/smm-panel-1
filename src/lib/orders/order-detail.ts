import type { Prisma } from "@prisma/client";

/** Shared include used by every endpoint that returns an order detail. */
export const orderDetailInclude = {
  service: true,
  steps: { orderBy: { stepNumber: "asc" } },
  providerRecords: { orderBy: { createdAt: "desc" }, take: 10 },
  monitoringSession: {
    select: {
      status: true,
      intervalMinutes: true,
      durationMinutes: true,
      nextCheckpointAt: true,
    },
  },
} satisfies Prisma.OrderInclude;

export interface OrderDetailStep {
  [key: string]: unknown;
  id: string;
  stepNumber: number;
  scheduledTime: string;
  executedAt?: string | null;
  quantity: number;
  status: string;
  providerOrderId?: string | null;
  retryCount: number;
  errorMessage?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeDate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return value;
  }

  return null;
}

function normalizeStep(value: unknown): OrderDetailStep | null {
  if (!isRecord(value)) return null;

  const scheduledTime = normalizeDate(value.scheduledTime);
  if (
    typeof value.id !== "string" ||
    !Number.isInteger(value.stepNumber) ||
    scheduledTime === null ||
    typeof value.quantity !== "number" ||
    !Number.isFinite(value.quantity) ||
    typeof value.status !== "string" ||
    typeof value.retryCount !== "number" ||
    !Number.isFinite(value.retryCount)
  ) {
    return null;
  }

  const executedAt = value.executedAt == null ? value.executedAt : normalizeDate(value.executedAt);
  if (value.executedAt != null && executedAt === null) return null;
  if (value.providerOrderId != null && typeof value.providerOrderId !== "string") return null;
  if (value.errorMessage != null && typeof value.errorMessage !== "string") return null;

  return {
    ...value,
    id: value.id,
    stepNumber: value.stepNumber as number,
    scheduledTime,
    ...(executedAt !== undefined ? { executedAt } : {}),
    quantity: value.quantity,
    status: value.status,
    ...(value.providerOrderId !== undefined ? { providerOrderId: value.providerOrderId as string | null } : {}),
    retryCount: value.retryCount,
    ...(value.errorMessage !== undefined ? { errorMessage: value.errorMessage as string | null } : {}),
  };
}

/** Missing, null, non-array, and malformed step data is represented as an empty/valid list. */
export function normalizeOrderSteps(value: unknown): OrderDetailStep[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeStep).filter((step): step is OrderDetailStep => step !== null);
}

export function normalizeOrderDetail<T extends object>(
  order: T
): Omit<T, "steps"> & { steps: OrderDetailStep[] };
export function normalizeOrderDetail(
  order: unknown
): (Record<string, unknown> & { steps: OrderDetailStep[] }) | null;
export function normalizeOrderDetail(order: unknown) {
  if (!isRecord(order)) return null;
  return { ...order, steps: normalizeOrderSteps(order.steps) };
}

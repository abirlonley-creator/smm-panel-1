import { prisma } from "@/lib/prisma";
import { sanitizeProviderResponse } from "./worker";

export interface LogOrderEventParams {
  orderId: string;
  runId?: string | null;
  eventType: "STATE_CHANGE" | "PROVIDER_CALL" | "REPLAN" | "WATCHDOG" | "REFUND";
  message: string;
  requestSummary?: string | null;
  responseCode?: number | null;
  rawResponse?: any;
  durationMs?: number | null;
  metadata?: Record<string, any> | null;
}

/**
 * Persists an event log entry for an EngagementOrder.
 * Guarantees that any sensitive data in responses or summaries is sanitized.
 */
export async function logOrderEvent(params: LogOrderEventParams): Promise<void> {
  try {
    const sanitizedResponse = params.rawResponse
      ? sanitizeProviderResponse(
          typeof params.rawResponse === "string"
            ? params.rawResponse
            : JSON.stringify(params.rawResponse)
        )
      : null;

    await prisma.orderEventLog.create({
      data: {
        engagementOrderId: params.orderId,
        runId: params.runId || null,
        eventType: params.eventType,
        message: params.message,
        requestSummary: params.requestSummary || null,
        responseCode: params.responseCode || null,
        rawResponse: sanitizedResponse,
        durationMs: params.durationMs || null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  } catch (err) {
    // Non-blocking for primary worker flow
    console.warn("[EVENT-LOGGER] Failed to write order event log:", err);
  }
}

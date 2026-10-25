import { prisma } from "@/lib/prisma";
import { sanitizeProviderResponse } from "./worker";

export interface RecordAlertParams {
  severity: "high" | "medium" | "low";
  type: string;
  orderId?: string | null;
  runId?: string | null;
  runNumber?: number | null;
  userId?: string | null;
  platform?: string | null;
  engagementType?: string | null;
  providerId?: string | null;
  providerName?: string | null;
  serviceId?: string | null;
  planned?: number | null;
  delivered?: number | null;
  deviationPercent?: number | null;
  errorType?: string | null;
  reason: string;
  rawResponse?: any;
  retryCount?: number;
  actionTaken?: string | null;
  suggestedAction?: string | null;
}

/**
 * Creates or updates an AdminAlert with deduplication by (providerId, serviceId, errorType/type).
 * Prevents flooding the admin console with identical repeated errors.
 */
export async function recordAdminAlert(params: RecordAlertParams): Promise<any> {
  try {
    const now = new Date();
    const sanitizedRaw = params.rawResponse
      ? sanitizeProviderResponse(
          typeof params.rawResponse === "string"
            ? params.rawResponse
            : JSON.stringify(params.rawResponse)
        )
      : null;

    const dedupKey = [
      params.providerId || "system",
      params.serviceId || "all",
      params.errorType || params.type,
    ].join(":");

    // Look for an existing OPEN alert with this deduplication key
    const existing = await prisma.adminAlert.findFirst({
      where: {
        status: "open",
        dedupKey,
      },
    });

    if (existing) {
      // Deduplicate: increment counter and update timestamp
      const updated = await prisma.adminAlert.update({
        where: { id: existing.id },
        data: {
          dedupCount: { increment: 1 },
          lastSeenAt: now,
          retryCount: params.retryCount ?? existing.retryCount,
          rawResponse: sanitizedRaw || existing.rawResponse,
          reason: params.reason, // Keep updated latest reason
          actionTaken: params.actionTaken || existing.actionTaken,
        },
      });

      return updated;
    }

    // Create fresh alert
    const created = await prisma.adminAlert.create({
      data: {
        severity: params.severity,
        type: params.type,
        orderId: params.orderId || null,
        runId: params.runId || null,
        runNumber: params.runNumber || null,
        userId: params.userId || null,
        platform: params.platform || null,
        engagementType: params.engagementType || null,
        providerId: params.providerId || null,
        providerName: params.providerName || null,
        serviceId: params.serviceId || null,
        planned: params.planned || null,
        delivered: params.delivered || null,
        deviationPercent: params.deviationPercent || null,
        errorType: params.errorType || null,
        dedupKey,
        dedupCount: 1,
        lastSeenAt: now,
        reason: params.reason,
        rawResponse: sanitizedRaw,
        retryCount: params.retryCount ?? 0,
        status: "open",
        actionTaken: params.actionTaken || null,
        suggestedAction: params.suggestedAction || null,
      },
    });

    // If HIGH severity, attempt webhook notification
    if (params.severity === "high") {
      dispatchAlertWebhook(created).catch((err) => {
        console.warn("[ALERT-SERVICE] Webhook notification skipped or failed:", err.message);
      });
    }

    return created;
  } catch (err: any) {
    console.error("[ALERT-SERVICE] Failed to record admin alert:", err);
    return null;
  }
}

/**
 * Dispatches an outbound webhook for HIGH-severity alerts (e.g. Telegram or custom webhook).
 * Never exposes un-sanitized secrets.
 */
async function dispatchAlertWebhook(alert: any) {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  const genericWebhookUrl = process.env.ADMIN_ALERT_WEBHOOK_URL;

  const alertText = `🚨 [AURASMM HIGH ALERT]\nType: ${alert.type}\nProvider: ${alert.providerName || "N/A"}\nReason: ${alert.reason}\nAction: ${alert.suggestedAction || "Review Admin Console"}`;

  if (telegramBotToken && telegramChatId) {
    try {
      await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: alertText,
          parse_mode: "HTML",
        }),
      });
    } catch (e: any) {
      console.warn("[TELEGRAM-ALERT] Failed to send Telegram alert:", e.message);
    }
  }

  if (genericWebhookUrl) {
    try {
      await fetch(genericWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert: {
            id: alert.id,
            severity: alert.severity,
            type: alert.type,
            reason: alert.reason,
            createdAt: alert.createdAt,
          },
        }),
      });
    } catch (e: any) {
      console.warn("[GENERIC-WEBHOOK] Webhook call failed:", e.message);
    }
  }
}

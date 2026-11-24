/**
 * Telegram Out-of-Band Security Alerting & Destructive Action Approval Gate
 * Delivers immediate notifications to the administrator's designated Telegram chat.
 */
import { redis } from "./redis";
import crypto from "crypto";

const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || "";

export async function sendTelegramSecurityAlert(params: {
  title: string;
  details: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  ip?: string;
  userAgent?: string;
}): Promise<boolean> {
  const icon =
    params.severity === "CRITICAL"
      ? "🚨 [CRITICAL ALERT]"
      : params.severity === "WARNING"
      ? "⚠️ [SECURITY WARNING]"
      : "🛡️ [SECURITY NOTICE]";

  const message = [
    `<b>${icon} — AuraSMM Security Gate</b>`,
    `<b>Event:</b> ${escapeHtml(params.title)}`,
    `<b>Details:</b> ${escapeHtml(params.details)}`,
    params.ip ? `<b>IP:</b> <code>${escapeHtml(params.ip)}</code>` : null,
    params.userAgent ? `<b>Client:</b> <code>${escapeHtml(params.userAgent.slice(0, 80))}</code>` : null,
    `<b>Time (UTC):</b> ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n");

  return postTelegramMessage(message);
}

/**
 * Creates an out-of-band approval token for high-risk destructive actions
 * (e.g., deleting users, clearing balances, changing provider secrets).
 */
export async function createApprovalRequest(params: {
  action: string;
  actor: string;
  target: string;
  metadata?: Record<string, unknown>;
}): Promise<{ approvalId: string; expiresAt: number }> {
  const approvalId = `appr_${crypto.randomBytes(16).toString("hex")}`;
  const ttlSeconds = 300; // 5 minute validity window

  const payload = {
    approvalId,
    action: params.action,
    actor: params.actor,
    target: params.target,
    metadata: params.metadata || {},
    status: "PENDING",
    createdAt: Date.now(),
  };

  await redis.set(`aurasmm:approval:${approvalId}`, JSON.stringify(payload), {
    ex: ttlSeconds,
  });

  const alertMessage = [
    `<b>⚠️ DESTRUCTIVE ACTION CONFIRMATION REQUIRED</b>`,
    `<b>Action:</b> <code>${escapeHtml(params.action)}</code>`,
    `<b>Target:</b> <code>${escapeHtml(params.target)}</code>`,
    `<b>Initiator:</b> ${escapeHtml(params.actor)}`,
    `<b>Approval Code:</b> <code>${approvalId}</code>`,
    `<i>This request expires in 5 minutes. Enter this code in your step-up prompt to confirm.</i>`,
  ].join("\n");

  await postTelegramMessage(alertMessage);

  return { approvalId, expiresAt: Date.now() + ttlSeconds * 1000 };
}

/**
 * Verifies that an out-of-band approval exists, is pending, and marks it consumed.
 */
export async function verifyAndConsumeApproval(approvalId: string): Promise<boolean> {
  if (!approvalId) return false;
  const key = `aurasmm:approval:${approvalId}`;
  const data = await redis.get<string>(key);
  if (!data) return false;

  const parsed = typeof data === "string" ? JSON.parse(data) : data;
  if (parsed.status !== "PENDING") return false;

  // Mark consumed
  await redis.del(key);
  return true;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function postTelegramMessage(text: string): Promise<boolean> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: adminChatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("[Telegram Bot] Notification delivery error:", err);
    return false;
  }
}

/**
 * Telegram Out-of-Band Security Alerting & Destructive Action Approval Gate
 * Delivers immediate notifications to the administrator's designated Telegram chat.
 */
import { redis } from "./redis";
import crypto from "crypto";

const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || "";

export interface ApprovalPayload {
  approvalId: string;
  action: string;
  actor: string;
  actorId?: string;
  target: string;
  fromValue?: string;
  toValue?: string;
  metadata?: Record<string, unknown>;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decidedBy?: string;
  decidedAt?: number;
  createdAt: number;
}

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

  const payload: ApprovalPayload = {
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
 * Creates an interactive Telegram approval request with inline Approve / Reject buttons
 * for Co-Admin rate or service modifications (showing From -> To values).
 */
export async function createRateChangeApprovalRequest(params: {
  actor: string;
  actorId: string;
  action: string;
  target: string;
  fromValue: string;
  toValue: string;
  metadata?: Record<string, unknown>;
}): Promise<{ approvalId: string; expiresAt: number }> {
  const approvalId = `appr_${crypto.randomBytes(12).toString("hex")}`;
  const ttlSeconds = 600; // 10 minute validity window

  const payload: ApprovalPayload = {
    approvalId,
    action: params.action,
    actor: params.actor,
    actorId: params.actorId,
    target: params.target,
    fromValue: params.fromValue,
    toValue: params.toValue,
    metadata: params.metadata || {},
    status: "PENDING",
    createdAt: Date.now(),
  };

  await redis.set(`aurasmm:approval:${approvalId}`, JSON.stringify(payload), {
    ex: ttlSeconds,
  });

  const alertMessage = [
    `<b>🔐 CO-ADMIN RATE CHANGE REQUEST</b>`,
    `<b>Co-Admin:</b> @${escapeHtml(params.actor)}`,
    `<b>Action:</b> <code>${escapeHtml(params.action)}</code>`,
    `<b>Target:</b> ${escapeHtml(params.target)}`,
    `<b>From:</b> <code>${escapeHtml(params.fromValue)}</code>`,
    `<b>To:</b> <code>${escapeHtml(params.toValue)}</code>`,
    `<b>ID:</b> <code>${approvalId}</code>`,
    `<i>Tap Approve below to apply this change immediately, or Reject to block it.</i>`,
  ].join("\n");

  await postTelegramMessage(alertMessage, {
    inline_keyboard: [
      [
        { text: "✅ Approve Change", callback_data: `approve:${approvalId}` },
        { text: "❌ Reject", callback_data: `reject:${approvalId}` },
      ],
    ],
  });

  return { approvalId, expiresAt: Date.now() + ttlSeconds * 1000 };
}

export async function getApprovalStatus(approvalId: string): Promise<ApprovalPayload | null> {
  if (!approvalId) return null;
  const key = `aurasmm:approval:${approvalId}`;
  const data = await redis.get<string>(key);
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : (data as ApprovalPayload);
}

export async function setApprovalDecision(
  approvalId: string,
  decision: "APPROVED" | "REJECTED",
  decidedBy: string
): Promise<ApprovalPayload | null> {
  const key = `aurasmm:approval:${approvalId}`;
  const existing = await getApprovalStatus(approvalId);
  if (!existing || existing.status !== "PENDING") return existing;

  const updated: ApprovalPayload = {
    ...existing,
    status: decision,
    decidedBy,
    decidedAt: Date.now(),
  };

  await redis.set(key, JSON.stringify(updated), { ex: 600 });
  return updated;
}

/**
 * Verifies that an out-of-band approval exists, is pending or approved, and marks it consumed.
 */
export async function verifyAndConsumeApproval(approvalId: string): Promise<boolean> {
  if (!approvalId) return false;
  const key = `aurasmm:approval:${approvalId}`;
  const data = await redis.get<string>(key);
  if (!data) return false;

  const parsed = typeof data === "string" ? JSON.parse(data) : data;
  if (parsed.status !== "PENDING" && parsed.status !== "APPROVED") return false;

  await redis.del(key);
  return true;
}

/**
 * Strictly verifies that the Master Admin explicitly clicked "Approve" on Telegram.
 * Co-admins cannot self-consume PENDING approvals.
 */
export async function verifyAndConsumeTelegramApproved(
  approvalId: string,
  expectedActorId?: string
): Promise<boolean> {
  if (!approvalId) return false;
  const key = `aurasmm:approval:${approvalId}`;
  const parsed = await getApprovalStatus(approvalId);
  if (!parsed) return false;
  if (parsed.status !== "APPROVED") return false;
  if (expectedActorId && parsed.actorId && parsed.actorId !== expectedActorId) {
    return false;
  }

  await redis.del(key);
  return true;
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function postTelegramMessage(
  text: string,
  replyMarkup?: Record<string, unknown>
): Promise<boolean> {
  if (!botToken || !adminChatId) return false;
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
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("[Telegram Bot] Notification delivery error:", err);
    return false;
  }
}

export async function answerTelegramCallback(
  callbackQueryId: string,
  text: string,
  showAlert = false
): Promise<void> {
  if (!botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
      }),
    });
  } catch (err) {
    console.error("[Telegram Bot] answerCallbackQuery error:", err);
  }
}

export async function editTelegramMessageText(
  chatId: string | number,
  messageId: number,
  text: string
): Promise<void> {
  if (!botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    console.error("[Telegram Bot] editMessageText error:", err);
  }
}

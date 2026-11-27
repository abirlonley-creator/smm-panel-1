import { NextResponse } from "next/server";
import {
  answerTelegramCallback,
  editTelegramMessageText,
  setApprovalDecision,
} from "@/lib/security/telegram";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, service: "AuraSMM Telegram Security Webhook" });
}

export async function POST(request: Request) {
  try {
    const update = await request.json();
    const callback = update?.callback_query;

    if (!callback) {
      return NextResponse.json({ ok: true });
    }

    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || "";
    const chatId = String(callback.message?.chat?.id ?? "");
    const fromId = String(callback.from?.id ?? "");

    // Security guard: Only the configured Master Admin Telegram chat can approve/reject
    if (adminChatId && chatId !== adminChatId && fromId !== adminChatId) {
      await answerTelegramCallback(
        callback.id,
        "Unauthorized: Only the Master Admin can approve or reject changes.",
        true
      );
      return NextResponse.json({ ok: false, error: "Unauthorized chat" }, { status: 403 });
    }

    const data = String(callback.data || "");
    const [action, approvalId] = data.split(":");
    if (!approvalId || (action !== "approve" && action !== "reject")) {
      await answerTelegramCallback(callback.id, "Invalid action.");
      return NextResponse.json({ ok: true });
    }

    const decision = action === "approve" ? "APPROVED" : "REJECTED";
    const actorName = callback.from?.username
      ? `@${callback.from.username}`
      : callback.from?.first_name || "Master Admin";

    const updated = await setApprovalDecision(approvalId, decision, actorName);

    if (!updated) {
      await answerTelegramCallback(callback.id, "This approval request has expired.", true);
      if (callback.message?.message_id) {
        await editTelegramMessageText(
          chatId,
          callback.message.message_id,
          `${callback.message.text || ""}\n\n⏳ <b>EXPIRED</b>`
        );
      }
      return NextResponse.json({ ok: true });
    }

    const statusBadge =
      decision === "APPROVED"
        ? `✅ <b>APPROVED</b> by ${actorName} — Co-admin can now apply this change.`
        : `❌ <b>REJECTED</b> by ${actorName} — Change was blocked.`;

    await answerTelegramCallback(
      callback.id,
      decision === "APPROVED" ? "Change Approved!" : "Change Rejected!"
    );

    if (callback.message?.message_id) {
      const baseText = [
        `<b>🔐 CO-ADMIN RATE CHANGE REQUEST</b>`,
        `<b>Co-Admin:</b> @${updated.actor}`,
        `<b>Action:</b> <code>${updated.action}</code>`,
        `<b>Target:</b> ${updated.target}`,
        updated.fromValue ? `<b>From:</b> <code>${updated.fromValue}</code>` : null,
        updated.toValue ? `<b>To:</b> <code>${updated.toValue}</code>` : null,
        `<b>ID:</b> <code>${updated.approvalId}</code>`,
        ``,
        statusBadge,
      ]
        .filter((l) => l !== null)
        .join("\n");

      await editTelegramMessageText(chatId, callback.message.message_id, baseText);
    }

    return NextResponse.json({ ok: true, status: updated.status });
  } catch (error: any) {
    console.error("[Telegram Webhook Error]:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

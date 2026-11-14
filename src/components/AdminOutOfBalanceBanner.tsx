"use client";

import React, { useState } from "react";
import { AlertTriangle, Send, Bell, Check, Loader2 } from "lucide-react";

interface AdminOutOfBalanceBannerProps {
  providerName?: string;
  orderType?: string;
  serviceName?: string;
  onDismiss?: () => void;
}

export function AdminOutOfBalanceBanner({
  providerName = "Upstream Provider",
  orderType = "Campaign",
  serviceName,
  onDismiss,
}: AdminOutOfBalanceBannerProps) {
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);

  async function handleNotifyAdmin() {
    setNotifying(true);
    try {
      const res = await fetch("/api/user/notify-admin-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerName,
          orderType,
          serviceName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotified(true);
      }
    } catch (err) {
      console.warn("Could not notify admin:", err);
    } finally {
      setNotifying(false);
    }
  }

  const telegramMsg = encodeURIComponent(
    `Hello Admin! I attempted to place a ${orderType} on AuraSMM, but the admin fulfillment provider (${providerName}) has run out of balance. My wallet balance is ready. Please refill your provider account so my order can be placed! Thank you.`
  );

  return (
    <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 shadow-md space-y-3 animate-fadeIn">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-800 border border-amber-400 flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5 text-amber-700" />
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-black text-amber-950 uppercase tracking-wide">
              Admin Has Run Out of Balance
            </h4>
            <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black uppercase">
              Provider Refill Needed
            </span>
          </div>
          <p className="text-xs text-amber-900/80 leading-relaxed font-medium">
            Your personal wallet balance is sufficient, but the admin&apos;s upstream fulfillment engine (
            <strong>{providerName}</strong>) is currently awaiting a balance refill.{" "}
            <strong>Your wallet has NOT been charged.</strong>
          </p>
        </div>
      </div>

      <div className="pt-2 border-t border-amber-200/80 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={handleNotifyAdmin}
          disabled={notifying || notified}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-subtle flex items-center gap-1.5 press-scale ${
            notified
              ? "bg-emerald-600 text-white cursor-default"
              : "bg-amber-600 hover:bg-amber-700 text-white"
          }`}
        >
          {notifying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : notified ? (
            <Check className="w-4 h-4" />
          ) : (
            <Bell className="w-4 h-4" />
          )}
          <span>{notified ? "Admin Notified! (Alert sent to admin panel)" : "Notify Admin"}</span>
        </button>

        <a
          href={`https://t.me/Ghostfinds?text=${telegramMsg}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2.5 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-black transition-all shadow-subtle flex items-center gap-1.5 press-scale"
        >
          <Send className="w-4 h-4" />
          <span>Send Admin a Message (Telegram)</span>
        </a>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="px-3 py-2 rounded-xl text-xs font-bold text-amber-900/60 hover:text-amber-900 hover:bg-amber-200/50 transition-colors ml-auto"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

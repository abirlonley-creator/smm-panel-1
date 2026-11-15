"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";

interface MaintenanceScreenProps {
  customTitle?: string;
  customMessage?: string;
  supportTelegram?: string;
  onRestored?: () => void;
}

export function MaintenanceScreen({
  customTitle,
  customMessage,
  supportTelegram = "Ghostfinds",
  onRestored,
}: MaintenanceScreenProps) {
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    async function checkStatus() {
      try {
        setChecking(true);
        const res = await fetch("/api/system/maintenance", { cache: "no-store" });
        const data = await res.json();

        if (data.success && !data.underMaintenance) {
          if (onRestored) {
            onRestored();
          } else {
            window.location.reload();
          }
        }
      } catch (err) {
        // ignore network glitch
      } finally {
        setChecking(false);
      }
    }

    interval = setInterval(checkStatus, 4000);
    return () => clearInterval(interval);
  }, [onRestored]);

  const cleanHandle = supportTelegram.replace(/^@/, "");

  return (
    <div className="min-h-screen bg-[#090A0F] text-white flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm rounded-2xl bg-[#12131A] border border-white/10 p-6 sm:p-7 text-center space-y-5 shadow-xl">
        
        {/* Status indicator */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 text-[11px] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>Updating</span>
        </div>

        {/* Minimal headline & note */}
        <div className="space-y-1.5">
          <h1 className="text-lg font-bold text-white tracking-tight">
            {customTitle || "Updating website"}
          </h1>
          <p className="text-xs text-neutral-400 leading-relaxed">
            {customMessage || "Orders continue delivering in the background."}
          </p>
        </div>

        {/* Support link */}
        <a
          href={`https://t.me/${cleanHandle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-white/10"
        >
          <Send className="w-3.5 h-3.5 text-neutral-400" />
          <span>Support (@{cleanHandle})</span>
        </a>

        {/* Quiet footer status */}
        <div className="pt-2 flex items-center justify-center text-[11px] text-neutral-500 border-t border-white/5">
          <span className="flex items-center gap-1.5">
            <span className={`w-1 h-1 rounded-full ${checking ? "bg-blue-400 animate-pulse" : "bg-neutral-600"}`} />
            <span>Auto-reconnecting</span>
          </span>
        </div>

      </div>
    </div>
  );
}

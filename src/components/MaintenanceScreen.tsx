"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Wrench,
  Zap,
  CheckCircle2,
  Send,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Clock,
} from "lucide-react";

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
  const [lastChecked, setLastChecked] = useState<string>("just now");

  // Auto-poll maintenance status so users are seamlessly restored the moment admin disables it
  useEffect(() => {
    let interval: NodeJS.Timeout;

    async function checkStatus() {
      try {
        setChecking(true);
        const res = await fetch("/api/system/maintenance", { cache: "no-store" });
        const data = await res.json();
        setLastChecked(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

        if (data.success && !data.underMaintenance) {
          if (onRestored) {
            onRestored();
          } else {
            window.location.reload();
          }
        }
      } catch (err) {
        // ignore network glitches
      } finally {
        setChecking(false);
      }
    }

    interval = setInterval(checkStatus, 4000);
    return () => clearInterval(interval);
  }, [onRestored]);

  return (
    <div className="min-h-screen bg-[#0E1018] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* ── Background Glows & Accent Gradients ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(58,78,251,0.22) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 w-[500px] h-[300px] opacity-[0.07]"
        style={{
          background:
            "radial-gradient(ellipse at 100% 100%, #E3FF3B 0%, transparent 60%)",
        }}
      />
      {/* Subtle Dot Grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* ── Main Maintenance Container ── */}
      <div className="relative z-10 w-full max-w-lg animate-fadeIn">
        <div className="rounded-3xl bg-[#161822]/90 border border-white/10 p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">
          
          {/* Top Status Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>PLATFORM UNDER SCHEDULED UPDATE</span>
          </div>

          {/* Animated Wrench / Gear Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#3A4EFB] to-indigo-700 flex items-center justify-center shadow-lg shadow-[#3A4EFB]/30 ring-8 ring-white/5">
              <Wrench className="w-10 h-10 text-white animate-spin-slow" />
            </div>
          </div>

          {/* Headlines & Core Reassurance */}
          <div className="space-y-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {customTitle || "Currently we're updating the website"}
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed font-medium">
              {customMessage ||
                "Please hold on for a moment while admin is updating the website. The panel will automatically reopen as soon as the update completes."}
            </p>
          </div>

          {/* Critical Order Safety Callout */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#1E2232] border border-emerald-500/30 text-left space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs sm:text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>Your Orders Are Safe & Actively Delivering</span>
            </div>
            <p className="text-[11px] sm:text-xs text-gray-300 leading-relaxed">
              Rest assured, all placed orders, organic TikTok S-Curve campaigns, and scheduled delivery runs are continuing to process in the background without interruption.
            </p>
            <div className="pt-2 flex items-center gap-2 text-[10px] text-emerald-400 font-mono font-semibold">
              <Zap className="w-3 h-3 animate-pulse" />
              <span>Backend Delivery Engine: 100% OPERATIONAL</span>
            </div>
          </div>

          {/* Support Button & Auto-Reconnect Bar */}
          <div className="space-y-3 pt-2">
            <a
              href={`https://t.me/${supportTelegram.replace(/^@/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 rounded-2xl bg-[#3A4EFB] hover:bg-[#2F40DB] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#3A4EFB]/30 transition-all press-scale"
            >
              <Send className="w-4 h-4" />
              <span>Contact 24/7 Support (@{supportTelegram.replace(/^@/, "")})</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>

            <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400 font-medium">
              <RefreshCw className={`w-3 h-3 text-[#3A4EFB] ${checking ? "animate-spin" : ""}`} />
              <span>Auto-reconnecting... (checked {lastChecked})</span>
            </div>
          </div>

          {/* Admin link discreetly at footer */}
          <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-500">
            <span>AuraSMM Maintenance Shield</span>
            <Link
              href="/admin"
              className="hover:text-gray-300 transition-colors flex items-center gap-1"
            >
              <ShieldCheck className="w-3 h-3" />
              <span>Admin Access</span>
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}

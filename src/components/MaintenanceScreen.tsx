"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Lock, KeyRound, ArrowRight, Loader2, AlertCircle } from "lucide-react";

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
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPasskey, setAdminPasskey] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    async function checkStatus() {
      try {
        setChecking(true);
        const res = await fetch("/api/system/maintenance", { cache: "no-store" });
        const data = await res.json();

        // If authenticated as admin, bypass maintenance and enter panel
        if (data.success && data.isAdmin) {
          if (onRestored) {
            onRestored();
          } else {
            router.push("/engagement");
          }
          return;
        }

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

    checkStatus();
    interval = setInterval(checkStatus, 4000);
    return () => clearInterval(interval);
  }, [onRestored, router]);

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!adminPasskey.trim()) return;

    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passkey: adminPasskey.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setLoginError(data.error || "Invalid administrator passkey.");
        return;
      }

      window.dispatchEvent(new CustomEvent("auth-changed", { detail: data }));
      if (onRestored) {
        onRestored();
      } else {
        router.push("/engagement");
      }
    } catch (err: any) {
      setLoginError(err.message || "Failed to authenticate.");
    } finally {
      setLoginLoading(false);
    }
  }

  const cleanHandle = supportTelegram.replace(/^@/, "");

  return (
    <div className="min-h-screen bg-[#111413] text-white flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm rounded-2xl bg-[#1B201E] border border-[#222826] p-6 sm:p-7 text-center space-y-5 shadow-xl relative overflow-hidden">
        
        {/* Brand Lockup */}
        <div className="flex justify-center mb-1">
          <img
            src="/brand/logos/lockup-stacked-on-dark.svg"
            alt="AuraSMM"
            className="w-36 h-auto mx-auto"
          />
        </div>

        {/* Status indicator */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 text-[11px] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span>Under Scheduled Update</span>
        </div>

        {/* Minimal headline & note */}
        <div className="space-y-1.5">
          <h1 className="text-lg font-bold text-white tracking-tight">
            {customTitle || "Updating website"}
          </h1>
          <p className="text-xs text-[#9AA39F] leading-relaxed">
            {customMessage || "Please hold on for a moment while our team completes important platform improvements. Orders continue delivering in the background."}
          </p>
        </div>

        {/* Support link */}
        <a
          href={`https://t.me/${cleanHandle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2.5 px-4 rounded-xl bg-[#229ED9]/15 hover:bg-[#229ED9]/25 text-[#229ED9] hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-[#222826]"
        >
          <Send className="w-3.5 h-3.5 text-[#229ED9]" />
          <span>Support (@{cleanHandle})</span>
        </a>

        {/* Administrator Access Accordion */}
        <div className="pt-2 border-t border-[#222826] space-y-3">
          {!showAdminLogin ? (
            <button
              type="button"
              onClick={() => setShowAdminLogin(true)}
              className="text-[11px] text-[#9AA39F] hover:text-[#F3F1EA] transition-colors flex items-center justify-center gap-1.5 mx-auto"
            >
              <Lock className="w-3 h-3" />
              <span>Administrator Access</span>
            </button>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-2.5 text-left animate-fadeIn">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-[#9AA39F] flex items-center gap-1.5">
                  <KeyRound className="w-3 h-3 text-[#D4F04F]" />
                  <span>Admin Passkey</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminLogin(false);
                    setLoginError(null);
                  }}
                  className="text-[10px] text-[#5B625F] hover:text-[#9AA39F]"
                >
                  Cancel
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Enter admin passkey..."
                  value={adminPasskey}
                  onChange={(e) => setAdminPasskey(e.target.value)}
                  disabled={loginLoading}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#111413] border border-[#222826] text-xs text-white placeholder-[#5B625F] focus:outline-none focus:border-[#D4F04F]"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loginLoading || !adminPasskey.trim()}
                  className="px-3 py-1.5 rounded-lg bg-[#D4F04F] hover:bg-[#C5E23A] text-[#111413] font-bold text-xs flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                >
                  {loginLoading ? <img src="/brand/logos/mark-on-dark.svg" className="w-3.5 h-3.5 animate-pulse opacity-80" alt="" /> : <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>

              {loginError && (
                <div className="flex items-center gap-1 text-[11px] text-[#C4552D]">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}
            </form>
          )}

          {/* Quiet footer auto-reconnecting status */}
          <div className="flex items-center justify-center text-[10px] text-[#5B625F]">
            <span className="flex items-center gap-1.5">
              <span className={`w-1 h-1 rounded-full ${checking ? "bg-[#D4F04F] animate-pulse" : "bg-[#5B625F]"}`} />
              <span>Auto-reconnecting</span>
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}

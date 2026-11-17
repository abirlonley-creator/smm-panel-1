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
    <div className="min-h-screen bg-[#090A0F] text-white flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm rounded-2xl bg-[#12131A] border border-white/10 p-6 sm:p-7 text-center space-y-5 shadow-xl relative overflow-hidden">
        
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
          <p className="text-xs text-neutral-400 leading-relaxed">
            {customMessage || "Please hold on for a moment while our team completes important platform improvements. Orders continue delivering in the background."}
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

        {/* Administrator Access Accordion */}
        <div className="pt-2 border-t border-white/5 space-y-3">
          {!showAdminLogin ? (
            <button
              type="button"
              onClick={() => setShowAdminLogin(true)}
              className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors flex items-center justify-center gap-1.5 mx-auto"
            >
              <Lock className="w-3 h-3" />
              <span>Administrator Access</span>
            </button>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-2.5 text-left animate-fadeIn">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-neutral-300 flex items-center gap-1.5">
                  <KeyRound className="w-3 h-3 text-amber-400" />
                  <span>Admin Passkey</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminLogin(false);
                    setLoginError(null);
                  }}
                  className="text-[10px] text-neutral-500 hover:text-neutral-300"
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
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400/50"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loginLoading || !adminPasskey.trim()}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                >
                  {loginLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>

              {loginError && (
                <div className="flex items-center gap-1 text-[11px] text-red-400">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}
            </form>
          )}

          {/* Quiet footer auto-reconnecting status */}
          <div className="flex items-center justify-center text-[10px] text-neutral-600">
            <span className="flex items-center gap-1.5">
              <span className={`w-1 h-1 rounded-full ${checking ? "bg-amber-400 animate-pulse" : "bg-neutral-600"}`} />
              <span>Auto-reconnecting</span>
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}

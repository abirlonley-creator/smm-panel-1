"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ArrowRight, Eye, EyeOff, AlertCircle, Send } from "lucide-react";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";

export default function LoginPage() {
  const router = useRouter();
  const [passkey, setPasskey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [underMaintenance, setUnderMaintenance] = useState(false);
  const [maintInfo, setMaintInfo] = useState<{ title?: string; message?: string; supportTelegram?: string }>({});

  useEffect(() => {
    fetch("/api/system/maintenance", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.isAdmin) {
          router.push("/engagement");
          return;
        }
        if (data.underMaintenance) {
          setUnderMaintenance(true);
          setMaintInfo({
            title: data.title,
            message: data.message,
            supportTelegram: data.supportTelegram,
          });
        }
      })
      .catch(() => {});
  }, [router]);

  if (underMaintenance) {
    return (
      <MaintenanceScreen
        customTitle={maintInfo.title}
        customMessage={maintInfo.message}
        supportTelegram={maintInfo.supportTelegram}
        onRestored={() => setUnderMaintenance(false)}
      />
    );
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!passkey.trim()) { setError("Please enter your passkey."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passkey: passkey.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Invalid or expired passkey.");
        return;
      }
      window.dispatchEvent(new CustomEvent("auth-changed", { detail: data }));
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#111413] flex items-center justify-center px-4 relative overflow-hidden">

      {/* ── Background ── */}
      {/* Top-centre lime subtle radial */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(212,240,79,0.06) 0%, transparent 70%)",
        }}
      />
      {/* Subtle dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* ── Card ── */}
      <div className="relative z-10 w-full max-w-[400px] animate-loginIn">

        {/* Logo + wordmark */}
        <div className="flex flex-col items-center mb-8">
          <img
            src="/brand/logos/lockup-stacked-on-dark.svg"
            alt="AuraSMM"
            className="w-48 h-auto mx-auto"
          />
        </div>

        {/* Auth card */}
        <div className="rounded-2xl border border-[#222826] bg-[#1B201E] shadow-2xl shadow-black/50 overflow-hidden">

          {/* Card header strip */}
          <div className="px-6 pt-6 pb-5 border-b border-[#222826]">
            <p className="text-[13px] font-semibold text-[#F3F1EA]">Sign in with passkey</p>
            <p className="text-[11px] text-[#9AA39F] mt-0.5">
              Enter the access key shared with you to continue.
            </p>
          </div>

          <form onSubmit={handleLogin} className="px-6 py-5 space-y-4">

            {/* Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="passkey-input"
                className="block text-[11px] font-semibold uppercase tracking-widest text-[#9AA39F]"
              >
                Passkey
              </label>
              <div className="relative group">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9AA39F] pointer-events-none transition-colors group-focus-within:text-[#D4F04F]" />
                <input
                  id="passkey-input"
                  type={showKey ? "text" : "password"}
                  value={passkey}
                  onChange={(e) => { setPasskey(e.target.value); setError(null); }}
                  placeholder="Enter your passkey"
                  autoFocus
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full bg-[#111413] text-white text-sm font-mono rounded-xl pl-10 pr-11 py-3 border border-[#222826] focus:border-[#D4F04F] focus:ring-1 focus:ring-[#D4F04F]/30 outline-none transition-all placeholder:text-[#5B625F] disabled:opacity-50"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#5B625F] hover:text-[#9AA39F] transition-colors"
                  aria-label={showKey ? "Hide passkey" : "Show passkey"}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl bg-[#C4552D]/10 border border-[#C4552D]/30 px-3.5 py-3 animate-loginIn">
                <AlertCircle className="w-3.5 h-3.5 text-[#C4552D] shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#C4552D] leading-relaxed">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              id="enter-panel-btn"
              disabled={loading || !passkey.trim()}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl bg-[#D4F04F] hover:bg-[#C5E23A] active:scale-[0.98] text-[#111413] text-[13px] font-bold transition-all shadow-md shadow-[#D4F04F]/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <img src="/brand/logos/mark-on-dark.svg" className="w-4 h-4 animate-pulse opacity-80" alt="" />
                  <span>Verifying…</span>
                </>
              ) : (
                <>
                  <span>Enter Panel</span>
                  <ArrowRight className="w-4 h-4 text-[#111413]" />
                </>
              )}
            </button>

          </form>

          {/* Footer */}
          <div className="px-6 pb-6 pt-1">
            <div className="rounded-xl bg-[#111413] border border-[#222826] px-4 py-3 flex items-start gap-3">
              <Send className="w-3.5 h-3.5 text-[#229ED9] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#9AA39F] leading-relaxed">
                Need a passkey?{" "}
                <a
                  href="https://t.me/Ghostfinds"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#229ED9] font-semibold hover:underline transition-colors"
                >
                  @Ghostfinds
                </a>{" "}
                on Telegram.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom trust row */}
        <div className="flex items-center justify-center gap-4 mt-6">
          {["Encrypted Keys", "Isolated APIs", "No Tracking"].map((t, i) => (
            <React.Fragment key={t}>
              <span className="text-[10px] text-[#5B625F] font-medium">{t}</span>
              {i < 2 && <span className="w-1 h-1 rounded-full bg-[#222826]" />}
            </React.Fragment>
          ))}
        </div>

      </div>
    </div>
  );
}

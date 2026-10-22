"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ArrowRight, Eye, EyeOff, AlertCircle, Send } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [passkey, setPasskey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="min-h-screen bg-[#0E1018] flex items-center justify-center px-4 relative overflow-hidden">

      {/* ── Background ── */}
      {/* Top-centre blue radial */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(58,78,251,0.18) 0%, transparent 70%)",
        }}
      />
      {/* Bottom-right lime accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 w-[500px] h-[300px] opacity-[0.06]"
        style={{
          background:
            "radial-gradient(ellipse at 100% 100%, #E3FF3B 0%, transparent 60%)",
        }}
      />
      {/* Subtle dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* ── Card ── */}
      <div className="relative z-10 w-full max-w-[400px] animate-loginIn">

        {/* Logo + wordmark */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-[#3A4EFB] flex items-center justify-center shadow-lg shadow-[#3A4EFB]/40">
              <span className="text-[22px] font-black text-white tracking-tighter leading-none">A</span>
            </div>
            {/* Small lime pulse dot */}
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#E3FF3B] border-2 border-[#0E1018]" />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-[22px] font-extrabold tracking-tight text-white">
              AuraSMM
            </h1>
            <p className="text-[12px] text-[#6B7280] font-medium">
              SMM Panel &amp; Growth Planner
            </p>
          </div>
        </div>

        {/* Auth card */}
        <div className="rounded-2xl border border-[#1F2437] bg-[#131726] shadow-2xl shadow-black/50 overflow-hidden">

          {/* Card header strip */}
          <div className="px-6 pt-6 pb-5 border-b border-[#1F2437]">
            <p className="text-[13px] font-semibold text-white">Sign in with passkey</p>
            <p className="text-[11px] text-[#6B7280] mt-0.5">
              Enter the access key shared with you to continue.
            </p>
          </div>

          <form onSubmit={handleLogin} className="px-6 py-5 space-y-4">

            {/* Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="passkey-input"
                className="block text-[11px] font-semibold uppercase tracking-widest text-[#6B7280]"
              >
                Passkey
              </label>
              <div className="relative group">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3A4EFB]/70 pointer-events-none transition-colors group-focus-within:text-[#3A4EFB]" />
                <input
                  id="passkey-input"
                  type={showKey ? "text" : "password"}
                  value={passkey}
                  onChange={(e) => { setPasskey(e.target.value); setError(null); }}
                  placeholder="Enter your passkey"
                  autoFocus
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full bg-[#0E1018] text-white text-sm font-mono rounded-xl pl-10 pr-11 py-3 border border-[#1F2437] focus:border-[#3A4EFB] focus:ring-1 focus:ring-[#3A4EFB]/40 outline-none transition-all placeholder:text-[#374151] disabled:opacity-50"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#374151] hover:text-[#9CA3AF] transition-colors"
                  aria-label={showKey ? "Hide passkey" : "Show passkey"}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl bg-red-500/8 border border-red-500/20 px-3.5 py-3 animate-loginIn">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-400 leading-relaxed">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              id="enter-panel-btn"
              disabled={loading || !passkey.trim()}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] active:scale-[0.98] text-white text-[13px] font-bold transition-all shadow-lg shadow-[#3A4EFB]/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                  <span>Verifying…</span>
                </>
              ) : (
                <>
                  <span>Enter Panel</span>
                  <ArrowRight className="w-4 h-4 text-[#E3FF3B]" />
                </>
              )}
            </button>

          </form>

          {/* Footer */}
          <div className="px-6 pb-6 pt-1">
            <div className="rounded-xl bg-[#0E1018] border border-[#1F2437] px-4 py-3 flex items-start gap-3">
              <Send className="w-3.5 h-3.5 text-[#3A4EFB] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#6B7280] leading-relaxed">
                Need a passkey?{" "}
                <a
                  href="https://t.me/Ghostfinds"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#3A4EFB] font-semibold hover:text-[#7B8FFF] transition-colors"
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
              <span className="text-[10px] text-[#374151] font-medium">{t}</span>
              {i < 2 && <span className="w-1 h-1 rounded-full bg-[#1F2437]" />}
            </React.Fragment>
          ))}
        </div>

      </div>
    </div>
  );
}

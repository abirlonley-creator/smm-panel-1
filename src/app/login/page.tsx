"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ArrowRight, ShieldCheck, AlertCircle, Eye, EyeOff, Send, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [passkey, setPasskey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!passkey.trim()) {
      setError("Please enter your passkey.");
      return;
    }

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
        setError(data.error || "Authentication failed. Invalid or expired passkey.");
        return;
      }

      // Trigger navigation event so balance and navigation items update
      window.dispatchEvent(new CustomEvent("auth-changed", { detail: data }));

      // Redirect to panel dashboard
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#141624] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-12 relative overflow-hidden select-none">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#3A4EFB]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#E3FF3B]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Branding Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#3A4EFB] text-white shadow-lg shadow-[#3A4EFB]/30 mb-2">
            <span className="text-2xl font-black tracking-tight">A</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            AuraSMM
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#E3FF3B] text-[#252943]">
              v2
            </span>
          </h1>
          <p className="text-xs text-[#DEE0ED]/65 font-medium">
            Minimalist SMM Panel & Growth Planner
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-[#1A1D31] border border-[#323758] rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
          <div className="flex items-center justify-between pb-5 border-b border-[#323758]/60 mb-5">
            <div className="flex items-center gap-2 text-white">
              <Lock className="w-4 h-4 text-[#E3FF3B]" />
              <h2 className="text-sm font-bold tracking-tight">Enter Your Passkey</h2>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#DEE0ED]/70 px-2.5 py-1 rounded-full bg-[#252943] border border-[#323758]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#3A4EFB]" />
              Protected
            </span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="passkey-input" className="block text-xs font-semibold text-[#DEE0ED]/80 mb-2">
                Access Passkey
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#DEE0ED]/40">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="passkey-input"
                  type={showKey ? "text" : "password"}
                  value={passkey}
                  onChange={(e) => setPasskey(e.target.value)}
                  placeholder="Enter your passkey..."
                  autoFocus
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full bg-[#141624] text-white text-sm rounded-xl pl-10 pr-10 py-3 border border-[#323758] focus:border-[#3A4EFB] focus:ring-1 focus:ring-[#3A4EFB] outline-none transition-all placeholder:text-[#DEE0ED]/30 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#DEE0ED]/50 hover:text-white transition-colors"
                  aria-label={showKey ? "Hide passkey" : "Show passkey"}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-semibold block">Authentication Failed</span>
                  {error}
                </div>
              </div>
            )}

            <button
              type="submit"
              id="enter-panel-btn"
              disabled={loading || !passkey.trim()}
              className="w-full py-3 px-4 rounded-xl bg-[#3A4EFB] hover:bg-[#2F40DB] active:scale-[0.99] text-white text-sm font-bold transition-all shadow-lg shadow-[#3A4EFB]/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Passkey...</span>
                </>
              ) : (
                <>
                  <span>Enter Panel</span>
                  <ArrowRight className="w-4 h-4 text-[#E3FF3B]" />
                </>
              )}
            </button>
          </form>

          {/* Telegram Support Notice */}
          <div className="mt-6 pt-5 border-t border-[#323758]/60 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-[#DEE0ED]/70 mb-1">
              <Send className="w-3.5 h-3.5 text-[#3A4EFB]" />
              <span>Need access or assistance?</span>
            </div>
            <p className="text-xs text-[#DEE0ED]/60 leading-relaxed">
              Need to purchase a passkey or get help setting up your provider API? Message{" "}
              <a
                href="https://t.me/Ghostfinds"
                target="_blank"
                rel="noreferrer"
                className="text-[#3A4EFB] font-semibold underline hover:text-blue-400 transition-colors"
              >
                @Ghostfinds
              </a>{" "}
              on Telegram.
            </p>
          </div>
        </div>

        {/* Whop Botters Badge */}
        <div className="flex items-center justify-center gap-2 text-xs text-[#DEE0ED]/40">
          <span>Made for Whop Botters</span>
          <span>•</span>
          <span>Encrypted Passkeys</span>
          <span>•</span>
          <span>Isolated Provider APIs</span>
        </div>
      </div>
    </div>
  );
}

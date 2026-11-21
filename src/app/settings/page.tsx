"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  KeyRound,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  User,
  Wallet,
  ArrowRight,
  ExternalLink,
  Zap,
  Lock,
} from "lucide-react";

export default function SettingsPage() {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Passkey activation state
  const [passkeyInput, setPasskeyInput] = useState("");
  const [activating, setActivating] = useState(false);
  const [activationResult, setActivationResult] = useState<{
    success: boolean;
    message: string;
    label?: string;
    expiresAt?: string | null;
    remainingDays?: number | null;
  } | null>(null);

  async function loadSession() {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const data = await res.json();
      if (data.authenticated) {
        setSession(data);
      }
    } catch (err) {
      console.error("Failed to load user session:", err);
    } finally {
      setLoadingSession(false);
    }
  }

  useEffect(() => {
    loadSession();
  }, []);

  async function handleActivatePasskey(e: React.FormEvent) {
    e.preventDefault();
    if (!passkeyInput.trim()) return;

    setActivating(true);
    setActivationResult(null);

    try {
      const res = await fetch("/api/user/activate-passkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passkey: passkeyInput.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setActivationResult({
          success: false,
          message: data.error || "Failed to activate passkey. Please verify the key and try again.",
        });
      } else {
        setActivationResult({
          success: true,
          message: data.message,
          label: data.label,
          expiresAt: data.expiresAt,
          remainingDays: data.remainingDays,
        });
        setPasskeyInput("");
        // Reload session to reflect updated VIP status
        await loadSession();
      }
    } catch (err: any) {
      setActivationResult({
        success: false,
        message: err.message || "Network error while activating passkey.",
      });
    } finally {
      setActivating(false);
    }
  }

  const isVip = session?.isVip || session?.role === "ADMIN";

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16 animate-fadeIn">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DEE0ED]">
        <div>
          <h1 className="text-xl font-bold text-[#252943] tracking-tight flex items-center gap-2">
            <span>Account Settings & Passkey</span>
            {isVip && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider border border-emerald-300">
                VIP Wholesale Active
              </span>
            )}
          </h1>
          <p className="text-xs text-[#252943]/60 mt-0.5">
            Manage your account credentials, activate admin passkeys for zero-markup perks, and configure API integrations.
          </p>
        </div>
      </div>

      {/* ── Section 1: VIP Passkey Activation ── */}
      <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 sm:p-8 shadow-subtle space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#DEE0ED]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#252943]">VIP Passkey Activation</h2>
              <p className="text-xs text-[#252943]/60">
                Redeem exclusive access keys created by administrators to unlock wholesale 0% markup pricing.
              </p>
            </div>
          </div>
          {isVip ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Perk Unlocked</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-[#DEE0ED] text-[#252943]/60 text-xs font-bold">
              <Lock className="w-4 h-4 text-slate-500" />
              <span>Standard Pricing</span>
            </div>
          )}
        </div>

        {/* VIP Status Banner */}
        {isVip ? (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-extrabold text-xs text-emerald-950">
                VIP Wholesale Pricing Active
              </span>
            </div>
            <p className="text-xs text-emerald-900/80 leading-relaxed">
              Your account is currently activated with VIP perks! All TikTok and Instagram algorithmic orders will be processed at direct wholesale provider cost with zero admin markup.
            </p>
            {session?.remainingDays !== undefined && session.remainingDays !== null && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-bold pt-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{session.remainingDays} days remaining on your active passkey perk</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#3A4EFB] shrink-0" />
              <span className="font-bold text-xs text-[#252943]">
                Have an exclusive VIP Passkey from Admin?
              </span>
            </div>
            <p className="text-xs text-[#252943]/70 leading-relaxed">
              Admins can issue VIP passkeys that remove all retail profit margins for your account. Enter your passkey below to redeem the perk immediately.
            </p>
          </div>
        )}

        {/* Activation Form */}
        <form onSubmit={handleActivatePasskey} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-xs font-bold text-[#252943] mb-1.5">
              Enter Admin-Issued Passkey
            </label>
            <div className="relative group">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#252943]/40 group-focus-within:text-[#3A4EFB] transition-colors" />
              <input
                type="text"
                value={passkeyInput}
                onChange={(e) => {
                  setPasskeyInput(e.target.value);
                  setActivationResult(null);
                }}
                placeholder="Enter VIP passkey code..."
                disabled={activating}
                className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-mono font-bold text-[#252943] outline-none focus:border-[#3A4EFB] focus:bg-white transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {activationResult && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-medium animate-fadeIn ${
                activationResult.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-rose-50 border-rose-200 text-rose-900"
              }`}
            >
              {activationResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{activationResult.message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={activating || !passkeyInput.trim()}
            className="px-5 py-2.5 rounded-xl bg-[#3A4EFB] hover:bg-[#2A3DE0] active:scale-[0.97] text-white text-xs font-bold transition-all shadow-subtle flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            {activating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{isVip ? "Renew / Switch Passkey" : "Activate VIP Perk"}</span>
          </button>
        </form>
      </div>

      {/* ── Section 2: Account Information ── */}
      <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 sm:p-8 shadow-subtle space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#DEE0ED]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-[#3A4EFB] flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#252943]">Account Overview</h2>
              <p className="text-xs text-[#252943]/60">Your current account details and wallet balance.</p>
            </div>
          </div>
          <Link
            href="/wallet"
            className="px-3.5 py-2 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] hover:bg-[#DEE0ED]/50 text-xs font-bold text-[#252943] transition-colors flex items-center gap-1.5"
          >
            <Wallet className="w-3.5 h-3.5 text-[#3A4EFB]" />
            <span>Top Up Wallet</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-1">
            <span className="text-[11px] font-bold text-[#252943]/60 uppercase tracking-wider block">
              Username
            </span>
            <span className="text-sm font-extrabold text-[#252943]">
              {session?.user?.username || "—"}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-1">
            <span className="text-[11px] font-bold text-[#252943]/60 uppercase tracking-wider block">
              Account Role / Tier
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-[#252943]">
                {session?.role === "ADMIN" ? "Administrator" : isVip ? "VIP Member" : "Standard User"}
              </span>
              {isVip && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  0% Markup
                </span>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-1">
            <span className="text-[11px] font-bold text-[#252943]/60 uppercase tracking-wider block">
              Wallet Balance
            </span>
            <span className="text-sm font-mono font-extrabold text-emerald-600">
              ₹{Number(session?.user?.walletBalance ?? 0).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Section 3: Developer & Provider API ── */}
      <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 sm:p-8 shadow-subtle space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#252943]">Provider & Developer API</h2>
            <p className="text-xs text-[#252943]/60">
              Configure third-party SMM providers, generate API keys, or connect automated order scripts.
            </p>
          </div>
          <Link
            href="/api-key"
            className="px-4 py-2.5 rounded-xl bg-[#252943] hover:bg-[#1a1d30] text-white text-xs font-bold transition-all shadow-subtle flex items-center gap-2 self-start"
          >
            <span>Manage API & Provider Keys</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

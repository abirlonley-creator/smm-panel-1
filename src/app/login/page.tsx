"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Lock,
  Zap,
  Users,
  Loader2,
  Sparkles,
} from "lucide-react";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";

export default function LoginPage() {
  const router = useRouter();

  // Mode: Sign In vs Sign Up vs Direct Passkey
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [usePasskeyDirect, setUsePasskeyDirect] = useState(false);

  // Input states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passkey, setPasskey] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [underMaintenance, setUnderMaintenance] = useState(false);
  const [maintInfo, setMaintInfo] = useState<{ title?: string; message?: string; supportTelegram?: string }>({});

  useEffect(() => {
    fetch("/api/system/maintenance", { cache: "no-store" })
      .then((res) => (res.ok ? res.json().catch(() => null) : null))
      .then((data) => {
        if (!data) return;
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (usePasskeyDirect) {
        if (!passkey.trim()) {
          setError("Please enter your passkey.");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passkey: passkey.trim() }),
        });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success) {
          setError(data?.error || "Invalid or expired passkey.");
          setLoading(false);
          return;
        }

        window.dispatchEvent(new CustomEvent("auth-changed", { detail: data }));
        router.push(data.role === "ADMIN" ? "/admin" : "/engagement");
        router.refresh();
        return;
      }

      if (authMode === "signup") {
        if (!username.trim() || !password) {
          setError("Please fill in all fields.");
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError("Password must be at least 6 characters.");
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: username.trim(),
            password,
          }),
        });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success) {
          setError(data?.error || "Failed to create account.");
          setLoading(false);
          return;
        }

        setSuccessMsg("Account created! Redirecting to dashboard...");
        window.dispatchEvent(new CustomEvent("auth-changed", { detail: data }));
        setTimeout(() => {
          router.push("/engagement");
          router.refresh();
        }, 700);
      } else {
        // Standard Sign In
        if (!username.trim() || !password) {
          setError("Please enter your username and password.");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: username.trim(),
            password,
          }),
        });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success) {
          setError(data?.error || "Invalid username or password.");
          setLoading(false);
          return;
        }

        setSuccessMsg("Signed in! Redirecting...");
        window.dispatchEvent(new CustomEvent("auth-changed", { detail: data }));
        setTimeout(() => {
          router.push(data.role === "ADMIN" ? "/admin" : "/engagement");
          router.refresh();
        }, 500);
      }
    } catch (err: any) {
      setError(err.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4 relative overflow-hidden text-[#252943]">
      {/* Background subtle radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% -10%, rgba(58, 78, 251, 0.08) 0%, rgba(212, 240, 79, 0.04) 50%, transparent 80%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.025] -z-10"
        style={{
          backgroundImage: "radial-gradient(circle, #252943 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-[420px] animate-loginIn space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <Link href="/" className="flex items-center gap-2.5 mb-2 group">
            <div className="w-10 h-10 rounded-2xl bg-[#3A4EFB] text-white flex items-center justify-center font-black shadow-md group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5 fill-white" />
            </div>
            <span className="text-xl font-black tracking-tight text-[#252943]">
              Aura<span className="text-[#3A4EFB]">SMM</span>
            </span>
          </Link>
          <p className="text-xs text-[#252943]/60">
            Natural-Looking Algorithmic Social Media Pacing
          </p>
        </div>

        {/* Auth Form Card */}
        <div className="rounded-3xl border border-[#DEE0ED] bg-white shadow-xl overflow-hidden p-6 sm:p-8 space-y-5">
          {/* Header & Tab Switcher */}
          {!usePasskeyDirect ? (
            <div className="flex items-center p-1 bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signin");
                  setError(null);
                }}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                  authMode === "signin"
                    ? "bg-white text-[#3A4EFB] shadow-xs"
                    : "text-[#252943]/60 hover:text-[#252943]"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signup");
                  setError(null);
                }}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                  authMode === "signup"
                    ? "bg-white text-[#3A4EFB] shadow-xs"
                    : "text-[#252943]/60 hover:text-[#252943]"
                }`}
              >
                Create Account
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#3A4EFB]" />
                <span className="font-extrabold text-sm text-[#252943]">Sign in with Passkey</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUsePasskeyDirect(false);
                  setError(null);
                }}
                className="text-[11px] font-bold text-[#3A4EFB] hover:underline cursor-pointer"
              >
                ← Back
              </button>
            </div>
          )}

          {/* Feedback Alerts */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Google Sign-In Button */}
          {!usePasskeyDirect && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/api/auth/google/initiate?returnTo=/engagement";
                }}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white hover:bg-zinc-50 border border-[#DEE0ED] text-[#252943] text-xs font-bold rounded-xl transition duration-200 shadow-xs cursor-pointer active:scale-[0.99]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center">
                <div className="flex-1 border-t border-[#DEE0ED]" />
                <span className="px-2 text-[10px] uppercase font-bold text-[#252943]/40 tracking-wider">
                  or with credentials
                </span>
                <div className="flex-1 border-t border-[#DEE0ED]" />
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {usePasskeyDirect ? (
              <div className="space-y-1.5">
                <label className="block font-bold text-[#252943]">Passkey</label>
                <div className="relative group">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#252943]/40 group-focus-within:text-[#3A4EFB] transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={passkey}
                    onChange={(e) => {
                      setPasskey(e.target.value);
                      setError(null);
                    }}
                    placeholder="Enter passkey code..."
                    autoFocus
                    disabled={loading}
                    className="w-full bg-[#F8F9FD] text-[#252943] text-xs font-mono font-bold rounded-xl pl-10 pr-11 py-2.5 border border-[#DEE0ED] focus:border-[#3A4EFB] focus:bg-white outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#252943]/40 hover:text-[#252943]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="block font-bold text-[#252943]">Username</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setError(null);
                    }}
                    placeholder="Enter username"
                    disabled={loading}
                    className="w-full bg-[#F8F9FD] text-[#252943] text-xs font-semibold rounded-xl px-3.5 py-2.5 border border-[#DEE0ED] focus:border-[#3A4EFB] focus:bg-white outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-[#252943]">Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#252943]/40 group-focus-within:text-[#3A4EFB] transition-colors" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError(null);
                      }}
                      placeholder="••••••••"
                      disabled={loading}
                      className="w-full bg-[#F8F9FD] text-[#252943] text-xs font-semibold rounded-xl pl-10 pr-11 py-2.5 border border-[#DEE0ED] focus:border-[#3A4EFB] focus:bg-white outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#252943]/40 hover:text-[#252943]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {authMode === "signup" && (
                  <div className="space-y-1.5">
                    <label className="block font-bold text-[#252943]">Confirm Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#252943]/40 group-focus-within:text-[#3A4EFB] transition-colors" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setError(null);
                        }}
                        placeholder="••••••••"
                        disabled={loading}
                        className="w-full bg-[#F8F9FD] text-[#252943] text-xs font-semibold rounded-xl pl-10 pr-3.5 py-2.5 border border-[#DEE0ED] focus:border-[#3A4EFB] focus:bg-white outline-none transition-all"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* VIP Passkey Notice */}
            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/60 text-[11px] text-blue-900 leading-relaxed">
              <span className="font-bold">💡 VIP Perk:</span> Hold an admin-issued passkey? Sign in or sign up, then activate it in <span className="font-bold">Settings</span> to unlock 0% markup wholesale rates!
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#3A4EFB] hover:bg-[#2A3DE0] active:scale-[0.97] text-white font-black text-xs transition-all shadow-subtle flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              <span>
                {usePasskeyDirect ? "Login with Passkey" : authMode === "signup" ? "Create Free Account" : "Sign In"}
              </span>
            </button>

            {/* Passkey Switcher */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setUsePasskeyDirect(!usePasskeyDirect);
                  setError(null);
                }}
                className="text-[11px] text-[#3A4EFB] font-bold hover:underline cursor-pointer"
              >
                {usePasskeyDirect ? "← Sign in with Username & Password" : "Sign in with Admin Passkey instead →"}
              </button>
            </div>
          </form>
        </div>

        {/* Back to Home Link */}
        <div className="text-center">
          <Link href="/" className="text-xs font-semibold text-[#252943]/60 hover:text-[#252943] transition-colors">
            ← Return to AuraSMM Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}

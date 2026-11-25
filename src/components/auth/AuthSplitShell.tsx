"use client";

import React, { useState, useEffect, useId } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Check,
  ShieldCheck,
} from "lucide-react";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import { AuthIllustration, AuthBackdropWatermark } from "./AuthIllustration";
import { TurnstileWidget } from "./TurnstileWidget";

interface AuthSplitShellProps {
  initialMode: "signin" | "signup";
}

export function AuthSplitShell({ initialMode }: AuthSplitShellProps) {
  const router = useRouter();
  const uid = useId();

  const [authMode, setAuthMode] = useState<"signin" | "signup">(initialMode);
  const [accountType, setAccountType] = useState<"standard" | "passkey">("standard");

  // Input states
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passkey, setPasskey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  // UI feedback states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Maintenance state
  const [underMaintenance, setUnderMaintenance] = useState(false);
  const [maintInfo, setMaintInfo] = useState<{
    title?: string;
    message?: string;
    supportTelegram?: string;
  }>({});

  // Sync URL ?error=... query parameter (e.g. from Google OAuth callback) safely on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlError = params.get("error");
      if (urlError) {
        setError(urlError);
      }
    }
  }, []);

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

  // Password strength calculation for Sign Up
  const passwordCriteria = [
    { label: "8+ characters", met: password.length >= 8 },
    { label: "Number", met: /[0-9]/.test(password) },
    { label: "Uppercase", met: /[A-Z]/.test(password) },
    { label: "Symbol", met: /[^a-zA-Z0-9]/.test(password) },
  ];
  const strengthScore = passwordCriteria.filter((c) => c.met).length;
  const strengthLabels = ["Weak", "Fair", "Good", "Strong"];
  const strengthBarColors = [
    "bg-[#C4552D]",
    "bg-[#E0A030]",
    "bg-[#5E8C1F]",
    "bg-[#18422B]",
  ];
  const passwordsMatch =
    password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      // 1. Direct VIP / Admin Passkey Sign In
      if (accountType === "passkey") {
        if (!passkey.trim()) {
          setError("Please enter your passkey code.");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            passkey: passkey.trim(),
            turnstileToken: turnstileToken || undefined,
          }),
        });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success) {
          setError(data?.error || "Invalid or expired passkey.");
          setLoading(false);
          return;
        }

        setSuccessMsg("Passkey verified! Entering workspace...");
        window.dispatchEvent(new CustomEvent("auth-changed", { detail: data }));
        setTimeout(() => {
          router.push(data.role === "ADMIN" ? "/admin" : "/engagement");
          router.refresh();
        }, 450);
        return;
      }

      // 2. Standard Account Registration
      if (authMode === "signup") {
        if (!username.trim() || !password) {
          setError("Please fill in your username and password.");
          setLoading(false);
          return;
        }
        if (password.length < 8) {
          setError("Password must be at least 8 characters long.");
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
            email: email.trim() || undefined,
            password,
            turnstileToken: turnstileToken || undefined,
          }),
        });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success) {
          setError(data?.error || "Failed to create account. Please try again.");
          setLoading(false);
          return;
        }

        setSuccessMsg("Account created! Setting up your dashboard...");
        window.dispatchEvent(new CustomEvent("auth-changed", { detail: data }));
        setTimeout(() => {
          router.push("/engagement");
          router.refresh();
        }, 650);
        return;
      }

      // 3. Standard Account Sign In
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
          turnstileToken: turnstileToken || undefined,
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
      }, 450);
    } catch (err: any) {
      setError(err?.message || "Network error. Please try again.");
      setLoading(false);
    }
  }

  function handleGoogleAuth() {
    window.location.href = "/api/auth/google/initiate?returnTo=/engagement";
  }

  const isSignUp = authMode === "signup" && accountType === "standard";

  const quote =
    authMode === "signup"
      ? {
          text: "Thoughtful delivery curves that actually respect how platforms work. Setting up our campaigns takes under a minute, and every batch stays transparent from start to finish.",
          author: "Ahmed Abir",
          location: "Rajshahi, Bangladesh",
          avatar: "/images/ahmed-abir.jpg",
        }
      : {
          text: "Seamless campaign experience! The panel makes scheduling views and engagement so easy. I loved the real-time pacing curves and instant order tracking. Definitely my go-to for every launch.",
          author: "Ahmed Abir",
          location: "Rajshahi, Bangladesh",
          avatar: "/images/ahmed-abir.jpg",
        };

  return (
    <div className="min-h-screen w-full bg-[#18422B] flex items-center justify-center p-3 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* Subtle architectural watermark on outer dark forest frame */}
      <AuthBackdropWatermark />

      {/* Centered Split-Card Frame */}
      <div className="relative z-10 w-full max-w-[460px] lg:max-w-[1040px] rounded-[24px] sm:rounded-[30px] bg-white shadow-[0_32px_70px_-16px_rgba(0,0,0,0.48)] overflow-hidden grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] animate-loginIn motion-reduce:animate-none">
        {/* ── LEFT PANE: Warm Cream Form Surface ── */}
        <div className="bg-[#F5F4EE] px-6 py-7 sm:px-10 sm:py-9 flex flex-col justify-between">
          {/* Top Brand Lockup */}
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18422B] rounded-lg p-0.5"
              aria-label="Return to AuraSMM homepage"
            >
              <Image
                src="/brand/lockup-horizontal-on-light.svg"
                alt="AuraSMM"
                width={142}
                height={34}
                priority
                className="h-7 w-auto transition-transform duration-150 group-hover:scale-[1.02] motion-reduce:transition-none"
              />
            </Link>

            <Link
              href="/"
              className="text-[11px] font-medium text-[#5B625F] hover:text-[#111413] transition-colors"
            >
              Back home
            </Link>
          </div>

          {/* Centered Form Column */}
          <div className="w-full max-w-[340px] mx-auto my-auto py-6 sm:py-8">
            {/* Heading & Subtitle */}
            <div className="text-center">
              <h1 className="text-[26px] sm:text-[28px] font-bold tracking-tight text-[#111413] leading-tight">
                {accountType === "passkey"
                  ? "Passkey Access"
                  : isSignUp
                  ? "Create Account"
                  : "Sign In"}
              </h1>
              <p className="text-xs text-[#5B625F] mt-1.5">
                {accountType === "passkey"
                  ? "Enter your exclusive passkey code to continue"
                  : isSignUp
                  ? "Create your free account to start organic pacing"
                  : "Welcome back! Please enter your details to continue"}
              </p>
            </div>

            {/* Account Type Radio Switcher (matching reference layout) */}
            <div
              role="radiogroup"
              aria-label="Authentication method"
              className="mt-5 mb-5 flex items-center justify-center gap-6"
            >
              <button
                type="button"
                role="radio"
                aria-checked={accountType === "standard"}
                onClick={() => {
                  setAccountType("standard");
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18422B] rounded-full px-1 py-0.5"
              >
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors motion-reduce:transition-none ${
                    accountType === "standard"
                      ? "border-[#18422B]"
                      : "border-[#B8B4A6]"
                  }`}
                >
                  {accountType === "standard" && (
                    <span className="w-2 h-2 rounded-full bg-[#18422B]" />
                  )}
                </span>
                <span
                  className={
                    accountType === "standard"
                      ? "text-[#111413] font-semibold"
                      : "text-[#5B625F]"
                  }
                >
                  Standard User
                </span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={accountType === "passkey"}
                onClick={() => {
                  setAccountType("passkey");
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18422B] rounded-full px-1 py-0.5"
              >
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors motion-reduce:transition-none ${
                    accountType === "passkey"
                      ? "border-[#18422B]"
                      : "border-[#B8B4A6]"
                  }`}
                >
                  {accountType === "passkey" && (
                    <span className="w-2 h-2 rounded-full bg-[#18422B]" />
                  )}
                </span>
                <span
                  className={
                    accountType === "passkey"
                      ? "text-[#111413] font-semibold"
                      : "text-[#5B625F]"
                  }
                >
                  VIP Passkey
                </span>
              </button>
            </div>

            {/* Google OAuth Button (Standard Mode) */}
            {accountType === "standard" && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  className="w-full h-11 rounded-full bg-white hover:bg-[#FAF9F5] border border-[#E4E0D3] shadow-[0_1px_2px_rgba(17,20,19,0.04)] flex items-center justify-center gap-2.5 text-xs font-semibold text-[#111413] cursor-pointer transition-[transform,background-color,box-shadow] duration-150 active:scale-[0.985] motion-reduce:transition-none"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{isSignUp ? "Sign up with Google" : "Sign in with Google"}</span>
                </button>

                {/* OR Divider */}
                <div className="flex items-center my-4">
                  <div className="flex-1 border-t border-[#E4E0D3]" />
                  <span className="px-3 text-[10px] font-semibold uppercase tracking-widest text-[#5B625F]/75">
                    OR
                  </span>
                  <div className="flex-1 border-t border-[#E4E0D3]" />
                </div>
              </>
            )}

            {/* Inline Status Feedback */}
            {error && (
              <div
                role="alert"
                className="mb-3.5 px-4 py-2.5 rounded-2xl bg-[#FDF2EF] border border-[#C4552D]/25 text-[#9B3B1A] text-xs font-medium flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#C4552D]" />
                <span>{error}</span>
              </div>
            )}
            {successMsg && (
              <div
                role="status"
                className="mb-3.5 px-4 py-2.5 rounded-2xl bg-[#EEF6EC] border border-[#2F6B3A]/25 text-[#18422B] text-xs font-medium flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2F6B3A]" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {accountType === "passkey" ? (
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor={`${uid}-passkey`}
                      className="block text-[11px] font-semibold text-[#111413] mb-1.5 pl-1"
                    >
                      Access Passkey <span className="text-[#C4552D]">*</span>
                    </label>
                    <div className="relative flex items-center rounded-full bg-white border border-[#E4E0D3] focus-within:border-[#18422B] focus-within:ring-2 focus-within:ring-[#18422B]/15 transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none">
                      <KeyRound className="w-4 h-4 text-[#5B625F] ml-4 shrink-0" />
                      <input
                        id={`${uid}-passkey`}
                        type={showPassword ? "text" : "password"}
                        required
                        autoFocus
                        disabled={loading}
                        value={passkey}
                        onChange={(e) => {
                          setPasskey(e.target.value);
                          setError(null);
                        }}
                        placeholder="Enter passkey code..."
                        className="w-full h-11 bg-transparent px-3 pr-10 text-xs font-mono font-semibold text-[#111413] placeholder:text-[#9AA39F] placeholder:font-sans placeholder:font-normal focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide passkey" : "Show passkey"}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 text-[#5B625F] hover:text-[#111413] cursor-pointer p-1"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="px-4 py-2.5 rounded-2xl bg-white/80 border border-[#E4E0D3] text-[11px] text-[#5B625F] leading-relaxed">
                    VIP passkeys are issued by an administrator and unlock dedicated wholesale rates.
                  </div>
                </div>
              ) : (
                <>
                  {/* Username */}
                  <div>
                    <label
                      htmlFor={`${uid}-username`}
                      className="block text-[11px] font-semibold text-[#111413] mb-1.5 pl-1"
                    >
                      Username <span className="text-[#C4552D]">*</span>
                    </label>
                    <div className="relative flex items-center rounded-full bg-white border border-[#E4E0D3] focus-within:border-[#18422B] focus-within:ring-2 focus-within:ring-[#18422B]/15 transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none">
                      <User className="w-4 h-4 text-[#5B625F] ml-4 shrink-0" />
                      <input
                        id={`${uid}-username`}
                        type="text"
                        required
                        autoComplete="username"
                        disabled={loading}
                        value={username}
                        onChange={(e) => {
                          setUsername(
                            isSignUp ? e.target.value.replace(/\s+/g, "") : e.target.value
                          );
                          setError(null);
                        }}
                        placeholder={isSignUp ? "e.g. creator_john" : "Enter username"}
                        className="w-full h-11 bg-transparent px-3 pr-4 text-xs font-medium text-[#111413] placeholder:text-[#9AA39F] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Email (Sign Up Only - Optional) */}
                  {isSignUp && (
                    <div>
                      <label
                        htmlFor={`${uid}-email`}
                        className="block text-[11px] font-semibold text-[#111413] mb-1.5 pl-1"
                      >
                        Email{" "}
                        <span className="text-[#5B625F] font-normal">(Optional)</span>
                      </label>
                      <div className="relative flex items-center rounded-full bg-white border border-[#E4E0D3] focus-within:border-[#18422B] focus-within:ring-2 focus-within:ring-[#18422B]/15 transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none">
                        <Mail className="w-4 h-4 text-[#5B625F] ml-4 shrink-0" />
                        <input
                          id={`${uid}-email`}
                          type="email"
                          autoComplete="email"
                          disabled={loading}
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value.trim());
                            setError(null);
                          }}
                          placeholder="name@example.com"
                          className="w-full h-11 bg-transparent px-3 pr-4 text-xs font-medium text-[#111413] placeholder:text-[#9AA39F] focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5 px-1">
                      <label
                        htmlFor={`${uid}-password`}
                        className="text-[11px] font-semibold text-[#111413]"
                      >
                        Password <span className="text-[#C4552D]">*</span>
                      </label>
                      {!isSignUp && (
                        <button
                          type="button"
                          onClick={() => {
                            setAccountType("passkey");
                            setError(null);
                          }}
                          className="text-[11px] font-medium text-[#18422B] hover:underline cursor-pointer"
                        >
                          Use VIP Passkey?
                        </button>
                      )}
                    </div>
                    <div className="relative flex items-center rounded-full bg-white border border-[#E4E0D3] focus-within:border-[#18422B] focus-within:ring-2 focus-within:ring-[#18422B]/15 transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none">
                      <Lock className="w-4 h-4 text-[#5B625F] ml-4 shrink-0" />
                      <input
                        id={`${uid}-password`}
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete={isSignUp ? "new-password" : "current-password"}
                        disabled={loading}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setError(null);
                        }}
                        placeholder={isSignUp ? "Min. 8 characters" : "Enter password"}
                        className="w-full h-11 bg-transparent px-3 pr-10 text-xs font-medium text-[#111413] placeholder:text-[#9AA39F] focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 text-[#5B625F] hover:text-[#111413] cursor-pointer p-1"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Sleek Compact Password Strength Meter (Sign Up) */}
                    {isSignUp && password.length > 0 && (
                      <div className="mt-2 px-2 space-y-1.5">
                        <div className="grid grid-cols-4 gap-1 h-1">
                          {[0, 1, 2, 3].map((idx) => (
                            <div
                              key={idx}
                              className={`h-full rounded-full transition-colors duration-200 motion-reduce:transition-none ${
                                idx < strengthScore
                                  ? strengthBarColors[Math.max(0, strengthScore - 1)]
                                  : "bg-[#E4E0D3]"
                              }`}
                            />
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-semibold text-[#111413]">
                            Strength: {strengthLabels[Math.max(0, strengthScore - 1)] || "Too weak"}
                          </span>
                          <div className="flex items-center gap-2 text-[#5B625F]">
                            {passwordCriteria.map((c, idx) => (
                              <span
                                key={idx}
                                className={c.met ? "text-[#2F6B3A] font-medium" : "text-[#9AA39F]"}
                              >
                                {c.met ? "✓" : "·"} {c.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password (Sign Up) */}
                  {isSignUp && (
                    <div>
                      <label
                        htmlFor={`${uid}-confirm`}
                        className="block text-[11px] font-semibold text-[#111413] mb-1.5 pl-1"
                      >
                        Confirm Password <span className="text-[#C4552D]">*</span>
                      </label>
                      <div className="relative flex items-center rounded-full bg-white border border-[#E4E0D3] focus-within:border-[#18422B] focus-within:ring-2 focus-within:ring-[#18422B]/15 transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none">
                        <Lock className="w-4 h-4 text-[#5B625F] ml-4 shrink-0" />
                        <input
                          id={`${uid}-confirm`}
                          type={showPassword ? "text" : "password"}
                          required
                          autoComplete="new-password"
                          disabled={loading}
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            setError(null);
                          }}
                          placeholder="Re-enter password"
                          className="w-full h-11 bg-transparent px-3 pr-10 text-xs font-medium text-[#111413] placeholder:text-[#9AA39F] focus:outline-none"
                        />
                        {passwordsMatch && (
                          <Check
                            className="w-4 h-4 text-[#2F6B3A] mr-3.5 shrink-0"
                            aria-label="Passwords match"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Cloudflare Turnstile Widget */}
              <div className="pt-1">
                <TurnstileWidget
                  onVerify={(token) => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken("")}
                />
              </div>

              {/* Primary Pill Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-full bg-[#18422B] hover:bg-[#123321] text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-[transform,background-color] duration-150 active:scale-[0.985] disabled:opacity-50 motion-reduce:transition-none"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {accountType === "passkey"
                    ? "Sign In with Passkey"
                    : isSignUp
                    ? "Create Account"
                    : "Sign In"}
                </span>
              </button>
            </form>

            {/* Bottom Account Mode Switcher */}
            <div className="mt-5 text-center text-[11px] text-[#5B625F]">
              {authMode === "signin" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <Link
                    href="/signup"
                    onClick={(e) => {
                      e.preventDefault();
                      setAuthMode("signup");
                      setAccountType("standard");
                      setError(null);
                      setSuccessMsg(null);
                      if (typeof window !== "undefined") {
                        window.history.replaceState(null, "", "/signup");
                      }
                    }}
                    className="font-semibold text-[#18422B] underline underline-offset-2 hover:text-[#123321]"
                  >
                    Sign Up
                  </Link>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    onClick={(e) => {
                      e.preventDefault();
                      setAuthMode("signin");
                      setAccountType("standard");
                      setError(null);
                      setSuccessMsg(null);
                      if (typeof window !== "undefined") {
                        window.history.replaceState(null, "", "/login");
                      }
                    }}
                    className="font-semibold text-[#18422B] underline underline-offset-2 hover:text-[#123321]"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Minimal security footer on left pane */}
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#5B625F]/80">
            <ShieldCheck className="w-3.5 h-3.5 text-[#2F6B3A]" />
            <span>Protected by Turnstile &amp; Argon2id</span>
          </div>
        </div>

        {/* ── RIGHT PANE: Editorial Testimonial & Line-Art Illustration ── */}
        <div className="hidden lg:flex bg-white flex-col justify-between relative overflow-hidden">
          <div className="px-12 xl:px-14 pt-14 xl:pt-16 pb-6 max-w-[500px]">
            {/* Warm orange opening quote */}
            <span
              aria-hidden="true"
              className="block text-[44px] leading-none font-serif font-bold text-[#E67E22] mb-2 select-none"
            >
              &ldquo;
            </span>

            <p className="text-[18px] xl:text-[19px] leading-[1.58] font-medium text-[#111413] tracking-[-0.015em]">
              {quote.text}
            </p>

            {/* Warm orange closing quote */}
            <div className="flex justify-end mt-1">
              <span
                aria-hidden="true"
                className="text-[44px] leading-none font-serif font-bold text-[#E67E22] select-none"
              >
                &rdquo;
              </span>
            </div>

            {/* Author row */}
            <div className="mt-2 flex items-center gap-3">
              <img
                src={quote.avatar}
                alt={quote.author}
                width={44}
                height={44}
                className="w-11 h-11 rounded-full object-cover object-top border border-[#E4E0D3] shadow-xs shrink-0"
              />
              <div>
                <div className="text-xs font-bold text-[#111413]">{quote.author}</div>
                <div className="text-[11px] text-[#5B625F]">{quote.location}</div>
              </div>
            </div>
          </div>

          {/* Bottom-right architectural & growth line-art illustration */}
          <div className="w-full mt-auto pl-6 pt-2">
            <AuthIllustration />
          </div>
        </div>
      </div>
    </div>
  );
}

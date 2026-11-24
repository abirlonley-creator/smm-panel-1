"use client";

import React, { useState, useId } from "react";
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
  Sparkles,
  Loader2,
  User,
  Mail,
  Shield,
  Check,
} from "lucide-react";

export default function SignupPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Password strength evaluation
  const passwordCriteria = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains a number (0-9)", met: /[0-9]/.test(password) },
    { label: "Contains an uppercase letter (A-Z)", met: /[A-Z]/.test(password) },
    { label: "Contains a special character (!@#$%...)", met: /[^a-zA-Z0-9]/.test(password) },
  ];

  const strengthScore = passwordCriteria.filter((c) => c.met).length;
  const strengthLabels = ["Weak", "Fair", "Good", "Strong"];
  const strengthColors = ["bg-red-500", "bg-amber-500", "bg-blue-500", "bg-emerald-500"];

  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
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

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Failed to create account. Please try again.");
        setLoading(false);
        return;
      }

      setSuccessMsg("Account created successfully! Redirecting...");
      setTimeout(() => {
        router.push("/engagement");
      }, 800);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  function handleGoogleAuth() {
    window.location.href = "/api/auth/google/initiate?returnTo=/engagement";
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-white flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-gradient-to-tr from-lime-500/10 via-emerald-500/5 to-transparent blur-3xl pointer-events-none rounded-full" />

      {/* Main card */}
      <div className="w-full max-w-md bg-[#0f121a]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lime-400/10 border border-lime-400/20 text-lime-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Zero-Mock Organic Panel
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Create an Account
          </h1>
          <p className="text-sm text-zinc-400 mt-1.5">
            Instant organic growth campaigns with algorithmic delivery
          </p>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-zinc-100 text-zinc-900 font-semibold rounded-xl transition duration-200 shadow-md active:scale-[0.99]"
        >
          {/* Google SVG Icon */}
          <svg className="w-5 h-5" viewBox="0 0 24 24">
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
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center my-5">
          <div className="flex-1 border-t border-zinc-800" />
          <span className="px-3 text-xs uppercase tracking-wider text-zinc-500 font-medium">
            or register with credentials
          </span>
          <div className="flex-1 border-t border-zinc-800" />
        </div>

        {/* Feedback alerts */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-xs text-red-400 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-xs text-emerald-400 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Username <span className="text-lime-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ""))}
                placeholder="e.g. alex_growth"
                className="w-full bg-[#161a24] border border-zinc-700 focus:border-lime-400 focus:ring-1 focus:ring-lime-400/40 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition pl-10"
              />
              <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Email Address <span className="text-zinc-500">(Optional for account recovery)</span>
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                placeholder="name@example.com"
                className="w-full bg-[#161a24] border border-zinc-700 focus:border-lime-400 focus:ring-1 focus:ring-lime-400/40 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition pl-10"
              />
              <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Password <span className="text-lime-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a strong password"
                className="w-full bg-[#161a24] border border-zinc-700 focus:border-lime-400 focus:ring-1 focus:ring-lime-400/40 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition pl-10 pr-10"
              />
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-zinc-400 hover:text-white transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password strength meter */}
            {password.length > 0 && (
              <div className="mt-2.5 space-y-2 p-2.5 bg-black/30 border border-white/5 rounded-lg">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Password Strength:</span>
                  <span className="font-semibold text-white">
                    {strengthLabels[strengthScore - 1] || "Too Weak"}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 h-1.5">
                  {[0, 1, 2, 3].map((index) => (
                    <div
                      key={index}
                      className={`h-full rounded-full transition-all duration-300 ${
                        index < strengthScore
                          ? strengthColors[strengthScore - 1]
                          : "bg-zinc-800"
                      }`}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px] text-zinc-400 pt-1">
                  {passwordCriteria.map((criterion, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <div
                        className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold ${
                          criterion.met
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-zinc-800 text-zinc-500"
                        }`}
                      >
                        {criterion.met ? "✓" : "•"}
                      </div>
                      <span className={criterion.met ? "text-zinc-200" : "text-zinc-500"}>
                        {criterion.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Confirm Password <span className="text-lime-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full bg-[#161a24] border border-zinc-700 focus:border-lime-400 focus:ring-1 focus:ring-lime-400/40 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition pl-10 pr-10"
              />
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
              {passwordsMatch && (
                <div className="absolute right-3 top-2.5 text-emerald-400">
                  <Check className="w-4 h-4" />
                </div>
              )}
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-[#c8ff00] hover:bg-[#b5e600] text-black font-bold rounded-xl text-sm transition duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-lime-500/20 active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Securing Account...
              </>
            ) : (
              <>
                Create Account
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-zinc-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-lime-400 hover:text-lime-300 font-semibold hover:underline"
          >
            Sign In
          </Link>
        </div>

        {/* Security badge */}
        <div className="mt-4 pt-4 border-t border-zinc-800/80 flex items-center justify-center gap-2 text-[11px] text-zinc-500">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Argon2id Memory-Hard Cryptography & Turnstile Protected</span>
        </div>
      </div>
    </div>
  );
}

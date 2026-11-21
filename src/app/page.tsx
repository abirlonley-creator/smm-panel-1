"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Zap,
  Star,
  Users,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Percent,
  RefreshCw,
  Clock,
  Heart,
  Play,
  Share2,
  Bookmark,
  Check,
  X,
  AlertCircle,
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();

  // Auth modal states
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [usePasskeyDirect, setUsePasskeyDirect] = useState(false);

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passkey, setPasskey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // User session state (check if already logged in)
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setSession(data);
        }
      })
      .catch(() => {});
  }, []);

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (usePasskeyDirect) {
        // Direct Passkey login (e.g. for Admin or VIP keyholders)
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
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error || "Invalid passkey.");
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
          setError("Please fill in all required fields.");
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
        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || "Failed to create account.");
          setLoading(false);
          return;
        }

        setSuccessMsg("Account created! Redirecting to dashboard...");
        window.dispatchEvent(new CustomEvent("auth-changed", { detail: data }));
        setTimeout(() => {
          router.push("/engagement");
          router.refresh();
        }, 800);
      } else {
        // Sign In
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
        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || "Invalid credentials.");
          setLoading(false);
          return;
        }

        setSuccessMsg("Signed in successfully! Redirecting...");
        window.dispatchEvent(new CustomEvent("auth-changed", { detail: data }));
        setTimeout(() => {
          router.push(data.role === "ADMIN" ? "/admin" : "/engagement");
          router.refresh();
        }, 600);
      }
    } catch (err: any) {
      setError(err.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function openAuth(mode: "signin" | "signup") {
    setAuthMode(mode);
    setUsePasskeyDirect(false);
    setError(null);
    setSuccessMsg(null);
    setAuthModalOpen(true);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#252943] relative selection:bg-[#3A4EFB]/20 overflow-x-hidden">
      {/* ── Background Subtle Glow & Radial Gradients ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[750px] -z-10"
        style={{
          background:
            "radial-gradient(ellipse 65% 55% at 50% 0%, rgba(58, 78, 251, 0.08) 0%, rgba(212, 240, 79, 0.04) 50%, transparent 80%)",
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

      {/* ── Floating Pill Top Navigation ── */}
      <header className="sticky top-5 z-40 max-w-5xl mx-auto px-4">
        <nav className="bg-white/90 backdrop-blur-md border border-[#DEE0ED] rounded-full px-5 py-2.5 shadow-sm flex items-center justify-between transition-all">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-full bg-[#3A4EFB] text-white flex items-center justify-center font-black shadow-xs group-hover:scale-105 transition-transform">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-sm tracking-tight text-[#252943]">
                Aura<span className="text-[#3A4EFB]">SMM</span>
              </span>
              <span className="text-[9px] font-mono text-[#252943]/50 leading-none">v2.0</span>
            </div>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-1 bg-[#F8F9FD] border border-[#DEE0ED]/60 rounded-full px-3 py-1 text-xs font-semibold text-[#252943]/70">
            <Link
              href="/"
              className="px-3 py-1 rounded-full text-[#3A4EFB] font-bold bg-white shadow-xs"
            >
              Home
            </Link>
            <Link
              href="/pricing"
              className="px-3 py-1 rounded-full hover:text-[#252943] transition-colors"
            >
              Service List
            </Link>
            <Link
              href="/api-docs"
              className="px-3 py-1 rounded-full hover:text-[#252943] transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/engagement"
              className="px-3 py-1 rounded-full hover:text-[#252943] transition-colors"
            >
              Engagement Engine
            </Link>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            {session?.authenticated ? (
              <Link
                href="/engagement"
                className="px-4 py-2 rounded-full bg-[#3A4EFB] hover:bg-[#2A3DE0] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-[0.97]"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openAuth("signin")}
                  className="px-3.5 py-1.5 text-xs font-bold text-[#252943]/80 hover:text-[#252943] transition-colors cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => openAuth("signup")}
                  className="px-4 py-2 rounded-full bg-[#3A4EFB] hover:bg-[#2A3DE0] text-white text-xs font-black transition-all shadow-sm active:scale-[0.97] cursor-pointer"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ── Main Hero Section ── */}
      <main className="max-w-6xl mx-auto px-4 pt-12 sm:pt-20 pb-20 relative">
        {/* Top Major Update Pill */}
        <div className="flex justify-center mb-6 animate-fadeIn">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 shadow-xs text-xs">
            <span className="px-2 py-0.5 rounded-full bg-[#3A4EFB] text-white text-[10px] font-black uppercase tracking-wider">
              Major Update!
            </span>
            <span className="font-semibold text-[#252943]">
              AuraSMM v2.0 is now online with Natural Algorithmic Pacing!
            </span>
          </div>
        </div>

        {/* Central Headline */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-[#252943] tracking-tight leading-[1.12]">
            Best SMM Tool{" "}
            <span className="inline-block text-[#3A4EFB]">
              ✨
            </span>{" "}
            for Genuine Social Media Engagement
          </h1>

          <p className="text-sm sm:text-base text-[#252943]/70 font-medium max-w-xl mx-auto leading-relaxed">
            A perfect fit for TikTok Creators, Instagram Influencers, Businesses, Artists & Brands seeking mathematically verified, ban-proof organic momentum.
          </p>

          {/* Hero CTA & Rating */}
          <div className="pt-4 flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={() => openAuth("signup")}
              className="px-8 py-3.5 rounded-full bg-[#3A4EFB] hover:bg-[#2A3DE0] active:scale-[0.97] text-white text-sm font-black transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
            >
              <span>Signup for free today!</span>
              <Users className="w-4 h-4" />
            </button>

            {/* Social Proof Star Rating & Avatar Stack */}
            <div className="flex items-center gap-2.5 text-xs text-[#252943]/70 font-semibold pt-1">
              <div className="flex -space-x-2 overflow-hidden">
                <img
                  className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80"
                  alt="Reviewer"
                />
                <img
                  className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80"
                  alt="Reviewer"
                />
                <img
                  className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80"
                  alt="Reviewer"
                />
                <img
                  className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&q=80"
                  alt="Reviewer"
                />
              </div>
              <div className="flex items-center gap-1">
                <div className="flex text-amber-400">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <Star className="w-3.5 h-3.5 fill-current" />
                </div>
                <span className="font-bold text-[#252943]">4.8 / 5</span>
                <span className="text-[#252943]/50">Rating over 500 Reviews</span>
              </div>
            </div>
          </div>

          {/* Feature Badges Row */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[11px] font-bold text-[#252943]">
            <span className="px-3 py-1.5 rounded-full bg-white border border-[#DEE0ED] shadow-xs flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-[#3A4EFB]" />
              <span>Starting at Just ₹0.84 / 1K</span>
            </span>
            <span className="px-3 py-1.5 rounded-full bg-white border border-[#DEE0ED] shadow-xs flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Natural Algorithmic Pacing</span>
            </span>
            <span className="px-3 py-1.5 rounded-full bg-white border border-[#DEE0ED] shadow-xs flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Non-drop services</span>
            </span>
            <span className="px-3 py-1.5 rounded-full bg-white border border-[#DEE0ED] shadow-xs flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
              <span>Lifetime Refills</span>
            </span>
            <span className="px-3 py-1.5 rounded-full bg-white border border-[#DEE0ED] shadow-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
              <span>24/7 Support</span>
            </span>
          </div>
        </div>

        {/* ── Interactive Realistic Mockup Showcase (Reference Layout) ── */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Left Floating Card: Growth & Net Follower Gain */}
          <div className="md:col-span-4 space-y-4">
            {/* Toast Notification */}
            <div className="p-3 bg-white/95 backdrop-blur-sm rounded-2xl border border-[#DEE0ED] shadow-subtle flex items-center gap-3 w-fit animate-fadeIn">
              <img
                className="w-8 h-8 rounded-full object-cover"
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80"
                alt="Notification avatar"
              />
              <div className="text-xs">
                <span className="font-bold text-[#252943]">You got New followers! 🎉</span>
                <span className="text-[10px] text-[#252943]/50 block">Just now via Natural FYP wave</span>
              </div>
            </div>

            {/* Follower Gain Card */}
            <div className="p-6 rounded-3xl bg-white border border-[#DEE0ED] shadow-subtle space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#252943]/60 uppercase tracking-wider block">
                    Net Campaign Growth
                  </span>
                  <span className="text-2xl font-black text-[#252943]">₹550,000+</span>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-full bg-blue-100 text-[#3A4EFB] text-[10px] font-black inline-flex items-center gap-1">
                    <span>Boost Activated</span>
                    <Sparkles className="w-3 h-3" />
                  </span>
                  <span className="text-[10px] text-[#252943]/50 block mt-1">250,000 Total Views</span>
                </div>
              </div>

              {/* Realistic SVG Curved Momentum Graph */}
              <div className="h-28 w-full relative pt-2">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 300 100">
                  <defs>
                    <linearGradient id="gradientCurve" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3A4EFB" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#3A4EFB" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 0,85 Q 50,70 100,60 T 200,35 T 300,10 L 300,100 L 0,100 Z"
                    fill="url(#gradientCurve)"
                  />
                  <path
                    d="M 0,85 Q 50,70 100,60 T 200,35 T 300,10"
                    fill="none"
                    stroke="#3A4EFB"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  <circle cx="200" cy="35" r="4.5" fill="#3A4EFB" />
                  <circle cx="300" cy="10" r="5" fill="#10B981" />
                </svg>
                {/* Month Indicators */}
                <div className="flex justify-between text-[10px] font-semibold text-[#252943]/40 pt-1">
                  <span>April</span>
                  <span>May</span>
                  <span>June</span>
                  <span>July</span>
                  <span>August</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center Showcase: Organic Engine Feature Card */}
          <div className="md:col-span-4 p-6 sm:p-7 rounded-3xl bg-gradient-to-b from-[#1E2235] to-[#111422] text-white shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#D4F04F]" />
                <span className="text-xs font-black uppercase tracking-wider text-[#D4F04F]">
                  Algorithmic Engine
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
                100% Invariant Compliant
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-extrabold text-white">
                Multi-Wave Natural Delivery
              </h3>
              <p className="text-xs text-white/70 leading-relaxed">
                Views, likes, saves & shares distributed across randomized circadian curves. No sudden spikes. Zero bot detection flags.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-white/50 block">Views Pacing</span>
                <span className="font-mono font-bold text-white">40-120/batch</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-white/50 block">Likes Lag</span>
                <span className="font-mono font-bold text-white">Synchronized</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openAuth("signup")}
              className="w-full py-2.5 rounded-xl bg-[#3A4EFB] hover:bg-[#2A3DE0] text-white text-xs font-bold transition-all shadow-subtle flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Explore Engine Live</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right Floating Cards: Live Order & Sales Performance */}
          <div className="md:col-span-4 space-y-4">
            {/* Live Order Card */}
            <div className="p-5 rounded-3xl bg-white border border-[#DEE0ED] shadow-subtle space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#252943]">Order #1345</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#3A4EFB] text-[10px] font-bold">
                  In Progress
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <img
                    className="w-7 h-7 rounded-full object-cover"
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80"
                    alt="Target profile"
                  />
                  <div>
                    <span className="font-bold text-[#252943] block">@elenaturkals</span>
                    <span className="text-[10px] text-emerald-600 font-semibold">Boost Active 🚀</span>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold text-[#252943]/70">
                  1,000 / 10,000,000
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#3A4EFB] h-full rounded-full transition-all duration-1000"
                  style={{ width: "68%" }}
                />
              </div>
            </div>

            {/* Sales Performance Card */}
            <div className="p-5 rounded-3xl bg-white border border-[#DEE0ED] shadow-subtle flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-[#252943]/60 font-semibold">
                  <span>My Clothing Brand</span>
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl font-black text-[#252943]">₹500,000</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    +110%
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Platform Logos Cloud ── */}
        <div className="mt-20 pt-8 border-t border-[#DEE0ED] text-center space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-[#252943]/50">
            Providing solutions for best platforms
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 text-sm font-bold text-[#252943]/60 grayscale hover:grayscale-0 transition-all">
            <span className="flex items-center gap-2 hover:text-red-600 transition-colors">
              <Play className="w-4 h-4 fill-current text-red-600" />
              <span>YouTube</span>
            </span>
            <span className="flex items-center gap-2 hover:text-black transition-colors">
              <span className="font-black text-base">𝕏</span>
              <span>Twitter</span>
            </span>
            <span className="flex items-center gap-2 hover:text-pink-600 transition-colors">
              <Heart className="w-4 h-4 fill-current text-pink-600" />
              <span>Instagram</span>
            </span>
            <span className="flex items-center gap-2 hover:text-[#000000] transition-colors">
              <Zap className="w-4 h-4 fill-current text-black" />
              <span>TikTok</span>
            </span>
            <span className="flex items-center gap-2 hover:text-blue-600 transition-colors">
              <Share2 className="w-4 h-4 text-blue-600" />
              <span>Facebook</span>
            </span>
          </div>
        </div>

        {/* ── How to Grow in 3 Steps Section (from reference) ── */}
        <section className="mt-24 pt-10 border-t border-[#DEE0ED] text-center space-y-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-bold text-[#3A4EFB]">
              <Percent className="w-3 h-3" />
              <span>How it works ?</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-[#252943]">
              How to grow in social in 3 steps ?
            </h2>
            <p className="text-xs sm:text-sm text-[#252943]/60 max-w-lg mx-auto">
              The All-In-One Social Media Marketing tool you will need!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {/* Step 1 */}
            <div className="p-6 rounded-3xl bg-white border border-[#DEE0ED] shadow-subtle space-y-3 hover:translate-y-[-2px] transition-transform">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#3A4EFB] flex items-center justify-center font-extrabold text-sm border border-blue-100">
                1
              </div>
              <h3 className="font-extrabold text-base text-[#252943]">Signup for free!</h3>
              <p className="text-xs text-[#252943]/60 leading-relaxed">
                Create your account in under 30 seconds. No credit card required to explore all natural engagement presets and rates.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-3xl bg-white border border-[#DEE0ED] shadow-subtle space-y-3 hover:translate-y-[-2px] transition-transform">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-extrabold text-sm border border-amber-100">
                2
              </div>
              <h3 className="font-extrabold text-base text-[#252943]">Select service & order!</h3>
              <p className="text-xs text-[#252943]/60 leading-relaxed">
                Choose TikTok or Instagram, enter your video URL, and select from tested natural pacing packages (2K, 5K, 10K, or custom).
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-3xl bg-white border border-[#DEE0ED] shadow-subtle space-y-3 hover:translate-y-[-2px] transition-transform">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-extrabold text-sm border border-emerald-100">
                3
              </div>
              <h3 className="font-extrabold text-base text-[#252943]">Watch natural growth!</h3>
              <p className="text-xs text-[#252943]/60 leading-relaxed">
                Our mathematical engine distributes views, likes, and saves over realistic multi-hour curves that trigger algorithm recommendation.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ── Unified Sign In / Sign Up Modal ── */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#252943]/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl border border-[#DEE0ED] max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 my-auto max-h-[calc(100vh-2rem)] overflow-y-auto animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#3A4EFB] text-white flex items-center justify-center font-bold">
                  <Zap className="w-4 h-4 fill-white" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#252943]">
                    {usePasskeyDirect ? "Admin / Passkey Login" : authMode === "signup" ? "Create an Account" : "Sign In to AuraSMM"}
                  </h3>
                  <span className="text-[11px] text-[#252943]/50 block">
                    {usePasskeyDirect ? "Enter your master access passkey" : authMode === "signup" ? "Get started with natural social engagement" : "Welcome back to your dashboard"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className="text-[#252943]/40 hover:text-[#252943] text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Switcher Tabs: Sign In vs Sign Up (when not in passkey mode) */}
            {!usePasskeyDirect && (
              <div className="flex items-center p-1 bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl text-xs font-bold">
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
              </div>
            )}

            {/* Error / Success Messages */}
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

            {/* Auth Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs">
              {usePasskeyDirect ? (
                <div>
                  <label className="block font-bold text-[#252943] mb-1">Passkey Code</label>
                  <div className="relative group">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#252943]/40 group-focus-within:text-[#3A4EFB]" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={passkey}
                      onChange={(e) => setPasskey(e.target.value)}
                      placeholder="e.g. abir90 or smm_live_..."
                      className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl pl-10 pr-10 py-2.5 font-mono font-bold text-[#252943] outline-none focus:border-[#3A4EFB]"
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
                  <div>
                    <label className="block font-bold text-[#252943] mb-1">Username</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. creator_john"
                      className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2.5 font-semibold text-[#252943] outline-none focus:border-[#3A4EFB]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#252943] mb-1">Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#252943]/40 group-focus-within:text-[#3A4EFB]" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl pl-10 pr-10 py-2.5 font-semibold text-[#252943] outline-none focus:border-[#3A4EFB]"
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
                    <div>
                      <label className="block font-bold text-[#252943] mb-1">Confirm Password</label>
                      <div className="relative group">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#252943]/40 group-focus-within:text-[#3A4EFB]" />
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl pl-10 pr-3.5 py-2.5 font-semibold text-[#252943] outline-none focus:border-[#3A4EFB]"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* VIP Notice */}
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/60 text-[11px] text-blue-900 leading-relaxed">
                <span className="font-bold">💡 Tip:</span> Received an exclusive VIP passkey from admin? Sign up here, then enter your passkey in <span className="font-bold">Settings</span> to unlock wholesale 0% markup perks!
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

              {/* Toggle to Admin Passkey */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setUsePasskeyDirect(!usePasskeyDirect);
                    setError(null);
                  }}
                  className="text-[11px] text-[#3A4EFB] font-bold hover:underline cursor-pointer"
                >
                  {usePasskeyDirect ? "← Back to standard login" : "Administrator or Passkey user? Sign in with Passkey →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-[#DEE0ED] py-8 text-xs text-[#252943]/60 text-center">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold text-[#252943]">
            <Zap className="w-4 h-4 text-[#3A4EFB]" />
            <span>AuraSMM • Natural Social Growth Engine</span>
          </div>
          <span>© 2026 AuraSMM. All rights reserved. Mathematical organic pacing.</span>
        </div>
      </footer>
    </div>
  );
}

"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
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
  Activity,
  Moon,
  Layers,
  Flame,
  XCircle,
} from "lucide-react";
import { LiveOrganicGrowthPreview } from "@/components/engagement/LiveOrganicGrowthPreview";
import { AuraPrimaryButton } from "@/components/ui/AuraPrimaryButton";
import {
  generatePattern,
  DEFAULT_PACKAGES,
  PackageConfig,
  DeterministicPlan,
  DEFAULT_PROVIDER_MINIMUMS,
  DEFAULT_INSTAGRAM_PROVIDER_MINIMUMS,
  DEFAULT_TIKTOK_CONFIG,
  DEFAULT_INSTAGRAM_CONFIG,
} from "@/lib/engagement/deterministic-pattern-engine";

export default function LandingPage() {
  const router = useRouter();

  // User session state (check if already logged in)
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json().catch(() => null) : null))
      .then((data) => {
        if (data && data.authenticated) {
          setSession(data);
        }
      })
      .catch(() => {});
  }, []);

  // ── Interactive Graphs Showcase States ──
  const [graphsActiveTab, setGraphsActiveTab] = useState<"live-preview" | "circadian" | "bot-comparison">("live-preview");
  const [demoPlatform, setDemoPlatform] = useState<"TikTok" | "Instagram">("TikTok");
  const [demoPackageKey, setDemoPackageKey] = useState<string>("tiktok_5k");
  const [demoSeed, setDemoSeed] = useState<string>("aurasmm_landing_v2");
  const [circadianStrategy, setCircadianStrategy] = useState<"circadian" | "viral" | "steady">("circadian");

  const demoStartTime = useMemo(() => {
    const ms = 1000 * 60 * 15;
    return new Date(Math.round(Date.now() / ms) * ms);
  }, []);

  const demoPackage: PackageConfig = useMemo(() => {
    return DEFAULT_PACKAGES[demoPackageKey] || DEFAULT_PACKAGES.tiktok_5k;
  }, [demoPackageKey]);

  const demoPlan: DeterministicPlan = useMemo(() => {
    return generatePattern(
      demoPackage,
      2500,
      demoSeed,
      {
        platformConfig: demoPlatform === "Instagram" ? DEFAULT_INSTAGRAM_CONFIG : DEFAULT_TIKTOK_CONFIG,
        providerMinimums: demoPlatform === "Instagram" ? DEFAULT_INSTAGRAM_PROVIDER_MINIMUMS : DEFAULT_PROVIDER_MINIMUMS,
        startDate: demoStartTime,
      }
    );
  }, [demoPackage, demoSeed, demoPlatform, demoStartTime]);

  return (
    <div className="landing min-h-screen bg-[#F3F1EA] text-[#111413] relative selection:bg-[#D4F04F]/30">
      {/* Aura brand atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[760px] -z-10"
        style={{
          background:
            "radial-gradient(ellipse 64% 56% at 55% 0%, rgba(212, 240, 79, 0.12) 0%, rgba(228, 224, 211, 0.18) 48%, transparent 82%)",
        }}
      />

      {/* ── Floating Pill Top Navigation ── */}
      <header className="landing-nav-wrap">
        <nav className="landing-nav">
          {/* Logo */}
          <Link href="/" className="landing-brand" aria-label="AuraSMM home">
            <Image
              src="/brand/lockup-horizontal-on-light.svg"
              alt="AuraSMM"
              width={180}
              height={42}
              priority
            />
          </Link>

          {/* Nav Links */}
          <div className="landing-nav-links">
            <Link
              href="/"
              className="text-current"
            >
              Home
            </Link>
            <Link
              href="/pricing"
            >
              Services
            </Link>
            <Link
              href="/api-docs"
            >
              API
            </Link>
            <Link
              href="#how-it-works"
            >
              How it works
            </Link>
          </div>

          {/* Right Action Buttons */}
          <div className="landing-nav-actions">
            {session?.authenticated ? (
              <Link
                href="/engagement"
                className="landing-button landing-button-dark"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="landing-signin"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="landing-button landing-button-lime"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

            {/* AuraSMM landing hero */}
      <main className="landing-main">
        <section className="landing-hero landing-hero-background">
          <div className="hero-wave-shape" aria-hidden="true" />
          <div className="landing-hero-copy hero-text-content">
            <p className="landing-eyebrow">
              <span className="landing-live-dot" aria-hidden="true" />
              A steadier way to grow
            </p>
            <h1>
              Social growth,
              <br />
              <span>with a plan.</span>
            </h1>
            <p className="landing-lede">
              Thoughtful delivery for the people building something online. Set up social media orders, shape their pace, and keep everything in view.
            </p>
            <div className="landing-hero-actions">
              <AuraPrimaryButton
                label="Create your account"
                size="large"
                href="/signup"
              />
              <Link href="/pricing" className="landing-text-link">
                Explore services
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="landing-proof-row">
              <span><Activity size={15} aria-hidden="true" /> Curve-aware delivery</span>
              <span><Heart size={15} aria-hidden="true" /> Built for TikTok & Instagram</span>
              <span><ShieldCheck size={15} aria-hidden="true" /> Clear order tracking</span>
            </div>
          </div>
          <div className="landing-stage">
            <div className="stage-glow" aria-hidden="true" />
            <figure className="landing-dashboard-figure">
              <div className="landing-image-frame">
                <Image
                  className="landing-dashboard-shot"
                  src="/brand/aurasmm-growth-preview.png"
                  alt="AuraSMM live growth preview showing view and engagement delivery over time"
                  width={1280}
                  height={759}
                  priority
                />
              </div>
            </figure>
          </div>
          <p className="landing-scroll-note"><span aria-hidden="true" /> Made for the day-to-day of growing online</p>
        </section>

        <div className="landing-platforms" aria-label="Supported social platforms">
          <span>GROW ACROSS</span>
          <b>TikTok</b><i aria-hidden="true" />
          <b>Instagram</b><i aria-hidden="true" />
          <b>YouTube</b><i aria-hidden="true" />
          <b>Facebook</b><i aria-hidden="true" />
          <b>X</b>
        </div>
{/* ── All Delivery Graphs & Algorithmic Visualizers Showcase ── */}
        <section className="mt-24 pt-10 border-t border-[#DEE0ED] space-y-10">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
              <Activity className="w-3.5 h-3.5 animate-pulse text-emerald-600" />
              <span>Proprietary Algorithmic Engine</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-[#252943] tracking-tight">
              Explore Our All Delivery Graphs & Curves
            </h2>
            <p className="text-xs sm:text-sm text-[#252943]/65 max-w-xl mx-auto leading-relaxed">
              Unlike generic panels that trigger immediate bot flags with instant spikes, AuraSMM synchronizes views, likes, and saves across realistic circadian curves.
            </p>

            {/* Graphs Tab Switcher */}
            <div className="inline-flex p-1.5 rounded-2xl bg-slate-100 border border-[#DEE0ED] gap-1 mt-4 max-w-full overflow-x-auto">
              <button
                type="button"
                onClick={() => setGraphsActiveTab("live-preview")}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  graphsActiveTab === "live-preview"
                    ? "bg-white text-[#3A4EFB] shadow-sm border border-[#DEE0ED]/60"
                    : "text-[#252943]/60 hover:text-[#252943]"
                }`}
              >
                <Activity className="w-4 h-4 text-emerald-500" />
                <span>1. Multi-Wave Live Engine</span>
              </button>
              <button
                type="button"
                onClick={() => setGraphsActiveTab("circadian")}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  graphsActiveTab === "circadian"
                    ? "bg-white text-[#3A4EFB] shadow-sm border border-[#DEE0ED]/60"
                    : "text-[#252943]/60 hover:text-[#252943]"
                }`}
              >
                <Moon className="w-4 h-4 text-indigo-500" />
                <span>2. Circadian & Pacing Curves</span>
              </button>
              <button
                type="button"
                onClick={() => setGraphsActiveTab("bot-comparison")}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  graphsActiveTab === "bot-comparison"
                    ? "bg-white text-[#3A4EFB] shadow-sm border border-[#DEE0ED]/60"
                    : "text-[#252943]/60 hover:text-[#252943]"
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-rose-500" />
                <span>3. Organic vs Bot Blast</span>
              </button>
            </div>
          </div>

          {/* ── TAB 1: Multi-Wave Live Engine Preview ── */}
          {graphsActiveTab === "live-preview" && (
            <div className="space-y-6">
              {/* Controls bar: Platform, Tier, Random Seed */}
              <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Platform Selector */}
                  <div className="flex items-center gap-1 p-1 bg-slate-50 border border-[#DEE0ED] rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setDemoPlatform("TikTok");
                        setDemoPackageKey("tiktok_5k");
                      }}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                        demoPlatform === "TikTok"
                          ? "bg-black text-white shadow-sm"
                          : "text-slate-600 hover:text-black"
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>TikTok</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDemoPlatform("Instagram");
                        setDemoPackageKey("tiktok_5k");
                      }}
                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                        demoPlatform === "Instagram"
                          ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm"
                          : "text-slate-600 hover:text-pink-600"
                      }`}
                    >
                      <Heart className="w-3.5 h-3.5 fill-current" />
                      <span>Instagram</span>
                    </button>
                  </div>

                  {/* Tier Selector */}
                  <div className="flex items-center gap-1 p-1 bg-slate-50 border border-[#DEE0ED] rounded-xl text-xs font-bold overflow-x-auto">
                    {[
                      { key: "tiktok_2k", label: "2K Starter", dur: "6h" },
                      { key: "tiktok_5k", label: "5K Growth", dur: "24h" },
                      { key: "tiktok_10k", label: "10K Surge", dur: "48h" },
                      { key: "tiktok_50k", label: "50K Mega", dur: "72h" },
                    ].map((pkg) => (
                      <button
                        key={pkg.key}
                        type="button"
                        onClick={() => setDemoPackageKey(pkg.key)}
                        className={`px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                          demoPackageKey === pkg.key
                            ? "bg-[#3A4EFB] text-white shadow-sm"
                            : "text-slate-600 hover:text-[#3A4EFB]"
                        }`}
                      >
                        {pkg.label}{" "}
                        <span className="opacity-75 text-[10px]">({pkg.dur})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Randomize Seed Button */}
                <button
                  type="button"
                  onClick={() =>
                    setDemoSeed(
                      "aurasmm_" + Math.random().toString(36).substring(2, 9)
                    )
                  }
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-[#DEE0ED] text-xs font-bold text-[#252943] flex items-center gap-2 transition-all ml-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#3A4EFB]" />
                  <span>New Random Seed</span>
                </button>
              </div>

              {/* Real Interactive Graph Preview */}
              <div className="bg-white rounded-3xl border border-[#DEE0ED] shadow-sm p-4 sm:p-6 overflow-hidden">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#DEE0ED] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-wider text-[#252943]">
                      Deterministic Multi-Wave Graph Preview
                    </span>
                  </div>
                  <span className="text-xs font-mono text-[#252943]/60 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    Seed: {demoSeed}
                  </span>
                </div>

                <LiveOrganicGrowthPreview
                  plan={demoPlan}
                  startDate={demoStartTime}
                  onNewPattern={() =>
                    setDemoSeed(
                      "aurasmm_" + Math.random().toString(36).substring(2, 9)
                    )
                  }
                />
              </div>

              {/* Highlight Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                <div className="p-3.5 rounded-2xl bg-white border border-[#DEE0ED] shadow-xs">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Invariant Safe</span>
                  </div>
                  <p className="text-[11px] text-[#252943]/70">
                    All 8 mathematical safety boundaries verified.
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-[#DEE0ED] shadow-xs">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 mb-1">
                    <Clock className="w-4 h-4" />
                    <span>15m Grid Ticks</span>
                  </div>
                  <p className="text-[11px] text-[#252943]/70">
                    Natural micro-batches aligned to real clock boundaries.
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-[#DEE0ED] shadow-xs">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 mb-1">
                    <Heart className="w-4 h-4" />
                    <span>Lag Synchronized</span>
                  </div>
                  <p className="text-[11px] text-[#252943]/70">
                    Likes & saves arrive proportionally after initial view waves.
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-[#DEE0ED] shadow-xs">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 mb-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>0% Anomaly Score</span>
                  </div>
                  <p className="text-[11px] text-[#252943]/70">
                    Undetectable to anti-spam & velocity tripwires.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: Circadian & Pacing Curves ── */}
          {graphsActiveTab === "circadian" && (
            <div className="space-y-6">
              {/* Curve Strategy Switcher */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setCircadianStrategy("circadian")}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    circadianStrategy === "circadian"
                      ? "bg-white border-[#3A4EFB] shadow-md ring-2 ring-[#3A4EFB]/15"
                      : "bg-white border-[#DEE0ED] hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <Moon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Recommended
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-[#252943]">
                    Circadian Diurnal Wave
                  </h4>
                  <p className="text-xs text-[#252943]/65 mt-1 leading-relaxed">
                    Sleep-cooling trough (02:00–07:00), midday lift, and 19:00 prime evening surge. 100% human-like.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setCircadianStrategy("viral")}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    circadianStrategy === "viral"
                      ? "bg-white border-[#3A4EFB] shadow-md ring-2 ring-[#3A4EFB]/15"
                      : "bg-white border-[#DEE0ED] hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                      <Flame className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      High Impact
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-[#252943]">
                    Viral Push Surge
                  </h4>
                  <p className="text-xs text-[#252943]/65 mt-1 leading-relaxed">
                    Front-loads 40% engagement in the first 90 minutes to break cold-start algorithmic test pools.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setCircadianStrategy("steady")}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    circadianStrategy === "steady"
                      ? "bg-white border-[#3A4EFB] shadow-md ring-2 ring-[#3A4EFB]/15"
                      : "bg-white border-[#DEE0ED] hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                      <Layers className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      Long-Tail
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-[#252943]">
                    Steady Monotonic Drip
                  </h4>
                  <p className="text-xs text-[#252943]/65 mt-1 leading-relaxed">
                    Uniform velocity with subtle Poisson noise across 24-72 hours for evergreen content and warmups.
                  </p>
                </button>
              </div>

              {/* Interactive Curve Visualizer Canvas */}
              <div className="bg-white rounded-3xl border border-[#DEE0ED] shadow-sm p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DEE0ED] pb-3">
                  <div>
                    <h3 className="text-sm font-black text-[#252943] flex items-center gap-2">
                      <span>Hourly Delivery Velocity Model (24-Hour Horizon)</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-[#3A4EFB] border border-blue-200">
                        {circadianStrategy.toUpperCase()}
                      </span>
                    </h3>
                    <p className="text-xs text-[#252943]/60">
                      Calculated using sinusoidal circadian modulation & multi-tier engagement gates.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="w-3 h-3 rounded bg-indigo-100 border border-indigo-300 inline-block" />
                      <span>Night Cooling (02:00-07:00)</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block" />
                      <span>Prime Surge (18:00-22:00)</span>
                    </span>
                  </div>
                </div>

                {/* SVG Curve Representation */}
                <div className="relative w-full aspect-[900/320] bg-slate-50/60 rounded-2xl border border-slate-200 overflow-hidden">
                  <svg
                    viewBox="0 0 900 320"
                    className="w-full h-full select-none"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="circadianGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3A4EFB" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#3A4EFB" stopOpacity="0.02" />
                      </linearGradient>
                      <linearGradient id="viralGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.02" />
                      </linearGradient>
                      <linearGradient id="steadyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>

                    {/* Shaded Night Cooling Zone (approx 02:00 to 07:00 -> x: 75 to 262) */}
                    <rect x="75" y="20" width="187" height="260" fill="#6366F1" fillOpacity="0.07" />
                    <text x="168" y="45" textAnchor="middle" fontSize="10" fill="#6366F1" fontWeight="700">
                      🌙 SLEEP COOLING ZONE
                    </text>

                    {/* Shaded Prime Evening Surge Zone (approx 18:00 to 22:00 -> x: 675 to 825) */}
                    <rect x="675" y="20" width="150" height="260" fill="#10B981" fillOpacity="0.08" />
                    <text x="750" y="45" textAnchor="middle" fontSize="10" fill="#059669" fontWeight="700">
                      🔥 PRIME EVENING SURGE
                    </text>

                    {/* Grid lines */}
                    <line x1="50" y1="280" x2="860" y2="280" stroke="#E2E8F0" strokeWidth="1" />
                    <line x1="50" y1="215" x2="860" y2="215" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="50" y1="150" x2="860" y2="150" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="50" y1="85" x2="860" y2="85" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />

                    {/* Time labels */}
                    <text x="50" y="300" fontSize="10" fill="#94A3B8" fontWeight="600">00:00</text>
                    <text x="168" y="300" fontSize="10" fill="#94A3B8" fontWeight="600">04:00</text>
                    <text x="318" y="300" fontSize="10" fill="#94A3B8" fontWeight="600">08:00</text>
                    <text x="468" y="300" fontSize="10" fill="#94A3B8" fontWeight="600">12:00</text>
                    <text x="618" y="300" fontSize="10" fill="#94A3B8" fontWeight="600">16:00</text>
                    <text x="768" y="300" fontSize="10" fill="#94A3B8" fontWeight="600">20:00</text>
                    <text x="860" y="300" fontSize="10" fill="#94A3B8" fontWeight="600">24:00</text>

                    {/* Dynamic Curves based on selected strategy */}
                    {circadianStrategy === "circadian" && (
                      <>
                        <path
                          d="M 50 220 C 100 250, 150 265, 220 260 C 290 255, 340 180, 420 160 C 500 140, 560 170, 640 130 C 720 90, 780 70, 810 75 C 835 80, 850 140, 860 190 L 860 280 L 50 280 Z"
                          fill="url(#circadianGrad)"
                        />
                        <path
                          d="M 50 220 C 100 250, 150 265, 220 260 C 290 255, 340 180, 420 160 C 500 140, 560 170, 640 130 C 720 90, 780 70, 810 75 C 835 80, 850 140, 860 190"
                          fill="none"
                          stroke="#3A4EFB"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                        />
                        {/* Peak node */}
                        <circle cx="780" cy="70" r="5" fill="#3A4EFB" stroke="#ffffff" strokeWidth="2" />
                        <text x="780" y="55" textAnchor="middle" fontSize="11" fill="#3A4EFB" fontWeight="800">
                          Peak 140 v/h
                        </text>
                        {/* Trough node */}
                        <circle cx="168" cy="265" r="5" fill="#6366F1" stroke="#ffffff" strokeWidth="2" />
                        <text x="168" y="250" textAnchor="middle" fontSize="11" fill="#6366F1" fontWeight="800">
                          Cooling 18 v/h
                        </text>
                      </>
                    )}

                    {circadianStrategy === "viral" && (
                      <>
                        <path
                          d="M 50 70 C 90 70, 140 110, 220 160 C 300 210, 420 215, 540 225 C 660 235, 780 245, 860 255 L 860 280 L 50 280 Z"
                          fill="url(#viralGrad)"
                        />
                        <path
                          d="M 50 70 C 90 70, 140 110, 220 160 C 300 210, 420 215, 540 225 C 660 235, 780 245, 860 255"
                          fill="none"
                          stroke="#F59E0B"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                        />
                        <circle cx="75" cy="70" r="5" fill="#F59E0B" stroke="#ffffff" strokeWidth="2" />
                        <text x="110" y="55" textAnchor="middle" fontSize="11" fill="#D97706" fontWeight="800">
                          Initial 40% Surge (Cold Start)
                        </text>
                        <circle cx="860" cy="255" r="4" fill="#F59E0B" stroke="#ffffff" strokeWidth="2" />
                      </>
                    )}

                    {circadianStrategy === "steady" && (
                      <>
                        <path
                          d="M 50 180 Q 150 175, 250 185 T 450 180 T 650 182 T 860 180 L 860 280 L 50 280 Z"
                          fill="url(#steadyGrad)"
                        />
                        <path
                          d="M 50 180 Q 150 175, 250 185 T 450 180 T 650 182 T 860 180"
                          fill="none"
                          stroke="#8B5CF6"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                        />
                        <circle cx="450" cy="180" r="5" fill="#8B5CF6" stroke="#ffffff" strokeWidth="2" />
                        <text x="450" y="160" textAnchor="middle" fontSize="11" fill="#7C3AED" fontWeight="800">
                          Continuous Constant Drip (Uniform)
                        </text>
                      </>
                    )}
                  </svg>
                </div>

                {/* Metrics Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Circadian Compliance
                    </span>
                    <div className="text-lg font-black text-emerald-600 mt-0.5">
                      99.8% Match
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Zero velocity threshold triggers
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Human Sleep Emulation
                    </span>
                    <div className="text-lg font-black text-[#252943] mt-0.5">
                      -75% Cooling
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Automated night volume dip
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Algorithm Safety Tier
                    </span>
                    <div className="text-lg font-black text-[#3A4EFB] mt-0.5">
                      Grade A+ (Safe)
                    </div>
                    <span className="text-[10px] text-slate-500">
                      TikTok FYP & Meta Explore compliant
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 3: Organic vs Bot Blast Safety Comparison ── */}
          {graphsActiveTab === "bot-comparison" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Traditional Bot Blast Card (RED) */}
                <div className="p-6 rounded-3xl bg-white border border-rose-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                        <XCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-rose-700">
                          Traditional Cheap SMM Panel
                        </h4>
                        <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">
                          Instant Bot Blast (High Ban Risk)
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                      94% Ban Risk
                    </span>
                  </div>

                  {/* Red Spike Chart */}
                  <div className="relative aspect-[450/220] bg-rose-50/40 rounded-2xl border border-rose-100 overflow-hidden p-3 flex flex-col justify-end">
                    <svg viewBox="0 0 450 180" className="w-full h-full select-none">
                      {/* Grid */}
                      <line x1="30" y1="160" x2="430" y2="160" stroke="#FECDD3" strokeWidth="1" />
                      <line x1="30" y1="90" x2="430" y2="90" stroke="#FECDD3" strokeWidth="1" strokeDasharray="3 3" />
                      {/* 90-degree instant cliff spike */}
                      <path
                        d="M 30 160 L 55 160 L 60 25 L 430 25 L 430 160 Z"
                        fill="rgba(244, 63, 94, 0.12)"
                      />
                      <path
                        d="M 30 160 L 55 160 L 60 25 L 430 25"
                        fill="none"
                        stroke="#E11D48"
                        strokeWidth="3.5"
                      />
                      {/* Anomaly Flag */}
                      <circle cx="60" cy="25" r="5" fill="#E11D48" stroke="#ffffff" strokeWidth="2" />
                      <rect x="70" y="15" width="130" height="22" rx="4" fill="#BE123C" />
                      <text x="135" y="30" textAnchor="middle" fontSize="10" fill="#ffffff" fontWeight="bold">
                        ⚠️ ANOMALY DETECTED
                      </text>
                    </svg>
                  </div>

                  {/* Flaw Points */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2 text-rose-800">
                      <X className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Instant unnatural spike:</strong> 10,000 views injected in under 120 seconds triggers TikTok/Meta velocity tripwires.
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-rose-800">
                      <X className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Zero engagement ratio:</strong> 0 likes, 0 saves, 0 shares. Proves botting to algorithm moderators.
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-rose-800">
                      <X className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Severe shadowban:</strong> Content reach clamped to 0 on subsequent organic uploads.
                      </span>
                    </div>
                  </div>
                </div>

                {/* AuraSMM Multi-Wave Card (GREEN) */}
                <div className="p-6 rounded-3xl bg-white border border-emerald-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-emerald-800">
                          AuraSMM Algorithmic Engine
                        </h4>
                        <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                          Multi-Wave Synchronized Pacing
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      100% Safe (FYP Boost)
                    </span>
                  </div>

                  {/* Green S-Curve Chart */}
                  <div className="relative aspect-[450/220] bg-emerald-50/40 rounded-2xl border border-emerald-100 overflow-hidden p-3 flex flex-col justify-end">
                    <svg viewBox="0 0 450 180" className="w-full h-full select-none">
                      {/* Grid */}
                      <line x1="30" y1="160" x2="430" y2="160" stroke="#A7F3D0" strokeWidth="1" />
                      <line x1="30" y1="90" x2="430" y2="90" stroke="#A7F3D0" strokeWidth="1" strokeDasharray="3 3" />
                      {/* Smooth Organic Multi-Wave S-Curve */}
                      <path
                        d="M 30 160 C 90 155, 140 140, 190 115 C 240 90, 290 85, 340 50 C 380 30, 410 25, 430 25 L 430 160 Z"
                        fill="rgba(16, 185, 129, 0.15)"
                      />
                      <path
                        d="M 30 160 C 90 155, 140 140, 190 115 C 240 90, 290 85, 340 50 C 380 30, 410 25, 430 25"
                        fill="none"
                        stroke="#059669"
                        strokeWidth="3.5"
                      />
                      {/* Synchronized likes curve */}
                      <path
                        d="M 60 160 C 120 158, 170 148, 220 135 C 270 120, 320 110, 360 90 C 400 80, 420 75, 430 75"
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                      />
                      {/* Algorithm FYP Unlock Tag */}
                      <circle cx="340" cy="50" r="5" fill="#059669" stroke="#ffffff" strokeWidth="2" />
                      <rect x="235" y="38" width="135" height="22" rx="4" fill="#047857" />
                      <text x="302" y="53" textAnchor="middle" fontSize="10" fill="#ffffff" fontWeight="bold">
                        ✨ FYP EXPLORE UNLOCKED
                      </text>
                    </svg>
                  </div>

                  {/* Advantage Points */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2 text-emerald-900">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Natural wave progression:</strong> Micro-batches delivered over 6-72 hours matching organic audience watch-time dynamics.
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-emerald-900">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Synchronized auxiliary signals:</strong> Likes (3-6%), saves (0.8%), and shares staggered naturally behind view waves.
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-emerald-900">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Cold-start pool breaker:</strong> Signals high retention to the recommendation engine, driving genuine organic viral spillover.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── How to Grow in 3 Steps Section (from reference) ── */}
        <section id="how-it-works" className="mt-24 pt-10 border-t border-[#DEE0ED] text-center space-y-10">
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

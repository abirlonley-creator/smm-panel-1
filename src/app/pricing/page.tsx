"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Zap,
  Clock,
  Boxes,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Sliders,
  Tag,
  Layers,
  Activity,
  Check,
  Percent,
  Compass
} from "lucide-react";

// Platform Baseline Rates (Derived directly from verified provider catalog)
const PLATFORM_BASELINES = {
  Instagram: {
    viewsRate: 0.84, // ₹ per 1k
    likesRate: 1.10,
    savesRate: 1.45,
    sharesRate: 2.20,
    commentsRate: 8.00,
    unit: "Views",
    minQty: 100,
  },
  TikTok: {
    viewsRate: 0.18,
    likesRate: 0.95,
    savesRate: 1.25,
    sharesRate: 1.80,
    commentsRate: 9.00,
    unit: "Views",
    minQty: 200,
  },
  YouTube: {
    viewsRate: 0.31,
    likesRate: 2.80,
    savesRate: 3.50,
    sharesRate: 4.10,
    commentsRate: 18.00,
    unit: "Views",
    minQty: 100,
  },
  "Twitter / X": {
    viewsRate: 0.01,
    likesRate: 4.50,
    savesRate: 2.10,
    sharesRate: 5.20,
    commentsRate: 22.00,
    unit: "Impressions",
    minQty: 500,
  },
  Telegram: {
    viewsRate: 0.11,
    likesRate: 1.80,
    savesRate: 1.50,
    sharesRate: 3.00,
    commentsRate: 12.00,
    unit: "Post Views",
    minQty: 50,
  },
};

type PlatformKey = keyof typeof PLATFORM_BASELINES;

const VOLUME_PRESETS = [2500, 5000, 10000, 25000, 50000, 100000];

export default function PricingPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey>("Instagram");
  const [volume, setVolume] = useState<number>(10000);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const baseline = PLATFORM_BASELINES[selectedPlatform];

  // Calculated Plan Pricing for Selected Volume
  const pricing = useMemo(() => {
    const k = volume / 1000;
    
    // 1. Instant Single Execution
    const instantCost = Number((k * baseline.viewsRate).toFixed(2));
    
    // 2. Drip-Feed Scheduled Growth (Includes multi-step pacing engine)
    const dripCost = Number((k * baseline.viewsRate).toFixed(2));
    
    // 3. Full Engagement Organic Pacing (Views + 4.5% Likes + 1.2% Saves + 0.5% Shares + 0.2% Comments)
    const organicViews = k * baseline.viewsRate;
    const organicLikes = (k * 0.045) * baseline.likesRate;
    const organicSaves = (k * 0.012) * baseline.savesRate;
    const organicShares = (k * 0.005) * baseline.sharesRate;
    const organicComments = (k * 0.002) * baseline.commentsRate;
    const organicTotal = Number((organicViews + organicLikes + organicSaves + organicShares + organicComments).toFixed(2));

    // 4. Multi-Service Combo Package (Views + Likes + Custom Comments bundle)
    const comboCost = Number((organicViews + (k * 0.08) * baseline.likesRate + 0.01 * k * baseline.commentsRate).toFixed(2));

    return {
      instant: Math.max(0.1, instantCost),
      drip: Math.max(0.1, dripCost),
      organic: Math.max(0.1, organicTotal),
      combo: Math.max(0.1, comboCost),
      counts: {
        views: volume,
        likes: Math.round(volume * 0.045),
        saves: Math.round(volume * 0.012),
        shares: Math.round(volume * 0.005),
        comments: Math.max(1, Math.round(volume * 0.002)),
      }
    };
  }, [volume, baseline]);

  const plans = [
    {
      id: "instant",
      name: "Instant Single Execution",
      badge: "High Velocity",
      badgeColor: "bg-[#252943]/10 text-[#252943] border-[#252943]/20",
      description: "Direct queue insertion for instant social proof. Fast delivery with zero scheduling delay.",
      price: pricing.instant,
      priceSub: `for ${volume.toLocaleString()} ${baseline.unit}`,
      deliveryTime: "Immediate (< 60s queue)",
      algorithm: "Flat Rapid Delivery",
      isPopular: false,
      ctaText: "Launch Instant Order",
      ctaHref: "/order",
      features: [
        { title: "Direct Provider Execution", desc: "No interval pauses or multi-step waits", included: true },
        { title: "Raw Volume Injection", desc: "Delivers full quantity in fastest provider batch", included: true },
        { title: "Live Status Tracking", desc: "Real-time updates from provider API", included: true },
        { title: "Multi-Step Interval Pacing", desc: "Gradual scheduled delivery over hours", included: false },
        { title: "Non-Linear S-Curve Envelope", desc: "Algorithmic exploration pacing", included: false },
        { title: "Secondary Engagement Ratios", desc: "Coupled Likes, Saves & Comments", included: false },
      ],
    },
    {
      id: "drip",
      name: "Controlled Drip-Feed",
      badge: "Scheduled Growth",
      badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
      description: "Evenly spaced or Gaussian-weighted batches. Ideal for continuous momentum and daily reach.",
      price: pricing.drip,
      priceSub: `for ${volume.toLocaleString()} ${baseline.unit}`,
      deliveryTime: "Configurable (1h – 30 days)",
      algorithm: "Interval / Even Pacing",
      isPopular: false,
      ctaText: "Configure Schedule",
      ctaHref: "/planner",
      features: [
        { title: "Custom Step Division", desc: "Split into 5 to 100 scheduled batches", included: true },
        { title: "Automated Resiliency", desc: "Automatic retries on partial provider lag", included: true },
        { title: "Interactive Pacing Modes", desc: "Even, Front-Loaded, Back-Loaded, Peak Hours", included: true },
        { title: "Timeline Step Inspector", desc: "Exact schedule timestamps before ordering", included: true },
        { title: "Non-Linear S-Curve Envelope", desc: "Dynamic mathematical logistic curve", included: false },
        { title: "Monotonic Ratio Guardrails", desc: "Secondary engagement locked to view velocity", included: false },
      ],
    },
    {
      id: "organic",
      name: "Natural S-Curve Engagement",
      badge: "⭐ Recommended",
      badgeColor: "bg-[#E3FF3B]/20 text-[#252943] font-bold border-[#E3FF3B]",
      description: "Algorithmic multi-wave pacing designed to emulate authentic content discovery. Views precede secondary engagement in natural ratios.",
      price: pricing.organic,
      priceSub: `All-in bundle (${pricing.counts.views.toLocaleString()} views, ${pricing.counts.likes.toLocaleString()} likes, ${pricing.counts.saves.toLocaleString()} saves, ${pricing.counts.shares.toLocaleString()} shares)`,
      deliveryTime: "24h – 168h (Presets)",
      algorithm: "Non-Linear Logistic S-Curve",
      isPopular: true,
      ctaText: "Configure Full Engagement",
      ctaHref: "/engagement",
      features: [
        { title: "Deterministic S-Curve (k & m)", desc: "Steepness k in [5.5, 7.5], midpoint m envelope", included: true },
        { title: "Multi-Wave Archetypes", desc: "Classic, Double-Wave, Stall-and-Surge, Slow-Ramp", included: true },
        { title: "Monotonic Ratio Enforcer", desc: "Secondary engagement strictly lags views (Likes ≤ 4.5%)", included: true },
        { title: "Provider Minimum Merging", desc: "Sub-minimum batches merge forward automatically", included: true },
        { title: "Audience Timezone Peak Hours", desc: "+40% batch sizing during 12-14h and 19-23h", included: true },
        { title: "Seed Fingerprint Protection", desc: "Every order generated with a distinct pattern", included: true },
      ],
    },
    {
      id: "combo",
      name: "Cross-Platform Combo Bundles",
      badge: "Multi-Service",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      description: "Bundled multi-service campaigns across views, likes, and comments executed with a single click.",
      price: pricing.combo,
      priceSub: `for multi-service package`,
      deliveryTime: "Cascaded (Synchronized)",
      algorithm: "Coordinated Execution",
      isPopular: false,
      ctaText: "Build Combo Campaign",
      ctaHref: "/combos",
      features: [
        { title: "Multi-Service Single Checkout", desc: "Views + Likes + Comments in one execution", included: true },
        { title: "Custom URL Mapping", desc: "Apply services to same link or custom URLs", included: true },
        { title: "Reusable Combo Templates", desc: "Save campaigns and re-execute instantly", included: true },
        { title: "Detailed Execution Logs", desc: "Per-item provider IDs and order breakdown", included: true },
        { title: "Batch Minimum Enforcement", desc: "Validates provider limits per service", included: true },
        { title: "Automated Balance Check", desc: "Pre-execution balance reservation", included: true },
      ],
    },
  ];

  const faqs = [
    {
      q: "How does Natural S-Curve pacing differ from standard SMM delivery?",
      a: "Standard SMM panels inject engagement in flat, instant bursts that trigger algorithmic anomaly filters. Our Natural S-Curve engine paces delivery along a continuous mathematical logistic curve (k in [5.5, 7.5], midpoint m in [0.25, 0.35]), with secondary actions (Likes, Saves, Shares, Comments) delayed behind views. Engagement never leads views, emulating organic discovery waves.",
    },
    {
      q: "What is the Provider Minimum Rule, and how does it affect my order?",
      a: "Every upstream provider specifies a minimum order quantity (e.g. 10 or 50 units). If an algorithmic batch falls below that minimum, our engine automatically merges it with its nearest later neighbor rather than dropping quantity or failing. The final delivery delivers 100% of your requested count while ensuring zero batches are rejected.",
    },
    {
      q: "Are the prices shown on this page all-inclusive?",
      a: "Yes. All pricing is in Indian Rupees (INR) with zero hidden platform markups, monthly subscription fees, or account maintenance costs. You only pay for the exact volume you schedule.",
    },
    {
      q: "What happens if a scheduled batch or order gets stuck?",
      a: "Our background scheduler features built-in dead-man monitoring and automatic retry logic. If an upstream provider returns a temporary error, the batch is safely retried with exponential backoff. In the event of a permanent provider cancellation, your wallet balance is immediately refunded.",
    },
    {
      q: "Can I customize the delivery speed and audience time zone?",
      a: "Yes. On the Full Engagement and Growth Planner pages, you can select duration presets (Fast 24h, Normal 48h/72h, Slow 96h/168h) and set your audience's local time zone (e.g. Asia/Kolkata, America/New_York) to enable +40% peak-hour batch weighting during high-traffic hours.",
    },
  ];

  return (
    <div className="space-y-12 animate-fadeIn max-w-7xl mx-auto pb-16">
      {/* ── 1. Hero Header ───────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-[#252943] border border-[#323758]/80 px-6 py-12 sm:px-12 sm:py-16 text-center text-white shadow-xl">
        {/* Subtle grid texture & ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#E3FF3B 1px, transparent 1px), linear-gradient(90deg, #E3FF3B 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-15 blur-3xl"
          style={{ background: "radial-gradient(circle, #3A4EFB 0%, #E3FF3B 60%, transparent 80%)" }}
        />

        <div className="relative z-10 max-w-3xl mx-auto space-y-5">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E3FF3B]/30 bg-[#E3FF3B]/10 px-4 py-1.5 text-xs font-bold tracking-wide text-[#E3FF3B] uppercase">
            <Sparkles className="w-3.5 h-3.5 text-[#E3FF3B] animate-pulse" />
            <span>Transparent Pricing · Deterministic Delivery · Zero Hidden Fees</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Clear, Compare-Ready <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-[#E3FF3B]">
              Growth Delivery Plans
            </span>
          </h1>

          <p className="text-sm sm:text-base text-[#DEE0ED]/75 leading-relaxed max-w-2xl mx-auto">
            Compare delivery architectures side-by-side. From high-velocity instant injections to 
            natural-looking multi-wave S-curves with locked secondary engagement ratios.
          </p>

          {/* Quick Navigator Pill */}
          <div className="pt-2 flex items-center justify-center gap-3 text-xs text-[#DEE0ED]/60 flex-wrap">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#E3FF3B]" /> Verified Catalog Rates
            </span>
            <span className="text-[#DEE0ED]/30">•</span>
            <span className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-[#E3FF3B]" /> 100% Exact Planned Totals
            </span>
            <span className="text-[#DEE0ED]/30">•</span>
            <span className="flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-[#E3FF3B]" /> Monotonic Ratio Ceilings
            </span>
          </div>
        </div>
      </section>

      {/* ── 2. Interactive Platform & Volume Controls ────────────── */}
      <section className="bg-white rounded-3xl border border-[#DEE0ED] p-6 sm:p-8 shadow-subtle space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#DEE0ED]/70 pb-6">
          <div>
            <span className="text-[11px] font-bold text-[#3A4EFB] uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" /> Step 1: Select Platform & Volume
            </span>
            <h2 className="text-lg font-bold text-[#252943] mt-0.5">
              Customize Your Delivery Target
            </h2>
          </div>
          <p className="text-xs text-[#252943]/60 max-w-sm">
            Toggle platforms and view counts to compare instant, scheduled, and organic engagement costs in real time.
          </p>
        </div>

        {/* Platform Tabs */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#252943]/70 uppercase tracking-wide">
            Target Platform
          </label>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {(Object.keys(PLATFORM_BASELINES) as PlatformKey[]).map((platform) => {
              const active = selectedPlatform === platform;
              return (
                <button
                  key={platform}
                  type="button"
                  onClick={() => setSelectedPlatform(platform)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all press-scale whitespace-nowrap flex items-center gap-2 ${
                    active
                      ? "bg-[#3A4EFB] text-white shadow-md shadow-[#3A4EFB]/20"
                      : "bg-[#F8F9FD] border border-[#DEE0ED] text-[#252943]/70 hover:bg-[#DEE0ED]/50"
                  }`}
                >
                  <span>{platform}</span>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-[#E3FF3B]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Volume Preset Chips & Slider */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-[#252943]/70 uppercase tracking-wide">
              Volume Target ({baseline.unit})
            </label>
            <span className="text-sm font-bold text-[#3A4EFB] tabular-nums">
              {volume.toLocaleString()} {baseline.unit}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {VOLUME_PRESETS.map((preset) => {
              const active = volume === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setVolume(preset)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all press-scale ${
                    active
                      ? "bg-[#252943] text-white font-bold"
                      : "bg-[#F8F9FD] border border-[#DEE0ED] text-[#252943]/70 hover:bg-[#DEE0ED]/50"
                  }`}
                >
                  {preset >= 1000 ? `${preset / 1000}k` : preset}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 3. Plan Comparison Cards with Clear Hierarchy ───────── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 px-1">
          <div>
            <span className="text-[11px] font-bold text-[#3A4EFB] uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Step 2: Choose Your Plan
            </span>
            <h2 className="text-2xl font-extrabold text-[#252943] tracking-tight">
              Compare Delivery Architectures
            </h2>
          </div>
          <span className="text-xs text-[#252943]/60 font-medium">
            Pricing shown for <strong className="text-[#252943] font-bold">{volume.toLocaleString()} {selectedPlatform} {baseline.unit}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch pt-2">
          {plans.map((plan) => {
            const isRec = plan.isPopular;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-3xl p-6 transition-all duration-300 ${
                  isRec
                    ? "bg-[#252943] text-white border-2 border-[#3A4EFB] shadow-2xl scale-[1.02] ring-4 ring-[#3A4EFB]/15"
                    : "bg-white text-[#252943] border border-[#DEE0ED] shadow-subtle hover:border-[#3A4EFB]/40 hover:shadow-md"
                }`}
              >
                {/* Popular Pill */}
                {isRec && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#E3FF3B] text-[#252943] px-3.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#252943]" />
                    <span>Most Popular Choice</span>
                  </div>
                )}

                {/* Card Header */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                        isRec
                          ? "bg-white/10 text-[#E3FF3B] border-[#E3FF3B]/30"
                          : plan.badgeColor
                      }`}
                    >
                      {plan.badge}
                    </span>
                  </div>
                  <h3 className={`text-lg font-bold ${isRec ? "text-white" : "text-[#252943]"}`}>
                    {plan.name}
                  </h3>
                  <p className={`text-xs leading-relaxed min-h-[48px] ${isRec ? "text-[#DEE0ED]/75" : "text-[#252943]/60"}`}>
                    {plan.description}
                  </p>
                </div>

                {/* Price Display */}
                <div className={`p-4 rounded-2xl mb-5 ${isRec ? "bg-white/8 border border-white/10" : "bg-[#F8F9FD] border border-[#DEE0ED]"}`}>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-xs font-bold ${isRec ? "text-[#E3FF3B]" : "text-[#3A4EFB]"}`}>₹</span>
                    <span className={`text-3xl font-extrabold tracking-tight tabular-nums ${isRec ? "text-white" : "text-[#252943]"}`}>
                      {plan.price.toFixed(2)}
                    </span>
                  </div>
                  <p className={`text-[11px] mt-1 line-clamp-2 ${isRec ? "text-[#DEE0ED]/60" : "text-[#252943]/50"}`}>
                    {plan.priceSub}
                  </p>
                </div>

                {/* Plan Highlights */}
                <div className="space-y-2.5 mb-6 text-xs flex-1">
                  <div className="flex items-center justify-between py-1 border-b border-dashed border-gray-200/40">
                    <span className={isRec ? "text-[#DEE0ED]/60" : "text-[#252943]/60"}>Delivery Velocity</span>
                    <span className={`font-semibold ${isRec ? "text-white" : "text-[#252943]"}`}>{plan.deliveryTime}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-dashed border-gray-200/40">
                    <span className={isRec ? "text-[#DEE0ED]/60" : "text-[#252943]/60"}>Pacing Curve</span>
                    <span className={`font-semibold ${isRec ? "text-white" : "text-[#252943]"}`}>{plan.algorithm}</span>
                  </div>

                  <div className="pt-2 space-y-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider block ${isRec ? "text-[#E3FF3B]" : "text-[#3A4EFB]"}`}>
                      Included Features
                    </span>
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        {feat.included ? (
                          <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isRec ? "text-[#E3FF3B]" : "text-emerald-600"}`} />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-400 opacity-40" />
                        )}
                        <span className={`text-[11px] ${feat.included ? (isRec ? "text-[#DEE0ED]" : "text-[#252943]") : "text-gray-400 line-through opacity-60"}`}>
                          {feat.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Primary CTA */}
                <Link
                  href={plan.ctaHref}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold text-center transition-all press-scale flex items-center justify-center gap-2 shadow-sm ${
                    isRec
                      ? "bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white ring-2 ring-[#E3FF3B]/50"
                      : "bg-[#252943] hover:bg-[#1E2135] text-white"
                  }`}
                >
                  <span>{plan.ctaText}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#E3FF3B]" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 4. Deep Feature Matrix Table ─────────────────────────── */}
      <section className="bg-white rounded-3xl border border-[#DEE0ED] shadow-subtle overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-[#DEE0ED] bg-[#F8F9FD]">
          <h2 className="text-xl font-bold text-[#252943]">
            Full Architecture Comparison
          </h2>
          <p className="text-xs text-[#252943]/60 mt-1">
            Examine the exact algorithmic protections, retry handling, and pacing controls across every tier.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#DEE0ED] bg-white text-[#252943]/70 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-4 px-6 w-1/3">Capability / Guarantee</th>
                <th className="py-4 px-4 text-center">Instant</th>
                <th className="py-4 px-4 text-center">Drip-Feed</th>
                <th className="py-4 px-4 text-center bg-[#3A4EFB]/5 text-[#3A4EFB] font-bold">Natural S-Curve</th>
                <th className="py-4 px-4 text-center">Combo Bundles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DEE0ED]/60 text-[#252943]">
              {[
                { name: "Pacing Algorithm", a: "Flat Immediate", b: "Linear / Interval", c: "Non-Linear S-Curve (k in [5.5, 7.5])", d: "Cascaded Batch" },
                { name: "Secondary Ratio Enforcer (Likes/Saves)", a: "None (Manual)", b: "Independent", c: "Monotonic Ceiling (≤ Target %)", d: "Fixed Ratio" },
                { name: "Secondary Engagement Lag Offsets", a: "None", b: "Manual Wait", c: "Automated (5m – 4h lag waves)", d: "Sequential" },
                { name: "Provider Minimum Auto-Merging", a: "Strict Reject", b: "Strict Reject", c: "Automated Forward Merge", d: "Pre-validated" },
                { name: "Audience Timezone Peak Hours", a: "Ignored", b: "Optional", c: "Active (+40% batch sizing)", d: "Standard" },
                { name: "Exact Planned Total Delivery", a: "Exact", b: "Exact", c: "Exact (Zero Drop)", d: "Exact" },
                { name: "Custom Seed / Pattern Regeneration", a: "None", b: "Fixed Seed", c: "Deterministic Seed Fingerprint", d: "Order ID Based" },
                { name: "Auto-Refill & Drop Protection", a: "Catalog Dependent", b: "Auto-Checked", c: "Monitored Retention", d: "Per-Service Guarantee" },
                { name: "Single-Click Multi-Service Checkout", a: "No", b: "No", c: "Yes (Bundled)", d: "Yes (Full Combo)" },
              ].map((row, idx) => (
                <tr key={idx} className="hover:bg-[#F8F9FD]/60 transition-colors">
                  <td className="py-3.5 px-6 font-semibold text-[#252943]">
                    {row.name}
                  </td>
                  <td className="py-3.5 px-4 text-center text-[#252943]/70">{row.a}</td>
                  <td className="py-3.5 px-4 text-center text-[#252943]/70">{row.b}</td>
                  <td className="py-3.5 px-4 text-center font-bold text-[#3A4EFB] bg-[#3A4EFB]/5">
                    {row.c}
                  </td>
                  <td className="py-3.5 px-4 text-center text-[#252943]/70">{row.d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 5. Platform Baseline Summary ─────────────────────────── */}
      <section className="bg-white rounded-3xl border border-[#DEE0ED] p-6 sm:p-8 shadow-subtle space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DEE0ED]/70 pb-5">
          <div>
            <h2 className="text-xl font-bold text-[#252943]">
              Verified Platform Catalog Baselines
            </h2>
            <p className="text-xs text-[#252943]/60 mt-0.5">
              Live provider rates synced across 2,400+ services. Direct pass-through with no markup on base volumes.
            </p>
          </div>
          <Link
            href="/services"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs font-bold text-[#3A4EFB] hover:bg-[#DEE0ED]/50 transition-colors"
          >
            <span>Search 2,400+ Raw Services</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { name: "Instagram", views: "₹0.84", likes: "₹1.10", count: "309 Services", popular: true },
            { name: "TikTok", views: "₹0.18", likes: "₹0.95", count: "166 Services", popular: true },
            { name: "YouTube", views: "₹0.31", likes: "₹2.80", count: "324 Services", popular: false },
            { name: "Twitter / X", views: "₹0.01", likes: "₹4.50", count: "185 Services", popular: false },
            { name: "Telegram", views: "₹0.11", likes: "₹1.80", count: "726 Services", popular: false },
          ].map((item) => (
            <div
              key={item.name}
              className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-2 hover:border-[#3A4EFB]/40 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#252943]">{item.name}</span>
                {item.popular && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3A4EFB]" />
                )}
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-[#252943]/60">
                  <span>Views / 1k:</span>
                  <span className="font-bold text-[#3A4EFB]">{item.views}</span>
                </div>
                <div className="flex justify-between text-[#252943]/60">
                  <span>Likes / 1k:</span>
                  <span className="font-semibold text-[#252943]">{item.likes}</span>
                </div>
              </div>
              <p className="text-[10px] text-[#252943]/45 pt-1 border-t border-[#DEE0ED]/60 font-medium">
                {item.count}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 6. FAQ Accordion ─────────────────────────────────────── */}
      <section className="bg-white rounded-3xl border border-[#DEE0ED] p-6 sm:p-8 shadow-subtle space-y-6">
        <div>
          <span className="text-[11px] font-bold text-[#3A4EFB] uppercase tracking-wider flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" /> Frequently Asked Questions
          </span>
          <h2 className="text-xl font-bold text-[#252943] mt-0.5">
            Everything You Need to Know About Our Plans
          </h2>
        </div>

        <div className="divide-y divide-[#DEE0ED]/70">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className="py-4">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 text-left font-bold text-sm text-[#252943] hover:text-[#3A4EFB] transition-colors"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#3A4EFB] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#252943]/40 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <p className="mt-3 text-xs sm:text-sm text-[#252943]/70 leading-relaxed pr-6 animate-fadeIn">
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 7. Bottom Conversion Banner ──────────────────────────── */}
      <section className="rounded-3xl bg-gradient-to-r from-[#252943] to-[#3A4EFB] p-8 sm:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
        <div className="space-y-2 text-center md:text-left">
          <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Ready for Natural-Looking Engagement?
          </h3>
          <p className="text-sm text-[#DEE0ED]/80 max-w-xl">
            Launch a full organic growth pacing order with live interactive S-curve preview and automated provider minimum merging.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 flex-wrap justify-center">
          <Link
            href="/engagement"
            className="px-6 py-3.5 rounded-xl bg-[#E3FF3B] text-[#252943] text-sm font-bold transition-all hover:bg-white press-scale shadow-md flex items-center gap-2"
          >
            <TrendingUp className="w-4 h-4 text-[#252943]" />
            <span>Launch Full Engagement</span>
          </Link>
          <Link
            href="/services"
            className="px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold transition-all press-scale"
          >
            Browse Services
          </Link>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  TrendingUp, 
  Sparkles, 
  RefreshCw, 
  Eye, 
  Heart, 
  Share2, 
  Bookmark, 
  MessageSquare, 
  Clock, 
  Wallet, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Layers, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
  Sliders,
  Info,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Percent,
  Calendar,
  Compass
} from "lucide-react";
import Link from "next/link";
import {
  generateOrganicPlan,
  OrganicPlanResult,
  EngagementType,
  DurationPreset,
} from "@/lib/engagement/planner";
import {
  getPlatformProfile,
  ProfilePresetKey,
} from "@/lib/engagement/platform-profiles";

export default function FullEngagementPage() {
  const router = useRouter();

  // Platform & Profile State
  const [activePlatformTab, setActivePlatformTab] = useState<"Instagram" | "TikTok">("Instagram");
  const [profileId, setProfileId] = useState<string>("instagram_reel");
  const [presetKey, setPresetKey] = useState<ProfilePresetKey>("normal");
  const [baseViews, setBaseViews] = useState<number>(10000);
  const [targetUrl, setTargetUrl] = useState("");
  const [targetTz, setTargetTz] = useState("Asia/Kolkata");
  const [peakHourWeighting, setPeakHourWeighting] = useState<boolean>(true);
  const [seed, setSeed] = useState<string>(() => `dhansmm_${Date.now()}`);
  const [showExplainer, setShowExplainer] = useState(true);

  // Wallet and Plan State
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [plan, setPlan] = useState<OrganicPlanResult | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active view tab for analytics preview: "cumulative" | "ratio" | "timeline" | "runs"
  const [previewTab, setPreviewTab] = useState<"cumulative" | "ratio" | "timeline" | "runs">("cumulative");
  const [selectedRunType, setSelectedRunType] = useState<EngagementType>("views");

  // Synchronize profileId when switching platform tabs
  function handleSelectPlatform(platform: "Instagram" | "TikTok") {
    setActivePlatformTab(platform);
    if (platform === "Instagram") {
      setProfileId("instagram_reel");
    } else {
      setProfileId("tiktok");
    }
    setPresetKey("normal");
  }

  const currentProfile = useMemo(() => {
    return getPlatformProfile(profileId);
  }, [profileId]);

  // Load User Wallet Balance
  useEffect(() => {
    async function fetchWallet() {
      try {
        const res = await fetch("/api/wallet");
        const data = await res.json();
        if (data.success && data.wallet) {
          setWalletBalance(data.wallet.balance);
        }
      } catch {
        // Non-fatal
      }
    }
    fetchWallet();
  }, []);

  // Compute / Refresh Delivery Plan via Backend Preview Endpoint
  useEffect(() => {
    let isCancelled = false;

    async function updatePlan() {
      setLoadingPlan(true);
      setErrorMsg(null);
      try {
        const res = await fetch("/api/engagement/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileId,
            platform: activePlatformTab,
            presetKey,
            baseViews: Number(baseViews),
            seed,
            targetTz,
            peakHourWeighting,
          }),
        });
        const data = await res.json();
        if (!isCancelled) {
          if (data.success && data.plan) {
            setPlan(data.plan);
          } else {
            setErrorMsg(data.error || "Failed to calculate organic plan");
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          setErrorMsg(err.message || "Network error loading plan preview");
        }
      } finally {
        if (!isCancelled) {
          setLoadingPlan(false);
        }
      }
    }

    updatePlan();
    return () => {
      isCancelled = true;
    };
  }, [profileId, activePlatformTab, presetKey, baseViews, seed, targetTz, peakHourWeighting]);

  async function handleNewPattern() {
    setLoadingPlan(true);
    try {
      const res = await fetch("/api/engagement/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          platform: activePlatformTab,
          presetKey,
          baseViews: Number(baseViews),
          seed: `dhansmm_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
          targetTz,
          peakHourWeighting,
          previousFingerprint: plan?.params.fingerprint,
        }),
      });
      const data = await res.json();
      if (data.success && data.plan) {
        setPlan(data.plan);
        setSeed(String(data.plan.seed));
      }
    } catch {
      // Fallback
      setSeed(`dhansmm_${Date.now()}_${Math.floor(Math.random() * 100000)}`);
    } finally {
      setLoadingPlan(false);
    }
  }

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!targetUrl.trim()) {
      setErrorMsg("Please paste a valid video or post link.");
      return;
    }

    if (!plan) return;

    if (walletBalance !== null && walletBalance < plan.totalCost) {
      setErrorMsg(
        `Insufficient wallet balance (₹${walletBalance.toFixed(2)}). Total charge is ₹${plan.totalCost.toFixed(2)}. Please recharge your wallet.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/engagement/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl: targetUrl.trim(),
          profileId,
          platform: activePlatformTab,
          presetKey,
          baseViews: Number(baseViews),
          durationPreset: plan.durationPreset,
          durationHours: plan.durationHours,
          seed: plan.seed,
          targetTz,
          peakHourWeighting,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to schedule full engagement order");
      }

      router.push("/engagement/orders");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit order");
    } finally {
      setSubmitting(false);
    }
  }

  // SVG Paths for Cumulative Growth S-Curves
  const svgCurves = useMemo(() => {
    if (!plan || !plan.curvePoints || plan.curvePoints.length === 0) return null;

    const width = 640;
    const height = 240;
    const padding = 35;
    const points = plan.curvePoints;
    const totalMinutes = plan.durationHours * 60;

    const getX = (mins: number) => padding + (mins / totalMinutes) * (width - padding * 2);

    const makePath = (accessor: (pt: (typeof points)[0]) => number, maxVal: number) => {
      if (maxVal <= 0) return "";
      return points
        .map((pt, i) => {
          const x = getX(pt.minutes);
          const y = height - padding - (accessor(pt) / maxVal) * (height - padding * 2);
          return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(" ");
    };

    return {
      views: makePath((p) => p.views, plan.plans.views?.totalQuantity || baseViews),
      likes: makePath((p) => p.likes, plan.plans.likes?.totalQuantity || 1),
      shares: makePath((p) => p.shares, plan.plans.shares?.totalQuantity || 1),
      saves: makePath((p) => p.saves, plan.plans.saves?.totalQuantity || 1),
      comments: makePath((p) => p.comments, plan.plans.comments?.totalQuantity || 1),
    };
  }, [plan, baseViews]);

  // SVG Paths for Ratio-Over-Time Chart
  const svgRatioChart = useMemo(() => {
    if (!plan || !plan.ratioPoints || plan.ratioPoints.length === 0) return null;

    const width = 640;
    const height = 220;
    const padding = 40;
    const points = plan.ratioPoints;
    const totalMinutes = plan.durationHours * 60;

    // Maximum ratio ceiling (likes is highest, e.g. ~7%)
    const maxRatio = Math.max(
      8.0,
      plan.params.ratios.likes * 100 * 1.25,
      ...points.map((p) => p.likesRatioPct)
    );

    const getX = (mins: number) => padding + (mins / totalMinutes) * (width - padding * 2);
    const getY = (valPct: number) => height - padding - (Math.min(maxRatio, valPct) / maxRatio) * (height - padding * 2);

    const makeLine = (accessor: (pt: (typeof points)[0]) => number) => {
      return points
        .map((pt, i) => `${i === 0 ? "M" : "L"} ${getX(pt.minutes).toFixed(1)} ${getY(accessor(pt)).toFixed(1)}`)
        .join(" ");
    };

    return {
      maxRatio,
      getY,
      likesActual: makeLine((p) => p.likesRatioPct),
      savesActual: makeLine((p) => p.savesRatioPct),
      sharesActual: makeLine((p) => p.sharesRatioPct),
      commentsActual: makeLine((p) => p.commentsRatioPct),
      likesTargetY: getY(plan.params.ratios.likes * 100),
      savesTargetY: getY(plan.params.ratios.saves * 100),
      sharesTargetY: getY(plan.params.ratios.shares * 100),
      commentsTargetY: getY(plan.params.ratios.comments * 100),
    };
  }, [plan]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-20">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DEE0ED]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#252943] flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#3A4EFB]" />
            Full Engagement (Organic Pacing Engine)
          </h1>
          <p className="text-xs text-[#252943]/60 mt-0.5">
            Deliver Views, Likes, Shares, Saves, and Comments on a natural, non-linear S-curve with seeded deterministic pacing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/engagement/orders"
            className="px-3.5 py-2 rounded-xl border border-[#DEE0ED] text-xs font-semibold text-[#252943]/80 hover:bg-[#F8F9FD] flex items-center gap-1.5 transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-[#3A4EFB]" />
            <span>Engagement Orders</span>
          </Link>
          <Link
            href="/wallet"
            className="px-3.5 py-2 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs font-bold text-[#252943] flex items-center gap-1.5"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-600" />
            <span>₹{walletBalance !== null ? walletBalance.toFixed(2) : "..."}</span>
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-start justify-between gap-3 shadow-subtle">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold block">Validation Alert</span>
              <p>{errorMsg}</p>
            </div>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-600 font-bold hover:underline shrink-0 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Campaign Configuration Card */}
      <form onSubmit={handleSubmitOrder} className="space-y-6">
        <div className="bg-white rounded-2xl border border-[#DEE0ED] p-6 shadow-subtle space-y-6">
          {/* Platform Tab Navigation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#DEE0ED]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#3A4EFB] flex items-center gap-1.5">
                <Zap className="w-4 h-4" />
                1. Select Platform & Profile
              </span>
              <span className="text-xs text-[#252943]/60">Config-driven organic growth profiles</span>
            </div>

            {/* Primary Platform Tabs */}
            <div className="grid grid-cols-2 gap-3">
              {(["Instagram", "TikTok"] as const).map((plat) => (
                <button
                  key={plat}
                  type="button"
                  onClick={() => handleSelectPlatform(plat)}
                  className={`py-3 px-4 rounded-2xl text-xs font-bold transition-all flex items-center justify-between border ${
                    activePlatformTab === plat
                      ? "bg-[#252943] text-white border-[#252943] shadow-subtle"
                      : "bg-[#F8F9FD] border-[#DEE0ED] text-[#252943]/70 hover:bg-[#DEE0ED]/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{plat === "Instagram" ? "📸" : "🎵"}</span>
                    <span className="text-xs sm:text-sm">{plat} Full Engagement</span>
                  </div>
                  {activePlatformTab === plat && (
                    <span className="w-2 h-2 rounded-full bg-[#3A4EFB]" />
                  )}
                </button>
              ))}
            </div>

            {/* Instagram Sub-Type Profile Selector (Reels vs Post) */}
            {activePlatformTab === "Instagram" && (
              <div className="p-3 bg-[#F8F9FD] rounded-xl border border-[#DEE0ED] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#252943]/80">Instagram Content Format:</span>
                  <span className="text-[10px] text-[#252943]/50">Tailors initial steepness and multi-wave delays</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setProfileId("instagram_reel")}
                    className={`p-2.5 rounded-lg text-left transition-all text-xs font-semibold border ${
                      profileId === "instagram_reel"
                        ? "bg-white border-[#3A4EFB] text-[#252943] shadow-sm ring-1 ring-[#3A4EFB]"
                        : "bg-white/60 border-[#DEE0ED] text-[#252943]/60 hover:bg-white"
                    }`}
                  >
                    <span className="font-bold block text-[#252943]">🎬 Instagram Reel</span>
                    <span className="text-[10px] text-[#252943]/60">Multi-wave pacing (Normal: 72h)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProfileId("instagram_post")}
                    className={`p-2.5 rounded-lg text-left transition-all text-xs font-semibold border ${
                      profileId === "instagram_post"
                        ? "bg-white border-[#3A4EFB] text-[#252943] shadow-sm ring-1 ring-[#3A4EFB]"
                        : "bg-white/60 border-[#DEE0ED] text-[#252943]/60 hover:bg-white"
                    }`}
                  >
                    <span className="font-bold block text-[#252943]">🖼️ Photo / Carousel Post</span>
                    <span className="text-[10px] text-[#252943]/60">Front-loaded feed burst (Normal: 48h)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Collapsible Explainer Card */}
            {currentProfile.explainerText && (
              <div className="rounded-xl border border-[#DEE0ED] bg-blue-50/40 overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setShowExplainer(!showExplainer)}
                  className="w-full px-4 py-2.5 flex items-center justify-between font-bold text-[#252943] hover:bg-blue-50/70 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-[#3A4EFB]" />
                    <span>How {currentProfile.name} Pacing Works</span>
                  </div>
                  {showExplainer ? (
                    <ChevronUp className="w-3.5 h-3.5 text-[#252943]/50" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#252943]/50" />
                  )}
                </button>
                {showExplainer && (
                  <div className="px-4 pb-3 pt-1 text-[#252943]/80 leading-relaxed border-t border-[#DEE0ED]/60 font-medium">
                    {currentProfile.explainerText}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* URL & View Count */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-[#252943]">Post or Video URL</label>
              <input
                type="url"
                required
                placeholder={
                  activePlatformTab === "Instagram"
                    ? "https://www.instagram.com/reel/C_abc123/ or post link"
                    : "https://www.tiktok.com/@username/video/1234567890"
                }
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2.5 text-xs text-[#252943] focus:border-[#3A4EFB] focus:bg-white transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#252943]">Audience Timezone (Peak Hours)</label>
              <select
                value={targetTz}
                onChange={(e) => setTargetTz(e.target.value)}
                className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2.5 text-xs text-[#252943] focus:border-[#3A4EFB] focus:bg-white transition-colors"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
              </select>
            </div>
          </div>

          {/* Sliders, Presets, and Seed Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-[#DEE0ED]/60">
            {/* Base Views */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-[#252943]">Base Views</label>
                <span className="font-bold text-[#3A4EFB]">{Number(baseViews).toLocaleString()} views</span>
              </div>
              <input
                type="range"
                min="500"
                max="250000"
                step="500"
                value={baseViews}
                onChange={(e) => setBaseViews(Number(e.target.value))}
                className="w-full accent-[#3A4EFB]"
              />
              <div className="flex items-center gap-1.5 pt-1">
                {[1000, 5000, 10000, 50000, 100000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setBaseViews(v)}
                    className="flex-1 py-1 rounded bg-[#F8F9FD] border border-[#DEE0ED] text-[10px] font-semibold text-[#252943]/70 hover:border-[#3A4EFB]"
                  >
                    {v >= 1000 ? `${v / 1000}k` : v}
                  </button>
                ))}
              </div>
            </div>

            {/* Presets (Fast / Normal / Slow) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-[#252943]">Pacing Duration Preset</label>
                <span className="font-bold text-[#252943]">
                  {currentProfile.presets[presetKey]?.hours} Hours
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {(["fast", "normal", "slow"] as const).map((pk) => {
                  const pOption = currentProfile.presets[pk];
                  if (!pOption) return null;
                  return (
                    <button
                      key={pk}
                      type="button"
                      onClick={() => setPresetKey(pk)}
                      className={`py-2 px-2 rounded-xl text-center transition-all ${
                        presetKey === pk
                          ? "bg-[#3A4EFB] text-white shadow-subtle"
                          : "bg-[#F8F9FD] border border-[#DEE0ED] text-[#252943]/70 hover:bg-[#DEE0ED]/50"
                      }`}
                    >
                      <span className="text-[11px] font-bold block capitalize">{pk}</span>
                      <span className="text-[9px] opacity-80">{pOption.hours}h</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pattern Uniqueness & Peak Hours */}
            <div className="space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-[#252943]">Pattern Reproducibility</label>
                <button
                  type="button"
                  onClick={handleNewPattern}
                  disabled={loadingPlan}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3A4EFB] hover:underline"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingPlan ? "animate-spin" : ""}`} />
                  <span>New Pattern</span>
                </button>
              </div>

              <div className="p-2 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-[11px] font-mono text-[#252943]/70 truncate flex items-center justify-between">
                <span>Seed: {seed.slice(0, 16)}...</span>
                <span className="text-[9px] font-sans font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Deterministic</span>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#252943]">
                <input
                  type="checkbox"
                  checked={peakHourWeighting}
                  onChange={(e) => setPeakHourWeighting(e.target.checked)}
                  className="rounded text-[#3A4EFB]"
                />
                <span>Peak-Hour Circadian Weighting (+40%)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Target Ratio Table & Provider Min Bounds */}
        {plan && (
          <div className="bg-white rounded-2xl border border-[#DEE0ED] p-5 shadow-subtle space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#DEE0ED]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#252943] flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-[#3A4EFB]" />
                2. Target Ratios & Provider Minimum Rules
              </span>
              <span className="text-xs text-[#252943]/60">
                Guaranteed: No batch below provider service min (sub-min runs merged)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[#DEE0ED] text-[#252943]/60 font-semibold">
                    <th className="py-2 px-3">Engagement Type</th>
                    <th className="py-2 px-3">Target Ratio %</th>
                    <th className="py-2 px-3">Total Quantity</th>
                    <th className="py-2 px-3">Planned Runs</th>
                    <th className="py-2 px-3">Provider Min / Run</th>
                    <th className="py-2 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DEE0ED]/60 font-medium">
                  {(["views", "likes", "shares", "saves", "comments"] as const).map((t) => {
                    const pl = plan.plans[t];
                    const srv = currentProfile.serviceMappings[t];
                    const ratioPct = t === "views" ? "100%" : `${(plan.params.ratios[t] * 100).toFixed(2)}%`;

                    return (
                      <tr key={t} className="hover:bg-[#F8F9FD]">
                        <td className="py-2.5 px-3 font-bold text-[#252943] capitalize flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${t === "views" ? "bg-blue-600" : t === "likes" ? "bg-rose-600" : t === "saves" ? "bg-amber-600" : t === "shares" ? "bg-indigo-600" : "bg-emerald-600"}`} />
                          {t}
                        </td>
                        <td className="py-2.5 px-3 text-[#3A4EFB] font-bold">{ratioPct}</td>
                        <td className="py-2.5 px-3 font-bold text-[#252943]">{pl?.totalQuantity.toLocaleString()}</td>
                        <td className="py-2.5 px-3">{pl?.runsCount} runs</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                            Min {srv.minQuantity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#252943]">
                          ₹{pl?.totalCost.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Live Organic Growth & Analytics UI Section */}
        {plan && (
          <div className="bg-white rounded-2xl border border-[#DEE0ED] p-6 shadow-subtle space-y-4">
            {/* Header & View Mode Switcher */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#DEE0ED]">
              <div>
                <h3 className="text-sm font-bold text-[#252943] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#3A4EFB]" />
                  Live Organic Growth Analytics (Preview == Real Delivery)
                </h3>
                <p className="text-xs text-[#252943]/60">
                  Profile: <span className="font-semibold text-[#252943]">{plan.profileName}</span> • Archetype: <span className="font-bold text-[#3A4EFB]">{plan.summaryChips.archetype}</span>
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPreviewTab("cumulative")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    previewTab === "cumulative"
                      ? "bg-[#252943] text-white shadow-subtle"
                      : "bg-[#F8F9FD] text-[#252943]/70 hover:bg-[#DEE0ED]/50"
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Cumulative S-Curve</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTab("ratio")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    previewTab === "ratio"
                      ? "bg-[#252943] text-white shadow-subtle"
                      : "bg-[#F8F9FD] text-[#252943]/70 hover:bg-[#DEE0ED]/50"
                  }`}
                >
                  <Percent className="w-3.5 h-3.5" />
                  <span>Ratio-Over-Time</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTab("timeline")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    previewTab === "timeline"
                      ? "bg-[#252943] text-white shadow-subtle"
                      : "bg-[#F8F9FD] text-[#252943]/70 hover:bg-[#DEE0ED]/50"
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Batch Timeline</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTab("runs")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    previewTab === "runs"
                      ? "bg-[#252943] text-white shadow-subtle"
                      : "bg-[#F8F9FD] text-[#252943]/70 hover:bg-[#DEE0ED]/50"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Runs Inspector</span>
                </button>

                <button
                  type="button"
                  onClick={handleNewPattern}
                  className="px-3 py-1.5 rounded-lg bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-xs font-bold transition-all flex items-center gap-1 shadow-subtle ml-1"
                >
                  <RefreshCw className="w-3 h-3 text-[#E3FF3B]" />
                  <span>New Pattern</span>
                </button>
              </div>
            </div>

            {/* Summary Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
              <div className="p-2.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-center">
                <span className="text-[10px] text-[#252943]/60 block font-semibold">Total Views</span>
                <span className="text-sm font-black text-[#252943]">{plan.summaryChips.totalViews.toLocaleString()}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-center">
                <span className="text-[10px] text-[#252943]/60 block font-semibold">Scheduled Batches</span>
                <span className="text-sm font-black text-[#3A4EFB]">{plan.summaryChips.totalRuns} runs</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-center">
                <span className="text-[10px] text-[#252943]/60 block font-semibold">Duration</span>
                <span className="text-sm font-black text-[#252943]">{plan.summaryChips.durationHours}h ({plan.durationPreset})</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-center">
                <span className="text-[10px] text-[#252943]/60 block font-semibold">Pacing Archetype</span>
                <span className="text-sm font-black text-indigo-600">{plan.summaryChips.archetype}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-center">
                <span className="text-[10px] text-[#252943]/60 block font-semibold">Circadian Peaks</span>
                <span className="text-sm font-black text-amber-600">12-14h & 19-23h</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-center">
                <span className="text-[10px] text-[#252943]/60 block font-semibold">Total Cost</span>
                <span className="text-sm font-black text-emerald-600">₹{plan.totalCost.toFixed(2)}</span>
              </div>
            </div>

            {/* TAB 1: Cumulative Growth S-Curve Chart */}
            {previewTab === "cumulative" && svgCurves && (
              <div className="space-y-3 pt-2">
                <div className="w-full bg-[#F8F9FD] rounded-xl border border-[#DEE0ED] p-4 overflow-hidden relative">
                  <svg viewBox="0 0 640 240" className="w-full h-56 stroke-linecap-round stroke-linejoin-round">
                    <line x1="35" y1="35" x2="605" y2="35" stroke="#DEE0ED" strokeDasharray="3 3" />
                    <line x1="35" y1="102" x2="605" y2="102" stroke="#DEE0ED" strokeDasharray="3 3" />
                    <line x1="35" y1="170" x2="605" y2="170" stroke="#DEE0ED" strokeDasharray="3 3" />
                    <line x1="35" y1="205" x2="605" y2="205" stroke="#252943" strokeOpacity="0.3" />

                    <path d={svgCurves.views} fill="none" stroke="#2563EB" strokeWidth="3" />
                    <path d={svgCurves.likes} fill="none" stroke="#E11D48" strokeWidth="2.5" />
                    <path d={svgCurves.shares} fill="none" stroke="#4F46E5" strokeWidth="2" strokeDasharray="4 2" />
                    <path d={svgCurves.saves} fill="none" stroke="#D97706" strokeWidth="2" strokeDasharray="3 3" />
                    <path d={svgCurves.comments} fill="none" stroke="#059669" strokeWidth="2" />
                  </svg>

                  <div className="flex items-center justify-between text-[11px] text-[#252943]/60 px-4 pt-1 font-semibold">
                    <span>Start (t=0h)</span>
                    <span>Midpoint (+{Math.round(plan.durationHours / 2)}h)</span>
                    <span>Completion (+{plan.durationHours}h)</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-4 text-xs font-semibold flex-wrap pt-1">
                  <span className="flex items-center gap-1.5 text-blue-600">
                    <span className="w-3 h-1 bg-blue-600 rounded" /> Views (S-Curve)
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-600">
                    <span className="w-3 h-1 bg-rose-600 rounded" /> Likes ({plan.plans.likes?.totalQuantity.toLocaleString()})
                  </span>
                  <span className="flex items-center gap-1.5 text-indigo-600">
                    <span className="w-3 h-1 bg-indigo-600 rounded border-dashed" /> Shares ({plan.plans.shares?.totalQuantity.toLocaleString()})
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <span className="w-3 h-1 bg-amber-600 rounded" /> Saves ({plan.plans.saves?.totalQuantity.toLocaleString()})
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <span className="w-3 h-1 bg-emerald-600 rounded" /> Comments ({plan.plans.comments?.totalQuantity.toLocaleString()})
                  </span>
                </div>
              </div>
            )}

            {/* TAB 2: Ratio-Over-Time Chart */}
            {previewTab === "ratio" && svgRatioChart && (
              <div className="space-y-3 pt-2">
                <div className="w-full bg-[#F8F9FD] rounded-xl border border-[#DEE0ED] p-4 overflow-hidden relative">
                  <svg viewBox="0 0 640 220" className="w-full h-56 stroke-linecap-round stroke-linejoin-round">
                    {/* Background grid */}
                    <line x1="40" y1="30" x2="600" y2="30" stroke="#DEE0ED" strokeDasharray="3 3" />
                    <line x1="40" y1="100" x2="600" y2="100" stroke="#DEE0ED" strokeDasharray="3 3" />
                    <line x1="40" y1="180" x2="600" y2="180" stroke="#252943" strokeOpacity="0.3" />

                    {/* Target Ratio Dashed Ceilings (Hard Rule Bounds) */}
                    <line x1="40" y1={svgRatioChart.likesTargetY} x2="600" y2={svgRatioChart.likesTargetY} stroke="#E11D48" strokeDasharray="4 4" strokeWidth="1.5" strokeOpacity="0.8" />
                    <line x1="40" y1={svgRatioChart.savesTargetY} x2="600" y2={svgRatioChart.savesTargetY} stroke="#D97706" strokeDasharray="4 4" strokeWidth="1.5" strokeOpacity="0.8" />

                    {/* Actual Cumulative Ratio Curves */}
                    <path d={svgRatioChart.likesActual} fill="none" stroke="#E11D48" strokeWidth="2.5" />
                    <path d={svgRatioChart.savesActual} fill="none" stroke="#D97706" strokeWidth="2" />
                    <path d={svgRatioChart.sharesActual} fill="none" stroke="#4F46E5" strokeWidth="1.5" />
                    <path d={svgRatioChart.commentsActual} fill="none" stroke="#059669" strokeWidth="1.5" />
                  </svg>

                  <div className="flex items-center justify-between text-[11px] text-[#252943]/60 px-4 pt-1 font-semibold">
                    <span>Start (0% views)</span>
                    <span>Observed delivery % approaches ceiling asymptotically</span>
                    <span>100% Target Delivered</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-4 text-xs font-semibold flex-wrap pt-1">
                  <span className="flex items-center gap-1.5 text-rose-600">
                    <span className="w-3 h-1 bg-rose-600 rounded" /> Likes/Views Ratio (Solid) vs Target {(plan.params.ratios.likes * 100).toFixed(1)}% (Dashed)
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <span className="w-3 h-1 bg-amber-600 rounded" /> Saves/Views Ratio (Target {(plan.params.ratios.saves * 100).toFixed(1)}%)
                  </span>
                  <span className="flex items-center gap-1.5 text-indigo-600">
                    <span className="w-3 h-1 bg-indigo-600 rounded" /> Shares/Views
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <span className="w-3 h-1 bg-emerald-600 rounded" /> Comments/Views
                  </span>
                </div>
              </div>
            )}

            {/* TAB 3: Batch Timeline (Bars per run & Peak Hour Bands) */}
            {previewTab === "timeline" && (
              <div className="space-y-3 pt-2">
                <div className="w-full bg-[#F8F9FD] rounded-xl border border-[#DEE0ED] p-4 overflow-x-auto">
                  <div className="min-w-[600px] h-52 flex items-end gap-1 px-2 border-b border-[#252943]/20 relative">
                    {/* Visual Shaded Peak Hour Bands Info */}
                    <div className="absolute top-2 left-2 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      ★ Highlighted bars = Circadian Peak Hours (12-14h & 19-23h in {targetTz})
                    </div>

                    {plan.batchTimeline.slice(0, 75).map((entry, idx) => {
                      const maxBatch = Math.max(...plan.batchTimeline.map((b) => b.quantity));
                      const heightPct = Math.max(8, Math.round((entry.quantity / maxBatch) * 85));

                      let barBg = "bg-blue-500";
                      if (entry.type === "likes") barBg = "bg-rose-500";
                      else if (entry.type === "saves") barBg = "bg-amber-500";
                      else if (entry.type === "shares") barBg = "bg-indigo-500";
                      else if (entry.type === "comments") barBg = "bg-emerald-500";

                      return (
                        <div
                          key={idx}
                          title={`${entry.type} run #${entry.runIndex}: ${entry.quantity.toLocaleString()} units @ +${Math.round(entry.minutes / 60)}h ${entry.isPeak ? "(Peak Hour +40%)" : ""}`}
                          className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                        >
                          {entry.isPeak && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mb-0.5" />
                          )}
                          <div
                            style={{ height: `${heightPct}%` }}
                            className={`w-full rounded-t transition-all group-hover:brightness-125 ${barBg} ${
                              entry.isPeak ? "ring-1 ring-amber-400" : ""
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#252943]/60 px-2 pt-2 font-semibold">
                    <span>Batch #1 (Start)</span>
                    <span>Distribution density tracks S-curve derivative with circadian bursts</span>
                    <span>Final Batch (+{plan.durationHours}h)</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Runs Inspector Table */}
            {previewTab === "runs" && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {(["views", "likes", "shares", "saves", "comments"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedRunType(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                        selectedRunType === t
                          ? "bg-[#3A4EFB] text-white"
                          : "bg-[#F8F9FD] text-[#252943]/70 hover:bg-[#DEE0ED]"
                      }`}
                    >
                      {t} ({plan.plans[t]?.runsCount} runs)
                    </button>
                  ))}
                </div>

                <div className="max-h-64 overflow-y-auto rounded-xl border border-[#DEE0ED]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#F8F9FD] sticky top-0 border-b border-[#DEE0ED] text-[#252943]/60 font-semibold">
                      <tr>
                        <th className="py-2 px-3">Run #</th>
                        <th className="py-2 px-3">Scheduled Time</th>
                        <th className="py-2 px-3">Offset</th>
                        <th className="py-2 px-3">Batch Size</th>
                        <th className="py-2 px-3">Cumulative</th>
                        <th className="py-2 px-3">Weight Window</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DEE0ED]/60 font-medium">
                      {plan.plans[selectedRunType]?.runs.map((r) => {
                        const d = new Date(r.scheduledAt);
                        const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                        return (
                          <tr key={r.runIndex} className="hover:bg-[#F8F9FD]">
                            <td className="py-2 px-3 font-bold text-[#252943]">#{r.runIndex}</td>
                            <td className="py-2 px-3">{timeStr}</td>
                            <td className="py-2 px-3 text-[#252943]/70">+{Math.floor(r.minutesFromStart / 60)}h {r.minutesFromStart % 60}m</td>
                            <td className="py-2 px-3 font-bold text-[#252943]">{r.quantity.toLocaleString()}</td>
                            <td className="py-2 px-3 text-[#3A4EFB]">{r.cumulativeQuantity.toLocaleString()}</td>
                            <td className="py-2 px-3">
                              {r.isPeak ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                                  Peak Hour (+40%)
                                </span>
                              ) : (
                                <span className="text-[#252943]/40 text-[10px]">Standard</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Order Submission Bar */}
        {plan && (
          <div className="bg-[#252943] text-white rounded-2xl p-6 shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold text-[#E3FF3B] tracking-wider">Package Price:</span>
                <span className="text-2xl font-black">₹{plan.totalCost.toFixed(2)}</span>
              </div>
              <p className="text-xs text-white/70 mt-0.5">
                All 5 engagement metrics queued across {plan.durationHours} hours. Wallet balance: ₹{walletBalance !== null ? walletBalance.toFixed(2) : "..."}
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-xs font-bold transition-all press-scale flex items-center justify-center gap-2 shadow-subtle disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#E3FF3B]" />
                  <span>Submitting Campaign...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#E3FF3B]" />
                  <span>Confirm & Schedule {currentProfile.name} Order</span>
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

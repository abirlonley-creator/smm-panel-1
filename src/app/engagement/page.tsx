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
  Sliders
} from "lucide-react";
import Link from "next/link";
import { generateOrganicPlan, OrganicPlanResult, EngagementType } from "@/lib/engagement/planner";

export default function FullEngagementPage() {
  const router = useRouter();

  // Form State
  const [targetUrl, setTargetUrl] = useState("");
  const [platform, setPlatform] = useState<"Instagram" | "TikTok">("Instagram");
  const [baseViews, setBaseViews] = useState<number>(10000);
  const [durationHours, setDurationHours] = useState<number>(24);
  const [peakHourWeighting, setPeakHourWeighting] = useState<boolean>(true);
  const [seed, setSeed] = useState<string>(() => `dhansmm_${Date.now()}`);

  // Wallet and Plan State
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [plan, setPlan] = useState<OrganicPlanResult | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active view tab for preview: "chart" | "runs"
  const [previewTab, setPreviewTab] = useState<"chart" | "runs">("chart");
  const [selectedRunType, setSelectedRunType] = useState<EngagementType>("views");

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

  // Compute / Refresh Delivery Plan (uses shared logic client-side or backend preview endpoint)
  useEffect(() => {
    async function updatePlan() {
      setLoadingPlan(true);
      try {
        const res = await fetch("/api/engagement/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform,
            baseViews: Number(baseViews),
            durationHours: Number(durationHours),
            seed,
            peakHourWeighting,
          }),
        });
        const data = await res.json();
        if (data.success && data.plan) {
          setPlan(data.plan);
        } else {
          // Fallback to direct client-side shared generator
          const localPlan = generateOrganicPlan({
            platform,
            baseViews: Number(baseViews),
            durationHours: Number(durationHours),
            seed,
            peakHourWeighting,
          });
          setPlan(localPlan);
        }
      } catch {
        const localPlan = generateOrganicPlan({
          platform,
          baseViews: Number(baseViews),
          durationHours: Number(durationHours),
          seed,
          peakHourWeighting,
        });
        setPlan(localPlan);
      } finally {
        setLoadingPlan(false);
      }
    }

    updatePlan();
  }, [platform, baseViews, durationHours, seed, peakHourWeighting]);

  function handleRegenerateSeed() {
    setSeed(`dhansmm_${Date.now()}_${Math.floor(Math.random() * 100000)}`);
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
        `Insufficient wallet balance (₹${walletBalance.toFixed(2)}). Total charge is ₹${plan.totalCost.toFixed(2)}. Please add funds in your Wallet.`
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
          platform,
          baseViews: Number(baseViews),
          durationHours: Number(durationHours),
          seed: plan.seed,
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

  // Generate SVG path points for the growth chart
  const svgCurves = useMemo(() => {
    if (!plan || !plan.curvePoints || plan.curvePoints.length === 0) return null;

    const width = 640;
    const height = 240;
    const padding = 35;
    const points = plan.curvePoints;
    const totalMinutes = plan.durationHours * 60;

    // Scale helpers
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
      views: makePath((p) => p.views, plan.plans.views.totalQuantity),
      likes: makePath((p) => p.likes, plan.plans.likes.totalQuantity),
      shares: makePath((p) => p.shares, plan.plans.shares.totalQuantity),
      saves: makePath((p) => p.saves, plan.plans.saves.totalQuantity),
      comments: makePath((p) => p.comments, plan.plans.comments.totalQuantity),
    };
  }, [plan]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DEE0ED]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#252943] flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#3A4EFB]" />
            Full Engagement (Organic S-Curve Delivery)
          </h1>
          <p className="text-xs text-[#252943]/60 mt-0.5">
            Deliver Views, Likes, Shares, Saves, and Comments on a natural, non-linear S-curve with seeded random pacing.
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
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-600 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Order Configuration Form */}
      <form onSubmit={handleSubmitOrder} className="space-y-6">
        <div className="bg-white rounded-2xl border border-[#DEE0ED] p-6 shadow-subtle space-y-5">
          <div className="pb-3 border-b border-[#DEE0ED] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#3A4EFB] flex items-center gap-1.5">
              <Zap className="w-4 h-4" />
              1. Campaign Target & Platform
            </span>
            <span className="text-xs text-[#252943]/60">One link delivers all 5 engagement metrics</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Platform Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#252943]">Platform</label>
              <div className="grid grid-cols-2 gap-2">
                {(["Instagram", "TikTok"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all press-scale flex items-center justify-center gap-2 ${
                      platform === p
                        ? "bg-[#252943] text-white shadow-subtle"
                        : "bg-[#F8F9FD] border border-[#DEE0ED] text-[#252943]/70 hover:bg-[#DEE0ED]/50"
                    }`}
                  >
                    <span>{p}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Target URL */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-[#252943]">Post or Video URL</label>
              <input
                type="url"
                required
                placeholder={
                  platform === "Instagram"
                    ? "https://www.instagram.com/p/C_abc123/ or reels link"
                    : "https://www.tiktok.com/@username/video/1234567890"
                }
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2 text-xs text-[#252943] focus:border-[#3A4EFB] focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Base Views & Duration Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-[#DEE0ED]/60">
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
                    className="flex-1 py-0.5 rounded bg-[#F8F9FD] border border-[#DEE0ED] text-[10px] font-semibold text-[#252943]/70 hover:border-[#3A4EFB]"
                  >
                    {v >= 1000 ? `${v / 1000}k` : v}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-[#252943]">Estimated Duration</label>
                <span className="font-bold text-[#252943]">{durationHours} Hours</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[12, 24, 48, 72].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setDurationHours(h)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      durationHours === h
                        ? "bg-[#3A4EFB] text-white shadow-subtle"
                        : "bg-[#F8F9FD] border border-[#DEE0ED] text-[#252943]/70 hover:bg-[#DEE0ED]/50"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-[#252943]">Pattern Reproducibility</label>
                <button
                  type="button"
                  onClick={handleRegenerateSeed}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3A4EFB] hover:underline"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>New Pattern</span>
                </button>
              </div>
              <div className="p-2 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-[11px] font-mono text-[#252943]/70 truncate">
                Seed: {seed.slice(0, 18)}...
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#252943]">
                <input
                  type="checkbox"
                  checked={peakHourWeighting}
                  onChange={(e) => setPeakHourWeighting(e.target.checked)}
                  className="rounded text-[#3A4EFB]"
                />
                <span>Peak-Hour Circadian Weighting</span>
              </label>
            </div>
          </div>
        </div>

        {/* Per-Type Breakdown Cards (Views, Likes, Shares, Saves, Comments) */}
        {plan && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#252943] flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-[#3A4EFB]" />
                2. Per-Type Quantity & Delivery Breakdown
              </span>
              <span className="text-xs text-[#252943]/60">Auto-calculated using natural organic ratios (±25% variance)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { type: "views", label: "Views", icon: Eye, color: "text-blue-600", bg: "bg-blue-50" },
                { type: "likes", label: "Likes", icon: Heart, color: "text-rose-600", bg: "bg-rose-50" },
                { type: "shares", label: "Shares", icon: Share2, color: "text-indigo-600", bg: "bg-indigo-50" },
                { type: "saves", label: "Saves", icon: Bookmark, color: "text-amber-600", bg: "bg-amber-50" },
                { type: "comments", label: "Comments", icon: MessageSquare, color: "text-emerald-600", bg: "bg-emerald-50" },
              ].map((item) => {
                const typePlan = plan.plans[item.type as EngagementType];
                const Icon = item.icon;

                return (
                  <div
                    key={item.type}
                    onClick={() => {
                      setSelectedRunType(item.type as EngagementType);
                      setPreviewTab("runs");
                    }}
                    className={`bg-white rounded-2xl border p-4 shadow-subtle cursor-pointer transition-all hover:border-[#3A4EFB] ${
                      selectedRunType === item.type && previewTab === "runs"
                        ? "border-[#3A4EFB] ring-1 ring-[#3A4EFB]"
                        : "border-[#DEE0ED]"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-[#DEE0ED]/60">
                      <div className="flex items-center gap-1.5">
                        <div className={`p-1.5 rounded-lg ${item.bg}`}>
                          <Icon className={`w-3.5 h-3.5 ${item.color}`} />
                        </div>
                        <span className="text-xs font-bold text-[#252943]">{item.label}</span>
                      </div>
                      <span className="text-[10px] font-bold text-[#3A4EFB]">
                        {typePlan.runsCount} runs
                      </span>
                    </div>

                    <div className="mt-2.5 space-y-1">
                      <span className="text-xl font-black text-[#252943] block">
                        {typePlan.totalQuantity.toLocaleString()}
                      </span>
                      <div className="text-[10px] text-[#252943]/60 flex items-center justify-between">
                        <span>Min {typePlan.minQuantity} / run</span>
                        <span className="font-bold text-[#252943]">₹{typePlan.totalCost.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Live Organic Growth Preview Section */}
        {plan && (
          <div className="bg-white rounded-2xl border border-[#DEE0ED] p-6 shadow-subtle space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DEE0ED]">
              <div>
                <h3 className="text-sm font-bold text-[#252943] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#3A4EFB]" />
                  Live Organic Growth Preview (Identical to Real Delivery)
                </h3>
                <p className="text-xs text-[#252943]/60">
                  Smooth S-curve delivery schedule generated with Mulberry32 deterministic randomness.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewTab("chart")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    previewTab === "chart"
                      ? "bg-[#252943] text-white"
                      : "bg-[#F8F9FD] text-[#252943]/70 hover:bg-[#DEE0ED]/50"
                  }`}
                >
                  Growth Curve
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab("runs")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    previewTab === "runs"
                      ? "bg-[#252943] text-white"
                      : "bg-[#F8F9FD] text-[#252943]/70 hover:bg-[#DEE0ED]/50"
                  }`}
                >
                  Per-Type Delivery Timeline
                </button>
                <button
                  type="button"
                  onClick={handleRegenerateSeed}
                  className="px-3 py-1.5 rounded-lg bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-xs font-bold transition-all flex items-center gap-1 shadow-subtle"
                >
                  <RefreshCw className="w-3 h-3 text-[#E3FF3B]" />
                  <span>New Pattern</span>
                </button>
              </div>
            </div>

            {previewTab === "chart" && svgCurves && (
              <div className="space-y-3">
                <div className="w-full bg-[#F8F9FD] rounded-xl border border-[#DEE0ED] p-4 overflow-hidden relative">
                  <svg viewBox="0 0 640 240" className="w-full h-56 stroke-linecap-round stroke-linejoin-round">
                    {/* Grid lines */}
                    <line x1="35" y1="35" x2="605" y2="35" stroke="#DEE0ED" strokeDasharray="3 3" />
                    <line x1="35" y1="102" x2="605" y2="102" stroke="#DEE0ED" strokeDasharray="3 3" />
                    <line x1="35" y1="170" x2="605" y2="170" stroke="#DEE0ED" strokeDasharray="3 3" />
                    <line x1="35" y1="205" x2="605" y2="205" stroke="#252943" strokeOpacity="0.3" />

                    {/* S-Curves for all 5 metrics */}
                    <path d={svgCurves.views} fill="none" stroke="#2563EB" strokeWidth="3" />
                    <path d={svgCurves.likes} fill="none" stroke="#E11D48" strokeWidth="2.5" />
                    <path d={svgCurves.shares} fill="none" stroke="#4F46E5" strokeWidth="2" strokeDasharray="4 2" />
                    <path d={svgCurves.saves} fill="none" stroke="#D97706" strokeWidth="2" strokeDasharray="3 3" />
                    <path d={svgCurves.comments} fill="none" stroke="#059669" strokeWidth="2" />
                  </svg>

                  <div className="flex items-center justify-between text-[11px] text-[#252943]/60 px-4 pt-1 font-semibold">
                    <span>Start (t=0h)</span>
                    <span>Midpoint (+{Math.round(durationHours / 2)}h)</span>
                    <span>Tail Completion (+{durationHours}h)</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 text-xs font-semibold flex-wrap pt-1">
                  <span className="flex items-center gap-1.5 text-blue-600">
                    <span className="w-3 h-1 bg-blue-600 rounded" /> Views (100% S-Curve)
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-600">
                    <span className="w-3 h-1 bg-rose-600 rounded" /> Likes
                  </span>
                  <span className="flex items-center gap-1.5 text-indigo-600">
                    <span className="w-3 h-1 bg-indigo-600 rounded border-dashed" /> Shares
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <span className="w-3 h-1 bg-amber-600 rounded" /> Saves
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <span className="w-3 h-1 bg-emerald-600 rounded" /> Comments
                  </span>
                </div>
              </div>
            )}

            {previewTab === "runs" && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {(["views", "likes", "shares", "saves", "comments"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedRunType(t)}
                      className={`text-xs px-3 py-1.5 rounded-lg capitalize font-semibold transition-all ${
                        selectedRunType === t
                          ? "bg-[#252943] text-white shadow-subtle"
                          : "bg-[#F8F9FD] border border-[#DEE0ED] text-[#252943]/70 hover:bg-[#DEE0ED]/50"
                      }`}
                    >
                      {t} ({plan.plans[t].runsCount} batches)
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto border border-[#DEE0ED] rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8F9FD] border-b border-[#DEE0ED] text-[#252943]/60 font-medium">
                      <tr>
                        <th className="py-2.5 px-3">Run #</th>
                        <th className="py-2.5 px-3">Delivery Time</th>
                        <th className="py-2.5 px-3 text-right">Batch Quantity</th>
                        <th className="py-2.5 px-3 text-right">Cumulative Delivered</th>
                        <th className="py-2.5 px-3 text-right">Batch Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DEE0ED]/60">
                      {plan.plans[selectedRunType].runs.map((r) => (
                        <tr key={r.runIndex} className="hover:bg-[#F8F9FD]/60">
                          <td className="py-2.5 px-3 font-bold text-[#252943]">Batch #{r.runIndex}</td>
                          <td className="py-2.5 px-3 text-[#252943]/80">
                            +{Math.floor(r.minutesFromStart / 60)}h {r.minutesFromStart % 60}m
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#252943]">
                            {r.quantity.toLocaleString()} units
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-[#3A4EFB]">
                            {r.cumulativeQuantity.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#252943]/70">
                            ₹{r.cost.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Total Cost & Launch Bar */}
        {plan && (
          <div className="bg-gradient-to-r from-[#252943] to-[#1A1D31] text-white rounded-2xl p-6 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-[#E3FF3B] uppercase tracking-wider block">
                Total Upfront Package Charge
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-white">₹{plan.totalCost.toFixed(2)}</span>
                <span className="text-xs text-white/60">
                  includes {plan.allRuns.length} scheduled runs across all 5 engagement types
                </span>
              </div>
              <p className="text-[11px] text-white/50 mt-1">
                Undelivered runs are automatically refunded to your INR wallet upon order cancellation or permanent failure.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="py-3 px-8 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-sm font-bold transition-all press-scale shadow-subtle flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#E3FF3B]" />
                  <span>Scheduling Delivery Runs...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-[#E3FF3B]" />
                  <span>Launch Organic Delivery</span>
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

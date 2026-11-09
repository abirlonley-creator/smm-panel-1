"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Zap,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ExternalLink,
  Layers,
  ArrowRight,
  Clock,
  Wallet,
  Play,
  Flame,
  Check,
  RefreshCw,
  Eye,
  Heart,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  Sliders,
  Award,
} from "lucide-react";

interface ApiStatusItem {
  connected: boolean;
  valid: boolean;
  name: string;
  connectionId: string | null;
  balance: number | null;
  currency: string;
  hasService: boolean;
  service: {
    id: string;
    providerServiceId: string;
    name: string;
    minQuantity: number;
    maxQuantity: number;
    ratePer1000: number;
  } | null;
  message: string;
}

interface EngagementStatusResponse {
  success: boolean;
  enabled: boolean;
  walletBalance: number;
  readyToOrder: boolean;
  zeofame: ApiStatusItem;
  xmedia: ApiStatusItem;
  config: {
    enabled: boolean;
    presetName: string;
    views: {
      enabled: boolean;
      providerName: string;
      serviceId: string;
      minQuantity: number;
      maxQuantity: number;
      runsCount: number;
      intervalMinutes: number;
    };
    likes: {
      enabled: boolean;
      providerName: string;
      serviceId: string;
      minQuantity: number;
      maxQuantity: number;
      runsCount: number;
      intervalMinutes: number;
    };
    syncThreshold: {
      minViews: number;
      maxViews: number;
    };
  };
  pricing: {
    totalEstimatedCost: number;
    viewsCost: number;
    likesCost: number;
    viewsRate: number;
    likesRate: number;
    totalPlannedViews: number;
    totalPlannedLikes: number;
    viewsRuns: number;
    likesRuns: number;
    durationMinutes: number;
  };
}

export default function EngagementPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusData, setStatusData] = useState<EngagementStatusResponse | null>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<any | null>(null);
  const [showApiDetails, setShowApiDetails] = useState(false);
  const [selectedTimelineTab, setSelectedTimelineTab] = useState<"overview" | "timeline">("overview");

  async function fetchStatus(isManual = false) {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/engagement/status");
      const data = await res.json();
      if (data.success) {
        setStatusData(data);
      } else {
        setErrorMsg(data.error || "Failed to load engagement status");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to connect to engagement backend");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchStatus();
  }, []);

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const url = targetUrl.trim();
    if (!url) {
      setErrorMsg("Please enter your TikTok video link.");
      return;
    }

    if (!url.toLowerCase().includes("tiktok.com")) {
      setErrorMsg("Please enter a valid TikTok video URL (e.g. https://www.tiktok.com/@username/video/...)");
      return;
    }

    if (!statusData?.readyToOrder) {
      setErrorMsg("Both Zeofame and Xmedia APIs must be connected and verified before ordering.");
      return;
    }

    if ((statusData?.walletBalance ?? 0) < (statusData?.pricing?.totalEstimatedCost ?? 0)) {
      setErrorMsg("Insufficient wallet balance. Please add funds to your wallet to place this engagement order.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/engagement/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl: url,
          presetName: statusData?.config?.presetName || "TikTok Organic Working Preset",
          platform: "TikTok",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create engagement order");
      }

      setSuccessReceipt(data);
      setTargetUrl("");
      // Refresh status and wallet balance
      fetchStatus();
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit engagement order");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-[#3A4EFB]/10 flex items-center justify-center text-[#3A4EFB]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-[#252943]">Verifying Dual Provider Engine</p>
          <p className="text-xs text-[#252943]/60 mt-0.5">Checking Xmedia (Views) & Zeofame (Likes) connections...</p>
        </div>
      </div>
    );
  }

  const walletBalance = statusData?.walletBalance ?? 0;
  const pricing = statusData?.pricing;
  const config = statusData?.config;
  const zeofame = statusData?.zeofame;
  const xmedia = statusData?.xmedia;
  const hasSufficientFunds = walletBalance >= (pricing?.totalEstimatedCost ?? 0);
  const isReady = Boolean(statusData?.readyToOrder);

  // Timeline schedule visualization events
  const timelineSchedule = [
    { time: "0 min", label: "Views Run #1 (Instant)", type: "views", desc: "~185 views sent immediately upon ordering", tag: "Immediate" },
    { time: "20 min", label: "Views Run #2", type: "views", desc: "~185 views delivered", tag: "Views" },
    { time: "40 min", label: "Views Run #3", type: "views", desc: "~185 views delivered", tag: "Views" },
    { time: "60 min", label: "Views Run #4", type: "views", desc: "Crossing 500-700 views (Protection Active)", tag: "Threshold" },
    { time: "80 min", label: "Views Run #5", type: "views", desc: "~185 views delivered", tag: "Views" },
    { time: "100 min", label: "Views Run #6", type: "views", desc: "~185 views delivered", tag: "Views" },
    { time: "120 min", label: "Views Run #7 + Likes Wave #1", type: "both", desc: "~185 views + First 12–16 likes wave", tag: "First Likes" },
    { time: "140 min - 180 min", label: "Views Runs #8 – #10", type: "views", desc: "Steady views pacing across 3 runs", tag: "Views" },
    { time: "200 min", label: "Views Run #11 + Likes Wave #2", type: "both", desc: "~185 views + Second 12–16 likes wave", tag: "Likes Wave" },
    { time: "220 min - 260 min", label: "Views Runs #12 – #14", type: "views", desc: "Views continuing steady growth", tag: "Views" },
    { time: "280 min", label: "Views Run #15 + Likes Wave #3", type: "both", desc: "Final 12–16 likes batch. ALL LIKES 100% CLEARED!", tag: "All Likes Done" },
    { time: "300 min", label: "Views Run #16 (Final Views Batch)", type: "views", desc: "Last ~185 views batch. Campaign 100% Complete!", tag: "Completed" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fadeIn">
      {/* Top Banner: Provider Connection Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="flex items-center -space-x-1.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black border-2 border-white ${
              xmedia?.connected ? "bg-blue-600 text-white" : "bg-gray-300 text-gray-700"
            }`}>
              XM
            </div>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black border-2 border-white ${
              zeofame?.connected ? "bg-rose-500 text-white" : "bg-gray-300 text-gray-700"
            }`}>
              ZF
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#252943]">
                Upstream Engine: {isReady ? "Dual Providers Connected" : "API Setup Required"}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                isReady ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}>
                {isReady ? "Ready to Launch" : "Attention Required"}
              </span>
            </div>
            <p className="text-[11px] text-[#252943]/60">
              Xmedia (#10322 Views) & Zeofame (#1123 Likes)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setShowApiDetails(!showApiDetails)}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-[#3A4EFB] hover:bg-blue-50 transition-all flex items-center gap-1 cursor-pointer"
          >
            <span>{showApiDetails ? "Hide Details" : "Provider Details"}</span>
            {showApiDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => fetchStatus(true)}
            disabled={refreshing}
            className="p-1.5 rounded-xl text-[#252943]/70 hover:bg-[#F8F9FD] transition-all cursor-pointer"
            title="Refresh API Balances"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#3A4EFB]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Expandable Provider API Details */}
      {showApiDetails && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] animate-fadeIn">
          {/* Xmedia Card */}
          <div className="bg-white p-4 rounded-xl border border-[#DEE0ED] shadow-subtle space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                  XM
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#252943]">Xmedia (Views Provider)</h4>
                  <span className="text-[10px] text-[#252943]/60">Service ID #10322</span>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                xmedia?.connected ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}>
                {xmedia?.connected ? "Active" : "Disconnected"}
              </span>
            </div>
            <div className="text-[11px] text-[#252943]/70 flex justify-between pt-1 border-t border-[#DEE0ED]/60">
              <span>Provider Balance:</span>
              <span className="font-bold text-[#252943]">{xmedia?.balance != null ? `₹${xmedia.balance.toFixed(2)}` : "—"}</span>
            </div>
            {!xmedia?.connected && (
              <Link href="/api-key" className="text-xs font-bold text-[#3A4EFB] hover:underline flex items-center gap-1 pt-1">
                <span>Connect Xmedia API</span> <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>

          {/* Zeofame Card */}
          <div className="bg-white p-4 rounded-xl border border-[#DEE0ED] shadow-subtle space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center">
                  ZF
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#252943]">Zeofame (Likes Provider)</h4>
                  <span className="text-[10px] text-[#252943]/60">Service ID #1123</span>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                zeofame?.connected ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}>
                {zeofame?.connected ? "Active" : "Disconnected"}
              </span>
            </div>
            <div className="text-[11px] text-[#252943]/70 flex justify-between pt-1 border-t border-[#DEE0ED]/60">
              <span>Provider Balance:</span>
              <span className="font-bold text-[#252943]">{zeofame?.balance != null ? `€${zeofame.balance.toFixed(4)}` : "—"}</span>
            </div>
            {!zeofame?.connected && (
              <Link href="/api-key" className="text-xs font-bold text-[#3A4EFB] hover:underline flex items-center gap-1 pt-1">
                <span>Connect Zeofame API</span> <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Success Receipt Banner */}
      {successReceipt && (
        <div className="p-6 rounded-3xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 space-y-4 animate-fadeIn shadow-subtle">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-emerald-950">
                  Engagement Campaign Launched Successfully!
                </h3>
                <p className="text-xs text-emerald-800">
                  Order ID: <strong className="font-mono">#{successReceipt.orderRef}</strong> • Views Run #1 dispatched immediately.
                </p>
              </div>
            </div>
            <Link
              href={`/engagement/orders/${successReceipt.orderId}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold transition-all shadow-subtle"
            >
              <span>Inspect Live Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-emerald-200 text-xs">
            <div>
              <span className="text-emerald-700/80 text-[10px] uppercase font-bold block">Planned Views</span>
              <span className="font-black text-sm text-emerald-950">~{successReceipt.totalPlannedViews?.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-emerald-700/80 text-[10px] uppercase font-bold block">Planned Likes</span>
              <span className="font-black text-sm text-emerald-950">~{successReceipt.totalPlannedLikes?.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-emerald-700/80 text-[10px] uppercase font-bold block">Batches</span>
              <span className="font-black text-sm text-emerald-950">{successReceipt.runsCount} Batches</span>
            </div>
            <div>
              <span className="text-emerald-700/80 text-[10px] uppercase font-bold block">Total Deducted</span>
              <span className="font-black text-sm text-[#3A4EFB]">₹{successReceipt.totalCost?.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-emerald-700/80 text-[10px] uppercase font-bold block">Wallet Left</span>
              <span className="font-black text-sm text-emerald-950">₹{successReceipt.remainingBalance?.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3 text-xs font-semibold animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
        </div>
      )}

      {/* HERO SECTION & PRODUCT EXPLAINER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E2235] via-[#252943] to-[#121421] text-white p-6 sm:p-8 shadow-card">
        {/* Decorative glow circles */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-[#3A4EFB]/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 -mb-20 w-60 h-60 rounded-full bg-rose-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white backdrop-blur-md border border-white/15">
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>Algorithm-Safe Growth Technology</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
            TikTok Organic Viral Engagement Engine
          </h1>

          <p className="text-xs sm:text-sm text-white/80 leading-relaxed max-w-2xl">
            Never send flat, bulk views that get flagged by TikTok. This automated pipeline mimics real viral audience retention across a calibrated <strong>5-hour window</strong> with <strong>16 micro-bursts of views</strong> and <strong>3 perfectly coordinated waves of likes</strong>.
          </p>

          {/* 3 Core Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
                <Zap className="w-4 h-4 text-blue-400" />
                <span>Instant Launch</span>
              </div>
              <p className="text-[11px] text-white/70 leading-normal">
                Batch #1 delivers within seconds of ordering to jumpstart your video.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
                <ShieldCheck className="w-4 h-4 text-rose-400" />
                <span>Zero Unorganic Likes</span>
              </div>
              <p className="text-[11px] text-white/70 leading-normal">
                All likes finish before views end. No likes are ever sent to a dormant video.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Smart Sync Protection</span>
              </div>
              <p className="text-[11px] text-white/70 leading-normal">
                Delayed Likes Protection automatically accelerates likes when views surge past 500.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN WORKSPACE: LEFT = ORDER FORM, RIGHT = DELIVERY VISUALIZER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: ORDER CARD (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#DEE0ED]">
            <div>
              <h2 className="text-base font-extrabold text-[#252943]">Create Engagement Order</h2>
              <p className="text-xs text-[#252943]/60">1-click automated TikTok organic preset</p>
            </div>
            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-[#3A4EFB]/10 text-[#3A4EFB]">
              Standard Preset
            </span>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
                <Eye className="w-3.5 h-3.5" />
                <span>TikTok Views</span>
              </div>
              <div className="text-lg font-black text-[#252943] font-mono">
                ~{pricing?.totalPlannedViews?.toLocaleString()}
              </div>
              <span className="text-[10px] text-blue-900/60 font-semibold block">
                16 runs • 150–220 each
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-100 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                <Heart className="w-3.5 h-3.5" />
                <span>TikTok Likes</span>
              </div>
              <div className="text-lg font-black text-[#252943] font-mono">
                ~{pricing?.totalPlannedLikes?.toLocaleString()}
              </div>
              <span className="text-[10px] text-rose-900/60 font-semibold block">
                3 waves • 12–16 each
              </span>
            </div>
          </div>

          {/* Order Input Form */}
          <form onSubmit={handleCreateOrder} className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-[#252943] mb-2 flex items-center justify-between">
                <span>TikTok Video URL</span>
                <span className="text-[10px] font-normal text-[#252943]/50">Public videos only</span>
              </label>
              <div className="relative">
                <input
                  type="url"
                  required
                  placeholder="https://www.tiktok.com/@username/video/..."
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs sm:text-sm font-semibold text-[#252943] placeholder-[#252943]/40 focus:outline-none focus:border-[#3A4EFB] focus:bg-white transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Total Cost & Wallet Card */}
            <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-3">
              <div className="flex items-center justify-between text-xs text-[#252943]/70">
                <span>Estimated Duration:</span>
                <span className="font-bold text-[#252943]">~5.0 Hours (300 mins)</span>
              </div>

              <div className="flex items-center justify-between text-xs text-[#252943]/70">
                <span>Views Cost ({pricing?.totalPlannedViews} @ ₹{pricing?.viewsRate}/1k):</span>
                <span className="font-mono font-semibold text-[#252943]">₹{pricing?.viewsCost.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-xs text-[#252943]/70">
                <span>Likes Cost ({pricing?.totalPlannedLikes} @ ₹{pricing?.likesRate}/1k):</span>
                <span className="font-mono font-semibold text-[#252943]">₹{pricing?.likesCost.toFixed(2)}</span>
              </div>

              <div className="pt-2 border-t border-[#DEE0ED] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">Total Order Price</span>
                  <span className="text-xl font-black text-[#3A4EFB] font-mono">
                    ₹{pricing?.totalEstimatedCost.toFixed(2)}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">Your Balance</span>
                  <span className={`text-xs font-bold ${hasSufficientFunds ? "text-emerald-700" : "text-rose-600"}`}>
                    ₹{walletBalance.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Order Action Button */}
            <button
              type="submit"
              disabled={submitting || !isReady || !hasSufficientFunds}
              className={`w-full py-4 rounded-2xl text-sm font-extrabold tracking-wide transition-all shadow-subtle flex items-center justify-center gap-2 cursor-pointer ${
                submitting || !isReady || !hasSufficientFunds
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white active:scale-[0.99] shadow-lg shadow-[#3A4EFB]/25"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Scheduling 19 Batches...</span>
                </>
              ) : !isReady ? (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Connect Provider APIs Above First</span>
                </>
              ) : !hasSufficientFunds ? (
                <>
                  <Wallet className="w-4 h-4" />
                  <span>Top Up Wallet (Need ₹{((pricing?.totalEstimatedCost ?? 0) - walletBalance).toFixed(2)})</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Launch TikTok Campaign (₹{pricing?.totalEstimatedCost.toFixed(2)})</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: VISUAL PACING & TIMELINE (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DEE0ED]">
            <div>
              <h2 className="text-base font-extrabold text-[#252943]">
                Pacing & Organic Delivery Blueprint
              </h2>
              <p className="text-xs text-[#252943]/60">
                19 deterministic batches synchronized over 300 minutes
              </p>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 p-1 bg-[#F0F2FA] rounded-xl self-start sm:self-auto text-xs font-bold">
              <button
                type="button"
                onClick={() => setSelectedTimelineTab("overview")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedTimelineTab === "overview"
                    ? "bg-white text-[#3A4EFB] shadow-sm"
                    : "text-[#252943]/60 hover:text-[#252943]"
                }`}
              >
                Visual Flow
              </button>
              <button
                type="button"
                onClick={() => setSelectedTimelineTab("timeline")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedTimelineTab === "timeline"
                    ? "bg-white text-[#3A4EFB] shadow-sm"
                    : "text-[#252943]/60 hover:text-[#252943]"
                }`}
              >
                Detailed Runs
              </button>
            </div>
          </div>

          {selectedTimelineTab === "overview" ? (
            <div className="space-y-6">
              {/* Visual 5-Hour Progress Stepper Bar */}
              <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#252943]">
                  <span>Campaign Timeline (5 Hours)</span>
                  <span className="text-[#3A4EFB] font-mono">0m → 300m</span>
                </div>

                {/* Multi-Segment Delivery Bar */}
                <div className="relative w-full h-8 bg-gray-100 rounded-xl overflow-hidden flex items-center p-1 gap-1 border border-[#DEE0ED]">
                  {/* Segment 1: 0m to 120m (Views only) */}
                  <div className="h-full bg-blue-500 rounded-lg flex items-center justify-center text-[10px] font-bold text-white px-2" style={{ width: "40%" }} title="0m - 120m: Views Only (Building Momentum)">
                    Views Phase (~1,100)
                  </div>
                  {/* Segment 2: 120m to 280m (Views + Synchronized Likes) */}
                  <div className="h-full bg-gradient-to-r from-blue-600 via-purple-600 to-rose-500 rounded-lg flex items-center justify-center text-[10px] font-bold text-white px-2" style={{ width: "53%" }} title="120m - 280m: Views + 3 Waves of Likes">
                    Views + Likes Waves
                  </div>
                  {/* Segment 3: 280m to 300m (Final View Batch wrap-up) */}
                  <div className="h-full bg-emerald-500 rounded-lg flex items-center justify-center text-[10px] font-bold text-white px-1.5" style={{ width: "7%" }} title="280m - 300m: Views Final Run">
                    Done
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#252943]/60 pt-1">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-blue-500" /> 0m: Launch
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-rose-500" /> 120m, 200m, 280m: Likes Waves
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> 300m: Complete
                  </span>
                </div>
              </div>

              {/* 3 Step Story Explainer */}
              <div className="space-y-3">
                {/* Step 1 */}
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white border border-[#DEE0ED] hover:border-blue-200 transition-all">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 font-black text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-[#252943]">
                      Hour 0 to 2: Initial Views Ramp (0m – 120m)
                    </h4>
                    <p className="text-[11px] text-[#252943]/70 leading-relaxed">
                      Views Run #1 sends immediately upon ordering. Over the next 2 hours, 6 randomized batches of 150–220 views arrive every 20 minutes to show natural engagement before any likes are introduced.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white border border-[#DEE0ED] hover:border-purple-200 transition-all">
                  <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 font-black text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-[#252943]">
                      Hour 2 to 4.6: Coordinated Likes Waves (120m, 200m, 280m)
                    </h4>
                    <p className="text-[11px] text-[#252943]/70 leading-relaxed">
                      3 synchronized waves of 12–16 likes are dropped alongside ongoing view runs. If views surge over 500 views early, Delayed Likes Protection triggers the first likes wave ahead of time.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white border border-[#DEE0ED] hover:border-emerald-200 transition-all">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 font-black text-xs flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-[#252943]">
                      Hour 5: Final Wrap-up (280m – 300m)
                    </h4>
                    <p className="text-[11px] text-[#252943]/70 leading-relaxed">
                      All 3 likes batches finish at 280m. The 16th and final view batch executes at 300m. <strong>Zero likes are ever sent after views end</strong>, keeping the video completely safe from algorithm penalties.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Detailed Runs Timeline */
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {timelineSchedule.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]/70 text-xs hover:bg-white transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-[#3A4EFB] w-14 shrink-0 text-[11px]">
                      {item.time}
                    </span>
                    <div>
                      <span className="font-bold text-[#252943] block text-[11px]">{item.label}</span>
                      <span className="text-[10px] text-[#252943]/60">{item.desc}</span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                    item.type === "both"
                      ? "bg-purple-100 text-purple-800"
                      : item.type === "views"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-rose-100 text-rose-800"
                  }`}>
                    {item.tag}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Delayed Likes Protection Alert */}
          <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-950">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-[11px]">Smart Delayed Likes Protection: Active</span>
              <p className="text-[10px] text-amber-900/80 leading-relaxed">
                If Xmedia confirms between {config?.syncThreshold.minViews || 500} and {config?.syncThreshold.maxViews || 700} views early, the system immediately pulls forward the next likes wave to keep the organic ratio in balance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

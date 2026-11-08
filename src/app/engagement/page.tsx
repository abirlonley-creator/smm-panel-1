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
} from "lucide-react";
import { formatBdDateTime } from "@/lib/date-bd";

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
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#3A4EFB]" />
        <span className="text-xs font-semibold text-[#252943]/60">Verifying API connections and engagement services...</span>
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

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn">
      {/* Header & Balance Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#DEE0ED]">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-[#3A4EFB]/10 text-[#3A4EFB] mb-2 border border-[#3A4EFB]/20">
            <Flame className="w-3.5 h-3.5 text-[#3A4EFB]" />
            <span>Dedicated Automation Pipeline</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#252943]">
            TikTok Engagement Automation
          </h1>
          <p className="text-xs sm:text-sm text-[#252943]/70 mt-1 max-w-2xl leading-relaxed">
            Coordinated dual-provider pacing: 16 Views runs via Xmedia and 3 Likes runs via Zeofame with smart Delayed Likes Protection to preserve organic growth ratios.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white border border-[#DEE0ED] rounded-2xl px-4 py-2.5 shadow-subtle flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">Website Balance</span>
              <span className="text-base font-extrabold text-[#252943]">₹{walletBalance.toFixed(2)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchStatus(true)}
            disabled={refreshing}
            className="p-3 rounded-2xl bg-white border border-[#DEE0ED] text-[#252943] hover:bg-[#F8F9FD] transition-all cursor-pointer shadow-subtle"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-[#3A4EFB]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Success Receipt Banner */}
      {successReceipt && (
        <div className="p-5 rounded-2xl bg-[#D4EDDA] border border-[#C3E6CB] text-[#155724] space-y-3 animate-fadeIn shadow-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-base text-[#155724]">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Engagement Order #{successReceipt.orderRef} Successfully Placed!</span>
            </div>
            <Link
              href={`/engagement/orders/${successReceipt.orderId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#155724] text-white text-xs font-bold hover:bg-[#0f441c] transition-all"
            >
              <span>Live Monitor Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <p className="text-xs leading-relaxed text-[#155724]/90">
            {successReceipt.message} All 16 Views batches and 3 Likes batches have been queued in the deterministic scheduler.
          </p>
          <div className="flex flex-wrap gap-4 text-xs font-semibold pt-1 border-t border-[#C3E6CB]">
            <span>Views: <strong>{successReceipt.totalPlannedViews?.toLocaleString()}</strong></span>
            <span>Likes: <strong>{successReceipt.totalPlannedLikes?.toLocaleString()}</strong></span>
            <span>Batches: <strong>{successReceipt.runsCount}</strong></span>
            <span>Charged: <strong>₹{successReceipt.totalCost?.toFixed(2)}</strong></span>
            <span>Remaining Balance: <strong>₹{successReceipt.remainingBalance?.toFixed(2)}</strong></span>
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

      {/* 1. API Integrations Connection Status (Requirement 2) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#252943]/70">
            Required Upstream Provider APIs
          </h2>
          <Link
            href="/api-key"
            className="text-xs font-bold text-[#3A4EFB] hover:underline flex items-center gap-1"
          >
            <span>Manage API Connections</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Xmedia Connection Card (Views) */}
          <div className={`p-5 rounded-2xl border transition-all ${
            xmedia?.connected && xmedia?.hasService
              ? "bg-white border-[#DEE0ED] shadow-subtle"
              : "bg-amber-50/50 border-amber-300"
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]/60">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                  xmedia?.connected && xmedia?.hasService
                    ? "bg-blue-100 text-blue-700"
                    : "bg-amber-100 text-amber-800"
                }`}>
                  XM
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#252943]">
                    Xmedia API <span className="font-normal text-xs text-[#252943]/60">(Views Provider)</span>
                  </h3>
                  <span className="text-[11px] font-medium text-[#252943]/60">
                    Service #{config?.views.serviceId || "10322"}
                  </span>
                </div>
              </div>

              {xmedia?.connected && xmedia?.hasService ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                  <Check className="w-3 h-3" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                  <AlertCircle className="w-3 h-3" /> Disconnected
                </span>
              )}
            </div>

            <div className="pt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between text-[#252943]/70">
                <span>Account Balance:</span>
                <span className="font-bold text-[#252943]">
                  {xmedia?.balance != null ? `₹${xmedia.balance.toFixed(2)}` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#252943]/70">
                <span>Target Service:</span>
                <span className="font-semibold text-[#252943] truncate max-w-[200px]" title={xmedia?.service?.name}>
                  {xmedia?.service?.name || `ID #${config?.views.serviceId}`}
                </span>
              </div>

              {(!xmedia?.connected || !xmedia?.hasService) && (
                <div className="pt-2">
                  <p className="text-[11px] font-semibold text-amber-900 mb-2">
                    {xmedia?.message || "Connect your Xmedia API to activate the TikTok Views service."}
                  </p>
                  <Link
                    href="/api-key"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold transition-all"
                  >
                    <span>Connect Xmedia API</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Zeofame Connection Card (Likes) */}
          <div className={`p-5 rounded-2xl border transition-all ${
            zeofame?.connected && zeofame?.hasService
              ? "bg-white border-[#DEE0ED] shadow-subtle"
              : "bg-amber-50/50 border-amber-300"
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]/60">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                  zeofame?.connected && zeofame?.hasService
                    ? "bg-purple-100 text-purple-700"
                    : "bg-amber-100 text-amber-800"
                }`}>
                  ZF
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#252943]">
                    Zeofame API <span className="font-normal text-xs text-[#252943]/60">(Likes Provider)</span>
                  </h3>
                  <span className="text-[11px] font-medium text-[#252943]/60">
                    Service #{config?.likes.serviceId || "1123"}
                  </span>
                </div>
              </div>

              {zeofame?.connected && zeofame?.hasService ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                  <Check className="w-3 h-3" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                  <AlertCircle className="w-3 h-3" /> Disconnected
                </span>
              )}
            </div>

            <div className="pt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between text-[#252943]/70">
                <span>Account Balance:</span>
                <span className="font-bold text-[#252943]">
                  {zeofame?.balance != null ? `€${zeofame.balance.toFixed(4)}` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#252943]/70">
                <span>Target Service:</span>
                <span className="font-semibold text-[#252943] truncate max-w-[200px]" title={zeofame?.service?.name}>
                  {zeofame?.service?.name || `ID #${config?.likes.serviceId}`}
                </span>
              </div>

              {(!zeofame?.connected || !zeofame?.hasService) && (
                <div className="pt-2">
                  <p className="text-[11px] font-semibold text-amber-900 mb-2">
                    {zeofame?.message || "Connect your Zeofame API to activate the TikTok Likes service."}
                  </p>
                  <Link
                    href="/api-key"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold transition-all"
                  >
                    <span>Connect Zeofame API</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. TikTok Organic Working Preset Card (Requirement 3 & 4) */}
      <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 sm:p-8 shadow-subtle space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DEE0ED]">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-[#E3FF3B]/30 text-[#252943] border border-[#DEE0ED] mb-1.5">
              <Zap className="w-3 h-3 text-[#3A4EFB]" />
              <span>ACTIVE SYSTEM PRESET</span>
            </div>
            <h2 className="text-xl font-extrabold text-[#252943]">
              {config?.presetName || "TikTok Organic Working Preset"}
            </h2>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Delayed Likes Protection Active</span>
          </div>
        </div>

        {/* Configuration Overview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Views Specification */}
          <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-sm text-[#252943] flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3A4EFB]" />
                Views Automation
              </span>
              <span className="text-xs font-bold text-[#3A4EFB]">Xmedia • ID #10322</span>
            </div>

            <div className="space-y-1.5 text-xs text-[#252943]/80">
              <div className="flex justify-between">
                <span>Runs Count:</span>
                <span className="font-bold text-[#252943]">{config?.views.runsCount} Batches</span>
              </div>
              <div className="flex justify-between">
                <span>Batch Quantity:</span>
                <span className="font-bold text-[#252943]">{config?.views.minQuantity} – {config?.views.maxQuantity} randomized / run</span>
              </div>
              <div className="flex justify-between">
                <span>Interval:</span>
                <span className="font-bold text-[#252943]">Every {config?.views.intervalMinutes} minutes</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Total Views:</span>
                <span className="font-extrabold text-emerald-700">~{pricing?.totalPlannedViews?.toLocaleString()} Views</span>
              </div>
            </div>
          </div>

          {/* Likes Specification */}
          <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-sm text-[#252943] flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Likes Automation
              </span>
              <span className="text-xs font-bold text-rose-600">Zeofame • ID #1123</span>
            </div>

            <div className="space-y-1.5 text-xs text-[#252943]/80">
              <div className="flex justify-between">
                <span>Runs Count:</span>
                <span className="font-bold text-[#252943]">{config?.likes.runsCount} Batches (rounded from 2.65)</span>
              </div>
              <div className="flex justify-between">
                <span>Batch Quantity:</span>
                <span className="font-bold text-[#252943]">{config?.likes.minQuantity} – {config?.likes.maxQuantity} randomized / run</span>
              </div>
              <div className="flex justify-between">
                <span>Pacing & Cleared:</span>
                <span className="font-bold text-[#252943]">Runs at 120m, 200m, 280m (before last view batch)</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Total Likes:</span>
                <span className="font-extrabold text-rose-700">~{pricing?.totalPlannedLikes?.toLocaleString()} Likes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Smart Synchronization Explainer Box (Delayed Likes Protection) */}
        <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-blue-950 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-sm text-blue-900">
            <ShieldCheck className="w-4 h-4 text-[#3A4EFB]" />
            <span>Smart Synchronization: Organic Pacing Protection</span>
          </div>
          <p className="leading-relaxed">
            Views start immediately upon ordering (Run #1 at 0m through Run #16 at 300m). Likes are dispatched at <strong>120m, 200m, and 280m</strong>, ensuring all likes batches are completed <strong>before the final view batch</strong> so no likes ever arrive without views. If views reach <strong>{config?.syncThreshold.minViews}–{config?.syncThreshold.maxViews} views</strong> early, Delayed Likes Protection accelerates likes immediately.
          </p>
        </div>

        {/* Order Form */}
        <form onSubmit={handleCreateOrder} className="space-y-6 pt-2">
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-[#252943] mb-2">
              TikTok Video URL
            </label>
            <div className="relative">
              <input
                type="url"
                required
                placeholder="https://www.tiktok.com/@username/video/7123456789012345678"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] text-sm font-semibold text-[#252943] placeholder-[#252943]/40 focus:outline-none focus:border-[#3A4EFB] focus:bg-white transition-all"
              />
            </div>
            <span className="text-[11px] text-[#252943]/50 mt-1 block">
              Direct public TikTok video link. Account must remain public during automated execution.
            </span>
          </div>

          {/* Pricing & Estimation Breakdown Card */}
          <div className="p-5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-3">
            <div className="flex items-center justify-between text-xs text-[#252943]/70 pb-2 border-b border-[#DEE0ED]/60">
              <span>Estimated Duration:</span>
              <span className="font-bold text-[#252943]">~5 Hours (300 minutes)</span>
            </div>

            <div className="flex items-center justify-between text-xs text-[#252943]/70">
              <span>Views Cost (Xmedia • ~{pricing?.totalPlannedViews} units @ ₹{pricing?.viewsRate}/1k):</span>
              <span className="font-bold text-[#252943]">₹{pricing?.viewsCost.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-xs text-[#252943]/70">
              <span>Likes Cost (Zeofame • ~{pricing?.totalPlannedLikes} units @ ₹{pricing?.likesRate}/1k):</span>
              <span className="font-bold text-[#252943]">₹{pricing?.likesCost.toFixed(2)}</span>
            </div>

            <div className="pt-2 border-t border-[#DEE0ED] flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-extrabold text-[#252943]/60 block">Total Order Price</span>
                <span className="text-2xl font-extrabold text-[#3A4EFB]">
                  ₹{pricing?.totalEstimatedCost.toFixed(2)}
                </span>
              </div>

              <div>
                {hasSufficientFunds ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    <Check className="w-3.5 h-3.5" /> Sufficient Balance (₹{walletBalance.toFixed(2)})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                    <AlertCircle className="w-3.5 h-3.5" /> Insufficient Balance (Need ₹{((pricing?.totalEstimatedCost ?? 0) - walletBalance).toFixed(2)})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={submitting || !isReady || !hasSufficientFunds}
              className={`w-full py-4 rounded-2xl text-sm font-extrabold tracking-wide transition-all shadow-subtle flex items-center justify-center gap-2 cursor-pointer ${
                submitting || !isReady || !hasSufficientFunds
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white active:scale-[0.99]"
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
                  <span>Connect Both APIs Above to Order</span>
                </>
              ) : !hasSufficientFunds ? (
                <>
                  <Wallet className="w-4 h-4" />
                  <span>Add Funds to Wallet to Order</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start TikTok Organic Engagement (16 Views + 3 Likes Batches)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

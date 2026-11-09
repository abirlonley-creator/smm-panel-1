"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Zap,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ExternalLink,
  ArrowRight,
  Clock,
  Wallet,
  Play,
  Check,
  RefreshCw,
  Eye,
  Heart,
  ChevronDown,
  ChevronUp,
  Dices,
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

// Generates an exact deterministic set of randomized numbers within preset bounds
function generateDeterministicPlan(
  viewsMin = 150,
  viewsMax = 220,
  viewsCount = 16,
  likesMin = 12,
  likesMax = 16,
  likesCount = 3
) {
  const views: number[] = [];
  for (let i = 0; i < viewsCount; i++) {
    views.push(Math.floor(Math.random() * (viewsMax - viewsMin + 1)) + viewsMin);
  }
  const likes: number[] = [];
  for (let i = 0; i < likesCount; i++) {
    likes.push(Math.floor(Math.random() * (likesMax - likesMin + 1)) + likesMin);
  }
  return { views, likes };
}

function formatBdTime(offsetMinutes: number, baseDate: Date): string {
  const targetDate = new Date(baseDate.getTime() + offsetMinutes * 60 * 1000);
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Dhaka",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(targetDate) + " BD"
  );
}

export default function EngagementPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusData, setStatusData] = useState<EngagementStatusResponse | null>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<any | null>(null);
  const [showApiDetails, setShowApiDetails] = useState(false);

  // Exact schedule state (randomized within preset limits, re-rollable by user)
  const [plannedSchedule, setPlannedSchedule] = useState<{ views: number[]; likes: number[] }>({
    views: [184, 205, 172, 198, 165, 210, 189, 176, 192, 168, 215, 180, 174, 199, 183, 190],
    likes: [14, 15, 13],
  });

  const [planTimestamp, setPlanTimestamp] = useState<Date>(new Date());

  function rerollPlan() {
    const config = statusData?.config;
    const vMin = config?.views.minQuantity || 150;
    const vMax = config?.views.maxQuantity || 220;
    const vCount = config?.views.runsCount || 16;
    const lMin = config?.likes.minQuantity || 12;
    const lMax = config?.likes.maxQuantity || 16;
    const lCount = config?.likes.runsCount || 3;

    setPlannedSchedule(generateDeterministicPlan(vMin, vMax, vCount, lMin, lMax, lCount));
    setPlanTimestamp(new Date());
  }

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

  // Recalculate exact totals and cost dynamically based on actual schedule
  const totalViews = useMemo(
    () => plannedSchedule.views.reduce((a, b) => a + b, 0),
    [plannedSchedule.views]
  );
  const totalLikes = useMemo(
    () => plannedSchedule.likes.reduce((a, b) => a + b, 0),
    [plannedSchedule.likes]
  );

  const viewsRate = statusData?.pricing?.viewsRate ?? 0.15;
  const likesRate = statusData?.pricing?.likesRate ?? 0.95;
  const exactViewsCost = Number(((totalViews / 1000) * viewsRate).toFixed(4));
  const exactLikesCost = Number(((totalLikes / 1000) * likesRate).toFixed(4));
  const exactTotalCost = Number((exactViewsCost + exactLikesCost).toFixed(2));

  const walletBalance = statusData?.walletBalance ?? 0;
  const zeofame = statusData?.zeofame;
  const xmedia = statusData?.xmedia;
  const hasSufficientFunds = walletBalance >= exactTotalCost;
  const isReady = Boolean(statusData?.readyToOrder);

  // Build the 16 exact batch schedule rows
  const scheduleRows = useMemo(() => {
    // 16 batches, 20 mins interval
    // Likes waves at 120m (Run 7), 200m (Run 11), 280m (Run 15)
    return plannedSchedule.views.map((viewQty, index) => {
      const runNumber = index + 1;
      const minuteOffset = index * 20;
      const clockTime = formatBdTime(minuteOffset, planTimestamp);

      let likeQty: number | null = null;
      let likeWaveNumber: number | null = null;
      let note: string | null = null;

      if (runNumber === 1) {
        note = "Instant Kickoff • Sends immediately upon ordering";
      } else if (runNumber === 4) {
        note = "Views pass 500–700 • Delayed Likes Protection Armed";
      } else if (runNumber === 7) {
        likeQty = plannedSchedule.likes[0] || 14;
        likeWaveNumber = 1;
        note = "Likes Wave #1 introduced after initial views established";
      } else if (runNumber === 11) {
        likeQty = plannedSchedule.likes[1] || 15;
        likeWaveNumber = 2;
        note = "Likes Wave #2 keeps engagement ratio balanced";
      } else if (runNumber === 15) {
        likeQty = plannedSchedule.likes[2] || 13;
        likeWaveNumber = 3;
        note = "Final Likes Wave • All likes 100% cleared before final views!";
      } else if (runNumber === 16) {
        note = "Final Views Batch • Campaign 100% Completed";
      }

      return {
        runNumber,
        minuteOffset,
        clockTime,
        viewQty,
        likeQty,
        likeWaveNumber,
        note,
      };
    });
  }, [plannedSchedule, planTimestamp]);

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

    if (!isReady) {
      setErrorMsg("Both Zeofame and Xmedia APIs must be connected and verified before ordering.");
      return;
    }

    if (!hasSufficientFunds) {
      setErrorMsg("Insufficient wallet balance. Please top up your wallet to continue.");
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
          plannedViews: plannedSchedule.views,
          plannedLikes: plannedSchedule.likes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create engagement order");
      }

      setSuccessReceipt(data);
      setTargetUrl("");
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
        <div className="w-12 h-12 rounded-2xl bg-[#3A4EFB]/10 flex items-center justify-center text-[#3A4EFB]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-[#252943]">Loading TikTok Engagement Engine</p>
          <p className="text-xs text-[#252943]/60 mt-0.5">Connecting Xmedia Views & Zeofame Likes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fadeIn">
      {/* 1. Header & Engine Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-[#DEE0ED] shadow-subtle">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-[#252943] tracking-tight">
              TikTok Engagement Automation
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-[#3A4EFB] border border-blue-200">
              5-Hour Organic Pacing
            </span>
          </div>
          <p className="text-xs text-[#252943]/70">
            16 View batches (Xmedia #10322) & 3 synchronized Like waves (Zeofame #1123) with Delayed Likes Protection.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
          {/* Wallet Balance Badge */}
          <div className="px-3.5 py-2 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[#3A4EFB]" />
            <div>
              <span className="text-[10px] uppercase font-bold text-[#252943]/50 block leading-tight">Balance</span>
              <span className="text-xs font-black text-[#252943] font-mono leading-tight">
                ₹{walletBalance.toFixed(2)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => fetchStatus(true)}
              disabled={refreshing}
              className="p-1 text-[#252943]/60 hover:text-[#3A4EFB] transition-colors"
              title="Refresh Balance"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#3A4EFB]" : ""}`} />
            </button>
          </div>

          {/* Upstream APIs Indicator */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowApiDetails(!showApiDetails)}
              className={`px-3 py-2 rounded-2xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                isReady
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                  : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isReady ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
              <span>{isReady ? "Dual APIs Connected" : "API Setup Required"}</span>
              {showApiDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable API Details */}
      {showApiDetails && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-3xl bg-[#F8F9FD] border border-[#DEE0ED] animate-fadeIn">
          {/* Xmedia Card */}
          <div className="bg-white p-4 rounded-2xl border border-[#DEE0ED] shadow-subtle space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center">
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
                {xmedia?.connected ? "Connected" : "Disconnected"}
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
          <div className="bg-white p-4 rounded-2xl border border-[#DEE0ED] shadow-subtle space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 font-black text-xs flex items-center justify-center">
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
                {zeofame?.connected ? "Connected" : "Disconnected"}
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

      {/* Success Notification */}
      {successReceipt && (
        <div className="p-5 rounded-3xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 space-y-3 animate-fadeIn shadow-subtle">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 stroke-[3]" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-emerald-950">
                  Engagement Campaign Launched Successfully!
                </h3>
                <p className="text-xs text-emerald-800">
                  Order ID: <strong className="font-mono">#{successReceipt.orderRef}</strong> • Views Run #1 dispatched immediately.
                </p>
              </div>
            </div>
            <Link
              href={`/engagement/orders/${successReceipt.orderId}`}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold transition-all shadow-subtle"
            >
              <span>Inspect Live Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3 text-xs font-semibold animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
        </div>
      )}

      {/* 2. THREE-STEP WORKSPACE: Clear, uncluttered, intuitive */}
      <form onSubmit={handleCreateOrder} className="space-y-6">
        {/* STEP 1: VIDEO LINK */}
        <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#3A4EFB] text-white text-xs font-black flex items-center justify-center">
                1
              </span>
              <h2 className="text-sm font-extrabold text-[#252943]">
                Enter TikTok Video URL
              </h2>
            </div>
            <span className="text-[11px] text-[#252943]/50">Public TikTok videos only</span>
          </div>

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

        {/* STEP 2: EXACT DELIVERY SCHEDULE */}
        <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DEE0ED]">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#3A4EFB] text-white text-xs font-black flex items-center justify-center">
                2
              </span>
              <div>
                <h2 className="text-sm font-extrabold text-[#252943]">
                  Exact Delivery Schedule & Quantities
                </h2>
                <p className="text-[11px] text-[#252943]/60">
                  Every batch is randomized between 150–220 views and 12–16 likes. What you see below is exactly what will be sent!
                </p>
              </div>
            </div>

            {/* Re-roll Button */}
            <button
              type="button"
              onClick={rerollPlan}
              className="px-3 py-1.5 rounded-xl bg-[#F8F9FD] hover:bg-[#EEF1FB] border border-[#DEE0ED] text-xs font-bold text-[#3A4EFB] transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              title="Shuffle randomized quantities within 150-220 & 12-16 bounds"
            >
              <Dices className="w-3.5 h-3.5 text-[#3A4EFB]" />
              <span>Shuffle Plan</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED]">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">Exact Total Views</span>
              <span className="text-base font-black text-blue-700 font-mono">
                {totalViews.toLocaleString()} Views
              </span>
              <span className="text-[10px] text-[#252943]/50 block">16 batches (150–220 each)</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">Exact Total Likes</span>
              <span className="text-base font-black text-rose-600 font-mono">
                {totalLikes} Likes
              </span>
              <span className="text-[10px] text-[#252943]/50 block">3 waves (12–16 each)</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">Total Duration</span>
              <span className="text-base font-black text-[#252943] font-mono">
                5.0 Hours
              </span>
              <span className="text-[10px] text-[#252943]/50 block">Batches every 20 min</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">Likes Completion</span>
              <span className="text-base font-black text-emerald-700 font-mono">
                At 280 min
              </span>
              <span className="text-[10px] text-emerald-800/70 font-semibold block">Before final views batch!</span>
            </div>
          </div>

          {/* Clear, Scrollable Batches Table */}
          <div className="border border-[#DEE0ED] rounded-2xl overflow-hidden">
            <div className="max-h-[380px] overflow-y-auto divide-y divide-[#DEE0ED]/70">
              {scheduleRows.map((row) => (
                <div
                  key={row.runNumber}
                  className={`p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                    row.likeQty ? "bg-rose-50/40 hover:bg-rose-50/70" : "hover:bg-[#F8F9FD]"
                  }`}
                >
                  {/* Left: Timing & Batch # */}
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-gray-100 text-[#252943] font-black text-[11px] flex items-center justify-center shrink-0">
                      #{row.runNumber}
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#252943]">
                          +{row.minuteOffset} min
                        </span>
                        <span className="text-[10px] text-[#252943]/60 font-mono">
                          ({row.clockTime})
                        </span>
                      </div>
                      <p className="text-[10px] text-[#252943]/60">
                        {row.note}
                      </p>
                    </div>
                  </div>

                  {/* Right: Exact Delivery Amounts */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    {/* Views Amount */}
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black font-mono bg-blue-100/70 text-blue-800 border border-blue-200">
                      {row.viewQty} Views
                    </span>

                    {/* Likes Amount (if active in this run) */}
                    {row.likeQty && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-black font-mono bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1 animate-pulse">
                        <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                        <span>+{row.likeQty} Likes (Wave #{row.likeWaveNumber})</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delayed Likes Protection Explainer */}
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-950">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-900/90 leading-relaxed">
              <strong>Delayed Likes Protection is Active:</strong> If views surge between 500 and 700 early, the system immediately pulls forward the next likes wave to keep the organic ratio in natural balance.
            </p>
          </div>
        </div>

        {/* STEP 3: PRICE BREAKDOWN & LAUNCH */}
        <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#DEE0ED]">
            <span className="w-6 h-6 rounded-lg bg-[#3A4EFB] text-white text-xs font-black flex items-center justify-center">
              3
            </span>
            <h2 className="text-sm font-extrabold text-[#252943]">
              Confirm & Launch
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED]">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">Total Campaign Price</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#3A4EFB] font-mono">
                  ₹{exactTotalCost.toFixed(2)}
                </span>
                <span className="text-[11px] text-[#252943]/60">
                  (Views: ₹{exactViewsCost.toFixed(2)} • Likes: ₹{exactLikesCost.toFixed(2)})
                </span>
              </div>
            </div>

            <div className="text-left sm:text-right space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">Your Wallet Balance</span>
              <div className="flex items-center sm:justify-end gap-1.5">
                <span className={`text-sm font-black font-mono ${hasSufficientFunds ? "text-emerald-700" : "text-rose-600"}`}>
                  ₹{walletBalance.toFixed(2)}
                </span>
                {hasSufficientFunds ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Sufficient
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                    Top Up Required
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Launch Button */}
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
                <span>Top Up Wallet (Need ₹{(exactTotalCost - walletBalance).toFixed(2)})</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Launch TikTok Campaign (₹{exactTotalCost.toFixed(2)})</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

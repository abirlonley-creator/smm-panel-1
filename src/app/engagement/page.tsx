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
  Bookmark,
  Share2,
  ChevronDown,
  ChevronUp,
  Dices,
  Sparkles,
  Calendar,
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
  rates?: {
    viewsRate: number;
    likesRate: number;
    savesRate: number;
    sharesRate: number;
  };
  presets?: any[];
  config: any;
  pricing: any;
}

// Preset definitions on the client
interface PresetOption {
  id: string;
  name: string;
  tagline: string;
  badge: string;
  durationLabel: string;
  durationHours: number;
  views: { count: number; min: number; max: number; interval: number };
  likes: { count: number; min: number; max: number; offsets: number[] };
  saves?: { count: number; min: number; max: number; offsets: number[] };
  shares?: { count: number; min: number; max: number; offsets: number[] };
  syncThreshold: { minViews: number; maxViews: number };
}

const PRESET_OPTIONS: Record<string, PresetOption> = {
  tiktok_2k: {
    id: "tiktok_2k",
    name: "TikTok 1st Working 2K",
    tagline: "Calibrated 5-Hour Organic Pacing for Starter Posts",
    badge: "5.0 Hours",
    durationLabel: "5.0 Hours",
    durationHours: 5.0,
    views: { count: 16, min: 150, max: 220, interval: 20 },
    likes: { count: 3, min: 12, max: 16, offsets: [120, 200, 280] },
    syncThreshold: { minViews: 500, maxViews: 700 },
  },
  tiktok_5k: {
    id: "tiktok_5k",
    name: "TikTok Organic Velocity 5K",
    tagline: "1-Day FYP Momentum with Views, Likes, Saves & Reposts",
    badge: "1 Day (16h)",
    durationLabel: "16.0 Hours (1 Day)",
    durationHours: 16.0,
    views: { count: 22, min: 210, max: 260, interval: 40 },
    likes: { count: 5, min: 26, max: 34, offsets: [120, 240, 400, 560, 720] },
    saves: { count: 3, min: 10, max: 14, offsets: [180, 360, 600] },
    shares: { count: 2, min: 6, max: 10, offsets: [300, 540] },
    syncThreshold: { minViews: 1000, maxViews: 1500 },
  },
  tiktok_10k: {
    id: "tiktok_10k",
    name: "TikTok FYP Breakthrough 10K",
    tagline: "Full 24-Hour Virality with High-Retention Saves & Reposts",
    badge: "1 Day (22h)",
    durationLabel: "22.0 Hours (1 Day)",
    durationHours: 22.0,
    views: { count: 30, min: 320, max: 380, interval: 40 },
    likes: { count: 7, min: 50, max: 60, offsets: [120, 280, 440, 600, 760, 920, 1080] },
    saves: { count: 5, min: 15, max: 19, offsets: [200, 400, 640, 840, 1040] },
    shares: { count: 3, min: 10, max: 14, offsets: [360, 680, 1000] },
    syncThreshold: { minViews: 2000, maxViews: 3000 },
  },
  tiktok_50k: {
    id: "tiktok_50k",
    name: "TikTok Viral Mega 50K",
    tagline: "2-Day (48-Hour) Full Viral Simulation across International Timezones",
    badge: "2 Days (48h)",
    durationLabel: "48.0 Hours (2 Days)",
    durationHours: 48.0,
    views: { count: 50, min: 900, max: 1100, interval: 56 },
    likes: { count: 12, min: 160, max: 190, offsets: [120, 360, 600, 840, 1080, 1320, 1560, 1800, 2040, 2280, 2520, 2760] },
    saves: { count: 9, min: 45, max: 55, offsets: [240, 540, 840, 1140, 1440, 1740, 2040, 2340, 2640] },
    shares: { count: 6, min: 25, max: 35, offsets: [360, 780, 1200, 1620, 2040, 2460] },
    syncThreshold: { minViews: 5000, maxViews: 8000 },
  },
};

function generatePlanForPreset(p: PresetOption) {
  const views: number[] = [];
  for (let i = 0; i < p.views.count; i++) {
    views.push(Math.floor(Math.random() * (p.views.max - p.views.min + 1)) + p.views.min);
  }

  const likes: number[] = [];
  for (let i = 0; i < p.likes.count; i++) {
    likes.push(Math.floor(Math.random() * (p.likes.max - p.likes.min + 1)) + p.likes.min);
  }

  const saves: number[] = [];
  if (p.saves) {
    for (let i = 0; i < p.saves.count; i++) {
      saves.push(Math.floor(Math.random() * (p.saves.max - p.saves.min + 1)) + p.saves.min);
    }
  }

  const shares: number[] = [];
  if (p.shares) {
    for (let i = 0; i < p.shares.count; i++) {
      shares.push(Math.floor(Math.random() * (p.shares.max - p.shares.min + 1)) + p.shares.min);
    }
  }

  return { views, likes, saves, shares };
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
  const [selectedPresetId, setSelectedPresetId] = useState<string>("tiktok_2k");
  const [targetUrl, setTargetUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<any | null>(null);
  const [showApiDetails, setShowApiDetails] = useState(false);

  const currentPreset = PRESET_OPTIONS[selectedPresetId] || PRESET_OPTIONS.tiktok_2k;

  const [plannedSchedule, setPlannedSchedule] = useState<{
    views: number[];
    likes: number[];
    saves: number[];
    shares: number[];
  }>(() => generatePlanForPreset(PRESET_OPTIONS.tiktok_2k));

  const [planTimestamp, setPlanTimestamp] = useState<Date>(new Date());

  // Re-generate plan when preset changes
  function switchPreset(presetId: string) {
    setSelectedPresetId(presetId);
    const p = PRESET_OPTIONS[presetId] || PRESET_OPTIONS.tiktok_2k;
    setPlannedSchedule(generatePlanForPreset(p));
    setPlanTimestamp(new Date());
  }

  function rerollPlan() {
    setPlannedSchedule(generatePlanForPreset(currentPreset));
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

  // Compute exact totals dynamically
  const totalViews = useMemo(
    () => plannedSchedule.views.reduce((a, b) => a + b, 0),
    [plannedSchedule.views]
  );
  const totalLikes = useMemo(
    () => plannedSchedule.likes.reduce((a, b) => a + b, 0),
    [plannedSchedule.likes]
  );
  const totalSaves = useMemo(
    () => plannedSchedule.saves.reduce((a, b) => a + b, 0),
    [plannedSchedule.saves]
  );
  const totalShares = useMemo(
    () => plannedSchedule.shares.reduce((a, b) => a + b, 0),
    [plannedSchedule.shares]
  );

  const viewsRate = statusData?.rates?.viewsRate ?? (statusData?.pricing?.viewsRate ?? 5.7);
  const likesRate = statusData?.rates?.likesRate ?? (statusData?.pricing?.likesRate ?? 0.88);
  const savesRate = statusData?.rates?.savesRate ?? 0.22;
  const sharesRate = statusData?.rates?.sharesRate ?? 0.22;

  const exactViewsCost = Number(((totalViews / 1000) * viewsRate).toFixed(4));
  const exactLikesCost = Number(((totalLikes / 1000) * likesRate).toFixed(4));
  const exactSavesCost = totalSaves > 0 ? Number(((totalSaves / 1000) * savesRate).toFixed(4)) : 0;
  const exactSharesCost = totalShares > 0 ? Number(((totalShares / 1000) * sharesRate).toFixed(4)) : 0;
  const exactTotalCost = Number((exactViewsCost + exactLikesCost + exactSavesCost + exactSharesCost).toFixed(2));

  const walletBalance = statusData?.walletBalance ?? 0;
  const zeofame = statusData?.zeofame;
  const xmedia = statusData?.xmedia;
  const hasSufficientFunds = walletBalance >= exactTotalCost;
  const isReady = Boolean(statusData?.readyToOrder);

  // Build the batch rows
  const scheduleRows = useMemo(() => {
    const rows: Array<{
      runNumber: number;
      minuteOffset: number;
      clockTime: string;
      viewQty: number;
      likeQty?: number;
      likeWave?: number;
      saveQty?: number;
      saveWave?: number;
      shareQty?: number;
      shareWave?: number;
      note?: string;
    }> = [];

    // Map likes by offset
    const likesMap = new Map<number, { qty: number; wave: number }>();
    currentPreset.likes.offsets.forEach((offset, idx) => {
      if (plannedSchedule.likes[idx]) {
        likesMap.set(offset, { qty: plannedSchedule.likes[idx], wave: idx + 1 });
      }
    });

    // Map saves by offset
    const savesMap = new Map<number, { qty: number; wave: number }>();
    if (currentPreset.saves) {
      currentPreset.saves.offsets.forEach((offset, idx) => {
        if (plannedSchedule.saves[idx]) {
          savesMap.set(offset, { qty: plannedSchedule.saves[idx], wave: idx + 1 });
        }
      });
    }

    // Map shares by offset
    const sharesMap = new Map<number, { qty: number; wave: number }>();
    if (currentPreset.shares) {
      currentPreset.shares.offsets.forEach((offset, idx) => {
        if (plannedSchedule.shares[idx]) {
          sharesMap.set(offset, { qty: plannedSchedule.shares[idx], wave: idx + 1 });
        }
      });
    }

    plannedSchedule.views.forEach((viewQty, index) => {
      const runNumber = index + 1;
      const minuteOffset = index * currentPreset.views.interval;
      const clockTime = formatBdTime(minuteOffset, planTimestamp);

      // Check if any engagement waves land on or near this view batch
      const likeInfo = likesMap.get(minuteOffset);
      const saveInfo = savesMap.get(minuteOffset);
      const shareInfo = sharesMap.get(minuteOffset);

      let note = "";
      if (runNumber === 1) {
        note = "Instant Launch • View batch #1 dispatches immediately";
      } else if (runNumber === Math.ceil(currentPreset.views.count * 0.25)) {
        note = `Views crossing ${currentPreset.syncThreshold.minViews}+ • Delayed Likes Protection active`;
      } else if (runNumber === currentPreset.views.count) {
        note = "Final Views Batch • Campaign 100% Completed";
      }

      rows.push({
        runNumber,
        minuteOffset,
        clockTime,
        viewQty,
        likeQty: likeInfo?.qty,
        likeWave: likeInfo?.wave,
        saveQty: saveInfo?.qty,
        saveWave: saveInfo?.wave,
        shareQty: shareInfo?.qty,
        shareWave: shareInfo?.wave,
        note,
      });
    });

    // Also include any engagement waves that don't fall directly on a view run minute
    // (Ensure everything is visible)
    return rows;
  }, [plannedSchedule, planTimestamp, currentPreset]);

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
          presetId: currentPreset.id,
          presetName: currentPreset.name,
          platform: "TikTok",
          plannedViews: plannedSchedule.views,
          plannedLikes: plannedSchedule.likes,
          plannedSaves: plannedSchedule.saves,
          plannedShares: plannedSchedule.shares,
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
          <p className="text-xs text-[#252943]/60 mt-0.5">Connecting Xmedia Views & Zeofame Likes/Saves...</p>
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
              1-Day & 2-Day Calibrated Virality
            </span>
          </div>
          <p className="text-xs text-[#252943]/70">
            Coordinated Views (Xmedia #10322) with Likes (#1123), Saves (#807), and Reposts (#718) on Zeofame.
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
            <span>{isReady ? "Dual APIs Active" : "API Setup Required"}</span>
            {showApiDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
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
                  <h4 className="text-xs font-bold text-[#252943]">Zeofame (Likes, Saves & Reposts)</h4>
                  <span className="text-[10px] text-[#252943]/60">Services #1123, #807, #718</span>
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
                  Order ID: <strong className="font-mono">#{successReceipt.orderRef}</strong> • Preset: <strong>{successReceipt.presetName}</strong> ({successReceipt.durationHours}h).
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

      {/* 2. PRESET TIER SELECTOR: 2K, 5K, 10K, 50K */}
      <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DEE0ED]">
          <div>
            <h2 className="text-sm font-extrabold text-[#252943] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#3A4EFB]" />
              <span>Select Organic Virality Tier</span>
            </h2>
            <p className="text-[11px] text-[#252943]/60">
              Calibrated pacing ensures traffic looks 100% human to TikTok algorithms (1 Day for normal orders, 2 Days for 50K).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.values(PRESET_OPTIONS).map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => switchPreset(preset.id)}
                className={`p-4 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? "bg-[#3A4EFB]/5 border-[#3A4EFB] shadow-sm ring-1 ring-[#3A4EFB]"
                    : "bg-[#F8F9FD] border-[#DEE0ED] hover:bg-white hover:border-[#3A4EFB]/50"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      isSelected ? "bg-[#3A4EFB] text-white" : "bg-gray-200 text-gray-700"
                    }`}>
                      {preset.badge}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-[#3A4EFB] stroke-[3]" />}
                  </div>

                  <div>
                    <h3 className="font-extrabold text-xs text-[#252943]">
                      {preset.name}
                    </h3>
                    <p className="text-[10px] text-[#252943]/60 mt-0.5 line-clamp-2">
                      {preset.tagline}
                    </p>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-[#DEE0ED]/60 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-blue-700 font-mono">
                    {preset.id === "tiktok_2k" ? "~3k Views" : preset.id === "tiktok_5k" ? "~5k Views" : preset.id === "tiktok_10k" ? "~10k Views" : "~50k Views"}
                  </span>
                  <span className="text-[10px] text-[#252943]/50">
                    {preset.views.count} Batches
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. THREE-STEP WORKSPACE: Clear, uncluttered, intuitive */}
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
                  Exact Delivery Schedule & Quantities ({currentPreset.name})
                </h2>
                <p className="text-[11px] text-[#252943]/60">
                  Every batch is randomized within safe algorithmic limits. What you see below is exactly what will be sent!
                </p>
              </div>
            </div>

            {/* Re-roll Button */}
            <button
              type="button"
              onClick={rerollPlan}
              className="px-3 py-1.5 rounded-xl bg-[#F8F9FD] hover:bg-[#EEF1FB] border border-[#DEE0ED] text-xs font-bold text-[#3A4EFB] transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              title="Shuffle randomized quantities within bounds"
            >
              <Dices className="w-3.5 h-3.5 text-[#3A4EFB]" />
              <span>Shuffle Plan</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED]">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">Exact Views</span>
              <span className="text-base font-black text-blue-700 font-mono">
                {totalViews.toLocaleString()}
              </span>
              <span className="text-[10px] text-[#252943]/50 block">{currentPreset.views.count} batches</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">Exact Likes</span>
              <span className="text-base font-black text-rose-600 font-mono">
                {totalLikes}
              </span>
              <span className="text-[10px] text-[#252943]/50 block">{currentPreset.likes.count} waves</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">Saves</span>
              <span className="text-base font-black text-amber-700 font-mono">
                {totalSaves > 0 ? totalSaves : "—"}
              </span>
              <span className="text-[10px] text-[#252943]/50 block">
                {currentPreset.saves ? `${currentPreset.saves.count} waves` : "Not in tier"}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">Reposts</span>
              <span className="text-base font-black text-purple-700 font-mono">
                {totalShares > 0 ? totalShares : "—"}
              </span>
              <span className="text-[10px] text-[#252943]/50 block">
                {currentPreset.shares ? `${currentPreset.shares.count} waves` : "Not in tier"}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">Duration</span>
              <span className="text-base font-black text-emerald-700 font-mono">
                {currentPreset.durationLabel}
              </span>
              <span className="text-[10px] text-emerald-800/70 font-semibold block">Natural Decay Pacing</span>
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
                      {row.note && (
                        <p className="text-[10px] text-[#252943]/60">
                          {row.note}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Exact Delivery Amounts */}
                  <div className="flex items-center flex-wrap gap-2 self-end sm:self-auto shrink-0">
                    {/* Views Amount */}
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black font-mono bg-blue-100/70 text-blue-800 border border-blue-200">
                      {row.viewQty} Views
                    </span>

                    {/* Likes Amount */}
                    {row.likeQty && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-black font-mono bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1 animate-pulse">
                        <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                        <span>+{row.likeQty} Likes (Wave #{row.likeWave})</span>
                      </span>
                    )}

                    {/* Saves Amount */}
                    {row.saveQty && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-black font-mono bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <Bookmark className="w-3 h-3 fill-amber-500 text-amber-500" />
                        <span>+{row.saveQty} Saves</span>
                      </span>
                    )}

                    {/* Reposts Amount */}
                    {row.shareQty && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-black font-mono bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                        <Share2 className="w-3 h-3 text-purple-600" />
                        <span>+{row.shareQty} Reposts</span>
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
              <strong>Delayed Likes Protection is Active:</strong> If views surge past {currentPreset.syncThreshold.minViews.toLocaleString()} early, the system immediately pulls forward the next likes and saves wave to preserve natural organic ratios.
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
              Confirm & Launch ({currentPreset.name})
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
                  (Views: ₹{exactViewsCost.toFixed(2)} • Likes: ₹{exactLikesCost.toFixed(2)}{exactSavesCost > 0 ? ` • Saves: ₹${exactSavesCost.toFixed(2)}` : ""}{exactSharesCost > 0 ? ` • Reposts: ₹${exactSharesCost.toFixed(2)}` : ""})
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
                <span>Scheduling Campaign Batches...</span>
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
                <span>Launch {currentPreset.name} (₹{exactTotalCost.toFixed(2)})</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

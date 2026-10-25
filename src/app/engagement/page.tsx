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
  Plus,
  Minus,
  Check,
  HelpCircle
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
  validateCustomDuration,
  formatDurationHours,
  computeAutoDuration,
} from "@/lib/engagement/platform-profiles";
import { EngagementDetailChart } from "@/components/engagement/EngagementDetailChart";

const FRIENDLY_ARCHETYPE_NAMES: Record<string, string> = {
  classic: "Gentle start, steady middle, slow finish",
  "double-wave": "Two natural waves with secondary surge",
  "stall-and-surge": "Exploration phase followed by viral surge",
  "slow-ramp": "Gradual organic buildup over time",
  "early-spike": "Front-loaded initial push with smooth tail",
};

export default function FullEngagementPage() {
  const router = useRouter();

  // Platform & Profile State
  const [activePlatformTab, setActivePlatformTab] = useState<"Instagram" | "TikTok">("Instagram");
  const [profileId, setProfileId] = useState<string>("instagram_reel");
  const [presetKey, setPresetKey] = useState<ProfilePresetKey>("normal");
  const [pacingMode, setPacingMode] = useState<"auto" | "custom">("auto");
  const [customSpeedPreset, setCustomSpeedPreset] = useState<"faster" | "slower" | "exact">("faster");
  const [customExactHours, setCustomExactHours] = useState<number>(24);
  const [showCustomSpeedWarning, setShowCustomSpeedWarning] = useState<boolean>(false);
  const [pendingCustomAction, setPendingCustomAction] = useState<(() => void) | null>(null);
  const [customSpeedError, setCustomSpeedError] = useState<string | null>(null);
  const [isCustomSpeedExpanded, setIsCustomSpeedExpanded] = useState<boolean>(false);
  const [baseViews, setBaseViews] = useState<number>(1000);
  const [targetUrl, setTargetUrl] = useState("");
  const [targetTz, setTargetTz] = useState("Asia/Kolkata");
  const [peakHourWeighting, setPeakHourWeighting] = useState<boolean>(true);
  const [seed, setSeed] = useState<string>(() => `dhansmm_${Date.now()}`);
  const [showExplainer, setShowExplainer] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Type toggles (Views is always on)
  const [typeToggles, setTypeToggles] = useState<Record<EngagementType, boolean>>({
    views: true,
    likes: true,
    saves: true,
    shares: true,
    comments: true,
  });

  // Custom Quantities & Source Flags
  const [customQuantities, setCustomQuantities] = useState<Partial<Record<EngagementType, number>>>({});
  const [customSources, setCustomSources] = useState<Record<EngagementType, "suggested" | "custom">>({
    views: "suggested",
    likes: "suggested",
    saves: "suggested",
    shares: "suggested",
    comments: "suggested",
  });

  // Wallet and Plan State
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [plan, setPlan] = useState<OrganicPlanResult | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // User Provider Engagement Mappings State (Change 13)
  const [mappings, setMappings] = useState<Record<string, any>>({});
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [userProviders, setUserProviders] = useState<{ id: string; name: string }[]>([]);
  const [loadingMappings, setLoadingMappings] = useState<boolean>(true);
  const [openServicePickerFor, setOpenServicePickerFor] = useState<string | null>(null);
  const [savingMappingType, setSavingMappingType] = useState<string | null>(null);

  // Active view tab for analytics preview: "cumulative" | "ratio" | "timeline" | "runs"
  const [previewTab, setPreviewTab] = useState<"cumulative" | "ratio" | "timeline" | "runs">("cumulative");
  const [selectedRunType, setSelectedRunType] = useState<EngagementType>("views");

  // Fetch User Engagement Mappings from Connected Providers
  const fetchMappings = async () => {
    setLoadingMappings(true);
    try {
      const res = await fetch(`/api/engagement/mappings?platform=${activePlatformTab}`);
      const data = await res.json();
      if (data.success) {
        const map: Record<string, any> = {};
        for (const m of data.mappings || []) {
          map[m.engagementType] = m;
        }
        setMappings(map);
        setAvailableServices(data.availableServices || []);
        setUserProviders(data.userProviders || []);
      }
    } catch (err) {
      console.error("Failed to load engagement mappings", err);
    } finally {
      setLoadingMappings(false);
    }
  };

  useEffect(() => {
    fetchMappings();
  }, [activePlatformTab]);

  // Load last toggles per platform from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`dhansmm_toggles_${activePlatformTab.toLowerCase()}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setTypeToggles((prev) => ({ ...prev, ...parsed, views: true }));
      }
    } catch {}
  }, [activePlatformTab]);

  function handleToggleType(type: EngagementType) {
    if (type === "views") return; // Views is always on
    const nextVal = !typeToggles[type];
    const updated = { ...typeToggles, [type]: nextVal };
    setTypeToggles(updated);
    try {
      localStorage.setItem(`dhansmm_toggles_${activePlatformTab.toLowerCase()}`, JSON.stringify(updated));
    } catch {}
  }

  // Handle service mapping save
  async function handleSelectServiceMapping(type: EngagementType, srv: any) {
    setSavingMappingType(type);
    try {
      const res = await fetch("/api/engagement/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: activePlatformTab,
          engagementType: type,
          providerId: srv.providerId,
          providerServiceId: srv.providerServiceId,
          active: true,
        }),
      });
      const data = await res.json();
      if (data.success && data.mapping) {
        setMappings((prev) => ({
          ...prev,
          [type]: data.mapping,
        }));
        setOpenServicePickerFor(null);
        // Force refresh preview pattern
        setSeed(`dhansmm_${Date.now()}`);
      } else {
        setErrorMsg(data.error || "Failed to save service mapping");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save service mapping");
    } finally {
      setSavingMappingType(null);
    }
  }

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
      } catch {}
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
        const activeTypes = (["views", "likes", "saves", "shares", "comments"] as EngagementType[]).filter(
          (t) => typeToggles[t] !== false
        );

        const res = await fetch("/api/engagement/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileId,
            platform: activePlatformTab,
            presetKey,
            pacingMode,
            customSpeedPreset: pacingMode === "custom" ? customSpeedPreset : undefined,
            customDurationHours: pacingMode === "custom" && customSpeedPreset === "exact" ? customExactHours : undefined,
            baseViews: Number(baseViews),
            seed,
            targetTz,
            peakHourWeighting,
            enabledTypes: activeTypes,
            typeToggles,
            customQuantities,
            customSources,
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
  }, [profileId, activePlatformTab, presetKey, pacingMode, customSpeedPreset, customExactHours, baseViews, seed, targetTz, peakHourWeighting, typeToggles, customQuantities, customSources]);

  async function handleNewPattern() {
    setLoadingPlan(true);
    try {
      const activeTypes = (["views", "likes", "saves", "shares", "comments"] as EngagementType[]).filter(
        (t) => typeToggles[t] !== false
      );

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
          enabledTypes: activeTypes,
          typeToggles,
          customQuantities,
          customSources,
          previousFingerprint: plan?.params.fingerprint,
        }),
      });
      const data = await res.json();
      if (data.success && data.plan) {
        setPlan(data.plan);
        setSeed(String(data.plan.seed));
      }
    } catch {
      setSeed(`dhansmm_${Date.now()}_${Math.floor(Math.random() * 100000)}`);
    } finally {
      setLoadingPlan(false);
    }
  }

  // Handle Custom Quantity Input
  function handleQuantityChange(type: EngagementType, newQuantity: number) {
    const srv = currentProfile.serviceMappings[type];
    const capped = srv && srv.maxQuantity ? Math.min(newQuantity, srv.maxQuantity) : newQuantity;
    const finalVal = Math.max(0, Math.round(capped));

    if (type === "views") {
      setBaseViews(Math.max(100, finalVal));
      return;
    }

    setCustomQuantities((prev) => ({
      ...prev,
      [type]: finalVal,
    }));
    setCustomSources((prev) => ({
      ...prev,
      [type]: "custom",
    }));
  }

  function handleResetTypeToSuggested(type: EngagementType) {
    setCustomSources((prev) => ({
      ...prev,
      [type]: "suggested",
    }));
    setCustomQuantities((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  }

  function handleResetAllToSuggested() {
    setCustomSources({
      views: "suggested",
      likes: "suggested",
      saves: "suggested",
      shares: "suggested",
      comments: "suggested",
    });
    setCustomQuantities({});
  }

  function handleUseMinimum(type: EngagementType, minQty: number) {
    handleQuantityChange(type, minQty);
    setTypeToggles((prev) => ({ ...prev, [type]: true }));
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
      const needed = (plan.totalCost - walletBalance).toFixed(2);
      setErrorMsg(
        `Your wallet balance is ₹${walletBalance.toFixed(2)}. Total required is ₹${plan.totalCost.toFixed(2)}. Please add ₹${needed} to complete this order.`
      );
      return;
    }

    const activeTypes = (["views", "likes", "saves", "shares", "comments"] as EngagementType[]).filter(
      (t) => typeToggles[t] !== false
    );

    const missingOrDisconnected = activeTypes.filter((t) => !mappings[t] || mappings[t].disconnected);
    if (missingOrDisconnected.length > 0) {
      const names = missingOrDisconnected.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(", ");
      setErrorMsg(`Please pick a connected service for ${names} before scheduling delivery, or switch them off.`);
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
          pacingMode,
          customSpeedPreset: pacingMode === "custom" ? customSpeedPreset : undefined,
          customDurationHours: pacingMode === "custom" && customSpeedPreset === "exact" ? customExactHours : undefined,
          baseViews: Number(baseViews),
          durationPreset: plan.durationPreset,
          durationHours: plan.durationHours,
          seed: plan.seed,
          targetTz,
          peakHourWeighting,
          enabledTypes: activeTypes,
          typeToggles,
          customQuantities,
          customSources,
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

    const maxRatio = Math.max(
      8.0,
      (plan.params.ratios.likes || 0.05) * 100 * 1.25,
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
      likesTargetY: getY((plan.params.ratios.likes || 0) * 100),
      savesTargetY: getY((plan.params.ratios.saves || 0) * 100),
      sharesTargetY: getY((plan.params.ratios.shares || 0) * 100),
      commentsTargetY: getY((plan.params.ratios.comments || 0) * 100),
    };
  }, [plan]);

  const hasInsufficientBalance = walletBalance !== null && plan !== null && walletBalance < plan.totalCost;
  const fundsNeeded = plan && walletBalance !== null ? Math.max(0, plan.totalCost - walletBalance) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-24">
      {/* Top Reassurance Banner */}
      <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 flex items-center justify-between gap-3 text-xs shadow-sm">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#3A4EFB] shrink-0" />
          <span className="font-semibold text-[#252943]">
            Nothing is charged until you confirm. You can cancel anytime, and unsent batches are refunded.
          </span>
        </div>
        <span className="hidden md:inline-block text-[11px] font-bold text-[#3A4EFB] bg-white px-2.5 py-1 rounded-lg border border-blue-200 shrink-0">
          Natural-looking delivery
        </span>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DEE0ED]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#252943] flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#3A4EFB]" />
            Full Engagement Engine
          </h1>
          <p className="text-xs text-[#252943]/60 mt-0.5">
            Synchronized organic delivery for views, likes, saves, shares, and comments with realistic viewer behavior.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/engagement/orders"
            className="px-3.5 py-2 rounded-xl border border-[#DEE0ED] text-xs font-semibold text-[#252943]/80 hover:bg-[#F8F9FD] flex items-center gap-1.5 transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-[#3A4EFB]" />
            <span>Orders & Timeline</span>
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

      {/* Calm Error / Insufficient Funds Message */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-medium text-amber-900 flex items-start justify-between gap-3 shadow-subtle animate-fadeIn">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Notice</span>
              <p>{errorMsg}</p>
              {hasInsufficientBalance && (
                <div className="pt-1">
                  <Link
                    href={`/wallet?add=${fundsNeeded.toFixed(2)}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3A4EFB] text-white text-xs font-bold hover:bg-[#2C3FE0]"
                  >
                    <span>Add ₹{fundsNeeded.toFixed(2)} to Wallet</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-amber-700 font-bold hover:underline shrink-0 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* 3-Step Simple Layout */}
      <form onSubmit={handleSubmitOrder} className="space-y-6">
        {/* STEP 1: Choose Platform and Paste Link */}
        <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-[#DEE0ED]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#3A4EFB] flex items-center gap-1.5">
              <Zap className="w-4 h-4" />
              Step 1: Choose Platform & Link
            </span>
            <span className="text-xs text-[#252943]/50">Where should we deliver engagement?</span>
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
                  <span className="text-xs sm:text-sm">{plat}</span>
                </div>
                {activePlatformTab === plat && (
                  <span className="w-2 h-2 rounded-full bg-[#E3FF3B]" />
                )}
              </button>
            ))}
          </div>

          {/* Instagram Content Format */}
          {activePlatformTab === "Instagram" && (
            <div className="p-3 bg-[#F8F9FD] rounded-2xl border border-[#DEE0ED] space-y-2">
              <span className="text-[11px] font-bold text-[#252943]/80 block">Content Format:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setProfileId("instagram_reel")}
                  className={`p-2.5 rounded-xl text-left transition-all text-xs font-semibold border ${
                    profileId === "instagram_reel"
                      ? "bg-white border-[#3A4EFB] text-[#252943] shadow-sm ring-1 ring-[#3A4EFB]"
                      : "bg-white/60 border-[#DEE0ED] text-[#252943]/60 hover:bg-white"
                  }`}
                >
                  <span className="font-bold block text-[#252943]">🎬 Instagram Reel</span>
                  <span className="text-[10px] text-[#252943]/60">Multi-wave organic pacing (Normal: 72h)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setProfileId("instagram_post")}
                  className={`p-2.5 rounded-xl text-left transition-all text-xs font-semibold border ${
                    profileId === "instagram_post"
                      ? "bg-white border-[#3A4EFB] text-[#252943] shadow-sm ring-1 ring-[#3A4EFB]"
                      : "bg-white/60 border-[#DEE0ED] text-[#252943]/60 hover:bg-white"
                  }`}
                >
                  <span className="font-bold block text-[#252943]">🖼️ Photo / Carousel Post</span>
                  <span className="text-[10px] text-[#252943]/60">Front-loaded organic burst (Normal: 48h)</span>
                </button>
              </div>
            </div>
          )}

          {/* URL & Timezone */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-[#252943]">Post or Video URL *</label>
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
              <label className="text-xs font-semibold text-[#252943]">Audience Timezone</label>
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

          {/* Collapsible "How this works" Explainer */}
          {currentProfile.explainerText && (
            <div className="rounded-xl border border-[#DEE0ED] bg-blue-50/30 overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setShowExplainer(!showExplainer)}
                className="w-full px-4 py-2 flex items-center justify-between font-bold text-[#252943] hover:bg-blue-50/60 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-[#3A4EFB]" />
                  <span>How {currentProfile.name} Natural Delivery Works</span>
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

        {/* STEP 2: Pick Amount, Speed & Engagement Types (Change 8: Editable Quantities) */}
        <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-[#DEE0ED]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#3A4EFB] flex items-center gap-1.5">
              <Sliders className="w-4 h-4" />
              Step 2: Amount, Speed & Quantities
            </span>
            <button
              type="button"
              onClick={handleResetAllToSuggested}
              className="text-xs font-bold text-[#3A4EFB] hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset all to suggested</span>
            </button>
          </div>

          {/* Base Views & Preset Duration Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Views Base */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-[#252943]">Base Views Quantity</label>
                <span className="font-black text-sm text-[#3A4EFB]">
                  {Number(baseViews).toLocaleString()} views
                </span>
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
                {[1000, 2000, 5000, 10000, 50000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setBaseViews(v)}
                    className={`flex-1 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                      baseViews === v
                        ? "bg-[#3A4EFB] text-white border-[#3A4EFB]"
                        : "bg-[#F8F9FD] border-[#DEE0ED] text-[#252943]/70 hover:border-[#3A4EFB]"
                    }`}
                  >
                    {v >= 1000 ? `${v / 1000}k` : v}
                  </button>
                ))}
              </div>
            </div>

            {/* Pacing Speed: Automatic (recommended) default with optional collapsed Custom speed (Change A) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-[#252943]">Delivery Speed</label>
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>Automatic (recommended)</span>
                </span>
              </div>

              {/* Automatic Speed Display Card */}
              <div
                className={`p-3.5 rounded-2xl border transition-all ${
                  pacingMode === "auto"
                    ? "bg-gradient-to-r from-blue-50/60 to-indigo-50/60 border-[#3A4EFB]/40 shadow-xs"
                    : "bg-[#F8F9FD] border-[#DEE0ED]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPacingMode("auto");
                        setIsCustomSpeedExpanded(false);
                      }}
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                        pacingMode === "auto"
                          ? "border-[#3A4EFB] bg-[#3A4EFB] text-white"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {pacingMode === "auto" && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </button>
                    <span className="text-xs font-bold text-[#252943]">
                      Natural Organic Delivery Pace
                    </span>
                  </div>
                  {plan && (
                    <span className="text-xs font-black text-[#3A4EFB] font-mono">
                      ~{plan.durationHours} hours
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#252943]/70 mt-1.5 leading-relaxed font-medium pl-6">
                  Calculated automatically from your {baseViews.toLocaleString()} views so growth looks authentic without sudden spikes.
                </p>
              </div>

              {/* Collapsed Custom Speed Toggle Accordion */}
              <div className="rounded-2xl border border-[#DEE0ED] overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => {
                    if (pacingMode === "auto") {
                      // Trigger confirmation warning modal before applying custom
                      setShowCustomSpeedWarning(true);
                    } else {
                      setIsCustomSpeedExpanded(!isCustomSpeedExpanded);
                    }
                  }}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-[#252943] hover:bg-[#F8F9FD] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#3A4EFB]" />
                    <span>Custom speed (optional)</span>
                    {pacingMode === "custom" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-bold">
                        Custom active
                      </span>
                    )}
                  </div>
                  {isCustomSpeedExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[#252943]/50" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#252943]/50" />
                  )}
                </button>

                {isCustomSpeedExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-[#DEE0ED]/60 space-y-3 bg-[#FAFBFD]">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#252943]/70">
                        Choose custom pace preset:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setPacingMode("auto");
                          setIsCustomSpeedExpanded(false);
                        }}
                        className="text-[10px] font-bold text-[#3A4EFB] hover:underline"
                      >
                        Reset to automatic
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: "faster", label: "Faster", desc: "Shortest safe pace" },
                        { key: "slower", label: "Slower", desc: "Extended organic pace" },
                        { key: "exact", label: "Exact Hours", desc: "Specify hours" },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setCustomSpeedPreset(opt.key as any);
                            if (pacingMode !== "custom") setPacingMode("custom");
                          }}
                          className={`p-2 rounded-xl text-center border text-xs transition-all ${
                            customSpeedPreset === opt.key && pacingMode === "custom"
                              ? "bg-[#252943] text-white border-[#252943] shadow-xs"
                              : "bg-white border-[#DEE0ED] text-[#252943]/70 hover:bg-[#F8F9FD]"
                          }`}
                        >
                          <span className="font-bold block">{opt.label}</span>
                          <span className="text-[9px] opacity-70 block">{opt.desc}</span>
                        </button>
                      ))}
                    </div>

                    {customSpeedPreset === "exact" && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs">
                          <label className="font-bold text-[#252943]">Duration in Hours</label>
                          <span className="font-mono font-bold text-[#3A4EFB]">{customExactHours} hours</span>
                        </div>
                        <input
                          type="number"
                          min="1"
                          max="400"
                          step="1"
                          value={customExactHours}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                            setCustomExactHours(val);
                            const check = validateCustomDuration(currentProfile, baseViews, val);
                            if (!check.valid) {
                              setCustomSpeedError(check.reason || "Duration exceeds natural delivery limit.");
                            } else {
                              setCustomSpeedError(null);
                            }
                          }}
                          className="w-full bg-white border border-[#DEE0ED] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#252943]"
                        />
                      </div>
                    )}

                    {/* Safety check warning if user picked too fast */}
                    {customSpeedError && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block">Safety Pace Limit</span>
                          <p className="text-[11px] leading-relaxed">{customSpeedError}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Editable Quantities & Type Toggles Table */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold text-[#252943] block">
              Engagement Metrics (Toggle on/off, or edit quantities directly):
            </span>

            <div className="space-y-2.5">
              {(["views", "likes", "saves", "shares", "comments"] as const).map((t) => {
                const isViews = t === "views";
                const isEnabled = typeToggles[t] !== false;
                const isCustom = customSources[t] === "custom";
                const mapping = mappings[t];
                const isDisconnected = mapping?.disconnected;
                const hasValidMapping = !!mapping && !isDisconnected;
                const srv = hasValidMapping ? {
                  minQuantity: mapping.minQuantity,
                  maxQuantity: mapping.maxQuantity,
                  ratePer1000: mapping.ratePer1000,
                  name: mapping.serviceName,
                } : currentProfile.serviceMappings[t];
                const range = plan?.suggestedRanges?.[t];
                const note = plan?.autoDisableNotes?.[t];
                const softHint = plan?.softHints?.[t];
                const currentVal = isViews
                  ? baseViews
                  : (isCustom && customQuantities[t] !== undefined ? customQuantities[t]! : (plan?.plans[t]?.totalQuantity ?? 0));

                const typeColor =
                  t === "views" ? "text-blue-600 bg-blue-50" :
                  t === "likes" ? "text-rose-600 bg-rose-50" :
                  t === "saves" ? "text-amber-600 bg-amber-50" :
                  t === "shares" ? "text-indigo-600 bg-indigo-50" : "text-emerald-600 bg-emerald-50";

                const isPickerOpen = openServicePickerFor === t;

                return (
                  <div
                    key={t}
                    className={`p-3.5 rounded-2xl border transition-all space-y-3 ${
                      !isEnabled
                        ? "bg-gray-50/70 border-gray-200 opacity-60"
                        : "bg-white border-[#DEE0ED] shadow-sm"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Toggle & Name */}
                      <div className="flex items-center gap-3">
                        {!isViews ? (
                          <button
                            type="button"
                            onClick={() => handleToggleType(t)}
                            className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
                              isEnabled ? "bg-[#3A4EFB]" : "bg-gray-300"
                            }`}
                          >
                            <div
                              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                                isEnabled ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        ) : (
                          <span className="w-10 text-center font-bold text-[10px] text-blue-600 bg-blue-100 rounded py-0.5">
                            Always On
                          </span>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-bold capitalize ${typeColor}`}>
                            {t}
                          </span>

                          {/* Connected Provider Badge / Mapping Tag */}
                          {hasValidMapping && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] bg-[#F8F9FD] text-[#252943]/80 px-2 py-0.5 rounded-md font-semibold border border-[#DEE0ED] truncate max-w-[200px]">
                                {mapping.providerName} (#{mapping.providerServiceId})
                              </span>
                              <button
                                type="button"
                                onClick={() => setOpenServicePickerFor(isPickerOpen ? null : t)}
                                className="text-[10px] text-[#3A4EFB] font-bold hover:underline"
                              >
                                {isPickerOpen ? "Done" : "Change"}
                              </button>
                            </div>
                          )}

                          {range && !isViews && (
                            <span className="text-[11px] text-[#252943]/60 hidden sm:inline">
                              Suggested: {range.min}–{range.max}
                            </span>
                          )}

                          {isCustom && !isViews && (
                            <div className="flex items-center gap-1">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                Edited
                              </span>
                              <button
                                type="button"
                                onClick={() => handleResetTypeToSuggested(t)}
                                className="text-[10px] text-[#3A4EFB] font-bold hover:underline"
                              >
                                Reset
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Stepper and Input */}
                      {isEnabled && (
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <div className="flex items-center rounded-xl border border-[#DEE0ED] bg-[#F8F9FD] overflow-hidden">
                            <button
                              type="button"
                              onClick={() => {
                                const step = isViews ? 500 : t === "likes" ? 10 : t === "comments" ? 1 : 5;
                                handleQuantityChange(t, Math.max(0, currentVal - step));
                              }}
                              className="px-2.5 py-1.5 hover:bg-[#DEE0ED] text-[#252943]"
                            >
                              <Minus className="w-3 h-3" />
                            </button>

                            <input
                              type="number"
                              min={0}
                              max={srv?.maxQuantity || 10000000}
                              value={currentVal}
                              onChange={(e) => handleQuantityChange(t, parseInt(e.target.value, 10) || 0)}
                              className="w-20 sm:w-24 bg-transparent text-center font-bold text-xs text-[#252943] py-1.5 outline-none"
                            />

                            <button
                              type="button"
                              onClick={() => {
                                const step = isViews ? 500 : t === "likes" ? 10 : t === "comments" ? 1 : 5;
                                handleQuantityChange(t, currentVal + step);
                              }}
                              className="px-2.5 py-1.5 hover:bg-[#DEE0ED] text-[#252943]"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="text-right w-20">
                            <span className="text-xs font-bold text-[#252943] block">
                              ₹{plan?.plans[t]?.totalCost.toFixed(2) || "0.00"}
                            </span>
                            <span className="text-[9px] text-[#252943]/40">
                              {plan?.plans[t]?.runsCount || 0} batches
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Missing Mapping Prompt (Change 13 Requirement) */}
                    {isEnabled && !mapping && !loadingMappings && (
                      <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-[#252943] space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-[#3A4EFB]" />
                            <span className="font-bold text-[#252943]">
                              Pick a service for {t.charAt(0).toUpperCase() + t.slice(1)} to continue
                            </span>
                          </div>
                          {!isViews && (
                            <button
                              type="button"
                              onClick={() => handleToggleType(t)}
                              className="text-[11px] font-semibold text-[#252943]/60 hover:text-[#252943] hover:underline"
                            >
                              Leave {t} off
                            </button>
                          )}
                        </div>

                        {availableServices.length > 0 ? (
                          <select
                            defaultValue=""
                            disabled={savingMappingType === t}
                            onChange={(e) => {
                              const s = availableServices.find(
                                (x) => `${x.providerId}:${x.providerServiceId}` === e.target.value
                              );
                              if (s) handleSelectServiceMapping(t, s);
                            }}
                            className="w-full bg-white border border-[#DEE0ED] rounded-xl px-3 py-2 text-xs font-semibold text-[#252943] focus:border-[#3A4EFB] focus:ring-1 focus:ring-[#3A4EFB]"
                          >
                            <option value="" disabled>Select from your connected catalog services...</option>
                            {availableServices.map((s) => (
                              <option key={`${s.providerId}:${s.providerServiceId}`} value={`${s.providerId}:${s.providerServiceId}`}>
                                {s.providerName} • #{s.providerServiceId} - {s.name} (Min: {s.minQuantity}, Max: {s.maxQuantity}, Rate: ₹{s.ratePer1000}/1k)
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="text-xs text-[#252943]/70 flex items-center justify-between">
                            <span>No catalog services found for {activePlatformTab}. Connect a provider in your Wallet tab.</span>
                            <Link href="/wallet" className="font-bold text-[#3A4EFB] hover:underline ml-2">
                              Go to Wallet &rarr;
                            </Link>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Disconnected Provider Warning (Change 13 Requirement) */}
                    {isEnabled && isDisconnected && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="font-bold">
                              {t.charAt(0).toUpperCase() + t.slice(1)} paused — its provider was disconnected. Pick a replacement service or leave {t} off.
                            </span>
                          </div>
                          {!isViews && (
                            <button
                              type="button"
                              onClick={() => handleToggleType(t)}
                              className="text-[11px] font-bold text-amber-800 hover:underline shrink-0"
                            >
                              Leave {t} off
                            </button>
                          )}
                        </div>

                        {availableServices.length > 0 && (
                          <select
                            defaultValue=""
                            disabled={savingMappingType === t}
                            onChange={(e) => {
                              const s = availableServices.find(
                                (x) => `${x.providerId}:${x.providerServiceId}` === e.target.value
                              );
                              if (s) handleSelectServiceMapping(t, s);
                            }}
                            className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-semibold text-[#252943] focus:border-[#3A4EFB]"
                          >
                            <option value="" disabled>Pick a replacement service...</option>
                            {availableServices.map((s) => (
                              <option key={`${s.providerId}:${s.providerServiceId}`} value={`${s.providerId}:${s.providerServiceId}`}>
                                {s.providerName} • #{s.providerServiceId} - {s.name} (Min: {s.minQuantity}, Rate: ₹{s.ratePer1000}/1k)
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    {/* Dropdown if "Change" clicked */}
                    {isEnabled && hasValidMapping && isPickerOpen && (
                      <div className="p-3 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs space-y-2 animate-fadeIn">
                        <span className="font-bold text-[#252943] block">Choose a different service for {t}:</span>
                        <select
                          defaultValue={`${mapping.providerId}:${mapping.providerServiceId}`}
                          disabled={savingMappingType === t}
                          onChange={(e) => {
                            const s = availableServices.find(
                              (x) => `${x.providerId}:${x.providerServiceId}` === e.target.value
                            );
                            if (s) handleSelectServiceMapping(t, s);
                          }}
                          className="w-full bg-white border border-[#DEE0ED] rounded-xl px-3 py-2 text-xs font-semibold text-[#252943] focus:border-[#3A4EFB]"
                        >
                          {availableServices.map((s) => (
                            <option key={`${s.providerId}:${s.providerServiceId}`} value={`${s.providerId}:${s.providerServiceId}`}>
                              {s.providerName} • #{s.providerServiceId} - {s.name} (Min: {s.minQuantity}, Max: {s.maxQuantity}, Rate: ₹{s.ratePer1000}/1k)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Below-Min Calm Note with Actions */}
                    {note && (
                      <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-[#252943] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Info className="w-3.5 h-3.5 text-[#3A4EFB] shrink-0" />
                          <span>{note}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {srv && srv.minQuantity && (
                            <button
                              type="button"
                              onClick={() => handleUseMinimum(t, srv.minQuantity)}
                              className="px-2.5 py-1 rounded-lg bg-[#3A4EFB] text-white text-[10px] font-bold hover:bg-[#2C3FE0]"
                            >
                              Use minimum ({srv.minQuantity})
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setTypeToggles((prev) => ({ ...prev, [t]: false }))}
                            className="px-2.5 py-1 rounded-lg border border-[#DEE0ED] bg-white text-[10px] font-bold text-[#252943]/70 hover:bg-[#F8F9FD]"
                          >
                            Keep off
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Unrealistic Ratio Soft Hint */}
                    {softHint && (
                      <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>{softHint}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* STEP 3: Review and Confirm Order */}
        {plan && (
          <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-[#DEE0ED]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#3A4EFB] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Step 3: Review & Schedule Delivery
              </span>
              <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                First delivery starts in ~5 minutes
              </span>
            </div>

            {/* Review Summary Glance */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED]">
                <span className="text-[10px] font-bold uppercase text-[#252943]/60 block mb-1">Total Package Price</span>
                <span className="text-xl font-black text-[#252943]">₹{plan.totalCost.toFixed(2)}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED]">
                <span className="text-[10px] font-bold uppercase text-[#252943]/60 block mb-1">Total Runs</span>
                <span className="text-xl font-black text-[#3A4EFB]">{plan.allRuns.length} batches</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED]">
                <span className="text-[10px] font-bold uppercase text-[#252943]/60 block mb-1">First Batch</span>
                <span className="text-xs font-bold text-emerald-600 mt-1 block">Starts in ~5 min</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED]">
                <span className="text-[10px] font-bold uppercase text-[#252943]/60 block mb-1">Estimated Finish</span>
                <span className="text-xs font-bold text-[#252943] mt-1 block">+{plan.durationHours} hours</span>
              </div>
            </div>

            {/* Visual Delivery Curves & Analytics Tabs */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#252943]">
                  Scheduled Delivery Preview:
                </span>

                <div className="flex items-center gap-1 flex-wrap">
                  {(["cumulative", "ratio", "timeline", "runs"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setPreviewTab(tab)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all capitalize ${
                        previewTab === tab
                          ? "bg-[#252943] text-white"
                          : "bg-[#F8F9FD] text-[#252943]/70 hover:bg-[#DEE0ED]"
                      }`}
                    >
                      {tab === "cumulative" ? "S-Curve" : tab === "ratio" ? "Ratios" : tab === "timeline" ? "Timeline" : "Batches"}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleNewPattern}
                    className="px-2.5 py-1 rounded-lg bg-[#3A4EFB] text-white text-xs font-bold ml-1 flex items-center gap-1 hover:bg-[#2C3FE0]"
                  >
                    <RefreshCw className="w-2.5 h-2.5 text-[#E3FF3B]" />
                    <span>New Pattern</span>
                  </button>
                </div>
              </div>

              {/* TAB 1: S-Curve Graph using shared EngagementDetailChart (Change F) */}
              {previewTab === "cumulative" && plan && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-[#252943]/60 pb-1">
                    <span>Cumulative Delivery S-Curve</span>
                    <span className="font-bold text-[#3A4EFB]">Pacing: {FRIENDLY_ARCHETYPE_NAMES[plan.params.archetype] || plan.summaryChips.archetype}</span>
                  </div>

                  <EngagementDetailChart
                    durationHours={plan.durationHours}
                    expectedCurve={plan.curvePoints}
                    runs={plan.allRuns}
                    visibleTypes={typeToggles}
                    onToggleType={handleToggleType}
                    showDelivered={false}
                    showNowMarker={false}
                    height={260}
                  />
                </div>
              )}

              {/* TAB 2: Ratio Chart */}
              {previewTab === "ratio" && svgRatioChart && (
                <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#252943]/60 pb-1">
                    <span>Monotonic Ratio Convergence (delivering safely without early spikes)</span>
                  </div>
                  <svg viewBox="0 0 640 220" className="w-full h-44">
                    <line x1="40" y1="180" x2="600" y2="180" stroke="#DEE0ED" strokeWidth="1" />
                    {svgRatioChart.likesActual && <path d={svgRatioChart.likesActual} fill="none" stroke="#E11D48" strokeWidth="2" />}
                    {svgRatioChart.savesActual && <path d={svgRatioChart.savesActual} fill="none" stroke="#D97706" strokeWidth="2" />}
                    {svgRatioChart.sharesActual && <path d={svgRatioChart.sharesActual} fill="none" stroke="#4F46E5" strokeWidth="2" />}
                    {svgRatioChart.commentsActual && <path d={svgRatioChart.commentsActual} fill="none" stroke="#059669" strokeWidth="2" />}
                  </svg>
                </div>
              )}

              {/* TAB 3: Batch Timeline */}
              {previewTab === "timeline" && (
                <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-2 max-h-60 overflow-y-auto">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {plan.batchTimeline.slice(0, 16).map((b, idx) => (
                      <div key={idx} className="p-2 rounded-xl bg-white border border-[#DEE0ED] space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold capitalize">
                          <span>{b.type}</span>
                          <span className="text-[#3A4EFB]">+{Math.floor(b.minutes / 60)}h</span>
                        </div>
                        <span className="text-xs font-black text-[#252943] block">
                          +{b.quantity.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: Runs Inspector */}
              {previewTab === "runs" && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {(["views", "likes", "shares", "saves", "comments"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedRunType(t)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all capitalize ${
                          selectedRunType === t
                            ? "bg-[#3A4EFB] text-white"
                            : "bg-[#F8F9FD] text-[#252943]/70 hover:bg-[#DEE0ED]"
                        }`}
                      >
                        {t} ({plan.plans[t]?.runsCount || 0})
                      </button>
                    ))}
                  </div>

                  <div className="max-h-52 overflow-y-auto rounded-xl border border-[#DEE0ED]">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#F8F9FD] sticky top-0 border-b border-[#DEE0ED] text-[#252943]/60 font-semibold">
                        <tr>
                          <th className="py-1.5 px-3">Batch #</th>
                          <th className="py-1.5 px-3">Scheduled At</th>
                          <th className="py-1.5 px-3">Size</th>
                          <th className="py-1.5 px-3">Cumulative</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DEE0ED]/60 font-medium">
                        {(plan.plans[selectedRunType]?.runs || []).map((r) => (
                          <tr key={r.runIndex} className="hover:bg-[#F8F9FD]">
                            <td className="py-1.5 px-3 font-bold text-[#252943]">#{r.runIndex}</td>
                            <td className="py-1.5 px-3">+{Math.floor(r.minutesFromStart / 60)}h {r.minutesFromStart % 60}m</td>
                            <td className="py-1.5 px-3 font-bold text-[#252943]">+{r.quantity.toLocaleString()}</td>
                            <td className="py-1.5 px-3 text-[#3A4EFB]">{r.cumulativeQuantity.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Collapsible Advanced Technical Details */}
            <div className="rounded-2xl border border-[#DEE0ED] bg-[#F8F9FD] overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full px-4 py-2.5 flex items-center justify-between font-bold text-[#252943] hover:bg-gray-100/60 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-[#3A4EFB]" />
                  <span>Advanced Delivery Parameters ({FRIENDLY_ARCHETYPE_NAMES[plan.params.archetype] || plan.summaryChips.archetype})</span>
                </div>
                {showAdvanced ? (
                  <ChevronUp className="w-3.5 h-3.5 text-[#252943]/50" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-[#252943]/50" />
                )}
              </button>
              {showAdvanced && (
                <div className="p-4 border-t border-[#DEE0ED] grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[11px] text-[#252943]/70">
                  <div>Archetype: <strong className="font-sans text-[#252943]">{plan.params.archetype}</strong></div>
                  <div>Steepness k: <strong className="text-[#252943]">{plan.params.k.toFixed(2)}</strong></div>
                  <div>Midpoint m: <strong className="text-[#252943]">{plan.params.m.toFixed(2)}</strong></div>
                  <div>Noise: <strong className="text-[#252943]">{(plan.params.noiseAmplitude * 100).toFixed(1)}%</strong></div>
                  <div className="col-span-2 truncate">Seed: {plan.seed}</div>
                  <div className="col-span-2 truncate">Fingerprint: {plan.params.fingerprint.slice(0, 24)}...</div>
                </div>
              )}
            </div>

            {/* Final Order Confirmation & Wallet Bar */}
            <div className="bg-[#252943] text-white rounded-3xl p-6 shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-bold text-[#E3FF3B] tracking-wider">Total Price:</span>
                  <span className="text-2xl font-black">₹{plan.totalCost.toFixed(2)}</span>
                </div>
                <p className="text-xs text-white/70 mt-0.5">
                  Your wallet: ₹{walletBalance !== null ? walletBalance.toFixed(2) : "..."} • Unsent batches are automatically refunded.
                </p>
              </div>

              {(() => {
                const unmappedEnabledTypes = (["views", "likes", "saves", "shares", "comments"] as EngagementType[]).filter(
                  (t) => typeToggles[t] !== false && (!mappings[t] || mappings[t].disconnected)
                );
                const hasMissing = unmappedEnabledTypes.length > 0;

                if (hasMissing) {
                  return (
                    <div className="flex flex-col items-end gap-1 w-full sm:w-auto">
                      <button
                        type="button"
                        disabled
                        className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-amber-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 opacity-90 cursor-not-allowed shadow-subtle"
                      >
                        <AlertCircle className="w-4 h-4 text-white" />
                        <span>Pick a service for {unmappedEnabledTypes.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(", ")}</span>
                      </button>
                      <span className="text-[10px] text-amber-300">
                        Map services above or switch them off to proceed.
                      </span>
                    </div>
                  );
                }

                if (hasInsufficientBalance) {
                  return (
                    <Link
                      href={`/wallet?add=${fundsNeeded.toFixed(2)}`}
                      className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-subtle"
                    >
                      <Wallet className="w-4 h-4 text-white" />
                      <span>Add ₹{fundsNeeded.toFixed(2)} to Confirm</span>
                    </Link>
                  );
                }

                return (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-xs font-bold transition-all press-scale flex items-center justify-center gap-2 shadow-subtle disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#E3FF3B]" />
                        <span>Scheduling Campaign...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-[#E3FF3B]" />
                        <span>Confirm & Schedule {currentProfile.name} Order</span>
                      </>
                    )}
                  </button>
                );
              })()}
            </div>
          </div>
        )}
      </form>

      {/* Custom Speed Warning Confirmation Modal (Change A) */}
      {showCustomSpeedWarning && (
        <div className="fixed inset-0 z-50 bg-[#252943]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#DEE0ED] max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[#DEE0ED]">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <h3 className="text-base font-bold text-[#252943]">Custom Speed Notice</h3>
            </div>
            <p className="text-xs text-[#252943]/80 leading-relaxed font-medium">
              Automatic speed is chosen to make your growth look natural and smooth, without sudden spikes. A custom speed can look less natural. Continue?
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowCustomSpeedWarning(false);
                  setPacingMode("auto");
                  setIsCustomSpeedExpanded(false);
                }}
                className="px-4 py-2 rounded-xl border border-[#DEE0ED] text-xs font-bold text-[#252943]/80 hover:bg-[#F8F9FD]"
              >
                Keep automatic
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCustomSpeedWarning(false);
                  setPacingMode("custom");
                  setIsCustomSpeedExpanded(true);
                  if (pendingCustomAction) pendingCustomAction();
                }}
                className="px-4 py-2 rounded-xl bg-[#3A4EFB] text-white text-xs font-bold hover:bg-[#2A3DE0] shadow-sm"
              >
                Use custom
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

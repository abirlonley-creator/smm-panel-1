"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
  Layers,
  Send,
  Plus,
  Flame,
  Rocket,
  Crown,
  Sliders,
  Activity,
  Moon,
  Link2,
} from "lucide-react";
import { BinanceAddFundsModal } from "@/components/BinanceAddFundsModal";
import { AdminOutOfBalanceBanner } from "@/components/AdminOutOfBalanceBanner";
import { InteractiveDeliveryGraph } from "@/components/engagement/InteractiveDeliveryGraph";
import {
  generateOrganicDeliveryPlan,
  generateTikTokAlgorithmicPlan,
  OrganicBatch,
  OrganicPlanResult,
  PacingStrategy,
} from "@/lib/engagement/organic-pacing-engine";

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
  services?: any[];
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
  targetViews?: number;
  targetLikes?: number;
  targetSaves?: number;
  targetShares?: number;
  views: { enabled?: boolean; count: number; min: number; max: number; interval: number };
  likes: { enabled?: boolean; count: number; min: number; max: number; offsets: number[] };
  saves?: { enabled?: boolean; count: number; min: number; max: number; offsets: number[] };
  shares?: { enabled?: boolean; count: number; min: number; max: number; offsets: number[] };
  syncThreshold: { minViews: number; maxViews: number };
}

const PRESET_OPTIONS: Record<string, PresetOption> = {
  tiktok_2k: {
    id: "tiktok_2k",
    name: "2K Starter",
    tagline: "6-hour initial test pool & seed momentum",
    badge: "6h",
    durationLabel: "6.0 Hours",
    durationHours: 6.0,
    targetViews: 2960,
    targetLikes: 42,
    targetSaves: 0,
    targetShares: 0,
    views: { enabled: true, count: 16, min: 110, max: 240, interval: 22 },
    likes: { enabled: true, count: 3, min: 10, max: 18, offsets: [35, 120, 240] },
    syncThreshold: { minViews: 500, maxViews: 700 },
  },
  tiktok_5k: {
    id: "tiktok_5k",
    name: "5K Velocity",
    tagline: "24-hour FYP expansion with interleaved likes",
    badge: "24h",
    durationLabel: "24.0 Hours (1 Day)",
    durationHours: 24.0,
    targetViews: 5100,
    targetLikes: 180,
    targetSaves: 44,
    targetShares: 22,
    views: { enabled: true, count: 22, min: 140, max: 320, interval: 65 },
    likes: {
      enabled: true,
      count: 12,
      min: 11,
      max: 24,
      offsets: [45, 120, 220, 340, 460, 580, 720, 860, 1000, 1140, 1260, 1380],
    },
    saves: { enabled: true, count: 4, min: 10, max: 14, offsets: [180, 420, 750, 1100] },
    shares: { enabled: true, count: 2, min: 10, max: 12, offsets: [360, 900] },
    syncThreshold: { minViews: 1000, maxViews: 1500 },
  },
  tiktok_10k: {
    id: "tiktok_10k",
    name: "10K Breakthrough",
    tagline: "2-day FYP surge with circadian peak hours",
    badge: "2 Days",
    durationLabel: "48.0 Hours (2 Days)",
    durationHours: 48.0,
    targetViews: 10500,
    targetLikes: 420,
    targetSaves: 90,
    targetShares: 44,
    views: { enabled: true, count: 28, min: 180, max: 520, interval: 102 },
    likes: {
      enabled: true,
      count: 18,
      min: 12,
      max: 28,
      offsets: [
        90, 180, 300, 450, 600, 780, 960, 1140, 1320, 1500, 1680, 1860, 2040, 2220, 2400, 2550, 2700, 2820,
      ],
    },
    saves: { enabled: true, count: 8, min: 10, max: 16, offsets: [240, 540, 900, 1260, 1620, 1980, 2340, 2700] },
    shares: { enabled: true, count: 4, min: 10, max: 14, offsets: [480, 1140, 1800, 2460] },
    syncThreshold: { minViews: 2000, maxViews: 3000 },
  },
  tiktok_15k: {
    id: "tiktok_15k",
    name: "15K Acceleration",
    tagline: "3-day organic algorithm surge with anti-radar ascent",
    badge: "3 Days",
    durationLabel: "72.0 Hours (3 Days)",
    durationHours: 72.0,
    targetViews: 15200,
    targetLikes: 650,
    targetSaves: 140,
    targetShares: 60,
    views: { enabled: true, count: 34, min: 220, max: 650, interval: 127 },
    likes: {
      enabled: true,
      count: 22,
      min: 14,
      max: 32,
      offsets: [
        120, 240, 420, 600, 840, 1080, 1320, 1560, 1800, 2100, 2400, 2700, 3000, 3300, 3600, 3840, 4080, 4200,
      ],
    },
    saves: { enabled: true, count: 10, min: 11, max: 18, offsets: [300, 720, 1200, 1680, 2160, 2640, 3120, 3600, 4000, 4220] },
    shares: { enabled: true, count: 6, min: 10, max: 14, offsets: [600, 1440, 2280, 3000, 3600, 4140] },
    syncThreshold: { minViews: 3000, maxViews: 5000 },
  },
  tiktok_50k: {
    id: "tiktok_50k",
    name: "50K Mega Viral",
    tagline: "5-day full multi-day FYP curve with soft landing tail",
    badge: "5 Days",
    durationLabel: "120.0 Hours (5 Days)",
    durationHours: 120.0,
    targetViews: 50600,
    targetLikes: 2600,
    targetSaves: 520,
    targetShares: 210,
    views: { enabled: true, count: 56, min: 250, max: 1350, interval: 128 },
    likes: {
      enabled: true,
      count: 38,
      min: 24,
      max: 65,
      offsets: [
        180, 360, 600, 840, 1140, 1440, 1800, 2160, 2520, 2880, 3240, 3600, 3960, 4320, 4680, 5040, 5400, 5760, 6120, 6480, 6840, 7080,
      ],
    },
    saves: {
      enabled: true,
      count: 20,
      min: 12,
      max: 25,
      offsets: [
        480, 960, 1500, 2100, 2700, 3300, 3900, 4500, 5100, 5700, 6300, 6900, 7120,
      ],
    },
    shares: {
      enabled: true,
      count: 12,
      min: 10,
      max: 18,
      offsets: [720, 1440, 2200, 3000, 3800, 4600, 5400, 6200, 6900, 7140],
    },
    syncThreshold: { minViews: 5000, maxViews: 8000 },
  },
};

interface PresetVisualMeta {
  tierBadge: string;
  shortTitle: string;
  durationShort: string;
  icon: any;
  iconColor: string;
  iconBg: string;
  accentBorder: string;
  isPopular?: boolean;
}

function getPresetVisuals(preset: PresetOption): PresetVisualMeta {
  const id = (preset.id || "").toLowerCase();
  const name = (preset.name || "").toLowerCase();

  if (id.includes("50k") || name.includes("50k")) {
    return {
      tierBadge: "50K",
      shortTitle: "Mega Viral",
      durationShort: preset.badge || "5 Days",
      icon: Crown,
      iconColor: "text-amber-500",
      iconBg: "bg-amber-500/10 border-amber-300/50",
      accentBorder: "border-amber-400",
    };
  }
  if (id.includes("15k") || name.includes("15k")) {
    return {
      tierBadge: "15K",
      shortTitle: "Acceleration",
      durationShort: preset.badge || "3 Days",
      icon: Sparkles,
      iconColor: "text-purple-600",
      iconBg: "bg-purple-500/10 border-purple-300/50",
      accentBorder: "border-purple-400",
    };
  }
  if (id.includes("10k") || name.includes("10k")) {
    return {
      tierBadge: "10K",
      shortTitle: "Breakthrough",
      durationShort: preset.badge || "2 Days",
      icon: Flame,
      iconColor: "text-rose-500",
      iconBg: "bg-rose-500/10 border-rose-300/50",
      accentBorder: "border-rose-400",
      isPopular: true,
    };
  }
  if (id.includes("5k") || name.includes("5k")) {
    return {
      tierBadge: "5K",
      shortTitle: "Velocity",
      durationShort: preset.badge || "24h",
      icon: Rocket,
      iconColor: "text-indigo-600",
      iconBg: "bg-indigo-500/10 border-indigo-300/50",
      accentBorder: "border-indigo-400",
    };
  }
  return {
    tierBadge: "2K",
    shortTitle: "Starter",
    durationShort: preset.badge || "6h",
    icon: Zap,
    iconColor: "text-sky-500",
    iconBg: "bg-sky-500/10 border-sky-300/50",
    accentBorder: "border-sky-400",
  };
}

function generateOrganicRandomDistribution(
  target: number,
  count: number,
  minBound: number,
  maxBound: number,
  allowVariance: boolean = true
): number[] {
  if (count <= 0) return [];
  if (count === 1) return [Math.max(minBound, target)];

  let min = Math.max(1, minBound);
  let max = Math.max(min + 1, maxBound);

  // If the bounds range is too tight compared to average, dynamically give room for realistic waves
  const avg = target / count;
  if (max - min < 10 && avg > 10) {
    min = Math.max(minBound, Math.floor(avg * 0.7));
    max = Math.max(maxBound, Math.ceil(avg * 1.35));
  }

  // When shuffling or generating, allow slight natural organic variance around the target (±2.5%)
  // so every plan has its own unique, realistic total that visibly updates the header and metric card!
  let effectiveTarget = target;
  if (allowVariance && count > 1) {
    const varianceSpread = Math.max(2, Math.round(target * 0.025));
    const randomShift = Math.floor((Math.random() * 2 - 1) * varianceSpread);
    effectiveTarget = target + randomShift;
  }

  // Ensure target can be reached within bounds
  const clampedTarget = Math.max(count * min, Math.min(count * max, effectiveTarget));

  // Generate initial random values spanning the entire [min, max] range
  const items: number[] = [];
  for (let i = 0; i < count; i++) {
    items.push(Math.floor(Math.random() * (max - min + 1)) + min);
  }

  // Distribute difference randomly so total equals clampedTarget 100%
  let currentSum = items.reduce((a, b) => a + b, 0);
  let diff = clampedTarget - currentSum;
  let attempts = 0;

  while (diff !== 0 && attempts < 8000) {
    attempts++;
    const idx = Math.floor(Math.random() * count);
    if (diff > 0 && items[idx] < max) {
      const room = max - items[idx];
      const step = Math.min(diff, Math.max(1, Math.floor(Math.random() * Math.min(room, 12)) + 1));
      items[idx] += step;
      diff -= step;
    } else if (diff < 0 && items[idx] > min) {
      const room = items[idx] - min;
      const step = Math.min(-diff, Math.max(1, Math.floor(Math.random() * Math.min(room, 12)) + 1));
      items[idx] -= step;
      diff += step;
    }
  }

  // If after attempts there is still a small remainder, distribute 1 by 1
  let guard = 0;
  while (diff > 0 && guard < count * 2) {
    const idx = guard % count;
    if (items[idx] < max) {
      items[idx]++;
      diff--;
    }
    guard++;
  }
  guard = 0;
  while (diff < 0 && guard < count * 2) {
    const idx = guard % count;
    if (items[idx] > min) {
      items[idx]--;
      diff++;
    }
    guard++;
  }

  // Fisher-Yates shuffle so high and low batches are organically dispersed
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = items[i];
    items[i] = items[j];
    items[j] = temp;
  }

  return items;
}

interface StrategyOption {
  id: PacingStrategy;
  name: string;
  badge: string;
  description: string;
  icon: "fire" | "zap" | "activity" | "moon" | "shield";
}

const STRATEGY_OPTIONS: StrategyOption[] = [
  {
    id: "s_curve",
    name: "S-Curve",
    badge: "Biological FYP",
    description: "Organic bell curve (gradual warm-up → algorithm peak → natural tail)",
    icon: "fire",
  },
  {
    id: "burst",
    name: "Burst",
    badge: "Viral Launch",
    description: "Front-loaded momentum rush in first 1–2h for fast algorithmic ranking",
    icon: "zap",
  },
  {
    id: "normal",
    name: "Normal",
    badge: "Steady Human",
    description: "Consistent human browsing arrival pace across total duration",
    icon: "activity",
  },
  {
    id: "peak_hours",
    name: "Peak Hours",
    badge: "6–10 PM Focus",
    description: "Concentrates high volume during prime evening viewing hours (18–22h)",
    icon: "moon",
  },
  {
    id: "stealth",
    name: "Stealth",
    badge: "Slow & Safe",
    description: "Cautious low-velocity trickle delivery for maximum safety",
    icon: "shield",
  },
];

function generateOrganicSCurvePlan(
  target: number,
  runsCount: number,
  durationMinutes: number,
  minBound: number,
  maxBound: number,
  strategy: PacingStrategy = "s_curve",
  peakHoursEnabled: boolean = true
): { quantities: number[]; minuteOffsets: number[]; plan: OrganicPlanResult } {
  const plan = generateOrganicDeliveryPlan("views", target, {
    durationHours: durationMinutes / 60,
    runsCount,
    providerMinimum: minBound,
    applyInitialDelay: false,
    pacingStrategy: strategy,
    peakHoursEnabled,
  });

  return {
    quantities: plan.runs.map((r) => r.quantity),
    minuteOffsets: plan.runs.map((r) => r.minuteOffset),
    plan,
  };
}

function generatePlanForPreset(
  p: PresetOption,
  strategy: PacingStrategy = "s_curve",
  peakHoursEnabled: boolean = true
) {
  const algoPlan = generateTikTokAlgorithmicPlan(p.targetViews || 2960, {
    durationHours: p.durationHours,
    strategy,
    peakHoursEnabled,
    targetLikes: p.targetLikes,
    targetSaves: p.targetSaves,
    targetShares: p.targetShares,
    providerMinViews: p.views?.min || 100,
  });

  return {
    views: algoPlan.views.quantities,
    viewOffsets: algoPlan.views.minuteOffsets,
    viewsPlan: algoPlan.views.plan,
    likes: algoPlan.likes.quantities,
    likeOffsets: algoPlan.likes.minuteOffsets,
    saves: algoPlan.saves.quantities,
    saveOffsets: algoPlan.saves.minuteOffsets,
    shares: algoPlan.shares.quantities,
    shareOffsets: algoPlan.shares.minuteOffsets,
  };
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
  const [adminOutOfBalance, setAdminOutOfBalance] = useState<{
    isOutOfBalance: boolean;
    providerName: string;
  } | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<any | null>(null);
  const [showApiDetails, setShowApiDetails] = useState(false);
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [showAllBatches, setShowAllBatches] = useState(false);

  const activePresets: Record<string, PresetOption> = useMemo(() => {
    if (Array.isArray(statusData?.presets) && statusData.presets.length > 0) {
      const result: Record<string, PresetOption> = {};
      for (const raw of statusData.presets) {
        result[raw.id] = {
          id: raw.id,
          name: raw.name || raw.id,
          tagline: raw.tagline || "",
          badge: raw.badge || `${raw.durationHours}h`,
          durationLabel: raw.durationLabel || `${raw.durationHours} Hours`,
          durationHours: raw.durationHours || 5.0,
          targetViews: raw.targetViews,
          targetLikes: raw.targetLikes,
          views: {
            enabled: raw.views?.enabled !== false,
            count: raw.views?.runsCount ?? 16,
            min: raw.views?.minQuantity ?? 150,
            max: raw.views?.maxQuantity ?? 220,
            interval: raw.views?.intervalMinutes ?? 20,
          },
          likes: {
            enabled: raw.likes?.enabled !== false,
            count: raw.likes?.runsCount ?? 3,
            min: raw.likes?.minQuantity ?? 12,
            max: raw.likes?.maxQuantity ?? 16,
            offsets: raw.likes?.waveOffsets ?? [120, 200, 280],
          },
          saves: raw.saves ? {
            enabled: Boolean(raw.saves.enabled),
            count: raw.saves?.runsCount ?? 4,
            min: raw.saves?.minQuantity ?? 10,
            max: raw.saves?.maxQuantity ?? 12,
            offsets: raw.saves?.waveOffsets ?? [240, 420, 600, 750],
          } : undefined,
          shares: raw.shares ? {
            enabled: Boolean(raw.shares.enabled),
            count: raw.shares?.runsCount ?? 2,
            min: raw.shares?.minQuantity ?? 10,
            max: raw.shares?.maxQuantity ?? 12,
            offsets: raw.shares?.waveOffsets ?? [360, 660],
          } : undefined,
          syncThreshold: raw.syncThreshold || { minViews: 500, maxViews: 700 },
        };
      }
      return result;
    }
    return PRESET_OPTIONS;
  }, [statusData?.presets]);

  const currentPreset = activePresets[selectedPresetId] || activePresets.tiktok_2k || PRESET_OPTIONS.tiktok_2k;

  const [selectedStrategy, setSelectedStrategy] = useState<PacingStrategy>("s_curve");
  const [peakHoursEnabled, setPeakHoursEnabled] = useState<boolean>(true);

  const [plannedSchedule, setPlannedSchedule] = useState<{
    views: number[];
    viewOffsets?: number[];
    viewsPlan?: OrganicPlanResult | null;
    likes: number[];
    likeOffsets?: number[];
    saves: number[];
    saveOffsets?: number[];
    shares: number[];
    shareOffsets?: number[];
  }>(() => generatePlanForPreset(PRESET_OPTIONS.tiktok_2k, "s_curve", true));

  const [planTimestamp, setPlanTimestamp] = useState<Date>(new Date());
  const [shuffling, setShuffling] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  // Re-generate plan when preset changes
  function switchPreset(presetId: string) {
    setSelectedPresetId(presetId);
    setShowAllBatches(false);
    const p = activePresets[presetId] || activePresets.tiktok_2k || PRESET_OPTIONS.tiktok_2k;
    setPlannedSchedule(generatePlanForPreset(p, selectedStrategy, peakHoursEnabled));
    setPlanTimestamp(new Date());
  }

  function selectStrategy(strategy: PacingStrategy) {
    setSelectedStrategy(strategy);
    setPlannedSchedule(generatePlanForPreset(currentPreset, strategy, peakHoursEnabled));
    setPlanTimestamp(new Date());
  }

  function togglePeakHours() {
    const nextVal = !peakHoursEnabled;
    setPeakHoursEnabled(nextVal);
    setPlannedSchedule(generatePlanForPreset(currentPreset, selectedStrategy, nextVal));
    setPlanTimestamp(new Date());
  }

  function rerollPlan() {
    setShuffling(true);
    setPlannedSchedule(generatePlanForPreset(currentPreset, selectedStrategy, peakHoursEnabled));
    setPlanTimestamp(new Date());
    setTimeout(() => setShuffling(false), 300);
  }

  const handleUpdateViews = useCallback((newViews: number[]) => {
    setPlannedSchedule((prev) => ({
      ...prev,
      views: newViews,
    }));
  }, []);

  const handleUpdateLikes = useCallback((newLikes: number[]) => {
    setPlannedSchedule((prev) => ({
      ...prev,
      likes: newLikes,
    }));
  }, []);

  const handleUpdateSaves = useCallback((newSaves: number[]) => {
    setPlannedSchedule((prev) => ({
      ...prev,
      saves: newSaves,
    }));
  }, []);

  const handleUpdateShares = useCallback((newShares: number[]) => {
    setPlannedSchedule((prev) => ({
      ...prev,
      shares: newShares,
    }));
  }, []);

  useEffect(() => {
    if (statusData?.presets) {
      const p = activePresets[selectedPresetId] || activePresets.tiktok_2k;
      if (p) {
        setPlannedSchedule(generatePlanForPreset(p, selectedStrategy, peakHoursEnabled));
      }
    }
  }, [statusData?.presets, selectedPresetId, selectedStrategy, peakHoursEnabled]);

  async function fetchStatus(isManual = false) {
    if (isManual) setRefreshing(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    try {
      const res = await fetch("/api/engagement/status", { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data.success) {
        setStatusData(data);
      } else {
        setErrorMsg(data.error || "Failed to load engagement status");
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        setErrorMsg("Connection timed out while reaching engagement engines. Please retry.");
      } else {
        setErrorMsg(err.message || "Failed to connect to engagement backend");
      }
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

  // Upfront estimated price per package
  const getPresetPrice = useCallback(
    (p: PresetOption) => {
      const estViews = p.targetViews || (p.views.count * ((p.views.min + p.views.max) / 2));
      const estLikes = p.targetLikes || (p.likes.count * ((p.likes.min + p.likes.max) / 2));
      const estSaves = p.targetSaves || (p.saves ? p.saves.count * ((p.saves.min + p.saves.max) / 2) : 0);
      const estShares = p.targetShares || (p.shares ? p.shares.count * ((p.shares.min + p.shares.max) / 2) : 0);
      const vCost = (estViews / 1000) * viewsRate;
      const lCost = (estLikes / 1000) * likesRate;
      const sCost = (estSaves / 1000) * savesRate;
      const rCost = (estShares / 1000) * sharesRate;
      return Number((vCost + lCost + sCost + rCost).toFixed(2));
    },
    [viewsRate, likesRate, savesRate, sharesRate]
  );

  const walletBalance = statusData?.walletBalance ?? 0;
  const zeofame = statusData?.zeofame;
  const xmedia = statusData?.xmedia;
  const hasSufficientFunds = walletBalance >= exactTotalCost;
  const isReady = Boolean(statusData?.readyToOrder);

  // Build the batch rows with unified timeline across all engagement waves
  const scheduleRows = useMemo(() => {
    // Map all unique minute offsets across views, likes, saves, shares
    const offsetMap = new Map<
      number,
      {
        viewQty: number;
        likeQty?: number;
        likeWave?: number;
        totalLikeWaves?: number;
        saveQty?: number;
        saveWave?: number;
        totalSaveWaves?: number;
        shareQty?: number;
        shareWave?: number;
        totalShareWaves?: number;
        humanScore?: number;
        sessionType?: string;
        patternBreaker?: boolean;
        timeOfDayLabel?: string;
      }
    >();

    const getOrCreate = (offset: number) => {
      let entry = offsetMap.get(offset);
      if (!entry) {
        entry = { viewQty: 0 };
        offsetMap.set(offset, entry);
      }
      return entry;
    };

    // 1. Views
    if (currentPreset.views.enabled !== false && plannedSchedule.views.length > 0) {
      plannedSchedule.views.forEach((viewQty, index) => {
        const offset = plannedSchedule.viewOffsets?.[index] ?? (index * currentPreset.views.interval);
        const entry = getOrCreate(offset);
        entry.viewQty = viewQty;
        const vRun = plannedSchedule.viewsPlan?.runs[index];
        if (vRun) {
          entry.humanScore = vRun.humanBehaviorScore;
          entry.sessionType = vRun.sessionType;
          entry.patternBreaker = vRun.patternBreaker;
          entry.timeOfDayLabel = vRun.timeOfDayLabel;
        }
      });
    }

    // 2. Likes (all waves mapped by offset)
    if (currentPreset.likes.enabled !== false && plannedSchedule.likes.length > 0) {
      const offsets = plannedSchedule.likeOffsets || currentPreset.likes.offsets || [];
      offsets.forEach((offset, idx) => {
        if (plannedSchedule.likes[idx] !== undefined) {
          const entry = getOrCreate(offset);
          entry.likeQty = plannedSchedule.likes[idx];
          entry.likeWave = idx + 1;
          entry.totalLikeWaves = plannedSchedule.likes.length;
        }
      });
    }

    // 3. Saves (all waves mapped by offset)
    if (currentPreset.saves?.enabled && plannedSchedule.saves.length > 0) {
      const offsets = plannedSchedule.saveOffsets || currentPreset.saves.offsets || [];
      offsets.forEach((offset, idx) => {
        if (plannedSchedule.saves[idx] !== undefined) {
          const entry = getOrCreate(offset);
          entry.saveQty = plannedSchedule.saves[idx];
          entry.saveWave = idx + 1;
          entry.totalSaveWaves = plannedSchedule.saves.length;
        }
      });
    }

    // 4. Shares (all waves mapped by offset)
    if (currentPreset.shares?.enabled && plannedSchedule.shares.length > 0) {
      const offsets = plannedSchedule.shareOffsets || currentPreset.shares.offsets || [];
      offsets.forEach((offset, idx) => {
        if (plannedSchedule.shares[idx] !== undefined) {
          const entry = getOrCreate(offset);
          entry.shareQty = plannedSchedule.shares[idx];
          entry.shareWave = idx + 1;
          entry.totalShareWaves = plannedSchedule.shares.length;
        }
      });
    }

    // Sort chronologically so all batches and waves flow in perfect sequence
    const sortedOffsets = Array.from(offsetMap.keys()).sort((a, b) => a - b);
    const totalBatches = sortedOffsets.length;

    return sortedOffsets.map((minuteOffset, idx) => {
      const runNumber = idx + 1;
      const clockTime = formatBdTime(minuteOffset, planTimestamp);
      const data = offsetMap.get(minuteOffset)!;

      let note = "";
      if (runNumber === 1) {
        note = "Instant Launch • View batch #1 dispatches immediately";
      } else if (runNumber === Math.ceil(totalBatches * 0.25)) {
        note = "Steady Momentum • Natural scheduled pacing active";
      } else if (runNumber === totalBatches) {
        note = "Final Batch • Campaign 100% Completed";
      }

      return {
        runNumber,
        minuteOffset,
        clockTime,
        viewQty: data.viewQty,
        likeQty: data.likeQty,
        likeWave: data.likeWave,
        totalLikeWaves: data.totalLikeWaves,
        saveQty: data.saveQty,
        saveWave: data.saveWave,
        totalSaveWaves: data.totalSaveWaves,
        shareQty: data.shareQty,
        shareWave: data.shareWave,
        totalShareWaves: data.totalShareWaves,
        humanScore: data.humanScore,
        sessionType: data.sessionType,
        patternBreaker: data.patternBreaker,
        timeOfDayLabel: data.timeOfDayLabel,
        note,
      };
    });
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
      setErrorMsg("Fulfillment engines are temporarily synchronizing. Please wait a moment or contact 24/7 Telegram support.");
      return;
    }

    if (!hasSufficientFunds) {
      const needed = Number((exactTotalCost - walletBalance).toFixed(2));
      setErrorMsg(`Insufficient wallet balance: ₹${needed} more needed. Tap 'Add Funds' below to top up.`);
      return;
    }

    setSubmitting(true);
    setAdminOutOfBalance(null);
    try {
      const res = await fetch("/api/engagement/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl: url,
          presetId: currentPreset.id,
          presetName: currentPreset.name,
          platform: "TikTok",
          pacingStrategy: selectedStrategy,
          peakHoursEnabled: peakHoursEnabled,
          plannedViews: currentPreset.views.enabled !== false ? plannedSchedule.views : [],
          viewOffsets: currentPreset.views.enabled !== false ? (plannedSchedule.viewOffsets || []) : [],
          plannedLikes: currentPreset.likes.enabled !== false ? plannedSchedule.likes : [],
          likeOffsets: currentPreset.likes.enabled !== false ? (plannedSchedule.likeOffsets || []) : [],
          plannedSaves: currentPreset.saves?.enabled ? plannedSchedule.saves : [],
          saveOffsets: currentPreset.saves?.enabled ? (plannedSchedule.saveOffsets || []) : [],
          plannedShares: currentPreset.shares?.enabled ? plannedSchedule.shares : [],
          shareOffsets: currentPreset.shares?.enabled ? (plannedSchedule.shareOffsets || []) : [],
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.isAdminOutOfBalance) {
          setAdminOutOfBalance({
            isOutOfBalance: true,
            providerName: data.providerName || "Fulfillment Engine",
          });
          setErrorMsg(null);
          return;
        }
        throw new Error(data.error || "Failed to create engagement order");
      }

      setSuccessReceipt(data);
      setTargetUrl("");
      fetchStatus();
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err: any) {
      const raw = err.message || "";
      let friendly = raw || "Failed to submit engagement order";
      if (raw.includes("Failed to fetch") || raw.includes("NetworkError")) {
        friendly = "Unable to connect to server. Please check your internet connection and retry.";
      } else if (raw.toLowerCase().includes("resolve") || raw.toLowerCase().includes("tiktok") || raw.toLowerCase().includes("url")) {
        friendly = "Could not resolve TikTok video. Please verify the post is public and the link is active.";
      }
      setErrorMsg(friendly);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 rounded-2xl bg-[#3A4EFB]/10 flex items-center justify-center text-[#3A4EFB]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fadeIn">
      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#DEE0ED] pb-3">
        <Link
          href="/engagement"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#3A4EFB] text-white shadow-subtle transition-all press-scale"
        >
          <Zap className="w-3.5 h-3.5 text-[#E3FF3B]" />
          <span>New Campaign</span>
        </Link>
        <Link
          href="/engagement/orders"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white text-[#252943]/70 hover:text-[#252943] hover:bg-[#F8F9FD] border border-[#DEE0ED] shadow-xs transition-all press-scale"
        >
          <Layers className="w-3.5 h-3.5 text-[#3A4EFB]" />
          <span>Campaign Orders</span>
        </Link>
      </div>

      {/* Success Notification */}
      {successReceipt && (
        <div className="p-4 sm:p-5 rounded-3xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 space-y-3 animate-fadeIn shadow-subtle">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 stroke-[3]" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-emerald-950">
                  Engagement Campaign Launched!
                </h3>
                <p className="text-xs text-emerald-800">
                  Order ID: <strong className="font-sans">#{successReceipt.orderRef}</strong> • Preset: <strong>{successReceipt.presetName}</strong> ({successReceipt.durationHours}h).
                </p>
              </div>
            </div>
            <Link
              href={`/engagement/orders/${successReceipt.orderId}`}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-subtle"
            >
              <span>Inspect Live Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Admin Out Of Balance Banner */}
      {adminOutOfBalance?.isOutOfBalance && (
        <AdminOutOfBalanceBanner
          providerName={adminOutOfBalance.providerName}
          orderType="TikTok Engagement Campaign"
          serviceName={currentPreset.name}
          onDismiss={() => setAdminOutOfBalance(null)}
        />
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3 text-xs font-semibold animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
        </div>
      )}

      {/* MAIN GUIDED CAMPAIGN WORKSPACE (4-STEP STREAMLINED FLOW) */}
      <form onSubmit={handleCreateOrder} className="space-y-6">
        {/* STEP 1: CHOOSE GROWTH PACKAGE */}
        <div className="bg-white rounded-3xl border border-[#DEE0ED] p-5 sm:p-6 shadow-subtle space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-[#3A4EFB] text-white text-xs font-black flex items-center justify-center shadow-xs">
                1
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#1A1D31]">
                  Choose Growth Package
                </h2>
                <p className="text-[11px] text-[#64748B]">
                  Select your target video reach — all packages deliver organic, human-paced engagement
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/80 hidden sm:inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Anti-Bot Protected</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {Object.values(activePresets).map((preset, idx) => {
              const isSelected = selectedPresetId === preset.id;
              const viewsEnabled = preset.views.enabled !== false;
              const likesEnabled = preset.likes.enabled !== false;
              const estViews = preset.targetViews || (preset.views.count * ((preset.views.min + preset.views.max) / 2));
              const estLikes = preset.targetLikes || (preset.likes.count * ((preset.likes.min + preset.likes.max) / 2));
              const estSaves = preset.targetSaves || (preset.saves?.enabled ? preset.saves.count * 10 : 0);
              const estShares = preset.targetShares || (preset.shares?.enabled ? preset.shares.count * 10 : 0);
              const basePrice = getPresetPrice(preset);
              const visuals = getPresetVisuals(preset);
              const IconComponent = visuals.icon;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => switchPreset(preset.id)}
                  className={`group relative p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between press-scale ${
                    idx === 4 ? "col-span-2 sm:col-span-1 lg:col-span-1" : "col-span-1"
                  } ${
                    isSelected
                      ? "bg-white border-[#3A4EFB] shadow-md ring-2 ring-[#3A4EFB]/20 -translate-y-0.5"
                      : "bg-[#F8F9FD] border-[#DEE0ED] hover:bg-white hover:border-[#3A4EFB]/40 hover:shadow-xs"
                  }`}
                >
                  {/* Top: Tier Icon + Duration Badge */}
                  <div className="w-full flex items-center justify-between gap-1 mb-2">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center border transition-transform duration-200 group-hover:scale-105 shrink-0 ${visuals.iconBg}`}
                    >
                      <IconComponent className={`w-3.5 h-3.5 ${visuals.iconColor}`} />
                    </div>

                    <div className="flex items-center gap-1">
                      {visuals.isPopular && !isSelected && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200/60 font-sans">
                          Hot
                        </span>
                      )}
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider font-sans ${
                          isSelected
                            ? "bg-[#3A4EFB] text-white shadow-2xs"
                            : "bg-gray-200/70 text-gray-700"
                        }`}
                      >
                        {visuals.durationShort}
                      </span>
                    </div>
                  </div>

                  {/* Middle: Reach Number & Tier Name */}
                  <div className="space-y-1">
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-base sm:text-lg font-black text-[#1A1D31] font-sans tracking-tight leading-none">
                          ~{Math.round(estViews).toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-[#3A4EFB] font-sans">Views</span>
                      </div>
                      <div className="text-[11px] font-bold text-[#1A1D31] truncate mt-1 font-sans">
                        {visuals.tierBadge} {visuals.shortTitle}
                      </div>
                    </div>

                    {/* Micro-Metrics Badges */}
                    <div className="flex items-center flex-wrap gap-1 text-[10px] font-semibold text-[#64748B] pt-0.5 font-sans">
                      {likesEnabled && (
                        <span className="inline-flex items-center gap-0.5 text-rose-600 font-sans font-bold bg-rose-50/80 px-1.5 py-0.5 rounded border border-rose-200/50">
                          <Heart className="w-2.5 h-2.5 fill-rose-500 text-rose-500" />
                          <span>+{Math.round(estLikes)}</span>
                        </span>
                      )}
                      {Boolean(preset.saves?.enabled && estSaves > 0) && (
                        <span className="inline-flex items-center gap-0.5 text-amber-600 font-sans font-bold bg-amber-50/80 px-1.5 py-0.5 rounded border border-amber-200/50">
                          <Bookmark className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                          <span>+{estSaves}</span>
                        </span>
                      )}
                      {Boolean(preset.shares?.enabled && estShares > 0) && (
                        <span className="inline-flex items-center gap-0.5 text-purple-600 font-sans font-bold bg-purple-50/80 px-1.5 py-0.5 rounded border border-purple-200/50">
                          <Share2 className="w-2.5 h-2.5 text-purple-500" />
                          <span>+{estShares}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom: Price + Selection Checkmark */}
                  <div className="pt-2 mt-2 border-t border-[#DEE0ED]/60 flex items-center justify-between w-full">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-[#64748B] block leading-none font-sans">Price</span>
                      <span className="text-xs sm:text-sm font-black text-[#1A1D31] font-sans">
                        ₹{basePrice.toFixed(2)}
                      </span>
                    </div>

                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${
                        isSelected
                          ? "bg-[#3A4EFB] border-[#3A4EFB] text-white shadow-2xs"
                          : "border-[#CBD5E1] bg-white group-hover:border-[#3A4EFB]/60"
                      }`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2: VIDEO LINK */}
        <div className="bg-white rounded-3xl border border-[#DEE0ED] p-5 sm:p-6 shadow-subtle space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#DEE0ED]">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-[#3A4EFB] text-white text-xs font-black flex items-center justify-center shadow-xs">
                2
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#1A1D31]">
                  TikTok Post URL
                </h2>
                <p className="text-[11px] text-[#64748B]">
                  Paste your public TikTok video or carousel link
                </p>
              </div>
            </div>

            {targetUrl.toLowerCase().includes("tiktok.com") ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Check className="w-3 h-3 stroke-[3]" />
                <span>Link Ready</span>
              </span>
            ) : (
              <span className="text-[11px] text-[#64748B] font-medium hidden sm:inline">
                Supports video, photo carousel & sound links
              </span>
            )}
          </div>

          <div className="relative">
            <input
              type="url"
              required
              placeholder="https://www.tiktok.com/@username/video/1234567890..."
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs sm:text-sm font-semibold text-[#1A1D31] placeholder-[#64748B]/50 focus:outline-none focus:border-[#3A4EFB] focus:bg-white focus:ring-2 focus:ring-[#3A4EFB]/15 transition-all shadow-inner font-sans"
            />
            <Link2 className="w-4 h-4 text-[#64748B] absolute left-4 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* STEP 3: DELIVERY PACING */}
        <div className="bg-white rounded-3xl border border-[#DEE0ED] p-5 sm:p-6 shadow-subtle space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DEE0ED]">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-[#3A4EFB] text-white text-xs font-black flex items-center justify-center shadow-xs">
                3
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#1A1D31]">
                  Delivery Pacing & Protection
                </h2>
                <p className="text-[11px] text-[#64748B]">
                  Paced organically across {currentPreset.durationLabel} to simulate authentic viewer arrival
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={togglePeakHours}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border self-start sm:self-auto press-scale ${
                peakHoursEnabled
                  ? "bg-amber-500/10 text-amber-900 border-amber-300 shadow-2xs"
                  : "bg-white text-[#64748B] border-[#DEE0ED] hover:bg-gray-50"
              }`}
              title="Prioritizes heavier delivery between 18:00 and 22:00"
            >
              <Moon className={`w-3.5 h-3.5 ${peakHoursEnabled ? "text-amber-600 fill-amber-500" : "text-gray-400"}`} />
              <span>Prime Evening (18–22h): {peakHoursEnabled ? "On" : "Off"}</span>
            </button>
          </div>

          {/* Strategy Selection Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            {STRATEGY_OPTIONS.map((opt) => {
              const isSelected = selectedStrategy === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => selectStrategy(opt.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col justify-between group press-scale card-hover ${
                    isSelected
                      ? "bg-white border-[#3A4EFB] shadow-md ring-2 ring-[#3A4EFB]/25 -translate-y-0.5"
                      : "bg-[#F8F9FD] hover:bg-white border-[#DEE0ED] hover:border-[#3A4EFB]/40"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="p-1 rounded-lg bg-white border border-[#DEE0ED]/80">
                        {opt.icon === "fire" && <Flame className="w-3.5 h-3.5 text-amber-500" />}
                        {opt.icon === "zap" && <Zap className="w-3.5 h-3.5 text-indigo-500" />}
                        {opt.icon === "activity" && <Activity className="w-3.5 h-3.5 text-emerald-500" />}
                        {opt.icon === "moon" && <Moon className="w-3.5 h-3.5 text-purple-500" />}
                        {opt.icon === "shield" && <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />}
                      </div>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                          isSelected ? "bg-[#3A4EFB] text-white" : "bg-gray-200/70 text-[#475569]"
                        }`}
                      >
                        {opt.badge}
                      </span>
                    </div>

                    <div className="font-bold text-xs text-[#1A1D31] flex items-center gap-1 font-sans">
                      <span>{opt.name}</span>
                      {isSelected && <Check className="w-3 h-3 text-[#3A4EFB] stroke-[3]" />}
                    </div>

                    <p className="text-[10px] text-[#64748B] mt-1 line-clamp-2 leading-tight font-sans">
                      {opt.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Interactive Live Delivery Graph with Draggable Points & Smooth Organic Spline */}
          <InteractiveDeliveryGraph
            durationHours={currentPreset.durationHours}
            strategy={selectedStrategy}
            views={plannedSchedule.views}
            viewOffsets={plannedSchedule.viewOffsets || []}
            likes={currentPreset.likes.enabled !== false ? plannedSchedule.likes : []}
            likeOffsets={plannedSchedule.likeOffsets || currentPreset.likes.offsets || []}
            saves={currentPreset.saves?.enabled ? plannedSchedule.saves : []}
            saveOffsets={plannedSchedule.saveOffsets || currentPreset.saves?.offsets || []}
            shares={currentPreset.shares?.enabled ? plannedSchedule.shares : []}
            shareOffsets={plannedSchedule.shareOffsets || currentPreset.shares?.offsets || []}
            providerMinimum={currentPreset.views.min || 100}
            planTimestamp={planTimestamp}
            onUpdateViews={handleUpdateViews}
            onUpdateLikes={handleUpdateLikes}
            onUpdateSaves={handleUpdateSaves}
            onUpdateShares={handleUpdateShares}
            onResetPlan={rerollPlan}
          />

          {/* Quick Metrics & Human Behavior Score Strip */}
          <div className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] flex flex-wrap items-center justify-between gap-3 text-xs font-sans">
            <div className="flex items-center flex-wrap gap-2 sm:gap-3 font-sans">
              <span className="px-2.5 py-1 rounded-xl bg-white border border-blue-200 font-bold text-blue-800 flex items-center gap-1 shadow-2xs font-sans">
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>{totalViews.toLocaleString()} Views</span>
              </span>
              {currentPreset.likes.enabled !== false && totalLikes > 0 && (
                <span className="px-2.5 py-1 rounded-xl bg-white border border-rose-200 font-bold text-rose-800 flex items-center gap-1 shadow-2xs font-sans">
                  <Heart className="w-3.5 h-3.5 text-rose-600 fill-rose-600" />
                  <span>{totalLikes} Likes</span>
                </span>
              )}
              {currentPreset.saves?.enabled && totalSaves > 0 && (
                <span className="px-2.5 py-1 rounded-xl bg-white border border-amber-200 font-bold text-amber-800 shadow-2xs font-sans">
                  +{totalSaves} Saves
                </span>
              )}
              {currentPreset.shares?.enabled && totalShares > 0 && (
                <span className="px-2.5 py-1 rounded-xl bg-white border border-purple-200 font-bold text-purple-800 shadow-2xs font-sans">
                  +{totalShares} Reposts
                </span>
              )}
              <span className="px-2.5 py-1 rounded-xl bg-white border border-emerald-200 font-bold text-emerald-800 shadow-2xs font-sans">
                🛡️ {plannedSchedule.viewsPlan?.avgHumanScore ?? 84}/100 Human Score
              </span>
            </div>

            <div className="flex items-center gap-2 font-sans">
              <button
                type="button"
                onClick={rerollPlan}
                disabled={shuffling}
                className="px-2.5 py-1 rounded-xl bg-white hover:bg-gray-50 border border-[#DEE0ED] text-[11px] font-bold text-[#3A4EFB] transition-all flex items-center gap-1 cursor-pointer press-scale shadow-2xs font-sans"
                title="Shuffle batch distributions"
              >
                <Dices className={`w-3.5 h-3.5 ${shuffling ? "animate-spin" : ""}`} />
                <span>{shuffling ? "..." : "Shuffle"}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowTimeline(!showTimeline)}
                className="px-3 py-1 rounded-xl bg-white hover:bg-gray-50 border border-[#DEE0ED] text-[11px] font-bold text-[#1A1D31] transition-all flex items-center gap-1 cursor-pointer press-scale shadow-2xs font-sans"
              >
                <span>{showTimeline ? "Hide Schedule" : `View Schedule (${plannedSchedule.views.length} Batches)`}</span>
                {showTimeline ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Collapsible Detailed Timeline Accordion */}
          {showTimeline && (
            <div className="border border-[#DEE0ED] rounded-2xl overflow-hidden bg-white animate-fadeIn font-sans">
              <div className="p-3 bg-[#F8F9FD] border-b border-[#DEE0ED] flex items-center justify-between text-xs font-sans">
                <span className="font-bold text-[#1A1D31]">Complete Batch Distribution</span>
                <span className="text-[11px] text-[#64748B]">Non-round quantities, zero multiples of 5</span>
              </div>
              <div className="divide-y divide-[#DEE0ED]/60 max-h-[320px] overflow-y-auto font-sans">
                {scheduleRows.map((row) => (
                  <div
                    key={row.runNumber}
                    className={`p-2.5 sm:px-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 transition-colors font-sans ${
                      row.likeQty ? "bg-rose-50/20 hover:bg-rose-50/50" : "hover:bg-[#F8F9FD]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-gray-100 text-[#1A1D31] font-bold text-[10px] flex items-center justify-center shrink-0 font-sans">
                        #{row.runNumber}
                      </span>
                      <span className="font-semibold text-[#1A1D31] font-sans">+{row.minuteOffset}m</span>
                      <span className="text-[10px] text-[#64748B] font-sans">({row.clockTime})</span>
                      {row.sessionType && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-gray-100 text-gray-700 font-sans">
                          {row.sessionType === "burst" ? "⚡ Burst" : row.sessionType === "peak" ? "🔥 Peak" : row.sessionType === "slow" ? "🌙 Slow" : "🌊 Normal"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center flex-wrap gap-1.5 self-end sm:self-auto shrink-0 font-sans text-[11px]">
                      {row.viewQty > 0 && currentPreset.views.enabled !== false && (
                        <div className="flex items-center gap-1 font-sans">
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...plannedSchedule.views];
                              const curr = next[row.runNumber - 1] ?? row.viewQty;
                              next[row.runNumber - 1] = Math.max(currentPreset.views.min || 100, curr - 25);
                              handleUpdateViews(next);
                            }}
                            className="w-4 h-4 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors"
                            title="Decrease batch volume"
                          >
                            -
                          </button>
                          <span className="px-2 py-0.5 rounded-md font-bold bg-blue-50 text-blue-700 border border-blue-200/60 font-sans">
                            {row.viewQty} views
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...plannedSchedule.views];
                              const curr = next[row.runNumber - 1] ?? row.viewQty;
                              next[row.runNumber - 1] = curr + 25;
                              handleUpdateViews(next);
                            }}
                            className="w-4 h-4 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors"
                            title="Increase batch volume"
                          >
                            +
                          </button>
                        </div>
                      )}
                      {row.likeQty && (
                        <span className="px-2 py-0.5 rounded-md font-bold bg-rose-50 text-rose-700 border border-rose-200/60 flex items-center gap-1 font-sans">
                          <Heart className="w-2.5 h-2.5 fill-rose-500 text-rose-500" />
                          <span>+{row.likeQty} likes</span>
                        </span>
                      )}
                      {row.saveQty && (
                        <span className="px-2 py-0.5 rounded-md font-bold bg-amber-50 text-amber-700 border border-amber-200/60 font-sans">
                          +{row.saveQty} saves
                        </span>
                      )}
                      {row.shareQty && (
                        <span className="px-2 py-0.5 rounded-md font-bold bg-purple-50 text-purple-700 border border-purple-200/60 font-sans">
                          +{row.shareQty} shares
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* STEP 4: CONFIRM & LAUNCH */}
        <div className="bg-white rounded-3xl border border-[#DEE0ED] p-5 sm:p-6 shadow-subtle space-y-4 font-sans">
          <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-[#3A4EFB] text-white text-xs font-black flex items-center justify-center shadow-xs">
                4
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#1A1D31]">
                  Review & Launch
                </h2>
                <p className="text-[11px] text-[#64748B]">
                  Instant processing with automatic upstream fulfillment
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-[#64748B] block leading-none font-sans">Your Balance</span>
              <span className="text-sm font-bold font-sans text-[#1A1D31]">
                ₹{walletBalance.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] font-sans">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#64748B] block font-sans">Total Campaign Price</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-[#1A1D31] font-sans tracking-tight">
                  ₹{exactTotalCost.toFixed(2)}
                </span>
                <span className="text-xs text-[#64748B] font-sans">
                  ({currentPreset.name} • {currentPreset.durationLabel})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {hasSufficientFunds ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                  <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-600" />
                  <span>Sufficient Funds</span>
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Need ₹{(exactTotalCost - walletBalance).toFixed(2)} More</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddFundsModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-[#F0B90B] hover:bg-[#e0a800] text-[#1E2329] text-xs font-black shadow-subtle flex items-center gap-1 transition-all press-scale cursor-pointer"
                  >
                    <Zap className="w-3 h-3 fill-[#1E2329]" />
                    <span>Add Funds</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Primary Action Button */}
          {hasSufficientFunds ? (
            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-4 rounded-2xl text-sm font-black tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer press-scale ${
                submitting
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white shadow-[#3A4EFB]/25 active:scale-[0.98]"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Launching Campaign...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Launch Campaign • ₹{exactTotalCost.toFixed(2)}</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddFundsModal(true)}
              className="w-full py-4 rounded-2xl text-sm font-black tracking-wide bg-[#F0B90B] hover:bg-[#e0a800] text-[#1E2329] shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-all press-scale cursor-pointer active:scale-[0.98]"
            >
              <Zap className="w-4 h-4 fill-[#1E2329]" />
              <span>Add Funds (Need ₹{(exactTotalCost - walletBalance).toFixed(2)})</span>
            </button>
          )}

          <div className="pt-2 text-center text-xs text-[#64748B] flex items-center justify-center gap-3">
            <span>✓ Anti-Bot Protected</span>
            <span>•</span>
            <span>✓ Views-First Synchronized</span>
            <span>•</span>
            <a href="https://t.me/Ghostfinds" target="_blank" rel="noopener noreferrer" className="text-[#3A4EFB] hover:underline font-bold">
              24/7 Telegram Support
            </a>
          </div>
        </div>
      </form>

      {/* 24/7 Live Support Banner */}
      <div className="p-3.5 rounded-2xl bg-white border border-[#DEE0ED] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#0088cc]/10 text-[#0088cc] flex items-center justify-center shrink-0">
            <Send className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-[#252943] block">Need Assistance or Instant Approval?</span>
            <span className="text-[11px] text-[#252943]/60 font-normal">Our team is active 24/7 on Telegram.</span>
          </div>
        </div>

        <a
          href="https://t.me/Ghostfinds"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-2 sm:py-1.5 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-bold transition-all shadow-subtle flex items-center justify-center gap-1.5 press-scale shrink-0 text-center"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Telegram @Ghostfinds</span>
        </a>
      </div>

      {/* Binance Pay Add Funds Modal */}
      <BinanceAddFundsModal
        isOpen={showAddFundsModal}
        onClose={() => setShowAddFundsModal(false)}
        currentBalance={walletBalance}
        onSuccess={() => fetchStatus(true)}
      />
    </div>
  );
}

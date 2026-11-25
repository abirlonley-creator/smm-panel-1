"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { toast } from "sonner";
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  Loader2,
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
  Repeat,
  MessageSquare,
  Calendar,
  Layers,
  Send,
  Plus,
  Flame,
  Rocket,
  Crown,
  Link2,
  Users,
  X,
  Sparkles,
  Minus,
} from "lucide-react";
import { AdminOutOfBalanceBanner } from "@/components/AdminOutOfBalanceBanner";
import { LiveOrganicGrowthPreview } from "@/components/engagement/LiveOrganicGrowthPreview";
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
import { EngagementPageSkeleton } from "@/components/ui/PageLoadingSkeletons";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

function TikTokIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.89 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.32 0 .62.06.9.16V9.45a6.37 6.37 0 0 0-.9-.06A6.34 6.34 0 0 0 3 15.73 6.34 6.34 0 0 0 9.34 22a6.34 6.34 0 0 0 6.34-6.27V9.17a8.16 8.16 0 0 0 4.91 1.63v-3.47c-.34 0-.68-.05-1-.14z" />
    </svg>
  );
}

function InstagramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

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
  isAdmin?: boolean;
  isVip?: boolean;
  accountType?: string;
  walletBalance: number;
  readyToOrder: boolean;
  zeofame: ApiStatusItem;
  xmedia: ApiStatusItem;
  pricingRates?: {
    tiktok: {
      views: number;
      likes: number;
      saves: number;
      shares: number;
      reposts: number;
      comments: number;
    };
    instagram: {
      views: number;
      likes: number;
      saves: number;
      shares: number;
      reposts: number;
      comments: number;
    };
  };
  presets?: any[];
  config: any;
  pricing: any;
}

interface PostPreviewData {
  authorHandle: string;
  authorName: string;
  title: string;
  thumbnailUrl: string;
  videoId?: string;
  views?: number;
}

interface PresetVisualMeta {
  tierBadge: string;
  shortTitle: string;
  durationShort: string;
  icon: any;
  isPopular?: boolean;
}

function getPresetVisuals(pkg: PackageConfig): PresetVisualMeta {
  const id = (pkg.id || "").toLowerCase();
  const name = (pkg.name || "").toLowerCase();

  if (id.includes("50k") || name.includes("50k")) {
    return { tierBadge: "50K", shortTitle: "Mega Viral", durationShort: "5 Days", icon: Crown };
  }
  if (id.includes("15k") || name.includes("15k")) {
    return { tierBadge: "15K", shortTitle: "Acceleration", durationShort: "3 Days", icon: Sparkles };
  }
  if (id.includes("10k") || name.includes("10k")) {
    return { tierBadge: "10K", shortTitle: "Breakthrough", durationShort: "2 Days", icon: Flame, isPopular: true };
  }
  if (id.includes("5k") || name.includes("5k")) {
    return { tierBadge: "5K", shortTitle: "Velocity", durationShort: "24h", icon: Rocket };
  }
  return { tierBadge: "2K", shortTitle: "Starter", durationShort: "6h", icon: Zap };
}

function formatBdTime(date: Date): string {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Dhaka",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date) + " BD"
  );
}

function snapTo15MinuteGrid(d: Date): Date {
  const ms = 1000 * 60 * 15;
  return new Date(Math.round(d.getTime() / ms) * ms);
}

export default function EngagementPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusData, setStatusData] = useState<EngagementStatusResponse | null>(null);

  // Selected platform & package
  const [platform, setPlatform] = useState<"TikTok" | "Instagram">("TikTok");
  const [selectedPackageId, setSelectedPackageId] = useState<string>("tiktok_2k");

  // Add-ons state
  const [addOnLikes, setAddOnLikes] = useState<boolean>(true);
  const [addOnSaves, setAddOnSaves] = useState<boolean>(true);
  const [addOnShares, setAddOnShares] = useState<boolean>(true);
  const [addOnReposts, setAddOnReposts] = useState<boolean>(true);
  const [addOnComments, setAddOnComments] = useState<boolean>(false);
  const [commentsCount, setCommentsCount] = useState<number>(10);
  const [customCommentsText, setCustomCommentsText] = useState<string>("");

  // URL & Post preview
  const [targetUrl, setTargetUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PostPreviewData | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);

  // Follower count & timing
  const [followers, setFollowers] = useState<number>(500);
  const [startMode, setStartMode] = useState<"now" | "schedule">("now");
  const [scheduledDate, setScheduledDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [scheduledTime, setScheduledTime] = useState<string>("12:00");

  // Pattern seed
  const [patternSeed, setPatternSeed] = useState<string>(
    () => `aurasmm_${Math.random().toString(36).substring(2, 9)}`
  );

  // Terms agreement & submission
  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [adminOutOfBalance, setAdminOutOfBalance] = useState<{
    isOutOfBalance: boolean;
    providerName: string;
  } | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<any | null>(null);

  // Active platform rates from status API
  const currentRates = useMemo(() => {
    const ratesObj =
      platform === "Instagram" ? statusData?.pricingRates?.instagram : statusData?.pricingRates?.tiktok;
    if (ratesObj) return ratesObj;
    if (platform === "Instagram") {
      return { views: 1.0, likes: 35.57, saves: 6.7, shares: 2.0, reposts: 152.45, comments: 2113.92 };
    }
    return { views: 4.5, likes: 2.0, saves: 0.8, shares: 0.8, reposts: 0.8, comments: 15.0 };
  }, [platform, statusData?.pricingRates]);

  // Exact dynamic price calculation: (qty/1000) * rate
  const getPackagePrice = useCallback(
    (
      pkg: PackageConfig,
      rates: { views: number; likes: number; saves: number; shares: number; reposts: number; comments: number }
    ) => {
      const v = ((pkg.views_total || pkg.base_views || 2000) / 1000) * rates.views;
      const l = ((pkg.likes || 0) / 1000) * rates.likes;
      const s = ((pkg.saves || 0) / 1000) * rates.saves;
      const sh = ((pkg.shares || 0) / 1000) * rates.shares;
      const rep = ((pkg.reposts || 0) / 1000) * rates.reposts;
      const c = ((pkg.comments || 0) / 1000) * rates.comments;
      return Number((v + l + s + sh + rep + c).toFixed(2));
    },
    []
  );

  // Memoized packages list combining defaults with live database preset prices & metrics
  const packagesList: PackageConfig[] = useMemo(() => {
    const rawList: (PackageConfig | null)[] = Object.values(DEFAULT_PACKAGES).map((defaultPkg) => {
      if (Array.isArray(statusData?.presets)) {
        const match = statusData.presets.find((p: any) => p.id === defaultPkg.id);
        if (match) {
          const isEnabled = match.disabled !== true && match.enabled !== false;
          const targetViews = match.views_total || match.targetViews || defaultPkg.views_total;
          const targetLikes = match.targetLikes ?? defaultPkg.likes;
          const targetSaves = match.targetSaves ?? defaultPkg.saves;
          const targetShares = match.targetShares ?? defaultPkg.shares;
          const dynamicPrice = getPackagePrice(
            {
              ...defaultPkg,
              views_total: targetViews,
              likes: targetLikes,
              saves: targetSaves,
              shares: targetShares,
            },
            currentRates
          );
          return {
            ...defaultPkg,
            enabled: isEnabled,
            disabled: !isEnabled,
            price_inr: dynamicPrice,
            views_total: targetViews,
            base_duration_hours: match.base_duration_hours || match.durationHours || defaultPkg.base_duration_hours,
            likes: targetLikes,
            saves: targetSaves,
            shares: targetShares,
            min_followers_note: match.min_followers_note || defaultPkg.min_followers_note,
          };
        }
        if (!statusData?.isAdmin) {
          return null;
        }
      }
      return {
        ...defaultPkg,
        price_inr: getPackagePrice(defaultPkg, currentRates),
      };
    });

    const list: PackageConfig[] = rawList.filter((p): p is PackageConfig => p !== null);

    if (!statusData?.isAdmin) {
      return list.filter((p) => p.disabled !== true && p.enabled !== false);
    }
    return list;
  }, [statusData?.presets, statusData?.isAdmin, currentRates, getPackagePrice]);

  // Active package definition
  const currentPackage: PackageConfig = useMemo(() => {
    const found = packagesList.find(
      (p) => p.id === selectedPackageId && (statusData?.isAdmin || (p.disabled !== true && p.enabled !== false))
    );
    return found || packagesList[0] || DEFAULT_PACKAGES.tiktok_2k;
  }, [packagesList, selectedPackageId, statusData?.isAdmin]);

  const handleSelectPackage = useCallback(
    (pkgId: string) => {
      setSelectedPackageId(pkgId);
      const targetPkg = packagesList.find((p) => p.id === pkgId) || DEFAULT_PACKAGES[pkgId] || DEFAULT_PACKAGES.tiktok_2k;
      setAddOnLikes((targetPkg.likes ?? 0) > 0);
      setAddOnSaves((targetPkg.saves ?? 0) > 0);
      setAddOnShares((targetPkg.shares ?? 0) > 0);
    },
    [packagesList]
  );

  // Calculated start time
  const computedStartTime = useMemo(() => {
    if (startMode === "now") {
      return snapTo15MinuteGrid(new Date());
    }
    try {
      const [hours, minutes] = scheduledTime.split(":").map(Number);
      const combined = new Date(scheduledDate);
      combined.setHours(hours || 0, minutes || 0, 0, 0);
      return snapTo15MinuteGrid(combined);
    } catch {
      return snapTo15MinuteGrid(new Date());
    }
  }, [startMode, scheduledDate, scheduledTime]);

  // Effective package incorporating signal add-ons
  const effectivePackage: PackageConfig = useMemo(() => {
    return {
      ...currentPackage,
      likes: addOnLikes ? currentPackage.likes : 0,
      saves: addOnSaves ? ((currentPackage.saves ?? 0) > 0 ? (currentPackage.saves ?? 0) : 20) : 0,
      shares: addOnShares ? ((currentPackage.shares ?? 0) > 0 ? (currentPackage.shares ?? 0) : 10) : 0,
      reposts: addOnReposts ? ((currentPackage.reposts ?? 0) > 0 ? (currentPackage.reposts ?? 0) : 10) : 0,
      comments: addOnComments ? commentsCount : 0,
    };
  }, [currentPackage, addOnLikes, addOnSaves, addOnShares, addOnReposts, addOnComments, commentsCount]);

  // Platform status & config selection
  const isTikTokEnabled = statusData?.config?.tiktokEnabled !== false && statusData?.config?.enabled !== false;
  const isInstagramEnabled = statusData?.config?.instagramEnabled !== false && statusData?.config?.enabled !== false;
  const isCurrentPlatformEnabled = platform === "TikTok" ? isTikTokEnabled : isInstagramEnabled;

  const currentPlatformConfig = useMemo(() => {
    return platform === "Instagram" ? DEFAULT_INSTAGRAM_CONFIG : DEFAULT_TIKTOK_CONFIG;
  }, [platform]);

  const currentProviderMinimums = useMemo(() => {
    return platform === "Instagram" ? DEFAULT_INSTAGRAM_PROVIDER_MINIMUMS : DEFAULT_PROVIDER_MINIMUMS;
  }, [platform]);

  const customCommentsLines = useMemo(() => {
    return customCommentsText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }, [customCommentsText]);

  const targetCommentsCount = effectivePackage.comments ?? 0;

  const handleCommentsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const lines = val.split("\n");
    if (targetCommentsCount > 0 && lines.length > targetCommentsCount) {
      setCustomCommentsText(lines.slice(0, targetCommentsCount).join("\n"));
      return;
    }
    setCustomCommentsText(val);
  };

  const handleCommentsKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      const currentLines = customCommentsText.split("\n");
      if (targetCommentsCount > 0 && currentLines.length >= targetCommentsCount) {
        e.preventDefault();
      }
    }
  };

  // Generate deterministic schedule plan
  const plan: DeterministicPlan = useMemo(() => {
    return generatePattern(effectivePackage, followers, patternSeed, {
      platformConfig: currentPlatformConfig,
      providerMinimums: currentProviderMinimums,
      startDate: computedStartTime,
      userCommentLines: customCommentsLines,
      commentsMode: "USER_ONLY",
    });
  }, [
    effectivePackage,
    followers,
    patternSeed,
    currentPlatformConfig,
    currentProviderMinimums,
    computedStartTime,
    customCommentsLines,
  ]);

  // Exact price breakdown
  const targetViews =
    plan && plan.viewsTotal > 0 ? plan.viewsTotal : effectivePackage.views_total || effectivePackage.base_views || 2000;
  const targetLikes = effectivePackage.likes ?? 0;
  const targetSaves = effectivePackage.saves ?? 0;
  const targetShares = effectivePackage.shares ?? 0;
  const targetReposts = effectivePackage.reposts ?? 0;
  const targetComments = effectivePackage.comments ?? 0;

  const viewsCost = (targetViews / 1000) * currentRates.views;
  const likesCost = (targetLikes / 1000) * currentRates.likes;
  const savesCost = (targetSaves / 1000) * currentRates.saves;
  const sharesCost = (targetShares / 1000) * currentRates.shares;
  const repostsCost = (targetReposts / 1000) * currentRates.reposts;
  const commentsCost = (targetComments / 1000) * currentRates.comments;

  const totalCampaignPriceInr = Number(
    (viewsCost + likesCost + savesCost + sharesCost + repostsCost + commentsCost).toFixed(2)
  );

  const basePackageViewsQty =
    plan && plan.viewsTotal > 0 ? plan.viewsTotal : currentPackage.views_total || currentPackage.base_views || 2000;
  const basePackageViewsCost = (basePackageViewsQty / 1000) * currentRates.views;
  const basePackageLikesCost = ((currentPackage.likes ?? 0) / 1000) * currentRates.likes;
  const basePackageSavesCost = ((currentPackage.saves ?? 0) / 1000) * currentRates.saves;
  const basePackageSharesCost = ((currentPackage.shares ?? 0) / 1000) * currentRates.shares;
  const basePackageRepostsCost = ((currentPackage.reposts ?? 0) / 1000) * currentRates.reposts;
  const basePackageCommentsCost = ((currentPackage.comments ?? 0) / 1000) * currentRates.comments;
  const basePackagePrice = Number(
    (
      basePackageViewsCost +
      basePackageLikesCost +
      basePackageSavesCost +
      basePackageSharesCost +
      basePackageRepostsCost +
      basePackageCommentsCost
    ).toFixed(2)
  );
  const addOnsTotalPrice = Math.max(0, Number((totalCampaignPriceInr - basePackagePrice).toFixed(2)));

  const walletBalance = statusData?.walletBalance ?? 0;
  const hasSufficientFunds = walletBalance >= totalCampaignPriceInr;
  const shortfallInr = Math.max(0, Number((totalCampaignPriceInr - walletBalance).toFixed(2)));
  const isReady = Boolean(statusData?.readyToOrder);
  const isAdmin = Boolean(statusData?.isAdmin);

  // Auto-fetch TikTok post preview
  useEffect(() => {
    const trimmed = targetUrl.trim();
    if (!trimmed || !trimmed.toLowerCase().includes("tiktok.com")) {
      setPreviewData(null);
      return;
    }

    if (previewAbortRef.current) {
      previewAbortRef.current.abort();
    }
    const abortController = new AbortController();
    previewAbortRef.current = abortController;

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await fetch(`/api/engagement/preview-post?url=${encodeURIComponent(trimmed)}`, {
          signal: abortController.signal,
        });
        const data = await res.json();
        if (data.success && data.data) {
          setPreviewData(data.data);
        } else {
          setPreviewData(null);
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setPreviewData(null);
        }
      } finally {
        setPreviewLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [targetUrl]);

  const handleNewPattern = useCallback(() => {
    setPatternSeed(`aurasmm_${Math.random().toString(36).substring(2, 9)}`);
    toast.success("Refreshed delivery pacing curve");
  }, []);

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
        if (isManual) toast.success("Balance & rates refreshed");
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

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!isCurrentPlatformEnabled) {
      setErrorMsg(`${platform} engagement ordering is currently paused by administrator.`);
      return;
    }

    const url = targetUrl.trim();
    if (!url) {
      setErrorMsg(`Please enter your ${platform} video or post link.`);
      return;
    }

    if (platform === "TikTok" && !url.toLowerCase().includes("tiktok.com")) {
      setErrorMsg("Please enter a valid TikTok video URL (e.g. https://www.tiktok.com/@username/video/...)");
      return;
    }

    if (platform === "Instagram" && !url.toLowerCase().includes("instagram.com")) {
      setErrorMsg("Please enter a valid Instagram post or reel link (e.g. https://www.instagram.com/p/... or /reel/...)");
      return;
    }

    if (targetCommentsCount > 0 && customCommentsLines.length < targetCommentsCount) {
      setErrorMsg(
        `Please enter all ${targetCommentsCount} custom comments (${customCommentsLines.length}/${targetCommentsCount} entered).`
      );
      return;
    }

    if (!agreedToTerms) {
      setErrorMsg("Please confirm that you agree to gradual, view-paced delivery.");
      return;
    }

    if (!isReady) {
      setErrorMsg("Fulfillment engines are temporarily synchronizing. Please wait a moment or contact support.");
      return;
    }

    if (!hasSufficientFunds) {
      setErrorMsg(`Insufficient wallet balance: ₹${shortfallInr.toFixed(2)} more needed.`);
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
          presetId: currentPackage.id,
          presetName: currentPackage.name,
          platform: platform,
          followers: followers,
          seed: plan.seed,
          scheduledStartTime: computedStartTime.toISOString(),
          packagePriceInr: getPackagePrice(currentPackage, currentRates),
          totalCostInr: totalCampaignPriceInr,
          customComments: customCommentsLines,
          batches: plan.batches,
          rows: plan.rows,
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
      setPreviewData(null);
      toast.success(`${platform} campaign launched!`);
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
      toast.error(friendly);
    } finally {
      setSubmitting(false);
    }
  }

  const finishTime = useMemo(() => {
    return new Date(computedStartTime.getTime() + plan.totalDurationMinutes * 60 * 1000);
  }, [computedStartTime, plan.totalDurationMinutes]);

  const activePresetMeta = getPresetVisuals(currentPackage);
  const needsCommentsInput = targetCommentsCount > 0 && customCommentsLines.length < targetCommentsCount;

  const canLaunch =
    !submitting && isReady && isCurrentPlatformEnabled && hasSufficientFunds && !needsCommentsInput && agreedToTerms;

  function renderCtaButton(compact = false) {
    const sizeCls = compact ? "px-4 py-2.5 rounded-xl text-xs" : "w-full py-3.5 rounded-2xl text-sm";

    if (!isReady) {
      return (
        <button
          type="button"
          disabled
          className={`${sizeCls} font-bold bg-[#F3F1EA] text-[#5B625F] flex items-center justify-center gap-2 cursor-not-allowed`}
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{compact ? "Syncing" : "Syncing Engines..."}</span>
        </button>
      );
    }

    if (!hasSufficientFunds) {
      return (
        <Link
          href={`/wallet/pay?amount=${Math.max(50, Math.ceil(totalCampaignPriceInr - walletBalance))}`}
          className={`${sizeCls} font-extrabold bg-[#D4F04F] hover:bg-[#C5E23A] text-[#111413] flex items-center justify-center gap-2 transition-colors active:scale-[0.98]`}
        >
          <Zap className="w-3.5 h-3.5 fill-[#111413]" />
          <span>{compact ? `Add ₹${shortfallInr.toFixed(2)}` : `Add Funds (Need ₹${shortfallInr.toFixed(2)})`}</span>
        </Link>
      );
    }

    return (
      <button
        type="submit"
        disabled={!canLaunch}
        className={`${sizeCls} font-extrabold flex items-center justify-center gap-2 transition-colors ${
          canLaunch
            ? "bg-[#D4F04F] hover:bg-[#C5E23A] text-[#111413] cursor-pointer active:scale-[0.98]"
            : "bg-[#E4E0D3] text-[#5B625F] cursor-not-allowed"
        }`}
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{compact ? "Launching..." : "Launching Campaign..."}</span>
          </>
        ) : !isCurrentPlatformEnabled ? (
          <span>{platform} Paused</span>
        ) : needsCommentsInput ? (
          <span>
            {compact ? `Comments (${customCommentsLines.length}/${targetCommentsCount})` : `Add Comments (${customCommentsLines.length}/${targetCommentsCount})`}
          </span>
        ) : (
          <>
            <Play className="w-3.5 h-3.5 fill-[#111413]" />
            <span>{compact ? "Launch Order" : `Launch Campaign • ₹${totalCampaignPriceInr.toFixed(2)}`}</span>
          </>
        )}
      </button>
    );
  }

  if (loading) {
    return <EngagementPageSkeleton />;
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="max-w-6xl mx-auto space-y-6 pb-28 lg:pb-16 font-sans">
        {/* TOP SUB-HEADER: Sub-navigation + Wallet Pill */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E0D3] pb-4">
          <div className="inline-flex items-center p-1 rounded-2xl bg-white border border-[#E4E0D3] shadow-2xs">
            <Link
              href="/engagement"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#111413] text-[#D4F04F] transition-colors"
            >
              <Zap className="w-3.5 h-3.5 fill-[#D4F04F]" />
              <span>New Campaign</span>
            </Link>
            <Link
              href="/engagement/orders"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#5B625F] hover:text-[#111413] transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Active Orders</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchStatus(true)}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-xl border border-[#E4E0D3] bg-white hover:bg-[#FAF9F5] text-xs font-semibold text-[#111413] flex items-center gap-2 transition-colors cursor-pointer"
              title="Refresh wallet balance"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#5E8C1F] ${refreshing ? "animate-spin" : ""}`} />
              <span className="tabular-nums font-bold">₹{walletBalance.toFixed(2)}</span>
            </button>

            <Link
              href="/wallet/pay"
              className="px-3.5 py-1.5 rounded-xl bg-[#D4F04F] hover:bg-[#C5E23A] text-[#111413] text-xs font-bold flex items-center gap-1 transition-colors active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add Funds</span>
            </Link>
          </div>
        </div>

        {/* PAGE HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-[#111413] leading-tight">
              Organic Engagement Builder
            </h1>
            <p className="text-sm text-[#5B625F] mt-1">
              Views-first micro-batches designed to match real discovery pacing.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E4E0D3] text-[11px] font-semibold text-[#5E8C1F] self-start sm:self-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5E8C1F]" />
            Instant Schedule Queue Ready
          </span>
        </div>

        {/* ALERTS & RECEIPT */}
        <AnimatePresence>
          {successReceipt && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              className="p-4 sm:p-5 rounded-3xl bg-white border-2 border-[#5E8C1F]/40 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#D4F04F] text-[#111413] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#111413]">
                    Campaign Queued Successfully
                  </h3>
                  <p className="text-xs text-[#5B625F] mt-0.5">
                    {successReceipt.message ||
                      `Your ${platform} campaign batches are scheduled on the 15-minute pacing grid.`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/engagement/orders"
                  className="px-4 py-2 rounded-xl bg-[#111413] text-[#D4F04F] text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                >
                  <span>Track Progress</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => setSuccessReceipt(null)}
                  className="p-2 rounded-xl bg-[#FAF9F5] border border-[#E4E0D3] text-[#5B625F] hover:text-[#111413] cursor-pointer"
                  aria-label="Dismiss receipt"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {adminOutOfBalance?.isOutOfBalance && (
          <AdminOutOfBalanceBanner
            providerName={adminOutOfBalance.providerName}
            orderType="Organic Engagement Campaign"
            serviceName={`${platform} ${activePresetMeta.tierBadge}`}
            onDismiss={() => setAdminOutOfBalance(null)}
          />
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-[#FFF5F2] border border-[#C4552D]/30 text-[#C4552D] text-xs font-semibold flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-[#C4552D]/70 hover:text-[#C4552D] cursor-pointer"
              aria-label="Close error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* MAIN 2-COLUMN BUILDER */}
        <form onSubmit={handleCreateOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: 3 FOCUSED BUILDER CARDS */}
          <div className="lg:col-span-8 space-y-5">
            {/* STEP 1: PLATFORM & PACKAGE */}
            <section className="bg-white rounded-3xl border border-[#E4E0D3] p-5 sm:p-6 shadow-subtle space-y-5">
              <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-[#E4E0D3]">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-[#111413] text-[#D4F04F] text-xs font-black flex items-center justify-center">
                    1
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-[#111413]">Platform & Volume</h2>
                    <p className="text-xs text-[#5B625F]">Pick your target platform, base tier, and optional signals.</p>
                  </div>
                </div>
              </div>

              {/* Platform Segmented Selector */}
              <div className="grid grid-cols-2 gap-2.5">
                {(["TikTok", "Instagram"] as const).map((p) => {
                  const isActive = platform === p;
                  const enabled = p === "TikTok" ? isTikTokEnabled : isInstagramEnabled;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setPlatform(p);
                        setErrorMsg(null);
                      }}
                      className={`p-3.5 rounded-2xl border text-left transition-colors cursor-pointer flex items-center justify-between active:scale-[0.99] ${isActive
                          ? "bg-[#111413] border-[#111413] text-white"
                          : "bg-[#FAF9F5] border-[#E4E0D3] hover:border-[#111413]/30 text-[#111413]"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isActive
                              ? "bg-[#D4F04F] text-[#111413]"
                              : "bg-white border border-[#E4E0D3] text-[#111413]"
                            }`}
                        >
                          {p === "TikTok" ? (
                            <TikTokIcon className="w-4 h-4" />
                          ) : (
                            <InstagramIcon className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{p}</span>
                            {!enabled && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#C4552D] text-white">
                                Paused
                              </span>
                            )}
                          </div>
                          <span className={`text-[11px] block ${isActive ? "text-white/65" : "text-[#5B625F]"}`}>
                            {p === "TikTok" ? "Videos & Sounds" : "Reels & Posts"}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center ${isActive ? "bg-[#D4F04F]" : "border border-[#D8D4C7] bg-white"
                          }`}
                      >
                        {isActive && <Check className="w-2.5 h-2.5 text-[#111413] stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Clean 5-Tier Package Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5B625F]">
                    Select Base Tier
                  </span>
                  <span className="text-[11px] text-[#5B625F]">
                    Includes organic view buffer
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5">
                  {packagesList.map((pkg, idx) => {
                    const isSelected = currentPackage.id === pkg.id;
                    const meta = getPresetVisuals(pkg);
                    const Icon = meta.icon;

                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => handleSelectPackage(pkg.id)}
                        className={`relative p-3.5 rounded-2xl border text-left transition-colors cursor-pointer flex flex-col justify-between gap-3 active:scale-[0.98] ${idx === 4 ? "col-span-2 sm:col-span-1" : "col-span-1"
                          } ${isSelected
                            ? "bg-[#FAF9F5] border-2 border-[#111413] shadow-2xs"
                            : "bg-white border-[#E4E0D3] hover:border-[#111413]/35"
                          }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div
                            className={`w-7 h-7 rounded-xl flex items-center justify-center ${isSelected
                                ? "bg-[#111413] text-[#D4F04F]"
                                : "bg-[#FAF9F5] border border-[#E4E0D3] text-[#111413]"
                              }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          {meta.isPopular ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D4F04F] text-[#111413]">
                              Popular
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-[#5B625F]">
                              {meta.durationShort}
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="text-lg font-extrabold text-[#111413] tracking-tight tabular-nums leading-none">
                            {(pkg.views_total ?? 0).toLocaleString()}
                          </div>
                          <div className="text-[11px] font-medium text-[#5B625F] mt-1">
                            {meta.shortTitle} views
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[#E4E0D3]/80 flex items-center justify-between">
                          <span className="text-sm font-extrabold text-[#111413] tabular-nums">
                            ₹{(pkg.price_inr ?? 0).toFixed(2)}
                          </span>
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center ${isSelected
                                ? "bg-[#D4F04F] text-[#111413] border border-[#111413]/20"
                                : "border border-[#E4E0D3]"
                              }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Clean Engagement Signal Add-On Pills */}
              <div className="pt-3 border-t border-[#E4E0D3] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5B625F]">
                    Engagement Signals
                  </span>
                  <span className="text-[11px] text-[#5B625F]">
                    Synced proportionally to view batches
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* Likes Toggle */}
                  {(currentPackage.likes ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => setAddOnLikes(!addOnLikes)}
                      className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer active:scale-[0.98] ${addOnLikes
                          ? "bg-[#111413] border-[#111413] text-white"
                          : "bg-[#FAF9F5] border-[#E4E0D3] text-[#5B625F] hover:text-[#111413]"
                        }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${addOnLikes ? "text-[#D4F04F] fill-[#D4F04F]" : ""}`} />
                      <span>Likes</span>
                      <span className={`tabular-nums text-[11px] ${addOnLikes ? "text-[#D4F04F]" : "text-[#5B625F]"}`}>
                        {(currentPackage.likes ?? 0).toLocaleString()}
                      </span>
                    </button>
                  )}

                  {/* Saves Toggle */}
                  <button
                    type="button"
                    onClick={() => setAddOnSaves(!addOnSaves)}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer active:scale-[0.98] ${addOnSaves
                        ? "bg-[#111413] border-[#111413] text-white"
                        : "bg-[#FAF9F5] border-[#E4E0D3] text-[#5B625F] hover:text-[#111413]"
                      }`}
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${addOnSaves ? "text-[#D4F04F] fill-[#D4F04F]" : ""}`} />
                    <span>Saves</span>
                    <span className={`tabular-nums text-[11px] ${addOnSaves ? "text-[#D4F04F]" : "text-[#5B625F]"}`}>
                      {((currentPackage.saves ?? 0) > 0 ? currentPackage.saves! : 20).toLocaleString()}
                    </span>
                  </button>

                  {/* Shares Toggle */}
                  <button
                    type="button"
                    onClick={() => setAddOnShares(!addOnShares)}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer active:scale-[0.98] ${addOnShares
                        ? "bg-[#111413] border-[#111413] text-white"
                        : "bg-[#FAF9F5] border-[#E4E0D3] text-[#5B625F] hover:text-[#111413]"
                      }`}
                  >
                    <Share2 className={`w-3.5 h-3.5 ${addOnShares ? "text-[#D4F04F]" : ""}`} />
                    <span>Shares</span>
                    <span className={`tabular-nums text-[11px] ${addOnShares ? "text-[#D4F04F]" : "text-[#5B625F]"}`}>
                      {((currentPackage.shares ?? 0) > 0 ? currentPackage.shares! : 10).toLocaleString()}
                    </span>
                  </button>

                  {/* Reposts Toggle */}
                  <button
                    type="button"
                    onClick={() => setAddOnReposts(!addOnReposts)}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer active:scale-[0.98] ${addOnReposts
                        ? "bg-[#111413] border-[#111413] text-white"
                        : "bg-[#FAF9F5] border-[#E4E0D3] text-[#5B625F] hover:text-[#111413]"
                      }`}
                  >
                    <Repeat className={`w-3.5 h-3.5 ${addOnReposts ? "text-[#D4F04F]" : ""}`} />
                    <span>Reposts</span>
                    <span className={`tabular-nums text-[11px] ${addOnReposts ? "text-[#D4F04F]" : "text-[#5B625F]"}`}>
                      {((currentPackage.reposts ?? 0) > 0 ? currentPackage.reposts! : 10).toLocaleString()}
                    </span>
                  </button>

                  {/* Custom Comments Toggle */}
                  <button
                    type="button"
                    onClick={() => setAddOnComments(!addOnComments)}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer active:scale-[0.98] ${addOnComments
                        ? "bg-[#111413] border-[#111413] text-white"
                        : "bg-[#FAF9F5] border-[#E4E0D3] text-[#5B625F] hover:text-[#111413]"
                      }`}
                  >
                    <MessageSquare className={`w-3.5 h-3.5 ${addOnComments ? "text-[#D4F04F]" : ""}`} />
                    <span>Custom Comments</span>
                    {addOnComments && (
                      <span className="tabular-nums text-[11px] text-[#D4F04F]">{commentsCount}</span>
                    )}
                  </button>
                </div>

                {/* Inline Comment Quantity Stepper when enabled */}
                <AnimatePresence>
                  {addOnComments && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: EASE_OUT }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 rounded-2xl bg-[#FAF9F5] border border-[#E4E0D3] flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-bold text-[#111413]">Custom Comments Count</div>
                          <div className="text-[11px] text-[#5B625F]">
                            +₹{((commentsCount / 1000) * currentRates.comments).toFixed(2)} for {commentsCount} custom lines
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {[5, 10, 20, 50].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setCommentsCount(preset)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums transition-colors cursor-pointer ${commentsCount === preset
                                  ? "bg-[#111413] text-[#D4F04F]"
                                  : "bg-white border border-[#E4E0D3] text-[#5B625F] hover:text-[#111413]"
                                }`}
                            >
                              {preset}
                            </button>
                          ))}
                          <div className="flex items-center border border-[#E4E0D3] rounded-lg bg-white ml-1">
                            <button
                              type="button"
                              onClick={() => setCommentsCount((c) => Math.max(5, c - 5))}
                              className="p-1.5 text-[#5B625F] hover:text-[#111413] cursor-pointer"
                              aria-label="Decrease comments"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2 text-xs font-bold tabular-nums text-[#111413]">
                              {commentsCount}
                            </span>
                            <button
                              type="button"
                              onClick={() => setCommentsCount((c) => Math.min(200, c + 5))}
                              className="p-1.5 text-[#5B625F] hover:text-[#111413] cursor-pointer"
                              aria-label="Increase comments"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>

            {/* STEP 2: POST LINK, ACCOUNT SIZE & PACING */}
            <section className="bg-white rounded-3xl border border-[#E4E0D3] p-5 sm:p-6 shadow-subtle space-y-5">
              <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-[#E4E0D3]">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-[#111413] text-[#D4F04F] text-xs font-black flex items-center justify-center">
                    2
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-[#111413]">Post Link & Pacing</h2>
                    <p className="text-xs text-[#5B625F]">Paste your public post link and set account size.</p>
                  </div>
                </div>
              </div>

              {/* URL Input */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#111413]">
                  {platform} Post URL <span className="text-[#C4552D]">*</span>
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-[#5B625F] pointer-events-none">
                    <Link2 className="w-4 h-4" />
                  </div>
                  <input
                    type="url"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder={
                      platform === "TikTok"
                        ? "https://www.tiktok.com/@username/video/..."
                        : "https://www.instagram.com/reel/..."
                    }
                    className="w-full pl-10 pr-10 py-3 rounded-2xl bg-[#FAF9F5] focus:bg-white border border-[#E4E0D3] focus:border-[#111413] text-sm text-[#111413] placeholder:text-[#5B625F]/60 focus:outline-none transition-colors"
                  />
                  {previewLoading ? (
                    <div className="absolute right-3.5">
                      <Loader2 className="w-4 h-4 animate-spin text-[#5E8C1F]" />
                    </div>
                  ) : targetUrl ? (
                    <button
                      type="button"
                      onClick={() => {
                        setTargetUrl("");
                        setPreviewData(null);
                      }}
                      className="absolute right-3 p-1 rounded-lg text-[#5B625F] hover:text-[#111413] cursor-pointer"
                      aria-label="Clear link"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Live TikTok Preview Card */}
              <AnimatePresence>
                {previewData && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                    className="p-3 rounded-2xl bg-[#FAF9F5] border border-[#E4E0D3] flex items-center gap-3"
                  >
                    {previewData.thumbnailUrl && (
                      <img
                        src={previewData.thumbnailUrl}
                        alt={previewData.title || "Post thumbnail"}
                        className="w-12 h-14 object-cover rounded-xl border border-[#E4E0D3] shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#111413] truncate">
                          @{previewData.authorHandle || previewData.authorName}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#5E8C1F]/10 text-[#5E8C1F]">
                          Public Link Verified
                        </span>
                      </div>
                      <p className="text-xs text-[#5B625F] truncate mt-0.5">
                        {previewData.title || "TikTok video ready for engagement delivery"}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Followers & Schedule Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {/* Account Followers */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#111413] flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#5E8C1F]" />
                      <span>Account Followers</span>
                    </label>
                    <div className="flex items-center gap-1">
                      {[500, 5000, 25000].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setFollowers(val)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${followers === val
                              ? "bg-[#111413] text-[#D4F04F]"
                              : "bg-[#FAF9F5] border border-[#E4E0D3] text-[#5B625F] hover:text-[#111413]"
                            }`}
                        >
                          {val >= 1000 ? `${val / 1000}K` : val}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="50000000"
                    value={followers}
                    onChange={(e) => setFollowers(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F5] focus:bg-white border border-[#E4E0D3] focus:border-[#111413] text-sm font-semibold tabular-nums text-[#111413] focus:outline-none transition-colors"
                  />
                  <p className="text-[11px] text-[#5B625F]">
                    Calibrates batch speed.{" "}
                    {currentPackage.min_followers_note ? `Note: ${currentPackage.min_followers_note}.` : ""}
                  </p>
                </div>

                {/* Start Timing */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#111413] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#5E8C1F]" />
                    <span>Start Timing</span>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStartMode("now")}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${startMode === "now"
                          ? "bg-[#111413] border-[#111413] text-[#D4F04F]"
                          : "bg-[#FAF9F5] border-[#E4E0D3] text-[#5B625F] hover:text-[#111413]"
                        }`}
                    >
                      Start Immediately
                    </button>
                    <button
                      type="button"
                      onClick={() => setStartMode("schedule")}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${startMode === "schedule"
                          ? "bg-[#111413] border-[#111413] text-[#D4F04F]"
                          : "bg-[#FAF9F5] border-[#E4E0D3] text-[#5B625F] hover:text-[#111413]"
                        }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Schedule</span>
                    </button>
                  </div>

                  {startMode === "schedule" ? (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#E4E0D3] text-xs font-semibold text-[#111413] focus:outline-none focus:border-[#111413]"
                      />
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#E4E0D3] text-xs font-semibold text-[#111413] focus:outline-none focus:border-[#111413]"
                      />
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#5B625F]">
                      First micro-batch launches on the next 15-minute slot.
                    </p>
                  )}
                </div>
              </div>

              {/* Custom Comments Editor */}
              {addOnComments && targetCommentsCount > 0 && (
                <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#E4E0D3] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-[#111413]">Custom Comments Script</span>
                      <p className="text-[11px] text-[#5B625F]">Enter exactly 1 comment per line.</p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold tabular-nums ${customCommentsLines.length >= targetCommentsCount
                          ? "bg-[#D4F04F] text-[#111413]"
                          : "bg-white border border-[#E4E0D3] text-[#C4552D]"
                        }`}
                    >
                      {customCommentsLines.length} / {targetCommentsCount} lines
                    </span>
                  </div>

                  <textarea
                    rows={4}
                    value={customCommentsText}
                    onChange={handleCommentsChange}
                    onKeyDown={handleCommentsKeyDown}
                    placeholder={`Line 1: Love how clean this transition is!\nLine 2: Saved for later 🔥\nLine 3: Need part 2 ASAP!`}
                    className="w-full p-3 rounded-xl bg-white border border-[#E4E0D3] focus:border-[#111413] text-xs text-[#111413] placeholder:text-[#5B625F]/50 focus:outline-none resize-y leading-relaxed"
                  />
                </div>
              )}
            </section>

            {/* STEP 3: LIVE GROWTH CURVE PREVIEW */}
            <LiveOrganicGrowthPreview
              plan={plan}
              startDate={computedStartTime}
              isAdmin={isAdmin}
              onNewPattern={handleNewPattern}
            />
          </div>

          {/* RIGHT COLUMN: STICKY ORDER SUMMARY & LAUNCH */}
          <aside className="lg:col-span-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto space-y-4">
            <div className="bg-white rounded-3xl border border-[#E4E0D3] p-5 sm:p-6 shadow-subtle space-y-5">
              <div className="flex items-center justify-between pb-3.5 border-b border-[#E4E0D3]">
                <h2 className="text-base font-bold text-[#111413]">Campaign Summary</h2>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#111413] text-[#D4F04F]">
                  {platform}
                </span>
              </div>

              {/* Selected Plan Overview */}
              <div className="p-3.5 rounded-2xl bg-[#FAF9F5] border border-[#E4E0D3] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#111413]">
                    {activePresetMeta.tierBadge} {activePresetMeta.shortTitle}
                  </span>
                  <span className="text-[11px] font-semibold text-[#5E8C1F]">
                    {plan.durationLabel} ramp
                  </span>
                </div>
                <div className="text-[11px] text-[#5B625F] space-y-0.5">
                  <div className="flex justify-between">
                    <span>Starts:</span>
                    <span className="font-semibold text-[#111413]">{formatBdTime(computedStartTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Est. Finish:</span>
                    <span className="font-semibold text-[#111413]">{formatBdTime(finishTime)}</span>
                  </div>
                </div>
              </div>

              {/* Deliverables */}
              <div className="space-y-2 text-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B625F]">
                  Included Deliverables
                </span>
                <div className="divide-y divide-[#E4E0D3]/60 border border-[#E4E0D3] rounded-2xl px-3.5 bg-white">
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-[#5B625F] flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-[#2F6B3A]" /> Views
                    </span>
                    <span className="font-bold text-[#111413] tabular-nums">
                      {plan.totals.views.toLocaleString()}
                    </span>
                  </div>
                  {plan.totals.likes > 0 && (
                    <div className="py-2 flex items-center justify-between">
                      <span className="text-[#5B625F] flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-[#C4552D]" /> Likes
                      </span>
                      <span className="font-bold text-[#111413] tabular-nums">
                        {plan.totals.likes.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {plan.totals.saves > 0 && (
                    <div className="py-2 flex items-center justify-between">
                      <span className="text-[#5B625F] flex items-center gap-1.5">
                        <Bookmark className="w-3.5 h-3.5 text-[#E0A030]" /> Saves
                      </span>
                      <span className="font-bold text-[#111413] tabular-nums">
                        {plan.totals.saves.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {plan.totals.shares > 0 && (
                    <div className="py-2 flex items-center justify-between">
                      <span className="text-[#5B625F] flex items-center gap-1.5">
                        <Share2 className="w-3.5 h-3.5 text-[#7C5CBF]" /> Shares
                      </span>
                      <span className="font-bold text-[#111413] tabular-nums">
                        {plan.totals.shares.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {plan.totals.reposts > 0 && (
                    <div className="py-2 flex items-center justify-between">
                      <span className="text-[#5B625F] flex items-center gap-1.5">
                        <Repeat className="w-3.5 h-3.5 text-[#2A9D8F]" /> Reposts
                      </span>
                      <span className="font-bold text-[#111413] tabular-nums">
                        {plan.totals.reposts.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {plan.totals.comments > 0 && (
                    <div className="py-2 flex items-center justify-between">
                      <span className="text-[#5B625F] flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-[#3D82A2]" /> Comments
                      </span>
                      <span className="font-bold text-[#111413] tabular-nums">
                        {plan.totals.comments.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Price Calculation */}
              <div className="space-y-2 pt-1 border-t border-[#E4E0D3] text-xs">
                <div className="flex justify-between text-[#5B625F]">
                  <span>Base Package</span>
                  <span className="font-semibold text-[#111413] tabular-nums">₹{basePackagePrice.toFixed(2)}</span>
                </div>
                {addOnsTotalPrice > 0 && (
                  <div className="flex justify-between text-[#5B625F]">
                    <span>Additional Signals</span>
                    <span className="font-semibold text-[#111413] tabular-nums">+₹{addOnsTotalPrice.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-baseline justify-between pt-2 border-t border-[#E4E0D3]">
                  <span className="text-sm font-bold text-[#111413]">Total</span>
                  <span className="text-2xl font-black text-[#111413] tabular-nums tracking-tight">
                    ₹{totalCampaignPriceInr.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Wallet Check */}
              <div
                className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${hasSufficientFunds
                    ? "bg-[#FAF9F5] border-[#E4E0D3] text-[#111413]"
                    : "bg-[#FFFBEB] border-[#F59E0B]/40 text-[#92400E]"
                  }`}
              >
                <div className="flex items-center gap-2">
                  <Wallet className={`w-4 h-4 ${hasSufficientFunds ? "text-[#5E8C1F]" : "text-[#D97706]"}`} />
                  <span className="font-medium">Wallet</span>
                </div>
                <div className="text-right tabular-nums">
                  <span className="font-bold">₹{walletBalance.toFixed(2)}</span>
                  {!hasSufficientFunds && (
                    <span className="block text-[10px] font-semibold">Need ₹{shortfallInr.toFixed(2)} more</span>
                  )}
                </div>
              </div>

              {/* Agreement */}
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-[#E4E0D3] accent-[#111413] cursor-pointer"
                />
                <span className="text-[11px] text-[#5B625F] leading-snug">
                  I confirm gradual, view-paced batch execution for this public link.
                </span>
              </label>

              {/* Primary CTA */}
              {renderCtaButton(false)}
            </div>

            {/* Compact Telegram Support Card */}
            <a
              href="https://t.me/Ghostfinds"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-2xl bg-white border border-[#E4E0D3] hover:border-[#111413]/30 flex items-center justify-between gap-3 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FAF9F5] border border-[#E4E0D3] text-[#111413] flex items-center justify-center shrink-0">
                  <Send className="w-3.5 h-3.5 text-[#5E8C1F]" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#111413] block">24/7 Support</span>
                  <span className="text-[11px] text-[#5B625F]">@Ghostfinds on Telegram</span>
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-[#5B625F] group-hover:text-[#111413]" />
            </a>
          </aside>

          {/* STICKY MOBILE / TABLET FLOATING CHECKOUT BAR */}
          <div className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-white/95 backdrop-blur-md border-t border-[#E4E0D3] px-4 py-3 shadow-dropdown">
            <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-[#5B625F] truncate">
                  {platform} • {plan.totals.views.toLocaleString()} views • {plan.durationLabel}
                </div>
                <div className="text-base font-black text-[#111413] tabular-nums leading-tight">
                  ₹{totalCampaignPriceInr.toFixed(2)}
                </div>
              </div>

              <div className="shrink-0">{renderCtaButton(true)}</div>
            </div>
          </div>
        </form>
      </div>
    </MotionConfig>
  );
}

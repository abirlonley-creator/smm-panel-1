"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  Repeat,
  MessageSquare,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Calendar,
  Layers,
  Send,
  Plus,
  Flame,
  Rocket,
  Crown,
  Link2,
  Users,
} from "lucide-react";
import { BinanceAddFundsModal } from "@/components/BinanceAddFundsModal";
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
  formatDurationDaysHours,
} from "@/lib/engagement/deterministic-pattern-engine";

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
  rates?: {
    viewsRate: number;
    likesRate: number;
    savesRate: number;
    sharesRate: number;
    commentsRate?: number;
  };
  presets?: any[];
  services?: any[];
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
  iconColor: string;
  iconBg: string;
  accentBorder: string;
  isPopular?: boolean;
}

function getPresetVisuals(pkg: PackageConfig): PresetVisualMeta {
  const id = (pkg.id || "").toLowerCase();
  const name = (pkg.name || "").toLowerCase();

  if (id.includes("50k") || name.includes("50k")) {
    return {
      tierBadge: "50K",
      shortTitle: "Mega Viral",
      durationShort: "5 Days",
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
      durationShort: "3 Days",
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
      durationShort: "2 Days",
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
      durationShort: "24h",
      icon: Rocket,
      iconColor: "text-indigo-600",
      iconBg: "bg-indigo-500/10 border-indigo-300/50",
      accentBorder: "border-indigo-400",
    };
  }
  return {
    tierBadge: "2K",
    shortTitle: "Starter",
    durationShort: "6h",
    icon: Zap,
    iconColor: "text-sky-500",
    iconBg: "bg-sky-500/10 border-sky-300/50",
    accentBorder: "border-sky-400",
  };
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

  // Step 1: Add-ons state
  const [addOnLikes, setAddOnLikes] = useState<boolean>(true);
  const [addOnSaves, setAddOnSaves] = useState<boolean>(true);
  const [addOnShares, setAddOnShares] = useState<boolean>(true);
  const [addOnReposts, setAddOnReposts] = useState<boolean>(true);
  const [addOnComments, setAddOnComments] = useState<boolean>(false);
  const [commentsCount, setCommentsCount] = useState<number>(10);
  const [customCommentsText, setCustomCommentsText] = useState<string>("");

  // Step 2: URL & Post preview
  const [targetUrl, setTargetUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PostPreviewData | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);

  // Step 2: Follower count & timing
  const [followers, setFollowers] = useState<number>(500);
  const [startMode, setStartMode] = useState<"now" | "schedule">("now");
  const [scheduledDate, setScheduledDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [scheduledTime, setScheduledTime] = useState<string>("12:00");

  // Step 3: Pattern seed
  const [patternSeed, setPatternSeed] = useState<string>(() => `aurasmm_${Math.random().toString(36).substring(2, 9)}`);

  // Step 4: Terms agreement & submission
  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [adminOutOfBalance, setAdminOutOfBalance] = useState<{
    isOutOfBalance: boolean;
    providerName: string;
  } | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<any | null>(null);
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);

  // Active platform rates from status API
  const currentRates = useMemo(() => {
    const ratesObj = platform === "Instagram" ? statusData?.pricingRates?.instagram : statusData?.pricingRates?.tiktok;
    if (ratesObj) return ratesObj;
    if (platform === "Instagram") {
      return { views: 3.5, likes: 2.2, saves: 2.5, shares: 2.5, reposts: 2.5, comments: 20.0 };
    }
    return { views: 4.5, likes: 2.0, saves: 0.8, shares: 0.8, reposts: 0.8, comments: 15.0 };
  }, [platform, statusData?.pricingRates]);

  // Exact dynamic price calculation for any package: (qty/1000) * rate
  const getPackagePrice = useCallback((pkg: PackageConfig, rates: { views: number; likes: number; saves: number; shares: number; reposts: number; comments: number }) => {
    const v = ((pkg.views_total || pkg.base_views || 2000) / 1000) * rates.views;
    const l = ((pkg.likes || 0) / 1000) * rates.likes;
    const s = ((pkg.saves || 0) / 1000) * rates.saves;
    const sh = ((pkg.shares || 0) / 1000) * rates.shares;
    const rep = ((pkg.reposts || 0) / 1000) * rates.reposts;
    const c = ((pkg.comments || 0) / 1000) * rates.comments;
    return Number((v + l + s + sh + rep + c).toFixed(2));
  }, []);

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
        // If statusData is loaded and user is non-admin, packages not in presets list are hidden/disabled
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

    // If regular user (non-admin), completely filter out disabled packages so users cannot view or see them
    if (!statusData?.isAdmin) {
      return list.filter((p) => p.disabled !== true && p.enabled !== false);
    }
    return list;
  }, [statusData?.presets, statusData?.isAdmin, currentRates, getPackagePrice]);

  // Active package definition - auto-falls back to first enabled package if selected is disabled
  const currentPackage: PackageConfig = useMemo(() => {
    const found = packagesList.find((p) => p.id === selectedPackageId && (statusData?.isAdmin || (p.disabled !== true && p.enabled !== false)));
    return found || packagesList[0] || DEFAULT_PACKAGES.tiktok_2k;
  }, [packagesList, selectedPackageId, statusData?.isAdmin]);

  // When switching package, configure default add-ons matching package specs
  const handleSelectPackage = useCallback((pkgId: string) => {
    setSelectedPackageId(pkgId);
    const targetPkg = packagesList.find((p) => p.id === pkgId) || DEFAULT_PACKAGES[pkgId] || DEFAULT_PACKAGES.tiktok_2k;
    setAddOnLikes((targetPkg.likes ?? 0) > 0);
    setAddOnSaves((targetPkg.saves ?? 0) > 0);
    setAddOnShares((targetPkg.shares ?? 0) > 0);
  }, [packagesList]);

  // Compute calculated start time
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

  // Construct effective package config incorporating add-on selections
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
    // If entered lines exceed target comments, restrict to target count
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
    return generatePattern(
      effectivePackage,
      followers,
      patternSeed,
      {
        platformConfig: currentPlatformConfig,
        providerMinimums: currentProviderMinimums,
        startDate: computedStartTime,
        userCommentLines: customCommentsLines,
        commentsMode: "USER_ONLY",
      }
    );
  }, [effectivePackage, followers, patternSeed, currentPlatformConfig, currentProviderMinimums, computedStartTime, customCommentsLines]);

  // Pure rate-based campaign price calculation strictly according to admin configured rates:
  // (views/1000)*viewsRate + (likes/1000)*likesRate + (saves/1000)*savesRate + (shares/1000)*sharesRate + (reposts/1000)*repostsRate + (comments/1000)*commentsRate
  const targetViews = effectivePackage.views_total || effectivePackage.base_views || 2000;
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

  const walletBalance = statusData?.walletBalance ?? 0;
  const hasSufficientFunds = walletBalance >= totalCampaignPriceInr;
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

  // Pick new seed
  const handleNewPattern = useCallback(() => {
    setPatternSeed(`aurasmm_${Math.random().toString(36).substring(2, 9)}`);
  }, []);

  // Fetch status
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

  // Submit order
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
      setErrorMsg(`Please enter all ${targetCommentsCount} custom comments (${customCommentsLines.length}/${targetCommentsCount} entered).`);
      return;
    }

    if (!agreedToTerms) {
      setErrorMsg("Please confirm that you agree to gradual, view-paced delivery.");
      return;
    }

    if (!isReady) {
      setErrorMsg("Fulfillment engines are temporarily synchronizing. Please wait a moment or contact 24/7 Telegram support.");
      return;
    }

    if (!hasSufficientFunds) {
      const needed = Number((totalCampaignPriceInr - walletBalance).toFixed(2));
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

  // Finish time display
  const finishTime = useMemo(() => {
    return new Date(computedStartTime.getTime() + plan.totalDurationMinutes * 60 * 1000);
  }, [computedStartTime, plan.totalDurationMinutes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <img
          src="/brand/logos/mark-on-light.svg"
          alt="Loading..."
          className="w-10 h-10 animate-pulse"
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fadeIn font-sans">
      {/* Navigation Sub-Tabs & Balance Header */}
      <div className="flex items-center justify-between border-b border-[#E4E0D3] pb-3 gap-2">
        <div className="flex items-center gap-2">
          <Link
            href="/engagement"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#D4F04F] hover:bg-[#C5E23A] text-[#111413] shadow-sm transition-all press-scale font-sans"
          >
            <Zap className="w-3.5 h-3.5 fill-[#111413] text-[#111413]" />
            <span>New Campaign</span>
          </Link>
          <Link
            href="/engagement/orders"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white text-[#111413] hover:bg-[#F3F1EA] border border-[#E4E0D3] shadow-xs transition-all press-scale font-sans"
          >
            <Layers className="w-3.5 h-3.5 text-[#5E8C1F]" />
            <span>Campaign Orders</span>
          </Link>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => fetchStatus(true)}
            disabled={refreshing}
            className="px-2.5 py-1.5 rounded-xl border border-[#E4E0D3] bg-white hover:bg-[#F3F1EA] text-xs font-semibold text-[#111413] flex items-center gap-1.5 transition-all shadow-2xs font-sans cursor-pointer press-scale"
            title="Refresh balance"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#5E8C1F] ${refreshing ? "animate-spin" : ""}`} />
            <span className="font-bold">₹{walletBalance.toFixed(2)}</span>
          </button>
          <a
            href="https://t.me/Ghostfinds"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-[#229ED9]/10 hover:bg-[#229ED9]/15 text-[#229ED9] border border-[#229ED9]/30 text-xs font-bold flex items-center gap-1.5 transition-all font-sans"
          >
            <Send className="w-3 h-3" />
            <span className="hidden sm:inline">24/7 Support</span>
          </a>
        </div>
      </div>

      {/* Success Receipt Banner */}
      {successReceipt && (
        <div className="p-4 sm:p-5 rounded-3xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 space-y-3 animate-fadeIn shadow-subtle font-sans">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 stroke-[3]" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-emerald-950 font-sans">
                  Campaign Successfully Scheduled!
                </h3>
                <p className="text-xs text-emerald-800 font-sans">
                  Order ID: <strong className="font-sans">#{successReceipt.orderRef}</strong> • Package: <strong>{successReceipt.presetName}</strong> ({successReceipt.durationHours}h) • {successReceipt.runsCount} batches scheduled.
                </p>
              </div>
            </div>
            <Link
              href={`/engagement/orders/${successReceipt.orderId}`}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-subtle font-sans"
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
          orderType={`${platform} Engagement Campaign`}
          serviceName={currentPackage.name}
          onDismiss={() => setAdminOutOfBalance(null)}
        />
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3 text-xs font-semibold animate-fadeIn font-sans">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
        </div>
      )}

      {/* 4-STEP STREAMLINED FLOW */}
      <form onSubmit={handleCreateOrder} className="space-y-6 font-sans">
        {/* PLATFORM SELECTOR (TikTok vs Instagram) */}
        <div className="bg-white rounded-3xl border border-[#E4E0D3] p-4 sm:p-5 shadow-subtle space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#5E8C1F]" />
              <span className="font-extrabold text-sm text-[#111413] font-sans">
                Select Platform
              </span>
            </div>
            <span className="text-[11px] font-semibold text-[#5B625F] font-sans">
              Algorithmic organic pacing tailored per platform
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* TikTok Button */}
            <button
              type="button"
              onClick={() => {
                setPlatform("TikTok");
                if (targetUrl.includes("instagram.com")) setTargetUrl("");
              }}
              className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex items-center justify-between press-scale font-sans ${
                platform === "TikTok"
                  ? "bg-[#111413] border-[#111413] text-white shadow-md ring-2 ring-[#D4F04F]/40"
                  : "bg-[#F8F9FD] border-[#DEE0ED] hover:border-[#111413]/30 text-[#111413]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    platform === "TikTok"
                      ? "bg-[#D4F04F] text-[#111413]"
                      : "bg-white text-[#111413] border border-[#DEE0ED]"
                  }`}
                >
                  <TikTokIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm">TikTok Organic</span>
                    {!isTikTokEnabled && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-200">
                        Paused
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs block ${
                      platform === "TikTok" ? "text-gray-300" : "text-[#5B625F]"
                    }`}
                  >
                    FYP Velocity & View-Paced Engagement
                  </span>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                  platform === "TikTok"
                    ? "bg-[#D4F04F] border-[#D4F04F] text-[#111413]"
                    : "border-gray-300 bg-white"
                }`}
              >
                {platform === "TikTok" && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </button>

            {/* Instagram Button */}
            <button
              type="button"
              onClick={() => {
                setPlatform("Instagram");
                if (targetUrl.includes("tiktok.com")) setTargetUrl("");
              }}
              className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex items-center justify-between press-scale font-sans ${
                platform === "Instagram"
                  ? "bg-[#111413] border-[#111413] text-white shadow-md ring-2 ring-[#D4F04F]/40"
                  : "bg-[#F8F9FD] border-[#DEE0ED] hover:border-[#111413]/30 text-[#111413]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    platform === "Instagram"
                      ? "bg-[#D4F04F] text-[#111413]"
                      : "bg-white text-[#111413] border border-[#DEE0ED]"
                  }`}
                >
                  <InstagramIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm">Instagram Organic</span>
                    {!isInstagramEnabled && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-200">
                        Paused
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs block ${
                      platform === "Instagram" ? "text-gray-300" : "text-[#5B625F]"
                    }`}
                  >
                    Reels & Posts Configured Waves Delivery
                  </span>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                  platform === "Instagram"
                    ? "bg-[#D4F04F] border-[#D4F04F] text-[#111413]"
                    : "border-gray-300 bg-white"
                }`}
              >
                {platform === "Instagram" && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </button>
          </div>

          {/* Platform Paused Warning if current platform disabled */}
          {!isCurrentPlatformEnabled && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2.5 text-xs font-semibold animate-fadeIn font-sans">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {platform} engagement orders are temporarily paused by administrator. You can preview delivery plans, but order placement is disabled.
              </span>
            </div>
          )}
        </div>

        {/* STEP 1: CHOOSE GROWTH PACKAGE */}
        <div className="bg-white rounded-3xl border border-[#E4E0D3] p-5 sm:p-6 shadow-subtle space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E4E0D3]">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-[#111413] text-[#D4F04F] text-xs font-black flex items-center justify-center shadow-xs font-sans shrink-0">
                1
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#111413] font-sans">
                  Choose Growth Package
                </h2>
                <p className="text-[11px] text-[#5B625F] font-sans">
                  Exact views delivered on an organic 15-minute schedule
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-[#5E8C1F] bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/80 hidden sm:inline-flex items-center gap-1 font-sans">
              <ShieldCheck className="w-3.5 h-3.5 text-[#5E8C1F]" />
              <span>Gradual, view-paced delivery</span>
            </span>
          </div>

          {/* Package Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {packagesList.map((pkg, idx) => {
              const isSelected = selectedPackageId === pkg.id;
              const visuals = getPresetVisuals(pkg);
              const IconComponent = visuals.icon;

              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => handleSelectPackage(pkg.id)}
                  className={`group relative p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between press-scale font-sans ${
                    idx === 4 ? "col-span-2 sm:col-span-1 lg:col-span-1" : "col-span-1"
                  } ${
                    isSelected
                      ? "bg-[#D4F04F]/[0.08] border-2 border-[#D4F04F] shadow-sm ring-2 ring-[#D4F04F]/20 -translate-y-0.5"
                      : "bg-white border-[#E4E0D3] hover:border-[#111413]/30 hover:shadow-xs"
                  }`}
                >
                  {/* Top: Icon + Duration */}
                  <div className="w-full flex items-center justify-between gap-1 mb-2">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center border transition-transform duration-200 group-hover:scale-105 shrink-0 ${visuals.iconBg}`}
                    >
                      <IconComponent className={`w-3.5 h-3.5 ${visuals.iconColor}`} />
                    </div>

                    <div className="flex items-center gap-1 font-sans">
                      {pkg.disabled && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-300 font-sans">
                          Disabled
                        </span>
                      )}
                      {visuals.isPopular && !isSelected && !pkg.disabled && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200/60 font-sans">
                          Hot
                        </span>
                      )}
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider font-sans ${
                          isSelected
                            ? "bg-[#111413] text-[#D4F04F] shadow-2xs"
                            : "bg-[#F3F1EA] text-[#5B625F]"
                        }`}
                      >
                        About {pkg.base_duration_hours}h
                      </span>
                    </div>
                  </div>

                  {/* Middle: Exact Views & Package Name */}
                  <div className="space-y-1">
                    <div>
                      <div className="flex items-baseline gap-1 font-sans">
                        <span className="text-base sm:text-lg font-black text-[#111413] font-sans tracking-tight leading-none">
                          {(pkg.views_total ?? 0).toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-[#5E8C1F] font-sans">+ buffer</span>
                      </div>
                      <div className="text-[11px] font-bold text-[#111413] truncate mt-1 font-sans">
                        {visuals.tierBadge} {visuals.shortTitle}
                      </div>
                    </div>

                    {/* Follower Note */}
                    {pkg.min_followers_note && (
                      <div className="text-[10px] font-medium text-[#5B625F] flex items-center gap-1 font-sans">
                        <Users className="w-3 h-3 text-[#5B625F]/70 shrink-0" />
                        <span className="truncate">{pkg.min_followers_note}</span>
                      </div>
                    )}

                    {/* Included Metrics */}
                    <div className="flex items-center flex-wrap gap-1 text-[10px] font-semibold text-[#5B625F] pt-0.5 font-sans">
                      {(pkg.likes ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-rose-600 font-sans font-bold bg-rose-50/80 px-1.5 py-0.5 rounded border border-rose-200/50">
                          <Heart className="w-2.5 h-2.5 fill-rose-500 text-rose-500" />
                          <span>+{pkg.likes}</span>
                        </span>
                      )}
                      {(pkg.saves ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-amber-600 font-sans font-bold bg-amber-50/80 px-1.5 py-0.5 rounded border border-amber-200/50">
                          <Bookmark className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                          <span>+{pkg.saves}</span>
                        </span>
                      )}
                      {(pkg.shares ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-purple-600 font-sans font-bold bg-purple-50/80 px-1.5 py-0.5 rounded border border-purple-200/50">
                          <Share2 className="w-2.5 h-2.5 text-purple-500" />
                          <span>+{pkg.shares}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom: Exact Price */}
                  <div className="pt-2 mt-2 border-t border-[#E4E0D3]/60 flex items-center justify-between w-full font-sans">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-[#5B625F] block leading-none font-sans">Price</span>
                      <span className="text-xs sm:text-sm font-black text-[#111413] font-sans">
                        ₹{Number(pkg.price_inr).toFixed(2)}
                      </span>
                    </div>

                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${
                        isSelected
                          ? "bg-[#111413] border-[#111413] text-[#D4F04F] shadow-2xs"
                          : "border-[#E4E0D3] bg-white group-hover:border-[#111413]/50"
                      }`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3] text-[#D4F04F]" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Live Add-ons Configuration */}
          <div className="pt-3 border-t border-[#E4E0D3] space-y-2">
            <span className="text-xs font-bold text-[#111413] block font-sans">
              Customize Engagement Add-ons (Included & Optional)
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs font-sans">
              {/* Likes Toggle */}
              <label
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                  addOnLikes
                    ? "bg-rose-50/60 border-rose-200 text-rose-950"
                    : "bg-white border-[#E4E0D3] text-[#5B625F] opacity-70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Heart className={`w-3.5 h-3.5 ${addOnLikes ? "fill-rose-500 text-rose-500" : "text-gray-400"}`} />
                  <div>
                    <span className="font-bold block text-xs">Likes</span>
                    <span className="text-[10px] text-[#5B625F]">+{currentPackage.likes} (Included)</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={addOnLikes}
                  onChange={(e) => setAddOnLikes(e.target.checked)}
                  className="rounded text-[#111413] focus:ring-0 cursor-pointer"
                />
              </label>

              {/* Saves Toggle */}
              <label
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                  addOnSaves
                    ? "bg-amber-50/60 border-amber-200 text-amber-950"
                    : "bg-white border-[#E4E0D3] text-[#5B625F] opacity-70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Bookmark className={`w-3.5 h-3.5 ${addOnSaves ? "fill-amber-500 text-amber-500" : "text-gray-400"}`} />
                  <div>
                    <span className="font-bold block text-xs">Saves</span>
                    <span className="text-[10px] text-[#5B625F]">
                      {(currentPackage.saves ?? 0) > 0
                        ? `+${currentPackage.saves} (Included)`
                        : `+20 (+₹${((20 / 1000) * currentRates.saves).toFixed(2)})`}
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={addOnSaves}
                  onChange={(e) => setAddOnSaves(e.target.checked)}
                  className="rounded text-[#111413] focus:ring-0 cursor-pointer"
                />
              </label>

              {/* Shares Toggle */}
              <label
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                  addOnShares
                    ? "bg-purple-50/60 border-purple-200 text-purple-950"
                    : "bg-white border-[#E4E0D3] text-[#5B625F] opacity-70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Share2 className={`w-3.5 h-3.5 ${addOnShares ? "text-purple-600" : "text-gray-400"}`} />
                  <div>
                    <span className="font-bold block text-xs">Shares</span>
                    <span className="text-[10px] text-[#5B625F]">
                      {(currentPackage.shares ?? 0) > 0
                        ? `+${currentPackage.shares} (Included)`
                        : `+10 (+₹${((10 / 1000) * currentRates.shares).toFixed(2)})`}
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={addOnShares}
                  onChange={(e) => setAddOnShares(e.target.checked)}
                  className="rounded text-[#111413] focus:ring-0 cursor-pointer"
                />
              </label>

              {/* Reposts Toggle */}
              <label
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                  addOnReposts
                    ? "bg-indigo-50/60 border-indigo-200 text-indigo-950"
                    : "bg-white border-[#E4E0D3] text-[#5B625F] opacity-70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Repeat className={`w-3.5 h-3.5 ${addOnReposts ? "text-indigo-600" : "text-gray-400"}`} />
                  <div>
                    <span className="font-bold block text-xs">Reposts</span>
                    <span className="text-[10px] text-[#5B625F]">
                      {(currentPackage.reposts ?? 0) > 0
                        ? `+${currentPackage.reposts} (Included)`
                        : `+10 (+₹${((10 / 1000) * currentRates.reposts).toFixed(2)})`}
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={addOnReposts}
                  onChange={(e) => setAddOnReposts(e.target.checked)}
                  className="rounded text-[#111413] focus:ring-0 cursor-pointer"
                />
              </label>

              {/* Comments Toggle (Optional Add-on) */}
              <div
                className={`p-2.5 rounded-xl border transition-all ${
                  addOnComments
                    ? "bg-sky-50/60 border-sky-200 text-sky-950"
                    : "bg-white border-[#E4E0D3] text-[#5B625F]"
                }`}
              >
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <MessageCircle className={`w-3.5 h-3.5 ${addOnComments ? "text-sky-600" : "text-gray-400"}`} />
                    <div>
                      <span className="font-bold block text-xs">Custom Comments</span>
                      <span className="text-[10px] text-[#5B625F]">
                        {addOnComments
                          ? `+${commentsCount} comments (+₹${((commentsCount / 1000) * currentRates.comments).toFixed(2)})`
                          : `Optional (+₹${((10 / 1000) * currentRates.comments).toFixed(2)}/10)`}
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={addOnComments}
                    onChange={(e) => setAddOnComments(e.target.checked)}
                    className="rounded text-[#111413] focus:ring-0 cursor-pointer"
                  />
                </label>
                {addOnComments && (
                  <div className="flex items-center gap-1.5 pt-2 border-t border-sky-200/60 mt-2">
                    <span className="text-[10px] font-bold text-sky-900">Qty:</span>
                    {[1, 5, 10, 20, 50].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCommentsCount(num)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                          commentsCount === num
                            ? "bg-sky-600 text-white border-sky-600 shadow-2xs"
                            : "bg-white text-sky-900 border-sky-200 hover:bg-sky-100"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* STEP 2: VIDEO LINK & TARGET PROFILE */}
        <div className="bg-white rounded-3xl border border-[#E4E0D3] p-5 sm:p-6 shadow-subtle space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E4E0D3]">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-[#111413] text-[#D4F04F] text-xs font-black flex items-center justify-center shadow-xs font-sans shrink-0">
                2
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#111413] font-sans">
                  {platform === "Instagram" ? "Instagram Post/Reel URL & Target Profile" : "TikTok Post URL & Target Profile"}
                </h2>
                <p className="text-[11px] text-[#5B625F] font-sans">
                  {platform === "Instagram"
                    ? "Paste your public Instagram post or reel link and account details"
                    : "Paste your public TikTok video link and account details"}
                </p>
              </div>
            </div>

            {((platform === "Instagram" && targetUrl.toLowerCase().includes("instagram.com")) ||
              (platform === "TikTok" && targetUrl.toLowerCase().includes("tiktok.com"))) ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-[#5E8C1F] border border-emerald-200 font-sans">
                <Check className="w-3 h-3 stroke-[3]" />
                <span>Link Ready</span>
              </span>
            ) : (
              <span className="text-[11px] text-[#5B625F] font-medium hidden sm:inline font-sans">
                {platform === "Instagram" ? "Supports reels, photo posts & carousels" : "Supports video, carousel & short links"}
              </span>
            )}
          </div>

          <div className="relative">
            <input
              type="url"
              required
              placeholder={
                platform === "Instagram"
                  ? "https://www.instagram.com/reel/C3x9... or https://www.instagram.com/p/..."
                  : "https://www.tiktok.com/@username/video/1234567890..."
              }
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="w-full pl-11 pr-10 py-3.5 rounded-2xl bg-white border border-[#E4E0D3] text-xs sm:text-sm font-semibold text-[#111413] placeholder-[#5B625F]/50 focus:outline-none focus:border-[#111413] focus:bg-white focus:ring-2 focus:ring-[#111413]/10 transition-all shadow-inner font-sans"
            />
            <Link2 className="w-4 h-4 text-[#5B625F] absolute left-4 top-1/2 -translate-y-1/2" />
            {previewLoading && (
              <Loader2 className="w-4 h-4 text-[#5E8C1F] animate-spin absolute right-4 top-1/2 -translate-y-1/2" />
            )}
          </div>

          {/* Post Preview Card */}
          {previewData && (
            <div className="p-3 sm:p-4 rounded-2xl bg-[#F3F1EA]/50 border border-[#E4E0D3] flex items-center gap-3.5 animate-fadeIn font-sans">
              {previewData.thumbnailUrl ? (
                <img
                  src={previewData.thumbnailUrl}
                  alt={previewData.authorName || "TikTok Post"}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover shrink-0 border border-gray-200 shadow-2xs"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-gray-200 flex items-center justify-center shrink-0 text-gray-500 font-bold text-xs">
                  TikTok
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-[#111413] font-sans truncate">
                    {previewData.authorName || previewData.authorHandle}
                  </span>
                  <span className="text-[10px] font-bold text-[#5E8C1F] bg-[#5E8C1F]/10 px-2 py-0.5 rounded-full font-sans">
                    {previewData.authorHandle}
                  </span>
                </div>
                <p className="text-[11px] text-[#5B625F] truncate font-sans">
                  {previewData.title || "TikTok Video"}
                </p>
                {typeof previewData.views === "number" && (
                  <span className="text-[10px] font-semibold text-[#5E8C1F] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-sans inline-block">
                    Current: ~{previewData.views.toLocaleString()} views
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Profile Followers & Timing Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* Followers Field */}
            <div className="space-y-1.5 font-sans">
              <label className="text-xs font-bold text-[#111413] block font-sans">
                Account Follower Count (Tunes initial push pace)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={followers}
                  onChange={(e) => setFollowers(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E4E0D3] text-xs font-semibold text-[#111413] focus:outline-none focus:border-[#111413] font-sans"
                />
                <div className="flex items-center gap-1 shrink-0 font-sans">
                  <button
                    type="button"
                    onClick={() => setFollowers(500)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                      followers < 1000 ? "bg-[#111413] text-[#D4F04F] border-[#111413]" : "bg-white text-[#5B625F] border-[#E4E0D3] hover:bg-[#F3F1EA]"
                    }`}
                  >
                    &lt;1k
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowers(3500)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                      followers >= 1000 && followers <= 10000 ? "bg-[#111413] text-[#D4F04F] border-[#111413]" : "bg-white text-[#5B625F] border-[#E4E0D3] hover:bg-[#F3F1EA]"
                    }`}
                  >
                    1k–10k
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowers(15000)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                      followers > 10000 ? "bg-[#111413] text-[#D4F04F] border-[#111413]" : "bg-white text-[#5B625F] border-[#E4E0D3] hover:bg-[#F3F1EA]"
                    }`}
                  >
                    &gt;10k
                  </button>
                </div>
              </div>
            </div>

            {/* Timing Selector */}
            <div className="space-y-1.5 font-sans">
              <label className="text-xs font-bold text-[#111413] block font-sans">
                Campaign Start Timing
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStartMode("now")}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer font-sans ${
                    startMode === "now"
                      ? "bg-[#111413] text-[#D4F04F] border-[#111413] shadow-xs"
                      : "bg-white text-[#5B625F] border-[#E4E0D3] hover:bg-[#F3F1EA]"
                  }`}
                >
                  Start Now
                </button>
                <button
                  type="button"
                  onClick={() => setStartMode("schedule")}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer font-sans ${
                    startMode === "schedule"
                      ? "bg-[#111413] text-[#D4F04F] border-[#111413] shadow-xs"
                      : "bg-white text-[#5B625F] border-[#E4E0D3] hover:bg-[#F3F1EA]"
                  }`}
                >
                  Schedule Start
                </button>
              </div>

              {startMode === "schedule" && (
                <div className="flex items-center gap-2 pt-1 font-sans">
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-xl bg-white border border-[#E4E0D3] text-xs font-semibold text-[#111413] font-sans"
                  />
                  <input
                    type="time"
                    step="900"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-28 px-2.5 py-1.5 rounded-xl bg-white border border-[#E4E0D3] text-xs font-semibold text-[#111413] font-sans"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Custom Comments (1 per line) Section */}
          {targetCommentsCount > 0 && (
            <div className="pt-4 border-t border-[#E4E0D3] space-y-2.5 font-sans">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-[#111413] flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-sky-600" />
                  <span>Comments (1 per line)</span>
                </label>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border transition-colors ${
                      customCommentsLines.length === targetCommentsCount
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : customCommentsLines.length > targetCommentsCount
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-sky-50 text-sky-800 border-sky-200"
                    }`}
                  >
                    {customCommentsLines.length} / {targetCommentsCount} comments
                  </span>
                </div>
              </div>

              {/* Dark rounded textarea matching design specification */}
              <div className="relative rounded-2xl bg-[#0E1217] border border-[#232936] p-3 shadow-inner">
                <textarea
                  rows={Math.max(4, Math.min(8, targetCommentsCount))}
                  value={customCommentsText}
                  onChange={handleCommentsChange}
                  onKeyDown={handleCommentsKeyDown}
                  placeholder={`Add your custom comments here (1 per line)...\ne.g.\nLove this reel! 🔥\nGreat content 👏\nAmazing post!`}
                  className="w-full bg-transparent text-xs sm:text-sm text-gray-100 placeholder-gray-500 font-mono outline-none resize-y"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#5B625F]">
                <span>
                  {customCommentsLines.length === targetCommentsCount ? (
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 stroke-[3]" /> All {targetCommentsCount} comments entered
                    </span>
                  ) : customCommentsLines.length > targetCommentsCount ? (
                    <span className="text-rose-600 font-bold">
                      Maximum {targetCommentsCount} comments allowed. Extra lines will not be sent.
                    </span>
                  ) : (
                    <span>
                      Please enter {targetCommentsCount - customCommentsLines.length} more comment{targetCommentsCount - customCommentsLines.length === 1 ? "" : "s"} (1 per line)
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  Provider: Zefame
                </span>
              </div>
            </div>
          )}
        </div>

        {/* STEP 3: LIVE ORGANIC GROWTH PREVIEW */}
        <div className="space-y-3 font-sans">
          <LiveOrganicGrowthPreview
            plan={plan}
            startDate={computedStartTime}
            isAdmin={isAdmin}
            onNewPattern={handleNewPattern}
          />
        </div>

        {/* STEP 4: REVIEW & LAUNCH */}
        <div className="bg-white rounded-3xl border border-[#E4E0D3] p-5 sm:p-6 shadow-subtle space-y-4 font-sans">
          <div className="flex items-center justify-between pb-3 border-b border-[#E4E0D3]">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-[#111413] text-[#D4F04F] text-xs font-black flex items-center justify-center shadow-xs font-sans shrink-0">
                4
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#111413] font-sans">
                  Review & Launch
                </h2>
                <p className="text-[11px] text-[#5B625F] font-sans">
                  Verified organic delivery schedule • Exact itemized pricing
                </p>
              </div>
            </div>

            <div className="text-right font-sans">
              <span className="text-[10px] uppercase font-bold text-[#5B625F] block leading-none font-sans">Your Balance</span>
              <span className="text-sm font-bold font-sans text-[#111413]">
                ₹{walletBalance.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Itemized Price & Delivery Schedule Box */}
          <div className="p-4 rounded-2xl bg-[#F3F1EA]/50 border border-[#E4E0D3] space-y-3 font-sans">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E4E0D3]/70">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-[#5B625F] block font-sans">Total Campaign Price</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-[#111413] font-sans tracking-tight">
                    ₹{totalCampaignPriceInr.toFixed(2)}
                  </span>
                  <span className="text-xs text-[#5B625F] font-sans">
                    ({currentPackage.name} • {plan.durationLabel})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                {hasSufficientFunds ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-[#5E8C1F] border border-emerald-200 text-xs font-bold font-sans">
                    <Check className="w-3.5 h-3.5 stroke-[3] text-[#5E8C1F]" />
                    <span>Sufficient Funds</span>
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold font-sans">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Need ₹{(totalCampaignPriceInr - walletBalance).toFixed(2)} More</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddFundsModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-[#F0B90B] hover:bg-[#e0a800] text-[#1E2329] text-xs font-black shadow-subtle flex items-center gap-1 transition-all press-scale cursor-pointer font-sans"
                    >
                      <Zap className="w-3 h-3 fill-[#1E2329]" />
                      <span>Add Funds</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Itemized Cost Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-sans text-[#5B625F]">
              <div>
                <span className="block text-[10px] font-bold uppercase text-[#5B625F]/80">Base Package</span>
                <span className="font-extrabold text-[#111413]">₹{getPackagePrice(currentPackage, currentRates).toFixed(2)}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-[#5B625F]/80">Add-ons Total</span>
                <span className="font-extrabold text-[#111413]">₹{Math.max(0, Number((totalCampaignPriceInr - getPackagePrice(currentPackage, currentRates)).toFixed(2))).toFixed(2)}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-[#5B625F]/80">Starts</span>
                <span className="font-semibold text-[#111413]">{formatBdTime(computedStartTime)}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-[#5B625F]/80">Finishes In</span>
                <span className="font-semibold text-[#111413]">{plan.durationLabel}</span>
              </div>
            </div>
          </div>

          {/* Terms Checkbox */}
          <div className="flex items-start gap-2.5 pt-1">
            <input
              type="checkbox"
              id="engagementTerms"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 rounded text-[#111413] focus:ring-0 cursor-pointer"
            />
            <label htmlFor="engagementTerms" className="text-xs text-[#5B625F] font-medium leading-relaxed cursor-pointer font-sans">
              I confirm this order for <strong>{plan.viewsTotal.toLocaleString()} views</strong> ({(currentPackage.views_total ?? 0).toLocaleString()} + buffer). I understand delivery is gradual, view-paced, and synchronized across a 15-minute grid.
            </label>
          </div>

          {/* Primary Action Button */}
          {hasSufficientFunds ? (
            <button
              type="submit"
              disabled={submitting || !agreedToTerms || !isCurrentPlatformEnabled || (targetCommentsCount > 0 && customCommentsLines.length < targetCommentsCount)}
              className={`w-full py-4 rounded-xl text-sm font-black tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer press-scale font-sans ${
                submitting || !agreedToTerms || !isCurrentPlatformEnabled || (targetCommentsCount > 0 && customCommentsLines.length < targetCommentsCount)
                  ? "bg-[#E4E0D3] text-[#5B625F] cursor-not-allowed opacity-60"
                  : "bg-[#D4F04F] hover:bg-[#C5E23A] text-[#111413] shadow-[#D4F04F]/25 active:scale-[0.98]"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#111413]" />
                  <span>Launching {platform} Campaign...</span>
                </>
              ) : !isCurrentPlatformEnabled ? (
                <span>{platform} Ordering Paused by Admin</span>
              ) : targetCommentsCount > 0 && customCommentsLines.length < targetCommentsCount ? (
                <span>Add All {targetCommentsCount} Custom Comments ({customCommentsLines.length}/{targetCommentsCount})</span>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-[#111413] text-[#111413]" />
                  <span>Launch {platform} Campaign • ₹{totalCampaignPriceInr.toFixed(2)}</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddFundsModal(true)}
              className="w-full py-4 rounded-xl text-sm font-black tracking-wide bg-[#F0B90B] hover:bg-[#e0a800] text-[#1E2329] shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-all press-scale cursor-pointer active:scale-[0.98] font-sans"
            >
              <Zap className="w-4 h-4 fill-[#1E2329]" />
              <span>Add Funds (Need ₹{(totalCampaignPriceInr - walletBalance).toFixed(2)})</span>
            </button>
          )}

          <div className="pt-2 text-center text-xs text-[#5B625F] flex items-center justify-center gap-3 font-sans">
            <span>✓ Gradual, view-paced delivery</span>
            <span>•</span>
            <span>✓ Views-first synchronized</span>
            <span>•</span>
            <a href="https://t.me/Ghostfinds" target="_blank" rel="noopener noreferrer" className="text-[#5E8C1F] hover:text-[#3F6212] font-bold font-sans">
              24/7 Telegram Support
            </a>
          </div>
        </div>
      </form>

      {/* 24/7 Live Support Banner */}
      <div className="p-3.5 rounded-2xl bg-white border border-[#E4E0D3] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs shadow-xs font-sans">
        <div className="flex items-center gap-2.5 font-sans">
          <div className="w-8 h-8 rounded-xl bg-[#229ED9]/10 text-[#229ED9] flex items-center justify-center shrink-0">
            <Send className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-[#111413] block">Need Assistance or Instant Approval?</span>
            <span className="text-[11px] text-[#5B625F] font-normal">Our team is active 24/7 on Telegram.</span>
          </div>
        </div>

        <a
          href="https://t.me/Ghostfinds"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-2 sm:py-1.5 rounded-xl bg-[#229ED9] hover:bg-[#0077b5] text-white text-xs font-bold transition-all shadow-subtle flex items-center justify-center gap-1.5 press-scale shrink-0 text-center font-sans"
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

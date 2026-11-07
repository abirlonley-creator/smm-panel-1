"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Repeat,
  ArrowRight,
  Clock,
  Sparkles,
  Shuffle,
  Calendar,
  Server,
  Wallet,
  Check,
  Search,
  X,
  RefreshCw,
  ArrowLeft,
  Send,
  Video,
  Music,
  Share2,
  Globe,
  Layers,
  Tv,
  Headphones,
  Compass,
  ExternalLink,
  Star,
} from "lucide-react";

interface ServiceItem {
  id: string;
  externalId: string;
  providerServiceId?: string;
  providerId?: string;
  providerName?: string;
  userProviderId?: string;
  name: string;
  platform: string;
  category: string;
  description: string;
  minQuantity: number;
  maxQuantity: number;
  ratePer1000: number;
  dripFeedSupported?: boolean;
  currency?: string;
  isFavourite?: boolean;
}

interface ProviderInfo {
  id: string;
  name: string;
  currency: string;
  balance?: number | null;
  apiUrl?: string;
  isActive?: boolean;
  servicesCount?: number;
}

interface RunItem {
  runNumber: number;
  quantity: number;
  timeLabel: string;
}

interface OrderReceipt {
  id: string;
  orderId?: string;
  serviceName: string;
  link: string;
  quantity: number;
  charge: number;
  currency: string;
  balance?: number | null;
  isDripFeed?: boolean;
}

const PLATFORMS_LIST: Array<{ key: string; label: string; icon: any }> = [
  { key: "FAVOURITES", label: "Favourites", icon: Star },
  { key: "ALL", label: "All", icon: Layers },
  { key: "Telegram", label: "Telegram", icon: Send },
  { key: "Instagram", label: "Instagram", icon: Sparkles },
  { key: "YouTube", label: "YouTube", icon: Tv },
  { key: "TikTok", label: "TikTok", icon: Video },
  { key: "Twitter", label: "Twitter", icon: Share2 },
  { key: "Facebook", label: "Facebook", icon: Globe },
  { key: "Spotify", label: "Spotify", icon: Headphones },
  { key: "LinkedIn", label: "LinkedIn", icon: Globe },
  { key: "Other", label: "+ Other", icon: Compass },
];

function formatCurrency(amount: number, currency = "USD"): string {
  const c = (currency || "USD").toUpperCase();
  const symMap: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    BDT: "৳",
    GBP: "£",
  };
  const sym = symMap[c] || `${currency} `;
  const num = Number(amount);
  if (isNaN(num)) return `${sym}0`;
  const formatted = num.toFixed(5).replace(/0+$/, "").replace(/\.$/, "") || "0";
  return `${sym}${formatted}`;
}

function matchesPlatform(service: ServiceItem, platKey: string): boolean {
  if (platKey === "ALL") return true;
  if (platKey === "FAVOURITES") return Boolean(service.isFavourite);
  const p = (service.platform || "").toLowerCase();
  const c = (service.category || "").toLowerCase();
  const n = (service.name || "").toLowerCase();
  const k = platKey.toLowerCase();

  if (k === "other") {
    const known = ["telegram", "instagram", "youtube", "tiktok", "twitter", "facebook", "spotify", "linkedin"];
    return !known.some((kn) => p.includes(kn) || c.includes(kn) || n.includes(kn));
  }
  if (k.startsWith("twitter")) {
    return p.includes("twitter") || p.includes(" x ") || c.includes("twitter") || c.includes(" x ") || n.includes("twitter");
  }
  return p.includes(k) || c.includes(k) || n.includes(k);
}

function formatBdTime(date: Date): string {
  try {
    return date.toLocaleTimeString("en-US", {
      timeZone: "Asia/Dhaka",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return date.toLocaleTimeString();
  }
}

function formatBdDate(date: Date): string {
  try {
    return date.toLocaleDateString("en-US", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return date.toLocaleDateString();
  }
}

function NewOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Mode: "NOW" (Instant / Drip) or "SCHEDULED" (BD Time Scheduler)
  const [orderMode, setOrderMode] = useState<"NOW" | "SCHEDULED">("NOW");

  // Catalog State (In-Memory Cached for 0ms Instant Switching)
  const [allServices, setAllServices] = useState<ServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [refreshingServices, setRefreshingServices] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");

  // Provider / Double API State
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string>("");
  const [providerFilter, setProviderFilter] = useState<string>("ALL");

  // Search State (Fast Instant Search)
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Target Input
  const [targetUrl, setTargetUrl] = useState<string>("");

  // Single Quantity State
  const [quantity, setQuantity] = useState<number | "">("");

  // Drip Feed State
  const [isDripFeed, setIsDripFeed] = useState<boolean>(false);
  const [dripRuns, setDripRuns] = useState<number>(5);
  const [dripIntervalMinutes, setDripIntervalMinutes] = useState<number>(60);

  // Min-Max Random Range Feature
  const [isRandomRange, setIsRandomRange] = useState<boolean>(false);
  const [minQtyRange, setMinQtyRange] = useState<number>(10);
  const [maxQtyRange, setMaxQtyRange] = useState<number>(14);
  const [runItems, setRunItems] = useState<RunItem[]>([]);

  // BD Time Scheduler State
  const [scheduledBdDate, setScheduledBdDate] = useState<string>("");
  const [scheduledBdTime, setScheduledBdTime] = useState<string>("");
  const [bdCurrentTimeDisplay, setBdCurrentTimeDisplay] = useState<string>("");

  // Platform Filter State (Matching Xmedia's Clean Pill Bar)
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");

  // Submission State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderReceipt, setOrderReceipt] = useState<OrderReceipt | null>(null);

  // Initialize BD Time clock and default scheduled time (1 hour ahead)
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setBdCurrentTimeDisplay(`${formatBdDate(now)} at ${formatBdTime(now)} (BST / UTC+6)`);
    }
    updateClock();
    const interval = setInterval(updateClock, 30000);

    // Default scheduled time: now + 60 minutes in BD Time (UTC+6)
    const future = new Date(Date.now() + 60 * 60 * 1000 + 6 * 60 * 60 * 1000);
    const dateStr = future.toISOString().split("T")[0];
    const hours = String(future.getUTCHours()).padStart(2, "0");
    const mins = String(future.getUTCMinutes()).padStart(2, "0");
    setScheduledBdDate(dateStr);
    setScheduledBdTime(`${hours}:${mins}`);

    return () => clearInterval(interval);
  }, []);

  // Compute Service Counts for each provider in memory
  const providerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of providers) {
      counts[p.id] = typeof p.servicesCount === "number" ? p.servicesCount : 0;
    }
    for (const s of allServices) {
      if (s.providerId && counts[s.providerId] !== undefined) {
        counts[s.providerId] = (counts[s.providerId] || 0) + 1;
      }
    }
    for (const p of providers) {
      if (!counts[p.id]) {
        const matchByName = allServices.filter(
          (s) =>
            s.providerId === p.id ||
            s.userProviderId === p.id ||
            s.providerName?.toLowerCase() === p.name.toLowerCase()
        ).length;
        counts[p.id] = matchByName;
      }
    }
    return counts;
  }, [allServices, providers]);

  // The active provider object currently displayed in the switcher banner
  const activeProvider = useMemo(() => {
    if (providerFilter !== "ALL") {
      const found = providers.find((p) => p.id === providerFilter);
      if (found) return found;
    }
    return providers.find((p) => p.id === activeProviderId) || providers[0] || null;
  }, [providers, activeProviderId, providerFilter]);

  // Filter services instantly in-memory by chosen Provider ("ALL" or specific Provider ID)
  const currentFilteredServices = useMemo(() => {
    if (providerFilter === "ALL") return allServices;
    const target = providers.find((p) => p.id === providerFilter);
    return allServices.filter((s) => {
      if (s.providerId === providerFilter || s.userProviderId === providerFilter) return true;
      if (target && s.providerName?.toLowerCase() === target.name.toLowerCase()) return true;
      return false;
    });
  }, [allServices, providerFilter, providers]);

  // Fast Instant Search Filter within currently active services
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return currentFilteredServices.filter((s) => {
      const nameMatch = s.name?.toLowerCase().includes(q);
      const catMatch = s.category?.toLowerCase().includes(q);
      const platMatch = s.platform?.toLowerCase().includes(q);
      const idMatch = (s.providerServiceId || s.externalId || s.id)?.toLowerCase().includes(q);
      const provMatch = s.providerName?.toLowerCase().includes(q);
      return nameMatch || catMatch || platMatch || idMatch || provMatch;
    });
  }, [currentFilteredServices, searchQuery]);

  // Favourite services count in currently active services
  const favouritesCount = useMemo(() => {
    return currentFilteredServices.filter((s) => s.isFavourite).length;
  }, [currentFilteredServices]);

  // Unique Categories List for currently active services and platform
  const categories = useMemo(() => {
    const set = new Set<string>();
    const pool = selectedPlatform === "ALL"
      ? currentFilteredServices
      : currentFilteredServices.filter((s) => matchesPlatform(s, selectedPlatform));
    pool.forEach((s) => {
      const cat = s.category?.trim() || s.platform?.trim() || "General";
      if (cat) set.add(cat);
    });
    return Array.from(set).sort();
  }, [currentFilteredServices, selectedPlatform]);

  // Services Filtered by Chosen Category and Platform
  const categoryServices = useMemo(() => {
    const pool = selectedPlatform === "ALL"
      ? currentFilteredServices
      : currentFilteredServices.filter((s) => matchesPlatform(s, selectedPlatform));
    if (!selectedCategory) return pool;
    return pool.filter(
      (s) => (s.category?.trim() || s.platform?.trim() || "General") === selectedCategory
    );
  }, [currentFilteredServices, selectedPlatform, selectedCategory]);

  // Displayed Services in dropdown: search results if search is active, all favourites if Favourites mode, else category services
  const displayedServices = useMemo(() => {
    if (searchQuery.trim()) {
      return searchResults;
    }
    if (selectedPlatform === "FAVOURITES") {
      return currentFilteredServices.filter((s) => s.isFavourite);
    }
    return categoryServices;
  }, [searchQuery, searchResults, selectedPlatform, currentFilteredServices, categoryServices]);

  // Active Service Object
  const activeService = useMemo(() => {
    return (
      displayedServices.find((s) => s.id === selectedServiceId) ||
      displayedServices[0] ||
      currentFilteredServices[0] ||
      null
    );
  }, [displayedServices, selectedServiceId, currentFilteredServices]);

  // Fetch Services Catalog with Instant 0ms SWR Local Cache
  const loadServices = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshingServices(true);
      } else {
        // 0ms Instant Cache Load: populate immediately from local storage if available
        if (typeof window !== "undefined") {
          try {
            const cachedStr = localStorage.getItem("aurasmm_cached_catalog");
            if (cachedStr) {
              const cached = JSON.parse(cachedStr);
              if (cached && Array.isArray(cached.services) && cached.services.length > 0) {
                setAllServices(cached.services);
                if (Array.isArray(cached.providers)) setProviders(cached.providers);
                setLoadingServices(false);
              }
            }
          } catch (e) {}
        }
      }

      const res = await fetch("/api/services");
      const data = await res.json();

      if (data.success && Array.isArray(data.services)) {
        setAllServices(data.services);

        if (Array.isArray(data.providers)) {
          setProviders(data.providers);
          const initialActive =
            data.activeProviderId ||
            data.providers.find((p: any) => p.isActive)?.id ||
            data.providers[0]?.id ||
            "";
          setActiveProviderId((prev) => prev || initialActive);
        }

        // Save to local storage for 0ms next load
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("aurasmm_cached_catalog", JSON.stringify(data));
          } catch (e) {}
        }

        const paramId = searchParams.get("serviceId");
        const target = paramId
          ? data.services.find(
              (s: ServiceItem) =>
                s.id === paramId ||
                s.externalId === paramId ||
                s.providerServiceId === paramId
            )
          : data.services[0];

        if (target) {
          setSelectedCategory(target.category?.trim() || target.platform?.trim() || "General");
          setSelectedServiceId(target.id);
          setQuantity(target.minQuantity || 100);
          setMinQtyRange(target.minQuantity || 10);
          setMaxQtyRange((target.minQuantity || 10) + 4);
        } else if (data.services.length > 0) {
          setSelectedCategory(data.services[0].category?.trim() || data.services[0].platform?.trim() || "General");
          setSelectedServiceId(data.services[0].id);
          setQuantity(data.services[0].minQuantity || 100);
          setMinQtyRange(data.services[0].minQuantity || 10);
          setMaxQtyRange((data.services[0].minQuantity || 10) + 4);
        }
      }
    } catch (err: any) {
      console.warn("Failed to load services catalog:", err);
    } finally {
      setLoadingServices(false);
      setRefreshingServices(false);
    }
  }, [searchParams]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  // Listen to external balance updates (e.g. from header switcher)
  useEffect(() => {
    const handleBalanceUpdate = () => {
      // Re-fetch balance quietly without blowing away service state
      fetch("/api/balance")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.providers)) {
            setProviders(data.providers);
            if (data.activeProviderId) setActiveProviderId(data.activeProviderId);
          }
        })
        .catch((e) => console.warn("Balance poll error:", e));
    };
    const handleFavUpdate = () => {
      loadServices(true);
    };
    window.addEventListener("balance-updated", handleBalanceUpdate);
    window.addEventListener("favourites-updated", handleFavUpdate);
    return () => {
      window.removeEventListener("balance-updated", handleBalanceUpdate);
      window.removeEventListener("favourites-updated", handleFavUpdate);
    };
  }, []);

  // 0ms Instant In-Memory Provider Switcher Handler
  const handleSelectProvider = useCallback(
    (filterId: string) => {
      setProviderFilter(filterId);
      setSearchQuery("");

      const target = providers.find((p) => p.id === filterId);
      const filtered =
        filterId === "ALL"
          ? allServices
          : allServices.filter(
              (s) =>
                s.providerId === filterId ||
                s.userProviderId === filterId ||
                (target && s.providerName?.toLowerCase() === target.name.toLowerCase())
            );

      if (filtered.length > 0) {
        setSelectedCategory(filtered[0].category?.trim() || filtered[0].platform?.trim() || "General");
        setSelectedServiceId(filtered[0].id);
        setQuantity(filtered[0].minQuantity || 100);
        setMinQtyRange(filtered[0].minQuantity || 10);
        setMaxQtyRange((filtered[0].minQuantity || 10) + 4);
      } else {
        setSelectedCategory("");
        setSelectedServiceId("");
      }

      // If a specific provider was selected, save as active preference in background (non-blocking)
      if (filterId !== "ALL") {
        setActiveProviderId(filterId);
        fetch("/api/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerId: filterId }),
        })
          .then(() => {
            window.dispatchEvent(new CustomEvent("balance-updated"));
          })
          .catch((err) => console.warn("Background balance update error:", err));
      }
    },
    [allServices, providers]
  );

  function handleSelectSearchedService(s: ServiceItem) {
    setSelectedCategory(s.category?.trim() || s.platform?.trim() || "General");
    setSelectedServiceId(s.id);
    setQuantity(s.minQuantity || 100);
    setMinQtyRange(s.minQuantity || 10);
    setMaxQtyRange((s.minQuantity || 10) + 4);
    setSearchQuery("");
  }

  // Generate or update Run Items when Drip Feed parameters change
  useEffect(() => {
    if (!isDripFeed) {
      setRunItems([]);
      return;
    }

    const runs = Math.max(2, dripRuns);
    const interval = Math.max(1, dripIntervalMinutes);
    const now = Date.now();

    setRunItems((prev) => {
      const items: RunItem[] = [];
      for (let i = 0; i < runs; i++) {
        const runTime = new Date(now + i * interval * 60 * 1000);
        const timeLabel = i === 0 ? "Now (+0m)" : `+${i * interval}m (${formatBdTime(runTime)} BD)`;

        let qty = typeof quantity === "number" ? quantity : 100;
        if (isRandomRange) {
          const min = Math.min(minQtyRange, maxQtyRange);
          const max = Math.max(minQtyRange, maxQtyRange);
          if (prev[i] && prev[i].quantity >= min && prev[i].quantity <= max) {
            qty = prev[i].quantity;
          } else {
            qty = Math.floor(Math.random() * (max - min + 1)) + min;
          }
        }

        items.push({
          runNumber: i + 1,
          quantity: qty,
          timeLabel,
        });
      }
      return items;
    });
  }, [isDripFeed, dripRuns, dripIntervalMinutes, isRandomRange, minQtyRange, maxQtyRange]);

  // Handler to roll/re-randomize quantities across all runs
  function handleRerollQuantities() {
    const min = Math.min(minQtyRange, maxQtyRange);
    const max = Math.max(minQtyRange, maxQtyRange);
    setRunItems((prev) =>
      prev.map((item) => ({
        ...item,
        quantity: Math.floor(Math.random() * (max - min + 1)) + min,
      }))
    );
  }

  // Handler to edit a single run's quantity
  function handleEditRunQuantity(index: number, val: number) {
    setRunItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], quantity: Math.max(1, val) };
      return next;
    });
  }

  // Handle Platform Select (1-Click Platform Filter Pill)
  const handleSelectPlatform = (platKey: string) => {
    setSelectedPlatform(platKey);
    setSearchQuery("");
    const pool = platKey === "ALL"
      ? currentFilteredServices
      : currentFilteredServices.filter((s) => matchesPlatform(s, platKey));

    if (pool.length > 0) {
      const firstCat = pool[0].category?.trim() || pool[0].platform?.trim() || "General";
      setSelectedCategory(firstCat);
      const catServices = pool.filter(
        (s) => (s.category?.trim() || s.platform?.trim() || "General") === firstCat
      );
      if (catServices.length > 0) {
        setSelectedServiceId(catServices[0].id);
        if (catServices[0].minQuantity) setQuantity(catServices[0].minQuantity);
        setMinQtyRange(catServices[0].minQuantity || 10);
        setMaxQtyRange((catServices[0].minQuantity || 10) + 4);
      }
    } else {
      setSelectedCategory("");
      setSelectedServiceId("");
    }
  };

  // Handle Category Change
  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    const pool = selectedPlatform === "ALL"
      ? currentFilteredServices
      : currentFilteredServices.filter((s) => matchesPlatform(s, selectedPlatform));
    const matched = pool.filter(
      (s) => (s.category?.trim() || s.platform?.trim() || "General") === cat
    );
    if (matched.length > 0) {
      setSelectedServiceId(matched[0].id);
      setQuantity(matched[0].minQuantity || 100);
      setMinQtyRange(matched[0].minQuantity || 10);
      setMaxQtyRange((matched[0].minQuantity || 10) + 4);
    }
  };

  // Handle Service Change
  const handleServiceChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    const srv = currentFilteredServices.find((s) => s.id === serviceId);
    if (srv) {
      setQuantity(srv.minQuantity || 100);
      setMinQtyRange(srv.minQuantity || 10);
      setMaxQtyRange((srv.minQuantity || 10) + 4);
    }
  };

  // Live Calculations
  const numericQty = typeof quantity === "number" ? quantity : 0;
  const totalUnits = useMemo(() => {
    if (isDripFeed && runItems.length > 0) {
      return runItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
    }
    return numericQty;
  }, [isDripFeed, runItems, numericQty]);

  const ratePer1k = activeService ? activeService.ratePer1000 : 0;
  const totalCost = Number(((totalUnits / 1000) * ratePer1k).toFixed(4));

  // Quantity Limits Validation
  const quantityError = useMemo(() => {
    if (!activeService) return null;
    if (isDripFeed && runItems.length > 0) {
      for (const item of runItems) {
        if (item.quantity < activeService.minQuantity) {
          return `Run #${item.runNumber} quantity (${item.quantity}) is below service minimum of ${activeService.minQuantity.toLocaleString()}`;
        }
        if (item.quantity > activeService.maxQuantity) {
          return `Run #${item.runNumber} quantity (${item.quantity}) exceeds service maximum of ${activeService.maxQuantity.toLocaleString()}`;
        }
      }
      return null;
    }

    if (!numericQty) return null;
    if (numericQty < activeService.minQuantity) {
      return `Min quantity: ${activeService.minQuantity.toLocaleString()}`;
    }
    if (numericQty > activeService.maxQuantity) {
      return `Max quantity: ${activeService.maxQuantity.toLocaleString()}`;
    }
    return null;
  }, [activeService, isDripFeed, runItems, numericQty]);

  // Submit Handler
  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!activeService) return;

    if (!targetUrl.trim()) {
      setErrorMessage("Please enter a target link.");
      return;
    }

    if (quantityError) {
      setErrorMessage(quantityError);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setOrderReceipt(null);

    try {
      if (orderMode === "SCHEDULED") {
        if (!scheduledBdDate || !scheduledBdTime) {
          throw new Error("Please select both a date and time in Bangladesh Time.");
        }

        const bdIsoString = `${scheduledBdDate}T${scheduledBdTime}:00+06:00`;
        const scheduledUtcDate = new Date(bdIsoString);

        if (isNaN(scheduledUtcDate.getTime())) {
          throw new Error("Invalid Bangladesh scheduled date or time.");
        }

        if (scheduledUtcDate.getTime() <= Date.now() + 60000) {
          throw new Error("Scheduled BD time must be at least 1 minute in the future.");
        }

        const res = await fetch("/api/scheduled-jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobType: "SINGLE",
            scheduledFor: scheduledUtcDate.toISOString(),
            timezone: "Asia/Dhaka",
            payload: {
              serviceId: activeService.id,
              targetUrl: targetUrl.trim(),
              requestedQuantity: numericQty || activeService.minQuantity,
              providerId: activeService.providerId || activeProviderId || undefined,
            },
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to schedule job.");
        }

        const submittedUrl = targetUrl.trim();
        const provCurrency = activeService.currency || activeProvider?.currency || "USD";
        const newBal = activeProvider?.balance != null ? Math.max(0, activeProvider.balance - totalCost) : null;

        setOrderReceipt({
          id: data.job?.jobRef || "Scheduled",
          serviceName: activeService.name,
          link: submittedUrl,
          quantity: numericQty,
          charge: totalCost,
          currency: provCurrency,
          balance: newBal,
          isDripFeed: false,
        });

        // ONLY remove the video link! Keep all other selections intact!
        setTargetUrl("");

        // Immediately scroll up to the top to show the receipt
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }

        return;
      }

      // PATH B: INSTANT / DRIP-FEED
      const payload: any = {
        serviceId: activeService.id,
        targetUrl: targetUrl.trim(),
        requestedQuantity: isDripFeed && runItems.length > 0 ? runItems[0].quantity : numericQty,
        scheduleMode: isDripFeed ? "DRIP_FEED" : "INSTANT",
        providerId: activeService.providerId || activeProviderId || undefined,
      };

      if (isDripFeed) {
        payload.dripRuns = runItems.length;
        payload.dripIntervalMinutes = Math.max(1, dripIntervalMinutes);
        payload.customRunQuantities = runItems.map((r) => r.quantity);
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit order.");
      }

      const submittedUrl = targetUrl.trim();
      const provCurrency = data.currency || activeService.currency || activeProvider?.currency || "USD";
      const newBal = typeof data.balance === "number"
        ? data.balance
        : activeProvider?.balance != null
          ? Math.max(0, activeProvider.balance - totalCost)
          : null;

      if (activeProvider && newBal !== null) {
        setProviders((prev) =>
          prev.map((p) => (p.id === activeProvider.id ? { ...p, balance: newBal } : p))
        );
      }

      setOrderReceipt({
        id: String(data.providerOrderId || data.order?.providerOrderId || data.order?.orderRef || "Submitted"),
        orderId: data.order?.id,
        serviceName: activeService.name,
        link: submittedUrl,
        quantity: isDripFeed && runItems.length > 0 ? totalUnits : numericQty,
        charge: totalCost,
        currency: provCurrency,
        balance: newBal,
        isDripFeed,
      });

      // ONLY remove the video link! Keep category, service, quantity, drip feed, etc. selected!
      setTargetUrl("");

      // Smooth scroll to top immediately to display receipt
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      window.dispatchEvent(new CustomEvent("balance-updated"));
    } catch (err: any) {
      const provPrefix = activeService?.providerName || activeProvider?.name;
      const rawMsg = err.message || "Failed to place order.";
      const formatted = provPrefix && !rawMsg.includes(provPrefix) ? `[${provPrefix}] ${rawMsg}` : rawMsg;
      setErrorMessage(formatted);
    } finally {
      setSubmitting(false);
    }
  }

  function handleDismissReceipt() {
    setOrderReceipt(null);
  }

  // Find another provider that actually has services for the 1-click fallback button
  const fallbackProvider = useMemo(() => {
    return providers.find((p) => p.id !== activeProvider?.id && (providerCounts[p.id] || 0) > 0) || null;
  }, [providers, activeProvider, providerCounts]);

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fadeIn pb-16">
      {/* 1. Header & Order Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DEE0ED] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#252943]">New Order</h1>
          <p className="text-xs text-[#252943]/60">Instant delivery, Min-Max drip feed, or BD Time scheduler.</p>
        </div>

        {/* Deliver Now vs Schedule in BD Time Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-[#F0F2FA] border border-[#DEE0ED] self-start sm:self-center">
          <button
            type="button"
            onClick={() => setOrderMode("NOW")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              orderMode === "NOW"
                ? "bg-white text-[#3A4EFB] shadow-sm"
                : "text-[#252943]/70 hover:text-[#252943]"
            }`}
          >
            Deliver Now / Drip
          </button>
          <button
            type="button"
            onClick={() => setOrderMode("SCHEDULED")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              orderMode === "SCHEDULED"
                ? "bg-white text-[#3A4EFB] shadow-sm"
                : "text-[#252943]/70 hover:text-[#252943]"
            }`}
          >
            <Clock className="w-3 h-3 text-[#3A4EFB]" />
            <span>BD Time Scheduler</span>
          </button>
        </div>
      </div>

      {/* 2. Exact Green Order Received Receipt (Matching Xmedia) */}
      {orderReceipt && (
        <div className="relative p-4 sm:p-5 rounded-2xl bg-[#D4EDDA] border border-[#C3E6CB] text-[#155724] space-y-1.5 animate-fadeIn shadow-xs">
          <button
            type="button"
            onClick={handleDismissReceipt}
            className="absolute top-3.5 right-3.5 text-[#155724]/70 hover:text-[#155724] transition-colors p-1 cursor-pointer"
            title="Dismiss receipt"
          >
            <X className="w-4 h-4" />
          </button>

          <h3 className="text-base sm:text-lg font-bold text-[#155724] tracking-tight">
            Your order received
          </h3>

          <div className="text-xs sm:text-sm space-y-1 pt-1 font-medium leading-relaxed">
            <div>
              <span className="font-semibold text-[#155724]/80">ID: </span>
              <span className="font-mono font-bold text-[#155724]">{orderReceipt.id}</span>
              {orderReceipt.orderId && (
                <Link
                  href={`/orders/${orderReceipt.orderId}`}
                  className="ml-2 text-xs font-semibold text-[#3A4EFB] hover:underline"
                >
                  View Details →
                </Link>
              )}
            </div>

            <div className="break-words">
              <span className="font-semibold text-[#155724]/80">Service: </span>
              <span className="text-[#155724]">{orderReceipt.serviceName}</span>
            </div>

            <div className="break-all">
              <span className="font-semibold text-[#155724]/80">Link: </span>
              <a
                href={orderReceipt.link}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-[#0b3315]"
              >
                {orderReceipt.link}
              </a>
            </div>

            <div>
              <span className="font-semibold text-[#155724]/80">Quantity: </span>
              <span className="font-bold text-[#155724]">{orderReceipt.quantity.toLocaleString()}</span>
              {orderReceipt.isDripFeed && (
                <span className="ml-1.5 text-xs text-[#155724]/80">(Drip-feed)</span>
              )}
            </div>

            <div>
              <span className="font-semibold text-[#155724]/80">Charge: </span>
              <span className="font-bold text-[#155724]">
                {formatCurrency(orderReceipt.charge, orderReceipt.currency)}
              </span>
            </div>

            {orderReceipt.balance !== null && orderReceipt.balance !== undefined && (
              <div>
                <span className="font-semibold text-[#155724]/80">Balance: </span>
                <span className="font-bold text-[#155724]">
                  {formatCurrency(orderReceipt.balance, orderReceipt.currency)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Error Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-center gap-2 text-xs font-medium animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 4. ALWAYS VISIBLE TOP BAR: Selected API Provider & Double/Multi API Switcher */}
      {providers.length > 0 ? (
        <div className="p-3.5 rounded-2xl bg-white border border-[#DEE0ED] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#3A4EFB]/10 border border-[#3A4EFB]/20 flex items-center justify-center text-[#3A4EFB] shrink-0">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#252943]/50 block">
                Selected API Provider
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-bold text-[#252943]">
                  {providerFilter === "ALL"
                    ? "All Connected APIs"
                    : activeProvider?.name || "Connected API"}
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  <Check className="w-2.5 h-2.5" />
                  Active
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
            {/* Live Upstream Balance of Selected Provider */}
            {activeProvider && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] shadow-subtle">
                <Wallet className="w-3.5 h-3.5 text-[#3A4EFB]" />
                <span className="text-xs font-bold text-[#252943]">
                  {activeProvider.balance !== null && activeProvider.balance !== undefined
                    ? `${activeProvider.currency || "USD"} ${activeProvider.balance.toFixed(2)}`
                    : "Available"}
                </span>
              </div>
            )}

            {/* Double / Multi API switcher buttons (Always clickable, 0ms latency) */}
            {providers.length > 1 && (
              <div className="flex items-center p-0.5 rounded-xl bg-[#EBEFFA] border border-[#DEE0ED] flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => handleSelectProvider("ALL")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    providerFilter === "ALL"
                      ? "bg-[#3A4EFB] text-white shadow-sm"
                      : "text-[#252943]/70 hover:text-[#252943] hover:bg-white/60"
                  }`}
                  title="Show all services across all connected APIs"
                >
                  All APIs ({allServices.length})
                </button>
                {providers.map((p) => {
                  const isSel = providerFilter === p.id;
                  const sCount = providerCounts[p.id] ?? 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectProvider(p.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSel
                          ? "bg-[#3A4EFB] text-white shadow-sm"
                          : "text-[#252943]/70 hover:text-[#252943] hover:bg-white/60"
                      }`}
                      title={`Switch to ${p.name} (${sCount} services)`}
                    >
                      <span>{p.name}</span>
                      <span
                        className={`text-[10px] px-1 py-0.2 rounded ${
                          isSel ? "bg-white/20 text-white" : "bg-[#252943]/10 text-[#252943]/60"
                        }`}
                      >
                        {sCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>No API Provider connected yet.</span>
          </div>
          <Link href="/api-key" className="font-bold underline text-[#3A4EFB] hover:text-[#3243d9]">
            Connect API Key →
          </Link>
        </div>
      )}

      {/* 5. Initial Loading Skeleton */}
      {loadingServices && allServices.length === 0 && (
        <div className="rounded-2xl bg-white border border-[#DEE0ED] p-12 text-center text-xs text-[#252943]/60 flex items-center justify-center gap-2 shadow-sm">
          <Loader2 className="w-4 h-4 animate-spin text-[#3A4EFB]" />
          <span>Loading services catalog...</span>
        </div>
      )}

      {/* 6. EMPTY STATE: When Selected Provider has 0 services synced / not connected */}
      {!loadingServices && currentFilteredServices.length === 0 && (
        <div className="rounded-2xl bg-white border border-[#DEE0ED] p-8 shadow-sm text-center space-y-4 animate-fadeIn">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-subtle">
            <AlertCircle className="w-6 h-6" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-base font-bold text-[#252943]">
              No Services Synced for {activeProvider?.name || "Selected API"}
            </h2>
            <p className="text-xs text-[#252943]/70 leading-relaxed">
              You don&apos;t have any API connected or services synced for{" "}
              <strong className="text-[#252943]">{activeProvider?.name || "this provider"}</strong> yet.
              You can instantly go back to your active services below or sync this provider in API settings.
            </p>
          </div>

          {/* Instant 1-Click Action Buttons: Never stranded! */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2 max-w-md mx-auto">
            {fallbackProvider && (
              <button
                type="button"
                onClick={() => handleSelectProvider(fallbackProvider.id)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#3A4EFB] hover:bg-[#3243d9] active:scale-95 text-white text-xs font-bold transition-all shadow-subtle flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Go Back to {fallbackProvider.name}</span>
                <span className="px-1.5 py-0.2 rounded bg-white/20 text-[10px]">
                  {providerCounts[fallbackProvider.id] || 0}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSelectProvider("ALL")}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#F0F2FA] hover:bg-[#DEE0ED] text-[#252943] text-xs font-bold transition-all border border-[#DEE0ED] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>View All Services ({allServices.length})</span>
            </button>
          </div>

          <div className="pt-2 flex items-center justify-center gap-4 text-xs">
            <Link
              href="/api-key"
              className="text-[#3A4EFB] font-bold hover:underline flex items-center gap-1"
            >
              <span>Open API Settings to Sync</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <span className="text-[#DEE0ED]">•</span>
            <button
              type="button"
              onClick={() => loadServices(true)}
              disabled={refreshingServices}
              className="text-[#252943]/70 hover:text-[#252943] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingServices ? "animate-spin text-[#3A4EFB]" : ""}`} />
              <span>{refreshingServices ? "Checking..." : "Check for Synced Services"}</span>
            </button>
          </div>
        </div>
      )}

      {/* 7. MAIN ORDER FORM: Rendered when services are available */}
      {!loadingServices && currentFilteredServices.length > 0 && (
        <form onSubmit={handleSubmitOrder} className="rounded-2xl bg-white border border-[#DEE0ED] p-6 shadow-sm space-y-4">
          {/* BD Time Scheduler Banner (When in SCHEDULED mode) */}
          {orderMode === "SCHEDULED" && (
            <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                  <Clock className="w-4 h-4 text-[#3A4EFB]" />
                  <span>Bangladesh Standard Time Scheduler (BST / UTC+6)</span>
                </div>
                <span className="text-[10px] font-mono text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                  {bdCurrentTimeDisplay || "Asia/Dhaka"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-indigo-900 mb-1">
                    Date (BD Time)
                  </label>
                  <input
                    type="date"
                    required
                    value={scheduledBdDate}
                    onChange={(e) => setScheduledBdDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-indigo-200 text-xs font-semibold text-[#252943] focus:outline-none focus:border-[#3A4EFB]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-indigo-900 mb-1">
                    Execution Time (BD Time)
                  </label>
                  <input
                    type="time"
                    required
                    value={scheduledBdTime}
                    onChange={(e) => setScheduledBdTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-indigo-200 text-xs font-bold text-[#252943] focus:outline-none focus:border-[#3A4EFB]"
                  />
                </div>
              </div>
              <p className="text-[11px] text-indigo-800 leading-relaxed">
                Your order will be queued and automatically dispatched at the exact BD time specified above.
              </p>
            </div>
          )}

          {/* Platform Category Filter Pills (Matching Xmedia's Simplified UI + Favourites) */}
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {PLATFORMS_LIST.map((plat) => {
                const isSel = selectedPlatform === plat.key;
                const isFav = plat.key === "FAVOURITES";
                const Icon = plat.icon;
                return (
                  <button
                    key={plat.key}
                    type="button"
                    onClick={() => handleSelectPlatform(plat.key)}
                    className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                      isSel
                        ? isFav
                          ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                          : "bg-[#3A4EFB] text-white border-[#3A4EFB] shadow-sm"
                        : isFav
                          ? "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200"
                          : "bg-[#F8F9FD] hover:bg-[#F0F2FA] text-[#252943] border-[#DEE0ED]"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isSel ? (isFav ? "fill-white text-white" : "text-white") : isFav ? "fill-amber-400 text-amber-500" : "text-[#3A4EFB]"}`} />
                    <span className="truncate">{isFav ? `Favourites (${favouritesCount})` : plat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Favourites Only Empty Banner: when Favourites is selected but user has 0 favourites */}
          {selectedPlatform === "FAVOURITES" && favouritesCount === 0 && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2 animate-fadeIn">
              <div className="font-bold flex items-center gap-1.5 text-sm">
                <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                <span>No Favourite Services Added Yet</span>
              </div>
              <p className="text-amber-800 text-xs leading-relaxed">
                You can add any service to your favourites from the <strong>Services</strong> section with 1 click. Once added, only those services will show here for quick ordering without seeing all other categories!
              </p>
              <Link
                href="/services"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs"
              >
                <span>Go to Services to add favourites</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* Fast Instant Search Bar */}
          <div>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search services by ID (#123), name, category, or provider..."
                className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs font-medium text-[#252943] focus:outline-none focus:border-[#3A4EFB] focus:bg-white transition-all shadow-subtle"
              />
              <Search className="w-4 h-4 text-[#252943]/40 absolute left-3 top-1/2 -translate-y-1/2" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#252943]/40 hover:text-[#252943] p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick-Pick Search Matches Dropdown (shows when searching) */}
            {searchQuery.trim() && searchResults.length > 0 && (
              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-[#DEE0ED] bg-white shadow-lg p-1.5 space-y-1 animate-fadeIn">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#252943]/50 px-2.5 py-1">
                  Matching Services ({searchResults.length})
                </div>
                {searchResults.slice(0, 10).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSearchedService(s)}
                    className={`w-full text-left p-2 rounded-lg text-xs transition-all flex items-center justify-between gap-2 cursor-pointer ${
                      s.id === selectedServiceId
                        ? "bg-[#F0F2FA] border border-[#3A4EFB]/40 text-[#252943]"
                        : "hover:bg-[#F8F9FD] text-[#252943]"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#3A4EFB] text-white shadow-xs">
                        {s.providerName || "API"}
                      </span>
                      <span className="font-mono text-[11px] text-[#252943]/60 shrink-0">
                        #{s.providerServiceId || s.externalId}
                      </span>
                      <span className="truncate font-medium">{s.name}</span>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="font-bold text-[#3A4EFB]">{formatCurrency(s.ratePer1000, activeProvider?.currency || "USD")}</span>
                      <span className="text-[10px] text-[#252943]/50">/1K</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Category Dropdown (Hidden in Favourites mode or active search so user selects directly without seeing categories) */}
          {!searchQuery.trim() && selectedPlatform !== "FAVOURITES" && (
            <div>
              <label className="block text-xs font-semibold text-[#252943] mb-1.5">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                disabled={categories.length === 0}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs font-semibold text-[#252943] focus:outline-none focus:border-[#3A4EFB] focus:bg-white transition-all cursor-pointer disabled:opacity-50"
              >
                {categories.length === 0 ? (
                  <option value="">No categories found</option>
                ) : (
                  categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Service Dropdown */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#252943]">
                Service {selectedPlatform === "FAVOURITES" ? <span className="text-amber-600 font-bold">(Your Favourites)</span> : searchQuery.trim() && <span className="text-[#3A4EFB] font-normal">(Filtered by Search)</span>}
              </label>

              {/* Blue Provider Name Button Badge */}
              {activeService && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-[#252943]/40">Provider:</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#3A4EFB] text-white shadow-sm">
                    <Server className="w-3 h-3" />
                    {activeService.providerName || activeProvider?.name || "API"}
                  </span>
                </div>
              )}
            </div>

            <select
              value={selectedServiceId}
              onChange={(e) => handleServiceChange(e.target.value)}
              disabled={displayedServices.length === 0}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs text-[#252943] font-medium focus:outline-none focus:border-[#3A4EFB] focus:bg-white transition-all cursor-pointer disabled:opacity-50"
            >
              {displayedServices.length === 0 ? (
                <option value="">No services available</option>
              ) : (
                displayedServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.providerName || "API"}] #{s.providerServiceId || s.externalId} — {s.name} ({formatCurrency(s.ratePer1000, activeProvider?.currency || "USD")}/1K)
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Description & Estimation Box (Matching Xmedia's Layout) */}
          {activeService && (
            <div className="p-3.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs space-y-2 animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-[#DEE0ED]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#252943]/60">
                  Description
                </span>
                <div className="flex items-center gap-2.5 text-[11px] text-[#252943]/70 font-medium flex-wrap">
                  <span>Min: <strong className="text-[#252943]">{activeService.minQuantity.toLocaleString()}</strong></span>
                  <span>•</span>
                  <span>Max: <strong className="text-[#252943]">{activeService.maxQuantity.toLocaleString()}</strong></span>
                  <span>•</span>
                  <span>Rate: <strong className="text-[#3A4EFB]">{formatCurrency(activeService.ratePer1000, activeProvider?.currency || "USD")}</strong> / 1K</span>
                  {activeService.dripFeedSupported && (
                    <>
                      <span>•</span>
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <Repeat className="w-3 h-3" /> Drip supported
                      </span>
                    </>
                  )}
                </div>
              </div>

              <p className="whitespace-pre-line text-[#252943]/85 leading-relaxed font-normal">
                {activeService.description || "Always working superfast."}
              </p>
            </div>
          )}

          {/* Target Link Input */}
          <div>
            <label className="block text-xs font-semibold text-[#252943] mb-1.5">
              Link
            </label>
            <input
              type="url"
              required
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs font-mono text-[#252943] focus:outline-none focus:border-[#3A4EFB] focus:bg-white transition-all"
            />
          </div>

          {/* Standard Quantity (Shown when Drip Feed is OFF or in Scheduled Mode) */}
          {(!isDripFeed || orderMode === "SCHEDULED") && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#252943]">
                  Quantity
                </label>
                {activeService && (
                  <span className="text-[11px] text-[#252943]/50">
                    {activeService.minQuantity} - {activeService.maxQuantity.toLocaleString()}
                  </span>
                )}
              </div>
              <input
                type="number"
                required
                min={activeService?.minQuantity || 1}
                max={activeService?.maxQuantity || 1000000}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FD] border text-xs font-bold text-[#252943] focus:outline-none focus:bg-white transition-all ${
                  quantityError ? "border-red-300 focus:border-red-500" : "border-[#DEE0ED] focus:border-[#3A4EFB]"
                }`}
              />
              {quantityError && (
                <p className="text-[11px] text-red-600 mt-1 font-medium">{quantityError}</p>
              )}
            </div>
          )}

          {/* Drip-Feed Option (Only in NOW mode) */}
          {orderMode === "NOW" && (
            <div className="pt-2 border-t border-[#DEE0ED]/60 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isDripFeed}
                    onChange={(e) => setIsDripFeed(e.target.checked)}
                    className="w-4 h-4 rounded text-[#3A4EFB] focus:ring-[#3A4EFB]"
                  />
                  <span className="text-xs font-bold text-[#252943] flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5 text-[#3A4EFB]" />
                    Drip-feed
                  </span>
                </label>

                {isDripFeed && (
                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-semibold text-[#3A4EFB] bg-[#3A4EFB]/10 px-2.5 py-1 rounded-lg">
                    <input
                      type="checkbox"
                      checked={isRandomRange}
                      onChange={(e) => setIsRandomRange(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-[#3A4EFB]"
                    />
                    <span>Min-Max Random Range</span>
                  </label>
                )}
              </div>

              {isDripFeed && (
                <div className="p-4 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-3 animate-fadeIn">
                  {/* Runs & Interval Inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#252943]/70 mb-1">
                        Runs (Batches)
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={100}
                        value={dripRuns}
                        onChange={(e) => setDripRuns(Math.max(2, parseInt(e.target.value, 10) || 2))}
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#DEE0ED] text-xs font-bold text-[#252943] focus:outline-none focus:border-[#3A4EFB]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#252943]/70 mb-1">
                        Interval (Minutes)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={1440}
                        value={dripIntervalMinutes}
                        onChange={(e) => setDripIntervalMinutes(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#DEE0ED] text-xs font-bold text-[#252943] focus:outline-none focus:border-[#3A4EFB]"
                      />
                    </div>
                  </div>

                  {/* Min to Max Range Inputs (When Random Range is ON) */}
                  {isRandomRange && (
                    <div className="p-3 rounded-lg bg-white border border-indigo-200 space-y-2 animate-fadeIn">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                          <Shuffle className="w-3.5 h-3.5 text-[#3A4EFB]" />
                          Random Range (Min to Max per run)
                        </span>
                        <button
                          type="button"
                          onClick={handleRerollQuantities}
                          className="text-[11px] font-bold text-[#3A4EFB] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Shuffle className="w-3 h-3" />
                          <span>Re-roll Random Values</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-[#252943]/60 mb-0.5">
                            Min Qty (x)
                          </label>
                          <input
                            type="number"
                            min={activeService?.minQuantity || 1}
                            max={activeService?.maxQuantity || 100000}
                            value={minQtyRange}
                            onChange={(e) => setMinQtyRange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full px-2.5 py-1.5 rounded-md bg-[#F8F9FD] border border-[#DEE0ED] text-xs font-bold text-[#252943] focus:outline-none focus:border-[#3A4EFB]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-[#252943]/60 mb-0.5">
                            Max Qty (y)
                          </label>
                          <input
                            type="number"
                            min={activeService?.minQuantity || 1}
                            max={activeService?.maxQuantity || 100000}
                            value={maxQtyRange}
                            onChange={(e) => setMaxQtyRange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full px-2.5 py-1.5 rounded-md bg-[#F8F9FD] border border-[#DEE0ED] text-xs font-bold text-[#252943] focus:outline-none focus:border-[#3A4EFB]"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-[#252943]/60">
                        Automatically selects random amounts between {minQtyRange} and {maxQtyRange} for each run. You can also edit individual run amounts below.
                      </p>
                    </div>
                  )}

                  {/* Interactive Runs Breakdown (Delivery Times & Editable Quantities) */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-[#252943] block">
                      Delivery Schedule & Quantities (editable):
                    </span>

                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {runItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#DEE0ED] text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#3A4EFB]/10 text-[#3A4EFB] font-bold text-[10px] flex items-center justify-center shrink-0">
                              #{item.runNumber}
                            </span>
                            <span className="text-[11px] text-[#252943]/70 font-mono">
                              {item.timeLabel}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={activeService?.minQuantity || 1}
                              max={activeService?.maxQuantity || 1000000}
                              value={item.quantity}
                              onChange={(e) => handleEditRunQuantity(idx, parseInt(e.target.value, 10) || 0)}
                              className="w-16 px-2 py-1 rounded border border-[#DEE0ED] text-right font-bold text-xs text-[#252943] focus:outline-none focus:border-[#3A4EFB]"
                            />
                            <span className="text-[10px] text-[#252943]/50">units</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 flex items-center justify-between text-xs border-t border-[#DEE0ED]">
                      <span className="font-semibold text-[#252943]">Total Drip Units:</span>
                      <strong className="text-[#3A4EFB] text-sm">{totalUnits.toLocaleString()} units</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Charge & Submit Button */}
          <div className="pt-3 border-t border-[#DEE0ED] flex items-center justify-between gap-4">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#252943]/50 font-bold block">
                Total Charge
              </span>
              <div className="text-xl font-extrabold text-[#252943]">
                {formatCurrency(totalCost, activeProvider?.currency || "USD")}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || loadingServices || !activeService || Boolean(quantityError)}
              className="px-6 py-2.5 rounded-xl bg-[#3A4EFB] hover:bg-[#3243d9] active:scale-95 disabled:opacity-50 text-white font-bold text-xs shadow-subtle transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : orderMode === "SCHEDULED" ? (
                <>
                  <Clock className="w-3.5 h-3.5" />
                  <span>Schedule Order (BD Time)</span>
                </>
              ) : (
                <span>{isDripFeed ? "Submit Drip-feed Order" : "Submit Order"}</span>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-[#252943]/60">
          <Loader2 className="w-5 h-5 animate-spin text-[#3A4EFB]" />
        </div>
      }
    >
      <NewOrderForm />
    </Suspense>
  );
}

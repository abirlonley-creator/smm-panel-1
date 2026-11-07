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

  // Submission State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<{
    type: "INSTANT" | "DRIP_FEED" | "SCHEDULED";
    reference: string;
    providerOrderId?: string;
    providerName?: string;
    details: string;
    totalUnits: number;
    totalCharge: number;
  } | null>(null);

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

  // Unique Categories List for currently active services
  const categories = useMemo(() => {
    const set = new Set<string>();
    currentFilteredServices.forEach((s) => {
      const cat = s.category?.trim() || s.platform?.trim() || "General";
      if (cat) set.add(cat);
    });
    return Array.from(set).sort();
  }, [currentFilteredServices]);

  // Services Filtered by Chosen Category
  const categoryServices = useMemo(() => {
    if (!selectedCategory) return currentFilteredServices;
    return currentFilteredServices.filter(
      (s) => (s.category?.trim() || s.platform?.trim() || "General") === selectedCategory
    );
  }, [currentFilteredServices, selectedCategory]);

  // Displayed Services in dropdown: search results if search is active, else category services
  const displayedServices = useMemo(() => {
    if (searchQuery.trim()) {
      return searchResults;
    }
    return categoryServices;
  }, [searchQuery, searchResults, categoryServices]);

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
    window.addEventListener("balance-updated", handleBalanceUpdate);
    return () => window.removeEventListener("balance-updated", handleBalanceUpdate);
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

  // Handle Category Change
  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    const matched = currentFilteredServices.filter(
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
    setOrderSuccess(null);

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

        setOrderSuccess({
          type: "SCHEDULED",
          reference: data.job.jobRef,
          details: `Scheduled for ${scheduledBdDate} at ${scheduledBdTime} (Bangladesh Time UTC+6)`,
          totalUnits: numericQty,
          totalCharge: totalCost,
        });

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

      const provName = activeService.providerName || activeProvider?.name || "Connected API";
      setOrderSuccess({
        type: isDripFeed ? "DRIP_FEED" : "INSTANT",
        reference: data.order.orderRef,
        providerOrderId: data.order.providerOrderId,
        providerName: provName,
        details: isDripFeed
          ? `${runItems.length} runs every ${dripIntervalMinutes}m (${runItems.map((r) => r.quantity).join(", ")}) — Run 1 sent to ${provName}`
          : `Dispatched directly to ${provName} via API`,
        totalUnits,
        totalCharge: totalCost,
      });

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

  function handleReset() {
    setOrderSuccess(null);
    setTargetUrl("");
    if (activeService) setQuantity(activeService.minQuantity || 100);
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

      {/* 2. Success Banner */}
      {orderSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2.5 animate-fadeIn text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                {orderSuccess.type === "SCHEDULED" ? "Order Scheduled in BD Time!" : "Order Dispatched to API!"}
              </span>
            </div>
            <Link
              href="/orders"
              className="text-xs font-bold text-emerald-800 underline hover:text-emerald-950 inline-flex items-center gap-1"
            >
              Go to Orders Table →
            </Link>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-emerald-800">
              Ref: <span className="font-mono font-bold">{orderSuccess.reference}</span>
            </span>
            {orderSuccess.providerOrderId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                {orderSuccess.providerName || "API"}: #{orderSuccess.providerOrderId}
              </span>
            )}
            <span className="text-xs text-emerald-800">
              • {orderSuccess.totalUnits.toLocaleString()} units (${orderSuccess.totalCharge.toFixed(2)})
            </span>
          </div>

          <p className="text-[11px] text-emerald-700 font-medium">
            {orderSuccess.details}
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-[#3A4EFB] hover:underline font-bold block pt-1 cursor-pointer"
          >
            + Place another order
          </button>
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

          {/* Fast Instant Search Bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#252943] flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-[#3A4EFB]" />
                <span>Quick Service Search</span>
              </label>
              {searchQuery && (
                <span className="text-[11px] font-semibold text-[#3A4EFB]">
                  Found {searchResults.length} {searchResults.length === 1 ? "service" : "services"}
                </span>
              )}
            </div>

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
                      {/* Blue Provider Button in front of the service */}
                      <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#3A4EFB] text-white shadow-xs">
                        {s.providerName || "API"}
                      </span>
                      <span className="font-mono text-[11px] text-[#252943]/60 shrink-0">
                        #{s.providerServiceId || s.externalId}
                      </span>
                      <span className="truncate font-medium">{s.name}</span>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="font-bold text-[#3A4EFB]">${s.ratePer1000.toFixed(2)}</span>
                      <span className="text-[10px] text-[#252943]/50">/1K</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Category Dropdown (Hidden during active search so user sees search results directly) */}
          {!searchQuery.trim() && (
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
                Service {searchQuery.trim() && <span className="text-[#3A4EFB] font-normal">(Filtered by Search)</span>}
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
                    [{s.providerName || "API"}] #{s.providerServiceId || s.externalId} — {s.name} (${s.ratePer1000.toFixed(2)}/1K)
                  </option>
                ))
              )}
            </select>

            {/* Service Details with Blue Button */}
            {activeService && (
              <div className="mt-2 p-2.5 rounded-xl bg-[#F0F2FA] border border-[#DEE0ED] flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#3A4EFB] text-white shadow-xs">
                    <Server className="w-3.5 h-3.5" />
                    {activeService.providerName || activeProvider?.name || "API"}
                  </span>
                  <span className="font-mono text-xs font-bold text-[#252943]">
                    #{activeService.providerServiceId || activeService.externalId}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-[#252943]/70 font-medium">
                  <span>Min: <strong className="text-[#252943]">{activeService.minQuantity.toLocaleString()}</strong></span>
                  <span>•</span>
                  <span>Max: <strong className="text-[#252943]">{activeService.maxQuantity.toLocaleString()}</strong></span>
                  <span>•</span>
                  <span>Rate: <strong className="text-[#3A4EFB]">${activeService.ratePer1000.toFixed(2)}</strong> / 1K</span>
                  {activeService.dripFeedSupported && (
                    <>
                      <span>•</span>
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <Repeat className="w-3 h-3" /> Drip supported
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

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
                ${totalCost.toFixed(2)}
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

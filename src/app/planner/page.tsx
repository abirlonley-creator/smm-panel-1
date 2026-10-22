"use client";

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  TrendingUp, 
  Calendar, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  Search,
  Plus,
  Loader2, 
  Sliders,
  Wallet
} from "lucide-react";
import Link from "next/link";
import { ScheduleMode, ScheduleStepPreview, ScheduleCalculationResult } from "@/lib/types";
import { DeliveryPacingEditor } from "@/components/DeliveryPacingEditor";
import { formatCurrency, formatProviderBalance } from "@/lib/currency";

interface ServiceItem {
  id: string;
  externalId: string;
  name: string;
  platform: string;
  category: string;
  description: string;
  minQuantity: number;
  maxQuantity: number;
  ratePer1000: number;
  dripFeedSupported: boolean;
  dripFeedMinInterval: number;
  restrictions?: string;
  isMock: boolean;
}

export default function GrowthPlannerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh] text-xs text-[#252943]/60 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#3A4EFB]" />
          <span>Loading Growth Planner...</span>
        </div>
      }
    >
      <GrowthPlannerContent />
    </Suspense>
  );
}

function GrowthPlannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [serviceSearchInput, setServiceSearchInput] = useState("");
  const [serviceSearchResults, setServiceSearchResults] = useState<ServiceItem[]>([]);
  const [selectedSearchServiceId, setSelectedSearchServiceId] = useState("");
  const [searchingServices, setSearchingServices] = useState(false);
  const [serviceSearchMessage, setServiceSearchMessage] = useState<string | null>(null);

  // Form Controls
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const selectedServiceIdRef = useRef("");
  const [targetUrl, setTargetUrl] = useState("");
  const [totalQuantity, setTotalQuantity] = useState<number>(2500);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("EVEN_DRIP");
  const [stepsCount, setStepsCount] = useState<number>(5);
  const [intervalMinutes, setIntervalMinutes] = useState<number>(60);
  
  // Calculated Plan State
  const [calculating, setCalculating] = useState(false);
  const [planResult, setPlanResult] = useState<ScheduleCalculationResult | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Live Balance State
  const [providerBalance, setProviderBalance] = useState<number | null>(null);
  const [providerCurrency, setProviderCurrency] = useState<string | null>(null);
  const [providerBalanceStale, setProviderBalanceStale] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(true);

  async function loadBalance(refresh = false) {
    try {
      const res = await fetch(`/api/balance${refresh ? "?refresh=true" : ""}`);
      const data = await res.json();
      if (typeof data.balance === "number" && typeof data.currency === "string") {
        setProviderBalance(data.balance);
        setProviderCurrency(data.currency);
      } else if (data.success !== true && data.balance === null) {
        setProviderBalance(null);
        setProviderCurrency(null);
      }
      setProviderBalanceStale(data.stale === true || data.success !== true);
    } catch (err) {
      console.warn("Failed to load provider balance in planner", err);
      setProviderBalanceStale(true);
    } finally {
      setLoadingBalance(false);
    }
  }

  useEffect(() => {
    loadBalance();
    const handleProviderBalanceRefreshed = (event: Event) => {
      const detail = (event as CustomEvent<{ balance: number | null; currency: string | null; stale: boolean; clearBalance?: boolean }>).detail;
      if (typeof detail?.balance === "number" && typeof detail.currency === "string") {
        setProviderBalance(detail.balance);
        setProviderCurrency(detail.currency);
      } else if (detail?.clearBalance) {
        setProviderBalance(null);
        setProviderCurrency(null);
      }
      if (detail) setProviderBalanceStale(detail.stale);
    };
    window.addEventListener("provider-balance-refreshed", handleProviderBalanceRefreshed);
    return () => {
      window.removeEventListener("provider-balance-refreshed", handleProviderBalanceRefreshed);
    };
  }, []);

  // Load services and handle query parameters
  useEffect(() => {
    async function loadServices() {
      try {
        const params = new URLSearchParams({ page: "1", pageSize: "15" });
        const res = await fetch(`/api/services?${params.toString()}`);
        const data = await res.json();
        if (data.success && data.services.length > 0) {
          const paramServiceId = searchParams.get("serviceId");
          const paramQty = searchParams.get("qty");
          const paramUrl = searchParams.get("url");
          let availableServices: ServiceItem[] = data.services;
          let selectedService = paramServiceId
            ? availableServices.find((s: ServiceItem) =>
                s.id === paramServiceId || s.externalId === paramServiceId
              )
            : undefined;

          // The service linked from the catalog may not be on the first page.
          if (paramServiceId && !selectedService) {
            const lookup = await fetch(
              `/api/services?serviceId=${encodeURIComponent(paramServiceId)}`
            );
            const lookupData = await lookup.json();
            selectedService = lookupData.success ? lookupData.services[0] : undefined;
            if (selectedService) availableServices = [selectedService, ...availableServices];
          }

          setServices(availableServices);
          const nextServiceId = selectedService?.id || availableServices[0].id;
          selectedServiceIdRef.current = nextServiceId;
          setSelectedServiceId(nextServiceId);

          if (paramQty) setTotalQuantity(parseInt(paramQty, 10) || 2500);
          if (paramUrl) setTargetUrl(decodeURIComponent(paramUrl));
        }
      } catch (err) {
        console.error("Failed to load services catalog", err);
      } finally {
        setLoadingServices(false);
      }
    }
    loadServices();
  }, [searchParams]);

  async function handleServiceSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = serviceSearchInput.trim();
    if (!query) {
      setServiceSearchResults([]);
      setServiceSearchMessage("Enter a service ID or name to search.");
      return;
    }

    setSearchingServices(true);
    setServiceSearchMessage(null);
    try {
      let results: ServiceItem[] = [];
      let totalMatches = 0;

      // Prefer an exact provider ID lookup when the query is numeric.
      if (/^\d+$/.test(query)) {
        const exactResponse = await fetch(`/api/services?serviceId=${encodeURIComponent(query)}`);
        const exactData = await exactResponse.json();
        if (exactResponse.ok && exactData.success) {
          results = exactData.services as ServiceItem[];
          totalMatches = exactData.totalServices ?? results.length;
        }
      }

      if (results.length === 0) {
        const params = new URLSearchParams({ search: query, page: "1", pageSize: "15" });
        const response = await fetch(`/api/services?${params.toString()}`);
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Service search failed.");
        }
        results = data.services as ServiceItem[];
        totalMatches = data.totalServices ?? results.length;
      }

      setServiceSearchResults(results);
      setSelectedSearchServiceId(results[0]?.id || "");
      setServiceSearchMessage(
        results.length > 0
          ? `${totalMatches} matching service${totalMatches === 1 ? "" : "s"} found${totalMatches > results.length ? `; showing the first ${results.length}` : ""}. Select one to add to your plan.`
          : "No matching services found. Try another ID or name."
      );
    } catch (error) {
      setServiceSearchResults([]);
      setSelectedSearchServiceId("");
      setServiceSearchMessage(
        error instanceof Error ? error.message : "Service search failed. Please try again."
      );
    } finally {
      setSearchingServices(false);
    }
  }

  function addSearchedService() {
    const selected = serviceSearchResults.find((service) => service.id === selectedSearchServiceId);
    if (!selected) return;

    setServices((current) =>
      current.some((service) => service.id === selected.id)
        ? current
        : [selected, ...current]
    );
    selectService(selected.id);
    setServiceSearchMessage(`Service #${selected.externalId} added to the plan.`);
  }

  const activeService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) || services[0],
    [services, selectedServiceId]
  );

  function selectService(serviceId: string) {
    if (serviceId === selectedServiceId) return;

    // Clear the old service's plan immediately so it cannot look like the
    // newly selected category failed to switch while the next plan recalculates.
    selectedServiceIdRef.current = serviceId;
    setSelectedServiceId(serviceId);
    setPlanResult(null);
    setPlanError(null);
    setShowConfirmModal(false);
    setSubmitError(null);
  }

  const handlePlanChange = useCallback((newPlan: any) => {
    if (selectedServiceIdRef.current !== activeService?.id) return;
    setPlanResult((prev) => {
      if (prev && JSON.stringify(prev) === JSON.stringify(newPlan)) return prev;
      return newPlan;
    });
    if (newPlan.valid) {
      setPlanError(null);
    } else {
      setPlanError(newPlan.errorMessage || "Invalid schedule configuration");
    }
  }, [activeService?.id]);

  const handleTotalQuantityChange = useCallback((qty: number) => {
    setTotalQuantity((prev) => (prev === qty ? prev : qty));
  }, []);

  // Re-calculate plan whenever relevant inputs change
  useEffect(() => {
    if (!activeService || !totalQuantity || totalQuantity <= 0) return;

    let isCancelled = false;
    async function fetchPlan() {
      setCalculating(true);
      setPlanError(null);
      try {
        const res = await fetch("/api/planner/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId: activeService.id,
            targetUrl: targetUrl.trim(),
            totalQuantity,
            scheduleMode,
            stepsCount,
            intervalMinutes,
          }),
        });
        const data = await res.json();

        if (!isCancelled && selectedServiceIdRef.current === activeService.id) {
          if (data.success) {
            setPlanResult((currentPlan) =>
              currentPlan?.serviceId === activeService.id && currentPlan.scheduleMode === "CUSTOM"
                ? currentPlan
                : data.plan
            );
            setPlanError(null);
          } else {
            setPlanResult(null);
            setPlanError(data.error || "Unable to calculate schedule");
          }
        }
      } catch (err: any) {
        if (!isCancelled && selectedServiceIdRef.current === activeService.id) {
          setPlanError(err.message || "Failed to calculate plan");
        }
      } finally {
        if (!isCancelled && selectedServiceIdRef.current === activeService.id) {
          setCalculating(false);
        }
      }
    }

    const timer = setTimeout(fetchPlan, 150);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [activeService, totalQuantity, scheduleMode, stepsCount, intervalMinutes, targetUrl]);

  async function handleConfirmSchedule() {
    if (!planResult || !planResult.valid || !activeService) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: activeService.id,
          targetUrl: targetUrl.trim(),
          requestedQuantity: planResult.totalQuantity,
          scheduleMode: planResult.scheduleMode,
          timingMode: planResult.timingMode,
          stepsCount: planResult.stepCount,
          intervalMinutes: planResult.defaultIntervalMinutes,
          totalDurationMinutes: planResult.totalDurationMinutes,
          customStepQuantities: planResult.steps.map((s: ScheduleStepPreview) => s.quantity),
          customIntervals: planResult.steps.map((s: ScheduleStepPreview) => s.intervalMinutesFromPrev),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to schedule growth plan");
      }

      // Notify balance widgets and state
      window.dispatchEvent(new Event("balance-updated"));

      setShowConfirmModal(false);
      router.push(`/orders/${data.order.id}`);
    } catch (err: any) {
      setSubmitError(err.message || "An error occurred while creating scheduled plan");
    } finally {
      setSubmitting(false);
    }
  }

  const planTotalCost = planResult?.totalCost ?? 0;
  const projectedBalance = providerBalance === null ? null : Number((providerBalance - planTotalCost).toFixed(2));
  const hasInsufficientBalance = providerBalance !== null && planTotalCost > 0 && providerBalance < planTotalCost;

  if (loadingServices) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-2 text-sm text-[#252943]/60">
          <Loader2 className="w-5 h-5 animate-spin text-[#3A4EFB]" />
          <span>Loading Growth Planner...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 text-xs text-[#252943]/60 mb-1">
          <Link href="/" className="hover:text-[#3A4EFB]">Dashboard</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span>Growth Planner</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#252943] flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-[#3A4EFB]" />
              Deterministic Growth Planner
            </h1>
            <p className="text-xs sm:text-sm text-[#252943]/60 mt-0.5">
              Paces volume delivery safely across time intervals according to verified provider constraints.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E3FF3B]/30 border border-[#E3FF3B] text-xs font-semibold text-[#252943]">
            <span className="w-2 h-2 rounded-full bg-[#3A4EFB]"></span>
            <span>Mathematical Precision (Exact Sum Guarantee)</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Controls vs Preview Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-[#DEE0ED] p-6 shadow-subtle space-y-5">
            <h2 className="text-sm font-semibold text-[#252943] pb-3 border-b border-[#DEE0ED] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#3A4EFB]" />
              Schedule Parameters
            </h2>

            {/* Service Selection */}
            <div className="space-y-1.5">
              <form onSubmit={handleServiceSearch} className="space-y-2">
                <label htmlFor="planner-service-search" className="text-xs font-medium text-[#252943]">
                  Find a service by ID or name
                </label>
                <div className="flex gap-2">
                  <input
                    id="planner-service-search"
                    type="search"
                    value={serviceSearchInput}
                    onChange={(event) => {
                      setServiceSearchInput(event.target.value);
                      setServiceSearchResults([]);
                      setSelectedSearchServiceId("");
                      setServiceSearchMessage(null);
                    }}
                    placeholder="Search service ID or name"
                    className="min-w-0 flex-1 bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2.5 text-xs text-[#252943] focus:border-[#3A4EFB] focus:bg-white transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={searchingServices}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#252943] hover:bg-[#1A1D31] text-white text-xs font-semibold disabled:opacity-60"
                  >
                    {searchingServices ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    Search
                  </button>
                </div>
              </form>

              {serviceSearchResults.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <select
                    aria-label="Search results"
                    value={selectedSearchServiceId}
                    onChange={(event) => setSelectedSearchServiceId(event.target.value)}
                    className="min-w-0 flex-1 bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2.5 text-xs text-[#252943] focus:border-[#3A4EFB] focus:bg-white transition-colors"
                  >
                    {serviceSearchResults.map((service) => (
                      <option key={service.id} value={service.id}>
                        #{service.externalId} — [{service.platform}] {service.name} (₹{service.ratePer1000.toFixed(2)}/1k)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addSearchedService}
                    disabled={!selectedSearchServiceId}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-xs font-semibold disabled:opacity-60"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add to Plan
                  </button>
                </div>
              )}

              {serviceSearchMessage && (
                <p role="status" className="text-[11px] text-[#252943]/65 pt-0.5">
                  {serviceSearchMessage}
                </p>
              )}

              <label htmlFor="planner-service" className="text-xs font-medium text-[#252943]">
                Selected Service
              </label>
              <select
                id="planner-service"
                value={selectedServiceId}
                onChange={(e) => selectService(e.target.value)}
                className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2.5 text-xs text-[#252943] focus:border-[#3A4EFB] focus:bg-white transition-colors"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.platform} · {s.category}] {s.name} (₹{s.ratePer1000.toFixed(2)}/1k)
                  </option>
                ))}
              </select>

              {activeService && (
                <div className="flex items-center justify-between text-[11px] text-[#252943]/60 px-1 pt-1">
                  <span>Min per order: <strong>{activeService.minQuantity.toLocaleString()}</strong></span>
                  <span>Rate: <strong>₹{activeService.ratePer1000.toFixed(2)}/1k</strong></span>
                </div>
              )}
            </div>

            {/* Target URL */}
            <div className="space-y-1.5">
              <label htmlFor="planner-url" className="text-xs font-medium text-[#252943]">
                Target Destination URL
              </label>
              <input
                id="planner-url"
                type="url"
                placeholder="https://..."
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2 text-xs text-[#252943] focus:border-[#3A4EFB] focus:bg-white transition-colors"
              />
            </div>

            {/* Total Target Quantity */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="planner-qty" className="text-xs font-medium text-[#252943]">
                  Total Target Quantity
                </label>
                <span className="text-xs text-[#3A4EFB] font-bold">
                  {totalQuantity.toLocaleString()} units
                </span>
              </div>
              <input
                id="planner-qty"
                type="number"
                min={activeService?.minQuantity || 100}
                max={activeService?.maxQuantity || 500000}
                step={50}
                value={totalQuantity}
                onChange={(e) => setTotalQuantity(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2 text-xs text-[#252943] tabular-nums focus:border-[#3A4EFB] focus:bg-white transition-colors"
              />
            </div>

          </div>
        </div>

        {/* Right Column: Live Deterministic Preview Table & Summary (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl border border-[#DEE0ED] p-6 shadow-subtle space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#3A4EFB]" />
                <h2 className="text-sm font-semibold text-[#252943]">
                  Delivery Schedule Preview
                </h2>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#DEE0ED]/60 text-[#252943]">
                {scheduleMode.replace("_", " ")}
              </span>
            </div>

            {/* Plan Metrics Bar */}
            {planResult && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-[#F8F9FD] p-3.5 rounded-xl border border-[#DEE0ED]/60 text-xs">
                  <div>
                    <span className="text-[#252943]/50 text-[10px] block">Target Quantity</span>
                    <span className="font-bold text-[#252943] text-sm tracking-tight">
                      {planResult.totalQuantity.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#252943]/50 text-[10px] block">Estimated Cost</span>
                    <span className="font-bold text-[#3A4EFB] text-sm tracking-tight">
                      ₹{planResult.totalCost.toFixed(4)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#252943]/50 text-[10px] block">Provider Balance</span>
                    <span className="font-bold text-[#252943] text-sm tracking-tight flex items-center gap-1">
                      <Wallet className="w-3 h-3 text-[#3A4EFB]" />
                      {loadingBalance ? "..." : formatProviderBalance(providerBalance, providerCurrency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#252943]/50 text-[10px] block">Balance After Plan</span>
                    <span className={`font-bold text-sm tracking-tight ${
                      projectedBalance === null ? "text-[#252943]/50" : projectedBalance >= 0 ? "text-emerald-700" : "text-red-600"
                    }`}>
                      {loadingBalance ? "..." : projectedBalance === null ? "Unavailable" : (
                        projectedBalance >= 0
                          ? formatCurrency(projectedBalance, 2, providerCurrency || "INR")
                          : `-${formatCurrency(Math.abs(projectedBalance), 2, providerCurrency || "INR")}`
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#252943]/50 text-[10px] block">Est. Completion</span>
                    <span className="font-medium text-[#252943] text-[11px]">
                      {new Date(planResult.estimatedCompletionTime).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {hasInsufficientBalance && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2 font-medium">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Insufficient Provider Balance:</span> Current balance is {formatProviderBalance(providerBalance, providerCurrency)}, but this schedule requires {formatCurrency(planTotalCost, 2, providerCurrency || "INR")} (short by {formatCurrency(Math.abs(projectedBalance ?? 0), 2, providerCurrency || "INR")} ).
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step Table */}
            {calculating ? (
              <div className="py-12 flex items-center justify-center text-xs text-[#252943]/60 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#3A4EFB]" />
                <span>Recalculating plan...</span>
              </div>
            ) : planResult && planResult.steps && planResult.steps.length > 0 ? (
              <div className="overflow-x-auto border border-[#DEE0ED]/60 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8F9FD] border-b border-[#DEE0ED] text-[#252943]/60 font-medium">
                    <tr>
                      <th className="py-2.5 px-3 w-12">Step</th>
                      <th className="py-2.5 px-3">Scheduled Time</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3 text-right">Cost</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DEE0ED]/40">
                    {planResult.steps.map((step: ScheduleStepPreview) => (
                      <tr key={step.stepNumber} className="hover:bg-[#F8F9FD]/60 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-[#252943]">
                          #{step.stepNumber}
                        </td>
                        <td className="py-2.5 px-3 text-[#252943] font-medium">
                          {step.scheduledTimeFormatted}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#252943]">
                          {step.quantity.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-[#252943]/80">
                          ₹{step.stepCost.toFixed(4)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#DEE0ED]/60 text-[#252943]/70">
                            Preview
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[#F8F9FD] border-t border-[#DEE0ED] font-semibold text-[#252943]">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-3 text-[11px] uppercase tracking-wider">
                        Total Sum
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-[#3A4EFB]">
                        {planResult.totalQuantity.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-[#3A4EFB]">
                        ₹{planResult.totalCost.toFixed(4)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-[#252943]/50">
                Adjust parameters on the left to calculate schedule.
              </div>
            )}

            {/* Assumptions & Disclaimer */}
            <div className="text-[11px] text-[#252943]/60 bg-[#F8F9FD] p-3 rounded-xl border border-[#DEE0ED]/60 space-y-1">
              <span className="font-semibold text-[#252943] block">Transparent Estimates:</span>
              <p>
                Delivery schedules operate via our persistent background worker. Timestamps indicate scheduled provider submission.
                Estimates are calculated conservatively and do not constitute platform-level delivery guarantees.
              </p>
            </div>

          </div>
        </div>
      </div>
      {activeService && (
        <div className="mt-6 min-w-0">
          <DeliveryPacingEditor
            key={activeService.id}
            service={activeService}
            totalQuantity={totalQuantity}
            onTotalQuantityChange={handleTotalQuantityChange}
            targetUrl={targetUrl}
            onPlanChange={handlePlanChange}
          />
        </div>
      )}
      <div className="mt-6">
        <button
          type="button"
          disabled={!planResult?.valid || targetUrl.trim().length < 5}
          onClick={() => setShowConfirmModal(true)}
          className={`w-full py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all press-scale flex items-center justify-center gap-2 shadow-subtle ${
            planResult?.valid && targetUrl.trim().length >= 5
              ? "bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white cursor-pointer"
              : "bg-[#DEE0ED] text-[#252943]/40 cursor-not-allowed"
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-[#E3FF3B]" />
          Review and schedule growth plan
        </button>
        {targetUrl.trim().length < 5 && (
          <p className="text-[11px] text-center text-[#252943]/50 mt-1.5">
            Add a valid target link to schedule this plan.
          </p>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && planResult && (
        <div className="fixed inset-0 z-50 bg-[#252943]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#DEE0ED] p-6 shadow-dropdown space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
              <h3 className="text-base font-semibold text-[#252943] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#3A4EFB]" />
                Launch Growth Schedule
              </h3>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-[#252943]/40 hover:text-[#252943] text-sm"
              >
                ✕
              </button>
            </div>

            {submitError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="space-y-2.5 text-xs bg-[#F8F9FD] p-4 rounded-xl border border-[#DEE0ED]/70">
              <div className="flex justify-between">
                <span className="text-[#252943]/60">Service</span>
                <span className="font-semibold text-[#252943] truncate max-w-[220px]">
                  {activeService?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#252943]/60">Target Link</span>
                <span className="font-medium text-[#252943] truncate max-w-[220px]">
                  {targetUrl}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#252943]/60">Total Quantity</span>
                <span className="font-bold text-[#252943]">
                  {planResult.totalQuantity.toLocaleString()} units
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#252943]/60">Pacing Plan</span>
                <span className="font-medium text-[#252943]">
                  {planResult.stepCount} steps ({intervalMinutes}m interval)
                </span>
              </div>
              <div className="flex justify-between border-t border-[#DEE0ED]/60 pt-2 items-baseline">
                <span className="font-semibold text-[#252943]">Estimated Plan Cost</span>
                <span className="font-bold text-[#3A4EFB] text-base">
                  ₹{planResult.totalCost.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-[#252943]/60 text-[11px]">Provider Balance</span>
                <span className="font-medium text-[#252943] text-xs">
                  {formatProviderBalance(providerBalance, providerCurrency)}
                </span>
              </div>
              {providerBalanceStale && <div className="text-[10px] text-amber-700">{providerBalance === null ? "Provider balance unavailable — no verified value is stored." : "Stale — showing the last verified provider balance."}</div>}
              <div className="flex justify-between items-baseline pt-1 border-t border-[#DEE0ED]/40">
                <span className="font-semibold text-[#252943] text-xs">Balance After Plan</span>
                <span className={`font-bold text-xs ${projectedBalance === null ? "text-[#252943]/50" : projectedBalance >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {projectedBalance === null ? "Unavailable" : projectedBalance >= 0 ? formatCurrency(projectedBalance, 2, providerCurrency || "INR") : `-${formatCurrency(Math.abs(projectedBalance), 2, providerCurrency || "INR")}`}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#252943]/60 leading-relaxed">
              This will create <strong>{planResult.stepCount} persistent jobs</strong> in the database.
              The jobs are managed by the background scheduler with duplicate prevention and safe retries.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl border border-[#DEE0ED] text-xs font-semibold text-[#252943] hover:bg-[#F8F9FD] transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmSchedule}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-xs font-semibold transition-all press-scale flex items-center justify-center gap-1.5 shadow-subtle"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Scheduling Plan...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#E3FF3B]" />
                    Confirm & Start Plan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

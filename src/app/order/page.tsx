"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  Repeat,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

interface ServiceItem {
  id: string;
  externalId: string;
  providerServiceId?: string;
  name: string;
  platform: string;
  category: string;
  description: string;
  minQuantity: number;
  maxQuantity: number;
  ratePer1000: number;
  dripFeedSupported?: boolean;
}

function NewOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Catalog State
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");

  // Order Inputs
  const [targetUrl, setTargetUrl] = useState<string>("");
  const [quantity, setQuantity] = useState<number | "">("");

  // Drip Feed State
  const [isDripFeed, setIsDripFeed] = useState<boolean>(false);
  const [dripRuns, setDripRuns] = useState<number>(5);
  const [dripIntervalMinutes, setDripIntervalMinutes] = useState<number>(60);

  // Submission State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<{
    orderRef: string;
    providerOrderId?: string;
    runs?: number;
    interval?: number;
    totalUnits: number;
    totalCharge: number;
  } | null>(null);

  // Fetch Services
  useEffect(() => {
    async function loadServices() {
      try {
        setLoadingServices(true);
        const res = await fetch("/api/services");
        const data = await res.json();
        if (data.success && Array.isArray(data.services)) {
          setServices(data.services);

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
          } else if (data.services.length > 0) {
            setSelectedCategory(data.services[0].category?.trim() || data.services[0].platform?.trim() || "General");
            setSelectedServiceId(data.services[0].id);
            setQuantity(data.services[0].minQuantity || 100);
          }
        }
      } catch (err: any) {
        console.warn("Failed to load services:", err);
      } finally {
        setLoadingServices(false);
      }
    }

    loadServices();
  }, [searchParams]);

  // Unique Categories List
  const categories = useMemo(() => {
    const set = new Set<string>();
    services.forEach((s) => {
      const cat = s.category?.trim() || s.platform?.trim() || "General";
      if (cat) set.add(cat);
    });
    return Array.from(set).sort();
  }, [services]);

  // Services Filtered by Chosen Category
  const categoryServices = useMemo(() => {
    if (!selectedCategory) return services;
    return services.filter(
      (s) => (s.category?.trim() || s.platform?.trim() || "General") === selectedCategory
    );
  }, [services, selectedCategory]);

  // Active Service Object
  const activeService = useMemo(() => {
    return (
      categoryServices.find((s) => s.id === selectedServiceId) ||
      categoryServices[0] ||
      services[0] ||
      null
    );
  }, [categoryServices, selectedServiceId, services]);

  // Handle Category Change
  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    const matched = services.filter(
      (s) => (s.category?.trim() || s.platform?.trim() || "General") === cat
    );
    if (matched.length > 0) {
      setSelectedServiceId(matched[0].id);
      setQuantity(matched[0].minQuantity || 100);
    }
  };

  // Handle Service Change
  const handleServiceChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    const srv = services.find((s) => s.id === serviceId);
    if (srv) {
      setQuantity(srv.minQuantity || 100);
    }
  };

  // Live Calculations
  const numericQty = typeof quantity === "number" ? quantity : 0;
  const effectiveRuns = isDripFeed ? Math.max(2, dripRuns) : 1;
  const totalUnits = numericQty * effectiveRuns;
  const ratePer1k = activeService ? activeService.ratePer1000 : 0;
  const totalCost = Number(((totalUnits / 1000) * ratePer1k).toFixed(4));

  // Quantity Limits Validation
  const quantityError = useMemo(() => {
    if (!activeService || !numericQty) return null;
    if (numericQty < activeService.minQuantity) {
      return `Min quantity: ${activeService.minQuantity.toLocaleString()}`;
    }
    if (numericQty > activeService.maxQuantity) {
      return `Max quantity: ${activeService.maxQuantity.toLocaleString()}`;
    }
    return null;
  }, [activeService, numericQty]);

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
      const payload: any = {
        serviceId: activeService.id,
        targetUrl: targetUrl.trim(),
        requestedQuantity: numericQty,
        scheduleMode: isDripFeed ? "DRIP_FEED" : "INSTANT",
      };

      if (isDripFeed) {
        payload.dripRuns = effectiveRuns;
        payload.dripIntervalMinutes = Math.max(1, dripIntervalMinutes);
        payload.dripMinQuantity = numericQty;
        payload.dripMaxQuantity = numericQty;
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

      setOrderSuccess({
        orderRef: data.order.orderRef,
        providerOrderId: data.order.providerOrderId,
        runs: isDripFeed ? effectiveRuns : undefined,
        interval: isDripFeed ? dripIntervalMinutes : undefined,
        totalUnits,
        totalCharge: totalCost,
      });

      window.dispatchEvent(new CustomEvent("balance-updated"));
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to place order.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setOrderSuccess(null);
    setTargetUrl("");
    if (activeService) setQuantity(activeService.minQuantity || 100);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn pb-16">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-[#DEE0ED] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#252943]">New Order</h1>
          <p className="text-xs text-[#252943]/60">Choose a service and place your order.</p>
        </div>
        <Link
          href="/orders"
          className="text-xs text-[#3A4EFB] hover:underline font-semibold flex items-center gap-1"
        >
          <span>View Orders</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Success Banner */}
      {orderSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2 animate-fadeIn text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Order Placed Successfully!</span>
            </div>
            <Link
              href="/orders"
              className="text-xs font-bold text-emerald-800 underline hover:text-emerald-950"
            >
              Go to Orders →
            </Link>
          </div>
          <p className="text-xs text-emerald-800">
            Order Ref: <span className="font-mono font-bold">{orderSuccess.orderRef}</span>
            {orderSuccess.providerOrderId && (
              <span> • Provider Order ID: <span className="font-mono font-bold">#{orderSuccess.providerOrderId}</span></span>
            )}
            {" • "}{orderSuccess.totalUnits.toLocaleString()} units (${orderSuccess.totalCharge.toFixed(2)})
            {orderSuccess.runs ? ` [Drip-feed: ${orderSuccess.runs} runs every ${orderSuccess.interval}m]` : ""}
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

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-center gap-2 text-xs font-medium animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loadingServices && services.length === 0 && (
        <div className="p-12 text-center text-xs text-[#252943]/60 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#3A4EFB]" />
          <span>Loading services catalog...</span>
        </div>
      )}

      {/* Order Form Card */}
      {!loadingServices && (
        <form onSubmit={handleSubmitOrder} className="rounded-2xl bg-white border border-[#DEE0ED] p-6 shadow-sm space-y-4">
          {/* Category Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-[#252943] mb-1.5">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs font-semibold text-[#252943] focus:outline-none focus:border-[#3A4EFB] focus:bg-white transition-all cursor-pointer"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Service Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-[#252943] mb-1.5">
              Service
            </label>
            <select
              value={selectedServiceId}
              onChange={(e) => handleServiceChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs text-[#252943] font-medium focus:outline-none focus:border-[#3A4EFB] focus:bg-white transition-all cursor-pointer"
            >
              {categoryServices.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.providerServiceId || s.externalId}] {s.name} — ${s.ratePer1000.toFixed(2)}/1K
                </option>
              ))}
            </select>

            {/* Compact Service Details Line */}
            {activeService && (
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-[#252943]/60">
                <span>Min: <strong className="text-[#252943]">{activeService.minQuantity.toLocaleString()}</strong></span>
                <span>•</span>
                <span>Max: <strong className="text-[#252943]">{activeService.maxQuantity.toLocaleString()}</strong></span>
                <span>•</span>
                <span>Rate: <strong className="text-[#3A4EFB]">${activeService.ratePer1000.toFixed(2)}</strong> / 1,000</span>
                {activeService.dripFeedSupported && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <Repeat className="w-3 h-3" /> Drip-feed supported
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Link Input */}
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

          {/* Quantity Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#252943]">
                {isDripFeed ? "Quantity per Run" : "Quantity"}
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

          {/* Drip-Feed Option */}
          <div className="pt-2 border-t border-[#DEE0ED]/60 space-y-3">
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
              <div className="p-3.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-2.5 animate-fadeIn">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#252943]/70 mb-1">
                      Runs
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

                <p className="text-[11px] text-[#252943]/70">
                  Total Quantity: <strong className="text-[#3A4EFB]">{totalUnits.toLocaleString()} units</strong> ({effectiveRuns} runs of {numericQty} every {dripIntervalMinutes}m)
                </p>
              </div>
            )}
          </div>

          {/* Price & Submit Action */}
          <div className="pt-3 border-t border-[#DEE0ED] flex items-center justify-between gap-4">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#252943]/50 font-bold block">
                Charge
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
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Order</span>
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

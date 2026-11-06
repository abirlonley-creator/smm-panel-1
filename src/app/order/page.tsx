"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Layers,
  KeyRound,
  ExternalLink,
  Search,
  Sparkles,
  ArrowRight,
  Info,
  Zap,
  Repeat,
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
  restrictions?: string;
}

function NewOrderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Catalog State
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState<string>("");

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
    serviceName: string;
  } | null>(null);

  // Load Services Catalog
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
                (s: ServiceItem) => s.id === paramId || s.externalId === paramId || s.providerServiceId === paramId
              )
            : data.services[0];

          if (target) {
            setSelectedCategory(target.category || target.platform);
            setSelectedServiceId(target.id);
            setQuantity(target.minQuantity || 100);
          } else if (data.services.length > 0) {
            setSelectedCategory(data.services[0].category || data.services[0].platform);
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

  // Unique Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    services.forEach((s) => {
      const cat = s.category?.trim() || s.platform?.trim() || "General";
      set.add(cat);
    });
    return Array.from(set).sort();
  }, [services]);

  // Filtered Services by Category and Search Filter
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const cat = s.category?.trim() || s.platform?.trim() || "General";
      const matchesCategory = !selectedCategory || cat === selectedCategory;

      if (!matchesCategory) return false;
      if (!searchFilter.trim()) return true;

      const q = searchFilter.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.externalId.toLowerCase().includes(q) ||
        (s.providerServiceId && s.providerServiceId.toLowerCase().includes(q))
      );
    });
  }, [services, selectedCategory, searchFilter]);

  // Currently Selected Service
  const activeService = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId) || filteredServices[0] || null;
  }, [services, selectedServiceId, filteredServices]);

  // Adjust quantity default on service change
  const handleSelectService = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    const srv = services.find((s) => s.id === serviceId);
    if (srv) {
      if (typeof quantity === "number") {
        if (quantity < srv.minQuantity) setQuantity(srv.minQuantity);
        if (quantity > srv.maxQuantity) setQuantity(srv.maxQuantity);
      } else {
        setQuantity(srv.minQuantity);
      }
    }
  };

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    const firstInCat = services.find(
      (s) => (s.category?.trim() || s.platform?.trim() || "General") === cat
    );
    if (firstInCat) {
      setSelectedServiceId(firstInCat.id);
      setQuantity(firstInCat.minQuantity);
    }
  };

  // Calculations
  const numericQty = typeof quantity === "number" ? quantity : 0;
  const effectiveRuns = isDripFeed ? Math.max(2, dripRuns) : 1;
  const totalUnits = numericQty * effectiveRuns;
  const ratePer1k = activeService ? activeService.ratePer1000 : 0;
  const totalCost = Number(((totalUnits / 1000) * ratePer1k).toFixed(4));

  // Quantity Validation
  const quantityError = useMemo(() => {
    if (!activeService || !numericQty) return null;
    if (numericQty < activeService.minQuantity) {
      return `Quantity must be at least ${activeService.minQuantity.toLocaleString()} for this service.`;
    }
    if (numericQty > activeService.maxQuantity) {
      return `Quantity cannot exceed ${activeService.maxQuantity.toLocaleString()} for this service.`;
    }
    return null;
  }, [activeService, numericQty]);

  // Submit Handler
  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!activeService) return;

    if (!targetUrl.trim()) {
      setErrorMessage("Please enter a valid target link / URL.");
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
        serviceName: activeService.name,
      });

      // Trigger global balance refresh
      window.dispatchEvent(new CustomEvent("balance-updated"));
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to place order.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleResetForm() {
    setOrderSuccess(null);
    setTargetUrl("");
    if (activeService) setQuantity(activeService.minQuantity);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn pb-16">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DEE0ED] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#3A4EFB]">
              Place Order
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#252943] tracking-tight">
            New Order
          </h1>
          <p className="text-sm text-[#252943]/60 mt-1">
            Submit instant delivery orders or create an automated drip feed to grow gradually.
          </p>
        </div>

        <Link
          href="/api-key"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F8F9FD] hover:bg-white border border-[#DEE0ED] hover:border-[#3A4EFB] text-xs font-semibold text-[#252943] shadow-subtle transition-all self-start sm:self-center"
        >
          <KeyRound className="w-3.5 h-3.5 text-[#3A4EFB]" />
          <span>Configure API Key</span>
        </Link>
      </div>

      {/* No Services Warning */}
      {!loadingServices && services.length === 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-6 text-amber-900 space-y-3">
          <div className="flex items-center gap-2 font-bold text-base">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            No services found
          </div>
          <p className="text-sm">
            You don't have any services synced yet. Add your SMM Provider API Key to automatically import your provider's catalog and start placing orders.
          </p>
          <Link
            href="/api-key"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3A4EFB] text-white text-xs font-bold shadow-subtle hover:bg-[#3243d9] transition-all"
          >
            <KeyRound className="w-4 h-4" />
            <span>Add API Key & Sync Services</span>
          </Link>
        </div>
      )}

      {/* Success Notification Box */}
      {orderSuccess && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-emerald-900 shadow-sm space-y-4 animate-fadeIn">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-950">Order Placed Successfully!</h3>
                <p className="text-xs text-emerald-800">
                  Reference: <span className="font-mono font-bold">{orderSuccess.orderRef}</span>
                  {orderSuccess.providerOrderId && (
                    <span> • Provider Order ID: <span className="font-mono font-bold">#{orderSuccess.providerOrderId}</span></span>
                  )}
                </p>
              </div>
            </div>

            <Link
              href="/orders"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-emerald-300 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-all shadow-subtle"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>View in Orders</span>
            </Link>
          </div>

          <div className="p-4 rounded-xl bg-white/70 border border-emerald-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-emerald-700 block font-semibold">Service</span>
              <span className="font-bold text-emerald-950 truncate block">{orderSuccess.serviceName}</span>
            </div>
            <div>
              <span className="text-emerald-700 block font-semibold">Total Quantity</span>
              <span className="font-bold text-emerald-950">{orderSuccess.totalUnits.toLocaleString()} units</span>
            </div>
            <div>
              <span className="text-emerald-700 block font-semibold">Total Cost</span>
              <span className="font-bold text-emerald-950">${orderSuccess.totalCharge.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-emerald-700 block font-semibold">Delivery Mode</span>
              <span className="font-bold text-emerald-950">
                {orderSuccess.runs ? `${orderSuccess.runs} runs (${orderSuccess.interval}m interval)` : "Instant Delivery"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetForm}
            className="text-xs font-bold text-[#3A4EFB] hover:underline cursor-pointer"
          >
            + Place another order
          </button>
        </div>
      )}

      {/* Error Notification */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-3 text-sm animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div className="leading-relaxed font-medium">{errorMessage}</div>
        </div>
      )}

      {/* Main Order Card */}
      <form onSubmit={handleSubmitOrder} className="rounded-2xl bg-white border border-[#DEE0ED] p-6 sm:p-8 shadow-sm space-y-6">
        {/* Category Picker */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#252943]/70 mb-2">
            Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => handleSelectCategory(e.target.value)}
            disabled={loadingServices || services.length === 0}
            className="w-full px-3.5 py-3 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-sm text-[#252943] font-semibold focus:outline-none focus:border-[#3A4EFB] focus:bg-white transition-all cursor-pointer"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Service Picker with Search */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-[#252943]/70">
              Service
            </label>
            <div className="relative w-48 sm:w-64">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search services..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#F8F9FD] border border-[#DEE0ED] text-xs text-[#252943] focus:outline-none focus:border-[#3A4EFB]"
              />
              <Search className="w-3.5 h-3.5 text-[#252943]/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <select
            value={selectedServiceId}
            onChange={(e) => handleSelectService(e.target.value)}
            disabled={loadingServices || filteredServices.length === 0}
            className="w-full px-3.5 py-3 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-sm text-[#252943] font-medium focus:outline-none focus:border-[#3A4EFB] focus:bg-white transition-all cursor-pointer"
          >
            {filteredServices.map((s) => (
              <option key={s.id} value={s.id}>
                [{s.providerServiceId || s.externalId}] {s.name} — ${s.ratePer1000.toFixed(2)}/1K
              </option>
            ))}
          </select>
        </div>

        {/* Active Service Info Box */}
        {activeService && (
          <div className="p-4 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-[#252943]">{activeService.name}</span>
              <span className="font-extrabold text-[#3A4EFB] bg-[#3A4EFB]/10 px-2.5 py-1 rounded-md">
                ${activeService.ratePer1000.toFixed(2)} per 1,000
              </span>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-[#252943]/70 pt-2 border-t border-[#DEE0ED]/60">
              <div>
                <span className="text-[#252943]/50">Min:</span>{" "}
                <span className="font-bold text-[#252943]">{activeService.minQuantity.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[#252943]/50">Max:</span>{" "}
                <span className="font-bold text-[#252943]">{activeService.maxQuantity.toLocaleString()}</span>
              </div>
              {activeService.dripFeedSupported && (
                <div className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                  <Repeat className="w-3 h-3" />
                  <span>Drip-feed Supported</span>
                </div>
              )}
            </div>

            {activeService.description && (
              <p className="text-xs text-[#252943]/60 leading-relaxed pt-1">
                {activeService.description}
              </p>
            )}
          </div>
        )}

        {/* Target Link */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#252943]/70 mb-2">
            Target Link <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            required
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://www.instagram.com/p/... or profile URL"
            className="w-full px-3.5 py-3 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-sm text-[#252943] focus:outline-none focus:border-[#3A4EFB] focus:bg-white transition-all font-mono"
          />
        </div>

        {/* Quantity Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#252943]/70">
              {isDripFeed ? "Quantity per Run" : "Quantity"} <span className="text-red-500">*</span>
            </label>
            {activeService && (
              <span className="text-xs text-[#252943]/50">
                Min: {activeService.minQuantity.toLocaleString()} – Max: {activeService.maxQuantity.toLocaleString()}
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
            className={`w-full px-3.5 py-3 rounded-xl bg-[#F8F9FD] border text-sm font-bold text-[#252943] focus:outline-none focus:bg-white transition-all ${
              quantityError ? "border-red-300 focus:border-red-500" : "border-[#DEE0ED] focus:border-[#3A4EFB]"
            }`}
          />
          {quantityError && (
            <p className="text-xs text-red-600 mt-1 font-semibold">{quantityError}</p>
          )}
        </div>

        {/* Drip-Feed Section (WORKING) */}
        <div className="pt-2 border-t border-[#DEE0ED]/80">
          <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#F8F9FD] hover:bg-[#F2F4FD] border border-[#DEE0ED] cursor-pointer transition-colors select-none">
            <input
              type="checkbox"
              checked={isDripFeed}
              onChange={(e) => setIsDripFeed(e.target.checked)}
              className="w-4 h-4 rounded text-[#3A4EFB] focus:ring-[#3A4EFB]"
            />
            <div>
              <span className="text-sm font-bold text-[#252943] flex items-center gap-2">
                <Repeat className="w-4 h-4 text-[#3A4EFB]" />
                Drip-feed
              </span>
              <span className="text-xs text-[#252943]/60 block mt-0.5">
                Deliver this order in multiple staggered batches over time for natural organic growth.
              </span>
            </div>
          </label>

          {isDripFeed && (
            <div className="mt-4 p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Runs */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#252943]/70 mb-1.5">
                    Runs (Batches)
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={100}
                    value={dripRuns}
                    onChange={(e) => setDripRuns(Math.max(2, parseInt(e.target.value, 10) || 2))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-indigo-200 text-sm font-bold text-[#252943] focus:outline-none focus:border-[#3A4EFB]"
                  />
                  <span className="text-[11px] text-[#252943]/50 mt-1 block">
                    Number of times to repeat the order (min: 2)
                  </span>
                </div>

                {/* Interval */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#252943]/70 mb-1.5">
                    Interval (Minutes)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={dripIntervalMinutes}
                    onChange={(e) => setDripIntervalMinutes(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-indigo-200 text-sm font-bold text-[#252943] focus:outline-none focus:border-[#3A4EFB]"
                  />
                  <span className="text-[11px] text-[#252943]/50 mt-1 block">
                    Minutes between each run (e.g. 60 = 1 hour)
                  </span>
                </div>
              </div>

              {/* Drip Calculation Summary */}
              <div className="p-3.5 rounded-xl bg-white border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-[#252943]">Drip Delivery Schedule:</span>
                  <div className="text-[#252943]/70 mt-0.5">
                    Will send <span className="font-bold text-[#3A4EFB]">{numericQty.toLocaleString()} units</span> every{" "}
                    <span className="font-bold text-[#3A4EFB]">{dripIntervalMinutes} minutes</span> across{" "}
                    <span className="font-bold text-[#3A4EFB]">{effectiveRuns} runs</span>.
                  </div>
                </div>

                <div className="text-right sm:border-l sm:border-indigo-100 sm:pl-4">
                  <span className="text-[11px] uppercase tracking-wider text-[#252943]/50 font-bold block">
                    Total Quantity
                  </span>
                  <span className="text-base font-extrabold text-[#3A4EFB]">
                    {totalUnits.toLocaleString()} units
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pricing & Charge Summary */}
        <div className="p-5 rounded-2xl bg-[#252943] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div>
            <span className="text-xs uppercase tracking-wider text-[#DEE0ED]/60 font-semibold block">
              Total Order Charge
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#E3FF3B] mt-0.5">
              ${totalCost.toFixed(2)}
            </div>
            <span className="text-xs text-[#DEE0ED]/70 mt-0.5 block">
              {totalUnits.toLocaleString()} units @ ${ratePer1k.toFixed(2)}/1K
              {isDripFeed ? ` (${effectiveRuns} runs of ${numericQty} units)` : ""}
            </span>
          </div>

          <button
            type="submit"
            disabled={submitting || loadingServices || !activeService || Boolean(quantityError)}
            className="px-8 py-3.5 rounded-xl bg-[#3A4EFB] hover:bg-[#3243d9] active:scale-95 disabled:opacity-50 text-white font-extrabold text-sm shadow-subtle transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting Order...</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                <span>{isDripFeed ? "Submit Drip-feed Order" : "Submit Order"}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-[#252943]/60">
          <Loader2 className="w-6 h-6 animate-spin text-[#3A4EFB]" />
        </div>
      }
    >
      <NewOrderForm />
    </Suspense>
  );
}

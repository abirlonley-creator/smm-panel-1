"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { 
  ListTree, 
  Search, 
  ChevronLeft,
  ChevronRight, 
  Loader2,
  Copy,
  Check,
  X,
  RotateCcw,
  Ban,
  Tag,
  RefreshCw,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

interface ServiceItem {
  id: string;
  externalId: string;
  providerServiceId?: string;
  providerId?: string;
  providerName?: string;
  name: string;
  type?: string;
  platform: string;
  category: string;
  description: string;
  minQuantity: number;
  maxQuantity: number;
  ratePer1000: number;
  refillSupported?: boolean;
  cancelSupported?: boolean;
  dripFeedSupported: boolean;
  dripFeedMinInterval: number;
  restrictions?: string;
  isMock: boolean;
}

const PAGE_SIZE = 15;
const PLATFORMS = [
  "All",
  "Instagram",
  "YouTube",
  "TikTok",
  "Twitter / X",
  "LinkedIn",
  "Spotify",
  "Telegram",
  "Other",
];

interface ProviderInfo {
  name: string;
  apiUrl: string;
  isMock: boolean;
  isLive: boolean;
  cached: boolean;
  lastSyncAt: string | null;
  warning?: string;
}

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [totalServices, setTotalServices] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selectedPlatform, setSelectedPlatform] = useState("All");
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [providers, setProviders] = useState<{ id: string; name: string; currency: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
  
  // Search state
  const [searchInput, setSearchInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchServices = useCallback(async (
    searchParam: string,
    page: number,
    platform: string,
    providerId: string,
    signal: AbortSignal,
    forceRefresh: boolean = false
  ) => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (searchParam && searchParam.trim()) {
        params.set("search", searchParam.trim());
      }
      if (platform !== "All") params.set("platform", platform);
      if (providerId) params.set("providerId", providerId);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      if (forceRefresh) params.set("refresh", "true");

      const res = await fetch(`/api/services?${params.toString()}`, {
        signal,
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.success || !Array.isArray(data.services)) {
        throw new Error(data.error || "The selected category could not be loaded.");
      }
      if (!signal.aborted) {
        setServices(data.services);
        setTotalServices(data.totalServices ?? data.services.length);
        if (data.provider) setProviderInfo(data.provider);
        if (Array.isArray(data.providers)) setProviders(data.providers);
      }
    } catch (err) {
      if (!signal.aborted) {
        console.error("Failed to load services", err);
        setServices([]);
        setTotalServices(0);
        setLoadError(err instanceof Error ? err.message : "Failed to load services.");
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchServices(activeQuery, currentPage, selectedPlatform, selectedProviderId, controller.signal);
    return () => controller.abort();
  }, [activeQuery, currentPage, selectedPlatform, selectedProviderId, fetchServices, loadAttempt]);

  async function handleManualSync() {
    setRefreshing(true);
    try {
      const controller = new AbortController();
      await fetchServices(activeQuery, currentPage, selectedPlatform, selectedProviderId, controller.signal, true);
    } finally {
      setRefreshing(false);
    }
  }

  function handlePlatformChange(platform: string) {
    // Switch the visible selection immediately and discard stale results while
    // the page-one results for the new category are being fetched.
    setSelectedPlatform(platform);
    setCurrentPage(1);
    setSearchInput("");
    setActiveQuery("");
    setServices([]);
    setTotalServices(0);
    setLoadError(null);
    setLoading(true);

    // Clicking the already-selected category retries its request.
    if (platform === selectedPlatform) {
      setLoadAttempt((attempt) => attempt + 1);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCurrentPage(1);
    setActiveQuery(searchInput.trim());
  }

  function handleClearSearch() {
    setSearchInput("");
    setActiveQuery("");
    setCurrentPage(1);
  }

  function handleQuickIdFilter(id: string) {
    setSearchInput(id);
    setActiveQuery(id);
    setCurrentPage(1);
  }

  const filtered = services;
  const totalPages = Math.max(1, Math.ceil(totalServices / PAGE_SIZE));
  const firstResult = totalServices === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastResult = Math.min(currentPage * PAGE_SIZE, totalServices);

  return (
    <div className="space-y-6 animate-fadeIn max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 text-xs text-[#252943]/60 mb-1">
          <Link href="/" className="hover:text-[#3A4EFB]">Dashboard</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span>Services</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#252943] flex items-center gap-2">
              <ListTree className="w-6 h-6 text-[#3A4EFB]" />
              Verified Services Catalog
            </h1>
            <p className="text-xs sm:text-sm text-[#252943]/60 mt-0.5">
              Browse platform capabilities, minimums, maximums, pricing, and scheduling availability.
            </p>
          </div>
          <div className="text-xs font-semibold text-[#252943]/70 bg-white px-3.5 py-1.5 rounded-xl border border-[#DEE0ED] shadow-subtle">
            {loading
              ? `Loading ${selectedPlatform === "All" ? "all" : selectedPlatform} services...`
              : loadError
                ? "Unable to load services"
                : `Showing ${firstResult}–${lastResult} of ${totalServices} services`}
          </div>
        </div>
      </div>

      {/* ── Plan Comparison Banner ────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#252943] via-[#2A2E4B] to-[#323758] rounded-2xl p-4 sm:p-5 text-white border border-[#323758] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-subtle">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
            <Sparkles className="w-5 h-5 text-[#E3FF3B]" />
          </div>
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2">
              <span>Comparing Delivery Architectures?</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#E3FF3B] text-[#252943]">
                Visual Guide
              </span>
            </h2>
            <p className="text-xs text-[#DEE0ED]/70 mt-0.5">
              Explore our structured comparison between Instant Execution, Drip-Feed Pacing, and Natural S-Curve Engagement.
            </p>
          </div>
        </div>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-xs font-bold text-white transition-all press-scale shrink-0 shadow-sm"
        >
          <span>Compare Plans & Pricing</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#E3FF3B]" />
        </Link>
      </div>

      {/* Search Bar with Dedicated Search Button */}
      <div className="bg-white rounded-2xl border border-[#DEE0ED] p-5 shadow-subtle space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#252943]/40" />
            <input
              type="text"
              id="service-search-input"
              placeholder="Search by Service ID (e.g. 1, 2, 101) or service name, category..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-[#252943] placeholder-[#252943]/40 focus:border-[#3A4EFB] focus:bg-white transition-colors"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#252943]/40 hover:text-[#252943] p-1"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="submit"
              id="search-services-btn"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-xs sm:text-sm font-semibold transition-all press-scale shadow-subtle flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4 text-[#E3FF3B]" />
              <span>Search Services</span>
            </button>

            {activeQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-3 py-2.5 rounded-xl border border-[#DEE0ED] text-xs font-semibold text-[#252943]/70 hover:bg-[#F8F9FD]"
              >
                Reset
              </button>
            )}
          </div>
        </form>

        {/* Quick ID Chips & Platform Tabs */}
        <div className="pt-2 border-t border-[#DEE0ED]/60 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          {/* Platform Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePlatformChange(p)}
                className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-all press-scale ${
                  selectedPlatform === p
                    ? "bg-[#252943] text-white font-medium shadow-subtle"
                    : "bg-[#F8F9FD] text-[#252943]/70 hover:bg-[#DEE0ED]/50"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Provider Filter & Quick ID shortcuts */}
          <div className="flex items-center gap-3 text-[11px] text-[#252943]/60 flex-wrap">
            {providers.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[#252943]/60">Provider:</span>
                <select
                  value={selectedProviderId}
                  onChange={(e) => {
                    setSelectedProviderId(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-[#F8F9FD] border border-[#DEE0ED] rounded-lg px-2 py-1 text-xs font-semibold text-[#252943] focus:border-[#3A4EFB]"
                >
                  <option value="">All Providers</option>
                  {providers.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <span className="font-medium text-[#252943]/50">Quick IDs:</span>
            {["1", "2", "101", "201", "301", "401"].map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => handleQuickIdFilter(id)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                  activeQuery === id 
                    ? "bg-[#3A4EFB] text-white shadow-subtle" 
                    : "bg-[#F8F9FD] border border-[#DEE0ED] hover:bg-[#DEE0ED]/60 text-[#252943]"
                }`}
              >
                #{id}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Search Filter Banner */}
      {activeQuery && (
        <div className="bg-[#E3FF3B]/15 border border-[#E3FF3B] rounded-xl px-4 py-2.5 text-xs text-[#252943] flex items-center justify-between">
          <span>
            Filtering by query / Service ID: <strong className="font-bold">&quot;{activeQuery}&quot;</strong> ({totalServices} results)
          </span>
          <button
            onClick={handleClearSearch}
            className="text-[11px] font-semibold text-[#3A4EFB] hover:underline"
          >
            Show All Services
          </button>
        </div>
      )}

      {/* Services Table */}
      <div className="bg-white rounded-2xl border border-[#DEE0ED] shadow-subtle overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center text-xs text-[#252943]/60 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#3A4EFB]" />
            <span>Loading {selectedPlatform === "All" ? "service catalog" : `${selectedPlatform} services`}...</span>
          </div>
        ) : loadError ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-medium text-[#252943]">Could not load this category</p>
            <p className="text-xs text-[#252943]/60">{loadError}</p>
            <button
              type="button"
              onClick={() => setLoadAttempt((attempt) => attempt + 1)}
              className="mt-2 px-3 py-1.5 rounded-lg bg-[#3A4EFB] text-white text-xs font-semibold"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-medium text-[#252943]">No services matched your query</p>
            <p className="text-xs text-[#252943]/60">
              No service matching &quot;{activeQuery || searchInput}&quot;. Try another ID (e.g. 1, 2, 101) or clearing filters.
            </p>
            <button
              onClick={handleClearSearch}
              className="mt-2 px-3 py-1.5 rounded-lg bg-[#3A4EFB] text-white text-xs font-semibold"
            >
              Reset Search
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FD] border-b border-[#DEE0ED] text-[#252943]/60 font-medium">
                <tr>
                  <th className="py-3 px-4 w-20">Service ID</th>
                  <th className="py-3 px-4">Service Name & Type</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Min / Max</th>
                  <th className="py-3 px-4 text-right">Rate / 1k</th>
                  <th className="py-3 px-4 text-center">Refill / Cancel</th>
                  <th className="py-3 px-4 text-center">Drip-Feed</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEE0ED]/60">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-[#F8F9FD]/60 transition-colors">
                    {/* Service ID with Quick Copy & Provider Badge */}
                    <td className="py-3.5 px-4 font-bold text-[#252943]">
                      <div className="flex flex-col gap-1 items-start">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(s.externalId);
                            setCopiedId(s.externalId);
                            setTimeout(() => setCopiedId(null), 1500);
                          }}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#DEE0ED]/60 hover:bg-[#DEE0ED] text-xs font-bold text-[#252943] transition-colors"
                          title="Click to copy Service ID"
                        >
                          <span>#{s.externalId}</span>
                          {copiedId === s.externalId ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3 text-[#252943]/40" />
                          )}
                        </button>
                        {s.providerName && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {s.providerName}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 max-w-sm">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#DEE0ED]/50 text-[#252943]">
                          {s.platform}
                        </span>
                        <span className="font-semibold text-[#252943]">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-[#3A4EFB] font-semibold bg-[#3A4EFB]/10 px-2 py-0.5 rounded">
                          {s.type || "Default"}
                        </span>
                        <p className="text-[11px] text-[#252943]/60 truncate">{s.description}</p>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-medium text-[#252943]">
                      {s.category}
                    </td>

                    <td className="py-3.5 px-4 text-right font-medium text-[#252943]">
                      {s.minQuantity.toLocaleString()} – {s.maxQuantity.toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-right font-bold text-[#3A4EFB] text-sm tracking-tight">
                      ₹{Number(s.ratePer1000).toFixed(2)}
                    </td>

                    {/* Refill / Cancel Indicators */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium">
                        {s.refillSupported ? (
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1" title="Auto-Refill Supported">
                            <RotateCcw className="w-3 h-3" /> Refill
                          </span>
                        ) : (
                          <span className="text-[#252943]/40" title="Refill Not Supported">—</span>
                        )}
                        {s.cancelSupported ? (
                          <span className="text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md flex items-center gap-1" title="Order Cancellation Supported">
                            Cancel
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {s.dripFeedSupported ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#252943] bg-[#E3FF3B] px-2 py-0.5 rounded-full">
                          Drip-Feed
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#252943]/40">Instant Only</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/order?serviceId=${s.id}`}
                          className="px-2.5 py-1 rounded-lg bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-[11px] font-semibold transition-all press-scale"
                        >
                          Order
                        </Link>
                        {s.dripFeedSupported && (
                          <Link
                            href={`/planner?serviceId=${s.id}`}
                            className="px-2.5 py-1 rounded-lg bg-[#252943] hover:bg-[#1A1D31] text-white text-[11px] font-semibold transition-all press-scale"
                            title="Open in Growth Planner"
                          >
                            Plan
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && totalServices > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
          <p className="text-xs text-[#252943]/60">
            Showing {firstResult}–{lastResult} of {totalServices} services · {PAGE_SIZE} per page
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#DEE0ED] text-xs font-semibold text-[#252943] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <span className="text-xs text-[#252943]/70 px-1">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage >= totalPages}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#DEE0ED] text-xs font-semibold text-[#252943] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

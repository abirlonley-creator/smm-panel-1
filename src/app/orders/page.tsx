"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Layers, 
  Search, 
  ChevronRight, 
  TrendingUp, 
  Loader2,
  RefreshCw,
  Zap,
  Clock,
  Send,
} from "lucide-react";
import { formatBdDateTime } from "@/lib/date-bd";

interface OrderItem {
  id: string;
  orderRef: string;
  targetUrl: string;
  requestedQuantity: number;
  submittedQuantity: number;
  deliveredQuantity: number;
  remainingQuantity: number;
  totalCost: number;
  isScheduled: boolean;
  scheduleMode?: string;
  status: string;
  providerOrderId?: string;
  createdAt: string;
  notes?: string | null;
  engagementOrder?: {
    id: string;
    orderRef: string;
    deliveredViews: number;
    plannedViews: number;
    deliveredLikes: number;
    plannedLikes: number;
    status: string;
    presetKey?: string | null;
  } | null;
  service: {
    name: string;
    platform: string;
    ratePer1000: number;
    userProvider?: { id: string; name: string; apiUrl: string; currency: string } | null;
    provider?: { id: string; name: string; currency: string } | null;
  };
  dripFeedRuns?: Array<{
    id: string;
    runNumber: number;
    quantity: number;
    status: string;
    providerOrderId?: string | null;
  }>;
  steps?: Array<{
    id: string;
    stepNumber: number;
    quantity: number;
    status: string;
  }>;
}

const STATUS_TABS = [
  "ALL",
  "ENGAGEMENT",
  "SCHEDULED",
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
  "REQUIRES_RECONCILIATION",
];

let initialOrdersCache: any = null;
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem("aurasmm_orders_v1_ALL_p1");
    if (raw) initialOrdersCache = JSON.parse(raw);
  } catch (e) {}
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>(() => initialOrdersCache?.orders || []);
  const [loading, setLoading] = useState<boolean>(() => !initialOrdersCache || !initialOrdersCache.orders || initialOrdersCache.orders.length === 0);
  const [activeTab, setActiveTab] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(() => initialOrdersCache?.pagination || { total: 0, totalPages: 1, page: 1 });
  const [counts, setCounts] = useState<Record<string, number>>(() => initialOrdersCache?.counts || {});

  async function fetchOrders(showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      const params = new URLSearchParams({
        status: activeTab,
        page: page.toString(),
        limit: "15",
      });
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/orders?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders);
        setPagination(data.pagination);
        setCounts(data.counts || {});
        if (typeof window !== "undefined" && !searchQuery.trim()) {
          try {
            localStorage.setItem(`aurasmm_orders_v1_${activeTab}_p${page}`, JSON.stringify(data));
          } catch (e) {}
        }
      }

      // Opportunistic background scheduler tick
      fetch("/api/scheduler/tick", { method: "POST" }).catch(() => {});
    } catch (err) {
      console.error("Failed to load orders", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // 0ms instant display from localStorage cache
    const cacheKey = `aurasmm_orders_v1_${activeTab}_p${page}`;
    let hasCached = false;
    if (typeof window !== "undefined" && !searchQuery.trim()) {
      try {
        const cachedStr = localStorage.getItem(cacheKey);
        if (cachedStr) {
          const parsed = JSON.parse(cachedStr);
          if (parsed && Array.isArray(parsed.orders) && parsed.orders.length > 0) {
            setOrders(parsed.orders);
            if (parsed.counts) setCounts(parsed.counts);
            if (parsed.pagination) setPagination(parsed.pagination);
            setLoading(false);
            hasCached = true;
          }
        }
      } catch (e) {}
    }
    fetchOrders(!hasCached);
  }, [activeTab, page]);

  // Quiet background auto-refresh every 15s to keep provider delivery status live
  useEffect(() => {
    const timer = setInterval(() => {
      fetchOrders(false);
    }, 15000);
    return () => clearInterval(timer);
  }, [activeTab, page, searchQuery]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  }

  return (
    <div className="space-y-6 animate-fadeIn max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 text-xs text-[#252943]/60 mb-1">
          <Link href="/" className="hover:text-[#3A4EFB]">Dashboard</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span>Orders</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#252943] flex items-center gap-2">
              <Layers className="w-6 h-6 text-[#3A4EFB]" />
              Order Management
            </h1>
            <p className="text-xs sm:text-sm text-[#252943]/60 mt-0.5">
              Live progress tracking, delivery references, and scheduled delivery status.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchOrders(true)}
              className="p-2 rounded-xl border border-[#DEE0ED] bg-white hover:bg-[#F8F9FD] text-[#252943]/70 transition-colors press-scale"
              title="Refresh Orders"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#3A4EFB]" : ""}`} />
            </button>
            <Link
              href="/order"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-xs font-semibold transition-all press-scale shadow-subtle"
            >
              + New Order
            </Link>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-2xl border border-[#DEE0ED] p-4 shadow-subtle space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
            {STATUS_TABS.map((tab) => {
              const count = counts[tab] ?? 0;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab);
                    setPage(1);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 press-scale ${
                    activeTab === tab
                      ? "bg-[#252943] text-white font-medium shadow-subtle"
                      : "bg-[#F8F9FD] text-[#252943]/70 hover:bg-[#DEE0ED]/50"
                  }`}
                >
                  <span>
                    {tab === "ALL" ? (
                      "All Orders"
                    ) : tab === "ENGAGEMENT" ? (
                      <span className="flex items-center gap-1">
                        <Zap className={`w-3 h-3 ${activeTab === tab ? "text-[#E3FF3B]" : "text-[#3A4EFB]"}`} />
                        <span>Engagement</span>
                      </span>
                    ) : tab === "REQUIRES_RECONCILIATION" ? (
                      "Needs Review"
                    ) : tab === "PARTIAL" ? (
                      "Partially Delivered"
                    ) : tab === "PROCESSING" ? (
                      "In Progress"
                    ) : (
                      tab.charAt(0) + tab.slice(1).toLowerCase()
                    )}
                  </span>
                  {count > 0 && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      activeTab === tab ? "bg-white/20 text-white" : "bg-[#DEE0ED] text-[#252943]"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#252943]/40" />
            <input
              type="text"
              placeholder="Search reference or URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#252943] focus:border-[#3A4EFB] focus:bg-white transition-colors"
            />
          </form>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-[#DEE0ED] shadow-subtle overflow-hidden">
        {loading && orders.length > 0 && (
          <div className="h-0.5 bg-blue-100 overflow-hidden">
            <div className="h-full bg-[#3A4EFB] animate-pulse w-full" />
          </div>
        )}
        {loading && orders.length === 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs animate-pulse">
              <thead className="bg-[#F8F9FD] border-b border-[#DEE0ED] text-[#252943]/60 font-medium">
                <tr>
                  <th className="py-3 px-4">Order Ref</th>
                  <th className="py-3 px-4">Platform & Service</th>
                  <th className="py-3 px-4">Target Link</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4 text-right">Cost / value</th>
                  <th className="py-3 px-4">Delivery Mode</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEE0ED]/60">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <tr key={i} className="hover:bg-[#F8F9FD]/60">
                    <td className="py-3.5 px-4"><div className="h-4 w-24 bg-[#EBEFFA] rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-44 bg-[#EBEFFA] rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-32 bg-[#EBEFFA] rounded" /></td>
                    <td className="py-3.5 px-4 text-right"><div className="h-4 w-16 bg-[#EBEFFA] rounded ml-auto" /></td>
                    <td className="py-3.5 px-4 text-right"><div className="h-4 w-12 bg-[#EBEFFA] rounded ml-auto" /></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-16 bg-[#EBEFFA] rounded" /></td>
                    <td className="py-3.5 px-4"><div className="h-5 w-20 bg-[#EBEFFA] rounded-full" /></td>
                    <td className="py-3.5 px-4 text-right"><div className="h-4 w-14 bg-[#EBEFFA] rounded ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#DEE0ED]/50 flex items-center justify-center mx-auto text-[#252943]/40">
              <Layers className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-[#252943]">No orders found</p>
            <p className="text-xs text-[#252943]/60 max-w-sm mx-auto">
              {searchQuery ? "Try refining your search terms or filter selection." : "Start by creating an order or a growth schedule."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FD] border-b border-[#DEE0ED] text-[#252943]/60 font-medium">
                <tr>
                  <th className="py-3 px-4">Order Ref</th>
                  <th className="py-3 px-4">Platform & Service</th>
                  <th className="py-3 px-4">Target Link</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4 text-right">Cost / value</th>
                  <th className="py-3 px-4">Delivery Mode</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEE0ED]/60">
                {orders.map((order) => {
                  const isEngagement = order.scheduleMode === "TIKTOK_ENGAGEMENT" || Boolean(order.engagementOrder);
                  const dashboardHref = order.engagementOrder ? `/engagement/orders/${order.engagementOrder.id}` : `/orders/${order.id}`;

                  return (
                    <tr key={order.id} className="hover:bg-[#F8F9FD]/60 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-[#252943]">
                        <div className="flex items-center gap-2">
                          <Link href={dashboardHref} className="hover:text-[#3A4EFB] font-bold text-sm">
                            {order.orderRef}
                          </Link>
                        </div>

                        {/* Prominent Delivery & Order Reference Badge */}
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          {isEngagement ? (
                            <>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[#3A4EFB]/10 text-[#3A4EFB] border border-[#3A4EFB]/20">
                                <Zap className="w-2.5 h-2.5" /> TikTok Engagement
                              </span>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                Views Batches
                              </span>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                Engagement Waves
                              </span>
                            </>
                          ) : order.providerOrderId ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              Ref: {order.orderRef}
                            </span>
                          ) : order.dripFeedRuns && order.dripFeedRuns.length > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              Drip Delivery: {order.dripFeedRuns.filter((r) => r.status === "COMPLETED").length}/{order.dripFeedRuns.length} runs sent
                            </span>
                          ) : order.isScheduled ? (
                            (() => {
                              let schedTime: string | null = null;
                              if (order.notes) {
                                try {
                                  const parsedNotes = JSON.parse(order.notes);
                                  if (parsedNotes.scheduledFor) schedTime = formatBdDateTime(parsedNotes.scheduledFor);
                                } catch {}
                              }
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  <Clock className="w-2.5 h-2.5 text-amber-600" />
                                  {schedTime ? `Scheduled: ${schedTime} BD` : "Scheduled Order"}
                                </span>
                              );
                            })()
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-50 text-gray-500 border border-gray-200">
                              Automated Network
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-[#252943]/50 font-normal mt-0.5">
                          {formatBdDateTime(order.createdAt)} BD
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-[220px]">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#DEE0ED]/60 text-[#252943] mr-1.5">
                          {isEngagement ? "TikTok" : order.service.platform}
                        </span>
                        <span className="font-semibold text-[#252943] truncate block mt-0.5">
                          {isEngagement ? "TikTok Organic Working Preset" : order.service.name}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 max-w-[180px] truncate font-normal text-[#252943]/80">
                        {order.targetUrl}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {isEngagement ? (
                          <div className="space-y-0.5">
                            <div className="font-extrabold text-[#252943] text-xs">
                              👁️ {(order.engagementOrder?.deliveredViews ?? 0).toLocaleString()} / {(order.engagementOrder?.plannedViews ?? order.requestedQuantity).toLocaleString()}
                            </div>
                            <div className="font-extrabold text-rose-600 text-[11px]">
                              ❤️ {(order.engagementOrder?.deliveredLikes ?? 0).toLocaleString()} / {(order.engagementOrder?.plannedLikes ?? 42).toLocaleString()}
                            </div>
                          </div>
                        ) : order.scheduleMode === "ADAPTIVE" ? (
                          <>
                            <div className="font-bold text-[#252943]">
                              {order.steps?.reduce((total, step) => total + (step.quantity || 0), 0).toLocaleString() || "0"}
                            </div>
                            <div className="text-[10px] text-[#252943]/60 font-medium">
                              {order.steps?.length
                                ? `from ${order.steps.length} measured ${order.steps.length === 1 ? "batch" : "batches"}`
                                : "no batches measured yet"}
                            </div>
                          </>
                        ) : (
                          (() => {
                            const dripCompleted = order.dripFeedRuns
                              ? order.dripFeedRuns.filter((r) => r.status === "COMPLETED").reduce((sum, r) => sum + r.quantity, 0)
                              : 0;
                            const dripDispatched = order.dripFeedRuns
                              ? order.dripFeedRuns.filter((r) => ["COMPLETED", "SUBMITTED", "PROCESSING"].includes(r.status)).reduce((sum, r) => sum + r.quantity, 0)
                              : 0;
                            const hasPendingBatches = Boolean(
                              (order.dripFeedRuns && order.dripFeedRuns.some((r) => ["PENDING", "PROCESSING"].includes(r.status))) ||
                              (order.steps && order.steps.some((s) => ["PENDING", "PROCESSING"].includes(s.status)))
                            );
                            const delivered =
                              order.dripFeedRuns && order.dripFeedRuns.length > 0
                                ? hasPendingBatches
                                  ? Math.min(dripDispatched, Math.max(0, dripCompleted))
                                  : order.status === "COMPLETED"
                                    ? Math.max(order.deliveredQuantity, order.submittedQuantity || order.requestedQuantity)
                                    : Math.min(dripDispatched, Math.max(order.deliveredQuantity, dripCompleted))
                                : order.steps && order.steps.length > 0
                                  ? hasPendingBatches
                                    ? Math.min(order.requestedQuantity, order.steps.filter((s) => s.status === "COMPLETED").reduce((sum, s) => sum + s.quantity, 0))
                                    : order.status === "COMPLETED"
                                      ? Math.max(order.deliveredQuantity, order.submittedQuantity || order.requestedQuantity)
                                      : order.deliveredQuantity
                                  : order.status === "COMPLETED"
                                    ? Math.max(order.deliveredQuantity, order.submittedQuantity || order.requestedQuantity)
                                    : order.deliveredQuantity;
                            const pct = Math.min(100, Math.round((delivered / (order.requestedQuantity || 1)) * 100));
                            return (
                              <>
                                <div className="font-bold text-[#252943]">
                                  {delivered.toLocaleString()} / {order.requestedQuantity.toLocaleString()}
                                </div>
                                <div className={`text-[10px] font-medium ${pct >= 100 && !hasPendingBatches ? "text-emerald-600 font-bold" : "text-[#252943]/60"}`}>
                                  {pct}% delivered
                                </div>
                              </>
                            );
                          })()
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-[#3A4EFB] text-sm">
                        {order.scheduleMode === "ADAPTIVE"
                          ? `₹${((Math.max(0, order.submittedQuantity) / 1000) * order.service.ratePer1000).toFixed(2)}`
                          : `₹${Number(order.totalCost).toFixed(2)}`}
                        {order.scheduleMode === "ADAPTIVE" && (
                          <span className="block text-[9px] font-normal text-[#252943]/50">estimated value sent</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {isEngagement ? (
                          <div className="inline-flex items-center gap-1 text-[11px] font-extrabold text-purple-900 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                            <Zap className="w-3 h-3 text-[#3A4EFB]" />
                            <span>16 Views + 3 Likes Runs</span>
                          </div>
                        ) : order.scheduleMode === "SCHEDULED" ? (
                          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Scheduled Single Order</span>
                          </div>
                        ) : order.isScheduled ? (
                          <div className="inline-flex items-center gap-1 text-[11px] font-medium text-[#252943] bg-[#DEE0ED]/60 px-2 py-0.5 rounded-full">
                            <TrendingUp className="w-3 h-3 text-[#3A4EFB]" />
                            <span>
                              {order.scheduleMode === "ADAPTIVE"
                                ? `Likes Analyze · ${order.steps?.length || 0} ${order.steps?.length === 1 ? "batch" : "batches"}`
                                : order.scheduleMode === "DRIP_FEED"
                                  ? `Drip Feed (${order.dripFeedRuns?.length || 0} runs)`
                                  : `${order.scheduleMode || "Drip"} (${order.steps?.length || 0} steps)`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#252943]/70">Instant</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge
                          status={
                            isEngagement
                              ? (order.engagementOrder?.status || order.status)
                              : Boolean(
                                  (order.dripFeedRuns && order.dripFeedRuns.some((r) => ["PENDING", "PROCESSING"].includes(r.status))) ||
                                  (order.steps && order.steps.some((s) => ["PENDING", "PROCESSING"].includes(s.status)))
                                ) && order.status === "COMPLETED"
                                ? "PROCESSING"
                                : order.status
                          }
                          label={order.scheduleMode === "ADAPTIVE" && order.status === "SCHEDULED" ? "Monitoring" : undefined}
                        />
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={dashboardHref}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#3A4EFB] hover:text-[#2C3FE0]"
                        >
                          <span>{isEngagement ? "Inspect Dashboard" : "Inspect"}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-[#DEE0ED] flex items-center justify-between text-xs text-[#252943]/60 bg-[#F8F9FD]">
            <span>
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total orders)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 rounded-lg border border-[#DEE0ED] bg-white disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 rounded-lg border border-[#DEE0ED] bg-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 24/7 Live Support Banner */}
      <div className="p-4 rounded-3xl bg-white border border-[#DEE0ED] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-[#0088cc]/10 border border-[#0088cc]/20 flex items-center justify-center text-[#0088cc] shrink-0">
            <Send className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-[#252943] flex items-center gap-2">
              <span>24/7 Dedicated Support</span>
              <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </span>
            </h4>
            <p className="text-[11px] text-[#252943]/60">
              Need assistance with your orders, deposit top ups, or custom requests?
            </p>
          </div>
        </div>

        <a
          href="https://t.me/Ghostfinds"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-bold transition-all shadow-subtle flex items-center justify-center gap-1.5 press-scale self-start sm:self-auto shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Message @Ghostfinds (24/7)</span>
        </a>
      </div>
    </div>
  );
}

function StatusBadge({ status, label }: { status: string; label?: string }) {
  let badgeColor = "bg-[#DEE0ED]/60 text-[#252943]";
  if (status === "COMPLETED") badgeColor = "bg-[#E3FF3B] text-[#252943] font-semibold";
  else if (status === "PROCESSING") badgeColor = "bg-[#3A4EFB]/15 text-[#3A4EFB] font-medium";
  else if (status === "SCHEDULED") badgeColor = "bg-[#252943] text-white font-medium";
  else if (status === "FAILED") badgeColor = "bg-red-100 text-red-700 font-medium";
  else if (status === "REQUIRES_RECONCILIATION") badgeColor = "bg-amber-100 text-amber-800 font-medium";
  else if (status === "CANCELLED") badgeColor = "bg-gray-200 text-gray-700 font-medium";

  const statusLabels: Record<string, string> = {
    COMPLETED: "Completed",
    PROCESSING: "Processing",
    SCHEDULED: "Scheduled",
    PENDING: "Queued",
    PARTIAL: "Partially delivered",
    FAILED: "Failed",
    REQUIRES_RECONCILIATION: "Needs review",
    CANCELLED: "Cancelled",
  };

  return (
    <span className={`inline-block text-[10px] tracking-wide px-2 py-0.5 rounded-full ${badgeColor}`}>
      {label || statusLabels[status] || status.replaceAll("_", " ")}
    </span>
  );
}

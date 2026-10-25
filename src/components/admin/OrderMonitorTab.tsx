"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Eye,
  Filter,
  Flame,
  HelpCircle,
  Layers,
  Loader2,
  PauseCircle,
  Play,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  TrendingDown,
  TrendingUp,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { EngagementDetailChart } from "@/components/engagement/EngagementDetailChart";
import { EngagementType } from "@/lib/engagement/planner";
import { formatProviderBalance } from "@/lib/currency";

interface OverviewStats {
  ordersInProgress: number;
  onTrackPercentage: number;
  delayedOrders: number;
  failedOrders: number;
  runsDueNextHour: number;
  openAlertsCount: number;
  providersHealth: Array<{
    id: string;
    name: string;
    health: "up" | "slow" | "down";
    active: boolean;
    balance: number | null;
    currency: string;
  }>;
}

interface OrderSummaryRow {
  id: string;
  orderRef: string;
  username: string;
  userRole?: string;
  platform: string;
  targetUrl: string;
  createdAt: string;
  status: string;
  totalPrice: number;
  progressPct: number;
  overallDeviationPct: number;
  delayStatus: "On time" | "Slightly late" | "Late" | "Failed";
  providers: string[];
  openAlertsCount: number;
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
}

export function OrderMonitorTab() {
  const [subTab, setSubTab] = useState<"orders" | "delivery_speed">("orders");

  // Orders table state
  const [orders, setOrders] = useState<OrderSummaryRow[]>([]);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterProvider, setFilterProvider] = useState("all");
  const [filterDateRange, setFilterDateRange] = useState("all");
  const [onlyDelayed, setOnlyDelayed] = useState(false);
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Selected Order Detail Modal state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailSubTab, setDetailSubTab] = useState<"cumulative" | "ratio" | "timeline" | "runs">("cumulative");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Delivery Speed Report state
  const [speedData, setSpeedData] = useState<any | null>(null);
  const [loadingSpeed, setLoadingSpeed] = useState(false);
  const [speedPeriod, setSpeedPeriod] = useState<"24h" | "7d" | "30d">("24h");
  const [instantThresholdMins, setInstantThresholdMins] = useState(5);
  const [slowP95ThresholdSecs, setSlowP95ThresholdSecs] = useState(300);
  const [selectedServiceDrilldown, setSelectedServiceDrilldown] = useState<any | null>(null);

  // Fetch orders from server
  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        sortBy,
        sortOrder,
      });

      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterPlatform !== "all") params.set("platform", filterPlatform);
      if (filterProvider !== "all") params.set("provider", filterProvider);
      if (filterDateRange !== "all") params.set("dateRange", filterDateRange);
      if (onlyDelayed) params.set("onlyDelayed", "true");
      if (onlyFailed) params.set("onlyFailed", "true");

      const res = await fetch(`/api/admin/order-monitor?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders);
        setOverview(data.overview);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.total);
      }
    } catch (err) {
      console.error("Failed to load admin orders monitor:", err);
    } finally {
      setLoadingOrders(false);
    }
  }, [
    page,
    pageSize,
    sortBy,
    sortOrder,
    searchQuery,
    filterStatus,
    filterPlatform,
    filterProvider,
    filterDateRange,
    onlyDelayed,
    onlyFailed,
  ]);

  useEffect(() => {
    loadOrders();
    const timer = setInterval(() => {
      loadOrders();
    }, 20000); // 20s live auto-refresh
    return () => clearInterval(timer);
  }, [loadOrders]);

  // Load order detail
  const loadOrderDetail = useCallback(async (orderId: string) => {
    setLoadingDetail(true);
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/admin/order-monitor/${orderId}`);
      const data = await res.json();
      if (data.success) {
        setDetailData(data);
      }
    } catch (err) {
      console.error("Failed to load order detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const openOrderModal = (orderId: string) => {
    setSelectedOrderId(orderId);
    loadOrderDetail(orderId);
  };

  const closeOrderModal = () => {
    setSelectedOrderId(null);
    setDetailData(null);
    setActionFeedback(null);
  };

  // Perform Order Action
  const handleOrderAction = async (action: string, payload?: any) => {
    if (!selectedOrderId) return;
    setActionLoading(action);
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/admin/order-monitor/${selectedOrderId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Action failed");
      }
      setActionFeedback({ type: "success", text: data.message || "Action completed" });
      await loadOrderDetail(selectedOrderId);
      await loadOrders();
    } catch (err: any) {
      setActionFeedback({ type: "error", text: err.message || "Failed to perform action" });
    } finally {
      setActionLoading(null);
    }
  };

  // Load Delivery Speed Report
  const loadDeliverySpeed = useCallback(async () => {
    setLoadingSpeed(true);
    try {
      const params = new URLSearchParams({
        period: speedPeriod,
        instantThresholdMins: instantThresholdMins.toString(),
        slowP95ThresholdSecs: slowP95ThresholdSecs.toString(),
      });
      const res = await fetch(`/api/admin/order-monitor/delivery-speed?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setSpeedData(data);
      }
    } catch (err) {
      console.error("Failed to load delivery speed report:", err);
    } finally {
      setLoadingSpeed(false);
    }
  }, [speedPeriod, instantThresholdMins, slowP95ThresholdSecs]);

  useEffect(() => {
    if (subTab === "delivery_speed") {
      loadDeliverySpeed();
    }
  }, [subTab, loadDeliverySpeed]);

  // CSV Export
  const triggerCsvExport = (type: "orders" | "runs") => {
    const params = new URLSearchParams({ type });
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterPlatform !== "all") params.set("platform", filterPlatform);
    if (filterProvider !== "all") params.set("provider", filterProvider);
    if (onlyDelayed) params.set("onlyDelayed", "true");
    if (onlyFailed) params.set("onlyFailed", "true");
    window.open(`/api/admin/order-monitor/export?${params.toString()}`, "_blank");
  };

  const getDelayChip = (delayStatus: string) => {
    switch (delayStatus) {
      case "On time":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            On time
          </span>
        );
      case "Slightly late":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Slightly late
          </span>
        );
      case "Late":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
            Late
          </span>
        );
      case "Failed":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            Failed
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-50 text-gray-700 border border-gray-200">
            {delayStatus}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Sub-Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#DEE0ED] pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab("orders")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              subTab === "orders"
                ? "bg-[#252943] text-white shadow-subtle"
                : "bg-white text-[#252943]/70 hover:bg-[#F8F9FD] border border-[#DEE0ED]"
            }`}
          >
            <Layers className="w-4 h-4 text-[#E3FF3B]" />
            <span>Orders Monitor</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab("delivery_speed")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              subTab === "delivery_speed"
                ? "bg-[#252943] text-white shadow-subtle"
                : "bg-white text-[#252943]/70 hover:bg-[#F8F9FD] border border-[#DEE0ED]"
            }`}
          >
            <Zap className="w-4 h-4 text-[#E3FF3B]" />
            <span>Delivery Speed & Bottlenecks</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => triggerCsvExport("orders")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#DEE0ED] bg-white text-xs font-bold text-[#252943] hover:border-[#3A4EFB] shadow-subtle"
          >
            <Download className="w-3.5 h-3.5 text-[#3A4EFB]" />
            <span>Export Orders CSV</span>
          </button>
          <button
            type="button"
            onClick={() => triggerCsvExport("runs")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#DEE0ED] bg-white text-xs font-bold text-[#252943] hover:border-[#3A4EFB] shadow-subtle"
          >
            <Download className="w-3.5 h-3.5 text-[#3A4EFB]" />
            <span>Export Runs CSV</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          SECTION: OVERVIEW CARDS (Change H.4)
      ====================================================================== */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <div className="p-3.5 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle">
            <span className="text-[10px] uppercase font-bold text-[#252943]/60 block mb-1">
              In Progress
            </span>
            <span className="text-xl font-black text-[#252943]">
              {overview.ordersInProgress}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle">
            <span className="text-[10px] uppercase font-bold text-[#252943]/60 block mb-1">
              On-Track Rate
            </span>
            <span className="text-xl font-black text-emerald-600">
              {overview.onTrackPercentage}%
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle">
            <span className="text-[10px] uppercase font-bold text-[#252943]/60 block mb-1">
              Delayed Orders
            </span>
            <span
              className={`text-xl font-black ${
                overview.delayedOrders > 0 ? "text-amber-600" : "text-[#252943]"
              }`}
            >
              {overview.delayedOrders}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle">
            <span className="text-[10px] uppercase font-bold text-[#252943]/60 block mb-1">
              Failed Orders
            </span>
            <span
              className={`text-xl font-black ${
                overview.failedOrders > 0 ? "text-rose-600" : "text-[#252943]"
              }`}
            >
              {overview.failedOrders}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle">
            <span className="text-[10px] uppercase font-bold text-[#252943]/60 block mb-1">
              Runs Next 1h
            </span>
            <span className="text-xl font-black text-[#3A4EFB]">
              {overview.runsDueNextHour}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle">
            <span className="text-[10px] uppercase font-bold text-[#252943]/60 block mb-1">
              Open Alerts
            </span>
            <span
              className={`text-xl font-black ${
                overview.openAlertsCount > 0 ? "text-rose-600" : "text-emerald-600"
              }`}
            >
              {overview.openAlertsCount}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle">
            <span className="text-[10px] uppercase font-bold text-[#252943]/60 block mb-1">
              Providers Health
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {((overview as any).providersHealth || (overview as any).providerHealth || []).map((p: any) => {
                const health = (p.health || p.status || "up").toLowerCase();
                const displayName = p.name || "Provider";
                return (
                  <span
                    key={p.id || displayName}
                    title={`${displayName}: ${health.toUpperCase()} (${
                      p.balance !== null && p.balance !== undefined
                        ? formatProviderBalance(p.balance, p.currency || "USD")
                        : "No bal"
                    })`}
                    className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      health === "up"
                        ? "bg-emerald-100 text-emerald-800"
                        : health === "slow"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {displayName.slice(0, 5)}: {health}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 1: ORDERS TABLE & FILTERS
      ====================================================================== */}
      {subTab === "orders" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white rounded-2xl border border-[#DEE0ED] p-4 shadow-subtle space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#252943]/40 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Order ID, User or Link..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl pl-8 pr-3 py-2 text-xs font-semibold text-[#252943] outline-none focus:border-[#3A4EFB]"
                />
              </div>

              {/* Status */}
              <div>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2 text-xs font-bold text-[#252943] outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>

              {/* Platform */}
              <div>
                <select
                  value={filterPlatform}
                  onChange={(e) => {
                    setFilterPlatform(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2 text-xs font-bold text-[#252943] outline-none"
                >
                  <option value="all">All Platforms</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="youtube">YouTube</option>
                  <option value="twitter">X / Twitter</option>
                  <option value="facebook">Facebook</option>
                </select>
              </div>

              {/* Provider */}
              <div>
                <select
                  value={filterProvider}
                  onChange={(e) => {
                    setFilterProvider(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2 text-xs font-bold text-[#252943] outline-none"
                >
                  <option value="all">All Providers</option>
                  {overview?.providersHealth?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div>
                <select
                  value={filterDateRange}
                  onChange={(e) => {
                    setFilterDateRange(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2 text-xs font-bold text-[#252943] outline-none"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>
            </div>

            {/* Checkbox Toggles & Results Counter */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[#DEE0ED]/60 text-xs">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-[#252943]">
                  <input
                    type="checkbox"
                    checked={onlyDelayed}
                    onChange={(e) => {
                      setOnlyDelayed(e.target.checked);
                      setPage(1);
                    }}
                    className="rounded border-[#DEE0ED] text-[#3A4EFB] focus:ring-0"
                  />
                  <span>Only Delayed Orders</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-[#252943]">
                  <input
                    type="checkbox"
                    checked={onlyFailed}
                    onChange={(e) => {
                      setOnlyFailed(e.target.checked);
                      setPage(1);
                    }}
                    className="rounded border-[#DEE0ED] text-rose-600 focus:ring-0"
                  />
                  <span>Only Failed Orders</span>
                </label>
              </div>

              <div className="flex items-center gap-3 text-[#252943]/60">
                <span>
                  Showing {orders.length} of {totalCount} orders
                </span>
                <button
                  type="button"
                  onClick={loadOrders}
                  disabled={loadingOrders}
                  className="p-1 rounded-lg hover:bg-gray-100 text-[#3A4EFB]"
                  title="Refresh orders"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Orders Table (Server-side paginated) */}
          <div className="bg-white rounded-3xl border border-[#DEE0ED] shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FD] text-[#252943]/70 font-bold border-b border-[#DEE0ED]">
                  <tr>
                    <th className="py-3 px-3.5">Order ID</th>
                    <th className="py-3 px-3.5">User</th>
                    <th className="py-3 px-3.5">Platform</th>
                    <th className="py-3 px-3.5">Created</th>
                    <th className="py-3 px-3.5">Status</th>
                    <th className="py-3 px-3.5">Total Price</th>
                    <th className="py-3 px-3.5">Progress</th>
                    <th className="py-3 px-3.5">Deviation</th>
                    <th className="py-3 px-3.5">Delay Status</th>
                    <th className="py-3 px-3.5">Provider(s)</th>
                    <th className="py-3 px-3.5 text-center">Alerts</th>
                    <th className="py-3 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DEE0ED]">
                  {loadingOrders && orders.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-[#252943]/60">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#3A4EFB] mb-2" />
                        Loading orders...
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-[#252943]/60">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                        No orders match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order: any) => {
                      const username = order.username || order.user || "Guest";
                      const totalPrice = typeof order.totalPrice === "number" ? order.totalPrice : (typeof order.totalCost === "number" ? order.totalCost : 0);
                      const progressPct = typeof order.progressPct === "number" ? order.progressPct : 0;
                      const completedRuns = order.completedRuns ?? 0;
                      const totalRuns = order.totalRuns ?? order.runsCount ?? 0;
                      const overallDeviationPct = order.overallDeviationPct ?? 0;
                      const delayStatus = order.delayStatus || order.delayChip || "On time";
                      const providersList = Array.isArray(order.providers) ? order.providers : [];
                      const createdDate = order.createdAt ? new Date(order.createdAt) : new Date();

                      return (
                        <tr
                          key={order.id}
                          onClick={() => openOrderModal(order.id)}
                          className="hover:bg-[#F8F9FD]/60 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-3.5 font-mono font-bold text-[#3A4EFB]">
                            {order.orderRef}
                          </td>
                          <td className="py-3 px-3.5 font-semibold text-[#252943]">
                            <div>{username}</div>
                            {order.userRole && (
                              <span className="text-[10px] text-[#252943]/40 font-mono">
                                {order.userRole}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 font-semibold text-[#252943] capitalize">
                            {order.platform || "Platform"}
                          </td>
                          <td className="py-3 px-3.5 text-[11px] text-[#252943]/70 whitespace-nowrap">
                            {createdDate.toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3 px-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                order.status === "COMPLETED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : order.status === "PROCESSING"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {order.status || "PENDING"}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 font-bold text-[#252943]">
                            ₹{totalPrice.toFixed(2)}
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="w-20 bg-gray-200 rounded-full h-1.5 overflow-hidden mb-1">
                              <div
                                className="bg-[#3A4EFB] h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-[#252943]/70">
                              {progressPct}% ({completedRuns}/{totalRuns})
                            </span>
                          </td>
                          <td className="py-3 px-3.5 font-mono font-bold">
                            <span
                              className={
                                overallDeviationPct < 0
                                  ? "text-amber-600"
                                  : overallDeviationPct > 0
                                  ? "text-blue-600"
                                  : "text-emerald-600"
                              }
                            >
                              {overallDeviationPct > 0 ? "+" : ""}
                              {overallDeviationPct}%
                            </span>
                          </td>
                          <td className="py-3 px-3.5">{getDelayChip(delayStatus)}</td>
                          <td className="py-3 px-3.5 text-[11px] font-medium text-[#252943]/80">
                            {providersList.length > 0 ? providersList.join(", ") : "Default"}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            {(order.openAlertsCount || 0) > 0 ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                                {order.openAlertsCount}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => openOrderModal(order.id)}
                              className="px-2.5 py-1 rounded-lg bg-[#3A4EFB]/10 hover:bg-[#3A4EFB] hover:text-white text-[#3A4EFB] text-[11px] font-bold transition-all"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3.5 border-t border-[#DEE0ED] flex items-center justify-between text-xs text-[#252943]/70">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(parseInt(e.target.value, 10));
                    setPage(1);
                  }}
                  className="bg-[#F8F9FD] border border-[#DEE0ED] rounded-lg px-2 py-1 font-bold text-[#252943]"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span>
                  Page {page} of {Math.max(1, totalPages)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page <= 1 || loadingOrders}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-[#DEE0ED] hover:bg-gray-100 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages || loadingOrders}
                    onClick={() => setPage((p) => p + 1)}
                    className="p-1.5 rounded-lg border border-[#DEE0ED] hover:bg-gray-100 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 2: DELIVERY SPEED REPORT (Change H.3)
      ====================================================================== */}
      {subTab === "delivery_speed" && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-[#DEE0ED] p-5 shadow-subtle space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-[#252943] flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-500" />
                  Delivery Speed & Provider Bottlenecks
                </h3>
                <p className="text-xs text-[#252943]/60">
                  Real-time p95 lateness, start-delays, and auto-flagging of slow services
                </p>
              </div>

              {/* Threshold and Window Controls */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="flex items-center gap-1.5 bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-2.5 py-1">
                  <span className="text-[#252943]/60 font-semibold">Period:</span>
                  {(["24h", "7d", "30d"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSpeedPeriod(p)}
                      className={`px-2 py-0.5 rounded-lg font-bold ${
                        speedPeriod === p
                          ? "bg-[#252943] text-white"
                          : "text-[#252943]/70 hover:text-[#252943]"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-2.5 py-1">
                  <span className="text-[#252943]/60 font-semibold">Slow P95 Limit:</span>
                  <input
                    type="number"
                    value={slowP95ThresholdSecs}
                    onChange={(e) => setSlowP95ThresholdSecs(parseInt(e.target.value, 10) || 300)}
                    className="w-16 bg-white border border-[#DEE0ED] rounded px-1.5 py-0.5 font-bold text-center"
                  />
                  <span className="text-[#252943]/60">s</span>
                </div>

                <button
                  type="button"
                  onClick={loadDeliverySpeed}
                  disabled={loadingSpeed}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#3A4EFB] text-white font-bold hover:bg-[#2A3DE0]"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingSpeed ? "animate-spin" : ""}`} />
                  <span>Re-analyze</span>
                </button>
              </div>
            </div>

            {/* Delivery Speed Ranked Table */}
            <div className="overflow-x-auto rounded-2xl border border-[#DEE0ED]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FD] text-[#252943]/70 font-bold border-b border-[#DEE0ED]">
                  <tr>
                    <th className="py-2.5 px-3">Service / Provider</th>
                    <th className="py-2.5 px-3">Runs Sent</th>
                    <th className="py-2.5 px-3">% On-Time</th>
                    <th className="py-2.5 px-3">Avg Latency</th>
                    <th className="py-2.5 px-3">p95 Latency</th>
                    <th className="py-2.5 px-3">Avg Start-Time</th>
                    <th className="py-2.5 px-3">p95 Start-Time</th>
                    <th className="py-2.5 px-3">Failure Rate</th>
                    <th className="py-2.5 px-3">Instant Delivery (&lt;{instantThresholdMins}m)</th>
                    <th className="py-2.5 px-3">Speed Status</th>
                    <th className="py-2.5 px-3 text-right">Drill-down</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DEE0ED]">
                  {loadingSpeed ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-[#252943]/60">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#3A4EFB] mb-1" />
                        Calculating provider speed metrics...
                      </td>
                    </tr>
                  ) : !speedData || speedData.services?.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-[#252943]/60">
                        No delivery runs recorded in the selected period.
                      </td>
                    </tr>
                  ) : (
                    speedData.services.map((item: any) => {
                      const statusColor =
                        item.statusChip === "Fast"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : item.statusChip === "OK"
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : item.statusChip === "Slow"
                          ? "bg-amber-100 text-amber-800 border-amber-200"
                          : "bg-rose-100 text-rose-800 border-rose-200";

                      return (
                        <tr key={item.key} className="hover:bg-[#F8F9FD]/60">
                          <td className="py-2.5 px-3 font-semibold text-[#252943]">
                            <div>{item.serviceName}</div>
                            <span className="text-[10px] text-[#252943]/50 block">
                              {item.providerName} • ID #{item.serviceId}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold">{item.runsSent}</td>
                          <td className="py-2.5 px-3 font-bold text-emerald-600">
                            {item.onTimeRate}%
                          </td>
                          <td className="py-2.5 px-3 font-mono">{item.avgLatenessSeconds}s</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[#252943]">
                            {item.p95LatenessSeconds}s
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {Math.round(item.avgTimeToStartMs / 1000)}s
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                            {Math.round(item.p95TimeToStartMs / 1000)}s
                          </td>
                          <td className="py-2.5 px-3 font-bold">
                            <span className={item.failureRate > 5 ? "text-rose-600" : "text-gray-600"}>
                              {item.failureRate}%
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-emerald-700">
                            {item.instantScore}%
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${statusColor}`}
                            >
                              {item.statusChip}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedServiceDrilldown(item)}
                              className="px-2 py-1 rounded-lg border border-[#DEE0ED] text-[10px] font-bold text-[#3A4EFB] hover:bg-[#3A4EFB]/10"
                            >
                              Slowest Runs
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          DRILLDOWN MODAL: SLOWEST RUNS FOR A SERVICE
      ====================================================================== */}
      {selectedServiceDrilldown && (
        <div className="fixed inset-0 z-50 bg-[#252943]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#DEE0ED] max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
              <div>
                <h3 className="text-base font-bold text-[#252943]">
                  Slowest Runs: {selectedServiceDrilldown.serviceName}
                </h3>
                <p className="text-xs text-[#252943]/60">
                  {selectedServiceDrilldown.providerName} (ID: {selectedServiceDrilldown.serviceId})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedServiceDrilldown(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#DEE0ED]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FD] text-[#252943]/70 font-bold border-b border-[#DEE0ED]">
                  <tr>
                    <th className="py-2 px-3">Run ID</th>
                    <th className="py-2 px-3">Scheduled</th>
                    <th className="py-2 px-3">Lateness</th>
                    <th className="py-2 px-3">Start Time</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DEE0ED]">
                  {(selectedServiceDrilldown.slowestRecentRuns || []).map((r: any) => (
                    <tr key={r.id}>
                      <td className="py-2 px-3 font-mono text-[11px] font-bold text-[#3A4EFB]">
                        #{r.id.slice(-6)}
                      </td>
                      <td className="py-2 px-3 text-[11px] text-[#252943]/70">
                        {new Date(r.scheduledAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-amber-600">
                        {r.latenessSeconds}s
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-indigo-600">
                        {Math.round((r.timeToStartMs || 0) / 1000)}s
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-800">
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedServiceDrilldown(null);
                            openOrderModal(r.engagementOrderId);
                          }}
                          className="text-[10px] text-[#3A4EFB] font-bold hover:underline"
                        >
                          View Order
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedServiceDrilldown(null)}
                className="px-4 py-2 rounded-xl bg-[#252943] text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ADMIN ORDER DETAIL MODAL (Change H.2)
      ====================================================================== */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-50 bg-[#252943]/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-[#DEE0ED] max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl animate-scaleUp overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#DEE0ED] flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[#252943] text-[#E3FF3B]">
                  ADMIN ORDER DETAIL
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-[#252943]">
                  {detailData?.order?.orderRef || "Loading Order..."}
                </h3>
                {detailData?.order && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                      detailData.order.status === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {detailData.order.status}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadOrderDetail(selectedOrderId)}
                  disabled={loadingDetail}
                  className="p-1.5 rounded-lg border border-[#DEE0ED] hover:bg-gray-100 text-[#3A4EFB]"
                  title="Reload order detail"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingDetail ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={closeOrderModal}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content Scrollable Area */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {loadingDetail && !detailData ? (
                <div className="py-20 text-center text-[#252943]/60">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#3A4EFB] mb-2" />
                  Loading full order analytics, delivery curves and runs...
                </div>
              ) : detailData ? (
                <>
                  {/* Action Feedback Banner */}
                  {actionFeedback && (
                    <div
                      className={`p-3 rounded-xl flex items-center justify-between font-semibold ${
                        actionFeedback.type === "success"
                          ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                          : "bg-rose-50 text-rose-900 border border-rose-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {actionFeedback.type === "success" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span>{actionFeedback.text}</span>
                      </div>
                      <button
                        onClick={() => setActionFeedback(null)}
                        className="text-gray-400 hover:text-gray-600 text-xs font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Admin Order Actions Bar */}
                  <div className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#252943]">Admin Operations:</span>
                      <span className="text-[11px] text-[#252943]/60">
                        Target:{" "}
                        <a
                          href={detailData.order.targetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#3A4EFB] underline font-semibold"
                        >
                          {detailData.order.targetUrl.slice(0, 32)}...
                        </a>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOrderAction("replan_remaining")}
                        disabled={actionLoading !== null}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#3A4EFB] text-white font-bold hover:bg-[#2A3DE0] disabled:opacity-50"
                      >
                        {actionLoading === "replan_remaining" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        <span>Re-plan Remaining</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOrderAction("refund_undelivered")}
                        disabled={actionLoading !== null}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 disabled:opacity-50"
                      >
                        {actionLoading === "refund_undelivered" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        <span>Refund Undelivered</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOrderAction("pause_order")}
                        disabled={actionLoading !== null}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#DEE0ED] bg-white text-[#252943] font-bold hover:bg-gray-50 disabled:opacity-50"
                      >
                        {actionLoading === "pause_order" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <PauseCircle className="w-3.5 h-3.5" />
                        )}
                        <span>Pause Order</span>
                      </button>
                    </div>
                  </div>

                  {/* Per-Type Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {(Object.keys(detailData.perTypeSummary || {}) as EngagementType[]).map((t) => {
                      const summary = detailData.perTypeSummary[t];
                      return (
                        <div
                          key={t}
                          className="p-3 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold capitalize text-[#252943]">{t}</span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                summary.deviationPct < 0
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {summary.deviationPct > 0 ? "+" : ""}
                              {summary.deviationPct}%
                            </span>
                          </div>
                          <div className="text-base font-black text-[#252943]">
                            {summary.delivered.toLocaleString()}{" "}
                            <span className="text-xs text-[#252943]/40 font-normal">
                              / {summary.planned.toLocaleString()}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#252943]/60">
                            Avg Latency: <strong>{summary.averageLatenessSeconds}s</strong>
                          </div>
                          <div className="text-[10px] text-[#252943]/60">
                            Avg Start: <strong>{Math.round(summary.averageTimeToStartMs / 1000)}s</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Detail Subtabs Navigation */}
                  <div className="flex items-center gap-2 border-b border-[#DEE0ED] pb-px">
                    <button
                      type="button"
                      onClick={() => setDetailSubTab("cumulative")}
                      className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
                        detailSubTab === "cumulative"
                          ? "border-[#3A4EFB] text-[#3A4EFB] bg-[#3A4EFB]/5"
                          : "border-transparent text-[#252943]/60 hover:text-[#252943]"
                      }`}
                    >
                      Cumulative Curves (Dashed Expected vs Solid Delivered)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailSubTab("runs")}
                      className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
                        detailSubTab === "runs"
                          ? "border-[#3A4EFB] text-[#3A4EFB] bg-[#3A4EFB]/5"
                          : "border-transparent text-[#252943]/60 hover:text-[#252943]"
                      }`}
                    >
                      Runs Table ({detailData.runs?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailSubTab("timeline")}
                      className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
                        detailSubTab === "timeline"
                          ? "border-[#3A4EFB] text-[#3A4EFB] bg-[#3A4EFB]/5"
                          : "border-transparent text-[#252943]/60 hover:text-[#252943]"
                      }`}
                    >
                      Batch Timeline
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailSubTab("ratio")}
                      className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
                        detailSubTab === "ratio"
                          ? "border-[#3A4EFB] text-[#3A4EFB] bg-[#3A4EFB]/5"
                          : "border-transparent text-[#252943]/60 hover:text-[#252943]"
                      }`}
                    >
                      Ratio Over Time
                    </button>
                  </div>

                  {/* Subtab 1: Cumulative Curves (Same shared component) */}
                  {detailSubTab === "cumulative" && (
                    <div className="bg-white rounded-2xl border border-[#DEE0ED] p-4 shadow-subtle space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#252943]">
                          Delivery Progression (Real Hour X-Axis 0h - {detailData.durationHours}h)
                        </span>
                        <div className="flex items-center gap-3 text-[11px] text-[#252943]/70">
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-0.5 border-t-2 border-dashed border-[#3A4EFB]" />
                            <span>Expected Curve</span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-1 bg-[#3A4EFB] rounded-full" />
                            <span>Actual Delivered Curve</span>
                          </span>
                        </div>
                      </div>

                      <EngagementDetailChart
                        durationHours={detailData.durationHours}
                        expectedCurve={detailData.expectedCurve || []}
                        statusSamples={detailData.statusSamples || []}
                        runs={detailData.runs || []}
                        createdAt={detailData.order.createdAt}
                        visibleTypes={{
                          views: true,
                          likes: true,
                          saves: true,
                          shares: true,
                          comments: true,
                        }}
                        showDelivered={true}
                        showNowMarker={true}
                        height={320}
                      />
                    </div>
                  )}

                  {/* Subtab 2: Detailed Runs Table */}
                  {detailSubTab === "runs" && (
                    <div className="bg-white rounded-2xl border border-[#DEE0ED] shadow-subtle overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#F8F9FD] text-[#252943]/70 font-bold border-b border-[#DEE0ED]">
                            <tr>
                              <th className="py-2.5 px-3">Run #</th>
                              <th className="py-2.5 px-3">Type</th>
                              <th className="py-2.5 px-3">Provider</th>
                              <th className="py-2.5 px-3">Provider Service</th>
                              <th className="py-2.5 px-3">Planned Time</th>
                              <th className="py-2.5 px-3">Sent Time</th>
                              <th className="py-2.5 px-3">Lateness</th>
                              <th className="py-2.5 px-3">Planned Qty</th>
                              <th className="py-2.5 px-3">Delivered Qty</th>
                              <th className="py-2.5 px-3">Time-to-Confirm</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3">Attempts</th>
                              <th className="py-2.5 px-3">Last Error</th>
                              <th className="py-2.5 px-3">Provider Order ID</th>
                              <th className="py-2.5 px-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#DEE0ED]">
                            {(detailData.runs || []).map((run: any) => (
                              <tr key={run.id} className="hover:bg-[#F8F9FD]/50">
                                <td className="py-2.5 px-3 font-mono font-bold text-[#3A4EFB]">
                                  #{run.runNumber}
                                </td>
                                <td className="py-2.5 px-3 font-bold capitalize text-[#252943]">
                                  {run.engagementType}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-[#252943]">
                                  {run.provider}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px] text-[#252943]/70">
                                  {run.providerServiceId}
                                </td>
                                <td className="py-2.5 px-3 text-[11px] text-[#252943]/70 whitespace-nowrap">
                                  {new Date(run.scheduledAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </td>
                                <td className="py-2.5 px-3 text-[11px] text-[#252943]/70 whitespace-nowrap">
                                  {run.sentAt
                                    ? new Date(run.sentAt).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : "—"}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-amber-600">
                                  {run.latenessSeconds > 0 ? `${run.latenessSeconds}s` : "0s"}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-[#252943]">
                                  {run.plannedQuantity}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-emerald-600">
                                  {run.deliveredQuantity}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[#252943]/70">
                                  {run.timeToConfirmMs
                                    ? `${Math.round(run.timeToConfirmMs / 1000)}s`
                                    : "—"}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      run.status === "confirmed" || run.status === "completed"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : run.status === "delayed"
                                        ? "bg-amber-100 text-amber-800"
                                        : run.status === "failed"
                                        ? "bg-rose-100 text-rose-800"
                                        : "bg-blue-100 text-blue-800"
                                    }`}
                                  >
                                    {run.status}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-bold text-center">
                                  {run.attempts}
                                </td>
                                <td className="py-2.5 px-3 max-w-xs truncate" title={run.lastError}>
                                  {run.lastError ? (
                                    <span className="text-rose-600 font-semibold">{run.lastError}</span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px]">
                                  {run.providerOrderId || "—"}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {run.status !== "confirmed" && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOrderAction("retry_run", { runId: run.id })
                                      }
                                      disabled={actionLoading === "retry_run"}
                                      className="px-2 py-1 rounded bg-[#3A4EFB] text-white text-[10px] font-bold hover:bg-[#2A3DE0]"
                                    >
                                      Retry
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Subtab 3: Batch Timeline */}
                  {detailSubTab === "timeline" && (
                    <div className="bg-white rounded-2xl border border-[#DEE0ED] p-4 shadow-subtle space-y-3">
                      <span className="font-bold text-[#252943]">Chronological Batch Timeline</span>
                      <div className="space-y-2">
                        {(detailData.runs || []).map((run: any) => (
                          <div
                            key={run.id}
                            className="p-2.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-[#3A4EFB]">
                                Run #{run.runNumber}
                              </span>
                              <span className="font-bold capitalize text-[#252943]">
                                {run.engagementType}
                              </span>
                              <span className="text-[11px] text-[#252943]/60">
                                Scheduled: {new Date(run.scheduledAt).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold">{run.plannedQuantity} items</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  run.status === "confirmed"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-gray-200 text-gray-800"
                                }`}
                              >
                                {run.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Subtab 4: Ratio Over Time */}
                  {detailSubTab === "ratio" && (
                    <div className="bg-white rounded-2xl border border-[#DEE0ED] p-4 shadow-subtle space-y-3">
                      <span className="font-bold text-[#252943]">Engagement Ratio Balance</span>
                      <p className="text-xs text-[#252943]/60">
                        Tracks relative proportions of likes, saves, shares and comments relative to views.
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                        {["likes", "saves", "shares", "comments"].map((type) => {
                          const viewsDelivered = detailData.perTypeSummary?.views?.delivered || 1;
                          const typeDelivered = detailData.perTypeSummary?.[type]?.delivered || 0;
                          const ratioPct = ((typeDelivered / Math.max(1, viewsDelivered)) * 100).toFixed(2);
                          return (
                            <div key={type} className="p-3 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]">
                              <span className="text-[10px] uppercase font-bold text-[#252943]/60 capitalize block">
                                {type} : Views Ratio
                              </span>
                              <span className="text-lg font-black text-[#252943]">{ratioPct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Event Log & Plan History (Change H.2) */}
                  <div className="bg-white rounded-2xl border border-[#DEE0ED] p-4 shadow-subtle space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-[#252943]">
                        Order Event Log & Provider Calls ({detailData.eventLogs?.length || 0})
                      </h4>
                      <span className="text-[10px] text-[#252943]/50">
                        Sanitized against secrets & API keys
                      </span>
                    </div>

                    <div className="max-h-60 overflow-y-auto rounded-xl border border-[#DEE0ED] divide-y divide-[#DEE0ED]">
                      {(detailData.eventLogs || []).length === 0 ? (
                        <div className="p-4 text-center text-[#252943]/50 text-xs">
                          No event logs recorded for this order.
                        </div>
                      ) : (
                        detailData.eventLogs.map((log: any) => (
                          <div key={log.id} className="p-2.5 text-xs hover:bg-[#F8F9FD]">
                            <div className="flex items-center justify-between font-semibold">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] text-[#252943]/50">
                                  {new Date(log.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  })}
                                </span>
                                <span className="font-bold text-[#252943] uppercase text-[10px] px-1.5 py-0.5 rounded bg-gray-100">
                                  {log.eventType}
                                </span>
                                <span>{log.summary}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {log.httpStatus && (
                                  <span className="font-mono font-bold text-[10px]">
                                    HTTP {log.httpStatus}
                                  </span>
                                )}
                                {log.durationMs && (
                                  <span className="font-mono text-[10px] text-gray-500">
                                    {log.durationMs}ms
                                  </span>
                                )}
                              </div>
                            </div>
                            {log.details && (
                              <pre className="mt-1 p-2 rounded bg-gray-50 text-[10px] font-mono text-[#252943]/80 overflow-x-auto">
                                {typeof log.details === "string"
                                  ? log.details
                                  : JSON.stringify(log.details, null, 2)}
                              </pre>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-[#DEE0ED] bg-gray-50 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-[#252943]/60">
                AuraSMM Superadmin Console • Real-time Order Monitoring
              </span>
              <button
                type="button"
                onClick={closeOrderModal}
                className="px-4 py-2 rounded-xl bg-[#252943] text-white text-xs font-bold hover:bg-[#1A1D31]"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Layers, 
  Search, 
  ChevronRight, 
  TrendingUp, 
  Loader2,
  RefreshCw
} from "lucide-react";

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
  service: {
    name: string;
    platform: string;
    ratePer1000: number;
  };
  steps?: Array<{
    id: string;
    stepNumber: number;
    quantity: number;
    status: string;
  }>;
}

const STATUS_TABS = [
  "ALL",
  "SCHEDULED",
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
  "REQUIRES_RECONCILIATION",
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, page: 1 });
  const [counts, setCounts] = useState<Record<string, number>>({});

  async function fetchOrders() {
    setLoading(true);
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
      }
    } catch (err) {
      console.error("Failed to load orders", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();
  }, [activeTab, page]);

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
              Live progress tracking, provider order references, and scheduled delivery status.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchOrders}
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
                  <span>{tab === "ALL" ? "All Orders" : tab.replace("_", " ")}</span>
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
        {loading ? (
          <div className="py-16 flex items-center justify-center text-xs text-[#252943]/60 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#3A4EFB]" />
            <span>Loading order history...</span>
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
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#F8F9FD]/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-[#252943]">
                      <Link href={`/orders/${order.id}`} className="hover:text-[#3A4EFB]">
                        {order.orderRef}
                      </Link>
                      <div className="text-[10px] text-[#252943]/50 font-normal">
                        {new Date(order.createdAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 max-w-[220px]">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#DEE0ED]/60 text-[#252943] mr-1.5">
                        {order.service.platform}
                      </span>
                      <span className="font-semibold text-[#252943] truncate block mt-0.5">
                        {order.service.name}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 max-w-[180px] truncate font-normal text-[#252943]/80">
                      {order.targetUrl}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {order.scheduleMode === "ADAPTIVE" ? (
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
                        <>
                          <div className="font-bold text-[#252943]">
                            {order.deliveredQuantity.toLocaleString()} / {order.requestedQuantity.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-[#252943]/60 font-medium">
                            {Math.round((order.deliveredQuantity / (order.requestedQuantity || 1)) * 100)}% delivered
                          </div>
                        </>
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
                      {order.isScheduled ? (
                        <div className="inline-flex items-center gap-1 text-[11px] font-medium text-[#252943] bg-[#DEE0ED]/60 px-2 py-0.5 rounded-full">
                          <TrendingUp className="w-3 h-3 text-[#3A4EFB]" />
                          <span>
                            {order.scheduleMode === "ADAPTIVE"
                              ? `Likes Analyze · ${order.steps?.length || 0} ${order.steps?.length === 1 ? "batch" : "batches"}`
                              : `${order.scheduleMode || "Drip"} (${order.steps?.length || 0} steps)`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#252943]/70">Instant</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <StatusBadge
                        status={order.status}
                        label={order.scheduleMode === "ADAPTIVE" && order.status === "SCHEDULED" ? "Monitoring" : undefined}
                      />
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/orders/${order.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#3A4EFB] hover:text-[#2C3FE0]"
                      >
                        Inspect <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
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

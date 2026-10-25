"use client";

import { useState, useEffect } from "react";
import { 
  Layers, 
  RefreshCw, 
  TrendingUp, 
  Eye, 
  Heart, 
  Share2, 
  Bookmark, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  XCircle, 
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Info
} from "lucide-react";
import Link from "next/link";

interface OrderBreakdownItem {
  planned: number;
  delivered: number;
}

interface OrderRecentRun {
  id: string;
  type: string;
  quantity: number;
  scheduledAt: string;
  status: string;
  attempts: number;
}

interface EngagementOrderItem {
  id: string;
  orderRef: string;
  targetUrl: string;
  platform: string;
  profileId?: string;
  presetKey?: string;
  baseViews: number;
  durationHours: number;
  status: string;
  totalCost: number;
  refundedAmount: number;
  remainingRefundableCost?: number;
  cancellableRunsCount?: number;
  progressPercent: number;
  nextRunTime: string | null;
  estimatedFinishTime?: string;
  enabledTypes?: string[];
  sources?: {
    views: string;
    likes: string;
    saves: string;
    shares: string;
    comments: string;
  };
  breakdown: {
    views: OrderBreakdownItem;
    likes: OrderBreakdownItem;
    shares: OrderBreakdownItem;
    saves: OrderBreakdownItem;
    comments: OrderBreakdownItem;
  };
  runsCount: number;
  completedRuns: number;
  recentRuns?: OrderRecentRun[];
  createdAt: string;
}

export default function EngagementOrdersPage() {
  const [orders, setOrders] = useState<EngagementOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedTimelines, setExpandedTimelines] = useState<Record<string, boolean>>({});

  async function loadOrders() {
    try {
      const res = await fetch("/api/engagement/orders");
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error("Failed to load engagement orders", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  const toggleTimeline = (orderId: string) => {
    setExpandedTimelines((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  async function handleCancelOrder(orderId: string, orderRef: string, refundableCost?: number) {
    const refundFormatted = (refundableCost ?? 0).toFixed(2);
    const confirmMessage = `Cancel remaining runs for ${orderRef}? ₹${refundFormatted} will be immediately refunded to your wallet.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setCancellingId(orderId);
    setActionError(null);
    try {
      const res = await fetch(`/api/engagement/orders/${orderId}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to cancel order");
      }

      setActionSuccess(data.message || `Order ${orderRef} cancelled. Refunded to wallet.`);
      setTimeout(() => setActionSuccess(null), 4000);
      await loadOrders();
    } catch (err: any) {
      setActionError(err.message || "Failed to cancel order");
    } finally {
      setCancellingId(null);
    }
  }

  const getFriendlyStatus = (order: EngagementOrderItem) => {
    if (order.status === "COMPLETED") {
      return {
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
        message: "Delivery complete: all batches finished naturally.",
      };
    }
    if (order.status === "CANCELLED") {
      return {
        badge: "bg-slate-100 text-slate-700 border-slate-200",
        message: `Order cancelled. ₹${order.refundedAmount.toFixed(2)} refunded to wallet.`,
      };
    }
    // Processing / Active states
    const hasDelayedRun = order.recentRuns?.some((r) => r.status === "delayed");
    if (hasDelayedRun) {
      return {
        badge: "bg-amber-50 text-amber-700 border-amber-200",
        message: "Small delay on our side, we are fixing it. You don't need to do anything.",
      };
    }
    if (order.completedRuns === 0) {
      return {
        badge: "bg-blue-50 text-blue-700 border-blue-200",
        message: "Your order is scheduled. First delivery starts in about 5 minutes.",
      };
    }
    return {
      badge: "bg-blue-50 text-blue-700 border-blue-200",
      message: `Delivering: ${order.progressPercent}% done`,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-2 text-sm text-[#252943]/60">
          <Loader2 className="w-5 h-5 animate-spin text-[#3A4EFB]" />
          <span>Loading natural-looking delivery campaigns...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-16">
      {/* Top Reassurance Banner */}
      <div className="p-3.5 rounded-2xl bg-[#F0F3FF] border border-[#3A4EFB]/20 flex items-center gap-2 text-xs text-[#252943] shadow-subtle">
        <ShieldCheck className="w-4 h-4 text-[#3A4EFB] shrink-0" />
        <span className="font-medium">
          <strong>Calm guarantee:</strong> Nothing is charged until you confirm. You can cancel anytime, and unsent batches are refunded immediately to your wallet.
        </span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DEE0ED]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#252943] flex items-center gap-2">
            <Layers className="w-6 h-6 text-[#3A4EFB]" />
            Full Engagement Delivery Orders
          </h1>
          <p className="text-xs text-[#252943]/60 mt-0.5">
            Monitor real-time natural-looking delivery across Views, Likes, Shares, Saves, and Comments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadOrders}
            className="p-2 rounded-xl border border-[#DEE0ED] text-xs font-semibold text-[#252943]/80 hover:bg-[#F8F9FD] flex items-center gap-1.5"
            title="Refresh order progress"
          >
            <RefreshCw className="w-4 h-4 text-[#3A4EFB]" />
          </button>
          <Link
            href="/engagement"
            className="px-4 py-2 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-xs font-bold transition-all press-scale flex items-center gap-1.5 shadow-subtle"
          >
            <TrendingUp className="w-4 h-4 text-[#E3FF3B]" />
            <span>New Campaign</span>
          </Link>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-[#DEE0ED] shadow-subtle space-y-3">
          <Layers className="w-10 h-10 text-[#3A4EFB]/40 mx-auto" />
          <h3 className="text-sm font-bold text-[#252943]">No Full Engagement Orders Yet</h3>
          <p className="text-xs text-[#252943]/60 max-w-sm mx-auto">
            Launch your first campaign with natural-looking S-curve delivery across all engagement types.
          </p>
          <Link
            href="/engagement"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3A4EFB] text-white text-xs font-bold hover:bg-[#2C3FE0]"
          >
            <TrendingUp className="w-4 h-4 text-[#E3FF3B]" />
            <span>Create Campaign</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isCancelling = cancellingId === order.id;
            const friendly = getFriendlyStatus(order);
            const refundable = order.remainingRefundableCost ?? Math.max(0, order.totalCost - (order.refundedAmount || 0));
            const canCancel = (order.cancellableRunsCount ?? 1) > 0 && order.status !== "COMPLETED" && order.status !== "CANCELLED";
            const isTimelineExpanded = !!expandedTimelines[order.id];

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-[#DEE0ED] p-6 shadow-subtle space-y-4 hover:border-[#3A4EFB]/40 transition-all"
              >
                {/* Order Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DEE0ED]/60">
                  <div className="space-y-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <Link
                        href={`/engagement/orders/${order.id}`}
                        className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-[#252943] text-white hover:bg-[#3A4EFB] transition-colors flex items-center gap-1"
                      >
                        <span>{order.orderRef}</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#3A4EFB]/10 text-[#3A4EFB]">
                        {order.platform.replace(/_/g, " ")}
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${friendly.badge}`}
                      >
                        {friendly.message}
                      </span>
                    </div>

                    <a
                      href={order.targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#252943]/70 hover:text-[#3A4EFB] flex items-center gap-1 truncate max-w-md"
                    >
                      <span>{order.targetUrl}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <div className="text-right">
                      <span className="text-xs font-bold text-[#252943] block">
                        ₹{order.totalCost.toFixed(2)}
                      </span>
                      {order.refundedAmount > 0 && (
                        <span className="text-[10px] text-emerald-600 font-semibold">
                          Refunded: ₹{order.refundedAmount.toFixed(2)}
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/engagement/orders/${order.id}`}
                      className="px-3 py-1.5 rounded-xl bg-[#3A4EFB] text-white hover:bg-[#2C3FE0] text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <span>Graph &amp; Runs</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>

                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => handleCancelOrder(order.id, order.orderRef, refundable)}
                        disabled={isCancelling}
                        className="px-3 py-1.5 rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors flex items-center gap-1 disabled:opacity-50"
                        title={`Cancel unsent runs and refund ₹${refundable.toFixed(2)}`}
                      >
                        {isCancelling ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        <span>Cancel (Refund ₹{refundable.toFixed(2)})</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar & Run Stats */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#252943]">
                      Delivery Progress ({order.completedRuns} of {order.runsCount} Batches Delivered)
                    </span>
                    <span className="font-bold text-[#3A4EFB]">{order.progressPercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#F8F9FD] rounded-full overflow-hidden border border-[#DEE0ED]">
                    <div
                      className="h-full bg-[#3A4EFB] rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(2, order.progressPercent))}%` }}
                    />
                  </div>
                </div>

                {/* Per-Type Progress Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                  {[
                    { type: "views", label: "Views", icon: Eye, color: "text-blue-600" },
                    { type: "likes", label: "Likes", icon: Heart, color: "text-rose-600" },
                    { type: "shares", label: "Shares", icon: Share2, color: "text-indigo-600" },
                    { type: "saves", label: "Saves", icon: Bookmark, color: "text-amber-600" },
                    { type: "comments", label: "Comments", icon: MessageSquare, color: "text-emerald-600" },
                  ].map((m) => {
                    const data = (order.breakdown as any)[m.type] as OrderBreakdownItem;
                    const Icon = m.icon;
                    const pct = data && data.planned > 0 ? Math.round((data.delivered / data.planned) * 100) : 0;
                    const isCustom = order.sources && (order.sources as any)[m.type] === "custom";

                    return (
                      <div key={m.type} className="p-3 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#252943] flex items-center gap-1">
                            <Icon className={`w-3 h-3 ${m.color}`} />
                            {m.label}
                          </span>
                          <div className="flex items-center gap-1">
                            {isCustom && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">
                                Custom
                              </span>
                            )}
                            <span className="text-[10px] font-semibold text-[#3A4EFB]">{pct}%</span>
                          </div>
                        </div>
                        <div className="text-xs font-black text-[#252943]">
                          {(data?.delivered || 0).toLocaleString()} / {(data?.planned || 0).toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Timeline / What's Next Accordion */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => toggleTimeline(order.id)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs font-semibold text-[#252943] hover:bg-[#F0F3FF] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-[#3A4EFB]" />
                      <span>
                        Timeline: {order.completedRuns} completed, {order.runsCount - order.completedRuns} remaining
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-[#3A4EFB]">
                      {isTimelineExpanded ? (
                        <>Hide details <ChevronUp className="w-3.5 h-3.5" /></>
                      ) : (
                        <>View timeline <ChevronDown className="w-3.5 h-3.5" /></>
                      )}
                    </span>
                  </button>

                  {isTimelineExpanded && order.recentRuns && (
                    <div className="mt-2 p-3 bg-[#FAFBFD] rounded-xl border border-[#DEE0ED] space-y-2 text-xs">
                      <div className="font-semibold text-[#252943] flex items-center justify-between">
                        <span>Upcoming & Recent Batches:</span>
                        {order.estimatedFinishTime && (
                          <span className="text-[11px] text-[#252943]/60">
                            Estimated finish: {new Date(order.estimatedFinishTime).toLocaleDateString()} {new Date(order.estimatedFinishTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {order.recentRuns.map((r, idx) => (
                          <div
                            key={r.id || idx}
                            className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#DEE0ED] text-[11px]"
                          >
                            <span className="font-medium text-[#252943] capitalize">
                              {r.type}: {r.quantity.toLocaleString()}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[#252943]/60">
                                {new Date(r.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full font-semibold uppercase text-[10px] ${
                                  r.status === "completed" || r.status === "sent"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : r.status === "delayed"
                                    ? "bg-amber-50 text-amber-700"
                                    : r.status === "failed"
                                    ? "bg-rose-50 text-rose-700"
                                    : "bg-blue-50 text-blue-700"
                                }`}
                              >
                                {r.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Bar: Next run time and timestamp */}
                <div className="pt-3 border-t border-[#DEE0ED]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[#252943]/60">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#3A4EFB]" />
                    <span>
                      {order.nextRunTime
                        ? `Next batch scheduled for: ${new Date(order.nextRunTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : order.status === "COMPLETED"
                        ? "All scheduled delivery runs completed naturally"
                        : "No further runs scheduled"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {order.estimatedFinishTime && order.status !== "COMPLETED" && (
                      <span>
                        Est. Finish: {new Date(order.estimatedFinishTime).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    <span>Placed: {new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

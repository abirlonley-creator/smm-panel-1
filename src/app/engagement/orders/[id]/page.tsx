"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp,
  ArrowLeft,
  RefreshCw,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Zap,
  RotateCcw,
  Sparkles,
  Eye,
  Heart,
  ChevronRight,
  ShieldAlert,
  XCircle,
  Info,
} from "lucide-react";
import { formatBdTime, formatBdDateTime } from "@/lib/date-bd";

interface EngagementRunItem {
  id: string;
  engagementType: "views" | "likes" | string;
  serviceName: string;
  providerServiceId: string;
  runNumber: number;
  scheduledAt: string;
  sentAt: string | null;
  quantity: number;
  plannedCumulative?: number;
  deliveredQuantity: number;
  deliveredCumulative?: number;
  status: string;
  providerOrderId?: string | null;
  latenessSeconds: number;
  isReplan: boolean;
  cost: number;
  errorMessage?: string | null;
}

interface EventLogItem {
  id: string;
  eventType: string;
  message: string;
  createdAt: string;
}

interface EngagementOrderDetail {
  id: string;
  orderRef: string;
  targetUrl: string;
  platform: string;
  presetKey: string;
  durationHours: number;
  status: string;
  deviationStatus: string;
  calmStatusText: string;
  totalCost: number;
  refundedAmount: number;
  createdAt: string;
  updatedAt: string;
  replanCount: number;
  lastReplanReason?: string | null;
  viewsSummary?: {
    planned: number;
    delivered: number;
    remaining: number;
    totalRuns: number;
    completedRuns: number;
    percent: number;
  };
  likesSummary?: {
    planned: number;
    delivered: number;
    remaining: number;
    totalRuns: number;
    completedRuns: number;
    percent: number;
  };
  completedRuns: number;
  totalRuns: number;
  progressPercent: number;
  nextRunTime: string | null;
  runs: EngagementRunItem[];
  eventLogs?: EventLogItem[];
  delayedLikesEvents?: EventLogItem[];
}

export default function EngagementOrderDetailPage() {
  const routerParams = useParams();
  const orderId = (typeof routerParams?.id === "string" ? routerParams.id : Array.isArray(routerParams?.id) ? routerParams.id[0] : "") || "";

  const [order, setOrder] = useState<EngagementOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "views" | "likes" | "timeline">("overview");
  const [retryingRunId, setRetryingRunId] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function fetchOrderDetail() {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/engagement/orders/${orderId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Network response was not ok");
      const data = await res.json();
      if (data.success && data.order) {
        setOrder(data.order);
      }
    } catch (err) {
      console.error("Failed to fetch engagement order", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrderDetail();
    // Auto-polling every 8 seconds for live progress
    const interval = setInterval(fetchOrderDetail, 8000);
    return () => clearInterval(interval);
  }, [orderId]);

  async function handleSyncWithProviders() {
    setSyncing(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/engagement/orders/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ text: data.message || "Synchronized with upstream providers.", type: "success" });
        await fetchOrderDetail();
      } else {
        setActionMsg({ text: data.error || "Failed to sync order.", type: "error" });
      }
    } catch (err: any) {
      setActionMsg({ text: err.message || "Sync failed", type: "error" });
    } finally {
      setSyncing(false);
    }
  }

  async function handleRetryRun(runId: string) {
    setRetryingRunId(runId);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/engagement/orders/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry_run", runId }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ text: data.message, type: "success" });
        await fetchOrderDetail();
      } else {
        setActionMsg({ text: data.error || "Failed to retry run.", type: "error" });
      }
    } catch (err: any) {
      setActionMsg({ text: err.message || "Retry failed", type: "error" });
    } finally {
      setRetryingRunId(null);
    }
  }

  async function handleRetryAllFailed() {
    setRetryingAll(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/engagement/orders/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry_all_failed" }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ text: data.message, type: "success" });
        await fetchOrderDetail();
      } else {
        setActionMsg({ text: data.error || "Failed to retry all runs.", type: "error" });
      }
    } catch (err: any) {
      setActionMsg({ text: err.message || "Retry all failed", type: "error" });
    } finally {
      setRetryingAll(false);
    }
  }

  async function handleCancelOrder() {
    if (!confirm("Are you sure you want to cancel the remaining batches of this engagement order? Undelivered runs will be refunded to your wallet.")) {
      return;
    }
    setCancelling(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/engagement/orders/${orderId}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg({
          text: `Order cancelled. ₹${data.refundAmount?.toFixed(2) || "0.00"} was refunded to your wallet.`,
          type: "success",
        });
        await fetchOrderDetail();
      } else {
        setActionMsg({ text: data.error || "Failed to cancel order.", type: "error" });
      }
    } catch (err: any) {
      setActionMsg({ text: err.message || "Cancellation error", type: "error" });
    } finally {
      setCancelling(false);
    }
  }

  if (loading && !order) {
    return (
      <div className="max-w-6xl mx-auto py-20 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-[#3A4EFB] animate-spin mx-auto" />
        <p className="text-xs font-bold text-[#252943]/60">Loading live engagement telemetry...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-[#252943]">Engagement Order Not Found</h2>
        <p className="text-xs text-[#252943]/60">
          The requested TikTok engagement delivery could not be found or you do not have permission.
        </p>
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3A4EFB] text-white text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Orders
        </Link>
      </div>
    );
  }

  const allRuns = Array.isArray(order?.runs) ? order.runs : [];
  const viewsRuns = allRuns.filter((r) => r.engagementType === "views");
  const likesRuns = allRuns.filter((r) => r.engagementType === "likes");

  const viewsSummary = order.viewsSummary || {
    planned: viewsRuns.reduce((sum, r) => sum + (r.quantity || 0), 0),
    delivered: viewsRuns.reduce((sum, r) => sum + (r.deliveredQuantity || 0), 0),
    remaining: Math.max(0, viewsRuns.reduce((sum, r) => sum + (r.quantity || 0), 0) - viewsRuns.reduce((sum, r) => sum + (r.deliveredQuantity || 0), 0)),
    totalRuns: viewsRuns.length,
    completedRuns: viewsRuns.filter((r) => r.status === "completed" || r.status === "confirmed").length,
    percent: 0,
  };

  const likesSummary = order.likesSummary || {
    planned: likesRuns.reduce((sum, r) => sum + (r.quantity || 0), 0),
    delivered: likesRuns.reduce((sum, r) => sum + (r.deliveredQuantity || 0), 0),
    remaining: Math.max(0, likesRuns.reduce((sum, r) => sum + (r.quantity || 0), 0) - likesRuns.reduce((sum, r) => sum + (r.deliveredQuantity || 0), 0)),
    totalRuns: likesRuns.length,
    completedRuns: likesRuns.filter((r) => r.status === "completed" || r.status === "confirmed").length,
    percent: 0,
  };

  const delayedLikesEvents = Array.isArray(order.delayedLikesEvents) ? order.delayedLikesEvents : [];
  const hasDelayedLikesProtectionTriggered = delayedLikesEvents.length > 0;
  const failedRuns = allRuns.filter((r) => r.status === "failed");
  const hasFailedRuns = failedRuns.length > 0;

  // Status badge styling
  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    COMPLETED: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    PROCESSING: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    SCHEDULED: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
    PARTIAL: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
    FAILED: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
    CANCELLED: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300" },
  };
  const activeStatusStyle = statusColors[order.status] || {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  };

  const isCompleted = order.status === "COMPLETED";
  const isCancelled = order.status === "CANCELLED";

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6 animate-fadeIn">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-[#252943]/50">
        <Link href="/orders" className="hover:text-[#3A4EFB] transition-colors">
          Orders
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/engagement" className="hover:text-[#3A4EFB] transition-colors">
          Engagement
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="font-mono font-bold text-[#252943]">{order.orderRef}</span>
      </div>

      {/* Main Order Header Banner */}
      <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#DEE0ED]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-[#252943] font-mono tracking-tight">
                {order.orderRef}
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${activeStatusStyle.bg} ${activeStatusStyle.text} ${activeStatusStyle.border}`}>
                {order.status}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E3FF3B]/30 border border-[#252943]/20 text-[#252943] text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-[#3A4EFB]" />
                {order.presetKey}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#252943]/60">Target:</span>
              <a
                href={order.targetUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono font-semibold text-[#3A4EFB] hover:underline inline-flex items-center gap-1 break-all"
              >
                {order.targetUrl} <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-start lg:self-center">
            <button
              type="button"
              onClick={handleSyncWithProviders}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#DEE0ED] bg-white hover:bg-[#F8F9FD] text-[#252943] text-xs font-bold transition-all shadow-subtle"
              title="Sync live status from upstream Xmedia and Zeofame APIs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#3A4EFB] ${syncing ? "animate-spin" : ""}`} />
              <span>Sync with Providers</span>
            </button>

            {!isCompleted && !isCancelled && (
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors"
                title="Cancel pending runs and refund undelivered balance"
              >
                {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                <span>Cancel Order</span>
              </button>
            )}
          </div>
        </div>

        {/* Action feedback message */}
        {actionMsg && (
          <div
            className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              actionMsg.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-700"
            }`}
          >
            {actionMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMsg.text}</span>
          </div>
        )}

        {/* Failed Runs Banner with 1-Click Safe Staggered Retry */}
        {hasFailedRuns && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-subtle">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <span className="text-xs font-bold block text-rose-900">
                  {failedRuns.length} delivery batches encountered upstream provider conflicts (active delivery on link)
                </span>
                <span className="text-[11px] text-rose-800/80">
                  Click below to resume and retry all failed batches safely spaced 20 minutes apart without link collisions.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRetryAllFailed}
              disabled={retryingAll}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-subtle shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {retryingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Retry All Failed ({failedRuns.length})</span>
            </button>
          </div>
        )}

        {/* Delayed Likes Protection Alert Banner */}
        {hasDelayedLikesProtectionTriggered && (
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-300 text-amber-950 space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="text-xs font-extrabold uppercase tracking-wide">
                Smart Coordination: Delayed Likes Protection Active
              </span>
            </div>
            <p className="text-xs leading-relaxed text-amber-900/90 pl-6">
              {delayedLikesEvents[0]?.message ||
                "Confirmed views delivered surpassed synchronization threshold. Next scheduled Likes delivery was accelerated immediately to protect organic engagement ratio."}
            </p>
          </div>
        )}

        {/* Section 7.D: Live Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 pt-2">
          {/* 1. Views Progress */}
          <div className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#252943]/60">
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-[#3A4EFB]" /> Views
              </span>
              <span className="font-mono text-[#3A4EFB]">{viewsSummary.percent}%</span>
            </div>
            <div className="text-base font-black text-[#252943] font-mono tracking-tight">
              {viewsSummary.delivered.toLocaleString()}{" "}
              <span className="text-xs font-normal text-[#252943]/50">/ {viewsSummary.planned.toLocaleString()}</span>
            </div>
            <div className="w-full bg-[#DEE0ED] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#3A4EFB] h-full rounded-full transition-all duration-500"
                style={{ width: `${viewsSummary.percent}%` }}
              />
            </div>
            <span className="text-[10px] text-[#252943]/50 block">
              {viewsSummary.remaining.toLocaleString()} views remaining
            </span>
          </div>

          {/* 2. Likes Progress */}
          <div className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#252943]/60">
              <span className="flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-rose-500" /> Likes
              </span>
              <span className="font-mono text-rose-600">{likesSummary.percent}%</span>
            </div>
            <div className="text-base font-black text-[#252943] font-mono tracking-tight">
              {likesSummary.delivered.toLocaleString()}{" "}
              <span className="text-xs font-normal text-[#252943]/50">/ {likesSummary.planned.toLocaleString()}</span>
            </div>
            <div className="w-full bg-[#DEE0ED] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-rose-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${likesSummary.percent}%` }}
              />
            </div>
            <span className="text-[10px] text-[#252943]/50 block">
              {likesSummary.remaining.toLocaleString()} likes remaining
            </span>
          </div>

          {/* 3. Overall Delivery % */}
          <div className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-1">
            <span className="text-[11px] font-bold text-[#252943]/60 block">Delivery Completion</span>
            <div className="text-lg font-black text-[#3A4EFB] font-mono tracking-tight">
              {order.progressPercent}%
            </div>
            <div className="w-full bg-[#DEE0ED] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#3A4EFB] h-full rounded-full transition-all duration-500"
                style={{ width: `${order.progressPercent}%` }}
              />
            </div>
            <span className="text-[10px] text-emerald-700 font-semibold block">
              {isCompleted ? "Fully Delivered" : "Active Pacing"}
            </span>
          </div>

          {/* 4. Completed Runs */}
          <div className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-1">
            <span className="text-[11px] font-bold text-[#252943]/60 block">Batches Dispatched</span>
            <div className="text-base font-black text-[#252943] font-mono tracking-tight">
              {order.completedRuns}{" "}
              <span className="text-xs font-normal text-[#252943]/50">/ {order.totalRuns}</span>
            </div>
            <span className="text-[10px] text-[#252943]/60 block">
              {order.totalRuns - order.completedRuns} pending runs
            </span>
          </div>

          {/* 5. Next Scheduled Delivery in Bangladesh Time */}
          <div className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-1">
            <span className="text-[11px] font-bold text-[#252943]/60 block">Next Scheduled Run</span>
            <div className="text-sm font-extrabold text-[#3A4EFB] font-mono">
              {order.nextRunTime ? `${formatBdTime(order.nextRunTime)} BD` : "Finished"}
            </div>
            <span className="text-[10px] text-[#252943]/50 block">
              {order.nextRunTime ? formatBdDateTime(order.nextRunTime) : "All runs finished"}
            </span>
          </div>

          {/* 6. Order Total Cost & Wallet */}
          <div className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-1">
            <span className="text-[11px] font-bold text-[#252943]/60 block">Total Investment</span>
            <div className="text-base font-black text-[#252943] font-mono">
              ₹{Number(order.totalCost).toFixed(2)}
            </div>
            {order.refundedAmount > 0 ? (
              <span className="text-[10px] font-bold text-rose-600 block">
                ₹{order.refundedAmount.toFixed(2)} refunded
              </span>
            ) : (
              <span className="text-[10px] text-emerald-600 font-semibold block">
                Wallet transaction safe
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[#DEE0ED] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "overview"
              ? "bg-[#252943] text-white shadow-subtle"
              : "bg-white text-[#252943]/70 hover:bg-[#F8F9FD] border border-[#DEE0ED]"
          }`}
        >
          Combined Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("views")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "views"
              ? "bg-[#3A4EFB] text-white shadow-subtle"
              : "bg-white text-[#252943]/70 hover:bg-[#F8F9FD] border border-[#DEE0ED]"
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Views Progress ({viewsRuns.length} runs)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("likes")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "likes"
              ? "bg-rose-600 text-white shadow-subtle"
              : "bg-white text-[#252943]/70 hover:bg-[#F8F9FD] border border-[#DEE0ED]"
          }`}
        >
          <Heart className="w-3.5 h-3.5" />
          <span>Likes Progress ({likesRuns.length} runs)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("timeline")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "timeline"
              ? "bg-[#252943] text-white shadow-subtle"
              : "bg-white text-[#252943]/70 hover:bg-[#F8F9FD] border border-[#DEE0ED]"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Combined Timeline</span>
        </button>
      </div>

      {/* TAB 1: COMBINED OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section 7.A: Views Summary Card */}
          <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#3A4EFB] flex items-center justify-center font-bold">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#252943]">TikTok Views (Xmedia)</h3>
                  <p className="text-[11px] text-[#252943]/60">Provider Service ID #10322 • 16 batches</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-[#3A4EFB]">
                {viewsSummary.delivered.toLocaleString()} / {viewsSummary.planned.toLocaleString()}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-[#252943]/70">Views Delivered:</span>
                <span className="font-mono text-[#252943]">{viewsSummary.delivered.toLocaleString()} ({viewsSummary.percent}%)</span>
              </div>
              <div className="w-full bg-[#F0F2FA] h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#3A4EFB] h-full rounded-full transition-all duration-500"
                  style={{ width: `${viewsSummary.percent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-[#252943]/50">
                <span>Completed: {viewsSummary.completedRuns} of 16 runs</span>
                <span>Remaining: {viewsSummary.remaining.toLocaleString()} views</span>
              </div>
            </div>

            {/* Next 3 upcoming views runs */}
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-bold uppercase text-[#252943]/60 block">Recent / Upcoming Views Runs</span>
              <div className="space-y-1.5">
                {viewsRuns.slice(0, 4).map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-2 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]/60 text-xs">
                    <span className="font-mono font-bold text-[#252943]">Run #{r.runNumber}</span>
                    <span className="text-[#252943]/70">{formatBdTime(r.scheduledAt)} BD</span>
                    <span className="font-mono font-semibold text-[#3A4EFB]">{r.quantity} views</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      r.status === "completed" || r.status === "confirmed"
                        ? "bg-emerald-100 text-emerald-800"
                        : r.status === "sent"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-slate-100 text-slate-700"
                    }`}>
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 7.B: Likes Summary Card */}
          <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <Heart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#252943]">TikTok Likes (Zeofame)</h3>
                  <p className="text-[11px] text-[#252943]/60">Provider Service ID #1123 • 3 batches</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-rose-600">
                {likesSummary.delivered.toLocaleString()} / {likesSummary.planned.toLocaleString()}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-[#252943]/70">Likes Delivered:</span>
                <span className="font-mono text-[#252943]">{likesSummary.delivered.toLocaleString()} ({likesSummary.percent}%)</span>
              </div>
              <div className="w-full bg-[#F0F2FA] h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${likesSummary.percent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-[#252943]/50">
                <span>Completed: {likesSummary.completedRuns} of 3 runs</span>
                <span>Remaining: {likesSummary.remaining.toLocaleString()} likes</span>
              </div>
            </div>

            {/* All 3 likes runs */}
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-bold uppercase text-[#252943]/60 block">Likes Delivery Batches</span>
              <div className="space-y-1.5">
                {likesRuns.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-2 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]/60 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-[#252943]">Run #{r.runNumber}</span>
                      {r.isReplan && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-100 text-amber-800 font-bold" title="Accelerated by Delayed Likes Protection">
                          Accelerated
                        </span>
                      )}
                    </div>
                    <span className="text-[#252943]/70">{formatBdTime(r.scheduledAt)} BD</span>
                    <span className="font-mono font-semibold text-rose-600">{r.quantity} likes</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      r.status === "completed" || r.status === "confirmed"
                        ? "bg-emerald-100 text-emerald-800"
                        : r.status === "sent"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-slate-100 text-slate-700"
                    }`}>
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: VIEWS PROGRESS GRAPH & RUNS (Section 7.A) */}
      {activeTab === "views" && (
        <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DEE0ED]">
            <div>
              <h2 className="text-base font-bold text-[#252943]">TikTok Views Delivery Progress (Xmedia #10322)</h2>
              <p className="text-xs text-[#252943]/60">
                16 randomized delivery runs (150–220 views/run) scheduled at 20-minute intervals.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="px-3 py-1 rounded-xl bg-blue-50 text-blue-700 font-bold">
                Delivered: {viewsSummary.delivered.toLocaleString()} / {viewsSummary.planned.toLocaleString()}
              </span>
            </div>
          </div>

          {/* SVG Progress Graph */}
          <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-2">
            <span className="text-xs font-bold text-[#252943] block">Planned Cumulative vs Delivered Delivery Curve</span>
            <div className="h-28 w-full flex items-end gap-1.5 pt-4">
              {viewsRuns.map((r, idx) => {
                const maxQty = viewsSummary.planned || 3000;
                const plannedH = Math.min(100, Math.round(((r.plannedCumulative || (idx + 1) * 185) / maxQty) * 100));
                const delivered = r.deliveredCumulative || (r.status === "completed" ? (r.plannedCumulative || (idx + 1) * 185) : 0);
                const deliveredH = Math.min(100, Math.round((delivered / maxQty) * 100));

                return (
                  <div key={r.id} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                    <div className="w-full flex items-end gap-0.5 h-20">
                      <div
                        className="w-1/2 bg-[#3A4EFB]/20 rounded-t transition-all"
                        style={{ height: `${plannedH}%` }}
                        title={`Run #${r.runNumber} Planned Cumulative: ${r.plannedCumulative || "—"}`}
                      />
                      <div
                        className="w-1/2 bg-[#3A4EFB] rounded-t transition-all"
                        style={{ height: `${deliveredH}%` }}
                        title={`Run #${r.runNumber} Delivered Cumulative: ${delivered}`}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-[#252943]/50">#{r.runNumber}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#252943]/60 pt-2 border-t border-[#DEE0ED]">
              <span>Axis: Run #1 (0m) to Run #16 (300m)</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#3A4EFB]/20 rounded" /> Planned Target</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#3A4EFB] rounded" /> Confivered Delivery</span>
              </div>
            </div>
          </div>

          {/* 16 Views Runs Table */}
          <div className="overflow-x-auto rounded-2xl border border-[#DEE0ED]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FD] text-[#252943]/70 font-bold border-b border-[#DEE0ED]">
                <tr>
                  <th className="py-2.5 px-3">Run #</th>
                  <th className="py-2.5 px-3">Scheduled (BD Time)</th>
                  <th className="py-2.5 px-3">Quantity</th>
                  <th className="py-2.5 px-3">Upstream Order ID</th>
                  <th className="py-2.5 px-3">Delivered</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEE0ED]">
                {viewsRuns.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F8F9FD]/60">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#252943]">
                      #{r.runNumber}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[#252943]/70">
                      {formatBdDateTime(r.scheduledAt)} ({formatBdTime(r.scheduledAt)} BD)
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#252943]">
                      {r.quantity}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[#3A4EFB]">
                      {r.providerOrderId ? `#${r.providerOrderId}` : "—"}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-600">
                      {r.deliveredQuantity ?? (r.status === "completed" ? r.quantity : 0)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        r.status === "completed" || r.status === "confirmed"
                          ? "bg-emerald-100 text-emerald-800"
                          : r.status === "sent"
                          ? "bg-blue-100 text-blue-800"
                          : r.status === "failed"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-slate-100 text-slate-700"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {["failed", "delayed"].includes(r.status) && (
                        <button
                          type="button"
                          onClick={() => handleRetryRun(r.id)}
                          disabled={retryingRunId === r.id}
                          className="px-2 py-1 rounded bg-[#3A4EFB] text-white text-[10px] font-bold hover:bg-[#252943]"
                        >
                          {retryingRunId === r.id ? "Retrying..." : "Retry"}
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

      {/* TAB 3: LIKES PROGRESS GRAPH & RUNS (Section 7.B) */}
      {activeTab === "likes" && (
        <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DEE0ED]">
            <div>
              <h2 className="text-base font-bold text-[#252943]">TikTok Likes Delivery Progress (Zeofame #1123)</h2>
              <p className="text-xs text-[#252943]/60">
                3 randomized delivery runs (12–16 likes/run) scheduled at 120-minute intervals (or accelerated by Delayed Likes Protection).
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="px-3 py-1 rounded-xl bg-rose-50 text-rose-700 font-bold">
                Delivered: {likesSummary.delivered.toLocaleString()} / {likesSummary.planned.toLocaleString()}
              </span>
            </div>
          </div>

          {/* 3 Likes Runs Table */}
          <div className="overflow-x-auto rounded-2xl border border-[#DEE0ED]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FD] text-[#252943]/70 font-bold border-b border-[#DEE0ED]">
                <tr>
                  <th className="py-2.5 px-3">Run #</th>
                  <th className="py-2.5 px-3">Scheduled (BD Time)</th>
                  <th className="py-2.5 px-3">Quantity</th>
                  <th className="py-2.5 px-3">Upstream Order ID</th>
                  <th className="py-2.5 px-3">Delivered</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEE0ED]">
                {likesRuns.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F8F9FD]/60">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#252943]">
                      #{r.runNumber}
                      {r.isReplan && (
                        <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] bg-amber-100 text-amber-800 font-bold">
                          Protection Accelerated
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[#252943]/70">
                      {formatBdDateTime(r.scheduledAt)} ({formatBdTime(r.scheduledAt)} BD)
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-rose-600">
                      {r.quantity}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[#3A4EFB]">
                      {r.providerOrderId ? `#${r.providerOrderId}` : "—"}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-600">
                      {r.deliveredQuantity ?? (r.status === "completed" ? r.quantity : 0)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        r.status === "completed" || r.status === "confirmed"
                          ? "bg-emerald-100 text-emerald-800"
                          : r.status === "sent"
                          ? "bg-blue-100 text-blue-800"
                          : r.status === "failed"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-slate-100 text-slate-700"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {["failed", "delayed"].includes(r.status) && (
                        <button
                          type="button"
                          onClick={() => handleRetryRun(r.id)}
                          disabled={retryingRunId === r.id}
                          className="px-2 py-1 rounded bg-[#3A4EFB] text-white text-[10px] font-bold hover:bg-[#252943]"
                        >
                          {retryingRunId === r.id ? "Retrying..." : "Retry"}
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

      {/* TAB 4: COMBINED TIMELINE (Section 7.C) */}
      {activeTab === "timeline" && (
        <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-6">
          <div className="pb-3 border-b border-[#DEE0ED]">
            <h2 className="text-base font-bold text-[#252943]">Unified Delivery Timeline & Event Logs</h2>
            <p className="text-xs text-[#252943]/60">
              Chronological sequence of all views runs, likes runs, and smart synchronization triggers.
            </p>
          </div>

          {/* Timeline Sequence */}
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#DEE0ED]">
            {/* Event 0: Campaign Started */}
            <div className="relative space-y-1">
              <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-[#3A4EFB] ring-4 ring-white" />
              <div className="text-xs font-bold text-[#252943]">
                Order Created & Queued
              </div>
              <span className="text-[10px] font-mono text-[#252943]/50 block">
                {formatBdDateTime(order.createdAt)} ({formatBdTime(order.createdAt)} BD)
              </span>
              <p className="text-xs text-[#252943]/70">
                16 Views batches (Xmedia #10322, Run #1 immediate through Run #16 at 300m) and 3 Likes batches (Zeofame #1123, cleared at 120m, 200m, and 280m before the last view batch) successfully queued.
              </p>
            </div>

            {/* Smart Delayed Likes Protection Trigger */}
            {hasDelayedLikesProtectionTriggered && (
              <div className="relative space-y-1 p-3 rounded-2xl bg-amber-50/80 border border-amber-300">
                <div className="absolute -left-6 top-4 w-3.5 h-3.5 rounded-full bg-amber-500 ring-4 ring-white" />
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-950">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span>Delayed Likes Protection Accelerated Run</span>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  {delayedLikesEvents[0]?.message}
                </p>
                <span className="text-[10px] font-mono text-amber-800/60 block">
                  {formatBdDateTime(delayedLikesEvents[0]?.createdAt)} ({formatBdTime(delayedLikesEvents[0]?.createdAt)} BD)
                </span>
              </div>
            )}

            {/* Chronological Runs */}
            {allRuns.map((r) => {
              const isViews = r.engagementType === "views";
              const isDone = r.status === "completed" || r.status === "confirmed";

              return (
                <div key={r.id} className="relative space-y-1">
                  <div
                    className={`absolute -left-6 top-1 w-3 h-3 rounded-full ring-4 ring-white ${
                      isDone
                        ? "bg-emerald-500"
                        : isViews
                        ? "bg-[#3A4EFB]"
                        : "bg-rose-500"
                    }`}
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold capitalize text-[#252943]">
                      {r.engagementType} Run #{r.runNumber}
                    </span>
                    <span className={`px-2 py-0.2 rounded text-[10px] font-bold uppercase ${
                      isDone
                        ? "bg-emerald-100 text-emerald-800"
                        : r.status === "sent"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-slate-100 text-slate-700"
                    }`}>
                      {r.status}
                    </span>
                    {r.isReplan && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-100 text-amber-800 font-bold">
                        Delayed Likes Accelerated
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-[#252943]/60 font-mono">
                    <span>Scheduled: {formatBdTime(r.scheduledAt)} BD</span>
                    <span>•</span>
                    <span>Quantity: {r.quantity}</span>
                    {r.providerOrderId && (
                      <>
                        <span>•</span>
                        <span className="text-[#3A4EFB]">Order ID: #{r.providerOrderId}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Final Completion Event */}
            {isCompleted && (
              <div className="relative space-y-1">
                <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-emerald-600 ring-4 ring-white" />
                <div className="text-xs font-bold text-emerald-700">
                  Engagement Delivery Completed
                </div>
                <span className="text-[10px] font-mono text-[#252943]/50 block">
                  {formatBdDateTime(order.updatedAt)} ({formatBdTime(order.updatedAt)} BD)
                </span>
                <p className="text-xs text-[#252943]/70">
                  All 16 Views batches and 3 Likes batches confirmed delivered by upstream providers.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

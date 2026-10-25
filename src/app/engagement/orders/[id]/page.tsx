"use client";

import { useState, useEffect, use } from "react";
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
  Layers,
  ExternalLink,
  ChevronRight,
  Info,
  Calendar,
  Zap,
} from "lucide-react";
import { EngagementType } from "@/lib/engagement/planner";
import { EngagementDetailChart } from "@/components/engagement/EngagementDetailChart";

interface OrderDetailData {
  id: string;
  orderRef: string;
  targetUrl: string;
  platform: string;
  profileId: string;
  presetKey?: string;
  baseViews: number;
  durationHours: number;
  status: string;
  deviationStatus: "on_track" | "slightly_behind" | "behind" | "ahead";
  typeStatuses: Record<string, "on_track" | "slightly_behind" | "behind" | "ahead">;
  calmStatusText: string;
  plainDeviationTexts: Record<string, string>;
  totalCost: number;
  refundedAmount: number;
  createdAt: string;
  replanCount: number;
  lastReplanReason?: string | null;
  enabledTypes: string[];
  plannedTotals: Record<string, number>;
  deliveredTotals: Record<string, number>;
  completedRuns: number;
  totalRuns: number;
  progressPercent: number;
  nextRunTime: string | null;
  expectedCurve: any[];
  statusSamples: any[];
  runs: Array<{
    id: string;
    engagementType: string;
    runNumber?: number;
    scheduledAt: string;
    sentAt: string | null;
    quantity: number;
    plannedCumulative?: number;
    deliveredQuantity?: number;
    deliveredCumulative?: number;
    status: string;
    latenessSeconds: number;
    isReplan: boolean;
    cost: number;
  }>;
}

const TYPE_COLORS: Record<EngagementType, string> = {
  views: "#3A4EFB",
  likes: "#E11D48",
  saves: "#D97706",
  shares: "#7C3AED",
  comments: "#059669",
};

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;

  const [order, setOrder] = useState<OrderDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [activeTab, setActiveTab] = useState<"cumulative" | "ratio" | "timeline" | "runs">("cumulative");
  const [visibleTypes, setVisibleTypes] = useState<Record<EngagementType, boolean>>({
    views: true,
    likes: true,
    saves: true,
    shares: true,
    comments: true,
  });

  async function fetchOrderDetail() {
    try {
      const res = await fetch(`/api/engagement/orders/${orderId}`);
      if (!res.ok) throw new Error("Network response was not ok");
      const data = await res.json();
      if (data.success && data.order) {
        setOrder(data.order);
        setIsOffline(false);
        setIsReconnecting(false);
      }
    } catch {
      setIsOffline(true);
      setIsReconnecting(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrderDetail();
    const interval = setInterval(fetchOrderDetail, 15000); // 15-30s live polling
    return () => clearInterval(interval);
  }, [orderId]);

  const handleToggleType = (t: EngagementType) => {
    setVisibleTypes((prev) => ({ ...prev, [t]: !prev[t] }));
  };

  if (loading && !order) {
    return (
      <div className="max-w-6xl mx-auto py-16 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-[#3A4EFB] animate-spin mx-auto" />
        <p className="text-xs font-semibold text-[#252943]/60">Loading campaign details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-6xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-[#252943]">Campaign Not Found</h2>
        <p className="text-xs text-[#252943]/60">This campaign could not be found or you do not have permission.</p>
        <Link
          href="/engagement/orders"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#252943] text-white text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Campaigns</span>
        </Link>
      </div>
    );
  }

  const durationHours = order.durationHours || 24;

  return (
    <div className="max-w-6xl mx-auto pb-16 space-y-6 animate-fadeIn">
      {/* Top Navigation & Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DEE0ED]">
        <div className="flex items-center gap-3">
          <Link
            href="/engagement/orders"
            className="p-2 rounded-xl border border-[#DEE0ED] bg-white text-[#252943]/70 hover:text-[#252943] hover:bg-[#F8F9FD] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-[#252943] font-mono tracking-tight">
                {order.orderRef}
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#252943] text-white uppercase">
                {order.platform}
              </span>
            </div>
            <a
              href={order.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#3A4EFB] hover:underline flex items-center gap-1 mt-0.5 truncate max-w-md"
            >
              <span className="truncate">{order.targetUrl}</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Calm user text badge */}
          <div
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border shadow-xs ${
              order.calmStatusText === "All good"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-amber-50 text-amber-900 border-amber-200"
            }`}
          >
            {order.calmStatusText === "All good" ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-amber-600" />
            )}
            <span>{order.calmStatusText}</span>
          </div>

          {/* Reconnecting badge */}
          {isReconnecting && (
            <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-[#252943]/60 text-[11px] font-semibold flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Reconnecting...</span>
            </span>
          )}

          <button
            type="button"
            onClick={fetchOrderDetail}
            className="p-2 rounded-xl border border-[#DEE0ED] bg-white text-[#252943]/70 hover:text-[#252943] hover:bg-[#F8F9FD]"
            title="Refresh now"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle">
          <span className="text-[10px] font-bold uppercase text-[#252943]/60 block mb-1">Overall Status</span>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                order.deviationStatus === "on_track"
                  ? "bg-emerald-500"
                  : order.deviationStatus === "slightly_behind"
                  ? "bg-amber-500"
                  : order.deviationStatus === "behind"
                  ? "bg-rose-500"
                  : "bg-blue-500"
              }`}
            />
            <span className="text-sm font-extrabold text-[#252943] capitalize">
              {order.deviationStatus.replace(/_/g, " ")}
            </span>
          </div>
          <span className="text-[10px] text-[#252943]/50 block mt-1">
            Progress: {order.progressPercent}% ({order.completedRuns}/{order.totalRuns} runs)
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle">
          <span className="text-[10px] font-bold uppercase text-[#252943]/60 block mb-1">Target Duration</span>
          <span className="text-sm font-extrabold text-[#252943] block">
            {order.durationHours} hours
          </span>
          <span className="text-[10px] text-[#252943]/50 block mt-1">
            Started: {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle">
          <span className="text-[10px] font-bold uppercase text-[#252943]/60 block mb-1">Next Delivery</span>
          <span className="text-sm font-extrabold text-[#3A4EFB] block">
            {order.nextRunTime
              ? new Date(order.nextRunTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "Completed"}
          </span>
          <span className="text-[10px] text-[#252943]/50 block mt-1">
            {order.replanCount > 0 ? `${order.replanCount} catch-up replans` : "Smooth pacing"}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle">
          <span className="text-[10px] font-bold uppercase text-[#252943]/60 block mb-1">Package Cost</span>
          <span className="text-sm font-extrabold text-[#252943] block">
            ₹{order.totalCost?.toFixed(2)}
          </span>
          {order.refundedAmount > 0 && (
            <span className="text-[10px] font-bold text-rose-600 block mt-1">
              ₹{order.refundedAmount.toFixed(2)} refunded
            </span>
          )}
        </div>
      </div>

      {/* Per-Type Status Chips with plain words */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["views", "likes", "saves", "shares", "comments"] as EngagementType[]).map((t) => {
          if (!order.enabledTypes.includes(t)) return null;
          const status = order.typeStatuses?.[t] || "on_track";
          const plainText = order.plainDeviationTexts?.[t] || `${t}: On track`;
          return (
            <div
              key={t}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                status === "on_track"
                  ? "bg-emerald-50/70 text-emerald-900 border-emerald-200"
                  : status === "slightly_behind"
                  ? "bg-amber-50/70 text-amber-900 border-amber-200"
                  : status === "behind"
                  ? "bg-rose-50/70 text-rose-900 border-rose-200"
                  : "bg-blue-50/70 text-blue-900 border-blue-200"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: TYPE_COLORS[t] }}
              />
              <span>{plainText}</span>
              <span className="text-[10px] opacity-60 font-mono">
                ({order.deliveredTotals[t]?.toLocaleString()} / {order.plannedTotals[t]?.toLocaleString()})
              </span>
            </div>
          );
        })}
      </div>

      {/* Main Tabs Container */}
      <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-5">
        {/* Tab Buttons */}
        <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED] flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            {[
              { key: "cumulative", label: "Cumulative Curves" },
              { key: "ratio", label: "Ratio Over Time" },
              { key: "timeline", label: "Batch Timeline" },
              { key: "runs", label: `Runs List (${order.runs.length})` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.key
                    ? "bg-[#252943] text-white shadow-xs"
                    : "bg-[#F8F9FD] text-[#252943]/70 hover:bg-[#DEE0ED]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-[#252943]/50 font-medium">
            Natural-looking delivery • Truthful status samples
          </span>
        </div>

        {/* TAB 1: Cumulative Expected vs Delivered Chart */}
        {activeTab === "cumulative" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[#252943]/70">
              <span className="font-semibold">
                Expected curve (dashed) vs Upstream confirmed delivery (solid)
              </span>
              <span className="text-[11px] font-mono text-[#252943]/50">
                Axis spans 0 to {order.durationHours}h
              </span>
            </div>

            <EngagementDetailChart
              durationHours={durationHours}
              expectedCurve={order.expectedCurve}
              statusSamples={order.statusSamples}
              runs={order.runs}
              createdAt={order.createdAt}
              visibleTypes={visibleTypes}
              onToggleType={handleToggleType}
              showDelivered={true}
              showNowMarker={true}
              height={280}
            />
          </div>
        )}

        {/* TAB 2: Ratio Over Time */}
        {activeTab === "ratio" && (
          <div className="space-y-4">
            <div className="text-xs text-[#252943]/70">
              <p className="font-semibold">
                Engagement Ratios vs Views (soft band convergence toward target)
              </p>
              <p className="text-[11px] text-[#252943]/50 mt-0.5">
                Delivered engagement never runs ahead of views: delivered(type) &le; ratio_cap &times; views.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {(["likes", "saves", "shares", "comments"] as EngagementType[]).map((t) => {
                if (!order.enabledTypes.includes(t)) return null;
                const plannedViews = order.plannedTotals.views || 1;
                const plannedType = order.plannedTotals[t] || 0;
                const targetRatioPct = ((plannedType / plannedViews) * 100).toFixed(1);

                const currentViews = order.deliveredTotals.views || 0;
                const currentType = order.deliveredTotals[t] || 0;
                const currentRatioPct = currentViews > 0 ? ((currentType / currentViews) * 100).toFixed(1) : "0.0";

                return (
                  <div key={t} className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-1">
                    <span className="text-xs font-bold text-[#252943] capitalize block">{t} / Views</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black text-[#252943] font-mono">{currentRatioPct}%</span>
                      <span className="text-xs font-bold text-[#252943]/50">target: {targetRatioPct}%</span>
                    </div>
                    <span className="text-[10px] text-emerald-600 font-semibold block">Within soft organic band</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: Batch Timeline */}
        {activeTab === "timeline" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[#252943]/60">
              <span>Timeline of individual batches sent across the schedule</span>
              <span>Showing {order.runs.length} batches</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-96 overflow-y-auto p-1">
              {order.runs.map((r, i) => {
                const isDone = r.status === "completed";
                const isSent = r.status === "sent";
                const isDelayed = r.status === "delayed";
                return (
                  <div
                    key={r.id || i}
                    className={`p-2.5 rounded-xl border text-xs space-y-1 transition-all ${
                      isDone
                        ? "bg-emerald-50/60 border-emerald-200"
                        : isSent
                        ? "bg-amber-50/60 border-amber-200"
                        : isDelayed
                        ? "bg-rose-50/60 border-rose-200"
                        : "bg-[#F8F9FD] border-[#DEE0ED]"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="capitalize" style={{ color: TYPE_COLORS[r.engagementType as EngagementType] || "#252943" }}>
                        {r.engagementType} #{r.runNumber || i + 1}
                      </span>
                      <span className="font-mono text-[9px] text-[#252943]/50">
                        {new Date(r.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="font-black text-xs text-[#252943]">
                        {r.quantity.toLocaleString()}
                      </span>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-1 rounded ${
                          isDone
                            ? "bg-emerald-100 text-emerald-800"
                            : isSent
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: Runs Inspector Table */}
        {activeTab === "runs" && (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-2xl border border-[#DEE0ED]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FD] text-[#252943]/70 font-bold border-b border-[#DEE0ED]">
                  <tr>
                    <th className="py-2.5 px-3">Run #</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Planned Time</th>
                    <th className="py-2.5 px-3">Sent Time</th>
                    <th className="py-2.5 px-3">Planned</th>
                    <th className="py-2.5 px-3">Delivered</th>
                    <th className="py-2.5 px-3">Lateness</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DEE0ED]">
                  {order.runs.map((r, i) => (
                    <tr key={r.id || i} className="hover:bg-[#F8F9FD]/60 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#252943]">
                        #{r.runNumber || i + 1}
                        {r.isReplan && (
                          <span className="ml-1 px-1 py-0.5 rounded text-[8px] bg-purple-100 text-purple-800 font-bold">
                            Re-plan
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-bold capitalize" style={{ color: TYPE_COLORS[r.engagementType as EngagementType] }}>
                        {r.engagementType}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#252943]/70">
                        {new Date(r.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#252943]/70">
                        {r.sentAt
                          ? new Date(r.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                          : "—"}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#252943]">
                        {r.quantity.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-600">
                        {(r.deliveredQuantity ?? (r.status === "completed" ? r.quantity : 0)).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {r.latenessSeconds > 0 ? (
                          <span className={r.latenessSeconds > 120 ? "text-rose-600 font-bold" : "text-[#252943]/60"}>
                            +{r.latenessSeconds}s
                          </span>
                        ) : (
                          <span className="text-[#252943]/40">&plusmn;0s</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            r.status === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : r.status === "sent"
                              ? "bg-amber-100 text-amber-800"
                              : r.status === "failed"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

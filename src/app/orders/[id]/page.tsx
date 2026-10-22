"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { 
  ChevronRight, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink, 
  XCircle, 
  Play, 
  Pause,
  Sliders,
  Loader2,
  ShieldAlert,
  ArrowLeft,
  Calendar,
  Clock,
  TrendingUp,
  Layers
} from "lucide-react";
import { redistributeRemaining } from "@/lib/scheduler/calculator";
import { normalizeOrderDetail, type OrderDetailStep } from "@/lib/orders/order-detail";

type StepRecord = OrderDetailStep;

interface OrderDetail {
  id: string;
  orderRef: string;
  targetUrl: string;
  requestedQuantity: number;
  submittedQuantity: number;
  deliveredQuantity: number;
  remainingQuantity: number;
  failedQuantity: number;
  unitCost: number;
  totalCost: number;
  isScheduled: boolean;
  scheduleMode?: string;
  status: string;
  providerOrderId?: string;
  refillId?: string;
  refillStatus?: string;
  errorMessage?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  service: {
    id: string;
    name: string;
    platform: string;
    category: string;
    ratePer1000: number;
    minQuantity: number;
    maxQuantity: number;
    refillSupported?: boolean;
    cancelSupported?: boolean;
    restrictions?: string;
    isMock: boolean;
  };
  monitoringSession?: {
    status: string;
    intervalMinutes: number;
    durationMinutes: number;
    nextCheckpointAt?: string | null;
  } | null;
  steps: StepRecord[];
  providerRecords: Array<{
    id: string;
    action: string;
    endpoint: string;
    statusCode: number;
    durationMs: number;
    success: boolean;
    createdAt: string;
  }>;
}

export default function OrderDetailPage() {
  const params = useParams();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [runningTick, setRunningTick] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Edit Batches Modal State
  const [showEditBatchesModal, setShowEditBatchesModal] = useState(false);
  const [editableBatches, setEditableBatches] = useState<Array<{ stepNumber: number; quantity: number; scheduledTime: string; isLocked: boolean }>>([]);
  const [savingBatches, setSavingBatches] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Always ensure steps is an array, including after cancellation.
  const steps = Array.isArray(order?.steps)
    ? order.steps
    : [];

  function setOrderFromResponse(value: unknown) {
    const normalized = normalizeOrderDetail(value);
    setOrder(normalized as unknown as OrderDetail | null);
  }

  async function loadOrder() {
    try {
      const res = await fetch(`/api/orders/${params.id}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.success && data.order) setOrderFromResponse(data.order);
      else setOrder(null);
    } catch (err) {
      console.error("Failed to load order", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrder();
    const refreshTimer = window.setInterval(loadOrder, 20_000);
    return () => window.clearInterval(refreshTimer);
  }, [params.id]);

  async function handleReconcile() {
    if (!order) return;
    setReconciling(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/orders/${order.id}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setOrderFromResponse(data.order);
        setActionMsg({ text: "Provider status synchronized successfully.", type: "success" });
      } else {
        setActionMsg({ text: data.error || "Failed to reconcile status", type: "error" });
      }
    } catch (err: any) {
      setActionMsg({ text: err.message || "Reconciliation error", type: "error" });
    } finally {
      setReconciling(false);
    }
  }

  async function handleCancel() {
    if (!order || !confirm("Are you sure you want to cancel this order?")) return;
    try {
      const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setOrderFromResponse(data.order);
        setActionMsg({ text: data.message || "Order was cancelled successfully.", type: "success" });
      } else {
        setActionMsg({ text: data.error || "Failed to cancel order", type: "error" });
      }
    } catch (err: any) {
      setActionMsg({ text: err.message || "Cancel failed", type: "error" });
    }
  }

  async function handlePauseSchedule() {
    if (!order) return;
    setPausing(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/pause`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setOrderFromResponse(data.order);
        setActionMsg({ text: data.message || "Schedule paused successfully.", type: "success" });
      } else {
        setActionMsg({ text: data.error || "Failed to pause schedule", type: "error" });
      }
    } catch (err: any) {
      setActionMsg({ text: err.message || "Pause failed", type: "error" });
    } finally {
      setPausing(false);
    }
  }

  async function handleResumeSchedule() {
    if (!order) return;
    setResuming(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/resume`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setOrderFromResponse(data.order);
        setActionMsg({ text: data.message || "Schedule resumed successfully.", type: "success" });
      } else {
        setActionMsg({ text: data.error || "Failed to resume schedule", type: "error" });
      }
    } catch (err: any) {
      setActionMsg({ text: err.message || "Resume failed", type: "error" });
    } finally {
      setResuming(false);
    }
  }

  async function handleTriggerSchedulerTick() {
    setRunningTick(true);
    setActionMsg(null);
    try {
      const res = await fetch("/api/scheduler/tick", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setActionMsg({
          text: `Scheduler tick executed: ${data.processedSteps} processed (${data.successfulSteps} succeeded, ${data.failedSteps} failed).`,
          type: "success",
        });
        await loadOrder();
      } else {
        setActionMsg({ text: data.error || "Scheduler tick failed", type: "error" });
      }
    } catch (err: any) {
      setActionMsg({ text: err.message || "Error running scheduler", type: "error" });
    } finally {
      setRunningTick(false);
    }
  }

  // Open Edit Batches Modal
  function openEditModal() {
    if (!order) return;
    setEditError(null);
    setEditableBatches(
      steps.map((s) => ({
        stepNumber: s.stepNumber,
        quantity: s.quantity,
        scheduledTime: s.scheduledTime,
        isLocked: ["SUBMITTED", "COMPLETED", "PROCESSING"].includes(s.status),
      }))
    );
    setShowEditBatchesModal(true);
  }

  function handleBatchQtyChange(stepNumber: number, newQty: number) {
    setEditableBatches((prev) =>
      prev.map((b) =>
        b.stepNumber === stepNumber && !b.isLocked
          ? { ...b, quantity: Math.max(0, Math.floor(newQty || 0)) }
          : b
      )
    );
  }

  function handleRedistributePendingBatches() {
    if (!order) return;
    const editableIndices = editableBatches
      .map((b, idx) => (!b.isLocked ? idx : -1))
      .filter((i) => i !== -1);

    if (editableIndices.length === 0) return;

    const lockedTotal = editableBatches
      .filter((b) => b.isLocked)
      .reduce((a, b) => a + b.quantity, 0);

    const targetForPending = order.requestedQuantity - lockedTotal;
    const currentPendingQtys = editableIndices.map((i) => editableBatches[i].quantity);

    const redistributed = redistributeRemaining(
      currentPendingQtys,
      targetForPending,
      order.service.minQuantity,
      order.service.maxQuantity
    );

    setEditableBatches((prev) => {
      const next = [...prev];
      editableIndices.forEach((origIdx, redIdx) => {
        next[origIdx] = { ...next[origIdx], quantity: redistributed[redIdx] };
      });
      return next;
    });
  }

  async function handleSaveBatches() {
    if (!order) return;
    setSavingBatches(true);
    setEditError(null);

    const sumBatches = editableBatches.reduce((a, b) => a + b.quantity, 0);
    if (sumBatches !== order.requestedQuantity) {
      const diff = order.requestedQuantity - sumBatches;
      setEditError(
        `Total quantity of batches (${sumBatches.toLocaleString()}) must equal requested total (${order.requestedQuantity.toLocaleString()}). Discrepancy: ${diff > 0 ? `${diff} units unallocated` : `${Math.abs(diff)} units overallocated`}.`
      );
      setSavingBatches(false);
      return;
    }

    try {
      const res = await fetch(`/api/orders/${order.id}/batches`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batches: editableBatches.map((b) => ({
            stepNumber: b.stepNumber,
            quantity: b.quantity,
            scheduledTime: b.scheduledTime,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update batches");
      }

      setOrderFromResponse(data.order);
      setShowEditBatchesModal(false);
      setActionMsg({ text: "Schedule batches successfully updated.", type: "success" });
    } catch (err: any) {
      setEditError(err.message || "Failed to update batches.");
    } finally {
      setSavingBatches(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-xs text-[#252943]/60 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#3A4EFB]" />
        <span>Loading order details...</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
        <h1 className="text-lg font-bold text-[#252943]">Order Not Found</h1>
        <p className="text-xs text-[#252943]/60">The requested order could not be located in our persistent database.</p>
        <Link href="/orders" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3A4EFB] text-white text-xs font-semibold">
          <ArrowLeft className="w-4 h-4" /> Return to Orders
        </Link>
      </div>
    );
  }

  const isAdaptiveMonitor = order.scheduleMode === "ADAPTIVE";
  const adaptiveBatchQuantity = steps.reduce((total, step) => total + step.quantity, 0);
  const adaptivePendingQuantity = steps
    .filter((step) => ["PENDING", "PAUSED"].includes(step.status))
    .reduce((total, step) => total + step.quantity, 0);
  const adaptiveSubmittedQuantity = Math.max(0, order.submittedQuantity);
  const adaptiveDeliveredQuantity = Math.max(0, order.deliveredQuantity);
  const adaptiveSubmittedValue = Number(
    ((adaptiveSubmittedQuantity / 1000) * order.service.ratePer1000).toFixed(2)
  );
  const percentComplete = Math.min(
    100,
    Math.round(
      ((order?.deliveredQuantity ?? 0) /
        ((isAdaptiveMonitor ? adaptiveSubmittedQuantity : order?.requestedQuantity) || 1)) *
        100
    )
  );

  const dispatchedBatchesCount = steps.filter((s) =>
    ["SUBMITTED", "COMPLETED"].includes(s.status)
  ).length;

  const pendingBatchesCount = steps.filter((s) =>
    ["PENDING", "PAUSED"].includes(s.status)
  ).length;

  const failedBatchesCount = steps.filter(
    (s) => s.status === "FAILED"
  ).length;

  const nextPendingStep = steps.find(
    (s) => s.status === "PENDING"
  );

  const monitorStatusLabels: Record<string, string> = {
    RUNNING: "Monitoring",
    PAUSED: "Paused",
    STOPPED: "Stopped",
    EXPIRED: "Finished",
    COMPLETED: "Finished",
  };
  const monitorStatusLabel = order.monitoringSession
    ? monitorStatusLabels[order.monitoringSession.status] || order.monitoringSession.status
    : "Automatic";
  const monitorIntervalDescription = order.monitoringSession?.intervalMinutes
    ? order.monitoringSession.status === "RUNNING"
      ? `This video is checked every ${order.monitoringSession.intervalMinutes} minutes${order.monitoringSession.durationMinutes ? ` for up to ${order.monitoringSession.durationMinutes} minutes` : ""}.`
      : order.monitoringSession.status === "PAUSED"
        ? `Checks are paused. The monitor checks every ${order.monitoringSession.intervalMinutes} minutes when resumed.`
        : `This video was checked every ${order.monitoringSession.intervalMinutes} minutes during its monitoring window.`
    : "This video is checked at regular intervals.";

  const editableBatchesSum = editableBatches.reduce((a, b) => a + b.quantity, 0);
  const editableUnallocated = order.requestedQuantity - editableBatchesSum;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn">
      {/* Breadcrumb & Navigation */}
      <div>
        <div className="inline-flex items-center gap-1.5 text-xs text-[#252943]/60 mb-1">
          <Link href="/orders" className="hover:text-[#3A4EFB] flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Orders
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="font-semibold text-[#252943]">{order.orderRef}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-[#252943]">
                {order.orderRef}
              </h1>
              <StatusBadge
                status={order.status}
                label={isAdaptiveMonitor
                  ? order.status === "CANCELLED" ? "Cancelled" : monitorStatusLabel
                  : undefined}
              />
            </div>
            <p className="text-xs text-[#252943]/60 mt-1">
              Created on {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Pause / Resume Schedule Controls */}
            {order.isScheduled && order.scheduleMode !== "ADAPTIVE" && !["COMPLETED", "CANCELLED", "FAILED"].includes(order.status) && (
              <>
                {order.status === "PAUSED" ? (
                  <button
                    type="button"
                    onClick={handleResumeSchedule}
                    disabled={resuming}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all press-scale shadow-subtle"
                  >
                    {resuming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 text-white" />}
                    Resume Schedule
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePauseSchedule}
                    disabled={pausing}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold transition-all press-scale"
                  >
                    {pausing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5 text-amber-700" />}
                    Pause Schedule
                  </button>
                )}

                {/* Edit Pending Batches */}
                <button
                  type="button"
                  onClick={openEditModal}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white hover:bg-[#F8F9FD] text-[#252943] text-xs font-semibold transition-all press-scale"
                  title="Edit unsubmitted batch sizes and timings"
                >
                  <Sliders className="w-3.5 h-3.5 text-[#3A4EFB]" />
                  Edit Batches
                </button>
              </>
            )}

            {order.isScheduled && !isAdaptiveMonitor && (
              <button
                type="button"
                onClick={handleTriggerSchedulerTick}
                disabled={runningTick}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#252943] hover:bg-[#1A1D31] text-white text-xs font-semibold transition-all press-scale shadow-subtle"
                title="Execute due steps immediately"
              >
                {runningTick ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 text-[#E3FF3B]" />}
                Run Scheduler Tick
              </button>
            )}

            {order.providerOrderId && (
              <button
                type="button"
                onClick={handleReconcile}
                disabled={reconciling}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white hover:bg-[#F8F9FD] text-[#252943] text-xs font-semibold transition-all press-scale"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#3A4EFB] ${reconciling ? "animate-spin" : ""}`} />
                Check Provider Status
              </button>
            )}

            {!["COMPLETED", "CANCELLED", "FAILED"].includes(order.status) && (
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" /> Cancel Order
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionMsg && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
          actionMsg.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {actionMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* Error Banner if Order has error */}
      {order.errorMessage && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Diagnostic Notice</span>
          </div>
          <p className="text-xs leading-relaxed font-medium">{order.errorMessage}</p>
        </div>
      )}

      {/* Progress & Delivery Metrics */}
      <div className="bg-white rounded-2xl border border-[#DEE0ED] p-6 shadow-subtle space-y-6">
        {isAdaptiveMonitor ? (
          <>
            <div className="rounded-xl border border-[#DDE3FF] bg-[#F5F7FF] p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-[#252943]">How Likes Analyze works</h2>
                  <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-[#252943]/70">
                    {monitorIntervalDescription} When likes increase, the system calculates a batch from that change and sends it to the selected service.
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[#252943]/70">
                    There is no fixed order quantity. The batch total below is the sum of batches measured so far. The service maximum is only a safety limit.
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#252943] ring-1 ring-[#DEE0ED]">
                  {monitorStatusLabel}
                </span>
              </div>
            </div>

            {adaptiveSubmittedQuantity > 0 ? (
              <div>
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-[#252943]">Provider delivery progress</span>
                  <span className="font-bold text-[#3A4EFB]">
                    {adaptiveDeliveredQuantity.toLocaleString()} of {adaptiveSubmittedQuantity.toLocaleString()} sent units delivered ({percentComplete}%)
                  </span>
                </div>
                <div
                  className="h-2.5 w-full overflow-hidden rounded-full bg-[#DEE0ED]/60"
                  role="progressbar"
                  aria-label="Provider delivery progress"
                  aria-valuemin={0}
                  aria-valuemax={adaptiveSubmittedQuantity}
                  aria-valuenow={Math.min(adaptiveDeliveredQuantity, adaptiveSubmittedQuantity)}
                >
                  <div className="h-full rounded-full bg-[#3A4EFB] transition-all duration-500" style={{ width: `${percentComplete}%` }} />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[#DEE0ED] bg-[#F8F9FD] p-4">
                <p className="text-sm font-semibold text-[#252943]">
                  {order.status === "CANCELLED" || order.monitoringSession?.status === "STOPPED"
                    ? "Monitoring has stopped; no batch was sent to the provider."
                    : steps.length > 0
                      ? "Batches have been measured, but none have been sent yet."
                      : "No batch has been created yet."}
                </p>
                {order.status !== "CANCELLED" && order.monitoringSession?.status === "RUNNING" && (
                  <p className="mt-1 text-xs leading-relaxed text-[#252943]/60">
                    The monitor checks again at the next interval. A batch is created only when it detects a likes increase.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              {[
                {
                  label: "Measured batch total",
                  value: adaptiveBatchQuantity.toLocaleString(),
                  help: `Sum of ${steps.length} measured ${steps.length === 1 ? "batch" : "batches"}`,
                },
                {
                  label: "Sent to provider",
                  value: adaptiveSubmittedQuantity.toLocaleString(),
                  help: "Units accepted by the provider",
                },
                {
                  label: "Delivered",
                  value: adaptiveDeliveredQuantity.toLocaleString(),
                  help: "Delivery reported by the provider",
                },
                {
                  label: "Waiting to send",
                  value: adaptivePendingQuantity.toLocaleString(),
                  help: "Measured batches still queued",
                },
                {
                  label: "Estimated submitted value",
                  value: `₹${adaptiveSubmittedValue.toFixed(2)}`,
                  help: "Estimate for units sent so far",
                },
              ].map((metric) => (
                <div key={metric.label} className="min-w-0 rounded-xl border border-[#DEE0ED] bg-white p-3">
                  <span className="block text-[10px] font-medium text-[#252943]/55">{metric.label}</span>
                  <span className="mt-1 block truncate text-lg font-bold tracking-tight text-[#252943]" title={metric.value}>{metric.value}</span>
                  <span className="mt-1 block text-[10px] leading-snug text-[#252943]/55">{metric.help}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-[#252943]">Delivery Completion</span>
                <span className="font-bold text-[#3A4EFB] text-sm">{percentComplete}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-[#DEE0ED]/60 overflow-hidden">
                <div className="h-full bg-[#3A4EFB] rounded-full transition-all duration-500" style={{ width: `${percentComplete}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-4 border-t border-[#DEE0ED]/60 text-xs">
              <div><span className="text-[#252943]/50 text-[10px] block">Requested</span><span className="font-bold text-[#252943] text-base tracking-tight">{order.requestedQuantity.toLocaleString()}</span></div>
              <div><span className="text-[#252943]/50 text-[10px] block">Submitted</span><span className="font-bold text-[#252943] text-base tracking-tight">{order.submittedQuantity.toLocaleString()}</span></div>
              <div><span className="text-[#252943]/50 text-[10px] block">Delivered</span><span className="font-bold text-emerald-700 text-base tracking-tight">{order.deliveredQuantity.toLocaleString()}</span></div>
              <div><span className="text-[#252943]/50 text-[10px] block">Remaining</span><span className="font-bold text-[#252943] text-base tracking-tight">{order.remainingQuantity.toLocaleString()}</span></div>
              <div><span className="text-[#252943]/50 text-[10px] block">Total Cost</span><span className="font-bold text-[#3A4EFB] text-base tracking-tight">₹{Number(order.totalCost).toFixed(2)}</span></div>
            </div>

            {order.isScheduled && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#DEE0ED]/60 text-xs bg-[#F8F9FD] p-3 rounded-xl border border-[#DEE0ED]/70">
                <div><span className="text-[10px] text-[#252943]/50 block">Pacing Strategy</span><span className="font-semibold text-[#252943]">{order.scheduleMode ? order.scheduleMode.replace("_", " ") : "Custom Schedule"}</span></div>
                <div><span className="text-[10px] text-[#252943]/50 block">Batch Progress</span><span className="font-semibold text-[#252943]">{dispatchedBatchesCount} / {steps.length} dispatched</span></div>
                <div><span className="text-[10px] text-[#252943]/50 block">Pending Batches</span><span className="font-semibold text-[#252943]">{pendingBatchesCount} batches remaining</span></div>
                <div><span className="text-[10px] text-[#252943]/50 block">Next Scheduled Dispatch</span><span className="font-semibold text-[#3A4EFB]">{nextPendingStep ? new Date(nextPendingStep.scheduledTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "All Dispatched"}</span></div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Two Column Layout: Order Meta + Scheduled Delivery Steps */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Order & Provider Attributes */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#DEE0ED] p-5 shadow-subtle space-y-4 text-xs">
            <h3 className="font-semibold text-[#252943] pb-2 border-b border-[#DEE0ED]">
              Order Specifications
            </h3>

            <div className="space-y-3">
              <div>
                <span className="text-[#252943]/50 text-[11px] block">Service</span>
                <span className="font-semibold text-[#252943]">{order.service.name}</span>
                <span className="text-[11px] font-medium block text-[#252943]/60 mt-0.5">{order.service.platform} • {order.service.category}</span>
              </div>

              <div>
                <span className="text-[#252943]/50 text-[11px] block">Destination Link</span>
                <a
                  href={order.targetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#3A4EFB] font-medium hover:underline break-all inline-flex items-center gap-1 mt-0.5"
                >
                  {order.targetUrl} <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>

              <div>
                <span className="text-[#252943]/50 text-[11px] block">Delivery Mode</span>
                <span className="font-medium text-[#252943]">
                  {isAdaptiveMonitor
                    ? "Likes Analyze · automatic batches"
                    : order.isScheduled
                      ? `Growth Plan (${order.scheduleMode})`
                      : "Instant Submission"}
                </span>
              </div>

              <div>
                <span className="text-[#252943]/50 text-[11px] block">
                  {isAdaptiveMonitor ? "Provider submission" : "Provider Order Reference"}
                </span>
                <span className="font-bold text-[#252943]">
                  {order.providerOrderId || (
                    isAdaptiveMonitor
                      ? adaptiveSubmittedQuantity > 0 ? "See references in batch history" : "No batches sent yet"
                      : "Pending Dispatch"
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Scheduled Delivery Steps */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-[#DEE0ED] shadow-subtle overflow-hidden">
            <div className="p-5 border-b border-[#DEE0ED] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#252943]">
                  {isAdaptiveMonitor ? "Batch history" : order.isScheduled ? "Scheduled Delivery Step Jobs" : "Execution Record"}
                </h3>
                <p className="text-xs text-[#252943]/60">
                  {isAdaptiveMonitor
                    ? steps.length === 0
                      ? "Batches appear here when a likes increase is detected."
                      : "Each quantity is calculated from the likes increase measured at that check."
                    : `${steps.length} scheduled delivery ${steps.length === 1 ? "step" : "steps"}`}
                </p>
              </div>

              {order.isScheduled && order.scheduleMode !== "ADAPTIVE" && !["COMPLETED", "CANCELLED", "FAILED"].includes(order.status) && (
                <button
                  type="button"
                  onClick={openEditModal}
                  className="px-2.5 py-1 rounded-lg border border-[#DEE0ED] hover:bg-[#F8F9FD] text-[11px] font-semibold text-[#252943] transition-colors flex items-center gap-1"
                >
                  <Sliders className="w-3 h-3 text-[#3A4EFB]" /> Edit Pending Batches
                </button>
              )}
            </div>

            {steps.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#252943]/50">
                {isAdaptiveMonitor
                  ? "No batches yet. Likes Analyze will calculate a batch after it detects a likes increase."
                  : "Single instant order. No recurring delivery steps configured."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8F9FD] border-b border-[#DEE0ED] text-[#252943]/60 font-medium">
                    <tr>
                      <th className="py-2.5 px-4 w-12">Step</th>
                      <th className="py-2.5 px-4">{isAdaptiveMonitor ? "Measured / sent" : "Scheduled Execution"}</th>
                      <th className="py-2.5 px-4 text-right">Quantity</th>
                      <th className="py-2.5 px-4">Provider Ref</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DEE0ED]/60">
                    {steps.map((step) => {
                      const isDelayed = step.retryCount > 0 && step.status === "PENDING";
                      return (
                        <tr key={step.id} className="hover:bg-[#F8F9FD]/60">
                          <td className="py-3 px-4 font-bold text-[#252943]">
                            #{step.stepNumber}
                          </td>
                          <td className="py-3 px-4 text-[#252943]">
                            <div className="font-medium">
                              {new Date(step.scheduledTime).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                            {step.executedAt && (
                              <div className="text-[11px] text-emerald-700 font-semibold">
                                Executed: {new Date(step.executedAt).toLocaleTimeString()}
                              </div>
                            )}
                            {isDelayed && (
                              <div className="text-[10px] text-orange-700 font-medium">
                                Delayed (Retry #{step.retryCount})
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-[#252943]">
                            {step.quantity.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-xs font-medium text-[#252943]/70">
                            {step.providerOrderId || "—"}
                          </td>
                          <td className="py-3 px-4">
                            <StatusBadge status={isDelayed ? "DELAYED" : step.status} />
                            {step.errorMessage && (
                              <div className="text-[10px] text-red-600 mt-1 max-w-[160px] truncate" title={step.errorMessage}>
                                {step.errorMessage}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Batches Modal */}
      {showEditBatchesModal && (
        <div className="fixed inset-0 z-50 bg-[#252943]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#DEE0ED] p-6 shadow-dropdown space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#3A4EFB]" />
                <h3 className="text-base font-semibold text-[#252943]">
                  Edit Pending Batches
                </h3>
              </div>
              <button
                onClick={() => setShowEditBatchesModal(false)}
                className="text-[#252943]/40 hover:text-[#252943] text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#252943]/60">
              Modify the quantities of unsubmitted batches. Completed and executing batches are locked to protect consistency.
            </p>

            {editError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            {/* Allocation Status */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs">
              <span className="font-medium text-[#252943]/70">Allocation Balance:</span>
              <div className="flex items-center gap-2">
                {editableUnallocated === 0 ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 100% Balanced ({order.requestedQuantity.toLocaleString()})
                  </span>
                ) : (
                  <>
                    <span className="text-amber-800 font-bold">
                      {Math.abs(editableUnallocated).toLocaleString()} {editableUnallocated > 0 ? "unallocated" : "overallocated"}
                    </span>
                    <button
                      type="button"
                      onClick={handleRedistributePendingBatches}
                      className="px-2 py-0.5 rounded-md bg-[#3A4EFB] text-white text-[11px] font-semibold"
                    >
                      Redistribute
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Batches Table Inputs */}
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 text-xs">
              {editableBatches.map((batch) => (
                <div
                  key={batch.stepNumber}
                  className={`flex items-center justify-between p-2.5 rounded-xl border ${
                    batch.isLocked
                      ? "bg-gray-50 border-[#DEE0ED]/60 opacity-60"
                      : "bg-white border-[#DEE0ED]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#252943]">Batch #{batch.stepNumber}</span>
                    {batch.isLocked && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                        Locked
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      disabled={batch.isLocked}
                      min={order.service.minQuantity}
                      max={order.service.maxQuantity}
                      step={50}
                      value={batch.quantity}
                      onChange={(e) => handleBatchQtyChange(batch.stepNumber, parseInt(e.target.value, 10))}
                      className="w-28 bg-[#F8F9FD] border border-[#DEE0ED] rounded-lg px-2.5 py-1 text-right font-bold text-[#252943] focus:border-[#3A4EFB] disabled:cursor-not-allowed"
                    />
                    <span className="text-[#252943]/60 text-[11px]">units</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowEditBatchesModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#DEE0ED] text-xs font-semibold text-[#252943] hover:bg-[#F8F9FD]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBatches}
                disabled={savingBatches || editableUnallocated !== 0}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all press-scale flex items-center justify-center gap-1.5 ${
                  editableUnallocated === 0 && !savingBatches
                    ? "bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white"
                    : "bg-[#DEE0ED] text-[#252943]/40 cursor-not-allowed"
                }`}
              >
                {savingBatches ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving Batches...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#E3FF3B]" />
                    Save Changes
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

function StatusBadge({ status, label }: { status: string; label?: string }) {
  let badgeColor = "bg-[#DEE0ED]/60 text-[#252943]";
  if (status === "COMPLETED") badgeColor = "bg-[#E3FF3B] text-[#252943] font-semibold";
  else if (status === "PROCESSING") badgeColor = "bg-[#3A4EFB]/15 text-[#3A4EFB] font-medium";
  else if (status === "SUBMITTED") badgeColor = "bg-[#3A4EFB]/15 text-[#3A4EFB] font-medium";
  else if (status === "PARTIAL") badgeColor = "bg-amber-100 text-amber-800 font-medium";
  else if (status === "SCHEDULED" || status === "PENDING") badgeColor = "bg-[#252943] text-white font-medium";
  else if (status === "PAUSED") badgeColor = "bg-amber-100 text-amber-800 font-medium";
  else if (status === "DELAYED") badgeColor = "bg-orange-100 text-orange-800 font-medium";
  else if (status === "FAILED") badgeColor = "bg-red-100 text-red-700 font-medium";
  else if (status === "REQUIRES_RECONCILIATION") badgeColor = "bg-amber-100 text-amber-800 font-medium";
  else if (status === "CANCELLED") badgeColor = "bg-gray-200 text-gray-700 font-medium";

  const statusLabels: Record<string, string> = {
    COMPLETED: "Completed",
    PROCESSING: "Processing",
    SUBMITTED: "Sent to provider",
    PARTIAL: "Partially delivered",
    SCHEDULED: "Scheduled",
    PENDING: "Queued",
    PAUSED: "Paused",
    DELAYED: "Delayed",
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

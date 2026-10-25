"use client";

import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Flame,
  HelpCircle,
  Loader2,
  PauseCircle,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldAlert,
  User,
  XCircle,
  Zap,
} from "lucide-react";
import { formatProviderBalance } from "@/lib/currency";

interface AdminAlertItem {
  id: string;
  orderId: string | null;
  runId: string | null;
  providerId: string | null;
  providerName: string | null;
  serviceId: string | null;
  engagementType: string | null;
  runNumber: number | null;
  errorType: string | null;
  severity: "high" | "medium" | "low" | string;
  title: string;
  reason: string;
  suggestedAction: string | null;
  details: any | null;
  dedupKey: string | null;
  dedupCount: number;
  lastSeenAt: string;
  retryCount: number;
  status: "open" | "retrying" | "resolved" | string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  run?: {
    id: string;
    scheduledAt: string;
    sentAt: string | null;
    quantity: number;
    deliveredQuantity: number;
    rawResponse: string | null;
    errorType: string | null;
    errorMessage: string | null;
    providerOrderId: string | null;
    latenessSeconds: number;
  } | null;
}

export function AlertsHealthTab() {
  const [alerts, setAlerts] = useState<AdminAlertItem[]>([]);
  const [metrics, setMetrics] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/alerts");
      const data = await res.json();
      if (data.success) {
        setAlerts(data.alerts || []);
        setMetrics(data.metrics || null);
      }
    } catch (err) {
      console.error("Failed to load alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleAlertAction = async (alertId: string, action: string) => {
    setActionLoadingId(`${alertId}-${action}`);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/alerts/${alertId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Action failed");
      }
      setActionMessage({ text: data.message || "Action completed", type: "success" });
      await loadAlerts();
    } catch (err: any) {
      setActionMessage({ text: err.message || "Failed to perform action", type: "error" });
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredAlerts = alerts
    .filter((a) => (filterSeverity === "all" ? true : a.severity === filterSeverity))
    .filter((a) => (filterStatus === "all" ? true : a.status === filterStatus));

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Providers Health Status Strip */}
      <div className="bg-white rounded-3xl border border-[#DEE0ED] p-5 shadow-subtle space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-[#252943] flex items-center gap-2">
              <Server className="w-5 h-5 text-[#3A4EFB]" />
              Active Provider Balances & Upstream Health
            </h3>
            <p className="text-xs text-[#252943]/60">
              Live statuses and funds across configured providers
            </p>
          </div>

          <button
            type="button"
            onClick={loadAlerts}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#DEE0ED] text-xs font-bold text-[#252943] hover:border-[#3A4EFB]"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#3A4EFB] ${loading ? "animate-spin" : ""}`} />
            <span>Re-check Balance</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(metrics?.providersStatus || []).map((p: any) => (
            <div
              key={p.id}
              className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#252943] capitalize">{p.name}</span>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      p.active ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {p.active ? "Active" : "Paused"}
                  </span>
                </div>
                <span className="text-[11px] text-[#252943]/60 block mt-1">
                  {p.isMock ? "Mock / Sandbox Mode" : "SMM API v2"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-extrabold text-[#252943] block">
                  {p.balance !== null && p.balance !== undefined
                    ? formatProviderBalance(p.balance, p.currency)
                    : "—"}
                </span>
                <span className="text-[10px] font-bold text-[#252943]/40">Balance</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Notification Message */}
      {actionMessage && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs font-semibold ${
            actionMessage.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-rose-50 text-rose-900 border border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-gray-400 hover:text-gray-700 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Incidents & Delivery Health Stream (Change J) */}
      <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-[#252943] flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              Incidents & Delivery Health Details
            </h3>
            <p className="text-xs text-[#252943]/60">
              Plain-language root cause, planned vs actual timing & quantity, automated recovery actions, and operator controls
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-1.5 font-bold text-[#252943] outline-none"
            >
              <option value="all">All Severities</option>
              <option value="high">High Severity</option>
              <option value="medium">Medium Severity</option>
              <option value="low">Low Severity</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-1.5 font-bold text-[#252943] outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="retrying">Retrying</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        {/* Detailed Alerts Cards List (Change J) */}
        <div className="space-y-3.5">
          {filteredAlerts.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#252943]/60 rounded-2xl border border-[#DEE0ED] bg-[#F8F9FD]">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              All systems operational. No active delivery incidents or health alerts.
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const isExpanded = expandedAlertId === alert.id;
              const severityColor =
                alert.severity === "high"
                  ? "border-rose-200 bg-rose-50/30"
                  : alert.severity === "medium"
                  ? "border-amber-200 bg-amber-50/30"
                  : "border-blue-200 bg-blue-50/30";

              return (
                <div
                  key={alert.id}
                  className={`rounded-2xl border ${severityColor} p-4 text-xs transition-all shadow-subtle space-y-3`}
                >
                  {/* Alert Header Row */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#DEE0ED]/60 pb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                          alert.severity === "high"
                            ? "bg-rose-500 text-white"
                            : alert.severity === "medium"
                            ? "bg-amber-500 text-white"
                            : "bg-blue-500 text-white"
                        }`}
                      >
                        {alert.severity}
                      </span>

                      <span className="font-extrabold text-[#252943] text-sm">
                        {alert.title}
                      </span>

                      {alert.dedupCount > 1 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                          Seen {alert.dedupCount} times
                        </span>
                      )}

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          alert.status === "open"
                            ? "bg-rose-100 text-rose-800"
                            : alert.status === "retrying"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {alert.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-[#252943]/60">
                      <span>
                        First: {new Date(alert.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span>
                        Last: {new Date(alert.lastSeenAt || alert.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>

                  {/* Core Information Grid (Change J) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 bg-white p-3 rounded-xl border border-[#DEE0ED]/80">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">
                        Order ID
                      </span>
                      {alert.orderId ? (
                        <span className="font-mono font-bold text-[#3A4EFB]">
                          #{alert.orderId.slice(-8)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">
                        Provider & Service
                      </span>
                      <span className="font-bold text-[#252943]">
                        {alert.providerName || "Provider"}{" "}
                        {alert.serviceId ? `(ID ${alert.serviceId})` : ""}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">
                        Engagement & Run
                      </span>
                      <span className="font-semibold text-[#252943] capitalize">
                        {alert.engagementType || "Run"} {alert.runNumber ? `#${alert.runNumber}` : ""}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">
                        Error Type
                      </span>
                      <span className="font-mono font-bold text-rose-600 uppercase text-[11px]">
                        {alert.errorType || "unknown"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">
                        Retry Attempts
                      </span>
                      <span className="font-bold text-[#252943]">
                        {alert.retryCount} / 5
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">
                        Resolution
                      </span>
                      {alert.status === "resolved" ? (
                        <span className="text-[10px] font-bold text-emerald-700">
                          By {alert.resolvedBy || "admin"} at{" "}
                          {alert.resolvedAt
                            ? new Date(alert.resolvedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-rose-600">Pending Operator</span>
                      )}
                    </div>
                  </div>

                  {/* Plain Language Explanation & What System Did */}
                  <div className="space-y-1.5 bg-white p-3 rounded-xl border border-[#DEE0ED]/80">
                    <div>
                      <span className="font-bold text-[#252943]">Plain-Language Explanation: </span>
                      <span className="text-[#252943]/80 font-medium">{alert.reason}</span>
                    </div>

                    {alert.suggestedAction && (
                      <div>
                        <span className="font-bold text-[#3A4EFB]">Suggested Action: </span>
                        <span className="text-[#252943]/80 font-medium">{alert.suggestedAction}</span>
                      </div>
                    )}

                    {alert.run && (
                      <div className="text-[11px] text-[#252943]/70 pt-1 border-t border-[#DEE0ED]/40 flex flex-wrap gap-4">
                        <span>
                          Planned Quantity: <strong>{alert.run.quantity}</strong>
                        </span>
                        <span>
                          Delivered Quantity:{" "}
                          <strong className="text-emerald-600">{alert.run.deliveredQuantity}</strong>
                        </span>
                        <span>
                          Lateness: <strong>{alert.run.latenessSeconds}s</strong>
                        </span>
                        {alert.run.providerOrderId && (
                          <span>
                            Upstream Order ID: <strong>{alert.run.providerOrderId}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Last Response (Secrets Stripped) Dropdown */}
                  {alert.run?.rawResponse && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setExpandedAlertId(isExpanded ? null : alert.id)}
                        className="flex items-center gap-1 text-[11px] font-bold text-[#3A4EFB] hover:underline"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        <span>{isExpanded ? "Hide Upstream Response Payload" : "View Upstream Response Payload (Secrets Removed)"}</span>
                      </button>

                      {isExpanded && (
                        <pre className="mt-2 p-2.5 rounded-xl bg-gray-900 text-gray-100 font-mono text-[10px] overflow-x-auto max-h-40">
                          {alert.run.rawResponse}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Operator Actions Buttons (Change J) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#DEE0ED]/60">
                    <span className="text-[10px] text-[#252943]/50">
                      Operator Controls (RLS Enforced)
                    </span>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Retry Now */}
                      {alert.runId && alert.status !== "resolved" && (
                        <button
                          type="button"
                          onClick={() => handleAlertAction(alert.id, "retry_run")}
                          disabled={actionLoadingId !== null}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#3A4EFB] text-white text-[11px] font-bold hover:bg-[#2A3DE0] disabled:opacity-50"
                        >
                          {actionLoadingId === `${alert.id}-retry_run` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          <span>Retry now</span>
                        </button>
                      )}

                      {/* Re-Plan */}
                      {alert.orderId && alert.status !== "resolved" && (
                        <button
                          type="button"
                          onClick={() => handleAlertAction(alert.id, "replan")}
                          disabled={actionLoadingId !== null}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-[11px] font-bold hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {actionLoadingId === `${alert.id}-replan` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          <span>Re-plan</span>
                        </button>
                      )}

                      {/* Refund */}
                      {alert.orderId && alert.status !== "resolved" && (
                        <button
                          type="button"
                          onClick={() => handleAlertAction(alert.id, "refund")}
                          disabled={actionLoadingId !== null}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700 disabled:opacity-50"
                        >
                          {actionLoadingId === `${alert.id}-refund` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          <span>Refund</span>
                        </button>
                      )}

                      {/* Pause Provider */}
                      {alert.providerId && alert.status !== "resolved" && (
                        <button
                          type="button"
                          onClick={() => handleAlertAction(alert.id, "pause_provider")}
                          disabled={actionLoadingId !== null}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-[11px] font-bold hover:bg-amber-600 disabled:opacity-50"
                        >
                          {actionLoadingId === `${alert.id}-pause_provider` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <PauseCircle className="w-3 h-3" />
                          )}
                          <span>Pause provider</span>
                        </button>
                      )}

                      {/* Resolve */}
                      {alert.status !== "resolved" && (
                        <button
                          type="button"
                          onClick={() => handleAlertAction(alert.id, "resolve")}
                          disabled={actionLoadingId !== null}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#DEE0ED] bg-white text-[#252943] text-[11px] font-bold hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 disabled:opacity-50"
                        >
                          {actionLoadingId === `${alert.id}-resolve` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          )}
                          <span>Resolve</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

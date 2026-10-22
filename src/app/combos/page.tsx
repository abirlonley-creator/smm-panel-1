"use client";

import { useState, useEffect } from "react";
import { 
  Boxes, 
  Plus, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RotateCcw, 
  Copy, 
  Trash2, 
  Edit3, 
  ChevronRight, 
  ExternalLink,
  Loader2,
  Check,
  Send,
  Zap,
  ArrowRight,
  ShieldAlert,
  Search
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ServiceItem {
  id: string;
  externalId: string;
  name: string;
  platform: string;
  minQuantity: number;
  maxQuantity: number;
  ratePer1000: number;
}

interface ComboItem {
  id: string;
  serviceId: string;
  defaultQuantity: number;
  targetType: "SAME_URL" | "CUSTOM_URL";
  customUrl?: string | null;
  service: ServiceItem;
}

interface Combo {
  id: string;
  comboRef: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  items: ComboItem[];
  _count?: { executions: number };
}

interface ComboExecution {
  id: string;
  executionRef: string;
  targetUrl: string;
  status: string;
  totalCost: number;
  totalServices: number;
  successfulServices: number;
  failedServices: number;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  combo: { name: string; comboRef: string };
  orders: {
    id: string;
    orderRef: string;
    requestedQuantity: number;
    status: string;
    providerOrderId: string | null;
    errorMessage: string | null;
    service: { name: string; externalId: string };
  }[];
}

export default function ComboOrdersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"combos" | "history">("combos");

  const [combos, setCombos] = useState<Combo[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [executions, setExecutions] = useState<ComboExecution[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingComboId, setEditingComboId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<Combo | null>(null);
  const [showExecuteModal, setShowExecuteModal] = useState<Combo | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formItems, setFormItems] = useState<
    { serviceId: string; defaultQuantity: number; targetType: "SAME_URL" | "CUSTOM_URL"; customUrl: string }[]
  >([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [serviceSearchTerm, setServiceSearchTerm] = useState("");

  // Execution modal state
  const [execTargetUrl, setExecTargetUrl] = useState("");
  const [execCustomUrls, setExecCustomUrls] = useState<Record<string, string>>({});
  const [execCustomQtys, setExecCustomQtys] = useState<Record<string, number>>({});
  const [executing, setExecuting] = useState(false);
  const [execError, setExecError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      const [combosRes, servicesRes, execsRes] = await Promise.all([
        fetch("/api/combos"),
        fetch("/api/services"),
        fetch("/api/combos/executions"),
      ]);

      const combosData = await combosRes.json();
      const servicesData = await servicesRes.json();
      const execsData = await execsRes.json();

      if (combosData.success) setCombos(combosData.combos);
      if (servicesData.success) setServices(servicesData.services);
      if (execsData.success) setExecutions(execsData.executions);
    } catch (err) {
      console.error("Failed to load combos data", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreateModal() {
    setEditingComboId(null);
    setFormName("");
    setFormDescription("");
    setServiceSearchTerm("");
    if (services.length >= 2) {
      setFormItems([
        { serviceId: services[0].id, defaultQuantity: services[0].minQuantity, targetType: "SAME_URL", customUrl: "" },
        { serviceId: services[1].id, defaultQuantity: services[1].minQuantity, targetType: "SAME_URL", customUrl: "" },
      ]);
    } else {
      setFormItems([]);
    }
    setFormError(null);
    setShowCreateModal(true);
  }

  function openEditModal(combo: Combo) {
    setEditingComboId(combo.id);
    setFormName(combo.name);
    setFormDescription(combo.description || "");
    setServiceSearchTerm("");
    setFormItems(
      combo.items.map((it) => ({
        serviceId: it.serviceId,
        defaultQuantity: it.defaultQuantity,
        targetType: it.targetType,
        customUrl: it.customUrl || "",
      }))
    );
    setFormError(null);
    setShowCreateModal(true);
  }

  function addServiceToForm() {
    if (formItems.length >= 5) return;
    const selectedIds = new Set(formItems.map((i) => i.serviceId));
    const nextAvail = services.find((s) => !selectedIds.has(s.id));
    if (!nextAvail) return;

    setFormItems([
      ...formItems,
      { serviceId: nextAvail.id, defaultQuantity: nextAvail.minQuantity, targetType: "SAME_URL", customUrl: "" },
    ]);
  }

  function removeServiceFromForm(index: number) {
    if (formItems.length <= 2) {
      setFormError("A combo must contain at least 2 services.");
      return;
    }
    const updated = [...formItems];
    updated.splice(index, 1);
    setFormItems(updated);
  }

  async function handleSaveCombo(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError("Combo name is required.");
      return;
    }

    if (formItems.length < 2 || formItems.length > 5) {
      setFormError("A combo must contain between 2 and 5 distinct services.");
      return;
    }

    // Check duplicate service selection
    const ids = formItems.map((i) => i.serviceId);
    if (new Set(ids).size !== ids.length) {
      setFormError("Duplicate services detected. Each service must be distinct.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        items: formItems.map((item, idx) => ({
          serviceId: item.serviceId,
          defaultQuantity: Number(item.defaultQuantity),
          targetType: item.targetType,
          customUrl: item.targetType === "CUSTOM_URL" ? item.customUrl : undefined,
          orderIndex: idx,
        })),
      };

      const url = editingComboId ? `/api/combos/${editingComboId}` : "/api/combos";
      const method = editingComboId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save combo");
      }

      setShowCreateModal(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || "Failed to save combo definition");
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate(id: string) {
    try {
      const res = await fetch(`/api/combos/${id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        await loadData();
      }
    } catch (err) {
      console.error("Duplicate failed", err);
    }
  }

  async function handleToggleActive(combo: Combo) {
    try {
      const res = await fetch(`/api/combos/${combo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !combo.active }),
      });
      if (res.ok) await loadData();
    } catch (err) {
      console.error("Failed to toggle status", err);
    }
  }

  async function handleDelete() {
    if (!showDeleteModal) return;
    try {
      const res = await fetch(`/api/combos/${showDeleteModal.id}`, { method: "DELETE" });
      if (res.ok) {
        setShowDeleteModal(null);
        await loadData();
      }
    } catch (err) {
      console.error("Delete failed", err);
    }
  }

  function openExecuteModal(combo: Combo) {
    setShowExecuteModal(combo);
    setExecTargetUrl("");
    setExecCustomUrls({});
    const initialQtys: Record<string, number> = {};
    combo.items.forEach((it) => {
      initialQtys[it.serviceId] = it.defaultQuantity;
    });
    setExecCustomQtys(initialQtys);
    setExecError(null);
  }

  async function handleExecuteCombo(e: React.FormEvent) {
    e.preventDefault();
    if (!showExecuteModal) return;

    if (!execTargetUrl.trim()) {
      setExecError("Target URL is required.");
      return;
    }

    setExecuting(true);
    setExecError(null);

    try {
      const res = await fetch("/api/combos/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comboId: showExecuteModal.id,
          targetUrl: execTargetUrl.trim(),
          customServiceUrls: execCustomUrls,
          customQuantities: execCustomQtys,
        }),
      });

      const data = await res.json();
      if (!res.ok && !data.success) {
        throw new Error(data.error || "Execution failed");
      }

      setShowExecuteModal(null);
      setActiveTab("history");
      await loadData();
    } catch (err: any) {
      setExecError(err.message || "Failed to execute combo order");
    } finally {
      setExecuting(false);
    }
  }

  async function handleRetry(executionId: string) {
    setRetryingId(executionId);
    try {
      const res = await fetch(`/api/combos/executions/${executionId}/retry`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
      }
    } catch (err) {
      console.error("Retry failed", err);
    } finally {
      setRetryingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-xs text-[#252943]/60 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#3A4EFB]" />
        <span>Loading Combo Orders system...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#DEE0ED]">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs text-[#252943]/60 mb-1">
            <Link href="/" className="hover:text-[#3A4EFB]">Dashboard</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/order" className="hover:text-[#3A4EFB]">New Order</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>Combo Orders</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#252943] flex items-center gap-2">
            <Boxes className="w-6 h-6 text-[#3A4EFB]" />
            Combo Orders & Maker
          </h1>
          <p className="text-xs sm:text-sm text-[#252943]/60 mt-0.5">
            Configure multi-service bundles (2–5 services) that execute coordinated child orders with automated tracking.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-xs font-semibold transition-all press-scale flex items-center gap-2 shadow-subtle self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-[#E3FF3B]" />
          <span>Create New Combo</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#DEE0ED]">
        <button
          onClick={() => setActiveTab("combos")}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 px-3 ${
            activeTab === "combos"
              ? "border-[#3A4EFB] text-[#3A4EFB]"
              : "border-transparent text-[#252943]/60 hover:text-[#252943]"
          }`}
        >
          Combo Definitions ({combos.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 px-3 ${
            activeTab === "history"
              ? "border-[#3A4EFB] text-[#3A4EFB]"
              : "border-transparent text-[#252943]/60 hover:text-[#252943]"
          }`}
        >
          Execution History ({executions.length})
        </button>
      </div>

      {/* TAB 1: COMBO DEFINITIONS */}
      {activeTab === "combos" && (
        <div className="space-y-4">
          {combos.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-[#DEE0ED] space-y-3">
              <Boxes className="w-10 h-10 text-[#3A4EFB]/40 mx-auto" />
              <h3 className="text-sm font-semibold text-[#252943]">No Combos Configured Yet</h3>
              <p className="text-xs text-[#252943]/60 max-w-sm mx-auto">
                Create your first combo with 2 to 5 services to submit all coordinated orders with a single click.
              </p>
              <button
                onClick={openCreateModal}
                className="mt-2 px-4 py-2 rounded-xl bg-[#3A4EFB] text-white text-xs font-semibold press-scale inline-flex items-center gap-1.5 shadow-subtle"
              >
                <Plus className="w-3.5 h-3.5 text-[#E3FF3B]" />
                Create Combo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {combos.map((combo) => {
                const totalEstimatedRate = combo.items.reduce(
                  (sum, it) => sum + (it.defaultQuantity / 1000) * it.service.ratePer1000,
                  0
                );

                return (
                  <div
                    key={combo.id}
                    className={`bg-white rounded-2xl border p-5 shadow-subtle space-y-4 flex flex-col justify-between transition-all ${
                      combo.active ? "border-[#DEE0ED]" : "border-[#DEE0ED]/50 opacity-70"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#252943] text-white">
                              {combo.comboRef}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                combo.active
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {combo.active ? "Active" : "Disabled"}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-[#252943] mt-1.5 tracking-tight">
                            {combo.name}
                          </h3>
                        </div>

                        <span className="text-xs font-bold text-[#3A4EFB] bg-[#3A4EFB]/10 px-2.5 py-1 rounded-lg shrink-0">
                          {combo.items.length} Services
                        </span>
                      </div>

                      {combo.description && (
                        <p className="text-xs text-[#252943]/70 line-clamp-2 font-normal">
                          {combo.description}
                        </p>
                      )}

                      {/* Items List */}
                      <div className="space-y-2 pt-2 border-t border-[#DEE0ED]/60">
                        <span className="text-[10px] uppercase font-bold text-[#252943]/50 tracking-wider block">
                          Included Services
                        </span>
                        <div className="space-y-1.5">
                          {combo.items.map((it) => (
                            <div
                              key={it.id}
                              className="text-xs bg-[#F8F9FD] p-2 rounded-lg flex items-center justify-between border border-[#DEE0ED]/60"
                            >
                              <div className="truncate mr-2">
                                <span className="font-bold text-[#252943]">
                                  #{it.service.externalId}
                                </span>{" "}
                                <span className="text-[#252943]/80">{it.service.name}</span>
                              </div>
                              <span className="font-semibold text-[#3A4EFB] shrink-0 text-[11px]">
                                {it.defaultQuantity.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between text-xs pt-2">
                        <span className="text-[#252943]/60">Default Cost:</span>
                        <span className="font-extrabold text-[#252943] text-sm">
                          ₹{totalEstimatedRate.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-[#DEE0ED] flex items-center justify-between gap-1">
                      <button
                        onClick={() => openExecuteModal(combo)}
                        disabled={!combo.active}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 press-scale ${
                          combo.active
                            ? "bg-[#3A4EFB] text-white hover:bg-[#2C3FE0]"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        <Send className="w-3 h-3 text-[#E3FF3B]" />
                        <span>Order Now</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleActive(combo)}
                          title={combo.active ? "Disable combo" : "Enable combo"}
                          className="p-1.5 rounded-lg text-[#252943]/60 hover:text-[#252943] hover:bg-[#F8F9FD]"
                        >
                          <Zap className={`w-3.5 h-3.5 ${combo.active ? "text-emerald-600" : "text-gray-400"}`} />
                        </button>
                        <button
                          onClick={() => handleDuplicate(combo.id)}
                          title="Duplicate combo"
                          className="p-1.5 rounded-lg text-[#252943]/60 hover:text-[#252943] hover:bg-[#F8F9FD]"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(combo)}
                          title="Edit combo"
                          className="p-1.5 rounded-lg text-[#252943]/60 hover:text-[#252943] hover:bg-[#F8F9FD]"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setShowDeleteModal(combo)}
                          title="Delete combo"
                          className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EXECUTION HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {executions.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-[#DEE0ED] text-xs text-[#252943]/60">
              No combo executions recorded yet.
            </div>
          ) : (
            <div className="space-y-4">
              {executions.map((exec) => (
                <div
                  key={exec.id}
                  className="bg-white rounded-2xl border border-[#DEE0ED] p-5 shadow-subtle space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[#DEE0ED]">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold text-white bg-[#252943] px-2.5 py-1 rounded-md">
                        {exec.executionRef}
                      </span>
                      <h4 className="text-sm font-bold text-[#252943]">{exec.combo.name}</h4>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md ${
                          exec.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : exec.status === "PARTIAL"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : exec.status === "FAILED"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {exec.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#252943]/60">
                      <span>Total: ₹{exec.totalCost.toFixed(2)}</span>
                      <span>•</span>
                      <span>{new Date(exec.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="text-xs text-[#252943]/70 truncate">
                    <span className="font-semibold text-[#252943]">Target URL: </span>
                    <a
                      href={exec.targetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#3A4EFB] hover:underline"
                    >
                      {exec.targetUrl}
                    </a>
                  </div>

                  {/* Child Orders Table */}
                  <div className="overflow-x-auto rounded-xl border border-[#DEE0ED]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8F9FD] text-[#252943]/60 uppercase text-[10px] font-bold border-b border-[#DEE0ED]">
                        <tr>
                          <th className="px-3 py-2">Child Order</th>
                          <th className="px-3 py-2">Service</th>
                          <th className="px-3 py-2">Quantity</th>
                          <th className="px-3 py-2">Provider Ref</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DEE0ED]/60">
                        {exec.orders.map((ord) => (
                          <tr key={ord.id} className="hover:bg-[#F8F9FD]/50">
                            <td className="px-3 py-2 font-mono font-semibold text-[#252943]">
                              {ord.orderRef}
                            </td>
                            <td className="px-3 py-2">
                              #{ord.service.externalId} — {ord.service.name}
                            </td>
                            <td className="px-3 py-2 font-bold text-[#252943]">
                              {ord.requestedQuantity.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 font-mono text-[#252943]/70">
                              {ord.providerOrderId ? `#${ord.providerOrderId}` : "—"}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  ord.status === "COMPLETED" || ord.status === "PROCESSING"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-red-50 text-red-700"
                                }`}
                              >
                                {ord.status}
                              </span>
                              {ord.errorMessage && (
                                <p className="text-[10px] text-red-600 mt-0.5">
                                  {ord.errorMessage}
                                </p>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Partial failure retry action */}
                  {(exec.status === "PARTIAL" || exec.status === "FAILED") && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                      <div className="flex items-center gap-1.5 text-amber-800">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>One or more child services failed. Re-attempt without duplicate submission?</span>
                      </div>
                      <button
                        onClick={() => handleRetry(exec.id)}
                        disabled={retryingId === exec.id}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold press-scale flex items-center gap-1 text-[11px]"
                      >
                        <RotateCcw className={`w-3 h-3 ${retryingId === exec.id ? "animate-spin" : ""}`} />
                        <span>Retry Failed Orders</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT COMBO MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-[#252943]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-[#DEE0ED] p-6 shadow-dropdown space-y-5 animate-scaleUp max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
              <h3 className="text-base font-bold text-[#252943] flex items-center gap-2">
                <Boxes className="w-5 h-5 text-[#3A4EFB]" />
                {editingComboId ? "Edit Combo Definition" : "Create New Combo Bundle"}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#252943]/40 hover:text-[#252943] text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCombo} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#252943]">Combo Name</label>
                <input
                  type="text"
                  placeholder="e.g. Viral Launch Pack (Views + Likes + Saves)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2 text-xs text-[#252943] focus:border-[#3A4EFB] focus:bg-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#252943]">Description (Optional)</label>
                <textarea
                  placeholder="Notes or strategy for this combo..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2 text-xs text-[#252943] focus:border-[#3A4EFB] focus:bg-white"
                />
              </div>

              {/* Items Section */}
              <div className="space-y-3 pt-2 border-t border-[#DEE0ED]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#252943]">
                    Included Services ({formItems.length} of max 5)
                  </label>
                  {formItems.length < 5 && (
                    <button
                      type="button"
                      onClick={addServiceToForm}
                      className="text-xs font-bold text-[#3A4EFB] hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Service
                    </button>
                  )}
                </div>

                {/* Service Catalog Quick Filter & Search Button */}
                <div className="bg-[#F8F9FD] p-2.5 rounded-xl border border-[#DEE0ED] space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#252943]/40" />
                      <input
                        type="text"
                        placeholder="Search service by name, platform, or ID..."
                        value={serviceSearchTerm}
                        onChange={(e) => setServiceSearchTerm(e.target.value)}
                        className="w-full bg-white border border-[#DEE0ED] rounded-lg pl-7 pr-3 py-1.5 text-xs text-[#252943] focus:border-[#3A4EFB]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {/* keeps filter active */}}
                      className="px-3 py-1.5 rounded-lg bg-[#252943] hover:bg-[#1A1D31] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all press-scale"
                    >
                      <Search className="w-3.5 h-3.5 text-[#E3FF3B]" />
                      <span>Search</span>
                    </button>
                    {serviceSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setServiceSearchTerm("")}
                        className="text-xs text-[#252943]/60 hover:text-[#252943] px-1.5 py-1"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {serviceSearchTerm && (
                    <p className="text-[11px] text-[#3A4EFB] font-medium flex items-center gap-1">
                      Showing matches for &quot;{serviceSearchTerm}&quot; ({services.filter(s => s.name.toLowerCase().includes(serviceSearchTerm.toLowerCase()) || s.externalId.includes(serviceSearchTerm) || s.platform.toLowerCase().includes(serviceSearchTerm.toLowerCase())).length} found)
                    </p>
                  )}
                </div>

                <div className="space-y-2.5">
                  {formItems.map((item, idx) => {
                    const srv = services.find((s) => s.id === item.serviceId);
                    const matchingServices = serviceSearchTerm.trim()
                      ? services.filter(
                          (s) =>
                            s.id === item.serviceId ||
                            s.name.toLowerCase().includes(serviceSearchTerm.toLowerCase()) ||
                            s.externalId.includes(serviceSearchTerm) ||
                            s.platform.toLowerCase().includes(serviceSearchTerm.toLowerCase())
                        )
                      : services;

                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-2.5 transition-all duration-300 ease-out animate-fadeIn shadow-subtle hover:border-[#3A4EFB]/40"
                      >
                        <div className="flex items-center justify-between gap-3 min-w-0">
                          {/* Number 1, 2, 3 in vibrant visible blue */}
                          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-[#3A4EFB] font-extrabold text-sm flex items-center justify-center shrink-0 shadow-sm">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <select
                              value={item.serviceId}
                              onChange={(e) => {
                                const newItems = [...formItems];
                                newItems[idx].serviceId = e.target.value;
                                const matched = services.find((s) => s.id === e.target.value);
                                if (matched) newItems[idx].defaultQuantity = matched.minQuantity;
                                setFormItems(newItems);
                              }}
                              className="w-full max-w-full truncate overflow-hidden bg-white border border-[#DEE0ED] rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#252943] focus:border-[#3A4EFB]"
                            >
                              {matchingServices.map((s) => (
                                <option key={s.id} value={s.id}>
                                  #{s.externalId} — [{s.platform}] {s.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {formItems.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeServiceFromForm(idx)}
                              className="text-red-500 hover:text-red-700 p-1.5 rounded shrink-0 transition-colors"
                              title="Remove service"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-[#252943]/60 block mb-0.5">
                              Default Quantity (Allowed: {srv?.minQuantity.toLocaleString()}–{srv?.maxQuantity.toLocaleString()})
                            </span>
                            <input
                              type="number"
                              min={srv?.minQuantity || 1}
                              max={srv?.maxQuantity || 100000}
                              value={item.defaultQuantity}
                              onChange={(e) => {
                                const newItems = [...formItems];
                                newItems[idx].defaultQuantity = parseInt(e.target.value, 10) || 0;
                                setFormItems(newItems);
                              }}
                              className="w-full bg-white border border-[#DEE0ED] rounded-lg px-2.5 py-1 text-xs font-semibold"
                            />
                          </div>

                          <div>
                            <span className="text-[10px] text-[#252943]/60 block mb-0.5">
                              Target Link Requirement
                            </span>
                            <select
                              value={item.targetType}
                              onChange={(e) => {
                                const newItems = [...formItems];
                                newItems[idx].targetType = e.target.value as any;
                                setFormItems(newItems);
                              }}
                              className="w-full bg-white border border-[#DEE0ED] rounded-lg px-2 py-1 text-xs"
                            >
                              <option value="SAME_URL">Shared Target Link</option>
                              <option value="CUSTOM_URL">Custom URL Per Order</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-[#DEE0ED]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl border border-[#DEE0ED] text-xs font-semibold text-[#252943] hover:bg-[#F8F9FD]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-xs font-semibold press-scale flex items-center justify-center gap-1.5 shadow-subtle"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#E3FF3B]" />
                      Save Combo
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXECUTE COMBO MODAL */}
      {showExecuteModal && (
        <div className="fixed inset-0 z-50 bg-[#252943]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#DEE0ED] p-6 shadow-dropdown space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
              <div>
                <span className="text-[10px] font-bold text-white bg-[#252943] px-2 py-0.5 rounded">
                  {showExecuteModal.comboRef}
                </span>
                <h3 className="text-base font-bold text-[#252943] mt-1">
                  Order Combo: {showExecuteModal.name}
                </h3>
              </div>
              <button
                onClick={() => setShowExecuteModal(null)}
                className="text-[#252943]/40 hover:text-[#252943] text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {execError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{execError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteCombo} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#252943]">
                  Target Link (Video, Post, or Profile)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={execTargetUrl}
                  onChange={(e) => setExecTargetUrl(e.target.value)}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2 text-xs text-[#252943] focus:border-[#3A4EFB] focus:bg-white"
                  required
                />
              </div>

              {/* Service Quantities Review */}
              <div className="space-y-2 pt-2 border-t border-[#DEE0ED]">
                <label className="text-xs font-bold text-[#252943] block">
                  Verify Child Quantities
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {showExecuteModal.items.map((it) => (
                    <div
                      key={it.id}
                      className="p-2.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] flex items-center justify-between text-xs"
                    >
                      <div className="truncate mr-2">
                        <span className="font-bold text-[#252943]">#{it.service.externalId}</span>{" "}
                        <span>{it.service.name}</span>
                      </div>
                      <input
                        type="number"
                        min={it.service.minQuantity}
                        max={it.service.maxQuantity}
                        value={execCustomQtys[it.serviceId] ?? it.defaultQuantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setExecCustomQtys({ ...execCustomQtys, [it.serviceId]: val });
                        }}
                        className="w-24 bg-white border border-[#DEE0ED] rounded px-2 py-1 text-xs font-bold text-right"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-[#DEE0ED]">
                <button
                  type="button"
                  onClick={() => setShowExecuteModal(null)}
                  disabled={executing}
                  className="flex-1 py-2.5 rounded-xl border border-[#DEE0ED] text-xs font-semibold text-[#252943] hover:bg-[#F8F9FD]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={executing}
                  className="flex-1 py-2.5 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-xs font-semibold press-scale flex items-center justify-center gap-1.5 shadow-subtle"
                >
                  {executing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Submitting Combo...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 text-[#E3FF3B]" />
                      Submit {showExecuteModal.items.length} Child Orders
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-[#252943]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-[#DEE0ED] p-6 shadow-dropdown space-y-4 animate-scaleUp">
            <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>Delete Combo Definition</span>
            </div>
            <p className="text-xs text-[#252943]/70 leading-relaxed">
              Are you sure you want to delete combo <strong>"{showDeleteModal.name}"</strong>? Past executions will remain preserved in history.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="flex-1 py-2 rounded-xl border border-[#DEE0ED] text-xs font-semibold text-[#252943]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold press-scale"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import {
  Layers,
  PlusCircle,
  RefreshCw,
  Trash2,
  Check,
  AlertCircle,
  Save,
  Tag,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
} from "lucide-react";

interface ServiceItem {
  id: string;
  service: number | string;
  numericId?: number;
  externalId?: string;
  name: string;
  platform: string;
  category: string;
  type: string;
  ratePer1000: number;
  minQuantity: number;
  maxQuantity: number;
  description: string;
  active: boolean;
}

export function EngagementServicesManager() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Service Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPlatform, setNewPlatform] = useState("TikTok");
  const [newType, setNewType] = useState("views");
  const [newRate, setNewRate] = useState("5.70");
  const [newMin, setNewMin] = useState("100");
  const [newMax, setNewMax] = useState("1000000");
  const [newDesc, setNewDesc] = useState("");
  const [newServiceId, setNewServiceId] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadServices() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/engagement-services");
      const data = await res.json();
      if (data.success && Array.isArray(data.services)) {
        setServices(data.services);
      } else {
        setErrorMsg(data.error || "Failed to load services");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadServices();
  }, []);

  async function handleCreateService(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    setCreating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/admin/engagement-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          platform: newPlatform.trim(),
          category: "Engagement",
          type: newType.trim(),
          rate: Number(newRate),
          min: Number(newMin),
          max: Number(newMax),
          description: newDesc.trim(),
          serviceId: newServiceId ? Number(newServiceId) : undefined,
          active: true,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Service '${data.service.name}' added successfully! It is now live in GET /api/v2/services.`);
        setShowAddForm(false);
        setNewName("");
        setNewDesc("");
        setNewServiceId("");
        loadServices();
      } else {
        setErrorMsg(data.error || "Failed to create service");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create service");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(s: ServiceItem) {
    setSavingId(s.id);
    try {
      const res = await fetch(`/api/admin/engagement-services/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !s.active }),
      });
      const data = await res.json();
      if (data.success) {
        setServices((prev) =>
          prev.map((item) => (item.id === s.id ? { ...item, active: !s.active } : item))
        );
      } else {
        alert(data.error || "Failed to update service status");
      }
    } catch (err: any) {
      alert(err.message || "Failed to update service status");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(s: ServiceItem) {
    if (!confirm(`Are you sure you want to delete '${s.name}'?`)) return;

    setSavingId(s.id);
    try {
      const res = await fetch(`/api/admin/engagement-services/${s.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setServices((prev) => prev.filter((item) => item.id !== s.id));
        setSuccessMsg(`Service '${s.name}' deleted.`);
      } else {
        alert(data.error || "Failed to delete service");
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete service");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="p-6 rounded-3xl border border-[#DEE0ED] bg-white space-y-5 shadow-subtle">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DEE0ED]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#3A4EFB] text-white flex items-center justify-center font-black shadow-subtle shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-[#252943]">
                Universal Engagement Services & API Catalog
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-[#3A4EFB] text-[10px] font-black uppercase">
                Live DB
              </span>
            </div>
            <p className="text-xs text-[#252943]/70">
              Direct source for the Engagement Tab & Universal API v2. When you add, edit, or toggle a service here, it updates the API and dashboard instantaneously.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadServices}
            disabled={loading}
            className="p-2 rounded-xl border border-[#DEE0ED] hover:bg-[#F8F9FD] text-[#252943] text-xs font-bold"
            title="Refresh Services"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3.5 py-2 rounded-xl bg-[#3A4EFB] hover:bg-[#3244db] text-white text-xs font-bold transition-all shadow-subtle flex items-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5 text-[#E3FF3B]" />
            <span>{showAddForm ? "Close Form" : "Add New Service"}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Add New Service Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateService}
          className="p-5 rounded-2xl bg-[#F8F9FD] border-2 border-[#3A4EFB]/30 space-y-4 animate-scaleIn"
        >
          <div className="flex items-center justify-between pb-2 border-b border-[#DEE0ED]">
            <h4 className="text-xs font-black text-[#252943] uppercase tracking-wider">
              Add New Engagement Service
            </h4>
            <span className="text-[10px] text-[#252943]/60">Appears immediately in GET /api/v2/services</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#252943] mb-1">Service Name</label>
              <input
                type="text"
                placeholder="e.g. YouTube Views High Retention"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold text-[#252943] outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#252943] mb-1">Platform</label>
              <input
                type="text"
                placeholder="e.g. YouTube, TikTok, Instagram"
                value={newPlatform}
                onChange={(e) => setNewPlatform(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold text-[#252943] outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#252943] mb-1">Type</label>
              <input
                type="text"
                placeholder="e.g. views, likes, shares, comments"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold text-[#252943] outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#252943] mb-1">Rate per 1,000 (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold text-[#252943] outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#252943] mb-1">Min Quantity</label>
              <input
                type="number"
                min="1"
                value={newMin}
                onChange={(e) => setNewMin(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold text-[#252943] outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#252943] mb-1">Max Quantity</label>
              <input
                type="number"
                min="10"
                value={newMax}
                onChange={(e) => setNewMax(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold text-[#252943] outline-none font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-[#252943] mb-1">Description</label>
              <input
                type="text"
                placeholder="e.g. High retention organic views"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold text-[#252943] outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#252943] mb-1">Custom Service ID (Optional)</label>
              <input
                type="number"
                placeholder="Auto-assigned if empty (e.g. 105)"
                value={newServiceId}
                onChange={(e) => setNewServiceId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold text-[#252943] outline-none font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#DEE0ED]">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3.5 py-1.5 rounded-xl border border-[#DEE0ED] text-xs font-bold text-[#252943]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-1.5 rounded-xl bg-[#3A4EFB] text-white text-xs font-bold hover:bg-[#3244db] disabled:opacity-50"
            >
              {creating ? "Adding..." : "Add Service"}
            </button>
          </div>
        </form>
      )}

      {/* Services Table */}
      <div className="rounded-2xl border border-[#DEE0ED] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8F9FD] border-b border-[#DEE0ED] text-[#252943]/70 uppercase text-[10px] font-bold">
              <tr>
                <th className="px-4 py-3">Service ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Rate / 1k</th>
                <th className="px-4 py-3">Min / Max</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DEE0ED]">
              {services.map((s) => (
                <tr key={s.id} className="hover:bg-[#F8F9FD]/60">
                  <td className="px-4 py-2.5 font-mono font-bold text-[#3A4EFB]">
                    #{s.service}
                  </td>
                  <td className="px-4 py-2.5 font-bold text-[#252943]">
                    {s.name}
                  </td>
                  <td className="px-4 py-2.5 text-[#252943]/80">{s.platform}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-[#252943]/70">
                    {s.type}
                  </td>
                  <td className="px-4 py-2.5 font-mono font-bold text-[#252943]">
                    ${Number(s.ratePer1000).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-[#252943]/70">
                    {s.minQuantity.toLocaleString()} - {s.maxQuantity.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(s)}
                      disabled={savingId === s.id}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all cursor-pointer ${
                        s.active
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                      title="Click to toggle active status"
                    >
                      {s.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(s)}
                      disabled={savingId === s.id}
                      className="p-1 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete Service"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

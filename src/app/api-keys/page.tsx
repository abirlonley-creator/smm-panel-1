"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  KeyRound,
  PlusCircle,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Ban,
  ShieldCheck,
  Zap,
  Terminal,
  Activity,
  ArrowRight,
  Clock,
  Eye,
  FileCode2,
  Layers,
} from "lucide-react";

interface ApiKeyItem {
  id: string;
  name: string;
  maskedKey: string;
  permission: "FULL_ACCESS" | "READ_ONLY";
  status: "ACTIVE" | "REVOKED";
  lastUsedAt: string | null;
  totalOrders: number;
  totalRequests: number;
  createdAt: string;
}

interface ApiLogItem {
  id: string;
  keyName: string;
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  success: boolean;
  error?: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [logs, setLogs] = useState<ApiLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [permission, setPermission] = useState<"FULL_ACCESS" | "READ_ONLY">("FULL_ACCESS");
  const [creating, setCreating] = useState(false);

  // Plain Key Display Modal (Only Once)
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch("/api/user/keys");
      const data = await res.json();
      if (data.success) {
        setKeys(data.keys || []);
        setLogs(data.logs || []);
      } else {
        setErrorMsg(data.error || "Failed to load API keys");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!keyName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/user/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName.trim(), permission }),
      });
      const data = await res.json();
      if (data.success && data.plainKey) {
        setRevealedKey(data.plainKey);
        setShowCreateModal(false);
        setKeyName("");
        loadData();
      } else {
        alert(data.error || "Failed to create key");
      }
    } catch (err: any) {
      alert(err.message || "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Are you sure you want to revoke this API key? Any active AI or script using it will stop working immediately.")) {
      return;
    }
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/user/keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || "Failed to revoke key");
      }
    } catch (err: any) {
      alert(err.message || "Failed to revoke key");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleRegenerate(id: string) {
    if (!confirm("Regenerating this key will immediately revoke the current key and issue a brand-new secret. Proceed?")) {
      return;
    }
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/user/keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate" }),
      });
      const data = await res.json();
      if (data.success && data.plainKey) {
        setRevealedKey(data.plainKey);
        loadData();
      } else {
        alert(data.error || "Failed to regenerate key");
      }
    } catch (err: any) {
      alert(err.message || "Failed to regenerate key");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to permanently delete this API key? This action cannot be undone.")) {
      return;
    }
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/user/keys/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || "Failed to delete key");
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete key");
    } finally {
      setActionLoadingId(null);
    }
  }

  function copyPlainKey() {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 animate-fadeIn">
      {/* Top Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#252943] text-white shadow-xl relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3A4EFB]/20 border border-[#3A4EFB]/40 text-xs font-semibold text-[#E3FF3B]">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Developer & AI Credentials</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            API Keys & Access Management
          </h1>
          <p className="text-sm text-[#DEE0ED]/80 max-w-xl">
            Create and manage secret API keys for automated AI agents (Muse, ChatGPT, Gemini, Claude) or your custom applications.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 z-10">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-[#3A4EFB] hover:bg-[#3244db] text-white text-xs font-bold transition-all shadow-subtle flex items-center gap-2 cursor-pointer press-scale"
          >
            <PlusCircle className="w-4 h-4 text-[#E3FF3B]" />
            <span>Create New Key</span>
          </button>
          <Link
            href="/api-docs"
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-all flex items-center gap-2"
          >
            <FileCode2 className="w-4 h-4 text-[#E3FF3B]" />
            <span>View API Docs</span>
          </Link>
        </div>
      </div>

      {/* Secret Key Revealed Modal (ONCE ONLY) */}
      {revealedKey && (
        <div className="fixed inset-0 z-50 bg-[#252943]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full border-2 border-emerald-500 shadow-2xl space-y-5 animate-scaleIn">
            <div className="flex items-center gap-3 pb-3 border-b border-[#DEE0ED]">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#252943]">Your API Key Is Ready</h3>
                <p className="text-xs text-[#252943]/70">Save this secret key now. You will never see it again!</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Security Warning:</strong> We store only a cryptographic hash of this key. If you close this window without saving your key, you will need to regenerate it.
              </span>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-[#252943]/70">Secret API Key:</span>
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#252943] text-white font-mono text-xs break-all gap-2">
                <span className="select-all font-bold text-emerald-400">{revealedKey}</span>
                <button
                  type="button"
                  onClick={copyPlainKey}
                  className="px-3 py-1.5 rounded-lg bg-[#3A4EFB] hover:bg-[#3244db] text-white text-xs font-bold shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-[#E3FF3B]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey ? "Copied!" : "Copy"}</span>
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setRevealedKey(null)}
                className="px-5 py-2.5 rounded-xl bg-[#252943] hover:bg-[#1A1D31] text-white text-xs font-bold transition-all cursor-pointer"
              >
                I Have Saved My Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-[#252943]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateKey}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-[#DEE0ED] shadow-2xl space-y-5 animate-scaleIn"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
              <h3 className="text-base font-black text-[#252943]">Create New API Key</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-xs text-[#252943]/60 hover:text-[#252943]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#252943]">Key Name / Purpose</label>
              <input
                type="text"
                placeholder="e.g. Muse, My Website, SMM Reseller, Test"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DEE0ED] focus:border-[#3A4EFB] text-xs font-semibold text-[#252943] outline-none"
              />
              <span className="text-[11px] text-[#252943]/60">Helps you identify who or what is using this key.</span>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#252943]">Access Permissions</label>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-1 ${
                    permission === "FULL_ACCESS"
                      ? "border-[#3A4EFB] bg-[#3A4EFB]/5 text-[#3A4EFB]"
                      : "border-[#DEE0ED] hover:bg-[#F8F9FD] text-[#252943]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="permission"
                      value="FULL_ACCESS"
                      checked={permission === "FULL_ACCESS"}
                      onChange={() => setPermission("FULL_ACCESS")}
                      className="accent-[#3A4EFB]"
                    />
                    <span className="text-xs font-bold">Full Access</span>
                  </div>
                  <span className="text-[10px] text-[#252943]/70 pl-5">Can read services, balance & place orders.</span>
                </label>

                <label
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-1 ${
                    permission === "READ_ONLY"
                      ? "border-[#3A4EFB] bg-[#3A4EFB]/5 text-[#3A4EFB]"
                      : "border-[#DEE0ED] hover:bg-[#F8F9FD] text-[#252943]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="permission"
                      value="READ_ONLY"
                      checked={permission === "READ_ONLY"}
                      onChange={() => setPermission("READ_ONLY")}
                      className="accent-[#3A4EFB]"
                    />
                    <span className="text-xs font-bold">Read Only</span>
                  </div>
                  <span className="text-[10px] text-[#252943]/70 pl-5">Services, balance & status. Cannot order.</span>
                </label>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#DEE0ED]">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl border border-[#DEE0ED] text-xs font-bold text-[#252943] hover:bg-[#F8F9FD]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !keyName.trim()}
                className="px-4 py-2 rounded-xl bg-[#3A4EFB] hover:bg-[#3244db] text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
              >
                {creating ? "Generating..." : "Generate Key"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active API Keys List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-[#252943] flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#3A4EFB]" />
            <span>Active API Keys ({keys.length})</span>
          </h2>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-1.5 rounded-lg border border-[#DEE0ED] text-[#252943]/70 hover:text-[#3A4EFB] hover:bg-white text-xs font-bold flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {keys.length === 0 && !loading ? (
          <div className="p-10 rounded-3xl bg-white border border-[#DEE0ED] text-center space-y-3 shadow-subtle">
            <div className="w-12 h-12 rounded-2xl bg-[#3A4EFB]/10 text-[#3A4EFB] mx-auto flex items-center justify-center">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#252943]">No API Keys Created Yet</h3>
            <p className="text-xs text-[#252943]/70 max-w-sm mx-auto">
              Generate your first API key to connect automated AI agents, growth bots, or webhooks directly to Aura SMM.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-xl bg-[#3A4EFB] text-white text-xs font-bold shadow-subtle"
            >
              Create API Key
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {keys.map((k) => {
              const isActive = k.status === "ACTIVE";
              const isBusy = actionLoadingId === k.id;
              return (
                <div
                  key={k.id}
                  className={`p-5 rounded-2xl bg-white border transition-all shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isActive ? "border-[#DEE0ED]" : "border-red-200 bg-red-50/20"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-sm text-[#252943]">{k.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          isActive ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {k.status}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          k.permission === "FULL_ACCESS"
                            ? "bg-blue-100 text-[#3A4EFB]"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {k.permission === "FULL_ACCESS" ? "Full Access" : "Read Only"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono text-[#252943]/70">
                      <span className="p-1 px-2 rounded-lg bg-[#F8F9FD] border border-[#DEE0ED] font-semibold text-[#252943]">
                        {k.maskedKey}
                      </span>
                      <span>Created {new Date(k.createdAt).toLocaleDateString()}</span>
                      {k.lastUsedAt && (
                        <span>Last used {new Date(k.lastUsedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  {/* Usage telemetry & Action buttons */}
                  <div className="flex items-center flex-wrap gap-4 text-xs">
                    <div className="flex items-center gap-3 text-center pr-3 border-r border-[#DEE0ED]">
                      <div>
                        <span className="block font-black text-[#252943] text-sm">{k.totalRequests}</span>
                        <span className="text-[10px] text-[#252943]/60 uppercase">Requests</span>
                      </div>
                      <div>
                        <span className="block font-black text-[#3A4EFB] text-sm">{k.totalOrders}</span>
                        <span className="text-[10px] text-[#252943]/60 uppercase">Orders</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isActive && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleRegenerate(k.id)}
                            disabled={isBusy}
                            className="px-3 py-1.5 rounded-xl border border-[#DEE0ED] hover:bg-[#F8F9FD] text-[#252943] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="Regenerate key (stops old key immediately)"
                          >
                            <RefreshCw className="w-3 h-3 text-[#3A4EFB]" />
                            <span>Regenerate</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRevoke(k.id)}
                            disabled={isBusy}
                            className="px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="Revoke key immediately"
                          >
                            <Ban className="w-3 h-3 text-amber-600" />
                            <span>Revoke</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(k.id)}
                        disabled={isBusy}
                        className="p-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                        title="Delete key permanently"
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

      {/* Live Telemetry Log Table */}
      <div className="space-y-4 pt-4 border-t border-[#DEE0ED]">
        <h2 className="text-base font-black text-[#252943] flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#3A4EFB]" />
          <span>Recent API Telemetry Logs</span>
        </h2>

        {logs.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white border border-[#DEE0ED] text-center text-xs text-[#252943]/60 shadow-subtle">
            No API activity logged yet. When AI or clients make requests, they will appear here live.
          </div>
        ) : (
          <div className="rounded-2xl border border-[#DEE0ED] bg-white overflow-hidden shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FD] border-b border-[#DEE0ED] text-[#252943]/70 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Key Name</th>
                    <th className="px-4 py-3">Method & Endpoint</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Latency</th>
                    <th className="px-4 py-3">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DEE0ED]">
                  {logs.slice(0, 25).map((log) => {
                    const isOk = log.statusCode >= 200 && log.statusCode < 300;
                    return (
                      <tr key={log.id} className="hover:bg-[#F8F9FD]/60">
                        <td className="px-4 py-2.5 font-mono text-[11px] text-[#252943]/70">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-[#252943]">{log.keyName}</td>
                        <td className="px-4 py-2.5 font-mono text-[11px]">
                          <span className="font-bold text-[#3A4EFB]">{log.method}</span> {log.endpoint}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              isOk
                                ? "bg-emerald-100 text-emerald-800"
                                : log.statusCode === 429
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {log.statusCode}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-[#252943]/70">
                          {log.durationMs}ms
                        </td>
                        <td className="px-4 py-2.5 text-[11px]">
                          {log.success ? (
                            <span className="text-emerald-700 font-semibold">Success</span>
                          ) : (
                            <span className="text-red-600 font-semibold truncate max-w-xs block" title={log.error || ""}>
                              {log.error || "Failed"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

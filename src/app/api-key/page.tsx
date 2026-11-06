"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  KeyRound,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Server,
  Wallet,
  ArrowRight,
  Eye,
  EyeOff,
  Trash2,
  Check,
  PlusCircle,
  Layers,
} from "lucide-react";

interface ProviderConnection {
  id: string;
  name: string;
  apiUrl: string;
  maskedKey: string;
  currency: string;
  balance: number | null;
  servicesCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
  active: boolean;
  isMock: boolean;
  createdAt: string;
}

export default function ApiKeyPage() {
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);

  // Form State
  const [apiUrl, setApiUrl] = useState("https://justanotherpanel.com/api/v2");
  const [apiKey, setApiKey] = useState("");
  const [providerName, setProviderName] = useState("Main Provider");
  const [currency, setCurrency] = useState("USD");
  const [showKey, setShowKey] = useState(false);

  // Actions state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    balance?: number;
    currency?: string;
    servicesCount?: number;
    error?: string;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function loadProviders() {
    setLoading(true);
    try {
      const [resProv, resBal] = await Promise.all([
        fetch("/api/user/providers"),
        fetch("/api/balance"),
      ]);
      const dataP = await resProv.json();
      const dataB = await resBal.json();

      if (dataP.success && Array.isArray(dataP.connections)) {
        setConnections(dataP.connections);
        const resolvedActiveId =
          dataB.activeProviderId ||
          dataP.connections.find((c: ProviderConnection) => c.active)?.id ||
          dataP.connections[0]?.id ||
          null;
        setActiveProviderId(resolvedActiveId);

        // Pre-fill form name suggestion if user already has 1 provider
        if (dataP.connections.length === 1) {
          setProviderName("Second Provider");
        } else if (dataP.connections.length >= 2) {
          setProviderName(`Provider ${dataP.connections.length + 1}`);
        } else {
          setProviderName("Main Provider");
        }
      }
    } catch (err: any) {
      console.warn("Failed to load provider connections:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProviders();
  }, []);

  async function handleSetActiveProvider(providerId: string) {
    if (providerId === activeProviderId) return;
    setSwitchingId(providerId);
    setNotification(null);

    try {
      const res = await fetch("/api/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to switch active provider");
      }

      setActiveProviderId(providerId);
      setNotification({
        type: "success",
        message: `Switched active API to "${data.activeProvider?.name}". Live Balance: ${data.activeProvider?.currency || "USD"} ${data.activeProvider?.balance?.toFixed(2) ?? "0.00"}.`,
      });

      window.dispatchEvent(new CustomEvent("balance-updated"));
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Failed to switch provider.",
      });
    } finally {
      setSwitchingId(null);
    }
  }

  async function handleTestConnection() {
    if (!apiUrl.trim() || !apiKey.trim()) {
      setNotification({
        type: "error",
        message: "Please enter both API URL and API Key to test.",
      });
      return;
    }

    setTesting(true);
    setTestResult(null);
    setNotification(null);

    try {
      const res = await fetch("/api/user/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: apiUrl.trim(),
          apiKey: apiKey.trim(),
          currency: currency.trim().toUpperCase(),
          isMock: false,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          balance: data.balance,
          currency: data.currency,
          servicesCount: data.servicesCount,
        });
      } else {
        setTestResult({
          success: false,
          error: data.error || "Connection test failed. Please verify API URL and Key.",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message || "Failed to contact provider.",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSaveConnection(e: React.FormEvent) {
    e.preventDefault();
    if (!apiUrl.trim() || !apiKey.trim()) {
      setNotification({
        type: "error",
        message: "Please provide both the API URL and API Key.",
      });
      return;
    }

    setSaving(true);
    setNotification(null);

    try {
      const res = await fetch("/api/user/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: providerName.trim() || `Provider ${connections.length + 1}`,
          apiUrl: apiUrl.trim(),
          apiKey: apiKey.trim(),
          currency: currency.trim().toUpperCase(),
          isMock: false,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save API key");
      }

      setNotification({
        type: "success",
        message: `API "${data.connection.name}" connected successfully! Balance: ${data.connection.currency} ${data.connection.balance ?? 0}. Synced ${data.servicesCount} services.`,
      });

      setApiKey("");
      setTestResult(null);

      // Trigger global update events for header balance & shell
      window.dispatchEvent(new CustomEvent("balance-updated"));
      window.dispatchEvent(new CustomEvent("auth-changed"));

      await loadProviders();
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Failed to save API connection.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncServices(providerId: string) {
    setSyncingId(providerId);
    setNotification(null);
    try {
      const res = await fetch(`/api/user/providers/${providerId}/refresh`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to sync services");
      }

      setNotification({
        type: "success",
        message: `Catalog refreshed for ${data.name}! ${data.importedCount || data.servicesCount || 0} services updated. Live Balance: ${data.currency} ${data.balance ?? 0}.`,
      });

      window.dispatchEvent(new CustomEvent("balance-updated"));
      await loadProviders();
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Failed to sync provider catalog.",
      });
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDeleteProvider(providerId: string, name: string) {
    if (!confirm(`Are you sure you want to disconnect "${name}"?`)) return;

    try {
      const res = await fetch(`/api/user/providers/${providerId}?force=true`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to remove provider");
      }

      setNotification({
        type: "success",
        message: `Provider "${name}" disconnected successfully.`,
      });

      window.dispatchEvent(new CustomEvent("balance-updated"));
      await loadProviders();
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Failed to disconnect provider.",
      });
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DEE0ED] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#3A4EFB]">
              Double API & Multi-Provider Settings
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#252943] tracking-tight">
            Connect & Manage API Keys
          </h1>
          <p className="text-sm text-[#252943]/60 mt-1">
            Connect your primary and secondary SMM v2 APIs (Double API). Switch between them to place orders using each provider&apos;s balance and catalog.
          </p>
        </div>

        <Link
          href="/order"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3A4EFB] hover:bg-[#3243d9] active:scale-95 text-white font-semibold text-sm shadow-subtle transition-all self-start sm:self-center"
        >
          <span>Go to New Order</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`p-4 rounded-xl flex items-start gap-3 border ${
            notification.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          )}
          <div className="text-sm font-medium leading-relaxed">{notification.message}</div>
        </div>
      )}

      {/* Connected APIs Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#3A4EFB]" />
            <h2 className="text-lg font-bold text-[#252943]">
              Connected API Providers ({connections.length})
            </h2>
          </div>
          {connections.length > 1 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-[#3A4EFB] border border-blue-200">
              Double API Active
            </span>
          )}
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white border border-[#DEE0ED] p-8 text-center text-sm text-[#252943]/60">
            <RefreshCw className="w-5 h-5 text-[#3A4EFB] animate-spin mx-auto mb-2" />
            Loading connected API providers...
          </div>
        ) : connections.length === 0 ? (
          <div className="rounded-2xl bg-white border border-dashed border-[#DEE0ED] p-8 text-center space-y-2">
            <Server className="w-8 h-8 text-[#252943]/40 mx-auto" />
            <h3 className="text-base font-bold text-[#252943]">No API Keys Connected</h3>
            <p className="text-xs text-[#252943]/60 max-w-sm mx-auto">
              Add your SMM provider API key below to sync services and start placing orders.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {connections.map((conn, idx) => {
              const isActive = conn.id === activeProviderId;
              const isSyncing = syncingId === conn.id;
              const isSwitching = switchingId === conn.id;

              return (
                <div
                  key={conn.id}
                  className={`rounded-2xl bg-white border p-6 shadow-sm transition-all space-y-4 ${
                    isActive
                      ? "border-[#3A4EFB] ring-2 ring-[#3A4EFB]/15"
                      : "border-[#DEE0ED] hover:border-[#DEE0ED]/80"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                          isActive
                            ? "bg-[#3A4EFB] text-white"
                            : "bg-[#F0F2FA] text-[#252943]/70"
                        }`}
                      >
                        API {idx + 1}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-[#252943]">{conn.name}</h3>
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                              <Check className="w-3 h-3" />
                              Active & In Use
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-[#252943]/60">
                              Standby
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#252943]/60 font-mono mt-0.5">
                          {conn.apiUrl}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => handleSetActiveProvider(conn.id)}
                          disabled={isSwitching}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3A4EFB] hover:bg-[#3243d9] text-white text-xs font-bold transition-all shadow-subtle active:scale-95 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isSwitching ? "Activating..." : "Select / Use This API"}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSyncServices(conn.id)}
                        disabled={isSyncing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8F9FD] hover:bg-white border border-[#DEE0ED] text-xs font-semibold text-[#252943] transition-all shadow-subtle disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 text-[#3A4EFB] ${isSyncing ? "animate-spin" : ""}`}
                        />
                        <span>{isSyncing ? "Syncing..." : "Sync Services"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteProvider(conn.id, conn.name)}
                        className="p-2 rounded-xl text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
                        title="Disconnect API Key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#DEE0ED]/60">
                    <div className="p-3 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]/80">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#252943]/50 block mb-1">
                        Live Balance
                      </span>
                      <div className="text-base sm:text-lg font-extrabold text-[#252943] flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-[#3A4EFB]" />
                        <span>
                          {conn.balance !== null
                            ? `${conn.currency} ${conn.balance.toFixed(2)}`
                            : "Unavailable"}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]/80">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#252943]/50 block mb-1">
                        Available Services
                      </span>
                      <div className="text-base sm:text-lg font-extrabold text-[#252943]">
                        {conn.servicesCount.toLocaleString()} services
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]/80">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#252943]/50 block mb-1">
                        API Key
                      </span>
                      <div className="text-xs sm:text-sm font-mono font-bold text-[#252943]/80 truncate">
                        {conn.maskedKey || "••••••••••••••••"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Connect API Form (Double API Support) */}
      <div className="rounded-2xl bg-white border border-[#DEE0ED] p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-[#3A4EFB]" />
            <h2 className="text-lg font-bold text-[#252943]">
              {connections.length === 0
                ? "Connect Your SMM Provider API Key"
                : connections.length === 1
                ? "Connect 2nd API Provider (Double API)"
                : "Connect Another API Provider"}
            </h2>
          </div>
          <p className="text-xs text-[#252943]/60 mt-1">
            Enter your SMM Provider API URL and API Key. We test the connection live using{" "}
            <code className="text-[#3A4EFB] font-mono">action=balance</code> before saving.
          </p>
        </div>

        <form onSubmit={handleSaveConnection} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Provider Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#252943]/70 mb-1.5">
                Provider Name
              </label>
              <input
                type="text"
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                placeholder="e.g. Zefame, XMedia SMM, SMM Raja"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-sm text-[#252943] focus:outline-none focus:border-[#3A4EFB] focus:bg-white transition-all font-medium"
              />
            </div>

            {/* Currency */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#252943]/70 mb-1.5">
                Account Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-sm text-[#252943] focus:outline-none focus:border-[#3A4EFB] focus:bg-white transition-all font-medium"
              >
                <option value="USD">USD ($)</option>
                <option value="INR">INR (₹)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="BDT">BDT (৳)</option>
                <option value="BRL">BRL (R$)</option>
              </select>
            </div>
          </div>

          {/* API URL */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#252943]/70 mb-1.5">
              Provider API URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              required
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://zefame.com/api/v2"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-sm font-mono text-[#252943] focus:outline-none focus:border-[#3A4EFB] focus:bg-white transition-all"
            />
            <span className="text-[11px] text-[#252943]/50 mt-1 block">
              Standard SMM API v2 endpoint URL. Must accept <code className="font-mono">POST action=services</code>, <code className="font-mono">add</code>, and <code className="font-mono">balance</code>.
            </span>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#252943]/70 mb-1.5">
              API Key <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                required
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your SMM provider API key here"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-sm font-mono text-[#252943] focus:outline-none focus:border-[#3A4EFB] focus:bg-white transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#252943]/40 hover:text-[#252943] transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Test Result Indicator */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center justify-between border ${
                testResult.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-red-50 border-red-200 text-red-900"
              }`}
            >
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>
                  {testResult.success
                    ? `Connection Verified! Balance: ${testResult.currency} ${testResult.balance?.toFixed(2)}`
                    : testResult.error}
                </span>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || saving}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#F8F9FD] hover:bg-[#F0F2FA] border border-[#DEE0ED] text-xs font-bold text-[#252943] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#3A4EFB] ${testing ? "animate-spin" : ""}`} />
              <span>{testing ? "Testing..." : "Test Connection"}</span>
            </button>

            <button
              type="submit"
              disabled={saving || testing}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#3A4EFB] hover:bg-[#3243d9] active:scale-95 text-white text-xs font-bold transition-all shadow-subtle flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>
                {saving
                  ? "Connecting & Syncing Services..."
                  : connections.length === 0
                  ? "Connect & Sync Services"
                  : "Connect & Add API"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

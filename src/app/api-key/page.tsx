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
  ShieldCheck,
  Check,
  Sparkles,
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
  const [activeConnection, setActiveConnection] = useState<ProviderConnection | null>(null);

  // Form State
  const [apiUrl, setApiUrl] = useState("https://justanotherpanel.com/api/v2");
  const [apiKey, setApiKey] = useState("");
  const [providerName, setProviderName] = useState("My SMM Provider");
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
  const [syncing, setSyncing] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function loadProviders() {
    setLoading(true);
    try {
      const res = await fetch("/api/user/providers");
      const data = await res.json();
      if (data.success && Array.isArray(data.connections)) {
        setConnections(data.connections);
        const active = data.connections.find((c: ProviderConnection) => c.active) || data.connections[0] || null;
        setActiveConnection(active);
        if (active) {
          setApiUrl(active.apiUrl);
          setProviderName(active.name);
          setCurrency(active.currency || "USD");
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
          name: providerName.trim() || "My SMM Provider",
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
        message: `API Key saved successfully! Balance: ${data.connection.currency} ${data.connection.balance ?? 0}. Synced ${data.servicesCount} services.`,
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
    setSyncing(true);
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
        message: `Catalog refreshed! ${data.importedCount || data.servicesCount || 0} services updated. Balance: ${data.balance ?? "verified"}.`,
      });

      window.dispatchEvent(new CustomEvent("balance-updated"));
      await loadProviders();
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Failed to sync provider catalog.",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleDeleteProvider(providerId: string) {
    if (!confirm("Are you sure you want to disconnect this API Key?")) return;

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
        message: "API Key disconnected successfully.",
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
              Provider Settings
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#252943] tracking-tight">
            Add & Configure API Key
          </h1>
          <p className="text-sm text-[#252943]/60 mt-1">
            Connect your standard SMM v2 Provider API (JustAnotherPanel, SMM Raja, etc.) to place orders and drip feeds directly.
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

      {/* Active Provider Card */}
      {activeConnection && (
        <div className="rounded-2xl bg-white border border-[#DEE0ED] p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#3A4EFB]/10 border border-[#3A4EFB]/20 flex items-center justify-center text-[#3A4EFB]">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#252943]">{activeConnection.name}</h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    <Check className="w-3 h-3" />
                    Active
                  </span>
                </div>
                <p className="text-xs text-[#252943]/60 font-mono mt-0.5">
                  {activeConnection.apiUrl}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSyncServices(activeConnection.id)}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8F9FD] hover:bg-white border border-[#DEE0ED] text-xs font-semibold text-[#252943] transition-all shadow-subtle"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#3A4EFB] ${syncing ? "animate-spin" : ""}`} />
                <span>{syncing ? "Syncing..." : "Sync Services Now"}</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeleteProvider(activeConnection.id)}
                className="p-2 rounded-xl text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
                title="Disconnect API Key"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#DEE0ED]/60">
            <div className="p-3.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#252943]/50 block mb-1">
                Live Upstream Balance
              </span>
              <div className="text-lg font-extrabold text-[#252943] flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#3A4EFB]" />
                <span>
                  {activeConnection.balance !== null
                    ? `${activeConnection.currency} ${activeConnection.balance.toFixed(2)}`
                    : "Unavailable"}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#252943]/50 block mb-1">
                Synced Services
              </span>
              <div className="text-lg font-extrabold text-[#252943]">
                {activeConnection.servicesCount.toLocaleString()} services
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#252943]/50 block mb-1">
                API Key
              </span>
              <div className="text-sm font-mono font-bold text-[#252943]/80">
                {activeConnection.maskedKey || "••••••••••••••••"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Update API Key Form */}
      <div className="rounded-2xl bg-white border border-[#DEE0ED] p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#3A4EFB]" />
            <h2 className="text-lg font-bold text-[#252943]">
              {activeConnection ? "Update or Connect New API Key" : "Connect Your SMM Provider API Key"}
            </h2>
          </div>
          <p className="text-xs text-[#252943]/60 mt-1">
            Enter your SMM Provider API URL and API Key. We test the connection live using <code className="text-[#3A4EFB] font-mono">action=balance</code> before saving.
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
                placeholder="e.g. JustAnotherPanel, SMM Raja"
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
              placeholder="https://justanotherpanel.com/api/v2"
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
                placeholder="Paste your SMM Provider API key here..."
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-sm font-mono text-[#252943] focus:outline-none focus:border-[#3A4EFB] focus:bg-white transition-all"
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

          {/* Test Result Banner */}
          {testResult && (
            <div
              className={`p-4 rounded-xl flex items-start gap-3 border ${
                testResult.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-red-50 border-red-200 text-red-900"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
              )}
              <div className="text-xs sm:text-sm">
                {testResult.success ? (
                  <div>
                    <span className="font-bold">Connection Verified!</span>
                    <div className="mt-0.5">
                      Provider Balance: <span className="font-extrabold">{testResult.currency} {testResult.balance?.toFixed(2)}</span> | {testResult.servicesCount} services detected.
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="font-bold">Connection Test Failed:</span> {testResult.error}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !apiKey.trim()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#F8F9FD] hover:bg-white border border-[#DEE0ED] hover:border-[#3A4EFB] text-xs sm:text-sm font-bold text-[#252943] active:scale-95 transition-all shadow-subtle flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#3A4EFB] ${testing ? "animate-spin" : ""}`} />
              <span>{testing ? "Testing Credentials..." : "Test Connection"}</span>
            </button>

            <button
              type="submit"
              disabled={saving || !apiKey.trim()}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#3A4EFB] hover:bg-[#3243d9] active:scale-95 text-xs sm:text-sm font-bold text-white transition-all shadow-subtle flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{saving ? "Saving & Syncing..." : "Save & Connect API"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Help / Instructions Note */}
      <div className="p-4 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs text-[#252943]/70 space-y-1.5 leading-relaxed">
        <div className="font-bold text-[#252943] flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#3A4EFB]" />
          How it works
        </div>
        <p>
          1. Paste your SMM Provider API URL (usually ending in <code className="font-mono">/api/v2</code>) and API Key from your provider dashboard.
        </p>
        <p>
          2. Click <strong>Test Connection</strong> to verify your key and check your live account balance.
        </p>
        <p>
          3. Click <strong>Save & Connect API</strong>. We will securely encrypt your key, fetch all available services, and make them immediately available in <strong>New Order</strong>.
        </p>
      </div>
    </div>
  );
}


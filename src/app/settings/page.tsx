"use client";

import React, { useState, useEffect } from "react";
import {
  Server,
  Key,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Send,
  Eye,
  EyeOff,
  Wallet,
  Clock,
  Layers,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { formatProviderBalance } from "@/lib/currency";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [refreshingBal, setRefreshingBal] = useState(false);

  // User & Passkey state
  const [userSession, setUserSession] = useState<any>(null);

  // Form state
  const [providerName, setProviderName] = useState("My SMM Provider");
  const [apiUrl, setApiUrl] = useState("https://api.smmprovider.com/v2");
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isMock, setIsMock] = useState(true);

  // Balance & Status
  const [balance, setBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState("INR");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Feedback notifications
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    success: boolean;
    servicesCount?: number;
    balance?: number | null;
    currency?: string | null;
    error?: string;
  } | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      // 1. Load session
      const sessRes = await fetch("/api/auth/session");
      const sessData = await sessRes.json();
      if (sessData.authenticated) {
        setUserSession(sessData);
      }

      // 2. Load provider config
      const provRes = await fetch("/api/provider");
      const provData = await provRes.json();
      if (provData.success && provData.config) {
        const c = provData.config;
        setProviderName(c.name || "My SMM Provider");
        setApiUrl(c.apiUrl || "https://api.smmprovider.com/v2");
        setHasApiKey(c.hasApiKey);
        setMaskedKey(c.maskedKey || "");
        setIsMock(c.isMock);
        setBalance(c.balance);
        setCurrency(c.currency || "INR");
        setLastSyncAt(c.lastSyncAt);
        setLastError(c.lastError);
      }
    } catch (err: any) {
      console.warn("Error loading settings:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotification(null);

    try {
      const payload: any = {
        name: providerName.trim(),
        apiUrl: apiUrl.trim(),
        isMock,
        active: true,
      };

      if (apiKey.trim()) {
        payload.apiKey = apiKey.trim();
      }

      const res = await fetch("/api/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save configuration");
      }

      setNotification({ type: "success", message: "Provider configuration saved successfully!" });
      setHasApiKey(data.config.hasApiKey);
      setMaskedKey(data.config.maskedKey);
      setApiKey(""); // clear plain text input

      // Trigger global balance update event
      window.dispatchEvent(new CustomEvent("balance-updated"));
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);

    try {
      const payload: any = { apiUrl: apiUrl.trim() };
      if (apiKey.trim()) {
        payload.apiKey = apiKey.trim();
      }

      const res = await fetch("/api/provider/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setTestResult({
          tested: true,
          success: false,
          error: data.error || "Connection failed. Please verify API URL and Key.",
        });
      } else {
        setTestResult({
          tested: true,
          success: true,
          servicesCount: data.servicesCount,
          balance: data.balance,
          currency: data.currency,
        });
      }
    } catch (err: any) {
      setTestResult({
        tested: true,
        success: false,
        error: err.message || "Connection error occurred.",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleRefreshBalance() {
    setRefreshingBal(true);
    try {
      const res = await fetch("/api/balance?refresh=true");
      const data = await res.json();
      if (typeof data.balance === "number") {
        setBalance(data.balance);
        setCurrency(data.currency || currency);
        setLastSyncAt(new Date().toISOString());
        setLastError(null);
      } else {
        setLastError(data.warning || "Live balance unavailable");
      }
      window.dispatchEvent(new CustomEvent("balance-updated"));
    } catch (err: any) {
      setLastError(err.message || "Balance refresh failed");
    } finally {
      setRefreshingBal(false);
    }
  }

  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-[#3A4EFB]">Account & Integrations</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#252943] tracking-tight">
          Settings & Provider API
        </h1>
        <p className="text-xs sm:text-sm text-[#252943]/60 mt-1">
          Configure your independent SMM provider connection, manage your API credentials, and monitor passkey access.
        </p>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-semibold ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Grid: Left Provider Form, Right Passkey & Help */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Provider API Configuration (Col-span-2) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 sm:p-7 shadow-subtle space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#DEE0ED]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#3A4EFB]/10 text-[#3A4EFB] flex items-center justify-center">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#252943] tracking-tight">
                    Dedicated SMM Provider API
                  </h2>
                  <p className="text-xs text-[#252943]/60">
                    All your orders route exclusively through your private provider credentials.
                  </p>
                </div>
              </div>
              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                  isMock
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : hasApiKey
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-gray-100 text-gray-700 border-gray-300"
                }`}
              >
                {isMock ? "Mock Sandbox" : hasApiKey ? "Live Provider Active" : "No Key Set"}
              </span>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Provider Name */}
              <div>
                <label className="block text-xs font-bold text-[#252943] mb-1.5">
                  Provider Label
                </label>
                <input
                  type="text"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  placeholder="e.g. PeakSMM / SMMKings"
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#252943] focus:border-[#3A4EFB] outline-none transition-colors"
                />
              </div>

              {/* API URL */}
              <div>
                <label className="block text-xs font-bold text-[#252943] mb-1.5">
                  Provider API URL (v2 endpoint)
                </label>
                <input
                  type="url"
                  required
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://provider-domain.com/api/v2"
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2.5 text-xs font-mono font-semibold text-[#252943] focus:border-[#3A4EFB] outline-none transition-colors"
                />
              </div>

              {/* API Key */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#252943]">
                    Provider API Key
                  </label>
                  {hasApiKey && (
                    <span className="text-[11px] text-[#252943]/50 font-mono">
                      Current: {maskedKey}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={hasApiKey ? "Enter new API key to replace existing" : "Paste your provider API key"}
                    className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2.5 pr-10 text-xs font-mono text-[#252943] focus:border-[#3A4EFB] outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#252943]/40 hover:text-[#252943]"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Sandbox Toggle */}
              <div className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#252943] block">
                    Mock Sandbox Mode
                  </span>
                  <span className="text-[11px] text-[#252943]/60">
                    Simulate orders and services without spending real funds.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isMock}
                    onChange={(e) => setIsMock(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3A4EFB]"></div>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#3A4EFB] hover:bg-[#2F40DB] text-white text-xs font-bold transition-all shadow-subtle press-scale flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#E3FF3B]" />
                      Save Configuration
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#252943] hover:bg-[#1A1D31] text-white text-xs font-bold transition-all shadow-subtle press-scale flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {testing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Testing API...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-[#E3FF3B]" />
                      Test Connection
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Test Connection Output */}
            {testResult && (
              <div
                className={`p-4 rounded-2xl border text-xs leading-relaxed animate-fadeIn ${
                  testResult.success
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-red-50 border-red-200 text-red-900"
                }`}
              >
                <div className="flex items-center gap-2 font-bold mb-1">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  )}
                  <span>
                    {testResult.success
                      ? "Connection Verified Successfully!"
                      : "Connection Failed"}
                  </span>
                </div>
                {testResult.success ? (
                  <p>
                    Verified <strong>{testResult.servicesCount ?? 0} services</strong> from provider.
                    {typeof testResult.balance === "number" && (
                      <span className="block mt-0.5">
                        Provider Balance:{" "}
                        <strong>{formatProviderBalance(testResult.balance, testResult.currency || "USD")}</strong>
                      </span>
                    )}
                  </p>
                ) : (
                  <p>{testResult.error}</p>
                )}
              </div>
            )}
          </div>

          {/* Telegram Assistance Banner */}
          <div className="bg-[#1A1D31] border border-[#323758] rounded-3xl p-5 text-white shadow-subtle flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-[#3A4EFB]/20 border border-[#3A4EFB]/40 text-[#E3FF3B] flex items-center justify-center shrink-0 mt-0.5">
              <Send className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold tracking-tight text-white">
                Need Help Setting Up Your Provider API?
              </h3>
              <p className="text-xs text-[#DEE0ED]/75 leading-relaxed">
                Need help setting up your provider API? Message{" "}
                <a
                  href="https://t.me/Ghostfinds"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#3A4EFB] font-bold underline hover:text-blue-400 transition-colors"
                >
                  @Ghostfinds
                </a>{" "}
                on Telegram.
              </p>
            </div>
          </div>
        </div>

        {/* Account & Passkey Overview Card (Col-span-1) */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-[#DEE0ED]">
              <div className="w-9 h-9 rounded-xl bg-[#3A4EFB]/10 text-[#3A4EFB] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#252943]">
                  Passkey Access Details
                </h3>
                <span className="text-[11px] text-[#252943]/60">
                  {userSession?.user?.username || "Authenticated User"}
                </span>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#252943]/60">Assigned Role</span>
                <span
                  className={`font-bold px-2.5 py-0.5 rounded-md text-[10px] uppercase ${
                    userSession?.role === "ADMIN"
                      ? "bg-[#252943] text-[#E3FF3B]"
                      : "bg-[#3A4EFB]/10 text-[#3A4EFB]"
                  }`}
                >
                  {userSession?.role || "USER"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#252943]/60">Remaining Access</span>
                <span className="font-extrabold text-[#3A4EFB] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {userSession?.remainingDays !== null && userSession?.remainingDays !== undefined ? (
                    userSession.remainingDays > 0 ? (
                      `${userSession.remainingDays} days remaining`
                    ) : (
                      `${userSession.remainingHours || 0} hours remaining`
                    )
                  ) : (
                    "Unlimited Access"
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#252943]/60">Expires On</span>
                <span className="font-semibold text-[#252943]">
                  {userSession?.expiresAt
                    ? new Date(userSession.expiresAt).toLocaleDateString()
                    : "Permanent Key"}
                </span>
              </div>
            </div>

            {/* Provider Live Balance Card */}
            <div className="pt-3 border-t border-[#DEE0ED] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#252943]/60 uppercase tracking-wider">
                  Provider Balance
                </span>
                <button
                  type="button"
                  onClick={handleRefreshBalance}
                  disabled={refreshingBal}
                  className="text-xs text-[#3A4EFB] hover:underline flex items-center gap-1 font-semibold"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshingBal ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Wallet className="w-4 h-4 text-[#3A4EFB]" />
                  <span className="text-base font-extrabold text-[#252943]">
                    {formatProviderBalance(balance, currency)}
                  </span>
                </div>
                {lastSyncAt && (
                  <span className="text-[10px] text-[#252943]/50">
                    Synced {new Date(lastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              {lastError && (
                <p className="text-[11px] text-amber-700 font-medium">
                  Notice: {lastError}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

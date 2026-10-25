"use client";

import { useState, useEffect } from "react";
import { 
  Wallet, 
  RefreshCw, 
  PlusCircle, 
  Server, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight, 
  Loader2, 
  ShieldCheck, 
  Sparkles,
  AlertTriangle,
  X,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { formatProviderBalance } from "@/lib/currency";

interface ProviderBalanceCard {
  connectionId: string;
  providerName: string;
  success: boolean;
  cached?: boolean;
  balance: number | null;
  currency: string;
  lastSyncAt: string | null;
  servicesCount?: number;
  error?: string;
  durationMs?: number;
}

interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  referenceId: string | null;
  description: string;
  createdAt: string;
}

export default function WalletPage() {
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [providerBalances, setProviderBalances] = useState<ProviderBalanceCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // Modal States
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [deleteWarningData, setDeleteWarningData] = useState<{
    id: string;
    name: string;
    unsentCount: number;
    warning: string;
  } | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<any>(null);

  // Form States for Add Provider
  const [providerName, setProviderName] = useState("");
  const [providerUrl, setProviderUrl] = useState("https://api.smmprovider.com/v2");
  const [providerKey, setProviderKey] = useState("");
  const [providerCurrency, setProviderCurrency] = useState("USD");
  const [isMock, setIsMock] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(500);

  // Test Connection State inside Add Provider
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    success: boolean;
    balance?: number | null;
    currency?: string;
    servicesCount?: number;
    error?: string;
  } | null>(null);

  // Progress state for instant service import
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadWalletData(forceRefresh = false) {
    try {
      if (forceRefresh) setRefreshingAll(true);
      const res = await fetch(`/api/wallet${forceRefresh ? "?refresh=true" : ""}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.success) {
        setWalletBalance(data.wallet.balance);
        setTransactions(data.transactions || []);
        setProviderBalances(data.providerBalances || []);
      }
    } catch (err) {
      console.error("Failed to load wallet data", err);
    } finally {
      setLoading(false);
      setRefreshingAll(false);
    }
  }

  useEffect(() => {
    loadWalletData();
  }, []);

  async function handleTestConnectionBeforeSave() {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/user/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: providerUrl.trim(),
          apiKey: providerKey.trim(),
          currency: providerCurrency.trim().toUpperCase(),
          isMock,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({
          tested: true,
          success: true,
          balance: data.balance,
          currency: data.currency,
          servicesCount: data.servicesCount,
        });
      } else {
        setTestResult({
          tested: true,
          success: false,
          error: data.error || "Connection test failed",
        });
      }
    } catch (err: any) {
      setTestResult({
        tested: true,
        success: false,
        error: err.message || "Failed to test connection",
      });
    } finally {
      setTestingConnection(false);
    }
  }

  async function handleRefreshSingleProvider(connectionId: string) {
    setRefreshingId(connectionId);
    try {
      const res = await fetch(`/api/user/providers/${connectionId}/refresh`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setProviderBalances((prev) =>
          prev.map((p) =>
            p.connectionId === connectionId
              ? {
                  ...p,
                  balance: data.balance,
                  currency: data.currency,
                  lastSyncAt: data.lastSyncAt,
                  success: true,
                  error: undefined,
                  cached: false,
                }
              : p
          )
        );
        window.dispatchEvent(new CustomEvent("balance-updated"));
      } else {
        setProviderBalances((prev) =>
          prev.map((p) =>
            p.connectionId === connectionId
              ? { ...p, success: false, error: data.error }
              : p
          )
        );
      }
    } catch (err: any) {
      console.error("Failed to refresh provider", err);
    } finally {
      setRefreshingId(null);
    }
  }

  async function handleDeleteProviderClick(connectionId: string, name: string) {
    setActionError(null);
    try {
      // 1. Check if provider has unsent batches
      const checkRes = await fetch(`/api/user/providers/${connectionId}`);
      const checkData = await checkRes.json();
      if (checkData.success && checkData.unsentCount > 0) {
        setDeleteWarningData({
          id: connectionId,
          name,
          unsentCount: checkData.unsentCount,
          warning: checkData.warning,
        });
        return;
      }

      // If no unsent batches, prompt standard confirm
      if (!confirm(`Are you sure you want to disconnect provider "${name}"? This will remove its imported services from the catalog.`)) {
        return;
      }

      await executeDeleteProvider(connectionId, name, false);
    } catch (err: any) {
      setActionError(err.message || "Failed to inspect provider before deletion");
    }
  }

  async function executeDeleteProvider(connectionId: string, name: string, force: boolean) {
    try {
      const res = await fetch(`/api/user/providers/${connectionId}${force ? "?force=true" : ""}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setDeleteWarningData(null);
        setActionSuccess(`Disconnected provider "${name}" successfully. Historical orders retained.`);
        setTimeout(() => setActionSuccess(null), 4000);
        await loadWalletData(true);
        window.dispatchEvent(new CustomEvent("balance-updated"));
      } else {
        setActionError(data.error || data.warning || "Failed to disconnect provider");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to disconnect provider");
    }
  }

  async function handleConnectProvider(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);
    setImportStatus("Testing provider connection action=balance...");

    try {
      const res = await fetch("/api/user/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: providerName.trim(),
          apiUrl: providerUrl.trim(),
          apiKey: providerKey.trim(),
          currency: providerCurrency.trim().toUpperCase(),
          isMock,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to connect provider");
      }

      setImportStatus(`Importing services... ${data.servicesCount || 0} found`);
      setTimeout(() => {
        setShowConnectModal(false);
        setProviderName("");
        setProviderKey("");
        setTestResult(null);
        setImportStatus(null);
      }, 1000);

      setActionSuccess(data.message || "Connected provider successfully!");
      setTimeout(() => setActionSuccess(null), 4000);
      await loadWalletData(true);
      window.dispatchEvent(new CustomEvent("balance-updated"));
    } catch (err: any) {
      setActionError(err.message || "Failed to connect provider");
      setImportStatus(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateProviderKey(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedConnection) return;
    setSubmitting(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/user/providers/${selectedConnection.connectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: providerUrl.trim() || undefined,
          apiKey: providerKey.trim() || undefined,
          currency: providerCurrency.trim().toUpperCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update provider");
      }

      setShowEditModal(false);
      setSelectedConnection(null);
      setProviderKey("");
      setActionSuccess("Updated provider credentials and verified balance successfully!");
      setTimeout(() => setActionSuccess(null), 3000);
      await loadWalletData(true);
      window.dispatchEvent(new CustomEvent("balance-updated"));
    } catch (err: any) {
      setActionError(err.message || "Failed to update credentials");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDepositFunds(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);

    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(depositAmount) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add funds");
      }

      setShowDepositModal(false);
      setActionSuccess(`Added ₹${depositAmount} to your wallet!`);
      setTimeout(() => setActionSuccess(null), 3000);
      await loadWalletData(false);
    } catch (err: any) {
      setActionError(err.message || "Failed to add funds");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-2 text-sm text-[#252943]/60">
          <Loader2 className="w-5 h-5 animate-spin text-[#3A4EFB]" />
          <span>Loading DhanSMM Wallet and connected provider balances...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DEE0ED]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#252943] flex items-center gap-2">
            <Wallet className="w-6 h-6 text-[#3A4EFB]" />
            SMM Provider Manager & Wallet
          </h1>
          <p className="text-xs text-[#252943]/60 mt-0.5">
            Connect upstream SMM providers, test credentials, and monitor individual live balances. There is no summed balance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadWalletData(true)}
            disabled={refreshingAll}
            className="px-3.5 py-2 rounded-xl border border-[#DEE0ED] text-xs font-semibold text-[#252943]/80 hover:bg-[#F8F9FD] flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#3A4EFB] ${refreshingAll ? "animate-spin" : ""}`} />
            <span>{refreshingAll ? "Refreshing..." : "Refresh Balances"}</span>
          </button>

          <button
            type="button"
            id="connect-provider-btn"
            onClick={() => {
              setTestResult(null);
              setShowConnectModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-xs font-bold transition-all press-scale shadow-subtle flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4 text-[#E3FF3B]" />
            <span>Add Provider</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="p-1 text-rose-500 hover:text-rose-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Grid: Left = INR Account Wallet Card, Right = Provider Manager Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* DhanSMM INR Wallet Card */}
        <div className="md:col-span-1 bg-gradient-to-br from-[#252943] to-[#1A1D31] text-white rounded-3xl p-6 shadow-subtle flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#3A4EFB]/20 rounded-full blur-2xl pointer-events-none" />
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#E3FF3B]">
                Internal Account Wallet
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white/80">
                INR (₹)
              </span>
            </div>

            <div>
              <p className="text-xs text-white/60">Available INR Balance</p>
              <h2 className="text-3xl font-black tracking-tight text-white mt-1">
                ₹{walletBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
            </div>
            
            <p className="text-[11px] text-white/60 leading-relaxed">
              Used to fund automated schedule steps, organic S-curve pacing, and combos upfront.
            </p>
          </div>

          <div className="pt-6 border-t border-white/10 mt-6 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDepositModal(true)}
              className="flex-1 py-2 px-3 rounded-xl bg-[#E3FF3B] text-[#252943] text-xs font-bold hover:bg-[#d6f228] transition-colors flex items-center justify-center gap-1.5 shadow-subtle"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add INR Funds</span>
            </button>
            <Link
              href="/order"
              className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1"
            >
              <span>Order Now</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Connected Providers Overview Stats */}
        <div className="md:col-span-2 bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#252943] flex items-center gap-2">
              <Server className="w-4 h-4 text-[#3A4EFB]" />
              Independent Provider Connections
            </span>
            <span className="text-xs text-[#252943]/60 font-semibold">
              {providerBalances.length} Connected Provider{providerBalances.length === 1 ? "" : "s"}
            </span>
          </div>

          <p className="text-xs text-[#252943]/70 leading-relaxed">
            All orders route directly through the provider that owns the chosen service using encrypted credentials. Providers execute independently and concurrently: a slow or unreachable provider will never block or delay orders on another provider.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#252943]/60 font-medium">Total Connected Providers</span>
                <p className="text-xl font-black text-[#252943]">{providerBalances.length}</p>
              </div>
              <Server className="w-6 h-6 text-[#3A4EFB]/40" />
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#252943]/60 font-medium">Active Live Endpoints</span>
                <p className="text-xl font-black text-emerald-600">
                  {providerBalances.filter((p) => p.success).length} of {providerBalances.length} Online
                </p>
              </div>
              <ShieldCheck className="w-6 h-6 text-emerald-500/40" />
            </div>
          </div>
        </div>
      </div>

      {/* Connected SMM Provider Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#252943] flex items-center gap-2">
            <Server className="w-4 h-4 text-[#3A4EFB]" />
            Connected Upstream SMM Providers
          </h3>
          <span className="text-xs text-[#252943]/50">Balances shown in provider&apos;s own currency (No combined sum)</span>
        </div>

        {providerBalances.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-[#DEE0ED] space-y-3 shadow-subtle">
            <Server className="w-10 h-10 text-[#3A4EFB]/40 mx-auto" />
            <h4 className="text-sm font-bold text-[#252943]">No SMM Providers Connected</h4>
            <p className="text-xs text-[#252943]/60 max-w-md mx-auto">
              Add your upstream SMM provider (e.g. Zeofame, xmedia, or any SMM v2 endpoint) to import services and route orders.
            </p>
            <button
              type="button"
              onClick={() => setShowConnectModal(true)}
              className="px-4 py-2 rounded-xl bg-[#3A4EFB] text-white text-xs font-bold hover:bg-[#2C3FE0] transition-colors inline-flex items-center gap-1.5 shadow-subtle"
            >
              <PlusCircle className="w-4 h-4 text-[#E3FF3B]" />
              <span>Connect First Provider</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {providerBalances.map((provider) => {
              const isRefreshing = refreshingId === provider.connectionId || refreshingAll;

              return (
                <div
                  key={provider.connectionId}
                  className="bg-white rounded-3xl border border-[#DEE0ED] p-5 shadow-subtle flex flex-col justify-between space-y-4 hover:border-[#3A4EFB]/30 transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#F8F9FD] border border-[#DEE0ED] text-[#252943]">
                        {provider.providerName}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleRefreshSingleProvider(provider.connectionId)}
                          disabled={isRefreshing}
                          title="Refresh live balance from provider API"
                          className="p-1.5 rounded-lg text-[#252943]/60 hover:text-[#3A4EFB] hover:bg-[#F8F9FD] transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[#3A4EFB]" : ""}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedConnection(provider);
                            setProviderUrl("");
                            setProviderKey("");
                            setProviderCurrency(provider.currency);
                            setShowEditModal(true);
                          }}
                          title="Update API Key"
                          className="p-1.5 rounded-lg text-[#252943]/60 hover:text-[#3A4EFB] hover:bg-[#F8F9FD] transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProviderClick(provider.connectionId, provider.providerName)}
                          title="Delete provider"
                          className="p-1.5 rounded-lg text-[#252943]/60 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-[#252943]/60 block font-medium">
                        Live Balance
                      </span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-2xl font-black tracking-tight text-[#252943]">
                          {provider.balance !== null ? (
                            formatProviderBalance(provider.balance, provider.currency)
                          ) : (
                            <span className="text-sm font-semibold text-amber-700">Unavailable</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {provider.error ? (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-700 flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{provider.error}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[11px] text-[#252943]/50 pt-1">
                        <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                          <CheckCircle2 className="w-3 h-3" /> Online & Verified
                        </span>
                        <span>
                          {provider.lastSyncAt ? new Date(provider.lastSyncAt).toLocaleTimeString() : "Pending"}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#DEE0ED]/60 flex items-center justify-between text-[11px]">
                    <span className="text-[#252943]/60">Status:</span>
                    <span className="font-semibold text-[#3A4EFB]">
                      {provider.cached ? "Cached" : "Live Read"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Wallet Transactions History Table */}
      <div className="bg-white rounded-3xl border border-[#DEE0ED] shadow-subtle p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
          <h3 className="text-sm font-bold text-[#252943] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#3A4EFB]" />
            Recent Wallet Activity & Refunds
          </h3>
          <span className="text-xs text-[#252943]/60">All amounts in INR (₹)</span>
        </div>

        {transactions.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#252943]/60">
            No wallet transactions recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FD] border-b border-[#DEE0ED] text-[#252943]/60 font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Date & Time</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4">Reference</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-4 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEE0ED]/60">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#F8F9FD]/60">
                    <td className="py-3 px-4 text-[#252943]/80">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          tx.type === "CREDIT" || tx.type === "REFUND"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-[#252943] max-w-xs truncate">
                      {tx.description}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#252943]/60">
                      {tx.referenceId || "—"}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-bold ${
                        tx.amount >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {tx.amount >= 0 ? `+₹${tx.amount.toFixed(2)}` : `-₹${Math.abs(tx.amount).toFixed(2)}`}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[#252943]">
                      ₹{tx.balanceAfter.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Provider Modal with Test Connection & Instant Import Feedback */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 bg-[#252943]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
              <h3 className="text-sm font-bold text-[#252943] flex items-center gap-2">
                <Server className="w-4 h-4 text-[#3A4EFB]" />
                Add SMM Provider Account
              </h3>
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                className="p-1 rounded-lg text-[#252943]/60 hover:text-[#252943]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConnectProvider} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-[#252943]">Provider Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zeofame or xmedia"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2 text-xs text-[#252943] focus:border-[#3A4EFB]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#252943]">Provider API URL (v2 endpoint)</label>
                <input
                  type="url"
                  required
                  placeholder="https://provider.com/api/v2"
                  value={providerUrl}
                  onChange={(e) => setProviderUrl(e.target.value)}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2 text-xs font-mono text-[#252943] focus:border-[#3A4EFB]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#252943]">Provider API Key</label>
                <input
                  type="password"
                  required
                  placeholder="Paste your SMM API key"
                  value={providerKey}
                  onChange={(e) => {
                    setProviderKey(e.target.value);
                    setTestResult(null);
                  }}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2 text-xs font-mono text-[#252943] focus:border-[#3A4EFB]"
                />
                <span className="text-[10px] text-[#252943]/50">
                  Encrypted at rest with AES-256-GCM. Masked in UI and never returned by endpoints.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="font-semibold text-[#252943]">Currency</label>
                  <select
                    value={providerCurrency}
                    onChange={(e) => setProviderCurrency(e.target.value)}
                    className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2 text-xs text-[#252943] focus:border-[#3A4EFB]"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>

                <div className="space-y-1 flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={isMock}
                      onChange={(e) => setIsMock(e.target.checked)}
                      className="rounded text-[#3A4EFB]"
                    />
                    <span className="text-xs font-semibold text-[#252943]">Mock Mode (Test)</span>
                  </label>
                </div>
              </div>

              {/* Test Connection Button */}
              <div className="pt-2">
                <button
                  type="button"
                  id="test-provider-connection-btn"
                  onClick={handleTestConnectionBeforeSave}
                  disabled={testingConnection || !providerUrl || !providerKey}
                  className="w-full py-2 px-3 rounded-xl bg-[#252943] hover:bg-[#1A1D31] text-white text-xs font-semibold transition-all press-scale flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  {testingConnection ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Testing action=balance...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-[#E3FF3B]" />
                      <span>Test Connection (action=balance)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Test Connection Result Feedback */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs leading-relaxed animate-fadeIn ${
                    testResult.success
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-rose-50 border-rose-200 text-rose-900"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-0.5">
                    {testResult.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    <span>{testResult.success ? "Connection Verified!" : "Connection Test Failed"}</span>
                  </div>
                  {testResult.success ? (
                    <p>
                      Balance: <strong>{formatProviderBalance(testResult.balance ?? null, testResult.currency || "USD")}</strong>
                      {typeof testResult.servicesCount === "number" && testResult.servicesCount > 0 && (
                        <span> · {testResult.servicesCount} services available</span>
                      )}
                    </p>
                  ) : (
                    <p>{testResult.error}</p>
                  )}
                </div>
              )}

              {/* Progress State during save & import */}
              {importStatus && (
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-2 animate-fadeIn">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3A4EFB]" />
                  <span>{importStatus}</span>
                </div>
              )}

              <div className="pt-3 border-t border-[#DEE0ED] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-[#DEE0ED] text-xs font-semibold text-[#252943]/70 hover:bg-[#F8F9FD]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="save-provider-btn"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-xs font-bold transition-all press-scale disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Provider</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Warning Modal (Change 10 requirement) */}
      {deleteWarningData && (
        <div className="fixed inset-0 z-50 bg-[#252943]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center gap-2.5 text-rose-600 pb-2 border-b border-rose-100">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-[#252943]">Scheduled Batches Warning</h3>
            </div>

            <div className="space-y-2 text-xs text-[#252943]/80 leading-relaxed">
              <p className="font-semibold text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200">
                &ldquo;{deleteWarningData.warning}&rdquo;
              </p>
              <p>
                Disconnecting provider <strong>{deleteWarningData.name}</strong> will remove all its catalog services, favourites, and engagement mappings. Historical orders will be preserved for your records.
              </p>
            </div>

            <div className="pt-3 border-t border-[#DEE0ED] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteWarningData(null)}
                className="px-3.5 py-2 rounded-xl border border-[#DEE0ED] text-xs font-semibold text-[#252943]/70 hover:bg-[#F8F9FD]"
              >
                Keep Provider
              </button>
              <button
                type="button"
                id="confirm-force-delete-provider-btn"
                onClick={() => executeDeleteProvider(deleteWarningData.id, deleteWarningData.name, true)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all press-scale"
              >
                Confirm Delete & Cleanup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Key Modal */}
      {showEditModal && selectedConnection && (
        <div className="fixed inset-0 z-50 bg-[#252943]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
              <h3 className="text-sm font-bold text-[#252943] flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#3A4EFB]" />
                Update Credentials: {selectedConnection.providerName}
              </h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg text-[#252943]/60 hover:text-[#252943]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateProviderKey} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-[#252943]">New API Key (Leave empty to keep existing)</label>
                <input
                  type="password"
                  placeholder="Enter new SMM API key..."
                  value={providerKey}
                  onChange={(e) => setProviderKey(e.target.value)}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2 text-xs font-mono text-[#252943] focus:border-[#3A4EFB]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#252943]">Currency</label>
                <select
                  value={providerCurrency}
                  onChange={(e) => setProviderCurrency(e.target.value)}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2 text-xs text-[#252943] focus:border-[#3A4EFB]"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-[#DEE0ED] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-[#DEE0ED] text-xs font-semibold text-[#252943]/70 hover:bg-[#F8F9FD]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-xs font-bold transition-all press-scale disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save & Verify Key</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deposit INR Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 bg-[#252943]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
              <h3 className="text-sm font-bold text-[#252943] flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#3A4EFB]" />
                Add Funds to DhanSMM Wallet
              </h3>
              <button
                type="button"
                onClick={() => setShowDepositModal(false)}
                className="p-1 rounded-lg text-[#252943]/60 hover:text-[#252943]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDepositFunds} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-[#252943]">Deposit Amount (INR ₹)</label>
                <input
                  type="number"
                  min="50"
                  step="50"
                  required
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(Number(e.target.value))}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2 text-sm font-bold text-[#252943] focus:border-[#3A4EFB]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                {[100, 500, 1000, 2500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDepositAmount(amt)}
                    className="flex-1 py-1.5 rounded-lg border border-[#DEE0ED] hover:bg-[#F8F9FD] text-[11px] font-semibold text-[#252943]"
                  >
                    +₹{amt}
                  </button>
                ))}
              </div>

              <div className="pt-3 border-t border-[#DEE0ED] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-[#DEE0ED] text-xs font-semibold text-[#252943]/70 hover:bg-[#F8F9FD]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-[#E3FF3B] text-[#252943] text-xs font-bold hover:bg-[#d6f228] transition-colors flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Add Funds Now</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

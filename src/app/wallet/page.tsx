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
  ArrowDownLeft, 
  Loader2, 
  ShieldCheck, 
  ExternalLink,
  DollarSign,
  TrendingUp,
  X
} from "lucide-react";
import Link from "next/link";

interface ProviderBalanceCard {
  connectionId: string;
  providerName: string;
  success: boolean;
  cached?: boolean;
  balance: number | null;
  currency: string;
  lastSyncAt: string | null;
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
  const [selectedConnection, setSelectedConnection] = useState<any>(null);

  // Form States
  const [providerName, setProviderName] = useState("");
  const [providerUrl, setProviderUrl] = useState("https://api.smmprovider.com/v2");
  const [providerKey, setProviderKey] = useState("");
  const [providerCurrency, setProviderCurrency] = useState("USD");
  const [isMock, setIsMock] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(500);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadWalletData(forceRefresh = false) {
    try {
      if (forceRefresh) setRefreshingAll(true);
      const res = await fetch(`/api/wallet${forceRefresh ? "?refresh=true" : ""}`);
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

  async function handleDisconnectProvider(connectionId: string, name: string) {
    if (!confirm(`Are you sure you want to disconnect provider "${name}"?`)) return;

    try {
      const res = await fetch(`/api/user/providers/${connectionId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Disconnected "${name}" successfully`);
        setTimeout(() => setActionSuccess(null), 3000);
        await loadWalletData(true);
      } else {
        setActionError(data.error || "Failed to disconnect");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to disconnect provider");
    }
  }

  async function handleConnectProvider(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);

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

      setShowConnectModal(false);
      setProviderName("");
      setProviderKey("");
      setActionSuccess(data.message || "Connected provider successfully!");
      setTimeout(() => setActionSuccess(null), 4000);
      await loadWalletData(true);
    } catch (err: any) {
      setActionError(err.message || "Failed to connect provider");
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
          apiUrl: providerUrl.trim(),
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
      setActionSuccess("Updated provider credentials successfully!");
      setTimeout(() => setActionSuccess(null), 3000);
      await loadWalletData(true);
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
            DhanSMM Wallet & Provider Balances
          </h1>
          <p className="text-xs text-[#252943]/60 mt-0.5">
            Manage your DhanSMM INR wallet balance and view live balances for all connected SMM provider accounts.
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
            <span>{refreshingAll ? "Refreshing All..." : "Refresh All Balances"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowConnectModal(true)}
            className="px-4 py-2 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-xs font-bold transition-all press-scale shadow-subtle flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4 text-[#E3FF3B]" />
            <span>Connect SMM Provider</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="p-1 text-rose-500 hover:text-rose-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Grid: Left = INR Wallet Card, Right = Provider Cards Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* DhanSMM INR Wallet Card */}
        <div className="md:col-span-1 bg-gradient-to-br from-[#252943] to-[#1A1D31] text-white rounded-2xl p-6 shadow-subtle flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#3A4EFB]/20 rounded-full blur-2xl pointer-events-none" />
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#E3FF3B]">
                DhanSMM Account Wallet
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white/80">
                INR (₹)
              </span>
            </div>

            <div>
              <p className="text-xs text-white/60">Available Balance</p>
              <h2 className="text-3xl font-black tracking-tight text-white mt-1">
                ₹{walletBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
            </div>
            
            <p className="text-[11px] text-white/60 leading-relaxed">
              Used to pay for Full Organic Engagement schedules, automatic drip-feeds, and single orders upfront.
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
        <div className="md:col-span-2 bg-white rounded-2xl border border-[#DEE0ED] p-6 shadow-subtle flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#252943] flex items-center gap-2">
              <Server className="w-4 h-4 text-[#3A4EFB]" />
              Connected Provider Balances
            </span>
            <span className="text-xs text-[#252943]/60 font-medium">
              {providerBalances.length} Connected Provider{providerBalances.length === 1 ? "" : "s"}
            </span>
          </div>

          <p className="text-xs text-[#252943]/70 leading-relaxed">
            Orders placed through individual provider services are submitted directly to that provider&apos;s API. Each provider operates concurrently and independently: a timeout on one provider never blocks or delays orders on another.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#252943]/60">Total Upstream Providers</span>
                <p className="text-lg font-bold text-[#252943]">{providerBalances.length}</p>
              </div>
              <Server className="w-6 h-6 text-[#3A4EFB]/40" />
            </div>

            <div className="p-3 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#252943]/60">Active Live Endpoints</span>
                <p className="text-lg font-bold text-emerald-600">
                  {providerBalances.filter((p) => p.success).length} of {providerBalances.length} Active
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
            Your Connected SMM Provider Accounts
          </h3>
          <span className="text-xs text-[#252943]/50">30s cached balance with instant refresh</span>
        </div>

        {providerBalances.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-[#DEE0ED] space-y-3 shadow-subtle">
            <Server className="w-10 h-10 text-[#3A4EFB]/40 mx-auto" />
            <h4 className="text-sm font-bold text-[#252943]">No Provider Accounts Connected Yet</h4>
            <p className="text-xs text-[#252943]/60 max-w-md mx-auto">
              Connect your external SMM provider accounts (e.g. Zeofame, xmedia, or any SMM v2 provider) to check live balances and route orders.
            </p>
            <button
              type="button"
              onClick={() => setShowConnectModal(true)}
              className="px-4 py-2 rounded-xl bg-[#3A4EFB] text-white text-xs font-bold hover:bg-[#2C3FE0] transition-colors inline-flex items-center gap-1.5"
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
                  className="bg-white rounded-2xl border border-[#DEE0ED] p-5 shadow-subtle flex flex-col justify-between space-y-4 hover:border-[#3A4EFB]/30 transition-all"
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
                          title="Reconnect or update API Key"
                          className="p-1.5 rounded-lg text-[#252943]/60 hover:text-[#3A4EFB] hover:bg-[#F8F9FD] transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDisconnectProvider(provider.connectionId, provider.providerName)}
                          title="Disconnect provider"
                          className="p-1.5 rounded-lg text-[#252943]/60 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-[#252943]/60 block font-medium">
                        {provider.providerName} Balance
                      </span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-2xl font-black tracking-tight text-[#252943]">
                          {provider.balance !== null ? (
                            provider.currency === "USD" ? `$${provider.balance.toFixed(3)}` : `${provider.currency} ${provider.balance.toFixed(2)}`
                          ) : (
                            <span className="text-sm font-semibold text-[#252943]/40">Unavailable</span>
                          )}
                        </span>
                        <span className="text-xs font-semibold text-[#252943]/50">
                          {provider.currency}
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
                          <CheckCircle2 className="w-3 h-3" /> Live & Connected
                        </span>
                        <span>
                          {provider.lastSyncAt ? new Date(provider.lastSyncAt).toLocaleTimeString() : "Pending"}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#DEE0ED]/60 flex items-center justify-between text-[11px]">
                    <span className="text-[#252943]/60">Endpoint Status:</span>
                    <span className="font-semibold text-[#3A4EFB]">
                      {provider.cached ? "30s Cached" : "Fresh Read"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Wallet Transactions History Table */}
      <div className="bg-white rounded-2xl border border-[#DEE0ED] shadow-subtle p-6 space-y-4">
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

      {/* Connect Provider Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 bg-[#252943]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
              <h3 className="text-sm font-bold text-[#252943] flex items-center gap-2">
                <Server className="w-4 h-4 text-[#3A4EFB]" />
                Connect SMM Provider Account
              </h3>
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                className="p-1 rounded-lg text-[#252943]/60 hover:text-[#252943]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConnectProvider} className="space-y-3 text-xs">
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
                <label className="font-semibold text-[#252943]">Provider API URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://provider.com/api/v2"
                  value={providerUrl}
                  onChange={(e) => setProviderUrl(e.target.value)}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2 text-xs text-[#252943] focus:border-[#3A4EFB]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#252943]">Provider API Key</label>
                <input
                  type="password"
                  required
                  placeholder="Paste your SMM API key"
                  value={providerKey}
                  onChange={(e) => setProviderKey(e.target.value)}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2 text-xs text-[#252943] focus:border-[#3A4EFB]"
                />
                <span className="text-[10px] text-[#252943]/50">
                  Stored securely using AES-256-GCM encryption. Never returned in plaintext.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="font-semibold text-[#252943]">Provider Currency</label>
                  <select
                    value={providerCurrency}
                    onChange={(e) => setProviderCurrency(e.target.value)}
                    className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2 text-xs text-[#252943] focus:border-[#3A4EFB]"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="EUR">EUR (€)</option>
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

              <div className="pt-4 border-t border-[#DEE0ED] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
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
                  <span>Connect & Verify</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reconnect / Update Key Modal */}
      {showEditModal && selectedConnection && (
        <div className="fixed inset-0 z-50 bg-[#252943]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
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

            <form onSubmit={handleUpdateProviderKey} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-[#252943]">New API Key (Leave empty to keep existing)</label>
                <input
                  type="password"
                  placeholder="Enter new SMM API key..."
                  value={providerKey}
                  onChange={(e) => setProviderKey(e.target.value)}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2 text-xs text-[#252943] focus:border-[#3A4EFB]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#252943]">Provider Currency</label>
                <select
                  value={providerCurrency}
                  onChange={(e) => setProviderCurrency(e.target.value)}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2 text-xs text-[#252943] focus:border-[#3A4EFB]"
                >
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-[#DEE0ED] flex items-center justify-end gap-2">
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
                  <span>Save & Reconnect</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deposit INR Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 bg-[#252943]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
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

            <form onSubmit={handleDepositFunds} className="space-y-3 text-xs">
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
                    className="flex-1 py-1 rounded-lg bg-[#F8F9FD] border border-[#DEE0ED] text-xs font-semibold hover:border-[#3A4EFB] text-[#252943]"
                  >
                    +₹{amt}
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t border-[#DEE0ED] flex items-center justify-end gap-2">
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
                  className="px-4 py-2 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-xs font-bold transition-all press-scale disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Deposit</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

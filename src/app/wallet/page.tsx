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
  Zap,
  ArrowLeftRight,
  Download,
  FileText,
  Printer,
  X,
  Clock,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { formatProviderBalance } from "@/lib/currency";
import { BRAND } from "@/lib/brand";
import { BinanceAddFundsModal } from "@/components/BinanceAddFundsModal";

function sanitizeProviderName(name: string): string {
  if (!name) return "Provider Account";
  const lower = name.toLowerCase();
  if (lower.includes("xmedia") || lower.includes("x media")) return "Views Provider";
  if (lower.includes("zeofame")) return "Engagement Provider";
  if (lower.includes("airgrow")) return "Growth Provider";
  return name;
}

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

interface PaymentDepositRecord {
  id: string;
  depositRef: string;
  userId: string;
  method: string;
  inrAmount: number;
  usdtAmount: number;
  exchangeRate: number;
  binanceUid: string;
  senderBinanceId?: string | null;
  txnId?: string | null;
  status: string;
  verifiedAt?: string | null;
  createdAt: string;
}

export default function WalletPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"addfunds" | "providers">("addfunds");

  // Wallet & Deposit Data
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [deposits, setDeposits] = useState<PaymentDepositRecord[]>([]);
  const [providerBalances, setProviderBalances] = useState<ProviderBalanceCard[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(90.0);
  const [binanceUid, setBinanceUid] = useState<string>("1161493552");

  // Loading States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Currency Converter Form States
  const [inrAmountStr, setInrAmountStr] = useState<string>("200");
  const [usdAmountStr, setUsdAmountStr] = useState<string>("2.22");

  // Modals
  const [showBinanceModal, setShowBinanceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PaymentDepositRecord | null>(null);

  // Admin Provider Management Modals & States
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<any>(null);
  const [providerName, setProviderName] = useState("");
  const [providerUrl, setProviderUrl] = useState("https://api.smmprovider.com/v2");
  const [providerKey, setProviderKey] = useState("");
  const [providerCurrency, setProviderCurrency] = useState("USD");
  const [isMock, setIsMock] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // Load auth, wallet & deposits
  async function loadAllData(forceRefresh = false) {
    if (forceRefresh) setRefreshing(true);
    try {
      // 1. Session check
      const authRes = await fetch("/api/auth/session");
      const authData = await authRes.json();
      if (authData.authenticated) {
        setIsAdmin(authData.role === "ADMIN");
        setSessionUser(authData);
      }

      // 2. Deposit history and config
      const depositRes = await fetch("/api/wallet/deposit");
      const depositData = await depositRes.json();
      if (depositData.success) {
        if (Array.isArray(depositData.deposits)) {
          setDeposits(depositData.deposits);
        }
        if (depositData.config) {
          if (depositData.config.exchangeRate) {
            setExchangeRate(depositData.config.exchangeRate);
          }
          if (depositData.config.binanceUid) {
            setBinanceUid(depositData.config.binanceUid);
          }
        }
      }

      // 3. Wallet balance and provider list
      const walletRes = await fetch(`/api/wallet${forceRefresh ? "?refresh=true" : ""}`, {
        cache: "no-store",
      });
      const walletData = await walletRes.json();
      if (walletData.success) {
        if (typeof walletData.wallet?.balance === "number") {
          setWalletBalance(walletData.wallet.balance);
        }
        if (Array.isArray(walletData.providerBalances)) {
          setProviderBalances(walletData.providerBalances);
        }
      }
    } catch (err) {
      console.error("Failed to load Add Funds page data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadAllData();

    const handleBalanceUpdate = () => {
      void loadAllData(true);
    };
    window.addEventListener("balance-updated", handleBalanceUpdate);
    return () => {
      window.removeEventListener("balance-updated", handleBalanceUpdate);
    };
  }, []);

  // Sync inputs on exchange rate change
  useEffect(() => {
    if (inrAmountStr) {
      const inr = parseFloat(inrAmountStr);
      if (!isNaN(inr) && inr > 0 && exchangeRate > 0) {
        setUsdAmountStr((inr / exchangeRate).toFixed(2));
      }
    }
  }, [exchangeRate]);

  // Two-way currency input handlers
  function handleInrChange(val: string) {
    setInrAmountStr(val);
    const inr = parseFloat(val);
    if (!isNaN(inr) && inr >= 0 && exchangeRate > 0) {
      setUsdAmountStr((inr / exchangeRate).toFixed(2));
    } else {
      setUsdAmountStr("");
    }
  }

  function handleUsdChange(val: string) {
    setUsdAmountStr(val);
    const usd = parseFloat(val);
    if (!isNaN(usd) && usd >= 0 && exchangeRate > 0) {
      setInrAmountStr((usd * exchangeRate).toFixed(2));
    } else {
      setInrAmountStr("");
    }
  }

  function selectPreset(inr: number) {
    setInrAmountStr(inr.toString());
    if (exchangeRate > 0) {
      setUsdAmountStr((inr / exchangeRate).toFixed(2));
    }
  }

  function handlePayClick() {
    const inr = parseFloat(inrAmountStr);
    if (isNaN(inr) || inr < 50) {
      setActionError("Minimum deposit amount is ₹50.");
      return;
    }
    setActionError(null);
    setShowBinanceModal(true);
  }

  // Admin provider actions
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
      }
    } catch (err) {
      console.error("Failed to refresh provider", err);
    } finally {
      setRefreshingId(null);
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
      await loadAllData(true);
      window.dispatchEvent(new CustomEvent("balance-updated"));
    } catch (err: any) {
      setActionError(err.message || "Failed to connect provider");
      setImportStatus(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-2 text-sm text-[#252943]/60">
          <Loader2 className="w-5 h-5 animate-spin text-[#3A4EFB]" />
          <span>Loading Add Funds & Deposit Engine...</span>
        </div>
      </div>
    );
  }

  const inrVal = parseFloat(inrAmountStr) || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-16">
      {/* Top Header & Balance Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DEE0ED]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#252943] flex items-center gap-2.5">
            <Wallet className="w-6 h-6 text-[#3A4EFB]" />
            <span>Add Funds</span>
          </h1>
          <p className="text-xs text-[#252943]/60 mt-0.5">
            Automatic instant wallet credit via Binance Pay
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Balance Pill */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#DEE0ED] shadow-subtle">
            <span className="text-[11px] font-semibold text-[#252943]/60 uppercase tracking-wider">
              Balance:
            </span>
            <span className="text-sm font-black text-[#252943]">
              ₹{walletBalance.toFixed(2)}
            </span>
            <button
              type="button"
              onClick={() => loadAllData(true)}
              disabled={refreshing}
              title="Refresh Balance"
              className="p-1 rounded-lg hover:bg-[#F8F9FD] text-[#252943]/50 hover:text-[#3A4EFB] transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#3A4EFB]" : ""}`} />
            </button>
          </div>

          {/* Admin Toggle if Admin */}
          {isAdmin && (
            <div className="flex items-center bg-[#F8F9FD] p-1 rounded-xl border border-[#DEE0ED]">
              <button
                type="button"
                onClick={() => setActiveTab("addfunds")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "addfunds"
                    ? "bg-[#3A4EFB] text-white shadow-sm"
                    : "text-[#252943]/70 hover:text-[#252943]"
                }`}
              >
                Add Funds
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("providers")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "providers"
                    ? "bg-[#3A4EFB] text-white shadow-sm"
                    : "text-[#252943]/70 hover:text-[#252943]"
                }`}
              >
                SMM Providers ({providerBalances.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Global Action Alerts */}
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

      {/* VIEW: ADD FUNDS (PRIMARY MATCHING REFERENCE SCREENSHOT) */}
      {activeTab === "addfunds" && (
        <div className="space-y-6">
          {/* Main Add Funds Card */}
          <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 sm:p-8 shadow-subtle space-y-6">
            {/* Method Dropdown */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#252943] block">
                Method
              </label>
              <div className="relative">
                <select
                  disabled
                  value="binance"
                  className="w-full px-4 py-3 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs font-bold text-[#252943] appearance-none cursor-default pr-10 focus:outline-none"
                >
                  <option value="binance">Binance Pay [Auto]</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Clean Instructions List matching reference screenshot */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-bold text-[#252943] block">
                Instruction
              </label>
              <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED]/80 text-xs text-[#252943]/80 space-y-2 font-medium">
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-white border border-[#DEE0ED] text-[11px] font-bold text-[#3A4EFB] flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>Put the Amount</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-white border border-[#DEE0ED] text-[11px] font-bold text-[#3A4EFB] flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>Send money to our ID (or scan Binance Pay QR)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-white border border-[#DEE0ED] text-[11px] font-bold text-[#3A4EFB] flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span>Enter the process ID / Binance Order ID</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-white border border-[#DEE0ED] text-[11px] font-bold text-[#3A4EFB] flex items-center justify-center shrink-0">
                    4
                  </span>
                  <span>Click Verify</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-white border border-[#DEE0ED] text-[11px] font-bold text-emerald-600 flex items-center justify-center shrink-0">
                    5
                  </span>
                  <span className="text-emerald-700 font-semibold">
                    The balance is added automatically. !!
                  </span>
                </div>
              </div>
            </div>

            {/* Dual Live Currency Input Row */}
            <div className="pt-2 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center relative">
                {/* INR Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#252943] block">
                    Amount , INR
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="50"
                      value={inrAmountStr}
                      onChange={(e) => handleInrChange(e.target.value)}
                      placeholder="200"
                      className="w-full px-4 py-3 rounded-xl bg-white border border-[#DEE0ED] focus:border-[#3A4EFB] text-sm font-bold text-[#252943] focus:outline-none transition-all"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#252943]/40">
                      ₹ INR
                    </span>
                  </div>
                </div>

                {/* Exchange Icon (in center for desktop) */}
                <div className="hidden sm:flex absolute left-1/2 top-[62%] -translate-x-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white border border-[#DEE0ED] items-center justify-center shadow-sm text-[#3A4EFB]">
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </div>

                {/* USD Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#252943] block">
                    Amount, USD
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0.5"
                      value={usdAmountStr}
                      onChange={(e) => handleUsdChange(e.target.value)}
                      placeholder="2.22"
                      className="w-full px-4 py-3 rounded-xl bg-white border border-[#DEE0ED] focus:border-[#3A4EFB] text-sm font-bold text-[#252943] focus:outline-none transition-all"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#252943]/40">
                      $ USDT
                    </span>
                  </div>
                </div>
              </div>

              {/* Preset Amount Chips & Exchange Rate */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-[#252943]/60">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-[#252943]/50">Presets:</span>
                  {[100, 200, 500, 1000, 2500, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => selectPreset(amt)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all press-scale ${
                        parseFloat(inrAmountStr) === amt
                          ? "bg-[#3A4EFB] text-white"
                          : "bg-[#F8F9FD] border border-[#DEE0ED] text-[#252943]/70 hover:bg-[#DEE0ED]/60"
                      }`}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>
                <span className="font-mono text-[11px] font-semibold text-[#252943]/60">
                  Rate: 1 USDT = ₹{exchangeRate.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Primary Action Button matching reference screenshot */}
            <div className="pt-2">
              <button
                type="button"
                id="addfunds-pay-btn"
                onClick={handlePayClick}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#E63946] hover:bg-[#d62839] text-white text-sm font-black text-center transition-all shadow-subtle press-scale flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>Pay {inrVal > 0 ? `₹${inrVal.toFixed(2)} (${usdAmountStr || "0.00"} USDT)` : ""}</span>
              </button>
            </div>
          </div>

          {/* Deposit History Table Card matching reference screenshot */}
          <div className="bg-white rounded-3xl border border-[#DEE0ED] shadow-subtle overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-[#DEE0ED] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#252943] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#3A4EFB]" />
                  <span>Deposit History</span>
                </h3>
                <p className="text-[11px] text-[#252943]/60 mt-0.5">
                  Recent Binance Pay deposit records and official transaction receipts
                </p>
              </div>

              <button
                type="button"
                onClick={() => loadAllData(true)}
                disabled={refreshing}
                title="Refresh Deposit History"
                className="p-1.5 rounded-lg border border-[#DEE0ED] hover:bg-[#F8F9FD] text-[#252943]/60 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#3A4EFB]" : ""}`} />
              </button>
            </div>

            {deposits.length === 0 ? (
              <div className="p-12 text-center space-y-2 text-[#252943]/60">
                <Wallet className="w-8 h-8 text-[#3A4EFB]/30 mx-auto" />
                <p className="text-xs font-semibold">No deposits recorded yet</p>
                <p className="text-[11px] text-[#252943]/40">
                  Enter an amount above and click Pay to add funds to your wallet.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8F9FD] border-b border-[#DEE0ED] text-[#252943]/70 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-5">ID</th>
                      <th className="py-3 px-5">Date</th>
                      <th className="py-3 px-5">Method</th>
                      <th className="py-3 px-5">Amount</th>
                      <th className="py-3 px-5 text-right">Invoice / Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DEE0ED]/60 font-medium">
                    {deposits.map((dep) => {
                      const isVerified = dep.status === "VERIFIED";
                      const isPendingReview = dep.status === "PENDING_REVIEW";
                      const isPending = dep.status === "PENDING";
                      const isRejected = dep.status === "REJECTED";

                      return (
                        <tr key={dep.id} className="hover:bg-[#F8F9FD]/60 transition-colors">
                          <td className="py-3.5 px-5 font-mono text-[11px] font-bold text-[#252943]">
                            {dep.depositRef || dep.id.slice(0, 8)}
                          </td>
                          <td className="py-3.5 px-5 text-[#252943]/70 text-[11px] whitespace-nowrap">
                            {new Date(dep.createdAt).toLocaleString("sv-SE", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </td>
                          <td className="py-3.5 px-5 text-[#252943] text-[11px] font-medium">
                            Binance Pay [Auto]
                          </td>
                          <td className="py-3.5 px-5 font-bold text-[#252943] whitespace-nowrap">
                            = {dep.inrAmount.toFixed(2)}
                            <span className="text-[10px] text-[#252943]/50 font-normal ml-1">
                              ({dep.usdtAmount.toFixed(2)} USDT)
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            {isVerified ? (
                              <button
                                type="button"
                                onClick={() => setSelectedInvoice(dep)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E63946] hover:bg-[#d62839] text-white text-[11px] font-bold transition-all press-scale shadow-sm cursor-pointer"
                              >
                                <Download className="w-3 h-3" />
                                <span>Download invoice</span>
                              </button>
                            ) : isPending || isPendingReview ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setInrAmountStr(dep.inrAmount.toString());
                                  setShowBinanceModal(true);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-700 border border-blue-500/30 text-[11px] font-semibold transition-colors"
                              >
                                <span>Verify Payment</span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-semibold">
                                <span>Rejected</span>
                              </span>
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
      )}

      {/* VIEW: ADMIN SMM PROVIDERS MANAGER (ONLY VISIBLE TO ADMINS) */}
      {isAdmin && activeTab === "providers" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#252943] flex items-center gap-2">
                <Server className="w-4 h-4 text-[#3A4EFB]" />
                Connected Upstream SMM Providers
              </h3>
              <p className="text-xs text-[#252943]/60">
                Balances shown in provider&apos;s own currency. Providers execute independently.
              </p>
            </div>

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

          {providerBalances.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-[#DEE0ED] space-y-3 shadow-subtle">
              <Server className="w-10 h-10 text-[#3A4EFB]/40 mx-auto" />
              <h4 className="text-sm font-bold text-[#252943]">No SMM Providers Connected</h4>
              <p className="text-xs text-[#252943]/60 max-w-md mx-auto">
                Add your SMM provider endpoint to import services and route orders.
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
                const isRefreshingSingle = refreshingId === provider.connectionId;

                return (
                  <div
                    key={provider.connectionId}
                    className="bg-white rounded-3xl border border-[#DEE0ED] p-5 shadow-subtle flex flex-col justify-between space-y-4 hover:border-[#3A4EFB]/30 transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#F8F9FD] border border-[#DEE0ED] text-[#252943]">
                          {sanitizeProviderName(provider.providerName)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleRefreshSingleProvider(provider.connectionId)}
                            disabled={isRefreshingSingle}
                            title="Refresh live balance from provider API"
                            className="p-1.5 rounded-lg text-[#252943]/60 hover:text-[#3A4EFB] hover:bg-[#F8F9FD] transition-colors disabled:opacity-50"
                          >
                            <RefreshCw
                              className={`w-3.5 h-3.5 ${isRefreshingSingle ? "animate-spin text-[#3A4EFB]" : ""}`}
                            />
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
      )}

      {/* Binance Add Funds Modal */}
      <BinanceAddFundsModal
        isOpen={showBinanceModal}
        onClose={() => setShowBinanceModal(false)}
        currentBalance={walletBalance}
        initialAmount={parseFloat(inrAmountStr) || 100}
        onSuccess={(newBal) => {
          setWalletBalance(newBal);
          loadAllData(true);
        }}
      />

      {/* Official Download Invoice / Receipt Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-[#DEE0ED] shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6 animate-scaleUp">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#DEE0ED] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#3A4EFB] text-white font-black text-sm flex items-center justify-center">
                    A
                  </div>
                  <span className="font-black text-lg tracking-tight text-[#252943]">
                    {BRAND.name}
                  </span>
                </div>
                <p className="text-[11px] text-[#252943]/60 mt-0.5">
                  Official Deposit Invoice & Tax Receipt
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="p-1.5 rounded-lg text-[#252943]/50 hover:text-[#252943] hover:bg-[#F8F9FD] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Summary Details */}
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED]">
                <div>
                  <span className="text-[10px] text-[#252943]/50 uppercase tracking-wider block font-bold">
                    Invoice ID
                  </span>
                  <span className="font-mono font-bold text-[#252943] text-sm">
                    {selectedInvoice.depositRef}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#252943]/50 uppercase tracking-wider block font-bold">
                    Status
                  </span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    PAID & CREDITED
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#252943]/50 uppercase tracking-wider block font-bold">
                    Date & Time
                  </span>
                  <span className="font-medium text-[#252943]">
                    {new Date(selectedInvoice.createdAt).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#252943]/50 uppercase tracking-wider block font-bold">
                    Payment Method
                  </span>
                  <span className="font-medium text-[#252943]">
                    Binance Pay [Auto]
                  </span>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-[#DEE0ED] rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-[#F8F9FD] text-[10px] font-bold uppercase text-[#252943]/60 border-b border-[#DEE0ED]">
                    <tr>
                      <th className="py-2.5 px-4">Description</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DEE0ED]/60">
                    <tr>
                      <td className="py-3 px-4 font-medium text-[#252943]">
                        Wallet Balance Deposit
                        <span className="block text-[10px] text-[#252943]/50 font-normal mt-0.5">
                          Binance Order ID: {selectedInvoice.txnId || "Direct Pay"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-[#252943]">
                        ₹{selectedInvoice.inrAmount.toFixed(2)}
                      </td>
                    </tr>
                    <tr className="bg-[#F8F9FD]/50">
                      <td className="py-2.5 px-4 text-[11px] font-semibold text-[#252943]/70">
                        Total Crypto Equivalent (USDT)
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">
                        {selectedInvoice.usdtAmount.toFixed(2)} USDT
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-xs font-bold transition-all press-scale flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Invoice</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="py-2.5 px-4 rounded-xl bg-[#F8F9FD] hover:bg-[#DEE0ED]/60 border border-[#DEE0ED] text-[#252943] text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Connect Provider Modal */}
      {isAdmin && showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-[#DEE0ED] shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
              <h3 className="text-sm font-bold text-[#252943] flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-[#3A4EFB]" />
                Connect Upstream SMM Provider
              </h3>
              <button
                onClick={() => setShowConnectModal(false)}
                className="p-1 text-[#252943]/60 hover:text-[#252943]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConnectProvider} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-[#252943] block mb-1">Provider Nickname</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Views Engine #1"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] focus:border-[#3A4EFB] outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-[#252943] block mb-1">API URL (V2 Standard)</label>
                <input
                  type="url"
                  required
                  value={providerUrl}
                  onChange={(e) => setProviderUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] focus:border-[#3A4EFB] outline-none font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#252943] block mb-1">API Key</label>
                <input
                  type="password"
                  required
                  placeholder="Paste provider API key"
                  value={providerKey}
                  onChange={(e) => setProviderKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] focus:border-[#3A4EFB] outline-none font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isMock}
                    onChange={(e) => setIsMock(e.target.checked)}
                    className="rounded text-[#3A4EFB]"
                  />
                  <span>Mock Mode (Local Simulator)</span>
                </label>
              </div>

              {importStatus && (
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700 text-[11px] flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{importStatus}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#DEE0ED]">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#DEE0ED] text-[#252943]/70 hover:bg-[#F8F9FD]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save & Connect</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

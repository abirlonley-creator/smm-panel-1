"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Wallet,
  RefreshCw,
  PlusCircle,
  Server,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  ShieldCheck,
  ArrowLeftRight,
  Download,
  Printer,
  X,
  Clock,
  TrendingUp,
} from "lucide-react";
import { formatProviderBalance } from "@/lib/currency";
import { BRAND } from "@/lib/brand";
import { WalletPageSkeleton } from "@/components/ui/PageLoadingSkeletons";

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
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<"addfunds" | "providers">("addfunds");

  // Wallet & Deposit Data
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [deposits, setDeposits] = useState<PaymentDepositRecord[]>([]);
  const [providerBalances, setProviderBalances] = useState<ProviderBalanceCard[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(90.0);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Currency Converter Form States
  const [inrAmountStr, setInrAmountStr] = useState<string>("250");
  const [usdAmountStr, setUsdAmountStr] = useState<string>("2.78");
  const [selectedInvoice, setSelectedInvoice] = useState<PaymentDepositRecord | null>(null);

  // Admin Provider Management Modals & States
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [providerName, setProviderName] = useState("");
  const [providerUrl, setProviderUrl] = useState("https://api.smmprovider.com/v2");
  const [providerKey, setProviderKey] = useState("");
  const [providerCurrency, setProviderCurrency] = useState("USD");
  const [isMock, setIsMock] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  async function loadAllData(forceRefresh = false) {
    if (forceRefresh) setRefreshing(true);
    try {
      const authRes = await fetch("/api/auth/session");
      const authData = await authRes.json();
      if (authData.authenticated) {
        setIsAdmin(authData.role === "ADMIN");
      }

      const depositRes = await fetch("/api/wallet/deposit", { cache: "no-store" });
      const depositData = await depositRes.json();
      if (depositData.success) {
        if (Array.isArray(depositData.deposits)) {
          setDeposits(depositData.deposits);
        }
        if (depositData.config?.exchangeRate) {
          setExchangeRate(depositData.config.exchangeRate);
        }
      }

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
      console.error("Failed to load wallet data:", err);
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

  useEffect(() => {
    if (inrAmountStr) {
      const inr = parseFloat(inrAmountStr);
      if (!isNaN(inr) && inr > 0 && exchangeRate > 0) {
        setUsdAmountStr((inr / exchangeRate).toFixed(2));
      }
    }
  }, [exchangeRate]);

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

  function handleProceedToCheckout() {
    const inr = parseFloat(inrAmountStr);
    if (isNaN(inr) || inr < 50) {
      setActionError("Minimum deposit amount is ₹50.");
      return;
    }
    setActionError(null);
    router.push(`/wallet/pay?amount=${Math.round(inr)}`);
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
    return <WalletPageSkeleton />;
  }

  const inrVal = parseFloat(inrAmountStr) || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-16">
      {/* Top Header & Balance Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E4E0D3]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111413] flex items-center gap-2.5">
            <Wallet className="w-6 h-6 text-[#5E8C1F]" />
            <span>Wallet &amp; Add Funds</span>
          </h1>
          <p className="text-xs text-[#5B625F] mt-0.5">
            Automatic verified wallet recharge via Binance Pay
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Balance Pill */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#E4E0D3] shadow-subtle">
            <span className="text-[11px] font-semibold text-[#5B625F] uppercase tracking-wider">
              Balance:
            </span>
            <span className="text-sm font-black font-mono text-[#111413]">
              ₹{walletBalance.toFixed(2)}
            </span>
            <button
              type="button"
              onClick={() => loadAllData(true)}
              disabled={refreshing}
              title="Refresh Balance"
              className="p-1 rounded-lg hover:bg-[#F3F1EA] text-[#5B625F] hover:text-[#111413] transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#5E8C1F]" : ""}`} />
            </button>
          </div>

          {isAdmin && (
            <div className="flex items-center bg-white p-1 rounded-xl border border-[#E4E0D3]">
              <button
                type="button"
                onClick={() => setActiveTab("addfunds")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "addfunds"
                    ? "bg-[#111413] text-[#D4F04F]"
                    : "text-[#5B625F] hover:text-[#111413]"
                }`}
              >
                Add Funds
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("providers")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "providers"
                    ? "bg-[#111413] text-[#D4F04F]"
                    : "text-[#5B625F] hover:text-[#111413]"
                }`}
              >
                Providers ({providerBalances.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-[#EEF6EC] border border-[#5E8C1F]/25 text-xs font-medium text-[#18422B] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#5E8C1F] shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3.5 rounded-xl bg-[#FDF2EF] border border-[#C4552D]/25 text-xs font-medium text-[#C4552D] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="p-1 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* VIEW: SIMPLIFIED ADD FUNDS */}
      {activeTab === "addfunds" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
            {/* Left Dark Balance Card */}
            <div className="md:col-span-5 rounded-3xl bg-[#111413] text-white p-6 flex flex-col justify-between border border-[#222826]">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9AA39F]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#D4F04F]" />
                  <span>Available Balance</span>
                </span>
                <div className="text-3xl font-black font-mono tracking-tight text-white">
                  ₹{walletBalance.toFixed(2)}
                </div>
                <p className="text-xs text-[#9AA39F] leading-relaxed">
                  Used automatically for all organic engagement and drip campaigns. Verified via Binance Pay with strict one-time Order ID protection.
                </p>
              </div>

              <div className="pt-6 space-y-2 text-[11px] text-[#9AA39F] border-t border-[#222826] mt-6">
                <div className="flex items-center justify-between">
                  <span>Payment Method</span>
                  <span className="text-white font-semibold">Binance Pay (USDT)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Conversion Rate</span>
                  <span className="text-[#D4F04F] font-mono font-semibold">
                    1 USDT = ₹{exchangeRate.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Clean Recharge Selector -> Navigates to Dedicated /wallet/pay */}
            <div className="md:col-span-7 bg-white rounded-3xl border border-[#E4E0D3] p-6 space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-bold text-[#111413]">
                    Quick Top-Up
                  </h2>
                  <p className="text-xs text-[#5B625F] mt-0.5">
                    Pick an amount to open the dedicated Binance Pay checkout page.
                  </p>
                </div>

                {/* Presets */}
                <div className="flex flex-wrap gap-2">
                  {[100, 250, 500, 1000, 2500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => selectPreset(amt)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                        parseFloat(inrAmountStr) === amt
                          ? "bg-[#111413] text-[#D4F04F]"
                          : "bg-[#F3F1EA] text-[#5B625F] hover:text-[#111413]"
                      }`}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>

                {/* INR / USDT Two-way Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center relative">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#5B625F] block">
                      Amount (INR)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="50"
                        value={inrAmountStr}
                        onChange={(e) => handleInrChange(e.target.value)}
                        placeholder="250"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F5] border border-[#E4E0D3] focus:bg-white focus:border-[#111413] text-sm font-bold text-[#111413] font-mono outline-none transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#5B625F]">
                        INR
                      </span>
                    </div>
                  </div>

                  <div className="hidden sm:flex absolute left-1/2 top-[63%] -translate-x-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white border border-[#E4E0D3] items-center justify-center text-[#111413]">
                    <ArrowLeftRight className="w-3 h-3" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#5B625F] block">
                      Equivalent (USDT)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0.5"
                        value={usdAmountStr}
                        onChange={(e) => handleUsdChange(e.target.value)}
                        placeholder="2.78"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F5] border border-[#E4E0D3] focus:bg-white focus:border-[#111413] text-sm font-bold text-[#111413] font-mono outline-none transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#5B625F]">
                        USDT
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                id="addfunds-pay-btn"
                onClick={handleProceedToCheckout}
                className="w-full py-3.5 px-5 rounded-2xl bg-[#D4F04F] hover:bg-[#C5E23A] active:scale-[0.98] text-[#111413] text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <span>
                  Proceed to Payment {inrVal > 0 ? `(₹${inrVal.toFixed(0)} · ${usdAmountStr || "0.00"} USDT)` : ""}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Simplified Deposit History Table */}
          <div className="bg-white rounded-3xl border border-[#E4E0D3] overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-[#E4E0D3] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#111413] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#5E8C1F]" />
                  <span>Deposit History</span>
                </h3>
                <p className="text-[11px] text-[#5B625F] mt-0.5">
                  Verified transactions and downloadable payment receipts
                </p>
              </div>

              <button
                type="button"
                onClick={() => loadAllData(true)}
                disabled={refreshing}
                title="Refresh Deposit History"
                className="p-1.5 rounded-lg border border-[#E4E0D3] hover:bg-[#F3F1EA] text-[#5B625F] transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#5E8C1F]" : ""}`} />
              </button>
            </div>

            {deposits.length === 0 ? (
              <div className="p-12 text-center space-y-2 text-[#5B625F]">
                <Wallet className="w-8 h-8 text-[#5B625F]/40 mx-auto" />
                <p className="text-xs font-semibold text-[#111413]">No deposits yet</p>
                <p className="text-[11px]">
                  Select an amount above and click Proceed to Payment to add funds.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF9F5] border-b border-[#E4E0D3] text-[#5B625F] font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-5">Reference</th>
                      <th className="py-3 px-5">Date</th>
                      <th className="py-3 px-5">Amount</th>
                      <th className="py-3 px-5 text-right">Status / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E0D3]/60 font-medium">
                    {deposits.map((dep) => {
                      const isVerified = dep.status === "VERIFIED";
                      const isPending = dep.status === "PENDING" || dep.status === "PENDING_REVIEW";

                      return (
                        <tr key={dep.id} className="hover:bg-[#FAF9F5] transition-colors">
                          <td className="py-3.5 px-5 font-mono text-[11px] font-bold text-[#111413]">
                            {dep.depositRef || dep.id.slice(0, 8)}
                          </td>
                          <td className="py-3.5 px-5 text-[#5B625F] text-[11px] whitespace-nowrap">
                            {new Date(dep.createdAt).toLocaleString("sv-SE", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3.5 px-5 font-bold text-[#111413] whitespace-nowrap font-mono">
                            ₹{dep.inrAmount.toFixed(2)}
                            <span className="text-[10px] text-[#5B625F] font-normal ml-1.5">
                              ({dep.usdtAmount.toFixed(2)} USDT)
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            {isVerified ? (
                              <button
                                type="button"
                                onClick={() => setSelectedInvoice(dep)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EEF6EC] hover:bg-[#5E8C1F]/20 text-[#5E8C1F] border border-[#5E8C1F]/25 text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                <Download className="w-3 h-3" />
                                <span>Receipt</span>
                              </button>
                            ) : isPending ? (
                              dep.txnId ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FBF0DC] text-[#B7791F] border border-[#B7791F]/30 text-[11px] font-semibold">
                                  <Clock className="w-3 h-3" />
                                  <span>In Review</span>
                                </span>
                              ) : (
                                <Link
                                  href={`/wallet/pay?depositId=${dep.id}&amount=${Math.round(dep.inrAmount)}`}
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#D4F04F] hover:bg-[#C5E23A] text-[#111413] text-[11px] font-bold transition-colors"
                                >
                                  <span>Verify Order ID</span>
                                  <ArrowRight className="w-3 h-3" />
                                </Link>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FDF2EF] text-[#C4552D] border border-[#C4552D]/25 text-[11px] font-semibold">
                                Rejected
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

      {/* VIEW: ADMIN PROVIDERS */}
      {isAdmin && activeTab === "providers" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#111413] flex items-center gap-2">
                <Server className="w-4 h-4 text-[#5E8C1F]" />
                <span>Connected Upstream SMM Providers</span>
              </h3>
              <p className="text-xs text-[#5B625F]">
                Balances shown in each provider&apos;s own currency.
              </p>
            </div>

            <button
              type="button"
              id="connect-provider-btn"
              onClick={() => setShowConnectModal(true)}
              className="px-4 py-2 rounded-xl bg-[#D4F04F] hover:bg-[#C5E23A] text-[#111413] text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Provider</span>
            </button>
          </div>

          {providerBalances.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-[#E4E0D3] space-y-3">
              <Server className="w-10 h-10 text-[#5B625F]/40 mx-auto" />
              <h4 className="text-sm font-bold text-[#111413]">No SMM Providers Connected</h4>
              <button
                type="button"
                onClick={() => setShowConnectModal(true)}
                className="px-4 py-2 rounded-xl bg-[#D4F04F] text-[#111413] text-xs font-bold hover:bg-[#C5E23A] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
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
                    className="bg-white rounded-3xl border border-[#E4E0D3] p-5 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#FAF9F5] border border-[#E4E0D3] text-[#111413]">
                          {sanitizeProviderName(provider.providerName)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRefreshSingleProvider(provider.connectionId)}
                          disabled={isRefreshingSingle}
                          className="p-1.5 rounded-lg text-[#5B625F] hover:text-[#111413] hover:bg-[#F3F1EA] transition-colors cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingSingle ? "animate-spin text-[#5E8C1F]" : ""}`} />
                        </button>
                      </div>

                      <div>
                        <span className="text-[11px] text-[#5B625F] block font-medium">
                          Live Balance
                        </span>
                        <span className="text-2xl font-black tracking-tight text-[#111413] font-mono">
                          {provider.balance !== null
                            ? formatProviderBalance(provider.balance, provider.currency)
                            : "Unavailable"}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#E4E0D3]/60 flex items-center justify-between text-[11px]">
                      <span className="text-[#5B625F]">Status:</span>
                      <span className="font-semibold text-[#5E8C1F]">
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

      {/* Official Receipt Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-[#E4E0D3] shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between border-b border-[#E4E0D3] pb-4">
              <div>
                <img
                  src="/brand/logos/lockup-horizontal-on-light.svg"
                  alt={BRAND.name}
                  className="h-7 w-auto"
                />
                <p className="text-[11px] text-[#5B625F] mt-1">
                  Official Deposit Receipt
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="p-1.5 rounded-lg text-[#5B625F] hover:text-[#111413] hover:bg-[#F3F1EA] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-[#FAF9F5] border border-[#E4E0D3]">
                <div>
                  <span className="text-[10px] text-[#5B625F] uppercase tracking-wider block font-bold">
                    Invoice ID
                  </span>
                  <span className="font-mono font-bold text-[#111413] text-sm">
                    {selectedInvoice.depositRef}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#5B625F] uppercase tracking-wider block font-bold">
                    Status
                  </span>
                  <span className="inline-flex items-center gap-1 font-bold text-[#5E8C1F]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    VERIFIED &amp; CREDITED
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#5B625F] uppercase tracking-wider block font-bold">
                    Date &amp; Time
                  </span>
                  <span className="font-medium text-[#111413]">
                    {new Date(selectedInvoice.createdAt).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#5B625F] uppercase tracking-wider block font-bold">
                    Method
                  </span>
                  <span className="font-medium text-[#111413]">Binance Pay [Auto]</span>
                </div>
              </div>

              <div className="border border-[#E4E0D3] rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-[#FAF9F5] text-[10px] font-bold uppercase text-[#5B625F] border-b border-[#E4E0D3]">
                    <tr>
                      <th className="py-2.5 px-4">Description</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E0D3]/60">
                    <tr>
                      <td className="py-3 px-4 font-medium text-[#111413]">
                        Wallet Balance Deposit
                        <span className="block text-[10px] text-[#5B625F] font-mono mt-0.5">
                          Order ID: {selectedInvoice.txnId || "Direct Pay"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black font-mono text-[#111413]">
                        ₹{selectedInvoice.inrAmount.toFixed(2)}
                      </td>
                    </tr>
                    <tr className="bg-[#FAF9F5]">
                      <td className="py-2.5 px-4 text-[11px] font-semibold text-[#5B625F]">
                        USDT Received
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-[#5E8C1F]">
                        {selectedInvoice.usdtAmount.toFixed(2)} USDT
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#111413] hover:bg-[#1B201E] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-[#D4F04F]" />
                <span>Print Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="py-2.5 px-4 rounded-xl bg-[#F3F1EA] hover:bg-[#E4E0D3] text-[#111413] text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Connect Provider Modal */}
      {isAdmin && showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl border border-[#E4E0D3] shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E0D3]">
              <h3 className="text-sm font-bold text-[#111413] flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-[#5E8C1F]" />
                Connect Upstream SMM Provider
              </h3>
              <button onClick={() => setShowConnectModal(false)} className="p-1 text-[#5B625F] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConnectProvider} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-[#111413] block mb-1">Provider Nickname</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Views Engine #1"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E0D3] focus:border-[#111413] outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-[#111413] block mb-1">API URL (V2 Standard)</label>
                <input
                  type="url"
                  required
                  value={providerUrl}
                  onChange={(e) => setProviderUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E0D3] focus:border-[#111413] outline-none font-mono text-[11px]"
                />
              </div>
              <div>
                <label className="font-semibold text-[#111413] block mb-1">API Key</label>
                <input
                  type="password"
                  required
                  placeholder="Paste provider API key"
                  value={providerKey}
                  onChange={(e) => setProviderKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E0D3] focus:border-[#111413] outline-none font-mono text-[11px]"
                />
              </div>

              {importStatus && (
                <div className="p-2.5 rounded-xl bg-[#FAF9F5] border border-[#E4E0D3] text-[#111413] text-[11px] flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#5E8C1F]" />
                  <span>{importStatus}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E4E0D3]">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#E4E0D3] text-[#5B625F] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-[#D4F04F] hover:bg-[#C5E23A] text-[#111413] font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save &amp; Connect</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

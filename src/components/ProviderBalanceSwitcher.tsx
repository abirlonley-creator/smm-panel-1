"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Wallet,
  RefreshCw,
  ChevronDown,
  Check,
  AlertTriangle,
  Server,
  ExternalLink,
  Plus,
  X,
} from "lucide-react";
import { formatProviderBalance } from "@/lib/currency";
import { BinanceAddFundsModal } from "@/components/BinanceAddFundsModal";

interface ProviderItem {
  id: string;
  name: string;
  balance: number | null;
  currency: string;
  isMock: boolean;
  hasApiKey: boolean;
  lastSyncAt: string | null;
  stale?: boolean;
  status: string;
  warning?: string | null;
}

interface ProviderBalanceSwitcherProps {
  variant?: "header" | "sidebar";
}

let sharedBalanceCache: { providers: ProviderItem[]; activeProviderId: string | null; isAdmin?: boolean; walletBalance?: number } | null = null;
let sharedBalancePromise: Promise<any> | null = null;

export function ProviderBalanceSwitcher({ variant = "header" }: ProviderBalanceSwitcherProps) {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (sharedBalanceCache?.isAdmin !== undefined) return sharedBalanceCache.isAdmin;
    return true; // default until loaded
  });

  const [walletBalance, setWalletBalance] = useState<number>(() => {
    if (sharedBalanceCache?.walletBalance !== undefined) return sharedBalanceCache.walletBalance;
    return 0;
  });

  const [providers, setProviders] = useState<ProviderItem[]>(() => {
    if (sharedBalanceCache) return sharedBalanceCache.providers;
    if (typeof window !== "undefined") {
      try {
        const local = localStorage.getItem("aurasmm_cached_balance");
        if (local) {
          const p = JSON.parse(local);
          if (p && Array.isArray(p.providers)) return p.providers;
        }
      } catch (e) {}
    }
    return [];
  });

  const [activeProviderId, setActiveProviderId] = useState<string | null>(() => {
    if (sharedBalanceCache) return sharedBalanceCache.activeProviderId;
    if (typeof window !== "undefined") {
      try {
        const local = localStorage.getItem("aurasmm_cached_balance");
        if (local) {
          const p = JSON.parse(local);
          if (p && p.activeProviderId) return p.activeProviderId;
        }
      } catch (e) {}
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (sharedBalanceCache) return false;
    if (typeof window !== "undefined") {
      try {
        const local = localStorage.getItem("aurasmm_cached_balance");
        if (local) {
          const p = JSON.parse(local);
          if (p && (Array.isArray(p.providers) || typeof p.walletBalance === "number")) return false;
        }
      } catch (e) {}
    }
    return true;
  });

  const [refreshing, setRefreshing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function loadBalanceData(forceRefresh = false) {
    if (forceRefresh) setRefreshing(true);
    try {
      if (!forceRefresh && sharedBalancePromise) {
        const data = await sharedBalancePromise;
        if (data?.success) {
          const isAdm = data.isAdmin !== false && data.role !== "USER";
          setIsAdmin(isAdm);
          if (typeof data.walletBalance === "number") setWalletBalance(data.walletBalance);
          if (Array.isArray(data.providers)) {
            setProviders(data.providers);
            setActiveProviderId(data.activeProviderId || (data.providers[0]?.id ?? null));
          }
        }
        return;
      }

      sharedBalancePromise = fetch(`/api/balance${forceRefresh ? "?refresh=true" : ""}`, {
        cache: "no-store",
      }).then((res) => res.json());

      const data = await sharedBalancePromise;
      if (data?.success) {
        const isAdm = data.isAdmin !== false && data.role !== "USER";
        setIsAdmin(isAdm);
        const wBal = typeof data.walletBalance === "number" ? data.walletBalance : 0;
        setWalletBalance(wBal);

        sharedBalanceCache = {
          providers: data.providers || [],
          activeProviderId: data.activeProviderId,
          isAdmin: isAdm,
          walletBalance: wBal,
        };

        if (Array.isArray(data.providers)) {
          setProviders(data.providers);
          setActiveProviderId(data.activeProviderId || (data.providers[0]?.id ?? null));
        }

        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("aurasmm_cached_balance", JSON.stringify(data));
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn("Failed to load provider balance switcher data:", err);
    } finally {
      sharedBalancePromise = null;
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    // 0ms instant display from localStorage on hydration
    if (typeof window !== "undefined") {
      try {
        const local = localStorage.getItem("aurasmm_cached_balance");
        if (local) {
          const p = JSON.parse(local);
          if (p) {
            if (p.isAdmin !== undefined || p.role !== undefined) {
              setIsAdmin(p.isAdmin !== false && p.role !== "USER");
            }
            if (typeof p.walletBalance === "number") {
              setWalletBalance(p.walletBalance);
            }
            if (Array.isArray(p.providers) && p.providers.length > 0) {
              setProviders(p.providers);
              if (p.activeProviderId) setActiveProviderId(p.activeProviderId);
            }
            setLoading(false);
          }
        }
      } catch {}
    }
    loadBalanceData();

    const handleBalanceUpdate = () => loadBalanceData(false);
    window.addEventListener("balance-updated", handleBalanceUpdate);
    window.addEventListener("provider-balance-refreshed", handleBalanceUpdate);

    // Click outside to close dropdown
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("balance-updated", handleBalanceUpdate);
      window.removeEventListener("provider-balance-refreshed", handleBalanceUpdate);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  async function handleSelectProvider(providerId: string) {
    if (providerId === activeProviderId) {
      setDropdownOpen(false);
      return;
    }
    setSwitching(true);
    try {
      const res = await fetch("/api/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveProviderId(providerId);
        window.dispatchEvent(new CustomEvent("balance-updated"));
      }
    } catch (err) {
      console.error("Failed to switch provider:", err);
    } finally {
      setSwitching(false);
      setDropdownOpen(false);
    }
  }

  const activeProvider = providers.find((p) => p.id === activeProviderId) || providers[0];
  const hasMultiple = providers.length > 1;

  // Binance Pay Add Funds Modal
  const renderAddFundsModal = () => (
    <BinanceAddFundsModal
      isOpen={showAddFundsModal}
      onClose={() => setShowAddFundsModal(false)}
      currentBalance={walletBalance}
      onSuccess={(newBal) => {
        setWalletBalance(newBal);
        loadBalanceData(true);
      }}
    />
  );

  // -------------------------------------------------------------
  // NON-ADMIN VIEW (Regular Users)
  // -------------------------------------------------------------
  if (!isAdmin) {
    if (variant === "header") {
      return (
        <>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs font-bold text-[#252943] shadow-subtle">
              <Wallet className="w-3.5 h-3.5 text-[#3A4EFB]" />
              <span>Balance: ₹{walletBalance.toFixed(2)}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAddFundsModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#3A4EFB] hover:bg-[#2F40DB] text-white text-xs font-bold transition-all shadow-subtle press-scale"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Funds</span>
            </button>
          </div>
          {renderAddFundsModal()}
        </>
      );
    }

    // Non-Admin Sidebar Card
    return (
      <>
        <div className="mx-3.5 mt-4 p-3.5 rounded-2xl bg-[#1A1D31] border border-[#323758] flex flex-col gap-2.5 shadow-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#3A4EFB]/20 border border-[#3A4EFB]/30 text-[#E3FF3B] flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#DEE0ED]/60 font-semibold block leading-none mb-1">
                  Account Balance
                </span>
                <span className="text-sm font-bold text-white tracking-tight">
                  ₹{walletBalance.toFixed(2)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => loadBalanceData(true)}
              disabled={refreshing}
              title="Refresh wallet balance"
              className="p-1.5 rounded-lg text-[#DEE0ED]/70 hover:text-white hover:bg-[#323758] transition-colors press-scale"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#E3FF3B] ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAddFundsModal(true)}
            className="w-full py-2 px-3 rounded-xl bg-[#3A4EFB] hover:bg-[#2F40DB] text-white text-xs font-bold text-center transition-all press-scale flex items-center justify-center gap-1.5 shadow-subtle"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Funds</span>
          </button>
        </div>
        {renderAddFundsModal()}
      </>
    );
  }

  // -------------------------------------------------------------
  // ADMIN VIEW: Upstream Providers Switcher
  // -------------------------------------------------------------
  if (variant === "header") {
    if (loading) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs font-semibold text-[#252943]/60">
          <Wallet className="w-3.5 h-3.5 text-[#3A4EFB]" />
          <span>...</span>
        </div>
      );
    }

    if (!activeProvider) {
      return (
        <Link
          href="/api-key"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold transition-all shadow-subtle press-scale"
        >
          <Server className="w-3.5 h-3.5 text-amber-600" />
          <span className="hidden xs:inline">Connect API Key</span>
          <span className="xs:hidden">Connect</span>
        </Link>
      );
    }

    const isUnavailable = activeProvider.balance === null;

    return (
      <div className="relative" ref={dropdownRef}>
        <div className="flex items-center bg-[#F8F9FD] border border-[#DEE0ED] hover:border-[#3A4EFB]/50 rounded-xl shadow-subtle transition-all">
          <button
            type="button"
            onClick={() => loadBalanceData(true)}
            disabled={refreshing}
            title={
              activeProvider.stale
                ? "Balance may be stale. Click to refresh live."
                : "Refresh live balance"
            }
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-[#252943] hover:text-[#3A4EFB] transition-colors"
          >
            <Wallet className="w-3.5 h-3.5 text-[#3A4EFB] shrink-0" />
            <span className="truncate">Balance:</span>
            {isUnavailable ? (
              <span className="text-amber-700 font-semibold">Unavailable</span>
            ) : (
              <span>{formatProviderBalance(activeProvider.balance, activeProvider.currency)}</span>
            )}
            {activeProvider.stale && !isUnavailable && (
              <span className="text-[10px] font-bold text-amber-600 px-1 rounded bg-amber-50 border border-amber-200">
                Stale
              </span>
            )}
            <RefreshCw
              className={`w-3 h-3 text-[#252943]/40 ${refreshing ? "animate-spin text-[#3A4EFB]" : ""}`}
            />
          </button>

          {/* If 2+ providers, show the dropdown arrow button */}
          {hasMultiple && (
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              title="Switch active balance"
              id="header-provider-switcher-btn"
              className="px-2 py-1.5 border-l border-[#DEE0ED] text-[#252943]/60 hover:text-[#3A4EFB] hover:bg-white rounded-r-xl transition-colors"
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  dropdownOpen ? "rotate-180 text-[#3A4EFB]" : ""
                }`}
              />
            </button>
          )}
        </div>

        {/* Dropdown Menu for 2+ providers */}
        {dropdownOpen && hasMultiple && (
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-[#DEE0ED] shadow-xl p-2 z-50 animate-scaleUp">
            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#252943]/50 border-b border-[#DEE0ED]/60 mb-1 flex items-center justify-between">
              <span>Switch Active Balance</span>
              <span className="text-[9px] text-[#3A4EFB] font-semibold">{providers.length} Accounts</span>
            </div>
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {providers.map((p, idx) => {
                const isSelected = p.id === activeProviderId;
                const pUnavailable = p.balance === null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProvider(p.id)}
                    disabled={switching}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors text-left ${
                      isSelected
                        ? "bg-[#3A4EFB]/10 text-[#3A4EFB] font-bold"
                        : "hover:bg-[#F8F9FD] text-[#252943] font-medium"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{p.name || `Balance #${idx + 1}`}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#3A4EFB] shrink-0" />}
                      </div>
                      <span className="text-[11px] font-bold text-[#252943]/70">
                        {pUnavailable
                          ? "Unavailable"
                          : formatProviderBalance(p.balance, p.currency)}
                        {p.stale && !pUnavailable && (
                          <span className="text-[9px] font-normal text-amber-600 ml-1">(Stale)</span>
                        )}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono uppercase text-[#252943]/40 shrink-0">
                      {p.currency}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="pt-2 mt-1 border-t border-[#DEE0ED]/60 px-1">
              <Link
                href="/admin"
                onClick={() => setDropdownOpen(false)}
                className="text-[11px] text-[#3A4EFB] hover:underline font-semibold flex items-center justify-between"
              >
                <span>Admin Provider Settings</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Admin Sidebar Card
  if (loading && !activeProvider) {
    return (
      <div className="mx-3.5 mt-4 p-3.5 rounded-2xl bg-[#1A1D31] border border-[#323758] animate-pulse flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-2 w-14 bg-[#323758] rounded" />
          <div className="h-4 w-20 bg-[#323758] rounded" />
        </div>
        <div className="w-6 h-6 rounded-lg bg-[#323758]" />
      </div>
    );
  }

  if (!activeProvider) {
    return (
      <div className="mx-3.5 mt-4 p-3.5 rounded-2xl bg-[#1A1D31] border border-[#323758] flex items-center justify-between shadow-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#3A4EFB]/20 border border-[#3A4EFB]/30 text-[#E3FF3B] flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#DEE0ED]/60 font-semibold block leading-none mb-1">
              Account Balance
            </span>
            <Link
              href="/admin"
              className="text-xs font-bold text-[#E3FF3B] hover:underline flex items-center gap-1"
            >
              Configure Providers →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isUnavailable = activeProvider.balance === null;

  return (
    <div className="mx-3.5 mt-4 relative" ref={dropdownRef}>
      <div className="p-3.5 rounded-2xl bg-[#1A1D31] border border-[#323758] flex items-center justify-between shadow-subtle">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#3A4EFB]/20 border border-[#3A4EFB]/30 text-[#E3FF3B] flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-[#DEE0ED]/60 font-semibold block leading-none truncate max-w-[120px]">
                {activeProvider.name || "Provider Balance"}
              </span>
              {hasMultiple && (
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  title="Switch account balance"
                  id="sidebar-provider-switcher-btn"
                  className="p-0.5 rounded text-[#DEE0ED]/70 hover:text-white hover:bg-[#323758] transition-colors"
                >
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${
                      dropdownOpen ? "rotate-180 text-[#E3FF3B]" : ""
                    }`}
                  />
                </button>
              )}
            </div>

            <div className="mt-1 flex items-baseline gap-1">
              {isUnavailable ? (
                <span className="text-xs font-bold text-amber-300">Unavailable</span>
              ) : (
                <span className="text-sm font-bold text-white tracking-tight">
                  {formatProviderBalance(activeProvider.balance, activeProvider.currency)}
                </span>
              )}
              {activeProvider.stale && !isUnavailable && (
                <span className="text-[9px] font-bold text-amber-300 ml-1">
                  (Stale)
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadBalanceData(true)}
          disabled={refreshing}
          title="Refresh live balance"
          className="p-1.5 rounded-lg text-[#DEE0ED]/70 hover:text-white hover:bg-[#323758] transition-colors press-scale"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-[#E3FF3B] ${refreshing ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Sidebar Dropdown Menu */}
      {dropdownOpen && hasMultiple && (
        <div className="absolute left-0 right-0 mt-2 bg-[#1A1D31] border border-[#323758] rounded-2xl shadow-2xl p-2 z-50 animate-scaleUp">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#DEE0ED]/50 border-b border-[#323758] mb-1 flex items-center justify-between">
            <span>Select Account</span>
            <span className="text-[#E3FF3B]">{providers.length} Accounts</span>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {providers.map((p, idx) => {
              const isSelected = p.id === activeProviderId;
              const pUnavailable = p.balance === null;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectProvider(p.id)}
                  disabled={switching}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors text-left ${
                    isSelected
                      ? "bg-[#3A4EFB] text-white font-bold"
                      : "hover:bg-[#252943] text-[#DEE0ED] font-medium"
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-1">
                    <span className="truncate">{p.name || `Account #${idx + 1}`}</span>
                    <span className="text-[10px] text-[#DEE0ED]/70 font-semibold">
                      {pUnavailable
                        ? "Unavailable"
                        : formatProviderBalance(p.balance, p.currency)}
                    </span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#E3FF3B] shrink-0" />}
                </button>
              );
            })}
          </div>
          <div className="pt-2 mt-1 border-t border-[#323758] px-1 text-center">
            <Link
              href="/admin"
              onClick={() => setDropdownOpen(false)}
              className="text-[10px] text-[#E3FF3B] hover:underline font-semibold"
            >
              Configure Providers →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

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
  Zap,
} from "lucide-react";
import { formatProviderBalance } from "@/lib/currency";

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

function getSafeEngineLabel(name: string | null | undefined, index: number = 0): string {
  if (!name) return index === 0 ? "Main Engine" : `Engine #${index + 1}`;
  const lower = name.toLowerCase();
  if (
    lower.includes("xmedia") ||
    lower.includes("zeofame") ||
    lower.includes("smm") ||
    lower.includes("panel") ||
    lower.includes(".com") ||
    lower.includes(".net") ||
    lower.includes("http") ||
    lower.includes("api")
  ) {
    return index === 0 ? "Main Engine" : `Engine #${index + 1}`;
  }
  return name;
}

export function ProviderBalanceSwitcher({ variant = "header" }: ProviderBalanceSwitcherProps) {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (sharedBalanceCache?.isAdmin !== undefined) return sharedBalanceCache.isAdmin;
    return false; // safe default for regular users
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

  // -------------------------------------------------------------
  // NON-ADMIN VIEW (Regular Users)
  // -------------------------------------------------------------
  if (!isAdmin) {
    if (variant === "header") {
      return (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E4E0D3] text-xs font-bold text-[#111413] shadow-subtle">
            <Wallet className="w-3.5 h-3.5 text-[#5E8C1F]" />
            <span>Balance: ₹{walletBalance.toFixed(2)}</span>
          </div>
          <Link
            href="/wallet/pay"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#D4F04F] hover:bg-[#C5E23A] text-[#111413] text-xs font-black transition-all shadow-subtle press-scale"
          >
            <Zap className="w-3.5 h-3.5 fill-[#111413]" />
            <span>Add Funds</span>
          </Link>
        </div>
      );
    }

    // Non-Admin Sidebar Card
    return (
      <div className="mx-3.5 mt-4 p-3.5 rounded-2xl bg-[#1B201E] border border-[#222826] flex flex-col gap-2.5 shadow-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#D4F04F]/15 border border-[#D4F04F]/30 text-[#D4F04F] flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#9AA39F] font-semibold block leading-none mb-1">
                Account Balance
              </span>
              <span className="text-sm font-black text-white tracking-tight">
                ₹{walletBalance.toFixed(2)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadBalanceData(true)}
            disabled={refreshing}
            title="Refresh wallet balance"
            className="p-1.5 rounded-lg text-[#9AA39F] hover:text-white hover:bg-[#222826] transition-colors press-scale"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#D4F04F] ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        <Link
          href="/wallet/pay"
          className="w-full py-2.5 px-3 rounded-xl bg-[#D4F04F] hover:bg-[#C5E23A] text-[#111413] text-xs font-black text-center transition-all press-scale flex items-center justify-center gap-1.5 shadow-subtle"
        >
          <Zap className="w-3.5 h-3.5 fill-[#111413]" />
          <span>Add Funds · Binance Pay</span>
        </Link>
      </div>
    );
  }

  // -------------------------------------------------------------
  // ADMIN VIEW: Upstream Providers Switcher
  // -------------------------------------------------------------
  if (variant === "header") {
    if (loading) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E4E0D3] text-xs font-semibold text-[#5B625F]">
          <Wallet className="w-3.5 h-3.5 text-[#5E8C1F]" />
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
        <div className="flex items-center bg-white border border-[#E4E0D3] hover:border-[#111413]/40 rounded-xl shadow-subtle transition-all">
          <button
            type="button"
            onClick={() => loadBalanceData(true)}
            disabled={refreshing}
            title={
              activeProvider.stale
                ? "Balance may be stale. Click to refresh live."
                : "Refresh live balance"
            }
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-[#111413] hover:text-[#5E8C1F] transition-colors"
          >
            <Wallet className="w-3.5 h-3.5 text-[#5E8C1F] shrink-0" />
            <span className="truncate">Balance:</span>
            {isUnavailable ? (
              <span className="text-amber-700 font-semibold">Unavailable</span>
            ) : (
              <span>{formatProviderBalance(activeProvider.balance, activeProvider.currency)}</span>
            )}
            <RefreshCw
              className={`w-3 h-3 text-[#111413]/40 ${refreshing ? "animate-spin text-[#5E8C1F]" : ""}`}
            />
          </button>

          {/* If 2+ providers, show the dropdown arrow button */}
          {hasMultiple && (
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              title="Switch active balance"
              id="header-provider-switcher-btn"
              className="px-2 py-1.5 border-l border-[#E4E0D3] text-[#5B625F] hover:text-[#111413] hover:bg-[#F3F1EA] rounded-r-xl transition-colors"
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  dropdownOpen ? "rotate-180 text-[#5E8C1F]" : ""
                }`}
              />
            </button>
          )}
        </div>

        {/* Dropdown Menu for 2+ providers */}
        {dropdownOpen && hasMultiple && (
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-[#E4E0D3] shadow-xl p-2 z-50 animate-scaleUp">
            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#5B625F] border-b border-[#E4E0D3] mb-1 flex items-center justify-between">
              <span>Switch Active Balance</span>
              <span className="text-[9px] text-[#5E8C1F] font-semibold">{providers.length} Accounts</span>
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
                        ? "bg-[#D4F04F]/20 text-[#111413] font-bold"
                        : "hover:bg-[#F3F1EA] text-[#111413] font-medium"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{getSafeEngineLabel(p.name, idx)}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#111413] shrink-0" />}
                      </div>
                      <span className="text-[11px] font-bold text-[#5B625F]">
                        {pUnavailable
                          ? "Unavailable"
                          : formatProviderBalance(p.balance, p.currency)}
                        {/* Balance display without stale tag */}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono uppercase text-[#5B625F]/60 shrink-0">
                      {p.currency}
                    </span>
                  </button>
                );
              })}
            </div>
            {isAdmin && (
              <div className="pt-2 mt-1 border-t border-[#E4E0D3] px-1">
                <Link
                  href="/admin"
                  onClick={() => setDropdownOpen(false)}
                  className="text-[11px] text-[#5E8C1F] hover:underline font-semibold flex items-center justify-between"
                >
                  <span>Admin Provider Settings</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Admin Sidebar Card
  if (loading && !activeProvider) {
    return (
      <div className="mx-3.5 mt-4 p-3.5 rounded-2xl bg-[#1B201E] border border-[#222826] animate-pulse flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-2 w-14 bg-[#222826] rounded" />
          <div className="h-4 w-20 bg-[#222826] rounded" />
        </div>
        <div className="w-6 h-6 rounded-lg bg-[#222826]" />
      </div>
    );
  }

  if (!activeProvider) {
    return (
      <div className="mx-3.5 mt-4 p-3.5 rounded-2xl bg-[#1B201E] border border-[#222826] flex items-center justify-between shadow-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#D4F04F]/15 border border-[#D4F04F]/30 text-[#D4F04F] flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#9AA39F] font-semibold block leading-none mb-1">
              Account Balance
            </span>
            {isAdmin ? (
              <Link
                href="/admin"
                className="text-xs font-bold text-[#D4F04F] hover:underline flex items-center gap-1"
              >
                Configure Providers →
              </Link>
            ) : (
              <span className="text-xs font-bold text-white font-mono">
                ₹{walletBalance.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isUnavailable = activeProvider.balance === null;

  return (
    <div className="mx-3.5 mt-4 relative" ref={dropdownRef}>
      <div className="p-3.5 rounded-2xl bg-[#1B201E] border border-[#222826] flex items-center justify-between shadow-subtle">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#D4F04F]/15 border border-[#D4F04F]/30 text-[#D4F04F] flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-[#9AA39F] font-semibold block leading-none truncate max-w-[120px]">
                {getSafeEngineLabel(activeProvider.name, providers.findIndex((p) => p.id === activeProvider.id))}
              </span>
              {hasMultiple && (
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  title="Switch account balance"
                  id="sidebar-provider-switcher-btn"
                  className="p-0.5 rounded text-[#9AA39F] hover:text-white hover:bg-[#222826] transition-colors"
                >
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${
                      dropdownOpen ? "rotate-180 text-[#D4F04F]" : ""
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
              {/* Active balance cleanly rendered */}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadBalanceData(true)}
          disabled={refreshing}
          title="Refresh live balance"
          className="p-1.5 rounded-lg text-[#9AA39F] hover:text-white hover:bg-[#222826] transition-colors press-scale"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-[#D4F04F] ${refreshing ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Sidebar Dropdown Menu */}
      {dropdownOpen && hasMultiple && (
        <div className="absolute left-0 right-0 mt-2 bg-[#1B201E] border border-[#222826] rounded-2xl shadow-2xl p-2 z-50 animate-scaleUp">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#9AA39F] border-b border-[#222826] mb-1 flex items-center justify-between">
            <span>Select Account</span>
            <span className="text-[#D4F04F]">{providers.length} Accounts</span>
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
                      ? "bg-[#D4F04F] text-[#111413] font-bold"
                      : "hover:bg-[#222826] text-[#F3F1EA] font-medium"
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-1">
                    <span className="truncate">{p.name || `Account #${idx + 1}`}</span>
                    <span className={`text-[10px] font-semibold ${isSelected ? "text-[#111413]/80" : "text-[#9AA39F]"}`}>
                      {pUnavailable
                        ? "Unavailable"
                        : formatProviderBalance(p.balance, p.currency)}
                    </span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#111413] shrink-0" />}
                </button>
              );
            })}
          </div>
          {isAdmin && (
            <div className="pt-2 mt-1 border-t border-[#222826] px-1 text-center">
              <Link
                href="/admin"
                onClick={() => setDropdownOpen(false)}
                className="text-[10px] text-[#D4F04F] hover:underline font-semibold"
              >
                Configure Providers →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Wallet,
  RefreshCw,
  Clock,
  LogOut,
  Settings,
  Server,
  ShieldCheck,
  User,
  AlertTriangle,
} from "lucide-react";
import { formatProviderBalance } from "@/lib/currency";

export function AppHeader() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState("INR");
  const [isMock, setIsMock] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadSessionAndBalance(refresh = false) {
    if (refresh) setRefreshing(true);
    try {
      // 1. Session check
      const sessRes = await fetch("/api/auth/session");
      const sessData = await sessRes.json();
      if (sessData.authenticated) {
        setSession(sessData);
      } else {
        // Unauthenticated, redirect to login
        router.push("/login");
        return;
      }

      // 2. Balance fetch
      const balRes = await fetch(`/api/balance${refresh ? "?refresh=true" : ""}`);
      const balData = await balRes.json();
      if (typeof balData.balance === "number") {
        setBalance(balData.balance);
        setCurrency(balData.currency || "INR");
      } else if (balData.balance === null) {
        setBalance(null);
      }
      setIsMock(balData.isMock === true);
      setHasApiKey(balData.hasApiKey === true);
    } catch (err) {
      console.warn("Failed to load header auth/balance state:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadSessionAndBalance();

    const handleUpdate = () => loadSessionAndBalance(true);
    window.addEventListener("balance-updated", handleUpdate);
    window.addEventListener("auth-changed", handleUpdate);

    return () => {
      window.removeEventListener("balance-updated", handleUpdate);
      window.removeEventListener("auth-changed", handleUpdate);
    };
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      setSession(null);
      router.push("/login");
      router.refresh();
    }
  }

  if (!session) {
    return null;
  }

  const role = session.role || "USER";
  const remainingDays = session.remainingDays;
  const remainingHours = session.remainingHours;

  return (
    <header className="w-full bg-white/80 backdrop-blur-md border-b border-[#DEE0ED] sticky top-0 z-40 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
      {/* Left: Quick User Indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {role === "ADMIN" ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider bg-[#252943] text-[#E3FF3B] border border-[#323758] shadow-subtle">
              <ShieldCheck className="w-3.5 h-3.5 text-[#E3FF3B]" />
              ADMIN
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-[#3A4EFB]/10 text-[#3A4EFB] border border-[#3A4EFB]/20">
              <User className="w-3.5 h-3.5 text-[#3A4EFB]" />
              USER
            </span>
          )}
          <span className="text-xs font-bold text-[#252943] hidden md:inline-block">
            {session.user?.username || session.label || "Account"}
          </span>
        </div>

        {/* Passkey Remaining Access Pill */}
        <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F8F9FD] border border-[#DEE0ED] text-[11px] font-semibold text-[#252943]/70">
          <Clock className="w-3 h-3 text-[#3A4EFB]" />
          <span>
            {remainingDays !== null && remainingDays !== undefined ? (
              remainingDays > 0 ? (
                `${remainingDays}d access remaining`
              ) : (
                `${remainingHours || 0}h remaining`
              )
            ) : (
              "Permanent Access"
            )}
          </span>
        </div>
      </div>

      {/* Right Persistent Account Area: Balance, Settings, Logout */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Provider Balance Pill */}
        {hasApiKey && balance !== null ? (
          <button
            type="button"
            onClick={() => loadSessionAndBalance(true)}
            disabled={refreshing}
            title="Refresh Provider Balance"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F8F9FD] hover:bg-white border border-[#DEE0ED] hover:border-[#3A4EFB] text-xs font-bold text-[#252943] shadow-subtle transition-all press-scale"
          >
            <Wallet className="w-3.5 h-3.5 text-[#3A4EFB]" />
            <span>{formatProviderBalance(balance, currency)}</span>
            <RefreshCw
              className={`w-3 h-3 text-[#252943]/40 ${
                refreshing ? "animate-spin text-[#3A4EFB]" : ""
              }`}
            />
          </button>
        ) : (
          <Link
            href="/settings"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold transition-all shadow-subtle press-scale"
          >
            <Server className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden xs:inline">Connect your provider API</span>
            <span className="xs:hidden">Connect API</span>
          </Link>
        )}

        {/* Settings Action */}
        <Link
          href="/settings"
          title="Account Settings & Provider API"
          className="p-2 rounded-xl bg-[#F8F9FD] hover:bg-white border border-[#DEE0ED] text-[#252943]/70 hover:text-[#252943] hover:border-[#3A4EFB] transition-all shadow-subtle"
        >
          <Settings className="w-4 h-4" />
        </Link>

        {/* Logout Action */}
        <button
          type="button"
          onClick={handleLogout}
          id="logout-btn"
          title="Sign out of panel"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 active:scale-95 border border-red-200 text-red-700 text-xs font-bold transition-all shadow-subtle cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Wallet,
  RefreshCw,
  Clock,
  LogOut,
  KeyRound,
  Server,
  ShieldCheck,
  User,
  AlertTriangle,
  Send,
} from "lucide-react";
import { formatProviderBalance } from "@/lib/currency";
import { ProviderBalanceSwitcher } from "@/components/ProviderBalanceSwitcher";

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
    <header className="hidden lg:flex w-full bg-[#F3F1EA]/80 backdrop-blur-md border-b border-[#E4E0D3] sticky top-0 z-40 px-4 sm:px-6 lg:px-8 py-3 items-center justify-between gap-4">
      {/* Left: Quick User Indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {role === "ADMIN" ? (
            <Link
              href="/admin"
              title="Open Admin Panel"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider bg-[#111413] text-[#D4F04F] border border-[#222826] shadow-subtle hover:bg-[#1B201E] transition-all cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#D4F04F]" />
              ADMIN
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-[#111413]/5 text-[#111413] border border-[#111413]/10">
              <User className="w-3.5 h-3.5 text-[#111413]" />
              USER
            </span>
          )}
          <span className="text-xs font-bold text-[#111413] hidden md:inline-block">
            {session.user?.username || session.label || "Account"}
          </span>
        </div>

        {/* Passkey Remaining Access Pill */}
        <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#E4E0D3] text-[11px] font-semibold text-[#5B625F]">
          <Clock className="w-3 h-3 text-[#5E8C1F]" />
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
        {/* 24/7 Live Support Pill */}
        <a
          href="https://t.me/Ghostfinds"
          target="_blank"
          rel="noopener noreferrer"
          title="24/7 Live Telegram Support"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#229ED9]/10 hover:bg-[#229ED9]/20 border border-[#229ED9]/30 text-[#229ED9] text-xs font-bold transition-all shadow-subtle press-scale"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <Send className="w-3.5 h-3.5 text-[#229ED9]" />
          <span>24/7 Support</span>
        </a>

        {/* Provider Balance Pill / Switcher */}
        <ProviderBalanceSwitcher variant="header" />

        {/* Admin Panel Quick Access */}
        {role === "ADMIN" && (
          <Link
            href="/admin"
            title="Open Admin Panel"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111413] hover:bg-[#1B201E] border border-[#222826] text-[#D4F04F] text-xs font-bold transition-all shadow-subtle"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#D4F04F]" />
            <span className="hidden sm:inline">Admin Panel</span>
          </Link>
        )}

        {/* API Key Action (Admin Only) */}
        {role === "ADMIN" && (
          <Link
            href="/api-key"
            title="Configure Provider API Key"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#F3F1EA] border border-[#E4E0D3] text-[#111413] hover:text-[#5E8C1F] hover:border-[#5E8C1F] text-xs font-semibold transition-all shadow-subtle"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#5E8C1F]" />
            <span className="hidden sm:inline">API Key</span>
          </Link>
        )}

        {/* Logout Action */}
        <button
          type="button"
          onClick={handleLogout}
          id="logout-btn"
          title="Sign out of panel"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C4552D]/10 hover:bg-[#C4552D]/20 active:scale-95 border border-[#C4552D]/30 text-[#C4552D] text-xs font-bold transition-all shadow-subtle cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}

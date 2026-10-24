"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Compass, 
  PlusCircle, 
  TrendingUp, 
  Radar,
  Layers, 
  ListTree, 
  ShieldCheck, 
  Menu, 
  X,
  ExternalLink,
  Wallet,
  RefreshCw,
  AlertTriangle,
  Boxes,
  Settings,
  Send,
  Clock,
  Shield,
  KeyRound,
  Tag,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { DEFAULT_PROVIDER_BALANCE_REFRESH_INTERVAL_MS } from "@/lib/provider/balance";
import { formatProviderBalance } from "@/lib/currency";

const ALL_NAV_ITEMS = [
  { href: "/", label: "Overview", icon: Compass, adminOnly: false },
  { href: "/pricing", label: "Plans & Pricing", icon: Tag, adminOnly: false },
  { href: "/order", label: "New Order", icon: PlusCircle, adminOnly: false },
  { href: "/engagement", label: "Full Engagement", icon: TrendingUp, adminOnly: false },
  { href: "/combos", label: "Combo Orders", icon: Boxes, adminOnly: false },
  { href: "/planner", label: "Growth Planner", icon: Clock, adminOnly: false },
  { href: "/likes-analyze", label: "Likes Analyze", icon: Radar, adminOnly: false },
  { href: "/orders", label: "Orders", icon: Layers, adminOnly: false },
  { href: "/services", label: "Services Catalog", icon: ListTree, adminOnly: false },
  { href: "/wallet", label: "Wallet", icon: Wallet, adminOnly: false },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: false },
  { href: "/admin", label: "Administration", icon: ShieldCheck, adminOnly: true },
];

export function Navigation() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [balanceStale, setBalanceStale] = useState(false);
  const [balanceWarning, setBalanceWarning] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [refreshingBalance, setRefreshingBalance] = useState(false);
  const refreshIntervalRef = useRef(DEFAULT_PROVIDER_BALANCE_REFRESH_INTERVAL_MS);

  // If on login page, hide navigation completely
  const isLoginPage = pathname === "/login";

  async function fetchSession() {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      if (data.authenticated) {
        setSession(data);
      } else {
        setSession(null);
      }
    } catch {
      setSession(null);
    }
  }

  async function fetchBalance(refresh = false) {
    if (refresh) setRefreshingBalance(true);
    try {
      const res = await fetch(`/api/balance${refresh ? "?refresh=true" : ""}`);
      const data = await res.json();
      if (typeof data.refreshIntervalMs === "number" && data.refreshIntervalMs > 0) {
        refreshIntervalRef.current = data.refreshIntervalMs;
      }
      if (typeof data.balance === "number" && typeof data.currency === "string") {
        setBalance(data.balance);
        setCurrency(data.currency);
      } else if (data.success !== true && data.balance === null) {
        setBalance(null);
        setCurrency(null);
      }
      setBalanceStale(data.stale === true || data.success !== true);
      setBalanceWarning(typeof data.warning === "string" ? data.warning : null);
      window.dispatchEvent(new CustomEvent("provider-balance-refreshed", {
        detail: {
          balance: typeof data.balance === "number" ? data.balance : null,
          currency: typeof data.currency === "string" ? data.currency : null,
          stale: data.stale === true || data.success !== true,
          warning: typeof data.warning === "string" ? data.warning : null,
          clearBalance: data.success !== true && data.balance === null,
        },
      }));
    } catch (err) {
      console.warn("Failed to fetch balance in navigation", err);
      setBalanceStale(true);
      setBalanceWarning("Provider balance refresh failed.");
    } finally {
      setLoadingBalance(false);
      setRefreshingBalance(false);
    }
  }

  useEffect(() => {
    if (isLoginPage) return;

    fetchSession();
    fetchBalance();

    const handleAuthChanged = () => {
      fetchSession();
      fetchBalance(true);
    };

    const handleBalanceUpdate = () => {
      void fetchBalance(true);
    };

    window.addEventListener("auth-changed", handleAuthChanged);
    window.addEventListener("balance-updated", handleBalanceUpdate);

    return () => {
      window.removeEventListener("auth-changed", handleAuthChanged);
      window.removeEventListener("balance-updated", handleBalanceUpdate);
    };
  }, [isLoginPage]);

  if (isLoginPage) {
    return null;
  }

  const role = session?.role || "USER";
  const isAdmin = role === "ADMIN";

  // Filter navigation items based on role
  const navItems = ALL_NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  const remainingDays = session?.remainingDays;
  const remainingHours = session?.remainingHours;

  return (
    <>
      {/* Mobile Header Bar */}
      <header className="lg:hidden flex items-center justify-between px-5 py-3.5 bg-[#252943] text-white sticky top-0 z-[60] border-b border-[#323758]">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-white">
          <div className="w-8 h-8 rounded-lg bg-[#3A4EFB] flex items-center justify-center text-white font-bold text-sm shadow-subtle">
            A
          </div>
          <span className="text-base tracking-tight font-medium">AuraSMM</span>
          {isAdmin ? (
            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-[#E3FF3B] text-[#252943] ml-1">
              ADMIN
            </span>
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#3A4EFB] text-white ml-1">
              USER
            </span>
          )}
        </Link>

        <div className="flex items-center gap-2">
          {/* Mobile Balance Pill */}
          <button
            type="button"
            onClick={() => fetchBalance(true)}
            title={balanceWarning || "Refresh provider balance"}
            aria-label="Refresh provider balance"
            disabled={refreshingBalance}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1A1D31] border border-[#323758] text-xs font-semibold text-white press-scale"
          >
            <Wallet className="w-3 h-3 text-[#E3FF3B]" />
            <span>{loadingBalance ? "..." : formatProviderBalance(balance, currency)}</span>
            <RefreshCw className={`w-2.5 h-2.5 text-[#DEE0ED]/60 ${refreshingBalance ? "animate-spin" : ""}`} />
            {balanceStale && (
              <span className="inline-flex items-center gap-1 text-[9px] text-amber-300">
                <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                {balance === null ? "Unavailable" : "Stale"}
              </span>
            )}
          </button>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg text-[#DEE0ED] hover:bg-[#323758] transition-colors"
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[70] bg-[#252943]/95 backdrop-blur-md flex flex-col pt-16 px-6 pb-8 animate-fadeIn overflow-y-auto">
          <button 
            onClick={() => setMobileOpen(false)}
            className="absolute top-4 right-5 p-2 rounded-lg text-white hover:bg-[#323758]"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="space-y-1.5 mt-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/" && (pathname === item.href || pathname.startsWith(item.href + "/")));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-[#3A4EFB] text-white shadow-subtle font-semibold"
                      : "text-[#DEE0ED] hover:bg-[#323758] hover:text-white"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Mobile Whop Section */}
          <div className="mt-8 pt-4 border-t border-[#323758]">
            <div className="p-4 rounded-2xl bg-[#1A1D31] border border-[#323758] space-y-3">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center bg-white px-2.5 py-1.5 rounded-lg shadow-sm">
                  <img
                    src="/whop-logo.png"
                    alt="Whop Logo"
                    className="h-4 w-auto object-contain"
                  />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E3FF3B]/15 text-[#E3FF3B] border border-[#E3FF3B]/30">
                  Botters Access
                </span>
              </div>

              <div>
                <h3 className="text-sm font-extrabold text-white tracking-tight">
                  Made for Whop Botters
                </h3>
                <p className="text-[#DEE0ED]/75 text-xs leading-relaxed mt-1 font-normal">
                  Manage your orders, provider APIs, and growth tools from one panel. Your access is available for a limited time based on your passkey.
                </p>
              </div>

              {/* Passkey Expiration Info */}
              <div className="p-2.5 rounded-xl bg-[#252943] border border-[#323758] text-[11px] text-[#DEE0ED] flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1.5 text-[#DEE0ED]/70">
                  <Clock className="w-3.5 h-3.5 text-[#E3FF3B]" />
                  Passkey Access:
                </span>
                <span className="text-[#E3FF3B] font-bold">
                  {remainingDays !== null && remainingDays !== undefined ? (
                    remainingDays > 0 ? (
                      `${remainingDays} days remaining`
                    ) : (
                      `${remainingHours || 0} hours remaining`
                    )
                  ) : (
                    "Unlimited / Permanent"
                  )}
                </span>
              </div>

              {/* Telegram Support Link */}
              <div className="pt-2 border-t border-[#323758]/60 text-[11px] text-[#DEE0ED]/75 leading-relaxed">
                <div className="flex items-center gap-1.5 text-white font-bold mb-1">
                  <Send className="w-3.5 h-3.5 text-[#3A4EFB]" />
                  <span>Telegram Support</span>
                </div>
                <p>
                  Need to purchase a passkey or get help setting up your provider API? Message{" "}
                  <a
                    href="https://t.me/Ghostfinds"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#3A4EFB] font-bold underline hover:text-blue-300"
                  >
                    @Ghostfinds
                  </a>{" "}
                  on Telegram.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 bg-[#252943] text-white z-[60] border-r border-[#323758]/60 select-none">
        {/* Brand */}
        <div className="px-6 py-6 border-b border-[#323758]/60">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-[#3A4EFB] group-hover:scale-105 transition-transform flex items-center justify-center text-white font-bold text-base shadow-subtle">
              A
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white tracking-tight text-base">AuraSMM</span>
                {isAdmin ? (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#E3FF3B] text-[#252943] tracking-wide shadow-sm">
                    ADMIN
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#3A4EFB] text-white">
                    USER
                  </span>
                )}
              </div>
              <p className="text-xs text-[#DEE0ED]/70 font-normal">Minimalist Panel & Planner</p>
            </div>
          </Link>
        </div>

        {/* Live Balance Card */}
        <div className="mx-3.5 mt-4 p-3.5 rounded-2xl bg-[#1A1D31] border border-[#323758] flex items-center justify-between shadow-subtle">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#3A4EFB]/20 border border-[#3A4EFB]/30 text-[#E3FF3B] flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#DEE0ED]/60 font-semibold block leading-none mb-1">
                Provider Balance
              </span>
              {loadingBalance ? (
                <span className="text-xs text-[#DEE0ED]/60 font-medium">Checking...</span>
              ) : balance !== null ? (
                <div>
                  <span className="text-sm font-bold text-white tracking-tight">
                    {formatProviderBalance(balance, currency)}
                  </span>
                  {balanceStale && (
                    <span className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-300" title={balanceWarning || "Last verified balance is stale"}>
                      <AlertTriangle className="h-3 w-3" /> Stale
                    </span>
                  )}
                </div>
              ) : (
                <Link
                  href="/settings"
                  className="text-xs font-bold text-[#E3FF3B] hover:underline flex items-center gap-1 mt-0.5"
                >
                  Connect API →
                </Link>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchBalance(true)}
            disabled={refreshingBalance}
            title={balanceWarning || "Refresh provider balance"}
            aria-label="Refresh provider balance"
            className="p-1.5 rounded-lg text-[#DEE0ED]/70 hover:text-white hover:bg-[#323758] transition-colors press-scale"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#E3FF3B] ${refreshingBalance ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3.5 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[#DEE0ED]/50">
            Platform Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/" && (pathname === item.href || pathname.startsWith(item.href + "/")));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm transition-all press-scale ${
                  isActive
                    ? "bg-[#3A4EFB] text-white font-medium shadow-subtle"
                    : "text-[#DEE0ED] hover:bg-[#323758]/70 hover:text-white font-normal"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-[#E3FF3B]" : "text-[#DEE0ED]/80"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Whop Branding Section */}
        <div className="p-4 mx-3 mb-4 rounded-2xl bg-[#1A1D31] border border-[#323758] shadow-subtle space-y-3">
          {/* Whop Logo */}
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center bg-white px-2.5 py-1.5 rounded-lg shadow-sm">
              <img
                src="/whop-logo.png"
                alt="Whop Logo"
                className="h-4 w-auto object-contain"
              />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E3FF3B]/15 text-[#E3FF3B] border border-[#E3FF3B]/30">
              Botters Access
            </span>
          </div>

          {/* Heading */}
          <div>
            <h3 className="text-sm font-extrabold text-white tracking-tight">
              Made for Whop Botters
            </h3>
            {/* Description */}
            <p className="text-[#DEE0ED]/75 text-xs leading-relaxed mt-1 font-normal">
              Manage your orders, provider APIs, and growth tools from one panel. Your access is available for a limited time based on your passkey.
            </p>
          </div>

          {/* Passkey Expiration Display */}
          <div className="p-2 rounded-xl bg-[#252943] border border-[#323758] text-[11px] text-[#DEE0ED] flex items-center justify-between font-semibold">
            <span className="flex items-center gap-1.5 text-[#DEE0ED]/70">
              <Clock className="w-3.5 h-3.5 text-[#E3FF3B]" />
              Access Left:
            </span>
            <span className="text-[#E3FF3B] font-bold">
              {remainingDays !== null && remainingDays !== undefined ? (
                remainingDays > 0 ? (
                  `${remainingDays} days remaining`
                ) : (
                  `${remainingHours || 0} hours remaining`
                )
              ) : (
                "Unlimited"
              )}
            </span>
          </div>

          {/* Telegram Support */}
          <div className="pt-2 border-t border-[#323758]/60 text-[11px] text-[#DEE0ED]/75 leading-relaxed">
            <div className="flex items-center gap-1.5 text-white font-bold mb-1">
              <Send className="w-3.5 h-3.5 text-[#3A4EFB]" />
              <span>Telegram Support</span>
            </div>
            <p>
              Need to purchase a passkey or get help setting up your provider API? Message{" "}
              <a
                href="https://t.me/Ghostfinds"
                target="_blank"
                rel="noreferrer"
                className="text-[#3A4EFB] font-bold underline hover:text-blue-300"
              >
                @Ghostfinds
              </a>{" "}
              on Telegram.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

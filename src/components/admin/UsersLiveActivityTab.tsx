"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Wallet,
  ShoppingBag,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  ExternalLink,
  Copy,
  Check,
  Edit3,
  AlertTriangle,
  ArrowLeft,
  Zap,
  RefreshCw,
  ShieldCheck,
  User,
  CreditCard,
  Layers,
  Calendar,
  DollarSign,
  TrendingUp,
} from "lucide-react";

interface UserLiveMetrics {
  totalOrders: number;
  activeCount: number;
  completedCount: number;
  cancelledCount: number;
  refundedCount: number;
  totalRefundedAmount: number;
  totalSpent: number;
  transactionCount: number;
  depositCount: number;
}

interface OrderItem {
  id: string;
  orderRef: string;
  type: "STANDARD" | "ENGAGEMENT";
  serviceName: string;
  platform: string;
  targetUrl: string;
  requestedQuantity: number;
  deliveredQuantity: number;
  totalCost: number;
  refundedAmount: number;
  isRefunded: boolean;
  status: string;
  isScheduled?: boolean;
  scheduleMode?: string | null;
  providerOrderId?: string | null;
  createdAt: string;
}

interface WalletTxn {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  referenceId: string | null;
  description: string;
  createdAt: string;
}

interface DepositItem {
  id: string;
  depositRef: string;
  inrAmount: number;
  usdtAmount: number;
  txnId: string | null;
  status: string;
  createdAt: string;
}

interface UserProfile {
  id: string;
  username: string;
  name: string;
  role: string;
  status: string;
  walletBalance: number;
  createdAt: string;
  passkey?: {
    label: string;
    expiresAt: string | null;
    status: string;
  } | null;
  liveMetrics: UserLiveMetrics;
  orders: OrderItem[];
  transactions: WalletTxn[];
  deposits: DepositItem[];
}

interface GlobalStats {
  totalUsers: number;
  usersWithActiveOrders: number;
  usersWithRefunds: number;
  totalBalances: number;
  totalRefunds: number;
}

// Generate consistent vibrant gradient colors based on string
function getAvatarGradient(str: string): string {
  const gradients = [
    "from-blue-600 to-indigo-600 text-white",
    "from-purple-600 to-pink-600 text-white",
    "from-emerald-500 to-teal-700 text-white",
    "from-amber-500 to-orange-600 text-white",
    "from-rose-500 to-red-700 text-white",
    "from-cyan-600 to-blue-700 text-white",
    "from-violet-600 to-purple-800 text-white",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

// Extract initials from a name (e.g., "Abir Ahmed" -> "AA")
function getInitials(name: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function UsersLiveActivityTab() {
  const [loading, setLoading] = useState<boolean>(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "ACTIVE_ORDERS" | "CANCELLED_REFUNDED" | "HAS_BALANCE">("ALL");

  // Selected User for deep inspection
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userViewTab, setUserViewTab] = useState<"orders" | "transactions" | "deposits">("orders");
  const [orderSubFilter, setOrderSubFilter] = useState<"ALL" | "ACTIVE" | "COMPLETED" | "CANCELLED_REFUNDED">("ALL");

  // Edit User State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [editUsername, setEditUsername] = useState<string>("");
  const [editBalance, setEditBalance] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function loadUsers(query = searchQuery, filter = activeFilter) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());
      if (filter !== "ALL") params.set("filter", filter);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
        if (data.stats) setStats(data.stats);

        // If the query was an exact order search and found a single user, automatically focus on that user!
        if (data.searchedOrderUserFound && data.users.length === 1) {
          setSelectedUserId(data.users[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [activeFilter]);

  // Handle Search Submission
  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadUsers(searchQuery, activeFilter);
  }

  // Clear Search
  function handleClearSearch() {
    setSearchQuery("");
    loadUsers("", activeFilter);
  }

  // Selected User object
  const selectedUser = useMemo(() => {
    return users.find((u) => u.id === selectedUserId) || null;
  }, [users, selectedUserId]);

  // Copy helper
  function handleCopy(text: string, id: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  // Open Edit User Modal
  function handleOpenEdit(user: UserProfile) {
    setEditingUser(user);
    setEditName(user.name);
    setEditUsername(user.username);
    setEditBalance(user.walletBalance.toString());
    setEditNote("");
    setEditError(null);
  }

  // Save Edit User
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim() || undefined,
          username: editUsername.trim() || undefined,
          walletBalance: editBalance !== "" ? Number(editBalance) : undefined,
          adjustmentNote: editNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update user profile");
      }

      setEditingUser(null);
      await loadUsers();
    } catch (err: any) {
      setEditError(err.message || "Failed to update user profile");
    } finally {
      setSavingEdit(false);
    }
  }

  // Filtered orders for selected user
  const userFilteredOrders = useMemo(() => {
    if (!selectedUser) return [];
    if (orderSubFilter === "ACTIVE") {
      return selectedUser.orders.filter(
        (o) =>
          o.status === "PENDING" ||
          o.status === "PROCESSING" ||
          o.status === "SCHEDULED" ||
          o.status === "PAUSED"
      );
    }
    if (orderSubFilter === "COMPLETED") {
      return selectedUser.orders.filter((o) => o.status === "COMPLETED");
    }
    if (orderSubFilter === "CANCELLED_REFUNDED") {
      return selectedUser.orders.filter(
        (o) => o.isRefunded || o.status === "CANCELLED" || o.status === "FAILED"
      );
    }
    return selectedUser.orders;
  }, [selectedUser, orderSubFilter]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* ============================================================== */}
      {/* 1. TOP STATS BAR                                               */}
      {/* ============================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-[#252943]/60 tracking-wider">
              Total Users
            </span>
            <Users className="w-4 h-4 text-[#3A4EFB]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#252943]">
              {stats?.totalUsers ?? users.length}
            </span>
            <span className="text-[11px] text-[#252943]/50 font-medium">registered</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-[#252943]/60 tracking-wider">
              Active Orders Live
            </span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600">
              {stats?.usersWithActiveOrders ?? 0}
            </span>
            <span className="text-[11px] text-[#252943]/50 font-medium">users running</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-[#252943]/60 tracking-wider">
              Canceled & Refunded
            </span>
            <RotateCcw className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-600">
              {stats?.usersWithRefunds ?? 0}
            </span>
            <span className="text-[11px] text-[#252943]/50 font-medium">
              ₹{(stats?.totalRefunds || 0).toFixed(0)} refunded
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-[#252943]/60 tracking-wider">
              Customer Balances
            </span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 font-mono">
              ₹{(stats?.totalBalances || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. SEARCH & LIVE SITUATION FILTER BAR                          */}
      {/* ============================================================== */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#DEE0ED] shadow-subtle space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Main Simplified Search: Search by Order ID or Username */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#252943]/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter Order ID (e.g. ORD-879577) or Username (e.g. john_doe)..."
              className="w-full bg-[#F8F9FD] border-2 border-[#DEE0ED] focus:border-[#3A4EFB] focus:bg-white rounded-2xl pl-10 pr-24 py-2.5 text-xs font-semibold text-[#252943] placeholder-[#252943]/40 outline-none transition-all shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-20 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                title="Clear search"
              >
                ✕
              </button>
            )}
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-[#3A4EFB] hover:bg-[#2F40DB] text-white text-xs font-bold transition-all shadow-xs press-scale"
            >
              Search
            </button>
          </form>

          {/* Refresh Action */}
          <button
            type="button"
            onClick={() => loadUsers()}
            disabled={loading}
            className="px-3.5 py-2.5 rounded-2xl bg-[#F8F9FD] hover:bg-[#EEF1FA] border border-[#DEE0ED] text-xs font-bold text-[#252943] flex items-center justify-center gap-1.5 transition-colors press-scale shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: "ALL", label: "All Users" },
            { id: "ACTIVE_ORDERS", label: "With Active Orders", icon: Zap, color: "text-amber-500" },
            { id: "CANCELLED_REFUNDED", label: "Canceled & Refunded", icon: RotateCcw, color: "text-rose-500" },
            { id: "HAS_BALANCE", label: "Has Balance (₹ > 0)", icon: Wallet, color: "text-emerald-500" },
          ].map((f) => {
            const Icon = f.icon;
            const isSelected = activeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setActiveFilter(f.id as any);
                  if (selectedUserId) setSelectedUserId(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 press-scale ${
                  isSelected
                    ? "bg-[#252943] text-white shadow-subtle"
                    : "bg-[#F8F9FD] text-[#252943]/70 hover:bg-[#DEE0ED]/60"
                }`}
              >
                {Icon && <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-white" : f.color}`} />}
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. CONDITIONAL VIEW: DEEP USER INSPECTOR vs USERS DIRECTORY    */}
      {/* ============================================================== */}
      {selectedUser ? (
        /* ============================================================ */
        /* DEEP SINGLE USER INSPECTOR (Orders, Refunds, Balance, Txns)  */
        /* ============================================================ */
        <div className="space-y-6 animate-scaleUp">
          {/* Back to list bar */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSelectedUserId(null)}
              className="px-3.5 py-2 rounded-xl bg-white border border-[#DEE0ED] text-xs font-bold text-[#252943] hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to All Users</span>
            </button>
            <div className="text-xs text-[#252943]/60 font-medium">
              Live Situation Inspector for User ID: <code className="font-mono text-gray-800">{selectedUser.id}</code>
            </div>
          </div>

          {/* User Profile Card */}
          <div className="p-6 rounded-3xl bg-white border border-[#DEE0ED] shadow-subtle space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100">
              <div className="flex items-center gap-4">
                {/* Profile Icon with Vibrant Gradient & Initials */}
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getAvatarGradient(
                    selectedUser.username
                  )} flex items-center justify-center font-black text-xl shadow-md shrink-0`}
                >
                  {getInitials(selectedUser.name)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-black text-[#252943] tracking-tight">
                      {selectedUser.name}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase font-mono bg-blue-50 text-[#3A4EFB] border border-blue-200">
                      @{selectedUser.username}
                    </span>
                    {selectedUser.role === "ADMIN" ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-[#252943] text-[#E3FF3B]">
                        ADMIN
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-gray-100 text-gray-700">
                        USER
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#252943]/60 mt-0.5 flex items-center gap-2">
                    <span>Member since {new Date(selectedUser.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>Passkey: {selectedUser.passkey?.label || "Direct User"}</span>
                  </p>
                </div>
              </div>

              {/* Edit User Button */}
              <button
                type="button"
                onClick={() => handleOpenEdit(selectedUser)}
                className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-800 flex items-center justify-center gap-1.5 transition-colors self-start sm:self-center"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Name / Balance</span>
              </button>
            </div>

            {/* Live Situation Metric Strips */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block mb-0.5">
                  Wallet Balance
                </span>
                <span className="text-xl font-black text-emerald-700 font-mono">
                  ₹{selectedUser.walletBalance.toFixed(2)}
                </span>
                <span className="text-[10px] text-emerald-600/80 block mt-0.5">Ready for orders</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200">
                <span className="text-[10px] uppercase font-bold text-blue-800 block mb-0.5">
                  Total Orders
                </span>
                <span className="text-xl font-black text-blue-700 font-mono">
                  {selectedUser.liveMetrics.totalOrders}
                </span>
                <span className="text-[10px] text-blue-600/80 block mt-0.5">
                  ₹{selectedUser.liveMetrics.totalSpent.toFixed(2)} total spent
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200">
                <span className="text-[10px] uppercase font-bold text-amber-800 block mb-0.5">
                  Active Running
                </span>
                <span className="text-xl font-black text-amber-700 font-mono">
                  {selectedUser.liveMetrics.activeCount}
                </span>
                <span className="text-[10px] text-amber-600/80 block mt-0.5">In progress / scheduled</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block mb-0.5">
                  Completed
                </span>
                <span className="text-xl font-black text-emerald-700 font-mono">
                  {selectedUser.liveMetrics.completedCount}
                </span>
                <span className="text-[10px] text-emerald-600/80 block mt-0.5">Successfully fulfilled</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200">
                <span className="text-[10px] uppercase font-bold text-rose-800 block mb-0.5">
                  Canceled / Refunded
                </span>
                <span className="text-xl font-black text-rose-700 font-mono">
                  {selectedUser.liveMetrics.cancelledCount}
                </span>
                <span className="text-[10px] text-rose-600 font-bold block mt-0.5">
                  ₹{selectedUser.liveMetrics.totalRefundedAmount.toFixed(2)} refunded back
                </span>
              </div>
            </div>
          </div>

          {/* Sub Navigation: Orders vs Wallet Transactions vs Deposits */}
          <div className="flex items-center gap-2 border-b border-[#DEE0ED] pb-px">
            <button
              type="button"
              onClick={() => setUserViewTab("orders")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
                userViewTab === "orders"
                  ? "border-[#3A4EFB] text-[#3A4EFB] bg-[#3A4EFB]/5"
                  : "border-transparent text-[#252943]/60 hover:text-[#252943]"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>All Orders ({selectedUser.orders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setUserViewTab("transactions")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
                userViewTab === "transactions"
                  ? "border-[#3A4EFB] text-[#3A4EFB] bg-[#3A4EFB]/5"
                  : "border-transparent text-[#252943]/60 hover:text-[#252943]"
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Wallet Transactions ({selectedUser.transactions.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setUserViewTab("deposits")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
                userViewTab === "deposits"
                  ? "border-[#3A4EFB] text-[#3A4EFB] bg-[#3A4EFB]/5"
                  : "border-transparent text-[#252943]/60 hover:text-[#252943]"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Binance Deposits ({selectedUser.deposits.length})</span>
            </button>
          </div>

          {/* ========================================================== */}
          {/* USER TAB: ORDERS LIST                                      */}
          {/* ========================================================== */}
          {userViewTab === "orders" && (
            <div className="space-y-4">
              {/* Order Status Filters */}
              <div className="flex items-center gap-2">
                {[
                  { id: "ALL", label: `All (${selectedUser.orders.length})` },
                  { id: "ACTIVE", label: `Active (${selectedUser.liveMetrics.activeCount})` },
                  { id: "COMPLETED", label: `Completed (${selectedUser.liveMetrics.completedCount})` },
                  { id: "CANCELLED_REFUNDED", label: `Canceled & Refunded (${selectedUser.liveMetrics.cancelledCount})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setOrderSubFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      orderSubFilter === f.id
                        ? "bg-[#252943] text-white"
                        : "bg-white border border-[#DEE0ED] text-[#252943]/70 hover:bg-gray-50"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Simplified Orders Table */}
              <div className="bg-white rounded-3xl border border-[#DEE0ED] shadow-subtle overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[760px]">
                    <thead className="bg-[#F8F9FD] text-[#252943]/60 uppercase text-[10px] font-bold border-b border-[#DEE0ED]">
                      <tr>
                        <th className="px-5 py-3.5">Order Ref / ID</th>
                        <th className="px-4 py-3.5">Platform & Service</th>
                        <th className="px-4 py-3.5">Target Link</th>
                        <th className="px-4 py-3.5 text-right">Quantity</th>
                        <th className="px-4 py-3.5 text-right">Cost (₹)</th>
                        <th className="px-4 py-3.5">Status & Refund</th>
                        <th className="px-4 py-3.5">Created Date</th>
                        <th className="px-4 py-3.5 text-right">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DEE0ED]/60 font-medium">
                      {userFilteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-gray-500">
                            No orders found matching this filter for this user.
                          </td>
                        </tr>
                      ) : (
                        userFilteredOrders.map((ord) => {
                          const isCancelled = ord.status === "CANCELLED" || ord.status === "FAILED";
                          const isCompleted = ord.status === "COMPLETED";
                          const isRunning =
                            ord.status === "PENDING" ||
                            ord.status === "PROCESSING" ||
                            ord.status === "SCHEDULED";

                          const inspectHref =
                            ord.type === "ENGAGEMENT"
                              ? `/engagement/orders/${ord.id}`
                              : `/orders/${ord.id}`;

                          return (
                            <tr key={ord.id} className="hover:bg-[#F8F9FD]/60 transition-colors">
                              {/* Order Ref & Copy */}
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-1.5 font-bold font-mono text-gray-900">
                                  <span>{ord.orderRef}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(ord.orderRef, ord.id)}
                                    title="Copy Order ID"
                                    className="p-1 rounded text-gray-400 hover:text-gray-700 transition-colors"
                                  >
                                    {copiedId === ord.id ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                                <span className="text-[10px] text-[#252943]/50">
                                  {ord.type === "ENGAGEMENT" ? "Organic S-Curve" : "Catalog Order"}
                                </span>
                              </td>

                              {/* Service Name */}
                              <td className="px-4 py-3.5 max-w-[200px]">
                                <span className="font-bold text-[#252943] block truncate" title={ord.serviceName}>
                                  {ord.serviceName}
                                </span>
                                <span className="text-[10px] text-gray-400 font-medium">
                                  {ord.platform}
                                </span>
                              </td>

                              {/* Target Link */}
                              <td className="px-4 py-3.5 max-w-[180px]">
                                <a
                                  href={ord.targetUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-[#3A4EFB] hover:underline truncate block max-w-[170px]"
                                  title={ord.targetUrl}
                                >
                                  {ord.targetUrl}
                                </a>
                              </td>

                              {/* Quantity */}
                              <td className="px-4 py-3.5 text-right font-mono">
                                <span className="font-bold text-gray-900">
                                  {ord.deliveredQuantity.toLocaleString()}
                                </span>
                                <span className="text-[10px] text-gray-400 block">
                                  / {ord.requestedQuantity.toLocaleString()}
                                </span>
                              </td>

                              {/* Cost */}
                              <td className="px-4 py-3.5 text-right font-mono font-bold text-gray-900">
                                ₹{ord.totalCost.toFixed(2)}
                              </td>

                              {/* Status & Refund Badge */}
                              <td className="px-4 py-3.5">
                                <div className="space-y-1">
                                  {isCompleted ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                                      <CheckCircle2 className="w-3 h-3" />
                                      COMPLETED
                                    </span>
                                  ) : isRunning ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800">
                                      <Clock className="w-3 h-3 animate-spin" />
                                      {ord.status}
                                    </span>
                                  ) : isCancelled ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800">
                                      <XCircle className="w-3 h-3" />
                                      CANCELLED
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-gray-100 text-gray-800">
                                      {ord.status}
                                    </span>
                                  )}

                                  {/* Refund Callout */}
                                  {ord.isRefunded && (
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                      <RotateCcw className="w-2.5 h-2.5" />
                                      <span>Refunded: ₹{ord.refundedAmount.toFixed(2)}</span>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Date */}
                              <td className="px-4 py-3.5 text-xs text-gray-600">
                                {new Date(ord.createdAt).toLocaleDateString()}
                                <span className="block text-[10px] text-gray-400">
                                  {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </td>

                              {/* View Action */}
                              <td className="px-4 py-3.5 text-right">
                                <Link
                                  href={inspectHref}
                                  target="_blank"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#252943] text-xs font-bold transition-colors"
                                >
                                  <span>View</span>
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* USER TAB: WALLET TRANSACTIONS & REFUNDS                    */}
          {/* ========================================================== */}
          {userViewTab === "transactions" && (
            <div className="bg-white rounded-3xl border border-[#DEE0ED] shadow-subtle overflow-hidden">
              <div className="p-4 bg-[#F8F9FD] border-b border-[#DEE0ED] flex items-center justify-between">
                <span className="text-xs font-bold text-[#252943]">
                  All Wallet Balance Adjustments, Deposits & Refunds
                </span>
                <span className="text-[11px] text-[#252943]/60">
                  Total Transactions: {selectedUser.transactions.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[650px]">
                  <thead className="bg-[#F8F9FD] text-[#252943]/60 uppercase text-[10px] font-bold border-b border-[#DEE0ED]">
                    <tr>
                      <th className="px-5 py-3.5">Type</th>
                      <th className="px-4 py-3.5">Amount</th>
                      <th className="px-4 py-3.5">Balance After</th>
                      <th className="px-4 py-3.5">Reference ID</th>
                      <th className="px-4 py-3.5">Description</th>
                      <th className="px-5 py-3.5 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DEE0ED]/60 font-medium">
                    {selectedUser.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-500">
                          No wallet transactions recorded for this user yet.
                        </td>
                      </tr>
                    ) : (
                      selectedUser.transactions.map((tx) => {
                        const isCredit = tx.type === "CREDIT";
                        const isRefund = tx.type === "REFUND";

                        return (
                          <tr key={tx.id} className="hover:bg-[#F8F9FD]/60 transition-colors">
                            <td className="px-5 py-3">
                              {isRefund ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-200">
                                  <RotateCcw className="w-2.5 h-2.5" />
                                  REFUND
                                </span>
                              ) : isCredit ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                                  + CREDIT
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-gray-100 text-gray-800">
                                  - DEBIT
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono font-bold">
                              <span
                                className={
                                  isRefund
                                    ? "text-amber-700"
                                    : isCredit
                                    ? "text-emerald-600"
                                    : "text-gray-900"
                                }
                              >
                                {isCredit || isRefund ? "+" : "-"}₹{tx.amount.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-700">
                              ₹{tx.balanceAfter.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-gray-600">
                              {tx.referenceId || "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-800 max-w-xs truncate" title={tx.description}>
                              {tx.description}
                            </td>
                            <td className="px-5 py-3 text-right text-gray-500 text-[11px]">
                              {new Date(tx.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* USER TAB: BINANCE DEPOSITS                                 */}
          {/* ========================================================== */}
          {userViewTab === "deposits" && (
            <div className="bg-white rounded-3xl border border-[#DEE0ED] shadow-subtle overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[600px]">
                  <thead className="bg-[#F8F9FD] text-[#252943]/60 uppercase text-[10px] font-bold border-b border-[#DEE0ED]">
                    <tr>
                      <th className="px-5 py-3.5">Deposit Ref</th>
                      <th className="px-4 py-3.5">Amount (INR)</th>
                      <th className="px-4 py-3.5">Amount (USDT)</th>
                      <th className="px-4 py-3.5">Binance Order ID</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DEE0ED]/60 font-medium">
                    {selectedUser.deposits.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-500">
                          No Binance Pay deposits submitted by this user yet.
                        </td>
                      </tr>
                    ) : (
                      selectedUser.deposits.map((dep) => (
                        <tr key={dep.id} className="hover:bg-[#F8F9FD]/60 transition-colors">
                          <td className="px-5 py-3 font-mono font-bold text-gray-900">
                            {dep.depositRef}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-emerald-600">
                            ₹{dep.inrAmount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-700">
                            {dep.usdtAmount.toFixed(2)} USDT
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-800">
                            {dep.txnId || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                dep.status === "VERIFIED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : dep.status === "PENDING"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {dep.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right text-gray-500 text-[11px]">
                            {new Date(dep.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ============================================================ */
        /* ALL USERS DIRECTORY VIEW                                     */
        /* ============================================================ */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#252943]">
                Users Directory ({users.length})
              </h2>
              <p className="text-xs text-[#252943]/60">
                Click any user to inspect their live order progress, wallet balance, and refund history.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-gray-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#3A4EFB] mb-2" />
              <p className="text-xs font-semibold">Loading users and live order situations...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white border border-[#DEE0ED] shadow-subtle space-y-3">
              <Users className="w-12 h-12 mx-auto text-gray-400" />
              <h3 className="text-base font-bold text-gray-900">No users found</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                No users match your search or filter. Try clearing the search query or changing filters.
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="px-4 py-2 rounded-xl bg-[#3A4EFB] text-white text-xs font-bold"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.map((u) => {
                const hasActive = u.liveMetrics.activeCount > 0;
                const hasRefunds = u.liveMetrics.refundedCount > 0;

                return (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className="p-5 rounded-3xl bg-white border border-[#DEE0ED] hover:border-[#3A4EFB] shadow-subtle hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group space-y-4"
                  >
                    {/* Top Row: Avatar, Name & Role */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {/* Profile Icon with Initials */}
                        <div
                          className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${getAvatarGradient(
                            u.username
                          )} flex items-center justify-center font-bold text-base shadow-sm shrink-0 group-hover:scale-105 transition-transform`}
                        >
                          {getInitials(u.name)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-sm font-bold text-[#252943] group-hover:text-[#3A4EFB] transition-colors">
                              {u.name}
                            </h3>
                            {u.role === "ADMIN" && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-[#252943] text-[#E3FF3B]">
                                ADMIN
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-gray-500 block">
                            @{u.username}
                          </span>
                        </div>
                      </div>

                      {/* Balance Pill */}
                      <div className="text-right shrink-0">
                        <span className="text-[9px] uppercase font-bold text-gray-400 block">
                          Balance
                        </span>
                        <span className="text-sm font-black text-emerald-600 font-mono">
                          ₹{u.walletBalance.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Middle: Live Situation Badges */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-[#F8F9FD] border border-gray-100 text-center">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-gray-400 block">
                          Total
                        </span>
                        <span className="text-xs font-black text-gray-800 font-mono">
                          {u.liveMetrics.totalOrders}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-amber-600 block">
                          Active
                        </span>
                        <span
                          className={`text-xs font-black font-mono ${
                            hasActive ? "text-amber-600" : "text-gray-400"
                          }`}
                        >
                          {u.liveMetrics.activeCount}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-rose-600 block">
                          Refunded
                        </span>
                        <span
                          className={`text-xs font-black font-mono ${
                            hasRefunds ? "text-rose-600" : "text-gray-400"
                          }`}
                        >
                          {u.liveMetrics.refundedCount}
                        </span>
                      </div>
                    </div>

                    {/* Bottom: Action Trigger */}
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-gray-400 font-medium">
                        Joined {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                      <span className="font-bold text-[#3A4EFB] group-hover:underline flex items-center gap-1">
                        <span>Live Situation</span>
                        <span>→</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. MODAL: EDIT USER NAME & BALANCE                             */}
      {/* ============================================================== */}
      {editingUser && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setEditingUser(null)}
          className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl border border-[#DEE0ED] max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp"
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">
                Edit User: @{editingUser.username}
              </h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Full Name / Display Label
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-900 outline-none focus:border-[#3A4EFB]"
                  placeholder="e.g. John Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Unique Username
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-mono font-bold text-gray-900 outline-none focus:border-[#3A4EFB]"
                  placeholder="e.g. john_doe"
                  required
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">
                  Lowercase letters, numbers, and underscores only.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Wallet Balance (INR ₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editBalance}
                  onChange={(e) => setEditBalance(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-mono font-bold text-emerald-700 outline-none focus:border-[#3A4EFB]"
                  placeholder="Current balance"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Adjustment Note (Audit Reason)
                </label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-800 outline-none"
                  placeholder="e.g. Manual top-up via support"
                />
              </div>

              {editError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                  {editError}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#3A4EFB] hover:bg-[#2F40DB] text-white text-xs font-bold shadow-sm transition-all press-scale flex items-center justify-center gap-1.5"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

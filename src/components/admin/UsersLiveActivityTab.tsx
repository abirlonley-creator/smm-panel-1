"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  RefreshCw,
  Edit3,
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  LayoutGrid,
  List,
} from "lucide-react";

interface UserLiveMetrics {
  totalOrders: number;
  activeCount: number;
  completedCount: number;
  cancelledCount: number;
  refundedCount: number;
  totalRefundedAmount: number;
  totalSpent: number;
  revenue?: number;
  upstreamCost?: number;
  profit?: number;
  marginPercent?: number;
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

interface UserActivity {
  status: "ONLINE" | "RECENT" | "IDLE" | "OFFLINE";
  isOnline: boolean;
  isActiveToday: boolean;
  hasActiveSession: boolean;
  lastActivityAt: string;
  sessionsCount: number;
}

interface UserProfile {
  id: string;
  username: string;
  name: string;
  role: string;
  status: string;
  walletBalance: number;
  createdAt: string;
  activity?: UserActivity;
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
  totalCustomers?: number;
  totalAdmins?: number;
  activeUsers?: number;
  usersWithActiveOrders: number;
  usersWithRefunds: number;
  totalBalances: number;
  totalRefunds: number;
}

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
  const [activeFilter, setActiveFilter] = useState<"ALL" | "ACTIVE_USERS" | "ACTIVE_ORDERS" | "CANCELLED_REFUNDED" | "HAS_BALANCE">("ALL");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

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

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadUsers(searchQuery, activeFilter);
  }

  function handleClearSearch() {
    setSearchQuery("");
    loadUsers("", activeFilter);
  }

  const selectedUser = useMemo(() => {
    return users.find((u) => u.id === selectedUserId) || null;
  }, [users, selectedUserId]);

  function handleCopy(text: string, id: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  }

  function handleOpenEdit(user: UserProfile) {
    setEditingUser(user);
    setEditName(user.name);
    setEditUsername(user.username);
    setEditBalance(user.walletBalance.toString());
    setEditNote("");
    setEditError(null);
  }

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
    <div className="space-y-5 animate-fadeIn pb-12">
      {/* ── 1. Top Minimal Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED]">
          <span className="text-[11px] font-medium text-[#252943]/60 block mb-1">Users</span>
          <div className="text-xl font-bold text-[#252943]">
            {stats?.totalUsers ?? users.filter((u) => u.role === "USER").length}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium block mt-1">
            {stats?.activeUsers ?? 0} active today
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED]">
          <span className="text-[11px] font-medium text-[#252943]/60 block mb-1">Active Orders</span>
          <div className="text-xl font-bold text-amber-600">
            {stats?.usersWithActiveOrders ?? 0}
          </div>
          <span className="text-[11px] text-[#252943]/50 block mt-1">users running</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED]">
          <span className="text-[11px] font-medium text-[#252943]/60 block mb-1">Refunded</span>
          <div className="text-xl font-bold text-rose-600">
            {stats?.usersWithRefunds ?? 0}
          </div>
          <span className="text-[11px] text-[#252943]/50 block mt-1">
            ₹{(stats?.totalRefunds || 0).toFixed(0)} refunded
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED]">
          <span className="text-[11px] font-medium text-[#252943]/60 block mb-1">Customer Balances</span>
          <div className="text-xl font-bold text-emerald-600 font-mono">
            ₹{(stats?.totalBalances || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-[#252943]/50 block mt-1">real deposits</span>
        </div>
      </div>

      {/* ── 2. Search & Filter Bar ── */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-[#DEE0ED] space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#252943]/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search username or order ref..."
              className="w-full bg-[#F8F9FD] border border-[#DEE0ED] focus:border-[#3A4EFB] focus:bg-white rounded-xl pl-9 pr-20 py-2 text-xs text-[#252943] placeholder-[#252943]/40 outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-16 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 text-xs"
              >
                ✕
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-[#252943] text-white text-xs font-semibold"
            >
              Search
            </button>
          </form>

          {/* View Toggle & Refresh */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <div className="flex items-center p-0.5 rounded-xl bg-[#F4F5F9] border border-[#DEE0ED]">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`p-1.5 rounded-lg text-xs transition-all ${
                  viewMode === "cards" ? "bg-white text-[#252943] shadow-xs" : "text-[#252943]/50"
                }`}
                title="Card View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg text-xs transition-all ${
                  viewMode === "table" ? "bg-white text-[#252943] shadow-xs" : "text-[#252943]/50"
                }`}
                title="Table View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => loadUsers()}
              disabled={loading}
              className="p-2 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs font-semibold text-[#252943]"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
          {[
            { id: "ALL", label: `All (${users.length})` },
            { id: "ACTIVE_USERS", label: `Active (${stats?.activeUsers ?? 0})` },
            { id: "ACTIVE_ORDERS", label: `Active Orders (${stats?.usersWithActiveOrders ?? 0})` },
            { id: "CANCELLED_REFUNDED", label: `Refunded (${stats?.usersWithRefunds ?? 0})` },
            { id: "HAS_BALANCE", label: "Balance > 0" },
          ].map((f) => {
            const isSelected = activeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setActiveFilter(f.id as any);
                  if (selectedUserId) setSelectedUserId(null);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? "bg-[#252943] text-white"
                    : "bg-[#F8F9FD] text-[#252943]/70 hover:bg-[#DEE0ED]"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. Detail View vs Directory List ── */}
      {selectedUser ? (
        /* ── SINGLE USER DETAIL ── */
        <div className="space-y-4 animate-scaleUp">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSelectedUserId(null)}
              className="px-3 py-1.5 rounded-xl bg-white border border-[#DEE0ED] text-xs font-semibold text-[#252943] hover:bg-gray-50 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Directory</span>
            </button>
            <span className="text-xs text-[#252943]/50 font-mono">{selectedUser.id}</span>
          </div>

          {/* User Card */}
          <div className="p-5 rounded-2xl bg-white border border-[#DEE0ED] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 font-bold text-sm flex items-center justify-center shrink-0">
                  {getInitials(selectedUser.name)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-[#252943]">{selectedUser.name}</h2>
                    <span className="text-xs text-[#252943]/50 font-mono">@{selectedUser.username}</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-gray-100 text-gray-700">
                      {selectedUser.role}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#252943]/50 flex items-center gap-2 mt-0.5">
                    <span>Joined {new Date(selectedUser.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span className={selectedUser.activity?.isOnline ? "text-emerald-600 font-semibold" : "text-gray-400"}>
                      {selectedUser.activity?.isOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenEdit(selectedUser)}
                className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-800 flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Edit3 className="w-3 h-3" />
                <span>Edit Profile</span>
              </button>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]">
                <span className="text-[11px] text-[#252943]/60 block mb-0.5">Balance</span>
                <span className="text-base font-bold text-emerald-600 font-mono">
                  ₹{selectedUser.walletBalance.toFixed(2)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]">
                <span className="text-[11px] text-[#252943]/60 block mb-0.5">Orders</span>
                <span className="text-base font-bold text-[#252943]">
                  {selectedUser.liveMetrics.totalOrders}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]">
                <span className="text-[11px] text-[#252943]/60 block mb-0.5">Active</span>
                <span className="text-base font-bold text-amber-600">
                  {selectedUser.liveMetrics.activeCount}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]">
                <span className="text-[11px] text-[#252943]/60 block mb-0.5">Refunded</span>
                <span className="text-base font-bold text-rose-600">
                  {selectedUser.liveMetrics.cancelledCount}
                </span>
              </div>
            </div>
          </div>

          {/* Sub Navigation */}
          <div className="flex items-center gap-1 border-b border-[#DEE0ED] pb-px text-xs">
            <button
              type="button"
              onClick={() => setUserViewTab("orders")}
              className={`px-3 py-1.5 font-semibold rounded-t-lg transition-all ${
                userViewTab === "orders" ? "bg-[#252943] text-white" : "text-[#252943]/60 hover:text-[#252943]"
              }`}
            >
              Orders ({selectedUser.orders.length})
            </button>
            <button
              type="button"
              onClick={() => setUserViewTab("transactions")}
              className={`px-3 py-1.5 font-semibold rounded-t-lg transition-all ${
                userViewTab === "transactions" ? "bg-[#252943] text-white" : "text-[#252943]/60 hover:text-[#252943]"
              }`}
            >
              Transactions ({selectedUser.transactions.length})
            </button>
            <button
              type="button"
              onClick={() => setUserViewTab("deposits")}
              className={`px-3 py-1.5 font-semibold rounded-t-lg transition-all ${
                userViewTab === "deposits" ? "bg-[#252943] text-white" : "text-[#252943]/60 hover:text-[#252943]"
              }`}
            >
              Deposits ({selectedUser.deposits.length})
            </button>
          </div>

          {/* Orders Tab */}
          {userViewTab === "orders" && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs">
                {[
                  { id: "ALL", label: `All (${selectedUser.orders.length})` },
                  { id: "ACTIVE", label: `Active (${selectedUser.liveMetrics.activeCount})` },
                  { id: "COMPLETED", label: `Completed (${selectedUser.liveMetrics.completedCount})` },
                  { id: "CANCELLED_REFUNDED", label: `Refunded (${selectedUser.liveMetrics.cancelledCount})` },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setOrderSubFilter(f.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      orderSubFilter === f.id
                        ? "bg-[#252943] text-white"
                        : "bg-white border border-[#DEE0ED] text-[#252943]/70"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="rounded-2xl bg-white border border-[#DEE0ED] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[640px]">
                    <thead className="bg-[#F8F9FD] text-[#252943]/60 text-[11px] border-b border-[#DEE0ED]">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">Ref</th>
                        <th className="py-2.5 px-3 font-semibold">Service</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Quantity</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Cost</th>
                        <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DEE0ED]/60 font-medium text-[#252943]">
                      {userFilteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-gray-400">
                            No orders found.
                          </td>
                        </tr>
                      ) : (
                        userFilteredOrders.map((ord) => (
                          <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-4 font-mono font-semibold">{ord.orderRef}</td>
                            <td className="py-2.5 px-3 truncate max-w-[200px]" title={ord.serviceName}>
                              {ord.serviceName}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">{ord.requestedQuantity}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold">₹{ord.totalCost.toFixed(2)}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                                {ord.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right text-[11px] text-[#252943]/50 font-mono">
                              {new Date(ord.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Transactions Tab */}
          {userViewTab === "transactions" && (
            <div className="rounded-2xl bg-white border border-[#DEE0ED] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[600px]">
                  <thead className="bg-[#F8F9FD] text-[#252943]/60 text-[11px] border-b border-[#DEE0ED]">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Type</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Amount</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Balance</th>
                      <th className="py-2.5 px-3 font-semibold">Description</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DEE0ED]/60 font-medium text-[#252943]">
                    {selectedUser.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-gray-400">
                          No transactions recorded.
                        </td>
                      </tr>
                    ) : (
                      selectedUser.transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                              {tx.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold">
                            {tx.type === "CREDIT" || tx.type === "REFUND" ? "+" : "-"}₹{tx.amount.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-[#252943]/60">
                            ₹{tx.balanceAfter.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 truncate max-w-[200px]" title={tx.description}>
                            {tx.description}
                          </td>
                          <td className="py-2.5 px-4 text-right text-[11px] text-[#252943]/50 font-mono">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Deposits Tab */}
          {userViewTab === "deposits" && (
            <div className="rounded-2xl bg-white border border-[#DEE0ED] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[550px]">
                  <thead className="bg-[#F8F9FD] text-[#252943]/60 text-[11px] border-b border-[#DEE0ED]">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Ref</th>
                      <th className="py-2.5 px-3 font-semibold text-right">INR</th>
                      <th className="py-2.5 px-3 font-semibold text-right">USDT</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DEE0ED]/60 font-medium text-[#252943]">
                    {selectedUser.deposits.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-gray-400">
                          No Binance deposits found.
                        </td>
                      </tr>
                    ) : (
                      selectedUser.deposits.map((dep) => (
                        <tr key={dep.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-4 font-mono font-semibold">{dep.depositRef}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-600">
                            ₹{dep.inrAmount.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-[#252943]/60">
                            {dep.usdtAmount.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                              {dep.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right text-[11px] text-[#252943]/50 font-mono">
                            {new Date(dep.createdAt).toLocaleDateString()}
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
        /* ── DIRECTORY LIST / CARDS ── */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#252943]">Users ({users.length})</h2>
            <span className="text-[11px] text-[#252943]/50">Click to view situation</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-neutral-400">Loading directory...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400 bg-white rounded-2xl border border-[#DEE0ED]">
              No users match your criteria.
            </div>
          ) : viewMode === "table" ? (
            /* TABLE VIEW */
            <div className="rounded-2xl bg-white border border-[#DEE0ED] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[650px]">
                  <thead className="bg-[#F8F9FD] text-[#252943]/60 text-[11px] border-b border-[#DEE0ED]">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">User</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Balance</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Orders</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Active</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Refunded</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DEE0ED]/60 font-medium text-[#252943]">
                    {users.map((u) => (
                      <tr
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                              {getInitials(u.name)}
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold block truncate leading-tight">{u.name}</span>
                              <span className="text-[10px] text-[#252943]/50 font-mono">@{u.username}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-600">
                          ₹{u.walletBalance.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">{u.liveMetrics.totalOrders}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-600">
                          {u.liveMetrics.activeCount || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                          {u.liveMetrics.refundedCount || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`w-1.5 h-1.5 rounded-full inline-block ${u.activity?.isOnline ? "bg-emerald-500" : "bg-neutral-300"}`} />
                        </td>
                        <td className="py-2.5 px-4 text-right text-[11px] text-[#252943]/50 font-mono">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* CARDS VIEW (Clean, compact, no AI slop) */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {users.map((u) => {
                const isOnline = u.activity?.isOnline;
                return (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className="p-3.5 rounded-xl bg-white border border-[#DEE0ED] hover:border-[#3A4EFB] transition-all cursor-pointer flex flex-col justify-between space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {getInitials(u.name)}
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-xs text-[#252943] block truncate leading-tight">
                            {u.name}
                          </span>
                          <span className="text-[10px] text-[#252943]/50 font-mono block truncate">
                            @{u.username}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-emerald-600 font-mono block">
                          ₹{u.walletBalance.toFixed(2)}
                        </span>
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-neutral-300"}`} />
                          <span className="text-[10px] text-neutral-400">{isOnline ? "Online" : "Offline"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#252943]/60">
                      <span>
                        {u.liveMetrics.totalOrders === 0 ? (
                          "0 orders"
                        ) : (
                          <>
                            <strong className="text-neutral-800">{u.liveMetrics.totalOrders}</strong> orders
                            {u.liveMetrics.activeCount > 0 && (
                              <span className="text-amber-600 ml-1">({u.liveMetrics.activeCount} active)</span>
                            )}
                          </>
                        )}
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 4. Edit User Modal ── */}
      {editingUser && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setEditingUser(null)}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-center items-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-[#DEE0ED] max-w-sm w-full p-5 space-y-3.5 shadow-xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Edit User: @{editingUser.username}</h3>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600 text-xs">
                ✕
              </button>
            </div>

            {editError && (
              <div className="p-2.5 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2 text-xs font-mono font-semibold text-gray-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Wallet Balance (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editBalance}
                  onChange={(e) => setEditBalance(e.target.value)}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Adjustment Note</label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Reason for change..."
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2 text-xs text-gray-800 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3 py-1.5 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-3 py-1.5 rounded-xl bg-[#252943] text-white text-xs font-semibold disabled:opacity-50"
                >
                  {savingEdit ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

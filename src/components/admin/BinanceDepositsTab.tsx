"use client";

import React, { useState, useEffect } from "react";
import {
  Wallet,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Loader2,
  Copy,
  Check,
  TrendingUp,
  Filter,
} from "lucide-react";

interface DepositItem {
  id: string;
  depositRef: string;
  method: string;
  inrAmount: number;
  usdtAmount: number;
  exchangeRate: number;
  binanceUid: string;
  senderBinanceId: string | null;
  txnId: string | null;
  status: "PENDING" | "VERIFIED" | "REJECTED" | string;
  verifiedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    walletBalance: number;
  };
}

export function BinanceDepositsTab() {
  const [deposits, setDeposits] = useState<DepositItem[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  async function loadDeposits() {
    try {
      setRefreshing(true);
      const res = await fetch("/api/admin/deposits");
      const data = await res.json();
      if (data.success) {
        setDeposits(data.deposits || []);
        setMetrics(data.metrics || null);
      }
    } catch (err: any) {
      console.error("Failed to load admin deposits:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDeposits();
  }, []);

  async function handleAction(depositId: string, action: "APPROVE" | "REJECT") {
    setActionLoadingId(depositId);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/admin/deposits/${depositId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to ${action.toLowerCase()} deposit`);
      }

      setActionMsg({ text: data.message, type: "success" });
      await loadDeposits();
    } catch (err: any) {
      setActionMsg({ text: err.message, type: "error" });
    } finally {
      setActionLoadingId(null);
    }
  }

  function copyText(text: string, id: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  const filteredDeposits = deposits.filter((d) => {
    if (statusFilter !== "ALL" && d.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.depositRef.toLowerCase().includes(q) ||
      (d.txnId && d.txnId.toLowerCase().includes(q)) ||
      (d.user?.username && d.user.username.toLowerCase().includes(q)) ||
      (d.senderBinanceId && d.senderBinanceId.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#252943]/60">
        <Loader2 className="w-6 h-6 animate-spin text-[#3A4EFB]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle">
          <span className="text-[10px] uppercase font-bold text-[#252943]/60 block mb-1">
            Total Credited (INR)
          </span>
          <span className="text-2xl font-black text-emerald-600">
            ₹{Number(metrics?.totalVerifiedInr || 0).toFixed(2)}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle">
          <span className="text-[10px] uppercase font-bold text-[#252943]/60 block mb-1">
            Total Received (USDT)
          </span>
          <span className="text-2xl font-black text-[#F0B90B]">
            {Number(metrics?.totalVerifiedUsdt || 0).toFixed(2)} USDT
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle">
          <span className="text-[10px] uppercase font-bold text-[#252943]/60 block mb-1">
            Pending Approval
          </span>
          <span className="text-2xl font-black text-amber-600">
            {metrics?.pendingCount || 0}
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle">
          <span className="text-[10px] uppercase font-bold text-[#252943]/60 block mb-1">
            Admin Binance UID
          </span>
          <span className="text-base font-black text-[#252943] font-mono">
            1161493552
          </span>
        </div>
      </div>

      {actionMsg && (
        <div
          className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-between shadow-subtle ${
            actionMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <span>{actionMsg.text}</span>
          <button onClick={() => setActionMsg(null)} className="text-xs font-bold underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#252943]">Binance Pay Deposits</h2>
          <p className="text-xs text-[#252943]/60">
            Monitor incoming Binance Pay recharges, review transaction IDs, and manage customer credits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-white border border-[#DEE0ED] rounded-xl p-1 shadow-subtle text-xs">
            {["ALL", "PENDING", "VERIFIED", "REJECTED"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase transition-all ${
                  statusFilter === st
                    ? "bg-[#3A4EFB] text-white"
                    : "text-[#252943]/60 hover:text-[#252943]"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#252943]/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user, ref, order ID..."
              className="bg-white border border-[#DEE0ED] rounded-xl pl-8 pr-3 py-2 text-xs text-[#252943] placeholder-[#252943]/40 focus:border-[#3A4EFB] outline-none w-44 sm:w-56 shadow-subtle"
            />
          </div>

          <button
            type="button"
            onClick={loadDeposits}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white border border-[#DEE0ED] text-[#252943]/70 hover:text-[#3A4EFB] shadow-subtle"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#3A4EFB]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Deposits Table */}
      <div className="bg-white rounded-3xl border border-[#DEE0ED] shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8F9FD] text-[#252943]/60 uppercase text-[10px] font-bold border-b border-[#DEE0ED]">
              <tr>
                <th className="px-5 py-3.5">Reference / User</th>
                <th className="px-4 py-3.5">Amount (INR)</th>
                <th className="px-4 py-3.5">Amount (USDT)</th>
                <th className="px-4 py-3.5">Binance Order ID</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Created At</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DEE0ED]/60 font-medium">
              {filteredDeposits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-[#252943]/50 text-xs">
                    No Binance Pay deposits found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredDeposits.map((d) => (
                  <tr key={d.id} className="hover:bg-[#F8F9FD]/60 transition-colors">
                    <td className="px-5 py-3">
                      <span className="font-bold text-[#252943] block font-mono">{d.depositRef}</span>
                      <span className="text-[10px] text-[#252943]/50">
                        User: {d.user?.username || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-700">
                      ₹{d.inrAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-bold text-[#F0B90B] font-mono">
                      {d.usdtAmount.toFixed(2)} USDT
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[#252943]/80">
                      {d.txnId ? (
                        <div className="flex items-center gap-1.5">
                          <span>{d.txnId}</span>
                          <button
                            type="button"
                            onClick={() => copyText(d.txnId!, d.id)}
                            className="text-[#252943]/40 hover:text-[#3A4EFB]"
                          >
                            {copiedId === d.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[#252943]/40 italic">Not submitted</span>
                      )}
                      {d.senderBinanceId && (
                        <span className="text-[9px] text-[#252943]/50 block">
                          Sender: {d.senderBinanceId}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          d.status === "VERIFIED"
                            ? "bg-emerald-100 text-emerald-800"
                            : d.status === "PENDING"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[#252943]/60">
                      {new Date(d.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {d.status === "PENDING" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAction(d.id, "APPROVE")}
                            disabled={actionLoadingId === d.id}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-subtle transition-all"
                          >
                            {actionLoadingId === d.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              "Approve"
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction(d.id, "REJECT")}
                            disabled={actionLoadingId === d.id}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition-all"
                          >
                            Reject
                          </button>
                        </div>
                      ) : d.status === "VERIFIED" ? (
                        <span className="text-[11px] font-bold text-emerald-600 flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Credited</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-rose-600">
                          {d.rejectionReason || "Rejected"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

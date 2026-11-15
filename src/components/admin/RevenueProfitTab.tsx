"use client";

import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  Loader2,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface FinancialSummary {
  totalRevenue: number;
  totalUpstreamCost: number;
  totalProfit: number;
  marginPercent: number;
  totalDepositsVerified: number;
  totalDepositsVerifiedUsdt: number;
  verifiedDepositsCount: number;
  totalDepositsPending: number;
  pendingDepositsCount: number;
  userWalletLiability: number;
  activeUsersCount: number;
}

interface StreamBreakdown {
  revenue: number;
  upstreamCost: number;
  profit: number;
  marginPercent: number;
  ordersCount: number;
  deliveredRuns?: number;
}

interface CustomerFinancialItem {
  id: string;
  username: string;
  name: string;
  passkeyLabel: string | null;
  walletBalance: number;
  totalDeposited: number;
  ordersCount: number;
  revenue: number;
  upstreamCost: number;
  profit: number;
  marginPercent: number;
  isOnline: boolean;
  isActiveToday: boolean;
}

interface LedgerItem {
  id: string;
  orderRef: string;
  type: "ENGAGEMENT" | "ORDER";
  name: string;
  customerName?: string;
  customerUsername?: string;
  customerPaid: number;
  upstreamCost: number;
  profit: number;
  marginPercent: number;
  status: string;
  createdAt: string;
}

function getInitials(name: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function RevenueProfitTab() {
  const [range, setRange] = useState<"all" | "30d" | "7d" | "today">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [breakdown, setBreakdown] = useState<{
    engagement: StreamBreakdown;
    smmOrders: StreamBreakdown;
  } | null>(null);
  const [customers, setCustomers] = useState<CustomerFinancialItem[]>([]);
  const [recentLedger, setRecentLedger] = useState<LedgerItem[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  async function loadFinancials(selectedRange = range, isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/admin/financials?range=${selectedRange}`);
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
        setBreakdown(data.breakdown);
        setCustomers(data.customers || []);
        setRecentLedger(data.recentLedger || []);
      }
    } catch (err) {
      console.error("Failed to load financials:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleResetFinancials() {
    setResetting(true);
    try {
      const res = await fetch("/api/admin/financials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const data = await res.json();
      if (data.success) {
        setResetSuccess(true);
        setTimeout(() => {
          setResetSuccess(false);
          setShowResetConfirm(false);
        }, 1000);
        await loadFinancials(range, true);
      }
    } catch (err) {
      console.error("Failed to reset financials:", err);
    } finally {
      setResetting(false);
    }
  }

  useEffect(() => {
    loadFinancials(range);
  }, [range]);

  if (loading && !summary) {
    return (
      <div className="py-16 text-center text-xs text-[#252943]/60 bg-white rounded-2xl border border-[#DEE0ED]">
        <Loader2 className="w-5 h-5 text-[#3A4EFB] animate-spin mx-auto mb-2" />
        <span>Loading financials...</span>
      </div>
    );
  }

  const grossOrders = (breakdown?.engagement.ordersCount || 0) + (breakdown?.smmOrders.ordersCount || 0);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* ── Minimal Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DEE0ED]">
        <div>
          <h2 className="text-base font-bold text-[#252943]">Revenue & Profit</h2>
          <p className="text-xs text-[#252943]/60">Customer orders vs wholesale provider expenses</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Range Pills */}
          <div className="flex items-center p-0.5 rounded-xl bg-[#F4F5F9] border border-[#DEE0ED]">
            {(
              [
                { label: "All", value: "all" },
                { label: "30d", value: "30d" },
                { label: "7d", value: "7d" },
                { label: "Today", value: "today" },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setRange(item.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  range === item.value
                    ? "bg-white text-[#252943] shadow-xs"
                    : "text-[#252943]/60 hover:text-[#252943]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => loadFinancials(range, true)}
            disabled={refreshing}
            className="p-1.5 rounded-xl border border-[#DEE0ED] bg-white hover:bg-slate-50 text-[#252943]/70 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#3A4EFB] ${refreshing ? "animate-spin" : ""}`} />
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="px-2.5 py-1 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors flex items-center gap-1"
            title="Reset metrics to 0"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* ── Reset Confirmation Modal ── */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-[#DEE0ED] p-5 max-w-sm w-full shadow-xl space-y-3">
            <h3 className="font-bold text-sm text-[#252943]">Reset financial tracking to 0?</h3>
            <p className="text-xs text-[#252943]/70">
              This resets all previous test metrics to ₹0.00. Genuine customer orders will continue tracking cleanly.
            </p>

            {resetSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Reset complete</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={resetting}
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 rounded-xl border border-[#DEE0ED] bg-white hover:bg-slate-50 text-xs font-semibold text-[#252943]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetting}
                onClick={handleResetFinancials}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>{resetting ? "Resetting..." : "Confirm"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 4 Minimal KPI Blocks ── */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED]">
            <span className="text-[11px] font-medium text-[#252943]/60 block mb-1">Revenue</span>
            <div className="text-xl font-bold text-[#252943] font-mono">
              ₹{summary.totalRevenue.toFixed(2)}
            </div>
            <span className="text-[11px] text-[#252943]/50 block mt-1">{grossOrders} orders</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED]">
            <span className="text-[11px] font-medium text-[#252943]/60 block mb-1">Wholesale Cost</span>
            <div className="text-xl font-bold text-rose-700 font-mono">
              ₹{summary.totalUpstreamCost.toFixed(2)}
            </div>
            <span className="text-[11px] text-[#252943]/50 block mt-1">
              {summary.totalRevenue > 0
                ? `${((summary.totalUpstreamCost / summary.totalRevenue) * 100).toFixed(0)}% of revenue`
                : "0%"}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-emerald-200">
            <span className="text-[11px] font-medium text-emerald-800 block mb-1">Net Profit</span>
            <div className="text-xl font-bold text-emerald-700 font-mono">
              {summary.totalProfit >= 0 ? `+₹${summary.totalProfit.toFixed(2)}` : `₹${summary.totalProfit.toFixed(2)}`}
            </div>
            <span className="text-[11px] text-emerald-700 font-semibold block mt-1">
              {summary.marginPercent}% margin
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED]">
            <span className="text-[11px] font-medium text-[#252943]/60 block mb-1">Binance Deposits</span>
            <div className="text-xl font-bold text-[#252943] font-mono">
              ₹{summary.totalDepositsVerified.toFixed(2)}
            </div>
            <span className="text-[11px] text-amber-700 block mt-1">
              {summary.pendingDepositsCount > 0 ? `₹${summary.totalDepositsPending.toFixed(0)} pending` : "0 pending"}
            </span>
          </div>
        </div>
      )}

      {/* ── Customer Accounts Breakdown (Sakib, Flex, John) ── */}
      <div className="rounded-2xl bg-white border border-[#DEE0ED] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#DEE0ED] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#252943]">Customer Financials ({customers.length})</h3>
          <span className="text-[11px] text-[#252943]/50">Real user metrics only</span>
        </div>

        {customers.length === 0 ? (
          <div className="p-6 text-center text-xs text-neutral-400">No customer accounts registered yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[640px]">
              <thead className="bg-[#F8F9FD] text-[#252943]/60 text-[11px] border-b border-[#DEE0ED]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Customer</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Orders</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Paid</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Wholesale Cost</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Net Profit</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Margin</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEE0ED]/60 font-medium text-[#252943]">
                {customers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {getInitials(cust.name)}
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold block truncate leading-tight">{cust.name}</span>
                          <span className="text-[10px] text-[#252943]/50 font-mono">@{cust.username}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#252943]/80">{cust.ordersCount}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">₹{cust.revenue.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-rose-600">₹{cust.upstreamCost.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                      {cust.profit >= 0 ? `+₹${cust.profit.toFixed(2)}` : `₹${cust.profit.toFixed(2)}`}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#252943]/70">{cust.marginPercent}%</td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-600">
                      ₹{cust.walletBalance.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Quiet Stream Comparison ── */}
      {breakdown && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-[#252943] block">TikTok Organic</span>
              <span className="text-[11px] text-[#252943]/50">
                {breakdown.engagement.ordersCount} campaigns ({breakdown.engagement.deliveredRuns || 0} batches)
              </span>
            </div>
            <div className="text-right">
              <span className="font-bold text-emerald-700 block font-mono">
                +₹{breakdown.engagement.profit.toFixed(2)}
              </span>
              <span className="text-[11px] text-[#252943]/50">
                ₹{breakdown.engagement.revenue.toFixed(0)} rev • {breakdown.engagement.marginPercent}% margin
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-[#252943] block">Direct SMM</span>
              <span className="text-[11px] text-[#252943]/50">{breakdown.smmOrders.ordersCount} orders</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-emerald-700 block font-mono">
                +₹{breakdown.smmOrders.profit.toFixed(2)}
              </span>
              <span className="text-[11px] text-[#252943]/50">
                ₹{breakdown.smmOrders.revenue.toFixed(0)} rev • {breakdown.smmOrders.marginPercent}% margin
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Recent Orders Ledger ── */}
      <div className="rounded-2xl bg-white border border-[#DEE0ED] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#DEE0ED] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#252943]">Order Ledger</h3>
          <span className="text-[11px] text-[#252943]/50">{recentLedger.length} recent entries</span>
        </div>

        {recentLedger.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-400">No orders recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-[#F8F9FD] text-[#252943]/60 text-[11px] border-b border-[#DEE0ED]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Ref</th>
                  <th className="py-2.5 px-3 font-semibold">Customer</th>
                  <th className="py-2.5 px-3 font-semibold">Service</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Paid</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Cost</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Profit</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEE0ED]/60 font-medium text-[#252943]">
                {recentLedger.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-semibold">{item.orderRef}</td>
                    <td className="py-2.5 px-3 truncate max-w-[120px]">{item.customerName || "Customer"}</td>
                    <td className="py-2.5 px-3 truncate max-w-[180px] text-[#252943]/80" title={item.name}>
                      {item.name}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">₹{item.customerPaid.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-rose-600">₹{item.upstreamCost.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                      +₹{item.profit.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right text-[11px] text-[#252943]/50 font-mono">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  DollarSign,
  CreditCard,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Loader2,
  Percent,
  Coins,
  ShieldCheck,
  Clock,
  Sparkles,
  Zap,
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

interface LedgerItem {
  id: string;
  orderRef: string;
  type: "ENGAGEMENT" | "ORDER";
  name: string;
  customerPaid: number;
  upstreamCost: number;
  profit: number;
  marginPercent: number;
  status: string;
  createdAt: string;
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
  const [recentLedger, setRecentLedger] = useState<LedgerItem[]>([]);

  async function loadFinancials(selectedRange = range, isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/admin/financials?range=${selectedRange}`);
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
        setBreakdown(data.breakdown);
        setRecentLedger(data.recentLedger || []);
      }
    } catch (err) {
      console.error("Failed to load financials:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadFinancials(range);
  }, [range]);

  if (loading && !summary) {
    return (
      <div className="p-16 text-center space-y-3 bg-white rounded-3xl border border-[#DEE0ED] shadow-subtle">
        <Loader2 className="w-8 h-8 text-[#3A4EFB] animate-spin mx-auto" />
        <p className="text-xs font-bold text-[#252943]">
          Calculating live upstream charges, customer billings, and net profit...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header with Title and Range Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-[#DEE0ED] shadow-subtle">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#252943]">
                Revenue, Wholesale Expenses & Net Profit
              </h2>
              <p className="text-xs text-[#252943]/60">
                Live financial tracking of what users were charged vs what upstream providers billed us.
              </p>
            </div>
          </div>
        </div>

        {/* Range Selector & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED]">
            {(
              [
                { label: "All Time", value: "all" },
                { label: "30 Days", value: "30d" },
                { label: "7 Days", value: "7d" },
                { label: "Today", value: "today" },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setRange(item.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  range === item.value
                    ? "bg-[#3A4EFB] text-white shadow-subtle"
                    : "text-[#252943]/70 hover:text-[#252943]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => loadFinancials(range, true)}
            disabled={refreshing}
            className="p-2 rounded-xl border border-[#DEE0ED] bg-white hover:bg-slate-50 text-[#252943]/70 hover:text-[#252943] transition-colors disabled:opacity-50"
            title="Refresh Financials"
          >
            <RefreshCw className={`w-4 h-4 text-[#3A4EFB] ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Hero 4 KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Revenue Made */}
          <div className="p-5 rounded-3xl bg-white border border-[#DEE0ED] shadow-subtle flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold text-[#252943]/60">
                How Much We Made (Revenue)
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#3A4EFB] flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-[#252943] font-mono tracking-tight">
                ₹{summary.totalRevenue.toFixed(2)}
              </div>
              <p className="text-[11px] text-[#252943]/60 mt-1 flex items-center gap-1">
                <span>Net customer payments after refunds</span>
              </p>
            </div>
            <div className="pt-2 border-t border-[#DEE0ED]/60 flex items-center justify-between text-[11px]">
              <span className="text-gray-500">Gross Orders Billed:</span>
              <span className="font-bold text-gray-800">
                {(breakdown?.engagement.ordersCount || 0) + (breakdown?.smmOrders.ordersCount || 0)} orders
              </span>
            </div>
          </div>

          {/* Card 2: What We Got Charged (Upstream Cost) */}
          <div className="p-5 rounded-3xl bg-white border border-[#DEE0ED] shadow-subtle flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold text-rose-600">
                What We Got Charged (Expenses)
              </span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-rose-700 font-mono tracking-tight">
                ₹{summary.totalUpstreamCost.toFixed(2)}
              </div>
              <p className="text-[11px] text-[#252943]/60 mt-1">
                Wholesale cost charged by upstream SMM providers
              </p>
            </div>
            <div className="pt-2 border-t border-[#DEE0ED]/60 flex items-center justify-between text-[11px]">
              <span className="text-gray-500">Wholesale Expense Ratio:</span>
              <span className="font-bold text-rose-600">
                {summary.totalRevenue > 0
                  ? ((summary.totalUpstreamCost / summary.totalRevenue) * 100).toFixed(1)
                  : "0.0"}
                %
              </span>
            </div>
          </div>

          {/* Card 3: In Profit */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white border-2 border-emerald-500/30 shadow-subtle flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold text-emerald-800">
                Net Profit
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-black text-emerald-700 font-mono tracking-tight">
                +₹{summary.totalProfit.toFixed(2)}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider">
                  {summary.marginPercent >= 0 ? `+${summary.marginPercent}%` : `${summary.marginPercent}%`} Margin
                </span>
                <span className="text-[11px] text-emerald-900/70 font-semibold">
                  (Revenue - Wholesale Cost)
                </span>
              </div>
            </div>
            <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-[11px]">
              <span className="text-emerald-900/70">Profit Per Rupee Billed:</span>
              <span className="font-bold text-emerald-800">
                ₹{summary.totalRevenue > 0 ? (summary.totalProfit / summary.totalRevenue).toFixed(2) : "0.00"}
              </span>
            </div>
          </div>

          {/* Card 4: Binance Capital Inflow */}
          <div className="p-5 rounded-3xl bg-white border border-[#DEE0ED] shadow-subtle flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold text-amber-700">
                Binance Pay Capital
              </span>
              <div className="w-8 h-8 rounded-xl bg-[#F0B90B]/10 border border-[#F0B90B]/30 text-[#F0B90B] flex items-center justify-center font-black text-xs">
                <span>B</span>
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-[#252943] font-mono tracking-tight">
                ₹{summary.totalDepositsVerified.toFixed(2)}
              </div>
              <p className="text-[11px] text-[#252943]/60 mt-1">
                {summary.verifiedDepositsCount} confirmed deposit{summary.verifiedDepositsCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="pt-2 border-t border-[#DEE0ED]/60 flex items-center justify-between text-[11px]">
              <span className="text-amber-800 font-medium">Pending Review:</span>
              <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                ₹{summary.totalDepositsPending.toFixed(2)} ({summary.pendingDepositsCount})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Breakdown by Service Stream */}
      {breakdown && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Stream 1: TikTok Organic Engagement Engine */}
          <div className="p-6 rounded-3xl bg-white border border-[#DEE0ED] shadow-subtle space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#252943]">
                    TikTok Organic Engagement Engine
                  </h3>
                  <span className="text-[11px] text-[#252943]/60">
                    S-Curve algorithmic views, likes, saves & shares
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">
                {breakdown.engagement.ordersCount} Campaigns
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED]">
                <span className="text-[10px] font-bold uppercase text-gray-500 block">
                  Customer Paid
                </span>
                <span className="text-lg font-black text-[#252943] font-mono">
                  ₹{breakdown.engagement.revenue.toFixed(2)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50/50 border border-rose-100">
                <span className="text-[10px] font-bold uppercase text-rose-600 block">
                  We Got Charged
                </span>
                <span className="text-lg font-black text-rose-700 font-mono">
                  ₹{breakdown.engagement.upstreamCost.toFixed(2)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] font-bold uppercase text-emerald-700 block">
                  Net Profit
                </span>
                <span className="text-lg font-black text-emerald-800 font-mono">
                  +₹{breakdown.engagement.profit.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-purple-50/50 border border-purple-100 flex items-center justify-between text-xs">
              <span className="text-purple-900 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Profit Margin:</span>
              </span>
              <span className="font-black text-purple-900 font-mono">
                {breakdown.engagement.marginPercent}% Margin ({breakdown.engagement.deliveredRuns || 0} batches delivered)
              </span>
            </div>
          </div>

          {/* Stream 2: Direct SMM Orders */}
          <div className="p-6 rounded-3xl bg-white border border-[#DEE0ED] shadow-subtle space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#3A4EFB] flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#252943]">Direct SMM Orders</h3>
                  <span className="text-[11px] text-[#252943]/60">
                    Standard orders placed via catalog & manual orders
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-[#3A4EFB] border border-blue-200 text-[10px] font-bold">
                {breakdown.smmOrders.ordersCount} Orders
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED]">
                <span className="text-[10px] font-bold uppercase text-gray-500 block">
                  Customer Paid
                </span>
                <span className="text-lg font-black text-[#252943] font-mono">
                  ₹{breakdown.smmOrders.revenue.toFixed(2)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50/50 border border-rose-100">
                <span className="text-[10px] font-bold uppercase text-rose-600 block">
                  We Got Charged
                </span>
                <span className="text-lg font-black text-rose-700 font-mono">
                  ₹{breakdown.smmOrders.upstreamCost.toFixed(2)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] font-bold uppercase text-emerald-700 block">
                  Net Profit
                </span>
                <span className="text-lg font-black text-emerald-800 font-mono">
                  +₹{breakdown.smmOrders.profit.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-center justify-between text-xs">
              <span className="text-blue-900 font-semibold flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-[#3A4EFB]" />
                <span>Profit Margin:</span>
              </span>
              <span className="font-black text-blue-900 font-mono">
                {breakdown.smmOrders.marginPercent}% Margin
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Orders Profit & Cost Ledger */}
      <div className="p-6 rounded-3xl bg-white border border-[#DEE0ED] shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
          <div>
            <h3 className="text-sm font-bold text-[#252943] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Live Order Profit & Wholesale Expense Ledger</span>
            </h3>
            <p className="text-xs text-[#252943]/60">
              Itemized billing vs wholesale provider expenses for recent orders & campaigns
            </p>
          </div>
          <span className="text-xs text-[#252943]/60 font-semibold">
            Showing latest {recentLedger.length} items
          </span>
        </div>

        {recentLedger.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">
            No completed orders recorded yet for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FD] border-b border-[#DEE0ED] text-[#252943]/60 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Order Ref</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Service / Campaign</th>
                  <th className="py-2.5 px-3 text-right">Customer Paid (₹)</th>
                  <th className="py-2.5 px-3 text-right">Wholesale Cost (₹)</th>
                  <th className="py-2.5 px-3 text-right">Net Profit (₹)</th>
                  <th className="py-2.5 px-3 text-right">Margin</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEE0ED]/60 font-medium">
                {recentLedger.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-gray-900">
                      {item.orderRef}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          item.type === "ENGAGEMENT"
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {item.type === "ENGAGEMENT" ? "Engagement" : "Direct SMM"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-800 max-w-[200px] truncate" title={item.name}>
                      {item.name}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-gray-900">
                      ₹{item.customerPaid.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-rose-600 font-semibold">
                      -₹{item.upstreamCost.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-emerald-700">
                      +₹{item.profit.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {item.marginPercent}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-gray-500 font-mono text-[11px]">
                      {new Date(item.createdAt).toLocaleDateString()}{" "}
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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

import React from "react";
import { Zap, Layers, Wallet, KeyRound, ShieldCheck, Play, Heart, Bookmark, Share2, Eye } from "lucide-react";

/**
 * Common Shimmer Placeholder Box
 */
export function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl bg-[#E4E0D3]/50 animate-shimmer relative overflow-hidden ${className}`}
    />
  );
}

/**
 * 1. Engagement Page Skeleton
 * Matches the layout of /engagement exactly to prevent Cumulative Layout Shift (CLS)
 */
export function EngagementPageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 font-sans animate-fadeIn">
      {/* Top Sub-Tabs & Wallet Pill */}
      <div className="flex items-center justify-between border-b border-[#E4E0D3] pb-4 gap-3">
        <SkeletonBox className="h-9 w-56 rounded-2xl" />
        <div className="flex items-center gap-2">
          <SkeletonBox className="h-8 w-24 rounded-xl" />
          <div className="h-8 w-24 rounded-xl bg-[#D4F04F]/60 animate-pulse" />
        </div>
      </div>

      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div className="space-y-2">
          <SkeletonBox className="h-8 w-72" />
          <SkeletonBox className="h-4 w-96 max-w-full" />
        </div>
        <SkeletonBox className="h-7 w-44 rounded-full" />
      </div>

      {/* 2-Column Builder Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 cols */}
        <div className="lg:col-span-8 space-y-5">
          <div className="bg-white rounded-3xl border border-[#E4E0D3] p-5 sm:p-6 shadow-subtle space-y-5">
            <div className="flex items-center gap-2.5 pb-3.5 border-b border-[#E4E0D3]">
              <span className="w-7 h-7 rounded-full bg-[#111413] text-[#D4F04F] text-xs font-black flex items-center justify-center">
                1
              </span>
              <div className="space-y-1.5">
                <SkeletonBox className="h-4 w-40" />
                <SkeletonBox className="h-3 w-64" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <SkeletonBox className="h-16 rounded-2xl" />
              <SkeletonBox className="h-16 rounded-2xl" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`p-3.5 rounded-2xl border flex flex-col justify-between space-y-3 ${
                    i === 1 ? "border-2 border-[#111413]/40 bg-[#FAF9F5]" : "border-[#E4E0D3] bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <SkeletonBox className="w-7 h-7 rounded-xl" />
                    <SkeletonBox className="h-4 w-10 rounded-full" />
                  </div>
                  <div className="space-y-1.5">
                    <SkeletonBox className="h-5 w-16" />
                    <SkeletonBox className="h-3 w-20" />
                  </div>
                  <div className="pt-2 border-t border-[#E4E0D3]/60 flex items-center justify-between">
                    <SkeletonBox className="h-4 w-12" />
                    <SkeletonBox className="w-4 h-4 rounded-full" />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#E4E0D3] flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <SkeletonBox key={i} className="h-9 w-24 rounded-xl" />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-[#E4E0D3] p-5 sm:p-6 shadow-subtle space-y-4">
            <div className="flex items-center gap-2.5 pb-3.5 border-b border-[#E4E0D3]">
              <span className="w-7 h-7 rounded-full bg-[#111413] text-[#D4F04F] text-xs font-black flex items-center justify-center">
                2
              </span>
              <div className="space-y-1.5">
                <SkeletonBox className="h-4 w-44" />
                <SkeletonBox className="h-3 w-60" />
              </div>
            </div>
            <SkeletonBox className="h-12 w-full rounded-2xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SkeletonBox className="h-11 w-full rounded-xl" />
              <SkeletonBox className="h-11 w-full rounded-xl" />
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-[#E4E0D3] p-5 sm:p-6 shadow-subtle space-y-4">
            <SkeletonBox className="h-6 w-48" />
            <SkeletonBox className="h-56 w-full rounded-2xl" />
          </div>
        </div>

        {/* Right 4 cols sticky summary */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-3xl border border-[#E4E0D3] p-5 sm:p-6 shadow-subtle space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E0D3]">
              <SkeletonBox className="h-5 w-36" />
              <SkeletonBox className="h-6 w-16 rounded-full" />
            </div>
            <SkeletonBox className="h-20 w-full rounded-2xl" />
            <SkeletonBox className="h-32 w-full rounded-2xl" />
            <SkeletonBox className="h-12 w-full rounded-2xl" />
            <div className="h-12 w-full rounded-2xl bg-[#D4F04F]/60 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 2. Wallet Page Skeleton
 */
export function WalletPageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 font-sans animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E4E0D3]">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gray-200 animate-pulse" />
            <SkeletonBox className="h-6 w-36" />
          </div>
          <SkeletonBox className="h-3.5 w-64" />
        </div>
        <SkeletonBox className="h-10 w-32 rounded-xl" />
      </div>

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-5 rounded-3xl bg-white border border-[#E4E0D3] shadow-subtle space-y-3">
            <div className="flex items-center justify-between">
              <SkeletonBox className="h-3 w-24" />
              <div className="w-7 h-7 rounded-xl bg-gray-200 animate-pulse" />
            </div>
            <SkeletonBox className="h-8 w-32" />
            <SkeletonBox className="h-3 w-40" />
          </div>
        ))}
      </div>

      {/* Deposit Form Skeleton */}
      <div className="p-6 rounded-3xl bg-white border border-[#E4E0D3] shadow-subtle space-y-5">
        <div className="space-y-1 pb-3 border-b border-[#E4E0D3]">
          <SkeletonBox className="h-5 w-48" />
          <SkeletonBox className="h-3 w-72" />
        </div>

        <div className="space-y-2">
          <SkeletonBox className="h-3.5 w-32" />
          <SkeletonBox className="h-12 w-full rounded-2xl" />
        </div>

        <div className="flex items-center gap-2">
          {[100, 500, 1000, 2500, 5000].map((num) => (
            <SkeletonBox key={num} className="h-8 w-16 rounded-xl" />
          ))}
        </div>

        <SkeletonBox className="h-12 w-full rounded-2xl" />
      </div>

      {/* Transactions Table Skeleton */}
      <div className="rounded-3xl bg-white border border-[#E4E0D3] shadow-subtle p-6 space-y-4">
        <SkeletonBox className="h-5 w-40" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-[#E4E0D3]/60">
              <div className="space-y-1">
                <SkeletonBox className="h-4 w-32" />
                <SkeletonBox className="h-2.5 w-44" />
              </div>
              <SkeletonBox className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 3. Orders Page Skeleton
 */
export function OrdersPageSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 font-sans animate-fadeIn">
      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E4E0D3] pb-3">
        <div className="h-9 w-32 rounded-xl bg-white border border-[#E4E0D3] animate-pulse" />
        <div className="h-9 w-36 rounded-xl bg-[#D4F04F]/60 animate-pulse" />
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SkeletonBox className="h-10 w-full sm:w-72 rounded-2xl" />
        <div className="flex items-center gap-2">
          <SkeletonBox className="h-9 w-24 rounded-xl" />
          <SkeletonBox className="h-9 w-24 rounded-xl" />
        </div>
      </div>

      {/* Orders List Cards */}
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="p-4 rounded-2xl bg-white border border-[#E4E0D3] shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <SkeletonBox className="h-4 w-28" />
                <SkeletonBox className="h-4 w-20 rounded-full" />
                <SkeletonBox className="h-4 w-16 rounded-full" />
              </div>
              <SkeletonBox className="h-3.5 w-3/4" />
              <div className="flex items-center gap-4 text-xs">
                <SkeletonBox className="h-3 w-20" />
                <SkeletonBox className="h-3 w-24" />
                <SkeletonBox className="h-3 w-28" />
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <SkeletonBox className="h-7 w-20" />
              <SkeletonBox className="h-8 w-24 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 4. Order Detail Skeleton
 */
export function OrderDetailSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 font-sans animate-fadeIn">
      {/* Back button & Title */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E4E0D3]">
        <div className="flex items-center gap-3">
          <SkeletonBox className="h-9 w-28 rounded-xl" />
          <div className="space-y-1">
            <SkeletonBox className="h-5 w-44" />
            <SkeletonBox className="h-3 w-32" />
          </div>
        </div>
        <SkeletonBox className="h-9 w-28 rounded-xl" />
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 rounded-2xl bg-white border border-[#E4E0D3] shadow-subtle space-y-2">
            <SkeletonBox className="h-3 w-20" />
            <SkeletonBox className="h-6 w-24" />
            <SkeletonBox className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>

      {/* Wave Timeline Box */}
      <div className="p-6 rounded-3xl bg-white border border-[#E4E0D3] shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E4E0D3]">
          <SkeletonBox className="h-5 w-44" />
          <SkeletonBox className="h-4 w-28" />
        </div>
        <SkeletonBox className="h-48 w-full rounded-2xl" />
      </div>
    </div>
  );
}

/**
 * 5. Services Catalog Skeleton
 */
export function CatalogPageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 font-sans animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E4E0D3]">
        <div className="space-y-1">
          <SkeletonBox className="h-6 w-44" />
          <SkeletonBox className="h-3 w-60" />
        </div>
        <SkeletonBox className="h-10 w-72 rounded-2xl" />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <SkeletonBox key={i} className="h-8 w-24 rounded-full shrink-0" />
        ))}
      </div>

      <div className="rounded-2xl bg-white border border-[#E4E0D3] shadow-subtle overflow-hidden">
        <div className="divide-y divide-[#E4E0D3]/60">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <SkeletonBox className="h-4 w-64" />
                <SkeletonBox className="h-3 w-96" />
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <SkeletonBox className="h-5 w-16" />
                <SkeletonBox className="h-8 w-20 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

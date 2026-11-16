"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Copy,
  Check,
  Zap,
  Terminal,
  KeyRound,
  FileCode,
  Shuffle,
  Flame,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
} from "lucide-react";

export default function ApiDocsPage() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const baseUrl = "https://smm-panel-1.vercel.app/api/v2";

  function copyCode(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  }

  const curlListServices = `curl -X GET "${baseUrl}/services" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;

  const curlCheckBalance = `curl -X GET "${baseUrl}/balance" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;

  const curlOrder2kEngagement = `curl -X POST "${baseUrl}/orders" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "service": "2k",
    "link": "https://www.tiktok.com/@username/video/7391829182910",
    "shuffle": true
  }'`;

  const curlOrder5kEngagement = `curl -X POST "${baseUrl}/orders" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "service": "5k",
    "link": "https://www.tiktok.com/@username/video/7391829182910",
    "shuffle": true
  }'`;

  const curlCheckStatus = `curl -X GET "${baseUrl}/orders/98765" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;

  const curlClassicPost = `curl -X POST "${baseUrl}" \\
  -d "key=YOUR_API_KEY" \\
  -d "action=add" \\
  -d "service=2k" \\
  -d "link=https://www.tiktok.com/@username/video/7391829182910" \\
  -d "shuffle=true"`;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 animate-fadeIn">
      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#252943] text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-[#3A4EFB]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3A4EFB]/20 border border-[#3A4EFB]/40 text-xs font-semibold text-[#E3FF3B]">
              <Zap className="w-3.5 h-3.5" />
              <span>Universal AI & Developer API v2 • Engagement Exclusive</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Aura SMM Engagement API Documentation
            </h1>
            <p className="text-sm text-[#DEE0ED]/80 max-w-2xl leading-relaxed">
              Standard REST API for automated AI agents (Muse, ChatGPT, Gemini, Claude) and developers.
              Query available TikTok Engagement tiers (<strong>2k</strong>, <strong>5k</strong>, <strong>10k</strong>, <strong>15k</strong>), check real-time balance, trigger organic multi-wave batches with natural dynamic shuffling, and track campaign delivery.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/api-keys"
              className="px-4 py-2.5 rounded-xl bg-[#3A4EFB] hover:bg-[#3244db] text-white text-xs font-bold transition-all shadow-subtle flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>Get API Key</span>
            </Link>
            <a
              href="/api/openapi.json"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <FileCode className="w-4 h-4 text-[#E3FF3B]" />
              <span>OpenAPI Spec</span>
            </a>
          </div>
        </div>
      </div>

      {/* Available Packages Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#3A4EFB]/10 text-[#3A4EFB]">
              Tier 2K
            </span>
            <span className="text-xs font-bold text-[#252943]/60">5 Hours</span>
          </div>
          <div className="text-xl font-black text-[#252943]">service: &quot;2k&quot;</div>
          <p className="text-[11px] text-[#252943]/70">
            2,960 views across 16 organic batches + 42 likes across 3 synchronized waves.
          </p>
          <div className="pt-1 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
            <Shuffle className="w-3.5 h-3.5" />
            <span>Dynamic Shuffle Supported</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#3A4EFB]/10 text-[#3A4EFB]">
              Tier 5K
            </span>
            <span className="text-xs font-bold text-[#252943]/60">16 Hours</span>
          </div>
          <div className="text-xl font-black text-[#252943]">service: &quot;5k&quot;</div>
          <p className="text-[11px] text-[#252943]/70">
            5,100 views in 20 batches + 170 likes (14 waves) + 44 saves + 22 reposts.
          </p>
          <div className="pt-1 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
            <Shuffle className="w-3.5 h-3.5" />
            <span>Dynamic Shuffle Supported</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#3A4EFB]/10 text-[#3A4EFB]">
              Tier 10K
            </span>
            <span className="text-xs font-bold text-[#252943]/60">22 Hours</span>
          </div>
          <div className="text-xl font-black text-[#252943]">service: &quot;10k&quot;</div>
          <p className="text-[11px] text-[#252943]/70">
            10,500 views in 26 batches + 384 likes (24 waves) + 90 saves + 44 reposts.
          </p>
          <div className="pt-1 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
            <Shuffle className="w-3.5 h-3.5" />
            <span>Dynamic Shuffle Supported</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#3A4EFB]/10 text-[#3A4EFB]">
              Tier 15K
            </span>
            <span className="text-xs font-bold text-[#252943]/60">24 Hours</span>
          </div>
          <div className="text-xl font-black text-[#252943]">service: &quot;15k&quot;</div>
          <p className="text-[11px] text-[#252943]/70">
            15,200 views in 30 batches + 550 likes (26 waves) + 120 saves + 60 reposts.
          </p>
          <div className="pt-1 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
            <Shuffle className="w-3.5 h-3.5" />
            <span>Dynamic Shuffle Supported</span>
          </div>
        </div>
      </div>

      {/* Base URL & Auth Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Base URL */}
        <div className="p-5 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle space-y-2">
          <span className="text-[11px] font-bold text-[#252943]/60 uppercase tracking-wider">
            API Base URL
          </span>
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] font-mono text-xs text-[#252943]">
            <span className="font-semibold truncate">{baseUrl}</span>
            <button
              onClick={() => copyCode(baseUrl, "base_url")}
              className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-[#DEE0ED] text-[#252943]/70 hover:text-[#3A4EFB] transition-colors"
              title="Copy Base URL"
            >
              {copiedSection === "base_url" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[11px] text-[#252943]/70">
            All requests must be served over secure HTTPS.
          </p>
        </div>

        {/* Authentication */}
        <div className="p-5 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle space-y-2">
          <span className="text-[11px] font-bold text-[#252943]/60 uppercase tracking-wider">
            Authentication Headers
          </span>
          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="p-2.5 rounded-lg bg-[#F8F9FD] border border-[#DEE0ED] text-[#252943]">
              <span className="text-[#3A4EFB] font-bold">Authorization:</span> Bearer aura_live_...
            </div>
            <div className="p-2.5 rounded-lg bg-[#F8F9FD] border border-[#DEE0ED] text-[#252943]">
              <span className="text-[#3A4EFB] font-bold">X-API-Key:</span> aura_live_...
            </div>
          </div>
          <p className="text-[11px] text-[#252943]/70">
            Keys begin with <code className="font-bold text-[#252943]">aura_live_</code>. Never expose your secret keys in client-side applications.
          </p>
        </div>
      </div>

      {/* Endpoints List */}
      <div className="space-y-6">
        <h2 className="text-lg font-black text-[#252943] flex items-center gap-2">
          <Terminal className="w-5 h-5 text-[#3A4EFB]" />
          <span>Core Universal Endpoints</span>
        </h2>

        {/* 1. GET /services */}
        <div className="p-6 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DEE0ED]/60">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase">
                GET
              </span>
              <span className="font-mono text-sm font-bold text-[#252943]">/api/v2/services</span>
            </div>
            <span className="text-xs text-[#252943]/70">List Engagement Tab Packages</span>
          </div>

          <p className="text-xs text-[#252943]/80 leading-relaxed">
            Returns the 4 engagement packages (<strong>2k</strong>, <strong>5k</strong>, <strong>10k</strong>, <strong>15k</strong>) with real-time calculated prices from your admin settings, batch breakdowns, and duration metrics. AI agents should always call this endpoint first to confirm package availability and rates.
          </p>

          <div>
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-[11px] font-bold text-[#252943]/70">Example Request</span>
              <button
                onClick={() => copyCode(curlListServices, "curl_services")}
                className="text-xs font-bold text-[#3A4EFB] hover:underline flex items-center gap-1"
              >
                {copiedSection === "curl_services" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSection === "curl_services" ? "Copied" : "Copy cURL"}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-[#252943] text-[#DEE0ED] text-xs font-mono overflow-x-auto">
              {curlListServices}
            </pre>
          </div>

          <div>
            <span className="text-[11px] font-bold text-[#252943]/70 block pb-1.5">Example Response (200 OK)</span>
            <pre className="p-3.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-[#252943] text-xs font-mono overflow-x-auto">
{`[
  {
    "service": 101,
    "alias": "2k",
    "category": "TikTok Engagement",
    "name": "2k",
    "display_name": "TikTok Engagement 2K",
    "platform": "tiktok",
    "type": "engagement_campaign",
    "rate": "16.91",
    "min": 2000,
    "max": 2000,
    "duration": "5 Hours",
    "target_views": 2960,
    "target_likes": 42,
    "target_saves": 0,
    "target_shares": 0,
    "shuffle_supported": true,
    "description": "Organic 5-hour pacing with 16 randomized view batches and 3 synchronized like waves. Dynamic organic shuffle supported.",
    "status": "active"
  },
  {
    "service": 102,
    "alias": "5k",
    "category": "TikTok Engagement",
    "name": "5k",
    "display_name": "TikTok Engagement 5K",
    "platform": "tiktok",
    "type": "engagement_campaign",
    "rate": "29.22",
    "min": 5000,
    "max": 5000,
    "duration": "16 Hours",
    "target_views": 5100,
    "target_likes": 170,
    "target_saves": 44,
    "target_shares": 22,
    "shuffle_supported": true,
    "description": "16-hour FYP velocity push with 20 randomized view batches, 14 like waves, 4 save waves, and 2 repost waves.",
    "status": "active"
  }
]`}
            </pre>
          </div>
        </div>

        {/* 2. GET /balance */}
        <div className="p-6 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DEE0ED]/60">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase">
                GET
              </span>
              <span className="font-mono text-sm font-bold text-[#252943]">/api/v2/balance</span>
            </div>
            <span className="text-xs text-[#252943]/70">Check Account Wallet Balance</span>
          </div>

          <p className="text-xs text-[#252943]/80 leading-relaxed">
            Returns the current available balance for the authenticated account in INR (₹).
          </p>

          <div>
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-[11px] font-bold text-[#252943]/70">Example Request</span>
              <button
                onClick={() => copyCode(curlCheckBalance, "curl_balance")}
                className="text-xs font-bold text-[#3A4EFB] hover:underline flex items-center gap-1"
              >
                {copiedSection === "curl_balance" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSection === "curl_balance" ? "Copied" : "Copy cURL"}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-[#252943] text-[#DEE0ED] text-xs font-mono overflow-x-auto">
              {curlCheckBalance}
            </pre>
          </div>

          <div>
            <span className="text-[11px] font-bold text-[#252943]/70 block pb-1.5">Example Response (200 OK)</span>
            <pre className="p-3.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-[#252943] text-xs font-mono overflow-x-auto">
{`{
  "balance": "206.12",
  "currency": "INR"
}`}
            </pre>
          </div>
        </div>

        {/* 3. POST /orders */}
        <div className="p-6 rounded-2xl bg-white border-2 border-[#3A4EFB]/30 shadow-subtle space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DEE0ED]/60">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-md bg-blue-100 text-[#3A4EFB] text-[11px] font-black uppercase">
                POST
              </span>
              <span className="font-mono text-sm font-bold text-[#252943]">/api/v2/orders</span>
            </div>
            <span className="text-xs font-bold text-[#3A4EFB]">Place Engagement Campaign Order</span>
          </div>

          <p className="text-xs text-[#252943]/80 leading-relaxed">
            Submits an engagement campaign order directly to the Engagement Tab worker. You can pass <code className="font-bold text-[#252943]">&quot;service&quot;: &quot;2k&quot;</code>, <code className="font-bold text-[#252943]">&quot;5k&quot;</code>, <code className="font-bold text-[#252943]">&quot;10k&quot;</code>, or <code className="font-bold text-[#252943]">&quot;15k&quot;</code> (or numeric IDs 101, 102, 103, 104). Passing <code className="font-bold text-[#252943]">&quot;shuffle&quot;: true</code> automatically applies natural randomized batch variance across all planned waves.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-[11px] font-bold text-[#252943]/70">Order 2k Campaign (with Shuffle)</span>
                <button
                  onClick={() => copyCode(curlOrder2kEngagement, "curl_order_2k")}
                  className="text-xs font-bold text-[#3A4EFB] hover:underline flex items-center gap-1"
                >
                  {copiedSection === "curl_order_2k" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSection === "curl_order_2k" ? "Copied" : "Copy cURL"}</span>
                </button>
              </div>
              <pre className="p-3.5 rounded-xl bg-[#252943] text-[#DEE0ED] text-xs font-mono overflow-x-auto">
                {curlOrder2kEngagement}
              </pre>
            </div>

            <div>
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-[11px] font-bold text-[#252943]/70">Order 5k Campaign (with Shuffle)</span>
                <button
                  onClick={() => copyCode(curlOrder5kEngagement, "curl_order_5k")}
                  className="text-xs font-bold text-[#3A4EFB] hover:underline flex items-center gap-1"
                >
                  {copiedSection === "curl_order_5k" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSection === "curl_order_5k" ? "Copied" : "Copy cURL"}</span>
                </button>
              </div>
              <pre className="p-3.5 rounded-xl bg-[#252943] text-[#DEE0ED] text-xs font-mono overflow-x-auto">
                {curlOrder5kEngagement}
              </pre>
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold text-[#252943]/70 block pb-1.5">Example Response (200 OK)</span>
            <pre className="p-3.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-[#252943] text-xs font-mono overflow-x-auto">
{`{
  "order": 98765,
  "order_ref": "ENG-179482-A3B9",
  "service": "2k",
  "preset": "tiktok_2k",
  "name": "2k",
  "link": "https://www.tiktok.com/@username/video/7391829182910",
  "target_views": 2960,
  "target_likes": 42,
  "batches": 16,
  "duration": "5 Hours",
  "charge": "16.91",
  "currency": "INR",
  "status": "processing"
}`}
            </pre>
          </div>
        </div>

        {/* 4. GET /orders/{id} */}
        <div className="p-6 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DEE0ED]/60">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase">
                GET
              </span>
              <span className="font-mono text-sm font-bold text-[#252943]">/api/v2/orders/:id</span>
            </div>
            <span className="text-xs text-[#252943]/70">Track Live Engagement Campaign Progress</span>
          </div>

          <p className="text-xs text-[#252943]/80 leading-relaxed">
            Retrieves delivery progress and execution metrics for an engagement order. Status values are strictly normalized to:{" "}
            <code className="font-bold text-[#252943]">pending</code>,{" "}
            <code className="font-bold text-[#252943]">in_progress</code>,{" "}
            <code className="font-bold text-[#252943]">completed</code>,{" "}
            <code className="font-bold text-[#252943]">cancelled</code>, or{" "}
            <code className="font-bold text-[#252943]">failed</code>.
          </p>

          <div>
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-[11px] font-bold text-[#252943]/70">Example Request</span>
              <button
                onClick={() => copyCode(curlCheckStatus, "curl_status")}
                className="text-xs font-bold text-[#3A4EFB] hover:underline flex items-center gap-1"
              >
                {copiedSection === "curl_status" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSection === "curl_status" ? "Copied" : "Copy cURL"}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-[#252943] text-[#DEE0ED] text-xs font-mono overflow-x-auto">
              {curlCheckStatus}
            </pre>
          </div>

          <div>
            <span className="text-[11px] font-bold text-[#252943]/70 block pb-1.5">Example Response (200 OK)</span>
            <pre className="p-3.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-[#252943] text-xs font-mono overflow-x-auto">
{`{
  "order": 98765,
  "service": 101,
  "name": "2k",
  "link": "https://www.tiktok.com/@username/video/7391829182910",
  "quantity": 2960,
  "status": "in_progress",
  "start_count": 0,
  "remains": 1450,
  "charge": "16.91",
  "currency": "INR",
  "engagement": {
    "target_views": 2960,
    "target_likes": 42,
    "delivered_views": 1510,
    "delivered_likes": 15,
    "batches_total": 16,
    "batches_completed": 8
  }
}`}
            </pre>
          </div>
        </div>

        {/* 5. Classic SMM Single-Endpoint POST /api/v2 */}
        <div className="p-6 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] shadow-subtle space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DEE0ED]/60">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-md bg-purple-100 text-purple-800 text-[11px] font-black uppercase">
                POST
              </span>
              <span className="font-mono text-sm font-bold text-[#252943]">/api/v2 (Classic SMM Compatibility)</span>
            </div>
            <span className="text-xs text-[#252943]/70">Form-data or URL-encoded Single-Endpoint</span>
          </div>

          <p className="text-xs text-[#252943]/80 leading-relaxed">
            Compatible with traditional SMM software. Supports <code className="font-bold text-[#252943]">action=services</code>, <code className="font-bold text-[#252943]">action=balance</code>, <code className="font-bold text-[#252943]">action=add</code>, and <code className="font-bold text-[#252943]">action=status</code>. Set <code className="font-bold text-[#252943]">service=2k</code> (or 5k, 10k, 15k) and <code className="font-bold text-[#252943]">shuffle=true</code>.
          </p>

          <div>
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-[11px] font-bold text-[#252943]/70">Example Request (action=add)</span>
              <button
                onClick={() => copyCode(curlClassicPost, "curl_classic")}
                className="text-xs font-bold text-[#3A4EFB] hover:underline flex items-center gap-1"
              >
                {copiedSection === "curl_classic" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSection === "curl_classic" ? "Copied" : "Copy cURL"}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-[#252943] text-[#DEE0ED] text-xs font-mono overflow-x-auto">
              {curlClassicPost}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

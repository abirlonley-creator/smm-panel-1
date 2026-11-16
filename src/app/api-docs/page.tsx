"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Code2,
  Copy,
  Check,
  Zap,
  ShieldCheck,
  ExternalLink,
  BookOpen,
  ArrowRight,
  Terminal,
  KeyRound,
  FileCode,
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

  const curlOrder2000Views = `curl -X POST "${baseUrl}/orders" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "service": 101,
    "link": "https://www.tiktok.com/@username/video/7391829182910",
    "quantity": 2000
  }'`;

  const curlCheckStatus = `curl -X GET "${baseUrl}/orders/98765" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;

  const curlClassicPost = `curl -X POST "${baseUrl}" \\
  -d "key=YOUR_API_KEY" \\
  -d "action=add" \\
  -d "service=101" \\
  -d "link=https://www.tiktok.com/@username/video/7391829182910" \\
  -d "quantity=2000"`;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 animate-fadeIn">
      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#252943] text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-[#3A4EFB]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3A4EFB]/20 border border-[#3A4EFB]/40 text-xs font-semibold text-[#E3FF3B]">
              <Zap className="w-3.5 h-3.5" />
              <span>Universal AI & Developer API v2</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Aura SMM Universal API Documentation
            </h1>
            <p className="text-sm text-[#DEE0ED]/80 max-w-2xl leading-relaxed">
              Standard REST API for automated agents (Muse, ChatGPT, Gemini, Claude) and developers.
              Query live engagement services, check real-time balance, place orders, and track execution status.
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
            Keys begin with <code className="font-bold text-[#252943]">aura_live_</code>. Never share your secret keys in client-side code.
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
            <span className="text-xs text-[#252943]/70">List all active engagement services</span>
          </div>

          <p className="text-xs text-[#252943]/80 leading-relaxed">
            Returns all available active services from the database with real-time rates, min/max limits, and descriptions. Automated AI assistants must always call this endpoint first to resolve service IDs.
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
    "category": "Engagement",
    "name": "TikTok Views",
    "platform": "tiktok",
    "type": "views",
    "rate": "5.70",
    "min": 100,
    "max": 10000000,
    "description": "Organic views for TikTok videos",
    "status": "active"
  },
  {
    "service": 102,
    "category": "Engagement",
    "name": "TikTok Likes",
    "platform": "tiktok",
    "type": "likes",
    "rate": "0.85",
    "min": 10,
    "max": 500000,
    "description": "Organic high quality likes for TikTok posts",
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
            <span className="text-xs text-[#252943]/70">Check account wallet balance</span>
          </div>

          <p className="text-xs text-[#252943]/80 leading-relaxed">
            Returns the current available balance for the authenticated account in USD.
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
  "balance": "125.50",
  "currency": "USD"
}`}
            </pre>
          </div>
        </div>

        {/* 3. POST /orders (Includes 2000 views example) */}
        <div className="p-6 rounded-2xl bg-white border-2 border-[#3A4EFB]/30 shadow-subtle space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DEE0ED]/60">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-md bg-blue-100 text-[#3A4EFB] text-[11px] font-black uppercase">
                POST
              </span>
              <span className="font-mono text-sm font-bold text-[#252943]">/api/v2/orders</span>
            </div>
            <span className="text-xs font-bold text-[#3A4EFB]">Place Order (Ordering 2,000 Views)</span>
          </div>

          <p className="text-xs text-[#252943]/80 leading-relaxed">
            Submits an order. Validates that the service exists and is active, link is valid, quantity is within bounds, and user has sufficient wallet balance. Requires <code className="font-bold text-[#252943]">FULL_ACCESS</code> permission.
          </p>

          <div>
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-[11px] font-bold text-[#252943]/70">Example Request (Ordering 2,000 Views)</span>
              <button
                onClick={() => copyCode(curlOrder2000Views, "curl_order")}
                className="text-xs font-bold text-[#3A4EFB] hover:underline flex items-center gap-1"
              >
                {copiedSection === "curl_order" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSection === "curl_order" ? "Copied" : "Copy cURL"}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-[#252943] text-[#DEE0ED] text-xs font-mono overflow-x-auto">
              {curlOrder2000Views}
            </pre>
          </div>

          <div>
            <span className="text-[11px] font-bold text-[#252943]/70 block pb-1.5">Example Response (200 OK)</span>
            <pre className="p-3.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-[#252943] text-xs font-mono overflow-x-auto">
{`{
  "order": 98765,
  "charge": "11.40",
  "currency": "USD",
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
            <span className="text-xs text-[#252943]/70">Track order progress & delivery</span>
          </div>

          <p className="text-xs text-[#252943]/80 leading-relaxed">
            Retrieves delivery progress and execution metrics for an order. Status values are strictly normalized to:{" "}
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
  "link": "https://www.tiktok.com/@username/video/7391829182910",
  "quantity": 2000,
  "status": "in_progress",
  "start_count": 0,
  "remains": 1500,
  "charge": "11.40"
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
              <span className="font-mono text-sm font-bold text-[#252943]">/api/v2 (Classic SMM Single-Endpoint)</span>
            </div>
            <span className="text-xs text-[#252943]/70">Backwards compatibility for legacy SMM software</span>
          </div>

          <p className="text-xs text-[#252943]/80 leading-relaxed">
            Accepts form fields (<code className="font-bold text-[#252943]">key</code>, <code className="font-bold text-[#252943]">action</code>) via URL-encoded form data or JSON:
            <br />
            <code className="text-[#3A4EFB] font-bold">action=services</code> |{" "}
            <code className="text-[#3A4EFB] font-bold">action=balance</code> |{" "}
            <code className="text-[#3A4EFB] font-bold">action=add</code> |{" "}
            <code className="text-[#3A4EFB] font-bold">action=status</code>
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

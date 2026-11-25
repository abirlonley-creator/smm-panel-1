"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ArrowRight, Check, AlertTriangle, Activity, Pause, Sparkles } from "lucide-react";
import {
  generatePattern,
  DEFAULT_PACKAGES,
  DEFAULT_PROVIDER_MINIMUMS,
  DEFAULT_TIKTOK_CONFIG,
} from "@/lib/engagement/deterministic-pattern-engine";
import { EASE_OUT, SPRING_GENTLE, VIEWPORT_ONCE } from "./motionTokens";

const PLATFORM_DELAYS = [0, 0.045, 0.085, 0.12, 0.15];

export function LandingOrganicShowcase() {
  const [curveMode, setCurveMode] = useState<"organic" | "bot">("organic");

  // Use the real deterministic engine to plot cumulative organic wave points
  const organicPoints = useMemo(() => {
    const plan = generatePattern(
      DEFAULT_PACKAGES.tiktok_5k,
      2500,
      "aurasmm_showcase_v3",
      {
        platformConfig: DEFAULT_TIKTOK_CONFIG,
        providerMinimums: DEFAULT_PROVIDER_MINIMUMS,
        startDate: new Date("2026-01-01T10:00:00Z"),
      }
    );

    const batches = (plan?.batches || []).filter((b) => b.service === "views");
    if (batches.length === 0) {
      return [
        { x: 10, y: 125 },
        { x: 60, y: 112 },
        { x: 120, y: 92 },
        { x: 180, y: 66 },
        { x: 240, y: 44 },
        { x: 300, y: 22 },
      ];
    }

    const totalViews = batches.reduce((acc, b) => acc + b.quantity, 0) || 1;
    let running = 0;
    const pts = batches.map((b, i) => {
      running += b.quantity;
      const x = 14 + (i / Math.max(1, batches.length - 1)) * 272;
      const pct = running / totalViews;
      const y = 132 - pct * 106;
      return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
    });
    return [{ x: 10, y: 135 }, ...pts];
  }, []);

  const organicPath = useMemo(() => {
    return organicPoints
      .map((pt, idx) => `${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`)
      .join(" ");
  }, [organicPoints]);

  const botPath = "M 10 135 L 42 135 L 54 18 L 300 18";

  function handleCurveSwitch(mode: "organic" | "bot") {
    setCurveMode(mode);
    if (mode === "organic") {
      toast.success("Organic Multi-Wave Curve", {
        description: "Views climb gradually across 24 hours—zero spam flags.",
      });
    } else {
      toast.error("Bot Spike Warning", {
        description: "Instant 90-second dumps trigger velocity tripwires.",
      });
    }
  }

  return (
    <div className="space-y-24 sm:space-y-32">
      {/* ── SECTION 4: Platforms + Dark Promo Banner ── */}
      <section className="max-w-[1160px] mx-auto px-4 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT_ONCE}
          transition={{ duration: 0.52, ease: EASE_OUT }}
          className="text-center max-w-xl mx-auto space-y-3 mb-12"
        >
          <h2 className="text-3xl sm:text-[44px] font-bold tracking-[-0.035em] text-[#111413] leading-[1.08]">
            Supported Platforms
          </h2>
          <p className="text-sm sm:text-base text-[#5B625F] leading-relaxed">
            Built for the algorithmic pacing rules of today&apos;s biggest creator networks and feeds.
          </p>
        </motion.div>

        {/* Clean Circular Platform Badges with non-uniform wave entrance */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-7 mb-20">
          {[
            {
              name: "TikTok",
              note: "Circadian FYP pacing & 3–6% likes ratio active",
              svg: (
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#111413]" aria-hidden="true">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
              ),
            },
            {
              name: "Instagram",
              note: "Reels Explore-safe velocity & save retention boost",
              svg: (
                <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-[#111413] fill-none" strokeWidth="2" aria-hidden="true">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" className="fill-[#111413]" />
                </svg>
              ),
            },
            {
              name: "YouTube",
              note: "Shorts retention-matched micro-batches",
              svg: (
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#111413]" aria-hidden="true">
                  <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
                  <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="#F7F6F2" />
                </svg>
              ),
            },
            {
              name: "Facebook",
              note: "Reels & feed steady multi-hour growth",
              svg: (
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#111413]" aria-hidden="true">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              ),
            },
            {
              name: "X",
              note: "Post impressions synced with natural repost waves",
              svg: (
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#111413]" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              ),
            },
          ].map((item, idx) => (
            <motion.button
              key={item.name}
              type="button"
              onClick={() => toast(item.name, { description: item.note })}
              initial={{ opacity: 0, y: 12, scale: 0.93 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={VIEWPORT_ONCE}
              transition={{
                duration: 0.45,
                delay: PLATFORM_DELAYS[idx] ?? 0.15,
                ease: EASE_OUT,
              }}
              whileHover={{ y: -3, transition: SPRING_GENTLE }}
              whileTap={{ scale: 0.96 }}
              className="group flex flex-col items-center gap-2 cursor-pointer focus-visible:outline-none"
            >
              <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-[#F7F6F2] border border-[#E4E0D3]/70 flex items-center justify-center transition-colors duration-200 group-hover:border-[#111413]/35 group-hover:bg-[#D4F04F]/30">
                {item.svg}
              </div>
              <span className="text-[11px] font-semibold text-[#5B625F] group-hover:text-[#111413] transition-colors">
                {item.name}
              </span>
            </motion.button>
          ))}
        </div>

        {/* Dark Ink Control Banner with Self-Drawing Sine Wave & Floating White Dashboard Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 18 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={VIEWPORT_ONCE}
          transition={{ duration: 0.58, ease: EASE_OUT }}
          className="relative rounded-[28px] sm:rounded-[34px] bg-[#111413] text-white px-6 py-10 sm:px-14 sm:py-14 overflow-visible"
        >
          {/* Subtle Concentric/Diagonal Vector Lines inside dark banner */}
          <svg
            aria-hidden="true"
            viewBox="0 0 800 320"
            className="absolute inset-0 w-full h-full pointer-events-none opacity-25 rounded-[28px] sm:rounded-[34px]"
            preserveAspectRatio="none"
          >
            <path d="M -40 260 L 420 120" stroke="#222826" strokeWidth="1" />
            <path d="M 80 320 L 580 140" stroke="#222826" strokeWidth="1" />
            <path d="M 220 320 L 760 80" stroke="#222826" strokeWidth="1" />
          </svg>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Copy + Self-Drawing Curved Sine Doodle */}
            <div className="lg:col-span-7 flex flex-col sm:flex-row items-start gap-6">
              <svg
                aria-hidden="true"
                viewBox="0 0 110 64"
                className="w-20 h-12 shrink-0 hidden sm:block mt-2"
              >
                <motion.path
                  d="M 4 50 C 20 12, 42 12, 54 34 C 66 56, 86 52, 102 36"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={VIEWPORT_ONCE}
                  transition={{ duration: 0.85, delay: 0.2, ease: EASE_OUT }}
                />
              </svg>

              <div className="space-y-6">
                <h3 className="text-2xl sm:text-[34px] font-bold tracking-[-0.03em] leading-[1.12] max-w-md">
                  Keep Your Finger on Every Growth Wave
                </h3>
                <p className="text-sm text-[#9AA39F] max-w-md leading-relaxed">
                  Watch micro-batches execute in real time, pause or adjust active curves anytime, and track every view, like, and save from one dashboard.
                </p>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-white hover:bg-[#F3F1EA] active:scale-[0.97] text-[#111413] text-sm font-bold transition-transform"
                >
                  <span>Open Growth Planner</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right Floating White App Card rising gently */}
            <div className="lg:col-span-5">
              <motion.div
                initial={{ opacity: 0, y: 28, scale: 0.96 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={VIEWPORT_ONCE}
                transition={{ duration: 0.62, delay: 0.14, ease: EASE_OUT }}
                className="bg-white text-[#111413] rounded-[24px] p-5 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.45)] border border-[#E4E0D3]/60 lg:-my-8"
              >
                <div className="text-center pb-3">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#9AA39F]">
                    Total Reach Delivered
                  </div>
                  <div className="text-2xl font-extrabold tracking-tight text-[#111413] tabular-nums mt-0.5">
                    15,240 <span className="text-xs font-bold text-[#5E8C1F]">+24.8%</span>
                  </div>
                </div>

                {/* Nested Dark Active Campaign Box */}
                <div className="rounded-2xl bg-[#111413] text-white p-4 mb-3.5">
                  <div className="flex items-center justify-between text-[10px] text-[#9AA39F] mb-1">
                    <span>Active Campaign • TikTok 10K</span>
                    <span className="w-2 h-2 rounded-full bg-[#D4F04F] animate-pulse" />
                  </div>
                  <div className="text-lg font-extrabold tabular-nums">
                    8,420 Views{" "}
                    <span className="text-[11px] font-semibold text-[#D4F04F]">
                      Wave 14/20
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#222826] text-[10px] font-semibold text-white">
                      <Pause className="w-2.5 h-2.5 text-[#D4F04F]" />
                      Pacing Active
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#D4F04F] text-[10px] font-bold text-[#111413]">
                      <Sparkles className="w-2.5 h-2.5" />
                      FYP Safe
                    </span>
                  </div>
                </div>

                {/* 3 Self-Drawing Sparkline Rows */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-[#EEF6EC] text-[#2F6B3A] flex items-center justify-center text-[10px] font-bold">
                        V
                      </span>
                      <div>
                        <div className="font-bold text-[#111413] text-[11px]">Views</div>
                        <div className="text-[9px] text-[#5B625F]">Circadian Ramp</div>
                      </div>
                    </div>
                    <svg viewBox="0 0 60 20" className="w-12 h-5">
                      <motion.path
                        d="M 2 16 Q 16 14, 28 9 T 58 3"
                        fill="none"
                        stroke="#5E8C1F"
                        strokeWidth="2"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        whileInView={{ pathLength: 1 }}
                        viewport={VIEWPORT_ONCE}
                        transition={{ duration: 0.75, delay: 0.28, ease: EASE_OUT }}
                      />
                    </svg>
                    <div className="text-right tabular-nums">
                      <div className="font-bold text-[11px]">8,420</div>
                      <div className="text-[9px] font-semibold text-[#5E8C1F]">+18.4%</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1 border-t border-[#E4E0D3]/50 pt-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-[#FDF2EF] text-[#C4552D] flex items-center justify-center text-[10px] font-bold">
                        L
                      </span>
                      <div>
                        <div className="font-bold text-[#111413] text-[11px]">Likes</div>
                        <div className="text-[9px] text-[#5B625F]">4.1% Ratio Sync</div>
                      </div>
                    </div>
                    <svg viewBox="0 0 60 20" className="w-12 h-5">
                      <motion.path
                        d="M 2 17 Q 20 15, 34 11 T 58 5"
                        fill="none"
                        stroke="#C4552D"
                        strokeWidth="2"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        whileInView={{ pathLength: 1 }}
                        viewport={VIEWPORT_ONCE}
                        transition={{ duration: 0.75, delay: 0.36, ease: EASE_OUT }}
                      />
                    </svg>
                    <div className="text-right tabular-nums">
                      <div className="font-bold text-[11px]">+345</div>
                      <div className="text-[9px] font-semibold text-[#C4552D]">Matched</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-1 border-t border-[#E4E0D3]/50 pt-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-[#FBF0DC] text-[#B7791F] flex items-center justify-center text-[10px] font-bold">
                        S
                      </span>
                      <div>
                        <div className="font-bold text-[#111413] text-[11px]">Saves</div>
                        <div className="text-[9px] text-[#5B625F]">Retention Boost</div>
                      </div>
                    </div>
                    <svg viewBox="0 0 60 20" className="w-12 h-5">
                      <motion.path
                        d="M 2 17 L 22 14 L 38 12 L 58 6"
                        fill="none"
                        stroke="#E0A030"
                        strokeWidth="2"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        whileInView={{ pathLength: 1 }}
                        viewport={VIEWPORT_ONCE}
                        transition={{ duration: 0.75, delay: 0.44, ease: EASE_OUT }}
                      />
                    </svg>
                    <div className="text-right tabular-nums">
                      <div className="font-bold text-[11px]">+84</div>
                      <div className="text-[9px] font-semibold text-[#B7791F]">Active</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── SECTION 5A: See the Curve Before You Spend ── */}
      <section id="organic-growth" className="max-w-[1160px] mx-auto px-4 sm:px-8 scroll-mt-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left: Lime Backing rotating into place + Dark Chart Card */}
          <div className="lg:col-span-6 relative py-4">
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0, rotate: -7, scale: 0.94 }}
              whileInView={{ opacity: 1, rotate: -3, scale: 1 }}
              viewport={VIEWPORT_ONCE}
              transition={{ duration: 0.65, ease: EASE_OUT }}
              className="absolute left-2 sm:left-6 top-6 bottom-2 w-[82%] rounded-[24px] bg-[#D4F04F]"
            />

            <motion.div
              initial={{ opacity: 0, y: 22, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={VIEWPORT_ONCE}
              transition={{ duration: 0.58, delay: 0.08, ease: EASE_OUT }}
              className="relative z-10 bg-[#111413] text-white rounded-[24px] p-6 sm:p-7 shadow-[0_28px_60px_-15px_rgba(17,20,19,0.35)] border border-[#222826] max-w-[460px] mx-auto lg:mx-0"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#D4F04F]" />
                    <span>
                      {curveMode === "organic"
                        ? "AuraSMM Circadian Wave"
                        : "Generic Bot Blast"}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#9AA39F] mt-0.5">
                    {curveMode === "organic"
                      ? "5,100 views across 24 hours"
                      : "5,000 views dumped in 90 seconds"}
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    curveMode === "organic"
                      ? "bg-[#2F6B3A]/30 text-[#D4F04F] border border-[#D4F04F]/30"
                      : "bg-[#C4552D]/25 text-[#F29B7E] border border-[#C4552D]/40"
                  }`}
                >
                  {curveMode === "organic" ? "FYP Safe" : "Flag Risk"}
                </span>
              </div>

              {/* SVG Live Curve Chart with Self-Drawing Animation */}
              <div className="h-[175px] rounded-2xl bg-[#181C1A] border border-[#222826] p-3 relative overflow-hidden">
                <svg viewBox="0 0 310 145" className="w-full h-full">
                  <line x1="10" y1="35" x2="300" y2="35" stroke="#222826" strokeDasharray="3 3" />
                  <line x1="10" y1="85" x2="300" y2="85" stroke="#222826" strokeDasharray="3 3" />
                  <line x1="10" y1="135" x2="300" y2="135" stroke="#2C332F" />

                  {curveMode === "organic" ? (
                    <g key="organic-svg">
                      <motion.path
                        d={`${organicPath} L 286 135 L 10 135 Z`}
                        fill="rgba(212, 240, 79, 0.12)"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={VIEWPORT_ONCE}
                        transition={{ duration: 0.6, delay: 0.25 }}
                      />
                      <motion.path
                        d={organicPath}
                        fill="none"
                        stroke="#D4F04F"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        whileInView={{ pathLength: 1 }}
                        viewport={VIEWPORT_ONCE}
                        transition={{ duration: 0.95, ease: EASE_OUT }}
                      />
                      <motion.circle
                        cx="286"
                        cy="26"
                        r="4"
                        fill="#D4F04F"
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={VIEWPORT_ONCE}
                        transition={{ delay: 0.8, duration: 0.25 }}
                      />
                    </g>
                  ) : (
                    <g key="bot-svg">
                      <motion.path
                        d={`${botPath} L 300 135 L 10 135 Z`}
                        fill="rgba(196, 85, 45, 0.16)"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.35 }}
                      />
                      <motion.path
                        d={botPath}
                        fill="none"
                        stroke="#C4552D"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.6, ease: EASE_OUT }}
                      />
                      <motion.circle
                        cx="54"
                        cy="18"
                        r="4.5"
                        fill="#C4552D"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.35 }}
                      />
                    </g>
                  )}
                </svg>

                <div className="absolute bottom-2.5 right-3 text-[10px] font-mono text-[#9AA39F]">
                  {curveMode === "organic" ? "24h multi-wave progression" : "00:01:30 vertical anomaly"}
                </div>
              </div>

              {/* Interactive Curve Switcher */}
              <div className="grid grid-cols-2 gap-2 mt-4 p-1 rounded-xl bg-[#181C1A] border border-[#222826]">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleCurveSwitch("organic")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    curveMode === "organic"
                      ? "bg-[#D4F04F] text-[#111413]"
                      : "text-[#9AA39F] hover:text-white"
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Organic Curve</span>
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleCurveSwitch("bot")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    curveMode === "bot"
                      ? "bg-[#C4552D] text-white"
                      : "text-[#9AA39F] hover:text-white"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Bot Spike</span>
                </motion.button>
              </div>
            </motion.div>
          </div>

          {/* Right Copy */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT_ONCE}
            transition={{ duration: 0.56, delay: 0.12, ease: EASE_OUT }}
            className="lg:col-span-6 space-y-5"
          >
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5E8C1F]">
              <span className="w-2 h-2 rounded-full bg-[#5E8C1F]" />
              Preview Before Launch
            </span>
            <h2 className="text-3xl sm:text-[42px] font-bold tracking-[-0.035em] text-[#111413] leading-[1.08]">
              See the Organic Curve Before You Spend
            </h2>
            <p className="text-base text-[#5B625F] leading-relaxed">
              Generic SMM panels blast every view at once, creating an unnatural vertical spike that trips algorithm spam filters.
            </p>
            <p className="text-base text-[#5B625F] leading-relaxed">
              AuraSMM computes your full multi-hour wave plan before checkout—scaling views, likes, and saves along realistic human activity curves so platforms reward your post with organic spillover.
            </p>
            <div className="pt-2">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 text-sm font-bold text-[#111413] hover:text-[#5E8C1F] transition-colors"
              >
                <span>Try the interactive planner</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── SECTION 5B: Simple From Link to Launch ── */}
      <section className="max-w-[1160px] mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Copy */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT_ONCE}
            transition={{ duration: 0.56, ease: EASE_OUT }}
            className="lg:col-span-6 space-y-5 order-2 lg:order-1"
          >
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5E8C1F]">
              <span className="w-2 h-2 rounded-full bg-[#5E8C1F]" />
              All-In-One Growth
            </span>
            <h2 className="text-3xl sm:text-[42px] font-bold tracking-[-0.035em] text-[#111413] leading-[1.08]">
              One Link. Every Signal Synchronized.
            </h2>
            <p className="text-base text-[#5B625F] leading-relaxed">
              Pick a tested preset from 2K Starter up to 50K Mega Viral—or automate directly via our REST v2 API. Each wave delivers views first, then layers natural likes, saves, and shares behind them.
            </p>
            <div className="flex flex-wrap items-center gap-6 pt-2">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#111413] hover:bg-[#1B201E] active:scale-[0.97] text-white text-sm font-semibold transition-transform"
              >
                <span>Explore Packages</span>
                <ArrowRight className="w-4 h-4 text-[#D4F04F]" />
              </Link>
              <Link
                href="/api-docs"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-[#111413] hover:text-[#5E8C1F] transition-colors"
              >
                <span>Read API Docs</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>

          {/* Right: Lime Circle Scaling + Vertical Ink Curve Drawing + Alternating Wave Cards */}
          <div className="lg:col-span-6 relative py-8 order-1 lg:order-2">
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={VIEWPORT_ONCE}
              transition={{ duration: 0.65, ease: EASE_OUT }}
              className="absolute right-0 sm:right-4 top-1/2 -translate-y-1/2 w-[260px] h-[260px] sm:w-[320px] sm:h-[320px] rounded-full bg-[#D4F04F]"
            />

            <svg
              aria-hidden="true"
              viewBox="0 0 320 260"
              className="absolute inset-0 w-full h-full pointer-events-none z-0"
            >
              <motion.path
                d="M 190 36 C 245 65, 115 110, 145 155 C 170 190, 230 205, 180 250"
                fill="none"
                stroke="#111413"
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={VIEWPORT_ONCE}
                transition={{ duration: 0.95, delay: 0.15, ease: EASE_OUT }}
              />
            </svg>

            <div className="relative z-10 space-y-4 max-w-[380px] mx-auto lg:mx-0">
              {/* Staggered Card 1 */}
              <motion.div
                initial={{ opacity: 0, x: -18, rotate: 0 }}
                whileInView={{ opacity: 1, x: 0, rotate: -2 }}
                viewport={VIEWPORT_ONCE}
                transition={{ duration: 0.52, delay: 0.08, ease: EASE_OUT }}
                whileHover={{ rotate: 0, y: -2, transition: SPRING_GENTLE }}
                className="bg-white rounded-2xl border border-[#E4E0D3]/80 shadow-[0_18px_40px_-12px_rgba(17,20,19,0.12)] px-4 py-3.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-full bg-[#111413] text-[#D4F04F] flex items-center justify-center text-xs font-extrabold shrink-0">
                    01
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#111413] truncate">
                      Initial Warmup Wave
                    </div>
                    <div className="text-[10px] text-[#5B625F]">Hour 0–2 • Soft entry</div>
                  </div>
                </div>
                <div className="text-right shrink-0 tabular-nums">
                  <div className="text-xs font-extrabold text-[#111413]">+420 Views</div>
                  <div className="text-[10px] font-semibold text-[#5E8C1F]">+14 Likes</div>
                </div>
              </motion.div>

              {/* Staggered Card 2 */}
              <motion.div
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 16 }}
                viewport={VIEWPORT_ONCE}
                transition={{ duration: 0.52, delay: 0.16, ease: EASE_OUT }}
                whileHover={{ y: -2, transition: SPRING_GENTLE }}
                className="bg-white rounded-2xl border border-[#E4E0D3]/80 shadow-[0_18px_40px_-12px_rgba(17,20,19,0.14)] px-4 py-3.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-full bg-[#F3F1EA] border border-[#E4E0D3] text-[#111413] flex items-center justify-center text-xs font-extrabold shrink-0">
                    02
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#111413] truncate">
                      Circadian Peak Wave
                    </div>
                    <div className="text-[10px] text-[#5B625F]">Hour 4–14 • Prime feed</div>
                  </div>
                </div>
                <svg viewBox="0 0 46 18" className="w-10 h-4 shrink-0 hidden sm:block">
                  <motion.path
                    d="M 2 14 Q 14 14, 22 8 T 44 3"
                    fill="none"
                    stroke="#C4552D"
                    strokeWidth="2"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={VIEWPORT_ONCE}
                    transition={{ duration: 0.7, delay: 0.3, ease: EASE_OUT }}
                  />
                </svg>
                <div className="text-right shrink-0 tabular-nums">
                  <div className="text-xs font-extrabold text-[#111413]">+2,650 Views</div>
                  <div className="text-[10px] font-semibold text-[#C4552D]">+112 Likes</div>
                </div>
              </motion.div>

              {/* Staggered Card 3 */}
              <motion.div
                initial={{ opacity: 0, x: -12, rotate: 0 }}
                whileInView={{ opacity: 1, x: 6, rotate: 1.5 }}
                viewport={VIEWPORT_ONCE}
                transition={{ duration: 0.52, delay: 0.22, ease: EASE_OUT }}
                whileHover={{ rotate: 0, y: -2, transition: SPRING_GENTLE }}
                className="bg-white rounded-2xl border border-[#E4E0D3]/80 shadow-[0_18px_40px_-12px_rgba(17,20,19,0.14)] px-4 py-3.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-full bg-[#EEF6EC] text-[#2F6B3A] flex items-center justify-center text-xs font-extrabold shrink-0">
                    03
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#111413] truncate">
                      Explore Spillover Sustain
                    </div>
                    <div className="text-[10px] text-[#5B625F]">Hour 16–24 • Tail boost</div>
                  </div>
                </div>
                <svg viewBox="0 0 46 18" className="w-10 h-4 shrink-0 hidden sm:block">
                  <motion.path
                    d="M 2 15 Q 16 12, 26 9 T 44 2"
                    fill="none"
                    stroke="#5E8C1F"
                    strokeWidth="2"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={VIEWPORT_ONCE}
                    transition={{ duration: 0.7, delay: 0.38, ease: EASE_OUT }}
                  />
                </svg>
                <div className="text-right shrink-0 tabular-nums">
                  <div className="text-xs font-extrabold text-[#111413]">+2,030 Views</div>
                  <div className="text-[10px] font-semibold text-[#5E8C1F]">+42 Saves</div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

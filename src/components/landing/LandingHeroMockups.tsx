"use client";

import React, { useState } from "react";
import { CheckCircle2, Play, Pause, Sparkles, Link2, ShieldCheck } from "lucide-react";

type PlatformKey = "TikTok" | "Instagram" | "YouTube" | "X";
type HorizonKey = "1H" | "6H" | "24H" | "48H" | "72H";

const PLATFORM_PRESETS: Record<
  PlatformKey,
  {
    packageName: string;
    reachLabel: string;
    views: string;
    likes: string;
    saves: string;
    urlPlaceholder: string;
    safetyScore: string;
    waveNote: string;
  }
> = {
  TikTok: {
    packageName: "5K Velocity Wave",
    reachLabel: "5,100 Views",
    views: "5,100",
    likes: "185",
    saves: "42",
    urlPlaceholder: "tiktok.com/@creator/video/7419...",
    safetyScore: "99.4% Safe",
    waveNote: "24h Circadian • FYP Explore Ready",
  },
  Instagram: {
    packageName: "Reels Organic 5K",
    reachLabel: "5,240 Plays",
    views: "5,240",
    likes: "210",
    saves: "58",
    urlPlaceholder: "instagram.com/reel/C9xK2pL...",
    safetyScore: "99.6% Safe",
    waveNote: "24h Explore Pace • Saves Synced",
  },
  YouTube: {
    packageName: "Shorts Steady 5K",
    reachLabel: "5,050 Views",
    views: "5,050",
    likes: "160",
    saves: "34",
    urlPlaceholder: "youtube.com/shorts/k8QmN4...",
    safetyScore: "99.5% Safe",
    waveNote: "36h Retention-Safe Drip",
  },
  X: {
    packageName: "Post Reach 5K",
    reachLabel: "5,180 Views",
    views: "5,180",
    likes: "145",
    saves: "29",
    urlPlaceholder: "x.com/builder/status/1842...",
    safetyScore: "99.2% Safe",
    waveNote: "18h Natural Velocity Ramp",
  },
};

const HORIZON_BARS: Record<
  HorizonKey,
  { h: number; type: "lime" | "clay" }[]
> = {
  "1H": [
    { h: 22, type: "lime" },
    { h: 28, type: "lime" },
    { h: 18, type: "clay" },
    { h: 35, type: "lime" },
    { h: 42, type: "lime" },
    { h: 38, type: "clay" },
    { h: 52, type: "lime" },
    { h: 64, type: "lime" },
  ],
  "6H": [
    { h: 20, type: "lime" },
    { h: 34, type: "lime" },
    { h: 26, type: "clay" },
    { h: 48, type: "lime" },
    { h: 56, type: "lime" },
    { h: 44, type: "clay" },
    { h: 70, type: "lime" },
    { h: 82, type: "lime" },
  ],
  "24H": [
    { h: 18, type: "lime" },
    { h: 32, type: "lime" },
    { h: 24, type: "clay" },
    { h: 46, type: "lime" },
    { h: 62, type: "lime" },
    { h: 50, type: "clay" },
    { h: 78, type: "lime" },
    { h: 92, type: "lime" },
  ],
  "48H": [
    { h: 15, type: "lime" },
    { h: 26, type: "lime" },
    { h: 36, type: "lime" },
    { h: 30, type: "clay" },
    { h: 54, type: "lime" },
    { h: 68, type: "lime" },
    { h: 60, type: "clay" },
    { h: 94, type: "lime" },
  ],
  "72H": [
    { h: 14, type: "lime" },
    { h: 24, type: "lime" },
    { h: 38, type: "lime" },
    { h: 44, type: "lime" },
    { h: 39, type: "clay" },
    { h: 64, type: "lime" },
    { h: 82, type: "lime" },
    { h: 96, type: "lime" },
  ],
};

export function LandingHeroMockups() {
  const [platform, setPlatform] = useState<PlatformKey>("TikTok");
  const [horizon, setHorizon] = useState<HorizonKey>("24H");
  const [paused, setPaused] = useState(false);

  const active = PLATFORM_PRESETS[platform];
  const bars = HORIZON_BARS[horizon];

  return (
    <div className="relative w-full max-w-[620px] mx-auto lg:mx-0 lg:ml-auto select-none">
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-0 items-start">
        {/* ── Front White Card: Growth Planner / Link & Package Picker ── */}
        <div className="sm:col-span-7 relative z-20 bg-white rounded-[26px] border border-[#E4E0D3]/80 shadow-[0_28px_60px_-15px_rgba(17,20,19,0.20)] p-5 text-[#111413] sm:-rotate-[2.5deg] transition-transform duration-300 hover:rotate-0">
          <div className="flex items-center justify-between mb-3.5">
            <span className="text-[17px] font-bold tracking-tight text-[#111413]">
              Planner
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[#F3F1EA] text-[#5E8C1F]">
              <ShieldCheck className="w-3 h-3" />
              Anti-Spike On
            </span>
          </div>

          {/* Search / Post URL Pill */}
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-[#F7F6F2] border border-[#E4E0D3]/70 text-[11px] text-[#5B625F] mb-3">
            <Link2 className="w-3.5 h-3.5 text-[#5E8C1F] shrink-0" />
            <span className="truncate font-medium">{active.urlPlaceholder}</span>
          </div>

          {/* Interactive Platform Chips */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {(["TikTok", "Instagram", "YouTube", "X"] as PlatformKey[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPlatform(item)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors cursor-pointer ${
                  platform === item
                    ? "bg-[#111413] text-[#D4F04F]"
                    : "bg-[#F3F1EA] text-[#5B625F] hover:text-[#111413]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {/* Dark Strategy Card inside White Phone */}
          <div className="text-[9px] font-bold uppercase tracking-wider text-[#9AA39F] mb-2">
            Active Wave Preset
          </div>
          <div className="rounded-2xl bg-[#111413] text-white p-4 mb-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-white">{active.packageName}</div>
                <div className="text-[10px] text-[#9AA39F] mt-0.5 leading-snug">
                  {active.waveNote}
                </div>
              </div>
              <Sparkles className="w-3.5 h-3.5 text-[#D4F04F] shrink-0 mt-0.5" />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-extrabold text-[#D4F04F] tabular-nums">
                  {active.safetyScore}
                </div>
                <div className="text-[9px] text-[#9AA39F]">algorithm match</div>
              </div>
              <div className="flex -space-x-1.5">
                <span className="w-6 h-6 rounded-full bg-[#2F6B3A] border-2 border-[#111413] flex items-center justify-center text-[8px] font-bold">
                  V
                </span>
                <span className="w-6 h-6 rounded-full bg-[#C4552D] border-2 border-[#111413] flex items-center justify-center text-[8px] font-bold">
                  L
                </span>
                <span className="w-6 h-6 rounded-full bg-[#E0A030] border-2 border-[#111413] flex items-center justify-center text-[8px] font-bold text-[#111413]">
                  S
                </span>
                <span className="w-6 h-6 rounded-full bg-[#222826] border-2 border-[#111413] flex items-center justify-center text-[8px] font-semibold text-white">
                  +2
                </span>
              </div>
            </div>
          </div>

          {/* Signals Row */}
          <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-[#9AA39F] mb-2">
            <span>Synced Signals</span>
            <span className="text-[#5E8C1F]">Auto-Ratio</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-[#F7F6F2] border border-[#E4E0D3]/60">
              <div className="w-6 h-6 rounded-lg bg-[#111413] text-[#D4F04F] flex items-center justify-center text-[10px] font-extrabold mb-1.5">
                V
              </div>
              <div className="text-[11px] font-bold text-[#111413]">Total Views</div>
              <div className="text-[10px] font-semibold text-[#2F6B3A] tabular-nums">
                +{active.views} paced
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-[#F7F6F2] border border-[#E4E0D3]/60">
              <div className="w-6 h-6 rounded-lg bg-[#5E8C1F] text-white flex items-center justify-center text-[10px] font-extrabold mb-1.5">
                L
              </div>
              <div className="text-[11px] font-bold text-[#111413]">Likes & Saves</div>
              <div className="text-[10px] font-semibold text-[#5E8C1F] tabular-nums">
                +{active.likes} · +{active.saves}
              </div>
            </div>
          </div>
        </div>

        {/* ── Back Dark Card: Live Organic Curve & Controls ── */}
        <div className="sm:col-span-6 sm:-ml-8 sm:mt-8 relative z-10 bg-[#111413] rounded-[26px] border border-[#222826] shadow-[0_32px_70px_-15px_rgba(17,20,19,0.42)] p-4 text-white sm:rotate-[2deg] transition-transform duration-300 hover:rotate-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D4F04F] animate-pulse" />
                {platform} Organic Curve
              </div>
              <div className="text-[16px] font-extrabold text-white tabular-nums mt-0.5">
                {active.reachLabel}{" "}
                <span className="text-[10px] font-semibold text-[#D4F04F]">
                  +24.8% spillover
                </span>
              </div>
            </div>
          </div>

          {/* Dark Chart Area (Bars + Smooth Wave Line) */}
          <div className="relative h-[132px] rounded-2xl bg-[#181C1A] border border-[#222826] px-3 pt-4 pb-2 flex flex-col justify-end overflow-hidden mb-3">
            {/* Subtle Curve Overlay */}
            <svg
              viewBox="0 0 220 90"
              className="absolute inset-0 w-full h-full pointer-events-none opacity-60"
              preserveAspectRatio="none"
            >
              <path
                d="M 10 82 Q 55 72, 95 52 T 175 26 T 212 12"
                fill="none"
                stroke="#D4F04F"
                strokeWidth="1.6"
                strokeDasharray="3 3"
              />
            </svg>

            {/* Wave Bars */}
            <div className="relative z-10 flex items-end justify-between gap-1.5 h-[88px]">
              {bars.map((bar, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div
                    className={`w-1.5 rounded-full transition-all duration-300 ${
                      bar.type === "lime" ? "bg-[#D4F04F]" : "bg-[#C4552D]"
                    }`}
                    style={{ height: `${bar.h}%` }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Timeframe Pills */}
          <div className="flex items-center justify-between gap-1 bg-[#181C1A] rounded-full p-1 mb-3">
            {(["1H", "6H", "24H", "48H", "72H"] as HorizonKey[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setHorizon(t)}
                className={`flex-1 py-1 rounded-full text-[9px] font-bold transition-colors cursor-pointer ${
                  horizon === t
                    ? "bg-[#2C332F] text-[#D4F04F]"
                    : "text-[#9AA39F] hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* White Inner Breakdown Card matching frame_001 */}
          <div className="rounded-2xl bg-white text-[#111413] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-[#9AA39F] border-b border-[#E4E0D3]/60 pb-1.5">
              <span>Overview</span>
              <span className="text-[#111413]">Signals</span>
              <span>Status</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#5B625F]">Views Wave</span>
              <span className="font-bold text-[#111413] tabular-nums">
                {active.views}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#5B625F]">Synced Likes</span>
              <span className="font-bold text-[#2F6B3A] tabular-nums">
                +{active.likes}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#5B625F]">Saves & Shares</span>
              <span className="font-bold text-[#C4552D] tabular-nums">
                +{active.saves}
              </span>
            </div>

            {/* Bottom Pause / Launch Pill Row matching Sell / Buy in video */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPaused(!paused)}
                className="py-2 rounded-full bg-[#C4552D] hover:bg-[#B04823] text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                {paused ? "Resume" : "Pause"}
              </button>
              <a
                href="/signup"
                className="py-2 rounded-full bg-[#D4F04F] hover:bg-[#C5E23A] text-[#111413] text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
              >
                <CheckCircle2 className="w-3 h-3" />
                Launch
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

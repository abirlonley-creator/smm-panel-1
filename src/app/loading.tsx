"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Zap, ShieldCheck } from "lucide-react";

const LOADING_STEPS = [
  "Synchronizing algorithmic pacing models...",
  "Calibrating organic delivery thresholds...",
  "Loading real-time campaign telemetry...",
  "Connecting high-retention upstream nodes...",
];

export default function RootLoading() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 1200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F3F1EA] px-4 font-sans select-none animate-fadeIn">
      {/* Background Soft Glow */}
      <div className="absolute w-80 h-80 rounded-full bg-radial from-[#D4F04F]/20 to-transparent blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 flex flex-col items-center max-w-sm w-full text-center space-y-6">
        {/* Brand Icon Mark with Breathing Halo */}
        <div className="relative group">
          <div className="absolute -inset-2 rounded-3xl bg-[#D4F04F]/30 blur-lg animate-pulse" />
          <div className="relative w-16 h-16 rounded-2xl bg-[#111413] flex items-center justify-center shadow-lg border border-[#222826]">
            <img
              src="/brand/logos/mark-on-light.svg"
              alt="AuraSMM"
              className="w-8 h-8 object-contain filter invert drop-shadow-[0_0_8px_rgba(212,240,79,0.5)]"
            />
          </div>
        </div>

        {/* Brand Name & Tagline */}
        <div className="space-y-1">
          <h2 className="text-base font-black tracking-tight text-[#111413]">
            Aura<span className="text-[#5E8C1F]">SMM</span>
          </h2>
          <p className="text-[11px] font-semibold text-[#5B625F] tracking-wide uppercase">
            Organic Algorithmic Growth Platform
          </p>
        </div>

        {/* Progress Track */}
        <div className="w-56 h-1.5 rounded-full bg-[#E4E0D3] overflow-hidden relative shadow-inner">
          <div className="absolute top-0 bottom-0 left-0 bg-[#111413] w-1/3 rounded-full animate-marquee-fast" />
          <div className="absolute top-0 bottom-0 right-0 bg-[#D4F04F] w-1/4 rounded-full animate-pulse" />
        </div>

        {/* Dynamic Micro-Step Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E4E0D3] shadow-xs text-[11px] font-bold text-[#111413] transition-all">
          <span className="w-2 h-2 rounded-full bg-[#5E8C1F] animate-ping shrink-0" />
          <span className="truncate">{LOADING_STEPS[stepIndex]}</span>
        </div>

        {/* Security & Authenticity Reassurance Footer */}
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-[#5B625F]/80 pt-2">
          <ShieldCheck className="w-3.5 h-3.5 text-[#5E8C1F]" />
          <span>Encrypted Session • Zero Data Loss Engine</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowRight, ShieldCheck, Clock, Layers, Eye } from "lucide-react";
import { LandingHeroMockups } from "@/components/landing/LandingHeroMockups";
import { LandingOrganicShowcase } from "@/components/landing/LandingOrganicShowcase";

export default function LandingPage() {
  const router = useRouter();
  const [session, setSession] = useState<{ authenticated?: boolean } | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [quickHandle, setQuickHandle] = useState("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json().catch(() => null) : null))
      .then((data) => {
        if (data && data.authenticated) {
          setSession(data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleQuickStart(e: React.FormEvent) {
    e.preventDefault();
    router.push("/signup");
  }

  return (
    <div className="min-h-screen bg-white text-[#111413] selection:bg-[#D4F04F] selection:text-[#111413]">
      {/* ── Sticky Minimal Header ── */}
      <header
        className={`sticky top-0 z-50 transition-all duration-200 ${
          scrolled
            ? "bg-white/95 backdrop-blur-md border-b border-[#E4E0D3]/80 shadow-[0_4px_20px_rgba(17,20,19,0.04)]"
            : "bg-white/95 backdrop-blur-sm border-b border-transparent"
        }`}
      >
        <nav className="max-w-[1200px] mx-auto px-4 sm:px-8 h-[74px] flex items-center justify-between gap-4">
          {/* Official Brand Lockup */}
          <Link href="/" className="inline-flex items-center shrink-0" aria-label="AuraSMM Home">
            <Image
              src="/brand/logos/lockup-horizontal-on-light.svg"
              alt="AuraSMM"
              width={142}
              height={36}
              priority
              className="h-8 sm:h-9 w-auto"
            />
          </Link>

          {/* Center Navigation Links */}
          <div className="hidden md:flex items-center gap-8 text-[13px] font-semibold text-[#5B625F]">
            <Link href="#what-it-does" className="hover:text-[#111413] transition-colors">
              What it Does
            </Link>
            <Link href="#how-it-works" className="hover:text-[#111413] transition-colors">
              How it Grows
            </Link>
            <Link href="#organic-growth" className="hover:text-[#111413] transition-colors">
              Organic Curves
            </Link>
            <Link href="/pricing" className="hover:text-[#111413] transition-colors">
              Pricing
            </Link>
            <Link href="/api-docs" className="hover:text-[#111413] transition-colors">
              API
            </Link>
          </div>

          {/* Right Auth Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {session?.authenticated ? (
              <Link
                href="/engagement"
                className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-[#111413] hover:bg-[#1B201E] text-white text-xs sm:text-[13px] font-bold transition-all active:scale-[0.98]"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#D4F04F]" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2.5 rounded-xl bg-[#F7F6F2] hover:bg-[#F3F1EA] border border-[#E4E0D3]/80 text-[#111413] text-xs sm:text-[13px] font-semibold transition-colors"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-[#111413] hover:bg-[#1B201E] text-white text-xs sm:text-[13px] font-bold transition-all active:scale-[0.98]"
                >
                  <img
                    src="/brand/logos/mark-on-dark.svg"
                    alt=""
                    aria-hidden="true"
                    className="w-3.5 h-3.5"
                  />
                  <span>Get Started</span>
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <main className="space-y-24 sm:space-y-32 pb-20 sm:pb-28">
        {/* ── HERO: Rounded Lime Showcase Card with Floating App Mockups (frame_001 style) ── */}
        <section className="max-w-[1200px] mx-auto px-3 sm:px-6 pt-2 sm:pt-4">
          <div className="relative rounded-[28px] sm:rounded-[36px] bg-[#D4F04F] px-6 py-10 sm:px-12 sm:py-14 lg:px-14 lg:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
              {/* Left Hero Copy */}
              <div className="lg:col-span-6 relative z-10 space-y-6">
                <h1 className="text-[42px] sm:text-[54px] lg:text-[62px] font-bold tracking-[-0.04em] leading-[1.03] text-[#111413]">
                  <span className="inline-flex items-center gap-3">
                    <span>Grow Social</span>
                    {/* 4-point Sparkle Star matching reference */}
                    <svg
                      viewBox="0 0 36 36"
                      className="w-7 h-7 sm:w-9 sm:h-9 shrink-0 text-[#111413]"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M18 3C18.9 11.5 24.5 17.1 33 18C24.5 18.9 18.9 24.5 18 33C17.1 24.5 11.5 18.9 3 18C11.5 17.1 17.1 11.5 18 3Z"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <br />
                  <span>Naturally</span>
                </h1>

                <p className="text-sm sm:text-base text-[#111413]/80 max-w-[440px] leading-relaxed font-medium">
                  Paste one link and let AuraSMM drip-feed views, likes, and saves across realistic multi-hour human waves—so algorithms push your content instead of flagging it.
                </p>

                {/* Primary CTA + Curved Black Loop Arrow */}
                <div className="relative pt-2 flex flex-col items-start gap-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <Link
                      href="/signup"
                      className="inline-flex items-center gap-2.5 px-7 py-4 rounded-xl bg-[#111413] hover:bg-[#1B201E] text-white text-sm font-bold shadow-[0_14px_30px_-10px_rgba(17,20,19,0.4)] transition-transform active:scale-[0.98]"
                    >
                      <img
                        src="/brand/logos/mark-on-dark.svg"
                        alt=""
                        aria-hidden="true"
                        className="w-4 h-4"
                      />
                      <span>Start Growing Free</span>
                    </Link>
                  </div>

                  <Link
                    href="#what-it-does"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#111413]/85 hover:text-[#111413] transition-colors"
                  >
                    <span>See how it works</span>
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Link>

                  {/* Iconic curved black doodle arrow pointing to CTA (frame_001) */}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 180 120"
                    className="hidden xl:block absolute -top-20 left-[295px] w-44 h-28 pointer-events-none text-[#111413]"
                    fill="none"
                  >
                    <path
                      d="M 110 8 C 168 18, 178 72, 132 96 C 110 107, 94 94, 102 80 C 110 66, 128 74, 118 89 C 102 108, 48 92, 14 92"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 24 85 L 12 92 L 24 99"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              {/* Right Interactive Overlapping UI Cards breaking out of bottom-right */}
              <div className="lg:col-span-6 lg:-mb-20">
                <LandingHeroMockups />
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 2: Get the Most Out of Every Post (frame_002 2-card layout) ── */}
        <section id="what-it-does" className="max-w-[1160px] mx-auto px-4 sm:px-8 pt-6 lg:pt-12">
          <div className="max-w-md mb-10">
            <h2 className="text-3xl sm:text-[42px] font-bold tracking-[-0.035em] text-[#111413] leading-[1.08]">
              Get the Most Out of Every Post
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Card: Multi-Wave Drip Delivery */}
            <div className="group relative rounded-[24px] bg-[#F7F6F2] border border-[#E4E0D3]/80 p-8 sm:p-10 min-h-[275px] flex flex-col justify-between overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D4F04F] hover:shadow-[0_18px_40px_-15px_rgba(17,20,19,0.08)]">
              <div className="relative z-10 max-w-[290px] space-y-3">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111413]">
                  Multi-Wave Drip Delivery
                </h3>
                <p className="text-sm text-[#5B625F] leading-relaxed">
                  Instead of blasting 10,000 views in 60 seconds, we break your order into realistic micro-batches over 6 to 72 hours.
                </p>
              </div>

              <div className="relative z-10 pt-8">
                <Link
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#111413] hover:text-[#5E8C1F] transition-colors"
                >
                  <span>How pacing works</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>

              {/* Bottom-Right Abstract Lime + Ink Shapes + Loop Doodle (frame_002) */}
              <svg
                aria-hidden="true"
                viewBox="0 0 210 150"
                className="absolute right-0 bottom-0 w-44 sm:w-52 h-auto pointer-events-none"
                fill="none"
              >
                <path
                  d="M 90 150 L 90 95 C 90 62, 130 30, 175 45 L 210 56 L 210 150 Z"
                  fill="#D4F04F"
                />
                <path
                  d="M 45 150 C 48 112, 74 96, 106 102 C 128 106, 138 128, 136 150 Z"
                  fill="#111413"
                />
                <path
                  d="M 116 68 C 122 52, 146 56, 144 74 C 142 88, 122 86, 132 68 C 140 54, 160 58, 166 72"
                  stroke="#111413"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Right Card: Synchronized Engagement Signals */}
            <div className="group relative rounded-[24px] bg-[#F7F6F2] border border-[#E4E0D3]/80 p-8 sm:p-10 min-h-[275px] flex flex-col justify-between overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D4F04F] hover:shadow-[0_18px_40px_-15px_rgba(17,20,19,0.08)]">
              <div className="relative z-10 max-w-[300px] space-y-3">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111413]">
                  Synchronized Social Signals
                </h3>
                <p className="text-sm text-[#5B625F] leading-relaxed">
                  Views never arrive alone. Likes (3–6%), saves, and shares are staggered naturally behind view waves to trigger explore feeds.
                </p>
              </div>

              <div className="relative z-10 pt-8">
                <Link
                  href="#organic-growth"
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#111413] hover:text-[#5E8C1F] transition-colors"
                >
                  <span>Compare organic curves</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>

              {/* Bottom-Right Segmented Ring + Upward Wave Arrow (frame_002) */}
              <svg
                aria-hidden="true"
                viewBox="0 0 180 150"
                className="absolute right-0 bottom-0 w-40 sm:w-44 h-auto pointer-events-none"
                fill="none"
              >
                {/* Segmented Arcs */}
                <path
                  d="M 38 148 A 66 66 0 0 1 42 74"
                  stroke="#C4552D"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <path
                  d="M 55 58 A 66 66 0 0 1 112 34"
                  stroke="#D4F04F"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <path
                  d="M 132 36 A 66 66 0 0 1 176 92"
                  stroke="#111413"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                {/* Climbing Jagged Organic Arrow inside ring */}
                <path
                  d="M 74 128 L 94 102 L 106 112 L 128 86 L 138 94 L 154 72"
                  stroke="#111413"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M 144 72 L 155 71 L 156 82"
                  stroke="#111413"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </section>

        {/* ── SECTION 3: How Organic Growth Works (frame_003 asymmetric 1/3 + 2/3 grid) ── */}
        <section id="how-it-works" className="max-w-[1160px] mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Left Heading Block */}
            <div className="lg:col-span-4 space-y-4">
              <h2 className="text-3xl sm:text-[42px] font-bold tracking-[-0.035em] text-[#111413] leading-[1.08]">
                How It Grows
              </h2>
              <p className="text-sm sm:text-base text-[#5B625F] leading-relaxed">
                Social algorithms inspect velocity, timing, and engagement ratios. Our mathematical engine balances all four automatically on every order.
              </p>
            </div>

            {/* Right 2x2 Grid with Clean Hairline Dividers & Lime Circle Icons */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 border-t border-[#E4E0D3] sm:border-t-0">
              {/* Item 1 */}
              <div className="py-7 sm:pr-8 sm:pb-9 sm:border-b sm:border-r border-[#E4E0D3]/80 flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-[#D4F04F] text-[#111413] flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div className="space-y-2.5">
                  <h3 className="text-lg font-bold text-[#111413]">1. Circadian Timing</h3>
                  <p className="text-xs sm:text-sm text-[#5B625F] leading-relaxed">
                    Delivery speeds up during active daytime and evening hours and rests overnight—matching real human scroll habits.
                  </p>
                  <Link
                    href="/signup"
                    className="inline-block px-3.5 py-1.5 rounded-lg bg-[#F7F6F2] hover:bg-[#F3F1EA] text-[11px] font-semibold text-[#111413] transition-colors"
                  >
                    24h Human Rhythm
                  </Link>
                </div>
              </div>

              {/* Item 2 */}
              <div className="py-7 sm:pl-8 sm:pb-9 border-t sm:border-t-0 sm:border-b border-[#E4E0D3]/80 flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-[#D4F04F] text-[#111413] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div className="space-y-2.5">
                  <h3 className="text-lg font-bold text-[#111413]">2. Anti-Spike Shield</h3>
                  <p className="text-xs sm:text-sm text-[#5B625F] leading-relaxed">
                    Strict per-minute velocity limits stop sudden vertical spikes that get accounts shadowbanned on TikTok or Reels.
                  </p>
                  <Link
                    href="#organic-growth"
                    className="inline-block px-3.5 py-1.5 rounded-lg bg-[#F7F6F2] hover:bg-[#F3F1EA] text-[11px] font-semibold text-[#111413] transition-colors"
                  >
                    Zero Bot Flags
                  </Link>
                </div>
              </div>

              {/* Item 3 */}
              <div className="py-7 sm:pr-8 sm:pt-9 border-t sm:border-t-0 sm:border-r border-[#E4E0D3]/80 flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-[#D4F04F] text-[#111413] flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div className="space-y-2.5">
                  <h3 className="text-lg font-bold text-[#111413]">3. Views-First Ratios</h3>
                  <p className="text-xs sm:text-sm text-[#5B625F] leading-relaxed">
                    Likes (3–6%), saves (0.8%), and shares only land after views build up, preserving believable engagement signals.
                  </p>
                  <Link
                    href="/pricing"
                    className="inline-block px-3.5 py-1.5 rounded-lg bg-[#F7F6F2] hover:bg-[#F3F1EA] text-[11px] font-semibold text-[#111413] transition-colors"
                  >
                    Explore Ratios
                  </Link>
                </div>
              </div>

              {/* Item 4 */}
              <div className="py-7 sm:pl-8 sm:pt-9 border-t sm:border-t-0 border-[#E4E0D3]/80 flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-[#D4F04F] text-[#111413] flex items-center justify-center shrink-0">
                  <Eye className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div className="space-y-2.5">
                  <h3 className="text-lg font-bold text-[#111413]">4. Preview Before Pay</h3>
                  <p className="text-xs sm:text-sm text-[#5B625F] leading-relaxed">
                    Inspect every scheduled micro-batch and chart curve before launching—and pause or adjust campaigns live.
                  </p>
                  <Link
                    href="/signup"
                    className="inline-block px-3.5 py-1.5 rounded-lg bg-[#F7F6F2] hover:bg-[#F3F1EA] text-[11px] font-semibold text-[#111413] transition-colors"
                  >
                    Start Free
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTIONS 4 & 5: Platforms, Dark Control Banner & Real-Time Curves ── */}
        <LandingOrganicShowcase />

        {/* ── SECTION 6: Final Clean CTA (frame_007 style) ── */}
        <section className="max-w-[960px] mx-auto px-4 sm:px-8 text-center pt-4">
          {/* Flowing curved line connector */}
          <div className="flex justify-center mb-6">
            <svg
              aria-hidden="true"
              viewBox="0 0 120 75"
              className="w-24 h-16 text-[#111413]"
              fill="none"
            >
              <path
                d="M 88 2 C 110 28, 86 44, 64 42 C 42 40, 32 56, 20 72"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <h2 className="text-3xl sm:text-[48px] font-bold tracking-[-0.04em] text-[#111413] leading-[1.06] max-w-xl mx-auto">
            Create Your Free Account and Start Growing
          </h2>
          <p className="text-sm sm:text-base text-[#5B625F] mt-4 max-w-md mx-auto leading-relaxed">
            Set up your first natural pacing campaign in under 60 seconds. No subscriptions or hidden markups.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2.5 px-7 py-4 rounded-xl bg-[#111413] hover:bg-[#1B201E] text-white text-sm font-bold shadow-[0_14px_28px_-10px_rgba(17,20,19,0.35)] transition-transform active:scale-[0.98]"
            >
              <img
                src="/brand/logos/mark-on-dark.svg"
                alt=""
                aria-hidden="true"
                className="w-4 h-4"
              />
              <span>Create Free Account</span>
            </Link>
            <Link
              href="/pricing"
              className="px-6 py-4 rounded-xl bg-[#F7F6F2] hover:bg-[#F3F1EA] border border-[#E4E0D3] text-[#111413] text-sm font-bold transition-colors"
            >
              View Pricing
            </Link>
          </div>
        </section>
      </main>

      {/* ── DARK INK FOOTER (frame_007 style with official brand lockup) ── */}
      <footer className="bg-[#111413] text-white pt-16 pb-12 border-t border-[#222826]">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-14 border-b border-[#222826]">
            {/* Brand Lockup Column */}
            <div className="md:col-span-4 space-y-4">
              <Link href="/" aria-label="AuraSMM Home" className="inline-block">
                <Image
                  src="/brand/logos/lockup-horizontal-on-dark.svg"
                  alt="AuraSMM"
                  width={154}
                  height={40}
                  className="h-9 w-auto"
                />
              </Link>
              <p className="text-xs text-[#9AA39F] max-w-xs leading-relaxed">
                Minimalist SMM Panel & Organic Growth Planner. Mathematical circadian pacing for real creator momentum.
              </p>
            </div>

            {/* Platform Links */}
            <div className="md:col-span-2 space-y-3 text-xs">
              <div className="font-bold text-white uppercase tracking-wider text-[11px]">
                Platform
              </div>
              <ul className="space-y-2.5 text-[#9AA39F]">
                <li>
                  <Link href="#what-it-does" className="hover:text-[#D4F04F] transition-colors">
                    What it Does
                  </Link>
                </li>
                <li>
                  <Link href="#how-it-works" className="hover:text-[#D4F04F] transition-colors">
                    How it Grows
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-[#D4F04F] transition-colors">
                    Services & Rates
                  </Link>
                </li>
                <li>
                  <Link href="/api-docs" className="hover:text-[#D4F04F] transition-colors">
                    Developer API v2
                  </Link>
                </li>
              </ul>
            </div>

            {/* Account Links */}
            <div className="md:col-span-2 space-y-3 text-xs">
              <div className="font-bold text-white uppercase tracking-wider text-[11px]">
                Account
              </div>
              <ul className="space-y-2.5 text-[#9AA39F]">
                <li>
                  <Link href="/login" className="hover:text-[#D4F04F] transition-colors">
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className="hover:text-[#D4F04F] transition-colors">
                    Create Account
                  </Link>
                </li>
                <li>
                  <Link href="/engagement" className="hover:text-[#D4F04F] transition-colors">
                    Growth Planner
                  </Link>
                </li>
                <li>
                  <Link href="/wallet" className="hover:text-[#D4F04F] transition-colors">
                    Add Funds
                  </Link>
                </li>
              </ul>
            </div>

            {/* Quick Start Pill Box matching frame_007 */}
            <div className="md:col-span-4 space-y-3">
              <div className="font-bold text-white text-xs">
                Quick Launch Your First Wave
              </div>
              <form
                onSubmit={handleQuickStart}
                className="flex items-center p-1.5 rounded-xl border border-[#222826] bg-[#1B201E] focus-within:border-[#D4F04F]/60 transition-colors"
              >
                <input
                  type="text"
                  value={quickHandle}
                  onChange={(e) => setQuickHandle(e.target.value)}
                  placeholder="Your @handle or email..."
                  aria-label="Enter handle or email to get started"
                  className="flex-1 bg-transparent px-3 py-2 text-xs text-white placeholder-[#9AA39F]/70 outline-none"
                />
                <button
                  type="submit"
                  aria-label="Continue to sign up"
                  className="w-9 h-9 rounded-lg bg-[#D4F04F] hover:bg-[#C5E23A] text-[#111413] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
              <p className="text-[11px] text-[#9AA39F]">
                No subscription required. Preview organic wave curves before paying.
              </p>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#9AA39F]">
            <div className="flex items-center gap-2">
              <img
                src="/brand/logos/mark-on-dark.svg"
                alt=""
                aria-hidden="true"
                className="w-4 h-4"
              />
              <span>© 2026 AuraSMM. Minimalist Panel & Growth Planner.</span>
            </div>
            <span>Mathematical organic pacing • TikTok · Instagram · YouTube · X</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

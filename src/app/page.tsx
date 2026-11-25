"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, MotionConfig } from "motion/react";
import { toast } from "sonner";
import { ArrowDown, ArrowRight, ShieldCheck, Clock, Layers, Eye } from "lucide-react";
import { LandingHeroMockups } from "@/components/landing/LandingHeroMockups";
import { LandingOrganicShowcase } from "@/components/landing/LandingOrganicShowcase";
import { EASE_OUT, SPRING_GENTLE, VIEWPORT_ONCE, smoothScrollTo } from "@/components/landing/motionTokens";

const HOW_IT_GROWS_ITEMS = [
  {
    icon: Clock,
    title: "1. Circadian Timing",
    description:
      "Delivery speeds up during active daytime and evening hours and rests overnight—matching real human scroll habits.",
    badge: "24h Human Rhythm",
    href: "/signup",
    delay: 0,
  },
  {
    icon: ShieldCheck,
    title: "2. Anti-Spike Shield",
    description:
      "Strict per-minute velocity limits stop sudden vertical spikes that get accounts shadowbanned on TikTok or Reels.",
    badge: "Zero Bot Flags",
    href: "#organic-growth",
    delay: 0.065,
  },
  {
    icon: Layers,
    title: "3. Views-First Ratios",
    description:
      "Likes (3–6%), saves (0.8%), and shares only land after views build up, preserving believable engagement signals.",
    badge: "Explore Ratios",
    href: "/pricing",
    delay: 0.12,
  },
  {
    icon: Eye,
    title: "4. Preview Before Pay",
    description:
      "Inspect every scheduled micro-batch and chart curve before launching—and pause or adjust campaigns live.",
    badge: "Start Free",
    href: "/signup",
    delay: 0.165,
  },
];

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
    const trimmed = quickHandle.trim();
    if (trimmed) {
      toast.success(`Opening signup for ${trimmed}`, {
        description: "Pre-filling your AuraSMM workspace setup.",
      });
    } else {
      toast("Ready to start your first wave", {
        description: "Create a free account to preview organic pacing curves.",
      });
    }
    router.push("/signup");
  }

  return (
    <MotionConfig reducedMotion="user">
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
              <a
                href="#what-it-does"
                onClick={(e) => smoothScrollTo(e, "#what-it-does")}
                className="hover:text-[#111413] transition-colors cursor-pointer"
              >
                What it Does
              </a>
              <a
                href="#how-it-works"
                onClick={(e) => smoothScrollTo(e, "#how-it-works")}
                className="hover:text-[#111413] transition-colors cursor-pointer"
              >
                How it Grows
              </a>
              <a
                href="#organic-growth"
                onClick={(e) => smoothScrollTo(e, "#organic-growth")}
                className="hover:text-[#111413] transition-colors cursor-pointer"
              >
                Organic Curves
              </a>
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
                  className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-[#111413] hover:bg-[#1B201E] text-white text-xs sm:text-[13px] font-bold transition-transform active:scale-[0.97]"
                >
                  <span>Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#D4F04F]" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-4 py-2.5 rounded-xl bg-[#F7F6F2] hover:bg-[#F3F1EA] active:scale-[0.97] border border-[#E4E0D3]/80 text-[#111413] text-xs sm:text-[13px] font-semibold transition-all"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-[#111413] hover:bg-[#1B201E] text-white text-xs sm:text-[13px] font-bold transition-transform active:scale-[0.97]"
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
          {/* ── HERO: Rounded Lime Showcase Card with Floating App Mockups ── */}
          <section className="max-w-[1200px] mx-auto px-3 sm:px-6 pt-2 sm:pt-4">
            <div className="relative rounded-[28px] sm:rounded-[36px] bg-[#D4F04F] px-6 py-10 sm:px-12 sm:py-14 lg:px-14 lg:py-16">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
                {/* Left Hero Copy (Choreographed Wave: Lead -> Support -> Decorative Stroke) */}
                <div className="lg:col-span-6 relative z-10 space-y-6">
                  <motion.h1
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.56, ease: EASE_OUT }}
                    className="text-[42px] sm:text-[54px] lg:text-[62px] font-bold tracking-[-0.04em] leading-[1.03] text-[#111413]"
                  >
                    <span className="inline-flex items-center gap-3">
                      <span>Grow Social</span>
                      {/* 4-point Sparkle Star settling with headline */}
                      <motion.svg
                        viewBox="0 0 36 36"
                        className="w-7 h-7 sm:w-9 sm:h-9 shrink-0 text-[#111413]"
                        fill="none"
                        aria-hidden="true"
                        initial={{ opacity: 0, scale: 0.92, rotate: -18 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        transition={{ duration: 0.55, delay: 0.22, ease: EASE_OUT }}
                      >
                        <path
                          d="M18 3C18.9 11.5 24.5 17.1 33 18C24.5 18.9 18.9 24.5 18 33C17.1 24.5 11.5 18.9 3 18C11.5 17.1 17.1 11.5 18 3Z"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinejoin="round"
                        />
                      </motion.svg>
                    </span>
                    <br />
                    <span>Naturally</span>
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.52, delay: 0.08, ease: EASE_OUT }}
                    className="text-sm sm:text-base text-[#111413]/80 max-w-[440px] leading-relaxed font-medium"
                  >
                    Paste one link and let AuraSMM drip-feed views, likes, and saves across realistic multi-hour human waves—so algorithms push your content instead of flagging it.
                  </motion.p>

                  {/* Primary CTA + Self-Drawing Loop Arrow */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.48, delay: 0.14, ease: EASE_OUT }}
                    className="relative pt-2 flex flex-col items-start gap-5"
                  >
                    <div className="flex flex-wrap items-center gap-4">
                      <Link
                        href="/signup"
                        className="inline-flex items-center gap-2.5 px-7 py-4 rounded-xl bg-[#111413] hover:bg-[#1B201E] text-white text-sm font-bold shadow-[0_14px_30px_-10px_rgba(17,20,19,0.4)] transition-transform active:scale-[0.97]"
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

                    <a
                      href="#what-it-does"
                      onClick={(e) => smoothScrollTo(e, "#what-it-does")}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#111413]/85 hover:text-[#111413] transition-colors cursor-pointer"
                    >
                      <span>See how it works</span>
                      <ArrowDown className="w-3.5 h-3.5" />
                    </a>

                    {/* Self-drawing curved loop doodle pointing to CTA */}
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 180 120"
                      className="hidden xl:block absolute -top-20 left-[295px] w-44 h-28 pointer-events-none text-[#111413]"
                      fill="none"
                    >
                      <motion.path
                        d="M 110 8 C 168 18, 178 72, 132 96 C 110 107, 94 94, 102 80 C 110 66, 128 74, 118 89 C 102 108, 48 92, 14 92"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ duration: 0.9, delay: 0.28, ease: EASE_OUT }}
                      />
                      <motion.path
                        d="M 24 85 L 12 92 L 24 99"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ duration: 0.25, delay: 1.05, ease: EASE_OUT }}
                      />
                    </svg>
                  </motion.div>
                </div>

                {/* Right Interactive Overlapping UI Cards breaking out of bottom-right */}
                <div className="lg:col-span-6 lg:-mb-20">
                  <LandingHeroMockups />
                </div>
              </div>
            </div>
          </section>

          {/* ── SECTION 2: Get the Most Out of Every Post (In-View Unique Shape & Ring Animations) ── */}
          <section id="what-it-does" className="max-w-[1160px] mx-auto px-4 sm:px-8 pt-6 lg:pt-12 scroll-mt-24">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT_ONCE}
              transition={{ duration: 0.52, ease: EASE_OUT }}
              className="max-w-md mb-10"
            >
              <h2 className="text-3xl sm:text-[42px] font-bold tracking-[-0.035em] text-[#111413] leading-[1.08]">
                Get the Most Out of Every Post
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Card: Multi-Wave Drip Delivery */}
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={VIEWPORT_ONCE}
                transition={{ duration: 0.55, ease: EASE_OUT }}
                whileHover={{ y: -3, transition: SPRING_GENTLE }}
                className="group relative rounded-[24px] bg-[#F7F6F2] border border-[#E4E0D3]/80 p-8 sm:p-10 min-h-[275px] flex flex-col justify-between overflow-hidden hover:border-[#D4F04F] hover:shadow-[0_18px_40px_-15px_rgba(17,20,19,0.08)] transition-colors"
              >
                <div className="relative z-10 max-w-[290px] space-y-3">
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111413]">
                    Multi-Wave Drip Delivery
                  </h3>
                  <p className="text-sm text-[#5B625F] leading-relaxed">
                    Instead of blasting 10,000 views in 60 seconds, we break your order into realistic micro-batches over 6 to 72 hours.
                  </p>
                </div>

                <div className="relative z-10 pt-8">
                  <a
                    href="#how-it-works"
                    onClick={(e) => smoothScrollTo(e, "#how-it-works")}
                    className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#111413] hover:text-[#5E8C1F] transition-colors cursor-pointer"
                  >
                    <span>How pacing works</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </a>
                </div>

                {/* Bottom-Right Abstract Lime + Ink Shapes + Self-Drawing Loop */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 210 150"
                  className="absolute right-0 bottom-0 w-44 sm:w-52 h-auto pointer-events-none"
                  fill="none"
                >
                  <motion.path
                    d="M 90 150 L 90 95 C 90 62, 130 30, 175 45 L 210 56 L 210 150 Z"
                    fill="#D4F04F"
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={VIEWPORT_ONCE}
                    transition={{ duration: 0.6, delay: 0.14, ease: EASE_OUT }}
                  />
                  <motion.path
                    d="M 45 150 C 48 112, 74 96, 106 102 C 128 106, 138 128, 136 150 Z"
                    fill="#111413"
                    initial={{ opacity: 0, y: 22 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={VIEWPORT_ONCE}
                    transition={{ duration: 0.55, delay: 0.22, ease: EASE_OUT }}
                  />
                  <motion.path
                    d="M 116 68 C 122 52, 146 56, 144 74 C 142 88, 122 86, 132 68 C 140 54, 160 58, 166 72"
                    stroke="#111413"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={VIEWPORT_ONCE}
                    transition={{ duration: 0.85, delay: 0.28, ease: EASE_OUT }}
                  />
                </svg>
              </motion.div>

              {/* Right Card: Synchronized Engagement Signals */}
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={VIEWPORT_ONCE}
                transition={{ duration: 0.55, delay: 0.09, ease: EASE_OUT }}
                whileHover={{ y: -3, transition: SPRING_GENTLE }}
                className="group relative rounded-[24px] bg-[#F7F6F2] border border-[#E4E0D3]/80 p-8 sm:p-10 min-h-[275px] flex flex-col justify-between overflow-hidden hover:border-[#D4F04F] hover:shadow-[0_18px_40px_-15px_rgba(17,20,19,0.08)] transition-colors"
              >
                <div className="relative z-10 max-w-[300px] space-y-3">
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111413]">
                    Synchronized Social Signals
                  </h3>
                  <p className="text-sm text-[#5B625F] leading-relaxed">
                    Views never arrive alone. Likes (3–6%), saves, and shares are staggered naturally behind view waves to trigger explore feeds.
                  </p>
                </div>

                <div className="relative z-10 pt-8">
                  <a
                    href="#organic-growth"
                    onClick={(e) => smoothScrollTo(e, "#organic-growth")}
                    className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#111413] hover:text-[#5E8C1F] transition-colors cursor-pointer"
                  >
                    <span>Compare organic curves</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </a>
                </div>

                {/* Bottom-Right Sequential Arcs + Climbing Jagged Arrow */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 180 150"
                  className="absolute right-0 bottom-0 w-40 sm:w-44 h-auto pointer-events-none"
                  fill="none"
                >
                  <motion.path
                    d="M 38 148 A 66 66 0 0 1 42 74"
                    stroke="#C4552D"
                    strokeWidth="12"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={VIEWPORT_ONCE}
                    transition={{ duration: 0.45, delay: 0.18, ease: EASE_OUT }}
                  />
                  <motion.path
                    d="M 55 58 A 66 66 0 0 1 112 34"
                    stroke="#D4F04F"
                    strokeWidth="12"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={VIEWPORT_ONCE}
                    transition={{ duration: 0.45, delay: 0.3, ease: EASE_OUT }}
                  />
                  <motion.path
                    d="M 132 36 A 66 66 0 0 1 176 92"
                    stroke="#111413"
                    strokeWidth="12"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={VIEWPORT_ONCE}
                    transition={{ duration: 0.45, delay: 0.42, ease: EASE_OUT }}
                  />
                  {/* Climbing Jagged Arrow */}
                  <motion.path
                    d="M 74 128 L 94 102 L 106 112 L 128 86 L 138 94 L 154 72"
                    stroke="#111413"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={VIEWPORT_ONCE}
                    transition={{ duration: 0.75, delay: 0.35, ease: EASE_OUT }}
                  />
                  <motion.path
                    d="M 144 72 L 155 71 L 156 82"
                    stroke="#111413"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={VIEWPORT_ONCE}
                    transition={{ duration: 0.2, delay: 0.98, ease: EASE_OUT }}
                  />
                </svg>
              </motion.div>
            </div>
          </section>

          {/* ── SECTION 3: How Organic Growth Works (Non-Uniform Reading Wave) ── */}
          <section id="how-it-works" className="max-w-[1160px] mx-auto px-4 sm:px-8 scroll-mt-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              {/* Left Heading Block */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={VIEWPORT_ONCE}
                transition={{ duration: 0.54, ease: EASE_OUT }}
                className="lg:col-span-4 space-y-4"
              >
                <h2 className="text-3xl sm:text-[42px] font-bold tracking-[-0.035em] text-[#111413] leading-[1.08]">
                  How It Grows
                </h2>
                <p className="text-sm sm:text-base text-[#5B625F] leading-relaxed">
                  Social algorithms inspect velocity, timing, and engagement ratios. Our mathematical engine balances all four automatically on every order.
                </p>
              </motion.div>

              {/* Right 2x2 Grid with Clean Hairline Dividers & Staggered Lime Circle Pops */}
              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 border-t border-[#E4E0D3] sm:border-t-0">
                {HOW_IT_GROWS_ITEMS.map((item, idx) => {
                  const Icon = item.icon;
                  const borderClasses =
                    idx === 0
                      ? "py-7 sm:pr-8 sm:pb-9 sm:border-b sm:border-r border-[#E4E0D3]/80"
                      : idx === 1
                      ? "py-7 sm:pl-8 sm:pb-9 border-t sm:border-t-0 sm:border-b border-[#E4E0D3]/80"
                      : idx === 2
                      ? "py-7 sm:pr-8 sm:pt-9 border-t sm:border-t-0 sm:border-r border-[#E4E0D3]/80"
                      : "py-7 sm:pl-8 sm:pt-9 border-t sm:border-t-0 border-[#E4E0D3]/80";

                  return (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, y: 14 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={VIEWPORT_ONCE}
                      transition={{ duration: 0.48, delay: item.delay, ease: EASE_OUT }}
                      className={`${borderClasses} flex gap-4 items-start`}
                    >
                      <motion.div
                        initial={{ scale: 0.9 }}
                        whileInView={{ scale: 1 }}
                        viewport={VIEWPORT_ONCE}
                        transition={{
                          ...SPRING_GENTLE,
                          delay: item.delay + 0.08,
                        }}
                        className="w-10 h-10 rounded-full bg-[#D4F04F] text-[#111413] flex items-center justify-center shrink-0"
                      >
                        <Icon className="w-4 h-4 stroke-[2.2]" />
                      </motion.div>
                      <div className="space-y-2.5">
                        <h3 className="text-lg font-bold text-[#111413]">{item.title}</h3>
                        <p className="text-xs sm:text-sm text-[#5B625F] leading-relaxed">
                          {item.description}
                        </p>
                        {item.href.startsWith("#") ? (
                          <a
                            href={item.href}
                            onClick={(e) => smoothScrollTo(e, item.href)}
                            className="inline-block px-3.5 py-1.5 rounded-lg bg-[#F7F6F2] hover:bg-[#F3F1EA] active:scale-[0.97] text-[11px] font-semibold text-[#111413] transition-all cursor-pointer"
                          >
                            {item.badge}
                          </a>
                        ) : (
                          <Link
                            href={item.href}
                            className="inline-block px-3.5 py-1.5 rounded-lg bg-[#F7F6F2] hover:bg-[#F3F1EA] active:scale-[0.97] text-[11px] font-semibold text-[#111413] transition-all"
                          >
                            {item.badge}
                          </Link>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ── SECTIONS 4 & 5: Platforms, Dark Control Banner & Real-Time Curves ── */}
          <LandingOrganicShowcase />

          {/* ── SECTION 6: Final Clean CTA with Flowing Connector Draw ── */}
          <section className="max-w-[960px] mx-auto px-4 sm:px-8 text-center pt-4">
            <div className="flex justify-center mb-6">
              <svg
                aria-hidden="true"
                viewBox="0 0 120 75"
                className="w-24 h-16 text-[#111413]"
                fill="none"
              >
                <motion.path
                  d="M 88 2 C 110 28, 86 44, 64 42 C 42 40, 32 56, 20 72"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={VIEWPORT_ONCE}
                  transition={{ duration: 0.85, ease: EASE_OUT }}
                />
              </svg>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={VIEWPORT_ONCE}
              transition={{ duration: 0.56, delay: 0.1, ease: EASE_OUT }}
            >
              <h2 className="text-3xl sm:text-[48px] font-bold tracking-[-0.04em] text-[#111413] leading-[1.06] max-w-xl mx-auto">
                Create Your Free Account and Start Growing
              </h2>
              <p className="text-sm sm:text-base text-[#5B625F] mt-4 max-w-md mx-auto leading-relaxed">
                Set up your first natural pacing campaign in under 60 seconds. No subscriptions or hidden markups.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2.5 px-7 py-4 rounded-xl bg-[#111413] hover:bg-[#1B201E] text-white text-sm font-bold shadow-[0_14px_28px_-10px_rgba(17,20,19,0.35)] transition-transform active:scale-[0.97]"
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
                  className="px-6 py-4 rounded-xl bg-[#F7F6F2] hover:bg-[#F3F1EA] active:scale-[0.97] border border-[#E4E0D3] text-[#111413] text-sm font-bold transition-all"
                >
                  View Pricing
                </Link>
              </div>
            </motion.div>
          </section>
        </main>

        {/* ── DARK INK FOOTER ── */}
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
                    <a
                      href="#what-it-does"
                      onClick={(e) => smoothScrollTo(e, "#what-it-does")}
                      className="hover:text-[#D4F04F] transition-colors cursor-pointer"
                    >
                      What it Does
                    </a>
                  </li>
                  <li>
                    <a
                      href="#how-it-works"
                      onClick={(e) => smoothScrollTo(e, "#how-it-works")}
                      className="hover:text-[#D4F04F] transition-colors cursor-pointer"
                    >
                      How it Grows
                    </a>
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

              {/* Quick Start Pill Box */}
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
                    className="w-9 h-9 rounded-lg bg-[#D4F04F] hover:bg-[#C5E23A] active:scale-[0.95] text-[#111413] flex items-center justify-center shrink-0 transition-transform cursor-pointer"
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
    </MotionConfig>
  );
}

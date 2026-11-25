"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, ShieldCheck } from "lucide-react";

interface PaymentSuccessCelebrationProps {
  creditedInr: number;
  newBalance: number;
  orderId?: string | null;
  alreadyCredited?: boolean;
  redirectSeconds?: number;
}

const CONFETTI_PIECES = [
  { x: -120, y: -96, rotate: -45, color: "#D4F04F", w: 10, h: 6, delay: 0.04 },
  { x: -84, y: -124, rotate: 28, color: "#5E8C1F", w: 8, h: 8, delay: 0.06 },
  { x: -42, y: -138, rotate: -20, color: "#111413", w: 12, h: 5, delay: 0.08 },
  { x: 0, y: -146, rotate: 60, color: "#E0A030", w: 9, h: 9, delay: 0.05 },
  { x: 46, y: -134, rotate: -55, color: "#D4F04F", w: 12, h: 6, delay: 0.07 },
  { x: 92, y: -118, rotate: 42, color: "#C4552D", w: 8, h: 8, delay: 0.09 },
  { x: 124, y: -86, rotate: 75, color: "#229ED9", w: 10, h: 5, delay: 0.06 },
  { x: -138, y: -44, rotate: -70, color: "#E0A030", w: 8, h: 8, delay: 0.1 },
  { x: 138, y: -38, rotate: 35, color: "#5E8C1F", w: 11, h: 6, delay: 0.11 },
  { x: -102, y: -62, rotate: 18, color: "#C4552D", w: 7, h: 7, delay: 0.12 },
  { x: 105, y: -64, rotate: -32, color: "#D4F04F", w: 9, h: 5, delay: 0.09 },
  { x: -18, y: -112, rotate: 48, color: "#229ED9", w: 7, h: 7, delay: 0.13 },
];

export function PaymentSuccessCelebration({
  creditedInr,
  newBalance,
  orderId,
  alreadyCredited = false,
  redirectSeconds = 3,
}: PaymentSuccessCelebrationProps) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(redirectSeconds);

  useEffect(() => {
    const countdownTimer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);

    const redirectTimer = setTimeout(() => {
      router.push("/engagement");
      router.refresh();
    }, redirectSeconds * 1000);

    return () => {
      clearInterval(countdownTimer);
      clearTimeout(redirectTimer);
    };
  }, [router, redirectSeconds]);

  return (
    <div className="relative py-8 sm:py-12 px-4 text-center overflow-hidden">
      {/* Confetti Popper Burst Layer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 w-0 h-0 z-10"
      >
        {CONFETTI_PIECES.map((piece, idx) => (
          <motion.span
            key={idx}
            initial={{ opacity: 0, x: 0, y: 16, scale: 0.6, rotate: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: piece.x,
              y: [16, piece.y, piece.y + 42],
              scale: [0.7, 1.08, 0.9],
              rotate: piece.rotate,
            }}
            transition={{
              duration: 1.45,
              delay: piece.delay,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{
              width: piece.w,
              height: piece.h,
              backgroundColor: piece.color,
            }}
            className="absolute block rounded-[2px]"
          />
        ))}
      </div>

      {/* Center Badges: Animated Tick Sign + Party Popper Accent */}
      <div className="relative z-20 flex flex-col items-center">
        <div className="relative flex items-center justify-center mb-6">
          {/* Soft Lime Halo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="absolute -inset-4 rounded-full bg-[#D4F04F]/35 blur-xl"
          />

          {/* Main Tick Circle */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", duration: 0.55, bounce: 0.25 }}
            className="relative w-20 h-20 rounded-full bg-[#111413] border-4 border-[#D4F04F] shadow-[0_18px_40px_-10px_rgba(17,20,19,0.28)] flex items-center justify-center"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-9 h-9 text-[#D4F04F]"
              fill="none"
              aria-hidden="true"
            >
              <motion.path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.48, delay: 0.14, ease: [0.23, 1, 0.32, 1] }}
              />
            </svg>
          </motion.div>

          {/* Party Popper Icon Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotate: -20, x: -8, y: 8 }}
            animate={{ opacity: 1, scale: 1, rotate: 12, x: 0, y: 0 }}
            transition={{ type: "spring", duration: 0.6, delay: 0.2, bounce: 0.3 }}
            className="absolute -right-4 -top-2 w-9 h-9 rounded-2xl bg-[#D4F04F] border-2 border-white shadow-md flex items-center justify-center"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
              <path
                d="M4 20l4.5-10.5L14.5 15.5 4 20z"
                fill="#111413"
                stroke="#111413"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M12 7c.5-1.5 2-2.5 3.5-2.5M17 11c1.5-.5 2.5-2 2.5-3.5M14.5 9.5l3-3"
                stroke="#C4552D"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </motion.div>
        </div>

        {/* Exact Completion Copy */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.18, ease: [0.23, 1, 0.32, 1] }}
          className="space-y-2 max-w-md mx-auto"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EEF6EC] border border-[#5E8C1F]/25 text-[#5E8C1F] text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{alreadyCredited ? "Already Verified" : "Binance Pay Verified"}</span>
          </span>

          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111413] pt-1">
            Your Transaction Is Completed
          </h2>
          <p className="text-sm text-[#5B625F]">
            {alreadyCredited
              ? "This Order ID was already verified once. Redirecting you to the Panel..."
              : "Redirecting you to the Panel..."}
          </p>
        </motion.div>

        {/* Balance Confirmation Card */}
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.48, delay: 0.28, ease: [0.23, 1, 0.32, 1] }}
          className="mt-6 w-full max-w-sm rounded-2xl bg-[#F7F6F2] border border-[#E4E0D3] p-4 space-y-2.5"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#5B625F] font-medium">
              {alreadyCredited ? "Verified Amount" : "Amount Added"}
            </span>
            <span className="font-mono font-bold text-[#5E8C1F]">
              {alreadyCredited ? `₹${creditedInr.toFixed(2)}` : `+₹${creditedInr.toFixed(2)} INR`}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs border-t border-[#E4E0D3]/80 pt-2.5">
            <span className="text-[#5B625F] font-medium">Current Wallet Balance</span>
            <span className="font-mono text-base font-black text-[#111413]">
              ₹{newBalance.toFixed(2)}
            </span>
          </div>
          {orderId && (
            <div className="flex items-center justify-between text-[11px] border-t border-[#E4E0D3]/80 pt-2 text-[#5B625F]">
              <span>Order ID</span>
              <span className="font-mono font-semibold text-[#111413] truncate max-w-[190px]">
                {orderId}
              </span>
            </div>
          )}
        </motion.div>

        {/* Smooth Auto-Redirect Progress Track + Manual Action */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="mt-6 w-full max-w-sm space-y-3"
        >
          <div className="w-full h-1.5 rounded-full bg-[#E4E0D3] overflow-hidden">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: redirectSeconds, ease: "linear" }}
              style={{ originX: 0 }}
              className="h-full bg-[#111413] rounded-full"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#5B625F]">
            <span>Taking you to Engagement Panel in {secondsLeft}s…</span>
          </div>

          <Link
            href="/engagement"
            className="w-full py-3.5 px-5 rounded-xl bg-[#D4F04F] hover:bg-[#C5E23A] active:scale-[0.98] text-[#111413] text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <span>Go to Panel Now</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

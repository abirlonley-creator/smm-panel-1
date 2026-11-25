"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  ShieldCheck,
  AlertCircle,
  Send,
  Wallet,
} from "lucide-react";
import { PaymentSuccessCelebration } from "@/components/wallet/PaymentSuccessCelebration";

const PRESET_AMOUNTS = [100, 250, 500, 1000, 2500];

export default function DedicatedPaymentPage() {
  const [step, setStep] = useState<"pay" | "verify" | "success">("pay");

  // Wallet & config
  const [inrAmount, setInrAmount] = useState<number>(200);
  const [exchangeRate, setExchangeRate] = useState<number>(90.0);
  const [binanceUid, setBinanceUid] = useState<string>("1161493552");
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [apiConfigured, setApiConfigured] = useState<boolean>(true);
  const [loadingConfig, setLoadingConfig] = useState<boolean>(true);

  // Created/Resumed deposit
  const [deposit, setDeposit] = useState<any>(null);
  const [creatingDeposit, setCreatingDeposit] = useState(false);

  // Verify form
  const [txnId, setTxnId] = useState("");
  const [senderBinanceId, setSenderBinanceId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyAttempt, setVerifyAttempt] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Success state
  const [creditedInr, setCreditedInr] = useState<number>(200);
  const [newBalance, setNewBalance] = useState<number>(0);
  const [alreadyCredited, setAlreadyCredited] = useState<boolean>(false);

  // Copy states
  const [copiedUid, setCopiedUid] = useState(false);
  const [copiedUsdt, setCopiedUsdt] = useState(false);

  const usdtAmount = Number((inrAmount / (exchangeRate || 90)).toFixed(2));

  useEffect(() => {
    // Parse optional ?amount=... and ?depositId=... safely on client mount
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const qAmt = Number(params.get("amount"));
      const qDepId = params.get("depositId");
      if (Number.isFinite(qAmt) && qAmt >= 50) {
        setInrAmount(Math.round(qAmt));
      }
      if (qDepId) {
        setDeposit({ id: qDepId });
        setStep("verify");
      }
    }

    async function loadPaymentSetup() {
      try {
        const [depRes, walRes] = await Promise.all([
          fetch("/api/wallet/deposit", { cache: "no-store" }),
          fetch("/api/wallet", { cache: "no-store" }),
        ]);
        const depData = await depRes.json().catch(() => null);
        const walData = await walRes.json().catch(() => null);

        if (depData?.success && depData.config) {
          if (depData.config.exchangeRate) setExchangeRate(depData.config.exchangeRate);
          if (depData.config.binanceUid) setBinanceUid(depData.config.binanceUid);
          setApiConfigured(Boolean(depData.config.isApiConfigured));
        }
        if (walData?.success && typeof walData.wallet?.balance === "number") {
          setCurrentBalance(walData.wallet.balance);
        }
      } catch {
        // fallback defaults remain active
      } finally {
        setLoadingConfig(false);
      }
    }

    loadPaymentSetup();
  }, []);

  function copyValue(val: string, kind: "uid" | "usdt") {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(val);
      if (kind === "uid") {
        setCopiedUid(true);
        toast.success("Copied Binance Pay ID", { description: val });
        setTimeout(() => setCopiedUid(false), 1800);
      } else {
        setCopiedUsdt(true);
        toast.success("Copied exact USDT amount", { description: `${val} USDT` });
        setTimeout(() => setCopiedUsdt(false), 1800);
      }
    }
  }

  async function handleProceedToVerify(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!inrAmount || inrAmount < 50) {
      setErrorMessage("Minimum deposit amount is ₹50.");
      return;
    }

    setCreatingDeposit(true);
    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inrAmount }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not create deposit order.");
      }

      setDeposit(data.deposit);
      if (data.deposit.binanceUid) setBinanceUid(data.deposit.binanceUid);
      if (data.deposit.exchangeRate) setExchangeRate(data.deposit.exchangeRate);
      setStep("verify");
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to initiate payment.");
    } finally {
      setCreatingDeposit(false);
    }
  }

  async function handleVerifyOrder(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const cleanedInput = txnId.trim();
    if (!cleanedInput) {
      setErrorMessage("Please enter your Binance Order ID.");
      return;
    }

    const MAX_ATTEMPTS = 3;
    const RETRY_DELAY_MS = 3500;

    setVerifying(true);
    try {
      let lastData: any = null;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        setVerifyAttempt(attempt);

        const res = await fetch("/api/wallet/deposit/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            depositId: deposit?.id,
            txnId: cleanedInput,
            senderBinanceId: senderBinanceId.trim() || undefined,
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "Payment verification failed.");
        }

        lastData = data;

        if (data?.success) {
          const verifiedAmt =
            typeof data.deposit?.inrAmount === "number" ? data.deposit.inrAmount : inrAmount;
          const updatedBal =
            typeof data.newBalance === "number" ? data.newBalance : currentBalance;

          setCreditedInr(verifiedAmt);
          setNewBalance(updatedBal);
          setAlreadyCredited(Boolean(data.alreadyCredited));

          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("balance-updated"));
          }

          if (data.alreadyCredited) {
            toast("Payment already verified", {
              description: "No duplicate credit was added to your balance.",
            });
          } else {
            toast.success(`₹${verifiedAmt.toFixed(2)} credited!`, {
              description: "Your Transaction Is Completed.",
            });
          }

          setStep("success");
          return;
        }

        const retryable =
          data?.autoVerifyStatus === "NOT_FOUND" || data?.autoVerifyStatus === "API_ERROR";
        if (!retryable || attempt === MAX_ATTEMPTS) break;

        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }

      setErrorMessage(
        lastData?.error ||
          "Order ID not found yet on Binance. If you just paid, wait 30 seconds and click Verify again."
      );
    } catch (err: any) {
      setErrorMessage(err?.message || "Verification failed. Please try again.");
    } finally {
      setVerifying(false);
      setVerifyAttempt(0);
    }
  }

  return (
    <div className="max-w-3xl mx-auto pb-16 space-y-6 animate-fadeIn">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E4E0D3]">
        <Link
          href="/wallet"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#5B625F] hover:text-[#111413] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Wallet</span>
        </Link>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#E4E0D3] text-[11px] font-semibold text-[#5E8C1F]">
          <Lock className="w-3.5 h-3.5" />
          <span>Single-Claim Verified Checkout</span>
        </div>
      </div>

      {/* Main Checkout Card */}
      <div className="bg-white rounded-[28px] border border-[#E4E0D3] shadow-[0_16px_44px_-16px_rgba(17,20,19,0.08)] overflow-hidden">
        {/* Card Header & Step Indicator */}
        {step !== "success" && (
          <div className="px-6 sm:px-8 py-5 border-b border-[#E4E0D3] bg-[#FAF9F5] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#111413] text-[#D4F04F] flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-[#111413]">
                  Binance Pay Secure Deposit
                </h1>
                <p className="text-xs text-[#5B625F]">
                  Current Balance:{" "}
                  <span className="font-mono font-bold text-[#111413]">
                    {loadingConfig ? "..." : `₹${currentBalance.toFixed(2)}`}
                  </span>
                </p>
              </div>
            </div>

            {/* Crisp 2-Step Pill */}
            <div className="flex items-center gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => step === "verify" && setStep("pay")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
                  step === "pay"
                    ? "bg-[#111413] text-[#D4F04F]"
                    : "bg-[#EEF6EC] text-[#5E8C1F]"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-current/15 flex items-center justify-center text-[10px]">
                  {step === "verify" ? "✓" : "1"}
                </span>
                <span>Send USDT</span>
              </button>

              <span className="w-4 h-[1px] bg-[#E4E0D3]" />

              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
                  step === "verify"
                    ? "bg-[#111413] text-[#D4F04F]"
                    : "bg-[#F3F1EA] text-[#5B625F]"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-current/15 flex items-center justify-center text-[10px]">
                  2
                </span>
                <span>Verify Order ID</span>
              </span>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-6 sm:p-8">
          <AnimatePresence mode="wait">
            {step === "pay" && (
              <motion.form
                key="pay-step"
                onSubmit={handleProceedToVerify}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
                className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start"
              >
                {/* Left Column: Amount & Action */}
                <div className="md:col-span-7 space-y-6">
                  {/* Amount Picker */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#5B625F]">
                        Deposit Amount (INR)
                      </label>
                      <span className="text-[11px] font-mono font-semibold text-[#5B625F]">
                        1 USDT = ₹{exchangeRate.toFixed(2)}
                      </span>
                    </div>

                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-[#5B625F]">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="50"
                        max="100000"
                        step="1"
                        required
                        value={inrAmount || ""}
                        onChange={(e) => setInrAmount(Number(e.target.value))}
                        placeholder="200"
                        className="w-full pl-9 pr-28 py-3.5 rounded-2xl border border-[#E4E0D3] bg-[#FAF9F5] focus:bg-white focus:border-[#111413] text-lg font-black text-[#111413] outline-none transition-colors font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => copyValue(usdtAmount.toFixed(2), "usdt")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-white border border-[#E4E0D3] hover:border-[#111413] text-xs font-mono font-bold text-[#111413] flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span>{usdtAmount.toFixed(2)} USDT</span>
                        {copiedUsdt ? (
                          <Check className="w-3 h-3 text-[#5E8C1F]" />
                        ) : (
                          <Copy className="w-3 h-3 text-[#5B625F]" />
                        )}
                      </button>
                    </div>

                    {/* Preset Pills */}
                    <div className="flex flex-wrap gap-2">
                      {PRESET_AMOUNTS.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setInrAmount(amt)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                            inrAmount === amt
                              ? "bg-[#111413] text-[#D4F04F]"
                              : "bg-[#F3F1EA] text-[#5B625F] hover:text-[#111413]"
                          }`}
                        >
                          ₹{amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recipient Binance Pay ID */}
                  <div className="p-4 rounded-2xl bg-[#F7F6F2] border border-[#E4E0D3] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B625F]">
                        Official Binance Pay ID
                      </span>
                      <span className="text-[11px] font-semibold text-[#5E8C1F]">
                        Send USDT (Zero Fee)
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 bg-white rounded-xl border border-[#E4E0D3] px-3.5 py-2.5">
                      <span className="font-mono text-base font-black text-[#111413] tracking-tight">
                        {binanceUid}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyValue(binanceUid, "uid")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F3F1EA] hover:bg-[#E4E0D3] text-xs font-bold text-[#111413] transition-colors cursor-pointer"
                      >
                        {copiedUid ? (
                          <Check className="w-3.5 h-3.5 text-[#5E8C1F]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-[#5B625F]" />
                        )}
                        <span>{copiedUid ? "Copied" : "Copy ID"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Clean Trust Steps */}
                  <div className="space-y-2 text-xs text-[#5B625F] leading-relaxed">
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#111413] text-[#D4F04F] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </span>
                      <span>
                        Open Binance App and send{" "}
                        <strong className="text-[#111413] font-mono">
                          {usdtAmount.toFixed(2)} USDT
                        </strong>{" "}
                        via Pay to ID{" "}
                        <strong className="text-[#111413] font-mono">{binanceUid}</strong> (or scan the QR).
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#111413] text-[#D4F04F] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </span>
                      <span>
                        Once sent, click below to paste your Binance Order ID for instant auto-credit.
                      </span>
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="p-3.5 rounded-2xl bg-[#FDF2EF] border border-[#C4552D]/30 text-xs font-semibold text-[#C4552D] flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={creatingDeposit || inrAmount < 50}
                    className="w-full py-4 px-6 rounded-2xl bg-[#D4F04F] hover:bg-[#C5E23A] active:scale-[0.98] disabled:opacity-50 text-[#111413] text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                  >
                    {creatingDeposit ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating Checkout Reference…</span>
                      </>
                    ) : (
                      <>
                        <span>I&apos;ve Paid — Verify Order ID</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                {/* Right Column: Official QR Code Card */}
                <div className="md:col-span-5 flex flex-col items-center p-6 rounded-2xl bg-[#FAF9F5] border border-[#E4E0D3] text-center space-y-4">
                  <div className="text-xs font-bold text-[#111413]">
                    Scan with Binance App
                  </div>

                  <a
                    href="https://app.binance.com/uni-qr/Dqvi2v2V"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 bg-white rounded-2xl border border-[#E4E0D3] shadow-sm hover:border-[#111413] transition-colors"
                  >
                    <img
                      src="/binance-pay-qr.png"
                      alt="Official Binance Pay QR Code"
                      width={196}
                      height={196}
                      className="w-44 h-44 sm:w-48 sm:h-48 object-contain rounded-xl"
                    />
                  </a>

                  <div className="space-y-1">
                    <div className="text-xl font-black font-mono text-[#111413]">
                      {usdtAmount.toFixed(2)} USDT
                    </div>
                    <div className="text-[11px] text-[#5B625F]">
                      Credits ≈ ₹{inrAmount.toFixed(2)} INR
                    </div>
                  </div>

                  <a
                    href="https://app.binance.com/uni-qr/Dqvi2v2V"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-[#F3F1EA] border border-[#E4E0D3] text-xs font-bold text-[#111413] inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Open Binance Pay App</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#5E8C1F]" />
                  </a>
                </div>
              </motion.form>
            )}

            {step === "verify" && (
              <motion.form
                key="verify-step"
                onSubmit={handleVerifyOrder}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
                className="max-w-lg mx-auto space-y-5"
              >
                {/* Locked Summary Bar */}
                <div className="p-4 rounded-2xl bg-[#F7F6F2] border border-[#E4E0D3] flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5B625F] block">
                      Expected Transfer
                    </span>
                    <span className="text-base font-black font-mono text-[#111413]">
                      {(deposit?.usdtAmount ?? usdtAmount).toFixed(2)} USDT
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5B625F] block">
                      To Binance ID
                    </span>
                    <span className="text-sm font-mono font-bold text-[#111413]">
                      {binanceUid}
                    </span>
                  </div>
                </div>

                {!apiConfigured && (
                  <div className="p-3.5 rounded-2xl bg-[#FBF0DC] border border-[#B7791F]/30 text-xs font-medium text-[#B7791F] flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Automatic verification is temporarily unavailable. Submit your Order ID and our team will credit it manually.
                    </span>
                  </div>
                )}

                {errorMessage && (
                  <div className="p-3.5 rounded-2xl bg-[#FDF2EF] border border-[#C4552D]/30 text-xs font-semibold text-[#C4552D] flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Order ID Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#111413]">
                    Binance Order ID / Transaction ID
                  </label>
                  <input
                    type="text"
                    required
                    value={txnId}
                    onChange={(e) => setTxnId(e.target.value)}
                    placeholder="e.g. 465805925807284224 or P_A25P..."
                    className="w-full px-4 py-3.5 rounded-2xl border border-[#E4E0D3] focus:border-[#111413] bg-[#FAF9F5] focus:bg-white text-sm font-mono font-bold text-[#111413] outline-none transition-colors"
                  />
                  <p className="text-[11px] text-[#5B625F]">
                    Copy the Order ID from your Binance Pay receipt. Each Order ID can only be credited once.
                  </p>
                </div>

                {/* Optional Sender UID */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-[#5B625F]">
                    Your Binance UID (optional)
                  </label>
                  <input
                    type="text"
                    value={senderBinanceId}
                    onChange={(e) => setSenderBinanceId(e.target.value)}
                    placeholder="e.g. 84920194"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E4E0D3] focus:border-[#111413] bg-white text-xs font-mono text-[#111413] outline-none transition-colors"
                  />
                </div>

                {/* Security Guarantee Pill */}
                <div className="p-3.5 rounded-2xl bg-[#EEF6EC] border border-[#5E8C1F]/20 flex items-center gap-2.5 text-xs text-[#18422B]">
                  <ShieldCheck className="w-4 h-4 text-[#5E8C1F] shrink-0" />
                  <span>
                    Verified live against Binance Pay ledger. Exact received USDT is converted at ₹{exchangeRate.toFixed(2)} and credited once.
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setStep("pay");
                    }}
                    className="px-5 py-3.5 rounded-2xl border border-[#E4E0D3] hover:bg-[#F3F1EA] text-xs font-bold text-[#111413] transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={verifying || !txnId.trim()}
                    className="flex-1 py-3.5 px-6 rounded-2xl bg-[#D4F04F] hover:bg-[#C5E23A] active:scale-[0.98] disabled:opacity-50 text-[#111413] text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>
                          Verifying on Binance
                          {verifyAttempt > 1 ? ` (${verifyAttempt}/3)` : "…"}
                        </span>
                      </>
                    ) : (
                      <span>Verify &amp; Credit Balance</span>
                    )}
                  </button>
                </div>

                <div className="pt-2 text-center text-xs text-[#5B625F]">
                  Need help?{" "}
                  <a
                    href="https://t.me/Ghostfinds"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-[#229ED9] hover:underline inline-flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" />
                    <span>Telegram @Ghostfinds</span>
                  </a>
                </div>
              </motion.form>
            )}

            {step === "success" && (
              <motion.div
                key="success-step"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
              >
                <PaymentSuccessCelebration
                  creditedInr={creditedInr}
                  newBalance={newBalance}
                  orderId={deposit?.txnId || txnId}
                  alreadyCredited={alreadyCredited}
                  redirectSeconds={3}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Send,
  Clock,
  ArrowLeft,
} from "lucide-react";

interface BinanceAddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance?: number;
  onSuccess?: (newBalance: number) => void;
}

const PRESET_AMOUNTS = [100, 250, 500, 1000, 2500, 5000];

export function BinanceAddFundsModal({
  isOpen,
  onClose,
  currentBalance = 0,
  onSuccess,
}: BinanceAddFundsModalProps) {
  const [mounted, setMounted] = useState(false);

  // Stepper state: "pay" (Step 1: Make payment) -> "verify" (Step 2: Verify payment) -> "success"
  const [step, setStep] = useState<"pay" | "verify" | "success">("pay");

  const [inrAmount, setInrAmount] = useState<number>(100);
  const [exchangeRate, setExchangeRate] = useState<number>(90.0);
  const [binanceUid, setBinanceUid] = useState<string>("1161493552");

  // Created deposit record
  const [deposit, setDeposit] = useState<any>(null);
  const [submittingDeposit, setSubmittingDeposit] = useState(false);

  // Verification form state
  const [txnId, setTxnId] = useState("");
  const [senderBinanceId, setSenderBinanceId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [isPendingReview, setIsPendingReview] = useState(false);

  // Clipboard & feedback
  const [copiedUid, setCopiedUid] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const usdtAmount = Number((inrAmount / exchangeRate).toFixed(2));

  // Client hydration check
  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset & config on open / close
  useEffect(() => {
    if (!isOpen) {
      setStep("pay");
      setTxnId("");
      setSenderBinanceId("");
      setIsPendingReview(false);
      setErrorMessage(null);
      setSuccessMessage(null);
      return;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);

    async function loadConfig() {
      try {
        const res = await fetch("/api/wallet/deposit");
        const data = await res.json();
        if (data.success && data.config) {
          if (data.config.exchangeRate) setExchangeRate(data.config.exchangeRate);
          if (data.config.binanceUid) setBinanceUid(data.config.binanceUid);
        }
      } catch (err) {
        console.warn("Could not load Binance payment config:", err);
      }
    }
    loadConfig();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  function copyText(text: string, type: "uid" | "amount") {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === "uid") {
        setCopiedUid(true);
        setTimeout(() => setCopiedUid(false), 2000);
      } else {
        setCopiedAmount(true);
        setTimeout(() => setCopiedAmount(false), 2000);
      }
    }
  }

  // Handle Step 1 -> "Confirm payment" -> create backend deposit order
  async function handleConfirmPayment(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!inrAmount || inrAmount < 50) {
      setErrorMessage("Minimum deposit amount is ₹50.");
      return;
    }

    setSubmittingDeposit(true);
    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inrAmount }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to initiate payment.");
      }
      setDeposit(data.deposit);
      if (data.deposit.binanceUid) setBinanceUid(data.deposit.binanceUid);
      if (data.deposit.exchangeRate) setExchangeRate(data.deposit.exchangeRate);
      setStep("verify");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to initiate payment.");
    } finally {
      setSubmittingDeposit(false);
    }
  }

  // Handle Step 2 -> "Verify payment" with Order ID
  async function handleVerifyPayment(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!txnId.trim()) {
      setErrorMessage("Please enter your Binance Order ID.");
      return;
    }

    setVerifying(true);
    try {
      const depositId = deposit?.id;
      const res = await fetch("/api/wallet/deposit/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          depositId,
          txnId: txnId.trim(),
          senderBinanceId: senderBinanceId.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Payment verification failed.");
      }

      if (data.pendingVerification) {
        setIsPendingReview(true);
        setSuccessMessage(
          data.message || "Payment submitted! Our team is verifying your Binance transaction."
        );
      } else {
        setIsPendingReview(false);
        setSuccessMessage(data.message || `₹${inrAmount.toFixed(2)} credited successfully!`);

        // Only notify balance state if actually credited
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("balance-updated"));
        }
        if (onSuccess && typeof data.newBalance === "number") {
          onSuccess(data.newBalance);
        }
      }

      setStep("success");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to verify transaction.");
    } finally {
      setVerifying(false);
    }
  }

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm overflow-y-auto p-3 sm:p-4 flex justify-center items-start sm:items-center min-h-full animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white rounded-3xl border border-[#DEE0ED] max-w-[460px] w-full shadow-2xl my-auto flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[min(90vh,760px)] overflow-hidden animate-scaleUp shrink-0"
      >
        {/* Header - White Minimalist matching screenshot */}
        <div className="shrink-0 bg-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900 tracking-tight">
            Binance internal transfer
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Add Funds Modal"
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper matching Screenshot 1 & 2 */}
        <div className="shrink-0 bg-white pt-4 pb-3 px-6 border-b border-gray-100">
          <div className="flex items-center justify-center max-w-[280px] mx-auto">
            {/* Step 1 Node: Make payment */}
            <button
              type="button"
              onClick={() => {
                if (step === "verify") setStep("pay");
              }}
              className="flex flex-col items-center gap-1 group cursor-pointer"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === "pay"
                  ? "bg-[#2563EB] text-white shadow-sm ring-4 ring-[#2563EB]/15"
                  : "bg-[#2563EB] text-white"
                  }`}
              >
                1
              </div>
              <span
                className={`text-xs font-semibold ${step === "pay" ? "text-gray-900" : "text-gray-600"
                  }`}
              >
                Make payment
              </span>
            </button>

            {/* Connecting Horizontal Line */}
            <div
              className={`h-[2px] flex-1 mx-3 mb-5 transition-colors ${step === "verify" || step === "success" ? "bg-[#2563EB]" : "bg-gray-200"
                }`}
            />

            {/* Step 2 Node: Verify payment */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === "verify"
                  ? "bg-[#2563EB] text-white shadow-sm ring-4 ring-[#2563EB]/15"
                  : step === "success"
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-200 text-gray-500"
                  }`}
              >
                2
              </div>
              <span
                className={`text-xs font-semibold ${step === "verify" ? "text-gray-900" : "text-gray-400"
                  }`}
              >
                Verify payment
              </span>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
          {/* ============================================================== */}
          {/* STEP 1: MAKE PAYMENT (Screenshot 2 Replica)                    */}
          {/* ============================================================== */}
          {step === "pay" && (
            <form onSubmit={handleConfirmPayment} className="space-y-4">
              {/* Quick Amount Selector / Custom Amount Input */}
              <div className="p-3 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block leading-none">
                    Select Deposit Amount (INR ₹)
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">
                    Rate: 1 USDT = ₹{exchangeRate.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="50"
                      max="100000"
                      step="10"
                      value={inrAmount || ""}
                      onChange={(e) => setInrAmount(Number(e.target.value))}
                      placeholder="Min ₹50"
                      className="w-full pl-7 pr-3 py-1.5 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-900 outline-none focus:border-[#2563EB]"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    {PRESET_AMOUNTS.slice(0, 4).map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setInrAmount(amt)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${inrAmount === amt
                          ? "bg-[#2563EB] text-white shadow-xs"
                          : "bg-white text-gray-700 border border-gray-200 hover:border-[#2563EB]"
                          }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Big Bold USDT Amount (Screenshot 2) */}
              <div className="text-center pt-1">
                <h2 className="text-3xl font-black text-gray-900 font-mono tracking-tight">
                  {usdtAmount.toFixed(2)} USDT
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  (= ₹{inrAmount.toFixed(2)} INR)
                </p>
              </div>

              {/* Send to Binance ID (Screenshot 2) */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-700">
                  Send to Binance ID
                </label>
                <div className="flex items-center rounded-xl border border-gray-200 bg-white overflow-hidden shadow-xs focus-within:border-[#2563EB]">
                  <div className="flex-1 px-3.5 py-2.5 text-sm font-mono font-bold text-gray-900">
                    {binanceUid}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(binanceUid, "uid")}
                    className="px-3.5 py-2.5 bg-gray-50 hover:bg-gray-100 border-l border-gray-200 text-xs font-semibold text-gray-700 flex items-center gap-1.5 transition-colors"
                  >
                    {copiedUid ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-gray-500" />
                    )}
                    <span>{copiedUid ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>

              {/* Binance Pay QR Code with Center Emblem (Screenshot 2) */}
              <div className="flex justify-center py-1">
                <div className="relative w-44 h-44 p-2 bg-white rounded-2xl border border-gray-200 shadow-xs flex items-center justify-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                      binanceUid
                    )}`}
                    alt={`Binance Pay UID ${binanceUid}`}
                    className="w-full h-full object-contain rounded-lg"
                    width={160}
                    height={160}
                  />
                  {/* Binance Emblem in Center */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-9 h-9 rounded-xl bg-white p-1 shadow-md border border-gray-100 flex items-center justify-center">
                      <div className="w-full h-full rounded-lg bg-[#F0B90B] flex items-center justify-center text-black font-black text-xs">
                        <span>B</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instructions Box (Screenshot 2) */}
              <div className="p-3.5 rounded-xl bg-[#F9FAFB] border border-gray-100 text-xs text-gray-600 space-y-1">
                <p className="leading-relaxed">
                  1. Scan the QR using the Binance app or send funds using the Binance ID.
                </p>
                <p className="leading-relaxed">
                  2. After completing the payment tap &ldquo;Confirm payment&rdquo;.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Primary Action Button: Confirm payment (Screenshot 2) */}
              <button
                type="submit"
                disabled={submittingDeposit || inrAmount < 50}
                className="w-full py-3 px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2 press-scale"
              >
                {submittingDeposit ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Confirm payment</span>
                )}
              </button>

              {/* 24/7 Support Footer */}
              <div className="pt-1 text-center text-xs text-gray-500">
                <span>Need assistance? </span>
                <a
                  href="https://t.me/Ghostfinds"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#2563EB] hover:underline inline-flex items-center gap-1"
                >
                  <Send className="w-3 h-3 text-[#2563EB]" />
                  <span>24/7 Support on Telegram (@Ghostfinds)</span>
                </a>
              </div>
            </form>
          )}

          {/* ============================================================== */}
          {/* STEP 2: VERIFY PAYMENT (Screenshot 1 Replica)                  */}
          {/* ============================================================== */}
          {step === "verify" && (
            <form onSubmit={handleVerifyPayment} className="space-y-4">
              {/* Summary Bar: Amount & Send to Binance ID (Screenshot 1) */}
              <div className="p-3 rounded-xl bg-[#F3F4F6] border border-gray-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-gray-500 font-medium block leading-none mb-1">
                    Amount
                  </span>
                  <span className="text-sm font-black text-gray-900 font-mono">
                    {deposit?.usdtAmount ? deposit.usdtAmount.toFixed(2) : usdtAmount.toFixed(2)} USDT
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-gray-500 font-medium block leading-none mb-1">
                    Send to Binance ID
                  </span>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-sm font-black text-gray-900 font-mono">
                      {binanceUid}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(binanceUid, "uid")}
                      title="Copy Binance ID"
                      className="p-1 rounded hover:bg-gray-200 text-gray-600 transition-colors"
                    >
                      {copiedUid ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Enter your Binance Order ID (Screenshot 1) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-800">
                  Enter your Binance Order ID
                </label>
                <input
                  type="text"
                  value={txnId}
                  onChange={(e) => setTxnId(e.target.value)}
                  placeholder="e.g. 2198401928301928"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 bg-white text-xs font-mono font-bold text-gray-900 outline-none transition-all shadow-xs"
                  required
                />
              </div>

              {/* Receipt Visual Guidance Mockup (Screenshot 1) */}
              <div className="p-3.5 rounded-2xl bg-[#F9FAFB] border border-gray-200 space-y-3">
                {/* Visual Receipt Card Graphic */}
                <div className="bg-white rounded-xl border border-gray-200/90 p-3 max-w-[270px] mx-auto text-center space-y-1.5 shadow-xs">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-xs">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div className="text-[11px] font-bold text-gray-800">Payment Successful</div>
                  <div className="text-base font-black text-gray-900 font-mono">
                    {deposit?.usdtAmount
                      ? deposit.usdtAmount.toFixed(2)
                      : usdtAmount.toFixed(2)}{" "}
                    USDT
                  </div>
                  <div className="text-[9px] text-gray-400 leading-tight">
                    The recipient has received the funds into their account.
                  </div>

                  {/* Highlighted Order ID Callout (Copy this field) */}
                  <div className="mt-2.5 p-2 rounded-lg bg-amber-50/90 border border-amber-300 flex items-center justify-between text-left">
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-wider text-amber-900 block leading-none mb-0.5">
                        Order ID (Copy This)
                      </span>
                      <span className="text-[11px] font-mono font-bold text-gray-900">
                        2198401928301928
                      </span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900 text-[9px] font-bold flex items-center gap-0.5">
                      <Copy className="w-2.5 h-2.5" />
                      <span>Copy</span>
                    </span>
                  </div>
                </div>

                {/* Instructions below receipt graphic (Screenshot 1) */}
                <div className="text-xs text-gray-600 space-y-1 pt-1 border-t border-gray-100">
                  <p className="leading-relaxed">
                    1. Copy the Order ID from the successful payment details in your Binance account.
                  </p>
                  <p className="leading-relaxed">
                    2. Paste it into the field above and tap &ldquo;Verify payment&rdquo;.
                  </p>
                </div>
              </div>

              {/* Optional Sender Binance UID */}
              <div className="space-y-1">
                <label className="block text-[11px] text-gray-500">
                  Your Binance UID (Optional for faster matching)
                </label>
                <input
                  type="text"
                  value={senderBinanceId}
                  onChange={(e) => setSenderBinanceId(e.target.value)}
                  placeholder="e.g. 84920194"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-mono text-gray-700 outline-none focus:border-[#2563EB]"
                />
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Buttons: Back & Verify payment (Screenshot 1) */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStep("pay")}
                  className="py-3 px-4 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={verifying || !txnId.trim()}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-all press-scale flex items-center justify-center gap-2"
                >
                  {verifying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Verify payment</span>
                  )}
                </button>
              </div>

              {/* 24/7 Telegram Support Footer Link */}
              <div className="pt-1 text-center text-xs text-gray-500">
                <span>Need assistance? Contact </span>
                <a
                  href="https://t.me/Ghostfinds"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#2563EB] hover:underline inline-flex items-center gap-1"
                >
                  <Send className="w-3 h-3 text-[#2563EB]" />
                  <span>24/7 Support on Telegram (@Ghostfinds)</span>
                </a>
              </div>
            </form>
          )}

          {/* ============================================================== */}
          {/* STEP 3: SUCCESS OR UNDER REVIEW FEEDBACK                       */}
          {/* ============================================================== */}
          {step === "success" && (
            <div className="py-6 text-center space-y-4 animate-scaleUp">
              {isPendingReview ? (
                <>
                  <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-sm">
                    <Clock className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      Payment Submitted for Verification
                    </h3>
                    <p className="text-xs text-gray-600 max-w-xs mx-auto mt-1 leading-relaxed">
                      Your Binance Order ID has been recorded. Our team is verifying your payment and your wallet will be credited shortly.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-gray-200 text-xs text-gray-600 max-w-xs mx-auto text-left space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Order ID:</span>
                      <span className="font-mono font-bold text-gray-900">{txnId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Amount:</span>
                      <span className="font-bold text-gray-900">₹{inrAmount.toFixed(2)} INR</span>
                    </div>
                  </div>
                  <div className="pt-2 max-w-xs mx-auto space-y-2">
                    <a
                      href="https://t.me/Ghostfinds"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Instant Approval: Telegram @Ghostfinds</span>
                    </a>
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full py-2.5 px-4 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Payment Successful!</h3>
                    <p className="text-xs text-gray-600 mt-1">
                      {successMessage || `₹${inrAmount.toFixed(2)} INR has been credited to your wallet.`}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs font-bold text-emerald-800 max-w-xs mx-auto font-mono">
                    Balance Added: +₹{deposit?.inrAmount?.toFixed(2) || inrAmount.toFixed(2)} INR
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full max-w-xs py-3 px-4 rounded-xl bg-[#2563EB] text-white text-xs font-bold hover:bg-[#1D4ED8] transition-all shadow-sm press-scale mx-auto"
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

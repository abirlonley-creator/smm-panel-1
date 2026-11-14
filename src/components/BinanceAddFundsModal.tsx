"use client";

import React, { useState, useEffect } from "react";
import {
  Wallet,
  X,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  Loader2,
  AlertCircle,
  ExternalLink,
  QrCode,
  Sparkles,
} from "lucide-react";

interface BinanceAddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance?: number;
  onSuccess?: (newBalance: number) => void;
}

const PRESET_AMOUNTS = [250, 500, 1000, 2500, 5000];

export function BinanceAddFundsModal({
  isOpen,
  onClose,
  currentBalance = 0,
  onSuccess,
}: BinanceAddFundsModalProps) {
  // Step 1: "amount" -> Step 2: "pay" -> Step 3: "success"
  const [step, setStep] = useState<"amount" | "pay" | "success">("amount");

  const [inrAmount, setInrAmount] = useState<number>(500);
  const [exchangeRate, setExchangeRate] = useState<number>(90.0);
  const [binanceUid, setBinanceUid] = useState<string>("1161493552");

  // Created deposit
  const [deposit, setDeposit] = useState<any>(null);
  const [submittingDeposit, setSubmittingDeposit] = useState(false);

  // Verification
  const [txnId, setTxnId] = useState("");
  const [senderBinanceId, setSenderBinanceId] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Feedback states
  const [copiedUid, setCopiedUid] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const usdtAmount = Number((inrAmount / exchangeRate).toFixed(2));

  // Load config on mount
  useEffect(() => {
    if (!isOpen) {
      // Reset form when closed
      setStep("amount");
      setTxnId("");
      setSenderBinanceId("");
      setErrorMessage(null);
      setSuccessMessage(null);
      return;
    }

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
  }, [isOpen]);

  function copyText(text: string, type: "uid" | "amount" | "ref") {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === "uid") {
        setCopiedUid(true);
        setTimeout(() => setCopiedUid(false), 2000);
      } else if (type === "amount") {
        setCopiedAmount(true);
        setTimeout(() => setCopiedAmount(false), 2000);
      } else {
        setCopiedRef(true);
        setTimeout(() => setCopiedRef(false), 2000);
      }
    }
  }

  // Handle Step 1 -> Create Deposit
  async function handleProceedToPay(e: React.FormEvent) {
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
        throw new Error(data.error || "Failed to create payment order.");
      }
      setDeposit(data.deposit);
      if (data.deposit.binanceUid) setBinanceUid(data.deposit.binanceUid);
      if (data.deposit.exchangeRate) setExchangeRate(data.deposit.exchangeRate);
      setStep("pay");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to initiate payment.");
    } finally {
      setSubmittingDeposit(false);
    }
  }

  // Handle Step 2 -> Verify Payment
  async function handleVerifyPayment(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    if (!txnId.trim()) {
      setErrorMessage("Please enter your Binance Order ID or Transaction ID.");
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch("/api/wallet/deposit/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          depositId: deposit.id,
          txnId: txnId.trim(),
          senderBinanceId: senderBinanceId.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Payment verification failed.");
      }

      setSuccessMessage(data.message || `₹${inrAmount.toFixed(2)} credited successfully!`);
      setStep("success");

      // Notify global balance state
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("balance-updated"));
      }
      if (onSuccess && typeof data.newBalance === "number") {
        onSuccess(data.newBalance);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to verify transaction.");
    } finally {
      setVerifying(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl border border-[#DEE0ED] max-w-lg w-full shadow-2xl overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="bg-[#1A1D31] text-white px-6 py-5 flex items-center justify-between border-b border-[#323758]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F0B90B]/10 border border-[#F0B90B]/30 flex items-center justify-center text-[#F0B90B] font-black text-sm">
              <span className="tracking-tighter">B</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Add Funds</h3>
                <span className="px-2 py-0.5 rounded-full bg-[#F0B90B] text-black text-[10px] font-black uppercase tracking-wider">
                  Binance Pay
                </span>
              </div>
              <p className="text-xs text-[#DEE0ED]/60">
                Send USDT via Binance ID · Balance credited in INR (₹)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#DEE0ED]/60 hover:text-white p-1 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* STEP 1: SELECT AMOUNT */}
          {step === "amount" && (
            <form onSubmit={handleProceedToPay} className="space-y-5">
              <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase font-bold text-[#252943]/60 block leading-none mb-1">
                    Current Wallet Balance
                  </span>
                  <span className="text-xl font-black text-[#252943]">
                    ₹{currentBalance.toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#252943]/50 block">Exchange Rate</span>
                  <span className="text-xs font-mono font-bold text-[#3A4EFB]">
                    1 USDT = ₹{exchangeRate.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#252943]">
                  Enter Deposit Amount (INR ₹)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-[#252943]/50">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="50"
                    max="100000"
                    step="10"
                    value={inrAmount || ""}
                    onChange={(e) => setInrAmount(Number(e.target.value))}
                    placeholder="Enter amount (min ₹50)"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-[#DEE0ED] focus:border-[#3A4EFB] bg-white text-base font-bold text-[#252943] outline-none transition-all shadow-subtle"
                    required
                  />
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-[#252943]/60">Quick Select:</span>
                <div className="grid grid-cols-5 gap-2">
                  {PRESET_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setInrAmount(amt)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-all ${
                        inrAmount === amt
                          ? "bg-[#3A4EFB] text-white shadow-subtle"
                          : "bg-[#F8F9FD] text-[#252943] border border-[#DEE0ED] hover:border-[#3A4EFB]"
                      }`}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Real-time Calculation Summary */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs space-y-1 text-amber-950">
                <div className="flex items-center justify-between font-bold">
                  <span>You Pay:</span>
                  <span className="text-sm font-black text-amber-900">
                    {usdtAmount.toFixed(2)} USDT
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-amber-900/80">
                  <span>You Receive in Wallet:</span>
                  <span className="font-bold text-emerald-700">₹{inrAmount.toFixed(2)} INR</span>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submittingDeposit || inrAmount < 50}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#3A4EFB] hover:bg-[#2F40DB] disabled:opacity-50 text-white text-sm font-bold shadow-subtle transition-all press-scale flex items-center justify-center gap-2"
              >
                {submittingDeposit ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Proceed to Pay {usdtAmount.toFixed(2)} USDT</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: TRANSFER TO BINANCE UID */}
          {step === "pay" && deposit && (
            <div className="space-y-5 animate-fadeIn">
              {/* Instructions banner */}
              <div className="p-4 rounded-2xl bg-[#F0B90B]/10 border border-[#F0B90B]/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-[#252943] tracking-wide">
                    Step 1: Send USDT to Binance UID
                  </span>
                  <span className="text-[10px] font-bold text-[#252943]/60 font-mono">
                    Order Ref: {deposit.depositRef}
                  </span>
                </div>
                <p className="text-xs text-[#252943]/80 leading-relaxed">
                  Open your <strong>Binance App</strong> → Go to <strong>Pay</strong> → Tap <strong>Send</strong> → Choose <strong>Binance ID / UID</strong>.
                </p>
              </div>

              {/* UID Box with Copy Button */}
              <div className="p-4 rounded-2xl bg-[#F8F9FD] border-2 border-[#DEE0ED] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#252943]/60 block leading-none mb-1">
                      Recipient Binance Pay UID
                    </span>
                    <span className="text-lg font-black text-[#252943] font-mono tracking-wider">
                      {binanceUid}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(binanceUid, "uid")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-subtle ${
                      copiedUid
                        ? "bg-emerald-600 text-white"
                        : "bg-[#252943] hover:bg-[#1a1d31] text-white"
                    }`}
                  >
                    {copiedUid ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUid ? "Copied UID" : "Copy UID"}</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-[#DEE0ED] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#252943]/60 block leading-none mb-0.5">
                      Exact Amount to Send
                    </span>
                    <span className="text-base font-black text-[#3A4EFB] font-mono">
                      {deposit.usdtAmount.toFixed(2)} USDT
                    </span>
                    <span className="text-[11px] text-[#252943]/60 ml-2">
                      (= ₹{deposit.inrAmount.toFixed(2)} INR)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(deposit.usdtAmount.toFixed(2), "amount")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 border ${
                      copiedAmount
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-white text-[#252943] border-[#DEE0ED] hover:bg-slate-50"
                    }`}
                  >
                    {copiedAmount ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedAmount ? "Copied" : "Copy Amount"}</span>
                  </button>
                </div>
              </div>

              {/* STEP 2: VERIFICATION FORM */}
              <form onSubmit={handleVerifyPayment} className="space-y-4 pt-1">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#252943]">
                      Step 2: Enter Binance Order ID / TxID
                    </label>
                    <span className="text-[10px] text-[#252943]/50">Found on transfer receipt</span>
                  </div>
                  <input
                    type="text"
                    value={txnId}
                    onChange={(e) => setTxnId(e.target.value)}
                    placeholder="e.g. 2198401928301928"
                    className="w-full px-4 py-3 rounded-2xl border-2 border-[#DEE0ED] focus:border-[#3A4EFB] bg-white text-xs font-mono font-bold text-[#252943] outline-none shadow-subtle"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-[#252943]/70">
                    Your Binance UID (Optional for faster matching)
                  </label>
                  <input
                    type="text"
                    value={senderBinanceId}
                    onChange={(e) => setSenderBinanceId(e.target.value)}
                    placeholder="e.g. 84920194"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#DEE0ED] bg-white text-xs font-mono text-[#252943] outline-none"
                  />
                </div>

                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setStep("amount")}
                    className="py-3 px-4 rounded-xl border border-[#DEE0ED] text-xs font-bold text-[#252943]/70 hover:bg-slate-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={verifying || !txnId.trim()}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black shadow-subtle transition-all press-scale flex items-center justify-center gap-2"
                  >
                    {verifying ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verify & Credit ₹{deposit.inrAmount.toFixed(2)}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 3: SUCCESS */}
          {step === "success" && (
            <div className="py-6 text-center space-y-4 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-black text-[#252943]">Payment Credited!</h4>
                <p className="text-xs text-[#252943]/70">
                  {successMessage || "Your balance has been updated successfully."}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-bold">
                Balance added: +₹{deposit?.inrAmount?.toFixed(2) || inrAmount.toFixed(2)} INR
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-4 rounded-2xl bg-[#252943] text-white text-xs font-bold hover:bg-[#1a1d31] transition-all shadow-subtle press-scale"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import crypto from "crypto";
import { prisma } from "../prisma";

export const ADMIN_BINANCE_UID = process.env.BINANCE_UID || "1161493552";
export const DEFAULT_EXCHANGE_RATE = Number(process.env.BINANCE_USDT_INR_RATE) || 90.0; // 1 USDT = 90 INR
export const MIN_DEPOSIT_INR = 50;
export const MAX_DEPOSIT_INR = 100000;

export interface BinancePaymentConfig {
  binanceUid: string;
  exchangeRate: number;
  minAmount: number;
  maxAmount: number;
  isApiConfigured: boolean;
}

export function getBinanceConfig(): BinancePaymentConfig {
  const hasApiKeys = Boolean(
    (process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET) ||
    (process.env.BINANCE_PAY_API_KEY && process.env.BINANCE_PAY_SECRET_KEY)
  );

  return {
    binanceUid: ADMIN_BINANCE_UID,
    exchangeRate: DEFAULT_EXCHANGE_RATE,
    minAmount: MIN_DEPOSIT_INR,
    maxAmount: MAX_DEPOSIT_INR,
    isApiConfigured: hasApiKeys,
  };
}

export function calculateUsdtAmount(inrAmount: number, rate = DEFAULT_EXCHANGE_RATE): number {
  return Number((inrAmount / rate).toFixed(2));
}

/**
 * Creates a pending deposit record for the user.
 */
export async function createBinanceDeposit({
  userId,
  inrAmount,
  exchangeRate = DEFAULT_EXCHANGE_RATE,
}: {
  userId: string;
  inrAmount: number;
  exchangeRate?: number;
}) {
  if (process.env.PAYMENTS_PAUSED === "true") {
    throw new Error(
      "We're currently fixing the payment issue. Please contact our 24/7 Support on Telegram: https://t.me/Ghostfinds"
    );
  }

  if (inrAmount < MIN_DEPOSIT_INR) {
    throw new Error(`Minimum deposit amount is ₹${MIN_DEPOSIT_INR}.`);
  }
  if (inrAmount > MAX_DEPOSIT_INR) {
    throw new Error(`Maximum deposit amount is ₹${MAX_DEPOSIT_INR}.`);
  }

  const usdtAmount = calculateUsdtAmount(inrAmount, exchangeRate);
  const depositRef = `PAY-${Math.floor(100000 + Math.random() * 900000)}`;

  const deposit = await prisma.paymentDeposit.create({
    data: {
      depositRef,
      userId,
      method: "BINANCE_PAY",
      inrAmount,
      usdtAmount,
      exchangeRate,
      binanceUid: ADMIN_BINANCE_UID,
      status: "PENDING",
    },
  });

  return deposit;
}

/**
 * Live verification using Binance SAPI Pay Transactions API.
 * Uses official Binance API with read-only permissions and HMAC-SHA256 signature.
 */
async function queryBinanceApiPayTransaction(orderOrTxnId: string): Promise<{
  verified: boolean;
  orderId?: string;
  transactionId?: string;
  amount?: number;
  currency?: string;
  isIncoming?: boolean;
  senderUid?: string;
  senderName?: string;
  receiverUid?: string;
  transactionTime?: number;
  statusText?: string;
  raw?: any;
}> {
  const apiKey = process.env.BINANCE_API_KEY || process.env.BINANCE_PAY_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET || process.env.BINANCE_PAY_SECRET_KEY;

  if (!apiKey || !apiSecret) {
    return {
      verified: false,
      statusText: "MANUAL_ADMIN_REVIEW_REQUIRED",
    };
  }

  try {
    const timestamp = Date.now();
    const recvWindow = 50000;
    // Query transactions from the last 30 days
    const startTimestamp = timestamp - 30 * 24 * 60 * 60 * 1000;
    const queryString = `startTimestamp=${startTimestamp}&timestamp=${timestamp}&recvWindow=${recvWindow}`;
    const signature = crypto
      .createHmac("sha256", apiSecret)
      .update(queryString)
      .digest("hex");

    const endpoint = `https://api.binance.com/sapi/v1/pay/transactions?${queryString}&signature=${signature}`;

    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": apiKey,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn("[BINANCE_API] Query error HTTP", res.status, await res.text());
      return { verified: false, statusText: `Binance API error HTTP ${res.status}` };
    }

    const data = await res.json();
    if (data?.code === "000000" && Array.isArray(data.data)) {
      const cleanSearch = orderOrTxnId.trim().replace(/^#\s*/, "").toLowerCase();
      const match = data.data.find((tx: any) => {
        const orderMatch = tx.orderId && String(tx.orderId).trim().toLowerCase() === cleanSearch;
        const txnMatch = tx.transactionId && String(tx.transactionId).trim().toLowerCase() === cleanSearch;
        return orderMatch || txnMatch;
      });

      if (match) {
        const parsedAmount = parseFloat(match.amount);
        const isIncoming = parsedAmount > 0;

        return {
          verified: true,
          orderId: String(match.orderId),
          transactionId: String(match.transactionId),
          amount: parsedAmount,
          currency: match.currency,
          isIncoming,
          senderUid: match.payerInfo?.binanceId
            ? String(match.payerInfo.binanceId)
            : match.counterpartyId
            ? String(match.counterpartyId)
            : undefined,
          senderName: match.payerInfo?.name || undefined,
          receiverUid: match.receiverInfo?.binanceId
            ? String(match.receiverInfo.binanceId)
            : String(match.uid),
          transactionTime: match.transactionTime,
          raw: match,
        };
      }
    }

    return { verified: false, statusText: "Transaction not found on Binance Pay records" };
  } catch (err: any) {
    console.error("[BINANCE_API] Verification exception:", err);
    return { verified: false, statusText: err.message };
  }
}

/**
 * Validates, checks for duplicates, verifies with live Binance API, and atomically credits
 * the user's wallet in a safe transaction with full security checks against fraud/tampering.
 */
export async function verifyAndCreditDeposit({
  userId,
  depositId,
  txnId,
  senderBinanceId,
}: {
  userId: string;
  depositId?: string;
  txnId: string;
  senderBinanceId?: string;
}) {
  if (process.env.PAYMENTS_PAUSED === "true") {
    throw new Error(
      "We're currently fixing the payment issue. Please contact our 24/7 Support on Telegram: https://t.me/Ghostfinds"
    );
  }

  const cleanTxnId = txnId.trim().replace(/^#\s*/, "");
  if (!cleanTxnId) {
    throw new Error("Please enter your Binance Order ID.");
  }

  // Permissive alphanumeric check for Binance Order IDs or Transaction IDs (numeric 6-30 digits or alphanumeric P_...)
  if (!/^[A-Za-z0-9_#-]{6,45}$/.test(cleanTxnId)) {
    throw new Error(
      "Invalid Binance Order ID format. Enter the numeric Order ID or Transaction ID from your Binance Pay receipt."
    );
  }

  // 1. Initial unique check: Prevent duplicate claims
  const duplicateTxn = await prisma.paymentDeposit.findFirst({
    where: {
      txnId: cleanTxnId,
      status: "VERIFIED",
    },
  });

  if (duplicateTxn) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true } });
    return {
      success: true,
      alreadyCredited: true,
      newBalance: user?.walletBalance ?? duplicateTxn.inrAmount,
      deposit: duplicateTxn,
      message: "This Binance Order ID has already been credited to wallet balance.",
    };
  }

  // 2. Retrieve deposit and ensure user ownership
  let deposit = depositId
    ? await prisma.paymentDeposit.findUnique({
        where: { id: depositId },
        include: { user: { select: { id: true, username: true, walletBalance: true } } },
      })
    : await prisma.paymentDeposit.findFirst({
        where: { userId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, username: true, walletBalance: true } } },
      });

  if (!deposit) {
    throw new Error("Deposit order not found. Please initiate a new payment request.");
  }

  if (deposit.userId !== userId) {
    throw new Error("Unauthorized: Deposit belongs to another user.");
  }

  if (deposit.status === "VERIFIED") {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true } });
    return {
      success: true,
      alreadyCredited: true,
      newBalance: user?.walletBalance ?? deposit.inrAmount,
      deposit,
      message: "This deposit has already been credited to your wallet balance.",
    };
  }

  // 3. Automated Binance Verification
  const config = getBinanceConfig();

  if (config.isApiConfigured) {
    // Automated check against live Binance Pay records via read-only API
    const verificationResult = await queryBinanceApiPayTransaction(cleanTxnId);

    let automatedMatchSuccess = false;
    let failureReason = "";

    if (!verificationResult.verified) {
      failureReason = "Transaction not found on Binance Pay records";
    } else if (!verificationResult.isIncoming || (verificationResult.amount ?? 0) <= 0) {
      failureReason = "Transaction is an outgoing transfer, not an incoming payment";
    } else if (verificationResult.currency && verificationResult.currency.toUpperCase() !== "USDT") {
      failureReason = `Unsupported currency: Received ${verificationResult.currency}. Deposits must be in USDT`;
    } else {
      // Recipient check: matches our UID
      const adminUid = String(ADMIN_BINANCE_UID).trim();
      const receiverUidStr = String(verificationResult.receiverUid || "").trim();
      if (receiverUidStr && receiverUidStr !== adminUid) {
        failureReason = `Recipient mismatch: Transferred to Binance ID ${receiverUidStr}, not official ID ${adminUid}`;
      } else {
        // Amount verification
        const requiredUsdt = deposit.usdtAmount;
        const receivedUsdt = verificationResult.amount || 0;
        if (receivedUsdt < requiredUsdt * 0.98) {
          failureReason = `Underpayment: Required ${requiredUsdt} USDT, but received ${receivedUsdt} USDT on Binance`;
        } else {
          automatedMatchSuccess = true;
        }
      }
    }

    // =========================================================================
    // CASE A: AUTOMATED MATCH SUCCESSFUL -> CREDIT WALLET IMMEDIATELY
    // =========================================================================
    if (automatedMatchSuccess) {
      const receivedUsdt = verificationResult.amount || deposit.usdtAmount;
      const requiredUsdt = deposit.usdtAmount;

      // Credit amount: if user sent more USDT, credit them fairly for the higher amount
      const creditInr =
        receivedUsdt > requiredUsdt
          ? Number((receivedUsdt * deposit.exchangeRate).toFixed(2))
          : deposit.inrAmount;

      const orderIdToLock = verificationResult.orderId || cleanTxnId;
      const txnIdToLock = verificationResult.transactionId || cleanTxnId;

      const result = await prisma.$transaction(async (tx) => {
        // Re-verify inside lock
        const concurrentCheck = await tx.paymentDeposit.findFirst({
          where: {
            status: "VERIFIED",
            OR: [
              { txnId: cleanTxnId },
              { txnId: orderIdToLock },
              { txnId: txnIdToLock },
            ],
          },
        });
        if (concurrentCheck) {
          throw new Error("This Binance Order ID has already been claimed.");
        }

        // A. Update deposit status to VERIFIED
        const updatedDeposit = await tx.paymentDeposit.update({
          where: { id: deposit.id },
          data: {
            status: "VERIFIED",
            txnId: orderIdToLock,
            senderBinanceId: verificationResult.senderUid || senderBinanceId?.trim() || null,
            inrAmount: creditInr,
            usdtAmount: receivedUsdt,
            verifiedAt: new Date(),
            rejectionReason: null,
            rawVerification: JSON.stringify(verificationResult),
          },
        });

        // B. Increment wallet balance
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            walletBalance: { increment: creditInr },
          },
          select: { id: true, walletBalance: true },
        });

        // C. Create immutable audit record
        const auditRecord = await tx.walletTransaction.create({
          data: {
            userId,
            type: "CREDIT",
            amount: creditInr,
            balanceAfter: updatedUser.walletBalance,
            referenceId: deposit.depositRef,
            description: `Binance Pay Auto-Verified: ₹${creditInr} (${receivedUsdt} USDT @ ₹${deposit.exchangeRate}) - Order ID: ${orderIdToLock}`,
          },
        });

        return {
          updatedDeposit,
          newBalance: updatedUser.walletBalance,
          auditRecord,
        };
      });

      return {
        success: true,
        verified: true,
        newBalance: result.newBalance,
        deposit: result.updatedDeposit,
        message: `Payment verified instantly! ₹${creditInr.toFixed(2)} has been credited to your wallet.`,
      };
    }

    // =========================================================================
    // CASE B: AUTOMATED MATCH FAILED / NOT FOUND -> DO NOT FORWARD TO ADMIN
    // =========================================================================
    return {
      success: false,
      requiresAdminReview: false,
      error: "Payment not found. Check your Binance Order ID.",
      message: "Payment not found. Check your Binance Order ID.",
      failureReason,
    };
  } else {
    // API not configured or unavailable -> directly report payment not found
    return {
      success: false,
      requiresAdminReview: false,
      error: "Payment not found. Check your Binance Order ID.",
      message: "Payment not found. Check your Binance Order ID.",
    };
  }
}

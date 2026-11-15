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
      const cleanSearch = orderOrTxnId.trim().toLowerCase();
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
  depositId: string;
  txnId: string;
  senderBinanceId?: string;
}) {
  if (process.env.PAYMENTS_PAUSED === "true") {
    throw new Error(
      "We're currently fixing the payment issue. Please contact our 24/7 Support on Telegram: https://t.me/Ghostfinds"
    );
  }

  const cleanTxnId = txnId.trim();
  if (!cleanTxnId) {
    throw new Error("Please enter your Binance Order ID.");
  }

  // Strict format check: accepts standard 10-25 digit numeric Order IDs or alphanumeric Binance Transaction IDs (P_...)
  if (!/^[A-Za-z0-9_]{10,35}$/.test(cleanTxnId)) {
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
    throw new Error(
      "This Binance Order ID has already been credited. Each payment can only be credited once."
    );
  }

  // 2. Retrieve deposit and ensure user ownership
  const deposit = await prisma.paymentDeposit.findUnique({
    where: { id: depositId },
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
    if (!verificationResult.verified) {
      throw new Error(
        `Binance verification failed: ${
          verificationResult.statusText ||
          "Payment could not be verified on Binance records. Please ensure the payment is completed on the Binance app and retry, or contact 24/7 Support."
        }`
      );
    }

    // Security Check A: Must be an incoming payment (positive amount)
    if (!verificationResult.isIncoming || (verificationResult.amount ?? 0) <= 0) {
      throw new Error("Invalid transaction: The provided ID is an outgoing transfer, not an incoming deposit.");
    }

    // Security Check B: Currency must be USDT
    if (verificationResult.currency && verificationResult.currency.toUpperCase() !== "USDT") {
      throw new Error(`Unsupported currency: Received ${verificationResult.currency}. Deposits must be in USDT.`);
    }

    // Security Check C: Recipient must be our official Binance UID
    if (verificationResult.receiverUid && verificationResult.receiverUid !== ADMIN_BINANCE_UID) {
      throw new Error(
        `Invalid recipient: Payment was transferred to Binance UID ${verificationResult.receiverUid}, not our official panel UID (${ADMIN_BINANCE_UID}).`
      );
    }

    // Security Check D: Amount verification (prevent underpayment attacks)
    const requiredUsdt = deposit.usdtAmount;
    const receivedUsdt = verificationResult.amount || 0;
    if (receivedUsdt < requiredUsdt * 0.98) {
      throw new Error(
        `Underpayment detected: This deposit request requires ${requiredUsdt} USDT, but only ${receivedUsdt} USDT was received on Binance. Please contact support.`
      );
    }

    // Credit amount: if user sent more USDT, credit them fairly for the higher amount
    const creditInr =
      receivedUsdt > requiredUsdt
        ? Number((receivedUsdt * deposit.exchangeRate).toFixed(2))
        : deposit.inrAmount;

    // 4. Atomically credit user balance and mark deposit VERIFIED
    const orderIdToLock = verificationResult.orderId || cleanTxnId;
    const txnIdToLock = verificationResult.transactionId || cleanTxnId;

    const result = await prisma.$transaction(async (tx) => {
      // Re-verify uniqueness inside transaction lock for both orderId and transactionId
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

      // A. Update deposit status
      const updatedDeposit = await tx.paymentDeposit.update({
        where: { id: deposit.id },
        data: {
          status: "VERIFIED",
          txnId: orderIdToLock,
          senderBinanceId: verificationResult.senderUid || senderBinanceId?.trim() || null,
          inrAmount: creditInr,
          usdtAmount: receivedUsdt,
          verifiedAt: new Date(),
          rawVerification: JSON.stringify(verificationResult),
        },
      });

      // B. Atomically increment user's walletBalance
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          walletBalance: { increment: creditInr },
        },
        select: { id: true, walletBalance: true },
      });

      // C. Create immutable WalletTransaction audit record
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
      newBalance: result.newBalance,
      deposit: result.updatedDeposit,
      message: `Payment verified instantly! ₹${creditInr.toFixed(2)} has been credited to your wallet.`,
    };
  } else {
    // Manual fallback mode if API keys are ever absent
    const updatedDeposit = await prisma.paymentDeposit.update({
      where: { id: deposit.id },
      data: {
        txnId: cleanTxnId,
        senderBinanceId: senderBinanceId?.trim() || null,
        status: "PENDING",
      },
    });

    return {
      success: true,
      pendingVerification: true,
      deposit: updatedDeposit,
      message:
        "Payment submitted! Our team is verifying your Binance transaction. Your balance will be credited upon confirmation. For instant updates, contact 24/7 Support.",
    };
  }
}

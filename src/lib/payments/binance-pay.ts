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

export function extractBinanceIdentifiers(input: string): {
  normalized: string;
  extractedOrderId?: string;
  extractedTxnId?: string;
  extractedBinanceId?: string;
} {
  const raw = String(input || "").trim();
  // Strip common label prefixes like "Order ID:", "Order:", "Txn ID:", "ID:", "Hash:"
  const stripped = raw
    .replace(/^(?:order\s*id|order|transaction\s*id|txn\s*id|payment\s*id|id|hash)\s*[:#-]?\s*/i, "")
    .trim();

  // Remove internal spaces and dashes
  const noSpaces = stripped.replace(/[\s-]+/g, "");

  // 1. Check for 16-22 digit numeric Order ID
  const orderIdMatch = noSpaces.match(/\d{16,22}/);
  const extractedOrderId = orderIdMatch ? orderIdMatch[0] : undefined;

  // 2. Check for P_... Transaction ID (e.g. P_A25P1G3T2W171114 or A25P1G3T2W171114)
  const txnIdMatch = noSpaces.match(/(?:P_)?[A-Za-z0-9]{12,25}/i);
  const extractedTxnId = txnIdMatch ? txnIdMatch[0] : undefined;

  // 3. Check for 7-12 digit numeric Binance ID / Pay ID
  const binanceIdMatch = noSpaces.match(/^\d{7,12}$/);
  const extractedBinanceId = binanceIdMatch ? binanceIdMatch[0] : undefined;

  return {
    normalized: noSpaces,
    extractedOrderId,
    extractedTxnId,
    extractedBinanceId,
  };
}

async function fetchBinancePayTransactions(params: Record<string, any> = {}): Promise<any[]> {
  const apiKey = process.env.BINANCE_API_KEY || process.env.BINANCE_PAY_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET || process.env.BINANCE_PAY_SECRET_KEY;

  if (!apiKey || !apiSecret) return [];

  const timestamp = Date.now();
  const recvWindow = 50000;
  const allParams = { ...params, timestamp, recvWindow, limit: 100 };
  const queryString = Object.entries(allParams)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  const signature = crypto.createHmac("sha256", apiSecret).update(queryString).digest("hex");
  const endpoint = `https://api.binance.com/sapi/v1/pay/transactions?${queryString}&signature=${signature}`;

  const res = await fetch(endpoint, {
    method: "GET",
    headers: { "X-MBX-APIKEY": apiKey },
    cache: "no-store",
  });

  if (!res.ok) {
    console.warn("[BINANCE_API] Query error HTTP", res.status, await res.text());
    return [];
  }

  const data = await res.json();
  if (data?.code === "000000" && Array.isArray(data.data)) {
    return data.data;
  }
  return [];
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
    const idInfo = extractBinanceIdentifiers(orderOrTxnId);
    const searchKeys = new Set<string>();
    if (idInfo.normalized) searchKeys.add(idInfo.normalized.toLowerCase());
    if (idInfo.extractedOrderId) searchKeys.add(idInfo.extractedOrderId.toLowerCase());
    if (idInfo.extractedTxnId) {
      searchKeys.add(idInfo.extractedTxnId.toLowerCase());
      if (idInfo.extractedTxnId.toLowerCase().startsWith("p_")) {
        searchKeys.add(idInfo.extractedTxnId.slice(2).toLowerCase());
      } else {
        searchKeys.add(`p_${idInfo.extractedTxnId.toLowerCase()}`);
      }
    }
    if (idInfo.extractedBinanceId) searchKeys.add(idInfo.extractedBinanceId.toLowerCase());

    const timestamp = Date.now();
    const startTimestamp = timestamp - 30 * 24 * 60 * 60 * 1000;

    // First attempt: with startTimestamp and limit=100
    let transactions = await fetchBinancePayTransactions({ startTimestamp });
    // Second attempt if empty: without startTimestamp
    if (!transactions.length) {
      transactions = await fetchBinancePayTransactions({});
    }

    const match = transactions.find((tx: any) => {
      const txOrderId = tx.orderId ? String(tx.orderId).trim().toLowerCase() : "";
      const txTxnId = tx.transactionId ? String(tx.transactionId).trim().toLowerCase() : "";
      const txPayerId = tx.payerInfo?.binanceId ? String(tx.payerInfo.binanceId).trim().toLowerCase() : "";
      const txCounterpartyId = tx.counterpartyId ? String(tx.counterpartyId).trim().toLowerCase() : "";

      if (searchKeys.has(txOrderId)) return true;
      if (searchKeys.has(txTxnId)) return true;
      if (txTxnId.startsWith("p_") && searchKeys.has(txTxnId.slice(2))) return true;
      if (idInfo.extractedBinanceId && (searchKeys.has(txPayerId) || searchKeys.has(txCounterpartyId))) {
        return true;
      }
      return false;
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

  const idInfo = extractBinanceIdentifiers(txnId);
  const cleanTxnId = idInfo.normalized;
  if (!cleanTxnId) {
    throw new Error("Please enter your Binance Order ID.");
  }

  // Permissive check: at least 5 alphanumeric characters
  if (cleanTxnId.length < 5) {
    throw new Error(
      "Invalid Binance Order ID format. Enter the numeric Order ID or Transaction ID from your Binance Pay receipt."
    );
  }

  // 1. Initial unique check: Prevent duplicate claims
  const searchTxnConditions: any[] = [{ txnId: cleanTxnId }];
  if (idInfo.extractedOrderId) searchTxnConditions.push({ txnId: idInfo.extractedOrderId });
  if (idInfo.extractedTxnId) searchTxnConditions.push({ txnId: idInfo.extractedTxnId });

  const duplicateTxn = await prisma.paymentDeposit.findFirst({
    where: {
      status: "VERIFIED",
      OR: searchTxnConditions,
    },
  });

  if (duplicateTxn) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true } });
    const isSameUser = duplicateTxn.userId === userId;
    return {
      success: true,
      alreadyCredited: true,
      newBalance: user?.walletBalance ?? duplicateTxn.inrAmount,
      deposit: duplicateTxn,
      message: isSameUser
        ? `This Binance payment (₹${duplicateTxn.inrAmount.toFixed(2)}) has already been credited to your wallet.`
        : "This Binance Order ID has already been claimed by another account.",
    };
  }

  // 2. Retrieve deposit or create on the fly
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
    const created = await createBinanceDeposit({
      userId,
      inrAmount: 100,
    });
    deposit = await prisma.paymentDeposit.findUnique({
      where: { id: created.id },
      include: { user: { select: { id: true, username: true, walletBalance: true } } },
    });
  }

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

  // Check for uniqueness: if another unverified deposit has this txnId, clear it so current deposit can use it
  const existingTxnDeposit = await prisma.paymentDeposit.findFirst({
    where: { txnId: cleanTxnId },
  });

  if (existingTxnDeposit && existingTxnDeposit.id !== deposit.id) {
    if (existingTxnDeposit.status === "VERIFIED") {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true } });
      return {
        success: true,
        alreadyCredited: true,
        newBalance: user?.walletBalance ?? existingTxnDeposit.inrAmount,
        deposit: existingTxnDeposit,
        message: "This Binance Order ID has already been credited to wallet balance.",
      };
    } else {
      await prisma.paymentDeposit.update({
        where: { id: existingTxnDeposit.id },
        data: { txnId: null },
      });
    }
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
        // Dynamic amount matching: whatever USDT was received on Binance gets credited at official exchange rate!
        const receivedUsdt = verificationResult.amount || 0;
        if (receivedUsdt <= 0) {
          failureReason = "Transaction amount is 0 or invalid on Binance Pay";
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
      // Dynamically calculate credited INR based on the exact USDT confirmed by Binance API
      const creditInr = Math.max(1, Number((receivedUsdt * deposit.exchangeRate).toFixed(2)));

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
    // CASE B: AUTOMATED MATCH FAILED / NOT FOUND -> QUEUE FOR ADMIN
    // =========================================================================
    const updatedDeposit = await prisma.paymentDeposit.update({
      where: { id: deposit.id },
      data: {
        txnId: cleanTxnId,
        senderBinanceId: senderBinanceId?.trim() || null,
        status: "PENDING",
        rejectionReason: failureReason
          ? `Not auto-matched: ${failureReason} (Queued for Admin)`
          : "Not auto-matched on Binance records (Queued for Admin)",
        rawVerification: JSON.stringify({
          attemptedAt: new Date().toISOString(),
          cleanTxnId,
          failureReason,
          verificationResult,
        }),
      },
    });

    return {
      success: false,
      requiresAdminReview: true,
      error: "Payment not found. Queued for Admin Review. Check your Binance Order ID.",
      message: "Payment not found. Queued for Admin Review. Check your Binance Order ID.",
      deposit: updatedDeposit,
      failureReason,
    };
  } else {
    // API not configured or unavailable -> queue for admin
    const updatedDeposit = await prisma.paymentDeposit.update({
      where: { id: deposit.id },
      data: {
        txnId: cleanTxnId,
        senderBinanceId: senderBinanceId?.trim() || null,
        status: "PENDING",
        rejectionReason: "Queued for Admin Review",
      },
    });

    return {
      success: false,
      requiresAdminReview: true,
      error: "Payment not found. Queued for Admin Review. Check your Binance Order ID.",
      message: "Payment not found. Queued for Admin Review. Check your Binance Order ID.",
      deposit: updatedDeposit,
    };
  }
}

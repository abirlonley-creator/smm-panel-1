import crypto from "crypto";
import { prisma } from "../prisma";

export const ADMIN_BINANCE_UID = process.env.BINANCE_UID || "1161493552";
export const DEFAULT_EXCHANGE_RATE = Number(process.env.BINANCE_USDT_INR_RATE) || 90.0; // 1 USDT = 90 INR
export const MIN_DEPOSIT_INR = 50;
export const MAX_DEPOSIT_INR = 100000;

/**
 * Binance occasionally blocks / rate-limits a single edge node, so every request is
 * retried against the mirrors before we conclude that the API is unreachable.
 */
const BINANCE_API_HOSTS = [
  "https://api.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://api-gcp.binance.com",
];
const PAY_TRANSACTIONS_PATH = "/sapi/v1/pay/transactions";
const PAY_TRANSACTIONS_LIMIT = 100; // Binance hard limit per request

export interface BinancePaymentConfig {
  binanceUid: string;
  exchangeRate: number;
  minAmount: number;
  maxAmount: number;
  isApiConfigured: boolean;
}

function cleanEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const value = raw.trim().replace(/^["']|["']$/g, "").trim();
  return value || undefined;
}

export function getBinanceApiCredentials(): { apiKey: string; apiSecret: string } | null {
  const apiKey = cleanEnv("BINANCE_API_KEY") || cleanEnv("BINANCE_PAY_API_KEY");
  const apiSecret = cleanEnv("BINANCE_API_SECRET") || cleanEnv("BINANCE_PAY_SECRET_KEY");
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret };
}

export function getBinanceConfig(): BinancePaymentConfig {
  return {
    binanceUid: ADMIN_BINANCE_UID,
    exchangeRate: DEFAULT_EXCHANGE_RATE,
    minAmount: MIN_DEPOSIT_INR,
    maxAmount: MAX_DEPOSIT_INR,
    isApiConfigured: Boolean(getBinanceApiCredentials()),
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

/** Canonical form used for every identifier comparison (order ids, txn ids, UIDs). */
export function normalizeBinanceId(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
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

  // 2. Check for a P_... Transaction ID (e.g. P_A25P1G3T2W171114) or another alphanumeric id
  const txnIdMatch = noSpaces.match(/^(?:P_)?[A-Za-z0-9]{10,40}$/i);
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

interface PayTransactionsFetch {
  ok: boolean;
  transactions: any[];
  error?: string;
}

/**
 * Queries the read-only Binance Pay transaction history (SAPI).
 * All failures are surfaced instead of being silently treated as "not found",
 * which previously made a broken API look like a missing customer payment.
 */
async function fetchBinancePayTransactions(
  params: Record<string, any> = {}
): Promise<PayTransactionsFetch> {
  const credentials = getBinanceApiCredentials();
  if (!credentials) {
    return { ok: false, transactions: [], error: "BINANCE_CREDENTIALS_MISSING" };
  }

  const timestamp = Date.now();
  const recvWindow = 50000;
  const queryString = Object.entries({ ...params, timestamp, recvWindow })
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  const signature = crypto
    .createHmac("sha256", credentials.apiSecret)
    .update(queryString)
    .digest("hex");

  let lastError = "Binance Pay API unreachable";
  const tried = new Set<string>();

  for (const host of BINANCE_API_HOSTS) {
    if (tried.has(host)) continue;
    tried.add(host);

    try {
      const res = await fetch(
        `${host}${PAY_TRANSACTIONS_PATH}?${queryString}&signature=${signature}`,
        {
          method: "GET",
          headers: { "X-MBX-APIKEY": credentials.apiKey },
          cache: "no-store",
        }
      );

      const text = await res.text();

      if (!res.ok) {
        lastError = `Binance Pay API HTTP ${res.status}: ${text.slice(0, 300)}`;
        continue;
      }

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        lastError = "Binance Pay API returned an invalid JSON response";
        continue;
      }

      if (data?.code === "000000" || data?.success === true) {
        return { ok: true, transactions: Array.isArray(data.data) ? data.data : [] };
      }

      lastError = `Binance Pay API ${data?.code ?? res.status}: ${
        data?.msg || data?.message || "unknown error"
      }`;

      // Auth / permission problems will not be fixed by another edge node.
      if (["-1022", "-2014", "-2015"].includes(String(data?.code))) break;
    } catch (err: any) {
      lastError = err?.message || String(err);
    }
  }

  console.error("[BINANCE_API]", lastError);
  return { ok: false, transactions: [], error: lastError };
}

/**
 * Loads the most recent Pay transactions. The 100-record cap is per request, so the
 * window is widened (3 days → 30 → 90) until history is exhausted or 90 days is reached.
 */
async function loadRecentPayTransactions(): Promise<PayTransactionsFetch> {
  const now = Date.now();
  const windowDays = [3, 30, 90];
  let result: PayTransactionsFetch = { ok: true, transactions: [] };
  let collected: any[] = [];

  for (const days of windowDays) {
    result = await fetchBinancePayTransactions({
      startTime: now - days * 24 * 60 * 60 * 1000,
      limit: PAY_TRANSACTIONS_LIMIT,
    });
    // A failed wider window should not discard the history already collected.
    if (!result.ok) {
      if (collected.length > 0) return { ok: true, transactions: collected };
      return { ...result, transactions: collected };
    }

    collected = result.transactions;
    // Fewer than the page limit means the whole window was returned.
    if (collected.length < PAY_TRANSACTIONS_LIMIT) break;
  }

  return { ...result, transactions: collected };
}

interface BinancePayment {
  orderId?: string;
  transactionId?: string;
  amount?: number;
  currency?: string;
  senderUid?: string;
  senderName?: string;
  receiverUid?: string;
  transactionTime?: number;
  raw: any;
}

export interface BinanceVerificationResult {
  status: "VERIFIED" | "INVALID" | "NOT_FOUND" | "API_ERROR" | "NOT_CONFIGURED";
  reason?: string;
  apiError?: string;
  matchedBy?: "ORDER_ID" | "TRANSACTION_ID" | "SENDER_UID" | "AMOUNT";
  payment?: BinancePayment;
}

function toBinancePayment(tx: any): BinancePayment {
  const amount = Number.parseFloat(String(tx?.amount ?? ""));

  return {
    orderId: tx?.orderId != null ? String(tx.orderId) : undefined,
    transactionId: tx?.transactionId != null ? String(tx.transactionId) : undefined,
    amount: Number.isFinite(amount) ? amount : undefined,
    currency: tx?.currency != null ? String(tx.currency) : undefined,
    senderUid:
      tx?.payerInfo?.binanceId != null
        ? String(tx.payerInfo.binanceId)
        : tx?.counterpartyId != null
          ? String(tx.counterpartyId)
          : undefined,
    senderName: tx?.payerInfo?.name || undefined,
    receiverUid:
      tx?.receiverInfo?.binanceId != null
        ? String(tx.receiverInfo.binanceId)
        : tx?.uid != null
          ? String(tx.uid)
          : undefined,
    transactionTime: typeof tx?.transactionTime === "number" ? tx.transactionTime : undefined,
    raw: tx,
  };
}

function validateIncomingPayment(payment: BinancePayment): string | null {
  if (!payment.amount || payment.amount <= 0) {
    return "This is an outgoing transfer, not an incoming payment";
  }

  const currency = (payment.currency || "").toUpperCase();
  if (currency && currency !== "USDT") {
    return `Received ${payment.currency}. Only USDT deposits are supported`;
  }

  const adminUid = normalizeBinanceId(ADMIN_BINANCE_UID);
  const receiverUid = normalizeBinanceId(payment.receiverUid);
  if (receiverUid && adminUid && receiverUid !== adminUid) {
    return `Payment was sent to Binance ID ${payment.receiverUid}, not the official deposit Binance ID ${ADMIN_BINANCE_UID}`;
  }

  return null;
}

/**
 * Verifies a customer payment against the live Binance Pay records.
 *
 * Matching order:
 *  1. Exact Order ID / Transaction ID match (primary).
 *  2. Sender Binance UID + exact amount (when the customer supplied their UID).
 *  3. A single unclaimed incoming payment of the exact expected USDT amount made
 *     after the deposit was created (only when unambiguous).
 */
export async function queryBinanceIncomingPayment({
  searchInput,
  expectedUsdt,
  senderUid,
  notBeforeMs,
}: {
  searchInput: string;
  expectedUsdt?: number;
  senderUid?: string;
  notBeforeMs?: number;
}): Promise<BinanceVerificationResult> {
  if (!getBinanceApiCredentials()) {
    return {
      status: "NOT_CONFIGURED",
      reason: "Binance API credentials are not configured on the server (BINANCE_API_KEY / BINANCE_API_SECRET)",
    };
  }

  const ids = extractBinanceIdentifiers(searchInput);
  const searchKeys = new Set<string>();
  const addKey = (value?: string | null) => {
    const key = normalizeBinanceId(value);
    if (key) searchKeys.add(key);
  };
  addKey(ids.normalized);
  addKey(ids.extractedOrderId);
  addKey(ids.extractedTxnId);
  addKey(ids.extractedBinanceId);

  const feed = await loadRecentPayTransactions();
  if (!feed.ok) {
    return {
      status: "API_ERROR",
      reason: feed.error === "BINANCE_CREDENTIALS_MISSING"
        ? "Binance API credentials are not configured on the server"
        : "Could not query Binance Pay right now",
      apiError: feed.error,
    };
  }

  const transactions = feed.transactions;
  const payments = transactions.map(toBinancePayment);

  // ---------------------------------------------------------------------
  // 1. Exact Order ID / Transaction ID match
  // ---------------------------------------------------------------------
  for (const payment of payments) {
    const orderKey = normalizeBinanceId(payment.orderId);
    const txnKey = normalizeBinanceId(payment.transactionId);

    if ((orderKey && searchKeys.has(orderKey)) || (txnKey && searchKeys.has(txnKey))) {
      const invalidReason = validateIncomingPayment(payment);
      if (invalidReason) return { status: "INVALID", reason: invalidReason, payment, matchedBy: "ORDER_ID" };
      return {
        status: "VERIFIED",
        matchedBy: orderKey && searchKeys.has(orderKey) ? "ORDER_ID" : "TRANSACTION_ID",
        payment,
      };
    }
  }

  const expected = Number(expectedUsdt || 0);
  const notBefore = notBeforeMs ?? 0;

  // ---------------------------------------------------------------------
  // 2. Sender Binance UID + expected amount
  // ---------------------------------------------------------------------
  const normalizedSender = normalizeBinanceId(senderUid);
  if (normalizedSender && expected > 0) {
    const senderCandidates = payments
      .filter((payment) => {
        if ((payment.amount || 0) <= 0) return false;
        if (normalizeBinanceId(payment.senderUid) !== normalizedSender) return false;
        if (Math.abs((payment.amount || 0) - expected) > 0.02) return false;
        if (notBefore && payment.transactionTime && payment.transactionTime < notBefore) return false;
        return !validateIncomingPayment(payment);
      })
      .sort((a, b) => (b.transactionTime || 0) - (a.transactionTime || 0));

    if (senderCandidates.length > 0) {
      return { status: "VERIFIED", matchedBy: "SENDER_UID", payment: senderCandidates[0] };
    }
  }

  // ---------------------------------------------------------------------
  // 3. Unique amount fallback (only when it cannot be ambiguous)
  // ---------------------------------------------------------------------
  if (expected > 0) {
    const amountCandidates = payments
      .filter((payment) => {
        if ((payment.amount || 0) <= 0) return false;
        if (Math.abs((payment.amount || 0) - expected) > 0.02) return false;
        if (notBefore && payment.transactionTime && payment.transactionTime < notBefore) return false;
        return !validateIncomingPayment(payment);
      })
      .sort((a, b) => (b.transactionTime || 0) - (a.transactionTime || 0));

    if (amountCandidates.length === 1) {
      const candidate = amountCandidates[0];
      const claimedDeposits = await prisma.paymentDeposit.findMany({
        where: { status: "VERIFIED", txnId: { not: null } },
        select: { txnId: true },
        take: 5000,
        orderBy: { createdAt: "desc" },
      });
      const claimedKeys = new Set(
        claimedDeposits.map((deposit) => normalizeBinanceId(deposit.txnId)).filter(Boolean)
      );

      const orderKey = normalizeBinanceId(candidate.orderId);
      const txnKey = normalizeBinanceId(candidate.transactionId);
      const alreadyClaimed = claimedKeys.has(orderKey) || claimedKeys.has(txnKey);

      if (!alreadyClaimed) {
        return { status: "VERIFIED", matchedBy: "AMOUNT", payment: candidate };
      }
    } else if (amountCandidates.length > 1) {
      return {
        status: "NOT_FOUND",
        reason: `${amountCandidates.length} different payments of ${expected} USDT were found, so this one cannot be auto-matched safely`,
      };
    }
  }

  return {
    status: "NOT_FOUND",
    reason: "Order ID was not found in the Binance Pay records yet",
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface DepositVerificationOutcome {
  success: boolean;
  verified?: boolean;
  alreadyCredited?: boolean;
  requiresAdminReview?: boolean;
  autoVerifyStatus?: BinanceVerificationResult["status"];
  newBalance?: number;
  deposit: any;
  message: string;
  error?: string;
  failureReason?: string;
  apiError?: string;
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
}): Promise<DepositVerificationOutcome> {
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

  // Variants that may be stored in the database for this same payment.
  const txnIdVariants = new Set<string>([cleanTxnId]);
  const addVariant = (value?: string) => {
    if (value) txnIdVariants.add(value);
  };
  addVariant(idInfo.extractedOrderId);
  addVariant(idInfo.extractedTxnId);
  const variantList = Array.from(txnIdVariants);

  // 1. Initial unique check: Prevent duplicate claims
  const duplicateTxn = await prisma.paymentDeposit.findFirst({
    where: {
      status: "VERIFIED",
      txnId: { in: variantList },
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
    where: { txnId: { in: variantList } },
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
  if (!getBinanceApiCredentials()) {
    console.error(
      "[BINANCE_API] Auto-verification skipped: BINANCE_API_KEY / BINANCE_API_SECRET are not configured."
    );

    const failureReason =
      "Auto-verification unavailable: Binance API credentials are not configured on the server";

    const updatedDeposit = await prisma.paymentDeposit.update({
      where: { id: deposit.id },
      data: {
        txnId: cleanTxnId,
        senderBinanceId: senderBinanceId?.trim() || null,
        status: "PENDING",
        rejectionReason: failureReason,
        rawVerification: JSON.stringify({
          attemptedAt: new Date().toISOString(),
          cleanTxnId,
          status: "NOT_CONFIGURED",
          failureReason,
        }),
      },
    });

    return {
      success: false,
      requiresAdminReview: true,
      autoVerifyStatus: "NOT_CONFIGURED" as const,
      error:
        "Automatic verification is temporarily unavailable. Your Order ID has been saved and our team will credit your wallet shortly.",
      message:
        "Automatic verification is temporarily unavailable. Your Order ID has been saved and our team will credit your wallet shortly.",
      deposit: updatedDeposit,
      failureReason,
    };
  }

  const expectedUsdt = deposit.usdtAmount > 0 ? deposit.usdtAmount : 0;
  const notBeforeMs = deposit.createdAt.getTime() - 10 * 60 * 1000; // small clock-skew allowance

  // Binance Pay history can lag a few seconds behind the payment confirmation,
  // so retry briefly before queuing the deposit for manual review.
  let verification = await queryBinanceIncomingPayment({
    searchInput: cleanTxnId,
    expectedUsdt,
    senderUid: senderBinanceId,
    notBeforeMs,
  });

  for (let attempt = 1; attempt <= 2; attempt++) {
    // Only "not found yet" is worth re-checking: Binance history can lag behind the
    // payment confirmation. Auth/network errors were already retried across hosts.
    if (verification.status !== "NOT_FOUND") break;
    await sleep(1500);
    verification = await queryBinanceIncomingPayment({
      searchInput: cleanTxnId,
      expectedUsdt,
      senderUid: senderBinanceId,
      notBeforeMs,
    });
  }

  const failureReason = verification.reason || "Payment could not be matched on Binance";

  // =========================================================================
  // CASE A: AUTOMATED MATCH SUCCESSFUL -> CREDIT WALLET IMMEDIATELY
  // =========================================================================
  if (verification.status === "VERIFIED" && verification.payment) {
    const payment = verification.payment;
    const receivedUsdt = payment.amount || 0;
    // Dynamically calculate credited INR based on the exact USDT confirmed by Binance API
    const creditInr = Math.max(1, Number((receivedUsdt * deposit.exchangeRate).toFixed(2)));

    const orderIdToLock = payment.orderId || cleanTxnId;
    const txnIdToLock = payment.transactionId || cleanTxnId;
    const lockIds = Array.from(new Set([cleanTxnId, orderIdToLock, txnIdToLock]));

    const result = await prisma.$transaction(async (tx) => {
      // Re-verify inside lock
      const concurrentCheck = await tx.paymentDeposit.findFirst({
        where: {
          status: "VERIFIED",
          txnId: { in: lockIds },
        },
      });
      if (concurrentCheck) {
        throw new Error("This Binance Order ID has already been claimed.");
      }

      // Release the identifiers from other unverified records so the unique
      // constraint on txnId does not block this genuine credit.
      await tx.paymentDeposit.updateMany({
        where: {
          id: { not: deposit.id },
          status: { not: "VERIFIED" },
          txnId: { in: lockIds },
        },
        data: { txnId: null },
      });

      // A. Update deposit status to VERIFIED
      const updatedDeposit = await tx.paymentDeposit.update({
        where: { id: deposit.id },
        data: {
          status: "VERIFIED",
          txnId: orderIdToLock,
          senderBinanceId: payment.senderUid || senderBinanceId?.trim() || null,
          inrAmount: creditInr,
          usdtAmount: receivedUsdt,
          verifiedAt: new Date(),
          rejectionReason: null,
          rawVerification: JSON.stringify({
            verifiedAt: new Date().toISOString(),
            matchedBy: verification.matchedBy,
            orderId: payment.orderId,
            transactionId: payment.transactionId,
            amount: receivedUsdt,
            currency: payment.currency,
            senderUid: payment.senderUid,
            receiverUid: payment.receiverUid,
            transactionTime: payment.transactionTime,
          }),
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
      autoVerifyStatus: "VERIFIED" as const,
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
      rejectionReason: `Not auto-verified: ${failureReason}`,
      rawVerification: JSON.stringify({
        attemptedAt: new Date().toISOString(),
        cleanTxnId,
        status: verification.status,
        failureReason,
        apiError: verification.apiError,
        verificationResult: verification.payment,
      }),
    },
  });

  let userMessage: string;
  if (verification.status === "API_ERROR" || verification.status === "NOT_CONFIGURED") {
    userMessage =
      "Automatic verification is temporarily unavailable. Your Order ID has been saved and our team will credit your wallet shortly.";
  } else if (verification.status === "INVALID") {
    userMessage = `${failureReason}. Your Order ID has been saved for admin review.`;
  } else {
    userMessage =
      "We couldn't confirm this Order ID on Binance yet. If you just paid, wait a minute and tap Verify payment again. Your details are saved for admin review.";
  }

  return {
    success: false,
    requiresAdminReview: true,
    autoVerifyStatus: verification.status,
    error: userMessage,
    message: userMessage,
    deposit: updatedDeposit,
    failureReason,
    apiError: verification.apiError,
  };
}

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
  matchedBy?: "ORDER_ID" | "TRANSACTION_ID";
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
  if (!receiverUid) {
    return "Binance did not report a recipient for this transaction, so it cannot be auto-approved";
  }
  if (adminUid && receiverUid !== adminUid) {
    return `Payment was sent to Binance ID ${payment.receiverUid}, not the official deposit Binance ID ${ADMIN_BINANCE_UID}`;
  }

  return null;
}

/**
 * Live verification against the receiving Binance Pay account.
 *
 * The ONLY thing that can match a payment is the Binance Order ID / Transaction ID
 * that the payer received in their Binance receipt. Amount-only or sender-only
 * fallbacks are intentionally NOT allowed: they would let somebody claim another
 * customer's payment by guessing an amount or a public UID.
 */
export async function queryBinanceIncomingPayment({
  searchInput,
}: {
  searchInput: string;
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

  const payments = feed.transactions.map(toBinancePayment);

  for (const payment of payments) {
    const orderKey = normalizeBinanceId(payment.orderId);
    const txnKey = normalizeBinanceId(payment.transactionId);

    if ((orderKey && searchKeys.has(orderKey)) || (txnKey && searchKeys.has(txnKey))) {
      const invalidReason = validateIncomingPayment(payment);
      if (invalidReason) {
        return { status: "INVALID", reason: invalidReason, payment, matchedBy: "ORDER_ID" };
      }
      return {
        status: "VERIFIED",
        matchedBy: orderKey && searchKeys.has(orderKey) ? "ORDER_ID" : "TRANSACTION_ID",
        payment,
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
  autoVerifyStatus?: BinanceVerificationResult["status"] | "ALREADY_CLAIMED";
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

  // 1. Resolve the deposit being verified and enforce ownership before anything else.
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

  if (deposit && deposit.userId !== userId) {
    throw new Error("Unauthorized: Deposit belongs to another user.");
  }

  if (deposit && deposit.status === "VERIFIED") {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true } });
    return {
      success: true,
      alreadyCredited: true,
      newBalance: user?.walletBalance ?? deposit.inrAmount,
      deposit,
      message: "This deposit has already been credited to your wallet balance.",
    };
  }

  // 2. An Order ID may only ever be credited ONCE - to the account that claimed it.
  const duplicateTxn = await prisma.paymentDeposit.findFirst({
    where: {
      status: "VERIFIED",
      txnId: { in: variantList },
    },
  });

  if (duplicateTxn) {
    if (duplicateTxn.userId === userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true } });
      return {
        success: true,
        alreadyCredited: true,
        newBalance: user?.walletBalance ?? duplicateTxn.inrAmount,
        deposit: duplicateTxn,
        message: `This Binance payment (₹${duplicateTxn.inrAmount.toFixed(2)}) has already been credited to your wallet.`,
      };
    }

    // Do not leak another account's deposit details.
    return {
      success: false,
      requiresAdminReview: false,
      autoVerifyStatus: "ALREADY_CLAIMED",
      error:
        "This Binance Order ID has already been claimed by another account. If you believe this is a mistake, contact support with your Binance receipt.",
      message:
        "This Binance Order ID has already been claimed by another account. If you believe this is a mistake, contact support with your Binance receipt.",
      deposit: null,
      failureReason: "Order ID already claimed by another account",
    };
  }

  // 3. Create a pending deposit on the fly if the customer never created one.
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

  // 4. An Order ID can only ever belong to ONE account.
  const conflictingDeposits = await prisma.paymentDeposit.findMany({
    where: { txnId: { in: variantList }, id: { not: deposit.id } },
    orderBy: { createdAt: "desc" },
  });

  for (const conflicting of conflictingDeposits) {
    if (conflicting.status === "VERIFIED") {
      if (conflicting.userId === userId) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true } });
        return {
          success: true,
          alreadyCredited: true,
          newBalance: user?.walletBalance ?? conflicting.inrAmount,
          deposit: conflicting,
          message: `This Binance payment (₹${conflicting.inrAmount.toFixed(2)}) has already been credited to your wallet.`,
        };
      }

      return {
        success: false,
        requiresAdminReview: false,
        autoVerifyStatus: "ALREADY_CLAIMED",
        error:
          "This Binance Order ID has already been claimed by another account. If you believe this is a mistake, contact support with your Binance receipt.",
        message:
          "This Binance Order ID has already been claimed by another account. If you believe this is a mistake, contact support with your Binance receipt.",
        deposit: null,
        failureReason: "Order ID already claimed by another account",
      };
    }

    // Never release an Order ID that another account already submitted - that would
    // let someone hijack a queued deposit by racing the real payer for it.
    if (conflicting.userId !== userId && conflicting.status !== "REJECTED") {
      return {
        success: false,
        requiresAdminReview: true,
        autoVerifyStatus: "ALREADY_CLAIMED",
        error:
          "This Order ID is already linked to another account's deposit. If you believe this is a mistake, contact support with your Binance receipt.",
        message:
          "This Order ID is already linked to another account's deposit. If you believe this is a mistake, contact support with your Binance receipt.",
        deposit,
        failureReason: "Order ID is already attached to another account's deposit",
      };
    }
  }

  // Same account re-submitting the same Order ID: release the stale record so the
  // unique constraint cannot block this attempt.
  const sameUserStale = conflictingDeposits.find(
    (existing) => existing.userId === userId && existing.status !== "REJECTED"
  );
  if (sameUserStale) {
    await prisma.paymentDeposit.update({
      where: { id: sameUserStale.id },
      data: { txnId: null },
    });
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

  // Binance Pay history can lag a few seconds behind the payment confirmation,
  // so retry briefly before queuing the deposit for manual review.
  let verification = await queryBinanceIncomingPayment({ searchInput: cleanTxnId });

  for (let attempt = 1; attempt <= 2; attempt++) {
    // Only "not found yet" is worth re-checking: Binance history can lag behind the
    // payment confirmation. Auth/network errors were already retried across hosts.
    if (verification.status !== "NOT_FOUND") break;
    await sleep(1500);
    verification = await queryBinanceIncomingPayment({ searchInput: cleanTxnId });
  }

  const failureReason = verification.reason || "Payment could not be matched on Binance";

  // =========================================================================
  // CASE A: AUTOMATED MATCH SUCCESSFUL -> CREDIT WALLET IMMEDIATELY
  // =========================================================================
  if (verification.status === "VERIFIED" && verification.payment) {
    const payment = verification.payment;
    const receivedUsdt = payment.amount || 0;
    if (receivedUsdt <= 0) {
      throw new Error("Binance reported an invalid amount for this payment.");
    }

    // The credited INR is derived from the USDT that Binance actually confirms was
    // received, at the rate stored on the deposit. It can never be inflated by the client.
    const creditInr = Math.max(0.01, Number((receivedUsdt * deposit.exchangeRate).toFixed(2)));

    const requestedUsdt = deposit.usdtAmount || 0;
    const amountTolerance = Math.max(0.02, requestedUsdt * 0.01);
    const amountMatches =
      requestedUsdt > 0 && Math.abs(receivedUsdt - requestedUsdt) <= amountTolerance;

    const orderIdToLock = payment.orderId || cleanTxnId;
    const txnIdToLock = payment.transactionId || cleanTxnId;
    const lockIds = Array.from(new Set([cleanTxnId, orderIdToLock, txnIdToLock]));

    let result: { updatedDeposit: any; newBalance: number };
    try {
      result = await prisma.$transaction(async (tx) => {
        // Re-verify inside the transaction: no other account may already own this payment.
        const concurrentCheck = await tx.paymentDeposit.findFirst({
          where: {
            status: "VERIFIED",
            txnId: { in: lockIds },
          },
        });
        if (concurrentCheck) {
          throw new Error("This Binance Order ID has already been claimed.");
        }

        // Release identifiers from this account's own stale records only. Another
        // account's claim is never released (it would allow payment hijacking).
        await tx.paymentDeposit.updateMany({
          where: {
            id: { not: deposit.id },
            userId,
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
              receivedUsdt,
              requestedUsdt,
              amountMatches,
              exchangeRate: deposit.exchangeRate,
              creditedInr: creditInr,
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
        await tx.walletTransaction.create({
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
        };
      });
    } catch (err: any) {
      // Unique constraint on txnId: another account won the race for this payment.
      if (err?.code === "P2002" || /already been claimed/i.test(err?.message || "")) {
        return {
          success: false,
          requiresAdminReview: true,
          autoVerifyStatus: "ALREADY_CLAIMED",
          error:
            "This Order ID has already been claimed by another account. If you believe this is a mistake, contact support with your Binance receipt.",
          message:
            "This Order ID has already been claimed by another account. If you believe this is a mistake, contact support with your Binance receipt.",
          deposit,
          failureReason: "Duplicate claim detected",
        };
      }
      throw err;
    }

    const amountNote = amountMatches
      ? ""
      : ` Binance confirmed ${receivedUsdt.toFixed(2)} USDT instead of the requested ${requestedUsdt.toFixed(
          2
        )} USDT, so the credit reflects the amount actually received.`;

    return {
      success: true,
      verified: true,
      autoVerifyStatus: "VERIFIED" as const,
      newBalance: result.newBalance,
      deposit: result.updatedDeposit,
      message: `Payment verified instantly! ₹${creditInr.toFixed(2)} has been credited to your wallet.${amountNote}`,
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

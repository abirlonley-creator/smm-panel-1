export interface ProviderBalance {
  balance: number;
  currency: string;
  rawBalance: string;
}

export interface CachedProviderBalance extends ProviderBalance {
  lastSyncAt: Date;
}

export const DEFAULT_PROVIDER_BALANCE_REFRESH_INTERVAL_MS = 60_000;
const MIN_PROVIDER_BALANCE_REFRESH_INTERVAL_MS = 10_000;
const MAX_PROVIDER_BALANCE_REFRESH_INTERVAL_MS = 60 * 60 * 1_000;

/** Parses a provider balance response, tolerating common real-world variations:
 *  - balance as a decimal string OR as a number (some panels return a number)
 *  - currency code in lowercase (normalized to uppercase before validation)
 *  - extra whitespace around values
 */
export function parseProviderBalanceResponse(
  payload: unknown,
  httpStatus = 200
): ProviderBalance {
  if (httpStatus < 200 || httpStatus >= 300) {
    throw new Error(`Provider API returned HTTP ${httpStatus}`);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Provider returned an invalid balance response");
  }

  const data = payload as Record<string, unknown>;
  if (typeof data.error === "string" && data.error.trim()) {
    throw new Error(`Provider API error: ${data.error.trim()}`);
  }

  // Accept balance as a string OR a number (some panels return a number).
  let rawBalance: string;
  if (typeof data.balance === "number") {
    if (!Number.isFinite(data.balance) || data.balance < 0) {
      throw new Error("Provider response has an invalid balance field");
    }
    rawBalance = String(data.balance);
  } else if (typeof data.balance === "string" && /^\d+(?:\.\d+)?$/.test(data.balance.trim())) {
    rawBalance = data.balance.trim();
  } else {
    throw new Error("Provider response has an invalid balance field");
  }

  const balance = Number(rawBalance);
  if (!Number.isFinite(balance) || balance < 0) {
    throw new Error("Provider response has an invalid balance field");
  }

  // Normalize currency: accept lowercase and uppercase (e.g. "usd" → "USD").
  const rawCurrency = typeof data.currency === "string" ? data.currency.trim().toUpperCase() : "";
  if (!/^[A-Z]{3}$/.test(rawCurrency)) {
    throw new Error(`Provider response has an invalid currency field (received: ${JSON.stringify(data.currency)})`);
  }

  return { balance, currency: rawCurrency, rawBalance };
}

export function getProviderBalanceRefreshIntervalMs(
  configuredValue: string | undefined
): number {
  if (!configuredValue?.trim()) return DEFAULT_PROVIDER_BALANCE_REFRESH_INTERVAL_MS;

  const parsed = Number(configuredValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PROVIDER_BALANCE_REFRESH_INTERVAL_MS;
  }

  return Math.min(
    MAX_PROVIDER_BALANCE_REFRESH_INTERVAL_MS,
    Math.max(MIN_PROVIDER_BALANCE_REFRESH_INTERVAL_MS, Math.floor(parsed))
  );
}

export interface ProviderBalanceSnapshot {
  success: boolean;
  balance: number | null;
  currency: string | null;
  lastSyncAt: Date | null;
  cached: boolean;
  stale: boolean;
  warning?: string;
}

export async function resolveProviderBalanceSnapshot(options: {
  cachedBalance: CachedProviderBalance | null;
  forceRefresh: boolean;
  refreshIntervalMs: number;
  now: Date;
  verifiedAt?: () => Date;
  fetchBalance: () => Promise<ProviderBalance>;
}): Promise<ProviderBalanceSnapshot> {
  const { cachedBalance, forceRefresh, refreshIntervalMs, now, verifiedAt, fetchBalance } = options;
  const cacheAgeMs = cachedBalance ? now.getTime() - cachedBalance.lastSyncAt.getTime() : null;
  const cacheIsFresh = cacheAgeMs !== null && cacheAgeMs >= 0 && cacheAgeMs < refreshIntervalMs;

  if (!forceRefresh && cachedBalance && cacheIsFresh) {
    return {
      success: true,
      balance: cachedBalance.balance,
      currency: cachedBalance.currency,
      lastSyncAt: cachedBalance.lastSyncAt,
      cached: true,
      stale: false,
    };
  }

  try {
    const liveBalance = await fetchBalance();
    return {
      success: true,
      balance: liveBalance.balance,
      currency: liveBalance.currency,
      lastSyncAt: verifiedAt ? verifiedAt() : now,
      cached: false,
      stale: false,
    };
  } catch {
    if (cachedBalance) {
      return {
        success: true,
        balance: cachedBalance.balance,
        currency: cachedBalance.currency,
        lastSyncAt: cachedBalance.lastSyncAt,
        cached: true,
        stale: true,
        warning: "Provider refresh failed. Showing the last verified balance.",
      };
    }

    return {
      success: false,
      balance: null,
      currency: null,
      lastSyncAt: null,
      cached: false,
      stale: true,
      warning: "Provider balance is unavailable because no verified balance is stored.",
    };
  }
}

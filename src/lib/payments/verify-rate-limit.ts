/**
 * Light in-memory rate limiter for Binance Order ID verification attempts.
 *
 * Purpose: stop an attacker from brute-forcing / enumerating Binance Order IDs
 * against the verify endpoint. Each attempt triggers a signed Binance API call,
 * so unbounded retries are both an abuse vector and a cost/latency problem.
 *
 * NOTE: this is per server instance (same trade-off as src/lib/api-v2/auth.ts).
 * It is a deterrent, not a security boundary - correctness of credits is still
 * enforced by the DB unique constraint on PaymentDeposit.txnId.
 */
interface AttemptBucket {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, AttemptBucket>();

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 15;
const MAX_TRACKED_USERS = 5000;

function sweep(now: number) {
  if (attempts.size < MAX_TRACKED_USERS) return;
  attempts.forEach((bucket, key) => {
    if (now > bucket.resetAt) attempts.delete(key);
  });
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

export function checkVerifyRateLimit(userId: string): RateLimitResult {
  const now = Date.now();
  const bucket = attempts.get(userId);

  if (!bucket || now > bucket.resetAt) {
    sweep(now);
    attempts.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0, remaining: MAX_ATTEMPTS_PER_WINDOW - 1 };
  }

  if (bucket.count >= MAX_ATTEMPTS_PER_WINDOW) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      remaining: 0,
    };
  }

  bucket.count++;
  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: MAX_ATTEMPTS_PER_WINDOW - bucket.count,
  };
}

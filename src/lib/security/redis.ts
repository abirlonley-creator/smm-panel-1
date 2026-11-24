import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || "";
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || "";

export const redis = new Redis({
  url: redisUrl || "https://localhost:8079",
  token: redisToken || "dummy_token",
});

/**
 * 5 attempts per 60 seconds for sensitive authentication endpoints
 */
export const authRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  prefix: "aurasmm:ratelimit:auth",
  analytics: true,
});

/**
 * 60 requests per 60 seconds for standard API interactions
 */
export const apiRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "60 s"),
  prefix: "aurasmm:ratelimit:api",
  analytics: true,
});

/**
 * 10 requests per 60 seconds for high-risk admin endpoints
 */
export const adminRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  prefix: "aurasmm:ratelimit:admin",
  analytics: true,
});

/**
 * Extracts client IP from common proxy headers (Cloudflare, Vercel, standard proxies).
 */
export function getClientIp(req: Request): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "127.0.0.1";
}

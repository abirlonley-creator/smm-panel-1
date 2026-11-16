import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export interface ApiAuthResult {
  authenticated: boolean;
  user?: {
    id: string;
    username: string;
    role: string;
    walletBalance: number;
    status: string;
  };
  apiKey?: {
    id: string;
    name: string;
    permission: string;
    status: string;
    totalOrders: number;
    totalRequests: number;
  };
  error?: string;
  statusCode?: number;
}

// In-Memory sliding window rate limiter: max 300 requests per 60 seconds per API key
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitBucket>();
const MAX_REQUESTS_PER_MINUTE = 300;

function checkRateLimit(keyId: string): boolean {
  const now = Date.now();
  const bucket = rateLimitMap.get(keyId);

  if (!bucket || now > bucket.resetAt) {
    rateLimitMap.set(keyId, {
      count: 1,
      resetAt: now + 60 * 1000,
    });
    return true;
  }

  if (bucket.count >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }

  bucket.count++;
  return true;
}

/**
 * Extracts and authenticates an incoming API request using either:
 * - Authorization: Bearer <key>
 * - X-API-Key: <key>
 * - query or body "key" parameter
 */
export async function authenticateApiRequest(
  request: Request | NextRequest,
  explicitKey?: string | null
): Promise<ApiAuthResult> {
  let plainKey = explicitKey?.trim();

  if (!plainKey) {
    // 1. Check Authorization: Bearer <key>
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      plainKey = authHeader.slice(7).trim();
    }
  }

  if (!plainKey) {
    // 2. Check X-API-Key header
    plainKey = request.headers.get("x-api-key") || request.headers.get("X-API-Key") || undefined;
    if (plainKey) plainKey = plainKey.trim();
  }

  if (!plainKey) {
    return {
      authenticated: false,
      error: "Missing API Key. Provide 'Authorization: Bearer <KEY>' or 'X-API-Key: <KEY>'.",
      statusCode: 401,
    };
  }

  // Basic format check
  if (!plainKey.startsWith("aura_live_")) {
    return {
      authenticated: false,
      error: "Invalid API Key format. Keys must begin with 'aura_live_'.",
      statusCode: 401,
    };
  }

  // Hash plain key using SHA-256
  const keyHash = crypto.createHash("sha256").update(plainKey).digest("hex");

  // Query key from database
  const apiKeyRecord = await prisma.userApiKey.findUnique({
    where: { keyHash },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          role: true,
          walletBalance: true,
          status: true,
        },
      },
    },
  });

  if (!apiKeyRecord) {
    return {
      authenticated: false,
      error: "Invalid API Key.",
      statusCode: 401,
    };
  }

  if (apiKeyRecord.status !== "ACTIVE") {
    return {
      authenticated: false,
      error: "API Key has been revoked or is no longer active.",
      statusCode: 401,
    };
  }

  if (!apiKeyRecord.user || apiKeyRecord.user.status !== "ACTIVE") {
    return {
      authenticated: false,
      error: "The account associated with this API key is inactive or disabled.",
      statusCode: 401,
    };
  }

  // Rate Limiting check
  if (!checkRateLimit(apiKeyRecord.id)) {
    return {
      authenticated: false,
      error: "Rate limit exceeded. Maximum 300 requests per minute per key.",
      statusCode: 429,
    };
  }

  // Asynchronously bump last used timestamp and total requests
  prisma.userApiKey
    .update({
      where: { id: apiKeyRecord.id },
      data: {
        lastUsedAt: new Date(),
        totalRequests: { increment: 1 },
      },
    })
    .catch(() => {});

  return {
    authenticated: true,
    user: apiKeyRecord.user,
    apiKey: {
      id: apiKeyRecord.id,
      name: apiKeyRecord.name,
      permission: apiKeyRecord.permission,
      status: apiKeyRecord.status,
      totalOrders: apiKeyRecord.totalOrders,
      totalRequests: apiKeyRecord.totalRequests,
    },
  };
}

/**
 * Log an API telemetry event to user_api_logs
 */
export async function logApiCall(params: {
  apiKeyId?: string | null;
  userId: string;
  keyName: string;
  endpoint: string;
  method: string;
  statusCode: number;
  ipAddress?: string | null;
  durationMs: number;
  success: boolean;
  error?: string | null;
}) {
  try {
    await prisma.userApiLog.create({
      data: {
        apiKeyId: params.apiKeyId || null,
        userId: params.userId,
        keyName: params.keyName,
        endpoint: params.endpoint,
        method: params.method.toUpperCase(),
        statusCode: params.statusCode,
        ipAddress: params.ipAddress || null,
        durationMs: Math.max(0, params.durationMs),
        success: params.success,
        error: params.error || null,
      },
    });
  } catch (err) {
    // Non-blocking telemetry failure
    console.error("[API_TELEMETRY_LOG_ERROR]", err);
  }
}

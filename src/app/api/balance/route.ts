import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth/session";
import { refreshUserBalance, getUserProviderConfig } from "@/lib/provider/user-provider";
import { decryptApiKey } from "@/lib/security/crypto";
import { StandardSMMv2Provider, MockSMMProvider } from "@/lib/provider/adapter";

export const dynamic = "force-dynamic";

interface BalanceCacheEntry {
  data: any;
  timestamp: number;
}
const BALANCE_CACHE = new Map<string, BalanceCacheEntry>();
const BALANCE_TTL_MS = 15 * 1000; // 15s memory cache for 0ms header/sidebar speed

/**
 * GET /api/balance
 * Returns the balance for the authenticated user's active provider and all connected providers.
 * There is NO combined or summed balance anywhere.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";
    const requestedProviderId = searchParams.get("providerId")?.trim();

    const session = await getAuthSession(request);

    if (session.authenticated && session.user) {
      const userId = session.user.id;
      const isAdmin = session.user.role === "ADMIN";

      // Non-admin regular users only have their personal wallet balance.
      // Upstream provider APIs, balances and credentials are strictly hidden.
      if (!isAdmin) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { walletBalance: true },
        });

        const walletBal = user?.walletBalance ?? 0;
        return NextResponse.json({
          success: true,
          role: "USER",
          isAdmin: false,
          walletBalance: walletBal,
          balance: walletBal,
          currency: "INR",
          count: 0,
          providers: [],
          activeProviderId: null,
          activeProvider: null,
          isMock: false,
          hasApiKey: false,
        });
      }

      const cacheKey = `${userId}:${requestedProviderId || "active"}`;

      if (!forceRefresh) {
        const cached = BALANCE_CACHE.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < BALANCE_TTL_MS) {
          return NextResponse.json(cached.data, {
            headers: {
              "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
              "X-Cache": "HIT",
            },
          });
        }
      }

      // 1. Get user preferences for active provider
      const pref = await prisma.userPreference.findUnique({
        where: { userId },
      });

      // 2. Fetch all user provider connections
      const connections = await prisma.userProviderConnection.findMany({
        where: { userId, active: true },
        orderBy: { createdAt: "asc" },
      });

      if (connections.length === 0) {
        // Return null balance when no provider is connected
        return NextResponse.json({
          success: true,
          count: 0,
          providers: [],
          activeProviderId: null,
          activeProvider: null,
          balance: null,
          currency: "USD",
          providerName: null,
          isMock: true,
          hasApiKey: false,
        });
      }

      // Determine active provider ID
      let activeId = requestedProviderId;
      if (!activeId && pref?.activeProviderId) {
        if (connections.some((c) => c.id === pref.activeProviderId)) {
          activeId = pref.activeProviderId;
        }
      }
      if (!activeId) {
        activeId = connections[0].id;
      }

      // If forceRefresh requested, refresh the active provider
      let targetConns = connections;
      if (forceRefresh) {
        await refreshUserBalance(userId, activeId);
        targetConns = await prisma.userProviderConnection.findMany({
          where: { userId, active: true },
          orderBy: { createdAt: "asc" },
        });
      }

      const providerList = targetConns.map((c) => {
        const balanceAgeMs = c.lastSyncAt ? Date.now() - c.lastSyncAt.getTime() : null;
        const stale = c.isMock ? false : c.balance === null || balanceAgeMs === null || balanceAgeMs > 60000;
        return {
          id: c.id,
          name: c.name,
          balance: c.balance,
          currency: c.currency || "USD",
          isMock: c.isMock,
          hasApiKey: Boolean(c.apiKeyEncrypted),
          lastSyncAt: c.lastSyncAt,
          lastError: c.lastError,
          stale,
          status: c.balance !== null ? "ok" : "unavailable",
          warning: c.lastError || (c.isMock ? "Mock Mode" : undefined),
        };
      });

      const activeConn = providerList.find((p) => p.id === activeId) || providerList[0];

      const responsePayload = {
        success: true,
        count: providerList.length,
        providers: providerList,
        activeProviderId: activeConn.id,
        activeProvider: activeConn,
        balance: activeConn.balance,
        currency: activeConn.currency,
        providerName: activeConn.name,
        isMock: activeConn.isMock,
        hasApiKey: activeConn.hasApiKey,
        stale: activeConn.stale,
        warning: activeConn.warning || null,
        refreshIntervalMs: 60000,
      };

      BALANCE_CACHE.set(cacheKey, { data: responsePayload, timestamp: Date.now() });

      return NextResponse.json(responsePayload, {
        headers: {
          "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
          "X-Cache": "MISS",
        },
      });
    }

    // Unauthenticated fallback: return mock state gracefully
    return NextResponse.json({
      success: true,
      count: 0,
      providers: [],
      activeProviderId: null,
      activeProvider: null,
      balance: null,
      currency: "USD",
      isMock: true,
      hasApiKey: false,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Failed to retrieve balance: ${msg}` },
      { status: 500 }
    );
  }
}

/**
 * POST /api/balance
 * Updates the user's active provider selection preference.
 */
export async function POST(request: Request) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden: Only administrators can configure providers." }, { status: 403 });
    }

    const body = await request.json();
    const providerId = body.providerId?.trim();

    if (!providerId) {
      return NextResponse.json({ success: false, error: "providerId is required" }, { status: 400 });
    }

    // Verify provider belongs to user
    const conn = await prisma.userProviderConnection.findFirst({
      where: { id: providerId, userId: session.user.id },
    });

    if (!conn) {
      return NextResponse.json({ success: false, error: "Provider connection not found" }, { status: 404 });
    }

    // Save choice in user_preferences
    await prisma.userPreference.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        activeProviderId: providerId,
      },
      update: {
        activeProviderId: providerId,
      },
    });

    return NextResponse.json({
      success: true,
      activeProviderId: providerId,
      activeProvider: {
        id: conn.id,
        name: conn.name,
        balance: conn.balance,
        currency: conn.currency,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

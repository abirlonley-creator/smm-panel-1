import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth/session";
import { refreshUserBalance, getUserProviderConfig } from "@/lib/provider/user-provider";
import { getActiveProvider } from "@/lib/provider/adapter";
import {
  getProviderBalanceRefreshIntervalMs,
  resolveProviderBalanceSnapshot,
} from "@/lib/provider/balance";

export const dynamic = "force-dynamic";

/**
 * GET /api/balance
 * Returns the current authenticated provider balance for the logged-in user.
 * Supports `?refresh=true` to force a live fetch from the external provider API.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";

    const session = await getAuthSession(request);

    // If request is from an authenticated user, return their user-specific provider balance
    if (session.authenticated && session.user) {
      if (forceRefresh) {
        const refreshResult = await refreshUserBalance(session.user.id);
        const userCfg = await getUserProviderConfig(session.user.id);
        return NextResponse.json({
          success: refreshResult.balance !== null,
          balance: refreshResult.balance,
          currency: refreshResult.currency || userCfg.currency,
          rawBalance: refreshResult.balance !== null ? String(refreshResult.balance) : null,
          cached: false,
          stale: refreshResult.stale,
          warning: refreshResult.warning || null,
          isMock: userCfg.isMock,
          hasApiKey: userCfg.hasApiKey,
          providerName: userCfg.name,
          refreshIntervalMs: 60000,
        });
      }

      const userCfg = await getUserProviderConfig(session.user.id);
      return NextResponse.json({
        success: userCfg.balance !== null,
        balance: userCfg.balance,
        currency: userCfg.currency,
        rawBalance: userCfg.balance !== null ? String(userCfg.balance) : null,
        cached: true,
        stale: userCfg.balanceIsStale,
        warning: userCfg.isMock ? "Mock provider mode active" : userCfg.lastError || null,
        isMock: userCfg.isMock,
        hasApiKey: userCfg.hasApiKey,
        providerName: userCfg.name,
        refreshIntervalMs: 60000,
      });
    }

    // Fallback: System-level provider balance (for unauthenticated callers or test suite)
    const { adapter, config } = await getActiveProvider();

    const dbConfig = await prisma.providerConfig.findUnique({
      where: { id: config.id },
    });
    const refreshIntervalMs = getProviderBalanceRefreshIntervalMs(
      process.env.PROVIDER_BALANCE_REFRESH_INTERVAL_MS
    );
    // Serve from DB cache when config is live (not mock) and a valid balance is stored.
    // Normalize currency to uppercase to match both old and new stored values.
    const storedCurrency = (dbConfig?.currency ?? "").trim().toUpperCase();
    const cachedBalance =
      !config.isMock &&
      typeof dbConfig?.balance === "number" &&
      Number.isFinite(dbConfig.balance) &&
      dbConfig.balance >= 0 &&
      /^[A-Z]{3}$/.test(storedCurrency) &&
      dbConfig.lastSyncAt
        ? {
            balance: dbConfig.balance,
            currency: storedCurrency,
            rawBalance: String(dbConfig.balance),
            lastSyncAt: dbConfig.lastSyncAt,
          }
        : null;

    const snapshot = await resolveProviderBalanceSnapshot({
      cachedBalance,
      forceRefresh,
      refreshIntervalMs,
      now: new Date(),
      verifiedAt: () => new Date(),
      fetchBalance: async () => {
        if (config.isMock || !dbConfig?.apiKey) {
          throw new Error("No live provider account is configured");
        }
        return adapter.getBalance();
      },
    });

    if (snapshot.success && !snapshot.cached && snapshot.lastSyncAt) {
      try {
        await prisma.providerConfig.update({
          where: { id: config.id },
          data: {
            balance: snapshot.balance,
            currency: snapshot.currency!,
            lastSyncAt: snapshot.lastSyncAt,
          },
        });
      } catch (error) {
        console.error("Failed to persist verified provider balance:", error);
      }
    }

    return NextResponse.json(
      {
        ...snapshot,
        isMock: config.isMock,
        providerName: config.name,
        refreshIntervalMs,
      },
      { status: snapshot.success ? 200 : 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Failed to retrieve balance: ${msg}` },
      { status: 500 }
    );
  }
}

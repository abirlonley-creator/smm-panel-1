import { decryptApiKey } from "../security/crypto";
import { StandardSMMv2Provider, MockSMMProvider, SMMProviderAdapter } from "./adapter";
import { prisma } from "../prisma";

export interface UserConnectionRecord {
  id: string;
  userId: string;
  name: string;
  apiUrl: string;
  apiKeyEncrypted?: string | null;
  isMock: boolean;
  active: boolean;
  balance: number | null;
  currency: string;
  lastSyncAt: Date | null;
  lastError: string | null;
}

export interface ProviderExecutionResult<T> {
  connectionId: string;
  providerName: string;
  success: boolean;
  data?: T;
  error?: string;
  durationMs: number;
}

const PROVIDER_TIMEOUT_MS = 8000;

/**
 * Creates an adapter instance for a user provider connection.
 */
export function getAdapterForUserConnection(connection: UserConnectionRecord): SMMProviderAdapter {
  if (connection.isMock || !connection.apiKeyEncrypted) {
    return new MockSMMProvider();
  }

  const rawKey = decryptApiKey(connection.apiKeyEncrypted);
  if (!rawKey || rawKey.trim() === "") {
    return new MockSMMProvider();
  }

  return new StandardSMMv2Provider(connection.apiUrl, rawKey);
}

/**
 * Executes an operation with a per-provider timeout and error isolation.
 * One provider failing or timing out NEVER throws or blocks another provider.
 */
export async function executeWithProviderTimeout<T>(
  connection: UserConnectionRecord,
  operation: (adapter: SMMProviderAdapter) => Promise<T>,
  timeoutMs = PROVIDER_TIMEOUT_MS
): Promise<ProviderExecutionResult<T>> {
  const start = Date.now();
  const adapter = getAdapterForUserConnection(connection);

  try {
    const result = await Promise.race([
      operation(adapter),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: Provider ${connection.name} did not respond within ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);

    return {
      connectionId: connection.id,
      providerName: connection.name,
      success: true,
      data: result,
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[CONCURRENT_RUNNER] Error for ${connection.name}:`, message);

    // Save lastError to connection record if exists in database (skip for in-memory test fixtures)
    if (connection.id && !connection.id.startsWith("conn-") && !connection.id.startsWith("mock-")) {
      try {
        await prisma.userProviderConnection.update({
          where: { id: connection.id },
          data: { lastError: message },
        });
      } catch {
        // Ignore if mock connection or record not found
      }
    }

    return {
      connectionId: connection.id,
      providerName: connection.name,
      success: false,
      error: message,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Fetches balances across multiple user connections concurrently using Promise.allSettled.
 * Respects 30-second short cache unless forceRefresh is true.
 */
export async function refreshAllUserProviderBalances(
  userId: string,
  forceRefresh = false
) {
  const connections = await prisma.userProviderConnection.findMany({
    where: { userId, active: true },
  });

  const now = Date.now();
  const CACHE_TTL_MS = 30000;

  const tasks = connections.map(async (conn) => {
    // Check short cache
    if (!forceRefresh && conn.balance !== null && conn.lastSyncAt) {
      const age = now - conn.lastSyncAt.getTime();
      if (age < CACHE_TTL_MS) {
        return {
          connectionId: conn.id,
          providerName: conn.name,
          success: true,
          cached: true,
          balance: conn.balance,
          currency: conn.currency,
          lastSyncAt: conn.lastSyncAt,
          durationMs: 0,
        };
      }
    }

    const execResult = await executeWithProviderTimeout(conn, async (adapter) => {
      return await adapter.getBalance();
    });

    if (execResult.success && execResult.data) {
      const bal = execResult.data.balance;
      const cur = execResult.data.currency || conn.currency;

      await prisma.userProviderConnection.update({
        where: { id: conn.id },
        data: {
          balance: bal,
          currency: cur,
          lastSyncAt: new Date(),
          lastError: null,
        },
      });

      return {
        connectionId: conn.id,
        providerName: conn.name,
        success: true,
        cached: false,
        balance: bal,
        currency: cur,
        lastSyncAt: new Date(),
        durationMs: execResult.durationMs,
      };
    } else {
      return {
        connectionId: conn.id,
        providerName: conn.name,
        success: false,
        cached: false,
        balance: conn.balance,
        currency: conn.currency,
        lastSyncAt: conn.lastSyncAt,
        error: execResult.error,
        durationMs: execResult.durationMs,
      };
    }
  });

  const results = await Promise.allSettled(tasks);
  return results.map((res, i) => {
    if (res.status === "fulfilled") {
      return res.value;
    } else {
      return {
        connectionId: connections[i].id,
        providerName: connections[i].name,
        success: false,
        cached: false,
        balance: connections[i].balance,
        currency: connections[i].currency,
        error: res.reason?.message || "Unknown error",
        durationMs: 0,
      };
    }
  });
}

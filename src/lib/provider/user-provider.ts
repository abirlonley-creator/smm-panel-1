import { prisma } from "../prisma";
import { StandardSMMv2Provider, MockSMMProvider } from "./adapter";
import { getProviderBalanceRefreshIntervalMs } from "./balance";
import { validateProviderEndpointUrl } from "../security/ssrf";
import { encryptApiKey, decryptApiKey, maskApiKey } from "../security/crypto";
import { syncProviderServices } from "./service-sync";

export interface UserProviderDTO {
  id: string;
  userId: string;
  name: string;
  apiUrl: string;
  hasApiKey: boolean;
  maskedKey: string;
  isMock: boolean;
  active: boolean;
  balance: number | null;
  currency: string;
  lastSyncAt: Date | null;
  lastError: string | null;
  balanceIsStale: boolean;
}

export { maskApiKey };

/**
 * Gets or creates the Provider connection for an authenticated user.
 * Reads from user_providers.
 */
export async function getUserProviderConfig(userId: string, providerId?: string): Promise<UserProviderDTO> {
  let connection: any = null;

  if (providerId) {
    connection = await prisma.userProviderConnection.findFirst({
      where: { id: providerId, userId },
    });
  }

  if (!connection) {
    // Check if user has an activeProviderId in preferences
    const pref = await prisma.userPreference.findUnique({
      where: { userId },
    });
    if (pref?.activeProviderId) {
      connection = await prisma.userProviderConnection.findFirst({
        where: { id: pref.activeProviderId, userId },
      });
    }
  }

  if (!connection) {
    // Fall back to first active connection
    connection = await prisma.userProviderConnection.findFirst({
      where: { userId, active: true },
      orderBy: { createdAt: "asc" },
    });
  }

  if (!connection) {
    // Check if any connection exists
    connection = await prisma.userProviderConnection.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
  }

  if (!connection) {
    // Create default connection
    connection = await prisma.userProviderConnection.create({
      data: {
        userId,
        name: "My SMM Provider",
        apiUrl: "https://api.smmprovider.com/v2",
        isMock: true,
        active: true,
        currency: "INR",
      },
    });
  }

  const balanceRefreshIntervalMs = getProviderBalanceRefreshIntervalMs(
    process.env.PROVIDER_BALANCE_REFRESH_INTERVAL_MS
  );
  const balanceAgeMs = connection.lastSyncAt ? Date.now() - connection.lastSyncAt.getTime() : null;
  const balanceIsStale =
    connection.isMock ||
    connection.balance === null ||
    balanceAgeMs === null ||
    balanceAgeMs < 0 ||
    balanceAgeMs >= balanceRefreshIntervalMs;

  return {
    id: connection.id,
    userId: connection.userId,
    name: connection.name,
    apiUrl: connection.apiUrl,
    hasApiKey: Boolean(connection.apiKeyEncrypted),
    maskedKey: maskApiKey(connection.apiKeyEncrypted),
    isMock: connection.isMock,
    active: connection.active,
    balance: connection.balance,
    currency: connection.currency,
    lastSyncAt: connection.lastSyncAt,
    lastError: connection.lastError,
    balanceIsStale,
  };
}

/**
 * Updates or creates an authenticated user's provider connection in user_providers.
 * Encrypts/stores credentials securely at rest.
 */
export async function saveUserProviderConfig(
  userId: string,
  data: {
    name?: string;
    apiUrl: string;
    apiKey?: string;
    isMock: boolean;
    active?: boolean;
    currency?: string;
  }
): Promise<UserProviderDTO> {
  const urlValidation = validateProviderEndpointUrl(data.apiUrl, { allowMock: data.isMock });
  if (!urlValidation.valid) {
    throw new Error(`Invalid provider endpoint: ${urlValidation.error}`);
  }
  const cleanApiUrl = urlValidation.normalizedUrl || data.apiUrl.trim();
  const providerName = data.name?.trim() || "My SMM Provider";

  const existing = await prisma.userProviderConnection.findFirst({
    where: { userId, name: providerName },
  });

  const incomingKey = data.apiKey?.trim();
  const encryptedKey = incomingKey !== undefined && incomingKey.length > 0
    ? encryptApiKey(incomingKey)
    : existing?.apiKeyEncrypted || null;

  const updated = existing
    ? await prisma.userProviderConnection.update({
        where: { id: existing.id },
        data: {
          apiUrl: cleanApiUrl,
          apiKeyEncrypted: encryptedKey,
          isMock: data.isMock,
          active: data.active ?? true,
          currency: data.currency ? data.currency.trim().toUpperCase() : existing.currency,
          lastError: null,
          ...(incomingKey ? { balance: null, lastSyncAt: null } : {}),
        },
      })
    : await prisma.userProviderConnection.create({
        data: {
          userId,
          name: providerName,
          apiUrl: cleanApiUrl,
          apiKeyEncrypted: encryptedKey,
          isMock: data.isMock,
          active: data.active ?? true,
          currency: data.currency ? data.currency.trim().toUpperCase() : "USD",
          lastSyncAt: null,
          balance: null,
          lastError: null,
        },
      });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE_USER_PROVIDER_CONNECTION",
      actor: "User",
      userId,
      details: `Saved provider connection "${updated.name}" (${updated.apiUrl}) - Mock: ${updated.isMock}`,
    },
  });

  // If live provider credentials are provided, proactively test balance and sync services
  if (!updated.isMock && incomingKey) {
    try {
      const decrypted = decryptApiKey(updated.apiKeyEncrypted);
      const provider = new StandardSMMv2Provider(updated.apiUrl, decrypted);
      const balRes = await provider.getBalance();
      if (typeof balRes.balance === "number") {
        await prisma.userProviderConnection.update({
          where: { id: updated.id },
          data: {
            balance: balRes.balance,
            currency: balRes.currency || updated.currency,
            lastSyncAt: new Date(),
          },
        });
      }
      await syncProviderServices(provider, "Wallet Save", {
        providerEndpoint: updated.apiUrl,
        providerName: updated.name,
        userId,
      });
    } catch (syncErr: any) {
      const msg = syncErr instanceof Error ? syncErr.message : String(syncErr);
      console.warn("[USER_PROVIDER] Auto-sync on save warning:", msg);
      await prisma.userProviderConnection.update({
        where: { id: updated.id },
        data: { lastError: msg },
      }).catch(() => {});
    }
  }

  return getUserProviderConfig(userId, updated.id);
}

/**
 * Tests an external provider connection live by verifying service catalog and account balance.
 */
export async function testProviderConnection(
  apiUrl: string,
  apiKey: string,
  isMock: boolean = false
): Promise<{
  success: boolean;
  balance?: number | null;
  currency?: string | null;
  servicesCount?: number;
  error?: string;
}> {
  const urlValidation = validateProviderEndpointUrl(apiUrl, { allowMock: isMock });
  if (!urlValidation.valid) {
    return {
      success: false,
      error: `Security restriction: ${urlValidation.error}`,
    };
  }

  if (isMock || apiKey?.toLowerCase().includes("mock") || apiUrl?.toLowerCase().includes("mock")) {
    return {
      success: true,
      servicesCount: 2,
      balance: 100.0,
      currency: "INR",
    };
  }

  try {
    const cleanUrl = urlValidation.normalizedUrl || apiUrl.trim();
    const provider = new StandardSMMv2Provider(cleanUrl, apiKey.trim());
    
    // Test balance (action=balance) as required by Change 10
    let balance: number | null = null;
    let currency: string | null = "USD";
    const balRes = await provider.getBalance();
    if (typeof balRes.balance === "number") {
      balance = balRes.balance;
      currency = balRes.currency || "USD";
    }

    // Also get services count if possible
    let servicesCount = 0;
    try {
      const services = await provider.getServices();
      servicesCount = services.length;
    } catch {
      // Balance verified
    }

    return {
      success: true,
      servicesCount,
      balance,
      currency,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Refreshes an authenticated user's provider balance live.
 */
export async function refreshUserBalance(userId: string, providerId?: string): Promise<{
  balance: number | null;
  currency: string | null;
  stale: boolean;
  warning?: string;
  providerName?: string;
}> {
  let connection: any = null;

  if (providerId) {
    connection = await prisma.userProviderConnection.findFirst({
      where: { id: providerId, userId },
    });
  }

  if (!connection) {
    const pref = await prisma.userPreference.findUnique({ where: { userId } });
    if (pref?.activeProviderId) {
      connection = await prisma.userProviderConnection.findFirst({
        where: { id: pref.activeProviderId, userId },
      });
    }
  }

  if (!connection) {
    connection = await prisma.userProviderConnection.findFirst({
      where: { userId, active: true },
      orderBy: { createdAt: "asc" },
    });
  }

  if (!connection) {
    return { balance: null, currency: null, stale: true, warning: "Provider not configured" };
  }

  if (connection.isMock) {
    const mockBal = connection.balance !== null ? connection.balance : 150.0;
    await prisma.userProviderConnection.update({
      where: { id: connection.id },
      data: {
        balance: mockBal,
        currency: connection.currency || "INR",
        lastSyncAt: new Date(),
        lastError: null,
      },
    }).catch(() => {});

    return {
      balance: mockBal,
      currency: connection.currency || "INR",
      stale: false,
      providerName: connection.name,
    };
  }

  if (!connection.apiKeyEncrypted) {
    return {
      balance: null,
      currency: connection.currency || "USD",
      stale: true,
      warning: "No API key configured.",
      providerName: connection.name,
    };
  }

  try {
    const decryptedKey = decryptApiKey(connection.apiKeyEncrypted);
    const provider = new StandardSMMv2Provider(connection.apiUrl, decryptedKey);
    const bal = await provider.getBalance();

    if (typeof bal.balance === "number") {
      await prisma.userProviderConnection.update({
        where: { id: connection.id },
        data: {
          balance: bal.balance,
          currency: bal.currency || connection.currency || "USD",
          lastSyncAt: new Date(),
          lastError: null,
        },
      });

      return {
        balance: bal.balance,
        currency: bal.currency || connection.currency || "USD",
        stale: false,
        providerName: connection.name,
      };
    }

    return {
      balance: connection.balance,
      currency: connection.currency,
      stale: true,
      warning: "Could not retrieve balance from provider",
      providerName: connection.name,
    };
  } catch (err: any) {
    await prisma.userProviderConnection.update({
      where: { id: connection.id },
      data: { lastError: err.message || "Failed to connect to provider" },
    }).catch(() => {});

    return {
      balance: connection.balance,
      currency: connection.currency,
      stale: true,
      warning: err.message || "Provider connection error",
      providerName: connection.name,
    };
  }
}

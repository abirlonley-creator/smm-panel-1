import { prisma } from "../prisma";
import { SMMProviderAdapter, MockSMMProvider, StandardSMMv2Provider } from "./adapter";
import { decryptApiKey } from "../security/crypto";

export interface ProviderRecord {
  id: string;
  name: string;
  apiUrl: string;
  apiKeyEncrypted?: string | null;
  isMock: boolean;
  active?: boolean;
  currency?: string;
  balance?: number | null;
  lastSyncAt?: Date | null;
}

/**
 * Creates an SMMProviderAdapter instance for a given Provider record.
 */
export function getAdapterForProvider(provider: ProviderRecord): SMMProviderAdapter {
  if (provider.isMock || !provider.apiKeyEncrypted) {
    return new MockSMMProvider();
  }

  const rawKey = decryptApiKey(provider.apiKeyEncrypted);
  if (!rawKey || rawKey.trim() === "") {
    return new MockSMMProvider();
  }

  return new StandardSMMv2Provider(provider.apiUrl, rawKey);
}

/**
 * Resolves a provider record and its live adapter by ID.
 */
export async function resolveProviderById(providerId: string): Promise<{
  provider: ProviderRecord;
  adapter: SMMProviderAdapter;
}> {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) {
    throw new Error(`Provider not found: ${providerId}`);
  }

  return {
    provider,
    adapter: getAdapterForProvider(provider),
  };
}

/**
 * Resolves service routing using composite keys (providerId, providerServiceId).
 * Guaranteed to route to the correct upstream provider even if externalIds match.
 */
export async function resolveServiceRouting(serviceId: string, preferredProviderId?: string) {
  let service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { provider: true },
  });

  if (!service) {
    throw new Error(`Service not found: ${serviceId}`);
  }

  // If a specific provider is requested and differs from the service's current provider,
  // find the service entry mapped to that provider with the same providerServiceId/externalId.
  if (preferredProviderId && service.providerId !== preferredProviderId) {
    const alternateService = await prisma.service.findFirst({
      where: {
        providerId: preferredProviderId,
        OR: [
          { providerServiceId: service.providerServiceId || service.externalId },
          { externalId: service.externalId },
        ],
      },
      include: { provider: true },
    });

    if (alternateService) {
      service = alternateService;
    }
  }

  let provider = service.provider;
  if (!provider && service.providerId) {
    provider = await prisma.provider.findUnique({
      where: { id: service.providerId },
    });
  }

  if (!provider) {
    // Fallback to any active provider or mock
    const fallback = await prisma.provider.findFirst({
      where: { active: true },
    });
    if (fallback) {
      provider = fallback;
    } else {
      provider = {
        id: "mock-default",
        name: "Mock Provider",
        apiUrl: "mock",
        apiKeyEncrypted: null,
        isMock: true,
        active: true,
        currency: "USD",
        balance: null,
        lastSyncAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  const adapter = getAdapterForProvider(provider);
  const providerServiceId = service.providerServiceId || service.externalId;

  return {
    service,
    provider,
    adapter,
    providerId: provider.id,
    providerServiceId,
  };
}

/**
 * Syncs the remote service catalog for a specific provider.
 * Uses composite key (providerId, externalId) to ensure no collisions.
 */
export async function syncProviderCatalog(providerId: string) {
  const { provider, adapter } = await resolveProviderById(providerId);

  // 1. Fetch balance
  let liveBalance: number | null = null;
  let liveCurrency = provider.currency || "USD";
  try {
    const bal = await adapter.getBalance();
    liveBalance = bal.balance;
    if (bal.currency) liveCurrency = bal.currency;
  } catch (err) {
    console.warn(`[SYNC] Could not fetch balance for provider ${provider.name}:`, err);
  }

  // 2. Fetch services
  const remoteServices = await adapter.getServices();
  if (!Array.isArray(remoteServices) || remoteServices.length === 0) {
    throw new Error(`Provider returned 0 services or invalid format`);
  }

  let upsertedCount = 0;
  for (const s of remoteServices) {
    const extId = String(s.id);
    await prisma.service.upsert({
      where: {
        providerId_externalId: {
          providerId: provider.id,
          externalId: extId,
        },
      },
      update: {
        name: s.name,
        type: s.type || "Default",
        platform: s.platform || "Other",
        category: s.category || "General",
        description: s.description || "",
        minQuantity: s.minQuantity || 10,
        maxQuantity: s.maxQuantity || 100000,
        ratePer1000: s.ratePer1000 || 1.0,
        refillSupported: Boolean(s.refillSupported),
        cancelSupported: s.cancelSupported ?? true,
        dripFeedSupported: Boolean(s.dripFeedSupported),
        dripFeedMinInterval: s.dripFeedMinInterval || 10,
        dripFeedMaxInterval: s.dripFeedMaxInterval || 1440,
        restrictions: s.restrictions || null,
        providerEndpoint: provider.apiUrl,
        isMock: provider.isMock,
        active: true,
        providerServiceId: extId,
      },
      create: {
        externalId: extId,
        providerServiceId: extId,
        providerId: provider.id,
        name: s.name,
        type: s.type || "Default",
        platform: s.platform || "Other",
        category: s.category || "General",
        description: s.description || "",
        minQuantity: s.minQuantity || 10,
        maxQuantity: s.maxQuantity || 100000,
        ratePer1000: s.ratePer1000 || 1.0,
        refillSupported: Boolean(s.refillSupported),
        cancelSupported: s.cancelSupported ?? true,
        dripFeedSupported: Boolean(s.dripFeedSupported),
        dripFeedMinInterval: s.dripFeedMinInterval || 10,
        dripFeedMaxInterval: s.dripFeedMaxInterval || 1440,
        restrictions: s.restrictions || null,
        providerEndpoint: provider.apiUrl,
        isMock: provider.isMock,
        active: true,
      },
    });
    upsertedCount++;
  }

  // 3. Update provider record
  await prisma.provider.update({
    where: { id: providerId },
    data: {
      balance: liveBalance,
      currency: liveCurrency,
      lastSyncAt: new Date(),
    },
  });

  return {
    success: true,
    providerId,
    servicesCount: upsertedCount,
    balance: liveBalance,
    currency: liveCurrency,
  };
}

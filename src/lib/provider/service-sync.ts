import { prisma } from "../prisma";
import { SMMProviderAdapter } from "./adapter";

export interface SyncCatalogResult {
  success: boolean;
  totalServices: number;
  createdCount: number;
  updatedCount: number;
  catalogSyncedAt: string;
  providerEndpoint?: string;
}

/**
 * Fast bulk synchronization of services from any SMM provider adapter.
 * Associates services with the provider's endpoint to support dynamic switching
 * between providers and multi-user provider isolation.
 */
export async function syncProviderServices(
  adapter: SMMProviderAdapter,
  actor: string = "System",
  options: {
    providerEndpoint?: string;
    providerName?: string;
    userId?: string;
  } = {}
): Promise<SyncCatalogResult> {
  const endpoint = (options.providerEndpoint || adapter.apiUrl || "mock").trim();
  const services = await adapter.getServices();
  if (!Array.isArray(services)) {
    throw new Error("Provider did not return a valid list of services");
  }

  // Load existing external IDs for THIS specific provider endpoint
  const existing = await prisma.service.findMany({
    where: {
      OR: [
        { providerEndpoint: endpoint },
        ...(endpoint === "mock" ? [{ isMock: true }] : []),
      ],
    },
    select: { id: true, externalId: true, restrictions: true },
  });
  const existingMap = new Map(existing.map((s) => [s.externalId, s]));

  const toCreate: any[] = [];
  const toUpdate: any[] = [];
  const incomingExternalIds = new Set<string>();

  for (const s of services) {
    const extId = String(s.id);
    incomingExternalIds.add(extId);
    const existingService = existingMap.get(extId);
    const serviceData = {
      externalId: extId,
      name: s.name,
      type: s.type || "Default",
      platform: s.platform,
      category: s.category,
      description: s.description || `${s.type || "Default"} service in ${s.category}`,
      minQuantity: s.minQuantity,
      maxQuantity: s.maxQuantity,
      ratePer1000: s.ratePer1000,
      refillSupported: s.refillSupported ?? false,
      cancelSupported: s.cancelSupported ?? true,
      dripFeedSupported: s.dripFeedSupported ?? false,
      dripFeedMinInterval: s.dripFeedMinInterval || 10,
      dripFeedMaxInterval: s.dripFeedMaxInterval || 1440,
      restrictions: s.restrictions || existingService?.restrictions || null,
      providerEndpoint: endpoint,
      isMock: s.isMock ?? (endpoint === "mock"),
      active: true,
    };

    if (existingService) {
      toUpdate.push({ id: existingService.id, ...serviceData });
    } else {
      toCreate.push(serviceData);
    }
  }

  // Bulk create in chunks of 500
  const CHUNK_SIZE = 500;
  for (let i = 0; i < toCreate.length; i += CHUNK_SIZE) {
    const chunk = toCreate.slice(i, i + CHUNK_SIZE);
    await prisma.service.createMany({
      data: chunk,
      skipDuplicates: true,
    });
  }

  // Update existing services
  for (const item of toUpdate) {
    const { id, ...data } = item;
    await prisma.service.update({
      where: { id },
      data,
    });
  }

  // Deactivate services no longer present in provider's live catalog
  // (Preserves historical foreign keys for existing orders while removing from catalog)
  const staleServices = existing.filter((s) => !incomingExternalIds.has(s.externalId));
  if (staleServices.length > 0) {
    await prisma.service.updateMany({
      where: {
        id: { in: staleServices.map((s) => s.id) },
      },
      data: { active: false },
    });
  }

  const catalogSyncedAt = new Date();

  // Update lastSyncAt on the corresponding ProviderConfig / UserProviderConfig
  if (options.userId) {
    await prisma.userProviderConfig.updateMany({
      where: { userId: options.userId },
      data: { lastSyncAt: catalogSyncedAt, lastError: null },
    }).catch(() => {});
  }

  if (endpoint !== "mock") {
    await prisma.providerConfig.updateMany({
      where: { apiUrl: endpoint },
      data: { lastSyncAt: catalogSyncedAt },
    }).catch(() => {});
  }

  await prisma.auditLog.create({
    data: {
      action: "SYNC_SERVICE_CATALOG",
      actor,
      userId: options.userId || null,
      details: `Synchronized ${services.length} services from ${endpoint} (${toCreate.length} added, ${toUpdate.length} updated, ${staleServices.length} deactivated)`,
    },
  }).catch(() => {});

  return {
    success: true,
    totalServices: services.length,
    createdCount: toCreate.length,
    updatedCount: toUpdate.length,
    catalogSyncedAt: catalogSyncedAt.toISOString(),
    providerEndpoint: endpoint,
  };
}

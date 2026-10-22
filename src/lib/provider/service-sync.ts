import { prisma } from "../prisma";
import { SMMProviderAdapter } from "./adapter";

export interface SyncCatalogResult {
  success: boolean;
  totalServices: number;
  createdCount: number;
  updatedCount: number;
  catalogSyncedAt: string;
}

/**
 * Fast bulk synchronization of services from any SMM provider adapter.
 * Uses chunked createMany for high performance on cloud databases (e.g. Supabase).
 */
export async function syncProviderServices(
  adapter: SMMProviderAdapter,
  actor: string = "System"
): Promise<SyncCatalogResult> {
  const services = await adapter.getServices();
  if (!Array.isArray(services)) {
    throw new Error("Provider did not return a valid list of services");
  }

  // Load existing external IDs
  const existing = await prisma.service.findMany({
    select: { id: true, externalId: true, restrictions: true },
  });
  const existingMap = new Map(existing.map((s) => [s.externalId, s]));

  const toCreate: any[] = [];
  const toUpdate: any[] = [];

  for (const s of services) {
    const existingService = existingMap.get(s.id);
    const serviceData = {
      externalId: s.id,
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
      isMock: s.isMock ?? false,
      active: true,
    };

    if (existingService) {
      toUpdate.push({ id: existingService.id, ...serviceData });
    } else {
      toCreate.push(serviceData);
    }
  }

  // Bulk create in chunks of 500 (fast SQL multi-row INSERTs)
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

  // Clean up unused mock services if live services are present
  const hasLiveServices = services.some((s) => !s.isMock);
  if (hasLiveServices) {
    await prisma.service.deleteMany({
      where: {
        isMock: true,
        orders: { none: {} },
      },
    }).catch(() => {});
  }

  const catalogSyncedAt = new Date();

  await prisma.auditLog.create({
    data: {
      action: "SYNC_SERVICE_CATALOG",
      actor,
      details: `Synchronized ${services.length} services (${toCreate.length} added, ${toUpdate.length} updated)`,
    },
  }).catch(() => {});

  return {
    success: true,
    totalServices: services.length,
    createdCount: toCreate.length,
    updatedCount: toUpdate.length,
    catalogSyncedAt: catalogSyncedAt.toISOString(),
  };
}

import { prisma } from "../prisma";
import { SMMProviderAdapter } from "./adapter";

export interface SyncCatalogResult {
  success: boolean;
  totalServices: number;
  createdCount: number;
  updatedCount: number;
  catalogSyncedAt: string;
  providerEndpoint?: string;
  providerId?: string;
}

/**
 * Fast bulk synchronization of services from any SMM provider adapter.
 * Upserts into catalog keyed by (provider_id, provider_service_id).
 */
export async function syncProviderServices(
  adapter: SMMProviderAdapter,
  actor: string = "System",
  options: {
    providerId?: string;
    userProviderId?: string;
    providerEndpoint?: string;
    providerName?: string;
    userId?: string;
  } = {}
): Promise<SyncCatalogResult> {
  const endpoint = (options.providerEndpoint || adapter.apiUrl || "mock").trim();
  
  // Resolve valid foreign keys for UserProviderConnection and legacy Provider
  let validUserProviderId: string | null = options.userProviderId || null;
  let validLegacyProviderId: string | null = null;

  if (validUserProviderId) {
    const userConn = await prisma.userProviderConnection.findUnique({
      where: { id: validUserProviderId },
      select: { id: true },
    });
    if (!userConn) validUserProviderId = null;
  }

  if (options.providerId && !validUserProviderId) {
    // Check if options.providerId is actually a UserProviderConnection
    const userConn = await prisma.userProviderConnection.findUnique({
      where: { id: options.providerId },
      select: { id: true },
    });
    if (userConn) {
      validUserProviderId = userConn.id;
    } else {
      const legProv = await prisma.provider.findUnique({
        where: { id: options.providerId },
        select: { id: true },
      });
      if (legProv) validLegacyProviderId = legProv.id;
    }
  } else if (options.providerId) {
    const legProv = await prisma.provider.findUnique({
      where: { id: options.providerId },
      select: { id: true },
    });
    if (legProv) validLegacyProviderId = legProv.id;
  }

  const services = await adapter.getServices();
  if (!Array.isArray(services)) {
    throw new Error("Provider did not return a valid list of services");
  }

  // Load existing external IDs for THIS specific provider ID / endpoint
  const existingWhere: any = {};
  if (validUserProviderId && validLegacyProviderId) {
    existingWhere.OR = [
      { userProviderId: validUserProviderId },
      { providerId: validLegacyProviderId },
    ];
  } else if (validUserProviderId) {
    existingWhere.userProviderId = validUserProviderId;
  } else if (validLegacyProviderId) {
    existingWhere.providerId = validLegacyProviderId;
  } else {
    existingWhere.OR = [
      { providerEndpoint: endpoint },
      ...(endpoint === "mock" ? [{ isMock: true }] : []),
    ];
  }

  const existing = await prisma.service.findMany({
    where: existingWhere,
    select: { id: true, externalId: true, providerServiceId: true, restrictions: true },
  });

  const existingMap = new Map(
    existing.map((s) => [s.providerServiceId || s.externalId, s])
  );

  const toCreate: any[] = [];
  const toUpdate: any[] = [];
  const incomingServiceIds = new Set<string>();

  for (const s of services) {
    const sId = String(s.id);
    incomingServiceIds.add(sId);
    const existingService = existingMap.get(sId);
    const serviceData = {
      externalId: sId,
      providerServiceId: sId,
      userProviderId: validUserProviderId,
      providerId: validLegacyProviderId,
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

  // Update existing services in concurrent batches for speed
  const UPDATE_CONCURRENCY = 25;
  for (let i = 0; i < toUpdate.length; i += UPDATE_CONCURRENCY) {
    const batch = toUpdate.slice(i, i + UPDATE_CONCURRENCY);
    await Promise.all(
      batch.map((item) => {
        const { id, ...data } = item;
        return prisma.service.update({
          where: { id },
          data,
        });
      })
    );
  }

  // Deactivate services no longer present in provider's live catalog
  const staleServices = existing.filter(
    (s) => !incomingServiceIds.has(s.providerServiceId || s.externalId)
  );
  if (staleServices.length > 0) {
    await prisma.service.updateMany({
      where: {
        id: { in: staleServices.map((s) => s.id) },
      },
      data: { active: false },
    });
  }

  const catalogSyncedAt = new Date();

  // Update servicesCount & lastSyncAt on user_providers
  if (validUserProviderId) {
    await prisma.userProviderConnection.update({
      where: { id: validUserProviderId },
      data: {
        servicesCount: services.length,
        lastSyncAt: catalogSyncedAt,
        lastError: null,
      },
    }).catch(() => {});
  } else if (options.userId) {
    await prisma.userProviderConnection.updateMany({
      where: { userId: options.userId },
      data: {
        servicesCount: services.length,
        lastSyncAt: catalogSyncedAt,
        lastError: null,
      },
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
    providerId: validUserProviderId || validLegacyProviderId || options.providerId,
  };
}

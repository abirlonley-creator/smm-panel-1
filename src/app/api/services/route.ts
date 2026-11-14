import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth/session";
import { getActiveProvider } from "@/lib/provider/adapter";
import { syncProviderServices } from "@/lib/provider/service-sync";

export const dynamic = "force-dynamic";

interface ServiceCacheEntry {
  data: any;
  timestamp: number;
}
const MEMORY_CACHE = new Map<string, ServiceCacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60s cache for lightning fast instant switching

function sanitizeProviderBrand(name?: string | null): string {
  if (!name) return "Primary Network";
  const lower = name.toLowerCase();
  if (lower.includes("xmedia") || lower.includes("x media")) return "Views Network";
  if (lower.includes("zeofame")) return "Engagement Network";
  if (lower.includes("airgrow")) return "Growth Network";
  return name;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform");
    const search = searchParams.get("search")?.trim();
    const serviceId = searchParams.get("serviceId")?.trim();
    const shouldRefresh = searchParams.get("refresh") === "true";
    const filterFavouritesOnly = searchParams.get("onlyFavourites") === "true";
    const ignoreSnapshot = searchParams.get("ignoreSnapshot") === "true";
    const paginationRequested = searchParams.has("page") || searchParams.has("pageSize");
    const parsedPage = Number.parseInt(searchParams.get("page") || "1", 10);
    const parsedPageSize = Number.parseInt(searchParams.get("pageSize") || "15", 10);
    const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
    const pageSize = Number.isFinite(parsedPageSize)
      ? Math.min(100, Math.max(1, parsedPageSize))
      : 15;

    // 1. Resolve caller session
    const session = await getAuthSession(request);
    const userId = session.authenticated && session.user ? session.user.id : undefined;

    // In-Memory Fast Cache Check (Sub-millisecond instant response for catalog)
    const filterProviderId = searchParams.get("providerId")?.trim();
    const cacheKey = `${userId || "anon"}:${filterProviderId || "all"}:${platform || "all"}:${search || ""}:${filterFavouritesOnly}:${page}:${pageSize}:${paginationRequested}`;
    if (!shouldRefresh && !serviceId) {
      const cached = MEMORY_CACHE.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return NextResponse.json(cached.data, {
          headers: {
            "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
            "X-Cache": "HIT",
          },
        });
      }
    }

    // 2. Fetch user's connected providers
    let userProviders: any[] = [];
    let userPref: any = null;
    let userFavourites: any[] = [];
    let snapshotKeys: string[] = [];

    if (userId) {
      [userProviders, userPref, userFavourites] = await Promise.all([
        prisma.userProviderConnection.findMany({
          where: { userId, active: true },
          select: { id: true, name: true, currency: true, isMock: true, apiUrl: true, lastSyncAt: true },
          orderBy: { createdAt: "asc" },
        }),
        prisma.userPreference.findUnique({
          where: { userId },
        }),
        prisma.favourite.findMany({
          where: { userId },
          select: { id: true, providerId: true, providerServiceId: true, serviceId: true },
        }),
      ]);

      if (userPref?.onlyFavourites && !ignoreSnapshot) {
        const snapshot = await prisma.favouritesSnapshot.findUnique({
          where: { userId },
        });
        if (snapshot?.serviceKeys) {
          try {
            snapshotKeys = JSON.parse(snapshot.serviceKeys);
          } catch {
            snapshotKeys = [];
          }
        }
      }
    }

    const effectiveProviderId = filterProviderId && filterProviderId !== "all" ? filterProviderId : undefined;
    const { adapter, config } = await getActiveProvider(userId, effectiveProviderId);
    const activeEndpoint = config.isMock ? "mock" : config.apiUrl.trim();

    // 3. Direct single-service lookup by ID (e.g. planner, likes-analyze, or order verification)
    if (serviceId) {
      const singleService = await prisma.service.findFirst({
        where: {
          OR: [
            { id: serviceId },
            { externalId: serviceId, providerEndpoint: activeEndpoint },
            { providerServiceId: serviceId },
            { externalId: serviceId, isMock: config.isMock },
          ],
        },
        include: {
          userProvider: { select: { id: true, name: true, currency: true } },
          provider: { select: { id: true, name: true, currency: true } },
        },
      });

      if (singleService) {
        return NextResponse.json({
          success: true,
          provider: {
            name: sanitizeProviderBrand(singleService.userProvider?.name || singleService.provider?.name || config.name),
            isMock: config.isMock,
            isLive: !config.isMock,
            cached: true,
            lastSyncAt: config.lastSyncAt,
          },
          services: [
            {
              ...singleService,
              providerId: singleService.userProviderId || singleService.providerId,
              providerName: sanitizeProviderBrand(singleService.userProvider?.name || singleService.provider?.name || config.name),
              providerServiceId: singleService.providerServiceId || singleService.externalId,
            },
          ],
          totalServices: 1,
        });
      }
    }

    // 4. Proactive sync if requested
    let syncError: string | null = null;
    let wasRefreshedLive = false;

    if (shouldRefresh && userId && userProviders.length > 0) {
      try {
        const targetProvider =
          (effectiveProviderId ? userProviders.find((p) => p.id === effectiveProviderId) : null) ||
          userProviders.find((p) => p.id === config.id) ||
          userProviders[0];
        await syncProviderServices(
          adapter,
          session.user?.username || session.label || "Manual Sync",
          {
            providerId: targetProvider.id,
            userProviderId: targetProvider.id,
            providerEndpoint: targetProvider.apiUrl,
            providerName: targetProvider.name,
            userId,
          }
        );
        wasRefreshedLive = true;
      } catch (err: any) {
        syncError = err instanceof Error ? err.message : String(err);
        console.warn(`[SERVICES_API] Provider live sync warning:`, syncError);
      }
    }

    // 5. Build filter query
    const where: any = { active: true };

    if (filterProviderId && filterProviderId !== "all") {
      const specificConn = userProviders.find((p) => p.id === filterProviderId);
      const specificEndpoint = specificConn?.apiUrl?.trim();
      where.OR = [
        { userProviderId: filterProviderId },
        { providerId: filterProviderId },
        ...(specificEndpoint && specificEndpoint !== "mock" ? [{ providerEndpoint: specificEndpoint }] : []),
      ];
    } else if (userProviders.length > 0) {
      const userProvIds = userProviders.map((p) => p.id);
      const userEndpoints = userProviders
        .map((p) => p.apiUrl?.trim())
        .filter((url): url is string => Boolean(url && url !== "mock"));

      where.OR = [
        { userProviderId: { in: userProvIds } },
        { providerId: { in: userProvIds } },
        ...(userEndpoints.length > 0 ? [{ providerEndpoint: { in: userEndpoints } }] : []),
        ...(activeEndpoint && activeEndpoint !== "mock" ? [{ providerEndpoint: activeEndpoint }] : []),
        ...(userProviders.some((p) => p.isMock) ? [{ isMock: true }] : []),
      ];
    } else {
      where.OR = [
        ...(activeEndpoint && activeEndpoint !== "mock" ? [{ providerEndpoint: activeEndpoint }] : []),
        { providerEndpoint: "mock" },
        { isMock: true },
      ];
    }

    if (platform && platform !== "All") {
      where.platform = platform;
    }

    if (search) {
      const searchConditions = [
        { externalId: { contains: search, mode: "insensitive" } },
        { providerServiceId: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { platform: { contains: search, mode: "insensitive" } },
      ];

      if (where.AND) {
        where.AND.push({ OR: searchConditions });
      } else {
        where.AND = [{ OR: searchConditions }];
      }
    }

    // 6. Fetch services matching query (Optimized select: excludes huge text payloads for fast 0ms speed)
    let [allServices, totalServices] = await Promise.all([
      prisma.service.findMany({
        where,
        select: {
          id: true,
          externalId: true,
          name: true,
          category: true,
          platform: true,
          ratePer1000: true,
          minQuantity: true,
          maxQuantity: true,
          userProviderId: true,
          providerId: true,
          providerEndpoint: true,
          providerServiceId: true,
          isMock: true,
          dripFeedSupported: true,
          refillSupported: true,
          cancelSupported: true,
          active: true,
          userProvider: { select: { id: true, name: true, currency: true } },
          provider: { select: { id: true, name: true, currency: true } },
        },
        orderBy: [
          { userProviderId: "asc" },
          { providerId: "asc" },
          { externalId: "asc" },
          { ratePer1000: "asc" },
        ],
      }),
      prisma.service.count({ where }),
    ]);

    // If 0 services found in DB, return empty list instantly without blocking.
    // Heavy syncing is done explicitly via /api/user/providers/[id]/refresh or when shouldRefresh is requested.

    // Build favourite keys set
    const favKeySet = new Set(
      userFavourites.map((f) => `${f.providerId}:${f.providerServiceId}`)
    );
    const favServiceIdSet = new Set(
      userFavourites.map((f) => f.serviceId).filter(Boolean)
    );

    const snapshotKeySet = new Set(snapshotKeys);

    const userProvMap = new Map<string, { id: string; name: string }>();
    for (const up of userProviders) {
      if (up.id) userProvMap.set(up.id, { id: up.id, name: up.name });
      if (up.apiUrl) userProvMap.set(up.apiUrl.trim(), { id: up.id, name: up.name });
    }

    let enriched = allServices.map((s) => {
      const matchedUserProv =
        (s.userProviderId ? userProvMap.get(s.userProviderId) : null) ||
        (s.providerEndpoint ? userProvMap.get(s.providerEndpoint.trim()) : null) ||
        (s.providerId ? userProvMap.get(s.providerId) : null);

      const pId = s.userProviderId || s.providerId || matchedUserProv?.id || config.id || "prov-default";
      const pName =
        s.userProvider?.name ||
        s.provider?.name ||
        matchedUserProv?.name ||
        (s.isMock ? "Mock SMM Provider" : config.name);
      const pSrvId = s.providerServiceId || s.externalId;
      const key = `${pId}:${pSrvId}`;
      const isFav = favKeySet.has(key) || favServiceIdSet.has(s.id);
      const inSnapshot = snapshotKeySet.has(key);

      return {
        ...s,
        providerId: pId,
        providerName: sanitizeProviderBrand(pName),
        providerServiceId: pSrvId,
        isFavourite: isFav,
        inSnapshot,
      };
    });

    // If onlyFavouritesMode is explicitly requested
    const isOnlyFavouritesMode = Boolean(userPref?.onlyFavourites && !ignoreSnapshot && filterFavouritesOnly);
    if (isOnlyFavouritesMode) {
      if (snapshotKeys.length > 0) {
        enriched = enriched.filter((s) => s.inSnapshot);
      } else {
        // If snapshot is empty, filter to current favourites
        enriched = enriched.filter((s) => s.isFavourite);
      }
    } else if (filterFavouritesOnly) {
      enriched = enriched.filter((s) => s.isFavourite);
    }

    // Sort: Favourites pinned at top
    enriched.sort((a, b) => {
      if (a.isFavourite && !b.isFavourite) return -1;
      if (!a.isFavourite && b.isFavourite) return 1;
      return 0;
    });

    const finalTotal = enriched.length;
    const paginated = paginationRequested
      ? enriched.slice((page - 1) * pageSize, page * pageSize)
      : enriched;

    const responsePayload = {
      success: true,
      provider: {
        name: sanitizeProviderBrand(config.name),
        isMock: config.isMock,
        isLive: !config.isMock && wasRefreshedLive,
        cached: !wasRefreshedLive,
        lastSyncAt: config.lastSyncAt,
        warning: syncError || undefined,
      },
      activeProviderId: config.id,
      providers: userProviders.map((p) => {
        const count = enriched.filter(
          (s) =>
            s.providerId === p.id ||
            s.userProviderId === p.id ||
            s.providerName?.toLowerCase() === p.name?.toLowerCase()
        ).length;
        return {
          id: p.id,
          name: sanitizeProviderBrand(p.name),
          currency: p.currency,
          balance: p.balance,
          isActive: p.id === config.id,
          servicesCount: count,
        };
      }),
      services: paginated,
      totalServices: finalTotal,
      onlyFavouritesMode: isOnlyFavouritesMode,
      snapshotCount: snapshotKeys.length,
      favouritesCount: userFavourites.length,
      ...(paginationRequested
        ? {
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(finalTotal / pageSize)),
          }
        : {}),
    };

    // Store in server memory cache for subsequent instant loads
    if (!serviceId) {
      MEMORY_CACHE.set(cacheKey, { data: responsePayload, timestamp: Date.now() });
    }

    return NextResponse.json(responsePayload, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
        "X-Cache": "MISS",
      },
    });
  } catch (error: any) {
    console.error("[SERVICES_API] Unhandled error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch services" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth/session";
import { getActiveProvider } from "@/lib/provider/adapter";
import { syncProviderServices } from "@/lib/provider/service-sync";

export const dynamic = "force-dynamic";

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

    const { adapter, config } = await getActiveProvider(userId);
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
            name: singleService.userProvider?.name || singleService.provider?.name || config.name,
            apiUrl: config.isMock ? "Mock SMM Provider" : config.apiUrl,
            isMock: config.isMock,
            isLive: !config.isMock,
            cached: true,
            lastSyncAt: config.lastSyncAt,
          },
          services: [
            {
              ...singleService,
              providerId: singleService.userProviderId || singleService.providerId,
              providerName: singleService.userProvider?.name || singleService.provider?.name || config.name,
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
        const targetProvider = userProviders[0];
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

    const filterProviderId = searchParams.get("providerId")?.trim();

    // 5. Build filter query
    const where: any = { active: true };

    if (filterProviderId) {
      where.OR = [
        { userProviderId: filterProviderId },
        { providerId: filterProviderId },
      ];
    } else if (userProviders.length > 0) {
      const userProvIds = userProviders.map((p) => p.id);
      where.OR = [
        { userProviderId: { in: userProvIds } },
        { providerId: { in: userProvIds } },
        ...(userProviders.some((p) => p.isMock) ? [{ isMock: true }] : []),
      ];
    } else {
      where.OR = [
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

    // 6. Fetch services matching query
    const [allServices, totalServices] = await Promise.all([
      prisma.service.findMany({
        where,
        include: {
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

    // Build favourite keys set
    const favKeySet = new Set(
      userFavourites.map((f) => `${f.providerId}:${f.providerServiceId}`)
    );
    const favServiceIdSet = new Set(
      userFavourites.map((f) => f.serviceId).filter(Boolean)
    );

    const snapshotKeySet = new Set(snapshotKeys);

    let enriched = allServices.map((s) => {
      const pId = s.userProviderId || s.providerId || "prov-default";
      const pSrvId = s.providerServiceId || s.externalId;
      const key = `${pId}:${pSrvId}`;
      const isFav = favKeySet.has(key) || favServiceIdSet.has(s.id);
      const inSnapshot = snapshotKeySet.has(key);

      return {
        ...s,
        providerId: pId,
        providerName: s.userProvider?.name || s.provider?.name || (s.isMock ? "Mock SMM Provider" : config.name),
        providerServiceId: pSrvId,
        isFavourite: isFav,
        inSnapshot,
      };
    });

    // If onlyFavouritesMode is ON (Change 12)
    const isOnlyFavouritesMode = Boolean(userPref?.onlyFavourites && !ignoreSnapshot);
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

    return NextResponse.json({
      success: true,
      provider: {
        name: config.name,
        apiUrl: config.isMock ? "Mock SMM Provider" : config.apiUrl,
        isMock: config.isMock,
        isLive: !config.isMock && wasRefreshedLive,
        cached: !wasRefreshedLive,
        lastSyncAt: config.lastSyncAt,
        warning: syncError || undefined,
      },
      providers: userProviders.map((p) => ({
        id: p.id,
        name: p.name,
        currency: p.currency,
      })),
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
    });
  } catch (error: any) {
    console.error("[SERVICES_API] Unhandled error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch services" },
      { status: 500 }
    );
  }
}

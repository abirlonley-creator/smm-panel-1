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
    const paginationRequested = searchParams.has("page") || searchParams.has("pageSize");
    const parsedPage = Number.parseInt(searchParams.get("page") || "1", 10);
    const parsedPageSize = Number.parseInt(searchParams.get("pageSize") || "15", 10);
    const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
    const pageSize = Number.isFinite(parsedPageSize)
      ? Math.min(100, Math.max(1, parsedPageSize))
      : 15;

    // 1. Resolve caller's active provider (user config if logged in, fallback to system config)
    const session = await getAuthSession(request);
    const userId = session.authenticated && session.user ? session.user.id : undefined;
    const { adapter, config } = await getActiveProvider(userId);
    const activeEndpoint = config.isMock ? "mock" : config.apiUrl.trim();

    // 2. Direct single-service lookup by ID (e.g. planner, likes-analyze, or order verification)
    if (serviceId) {
      const singleService = await prisma.service.findFirst({
        where: {
          OR: [
            { id: serviceId },
            { externalId: serviceId, providerEndpoint: activeEndpoint },
            { externalId: serviceId, isMock: config.isMock },
          ],
        },
      });

      if (singleService) {
        return NextResponse.json({
          success: true,
          provider: {
            name: config.name,
            apiUrl: config.isMock ? "Mock SMM Provider" : config.apiUrl,
            isMock: config.isMock,
            isLive: !config.isMock,
            cached: true,
            lastSyncAt: config.lastSyncAt,
          },
          services: [singleService],
          totalServices: 1,
        });
      }
    }

    // 3. Check existing catalog count in database for this specific provider endpoint
    const existingCountForProvider = await prisma.service.count({
      where: config.isMock
        ? { OR: [{ providerEndpoint: "mock" }, { isMock: true }], active: true }
        : { providerEndpoint: activeEndpoint, active: true },
    });

    let syncError: string | null = null;
    let wasRefreshedLive = false;

    // 4. Dynamic Live Retrieval:
    // Fetch live from upstream provider if:
    // a) Caller explicitly requested refresh (e.g. click "Sync from Provider"), OR
    // b) Active provider is live (not mock) and has 0 services in database
    const needsInitialSync = !config.isMock && existingCountForProvider === 0;

    if (shouldRefresh || needsInitialSync) {
      try {
        await syncProviderServices(
          adapter,
          session.user?.username || session.label || "Dynamic Catalog Fetch",
          {
            providerEndpoint: activeEndpoint,
            providerName: config.name,
            userId,
          }
        );
        wasRefreshedLive = true;
      } catch (err: any) {
        syncError = err instanceof Error ? err.message : String(err);
        console.warn(`[SERVICES_API] Provider live sync failed for ${activeEndpoint}:`, syncError);
      }
    }

    const filterProviderId = searchParams.get("providerId")?.trim();

    // 5. Build filter query
    const where: any = { active: true };

    if (filterProviderId) {
      where.providerId = filterProviderId;
    } else if (config.isMock) {
      where.OR = [
        { providerEndpoint: "mock" },
        { isMock: true },
        { provider: { isMock: true } },
      ];
    } else {
      where.providerEndpoint = activeEndpoint;
    }

    if (platform && platform !== "All") {
      where.platform = platform;
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { externalId: { contains: search, mode: "insensitive" } },
            { providerServiceId: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
            { category: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { platform: { contains: search, mode: "insensitive" } },
          ],
        },
      ];
    }

    const [services, totalServices, activeProviders] = await Promise.all([
      prisma.service.findMany({
        where,
        include: {
          provider: {
            select: { id: true, name: true, currency: true },
          },
        },
        orderBy: [{ providerId: "asc" }, { externalId: "asc" }, { ratePer1000: "asc" }],
        ...(paginationRequested
          ? { skip: (page - 1) * pageSize, take: pageSize }
          : {}),
      }),
      prisma.service.count({ where }),
      prisma.provider.findMany({
        where: { active: true },
        select: { id: true, name: true, currency: true },
        orderBy: { name: "asc" },
      }),
    ]);

    // If no services were found and a sync error occurred, communicate the failure clearly
    if (totalServices === 0 && syncError) {
      return NextResponse.json(
        {
          success: false,
          error: `Provider API connection failed (${config.name}): ${syncError}. Please verify your API URL and credentials in Settings.`,
          provider: {
            name: config.name,
            apiUrl: config.apiUrl,
            isMock: config.isMock,
            isLive: false,
            cached: false,
            error: syncError,
          },
        },
        { status: 502 }
      );
    }

    const enrichedServices = services.map((s) => ({
      ...s,
      providerId: s.providerId,
      providerName: s.provider?.name || (s.isMock ? "Mock SMM Provider" : "Standard Provider"),
      providerServiceId: s.providerServiceId || s.externalId,
    }));

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
      providers: activeProviders,
      services: enrichedServices,
      totalServices,
      ...(paginationRequested
        ? {
            page,
            pageSize,
            totalPages: Math.ceil(totalServices / pageSize),
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

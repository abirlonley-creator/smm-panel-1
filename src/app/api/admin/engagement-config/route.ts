import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  getTikTokEngagementConfigAsync,
  saveTikTokEngagementConfigAsync,
  getAllTikTokPresetsRecordAsync,
  getAllTikTokPresetsAsync,
  saveTikTokPresetAsync,
  saveAllTikTokPresetsAsync,
  type TikTokTierPreset,
  type TikTokEngagementPresetConfig,
} from "@/lib/engagement/tiktok-preset-config";
import { getAdminViewsProvider, getAdminEngagementProvider } from "@/lib/provider/admin-provider";

async function resolveAllWholesaleRates(config: TikTokEngagementPresetConfig) {
  const [adminViews, adminEng] = await Promise.all([
    getAdminViewsProvider().catch(() => null),
    getAdminEngagementProvider().catch(() => null),
  ]);

  const defaultViewsConnId = adminViews?.connectionRecord?.id;
  const defaultEngConnId = adminEng?.connectionRecord?.id;

  async function resolveRate(
    targetConnId: string | undefined,
    serviceId: string | undefined,
    fallbackRate: number
  ): Promise<number> {
    if (!serviceId) return fallbackRate;

    // 1. If a specific provider connection ID is assigned, look strictly in that provider's services
    if (targetConnId) {
      const srv = await prisma.service.findFirst({
        where: {
          userProviderId: targetConnId,
          OR: [
            { providerServiceId: serviceId },
            { externalId: serviceId },
          ],
        },
      });
      const maxSensibleRate = Math.max(50, fallbackRate * 25);
      if (srv && typeof srv.ratePer1000 === "number" && srv.ratePer1000 > 0 && srv.ratePer1000 <= maxSensibleRate) {
        return srv.ratePer1000;
      }
    }

    // 2. Fallback: match by service ID across any provider, avoiding astronomical outliers (> maxSensibleRate)
    const maxSensibleRate = Math.max(50, fallbackRate * 25);
    const fallbackSrv = await prisma.service.findFirst({
      where: {
        OR: [
          { providerServiceId: serviceId },
          { externalId: serviceId },
        ],
        userProviderId: { not: null },
        ratePer1000: { gt: 0, lte: maxSensibleRate },
      },
      orderBy: { ratePer1000: "asc" },
    });

    if (fallbackSrv && typeof fallbackSrv.ratePer1000 === "number" && fallbackSrv.ratePer1000 > 0) {
      return fallbackSrv.ratePer1000;
    }

    return fallbackRate;
  }

  const [
    viewsRate,
    likesRate,
    savesRate,
    sharesRate,
    commentsRate,
    igViewsRate,
    igLikesRate,
    igSavesRate,
    igSharesRate,
    igRepostsRate,
    igCommentsRate,
  ] = await Promise.all([
    resolveRate(config.views?.providerId || defaultViewsConnId, config.views?.serviceId, 2.23),
    resolveRate(config.likes?.providerId || defaultEngConnId, config.likes?.serviceId, 0.88),
    resolveRate(config.saves?.providerId || defaultEngConnId, config.saves?.serviceId, 0.22),
    resolveRate(config.shares?.providerId || defaultEngConnId, config.shares?.serviceId, 0.22),
    resolveRate(config.comments?.providerId || defaultEngConnId, config.comments?.serviceId, 5.00),

    resolveRate(config.instagramViews?.providerId || defaultViewsConnId, config.instagramViews?.serviceId, 0.84),
    resolveRate(config.instagramLikes?.providerId || defaultEngConnId, config.instagramLikes?.serviceId, 1.10),
    resolveRate(config.instagramSaves?.providerId || defaultEngConnId, config.instagramSaves?.serviceId, 1.45),
    resolveRate(config.instagramShares?.providerId || defaultEngConnId, config.instagramShares?.serviceId, 1.50),
    resolveRate(config.instagramReposts?.providerId || defaultEngConnId, config.instagramReposts?.serviceId, 0.22),
    resolveRate(config.instagramComments?.providerId || defaultEngConnId, config.instagramComments?.serviceId, 5.00),
  ]);

  return {
    originalRates: {
      views: viewsRate,
      likes: likesRate,
      saves: savesRate,
      shares: sharesRate,
      comments: commentsRate,
    },
    instagramOriginalRates: {
      views: igViewsRate,
      likes: igLikesRate,
      saves: igSavesRate,
      shares: igSharesRate,
      comments: igCommentsRate,
      reposts: igRepostsRate,
    },
  };
}

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const [config, presets, presetsList] = await Promise.all([
    getTikTokEngagementConfigAsync(true),
    getAllTikTokPresetsRecordAsync(true),
    getAllTikTokPresetsAsync(true),
  ]);

  // Resolve live wholesale rates strictly from the admin-assigned SMM providers & service IDs
  const { originalRates, instagramOriginalRates } = await resolveAllWholesaleRates(config);

  // Build a map of all services across admin providers for instant live rate preview in admin UI
  const allServices = await prisma.service.findMany({
    where: { userProviderId: { not: null } },
    select: { userProviderId: true, providerServiceId: true, externalId: true, ratePer1000: true },
  });
  const providerServicesMap: Record<string, number> = {};
  for (const s of allServices) {
    if (s.userProviderId && s.ratePer1000) {
      if (s.providerServiceId) providerServicesMap[`${s.userProviderId}:${s.providerServiceId}`] = s.ratePer1000;
      if (s.externalId) providerServicesMap[`${s.userProviderId}:${s.externalId}`] = s.ratePer1000;
    }
  }

  // Fetch all Admin SMM providers for dropdown mapping
  let providersList: any[] = [];
  try {
    const [adminConns, legacyProviders] = await Promise.all([
      prisma.userProviderConnection.findMany({
        where: { user: { role: "ADMIN" } },
        orderBy: [{ isMock: "asc" }, { createdAt: "asc" }],
      }),
      prisma.provider.findMany({
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const seenProvIds = new Set<string>();
    for (const c of adminConns) {
      seenProvIds.add(c.id);
      providersList.push({
        id: c.id,
        name: c.name,
        apiUrl: c.apiUrl,
        currency: c.currency || "INR",
        balance: c.balance,
        isMock: c.isMock,
        active: c.active,
      });
    }

    for (const p of legacyProviders) {
      if (!seenProvIds.has(p.id)) {
        seenProvIds.add(p.id);
        providersList.push({
          id: p.id,
          name: p.name,
          apiUrl: p.apiUrl,
          currency: p.currency || "USD",
          balance: p.balance,
          isMock: p.isMock,
          active: p.active,
        });
      }
    }
  } catch (err) {
    console.warn("[ADMIN_CONFIG] Could not load providers list:", err);
  }

  return NextResponse.json({
    success: true,
    config,
    presets,
    presetsList,
    providers: providersList,
    providerServicesMap,
    originalRates,
    instagramOriginalRates,
  });
}

export async function PUT(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const actor = session.user?.username || session.user?.email || "admin";

  try {
    const body = await request.json();

    // 1. Update individual preset if presetId and preset updates are provided
    if (body.presetId && body.preset) {
      await saveTikTokPresetAsync(body.presetId, body.preset, actor);
    }

    // 2. Update all presets if presets record is provided
    if (body.presets && typeof body.presets === "object") {
      await saveAllTikTokPresetsAsync(body.presets, actor);
    }

    // 3. Update global config/pricing if config or pricing is provided
    let updatedConfig = await getTikTokEngagementConfigAsync(true);
    if (
      body.config ||
      body.pricing ||
      body.views ||
      body.likes ||
      body.saves ||
      body.shares ||
      body.instagramViews ||
      body.instagramLikes ||
      body.instagramSaves ||
      body.instagramShares ||
      body.instagramReposts ||
      body.instagramComments ||
      body.instagramPricing
    ) {
      const configPayload = body.config || body;
      updatedConfig = await saveTikTokEngagementConfigAsync(configPayload, actor);

      // Automatically synchronize retail rates and limits to catalog services in DB for API v2
      try {
        if (updatedConfig.pricing) {
          if (typeof updatedConfig.pricing.viewsUserRate === "number") {
            await prisma.service.updateMany({
              where: { numericId: 101 },
              data: { ratePer1000: updatedConfig.pricing.viewsUserRate },
            });
          }
          if (typeof updatedConfig.pricing.likesUserRate === "number") {
            await prisma.service.updateMany({
              where: { numericId: 102 },
              data: { ratePer1000: updatedConfig.pricing.likesUserRate },
            });
          }
          if (typeof updatedConfig.pricing.savesUserRate === "number") {
            await prisma.service.updateMany({
              where: { numericId: 103 },
              data: { ratePer1000: updatedConfig.pricing.savesUserRate },
            });
          }
          if (typeof updatedConfig.pricing.sharesUserRate === "number") {
            await prisma.service.updateMany({
              where: { numericId: 104 },
              data: { ratePer1000: updatedConfig.pricing.sharesUserRate },
            });
          }

          // Automatically sync package prices to match the admin's live rates ("Customer Pays")
          const vRate = updatedConfig.pricing.viewsUserRate ?? 4.5;
          const lRate = updatedConfig.pricing.likesUserRate ?? 2.0;
          const sRate = updatedConfig.pricing.savesUserRate ?? 0.8;
          const shRate = updatedConfig.pricing.sharesUserRate ?? 0.8;

          const currentPresets = await getAllTikTokPresetsRecordAsync(true);
          for (const key of Object.keys(currentPresets)) {
            const p = currentPresets[key];
            const vC = (p.targetViews / 1000) * vRate;
            const lC = (p.targetLikes / 1000) * lRate;
            const sC = p.saves?.enabled ? (p.targetSaves / 1000) * sRate : 0;
            const shC = p.shares?.enabled ? (p.targetShares / 1000) * shRate : 0;
            p.price_inr = Number((vC + lC + sC + shC).toFixed(2));
          }
          await saveAllTikTokPresetsAsync(currentPresets, actor);
        }
      } catch (syncErr) {
        console.warn("Failed to sync pricing to catalog services:", syncErr);
      }
    }

    const [{ originalRates, instagramOriginalRates }, presetsRecord, presetsList] = await Promise.all([
      resolveAllWholesaleRates(updatedConfig),
      getAllTikTokPresetsRecordAsync(true),
      getAllTikTokPresetsAsync(true),
    ]);

    return NextResponse.json({
      success: true,
      config: updatedConfig,
      presets: presetsRecord,
      presetsList,
      originalRates,
      instagramOriginalRates,
      message: "TikTok Engagement presets and pricing configuration saved successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update configuration" },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  return PUT(request);
}


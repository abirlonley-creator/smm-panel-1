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

  // Resolve live wholesale provider rates
  let viewsOriginalRate = 2.23;
  let likesOriginalRate = 0.88;
  let savesOriginalRate = 0.22;
  let sharesOriginalRate = 0.22;
  let commentsOriginalRate = 5.00;

  let igViewsOriginalRate = 0.84;
  let igLikesOriginalRate = 1.10;
  let igSavesOriginalRate = 1.45;
  let igSharesOriginalRate = 1.50;
  let igCommentsOriginalRate = 5.00;
  let igRepostsOriginalRate = 0.22;

  try {
    const [adminViews, adminEng] = await Promise.all([
      getAdminViewsProvider().catch(() => null),
      getAdminEngagementProvider().catch(() => null),
    ]);

    const viewsConnId = adminViews?.connectionRecord?.id;
    const engConnId = adminEng?.connectionRecord?.id;

    if (viewsConnId) {
      const vServiceId = config.views?.serviceId || "897";
      const igVServiceId = config.instagramViews?.serviceId || "101";

      const [srv, igSrv] = await Promise.all([
        prisma.service.findFirst({
          where: {
            userProviderId: viewsConnId,
            OR: [
              { providerServiceId: vServiceId },
              { externalId: vServiceId },
              { providerServiceId: "897" },
              { externalId: "897" },
              { providerServiceId: "10322" },
              { externalId: "10322" },
            ],
          },
        }),
        prisma.service.findFirst({
          where: {
            userProviderId: viewsConnId,
            OR: [
              { providerServiceId: igVServiceId },
              { externalId: igVServiceId },
              { providerServiceId: "101" },
              { externalId: "101" },
            ],
          },
        }),
      ]);

      if (srv && typeof srv.ratePer1000 === "number") {
        viewsOriginalRate = srv.ratePer1000;
      }
      if (igSrv && typeof igSrv.ratePer1000 === "number") {
        igViewsOriginalRate = igSrv.ratePer1000;
      }
    }

    if (engConnId) {
      const lServiceId = config.likes?.serviceId || "1123";
      const sServiceId = config.saves?.serviceId || "807";
      const rServiceId = config.shares?.serviceId || "718";

      const igLServiceId = config.instagramLikes?.serviceId || "102";
      const igSServiceId = config.instagramSaves?.serviceId || "103";
      const igRServiceId = config.instagramShares?.serviceId || "104";
      const igRepServiceId = config.instagramReposts?.serviceId || "105";

      const [likesSrv, savesSrv, sharesSrv, igLikesSrv, igSavesSrv, igSharesSrv, igRepostsSrv] = await Promise.all([
        prisma.service.findFirst({
          where: {
            userProviderId: engConnId,
            OR: [{ providerServiceId: lServiceId }, { externalId: lServiceId }],
          },
        }),
        prisma.service.findFirst({
          where: {
            userProviderId: engConnId,
            OR: [{ providerServiceId: sServiceId }, { externalId: sServiceId }],
          },
        }),
        prisma.service.findFirst({
          where: {
            userProviderId: engConnId,
            OR: [{ providerServiceId: rServiceId }, { externalId: rServiceId }],
          },
        }),
        prisma.service.findFirst({
          where: {
            userProviderId: engConnId,
            OR: [{ providerServiceId: igLServiceId }, { externalId: igLServiceId }],
          },
        }),
        prisma.service.findFirst({
          where: {
            userProviderId: engConnId,
            OR: [{ providerServiceId: igSServiceId }, { externalId: igSServiceId }],
          },
        }),
        prisma.service.findFirst({
          where: {
            userProviderId: engConnId,
            OR: [{ providerServiceId: igRServiceId }, { externalId: igRServiceId }],
          },
        }),
        prisma.service.findFirst({
          where: {
            userProviderId: engConnId,
            OR: [{ providerServiceId: igRepServiceId }, { externalId: igRepServiceId }],
          },
        }),
      ]);

      if (likesSrv && typeof likesSrv.ratePer1000 === "number") likesOriginalRate = likesSrv.ratePer1000;
      if (savesSrv && typeof savesSrv.ratePer1000 === "number") savesOriginalRate = savesSrv.ratePer1000;
      if (sharesSrv && typeof sharesSrv.ratePer1000 === "number") sharesOriginalRate = sharesSrv.ratePer1000;

      if (igLikesSrv && typeof igLikesSrv.ratePer1000 === "number") igLikesOriginalRate = igLikesSrv.ratePer1000;
      if (igSavesSrv && typeof igSavesSrv.ratePer1000 === "number") igSavesOriginalRate = igSavesSrv.ratePer1000;
      if (igSharesSrv && typeof igSharesSrv.ratePer1000 === "number") igSharesOriginalRate = igSharesSrv.ratePer1000;
      if (igRepostsSrv && typeof igRepostsSrv.ratePer1000 === "number") igRepostsOriginalRate = igRepostsSrv.ratePer1000;
    }
  } catch (err) {
    console.warn("[ADMIN_CONFIG] Could not resolve provider wholesale rates:", err);
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
    originalRates: {
      views: viewsOriginalRate,
      likes: likesOriginalRate,
      saves: savesOriginalRate,
      shares: sharesOriginalRate,
      comments: commentsOriginalRate,
    },
    instagramOriginalRates: {
      views: igViewsOriginalRate,
      likes: igLikesOriginalRate,
      saves: igSavesOriginalRate,
      shares: igSharesOriginalRate,
      comments: igCommentsOriginalRate,
      reposts: igRepostsOriginalRate,
    },
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

    const [presetsRecord, presetsList] = await Promise.all([
      getAllTikTokPresetsRecordAsync(true),
      getAllTikTokPresetsAsync(true),
    ]);

    return NextResponse.json({
      success: true,
      config: updatedConfig,
      presets: presetsRecord,
      presetsList,
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


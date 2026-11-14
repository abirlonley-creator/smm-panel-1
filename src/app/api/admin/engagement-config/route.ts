import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  getTikTokEngagementConfig,
  saveTikTokEngagementConfig,
  getAllTikTokPresetsRecord,
  getAllTikTokPresets,
  saveTikTokPreset,
  saveAllTikTokPresets,
  type TikTokTierPreset,
  type TikTokEngagementPresetConfig,
} from "@/lib/engagement/tiktok-preset-config";
import { getAdminViewsProvider, getAdminEngagementProvider } from "@/lib/provider/admin-provider";

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const config = getTikTokEngagementConfig();
  const presets = getAllTikTokPresetsRecord();
  const presetsList = getAllTikTokPresets();

  // Resolve live wholesale provider rates
  let viewsOriginalRate = 2.23;
  let likesOriginalRate = 0.88;
  let savesOriginalRate = 0.22;
  let sharesOriginalRate = 0.22;
  let commentsOriginalRate = 5.00;

  try {
    const [adminViews, adminEng] = await Promise.all([
      getAdminViewsProvider().catch(() => null),
      getAdminEngagementProvider().catch(() => null),
    ]);

    const viewsConnId = adminViews?.connectionRecord?.id;
    const engConnId = adminEng?.connectionRecord?.id;

    if (viewsConnId) {
      const vServiceId = config.views?.serviceId || "897";
      const srv = await prisma.service.findFirst({
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
      });
      if (srv && typeof srv.ratePer1000 === "number") {
        viewsOriginalRate = srv.ratePer1000;
      }
    }

    if (engConnId) {
      const lServiceId = config.likes?.serviceId || "1123";
      const sServiceId = config.saves?.serviceId || "807";
      const rServiceId = config.shares?.serviceId || "718";

      const [likesSrv, savesSrv, sharesSrv] = await Promise.all([
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
      ]);

      if (likesSrv && typeof likesSrv.ratePer1000 === "number") likesOriginalRate = likesSrv.ratePer1000;
      if (savesSrv && typeof savesSrv.ratePer1000 === "number") savesOriginalRate = savesSrv.ratePer1000;
      if (sharesSrv && typeof sharesSrv.ratePer1000 === "number") sharesOriginalRate = sharesSrv.ratePer1000;
    }
  } catch (err) {
    console.warn("[ADMIN_CONFIG] Could not resolve provider wholesale rates:", err);
  }

  return NextResponse.json({
    success: true,
    config,
    presets,
    presetsList,
    originalRates: {
      views: viewsOriginalRate,
      likes: likesOriginalRate,
      saves: savesOriginalRate,
      shares: sharesOriginalRate,
      comments: commentsOriginalRate,
    },
  });
}

export async function PUT(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // 1. Update individual preset if presetId and preset updates are provided
    if (body.presetId && body.preset) {
      saveTikTokPreset(body.presetId, body.preset);
    }

    // 2. Update all presets if presets record is provided
    if (body.presets && typeof body.presets === "object") {
      saveAllTikTokPresets(body.presets);
    }

    // 3. Update global config/pricing if config or pricing is provided
    let updatedConfig = getTikTokEngagementConfig();
    if (body.config || body.pricing || body.views || body.likes || body.saves || body.shares) {
      const configPayload = body.config || body;
      updatedConfig = saveTikTokEngagementConfig(configPayload);
    }

    return NextResponse.json({
      success: true,
      config: updatedConfig,
      presets: getAllTikTokPresetsRecord(),
      presetsList: getAllTikTokPresets(),
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


import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/security/crypto";
import { StandardSMMv2Provider, MockSMMProvider } from "@/lib/provider/adapter";
import {
  getTikTokEngagementConfig,
  TIKTOK_TIER_PRESETS,
  getAllTikTokPresets,
} from "@/lib/engagement/tiktok-preset-config";
import { getAdminViewsProvider, getAdminEngagementProvider } from "@/lib/provider/admin-provider";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  const config = getTikTokEngagementConfig();

  // If engagement is globally disabled by admin
  if (!config.enabled) {
    return NextResponse.json({
      success: true,
      enabled: false,
      message: "Engagement system is currently undergoing scheduled maintenance.",
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, role: true, walletBalance: true },
  });

  const walletBalance = user?.walletBalance ?? 0;

  // Always resolve system execution providers through the Administrator
  const [adminViews, adminEng] = await Promise.all([
    getAdminViewsProvider(),
    getAdminEngagementProvider(),
  ]);

  const zeofameConn = adminEng?.connectionRecord || null;
  const xmediaConn = adminViews?.connectionRecord || null;

  // 1. Check Engagement connection (Likes, Saves, Shares)
  let zeofameStatus = {
    connected: false,
    valid: false,
    name: "Engagement Engine",
    connectionId: null as string | null,
    balance: null as number | null,
    currency: "EUR",
    hasService: false,
    service: null as any,
    savesService: null as any,
    sharesService: null as any,
    message: zeofameConn ? "Connected & Active" : "Engagement API is not configured by system administrator.",
  };

  const likesServiceId = config.likes?.serviceId || "1123";
  const savesServiceId = config.saves?.serviceId || "807";
  const sharesServiceId = config.shares?.serviceId || "718";

  if (zeofameConn && zeofameConn.active) {
    if (isAdmin) {
      zeofameStatus.connectionId = zeofameConn.id;
      zeofameStatus.currency = zeofameConn.currency || "EUR";
    }

    const rawKey = zeofameConn.apiKeyEncrypted ? decryptApiKey(zeofameConn.apiKeyEncrypted) : null;

    if (rawKey || zeofameConn.isMock) {
      const adapter = (zeofameConn.isMock || !rawKey)
        ? new MockSMMProvider()
        : new StandardSMMv2Provider(zeofameConn.apiUrl, rawKey);

      try {
        let bal = zeofameConn.balance;
        if (isAdmin) {
          const isFresh = zeofameConn.lastSyncAt && (Date.now() - zeofameConn.lastSyncAt.getTime() < 30000);
          if (!isFresh) {
            try {
              const balRes = await Promise.race([
                adapter.getBalance(),
                new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3500)),
              ]);
              if (typeof balRes.balance === "number") bal = balRes.balance;
            } catch {
              // Fall back to stored balance without blocking
            }
          }
          zeofameStatus.balance = bal;
        }

        zeofameStatus.valid = true;
        zeofameStatus.connected = true;

        // Check or import Likes service
        let likesSrv = await prisma.service.findFirst({
          where: {
            userProviderId: zeofameConn.id,
            OR: [{ providerServiceId: likesServiceId }, { externalId: likesServiceId }],
          },
        });

        // Check or import Saves service
        let savesSrv = await prisma.service.findFirst({
          where: {
            userProviderId: zeofameConn.id,
            OR: [{ providerServiceId: savesServiceId }, { externalId: savesServiceId }],
          },
        });

        // Check or import Shares service
        let sharesSrv = await prisma.service.findFirst({
          where: {
            userProviderId: zeofameConn.id,
            OR: [{ providerServiceId: sharesServiceId }, { externalId: sharesServiceId }],
          },
        });

        if (likesSrv) {
          zeofameStatus.hasService = true;
          zeofameStatus.service = {
            id: likesSrv.id,
            providerServiceId: likesSrv.providerServiceId || likesSrv.externalId,
            name: likesSrv.name,
            minQuantity: likesSrv.minQuantity,
            maxQuantity: likesSrv.maxQuantity,
            ratePer1000: likesSrv.ratePer1000,
          };
          zeofameStatus.message = "Connected & Active";
        }
        if (savesSrv) {
          zeofameStatus.savesService = {
            id: savesSrv.id,
            providerServiceId: savesSrv.providerServiceId || savesSrv.externalId,
            ratePer1000: savesSrv.ratePer1000,
          };
        }
        if (sharesSrv) {
          zeofameStatus.sharesService = {
            id: sharesSrv.id,
            providerServiceId: sharesSrv.providerServiceId || sharesSrv.externalId,
            ratePer1000: sharesSrv.ratePer1000,
          };
        }
      } catch (err: any) {
        if (isAdmin) {
          zeofameStatus.message = `Engagement API error: ${err.message || "Failed to reach provider"}`;
        }
      }
    }
  }

  // 2. Check Views connection
  const viewsServiceId = config.views?.serviceId || "897";

  let xmediaStatus = {
    connected: false,
    valid: false,
    name: "Views Engine",
    connectionId: null as string | null,
    balance: null as number | null,
    currency: "INR",
    hasService: false,
    service: null as any,
    message: xmediaConn ? "Connected & Active" : "Views API is not configured by system administrator.",
  };

  if (xmediaConn && xmediaConn.active) {
    if (isAdmin) {
      xmediaStatus.connectionId = xmediaConn.id;
      xmediaStatus.currency = xmediaConn.currency || "INR";
    }

    const rawKey = xmediaConn.apiKeyEncrypted ? decryptApiKey(xmediaConn.apiKeyEncrypted) : null;

    if (rawKey || xmediaConn.isMock) {
      const adapter = (xmediaConn.isMock || !rawKey)
        ? new MockSMMProvider()
        : new StandardSMMv2Provider(xmediaConn.apiUrl, rawKey);

      try {
        let bal = xmediaConn.balance;
        if (isAdmin) {
          const isFresh = xmediaConn.lastSyncAt && (Date.now() - xmediaConn.lastSyncAt.getTime() < 30000);
          if (!isFresh) {
            try {
              const balRes = await Promise.race([
                adapter.getBalance(),
                new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3500)),
              ]);
              if (typeof balRes.balance === "number") bal = balRes.balance;
            } catch {
              // Fall back to stored balance without blocking
            }
          }
          xmediaStatus.balance = bal;
        }

        xmediaStatus.valid = true;
        xmediaStatus.connected = true;

        // Check if views service is in DB for this connection
        let srv = await prisma.service.findFirst({
          where: {
            userProviderId: xmediaConn.id,
            OR: [
              { providerServiceId: viewsServiceId },
              { externalId: viewsServiceId },
              { providerServiceId: "897" },
              { externalId: "897" },
              { providerServiceId: "10322" },
              { externalId: "10322" },
            ],
          },
        });

        if (srv) {
          xmediaStatus.hasService = true;
          xmediaStatus.service = {
            id: srv.id,
            providerServiceId: srv.providerServiceId || srv.externalId,
            name: srv.name,
            minQuantity: srv.minQuantity,
            maxQuantity: srv.maxQuantity,
            ratePer1000: srv.ratePer1000,
          };
          xmediaStatus.message = "Connected & Active";
        }
      } catch (err: any) {
        if (isAdmin) {
          xmediaStatus.message = `Views API error: ${err.message || "Failed to reach provider"}`;
        }
      }
    }
  }

  // 1. Original Provider Wholesale Rates
  const originalViewsRate = xmediaStatus.service?.ratePer1000 ?? 2.23;
  const originalLikesRate = zeofameStatus.service?.ratePer1000 ?? 0.88;
  const originalSavesRate = zeofameStatus.savesService?.ratePer1000 ?? 0.22;
  const originalSharesRate = zeofameStatus.sharesService?.ratePer1000 ?? 0.22;
  const originalCommentsRate = 5.00;

  // 2. Selling Rates Charged to Users (Admin Configured with Profit Margin)
  const viewsRate = config.pricing?.viewsUserRate ?? 4.50;
  const likesRate = config.pricing?.likesUserRate ?? 2.00;
  const savesRate = config.pricing?.savesUserRate ?? 0.80;
  const sharesRate = config.pricing?.sharesUserRate ?? 0.80;
  const commentsRate = config.pricing?.commentsUserRate ?? 15.00;

  // Calculate costs for all presets based on user retail rates
  const presetsList = getAllTikTokPresets().map((preset) => {
    const vCost = Number(((preset.targetViews / 1000) * viewsRate).toFixed(4));
    const lCost = Number(((preset.targetLikes / 1000) * likesRate).toFixed(4));
    const sCost = preset.saves?.enabled ? Number(((preset.targetSaves / 1000) * savesRate).toFixed(4)) : 0;
    const rCost = preset.shares?.enabled ? Number(((preset.targetShares / 1000) * sharesRate).toFixed(4)) : 0;
    const totalCost = Number((vCost + lCost + sCost + rCost).toFixed(2));

    return {
      ...preset,
      pricing: {
        viewsCost: vCost,
        likesCost: lCost,
        savesCost: sCost,
        sharesCost: rCost,
        totalCost,
      },
    };
  });

  const defaultPreset = presetsList[0];
  const readyToOrder = Boolean(zeofameConn && xmediaConn);

  return NextResponse.json({
    success: true,
    enabled: true,
    walletBalance,
    readyToOrder,
    zeofame: zeofameStatus,
    xmedia: xmediaStatus,
    rates: {
      viewsRate,
      likesRate,
      savesRate,
      sharesRate,
      commentsRate,
    },
    originalRates: isAdmin
      ? {
          views: originalViewsRate,
          likes: originalLikesRate,
          saves: originalSavesRate,
          shares: originalSharesRate,
          comments: originalCommentsRate,
        }
      : undefined,
    presets: presetsList,
    config,
    pricing: {
      totalEstimatedCost: defaultPreset.pricing.totalCost,
      viewsCost: defaultPreset.pricing.viewsCost,
      likesCost: defaultPreset.pricing.likesCost,
      viewsRate,
      likesRate,
      savesRate,
      sharesRate,
      commentsRate,
      totalPlannedViews: defaultPreset.targetViews,
      totalPlannedLikes: defaultPreset.targetLikes,
      viewsRuns: defaultPreset.views.runsCount,
      likesRuns: defaultPreset.likes.runsCount,
      durationMinutes: defaultPreset.totalDurationMinutes,
    },
  });
}

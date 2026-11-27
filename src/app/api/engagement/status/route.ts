import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { isMasterAdmin } from "@/lib/auth/master-admin";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/security/crypto";
import { StandardSMMv2Provider, MockSMMProvider } from "@/lib/provider/adapter";
import {
  getTikTokEngagementConfigAsync,
  TIKTOK_TIER_PRESETS,
  getAllTikTokPresetsAsync,
} from "@/lib/engagement/tiktok-preset-config";
import { getAdminViewsProvider, getAdminEngagementProvider } from "@/lib/provider/admin-provider";

export const dynamic = "force-dynamic";

function sanitizeBrandOrProviderName(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/zeofame/gi, "Aura Growth")
    .replace(/xmedia/gi, "Aura Views")
    .replace(/x\s*media/gi, "Aura Views")
    .replace(/airgrow/gi, "Aura Fast")
    .replace(/smmprovider/gi, "Aura Network")
    .replace(/smm\.internal/gi, "aura.internal")
    .replace(/https?:\/\/[^\s]+/gi, "")
    .trim();
}

export async function GET(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const isAdmin = isMasterAdmin(session.user);
  const config = await getTikTokEngagementConfigAsync();

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

  const userVipPasskeys = await prisma.passkey.findMany({
    where: {
      userId,
      status: "ACTIVE",
      label: { not: "Account Password" },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  const isVip = userVipPasskeys.length > 0 || Boolean(session.passkey && session.passkey.label !== "Account Password");

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

  // 1. Original Provider Wholesale Rates (TikTok)
  const originalViewsRate = xmediaStatus.service?.ratePer1000 ?? 2.23;
  const originalLikesRate = zeofameStatus.service?.ratePer1000 ?? 0.88;
  const originalSavesRate = zeofameStatus.savesService?.ratePer1000 ?? 0.22;
  const originalSharesRate = zeofameStatus.sharesService?.ratePer1000 ?? 0.22;
  const originalCommentsRate = 5.00;

  // Instagram Original Wholesale Rates
  const origIgViews = 0.84;
  const origIgLikes = 1.10;
  const origIgSaves = 1.45;
  const origIgShares = 1.50;
  const origIgReposts = 0.22;
  const origIgComments = 5.00;

  // 2. Selling Rates Charged to Users (Standard Rates vs VIP Passkey Rates)
  let tiktokViewsRate: number;
  let tiktokLikesRate: number;
  let tiktokSavesRate: number;
  let tiktokSharesRate: number;
  let tiktokRepostsRate: number;
  let tiktokCommentsRate: number;

  if (isVip && (config.tiktokZeroProfitVip || config.tiktokVipPricing)) {
    tiktokViewsRate = config.tiktokZeroProfitVip ? originalViewsRate : (config.tiktokVipPricing?.viewsUserRate ?? originalViewsRate);
    tiktokLikesRate = config.tiktokZeroProfitVip ? originalLikesRate : (config.tiktokVipPricing?.likesUserRate ?? originalLikesRate);
    tiktokSavesRate = config.tiktokZeroProfitVip ? originalSavesRate : (config.tiktokVipPricing?.savesUserRate ?? originalSavesRate);
    tiktokSharesRate = config.tiktokZeroProfitVip ? originalSharesRate : (config.tiktokVipPricing?.sharesUserRate ?? originalSharesRate);
    tiktokRepostsRate = tiktokSharesRate;
    tiktokCommentsRate = config.tiktokZeroProfitVip ? originalCommentsRate : (config.tiktokVipPricing?.commentsUserRate ?? originalCommentsRate);
  } else {
    tiktokViewsRate = config.pricing?.viewsUserRate ?? 4.50;
    tiktokLikesRate = config.pricing?.likesUserRate ?? 2.00;
    tiktokSavesRate = config.pricing?.savesUserRate ?? 0.80;
    tiktokSharesRate = config.pricing?.sharesUserRate ?? 0.80;
    tiktokRepostsRate = config.pricing?.sharesUserRate ?? 0.80;
    tiktokCommentsRate = config.pricing?.commentsUserRate ?? 15.00;
  }

  let instagramViewsRate: number;
  let instagramLikesRate: number;
  let instagramSavesRate: number;
  let instagramSharesRate: number;
  let instagramRepostsRate: number;
  let instagramCommentsRate: number;

  if (isVip && (config.instagramZeroProfitVip || config.instagramVipPricing)) {
    instagramViewsRate = config.instagramZeroProfitVip ? origIgViews : (config.instagramVipPricing?.viewsUserRate ?? origIgViews);
    instagramLikesRate = config.instagramZeroProfitVip ? origIgLikes : (config.instagramVipPricing?.likesUserRate ?? origIgLikes);
    instagramSavesRate = config.instagramZeroProfitVip ? origIgSaves : (config.instagramVipPricing?.savesUserRate ?? origIgSaves);
    instagramSharesRate = config.instagramZeroProfitVip ? origIgShares : (config.instagramVipPricing?.sharesUserRate ?? origIgShares);
    instagramRepostsRate = config.instagramZeroProfitVip ? origIgReposts : (config.instagramVipPricing?.repostsUserRate ?? origIgReposts);
    instagramCommentsRate = config.instagramZeroProfitVip ? origIgComments : (config.instagramVipPricing?.commentsUserRate ?? origIgComments);
  } else {
    instagramViewsRate = config.instagramPricing?.viewsUserRate ?? 1.00;
    instagramLikesRate = config.instagramPricing?.likesUserRate ?? 35.57;
    instagramSavesRate = config.instagramPricing?.savesUserRate ?? 6.70;
    instagramSharesRate = config.instagramPricing?.sharesUserRate ?? 2.00;
    instagramRepostsRate = config.instagramPricing?.repostsUserRate ?? 152.45;
    instagramCommentsRate = config.instagramPricing?.commentsUserRate ?? 2113.92;
  }

  // Active rate aliases for backward compatibility
  const viewsRate = tiktokViewsRate;
  const likesRate = tiktokLikesRate;
  const savesRate = tiktokSavesRate;
  const sharesRate = tiktokSharesRate;
  const commentsRate = tiktokCommentsRate;

  // Calculate costs for all presets based on user retail rates dynamically
  const allPresets = await getAllTikTokPresetsAsync();
  const presetsList = allPresets.map((preset: any) => {
    const vCost = Number(((preset.targetViews / 1000) * tiktokViewsRate).toFixed(4));
    const lCost = Number(((preset.targetLikes / 1000) * tiktokLikesRate).toFixed(4));
    const sCost = preset.saves?.enabled ? Number(((preset.targetSaves / 1000) * tiktokSavesRate).toFixed(4)) : 0;
    const rCost = preset.shares?.enabled ? Number(((preset.targetShares / 1000) * tiktokSharesRate).toFixed(4)) : 0;
    const computedCost = Number((vCost + lCost + sCost + rCost).toFixed(2));
    const isPackageEnabled = preset.disabled !== true && preset.enabled !== false;

    return {
      ...preset,
      enabled: isPackageEnabled,
      disabled: !isPackageEnabled,
      price_inr: computedCost,
      views_total: preset.views_total || preset.targetViews,
      base_duration_hours: preset.base_duration_hours || preset.durationHours,
      pricing: {
        viewsCost: vCost,
        likesCost: lCost,
        savesCost: sCost,
        sharesCost: rCost,
        totalCost: computedCost,
      },
    };
  });

  // For regular users (non-admins), filter out disabled packages completely so they cannot view or see them
  const visiblePresets = isAdmin
    ? presetsList
    : presetsList.filter((p: any) => p.enabled !== false && p.disabled !== true);

  const defaultPreset = visiblePresets[0] || presetsList[0];
  const readyToOrder = Boolean(zeofameConn && xmediaConn);

  // Fetch all Engagement catalog services from DB (universal API source)
  const catalogServices = await prisma.service.findMany({
    where: { category: { equals: "Engagement", mode: "insensitive" } },
    orderBy: [{ numericId: "asc" }, { createdAt: "asc" }],
  });

  const formattedCatalogServices = catalogServices.map((s) => ({
    service: s.numericId || (!isNaN(Number(s.externalId)) ? Number(s.externalId) : s.id),
    category: s.category,
    name: sanitizeBrandOrProviderName(s.name),
    platform: s.platform,
    type: s.type,
    rate: s.ratePer1000,
    min: s.minQuantity,
    max: s.maxQuantity,
    description: sanitizeBrandOrProviderName(s.description),
    active: s.active,
  }));

  const userZeofame = isAdmin
    ? zeofameStatus
    : {
        connected: zeofameStatus.connected,
        valid: zeofameStatus.valid,
        name: "Engagement Engine",
        hasService: zeofameStatus.hasService,
        message: zeofameStatus.connected ? "Operational" : "Temporarily Offline",
      };

  const userXmedia = isAdmin
    ? xmediaStatus
    : {
        connected: xmediaStatus.connected,
        valid: xmediaStatus.valid,
        name: "Views Engine",
        hasService: xmediaStatus.hasService,
        message: xmediaStatus.connected ? "Operational" : "Temporarily Offline",
      };

  return NextResponse.json({
    success: true,
    enabled: true,
    isAdmin,
    isVip,
    accountType: isVip ? "VIP_PASSKEY" : "REGISTERED_ACCOUNT",
    walletBalance,
    readyToOrder,
    zeofame: userZeofame,
    xmedia: userXmedia,
    services: formattedCatalogServices,
    pricingRates: {
      tiktok: {
        views: tiktokViewsRate,
        likes: tiktokLikesRate,
        saves: tiktokSavesRate,
        shares: tiktokSharesRate,
        reposts: tiktokRepostsRate,
        comments: tiktokCommentsRate,
      },
      instagram: {
        views: instagramViewsRate,
        likes: instagramLikesRate,
        saves: instagramSavesRate,
        shares: instagramSharesRate,
        reposts: instagramRepostsRate,
        comments: instagramCommentsRate,
      },
    },
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
    presets: visiblePresets,
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

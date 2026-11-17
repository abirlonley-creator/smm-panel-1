import { prisma } from "@/lib/prisma";
import { resolveTargetUrl } from "@/lib/urls/tiktok-resolver";
import {
  getTikTokEngagementConfigAsync,
  getTikTokPresetByIdAsync,
  TikTokTierPreset,
} from "./tiktok-preset-config";
import { getAdminViewsProvider, getAdminEngagementProvider } from "@/lib/provider/admin-provider";
import { logOrderEvent } from "./event-logger";
import { recordAdminAlert } from "./alert-service";
import { runEngagementTick } from "./worker";
import {
  generateOrganicDeliveryPlan,
  OrganicBatch,
  OrganicPlanResult,
  PacingStrategy,
} from "./organic-pacing-engine";

export interface CreateEngagementOrderParams {
  userId: string;
  targetUrl: string;
  serviceOrPreset: string | number;
  quantity?: number;
  shuffle?: boolean;
  plannedViews?: number[];
  viewOffsets?: number[];
  plannedLikes?: number[];
  plannedSaves?: number[];
  plannedShares?: number[];
  pacingStrategy?: PacingStrategy;
  peakHoursEnabled?: boolean;
  apiKeyId?: string;
}

export interface EngagementOrderResult {
  success: boolean;
  orderId?: string;
  orderRef?: string;
  numericOrder?: number;
  service?: number;
  preset?: string;
  name?: string;
  charge?: string;
  currency?: string;
  status?: string;
  targetViews?: number;
  targetLikes?: number;
  targetSaves?: number;
  targetShares?: number;
  batchesCount?: number;
  durationHours?: number;
  remainingBalance?: number;
  error?: string;
  statusCode?: number;
}

/**
 * Organic Random Distribution generator for realistic delivery pacing.
 */
export function generateOrganicRandomDistribution(
  target: number,
  count: number,
  minBound: number,
  maxBound: number,
  allowVariance: boolean = true
): number[] {
  if (count <= 0) return [];
  if (count === 1) return [Math.max(minBound, target)];

  let min = Math.max(1, minBound);
  let max = Math.max(min + 1, maxBound);

  const avg = target / count;
  if (max - min < 10 && avg > 10) {
    min = Math.max(minBound, Math.floor(avg * 0.7));
    max = Math.max(maxBound, Math.ceil(avg * 1.35));
  }

  let effectiveTarget = target;
  if (allowVariance && count > 1) {
    const varianceSpread = Math.max(2, Math.round(target * 0.025));
    const randomShift = Math.floor((Math.random() * 2 - 1) * varianceSpread);
    effectiveTarget = target + randomShift;
  }

  const clampedTarget = Math.max(count * min, Math.min(count * max, effectiveTarget));

  const items: number[] = [];
  for (let i = 0; i < count; i++) {
    items.push(Math.floor(Math.random() * (max - min + 1)) + min);
  }

  let currentSum = items.reduce((a, b) => a + b, 0);
  let diff = clampedTarget - currentSum;
  let attempts = 0;

  while (diff !== 0 && attempts < 8000) {
    attempts++;
    const idx = Math.floor(Math.random() * count);
    if (diff > 0 && items[idx] < max) {
      const room = max - items[idx];
      const step = Math.min(diff, Math.max(1, Math.floor(Math.random() * Math.min(room, 12)) + 1));
      items[idx] += step;
      diff -= step;
    } else if (diff < 0 && items[idx] > min) {
      const room = items[idx] - min;
      const step = Math.min(-diff, Math.max(1, Math.floor(Math.random() * Math.min(room, 12)) + 1));
      items[idx] -= step;
      diff += step;
    }
  }

  let guard = 0;
  while (diff > 0 && guard < count * 2) {
    const idx = guard % count;
    if (items[idx] < max) {
      items[idx]++;
      diff--;
    }
    guard++;
  }
  guard = 0;
  while (diff < 0 && guard < count * 2) {
    const idx = guard % count;
    if (items[idx] > min) {
      items[idx]--;
      diff++;
    }
    guard++;
  }

  // Fisher-Yates shuffle
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = items[i];
    items[i] = items[j];
    items[j] = temp;
  }

  return items;
}

/**
 * Generates an organic S-Curve delivery schedule with natural jittered checkpoints
 * and non-repeating batch quantities mimicking real social algorithm distribution.
 * Fully backed by OrganicSMM anti-bot evasion algorithms.
 */
export function generateOrganicSCurvePlan(
  target: number,
  runsCount: number,
  durationMinutes: number,
  minBound: number,
  maxBound: number,
  pacingStrategy?: PacingStrategy,
  peakHoursEnabled?: boolean
): { quantities: number[]; minuteOffsets: number[]; plan: OrganicPlanResult } {
  if (runsCount <= 1) {
    const singlePlan = generateOrganicDeliveryPlan("views", target, {
      durationHours: durationMinutes / 60,
      runsCount: 1,
      providerMinimum: minBound,
      applyInitialDelay: false,
      pacingStrategy: pacingStrategy || "s_curve",
      peakHoursEnabled: peakHoursEnabled ?? true,
    });
    return { quantities: [target], minuteOffsets: [0], plan: singlePlan };
  }

  const plan = generateOrganicDeliveryPlan("views", target, {
    durationHours: durationMinutes / 60,
    runsCount,
    providerMinimum: minBound,
    applyInitialDelay: false,
    pacingStrategy: pacingStrategy || "s_curve",
    peakHoursEnabled: peakHoursEnabled ?? true,
  });

  return {
    quantities: plan.runs.map((r) => r.quantity),
    minuteOffsets: plan.runs.map((r) => r.minuteOffset),
    plan,
  };
}

// Helper to resolve or import a service
async function resolveService(userProviderId: string, targetExtId: string, adapter: any, defaults: any) {
  let srv = await prisma.service.findFirst({
    where: {
      userProviderId,
      OR: [{ providerServiceId: targetExtId }, { externalId: targetExtId }],
    },
  });

  if (!srv) {
    try {
      const all = await adapter.getServices();
      const match = all.find((s: any) => String(s.id) === targetExtId);
      if (match) {
        srv = await prisma.service.create({
          data: {
            externalId: targetExtId,
            providerServiceId: targetExtId,
            name: match.name,
            type: match.type || "Default",
            platform: "TikTok",
            category: match.category || defaults.category,
            description: match.description || match.name || defaults.name,
            minQuantity: match.minQuantity || defaults.minQuantity,
            maxQuantity: match.maxQuantity || defaults.maxQuantity,
            ratePer1000: match.ratePer1000 || defaults.ratePer1000,
            userProviderId,
            active: true,
          },
        });
      }
    } catch {}
  }

  if (!srv) {
    srv = await prisma.service.create({
      data: {
        externalId: targetExtId,
        providerServiceId: targetExtId,
        name: defaults.name,
        type: "Default",
        platform: "TikTok",
        category: defaults.category,
        description: defaults.name,
        minQuantity: defaults.minQuantity,
        maxQuantity: defaults.maxQuantity,
        ratePer1000: defaults.ratePer1000,
        userProviderId,
        active: true,
      },
    });
  }

  return srv;
}

export const ENGAGEMENT_TIER_SERVICES = [
  {
    service: 101,
    alias: "2k",
    presetId: "tiktok_2k",
    name: "2k",
    displayName: "TikTok Engagement 2K",
    duration: "5 Hours",
    min: 2000,
    max: 2000,
    targetViews: 2960,
    targetLikes: 42,
    targetSaves: 0,
    targetShares: 0,
    description: "Organic 5-hour pacing with 16 randomized view batches and 3 synchronized like waves. Dynamic organic shuffle supported.",
  },
  {
    service: 102,
    alias: "5k",
    presetId: "tiktok_5k",
    name: "5k",
    displayName: "TikTok Engagement 5K",
    duration: "16 Hours",
    min: 5000,
    max: 5000,
    targetViews: 5100,
    targetLikes: 170,
    targetSaves: 44,
    targetShares: 22,
    description: "16-hour FYP velocity push with 20 randomized view batches, 14 like waves, 4 save waves, and 2 repost waves.",
  },
  {
    service: 103,
    alias: "10k",
    presetId: "tiktok_10k",
    name: "10k",
    displayName: "TikTok Engagement 10K",
    duration: "22 Hours",
    min: 10000,
    max: 10000,
    targetViews: 10500,
    targetLikes: 384,
    targetSaves: 90,
    targetShares: 44,
    description: "22-hour algorithm breakout with 26 view batches, 24 like waves, 8 save waves, and 4 repost waves.",
  },
  {
    service: 104,
    alias: "15k",
    presetId: "tiktok_15k",
    name: "15k",
    displayName: "TikTok Engagement 15K",
    duration: "24 Hours",
    min: 15000,
    max: 15000,
    targetViews: 15200,
    targetLikes: 550,
    targetSaves: 120,
    targetShares: 60,
    description: "24-hour full FYP acceleration surge with 30 view batches, 26 like waves, 10 save waves, and 6 repost waves.",
  },
];

/**
 * Returns formatted services catalog for the API v2 services endpoint.
 */
export async function getEngagementServicesCatalog() {
  const config = await getTikTokEngagementConfigAsync();
  const vRate = config.pricing?.viewsUserRate ?? 5.7;
  const lRate = config.pricing?.likesUserRate ?? 0.88;
  const sRate = config.pricing?.savesUserRate ?? 0.22;
  const shRate = config.pricing?.sharesUserRate ?? 0.22;

  return ENGAGEMENT_TIER_SERVICES.map((tier) => {
    const viewsCost = (tier.targetViews / 1000) * vRate;
    const likesCost = (tier.targetLikes / 1000) * lRate;
    const savesCost = (tier.targetSaves / 1000) * sRate;
    const sharesCost = (tier.targetShares / 1000) * shRate;
    const totalCost = Number((viewsCost + likesCost + savesCost + sharesCost).toFixed(2));

    return {
      service: tier.service,
      alias: tier.alias,
      category: "TikTok Engagement",
      name: tier.name,
      display_name: tier.displayName,
      platform: "tiktok",
      type: "engagement_campaign",
      rate: totalCost.toFixed(2),
      min: tier.min,
      max: tier.max,
      duration: tier.duration,
      target_views: tier.targetViews,
      target_likes: tier.targetLikes,
      target_saves: tier.targetSaves,
      target_shares: tier.targetShares,
      shuffle_supported: true,
      description: tier.description,
      status: "active",
    };
  });
}

/**
 * Creates an Engagement Campaign Order with deterministic/organic batch scheduling.
 */
export async function createEngagementOrderInternal(
  params: CreateEngagementOrderParams
): Promise<EngagementOrderResult> {
  let targetUrl = params.targetUrl.trim();
  const lowerUrl = targetUrl.toLowerCase();

  if (!lowerUrl.includes("tiktok.com")) {
    return {
      success: false,
      error: "Please enter a valid TikTok video URL (e.g. https://www.tiktok.com/@username/video/...)",
      statusCode: 400,
    };
  }

  if (lowerUrl.includes("vt.tiktok.com") || lowerUrl.includes("vm.tiktok.com")) {
    try {
      const resolved = await resolveTargetUrl(targetUrl);
      if (resolved?.normalizedUrl) {
        targetUrl = resolved.normalizedUrl;
      }
    } catch {}
  }

  const config = await getTikTokEngagementConfigAsync();
  if (!config.enabled) {
    return {
      success: false,
      error: "TikTok Engagement system is currently disabled by administrator.",
      statusCode: 503,
    };
  }

  // Resolve preset from shorthand ("2k", "5k", "10k", "15k"), numeric ID (101-104), or preset key
  const preset = await getTikTokPresetByIdAsync(String(params.serviceOrPreset));

  // Determine matched tier definition
  const matchedTier =
    ENGAGEMENT_TIER_SERVICES.find((t) => t.presetId === preset.id) ||
    ENGAGEMENT_TIER_SERVICES.find((t) => t.alias === String(params.serviceOrPreset).toLowerCase()) ||
    ENGAGEMENT_TIER_SERVICES[0];

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, walletBalance: true, username: true },
  });

  if (!user) {
    return { success: false, error: "User account not found", statusCode: 404 };
  }

  // 1. Resolve Admin Upstream Providers
  const [adminViews, adminEng] = await Promise.all([
    getAdminViewsProvider(),
    getAdminEngagementProvider(),
  ]);

  if (!adminViews || !adminEng) {
    return {
      success: false,
      error: "System delivery engines are not yet configured by administrator. Please contact support.",
      statusCode: 503,
    };
  }

  const xmediaConn = adminViews.connectionRecord;
  const zeofameConn = adminEng.connectionRecord;
  const xmediaAdapter = adminViews.adapter;
  const zeofameAdapter = adminEng.adapter;

  const viewsServiceId = config.views?.serviceId || preset.views.serviceId || "897";
  const likesServiceId = config.likes?.serviceId || preset.likes.serviceId || "1123";
  const savesServiceId = config.saves?.serviceId || preset.saves?.serviceId || "807";
  const sharesServiceId = config.shares?.serviceId || preset.shares?.serviceId || "718";

  const xmediaViewsService = await resolveService(xmediaConn.id, viewsServiceId, xmediaAdapter, {
    name: "TikTok Video Views [Medium Fast]",
    category: "TikTok Views",
    ratePer1000: 2.23,
    minQuantity: 100,
    maxQuantity: 100000000,
  });

  const zeofameLikesService = await resolveService(zeofameConn.id, likesServiceId, zeofameAdapter, {
    name: "TikTok Likes [Fast]",
    category: "TikTok Likes",
    ratePer1000: 0.88,
    minQuantity: 10,
    maxQuantity: 500000,
  });

  let zeofameSavesService: any = null;
  if (preset.saves?.enabled) {
    zeofameSavesService = await resolveService(zeofameConn.id, savesServiceId, zeofameAdapter, {
      name: "TikTok Video Save",
      category: "TikTok Saves",
      ratePer1000: 0.22,
      minQuantity: 10,
      maxQuantity: 500000,
    });
  }

  let zeofameSharesService: any = null;
  if (preset.shares?.enabled) {
    zeofameSharesService = await resolveService(zeofameConn.id, sharesServiceId, zeofameAdapter, {
      name: "TikTok Shares / Reposts",
      category: "TikTok Shares",
      ratePer1000: 0.22,
      minQuantity: 10,
      maxQuantity: 500000,
    });
  }

  // 2. Build Batch Schedules (with dynamic organic shuffle support)
  const now = Date.now();
  const viewsRate = config.pricing?.viewsUserRate ?? (xmediaViewsService?.ratePer1000 ? xmediaViewsService.ratePer1000 * 1.5 : 4.5);
  const likesRate = config.pricing?.likesUserRate ?? (zeofameLikesService?.ratePer1000 ? zeofameLikesService.ratePer1000 * 2.0 : 2.0);
  const savesRate = config.pricing?.savesUserRate ?? (zeofameSavesService?.ratePer1000 ? zeofameSavesService.ratePer1000 * 2.5 : 0.8);
  const sharesRate = config.pricing?.sharesUserRate ?? (zeofameSharesService?.ratePer1000 ? zeofameSharesService.ratePer1000 * 2.5 : 0.8);

  const shouldShuffle = params.shuffle !== false;

  // A. Views Runs
  const viewsRuns: Array<{ runNumber: number; scheduledAt: Date; quantity: number; cost: number }> = [];
  let totalPlannedViews = 0;
  let totalViewsCost = 0;
  let sCurvePlan: { quantities: number[]; minuteOffsets: number[]; plan: OrganicPlanResult } | null = null;

  if (preset.views.enabled !== false) {
    const minV = Math.min(preset.views.minQuantity, preset.views.maxQuantity);
    const maxV = Math.max(preset.views.minQuantity, preset.views.maxQuantity);
    const targetV = preset.targetViews || matchedTier.targetViews;
    const durationMinutes = (preset.durationHours || 5) * 60;

    sCurvePlan = shouldShuffle
      ? generateOrganicSCurvePlan(
          targetV,
          preset.views.runsCount,
          durationMinutes,
          minV,
          maxV,
          params.pacingStrategy,
          params.peakHoursEnabled
        )
      : null;

    for (let i = 0; i < preset.views.runsCount; i++) {
      let qty: number;
      if (params.plannedViews && typeof params.plannedViews[i] === "number" && params.plannedViews[i] >= Math.min(minV, 100)) {
        qty = params.plannedViews[i];
      } else if (sCurvePlan?.quantities[i]) {
        qty = sCurvePlan.quantities[i];
      } else {
        qty = Math.floor(Math.random() * (maxV - minV + 1)) + minV;
      }

      const offsetMinutes = sCurvePlan?.minuteOffsets[i] ?? (i * preset.views.intervalMinutes);
      const scheduledAt = new Date(now + offsetMinutes * 60 * 1000);
      const runCost = Number(((qty / 1000) * viewsRate).toFixed(4));

      totalPlannedViews += qty;
      totalViewsCost += runCost;
      viewsRuns.push({ runNumber: i + 1, scheduledAt, quantity: qty, cost: runCost });
    }
  }

  // B. Likes Runs
  const likesRuns: Array<{ runNumber: number; scheduledAt: Date; quantity: number; cost: number }> = [];
  let totalPlannedLikes = 0;
  let totalLikesCost = 0;

  if (preset.likes.enabled !== false) {
    const minL = Math.min(preset.likes.minQuantity, preset.likes.maxQuantity);
    const maxL = Math.max(preset.likes.minQuantity, preset.likes.maxQuantity);
    const targetL = preset.targetLikes || matchedTier.targetLikes;
    const likesOffsets = preset.likes.waveOffsets || [120, 200, 280];

    const randomizedLikes = shouldShuffle
      ? generateOrganicRandomDistribution(targetL, preset.likes.runsCount, minL, maxL, true)
      : [];

    for (let i = 0; i < preset.likes.runsCount; i++) {
      let qty: number;
      if (params.plannedLikes && typeof params.plannedLikes[i] === "number" && params.plannedLikes[i] >= Math.min(minL, 10)) {
        qty = params.plannedLikes[i];
      } else if (randomizedLikes[i]) {
        qty = randomizedLikes[i];
      } else {
        qty = Math.floor(Math.random() * (maxL - minL + 1)) + minL;
      }

      const offsetMinutes = likesOffsets[i] ?? (120 + i * 80);
      const scheduledAt = new Date(now + offsetMinutes * 60 * 1000);
      const runCost = Number(((qty / 1000) * likesRate).toFixed(4));

      totalPlannedLikes += qty;
      totalLikesCost += runCost;
      likesRuns.push({ runNumber: i + 1, scheduledAt, quantity: qty, cost: runCost });
    }
  }

  // C. Saves Runs
  const savesRuns: Array<{ runNumber: number; scheduledAt: Date; quantity: number; cost: number }> = [];
  let totalPlannedSaves = 0;
  let totalSavesCost = 0;

  if (preset.saves?.enabled) {
    const minS = Math.min(preset.saves.minQuantity, preset.saves.maxQuantity);
    const maxS = Math.max(preset.saves.minQuantity, preset.saves.maxQuantity);
    const targetS = preset.targetSaves || matchedTier.targetSaves;
    const savesOffsets = preset.saves.waveOffsets || [180, 360, 600];

    const randomizedSaves = shouldShuffle
      ? generateOrganicRandomDistribution(targetS, preset.saves.runsCount, minS, maxS, true)
      : [];

    for (let i = 0; i < preset.saves.runsCount; i++) {
      let qty: number;
      if (params.plannedSaves && typeof params.plannedSaves[i] === "number" && params.plannedSaves[i] >= Math.min(minS, 10)) {
        qty = params.plannedSaves[i];
      } else if (randomizedSaves[i]) {
        qty = randomizedSaves[i];
      } else {
        qty = Math.floor(Math.random() * (maxS - minS + 1)) + minS;
      }

      const offsetMinutes = savesOffsets[i] ?? (180 + i * 180);
      const scheduledAt = new Date(now + offsetMinutes * 60 * 1000);
      const runCost = Number(((qty / 1000) * savesRate).toFixed(4));

      totalPlannedSaves += qty;
      totalSavesCost += runCost;
      savesRuns.push({ runNumber: i + 1, scheduledAt, quantity: qty, cost: runCost });
    }
  }

  // D. Shares Runs
  const sharesRuns: Array<{ runNumber: number; scheduledAt: Date; quantity: number; cost: number }> = [];
  let totalPlannedShares = 0;
  let totalSharesCost = 0;

  if (preset.shares?.enabled) {
    const minR = Math.min(preset.shares.minQuantity, preset.shares.maxQuantity);
    const maxR = Math.max(preset.shares.minQuantity, preset.shares.maxQuantity);
    const targetR = preset.targetShares || matchedTier.targetShares;
    const sharesOffsets = preset.shares.waveOffsets || [300, 540];

    const randomizedShares = shouldShuffle
      ? generateOrganicRandomDistribution(targetR, preset.shares.runsCount, minR, maxR, true)
      : [];

    for (let i = 0; i < preset.shares.runsCount; i++) {
      let qty: number;
      if (params.plannedShares && typeof params.plannedShares[i] === "number" && params.plannedShares[i] >= Math.min(minR, 5)) {
        qty = params.plannedShares[i];
      } else if (randomizedShares[i]) {
        qty = randomizedShares[i];
      } else {
        qty = Math.floor(Math.random() * (maxR - minR + 1)) + minR;
      }

      const offsetMinutes = sharesOffsets[i] ?? (300 + i * 240);
      const scheduledAt = new Date(now + offsetMinutes * 60 * 1000);
      const runCost = Number(((qty / 1000) * sharesRate).toFixed(4));

      totalPlannedShares += qty;
      totalSharesCost += runCost;
      sharesRuns.push({ runNumber: i + 1, scheduledAt, quantity: qty, cost: runCost });
    }
  }

  const totalCost = Number((totalViewsCost + totalLikesCost + totalSavesCost + totalSharesCost).toFixed(2));
  const currentBalance = user.walletBalance ?? 0;

  if (currentBalance < totalCost) {
    const needed = Number((totalCost - currentBalance).toFixed(2));
    return {
      success: false,
      error: `Insufficient wallet balance. Total cost is ₹${totalCost.toFixed(2)}, but your current balance is ₹${currentBalance.toFixed(2)}. Please add ₹${needed.toFixed(2)} to continue.`,
      statusCode: 402,
    };
  }

  // 3. Admin Upstream Balance Check
  const viewsWholesaleCost = Number(((totalPlannedViews / 1000) * (xmediaViewsService.ratePer1000 || 2.23)).toFixed(4));
  const engWholesaleCost = Number((
    (totalPlannedLikes / 1000) * (zeofameLikesService.ratePer1000 || 0.88) +
    (totalPlannedSaves / 1000) * (zeofameSavesService?.ratePer1000 || 0.22) +
    (totalPlannedShares / 1000) * (zeofameSharesService?.ratePer1000 || 0.22)
  ).toFixed(4));

  const viewsProviderBalance = typeof xmediaConn.balance === "number" ? xmediaConn.balance : null;
  const engProviderBalance = typeof zeofameConn.balance === "number" ? zeofameConn.balance : null;

  let adminOutOfBalanceProvider: string | null = null;
  if (totalPlannedViews > 0 && viewsProviderBalance !== null && viewsProviderBalance <= 0) {
    adminOutOfBalanceProvider = xmediaConn.name || "Views Network";
  } else if ((totalPlannedLikes > 0 || totalPlannedSaves > 0 || totalPlannedShares > 0) && engProviderBalance !== null && engProviderBalance <= 0) {
    adminOutOfBalanceProvider = zeofameConn.name || "Engagement Network";
  } else if (totalPlannedViews > 0 && viewsProviderBalance !== null && viewsProviderBalance < viewsWholesaleCost && !xmediaConn.isMock) {
    adminOutOfBalanceProvider = xmediaConn.name || "Views Network";
  } else if ((totalPlannedLikes > 0 || totalPlannedSaves > 0 || totalPlannedShares > 0) && engProviderBalance !== null && engProviderBalance < engWholesaleCost && !zeofameConn.isMock) {
    adminOutOfBalanceProvider = zeofameConn.name || "Engagement Network";
  }

  if (adminOutOfBalanceProvider) {
    await recordAdminAlert({
      severity: "high",
      type: "insufficient_balance",
      providerName: adminOutOfBalanceProvider,
      providerId: xmediaConn.id,
      userId: user.id,
      platform: "TikTok",
      reason: `Admin provider "${adminOutOfBalanceProvider}" has run out of balance. User @${user.username} tried to place order (${matchedTier.name}) with sufficient balance, but upstream provider is depleted.`,
    }).catch(() => {});

    return {
      success: false,
      error: "Admin provider balance depleted. Admin has been notified to refill balance.",
      statusCode: 503,
    };
  }

  // 4. Sequential numeric order ID (e.g. 5-digit number starting at 90000)
  const lastOrder = await prisma.order.findFirst({
    where: { numericId: { not: null } },
    orderBy: { numericId: "desc" },
    select: { numericId: true },
  });

  const nextNumericId =
    lastOrder && typeof lastOrder.numericId === "number" && lastOrder.numericId >= 90000
      ? lastOrder.numericId + 1
      : 90000 + Math.floor(Math.random() * 8000) + 1;

  const orderRef = `ENG-${nextNumericId}`;
  const newBalance = Number((currentBalance - totalCost).toFixed(2));

  // 5. Transactional Execution
  const result = await prisma.$transaction(async (tx) => {
    // A. Debit wallet
    await tx.user.update({
      where: { id: user.id },
      data: { walletBalance: newBalance },
    });

    // B. Create audit transaction
    await tx.walletTransaction.create({
      data: {
        userId: user.id,
        type: "DEBIT",
        amount: -totalCost,
        balanceAfter: newBalance,
        referenceId: orderRef,
        description: `TikTok Engagement (${matchedTier.name}): ${totalPlannedViews} Views, ${totalPlannedLikes} Likes${totalPlannedSaves ? `, ${totalPlannedSaves} Saves` : ""}${totalPlannedShares ? `, ${totalPlannedShares} Reposts` : ""}`,
      },
    });

    const enabledTypes: string[] = [];
    if (totalPlannedViews > 0) enabledTypes.push("views");
    if (totalPlannedLikes > 0) enabledTypes.push("likes");
    if (totalPlannedSaves > 0) enabledTypes.push("saves");
    if (totalPlannedShares > 0) enabledTypes.push("shares");

    // C. Create EngagementOrder
    const engagementOrder = await tx.engagementOrder.create({
      data: {
        orderRef,
        userId: user.id,
        targetUrl,
        platform: "TikTok",
        profileId: preset.id,
        presetKey: matchedTier.name,
        baseViews: totalPlannedViews,
        durationHours: Math.ceil(preset.durationHours),
        seed: `aurasmm_${Date.now()}`,
        status: "PROCESSING",
        totalCost,
        refundedAmount: 0,
        plannedViews: totalPlannedViews,
        plannedLikes: totalPlannedLikes,
        plannedSaves: totalPlannedSaves,
        plannedShares: totalPlannedShares,
        enabledTypes: JSON.stringify(enabledTypes),
        planParams: JSON.stringify({
          version: "organicsmm_v2",
          pacingEngine: "organic_anti_bot_v2",
          pacingStrategy: params.pacingStrategy || "s_curve",
          peakHoursEnabled: params.peakHoursEnabled ?? true,
          avgHumanScore: sCurvePlan?.plan?.avgHumanScore ?? 84,
          varietyIndex: sCurvePlan?.plan?.varietyIndex ?? 42,
          patternBreakCount: sCurvePlan?.plan?.patternBreakCount ?? 0,
          presetId: preset.id,
          presetName: preset.name,
          tierName: matchedTier.name,
          durationHours: preset.durationHours,
          shuffled: shouldShuffle,
          viewsRuns: viewsRuns.length,
          likesRuns: likesRuns.length,
          savesRuns: savesRuns.length,
          sharesRuns: sharesRuns.length,
        }),
      },
    });

    // Valid providers set to avoid foreign key errors
    const validProviders = new Set((await tx.provider.findMany({ select: { id: true } })).map((p) => p.id));
    const viewsProviderId = xmediaViewsService.providerId && validProviders.has(xmediaViewsService.providerId) ? xmediaViewsService.providerId : null;
    const likesProviderId = zeofameLikesService.providerId && validProviders.has(zeofameLikesService.providerId) ? zeofameLikesService.providerId : null;
    const savesProviderId = zeofameSavesService?.providerId && validProviders.has(zeofameSavesService.providerId) ? zeofameSavesService.providerId : null;
    const sharesProviderId = zeofameSharesService?.providerId && validProviders.has(zeofameSharesService.providerId) ? zeofameSharesService.providerId : null;

    // D. Create Runs
    for (const vr of viewsRuns) {
      await tx.engagementRun.create({
        data: {
          engagementOrderId: engagementOrder.id,
          engagementType: "views",
          serviceId: xmediaViewsService.id,
          providerId: viewsProviderId,
          providerServiceId: String(xmediaViewsService.providerServiceId || xmediaViewsService.externalId),
          runNumber: vr.runNumber,
          scheduledAt: vr.scheduledAt,
          quantity: vr.quantity,
          plannedCumulative: 0,
          status: "scheduled",
          cost: vr.cost,
        },
      });
    }

    for (const lr of likesRuns) {
      await tx.engagementRun.create({
        data: {
          engagementOrderId: engagementOrder.id,
          engagementType: "likes",
          serviceId: zeofameLikesService.id,
          providerId: likesProviderId,
          providerServiceId: String(zeofameLikesService.providerServiceId || zeofameLikesService.externalId),
          runNumber: lr.runNumber,
          scheduledAt: lr.scheduledAt,
          quantity: lr.quantity,
          plannedCumulative: 0,
          status: "scheduled",
          cost: lr.cost,
        },
      });
    }

    for (const sr of savesRuns) {
      await tx.engagementRun.create({
        data: {
          engagementOrderId: engagementOrder.id,
          engagementType: "saves",
          serviceId: zeofameSavesService.id,
          providerId: savesProviderId,
          providerServiceId: String(zeofameSavesService.providerServiceId || zeofameSavesService.externalId),
          runNumber: sr.runNumber,
          scheduledAt: sr.scheduledAt,
          quantity: sr.quantity,
          plannedCumulative: 0,
          status: "scheduled",
          cost: sr.cost,
        },
      });
    }

    for (const shr of sharesRuns) {
      await tx.engagementRun.create({
        data: {
          engagementOrderId: engagementOrder.id,
          engagementType: "shares",
          serviceId: zeofameSharesService.id,
          providerId: sharesProviderId,
          providerServiceId: String(zeofameSharesService.providerServiceId || zeofameSharesService.externalId),
          runNumber: shr.runNumber,
          scheduledAt: shr.scheduledAt,
          quantity: shr.quantity,
          plannedCumulative: 0,
          status: "scheduled",
          cost: shr.cost,
        },
      });
    }

    // E. Create parent Order entry for global tracking
    const mainOrder = await tx.order.create({
      data: {
        numericId: nextNumericId,
        orderRef,
        userId: user.id,
        serviceId: xmediaViewsService.id,
        targetUrl,
        requestedQuantity: totalPlannedViews,
        submittedQuantity: totalPlannedViews,
        remainingQuantity: totalPlannedViews,
        deliveredQuantity: 0,
        unitCost: viewsRate,
        totalCost,
        status: "PROCESSING",
        scheduleMode: "TIKTOK_ENGAGEMENT",
        notes: JSON.stringify({
          isEngagement: true,
          presetId: preset.id,
          tierName: matchedTier.name,
          totalPlannedViews,
          totalPlannedLikes,
          totalPlannedSaves,
          totalPlannedShares,
          durationHours: preset.durationHours,
        }),
      },
    });

    // F. Increment API Key order counter if placed via API
    if (params.apiKeyId) {
      await tx.userApiKey.update({
        where: { id: params.apiKeyId },
        data: { totalOrders: { increment: 1 } },
      }).catch(() => {});
    }

    return { engagementOrder, mainOrder };
  });

  const totalRunsCount = viewsRuns.length + likesRuns.length + savesRuns.length + sharesRuns.length;

  await logOrderEvent({
    orderId: result.engagementOrder.id,
    eventType: "STATE_CHANGE",
    message: `Engagement campaign created with preset "${matchedTier.name}". Scheduled ${totalRunsCount} batches over ${preset.durationHours} hours.`,
  });

  // Trigger background execution
  runEngagementTick().catch(() => {});

  return {
    success: true,
    orderId: result.engagementOrder.id,
    orderRef,
    numericOrder: nextNumericId,
    service: matchedTier.service,
    preset: matchedTier.alias,
    name: matchedTier.name,
    charge: totalCost.toFixed(2),
    currency: "INR",
    status: "processing",
    targetViews: totalPlannedViews,
    targetLikes: totalPlannedLikes,
    targetSaves: totalPlannedSaves,
    targetShares: totalPlannedShares,
    batchesCount: totalRunsCount,
    durationHours: Math.ceil(preset.durationHours),
    remainingBalance: newBalance,
  };
}

/**
 * Retrieves full details for an Engagement order.
 */
export async function getEngagementOrderDetails(
  orderIdentifier: string,
  userId: string
) {
  const clean = orderIdentifier.trim();
  const num = parseInt(clean, 10);

  const searchCond: any[] = [{ id: clean }, { orderRef: clean }, { orderRef: `ENG-${clean}` }];

  // Look in EngagementOrder first
  let engOrder = await prisma.engagementOrder.findFirst({
    where: {
      OR: searchCond,
    },
    include: {
      runs: {
        orderBy: { runNumber: "asc" },
      },
    },
  });

  if (!engOrder && !isNaN(num)) {
    // Check through parent Order numericId
    const parent = await prisma.order.findFirst({
      where: { numericId: num },
      select: { orderRef: true, userId: true },
    });
    if (parent) {
      engOrder = await prisma.engagementOrder.findFirst({
        where: { orderRef: parent.orderRef },
        include: { runs: { orderBy: { runNumber: "asc" } } },
      });
    }
  }

  if (!engOrder) {
    return null;
  }

  // Security check: only owner or admin can view
  if (engOrder.userId && engOrder.userId !== userId) {
    return { unauthorized: true };
  }

  // Map to standard status: pending, in_progress, completed, cancelled, failed
  const rawStatus = (engOrder.status || "").toUpperCase();
  let v2Status: "pending" | "in_progress" | "completed" | "cancelled" | "failed" = "in_progress";
  if (rawStatus === "PENDING" || rawStatus === "SCHEDULED") v2Status = "pending";
  else if (rawStatus === "COMPLETED") v2Status = "completed";
  else if (rawStatus === "CANCELLED") v2Status = "cancelled";
  else if (rawStatus === "FAILED") v2Status = "failed";

  const totalBatches = engOrder.runs.length;
  const completedBatches = engOrder.runs.filter(
    (r) => r.status === "confirmed" || r.status === "completed"
  ).length;

  const matchedTier =
    ENGAGEMENT_TIER_SERVICES.find((t) => t.presetId === engOrder!.profileId) ||
    ENGAGEMENT_TIER_SERVICES.find((t) => t.name.toLowerCase() === (engOrder!.presetKey || "").toLowerCase()) ||
    ENGAGEMENT_TIER_SERVICES[0];

  const numericOrder = parseInt(engOrder.orderRef.replace(/\D/g, ""), 10) || 0;

  return {
    order: numericOrder || engOrder.orderRef,
    order_ref: engOrder.orderRef,
    service: matchedTier.service,
    preset: matchedTier.alias,
    name: matchedTier.name,
    link: engOrder.targetUrl,
    status: v2Status,
    duration_hours: engOrder.durationHours,
    planned_views: engOrder.plannedViews,
    delivered_views: engOrder.deliveredViews,
    planned_likes: engOrder.plannedLikes,
    delivered_likes: engOrder.deliveredLikes,
    planned_saves: engOrder.plannedSaves,
    delivered_saves: engOrder.deliveredSaves,
    planned_shares: engOrder.plannedShares,
    delivered_shares: engOrder.deliveredShares,
    remains: Math.max(0, engOrder.plannedViews - engOrder.deliveredViews),
    total_batches: totalBatches,
    completed_batches: completedBatches,
    charge: engOrder.totalCost.toFixed(2),
    currency: "INR",
    created_at: engOrder.createdAt.toISOString(),
  };
}

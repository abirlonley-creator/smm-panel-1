import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/security/crypto";
import { StandardSMMv2Provider, MockSMMProvider } from "@/lib/provider/adapter";
import {
  getTikTokEngagementConfigAsync,
  getTikTokPresetByIdAsync,
} from "@/lib/engagement/tiktok-preset-config";
import { getAdminViewsProvider, getAdminEngagementProvider } from "@/lib/provider/admin-provider";
import { logOrderEvent } from "@/lib/engagement/event-logger";
import { recordAdminAlert } from "@/lib/engagement/alert-service";
import { runEngagementTick } from "@/lib/engagement/worker";
import { resolveTargetUrl } from "@/lib/urls/tiktok-resolver";
import { getMaintenanceState } from "@/lib/maintenance/maintenance-service";
import {
  generateOrganicDeliveryPlan,
  generateTikTokAlgorithmicPlan,
} from "@/lib/engagement/organic-pacing-engine";
import {
  DEFAULT_PACKAGES,
  generatePattern,
  PackageConfig,
} from "@/lib/engagement/deterministic-pattern-engine";
import { z } from "zod";

const createEngagementOrderSchema = z.object({
  targetUrl: z.string().url("Valid post or video URL required"),
  presetId: z.string().optional().default("tiktok_2k"),
  presetName: z.string().optional(),
  platform: z.string().default("TikTok"),
  followers: z.number().int().min(0).optional().default(500),
  seed: z.string().optional(),
  scheduledStartTime: z.string().optional(),
  packagePriceInr: z.number().optional(),
  totalCostInr: z.number().optional(),
  batches: z.array(
    z.object({
      id: z.string().optional(),
      service: z.enum(["views", "likes", "saves", "reposts", "shares", "comments"]),
      tick: z.number().optional().default(0),
      minuteOffset: z.number(),
      clockTime: z.string().optional(),
      quantity: z.number(),
      cumulativeAfter: z.number().optional(),
    })
  ).optional(),
  rows: z.array(z.any()).optional(),
  plannedViews: z.array(z.number().int()).optional(),
  viewOffsets: z.array(z.number().int()).optional(),
  plannedLikes: z.array(z.number().int()).optional(),
  likeOffsets: z.array(z.number().int()).optional(),
  plannedSaves: z.array(z.number().int()).optional(),
  saveOffsets: z.array(z.number().int()).optional(),
  plannedShares: z.array(z.number().int()).optional(),
  shareOffsets: z.array(z.number().int()).optional(),
  plannedComments: z.array(z.number().int()).optional(),
  commentOffsets: z.array(z.number().int()).optional(),
  pacingStrategy: z.enum(["s_curve", "burst", "normal", "peak_hours", "stealth"]).optional().default("s_curve"),
  peakHoursEnabled: z.boolean().optional().default(true),
});

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

export async function POST(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const maintenance = await getMaintenanceState();
  if (maintenance.enabled && session.user.role !== "ADMIN") {
    return NextResponse.json(
      {
        success: false,
        underMaintenance: true,
        error: "Currently we're updating the website. Please hold on for a moment while admin completes updates. Your existing orders remain actively delivering.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createEngagementOrderSchema.parse(body);

    let targetUrl = parsed.targetUrl.trim();
    const lowerUrl = targetUrl.toLowerCase();
    if (!lowerUrl.includes("tiktok.com")) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid TikTok video URL (e.g. https://www.tiktok.com/@username/video/...)" },
        { status: 400 }
      );
    }

    if (lowerUrl.includes("vt.tiktok.com") || lowerUrl.includes("vm.tiktok.com")) {
      try {
        const resolved = await resolveTargetUrl(targetUrl);
        if (resolved?.normalizedUrl) {
          targetUrl = resolved.normalizedUrl;
        }
      } catch (err: any) {
        console.warn("[ENGAGEMENT] URL resolution warning:", err?.message);
      }
    }

    const config = await getTikTokEngagementConfigAsync();
    if (!config.enabled) {
      return NextResponse.json(
        { success: false, error: "TikTok Engagement system is currently disabled by administrator." },
        { status: 503 }
      );
    }

    const preset = await getTikTokPresetByIdAsync(parsed.presetId || parsed.presetName);
    if (preset && (preset.disabled === true || preset.enabled === false)) {
      return NextResponse.json(
        {
          success: false,
          error: "This growth package is currently unavailable or has been disabled by the administrator.",
        },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, walletBalance: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User account not found" }, { status: 404 });
    }

    // 1. Resolve System Upstream Execution Providers (Managed exclusively by Admin)
    const [adminViews, adminEng] = await Promise.all([
      getAdminViewsProvider(),
      getAdminEngagementProvider(),
    ]);

    if (!adminViews || !adminEng) {
      return NextResponse.json(
        {
          success: false,
          error: "System delivery engines are not yet configured by administrator. Please contact support.",
        },
        { status: 503 }
      );
    }

    const xmediaConn = adminViews.connectionRecord;
    const zeofameConn = adminEng.connectionRecord;
    const xmediaAdapter = adminViews.adapter;
    const zeofameAdapter = adminEng.adapter;

    // 2. Resolve Required Services linked to Admin's Provider Connections using Admin Preset configuration
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
    if (
      preset.shares?.enabled ||
      (parsed.batches && parsed.batches.some((b) => b.service === "shares" || b.service === "reposts"))
    ) {
      zeofameSharesService = await resolveService(zeofameConn.id, sharesServiceId, zeofameAdapter, {
        name: "TikTok Shares / Reposts",
        category: "TikTok Shares",
        ratePer1000: 0.22,
        minQuantity: 10,
        maxQuantity: 500000,
      });
    }

    // Comments service (optional engagement add-on)
    let zeofameCommentsService: any = null;
    const commentsServiceId = config.comments?.serviceId || "950";
    const hasComments =
      (parsed.batches && parsed.batches.some((b) => b.service === "comments")) ||
      (parsed.plannedComments && parsed.plannedComments.length > 0);

    if (hasComments) {
      zeofameCommentsService = await resolveService(zeofameConn.id, commentsServiceId, zeofameAdapter, {
        name: "TikTok Comments",
        category: "TikTok Comments",
        ratePer1000: 15.00,
        minQuantity: 1,
        maxQuantity: 10000,
      });
    }

    // 3. Build Batch Runs - Calculated with Admin Configured Selling Rates
    const now = Date.now();
    const viewsRate = config.pricing?.viewsUserRate ?? (xmediaViewsService?.ratePer1000 ? xmediaViewsService.ratePer1000 * 1.5 : 4.50);
    const likesRate = config.pricing?.likesUserRate ?? (zeofameLikesService?.ratePer1000 ? zeofameLikesService.ratePer1000 * 2.0 : 2.00);
    const savesRate = config.pricing?.savesUserRate ?? (zeofameSavesService?.ratePer1000 ? zeofameSavesService.ratePer1000 * 2.5 : 0.80);
    const sharesRate = config.pricing?.sharesUserRate ?? (zeofameSharesService?.ratePer1000 ? zeofameSharesService.ratePer1000 * 2.5 : 0.80);
    const commentsRate = config.pricing?.commentsUserRate ?? 15.00;

    // A–D. Build Runs — ALWAYS use deterministic plan batches when provided.
    // The legacy min/max/interval/runsCount fields in admin are no longer used for ordering.
    const viewsRuns: Array<{ runNumber: number; scheduledAt: Date; quantity: number; cost: number }> = [];
    let totalPlannedViews = 0;
    let totalViewsCost = 0;

    // Only run the legacy path if no deterministic batches were submitted
    const hasDeterministicBatches = Array.isArray(parsed.batches) && parsed.batches.length > 0;
    let fallbackViewsPlan: any = null;

    if (!hasDeterministicBatches && preset.views.enabled !== false) {
      const minV = Math.min(preset.views.minQuantity, preset.views.maxQuantity);
      const maxV = Math.max(preset.views.minQuantity, preset.views.maxQuantity);
      const targetViews = preset.targetViews || 2960;

      if (!parsed.viewOffsets || parsed.viewOffsets.length === 0) {
        const algo = generateTikTokAlgorithmicPlan(targetViews, {
          durationHours: preset.durationHours,
          strategy: parsed.pacingStrategy,
          peakHoursEnabled: parsed.peakHoursEnabled,
          providerMinViews: minV,
          targetLikes: preset.targetLikes,
          targetSaves: preset.targetSaves,
          targetShares: preset.targetShares,
        });
        fallbackViewsPlan = algo.views.plan;
      }

      const viewsRunsCount = (parsed.plannedViews && parsed.plannedViews.length > 0)
        ? parsed.plannedViews.length
        : preset.views.runsCount;

      for (let i = 0; i < viewsRunsCount; i++) {
        let qty: number;
        if (
          parsed.plannedViews &&
          typeof parsed.plannedViews[i] === "number" &&
          parsed.plannedViews[i] >= Math.min(minV, 100)
        ) {
          qty = parsed.plannedViews[i];
        } else if (fallbackViewsPlan?.runs[i]) {
          qty = fallbackViewsPlan.runs[i].quantity;
        } else {
          qty = Math.floor(Math.random() * (maxV - minV + 1)) + minV;
        }

        const offsetMinutes =
          parsed.viewOffsets && typeof parsed.viewOffsets[i] === "number"
            ? parsed.viewOffsets[i]
            : (fallbackViewsPlan?.runs[i]?.minuteOffset ?? (i * preset.views.intervalMinutes));

        const scheduledAt = new Date(now + offsetMinutes * 60 * 1000);
        const runCost = Number(((qty / 1000) * viewsRate).toFixed(4));

        totalPlannedViews += qty;
        totalViewsCost += runCost;
        viewsRuns.push({ runNumber: i + 1, scheduledAt, quantity: qty, cost: runCost });
      }
    }

    // B. Likes Runs (if enabled — legacy path only, overridden below by deterministic batches)
    const likesRuns: Array<{ runNumber: number; scheduledAt: Date; quantity: number; cost: number }> = [];
    let totalPlannedLikes = 0;
    let totalLikesCost = 0;
    if (!hasDeterministicBatches && preset.likes.enabled !== false) {
      const minL = Math.min(preset.likes.minQuantity, preset.likes.maxQuantity);
      const maxL = Math.max(preset.likes.minQuantity, preset.likes.maxQuantity);
      const likesOffsets = preset.likes.waveOffsets || [120, 200, 280];
      const likesRunsCount = (parsed.plannedLikes && parsed.plannedLikes.length > 0)
        ? parsed.plannedLikes.length
        : preset.likes.runsCount;

      for (let i = 0; i < likesRunsCount; i++) {
        let qty: number;
        if (
          parsed.plannedLikes &&
          typeof parsed.plannedLikes[i] === "number" &&
          parsed.plannedLikes[i] >= Math.min(minL, 10)
        ) {
          qty = parsed.plannedLikes[i];
        } else {
          qty = Math.floor(Math.random() * (maxL - minL + 1)) + minL;
        }
        const offsetMinutes =
          parsed.likeOffsets && typeof parsed.likeOffsets[i] === "number"
            ? parsed.likeOffsets[i]
            : (likesOffsets[i] ?? (120 + i * 80));
        const scheduledAt = new Date(now + offsetMinutes * 60 * 1000);
        const runCost = Number(((qty / 1000) * likesRate).toFixed(4));

        totalPlannedLikes += qty;
        totalLikesCost += runCost;
        likesRuns.push({ runNumber: i + 1, scheduledAt, quantity: qty, cost: runCost });
      }
    }

    // C. Saves Runs (legacy path only — overridden by deterministic batches below)
    const savesRuns: Array<{ runNumber: number; scheduledAt: Date; quantity: number; cost: number }> = [];
    let totalPlannedSaves = 0;
    let totalSavesCost = 0;
    if (!hasDeterministicBatches && preset.saves?.enabled) {
      const minS = Math.min(preset.saves.minQuantity, preset.saves.maxQuantity);
      const maxS = Math.max(preset.saves.minQuantity, preset.saves.maxQuantity);
      const savesOffsets = preset.saves.waveOffsets || [180, 360, 600];
      const savesRunsCount = (parsed.plannedSaves && parsed.plannedSaves.length > 0)
        ? parsed.plannedSaves.length
        : (preset.saves?.runsCount || 0);

      for (let i = 0; i < savesRunsCount; i++) {
        let qty: number;
        if (
          parsed.plannedSaves &&
          typeof parsed.plannedSaves[i] === "number" &&
          parsed.plannedSaves[i] >= Math.min(minS, 10)
        ) {
          qty = parsed.plannedSaves[i];
        } else {
          qty = Math.floor(Math.random() * (maxS - minS + 1)) + minS;
        }
        const offsetMinutes =
          parsed.saveOffsets && typeof parsed.saveOffsets[i] === "number"
            ? parsed.saveOffsets[i]
            : (savesOffsets[i] ?? (180 + i * 180));
        const scheduledAt = new Date(now + offsetMinutes * 60 * 1000);
        const runCost = Number(((qty / 1000) * savesRate).toFixed(4));

        totalPlannedSaves += qty;
        totalSavesCost += runCost;
        savesRuns.push({ runNumber: i + 1, scheduledAt, quantity: qty, cost: runCost });
      }
    }

    // D. Shares/Reposts Runs (legacy path only — overridden by deterministic batches below)
    const sharesRuns: Array<{ runNumber: number; scheduledAt: Date; quantity: number; cost: number }> = [];
    let totalPlannedShares = 0;
    let totalSharesCost = 0;
    if (!hasDeterministicBatches && preset.shares?.enabled) {
      const minR = Math.min(preset.shares.minQuantity, preset.shares.maxQuantity);
      const maxR = Math.max(preset.shares.minQuantity, preset.shares.maxQuantity);
      const sharesOffsets = preset.shares.waveOffsets || [300, 540];
      const sharesRunsCount = (parsed.plannedShares && parsed.plannedShares.length > 0)
        ? parsed.plannedShares.length
        : (preset.shares?.runsCount || 0);

      for (let i = 0; i < sharesRunsCount; i++) {
        let qty: number;
        if (
          parsed.plannedShares &&
          typeof parsed.plannedShares[i] === "number" &&
          parsed.plannedShares[i] >= Math.min(minR, 5)
        ) {
          qty = parsed.plannedShares[i];
        } else {
          qty = Math.floor(Math.random() * (maxR - minR + 1)) + minR;
        }
        const offsetMinutes =
          parsed.shareOffsets && typeof parsed.shareOffsets[i] === "number"
            ? parsed.shareOffsets[i]
            : (sharesOffsets[i] ?? (300 + i * 240));
        const scheduledAt = new Date(now + offsetMinutes * 60 * 1000);
        const runCost = Number(((qty / 1000) * sharesRate).toFixed(4));

        totalPlannedShares += qty;
        totalSharesCost += runCost;
        sharesRuns.push({ runNumber: i + 1, scheduledAt, quantity: qty, cost: runCost });
      }
    }

    // E. Comments Runs (if any)
    const commentsRuns: Array<{ runNumber: number; scheduledAt: Date; quantity: number; cost: number }> = [];
    let totalPlannedComments = 0;
    let totalCommentsCost = 0;

    // Check if deterministic batches are supplied from the pattern engine
    const baseStartTime = parsed.scheduledStartTime ? new Date(parsed.scheduledStartTime) : new Date(now);

    if (parsed.batches && parsed.batches.length > 0) {
      viewsRuns.length = 0;
      likesRuns.length = 0;
      savesRuns.length = 0;
      sharesRuns.length = 0;
      commentsRuns.length = 0;
      totalPlannedViews = 0;
      totalViewsCost = 0;
      totalPlannedLikes = 0;
      totalLikesCost = 0;
      totalPlannedSaves = 0;
      totalSavesCost = 0;
      totalPlannedShares = 0;
      totalSharesCost = 0;
      totalPlannedComments = 0;
      totalCommentsCost = 0;

      let vIdx = 1;
      let lIdx = 1;
      let sIdx = 1;
      let shIdx = 1;
      let cIdx = 1;

      for (const b of parsed.batches) {
        const batchScheduledAt = new Date(baseStartTime.getTime() + b.minuteOffset * 60 * 1000);
        if (b.service === "views") {
          const runCost = Number(((b.quantity / 1000) * viewsRate).toFixed(4));
          viewsRuns.push({ runNumber: vIdx++, scheduledAt: batchScheduledAt, quantity: b.quantity, cost: runCost });
          totalPlannedViews += b.quantity;
          totalViewsCost += runCost;
        } else if (b.service === "likes") {
          const runCost = Number(((b.quantity / 1000) * likesRate).toFixed(4));
          likesRuns.push({ runNumber: lIdx++, scheduledAt: batchScheduledAt, quantity: b.quantity, cost: runCost });
          totalPlannedLikes += b.quantity;
          totalLikesCost += runCost;
        } else if (b.service === "saves") {
          const runCost = Number(((b.quantity / 1000) * savesRate).toFixed(4));
          savesRuns.push({ runNumber: sIdx++, scheduledAt: batchScheduledAt, quantity: b.quantity, cost: runCost });
          totalPlannedSaves += b.quantity;
          totalSavesCost += runCost;
        } else if (b.service === "shares" || b.service === "reposts") {
          const runCost = Number(((b.quantity / 1000) * sharesRate).toFixed(4));
          sharesRuns.push({ runNumber: shIdx++, scheduledAt: batchScheduledAt, quantity: b.quantity, cost: runCost });
          totalPlannedShares += b.quantity;
          totalSharesCost += runCost;
        } else if (b.service === "comments") {
          const runCost = Number(((b.quantity / 1000) * commentsRate).toFixed(4));
          commentsRuns.push({ runNumber: cIdx++, scheduledAt: batchScheduledAt, quantity: b.quantity, cost: runCost });
          totalPlannedComments += b.quantity;
          totalCommentsCost += runCost;
        }
      }
    }

    let totalCost: number;
    if (typeof parsed.totalCostInr === "number" && parsed.totalCostInr > 0) {
      totalCost = Number(parsed.totalCostInr.toFixed(2));
    } else {
      totalCost = Number((totalViewsCost + totalLikesCost + totalSavesCost + totalSharesCost + totalCommentsCost).toFixed(2));
    }
    const currentBalance = user.walletBalance ?? 0;

    // 4. Wallet Balance Check (User balance check only)
    if (currentBalance < totalCost) {
      const needed = Number((totalCost - currentBalance).toFixed(2));
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient wallet balance. Total cost is ₹${totalCost.toFixed(2)}, but your current balance is ₹${currentBalance.toFixed(2)}. Please add ₹${needed.toFixed(2)} to continue.`,
          required: totalCost,
          currentBalance,
          needed,
          isAdminOutOfBalance: false,
        },
        { status: 402 }
      );
    }

    // 4.5. Admin Upstream Provider Balance Check
    // (Only triggers when user HAS sufficient wallet balance, but ADMIN provider has run out of balance)
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
      // Record High Priority Admin Alert (Immediately triggers red 1 badge in Admin Panel)
      await recordAdminAlert({
        severity: "high",
        type: "insufficient_balance",
        providerName: adminOutOfBalanceProvider,
        providerId: xmediaConn.id,
        userId: user.id,
        platform: "TikTok",
        reason: `Admin provider "${adminOutOfBalanceProvider}" has run out of balance. User @${session.user.username} tried to place order (${preset.name}) with sufficient user wallet balance (₹${currentBalance}), but the admin upstream provider balance is depleted.`,
      }).catch((err) => console.warn("Could not log admin alert:", err));

      return NextResponse.json(
        {
          success: false,
          error: "Admin has run out of balance in the upstream provider.",
          isAdminOutOfBalance: true,
          providerName: adminOutOfBalanceProvider,
          canNotifyAdmin: true,
          supportUrl: "https://t.me/Ghostfinds",
          message: "Admin has run out of balance in the fulfillment provider. Your wallet balance has NOT been charged. Please tap 'Notify Admin' or contact Telegram support so the admin can refill the provider balance.",
        },
        { status: 503 }
      );
    }

    const orderRef = `ENG-${Math.floor(100000 + Math.random() * 900000)}`;
    const newBalance = Number((currentBalance - totalCost).toFixed(2));

    // 5. Transactionally Deduct Balance, Create EngagementOrder, Runs, and Main Order
    const result = await prisma.$transaction(async (tx) => {
      // A. Deduct user wallet
      await tx.user.update({
        where: { id: user.id },
        data: { walletBalance: newBalance },
      });

      // B. Create wallet audit transaction
      const descriptionParts = [`${totalPlannedViews} Views`, `${totalPlannedLikes} Likes`];
      if (totalPlannedSaves > 0) descriptionParts.push(`${totalPlannedSaves} Saves`);
      if (totalPlannedShares > 0) descriptionParts.push(`${totalPlannedShares} Reposts`);
      if (totalPlannedComments > 0) descriptionParts.push(`${totalPlannedComments} Comments`);

      await tx.walletTransaction.create({
        data: {
          userId: user.id,
          type: "DEBIT",
          amount: -totalCost,
          balanceAfter: newBalance,
          referenceId: orderRef,
          description: `TikTok Engagement (${preset.name}): ${descriptionParts.join(", ")}`,
        },
      });

      const enabledTypes: string[] = [];
      if (totalPlannedViews > 0) enabledTypes.push("views");
      if (totalPlannedLikes > 0) enabledTypes.push("likes");
      if (totalPlannedSaves > 0) enabledTypes.push("saves");
      if (totalPlannedShares > 0) enabledTypes.push("shares");
      if (totalPlannedComments > 0) enabledTypes.push("comments");

      // C. Create EngagementOrder
      const engagementOrder = await tx.engagementOrder.create({
        data: {
          orderRef,
          userId: user.id,
          targetUrl,
          platform: "TikTok",
          profileId: preset.id,
          presetKey: preset.name,
          baseViews: totalPlannedViews,
          durationHours: Math.ceil(preset.durationHours),
          seed: parsed.seed || `aurasmm_${Date.now()}`,
          status: "PROCESSING",
          totalCost,
          refundedAmount: 0,
          plannedViews: totalPlannedViews,
          plannedLikes: totalPlannedLikes,
          plannedSaves: totalPlannedSaves,
          plannedShares: totalPlannedShares,
          plannedComments: totalPlannedComments,
          enabledTypes: JSON.stringify(enabledTypes),
          planParams: JSON.stringify({
            version: "aurasmm_deterministic_v1",
            pacingEngine: "deterministic_anti_radar",
            seed: parsed.seed || null,
            followers: parsed.followers || 500,
            scheduledStartTime: parsed.scheduledStartTime || null,
            pacingStrategy: parsed.pacingStrategy || "s_curve",
            peakHoursEnabled: parsed.peakHoursEnabled ?? true,
            presetId: preset.id,
            presetName: preset.name,
            durationHours: preset.durationHours,
            viewsRuns: viewsRuns.length,
            likesRuns: likesRuns.length,
            savesRuns: savesRuns.length,
            sharesRuns: sharesRuns.length,
            commentsRuns: commentsRuns.length,
            rows: parsed.rows || null,
          }),
        },
      });

      // Safe resolution of Provider.id to prevent Foreign Key Constraint Violations on EngagementRun_providerId_fkey
      const validProviders = new Set(
        (await tx.provider.findMany({ select: { id: true } })).map((p) => p.id)
      );

      const viewsProviderId =
        xmediaViewsService.providerId && validProviders.has(xmediaViewsService.providerId)
          ? xmediaViewsService.providerId
          : null;

      const likesProviderId =
        zeofameLikesService.providerId && validProviders.has(zeofameLikesService.providerId)
          ? zeofameLikesService.providerId
          : null;

      const savesProviderId =
        zeofameSavesService?.providerId && validProviders.has(zeofameSavesService.providerId)
          ? zeofameSavesService.providerId
          : null;

      const sharesProviderId =
        zeofameSharesService?.providerId && validProviders.has(zeofameSharesService.providerId)
          ? zeofameSharesService.providerId
          : null;

      const commentsProviderId =
        zeofameCommentsService?.providerId && validProviders.has(zeofameCommentsService.providerId)
          ? zeofameCommentsService.providerId
          : null;

      // D. Create Views Runs
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

      // E. Create Likes Runs
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

      // F. Create Saves Runs (if any)
      for (const sr of savesRuns) {
        await tx.engagementRun.create({
          data: {
            engagementOrderId: engagementOrder.id,
            engagementType: "saves",
            serviceId: zeofameSavesService?.id ?? null,
            providerId: savesProviderId,
            providerServiceId: String(zeofameSavesService?.providerServiceId || zeofameSavesService?.externalId || "807"),
            runNumber: sr.runNumber,
            scheduledAt: sr.scheduledAt,
            quantity: sr.quantity,
            plannedCumulative: 0,
            status: "scheduled",
            cost: sr.cost,
          },
        });
      }

      // G. Create Shares Runs (if any)
      for (const shr of sharesRuns) {
        await tx.engagementRun.create({
          data: {
            engagementOrderId: engagementOrder.id,
            engagementType: "shares",
            serviceId: zeofameSharesService?.id ?? null,
            providerId: sharesProviderId,
            providerServiceId: String(zeofameSharesService?.providerServiceId || zeofameSharesService?.externalId || "718"),
            runNumber: shr.runNumber,
            scheduledAt: shr.scheduledAt,
            quantity: shr.quantity,
            plannedCumulative: 0,
            status: "scheduled",
            cost: shr.cost,
          },
        });
      }

      // H. Create Comments Runs (if any)
      for (const cr of commentsRuns) {
        await tx.engagementRun.create({
          data: {
            engagementOrderId: engagementOrder.id,
            engagementType: "comments",
            serviceId: zeofameCommentsService?.id ?? null,
            providerId: commentsProviderId,
            providerServiceId: String(zeofameCommentsService?.providerServiceId || zeofameCommentsService?.externalId || "950"),
            runNumber: cr.runNumber,
            scheduledAt: cr.scheduledAt,
            quantity: cr.quantity,
            plannedCumulative: 0,
            status: "scheduled",
            cost: cr.cost,
          },
        });
      }

      // I. Create corresponding parent Order entry for the main Orders tab
      const mainOrder = await tx.order.create({
        data: {
          orderRef,
          userId: user.id,
          serviceId: xmediaViewsService.id,
          targetUrl,
          requestedQuantity: totalPlannedViews,
          unitCost: viewsRate,
          totalCost,
          status: "PROCESSING",
          scheduleMode: "TIKTOK_ENGAGEMENT",
          notes: JSON.stringify({
            isEngagement: true,
            presetId: preset.id,
            presetName: preset.name,
            totalPlannedViews,
            totalPlannedLikes,
            totalPlannedSaves,
            totalPlannedShares,
            totalPlannedComments,
            durationHours: preset.durationHours,
          }),
        },
      });

      return {
        engagementOrder,
        mainOrder,
      };
    });

    const totalRunsCount = viewsRuns.length + likesRuns.length + savesRuns.length + sharesRuns.length + commentsRuns.length;

    // Log Creation Event
    await logOrderEvent({
      orderId: result.engagementOrder.id,
      eventType: "STATE_CHANGE",
      message: `Engagement campaign created with preset "${preset.name}". Scheduled ${totalRunsCount} deterministic batches over ${preset.durationHours} hours.`,
      metadata: {
        totalCost,
        plannedViews: totalPlannedViews,
        plannedLikes: totalPlannedLikes,
        plannedSaves: totalPlannedSaves,
        plannedShares: totalPlannedShares,
        plannedComments: totalPlannedComments,
        durationHours: preset.durationHours,
      },
    });

    // Execute first immediate tick asynchronously in background if scheduled starting now
    const isStartingNow = Math.abs(baseStartTime.getTime() - Date.now()) < 5 * 60 * 1000;
    if (isStartingNow) {
      runEngagementTick().catch((tickErr) => {
        console.warn("[ENGAGEMENT] Immediate tick execution caught non-fatal error:", tickErr.message);
      });
    }

    return NextResponse.json({
      success: true,
      orderId: result.engagementOrder.id,
      orderRef,
      presetName: preset.name,
      totalCost,
      totalPlannedViews,
      totalPlannedLikes,
      totalPlannedSaves,
      totalPlannedShares,
      totalPlannedComments,
      runsCount: totalRunsCount,
      durationHours: preset.durationHours,
      remainingBalance: newBalance,
      message: `TikTok Engagement campaign launched (${preset.name})! Scheduled ${totalRunsCount} batches over ${preset.durationHours} hours.`,
    });
  } catch (err: any) {
    console.error("[ENGAGEMENT-ORDER-CREATE] Error creating order:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create engagement order" },
      { status: 500 }
    );
  }
}

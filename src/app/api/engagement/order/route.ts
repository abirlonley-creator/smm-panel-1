import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/security/crypto";
import { StandardSMMv2Provider, MockSMMProvider } from "@/lib/provider/adapter";
import {
  getTikTokEngagementConfig,
  getTikTokPresetById,
} from "@/lib/engagement/tiktok-preset-config";
import { getAdminViewsProvider, getAdminEngagementProvider } from "@/lib/provider/admin-provider";
import { logOrderEvent } from "@/lib/engagement/event-logger";
import { runEngagementTick } from "@/lib/engagement/worker";
import { resolveTargetUrl } from "@/lib/urls/tiktok-resolver";
import { z } from "zod";

const createEngagementOrderSchema = z.object({
  targetUrl: z.string().url("Valid post or video URL required"),
  presetId: z.string().optional().default("tiktok_2k"),
  presetName: z.string().optional(),
  platform: z.string().default("TikTok"),
  plannedViews: z.array(z.number().int()).optional(),
  plannedLikes: z.array(z.number().int()).optional(),
  plannedSaves: z.array(z.number().int()).optional(),
  plannedShares: z.array(z.number().int()).optional(),
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

    const config = getTikTokEngagementConfig();
    if (!config.enabled) {
      return NextResponse.json(
        { success: false, error: "TikTok Engagement system is currently disabled by administrator." },
        { status: 503 }
      );
    }

    const preset = getTikTokPresetById(parsed.presetId || parsed.presetName);

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
    if (preset.shares?.enabled) {
      zeofameSharesService = await resolveService(zeofameConn.id, sharesServiceId, zeofameAdapter, {
        name: "TikTok Shares / Reposts",
        category: "TikTok Shares",
        ratePer1000: 0.22,
        minQuantity: 10,
        maxQuantity: 500000,
      });
    }

    // 3. Build Batch Runs
    const now = Date.now();
    const viewsRate = xmediaViewsService.ratePer1000;
    const likesRate = zeofameLikesService.ratePer1000;
    const savesRate = zeofameSavesService?.ratePer1000 ?? 0.22;
    const sharesRate = zeofameSharesService?.ratePer1000 ?? 0.22;

    // A. Views Runs
    const viewsRuns: Array<{ runNumber: number; scheduledAt: Date; quantity: number; cost: number }> = [];
    let totalPlannedViews = 0;
    let totalViewsCost = 0;
    const minV = Math.min(preset.views.minQuantity, preset.views.maxQuantity);
    const maxV = Math.max(preset.views.minQuantity, preset.views.maxQuantity);

    for (let i = 0; i < preset.views.runsCount; i++) {
      let qty: number;
      if (
        parsed.plannedViews &&
        typeof parsed.plannedViews[i] === "number" &&
        parsed.plannedViews[i] >= minV &&
        parsed.plannedViews[i] <= maxV
      ) {
        qty = parsed.plannedViews[i];
      } else {
        qty = Math.floor(Math.random() * (maxV - minV + 1)) + minV;
      }
      const scheduledAt = new Date(now + i * preset.views.intervalMinutes * 60 * 1000);
      const runCost = Number(((qty / 1000) * viewsRate).toFixed(4));

      totalPlannedViews += qty;
      totalViewsCost += runCost;
      viewsRuns.push({ runNumber: i + 1, scheduledAt, quantity: qty, cost: runCost });
    }

    // B. Likes Runs
    const likesRuns: Array<{ runNumber: number; scheduledAt: Date; quantity: number; cost: number }> = [];
    let totalPlannedLikes = 0;
    let totalLikesCost = 0;
    const minL = Math.min(preset.likes.minQuantity, preset.likes.maxQuantity);
    const maxL = Math.max(preset.likes.minQuantity, preset.likes.maxQuantity);
    const likesOffsets = preset.likes.waveOffsets || [120, 200, 280];

    for (let i = 0; i < preset.likes.runsCount; i++) {
      let qty: number;
      if (
        parsed.plannedLikes &&
        typeof parsed.plannedLikes[i] === "number" &&
        parsed.plannedLikes[i] >= minL &&
        parsed.plannedLikes[i] <= maxL
      ) {
        qty = parsed.plannedLikes[i];
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

    // C. Saves Runs (if enabled)
    const savesRuns: Array<{ runNumber: number; scheduledAt: Date; quantity: number; cost: number }> = [];
    let totalPlannedSaves = 0;
    let totalSavesCost = 0;
    if (preset.saves?.enabled) {
      const minS = Math.min(preset.saves.minQuantity, preset.saves.maxQuantity);
      const maxS = Math.max(preset.saves.minQuantity, preset.saves.maxQuantity);
      const savesOffsets = preset.saves.waveOffsets || [180, 360, 600];

      for (let i = 0; i < preset.saves.runsCount; i++) {
        let qty: number;
        if (
          parsed.plannedSaves &&
          typeof parsed.plannedSaves[i] === "number" &&
          parsed.plannedSaves[i] >= minS &&
          parsed.plannedSaves[i] <= maxS
        ) {
          qty = parsed.plannedSaves[i];
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

    // D. Shares/Reposts Runs (if enabled)
    const sharesRuns: Array<{ runNumber: number; scheduledAt: Date; quantity: number; cost: number }> = [];
    let totalPlannedShares = 0;
    let totalSharesCost = 0;
    if (preset.shares?.enabled) {
      const minR = Math.min(preset.shares.minQuantity, preset.shares.maxQuantity);
      const maxR = Math.max(preset.shares.minQuantity, preset.shares.maxQuantity);
      const sharesOffsets = preset.shares.waveOffsets || [300, 540];

      for (let i = 0; i < preset.shares.runsCount; i++) {
        let qty: number;
        if (
          parsed.plannedShares &&
          typeof parsed.plannedShares[i] === "number" &&
          parsed.plannedShares[i] >= minR &&
          parsed.plannedShares[i] <= maxR
        ) {
          qty = parsed.plannedShares[i];
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

    // 4. Wallet Balance Check
    if (currentBalance < totalCost) {
      const needed = Number((totalCost - currentBalance).toFixed(2));
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient wallet balance. Total cost is ₹${totalCost.toFixed(2)}, but your current balance is ₹${currentBalance.toFixed(2)}. Please add ₹${needed.toFixed(2)} to continue.`,
          required: totalCost,
          currentBalance,
          needed,
        },
        { status: 402 }
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
      await tx.walletTransaction.create({
        data: {
          userId: user.id,
          type: "DEBIT",
          amount: -totalCost,
          balanceAfter: newBalance,
          referenceId: orderRef,
          description: `TikTok Engagement (${preset.name}): ${totalPlannedViews} Views, ${totalPlannedLikes} Likes${totalPlannedSaves ? `, ${totalPlannedSaves} Saves` : ""}${totalPlannedShares ? `, ${totalPlannedShares} Reposts` : ""}`,
        },
      });

      const enabledTypes = ["views", "likes"];
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
          presetKey: preset.name,
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
            presetId: preset.id,
            presetName: preset.name,
            durationHours: preset.durationHours,
            viewsRuns: viewsRuns.length,
            likesRuns: likesRuns.length,
            savesRuns: savesRuns.length,
            sharesRuns: sharesRuns.length,
          }),
        },
      });

      // D. Create Views Runs
      for (const vr of viewsRuns) {
        await tx.engagementRun.create({
          data: {
            engagementOrderId: engagementOrder.id,
            engagementType: "views",
            serviceId: xmediaViewsService.id,
            providerId: xmediaViewsService.providerId || xmediaViewsService.userProviderId || null,
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
            providerId: zeofameLikesService.providerId || zeofameLikesService.userProviderId || null,
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
            serviceId: zeofameSavesService.id,
            providerId: zeofameSavesService?.providerId || zeofameSavesService?.userProviderId || null,
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

      // G. Create Shares Runs (if any)
      for (const shr of sharesRuns) {
        await tx.engagementRun.create({
          data: {
            engagementOrderId: engagementOrder.id,
            engagementType: "shares",
            serviceId: zeofameSharesService.id,
            providerId: zeofameSharesService?.providerId || zeofameSharesService?.userProviderId || null,
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

      // H. Create corresponding parent Order entry for the main Orders tab
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
            durationHours: preset.durationHours,
          }),
        },
      });

      return {
        engagementOrder,
        mainOrder,
      };
    });

    const totalRunsCount = viewsRuns.length + likesRuns.length + savesRuns.length + sharesRuns.length;

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
        durationHours: preset.durationHours,
      },
    });

    // Execute first immediate tick asynchronously in background
    runEngagementTick().catch((tickErr) => {
      console.warn("[ENGAGEMENT] Immediate tick execution caught non-fatal error:", tickErr.message);
    });

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

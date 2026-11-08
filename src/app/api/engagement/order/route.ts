import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/security/crypto";
import { StandardSMMv2Provider, MockSMMProvider } from "@/lib/provider/adapter";
import { getTikTokEngagementConfig } from "@/lib/engagement/tiktok-preset-config";
import { logOrderEvent } from "@/lib/engagement/event-logger";
import { runEngagementTick } from "@/lib/engagement/worker";
import { z } from "zod";

const createEngagementOrderSchema = z.object({
  targetUrl: z.string().url("Valid post or video URL required"),
  presetName: z.string().optional().default("TikTok Organic Working Preset"),
  platform: z.string().default("TikTok"),
});

export async function POST(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createEngagementOrderSchema.parse(body);

    const targetUrl = parsed.targetUrl.trim();
    const lowerUrl = targetUrl.toLowerCase();
    if (!lowerUrl.includes("tiktok.com")) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid TikTok video URL (e.g. https://www.tiktok.com/@username/video/...)" },
        { status: 400 }
      );
    }

    const config = getTikTokEngagementConfig();
    if (!config.enabled) {
      return NextResponse.json(
        { success: false, error: "TikTok Engagement system is currently disabled by administrator." },
        { status: 503 }
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

    // 1. Verify User's API Connections (Independently Managed per user)
    const userConnections = await prisma.userProviderConnection.findMany({
      where: { userId },
    });

    // A. Zeofame for Likes (Service 1123)
    const zeofameTargetServiceId = config.likes.serviceId;
    const zeofameConn = userConnections.find((c) => {
      const name = (c.name || "").toLowerCase();
      const url = (c.apiUrl || "").toLowerCase();
      return name.includes("zeofame") || name.includes("zefame") || url.includes("zeofame") || url.includes("zefame");
    });

    if (!zeofameConn || !zeofameConn.active) {
      return NextResponse.json(
        {
          success: false,
          error: "API Connection Required: Connect your Zeofame API to activate the TikTok Likes service.",
          missingProvider: "Zeofame",
        },
        { status: 400 }
      );
    }

    // Test Zeofame connection
    const rawZeofameKey = zeofameConn.apiKeyEncrypted ? decryptApiKey(zeofameConn.apiKeyEncrypted) : null;
    const zeofameAdapter = (zeofameConn.isMock || !rawZeofameKey)
      ? new MockSMMProvider()
      : new StandardSMMv2Provider(zeofameConn.apiUrl, rawZeofameKey);

    try {
      await zeofameAdapter.getBalance();
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: `Zeofame API connection invalid: ${e.message}. Please check your credentials in API Key settings.` },
        { status: 400 }
      );
    }

    // Find or import Zeofame service 1123
    let zeofameService = await prisma.service.findFirst({
      where: {
        userProviderId: zeofameConn.id,
        OR: [{ providerServiceId: zeofameTargetServiceId }, { externalId: zeofameTargetServiceId }],
      },
    });

    if (!zeofameService && !zeofameConn.isMock) {
      try {
        const services = await zeofameAdapter.getServices();
        const match = services.find((s) => String(s.id) === zeofameTargetServiceId);
        if (match) {
          zeofameService = await prisma.service.create({
            data: {
              externalId: String(match.id),
              providerServiceId: String(match.id),
              name: match.name,
              type: match.type || "Default",
              platform: "TikTok",
              category: "TikTok Likes",
              description: match.description || "TikTok Likes",
              minQuantity: match.minQuantity || config.likes.minQuantity,
              maxQuantity: match.maxQuantity || 500000,
              ratePer1000: match.ratePer1000 || 0.95,
              userProviderId: zeofameConn.id,
              active: true,
            },
          });
        }
      } catch {}
    }

    if (!zeofameService) {
      return NextResponse.json(
        { success: false, error: `Service ID ${zeofameTargetServiceId} does not exist on your connected Zeofame provider.` },
        { status: 400 }
      );
    }

    // B. Xmedia for Views (Service 10322)
    const xmediaTargetServiceId = config.views.serviceId;
    const xmediaConn = userConnections.find((c) => {
      const name = (c.name || "").toLowerCase();
      const url = (c.apiUrl || "").toLowerCase();
      return name.includes("xmedia") || url.includes("xmedia");
    });

    if (!xmediaConn || !xmediaConn.active) {
      return NextResponse.json(
        {
          success: false,
          error: "API Connection Required: Connect your Xmedia API to activate the TikTok Views service.",
          missingProvider: "Xmedia",
        },
        { status: 400 }
      );
    }

    // Test Xmedia connection
    const rawXmediaKey = xmediaConn.apiKeyEncrypted ? decryptApiKey(xmediaConn.apiKeyEncrypted) : null;
    const xmediaAdapter = (xmediaConn.isMock || !rawXmediaKey)
      ? new MockSMMProvider()
      : new StandardSMMv2Provider(xmediaConn.apiUrl, rawXmediaKey);

    try {
      await xmediaAdapter.getBalance();
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: `Xmedia API connection invalid: ${e.message}. Please check your credentials in API Key settings.` },
        { status: 400 }
      );
    }

    // Find or import Xmedia service 10322
    let xmediaService = await prisma.service.findFirst({
      where: {
        userProviderId: xmediaConn.id,
        OR: [{ providerServiceId: xmediaTargetServiceId }, { externalId: xmediaTargetServiceId }],
      },
    });

    if (!xmediaService && !xmediaConn.isMock) {
      try {
        const services = await xmediaAdapter.getServices();
        const match = services.find((s) => String(s.id) === xmediaTargetServiceId);
        if (match) {
          xmediaService = await prisma.service.create({
            data: {
              externalId: String(match.id),
              providerServiceId: String(match.id),
              name: match.name,
              type: match.type || "Default",
              platform: "TikTok",
              category: "TikTok Views",
              description: match.description || "TikTok Views",
              minQuantity: match.minQuantity || config.views.minQuantity,
              maxQuantity: match.maxQuantity || 10000000,
              ratePer1000: match.ratePer1000 || 0.15,
              userProviderId: xmediaConn.id,
              active: true,
            },
          });
        }
      } catch {}
    }

    if (!xmediaService) {
      return NextResponse.json(
        { success: false, error: `Service ID ${xmediaTargetServiceId} does not exist on your connected Xmedia provider.` },
        { status: 400 }
      );
    }

    // 2. Generate Randomized Runs matching Section 3 specification
    const now = Date.now();
    const viewsRate = xmediaService.ratePer1000;
    const likesRate = zeofameService.ratePer1000;

    // 16 Views runs, randomly 150 - 220, every 20 minutes
    const viewsRuns: Array<{ runNumber: number; scheduledAt: Date; quantity: number; cost: number }> = [];
    let totalPlannedViews = 0;
    let totalViewsCost = 0;

    for (let i = 0; i < config.views.runsCount; i++) {
      const minV = Math.min(config.views.minQuantity, config.views.maxQuantity);
      const maxV = Math.max(config.views.minQuantity, config.views.maxQuantity);
      const qty = Math.floor(Math.random() * (maxV - minV + 1)) + minV;
      const scheduledAt = new Date(now + i * config.views.intervalMinutes * 60 * 1000);
      const runCost = Number(((qty / 1000) * viewsRate).toFixed(4));

      totalPlannedViews += qty;
      totalViewsCost += runCost;
      viewsRuns.push({ runNumber: i + 1, scheduledAt, quantity: qty, cost: runCost });
    }

    // 3 Likes runs, randomly 12 - 16, every 120 minutes
    // NOTE: Likes do NOT send immediately upon clicking Order!
    // Run #1 begins after 120 minutes (2h), Run #2 at 240 minutes (4h), and Run #3 at 360 minutes (6h).
    // (If views delivery surpasses 500-700 views earlier, Delayed Likes Protection will accelerate Run #1 immediately).
    const likesRuns: Array<{ runNumber: number; scheduledAt: Date; quantity: number; cost: number }> = [];
    let totalPlannedLikes = 0;
    let totalLikesCost = 0;

    for (let i = 0; i < config.likes.runsCount; i++) {
      const minL = Math.min(config.likes.minQuantity, config.likes.maxQuantity);
      const maxL = Math.max(config.likes.minQuantity, config.likes.maxQuantity);
      const qty = Math.floor(Math.random() * (maxL - minL + 1)) + minL;
      // Start likes at +120 minutes (i + 1), not immediately at 0m
      const scheduledAt = new Date(now + (i + 1) * config.likes.intervalMinutes * 60 * 1000);
      const runCost = Number(((qty / 1000) * likesRate).toFixed(4));

      totalPlannedLikes += qty;
      totalLikesCost += runCost;
      likesRuns.push({ runNumber: i + 1, scheduledAt, quantity: qty, cost: runCost });
    }

    const totalCost = Number((totalViewsCost + totalLikesCost).toFixed(2));
    const currentBalance = user.walletBalance ?? 0;

    // 3. Wallet Balance Check
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
    const maxDurationMinutes = Math.max(
      (config.views.runsCount - 1) * config.views.intervalMinutes,
      config.likes.runsCount * config.likes.intervalMinutes
    );
    const durationHours = Number((maxDurationMinutes / 60).toFixed(1));

    // 4. Transactionally Deduct Balance, Create EngagementOrder, Runs, and Main Order
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
          description: `TikTok Organic Engagement (${totalPlannedViews} Views via Xmedia, ${totalPlannedLikes} Likes via Zeofame)`,
        },
      });

      // C. Create EngagementOrder
      const engagementOrder = await tx.engagementOrder.create({
        data: {
          orderRef,
          userId: user.id,
          targetUrl,
          platform: "TikTok",
          profileId: "tiktok_organic_working",
          presetKey: config.presetName,
          baseViews: totalPlannedViews,
          durationHours: Math.ceil(durationHours),
          seed: `aurasmm_${Date.now()}`,
          status: "PROCESSING",
          totalCost,
          refundedAmount: 0,
          plannedViews: totalPlannedViews,
          plannedLikes: totalPlannedLikes,
          plannedShares: 0,
          plannedSaves: 0,
          plannedComments: 0,
          enabledTypes: JSON.stringify(["views", "likes"]),
          deviationStatus: "on_track",
          replanCount: 0,
        },
      });

      // D. Create 16 Views Runs
      let runningPlannedViews = 0;
      for (const run of viewsRuns) {
        runningPlannedViews += run.quantity;
        await tx.engagementRun.create({
          data: {
            engagementOrderId: engagementOrder.id,
            engagementType: "views",
            serviceId: xmediaService.id,
            providerId: null,
            providerServiceId: xmediaTargetServiceId,
            runNumber: run.runNumber,
            scheduledAt: run.scheduledAt,
            quantity: run.quantity,
            plannedCumulative: runningPlannedViews,
            deliveredQuantity: 0,
            deliveredCumulative: 0,
            status: "scheduled",
            idempotencyKey: `ENG-RUN-${engagementOrder.id}-views-${run.runNumber}`,
            cost: run.cost,
            attempts: 0,
            latenessSeconds: 0,
            isReplan: false,
          },
        });
      }

      // E. Create 3 Likes Runs
      let runningPlannedLikes = 0;
      for (const run of likesRuns) {
        runningPlannedLikes += run.quantity;
        await tx.engagementRun.create({
          data: {
            engagementOrderId: engagementOrder.id,
            engagementType: "likes",
            serviceId: zeofameService.id,
            providerId: null,
            providerServiceId: zeofameTargetServiceId,
            runNumber: run.runNumber,
            scheduledAt: run.scheduledAt,
            quantity: run.quantity,
            plannedCumulative: runningPlannedLikes,
            deliveredQuantity: 0,
            deliveredCumulative: 0,
            status: "scheduled",
            idempotencyKey: `ENG-RUN-${engagementOrder.id}-likes-${run.runNumber}`,
            cost: run.cost,
            attempts: 0,
            latenessSeconds: 0,
            isReplan: false,
          },
        });
      }

      // F. Create Linked Main Order so it appears in the existing Orders page (/orders)
      await tx.order.create({
        data: {
          orderRef,
          serviceId: xmediaService.id,
          providerId: null,
          targetUrl,
          requestedQuantity: totalPlannedViews,
          submittedQuantity: 0,
          deliveredQuantity: 0,
          remainingQuantity: totalPlannedViews,
          failedQuantity: 0,
          unitCost: viewsRate,
          totalCost,
          isScheduled: true,
          scheduleMode: "TIKTOK_ENGAGEMENT",
          status: "PROCESSING",
          notes: JSON.stringify({
            presetName: config.presetName,
            plannedViews: totalPlannedViews,
            plannedLikes: totalPlannedLikes,
            viewsProvider: xmediaConn.name,
            likesProvider: zeofameConn.name,
            viewsServiceId: xmediaTargetServiceId,
            likesServiceId: zeofameTargetServiceId,
          }),
          userId: user.id,
        },
      });

      return engagementOrder;
    });

    await logOrderEvent({
      orderId: result.id,
      eventType: "STATE_CHANGE",
      message: `TikTok Organic Engagement started with 16 Views runs via Xmedia (#${xmediaTargetServiceId}) and 3 Likes runs via Zeofame (#${zeofameTargetServiceId}). Views begin immediately (Run #1 at 0m), while Likes start after 120 minutes.`,
    }).catch(() => {});

    // Dispatch immediate views delivery (Run #1 at t=0) as soon as user hits Order button
    runEngagementTick().catch((tickErr) => {
      console.warn("[ENGAGEMENT] Immediate views dispatch tick warning:", tickErr);
    });

    return NextResponse.json({
      success: true,
      orderId: result.id,
      orderRef: result.orderRef,
      presetName: config.presetName,
      totalCost,
      totalPlannedViews,
      totalPlannedLikes,
      runsCount: viewsRuns.length + likesRuns.length,
      remainingBalance: newBalance,
      message: `TikTok Organic Engagement order ${result.orderRef} placed successfully! 16 Views batches and 3 Likes batches are queued.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to submit engagement order" },
      { status: 400 }
    );
  }
}

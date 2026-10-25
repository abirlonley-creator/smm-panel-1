import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import {
  generateOrganicPlan,
  type DurationPreset,
  type EngagementType,
} from "@/lib/engagement/planner";
import { getPlatformProfile } from "@/lib/engagement/platform-profiles";
import { checkProviderHealthGate } from "@/lib/engagement/health-gate";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createEngagementOrderSchema = z.object({
  targetUrl: z.string().url("Valid post or video URL required"),
  profileId: z.string().optional(),
  platform: z.string().default("Instagram"),
  baseViews: z.number().int().min(1).max(10000000),
  presetKey: z.enum(["fast", "normal", "slow"]).optional(),
  pacingMode: z.enum(["auto", "custom"]).default("auto"),
  customSpeedPreset: z.enum(["faster", "slower", "exact"]).optional(),
  customDurationHours: z.number().min(0.2).max(400).optional(),
  durationPreset: z.enum(["24h", "48h", "72h", "96h", "168h"]).optional(),
  durationHours: z.number().min(0.2).max(400).optional(),
  seed: z.union([z.string(), z.number()]).default(() => String(Math.floor(Math.random() * 100000000))),
  targetTz: z.string().default("Asia/Kolkata"),
  peakHourWeighting: z.boolean().default(true),
  enabledTypes: z.array(z.enum(["views", "likes", "shares", "saves", "comments"])).optional(),
  typeToggles: z.record(z.string(), z.boolean()).optional(),
  customQuantities: z.record(z.string(), z.number()).optional(),
  customSources: z.record(z.string(), z.enum(["suggested", "custom"])).optional(),
  customRatios: z.record(z.string(), z.number()).optional(),
});

export async function POST(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createEngagementOrderSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, walletBalance: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User account not found" }, { status: 404 });
    }

    // 1. Resolve Config-Driven Platform Profile & Backend Service Mappings
    const profileId = parsed.profileId || (parsed.platform?.toLowerCase() === "tiktok" ? "tiktok" : "instagram_reel");
    const profile = getPlatformProfile(profileId);

    const activeTypes = (parsed.enabledTypes || ["views", "likes", "saves", "shares", "comments"]).filter(
      (t) => parsed.typeToggles?.[t] !== false
    ) as EngagementType[];

    // 2. Health Gate Pre-Check with user's mapped providers
    const health = await checkProviderHealthGate(profile.id, activeTypes, 0, user.id);
    if (!health.ok) {
      return NextResponse.json(
        {
          success: false,
          error: health.userMessage || "Delivery for this service is temporarily unavailable. Nothing was charged. Please try again in a few minutes.",
          providerUnavailable: true,
        },
        { status: 503 }
      );
    }

    // Resolve user's configured provider service mappings
    const userMappings = await prisma.userEngagementMapping.findMany({
      where: { userId: user.id, platform: profile.platform },
      include: { provider: true },
    });
    const mappingMap = new Map(userMappings.map((m) => [m.engagementType, m]));
    const resolvedServices: Record<EngagementType, any> = { ...profile.serviceMappings };

    for (const t of activeTypes) {
      const m = mappingMap.get(t);
      if (m && m.provider) {
        resolvedServices[t] = {
          id: m.id,
          providerId: m.providerId,
          providerServiceId: m.providerServiceId,
          name: m.serviceName || `${profile.name} ${t}`,
          minQuantity: m.minQuantity,
          maxQuantity: m.maxQuantity,
          ratePer1000: m.ratePer1000,
        };
      }
    }

    // 3. Generate the deterministic delivery plan using the shared engine
    const plan = generateOrganicPlan({
      profileId: profile.id,
      platform: profile.platform,
      presetKey: parsed.presetKey,
      pacingMode: parsed.pacingMode,
      customSpeedPreset: parsed.customSpeedPreset,
      customDurationHours: parsed.customDurationHours,
      baseViews: parsed.baseViews,
      durationPreset: parsed.durationPreset as DurationPreset | undefined,
      durationHours: parsed.durationHours,
      seed: parsed.seed,
      targetTz: parsed.targetTz,
      peakHourWeighting: parsed.peakHourWeighting,
      enabledTypes: activeTypes,
      typeToggles: parsed.typeToggles,
      customQuantities: parsed.customQuantities as Partial<Record<EngagementType, number>> | undefined,
      customSources: parsed.customSources as Partial<Record<EngagementType, "suggested" | "custom">> | undefined,
      customRatios: parsed.customRatios as Partial<Record<EngagementType, number>> | undefined,
      services: resolvedServices, // User-resolved service mappings
      autoDisableBelowMin: true,
    });

    const totalCost = plan.totalCost;
    const currentBalance = user.walletBalance ?? 0;

    // Check wallet funds
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

    // 4. Transactionally deduct wallet funds, record transaction, and create order + scheduled runs with stored plan
    const result = await prisma.$transaction(async (tx) => {
      // Deduct balance
      await tx.user.update({
        where: { id: user.id },
        data: { walletBalance: newBalance },
      });

      // Record transaction
      await tx.walletTransaction.create({
        data: {
          userId: user.id,
          type: "DEBIT",
          amount: -totalCost,
          balanceAfter: newBalance,
          referenceId: orderRef,
          description: `Full Organic Engagement: ${profile.name} (${parsed.baseViews.toLocaleString()} Views, ${plan.durationHours}h)`,
        },
      });

      // Initial type statuses
      const initialTypeStatuses: Record<string, string> = {};
      for (const t of activeTypes) {
        initialTypeStatuses[t] = "on_track";
      }

      // Create Engagement Order with stored plan per Change D
      const engagementOrder = await tx.engagementOrder.create({
        data: {
          orderRef,
          userId: user.id,
          targetUrl: parsed.targetUrl.trim(),
          platform: profile.platform,
          profileId: profile.id,
          presetKey: parsed.presetKey || profile.defaultPreset,
          baseViews: parsed.baseViews,
          durationHours: plan.durationHours,
          seed: String(plan.seed),
          status: "PROCESSING",
          totalCost,
          refundedAmount: 0,
          plannedViews: plan.plans.views?.totalQuantity ?? 0,
          plannedLikes: plan.plans.likes?.totalQuantity ?? 0,
          plannedShares: plan.plans.shares?.totalQuantity ?? 0,
          plannedSaves: plan.plans.saves?.totalQuantity ?? 0,
          plannedComments: plan.plans.comments?.totalQuantity ?? 0,
          viewsSource: parsed.customSources?.views || "suggested",
          likesSource: parsed.customSources?.likes || "suggested",
          savesSource: parsed.customSources?.saves || "suggested",
          sharesSource: parsed.customSources?.shares || "suggested",
          commentsSource: parsed.customSources?.comments || "suggested",
          enabledTypes: JSON.stringify(activeTypes),
          planParams: JSON.stringify(plan.params),
          expectedCurve: JSON.stringify(plan.curvePoints),
          statusSamples: JSON.stringify([]),
          deviationStatus: "on_track",
          typeStatuses: JSON.stringify(initialTypeStatuses),
          replanCount: 0,
        },
      });

      // Create all Scheduled Runs with unique idempotency keys and plannedCumulative
      for (const run of plan.allRuns) {
        await tx.engagementRun.create({
          data: {
            engagementOrderId: engagementOrder.id,
            engagementType: run.engagementType,
            serviceId: run.serviceId || null,
            providerId: run.providerId || null,
            providerServiceId: run.providerServiceId || null,
            runNumber: run.runIndex,
            scheduledAt: new Date(run.scheduledAt),
            quantity: run.quantity,
            plannedCumulative: run.cumulativeQuantity,
            deliveredQuantity: 0,
            deliveredCumulative: 0,
            status: "scheduled",
            idempotencyKey: `ENG-RUN-${engagementOrder.id}-${run.engagementType}-${run.runIndex}`,
            cost: run.cost,
            attempts: 0,
            latenessSeconds: 0,
            isReplan: false,
          },
        });
      }

      return engagementOrder;
    });

    return NextResponse.json({
      success: true,
      orderId: result.id,
      orderRef: result.orderRef,
      seed: plan.seed,
      profileId: profile.id,
      profileName: profile.name,
      archetype: plan.params.archetype,
      totalCost,
      remainingBalance: newBalance,
      runsCount: plan.allRuns.length,
      message: `Full Engagement order ${result.orderRef} scheduled successfully! All ${plan.allRuns.length} batches are queued.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to submit engagement order" },
      { status: 400 }
    );
  }
}

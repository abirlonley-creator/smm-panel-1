import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { generateOrganicPlan } from "@/lib/engagement/planner";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createEngagementOrderSchema = z.object({
  targetUrl: z.string().url("Valid post or video URL required"),
  platform: z.enum(["Instagram", "TikTok"]),
  baseViews: z.number().int().min(100).max(10000000),
  durationHours: z.number().int().min(1).max(168).default(24),
  seed: z.string().min(1),
  peakHourWeighting: z.boolean().default(false),
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

    // 1. Fetch real DB services mapped to these platform engagement types
    const dbServices = await prisma.service.findMany({
      where: {
        platform: parsed.platform,
        active: true,
      },
    });

    const servicesMap: any = {};
    for (const type of ["views", "likes", "shares", "saves", "comments"] as const) {
      const match = dbServices.find((s) => s.category.toLowerCase().includes(type) || s.name.toLowerCase().includes(type));
      if (match) {
        servicesMap[type] = {
          id: match.id,
          providerId: match.providerId,
          name: match.name,
          minQuantity: match.minQuantity,
          maxQuantity: match.maxQuantity,
          ratePer1000: match.ratePer1000,
        };
      }
    }

    // 2. Generate the deterministic delivery plan using the shared engine
    const plan = generateOrganicPlan({
      platform: parsed.platform,
      baseViews: parsed.baseViews,
      durationHours: parsed.durationHours,
      seed: parsed.seed,
      peakHourWeighting: parsed.peakHourWeighting,
      services: Object.keys(servicesMap).length > 0 ? servicesMap : undefined,
    });

    const totalCost = plan.totalCost;
    const currentBalance = user.walletBalance ?? 0;

    // Check wallet funds
    if (currentBalance < totalCost) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient wallet balance. Total cost is ₹${totalCost.toFixed(2)}, but your current balance is ₹${currentBalance.toFixed(2)}. Please recharge your wallet.`,
          required: totalCost,
          currentBalance,
        },
        { status: 402 }
      );
    }

    const orderRef = `ENG-${Math.floor(100000 + Math.random() * 900000)}`;
    const newBalance = Number((currentBalance - totalCost).toFixed(2));

    // 3. Transactionally deduct wallet funds, record transaction, and create order + scheduled runs
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
          description: `Full Organic Engagement: ${parsed.platform} (${parsed.baseViews.toLocaleString()} Base Views)`,
        },
      });

      // Create Engagement Order
      const engagementOrder = await tx.engagementOrder.create({
        data: {
          orderRef,
          userId: user.id,
          targetUrl: parsed.targetUrl.trim(),
          platform: parsed.platform,
          baseViews: parsed.baseViews,
          durationHours: parsed.durationHours,
          seed: plan.seed,
          status: "PROCESSING",
          totalCost,
          refundedAmount: 0,
          plannedViews: plan.plans.views.totalQuantity,
          plannedLikes: plan.plans.likes.totalQuantity,
          plannedShares: plan.plans.shares.totalQuantity,
          plannedSaves: plan.plans.saves.totalQuantity,
          plannedComments: plan.plans.comments.totalQuantity,
        },
      });

      // Create all Scheduled Runs
      for (const run of plan.allRuns) {
        await tx.engagementRun.create({
          data: {
            engagementOrderId: engagementOrder.id,
            engagementType: run.engagementType,
            serviceId: run.serviceId || null,
            providerId: run.providerId || null,
            scheduledAt: new Date(run.scheduledAt),
            quantity: run.quantity,
            status: "PENDING",
            cost: run.cost,
          },
        });
      }

      return engagementOrder;
    });

    return NextResponse.json({
      success: true,
      orderId: result.id,
      orderRef: result.orderRef,
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

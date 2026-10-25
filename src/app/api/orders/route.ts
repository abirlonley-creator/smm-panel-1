import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveProvider } from "@/lib/provider/adapter";
import { getAuthSession } from "@/lib/auth/session";
import { calculateGrowthPlan } from "@/lib/scheduler/calculator";
import { ScheduleMode } from "@/lib/types";
import { generateDripFeedSequence } from "@/lib/orders/drip-feed-randomizer";
import { z } from "zod";

const createOrderSchema = z.object({
  serviceId: z.string().min(1, "Service ID is required"),
  targetUrl: z.string().url("A valid target URL is required"),
  requestedQuantity: z.number().int().positive("Quantity must be greater than 0").optional().default(100),
  scheduleMode: z
    .enum([
      "INSTANT",
      "DRIP_FEED",
      "EVEN_DRIP",
      "FRONT_LOADED",
      "GRADUAL_RAMP",
      "CUSTOM",
      "SLOW_BURN",
      "TEST_BATCH_BREAKOUT",
      "EVENING_SURGE",
      "VIRAL_SPIKE",
      "FRONT_LOADED_DECAY",
      "DOUBLE_WAVE",
      "HEARTBEAT",
      "LATE_ROCKET",
      "SLEEPER_HIT",
      "LONG_TAIL",
    ])
    .default("INSTANT"),
  dripMinQuantity: z.number().int().positive().optional(),
  dripMaxQuantity: z.number().int().positive().optional(),
  dripRuns: z.number().int().min(1).max(100).optional(),
  dripIntervalMinutes: z.number().int().min(1).max(10080).optional(),
  timingMode: z.enum(["MODE_A", "MODE_B", "CUSTOM"]).optional().default("MODE_B"),
  stepsCount: z.number().int().min(1).max(30).optional().default(1),
  intervalMinutes: z.number().int().min(5).max(10080).optional().default(60),
  totalDurationMinutes: z.number().int().positive().optional(),
  customStepQuantities: z.array(z.number().int().positive()).optional(),
  customIntervals: z.array(z.number().int().nonnegative()).optional(),
  seed: z.number().int().optional(),
  smoothness: z.number().min(0).max(100).optional(),
  spikeIntensity: z.enum(["off", "low", "medium", "high"]).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      );
    }

    const {
      serviceId,
      targetUrl,
      requestedQuantity,
      scheduleMode,
      timingMode,
      stepsCount,
      intervalMinutes,
      totalDurationMinutes,
      customStepQuantities,
      customIntervals,
    } = parsed.data;

    // Fetch verified service
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service || !service.active) {
      return NextResponse.json(
        { success: false, error: "The selected service is currently unavailable." },
        { status: 400 }
      );
    }

    // Validate quantities strictly against service rules for standard/scheduled orders
    if (scheduleMode !== "DRIP_FEED") {
      if (requestedQuantity < service.minQuantity) {
        return NextResponse.json(
          {
            success: false,
            error: `Minimum allowed order quantity for this service is ${service.minQuantity.toLocaleString()}.`,
          },
          { status: 400 }
        );
      }

      if (requestedQuantity > service.maxQuantity) {
        return NextResponse.json(
          {
            success: false,
            error: `Maximum allowed order quantity for this service is ${service.maxQuantity.toLocaleString()}.`,
          },
          { status: 400 }
        );
      }
    }

    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json(
        { success: false, error: "Authentication required to place orders." },
        { status: 401 }
      );
    }
    const userId = session.user.id;

    // -----------------------------------------------------------------------
    // Provider-Endpoint Ownership Guard
    // A live service (providerEndpoint set, not mock) must belong to the
    // requesting user's own active provider. This prevents cross-user catalog
    // injection: User A cannot submit orders via User B's provider services.
    // -----------------------------------------------------------------------
    if (service.providerEndpoint && service.providerEndpoint !== "mock" && !service.isMock) {
      const { config: userProviderConfig } = await getActiveProvider(userId);
      const userEndpoint = userProviderConfig.isMock
        ? "mock"
        : userProviderConfig.apiUrl.trim();

      if (userEndpoint !== service.providerEndpoint) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The selected service does not belong to your connected provider. Please choose a service from your own provider catalog.",
          },
          { status: 403 }
        );
      }
    }

    const unitCost = service.ratePer1000 / 1000;
    const orderRef = `SMM-${Math.floor(100000 + Math.random() * 900000)}`;

    // Case 0: Drip Feed Random Range Order
    if (scheduleMode === "DRIP_FEED") {
      const minQty = parsed.data.dripMinQuantity ?? service.minQuantity;
      const maxQty = parsed.data.dripMaxQuantity ?? minQty;
      const runs = parsed.data.dripRuns ?? 5;
      const interval = parsed.data.dripIntervalMinutes ?? 60;

      let dripPlan;
      try {
        dripPlan = generateDripFeedSequence({
          minQuantityPerRun: minQty,
          maxQuantityPerRun: maxQty,
          runsCount: runs,
          intervalMinutes: interval,
          serviceMin: service.minQuantity,
          serviceMax: service.maxQuantity,
          ratePer1000: service.ratePer1000,
        });
      } catch (err: any) {
        return NextResponse.json(
          { success: false, error: err.message || "Failed to generate drip feed plan" },
          { status: 400 }
        );
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      const currentBalance = user?.walletBalance ?? 0;
      if (currentBalance < dripPlan.actualFinalCharge) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient wallet balance. Total cost is ₹${dripPlan.actualFinalCharge.toFixed(2)}, but your current balance is ₹${currentBalance.toFixed(2)}. Please recharge your wallet.`,
            required: dripPlan.actualFinalCharge,
            currentBalance,
          },
          { status: 402 }
        );
      }

      const order = await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { walletBalance: { decrement: dripPlan.actualFinalCharge } },
        });

        await tx.walletTransaction.create({
          data: {
            userId,
            type: "DEBIT",
            amount: dripPlan.actualFinalCharge,
            balanceAfter: updatedUser.walletBalance,
            referenceId: orderRef,
            description: `Drip Feed order ${orderRef} (${dripPlan.runsCount} runs, total ${dripPlan.actualTotalQuantity} units)`,
          },
        });

        const newOrder = await tx.order.create({
          data: {
            orderRef,
            serviceId: service.id,
            providerId: service.providerId,
            targetUrl,
            requestedQuantity: dripPlan.actualTotalQuantity,
            submittedQuantity: 0,
            deliveredQuantity: 0,
            remainingQuantity: dripPlan.actualTotalQuantity,
            failedQuantity: 0,
            unitCost,
            totalCost: dripPlan.actualFinalCharge,
            isScheduled: true,
            scheduleMode: "DRIP_FEED",
            status: "SCHEDULED",
            userId,
          },
        });

        const now = new Date();
        for (let i = 0; i < dripPlan.quantities.length; i++) {
          const runQty = dripPlan.quantities[i];
          const scheduledAt = new Date(now.getTime() + i * dripPlan.intervalMinutes * 60 * 1000);
          const runCost = Number(((runQty / 1000) * service.ratePer1000).toFixed(4));

          await tx.dripFeedRun.create({
            data: {
              orderId: newOrder.id,
              runNumber: i + 1,
              scheduledAt,
              quantity: runQty,
              status: "PENDING",
              cost: runCost,
            },
          });
        }

        return newOrder;
      });

      await prisma.auditLog.create({
        data: {
          action: "DRIP_FEED_ORDER_PLACED",
          actor: "Customer",
          details: `Drip Feed order ${orderRef} created with ${dripPlan.runsCount} runs (range ${minQty}-${maxQty})`,
          userId,
        },
      });

      const fullOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: { service: true, dripFeedRuns: { orderBy: { runNumber: "asc" } } },
      });

      return NextResponse.json({ success: true, order: fullOrder, dripPlan });
    }

    const totalCost = Number(((requestedQuantity / 1000) * service.ratePer1000).toFixed(4));

    // -----------------------------------------------------------------------
    // Change 14: Comprehensive Pre-Order Validation Suite
    // Reject BEFORE charging anything with a clear, calm message explaining what to fix.
    // -----------------------------------------------------------------------

    // 1. Link format validation (valid URL and matching platform syntax)
    const platform = service.platform?.toLowerCase() || "";
    const lowerUrl = targetUrl.toLowerCase();
    if (platform.includes("instagram") && !lowerUrl.includes("instagram.com")) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid Instagram post or reel link (e.g. https://www.instagram.com/p/...)" },
        { status: 400 }
      );
    }
    if (platform.includes("tiktok") && !lowerUrl.includes("tiktok.com")) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid TikTok video link (e.g. https://www.tiktok.com/@user/video/...)" },
        { status: 400 }
      );
    }
    if (platform.includes("youtube") && !lowerUrl.includes("youtube.com") && !lowerUrl.includes("youtu.be")) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid YouTube video link" },
        { status: 400 }
      );
    }

    // 2. Fetch User & Validate User Wallet Balance
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: "User account not found." }, { status: 404 });
    }
    const currentBalance = user.walletBalance ?? 0;
    if (currentBalance < totalCost) {
      const needed = Number((totalCost - currentBalance).toFixed(2));
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient wallet balance. Total cost is ₹${totalCost.toFixed(2)}, but your balance is ₹${currentBalance.toFixed(2)}. Please add ₹${needed.toFixed(2)} to continue.`,
          required: totalCost,
          currentBalance,
          needed,
        },
        { status: 402 }
      );
    }

    // 3. Resolve Chosen Provider & Validate Status, Key, and Upstream Balance
    const targetProviderId = service.userProviderId || service.providerId;
    let providerConnection = null;
    if (targetProviderId) {
      providerConnection = await prisma.userProviderConnection.findFirst({
        where: { id: targetProviderId, userId },
      });
    }
    if (!providerConnection) {
      providerConnection = await prisma.userProviderConnection.findFirst({
        where: { userId, active: true },
      });
    }

    if (!providerConnection || !providerConnection.active) {
      return NextResponse.json(
        { success: false, error: "The chosen provider is currently disconnected or paused. Please check your Wallet tab." },
        { status: 400 }
      );
    }

    const { adapter } = await getActiveProvider(userId, providerConnection.id);

    // Validate provider API key
    if (!providerConnection.isMock) {
      const { decryptApiKey } = await import("@/lib/security/crypto");
      const decryptedKey = decryptApiKey(providerConnection.apiKeyEncrypted);
      if (!decryptedKey || decryptedKey.trim() === "") {
        return NextResponse.json(
          { success: false, error: `Provider "${providerConnection.name}" API key is invalid or unconfigured. Please update your key in the Wallet tab.` },
          { status: 400 }
        );
      }
    }

    // Validate provider balance if known
    if (providerConnection.balance !== null && providerConnection.balance < totalCost && !providerConnection.isMock) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient balance on provider "${providerConnection.name}". Available: ${providerConnection.currency} ${providerConnection.balance.toFixed(2)}, Needed: ${totalCost.toFixed(2)}. Please recharge your provider account.`,
        },
        { status: 400 }
      );
    }

    // Case A: Instant Order Submission (Sent immediately to provider)
    if (scheduleMode === "INSTANT" || stepsCount === 1) {
      const targetProviderServiceId = service.providerServiceId || service.externalId;
      const providerRes = await adapter.createOrder({
        serviceExternalId: targetProviderServiceId,
        targetUrl,
        quantity: requestedQuantity,
      });

      if (!providerRes.success) {
        // Upstream rejected: DO NOT CHARGE USER! Reject before charging.
        return NextResponse.json(
          {
            success: false,
            error: providerRes.error || "Provider rejected order placement. Nothing was charged.",
          },
          { status: 422 }
        );
      }

      // Success: Transactionally debit user wallet and record order
      const newBal = Number((currentBalance - totalCost).toFixed(2));
      const order = await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { walletBalance: newBal },
        });

        await tx.walletTransaction.create({
          data: {
            userId,
            type: "DEBIT",
            amount: -totalCost,
            balanceAfter: newBal,
            referenceId: orderRef,
            description: `Order ${orderRef} (${service.name}, ${requestedQuantity.toLocaleString()} units)`,
          },
        });

        return tx.order.create({
          data: {
            orderRef,
            serviceId: service.id,
            providerId: providerConnection.id,
            targetUrl,
            requestedQuantity,
            submittedQuantity: requestedQuantity,
            deliveredQuantity: 0,
            remainingQuantity: requestedQuantity,
            failedQuantity: 0,
            unitCost,
            totalCost,
            isScheduled: false,
            scheduleMode: "INSTANT",
            status: "PROCESSING",
            providerOrderId: String(providerRes.providerOrderId),
            userId,
          },
          include: { service: true },
        });
      });

      await prisma.auditLog.create({
        data: {
          action: "ORDER_SUBMITTED",
          actor: "Customer",
          details: `Order ${orderRef} successfully submitted to provider (${providerRes.providerOrderId})`,
          userId,
        },
      });

      return NextResponse.json({ success: true, order });
    }

    // Case B: Scheduled Growth Planner Order
    const plan = calculateGrowthPlan({
      service,
      targetUrl,
      totalQuantity: requestedQuantity,
      scheduleMode: scheduleMode as ScheduleMode,
      timingMode,
      stepsCount,
      intervalMinutes,
      totalDurationMinutes,
      customStepQuantities,
      customIntervals,
      seed: parsed.data.seed,
      smoothness: parsed.data.smoothness,
      spikeIntensity: parsed.data.spikeIntensity,
      enforceExactAllocation: true,
      startDate: new Date(),
    });

    if (!plan.valid) {
      return NextResponse.json(
        { success: false, error: plan.errorMessage || "Invalid schedule configuration." },
        { status: 400 }
      );
    }

    // Transactionally debit wallet and create Order + persistent steps
    const newBal = Number((currentBalance - totalCost).toFixed(2));
    const order = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { walletBalance: newBal },
      });

      await tx.walletTransaction.create({
        data: {
          userId,
          type: "DEBIT",
          amount: -totalCost,
          balanceAfter: newBal,
          referenceId: orderRef,
          description: `Scheduled Growth Order ${orderRef} (${stepsCount} steps, ${requestedQuantity.toLocaleString()} units)`,
        },
      });

      const newOrder = await tx.order.create({
        data: {
          orderRef,
          serviceId: service.id,
          providerId: providerConnection.id,
          targetUrl,
          requestedQuantity,
          submittedQuantity: 0,
          deliveredQuantity: 0,
          remainingQuantity: requestedQuantity,
          failedQuantity: 0,
          unitCost,
          totalCost,
          isScheduled: true,
          scheduleMode,
          status: "SCHEDULED",
          userId,
        },
      });

      for (const step of plan.steps) {
        await tx.scheduledDeliveryStep.create({
          data: {
            orderId: newOrder.id,
            stepNumber: step.stepNumber,
            scheduledTime: new Date(step.scheduledTime),
            quantity: step.quantity,
            status: "PENDING",
            idempotencyKey: `${orderRef}-step-${step.stepNumber}`,
          },
        });
      }

      return newOrder;
    });

    await prisma.auditLog.create({
      data: {
        action: "GROWTH_PLAN_SCHEDULED",
        actor: "Customer",
        details: `Growth plan ${orderRef} created with ${plan.steps.length} persistent steps across ${intervalMinutes}m intervals`,
        userId,
      },
    });

    const fullOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        service: true,
        steps: { orderBy: { stepNumber: "asc" } },
      },
    });

    return NextResponse.json({ success: true, order: fullOrder });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process order" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json(
        { success: false, error: "Authentication required to view orders." },
        { status: 401 }
      );
    }
    const userId = session.user.id;
    const isAdmin = session.role === "ADMIN";

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, Math.min(50, parseInt(searchParams.get("limit") || "20")));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (!isAdmin) {
      where.userId = userId;
    }
    if (status && status !== "ALL") {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { orderRef: { contains: search } },
        { targetUrl: { contains: search } },
        { service: { name: { contains: search } } },
      ];
    }

    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          service: true,
          steps: {
            orderBy: { stepNumber: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    // Also get status count breakdown for tabs
    const statusCountWhere: any = {};
    if (!isAdmin) {
      statusCountWhere.userId = userId;
    }
    const statusCounts = await prisma.order.groupBy({
      by: ["status"],
      where: statusCountWhere,
      _count: { id: true },
    });

    const countMap: Record<string, number> = { ALL: totalCount };
    statusCounts.forEach((c) => {
      countMap[c.status] = c._count.id;
    });

    return NextResponse.json({
      success: true,
      orders,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
      counts: countMap,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load orders" },
      { status: 500 }
    );
  }
}

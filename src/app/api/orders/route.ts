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

    // Resolve Chosen Provider Connection
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

    const { adapter, config: providerConfig } = await getActiveProvider(
      userId,
      providerConnection?.id
    );
    const targetProviderServiceId = service.providerServiceId || service.externalId;

    // Fetch user (for optional local wallet records)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const currentBalance = user?.walletBalance ?? 0;

    // Case 0: Working Drip Feed Order
    if (scheduleMode === "DRIP_FEED") {
      const runs = parsed.data.dripRuns && parsed.data.dripRuns >= 1 ? parsed.data.dripRuns : 5;
      const interval = parsed.data.dripIntervalMinutes && parsed.data.dripIntervalMinutes >= 1 ? parsed.data.dripIntervalMinutes : 60;
      const quantityPerRun = requestedQuantity;

      // Validate quantity per run against service limits
      if (quantityPerRun < service.minQuantity) {
        return NextResponse.json(
          {
            success: false,
            error: `Quantity per run (${quantityPerRun.toLocaleString()}) is below the minimum required (${service.minQuantity.toLocaleString()}).`,
          },
          { status: 400 }
        );
      }
      if (quantityPerRun > service.maxQuantity) {
        return NextResponse.json(
          {
            success: false,
            error: `Quantity per run (${quantityPerRun.toLocaleString()}) exceeds the maximum allowed (${service.maxQuantity.toLocaleString()}).`,
          },
          { status: 400 }
        );
      }

      const totalQuantity = quantityPerRun * runs;
      const totalCharge = Number(((totalQuantity / 1000) * service.ratePer1000).toFixed(4));

      // Attempt native provider drip feed first (Standard SMM API v2: action=add with runs & interval)
      let providerOrderId: string | null = null;
      let isNativeDrip = false;

      const providerRes = await adapter.createOrder({
        serviceExternalId: targetProviderServiceId,
        targetUrl,
        quantity: quantityPerRun,
        runs,
        interval,
      });

      if (providerRes.success && providerRes.providerOrderId) {
        providerOrderId = String(providerRes.providerOrderId);
        isNativeDrip = true;
      } else {
        // Provider does not support native drip feed -> Send Run 1 immediately as first batch
        const run1Res = await adapter.createOrder({
          serviceExternalId: targetProviderServiceId,
          targetUrl,
          quantity: quantityPerRun,
        });

        if (run1Res.success && run1Res.providerOrderId) {
          providerOrderId = String(run1Res.providerOrderId);
          isNativeDrip = false;
        } else {
          return NextResponse.json(
            {
              success: false,
              error:
                providerRes.error ||
                run1Res.error ||
                "Provider rejected order placement. Please verify service ID and link.",
            },
            { status: 422 }
          );
        }
      }

      // Record in database
      const now = new Date();
      const order = await prisma.$transaction(async (tx) => {
        // If user has local wallet balance, debit it; do not block if zero
        if (currentBalance > 0) {
          const debited = Math.min(currentBalance, totalCharge);
          const newBal = Number((currentBalance - debited).toFixed(2));
          await tx.user.update({
            where: { id: userId },
            data: { walletBalance: newBal },
          });
          await tx.walletTransaction.create({
            data: {
              userId,
              type: "DEBIT",
              amount: -debited,
              balanceAfter: newBal,
              referenceId: orderRef,
              description: `Drip Feed order ${orderRef} (${runs} runs × ${quantityPerRun} units)`,
            },
          });
        }

        const newOrder = await tx.order.create({
          data: {
            orderRef,
            serviceId: service.id,
            providerId: providerConnection?.id || null,
            targetUrl,
            requestedQuantity: totalQuantity,
            submittedQuantity: isNativeDrip ? totalQuantity : quantityPerRun,
            deliveredQuantity: 0,
            remainingQuantity: isNativeDrip ? totalQuantity : totalQuantity - quantityPerRun,
            failedQuantity: 0,
            unitCost,
            totalCost: totalCharge,
            isScheduled: true,
            scheduleMode: "DRIP_FEED",
            status: "PROCESSING",
            providerOrderId,
            userId,
          },
        });

        // Create drip feed run entries for tracking
        for (let i = 0; i < runs; i++) {
          const scheduledAt = new Date(now.getTime() + i * interval * 60 * 1000);
          const runCost = Number(((quantityPerRun / 1000) * service.ratePer1000).toFixed(4));

          await tx.dripFeedRun.create({
            data: {
              orderId: newOrder.id,
              runNumber: i + 1,
              scheduledAt,
              quantity: quantityPerRun,
              status: isNativeDrip ? "PROCESSING" : i === 0 ? "COMPLETED" : "PENDING",
              providerOrderId: isNativeDrip ? providerOrderId : i === 0 ? providerOrderId : null,
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
          details: `Drip Feed order ${orderRef} placed: ${runs} runs of ${quantityPerRun} units every ${interval}m (Provider Order #${providerOrderId})`,
          userId,
        },
      });

      const fullOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: { service: true, dripFeedRuns: { orderBy: { runNumber: "asc" } } },
      });

      return NextResponse.json({
        success: true,
        order: fullOrder,
        message: `Drip feed order #${providerOrderId || orderRef} placed successfully! ${runs} runs scheduled every ${interval} minutes.`,
      });
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

    // 2. Validate User Wallet Balance (Only block if no provider connected)
    if (!user) {
      return NextResponse.json({ success: false, error: "User account not found." }, { status: 404 });
    }
    if (!providerConnection && currentBalance < totalCost) {
      const needed = Number((totalCost - currentBalance).toFixed(2));
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient wallet balance. Total cost is ${totalCost.toFixed(2)}, but your balance is ${currentBalance.toFixed(2)}. Please connect your provider API key or add balance.`,
          required: totalCost,
          currentBalance,
          needed,
        },
        { status: 402 }
      );
    }

    if (providerConnection && !providerConnection.active) {
      return NextResponse.json(
        { success: false, error: "The chosen provider is currently disconnected or paused. Please check your API Key tab." },
        { status: 400 }
      );
    }

    // Validate provider API key
    if (providerConnection && !providerConnection.isMock) {
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
    if (providerConnection && providerConnection.balance !== null && providerConnection.balance < totalCost && !providerConnection.isMock) {
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

      // Success: Transactionally debit user wallet (if positive) and record order
      const debited = Math.min(currentBalance, totalCost);
      const newBal = Number((currentBalance - debited).toFixed(2));
      const order = await prisma.$transaction(async (tx) => {
        if (debited > 0) {
          await tx.user.update({
            where: { id: userId },
            data: { walletBalance: newBal },
          });

          await tx.walletTransaction.create({
            data: {
              userId,
              type: "DEBIT",
              amount: -debited,
              balanceAfter: newBal,
              referenceId: orderRef,
              description: `Order ${orderRef} (${service.name}, ${requestedQuantity.toLocaleString()} units)`,
            },
          });
        }

        return tx.order.create({
          data: {
            orderRef,
            serviceId: service.id,
            providerId: providerConnection?.id || null,
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
          providerId: providerConnection?.id || null,
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

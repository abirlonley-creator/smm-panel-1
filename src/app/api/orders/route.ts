import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveProvider } from "@/lib/provider/adapter";
import { getAuthSession } from "@/lib/auth/session";
import { calculateGrowthPlan } from "@/lib/scheduler/calculator";
import { ScheduleMode } from "@/lib/types";
import { z } from "zod";

const createOrderSchema = z.object({
  serviceId: z.string().min(1, "Service ID is required"),
  targetUrl: z.string().url("A valid target URL is required"),
  requestedQuantity: z.number().int().positive("Quantity must be greater than 0"),
  scheduleMode: z
    .enum([
      "INSTANT",
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

    // Validate quantities strictly against service rules
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

    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json(
        { success: false, error: "Authentication required to place orders." },
        { status: 401 }
      );
    }
    const userId = session.user.id;

    const unitCost = service.ratePer1000 / 1000;
    const totalCost = Number(((requestedQuantity / 1000) * service.ratePer1000).toFixed(4));
    const orderRef = `SMM-${Math.floor(100000 + Math.random() * 900000)}`;

    // Case A: Instant Order Submission
    if (scheduleMode === "INSTANT" || stepsCount === 1) {
      const { adapter } = await getActiveProvider(userId);
      const providerRes = await adapter.createOrder({
        serviceExternalId: service.externalId,
        targetUrl,
        quantity: requestedQuantity,
      });

      if (!providerRes.success) {
        // Never fake success when provider fails!
        const failedOrder = await prisma.order.create({
          data: {
            orderRef,
            serviceId: service.id,
            targetUrl,
            requestedQuantity,
            submittedQuantity: 0,
            deliveredQuantity: 0,
            remainingQuantity: requestedQuantity,
            failedQuantity: requestedQuantity,
            unitCost,
            totalCost,
            isScheduled: false,
            scheduleMode: "INSTANT",
            status: "FAILED",
            errorMessage: providerRes.error || "Provider rejected order placement.",
            userId: userId || null,
          },
          include: { service: true },
        });

        await prisma.auditLog.create({
          data: {
            action: "ORDER_FAILED_SUBMISSION",
            actor: "Customer",
            details: `Order ${orderRef} failed: ${providerRes.error}`,
          },
        });

        return NextResponse.json(
          {
            success: false,
            error: providerRes.error || "Provider rejected order placement.",
            order: failedOrder,
          },
          { status: 422 }
        );
      }

      // Success
      const order = await prisma.order.create({
        data: {
          orderRef,
          serviceId: service.id,
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
          providerOrderId: providerRes.providerOrderId,
          userId: userId || null,
        },
        include: { service: true },
      });

      await prisma.auditLog.create({
        data: {
          action: "ORDER_SUBMITTED",
          actor: "Customer",
          details: `Order ${orderRef} successfully submitted to provider (${providerRes.providerOrderId})`,
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
      enforceExactAllocation: true, // Strict validation on final submission
      startDate: new Date(),
    });

    if (!plan.valid) {
      return NextResponse.json(
        { success: false, error: plan.errorMessage || "Invalid schedule configuration." },
        { status: 400 }
      );
    }

    // Create Order and persistent steps in a transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderRef,
          serviceId: service.id,
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
          userId: userId || null,
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

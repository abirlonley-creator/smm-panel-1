import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateGrowthPlan } from "@/lib/scheduler/calculator";
import { ScheduleMode, SchedulingTimingMode } from "@/lib/types";
import { z } from "zod";

const calculateSchema = z.object({
  serviceId: z.string().min(1, "Service ID is required"),
  targetUrl: z.string().optional().default(""),
  totalQuantity: z.number().int().positive("Quantity must be greater than 0"),
  scheduleMode: z.enum(["INSTANT", "EVEN_DRIP", "FRONT_LOADED", "GRADUAL_RAMP", "CUSTOM"]).default("EVEN_DRIP"),
  timingMode: z.enum(["MODE_A", "MODE_B", "CUSTOM"]).optional().default("MODE_B"),
  stepsCount: z.number().int().min(1).max(30).optional().default(5),
  intervalMinutes: z.number().int().min(1).max(10080).optional().default(30),
  totalDurationMinutes: z.number().int().positive().optional(),
  startDate: z.string().optional(),
  customStepQuantities: z.array(z.number().int().positive()).optional(),
  customIntervals: z.array(z.number().int().nonnegative()).optional(),
  enforceExactAllocation: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = calculateSchema.safeParse(body);

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
      targetUrl = "",
      totalQuantity,
      scheduleMode,
      timingMode,
      stepsCount,
      intervalMinutes,
      totalDurationMinutes,
      startDate,
      customStepQuantities,
      customIntervals,
      enforceExactAllocation,
    } = parsed.data;

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return NextResponse.json(
        { success: false, error: "Requested service was not found." },
        { status: 404 }
      );
    }

    const plan = calculateGrowthPlan({
      service,
      targetUrl,
      totalQuantity,
      scheduleMode: scheduleMode as ScheduleMode,
      timingMode: timingMode as SchedulingTimingMode,
      stepsCount,
      intervalMinutes,
      totalDurationMinutes,
      customStepQuantities,
      customIntervals,
      enforceExactAllocation,
      startDate: startDate ? new Date(startDate) : undefined,
    });

    return NextResponse.json({
      success: plan.valid,
      plan,
      error: plan.valid ? null : plan.errorMessage,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to calculate plan" },
      { status: 500 }
    );
  }
}

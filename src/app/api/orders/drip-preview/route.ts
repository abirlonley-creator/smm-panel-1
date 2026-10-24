import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDripFeedSequence } from "@/lib/orders/drip-feed-randomizer";
import { z } from "zod";

const previewSchema = z.object({
  serviceId: z.string().min(1),
  minQuantity: z.number().int().positive(),
  maxQuantity: z.number().int().positive(),
  runs: z.number().int().min(1).max(100),
  intervalMinutes: z.number().int().min(1).max(10080).default(60),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = previewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const { serviceId, minQuantity, maxQuantity, runs, intervalMinutes } = parsed.data;

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return NextResponse.json(
        { success: false, error: "Service not found" },
        { status: 404 }
      );
    }

    const plan = generateDripFeedSequence({
      minQuantityPerRun: minQuantity,
      maxQuantityPerRun: maxQuantity,
      runsCount: runs,
      intervalMinutes,
      serviceMin: service.minQuantity,
      serviceMax: service.maxQuantity,
      ratePer1000: service.ratePer1000,
    });

    return NextResponse.json({ success: true, plan });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate drip preview" },
      { status: 400 }
    );
  }
}

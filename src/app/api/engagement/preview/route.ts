import { NextResponse } from "next/server";
import { generateOrganicPlan, DEFAULT_SERVICE_SPECS } from "@/lib/engagement/planner";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const previewSchema = z.object({
  platform: z.enum(["Instagram", "TikTok"]),
  baseViews: z.number().int().min(100).max(10000000),
  durationHours: z.number().int().min(1).max(168).default(24),
  seed: z.string().optional(),
  peakHourWeighting: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = previewSchema.parse(body);

    // Look for mapped services in DB for this platform if available
    const dbServices = await prisma.service.findMany({
      where: {
        platform: parsed.platform,
        active: true,
      },
      select: {
        id: true,
        providerId: true,
        name: true,
        category: true,
        minQuantity: true,
        maxQuantity: true,
        ratePer1000: true,
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

    const plan = generateOrganicPlan({
      platform: parsed.platform,
      baseViews: parsed.baseViews,
      durationHours: parsed.durationHours,
      seed: parsed.seed,
      peakHourWeighting: parsed.peakHourWeighting,
      services: Object.keys(servicesMap).length > 0 ? servicesMap : undefined,
    });

    return NextResponse.json({
      success: true,
      plan,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate plan preview" },
      { status: 400 }
    );
  }
}

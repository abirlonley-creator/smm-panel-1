import { NextResponse } from "next/server";
import {
  generateOrganicPlan,
  generateUniqueOrganicPlan,
  type DurationPreset,
  type EngagementType,
} from "@/lib/engagement/planner";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const previewSchema = z.object({
  platform: z.enum(["Instagram", "TikTok"]).default("Instagram"),
  baseViews: z.number().int().min(100).max(10000000),
  durationPreset: z.enum(["24h", "72h", "168h"]).default("72h"),
  durationHours: z.number().int().min(1).max(168).optional(),
  seed: z.union([z.string(), z.number()]).optional(),
  targetTz: z.string().default("Asia/Kolkata"),
  startTime: z.string().optional(),
  enabledTypes: z.array(z.enum(["views", "likes", "shares", "saves", "comments"])).optional(),
  peakHourWeighting: z.boolean().default(true),
  customRatios: z.record(z.string(), z.number()).optional(),
  previousFingerprint: z.string().optional(),
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
      const match = dbServices.find(
        (s) => s.category.toLowerCase().includes(type) || s.name.toLowerCase().includes(type)
      );
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

    const planOptions = {
      platform: parsed.platform,
      baseViews: parsed.baseViews,
      durationPreset: parsed.durationPreset as DurationPreset,
      durationHours: parsed.durationHours,
      seed: parsed.seed,
      targetTz: parsed.targetTz,
      startTime: parsed.startTime,
      enabledTypes: parsed.enabledTypes as EngagementType[] | undefined,
      peakHourWeighting: parsed.peakHourWeighting,
      services: Object.keys(servicesMap).length > 0 ? servicesMap : undefined,
      customRatios: parsed.customRatios as Partial<Record<EngagementType, number>> | undefined,
    };

    // If previousFingerprint is passed (e.g. "New Pattern" button clicked), guarantee distinct plan
    const plan = parsed.previousFingerprint
      ? generateUniqueOrganicPlan(planOptions, parsed.previousFingerprint)
      : generateOrganicPlan(planOptions);

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

import { NextResponse } from "next/server";
import {
  generateOrganicPlan,
  generateUniqueOrganicPlan,
  type DurationPreset,
  type EngagementType,
} from "@/lib/engagement/planner";
import { getPlatformProfile } from "@/lib/engagement/platform-profiles";
import { z } from "zod";

const previewSchema = z.object({
  profileId: z.string().optional(),
  platform: z.string().optional(),
  baseViews: z.number().int().min(1).max(10000000),
  presetKey: z.enum(["fast", "normal", "slow"]).optional(),
  durationPreset: z.enum(["24h", "48h", "72h", "96h", "168h"]).optional(),
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

    const profileId = parsed.profileId || (parsed.platform?.toLowerCase() === "tiktok" ? "tiktok" : "instagram_reel");
    const profile = getPlatformProfile(profileId);

    const planOptions = {
      profileId: profile.id,
      platform: profile.platform,
      presetKey: parsed.presetKey,
      baseViews: parsed.baseViews,
      durationPreset: parsed.durationPreset as DurationPreset | undefined,
      durationHours: parsed.durationHours,
      seed: parsed.seed,
      targetTz: parsed.targetTz,
      startTime: parsed.startTime,
      enabledTypes: parsed.enabledTypes as EngagementType[] | undefined,
      peakHourWeighting: parsed.peakHourWeighting,
      services: profile.serviceMappings, // Backend-resolved service mappings
      customRatios: parsed.customRatios as Partial<Record<EngagementType, number>> | undefined,
    };

    const plan = parsed.previousFingerprint
      ? generateUniqueOrganicPlan(planOptions, parsed.previousFingerprint)
      : generateOrganicPlan(planOptions);

    return NextResponse.json({
      success: true,
      plan,
      profile: {
        id: profile.id,
        name: profile.name,
        badge: profile.badge,
        description: profile.description,
        explainerText: profile.explainerText,
        presets: profile.presets,
        defaultPreset: profile.defaultPreset,
        serviceMappings: Object.entries(profile.serviceMappings).reduce((acc, [k, v]) => {
          acc[k] = { min: v.minQuantity, max: v.maxQuantity, rate: v.ratePer1000 };
          return acc;
        }, {} as Record<string, { min: number; max: number; rate: number }>),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate plan preview" },
      { status: 400 }
    );
  }
}

import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  generateOrganicPlan,
  generateUniqueOrganicPlan,
  type DurationPreset,
  type EngagementType,
  type ServiceSpec,
} from "@/lib/engagement/planner";
import { getPlatformProfile } from "@/lib/engagement/platform-profiles";
import { z } from "zod";

const previewSchema = z.object({
  profileId: z.string().optional(),
  platform: z.string().optional(),
  baseViews: z.number().int().min(1).max(10000000),
  presetKey: z.enum(["fast", "normal", "slow"]).optional(),
  pacingMode: z.enum(["auto", "custom"]).optional(),
  customSpeedPreset: z.enum(["faster", "slower", "exact"]).optional(),
  customDurationHours: z.number().min(0.2).max(400).optional(),
  durationPreset: z.enum(["24h", "48h", "72h", "96h", "168h"]).optional(),
  durationHours: z.number().min(0.2).max(400).optional(),
  seed: z.union([z.string(), z.number()]).optional(),
  targetTz: z.string().default("Asia/Kolkata"),
  startTime: z.string().optional(),
  enabledTypes: z.array(z.enum(["views", "likes", "shares", "saves", "comments"])).optional(),
  typeToggles: z.record(z.string(), z.boolean()).optional(),
  customQuantities: z.record(z.string(), z.number()).optional(),
  customSources: z.record(z.string(), z.enum(["suggested", "custom"])).optional(),
  peakHourWeighting: z.boolean().default(true),
  customRatios: z.record(z.string(), z.number()).optional(),
  previousFingerprint: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getAuthSession(request);
    const body = await request.json();
    const parsed = previewSchema.parse(body);

    const profileId = parsed.profileId || (parsed.platform?.toLowerCase() === "tiktok" ? "tiktok" : "instagram_reel");
    const profile = getPlatformProfile(profileId);

    const activeTypes = (parsed.enabledTypes || ["views", "likes", "saves", "shares", "comments"]).filter(
      (t) => parsed.typeToggles?.[t] !== false
    ) as EngagementType[];

    // Resolve user's configured provider service mappings if logged in
    const resolvedServices: Record<EngagementType, ServiceSpec> = { ...profile.serviceMappings };
    const unmappedTypes: EngagementType[] = [];
    const disconnectedTypes: EngagementType[] = [];

    if (session.authenticated && session.user) {
      const userMappings = await prisma.userEngagementMapping.findMany({
        where: { userId: session.user.id, platform: profile.platform },
        include: { provider: true },
      });
      const mappingMap = new Map(userMappings.map((m) => [m.engagementType, m]));

      for (const t of activeTypes) {
        const m = mappingMap.get(t);
        if (!m || !m.active) {
          unmappedTypes.push(t);
        } else if (!m.provider || !m.provider.active) {
          disconnectedTypes.push(t);
        } else {
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
    }

    const planOptions = {
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
      startTime: parsed.startTime,
      enabledTypes: activeTypes,
      typeToggles: parsed.typeToggles,
      customQuantities: parsed.customQuantities as Partial<Record<EngagementType, number>> | undefined,
      customSources: parsed.customSources as Partial<Record<EngagementType, "suggested" | "custom">> | undefined,
      peakHourWeighting: parsed.peakHourWeighting,
      services: resolvedServices,
      customRatios: parsed.customRatios as Partial<Record<EngagementType, number>> | undefined,
      autoDisableBelowMin: true,
    };

    const plan = parsed.previousFingerprint
      ? generateUniqueOrganicPlan(planOptions, parsed.previousFingerprint)
      : generateOrganicPlan(planOptions);

    return NextResponse.json({
      success: true,
      plan,
      unmappedTypes,
      disconnectedTypes,
      profile: {
        id: profile.id,
        name: profile.name,
        badge: profile.badge,
        description: profile.description,
        explainerText: profile.explainerText,
        presets: profile.presets,
        defaultPreset: profile.defaultPreset,
        serviceMappings: Object.entries(resolvedServices).reduce((acc, [k, v]) => {
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


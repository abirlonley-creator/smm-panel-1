import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import {
  getAllPlatformProfiles,
  getPlatformProfile,
  updateEngagementServiceMapping,
  savePlatformProfile,
} from "@/lib/engagement/platform-profiles";
import { EngagementType } from "@/lib/engagement/planner";
import { z } from "zod";

const updateMappingSchema = z.object({
  profileId: z.string().min(1),
  type: z.enum(["views", "likes", "shares", "saves", "comments"]),
  providerId: z.string().optional(),
  providerServiceId: z.string().optional(),
  name: z.string().optional(),
  minQuantity: z.number().int().positive().optional(),
  maxQuantity: z.number().int().positive().optional(),
  ratePer1000: z.number().positive().optional(),
});

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profiles = getAllPlatformProfiles();
    return NextResponse.json({
      success: true,
      profiles,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch platform profiles" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateMappingSchema.parse(body);

    const updated = updateEngagementServiceMapping(
      parsed.profileId,
      parsed.type as EngagementType,
      {
        providerId: parsed.providerId,
        providerServiceId: parsed.providerServiceId,
        name: parsed.name,
        minQuantity: parsed.minQuantity,
        maxQuantity: parsed.maxQuantity,
        ratePer1000: parsed.ratePer1000,
      }
    );

    return NextResponse.json({
      success: true,
      message: `Updated service mapping for ${parsed.profileId} [${parsed.type}] successfully.`,
      mapping: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update service mapping" },
      { status: 400 }
    );
  }
}

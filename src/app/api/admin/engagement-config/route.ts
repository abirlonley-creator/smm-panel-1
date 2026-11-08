import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import {
  getTikTokEngagementConfig,
  saveTikTokEngagementConfig,
  type TikTokEngagementPresetConfig,
} from "@/lib/engagement/tiktok-preset-config";

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const config = getTikTokEngagementConfig();
  return NextResponse.json({ success: true, config });
}

export async function PUT(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const updated = saveTikTokEngagementConfig(body);
    return NextResponse.json({
      success: true,
      config: updated,
      message: "TikTok Engagement configuration saved successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update configuration" },
      { status: 400 }
    );
  }
}

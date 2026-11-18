import { NextResponse } from "next/server";
import { getAnnouncementState } from "@/lib/announcement/announcement-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await getAnnouncementState();
    return NextResponse.json({
      success: true,
      announcement: config,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err?.message || "Failed to retrieve site announcement",
      announcement: {
        enabled: false,
        message: "",
      },
    });
  }
}

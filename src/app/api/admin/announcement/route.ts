import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { requireAdminPermission } from "@/lib/auth/admin-permissions";
import { getAnnouncementState, setAnnouncementState, AnnouncementConfig } from "@/lib/announcement/announcement-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await getAnnouncementState();
    return NextResponse.json({
      success: true,
      announcement: config,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to fetch announcement config" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const perm = await requireAdminPermission(request, "canEditAnnouncement");
  if (!perm.allowed) {
    return NextResponse.json({ success: false, error: perm.error }, { status: perm.status });
  }
  const session = perm.session;

  try {
    const body = await request.json();
    const updated = await setAnnouncementState(
      {
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
        message: typeof body.message === "string" ? body.message : undefined,
        badge: typeof body.badge === "string" ? body.badge : undefined,
        link: typeof body.link === "string" ? body.link : undefined,
        linkText: typeof body.linkText === "string" ? body.linkText : undefined,
        speed: body.speed,
        allowDismiss: typeof body.allowDismiss === "boolean" ? body.allowDismiss : undefined,
      },
      session.label || "admin"
    );

    return NextResponse.json({
      success: true,
      announcement: updated,
      message: updated.enabled ? "Announcement is now live on the website!" : "Announcement disabled.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to update announcement config" },
      { status: 500 }
    );
  }
}

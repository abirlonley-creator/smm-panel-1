import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { getMaintenanceState, setMaintenanceState } from "@/lib/maintenance/maintenance-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  enabled: z.boolean(),
  title: z.string().optional(),
  message: z.string().optional(),
  supportTelegram: z.string().optional(),
});

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const state = await getMaintenanceState();
    return NextResponse.json({
      success: true,
      maintenance: state,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to retrieve maintenance state" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload: enabled boolean is required" },
        { status: 400 }
      );
    }

    const { enabled, title, message, supportTelegram } = parsed.data;
    const updated = await setMaintenanceState(enabled, {
      title,
      message,
      supportTelegram,
      actor: session.user?.username || session.label || "admin",
    });

    return NextResponse.json({
      success: true,
      maintenance: updated,
      message: enabled
        ? "Website is now in Under Update (Maintenance) mode. Regular users are blocked, but backend order deliveries remain active."
        : "Website is now live. User access has been fully restored.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update maintenance state" },
      { status: 500 }
    );
  }
}

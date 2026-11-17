import { NextResponse } from "next/server";
import { getMaintenanceState } from "@/lib/maintenance/maintenance-service";
import { getAuthSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const state = await getMaintenanceState();
    const session = await getAuthSession(request);
    const isAdmin = Boolean(session.authenticated && session.role === "ADMIN");

    return NextResponse.json({
      success: true,
      underMaintenance: state.enabled,
      isAdmin,
      userRole: session.role || null,
      title: state.title,
      message: state.message,
      supportTelegram: state.supportTelegram,
      updatedAt: state.updatedAt,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: true,
      underMaintenance: false,
      isAdmin: false,
      userRole: null,
    });
  }
}

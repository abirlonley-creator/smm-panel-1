import { NextResponse } from "next/server";
import { getMaintenanceState } from "@/lib/maintenance/maintenance-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await getMaintenanceState();
    return NextResponse.json({
      success: true,
      underMaintenance: state.enabled,
      title: state.title,
      message: state.message,
      supportTelegram: state.supportTelegram,
      updatedAt: state.updatedAt,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: true,
      underMaintenance: false,
    });
  }
}

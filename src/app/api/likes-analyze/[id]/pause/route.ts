import { NextResponse } from "next/server";
import { pauseMonitoringSession } from "@/lib/monitoring/engine";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await getAuthSession(request);
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const session = await prisma.monitoringSession.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true },
    });
    if (!session) {
      return NextResponse.json({ success: false, error: "Monitoring session not found." }, { status: 404 });
    }
    if (auth.role !== "ADMIN" && session.userId !== auth.user.id) {
      return NextResponse.json({ success: false, error: "Monitoring session not found." }, { status: 404 });
    }

    const result = await pauseMonitoringSession(params.id);
    return NextResponse.json({ ...result, success: result.ok }, { status: result.ok ? 200 : 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to pause monitoring session" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { runMonitoringTick } from "@/lib/monitoring/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/likes-analyze/[id]/tick
 *
 * Manually triggers one monitoring tick for a specific session.
 * Used by the UI immediately after session creation to execute the
 * first snapshot (checkpoint #1) without blocking the POST /api/likes-analyze
 * response — which would otherwise time out on Vercel Hobby (10s limit).
 *
 * The analytics adapter (Apify TikTok scraper) takes 8-15s per snapshot.
 * By separating creation from the first tick, the UI can show a loading state
 * and poll for results rather than waiting for a single giant synchronous call.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthSession(request);
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const sessionId = params.id;
    if (!sessionId) {
      return NextResponse.json({ success: false, error: "Session ID is required." }, { status: 400 });
    }

    // Verify the session belongs to this user (or user is admin)
    const session = await prisma.monitoringSession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, status: true, orderRef: true },
    });

    if (!session) {
      return NextResponse.json({ success: false, error: "Session not found." }, { status: 404 });
    }

    const isAdmin = auth.role === "ADMIN";
    if (!isAdmin && session.userId !== auth.user.id) {
      return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
    }

    if (session.status !== "RUNNING") {
      return NextResponse.json(
        { success: false, error: `Session is not running (status: ${session.status}).` },
        { status: 400 }
      );
    }

    // Run the tick for this specific session
    const tickResult = await runMonitoringTick(new Date(), sessionId);

    // Return the updated session state
    const updated = await prisma.monitoringSession.findUnique({
      where: { id: sessionId },
      include: {
        checkpoints: { orderBy: { sequence: "asc" }, take: 5 },
      },
    });

    return NextResponse.json({
      success: true,
      tick: tickResult,
      session: updated,
    });
  } catch (error: any) {
    console.error("[TICK] Error running monitoring tick:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Tick execution failed." },
      { status: 500 }
    );
  }
}

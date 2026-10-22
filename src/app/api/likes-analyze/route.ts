import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createMonitoringSession } from "@/lib/monitoring/engine";
import { runMonitoringTick } from "@/lib/monitoring/engine";
import { getAuthSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const createSessionSchema = z.object({
  serviceId: z.string().min(1, "Service ID is required"),
  videoUrl: z.string().url("A valid video URL is required"),
  durationMinutes: z.number().int().positive("Monitoring duration must be greater than 0"),
  intervalMinutes: z.number().int().positive("Monitoring interval must be greater than 0"),
  budgetCap: z.number().positive("Budget limit must be a positive number").optional(),
  quantityCap: z.number().int().positive("Quantity limit must be a positive number").optional(),
});

/**
 * POST /api/likes-analyze
 * Creates and starts a persistent monitoring session. The initial snapshot is
 * checkpoint #1 and is executed immediately after validation, using the real
 * analytics adapter.
 */
export async function POST(request: Request) {
  try {
    const auth = await getAuthSession(request);
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const result = await createMonitoringSession({
      serviceId: parsed.data.serviceId,
      videoUrl: parsed.data.videoUrl.trim(),
      durationMinutes: parsed.data.durationMinutes,
      intervalMinutes: parsed.data.intervalMinutes,
      budgetCap: parsed.data.budgetCap,
      quantityCap: parsed.data.quantityCap,
      userId: auth.user.id,
    });

    if (!result.ok || !result.session) {
      return NextResponse.json({ success: false, error: result.error || "Unable to create monitoring session." }, { status: 400 });
    }

    // Execute the initial snapshot (checkpoint #1) immediately so the UI shows
    // real data right away. Failures here are persisted and visible in the UI.
    const tick = await runMonitoringTick(new Date(), result.session.id);

    const session = await prisma.monitoringSession.findUnique({
      where: { id: result.session.id },
      include: { checkpoints: { orderBy: { sequence: "asc" } } },
    });

    return NextResponse.json({ success: true, session, initialTick: tick });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create monitoring session" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/likes-analyze
 * Lists monitoring sessions (newest first). Non-admins only see their own sessions.
 */
export async function GET(request: Request) {
  try {
    const auth = await getAuthSession(request);
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const isAdmin = auth.role === "ADMIN";
    const where = isAdmin ? {} : { userId: auth.user.id };

    const sessions = await prisma.monitoringSession.findMany({
      where,
      include: {
        service: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ success: true, sessions });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load monitoring sessions" },
      { status: 500 }
    );
  }
}

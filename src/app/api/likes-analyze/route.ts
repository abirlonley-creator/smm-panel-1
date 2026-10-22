import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createMonitoringSession } from "@/lib/monitoring/engine";
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

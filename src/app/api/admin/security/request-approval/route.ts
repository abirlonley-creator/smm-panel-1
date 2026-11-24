import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { createApprovalRequest } from "@/lib/security/telegram";
import { z } from "zod";

const requestApprovalSchema = z.object({
  action: z.string().min(1),
  target: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const adminSession = await getAdminSession(request);
  if (!adminSession.authenticated || adminSession.role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = requestApprovalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid action parameters" }, { status: 400 });
    }

    const { action, target, metadata } = parsed.data;

    const result = await createApprovalRequest({
      action,
      actor: adminSession.label || adminSession.user?.username || "Administrator",
      target,
      metadata,
    });

    return NextResponse.json({
      success: true,
      approvalId: result.approvalId,
      expiresAt: result.expiresAt,
      message: "An out-of-band confirmation code has been dispatched to your Telegram.",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to initiate approval" }, { status: 500 });
  }
}

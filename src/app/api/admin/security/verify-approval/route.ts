import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { getApprovalStatus, verifyAndConsumeApproval } from "@/lib/security/telegram";
import { z } from "zod";

const verifyApprovalSchema = z.object({
  approvalId: z.string().min(1),
});

export async function GET(request: Request) {
  const adminSession = await getAdminSession(request);
  if (!adminSession.authenticated || adminSession.role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const approvalId = searchParams.get("approvalId") || "";
  if (!approvalId) {
    return NextResponse.json({ success: false, error: "approvalId is required" }, { status: 400 });
  }

  const record = await getApprovalStatus(approvalId);
  if (!record) {
    return NextResponse.json({ success: true, status: "EXPIRED" });
  }

  return NextResponse.json({
    success: true,
    status: record.status,
    decidedBy: record.decidedBy || null,
  });
}

export async function POST(request: Request) {
  const adminSession = await getAdminSession(request);
  if (!adminSession.authenticated || adminSession.role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = verifyApprovalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Approval ID is required" }, { status: 400 });
    }

    const valid = await verifyAndConsumeApproval(parsed.data.approvalId);

    if (!valid) {
      return NextResponse.json(
        {
          success: false,
          approved: false,
          error: "Invalid, expired, or already consumed out-of-band approval code.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      approved: true,
      message: "Out-of-band verification confirmed.",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Verification failed" }, { status: 500 });
  }
}

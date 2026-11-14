import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { recordAdminAlert } from "@/lib/engagement/alert-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const providerName = body.providerName || "Admin Fulfillment Engine";
    const serviceName = body.serviceName || "TikTok Engagement / SMM Service";
    const orderType = body.orderType || "Order";

    const alert = await recordAdminAlert({
      severity: "high",
      type: "insufficient_balance",
      providerName,
      userId: session.user.id,
      reason: `User @${session.user.username} tried to place a ${orderType} (${serviceName}) but the admin provider "${providerName}" has run out of balance. User tapped "Notify Admin".`,
    });

    return NextResponse.json({
      success: true,
      alertId: alert?.id,
      message: "Admin has been notified with high priority. A red alert has been dispatched to the admin console.",
      supportUrl: "https://t.me/Ghostfinds",
    });
  } catch (err: any) {
    console.error("[NOTIFY_ADMIN_BALANCE_ERROR]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to notify admin" },
      { status: 500 }
    );
  }
}

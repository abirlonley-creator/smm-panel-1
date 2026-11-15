import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { verifyAndCreditDeposit } from "@/lib/payments/binance-pay";
import { z } from "zod";

export const dynamic = "force-dynamic";

const verifyDepositSchema = z.object({
  depositId: z.string().optional(),
  txnId: z.string().min(5, "Binance Order ID or Transaction ID is required"),
  senderBinanceId: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = verifyDepositSchema.parse(body);

    const result = await verifyAndCreditDeposit({
      userId: session.user.id,
      depositId: parsed.depositId,
      txnId: parsed.txnId,
      senderBinanceId: parsed.senderBinanceId,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          requiresAdminReview: Boolean(result.requiresAdminReview),
          error: result.error || "Payment not found. Queued for Admin Review. Check your Binance Order ID.",
          message: result.message,
          failureReason: result.failureReason,
          deposit: result.deposit,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      verified: Boolean(result.verified),
      alreadyCredited: Boolean(result.alreadyCredited),
      newBalance: result.newBalance,
      deposit: result.deposit,
      message: result.message,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Payment verification failed" },
      { status: 400 }
    );
  }
}

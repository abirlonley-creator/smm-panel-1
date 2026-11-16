import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { verifyAndCreditDeposit } from "@/lib/payments/binance-pay";

export const dynamic = "force-dynamic";

/**
 * Re-runs the automated Binance Pay verification for a deposit the customer already
 * submitted an Order ID for. Useful when a payment arrived after the customer's last
 * attempt, or after the Binance API credentials were fixed.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deposit = await prisma.paymentDeposit.findUnique({
      where: { id: params.id },
      include: { user: { select: { id: true, username: true } } },
    });

    if (!deposit) {
      return NextResponse.json({ success: false, error: "Deposit not found" }, { status: 404 });
    }

    if (deposit.status === "VERIFIED") {
      return NextResponse.json(
        { success: false, error: "Deposit is already verified and credited" },
        { status: 400 }
      );
    }

    if (!deposit.txnId) {
      return NextResponse.json(
        { success: false, error: "The customer has not submitted a Binance Order ID yet" },
        { status: 400 }
      );
    }

    const result = await verifyAndCreditDeposit({
      userId: deposit.userId,
      depositId: deposit.id,
      txnId: deposit.txnId,
      senderBinanceId: deposit.senderBinanceId || undefined,
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        autoVerifyStatus: result.autoVerifyStatus,
        error: result.error,
        failureReason: result.failureReason,
        apiError: result.apiError,
        deposit: result.deposit,
      });
    }

    return NextResponse.json({
      success: true,
      autoVerifyStatus: result.autoVerifyStatus,
      newBalance: result.newBalance,
      deposit: result.deposit,
      message: result.message,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Auto-verification failed" },
      { status: 400 }
    );
  }
}

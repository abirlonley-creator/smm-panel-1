import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const actionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, reason } = actionSchema.parse(body);

    const deposit = await prisma.paymentDeposit.findUnique({
      where: { id: params.id },
      include: { user: true },
    });

    if (!deposit) {
      return NextResponse.json({ success: false, error: "Deposit not found" }, { status: 404 });
    }

    if (deposit.status === "VERIFIED") {
      return NextResponse.json(
        { success: false, error: "Deposit is already approved and credited" },
        { status: 400 }
      );
    }

    if (action === "REJECT") {
      const updated = await prisma.paymentDeposit.update({
        where: { id: deposit.id },
        data: {
          status: "REJECTED",
          rejectionReason: reason || "Rejected by administrator",
        },
      });
      return NextResponse.json({
        success: true,
        deposit: updated,
        message: "Deposit has been marked as rejected.",
      });
    }

    // APPROVE action: Atomically credit user's wallet
    const result = await prisma.$transaction(async (tx) => {
      const updatedDeposit = await tx.paymentDeposit.update({
        where: { id: deposit.id },
        data: {
          status: "VERIFIED",
          verifiedAt: new Date(),
          rejectionReason: null,
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: deposit.userId },
        data: {
          walletBalance: { increment: deposit.inrAmount },
        },
        select: { id: true, walletBalance: true },
      });

      await tx.walletTransaction.create({
        data: {
          userId: deposit.userId,
          type: "CREDIT",
          amount: deposit.inrAmount,
          balanceAfter: updatedUser.walletBalance,
          referenceId: deposit.depositRef,
          description: `Admin Approved Binance Pay Deposit: ₹${deposit.inrAmount} (${deposit.usdtAmount} USDT)`,
        },
      });

      return { updatedDeposit, newBalance: updatedUser.walletBalance };
    });

    return NextResponse.json({
      success: true,
      deposit: result.updatedDeposit,
      newBalance: result.newBalance,
      message: `Deposit approved! ₹${deposit.inrAmount} has been credited to ${deposit.user.username}.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process deposit action" },
      { status: 400 }
    );
  }
}

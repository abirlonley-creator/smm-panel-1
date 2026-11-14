import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  getBinanceConfig,
  createBinanceDeposit,
  calculateUsdtAmount,
} from "@/lib/payments/binance-pay";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createDepositSchema = z.object({
  inrAmount: z.number().positive("Amount must be greater than 0"),
});

export async function GET(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = getBinanceConfig();
    const deposits = await prisma.paymentDeposit.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      config,
      deposits,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load deposit history" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createDepositSchema.parse(body);

    const deposit = await createBinanceDeposit({
      userId: session.user.id,
      inrAmount: parsed.inrAmount,
    });

    return NextResponse.json({
      success: true,
      deposit: {
        id: deposit.id,
        depositRef: deposit.depositRef,
        inrAmount: deposit.inrAmount,
        usdtAmount: deposit.usdtAmount,
        exchangeRate: deposit.exchangeRate,
        binanceUid: deposit.binanceUid,
        status: deposit.status,
        createdAt: deposit.createdAt,
      },
      message: `Deposit reference ${deposit.depositRef} created. Please send ${deposit.usdtAmount} USDT to Binance UID ${deposit.binanceUid}.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create deposit order" },
      { status: 400 }
    );
  }
}

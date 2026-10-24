import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { refreshAllUserProviderBalances } from "@/lib/provider/concurrent-runner";
import { z } from "zod";

const depositSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  description: z.string().optional(),
});

export async function GET(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get("refresh") === "true";

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, username: true, walletBalance: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // 1. Fetch transactions
    const transactions = await prisma.walletTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // 2. Fetch all user connected providers with live/cached balances concurrently
    const providerBalances = await refreshAllUserProviderBalances(user.id, forceRefresh);

    return NextResponse.json({
      success: true,
      wallet: {
        currency: "INR",
        balance: user.walletBalance ?? 1000.0,
      },
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        referenceId: t.referenceId,
        description: t.description,
        createdAt: t.createdAt,
      })),
      providerBalances,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load wallet data" },
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
    const parsed = depositSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, walletBalance: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const currentBal = user.walletBalance ?? 0;
    const newBal = Number((currentBal + parsed.amount).toFixed(2));

    const [updatedUser, transaction] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { walletBalance: newBal },
        select: { id: true, walletBalance: true },
      }),
      prisma.walletTransaction.create({
        data: {
          userId: user.id,
          type: "CREDIT",
          amount: parsed.amount,
          balanceAfter: newBal,
          referenceId: `DEP-${Date.now()}`,
          description: parsed.description || "Manual Wallet Funds Recharge",
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      balance: updatedUser.walletBalance,
      transaction,
      message: `Successfully added ₹${parsed.amount.toFixed(2)} to your wallet!`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to add funds" },
      { status: 400 }
    );
  }
}

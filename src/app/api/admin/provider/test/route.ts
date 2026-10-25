import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { getActiveProvider } from "@/lib/provider/adapter";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { adapter, config } = await getActiveProvider();
    if (config.isMock) {
      throw new Error("A live provider is not configured; no real balance can be verified");
    }
    const balanceRes = await adapter.getBalance();

    // Update cached balance in provider
    await prisma.provider.updateMany({
      where: { id: config.id },
      data: {
        balance: balanceRes.balance,
        currency: balanceRes.currency,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Connection successful. Provider balance: ${balanceRes.rawBalance} ${balanceRes.currency}`,
      provider: config.name,
      isMock: config.isMock,
      balance: balanceRes.balance,
      currency: balanceRes.currency,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Provider connection test failed.",
      },
      { status: 502 }
    );
  }
}

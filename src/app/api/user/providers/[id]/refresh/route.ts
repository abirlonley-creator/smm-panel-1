import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { executeWithProviderTimeout } from "@/lib/provider/concurrent-runner";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connection = await prisma.userProviderConnection.findFirst({
      where: { id: params.id, userId: session.user.id },
    });

    if (!connection) {
      return NextResponse.json({ success: false, error: "Provider connection not found" }, { status: 404 });
    }

    const execResult = await executeWithProviderTimeout(connection, async (adapter) => {
      return await adapter.getBalance();
    });

    if (!execResult.success || !execResult.data) {
      return NextResponse.json({
        success: false,
        error: execResult.error || "Failed to fetch live balance from provider",
        cachedBalance: connection.balance,
        currency: connection.currency,
      }, { status: 502 });
    }

    const liveBalance = execResult.data.balance;
    const liveCurrency = execResult.data.currency || connection.currency;

    const updated = await prisma.userProviderConnection.update({
      where: { id: params.id },
      data: {
        balance: liveBalance,
        currency: liveCurrency,
        lastSyncAt: new Date(),
        lastError: null,
      },
    });

    return NextResponse.json({
      success: true,
      connectionId: updated.id,
      name: updated.name,
      balance: updated.balance,
      currency: updated.currency,
      lastSyncAt: updated.lastSyncAt,
      durationMs: execResult.durationMs,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to refresh provider balance" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { resolveProviderById } from "@/lib/provider/registry";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { provider, adapter } = await resolveProviderById(params.id);
    const balanceResult = await adapter.getBalance();

    // Update stored balance if successfully fetched
    if (balanceResult.balance !== null) {
      await prisma.provider.update({
        where: { id: params.id },
        data: {
          balance: balanceResult.balance,
          currency: balanceResult.currency || provider.currency,
          lastSyncAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      providerId: provider.id,
      name: provider.name,
      balance: balanceResult.balance,
      currency: balanceResult.currency || provider.currency,
      message: `Connection successful! Balance: ${balanceResult.balance ?? "N/A"} ${balanceResult.currency || provider.currency}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to connect to provider",
      },
      { status: 502 }
    );
  }
}

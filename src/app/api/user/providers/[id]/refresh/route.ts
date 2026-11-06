import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { executeWithProviderTimeout } from "@/lib/provider/concurrent-runner";
import { syncProviderServices } from "@/lib/provider/service-sync";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const connection = await prisma.userProviderConnection.findFirst({
      where: { id: params.id, userId },
    });

    if (!connection) {
      return NextResponse.json({ success: false, error: "Provider connection not found" }, { status: 404 });
    }

    const execResult = await executeWithProviderTimeout(connection, async (adapter) => {
      const balRes = await adapter.getBalance();
      let importedCount = 0;
      try {
        const syncRes = await syncProviderServices(adapter, "Provider Refresh", {
          providerId: connection.id,
          userProviderId: connection.id,
          providerEndpoint: connection.apiUrl,
          providerName: connection.name,
          userId,
        });
        importedCount = syncRes.totalServices;
      } catch (syncErr: any) {
        console.warn(`[PROVIDER_REFRESH] Catalog sync warning for ${connection.name}:`, syncErr.message);
      }
      return {
        balance: balRes.balance,
        currency: balRes.currency,
        importedCount,
      };
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
    const importedCount = execResult.data.importedCount;

    const updated = await prisma.userProviderConnection.update({
      where: { id: params.id },
      data: {
        balance: liveBalance,
        currency: liveCurrency,
        servicesCount: importedCount > 0 ? importedCount : connection.servicesCount,
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
      importedCount: updated.servicesCount,
      servicesCount: updated.servicesCount,
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

import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { getActiveProvider } from "@/lib/provider/adapter";
import { syncProviderServices } from "@/lib/provider/service-sync";

export async function POST(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { adapter, config } = await getActiveProvider(session.user.id);
    const result = await syncProviderServices(
      adapter,
      session.user.username || session.user.id
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[PROVIDER_SYNC] Error syncing catalog:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to synchronize service catalog from provider.",
      },
      { status: 500 }
    );
  }
}

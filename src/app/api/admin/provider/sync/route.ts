import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { getActiveProvider } from "@/lib/provider/adapter";
import { syncProviderServices } from "@/lib/provider/service-sync";

export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { adapter } = await getActiveProvider();
    const result = await syncProviderServices(adapter, session.label || "Admin");

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Catalog synchronization failed.",
      },
      { status: 500 }
    );
  }
}

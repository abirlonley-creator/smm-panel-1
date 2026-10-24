import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { syncProviderCatalog } from "@/lib/provider/registry";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncProviderCatalog(params.id);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to sync provider catalog",
      },
      { status: 500 }
    );
  }
}

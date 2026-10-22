import { NextResponse } from "next/server";
import { listComboExecutions } from "@/lib/combos/combo-service";
import { getAuthSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "30", 10);
    const isAdmin = session.role === "ADMIN";
    const executions = await listComboExecutions(limit, isAdmin ? undefined : session.user.id, isAdmin);
    return NextResponse.json({ success: true, executions });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}

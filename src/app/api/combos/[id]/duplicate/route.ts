import { NextResponse } from "next/server";
import { duplicateCombo } from "@/lib/combos/combo-service";
import { getComboById } from "@/lib/combos/combo-service";
import { getAuthSession } from "@/lib/auth/session";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    // Verify the source combo exists and belongs to this user
    const source = await getComboById(params.id);
    if (!source) {
      return NextResponse.json({ success: false, error: "Combo not found" }, { status: 404 });
    }
    if (session.role !== "ADMIN" && source.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: "Combo not found" }, { status: 404 });
    }

    const duplicated = await duplicateCombo(params.id, session.user.id);
    return NextResponse.json({ success: true, combo: duplicated }, { status: 201 });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 400 });
  }
}

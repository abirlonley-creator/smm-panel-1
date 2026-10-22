import { NextResponse } from "next/server";
import { retryFailedComboChildOrders } from "@/lib/combos/combo-service";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    // Verify the execution belongs to this user (or user is admin)
    const execution = await prisma.comboExecution.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true },
    });

    if (!execution) {
      return NextResponse.json({ success: false, error: "Execution not found." }, { status: 404 });
    }

    if (session.role !== "ADMIN" && execution.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: "Execution not found." }, { status: 404 });
    }

    const result = await retryFailedComboChildOrders(params.id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { createCombo, listCombos } from "@/lib/combos/combo-service";
import { getAuthSession } from "@/lib/auth/session";
import { z } from "zod";

const createComboSchema = z.object({
  name: z.string().min(1, "Combo name is required"),
  description: z.string().optional(),
  items: z
    .array(
      z.object({
        serviceId: z.string().min(1, "Service ID is required"),
        defaultQuantity: z.number().int().positive("Quantity must be positive"),
        targetType: z.enum(["SAME_URL", "CUSTOM_URL"]).optional().default("SAME_URL"),
        customUrl: z.string().optional(),
        orderIndex: z.number().int().optional(),
      })
    )
    .min(2, "A combo must contain at least 2 services")
    .max(5, "A combo can contain at most 5 services"),
});

export async function GET(request: Request) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";
    const isAdmin = session.role === "ADMIN";
    const combos = await listCombos(activeOnly, isAdmin ? undefined : session.user.id, isAdmin);
    return NextResponse.json({ success: true, combos });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createComboSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      );
    }

    const combo = await createCombo({ ...parsed.data, userId: session.user.id });
    return NextResponse.json({ success: true, combo }, { status: 201 });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 400 });
  }
}

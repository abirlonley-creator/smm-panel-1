import { NextResponse } from "next/server";
import { getComboById, updateCombo, deleteCombo } from "@/lib/combos/combo-service";
import { getAuthSession } from "@/lib/auth/session";
import { z } from "zod";

const updateComboSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
  items: z
    .array(
      z.object({
        serviceId: z.string().min(1),
        defaultQuantity: z.number().int().positive(),
        targetType: z.enum(["SAME_URL", "CUSTOM_URL"]).optional(),
        customUrl: z.string().optional(),
        orderIndex: z.number().int().optional(),
      })
    )
    .min(2)
    .max(5)
    .optional(),
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const combo = await getComboById(params.id);
    if (!combo) {
      return NextResponse.json({ success: false, error: "Combo not found" }, { status: 404 });
    }

    // Ownership check: non-admins can only view their own combos
    if (session.role !== "ADMIN" && combo.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: "Combo not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, combo });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const combo = await getComboById(params.id);
    if (!combo) {
      return NextResponse.json({ success: false, error: "Combo not found" }, { status: 404 });
    }
    if (session.role !== "ADMIN" && combo.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: "Combo not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateComboSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      );
    }

    const updated = await updateCombo(params.id, parsed.data);
    return NextResponse.json({ success: true, combo: updated });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const combo = await getComboById(params.id);
    if (!combo) {
      return NextResponse.json({ success: false, error: "Combo not found" }, { status: 404 });
    }
    if (session.role !== "ADMIN" && combo.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: "Combo not found" }, { status: 404 });
    }

    const res = await deleteCombo(params.id);
    return NextResponse.json(res);
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 400 });
  }
}

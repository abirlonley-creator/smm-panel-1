import { NextResponse } from "next/server";
import { submitBulkOrders } from "@/lib/orders/bulk-service";
import { getAuthSession } from "@/lib/auth/session";
import { z } from "zod";

const submitBulkSchema = z.object({
  serviceId: z.string().min(1, "Service ID is required"),
  rows: z
    .array(
      z.object({
        rawUrl: z.string().min(1),
        normalizedUrl: z.string().optional(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1, "At least one order row is required"),
  idempotencyToken: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json(
        { success: false, error: "Authentication required to submit bulk orders." },
        { status: 401 }
      );
    }
    const userId = session.user.id;

    const body = await request.json();
    const parsed = submitBulkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      );
    }

    const result = await submitBulkOrders({
      serviceId: parsed.data.serviceId,
      rows: parsed.data.rows,
      idempotencyToken: parsed.data.idempotencyToken,
      userId,
    });

    const status = result.success ? 200 : result.successOrders > 0 ? 207 : 422;

    return NextResponse.json(result, { status });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { executeCombo } from "@/lib/combos/combo-service";
import { getAuthSession } from "@/lib/auth/session";
import { z } from "zod";

const executeComboSchema = z
  .object({
    comboId: z.string().min(1, "Combo ID is required"),
    targetUrl: z.string().url("A valid target URL is required").optional(),
    targetUrls: z.array(z.string().url()).optional(),
    orderItems: z
      .array(
        z.object({
          url: z.string().url("Invalid order URL"),
          serviceId: z.string().min(1),
          quantity: z.number().int().positive(),
        })
      )
      .optional(),
    customServiceUrls: z.record(z.string(), z.string()).optional(),
    customQuantities: z.record(z.string(), z.number().int().positive()).optional(),
    idempotencyToken: z.string().optional(),
  })
  .refine(
    (data) =>
      Boolean(
        data.targetUrl ||
          (data.targetUrls && data.targetUrls.length > 0) ||
          (data.orderItems && data.orderItems.length > 0)
      ),
    { message: "At least one target URL or order item must be provided." }
  );

export async function POST(request: Request) {
  try {
    const session = await getAuthSession(request);
    const body = await request.json();
    const parsed = executeComboSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      );
    }

    const result = await executeCombo({
      comboId: parsed.data.comboId,
      targetUrl: parsed.data.targetUrl,
      targetUrls: parsed.data.targetUrls,
      orderItems: parsed.data.orderItems,
      customServiceUrls: parsed.data.customServiceUrls,
      customQuantities: parsed.data.customQuantities,
      idempotencyToken: parsed.data.idempotencyToken,
      userId: session?.user?.id,
    });

    const status = result.success ? 200 : result.successfulServices > 0 ? 207 : 422;

    return NextResponse.json(result, { status });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 400 });
  }
}

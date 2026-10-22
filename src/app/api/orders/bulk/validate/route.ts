import { NextResponse } from "next/server";
import { validateBulkOrderLinks } from "@/lib/orders/bulk-service";
import { z } from "zod";

const validateSchema = z
  .object({
    serviceId: z.string().optional(),
    comboId: z.string().optional(),
    rawText: z.string(),
    defaultQuantity: z.number().int().positive().optional(),
    perRowQuantities: z.array(z.number().int().positive()).optional(),
  })
  .refine((data) => Boolean(data.serviceId || data.comboId), {
    message: "Either serviceId or comboId is required",
  });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = validateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      );
    }

    const { serviceId, comboId, rawText, defaultQuantity, perRowQuantities } = parsed.data;

    const summary = await validateBulkOrderLinks(
      rawText,
      serviceId,
      defaultQuantity,
      perRowQuantities,
      comboId
    );

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 400 });
  }
}

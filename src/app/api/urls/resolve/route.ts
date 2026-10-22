import { NextResponse } from "next/server";
import { validateBulkOrderLinks } from "@/lib/orders/bulk-service";
import { resolveTargetUrl } from "@/lib/urls/tiktok-resolver";
import { z } from "zod";

const resolveSchema = z.object({
  url: z.string().trim().min(1, "A TikTok link is required"),
  serviceId: z.string().optional(),
  comboId: z.string().optional(),
  defaultQuantity: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resolveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      );
    }

    const { url, serviceId, comboId, defaultQuantity } = parsed.data;

    if (!serviceId && !comboId) {
      const normalized = await resolveTargetUrl(url);
      return NextResponse.json(
        { success: normalized.isValid, normalized, error: normalized.error },
        { status: normalized.isValid ? 200 : 400 }
      );
    }

    const summary = await validateBulkOrderLinks(
      url,
      serviceId,
      defaultQuantity,
      undefined,
      comboId
    );

    return NextResponse.json({
      success: true,
      normalized: summary.rows[0] || null,
      summary,
      rows: summary.rows,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 400 });
  }
}

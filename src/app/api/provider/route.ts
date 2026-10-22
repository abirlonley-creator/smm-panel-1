import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { getUserProviderConfig, saveUserProviderConfig } from "@/lib/provider/user-provider";
import { z } from "zod";

const updateProviderSchema = z.object({
  name: z.string().min(1).optional().default("My SMM Provider"),
  apiUrl: z.string().url("Must be a valid API URL"),
  apiKey: z.string().optional(),
  isMock: z.boolean().default(false),
  active: z.boolean().default(true),
});

export async function GET(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await getUserProviderConfig(session.user.id);
    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load provider configuration" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateProviderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const updated = await saveUserProviderConfig(session.user.id, parsed.data);

    return NextResponse.json({
      success: true,
      message: "Provider configuration saved successfully.",
      config: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update provider configuration" },
      { status: 500 }
    );
  }
}

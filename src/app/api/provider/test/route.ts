import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { testProviderConnection } from "@/lib/provider/user-provider";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const testSchema = z.object({
  apiUrl: z.string().url("Must be a valid API URL"),
  apiKey: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = testSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    let apiKey = parsed.data.apiKey?.trim();
    if (!apiKey) {
      // Use existing key stored for this user
      const existing = await prisma.userProviderConfig.findUnique({
        where: { userId: session.user.id },
      });
      apiKey = existing?.apiKey || "";
    }

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "API Key is required to test the connection." },
        { status: 400 }
      );
    }

    const testResult = await testProviderConnection(parsed.data.apiUrl, apiKey);

    return NextResponse.json(testResult);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to test provider connection" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { validateProviderEndpointUrl } from "@/lib/security/ssrf";
import { StandardSMMv2Provider, MockSMMProvider } from "@/lib/provider/adapter";
import { z } from "zod";

export const dynamic = "force-dynamic";

const testSchema = z.object({
  apiUrl: z.string().url("Must be a valid API URL"),
  apiKey: z.string().min(1, "API Key is required"),
  currency: z.string().default("USD"),
  isMock: z.boolean().default(false),
});

export async function POST(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = testSchema.parse(body);

    if (!parsed.isMock) {
      const ssrf = validateProviderEndpointUrl(parsed.apiUrl);
      if (!ssrf.valid) {
        return NextResponse.json({ success: false, error: `Invalid API URL: ${ssrf.error}` }, { status: 400 });
      }
    }

    const adapter = parsed.isMock
      ? new MockSMMProvider()
      : new StandardSMMv2Provider(parsed.apiUrl.trim(), parsed.apiKey.trim());

    const balRes = await adapter.getBalance();
    if (typeof balRes.balance !== "number") {
      return NextResponse.json({
        success: false,
        error: "Provider responded, but no valid balance was returned. Please verify credentials.",
      }, { status: 400 });
    }

    let servicesCount = 0;
    try {
      const s = await adapter.getServices();
      servicesCount = s.length;
    } catch {
      // Balance verified
    }

    return NextResponse.json({
      success: true,
      balance: balRes.balance,
      currency: balRes.currency || parsed.currency.toUpperCase(),
      servicesCount,
      message: `Connection verified! Balance: ${balRes.balance} ${balRes.currency || parsed.currency.toUpperCase()}`,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || "Failed to connect to provider API",
    }, { status: 400 });
  }
}

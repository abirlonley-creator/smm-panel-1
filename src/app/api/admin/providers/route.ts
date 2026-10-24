import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { encryptApiKey, maskApiKey } from "@/lib/security/crypto";
import { validateProviderEndpointUrl } from "@/lib/security/ssrf";
import { z } from "zod";

const createProviderSchema = z.object({
  name: z.string().min(1, "Name is required"),
  apiUrl: z.string().url("Must be a valid API URL"),
  apiKey: z.string().optional().nullable(),
  isMock: z.boolean().default(false),
  active: z.boolean().default(true),
  currency: z.string().default("USD"),
});

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const providers = await prisma.provider.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: { services: true, orders: true },
        },
      },
    });

    const sanitized = providers.map((p) => ({
      id: p.id,
      name: p.name,
      apiUrl: p.apiUrl,
      maskedKey: maskApiKey(p.apiKeyEncrypted),
      hasApiKey: Boolean(p.apiKeyEncrypted),
      isMock: p.isMock,
      active: p.active,
      currency: p.currency,
      balance: p.balance,
      lastSyncAt: p.lastSyncAt,
      serviceCount: p._count.services,
      orderCount: p._count.orders,
      createdAt: p.createdAt,
    }));

    return NextResponse.json({ success: true, providers: sanitized });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load providers" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createProviderSchema.parse(body);

    // SSRF Check unless mock
    if (!parsed.isMock) {
      const ssrfCheck = validateProviderEndpointUrl(parsed.apiUrl);
      if (!ssrfCheck.valid) {
        return NextResponse.json(
          { success: false, error: `Invalid API URL: ${ssrfCheck.error}` },
          { status: 400 }
        );
      }
    }

    const provider = await prisma.provider.create({
      data: {
        name: parsed.name.trim(),
        apiUrl: parsed.apiUrl.trim(),
        apiKeyEncrypted: parsed.apiKey ? encryptApiKey(parsed.apiKey.trim()) : null,
        isMock: parsed.isMock,
        active: parsed.active,
        currency: parsed.currency.trim().toUpperCase(),
      },
    });

    return NextResponse.json({
      success: true,
      provider: {
        id: provider.id,
        name: provider.name,
        apiUrl: provider.apiUrl,
        maskedKey: maskApiKey(provider.apiKeyEncrypted),
        isMock: provider.isMock,
        active: provider.active,
        currency: provider.currency,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create provider" },
      { status: 400 }
    );
  }
}

import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { encryptApiKey, maskApiKey } from "@/lib/security/crypto";
import { validateProviderEndpointUrl } from "@/lib/security/ssrf";
import { StandardSMMv2Provider, MockSMMProvider } from "@/lib/provider/adapter";
import { syncProviderServices } from "@/lib/provider/service-sync";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createConnectionSchema = z.object({
  name: z.string().min(1, "Provider name is required"),
  apiUrl: z.string().url("Must be a valid API URL"),
  apiKey: z.string().min(1, "API Key is required"),
  currency: z.string().default("USD"),
  isMock: z.boolean().default(false),
});

export async function GET(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connections = await prisma.userProviderConnection.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: { services: true },
        },
      },
    });

    const sanitized = connections.map((c) => ({
      id: c.id,
      name: c.name,
      apiUrl: c.apiUrl,
      maskedKey: maskApiKey(c.apiKeyEncrypted),
      currency: c.currency,
      balance: c.balance,
      servicesCount: c._count.services || c.servicesCount || 0,
      lastSyncAt: c.lastSyncAt,
      lastError: c.lastError,
      active: c.active,
      isMock: c.isMock,
      createdAt: c.createdAt,
    }));

    return NextResponse.json({ success: true, connections: sanitized });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load provider connections" },
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
    const parsed = createConnectionSchema.parse(body);

    if (!parsed.isMock) {
      const ssrf = validateProviderEndpointUrl(parsed.apiUrl);
      if (!ssrf.valid) {
        return NextResponse.json({ success: false, error: `Invalid API URL: ${ssrf.error}` }, { status: 400 });
      }
    }

    // Check if name is already used for this user
    const existing = await prisma.userProviderConnection.findUnique({
      where: {
        userId_name: {
          userId: session.user.id,
          name: parsed.name.trim(),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `You already have a provider connection named "${parsed.name.trim()}". Please use a unique name.` },
        { status: 409 }
      );
    }

    // Test connection action=balance. SAVE ONLY IF THE TEST PASSES! (Change 10 requirement)
    let initialBalance: number | null = null;
    let initialCurrency = parsed.currency.toUpperCase();
    const adapter = parsed.isMock
      ? new MockSMMProvider()
      : new StandardSMMv2Provider(parsed.apiUrl.trim(), parsed.apiKey.trim());

    try {
      const balRes = await adapter.getBalance();
      if (typeof balRes.balance === "number") {
        initialBalance = balRes.balance;
        if (balRes.currency) initialCurrency = balRes.currency;
      } else {
        throw new Error("Provider did not return a valid balance");
      }
    } catch (testErr: any) {
      return NextResponse.json(
        {
          success: false,
          error: `Connection test failed: ${testErr.message || "Unable to retrieve balance"}. Provider was not saved.`,
        },
        { status: 400 }
      );
    }

    // Encrypt API key with AES-256-GCM before saving
    const encryptedKey = encryptApiKey(parsed.apiKey.trim());

    const connection = await prisma.userProviderConnection.create({
      data: {
        userId: session.user.id,
        name: parsed.name.trim(),
        apiUrl: parsed.apiUrl.trim(),
        apiKeyEncrypted: encryptedKey,
        currency: initialCurrency,
        balance: initialBalance,
        lastSyncAt: new Date(),
        lastError: null,
        isMock: parsed.isMock,
        active: true,
      },
    });

    // Also set as activeProviderId if user has none
    const pref = await prisma.userPreference.findUnique({
      where: { userId: session.user.id },
    });
    if (!pref || !pref.activeProviderId) {
      await prisma.userPreference.upsert({
        where: { userId: session.user.id },
        create: {
          userId: session.user.id,
          activeProviderId: connection.id,
        },
        update: {
          activeProviderId: connection.id,
        },
      });
    }

    // Instant background service import: upsert into catalog keyed by (provider_id, provider_service_id)
    let importedCount = 0;
    try {
      const syncRes = await syncProviderServices(adapter, "Provider Connect", {
        providerId: connection.id,
        userProviderId: connection.id,
        providerEndpoint: connection.apiUrl,
        providerName: connection.name,
        userId: session.user.id,
      });
      importedCount = syncRes.totalServices;
    } catch (syncErr: any) {
      console.warn(`[USER_PROVIDER] Background service import warning for ${connection.name}:`, syncErr.message);
    }

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        name: connection.name,
        apiUrl: connection.apiUrl,
        maskedKey: maskApiKey(connection.apiKeyEncrypted),
        currency: connection.currency,
        balance: connection.balance,
        servicesCount: importedCount,
        lastSyncAt: connection.lastSyncAt,
        lastError: null,
        active: connection.active,
      },
      servicesCount: importedCount,
      message: `Connected successfully! Balance: ${initialBalance} ${initialCurrency}. Importing services... ${importedCount} found.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to add provider connection" },
      { status: 400 }
    );
  }
}

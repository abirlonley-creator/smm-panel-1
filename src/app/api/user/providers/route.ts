import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { encryptApiKey, maskApiKey } from "@/lib/security/crypto";
import { validateProviderEndpointUrl } from "@/lib/security/ssrf";
import { getAdapterForUserConnection } from "@/lib/provider/concurrent-runner";
import { z } from "zod";

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
    });

    const sanitized = connections.map((c) => ({
      id: c.id,
      name: c.name,
      apiUrl: c.apiUrl,
      maskedKey: maskApiKey(c.apiKeyEncrypted),
      currency: c.currency,
      balance: c.balance,
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

    const encryptedKey = encryptApiKey(parsed.apiKey.trim());

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

    // Attempt initial balance check
    let initialBalance: number | null = null;
    let initialCurrency = parsed.currency.toUpperCase();
    let initialError: string | null = null;

    try {
      const tempConn = {
        id: "temp",
        userId: session.user.id,
        name: parsed.name.trim(),
        apiUrl: parsed.apiUrl.trim(),
        apiKeyEncrypted: encryptedKey,
        isMock: parsed.isMock,
        active: true,
        balance: null,
        currency: initialCurrency,
        lastSyncAt: null,
        lastError: null,
      };
      const adapter = getAdapterForUserConnection(tempConn);
      const balRes = await adapter.getBalance();
      initialBalance = balRes.balance;
      if (balRes.currency) initialCurrency = balRes.currency;
    } catch (testErr: any) {
      initialError = testErr.message || "Could not retrieve balance on initial connection";
      console.warn(`[USER_PROVIDER] Initial connection warning for ${parsed.name}:`, initialError);
    }

    const connection = await prisma.userProviderConnection.create({
      data: {
        userId: session.user.id,
        name: parsed.name.trim(),
        apiUrl: parsed.apiUrl.trim(),
        apiKeyEncrypted: encryptedKey,
        currency: initialCurrency,
        balance: initialBalance,
        lastSyncAt: initialBalance !== null ? new Date() : null,
        lastError: initialError,
        isMock: parsed.isMock,
        active: true,
      },
    });

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        name: connection.name,
        apiUrl: connection.apiUrl,
        maskedKey: maskApiKey(connection.apiKeyEncrypted),
        currency: connection.currency,
        balance: connection.balance,
        lastSyncAt: connection.lastSyncAt,
        lastError: connection.lastError,
        active: connection.active,
      },
      message: initialError
        ? `Connected with warning: ${initialError}`
        : `Connected successfully! Balance: ${initialBalance ?? "N/A"} ${initialCurrency}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to add provider connection" },
      { status: 400 }
    );
  }
}

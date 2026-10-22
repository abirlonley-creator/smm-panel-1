import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getActiveProvider } from "@/lib/provider/adapter";
import { getProviderBalanceRefreshIntervalMs } from "@/lib/provider/balance";
import { z } from "zod";

const updateProviderSchema = z.object({
  name: z.string().min(1),
  apiUrl: z.string().url("Must be a valid API URL"),
  apiKey: z.string().optional(), // If empty, keeps existing
  isMock: z.boolean(),
  active: z.boolean(),
});

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    let config = await prisma.providerConfig.findFirst({
      where: { active: true },
    });

    if (!config) {
      config = await prisma.providerConfig.create({
        data: {
          name: "Standard SMM Mock Adapter",
          apiUrl: "https://mock-provider.smm.internal/v2",
          isMock: true,
          active: true,
          balance: null,
          lastSyncAt: null,
        },
      });
    }

    const balanceRefreshIntervalMs = getProviderBalanceRefreshIntervalMs(
      process.env.PROVIDER_BALANCE_REFRESH_INTERVAL_MS
    );
    const balanceAgeMs = config.lastSyncAt ? Date.now() - config.lastSyncAt.getTime() : null;
    const balanceIsStale =
      config.isMock ||
      config.balance === null ||
      balanceAgeMs === null ||
      balanceAgeMs < 0 ||
      balanceAgeMs >= balanceRefreshIntervalMs;

    return NextResponse.json({
      success: true,
      config: {
        id: config.id,
        name: config.name,
        apiUrl: config.apiUrl,
        hasApiKey: Boolean(config.apiKey),
        maskedKey: config.apiKey ? `${config.apiKey.slice(0, 4)}••••••••${config.apiKey.slice(-4)}` : "None configured (Mock Mode)",
        isMock: config.isMock,
        active: config.active,
        balance: config.balance,
        currency: config.currency,
        lastSyncAt: config.lastSyncAt,
        balanceIsStale,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load provider configuration" },
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
    const parsed = updateProviderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const { name, apiUrl, apiKey, isMock, active } = parsed.data;

    let config = await prisma.providerConfig.findFirst();
    const incomingApiKey = apiKey?.trim();
    const providerIdentityChanged =
      !config ||
      config.apiUrl !== apiUrl ||
      config.isMock !== isMock ||
      Boolean(incomingApiKey && incomingApiKey !== config.apiKey);
    const updateData: any = {
      name,
      apiUrl,
      isMock,
      active,
    };

    if (providerIdentityChanged) {
      updateData.balance = null;
      updateData.lastSyncAt = null;
    }

    // Only update apiKey if non-empty string provided
    if (incomingApiKey) {
      updateData.apiKey = incomingApiKey;
    }

    if (config) {
      config = await prisma.providerConfig.update({
        where: { id: config.id },
        data: updateData,
      });
    } else {
      config = await prisma.providerConfig.create({
        data: updateData,
      });
    }

    // Immediately query live balance upon connecting or updating provider API
    try {
      const { adapter } = await getActiveProvider();
      const bal = await adapter.getBalance();
      config = await prisma.providerConfig.update({
        where: { id: config.id },
        data: {
          balance: bal.balance,
          currency: bal.currency,
          lastSyncAt: new Date(),
        },
      });
    } catch (balErr: unknown) {
      console.warn("[ADMIN] Could not fetch balance immediately upon provider update:", balErr);
    }

    await prisma.auditLog.create({
      data: {
        action: "UPDATE_PROVIDER_CONFIG",
        actor: session.label || "Admin",
        details: `Updated provider config: isMock=${isMock}, apiUrl=${apiUrl}, liveBalance=${config.balance}`,
      },
    });

    const refreshIntervalMs = getProviderBalanceRefreshIntervalMs(
      process.env.PROVIDER_BALANCE_REFRESH_INTERVAL_MS
    );
    const balanceAgeMs = config.lastSyncAt ? Date.now() - config.lastSyncAt.getTime() : null;
    const balanceIsStale =
      config.isMock ||
      config.balance === null ||
      balanceAgeMs === null ||
      balanceAgeMs < 0 ||
      balanceAgeMs >= refreshIntervalMs;

    return NextResponse.json({
      success: true,
      message: "Provider configuration saved successfully.",
      config: {
        id: config.id,
        name: config.name,
        apiUrl: config.apiUrl,
        isMock: config.isMock,
        hasApiKey: Boolean(config.apiKey),
        balance: config.balance,
        currency: config.currency,
        lastSyncAt: config.lastSyncAt,
        balanceIsStale,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update provider configuration" },
      { status: 500 }
    );
  }
}

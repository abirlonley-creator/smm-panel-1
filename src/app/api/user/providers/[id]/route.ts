import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { encryptApiKey, maskApiKey, decryptApiKey } from "@/lib/security/crypto";
import { validateProviderEndpointUrl } from "@/lib/security/ssrf";
import { StandardSMMv2Provider, MockSMMProvider } from "@/lib/provider/adapter";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateConnectionSchema = z.object({
  name: z.string().min(1).optional(),
  apiUrl: z.string().url("Must be a valid API URL").optional(),
  apiKey: z.string().optional(),
  currency: z.string().optional(),
  active: z.boolean().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connection = await prisma.userProviderConnection.findFirst({
      where: { id: params.id, userId: session.user.id },
      include: {
        _count: {
          select: { services: true },
        },
      },
    });

    if (!connection) {
      return NextResponse.json({ success: false, error: "Provider not found" }, { status: 404 });
    }

    // Check unsent scheduled runs
    const [unsentRuns, unsentSteps] = await Promise.all([
      prisma.engagementRun.count({
        where: {
          providerId: connection.id,
          status: { in: ["scheduled", "sending"] },
        },
      }),
      prisma.scheduledDeliveryStep.count({
        where: {
          order: { providerId: connection.id },
          status: { in: ["PENDING", "PROCESSING"] },
        },
      }),
    ]);

    const unsentCount = unsentRuns + unsentSteps;

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        name: connection.name,
        apiUrl: connection.apiUrl,
        maskedKey: maskApiKey(connection.apiKeyEncrypted),
        currency: connection.currency,
        balance: connection.balance,
        servicesCount: connection._count.services,
        lastSyncAt: connection.lastSyncAt,
        lastError: connection.lastError,
        active: connection.active,
      },
      unsentCount,
      warning:
        unsentCount > 0
          ? `${unsentCount} batches are still scheduled. Wait for them to finish or cancel them (undelivered amount is refunded).`
          : null,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";

    const connection = await prisma.userProviderConnection.findFirst({
      where: { id: params.id, userId: session.user.id },
    });

    if (!connection) {
      return NextResponse.json({ success: false, error: "Provider connection not found" }, { status: 404 });
    }

    // Check for unsent scheduled runs
    const [unsentRuns, unsentSteps] = await Promise.all([
      prisma.engagementRun.count({
        where: {
          providerId: connection.id,
          status: { in: ["scheduled", "sending"] },
        },
      }),
      prisma.scheduledDeliveryStep.count({
        where: {
          order: { providerId: connection.id },
          status: { in: ["PENDING", "PROCESSING"] },
        },
      }),
    ]);

    const unsentCount = unsentRuns + unsentSteps;

    if (unsentCount > 0 && !force) {
      return NextResponse.json(
        {
          success: false,
          requiresConfirmation: true,
          unsentCount,
          warning: `${unsentCount} batches are still scheduled. Wait for them to finish or cancel them (undelivered amount is refunded).`,
        },
        { status: 400 }
      );
    }

    // After confirming:
    // 1. Delete provider's catalog services
    await prisma.service.deleteMany({
      where: {
        OR: [
          { userProviderId: connection.id },
          { providerId: connection.id },
        ],
      },
    });

    // 2. Delete favourites pointing to them
    await prisma.favourite.deleteMany({
      where: { providerId: connection.id },
    });

    // 3. Delete its engagement mappings
    await prisma.userEngagementMapping.deleteMany({
      where: { providerId: connection.id },
    });

    // 4. Keep historical orders for records (mark provider as deleted by name)
    await prisma.order.updateMany({
      where: { providerId: connection.id },
      data: {
        notes: `Provider deleted: ${connection.name}`,
        providerId: null,
      },
    });

    // 5. Update user preferences if this was active provider
    await prisma.userPreference.updateMany({
      where: { userId: session.user.id, activeProviderId: connection.id },
      data: { activeProviderId: null },
    });

    // 6. Delete provider connection
    await prisma.userProviderConnection.delete({
      where: { id: connection.id },
    });

    return NextResponse.json({
      success: true,
      message: `Disconnected provider "${connection.name}" and cleaned up catalog services and mappings. Historical orders retained.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to disconnect provider" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connection = await prisma.userProviderConnection.findFirst({
      where: { id: params.id, userId: session.user.id },
    });

    if (!connection) {
      return NextResponse.json({ success: false, error: "Provider connection not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateConnectionSchema.parse(body);

    const updateData: any = {};
    if (parsed.name) updateData.name = parsed.name.trim();
    if (parsed.currency) updateData.currency = parsed.currency.trim().toUpperCase();
    if (parsed.active !== undefined) updateData.active = parsed.active;

    if (parsed.apiUrl) {
      if (!connection.isMock) {
        const ssrf = validateProviderEndpointUrl(parsed.apiUrl);
        if (!ssrf.valid) {
          return NextResponse.json({ success: false, error: `Invalid API URL: ${ssrf.error}` }, { status: 400 });
        }
      }
      updateData.apiUrl = parsed.apiUrl.trim();
    }

    if (parsed.apiKey && parsed.apiKey.trim() !== "") {
      updateData.apiKeyEncrypted = encryptApiKey(parsed.apiKey.trim());
    }

    // Test new credentials if key or URL was updated
    if (updateData.apiUrl || updateData.apiKeyEncrypted) {
      const targetUrl = updateData.apiUrl || connection.apiUrl;
      const targetEncKey = updateData.apiKeyEncrypted || connection.apiKeyEncrypted;
      const decKey = decryptApiKey(targetEncKey);

      const adapter = connection.isMock
        ? new MockSMMProvider()
        : new StandardSMMv2Provider(targetUrl, decKey);

      try {
        const bal = await adapter.getBalance();
        if (typeof bal.balance === "number") {
          updateData.balance = bal.balance;
          if (bal.currency) updateData.currency = bal.currency;
          updateData.lastSyncAt = new Date();
          updateData.lastError = null;
        }
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          error: `Failed to verify credentials: ${err.message || "Balance check failed"}`,
        }, { status: 400 });
      }
    }

    const updated = await prisma.userProviderConnection.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      connection: {
        id: updated.id,
        name: updated.name,
        apiUrl: updated.apiUrl,
        maskedKey: maskApiKey(updated.apiKeyEncrypted),
        currency: updated.currency,
        balance: updated.balance,
        lastSyncAt: updated.lastSyncAt,
        lastError: updated.lastError,
        active: updated.active,
      },
      message: "Provider connection updated and verified successfully!",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update provider connection" },
      { status: 400 }
    );
  }
}

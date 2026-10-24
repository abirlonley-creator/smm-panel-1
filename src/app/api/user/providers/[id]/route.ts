import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { encryptApiKey, maskApiKey } from "@/lib/security/crypto";
import { validateProviderEndpointUrl } from "@/lib/security/ssrf";
import { getAdapterForUserConnection } from "@/lib/provider/concurrent-runner";
import { z } from "zod";

const updateConnectionSchema = z.object({
  name: z.string().min(1).optional(),
  apiUrl: z.string().url("Must be a valid API URL").optional(),
  apiKey: z.string().optional(),
  currency: z.string().optional(),
  active: z.boolean().optional(),
});

export async function DELETE(
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

    await prisma.userProviderConnection.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: `Disconnected provider "${connection.name}" successfully`,
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
      try {
        const temp = {
          ...connection,
          ...updateData,
        };
        const adapter = getAdapterForUserConnection(temp);
        const bal = await adapter.getBalance();
        if (bal.balance !== null) {
          updateData.balance = bal.balance;
          if (bal.currency) updateData.currency = bal.currency;
          updateData.lastSyncAt = new Date();
          updateData.lastError = null;
        }
      } catch (err: any) {
        updateData.lastError = err.message || "Failed to connect with updated credentials";
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
      message: updated.lastError
        ? `Credentials saved with warning: ${updated.lastError}`
        : "Provider connection updated and verified successfully!",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update provider connection" },
      { status: 400 }
    );
  }
}

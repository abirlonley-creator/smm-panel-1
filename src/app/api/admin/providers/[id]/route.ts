import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { encryptApiKey, maskApiKey } from "@/lib/security/crypto";
import { validateProviderEndpointUrl } from "@/lib/security/ssrf";
import { z } from "zod";

const updateProviderSchema = z.object({
  name: z.string().min(1).optional(),
  apiUrl: z.string().url("Must be a valid API URL").optional(),
  apiKey: z.string().optional().nullable(),
  isMock: z.boolean().optional(),
  active: z.boolean().optional(),
  currency: z.string().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const provider = await prisma.provider.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { services: true, orders: true },
        },
      },
    });

    if (!provider) {
      return NextResponse.json({ success: false, error: "Provider not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      provider: {
        id: provider.id,
        name: provider.name,
        apiUrl: provider.apiUrl,
        maskedKey: maskApiKey(provider.apiKeyEncrypted),
        hasApiKey: Boolean(provider.apiKeyEncrypted),
        isMock: provider.isMock,
        active: provider.active,
        currency: provider.currency,
        balance: provider.balance,
        lastSyncAt: provider.lastSyncAt,
        serviceCount: provider._count.services,
        orderCount: provider._count.orders,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch provider" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateProviderSchema.parse(body);

    const existing = await prisma.provider.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Provider not found" }, { status: 404 });
    }

    const dataToUpdate: any = {};
    if (parsed.name) dataToUpdate.name = parsed.name.trim();
    if (parsed.apiUrl) {
      if (!parsed.isMock && !existing.isMock) {
        const ssrf = validateProviderEndpointUrl(parsed.apiUrl);
        if (!ssrf.valid) {
          return NextResponse.json({ success: false, error: `Invalid API URL: ${ssrf.error}` }, { status: 400 });
        }
      }
      dataToUpdate.apiUrl = parsed.apiUrl.trim();
    }
    if (parsed.apiKey !== undefined) {
      if (parsed.apiKey && parsed.apiKey.trim() !== "") {
        dataToUpdate.apiKeyEncrypted = encryptApiKey(parsed.apiKey.trim());
      } else if (parsed.apiKey === null || parsed.apiKey === "") {
        dataToUpdate.apiKeyEncrypted = null;
      }
    }
    if (parsed.isMock !== undefined) dataToUpdate.isMock = parsed.isMock;
    if (parsed.active !== undefined) dataToUpdate.active = parsed.active;
    if (parsed.currency) dataToUpdate.currency = parsed.currency.trim().toUpperCase();

    const updated = await prisma.provider.update({
      where: { id: params.id },
      data: dataToUpdate,
    });

    return NextResponse.json({
      success: true,
      provider: {
        id: updated.id,
        name: updated.name,
        apiUrl: updated.apiUrl,
        maskedKey: maskApiKey(updated.apiKeyEncrypted),
        isMock: updated.isMock,
        active: updated.active,
        currency: updated.currency,
        balance: updated.balance,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update provider" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const existing = await prisma.provider.findUnique({
      where: { id: params.id },
      include: {
        _count: { select: { orders: true, services: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Provider not found" }, { status: 404 });
    }

    // If orders exist, soft-disable rather than hard delete to preserve referential integrity
    if (existing._count.orders > 0) {
      await prisma.provider.update({
        where: { id: params.id },
        data: { active: false },
      });
      return NextResponse.json({
        success: true,
        message: "Provider deactivated (preserved because orders reference it)",
        disabled: true,
      });
    }

    await prisma.provider.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: "Provider deleted successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete provider" },
      { status: 500 }
    );
  }
}

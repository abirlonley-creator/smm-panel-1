import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keyId = params.id;
  try {
    const existing = await prisma.userApiKey.findFirst({
      where: { id: keyId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    await prisma.userApiKey.delete({
      where: { id: keyId },
    });

    return NextResponse.json({ success: true, message: "API Key deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete API key" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keyId = params.id;
  try {
    const body = await request.json();
    const action = body.action; // "revoke" or "regenerate"

    const existing = await prisma.userApiKey.findFirst({
      where: { id: keyId, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    if (action === "revoke") {
      const updated = await prisma.userApiKey.update({
        where: { id: keyId },
        data: { status: "REVOKED" },
      });
      return NextResponse.json({
        success: true,
        message: "API Key revoked immediately",
        status: updated.status,
      });
    }

    if (action === "regenerate") {
      // 1. Mark existing key as revoked
      await prisma.userApiKey.update({
        where: { id: keyId },
        data: { status: "REVOKED" },
      });

      // 2. Generate new key with the same name and permission
      const randomHex = crypto.randomBytes(16).toString("hex");
      const plainKey = `aura_live_${randomHex}`;
      const keyHash = crypto.createHash("sha256").update(plainKey).digest("hex");
      const keyPrefix = `aura_live_${randomHex.slice(0, 4)}`;
      const keySuffix = randomHex.slice(-4);

      const newKey = await prisma.userApiKey.create({
        data: {
          userId: session.user.id,
          name: existing.name,
          keyPrefix,
          keySuffix,
          keyHash,
          permission: existing.permission,
          status: "ACTIVE",
        },
      });

      return NextResponse.json({
        success: true,
        message: "API Key regenerated. Old key revoked immediately.",
        plainKey, // RETURNED ONLY ONCE!
        key: {
          id: newKey.id,
          name: newKey.name,
          maskedKey: `${keyPrefix}...${keySuffix}`,
          permission: newKey.permission,
          status: newKey.status,
          createdAt: newKey.createdAt,
        },
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update API key" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [keys, logs] = await Promise.all([
      prisma.userApiKey.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.userApiLog.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    const formattedKeys = keys.map((k) => ({
      id: k.id,
      name: k.name,
      maskedKey: `${k.keyPrefix}...${k.keySuffix}`,
      permission: k.permission,
      status: k.status,
      lastUsedAt: k.lastUsedAt,
      totalOrders: k.totalOrders,
      totalRequests: k.totalRequests,
      createdAt: k.createdAt,
    }));

    return NextResponse.json({
      success: true,
      keys: formattedKeys,
      logs,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch keys" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = (body.name || "").trim() || "Default API Key";
    const permission = body.permission === "READ_ONLY" ? "READ_ONLY" : "FULL_ACCESS";

    // Generate plain key: aura_live_ + 32 random hex characters
    const randomHex = crypto.randomBytes(16).toString("hex");
    const plainKey = `aura_live_${randomHex}`;
    const keyHash = crypto.createHash("sha256").update(plainKey).digest("hex");

    const keyPrefix = `aura_live_${randomHex.slice(0, 4)}`;
    const keySuffix = randomHex.slice(-4);

    const newKey = await prisma.userApiKey.create({
      data: {
        userId: session.user.id,
        name,
        keyPrefix,
        keySuffix,
        keyHash,
        permission,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      success: true,
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create API key" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "Engagement";

    const services = await prisma.service.findMany({
      where: {
        category: { equals: category, mode: "insensitive" },
      },
      orderBy: [{ numericId: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({
      success: true,
      services: services.map((s) => ({
        id: s.id,
        service: s.numericId || (!isNaN(Number(s.externalId)) ? Number(s.externalId) : s.id),
        numericId: s.numericId,
        externalId: s.externalId,
        name: s.name,
        platform: s.platform,
        category: s.category,
        type: s.type,
        rate: s.ratePer1000,
        ratePer1000: s.ratePer1000,
        min: s.minQuantity,
        minQuantity: s.minQuantity,
        max: s.maxQuantity,
        maxQuantity: s.maxQuantity,
        description: s.description,
        active: s.active,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      platform = "TikTok",
      category = "Engagement",
      type = "views",
      rate = 1.0,
      min = 100,
      max = 1000000,
      description = "",
      active = true,
      serviceId,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Service name is required" }, { status: 400 });
    }

    let targetNumericId = serviceId ? Number(serviceId) : undefined;
    if (!targetNumericId || isNaN(targetNumericId)) {
      const highest = await prisma.service.findFirst({
        where: { numericId: { not: null } },
        orderBy: { numericId: "desc" },
        select: { numericId: true },
      });
      targetNumericId = highest && typeof highest.numericId === "number" ? highest.numericId + 1 : 105;
    }

    const created = await prisma.service.create({
      data: {
        numericId: targetNumericId,
        externalId: String(targetNumericId),
        name: name.trim(),
        platform: platform.trim(),
        category: category.trim(),
        type: type.trim().toLowerCase(),
        ratePer1000: Number(rate) || 1.0,
        minQuantity: Number(min) || 10,
        maxQuantity: Number(max) || 1000000,
        description: description.trim() || `${name} on ${platform}`,
        active: active !== false,
      },
    });

    return NextResponse.json({
      success: true,
      service: {
        id: created.id,
        service: created.numericId,
        numericId: created.numericId,
        name: created.name,
        platform: created.platform,
        category: created.category,
        type: created.type,
        rate: created.ratePer1000,
        min: created.minQuantity,
        max: created.maxQuantity,
        active: created.active,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

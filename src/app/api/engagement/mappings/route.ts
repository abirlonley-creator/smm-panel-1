import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { recordAdminAlert } from "@/lib/engagement/alert-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const saveMappingSchema = z.object({
  platform: z.string().min(1, "Platform is required"),
  engagementType: z.string().min(1, "Engagement type is required"),
  providerId: z.string().min(1, "Provider is required"),
  providerServiceId: z.string().min(1, "Provider Service ID is required"),
  active: z.boolean().default(true),
});

export async function GET(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform")?.trim();

  try {
    // 1. Fetch user's connected providers
    const userProviders = await prisma.userProviderConnection.findMany({
      where: { userId, active: true },
      select: { id: true, name: true, currency: true },
    });
    const validProviderIds = new Set(userProviders.map((p) => p.id));

    // 2. Fetch existing mappings for this user
    const where: any = { userId };
    if (platform) where.platform = platform;

    const mappings = await prisma.userEngagementMapping.findMany({
      where,
      include: {
        provider: { select: { id: true, name: true, active: true } },
      },
    });

    // 3. Check for disconnected / deleted providers
    const processedMappings = mappings.map((m) => {
      const isConnected = validProviderIds.has(m.providerId) && m.provider?.active !== false;
      return {
        id: m.id,
        platform: m.platform,
        engagementType: m.engagementType,
        providerId: m.providerId,
        providerName: m.provider?.name || "Deleted Provider",
        providerServiceId: m.providerServiceId,
        serviceName: m.serviceName,
        minQuantity: m.minQuantity,
        maxQuantity: m.maxQuantity,
        ratePer1000: m.ratePer1000,
        active: isConnected ? m.active : false,
        disconnected: !isConnected,
        disconnectedMessage: !isConnected
          ? `Mapped provider (${m.provider?.name || "Upstream"}) is disconnected or deleted. Service is switched off.`
          : null,
      };
    });

    // 4. Fetch available catalog services from user's connected providers
    const catalogServices = await prisma.service.findMany({
      where: {
        active: true,
        OR: [
          { userProviderId: { in: Array.from(validProviderIds) } },
          { providerId: { in: Array.from(validProviderIds) } },
        ],
        ...(platform ? { platform: { contains: platform, mode: "insensitive" } } : {}),
      },
      include: {
        userProvider: { select: { id: true, name: true } },
        provider: { select: { id: true, name: true } },
      },
      orderBy: [{ name: "asc" }],
    });

    const availableServices = catalogServices.map((s) => ({
      id: s.id,
      externalId: s.externalId,
      providerServiceId: s.providerServiceId || s.externalId,
      providerId: s.userProviderId || s.providerId,
      providerName: s.userProvider?.name || s.provider?.name || "Connected Provider",
      name: s.name,
      platform: s.platform,
      category: s.category,
      minQuantity: s.minQuantity,
      maxQuantity: s.maxQuantity,
      ratePer1000: s.ratePer1000,
    }));

    return NextResponse.json({
      success: true,
      mappings: processedMappings,
      userProviders,
      availableServices,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const body = await request.json();
    const parsed = saveMappingSchema.parse(body);

    // Verify provider belongs to user
    const connection = await prisma.userProviderConnection.findFirst({
      where: { id: parsed.providerId, userId },
    });

    if (!connection) {
      return NextResponse.json(
        { success: false, error: "Selected provider is not connected to your account" },
        { status: 400 }
      );
    }

    // Auto-read min, max, rate, and name from catalog (Change 13 requirement)
    const serviceInCatalog = await prisma.service.findFirst({
      where: {
        OR: [
          { userProviderId: parsed.providerId, providerServiceId: parsed.providerServiceId },
          { providerId: parsed.providerId, providerServiceId: parsed.providerServiceId },
          { userProviderId: parsed.providerId, externalId: parsed.providerServiceId },
          { providerId: parsed.providerId, externalId: parsed.providerServiceId },
        ],
      },
    });

    const minQuantity = serviceInCatalog?.minQuantity ?? 10;
    const maxQuantity = serviceInCatalog?.maxQuantity ?? 100000;
    const ratePer1000 = serviceInCatalog?.ratePer1000 ?? 0;
    const serviceName = serviceInCatalog?.name || `Service #${parsed.providerServiceId}`;

    const mapping = await prisma.userEngagementMapping.upsert({
      where: {
        userId_platform_engagementType: {
          userId,
          platform: parsed.platform,
          engagementType: parsed.engagementType,
        },
      },
      create: {
        userId,
        platform: parsed.platform,
        engagementType: parsed.engagementType,
        providerId: parsed.providerId,
        providerServiceId: parsed.providerServiceId,
        serviceName,
        minQuantity,
        maxQuantity,
        ratePer1000,
        active: parsed.active,
      },
      update: {
        providerId: parsed.providerId,
        providerServiceId: parsed.providerServiceId,
        serviceName,
        minQuantity,
        maxQuantity,
        ratePer1000,
        active: parsed.active,
      },
    });

    if (parsed.engagementType === "views" && minQuantity > 50) {
      recordAdminAlert({
        severity: "low",
        type: "chunky_delivery_minimum",
        userId,
        platform: parsed.platform,
        engagementType: "views",
        providerId: parsed.providerId,
        serviceId: parsed.providerServiceId,
        reason: `Mapped views service "${serviceName}" has a minimum of ${minQuantity} (> 5% of 1,000 views), which makes small orders deliver in chunky steps.`,
        suggestedAction: "Map a service with min <= 50 for smoother small-order pacing.",
      }).catch((e) => console.warn("[ADMIN-ALERT] Failed to record chunky notice:", e));
    }

    return NextResponse.json({
      success: true,
      mapping: {
        ...mapping,
        providerName: connection.name,
      },
      message: `Mapped ${parsed.engagementType} to ${connection.name} (#${parsed.providerServiceId}) with min ${minQuantity}, max ${maxQuantity}, rate ₹${ratePer1000}/1k`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

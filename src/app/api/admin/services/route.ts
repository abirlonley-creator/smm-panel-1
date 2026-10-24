import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createServiceSchema = z.object({
  providerId: z.string().min(1, "Provider is required"),
  providerServiceId: z.string().min(1, "Provider Service ID is required"),
  name: z.string().min(1, "Name is required"),
  type: z.string().default("Default"),
  platform: z.string().default("Instagram"),
  category: z.string().default("General"),
  description: z.string().default(""),
  minQuantity: z.number().int().positive(),
  maxQuantity: z.number().int().positive(),
  ratePer1000: z.number().positive(),
  refillSupported: z.boolean().default(false),
  cancelSupported: z.boolean().default(true),
  dripFeedSupported: z.boolean().default(false),
});

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const providerId = url.searchParams.get("providerId");
  const platform = url.searchParams.get("platform");
  const search = url.searchParams.get("search");
  const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get("limit") || "50", 10)));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

  try {
    const where: any = {};
    if (providerId) where.providerId = providerId;
    if (platform && platform !== "All") where.platform = platform;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { externalId: { contains: search, mode: "insensitive" } },
        { providerServiceId: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
      ];
    }

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        include: {
          provider: {
            select: { id: true, name: true, currency: true, isMock: true, active: true },
          },
        },
        orderBy: [{ providerId: "asc" }, { externalId: "asc" }],
        take: limit,
        skip: offset,
      }),
      prisma.service.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      services: services.map((s) => ({
        id: s.id,
        externalId: s.externalId,
        providerServiceId: s.providerServiceId || s.externalId,
        providerId: s.providerId,
        providerName: s.provider?.name || "Unassigned",
        providerCurrency: s.provider?.currency || "USD",
        name: s.name,
        type: s.type,
        platform: s.platform,
        category: s.category,
        description: s.description,
        minQuantity: s.minQuantity,
        maxQuantity: s.maxQuantity,
        ratePer1000: s.ratePer1000,
        refillSupported: s.refillSupported,
        cancelSupported: s.cancelSupported,
        dripFeedSupported: s.dripFeedSupported,
        active: s.active,
      })),
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch services" },
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
    const parsed = createServiceSchema.parse(body);

    const provider = await prisma.provider.findUnique({
      where: { id: parsed.providerId },
    });
    if (!provider) {
      return NextResponse.json({ success: false, error: "Selected provider not found" }, { status: 404 });
    }

    const extId = parsed.providerServiceId.trim();

    // Check composite uniqueness: (providerId, externalId)
    const existing = await prisma.service.findUnique({
      where: {
        providerId_externalId: {
          providerId: provider.id,
          externalId: extId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: `Service ${extId} already exists under provider ${provider.name}. Update the existing record instead.`,
        },
        { status: 409 }
      );
    }

    const service = await prisma.service.create({
      data: {
        providerId: provider.id,
        providerServiceId: extId,
        externalId: extId,
        name: parsed.name.trim(),
        type: parsed.type,
        platform: parsed.platform,
        category: parsed.category,
        description: parsed.description,
        minQuantity: parsed.minQuantity,
        maxQuantity: parsed.maxQuantity,
        ratePer1000: parsed.ratePer1000,
        refillSupported: parsed.refillSupported,
        cancelSupported: parsed.cancelSupported,
        dripFeedSupported: parsed.dripFeedSupported,
        providerEndpoint: provider.apiUrl,
        isMock: provider.isMock,
        active: true,
      },
      include: { provider: true },
    });

    return NextResponse.json({
      success: true,
      service: {
        id: service.id,
        providerId: service.providerId,
        providerName: service.provider?.name,
        providerServiceId: service.providerServiceId,
        externalId: service.externalId,
        name: service.name,
        ratePer1000: service.ratePer1000,
        minQuantity: service.minQuantity,
        maxQuantity: service.maxQuantity,
        platform: service.platform,
        category: service.category,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create service mapping" },
      { status: 400 }
    );
  }
}

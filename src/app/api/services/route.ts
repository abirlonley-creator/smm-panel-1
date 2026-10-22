import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform");
    const search = searchParams.get("search")?.trim();
    const serviceId = searchParams.get("serviceId")?.trim();
    const paginationRequested = searchParams.has("page") || searchParams.has("pageSize");
    const parsedPage = Number.parseInt(searchParams.get("page") || "1", 10);
    const parsedPageSize = Number.parseInt(searchParams.get("pageSize") || "15", 10);
    const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
    const pageSize = Number.isFinite(parsedPageSize)
      ? Math.min(15, Math.max(1, parsedPageSize))
      : 15;

    const where: any = { active: true };
    if (platform && platform !== "All") {
      where.platform = platform;
    }

    if (serviceId) {
      where.OR = [
        { externalId: serviceId },
        { id: serviceId },
      ];
    } else if (search) {
      where.OR = [
        { externalId: { contains: search } },
        { name: { contains: search } },
        { category: { contains: search } },
        { description: { contains: search } },
        { type: { contains: search } },
      ];
    }

    const [services, totalServices] = await Promise.all([
      prisma.service.findMany({
        where,
        orderBy: [{ externalId: "asc" }, { ratePer1000: "asc" }],
        ...(paginationRequested
          ? { skip: (page - 1) * pageSize, take: pageSize }
          : {}),
      }),
      prisma.service.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      services,
      totalServices,
      ...(paginationRequested
        ? {
            page,
            pageSize,
            totalPages: Math.ceil(totalServices / pageSize),
          }
        : {}),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch services" },
      { status: 500 }
    );
  }
}

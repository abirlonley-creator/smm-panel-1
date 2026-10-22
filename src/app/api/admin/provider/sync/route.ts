import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { getActiveProvider } from "@/lib/provider/adapter";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { adapter, config } = await getActiveProvider();
    const services = await adapter.getServices();

    let createdCount = 0;
    let updatedCount = 0;

    for (const s of services) {
      const existing = await prisma.service.findFirst({
        where: { externalId: s.id },
      });

      if (existing) {
        await prisma.service.update({
          where: { id: existing.id },
          data: {
            name: s.name,
            type: s.type || "Default",
            platform: s.platform,
            category: s.category,
            description: s.description,
            minQuantity: s.minQuantity,
            maxQuantity: s.maxQuantity,
            ratePer1000: s.ratePer1000,
            refillSupported: s.refillSupported,
            cancelSupported: s.cancelSupported,
            dripFeedSupported: s.dripFeedSupported,
            restrictions: s.restrictions || existing.restrictions,
            isMock: s.isMock,
          },
        });
        updatedCount++;
      } else {
        await prisma.service.create({
          data: {
            externalId: s.id,
            name: s.name,
            type: s.type || "Default",
            platform: s.platform,
            category: s.category,
            description: s.description,
            minQuantity: s.minQuantity,
            maxQuantity: s.maxQuantity,
            ratePer1000: s.ratePer1000,
            refillSupported: s.refillSupported,
            cancelSupported: s.cancelSupported,
            dripFeedSupported: s.dripFeedSupported,
            restrictions: s.restrictions,
            isMock: s.isMock,
            active: true,
          },
        });
        createdCount++;
      }
    }

    const catalogSyncedAt = new Date();

    await prisma.auditLog.create({
      data: {
        action: "SYNC_SERVICE_CATALOG",
        actor: session.label || "Admin",
        details: `Synchronized ${services.length} services (${createdCount} added, ${updatedCount} updated)`,
      },
    });

    return NextResponse.json({
      success: true,
      totalServices: services.length,
      createdCount,
      updatedCount,
      catalogSyncedAt: catalogSyncedAt.toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Catalog synchronization failed.",
      },
      { status: 500 }
    );
  }
}

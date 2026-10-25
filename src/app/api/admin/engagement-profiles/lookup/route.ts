import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getAdapterForProvider } from "@/lib/provider/registry";

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get("providerId")?.trim();
  const providerServiceId = searchParams.get("providerServiceId")?.trim();

  if (!providerId || !providerServiceId) {
    return NextResponse.json(
      { success: false, error: "providerId and providerServiceId are required" },
      { status: 400 }
    );
  }

  try {
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      return NextResponse.json(
        { success: false, error: `Provider ${providerId} not found` },
        { status: 404 }
      );
    }

    // 1. First check local synchronized Service table
    let localService = await prisma.service.findFirst({
      where: {
        providerId: provider.id,
        OR: [
          { externalId: providerServiceId },
          { providerServiceId: providerServiceId },
        ],
      },
    });

    // 2. If not found locally, query live provider adapter
    if (!localService) {
      try {
        const adapter = getAdapterForProvider(provider);
        const remoteServices = await adapter.getServices();
        const foundRemote = remoteServices.find(
          (s) => String(s.id) === providerServiceId || String((s as any).service) === providerServiceId
        );

        if (foundRemote) {
          return NextResponse.json({
            success: true,
            found: true,
            service: {
              providerId: provider.id,
              providerName: provider.name,
              providerServiceId,
              name: foundRemote.name,
              minQuantity: foundRemote.minQuantity,
              maxQuantity: foundRemote.maxQuantity,
              ratePer1000: foundRemote.ratePer1000,
              platform: foundRemote.platform,
              category: foundRemote.category,
            },
          });
        }
      } catch (adapterErr) {
        console.warn(`[LOOKUP] Live adapter services query failed:`, adapterErr);
      }

      return NextResponse.json({
        success: true,
        found: false,
        error: `Service ID ${providerServiceId} does not exist on provider "${provider.name}".`,
      });
    }

    return NextResponse.json({
      success: true,
      found: true,
      service: {
        providerId: provider.id,
        providerName: provider.name,
        providerServiceId,
        name: localService.name,
        minQuantity: localService.minQuantity,
        maxQuantity: localService.maxQuantity,
        ratePer1000: localService.ratePer1000,
        platform: localService.platform,
        category: localService.category,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to lookup service" },
      { status: 500 }
    );
  }
}

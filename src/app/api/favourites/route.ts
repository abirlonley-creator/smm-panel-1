import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const favouriteSchema = z.object({
  providerId: z.string().min(1, "providerId is required"),
  providerServiceId: z.string().min(1, "providerServiceId is required"),
  serviceId: z.string().optional(),
});

export async function GET(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const favourites = await prisma.favourite.findMany({
      where: { userId: session.user.id },
      include: {
        service: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const mapped = favourites.map((f) => ({
      id: f.id,
      providerId: f.providerId,
      providerServiceId: f.providerServiceId,
      serviceId: f.serviceId,
      service: f.service,
      createdAt: f.createdAt,
    }));

    return NextResponse.json({ success: true, favourites: mapped });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = favouriteSchema.parse(body);

    // Resolve serviceId if not provided
    let serviceId = parsed.serviceId;
    if (!serviceId) {
      const match = await prisma.service.findFirst({
        where: {
          OR: [
            { providerId: parsed.providerId, providerServiceId: parsed.providerServiceId },
            { userProviderId: parsed.providerId, providerServiceId: parsed.providerServiceId },
            { externalId: parsed.providerServiceId },
          ],
        },
      });
      if (match) serviceId = match.id;
    }

    const favourite = await prisma.favourite.upsert({
      where: {
        userId_providerId_providerServiceId: {
          userId: session.user.id,
          providerId: parsed.providerId,
          providerServiceId: parsed.providerServiceId,
        },
      },
      create: {
        userId: session.user.id,
        providerId: parsed.providerId,
        providerServiceId: parsed.providerServiceId,
        serviceId: serviceId || null,
      },
      update: {
        serviceId: serviceId || null,
      },
    });

    return NextResponse.json({
      success: true,
      favourite,
      message: "Added to favourites",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    let providerId = searchParams.get("providerId")?.trim();
    let providerServiceId = searchParams.get("providerServiceId")?.trim();

    if (!providerId || !providerServiceId) {
      const body = await request.json().catch(() => ({}));
      providerId = providerId || body.providerId;
      providerServiceId = providerServiceId || body.providerServiceId;
    }

    if (!providerId || !providerServiceId) {
      return NextResponse.json(
        { success: false, error: "providerId and providerServiceId are required" },
        { status: 400 }
      );
    }

    await prisma.favourite.deleteMany({
      where: {
        userId: session.user.id,
        providerId,
        providerServiceId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Removed from favourites",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

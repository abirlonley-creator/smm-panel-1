import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateServiceSchema = z.object({
  providerId: z.string().optional(),
  providerServiceId: z.string().optional(),
  name: z.string().min(1).optional(),
  ratePer1000: z.number().positive().optional(),
  minQuantity: z.number().int().positive().optional(),
  maxQuantity: z.number().int().positive().optional(),
  platform: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  refillSupported: z.boolean().optional(),
  cancelSupported: z.boolean().optional(),
  dripFeedSupported: z.boolean().optional(),
  active: z.boolean().optional(),
});

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
    const parsed = updateServiceSchema.parse(body);

    const existing = await prisma.service.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 });
    }

    const dataToUpdate: any = { ...parsed };
    if (parsed.providerServiceId) {
      dataToUpdate.providerServiceId = parsed.providerServiceId.trim();
      dataToUpdate.externalId = parsed.providerServiceId.trim();
    }

    const updated = await prisma.service.update({
      where: { id: params.id },
      data: dataToUpdate,
      include: { provider: true },
    });

    return NextResponse.json({
      success: true,
      service: {
        id: updated.id,
        name: updated.name,
        providerId: updated.providerId,
        providerName: updated.provider?.name,
        providerServiceId: updated.providerServiceId,
        externalId: updated.externalId,
        ratePer1000: updated.ratePer1000,
        minQuantity: updated.minQuantity,
        maxQuantity: updated.maxQuantity,
        active: updated.active,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update service" },
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
    const existing = await prisma.service.findUnique({
      where: { id: params.id },
      include: {
        _count: { select: { orders: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 });
    }

    if (existing._count.orders > 0) {
      await prisma.service.update({
        where: { id: params.id },
        data: { active: false },
      });
      return NextResponse.json({
        success: true,
        message: "Service deactivated (preserved because orders reference it)",
        deactivated: true,
      });
    }

    await prisma.service.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: "Service deleted successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete service" },
      { status: 500 }
    );
  }
}

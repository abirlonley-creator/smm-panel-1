import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/auth/admin-permissions";
import {
  createRateChangeApprovalRequest,
  verifyAndConsumeTelegramApproved,
} from "@/lib/security/telegram";
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
  approvalId: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const perm = await requireAdminPermission(request, "canEditRates");
  if (!perm.allowed) {
    return NextResponse.json({ success: false, error: perm.error }, { status: perm.status });
  }
  const session = perm.session;

  try {
    const body = await request.json();
    const { approvalId, ...serviceFields } = updateServiceSchema.parse(body);

    const existing = await prisma.service.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 });
    }

    // Co-admins MUST get Master Admin Telegram approval before changing service rates or settings
    if (!perm.isMaster) {
      const approved = approvalId
        ? await verifyAndConsumeTelegramApproved(approvalId, session.user?.id)
        : false;

      if (!approved) {
        const changes: string[] = [];
        const fromParts: string[] = [];
        const toParts: string[] = [];

        if (typeof serviceFields.ratePer1000 === "number" && serviceFields.ratePer1000 !== existing.ratePer1000) {
          changes.push("Rate");
          fromParts.push(`₹${existing.ratePer1000}/1k`);
          toParts.push(`₹${serviceFields.ratePer1000}/1k`);
        }
        if (typeof serviceFields.active === "boolean" && serviceFields.active !== existing.active) {
          changes.push("Status");
          fromParts.push(existing.active ? "Active" : "Disabled");
          toParts.push(serviceFields.active ? "Active" : "Disabled");
        }
        if (typeof serviceFields.name === "string" && serviceFields.name !== existing.name) {
          changes.push("Name");
          fromParts.push(existing.name);
          toParts.push(serviceFields.name);
        }

        const reqRes = await createRateChangeApprovalRequest({
          actor: session.user?.username || session.label || "co-admin",
          actorId: session.user?.id || "",
          action: `Update Service (${changes.join(", ") || "Config"})`,
          target: `${existing.name} (#${existing.numericId || existing.externalId})`,
          fromValue: fromParts.join(" | ") || `₹${existing.ratePer1000}/1k`,
          toValue: toParts.join(" | ") || `₹${serviceFields.ratePer1000 ?? existing.ratePer1000}/1k`,
          metadata: { serviceId: existing.id },
        });

        return NextResponse.json(
          {
            success: false,
            requiresApproval: true,
            approvalId: reqRes.approvalId,
            expiresAt: reqRes.expiresAt,
            message: "Telegram approval sent to Master Admin. Waiting for confirmation...",
          },
          { status: 202 }
        );
      }
    }

    const dataToUpdate: any = { ...serviceFields };
    if (serviceFields.providerServiceId) {
      dataToUpdate.providerServiceId = serviceFields.providerServiceId.trim();
      dataToUpdate.externalId = serviceFields.providerServiceId.trim();
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
  const perm = await requireAdminPermission(request, "MASTER_ONLY");
  if (!perm.allowed) {
    return NextResponse.json({ success: false, error: perm.error }, { status: perm.status });
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

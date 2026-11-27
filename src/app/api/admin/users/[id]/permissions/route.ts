import { NextResponse } from "next/server";
import {
  ADMIN_PERMISSION_KEYS,
  getAdminPermissions,
  requireAdminPermission,
} from "@/lib/auth/admin-permissions";
import { isMasterAdmin } from "@/lib/auth/master-admin";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchPermissionsSchema = z.object({
  canEditRates: z.boolean().optional(),
  canManageOrders: z.boolean().optional(),
  canViewFinancials: z.boolean().optional(),
  canManageDeposits: z.boolean().optional(),
  canManageUsers: z.boolean().optional(),
  canEditAnnouncement: z.boolean().optional(),
  canViewAlerts: z.boolean().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const perm = await requireAdminPermission(request);
  if (!perm.allowed) {
    return NextResponse.json({ success: false, error: perm.error }, { status: perm.status });
  }

  // Only master admin or the user themselves can view their permissions
  if (!perm.isMaster && perm.session.user?.id !== params.id) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Only Master Admin can inspect co-admin permissions." },
      { status: 403 }
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, username: true, role: true },
  });

  if (!targetUser) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  const result = await getAdminPermissions(params.id);
  return NextResponse.json({
    success: true,
    userId: params.id,
    username: targetUser.username,
    role: targetUser.role,
    isMaster: result.isMaster,
    permissions: result.permissions,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const perm = await requireAdminPermission(request, "MASTER_ONLY");
  if (!perm.allowed) {
    return NextResponse.json({ success: false, error: perm.error }, { status: perm.status });
  }

  try {
    const body = await request.json();
    const parsed = patchPermissionsSchema.parse(body);

    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, username: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    if (isMasterAdmin(targetUser)) {
      return NextResponse.json(
        { success: false, error: "Master Admin always has full permissions." },
        { status: 400 }
      );
    }

    const updateData: Record<string, boolean> = {};
    for (const key of ADMIN_PERMISSION_KEYS) {
      if (typeof parsed[key] === "boolean") {
        updateData[key] = parsed[key] as boolean;
      }
    }

    const updated = await prisma.adminPermission.upsert({
      where: { userId: params.id },
      update: updateData,
      create: {
        userId: params.id,
        ...updateData,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CO_ADMIN_PERMISSIONS_UPDATED",
        actor: perm.session.label || perm.session.user?.username || "admin",
        userId: params.id,
        details: JSON.stringify({
          username: targetUser.username,
          updated: updateData,
        }),
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      userId: params.id,
      permissions: {
        canEditRates: updated.canEditRates,
        canManageOrders: updated.canManageOrders,
        canViewFinancials: updated.canViewFinancials,
        canManageDeposits: updated.canManageDeposits,
        canManageUsers: updated.canManageUsers,
        canEditAnnouncement: updated.canEditAnnouncement,
        canViewAlerts: updated.canViewAlerts,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update permissions" },
      { status: 400 }
    );
  }
}

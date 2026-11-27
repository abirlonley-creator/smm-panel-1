import { prisma } from "@/lib/prisma";
import { getAdminSession, type AuthSessionResult } from "./session";
import { isMasterAdminUser } from "./master-admin";

export type AdminPermissionKey =
  | "canEditRates"
  | "canManageOrders"
  | "canViewFinancials"
  | "canManageDeposits"
  | "canManageUsers"
  | "canEditAnnouncement"
  | "canViewAlerts";

export const ADMIN_PERMISSION_KEYS: AdminPermissionKey[] = [
  "canEditRates",
  "canManageOrders",
  "canViewFinancials",
  "canManageDeposits",
  "canManageUsers",
  "canEditAnnouncement",
  "canViewAlerts",
];

export type AdminPermissionsMap = Record<AdminPermissionKey, boolean>;

export const DEFAULT_CO_ADMIN_PERMISSIONS: AdminPermissionsMap = {
  canEditRates: false,
  canManageOrders: true,
  canViewFinancials: false,
  canManageDeposits: false,
  canManageUsers: false,
  canEditAnnouncement: false,
  canViewAlerts: true,
};

export const MASTER_ADMIN_PERMISSIONS: AdminPermissionsMap = {
  canEditRates: true,
  canManageOrders: true,
  canViewFinancials: true,
  canManageDeposits: true,
  canManageUsers: true,
  canEditAnnouncement: true,
  canViewAlerts: true,
};

export async function getAdminPermissions(userId: string): Promise<{
  isMaster: boolean;
  permissions: AdminPermissionsMap;
}> {
  const isMaster = await isMasterAdminUser(userId);
  if (isMaster) {
    return {
      isMaster: true,
      permissions: { ...MASTER_ADMIN_PERMISSIONS },
    };
  }

  let record = await prisma.adminPermission.findUnique({
    where: { userId },
  });

  if (!record) {
    record = await prisma.adminPermission.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        ...DEFAULT_CO_ADMIN_PERMISSIONS,
      },
    });
  }

  return {
    isMaster: false,
    permissions: {
      canEditRates: record.canEditRates,
      canManageOrders: record.canManageOrders,
      canViewFinancials: record.canViewFinancials,
      canManageDeposits: record.canManageDeposits,
      canManageUsers: record.canManageUsers,
      canEditAnnouncement: record.canEditAnnouncement,
      canViewAlerts: record.canViewAlerts,
    },
  };
}

export async function requireAdminPermission(
  request: Request,
  permission?: AdminPermissionKey | "MASTER_ONLY"
): Promise<{
  allowed: boolean;
  status: number;
  error?: string;
  isMaster: boolean;
  session: AuthSessionResult;
  permissions?: AdminPermissionsMap;
}> {
  const session = await getAdminSession(request);
  if (!session.authenticated || !session.user) {
    return {
      allowed: false,
      status: 401,
      error: "Unauthorized",
      isMaster: false,
      session,
    };
  }

  const { isMaster, permissions } = await getAdminPermissions(session.user.id);

  if (isMaster) {
    return {
      allowed: true,
      status: 200,
      isMaster: true,
      session,
      permissions,
    };
  }

  if (permission === "MASTER_ONLY") {
    return {
      allowed: false,
      status: 403,
      error: "Forbidden: Only the Master Admin can perform this action.",
      isMaster: false,
      session,
      permissions,
    };
  }

  if (permission && !permissions[permission]) {
    return {
      allowed: false,
      status: 403,
      error: `Forbidden: Missing '${permission}' permission.`,
      isMaster: false,
      session,
      permissions,
    };
  }

  return {
    allowed: true,
    status: 200,
    isMaster: false,
    session,
    permissions,
  };
}

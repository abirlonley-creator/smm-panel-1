import { prisma } from "@/lib/prisma";

/**
 * Primary Master Admin ID (the original root admin account).
 * Only the Master Admin can configure universal API providers, use mock balance,
 * manage co-admin permissions, and approve co-admin rate changes via Telegram.
 */
export const MASTER_ADMIN_ID = "cmvj7rgpo0000jovibjyj022k";
export const MASTER_ADMIN_USERNAMES = new Set(["admin", "abir90"]);

export function getMasterAdminId(): string {
  return MASTER_ADMIN_ID;
}

/**
 * Synchronous check when you already have the user object or ID.
 */
export function isMasterAdmin(
  userOrId?: { id?: string | null; username?: string | null; role?: string | null } | string | null
): boolean {
  if (!userOrId) return false;
  if (typeof userOrId === "string") {
    return userOrId === MASTER_ADMIN_ID;
  }
  if (userOrId.id === MASTER_ADMIN_ID) return true;
  if (
    userOrId.role === "ADMIN" &&
    userOrId.username &&
    MASTER_ADMIN_USERNAMES.has(userOrId.username.toLowerCase())
  ) {
    return true;
  }
  return false;
}

/**
 * Async check by userId (uses fast ID check first, then falls back to DB username check).
 */
export async function isMasterAdminUser(userId?: string | null): Promise<boolean> {
  if (!userId) return false;
  if (userId === MASTER_ADMIN_ID) return true;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, role: true },
  });
  return isMasterAdmin(user);
}

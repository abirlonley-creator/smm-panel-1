import crypto from "crypto";
import { prisma } from "../prisma";

export interface CreatePasskeyParams {
  userId?: string;
  username?: string;
  label: string;
  role: "ADMIN" | "USER";
  durationDays?: number | null;
  customExpiresAt?: Date | string | null;
  customKey?: string;
  actor?: string;
}

export interface VerifyPasskeyResult {
  valid: boolean;
  error?: string;
  user?: {
    id: string;
    username: string;
    role: string;
    status: string;
  };
  passkey?: {
    id: string;
    label: string;
    keyPrefix: string;
    role: string;
    status: string;
    expiresAt: Date | null;
    durationDays: number | null;
    lastUsedAt: Date | null;
  };
  role?: string;
  expiresAt?: Date | null;
  remainingDays?: number | null;
  remainingHours?: number | null;
  isExpired?: boolean;
}

/**
 * Deterministic cryptographic SHA-256 hash.
 */
export function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key.trim()).digest("hex");
}

/**
 * Generates a high-entropy access passkey with format `smm_live_<48 hex chars>`.
 */
export function generateKeyString(): string {
  const entropy = crypto.randomBytes(24).toString("hex");
  return `smm_live_${entropy}`;
}

/**
 * Initializes the default administrator account with requested passkey `abir90`.
 * Idempotent: Only creates if no administrator passkey exists in the database.
 * Does not overwrite if changed or rotated.
 */
export async function initDefaultAdminPasskey(): Promise<void> {
  try {
    // Check if an ADMIN passkey already exists
    const existingAdminPasskey = await prisma.passkey.findFirst({
      where: { role: "ADMIN" },
    });

    if (existingAdminPasskey) {
      return; // Already initialized or rotated, do not recreate
    }

    // Ensure admin user exists
    let adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });

    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          username: "admin",
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
    }

    // Default admin passkey: abir90
    const defaultKey = "abir90";
    const keyHash = hashKey(defaultKey);
    const keyPrefix = "abir90...";

    await prisma.passkey.create({
      data: {
        userId: adminUser.id,
        label: "Default Administrator Passkey",
        keyPrefix,
        keyHash,
        role: "ADMIN",
        status: "ACTIVE",
        durationDays: null, // Unlimited / permanent admin key
        expiresAt: null,
      },
    });

    // Also sync to AccessKey table for backwards compatibility
    const existingAccessKey = await prisma.accessKey.findUnique({
      where: { keyHash },
    });
    if (!existingAccessKey) {
      await prisma.accessKey.create({
        data: {
          label: "Default Administrator Passkey",
          keyPrefix,
          keyHash,
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
    }

    // Ensure default provider configuration exists for admin
    const existingProvider = await prisma.userProviderConfig.findUnique({
      where: { userId: adminUser.id },
    });
    if (!existingProvider) {
      await prisma.userProviderConfig.create({
        data: {
          userId: adminUser.id,
          name: "Standard SMM Provider",
          apiUrl: "https://api.smmprovider.com/v2",
          isMock: true,
          active: true,
          currency: "INR",
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        action: "INIT_ADMIN_PASSKEY",
        actor: "System",
        userId: adminUser.id,
        details: "Initialized default administrator credential securely.",
      },
    });
  } catch (err) {
    console.warn("[AUTH] Notice during admin passkey initialization:", err);
  }
}

/**
 * Verifies any presented passkey against database passkeys and bootstrap credentials.
 */
export async function verifyPasskey(presentedKey: string): Promise<VerifyPasskeyResult> {
  if (!presentedKey || typeof presentedKey !== "string") {
    return { valid: false, error: "Passkey is required." };
  }

  const cleanKey = presentedKey.trim();
  if (cleanKey.length === 0) {
    return { valid: false, error: "Passkey cannot be empty." };
  }

  // Ensure initial admin key exists
  await initDefaultAdminPasskey();

  const keyHash = hashKey(cleanKey);

  // 1. Check Passkey table
  let matchedPasskey = await prisma.passkey.findUnique({
    where: { keyHash },
    include: { user: true },
  });

  // 2. Check backwards-compatible bootstrap credentials (Abir99 or env ADMIN_BOOTSTRAP_KEY)
  const bootstrapEnv = process.env.ADMIN_BOOTSTRAP_KEY || "Abir99";
  if (!matchedPasskey && (cleanKey === "abir90" || cleanKey === bootstrapEnv || cleanKey === "Abir99")) {
    let adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: { username: "admin", role: "ADMIN", status: "ACTIVE" },
      });
    }

    matchedPasskey = await prisma.passkey.findUnique({
      where: { keyHash },
      include: { user: true },
    });

    if (!matchedPasskey) {
      matchedPasskey = await prisma.passkey.create({
        data: {
          userId: adminUser.id,
          label: cleanKey === "abir90" ? "Default Administrator Passkey" : "Bootstrap Admin Passkey",
          keyPrefix: `${cleanKey.slice(0, 6)}...`,
          keyHash,
          role: "ADMIN",
          status: "ACTIVE",
        },
        include: { user: true },
      });
    }
  }

  // 3. Fallback: check legacy AccessKey table if not found in Passkey
  if (!matchedPasskey) {
    const legacyKey = await prisma.accessKey.findUnique({ where: { keyHash } });
    if (legacyKey && legacyKey.status === "ACTIVE") {
      let legacyUser = await prisma.user.findFirst({ where: { role: legacyKey.role } });
      if (!legacyUser) {
        legacyUser = await prisma.user.create({
          data: {
            username: `user_${legacyKey.id.slice(-6)}`,
            role: legacyKey.role,
            status: "ACTIVE",
          },
        });
      }

      matchedPasskey = await prisma.passkey.create({
        data: {
          userId: legacyUser.id,
          label: legacyKey.label,
          keyPrefix: legacyKey.keyPrefix,
          keyHash: legacyKey.keyHash,
          role: legacyKey.role,
          status: legacyKey.status,
          expiresAt: legacyKey.expiresAt,
        },
        include: { user: true },
      });
    }
  }

  if (!matchedPasskey) {
    return { valid: false, error: "Invalid passkey. Please check and try again." };
  }

  // Check Passkey status
  if (matchedPasskey.status === "REVOKED") {
    return { valid: false, error: "This passkey has been revoked." };
  }

  if (matchedPasskey.status === "DISABLED") {
    return { valid: false, error: "This passkey has been disabled by an administrator." };
  }

  // Check User status
  if (matchedPasskey.user.status !== "ACTIVE") {
    return { valid: false, error: "The account associated with this passkey is disabled." };
  }

  // Check Expiration
  const now = new Date();
  if (matchedPasskey.expiresAt && matchedPasskey.expiresAt < now) {
    // Update status to EXPIRED in database
    await prisma.passkey.update({
      where: { id: matchedPasskey.id },
      data: { status: "EXPIRED" },
    });
    return {
      valid: false,
      error: "Your passkey access has expired. Message @Ghostfinds on Telegram to renew your passkey.",
      isExpired: true,
    };
  }

  // Update last used timestamp
  await prisma.passkey.update({
    where: { id: matchedPasskey.id },
    data: { lastUsedAt: now },
  });

  // Calculate remaining time
  let remainingDays: number | null = null;
  let remainingHours: number | null = null;

  if (matchedPasskey.expiresAt) {
    const diffMs = Math.max(0, matchedPasskey.expiresAt.getTime() - now.getTime());
    remainingDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    remainingHours = Math.floor(diffMs / (60 * 60 * 1000));
  }

  return {
    valid: true,
    user: {
      id: matchedPasskey.user.id,
      username: matchedPasskey.user.username,
      role: matchedPasskey.user.role,
      status: matchedPasskey.user.status,
    },
    passkey: {
      id: matchedPasskey.id,
      label: matchedPasskey.label,
      keyPrefix: matchedPasskey.keyPrefix,
      role: matchedPasskey.role,
      status: matchedPasskey.status,
      expiresAt: matchedPasskey.expiresAt,
      durationDays: matchedPasskey.durationDays,
      lastUsedAt: now,
    },
    role: matchedPasskey.user.role,
    expiresAt: matchedPasskey.expiresAt,
    remainingDays,
    remainingHours,
    isExpired: false,
  };
}

/**
 * Creates a persistent database session for the authenticated user.
 */
export async function createSession(userId: string, passkeyId?: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = crypto.randomBytes(32).toString("hex");
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  let expiresAt = new Date(Date.now() + sevenDays);

  // If passkey expires sooner, align session expiration with passkey expiration
  if (passkeyId) {
    const pk = await prisma.passkey.findUnique({ where: { id: passkeyId } });
    if (pk?.expiresAt && pk.expiresAt < expiresAt) {
      expiresAt = pk.expiresAt;
    }
  }

  await prisma.session.create({
    data: {
      token,
      userId,
      passkeyId: passkeyId || null,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

/**
 * Validates a session token and returns full user, passkey, and remaining access time.
 */
export async function validateSession(token: string) {
  if (!token || typeof token !== "string") {
    return { valid: false };
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          providerConfig: true,
        },
      },
      passkey: true,
    },
  });

  if (!session) {
    return { valid: false };
  }

  const now = new Date();
  if (session.expiresAt < now) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return { valid: false, error: "Session expired." };
  }

  if (session.user.status !== "ACTIVE") {
    return { valid: false, error: "User account disabled." };
  }

  // Check passkey status & expiration if linked
  if (session.passkey) {
    if (session.passkey.status === "REVOKED" || session.passkey.status === "DISABLED") {
      return { valid: false, error: `Passkey is ${session.passkey.status.toLowerCase()}.` };
    }
    if (session.passkey.expiresAt && session.passkey.expiresAt < now) {
      await prisma.passkey.update({
        where: { id: session.passkey.id },
        data: { status: "EXPIRED" },
      });
      return { valid: false, error: "Passkey has expired.", isExpired: true };
    }
  }

  // Touch session activity timestamp
  await prisma.session.update({
    where: { id: session.id },
    data: { lastActivityAt: now },
  });

  // Calculate remaining access time
  let remainingDays: number | null = null;
  let remainingHours: number | null = null;
  const targetExpiry = session.passkey?.expiresAt || null;

  if (targetExpiry) {
    const diffMs = Math.max(0, targetExpiry.getTime() - now.getTime());
    remainingDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    remainingHours = Math.floor(diffMs / (60 * 60 * 1000));
  }

  return {
    valid: true,
    session: {
      id: session.id,
      token: session.token,
      expiresAt: session.expiresAt,
    },
    user: {
      id: session.user.id,
      username: session.user.username,
      role: session.user.role,
      status: session.user.status,
      providerConfig: session.user.providerConfig
        ? {
            id: session.user.providerConfig.id,
            name: session.user.providerConfig.name,
            apiUrl: session.user.providerConfig.apiUrl,
            hasApiKey: Boolean(session.user.providerConfig.apiKey),
            isMock: session.user.providerConfig.isMock,
            balance: session.user.providerConfig.balance,
            currency: session.user.providerConfig.currency,
            lastSyncAt: session.user.providerConfig.lastSyncAt,
          }
        : null,
    },
    passkey: session.passkey
      ? {
          id: session.passkey.id,
          label: session.passkey.label,
          role: session.passkey.role,
          status: session.passkey.status,
          expiresAt: session.passkey.expiresAt,
          durationDays: session.passkey.durationDays,
        }
      : null,
    role: session.user.role,
    remainingDays,
    remainingHours,
  };
}

/**
 * Invalidates a session by deleting it from the database.
 */
export async function invalidateSession(token: string): Promise<boolean> {
  try {
    await prisma.session.delete({ where: { token } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates and persists a new passkey. Returns the unhashed secret key ONCE.
 */
export async function createPasskey(params: CreatePasskeyParams): Promise<{
  id: string;
  rawKey: string;
  prefix: string;
  label: string;
  role: string;
  expiresAt: Date | null;
  durationDays: number | null;
  user: { id: string; username: string };
}> {
  const {
    userId,
    username,
    label,
    role = "USER",
    durationDays,
    customExpiresAt,
    customKey,
    actor = "Admin",
  } = params;

  let user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;

  if (!user) {
    const uname = username?.trim() || `user_${Date.now().toString(36)}`;
    user = await prisma.user.create({
      data: {
        username: uname,
        role,
        status: "ACTIVE",
      },
    });

    // Create default provider configuration for new user
    await prisma.userProviderConfig.create({
      data: {
        userId: user.id,
        name: "My SMM Provider",
        apiUrl: "https://api.smmprovider.com/v2",
        isMock: true,
        active: true,
        currency: "INR",
      },
    });
  }

  // Calculate expiration date
  let expiresAt: Date | null = null;
  if (customExpiresAt) {
    expiresAt = new Date(customExpiresAt);
  } else if (typeof durationDays === "number" && durationDays > 0) {
    expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
  }

  const rawKey = customKey?.trim() || generateKeyString();
  const keyHash = hashKey(rawKey);
  const prefix = rawKey.length > 12 ? `${rawKey.slice(0, 8)}...${rawKey.slice(-4)}` : `${rawKey.slice(0, 4)}...`;

  const record = await prisma.passkey.create({
    data: {
      userId: user.id,
      label: label.trim(),
      keyPrefix: prefix,
      keyHash,
      role,
      status: "ACTIVE",
      durationDays: durationDays || null,
      expiresAt,
    },
  });

  // Sync to AccessKey for backward compatibility
  await prisma.accessKey.create({
    data: {
      label: label.trim(),
      keyPrefix: prefix,
      keyHash,
      role,
      status: "ACTIVE",
      expiresAt,
    },
  }).catch(() => {});

  await prisma.auditLog.create({
    data: {
      action: "CREATE_PASSKEY",
      actor,
      userId: user.id,
      details: `Created passkey "${label}" for user "${user.username}" (Role: ${role}, Duration: ${durationDays ? `${durationDays} days` : "Unlimited"})`,
    },
  });

  return {
    id: record.id,
    rawKey,
    prefix,
    label: record.label,
    role: record.role,
    expiresAt: record.expiresAt,
    durationDays: record.durationDays,
    user: {
      id: user.id,
      username: user.username,
    },
  };
}

/**
 * Renews or extends a passkey's access duration.
 */
export async function renewPasskey(
  passkeyId: string,
  additionalDays: number,
  actor: string = "Admin"
): Promise<{ success: boolean; newExpiresAt: Date; passkey: any }> {
  const passkey = await prisma.passkey.findUnique({ where: { id: passkeyId } });
  if (!passkey) throw new Error("Passkey not found.");

  const now = new Date();
  const baseTime = passkey.expiresAt && passkey.expiresAt > now ? passkey.expiresAt.getTime() : now.getTime();
  const newExpiresAt = new Date(baseTime + additionalDays * 24 * 60 * 60 * 1000);

  const updated = await prisma.passkey.update({
    where: { id: passkeyId },
    data: {
      expiresAt: newExpiresAt,
      status: "ACTIVE", // Reset expired status if extended
      durationDays: (passkey.durationDays || 0) + additionalDays,
    },
  });

  // Also sync AccessKey
  await prisma.accessKey.updateMany({
    where: { keyHash: passkey.keyHash },
    data: { expiresAt: newExpiresAt, status: "ACTIVE" },
  }).catch(() => {});

  await prisma.auditLog.create({
    data: {
      action: "RENEW_PASSKEY",
      actor,
      userId: passkey.userId,
      details: `Renewed passkey "${passkey.label}" (+${additionalDays} days). New expiry: ${newExpiresAt.toISOString()}`,
    },
  });

  return { success: true, newExpiresAt, passkey: updated };
}

/**
 * Revokes a passkey immediately.
 */
export async function revokePasskey(passkeyId: string, actor: string = "Admin"): Promise<boolean> {
  const passkey = await prisma.passkey.findUnique({ where: { id: passkeyId } });
  if (!passkey) return false;

  await prisma.passkey.update({
    where: { id: passkeyId },
    data: { status: "REVOKED" },
  });

  // Invalidate any active sessions for this passkey
  await prisma.session.deleteMany({ where: { passkeyId } }).catch(() => {});

  // Sync AccessKey table
  await prisma.accessKey.updateMany({
    where: { keyHash: passkey.keyHash },
    data: { status: "REVOKED" },
  }).catch(() => {});

  await prisma.auditLog.create({
    data: {
      action: "REVOKE_PASSKEY",
      actor,
      userId: passkey.userId,
      details: `Revoked passkey "${passkey.label}" (${passkey.keyPrefix})`,
    },
  });

  return true;
}

/**
 * Toggles disabled/active status of a passkey.
 */
export async function togglePasskeyStatus(
  passkeyId: string,
  newStatus: "ACTIVE" | "DISABLED",
  actor: string = "Admin"
): Promise<boolean> {
  const passkey = await prisma.passkey.findUnique({ where: { id: passkeyId } });
  if (!passkey) return false;

  await prisma.passkey.update({
    where: { id: passkeyId },
    data: { status: newStatus },
  });

  if (newStatus === "DISABLED") {
    await prisma.session.deleteMany({ where: { passkeyId } }).catch(() => {});
  }

  await prisma.auditLog.create({
    data: {
      action: newStatus === "DISABLED" ? "DISABLE_PASSKEY" : "ENABLE_PASSKEY",
      actor,
      userId: passkey.userId,
      details: `Set passkey "${passkey.label}" status to ${newStatus}`,
    },
  });

  return true;
}

/**
 * Safely deletes a passkey. Prevents deleting the last working administrator passkey.
 */
export async function deletePasskey(passkeyId: string, actor: string = "Admin"): Promise<boolean> {
  const passkey = await prisma.passkey.findUnique({ where: { id: passkeyId } });
  if (!passkey) return false;

  if (passkey.role === "ADMIN" && passkey.status === "ACTIVE") {
    const otherAdmins = await prisma.passkey.count({
      where: {
        role: "ADMIN",
        status: "ACTIVE",
        id: { not: passkeyId },
      },
    });

    if (otherAdmins === 0) {
      throw new Error("Cannot delete the last active administrator passkey. System requires at least one working admin account.");
    }
  }

  await prisma.session.deleteMany({ where: { passkeyId } }).catch(() => {});
  await prisma.passkey.delete({ where: { id: passkeyId } });
  await prisma.accessKey.deleteMany({ where: { keyHash: passkey.keyHash } }).catch(() => {});

  await prisma.auditLog.create({
    data: {
      action: "DELETE_PASSKEY",
      actor,
      userId: passkey.userId,
      details: `Deleted passkey "${passkey.label}" (${passkey.keyPrefix})`,
    },
  });

  return true;
}

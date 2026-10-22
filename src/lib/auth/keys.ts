import {
  hashKey,
  generateKeyString,
  createPasskey,
  revokePasskey,
  verifyPasskey,
} from "./passkey-service";

export interface GeneratedKeyResult {
  fullKey: string;
  prefix: string;
  label: string;
  id: string;
}

export { hashKey, generateKeyString };

/**
 * Creates and persists a new admin access key. Returns the unhashed key ONCE.
 */
export async function createAccessKey(label: string, actor: string = "Admin"): Promise<GeneratedKeyResult> {
  const result = await createPasskey({
    label,
    role: "ADMIN",
    actor,
  });

  return {
    id: result.id,
    fullKey: result.rawKey,
    prefix: result.prefix,
    label: result.label,
  };
}

/**
 * Revokes an access key immediately
 */
export async function revokeAccessKey(id: string, actor: string = "Admin"): Promise<boolean> {
  return revokePasskey(id, actor);
}

/**
 * Verifies any presented credential:
 * 1. Default admin passkey `abir90`
 * 2. Bootstrap key `Abir99` (from env or fallback)
 * 3. Any active hashed access key or passkey in database
 */
export async function verifyAdminCredential(presentedKey: string): Promise<{
  valid: boolean;
  role?: string;
  label?: string;
}> {
  const result = await verifyPasskey(presentedKey);
  if (!result.valid) {
    return { valid: false };
  }

  return {
    valid: true,
    role: result.role,
    label: result.passkey?.label || result.user?.username || "Admin",
  };
}

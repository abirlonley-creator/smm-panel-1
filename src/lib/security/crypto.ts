import crypto from "crypto";

const MASTER_SECRET =
  process.env.ENCRYPTION_SECRET ||
  process.env.ADMIN_SESSION_SECRET ||
  "smm-aes256gcm-default-key-32bytes-hex-aura";

// Derive deterministic 32-byte key from secret
const CIPHER_KEY = crypto.createHash("sha256").update(MASTER_SECRET).digest();

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: iv:authTag:ciphertext (hex encoded)
 */
export function encryptApiKey(plaintext: string): string {
  if (!plaintext || plaintext.trim() === "") return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", CIPHER_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Supports legacy unencrypted keys gracefully.
 */
export function decryptApiKey(encryptedText?: string | null): string {
  if (!encryptedText) return "";
  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    // If not in iv:tag:ciphertext format, treat as raw plaintext key
    return encryptedText;
  }

  try {
    const [ivHex, tagHex, cipherHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", CIPHER_KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (err) {
    console.warn("[CRYPTO] Failed to decrypt API key:", err);
    return "";
  }
}

/**
 * Masks an API key for safe UI display (e.g. "sk_••••••••a1b2").
 * Never exposes the full plaintext.
 */
export function maskApiKey(key?: string | null): string {
  if (!key || key.trim() === "") return "None configured";
  const decrypted = decryptApiKey(key) || key;
  if (!decrypted || decrypted.length <= 8) return "••••••••";
  const prefix = decrypted.slice(0, 4);
  const suffix = decrypted.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

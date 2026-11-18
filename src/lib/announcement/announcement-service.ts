import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export interface AnnouncementConfig {
  enabled: boolean;
  message: string;
  badge?: string;
  link?: string;
  linkText?: string;
  speed?: "slow" | "normal" | "fast";
  allowDismiss?: boolean;
  updatedAt: string;
  updatedBy: string;
}

export const DEFAULT_ANNOUNCEMENT_CONFIG: AnnouncementConfig = {
  enabled: false,
  message:
    "⚡ System Notice: S-Curve gradual organic delivery algorithm is running optimally. 24/7 Live Telegram support is online @Ghostfinds.",
  badge: "ANNOUNCEMENT",
  link: "https://t.me/Ghostfinds",
  linkText: "24/7 Support",
  speed: "normal",
  allowDismiss: true,
  updatedAt: new Date().toISOString(),
  updatedBy: "system",
};

let memoryCache: { config: AnnouncementConfig; expiresAt: number } | null = null;
const CACHE_TTL_MS = 3000; // 3 seconds cache for responsive updates

function getFallbackFilePath(): string {
  if (process.env.NODE_ENV === "production") {
    return path.join("/tmp", "announcement-config.json");
  }
  return path.join(process.cwd(), "data", "announcement-config.json");
}

export async function getAnnouncementState(): Promise<AnnouncementConfig> {
  const now = Date.now();
  if (memoryCache && memoryCache.expiresAt > now) {
    return memoryCache.config;
  }

  try {
    const latestLog = await prisma.auditLog.findFirst({
      where: { action: "SYSTEM_ANNOUNCEMENT" },
      orderBy: { createdAt: "desc" },
    });

    if (latestLog && latestLog.details) {
      const parsed = JSON.parse(latestLog.details);
      const config: AnnouncementConfig = {
        enabled: Boolean(parsed.enabled),
        message: typeof parsed.message === "string" ? parsed.message : DEFAULT_ANNOUNCEMENT_CONFIG.message,
        badge: parsed.badge || DEFAULT_ANNOUNCEMENT_CONFIG.badge,
        link: parsed.link !== undefined ? parsed.link : DEFAULT_ANNOUNCEMENT_CONFIG.link,
        linkText: parsed.linkText !== undefined ? parsed.linkText : DEFAULT_ANNOUNCEMENT_CONFIG.linkText,
        speed: parsed.speed || DEFAULT_ANNOUNCEMENT_CONFIG.speed,
        allowDismiss: parsed.allowDismiss !== false,
        updatedAt: parsed.updatedAt || latestLog.createdAt.toISOString(),
        updatedBy: parsed.updatedBy || latestLog.actor || "admin",
      };
      memoryCache = { config, expiresAt: now + CACHE_TTL_MS };
      return config;
    }
  } catch (err) {
    console.warn("[ANNOUNCEMENT_SERVICE] Failed to read from database, checking disk fallback:", err);
  }

  // Disk fallback
  try {
    const filePath = getFallbackFilePath();
    if (fs.existsSync(filePath)) {
      const fileData = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(fileData);
      const config: AnnouncementConfig = {
        ...DEFAULT_ANNOUNCEMENT_CONFIG,
        ...parsed,
      };
      memoryCache = { config, expiresAt: now + CACHE_TTL_MS };
      return config;
    }
  } catch (err) {
    // ignore
  }

  memoryCache = { config: DEFAULT_ANNOUNCEMENT_CONFIG, expiresAt: now + CACHE_TTL_MS };
  return DEFAULT_ANNOUNCEMENT_CONFIG;
}

export async function setAnnouncementState(
  payload: Partial<AnnouncementConfig>,
  actor = "admin"
): Promise<AnnouncementConfig> {
  const current = await getAnnouncementState();
  const updated: AnnouncementConfig = {
    enabled: typeof payload.enabled === "boolean" ? payload.enabled : current.enabled,
    message: typeof payload.message === "string" ? payload.message.trim() : current.message,
    badge: typeof payload.badge === "string" ? payload.badge.trim() : (current.badge || DEFAULT_ANNOUNCEMENT_CONFIG.badge),
    link: typeof payload.link === "string" ? payload.link.trim() : current.link,
    linkText: typeof payload.linkText === "string" ? payload.linkText.trim() : current.linkText,
    speed: payload.speed || current.speed || DEFAULT_ANNOUNCEMENT_CONFIG.speed,
    allowDismiss: payload.allowDismiss !== undefined ? Boolean(payload.allowDismiss) : (current.allowDismiss !== false),
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  };

  // Write to Database
  try {
    await prisma.auditLog.create({
      data: {
        action: "SYSTEM_ANNOUNCEMENT",
        actor,
        details: JSON.stringify(updated),
      },
    });
  } catch (err) {
    console.warn("[ANNOUNCEMENT_SERVICE] Failed to record in DB auditLog:", err);
  }

  // Write to Disk Fallback
  try {
    const filePath = getFallbackFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), "utf-8");
  } catch (err) {
    console.warn("[ANNOUNCEMENT_SERVICE] Failed to write disk fallback:", err);
  }

  memoryCache = { config: updated, expiresAt: Date.now() + CACHE_TTL_MS };
  return updated;
}

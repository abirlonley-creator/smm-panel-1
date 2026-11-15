import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export interface MaintenanceConfig {
  enabled: boolean;
  title: string;
  message: string;
  supportTelegram: string;
  updatedAt: string;
  updatedBy: string;
}

export const DEFAULT_MAINTENANCE_CONFIG: MaintenanceConfig = {
  enabled: false,
  title: "Currently we're updating the website",
  message:
    "Please hold on for a moment while our team completes important platform improvements. Rest assured, all placed orders, S-Curve campaigns, and scheduled batches are continuing to deliver in the backend without any interruption.",
  supportTelegram: "Ghostfinds",
  updatedAt: new Date().toISOString(),
  updatedBy: "system",
};

let memoryCache: { config: MaintenanceConfig; expiresAt: number } | null = null;
const CACHE_TTL_MS = 4000; // 4 seconds cache for responsive updates

function getFallbackFilePath(): string {
  if (process.env.NODE_ENV === "production") {
    return path.join("/tmp", "maintenance-mode.json");
  }
  return path.join(process.cwd(), "data", "maintenance-mode.json");
}

export async function getMaintenanceState(): Promise<MaintenanceConfig> {
  const now = Date.now();
  if (memoryCache && memoryCache.expiresAt > now) {
    return memoryCache.config;
  }

  try {
    const latestLog = await prisma.auditLog.findFirst({
      where: { action: "SYSTEM_MAINTENANCE_MODE" },
      orderBy: { createdAt: "desc" },
    });

    if (latestLog && latestLog.details) {
      const parsed = JSON.parse(latestLog.details);
      const config: MaintenanceConfig = {
        enabled: Boolean(parsed.enabled),
        title: parsed.title || DEFAULT_MAINTENANCE_CONFIG.title,
        message: parsed.message || DEFAULT_MAINTENANCE_CONFIG.message,
        supportTelegram: parsed.supportTelegram || DEFAULT_MAINTENANCE_CONFIG.supportTelegram,
        updatedAt: parsed.updatedAt || latestLog.createdAt.toISOString(),
        updatedBy: parsed.updatedBy || latestLog.actor || "admin",
      };
      memoryCache = { config, expiresAt: now + CACHE_TTL_MS };
      return config;
    }
  } catch (err) {
    console.warn("[MAINTENANCE_SERVICE] Failed to read from database, checking disk fallback:", err);
  }

  // Disk fallback
  try {
    const filePath = getFallbackFilePath();
    if (fs.existsSync(filePath)) {
      const fileData = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(fileData);
      const config: MaintenanceConfig = {
        ...DEFAULT_MAINTENANCE_CONFIG,
        ...parsed,
      };
      memoryCache = { config, expiresAt: now + CACHE_TTL_MS };
      return config;
    }
  } catch (err) {
    // ignore
  }

  memoryCache = { config: DEFAULT_MAINTENANCE_CONFIG, expiresAt: now + CACHE_TTL_MS };
  return DEFAULT_MAINTENANCE_CONFIG;
}

export async function setMaintenanceState(
  enabled: boolean,
  options?: {
    title?: string;
    message?: string;
    supportTelegram?: string;
    actor?: string;
  }
): Promise<MaintenanceConfig> {
  const current = await getMaintenanceState();
  const updated: MaintenanceConfig = {
    enabled,
    title: options?.title?.trim() || current.title || DEFAULT_MAINTENANCE_CONFIG.title,
    message: options?.message?.trim() || current.message || DEFAULT_MAINTENANCE_CONFIG.message,
    supportTelegram: options?.supportTelegram?.trim() || current.supportTelegram || DEFAULT_MAINTENANCE_CONFIG.supportTelegram,
    updatedAt: new Date().toISOString(),
    updatedBy: options?.actor || "admin",
  };

  // 1. Write to AuditLog in database
  try {
    await prisma.auditLog.create({
      data: {
        action: "SYSTEM_MAINTENANCE_MODE",
        actor: updated.updatedBy,
        details: JSON.stringify(updated),
      },
    });
  } catch (err) {
    console.error("[MAINTENANCE_SERVICE] Failed to save maintenance record to database:", err);
  }

  // 2. Update memory cache
  memoryCache = { config: updated, expiresAt: Date.now() + CACHE_TTL_MS };

  // 3. Update disk fallback
  try {
    const filePath = getFallbackFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), "utf-8");
  } catch (err) {
    // ignore
  }

  return updated;
}

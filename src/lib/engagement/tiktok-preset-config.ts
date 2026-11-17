import fs from "fs";
import path from "path";
import { prisma } from "../prisma";

export interface MetricSpec {
  enabled: boolean;
  providerName: string;
  serviceId: string;
  minQuantity: number;
  maxQuantity: number;
  runsCount: number;
  intervalMinutes?: number;
  waveOffsets?: number[];
}

export interface TikTokTierPreset {
  id: string; // "tiktok_2k" | "tiktok_5k" | "tiktok_10k" | "tiktok_50k"
  name: string;
  tagline: string;
  badge: string;
  targetViews: number;
  targetLikes: number;
  targetSaves: number;
  targetShares: number;
  durationHours: number;
  totalDurationMinutes: number;
  views: MetricSpec & { intervalMinutes: number };
  likes: MetricSpec & { waveOffsets: number[] };
  saves?: MetricSpec & { waveOffsets: number[] };
  shares?: MetricSpec & { waveOffsets: number[] };
  syncThreshold: {
    minViews: number;
    maxViews: number;
  };
}

export const TIKTOK_TIER_PRESETS: Record<string, TikTokTierPreset> = {
  tiktok_2k: {
    id: "tiktok_2k",
    name: "TikTok 1st Working 2K",
    tagline: "6-Hour Algorithmic Seed Pool & Initial Watch-Time Push",
    badge: "6 Hours",
    targetViews: 2960,
    targetLikes: 42,
    targetSaves: 0,
    targetShares: 0,
    durationHours: 6.0,
    totalDurationMinutes: 360,
    views: {
      enabled: true,
      providerName: "Views Engine",
      serviceId: "897",
      minQuantity: 110,
      maxQuantity: 240,
      runsCount: 16,
      intervalMinutes: 22,
    },
    likes: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "1123",
      minQuantity: 10,
      maxQuantity: 18,
      runsCount: 3,
      waveOffsets: [35, 120, 240],
    },
    saves: {
      enabled: false,
      providerName: "Engagement Engine",
      serviceId: "807",
      minQuantity: 10,
      maxQuantity: 12,
      runsCount: 3,
      waveOffsets: [180, 240, 280],
    },
    shares: {
      enabled: false,
      providerName: "Engagement Engine",
      serviceId: "718",
      minQuantity: 5,
      maxQuantity: 10,
      runsCount: 2,
      waveOffsets: [200, 260],
    },
    syncThreshold: {
      minViews: 500,
      maxViews: 700,
    },
  },

  tiktok_5k: {
    id: "tiktok_5k",
    name: "TikTok Organic Velocity 5K",
    tagline: "Natural 24-Hour FYP Momentum with Synchronized Engagement Waves",
    badge: "24 Hours (1 Day)",
    targetViews: 5100,
    targetLikes: 180,
    targetSaves: 44,
    targetShares: 22,
    durationHours: 24.0,
    totalDurationMinutes: 1440,
    views: {
      enabled: true,
      providerName: "Views Engine",
      serviceId: "897",
      minQuantity: 140,
      maxQuantity: 320,
      runsCount: 22,
      intervalMinutes: 65,
    },
    likes: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "1123",
      minQuantity: 11,
      maxQuantity: 24,
      runsCount: 12,
      waveOffsets: [45, 120, 220, 340, 460, 580, 720, 860, 1000, 1140, 1260, 1380],
    },
    saves: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "807",
      minQuantity: 10,
      maxQuantity: 14,
      runsCount: 4,
      waveOffsets: [180, 420, 750, 1100],
    },
    shares: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "718",
      minQuantity: 10,
      maxQuantity: 12,
      runsCount: 2,
      waveOffsets: [360, 900],
    },
    syncThreshold: {
      minViews: 1000,
      maxViews: 1500,
    },
  },

  tiktok_10k: {
    id: "tiktok_10k",
    name: "TikTok FYP Breakthrough 10K",
    tagline: "2-Day Algorithmic FYP Breakout with Circadian Evening Weighting",
    badge: "2 Days (48h)",
    targetViews: 10500,
    targetLikes: 420,
    targetSaves: 90,
    targetShares: 44,
    durationHours: 48.0,
    totalDurationMinutes: 2880,
    views: {
      enabled: true,
      providerName: "Views Engine",
      serviceId: "897",
      minQuantity: 180,
      maxQuantity: 520,
      runsCount: 28,
      intervalMinutes: 102,
    },
    likes: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "1123",
      minQuantity: 12,
      maxQuantity: 28,
      runsCount: 18,
      waveOffsets: [
        90, 180, 300, 450, 600, 780, 960, 1140, 1320, 1500, 1680, 1860, 2040, 2220, 2400, 2550, 2700, 2820,
      ],
    },
    saves: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "807",
      minQuantity: 10,
      maxQuantity: 16,
      runsCount: 8,
      waveOffsets: [240, 540, 900, 1260, 1620, 1980, 2340, 2700],
    },
    shares: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "718",
      minQuantity: 10,
      maxQuantity: 14,
      runsCount: 4,
      waveOffsets: [480, 1140, 1800, 2460],
    },
    syncThreshold: {
      minViews: 2000,
      maxViews: 3000,
    },
  },

  tiktok_15k: {
    id: "tiktok_15k",
    name: "TikTok FYP Acceleration 15K",
    tagline: "3-Day Organic Algorithm Surge with Steady Anti-Radar Ascent",
    badge: "3 Days (72h)",
    targetViews: 15200,
    targetLikes: 650,
    targetSaves: 140,
    targetShares: 60,
    durationHours: 72.0,
    totalDurationMinutes: 4320,
    views: {
      enabled: true,
      providerName: "Views Engine",
      serviceId: "897",
      minQuantity: 220,
      maxQuantity: 650,
      runsCount: 34,
      intervalMinutes: 127,
    },
    likes: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "1123",
      minQuantity: 14,
      maxQuantity: 32,
      runsCount: 22,
      waveOffsets: [
        120, 240, 420, 600, 840, 1080, 1320, 1560, 1800, 2100, 2400, 2700, 3000, 3300, 3600, 3840, 4080, 4200,
      ],
    },
    saves: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "807",
      minQuantity: 11,
      maxQuantity: 18,
      runsCount: 10,
      waveOffsets: [300, 720, 1200, 1680, 2160, 2640, 3120, 3600, 4000, 4220],
    },
    shares: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "718",
      minQuantity: 10,
      maxQuantity: 14,
      runsCount: 6,
      waveOffsets: [600, 1440, 2280, 3000, 3600, 4140],
    },
    syncThreshold: {
      minViews: 3000,
      maxViews: 5000,
    },
  },

  tiktok_50k: {
    id: "tiktok_50k",
    name: "TikTok Viral Mega 50K",
    tagline: "5-Day Continuous FYP Virality Curve with Anti-Radar Long Tail",
    badge: "5 Days (Anti-Radar)",
    targetViews: 50600,
    targetLikes: 2600,
    targetSaves: 520,
    targetShares: 210,
    durationHours: 120.0,
    totalDurationMinutes: 7200,
    views: {
      enabled: true,
      providerName: "Views Engine",
      serviceId: "897",
      minQuantity: 250,
      maxQuantity: 1350,
      runsCount: 56,
      intervalMinutes: 128,
    },
    likes: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "1123",
      minQuantity: 24,
      maxQuantity: 65,
      runsCount: 38,
      waveOffsets: [
        180, 360, 600, 840, 1140, 1440, 1800, 2160, 2520, 2880, 3240, 3600, 3960, 4320, 4680, 5040, 5400, 5760, 6120, 6480, 6840, 7080,
      ],
    },
    saves: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "807",
      minQuantity: 12,
      maxQuantity: 25,
      runsCount: 20,
      waveOffsets: [
        480, 960, 1500, 2100, 2700, 3300, 3900, 4500, 5100, 5700, 6300, 6900, 7120,
      ],
    },
    shares: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "718",
      minQuantity: 10,
      maxQuantity: 18,
      runsCount: 12,
      waveOffsets: [720, 1440, 2200, 3000, 3800, 4600, 5400, 6200, 6900, 7140],
    },
    syncThreshold: {
      minViews: 5000,
      maxViews: 8000,
    },
  },
};

function getTierPresetsFilePath(): string {
  return path.join(process.cwd(), "data", "tiktok-tier-presets.json");
}

const CACHE_TTL_MS = 20000;
let cachedTierPresets: Record<string, TikTokTierPreset> | null = null;
let lastTierPresetsFetch = 0;

export async function getAllTikTokPresetsRecordAsync(force = false): Promise<Record<string, TikTokTierPreset>> {
  const now = Date.now();
  if (!force && cachedTierPresets && lastTierPresetsFetch + CACHE_TTL_MS > now) {
    return cachedTierPresets;
  }

  try {
    const log = await prisma.auditLog.findFirst({
      where: { action: "TIKTOK_TIER_PRESETS" },
      orderBy: { createdAt: "desc" },
    });

    if (log && log.details) {
      const parsed = JSON.parse(log.details);
      if (parsed && typeof parsed === "object") {
        const merged: Record<string, TikTokTierPreset> = {
          ...TIKTOK_TIER_PRESETS,
          ...parsed,
        };
        cachedTierPresets = merged;
        lastTierPresetsFetch = now;
        return merged;
      }
    }
  } catch (err) {
    console.warn("[TIKTOK_PRESETS] Failed to read tier presets from database:", err);
  }

  const fallback = getAllTikTokPresetsRecord();
  cachedTierPresets = fallback;
  lastTierPresetsFetch = now;
  return fallback;
}

export async function getAllTikTokPresetsAsync(force = false): Promise<TikTokTierPreset[]> {
  const all = await getAllTikTokPresetsRecordAsync(force);
  return Object.values(all);
}

export async function getTikTokPresetByIdAsync(presetId?: string): Promise<TikTokTierPreset> {
  const all = await getAllTikTokPresetsRecordAsync();
  if (!presetId) {
    return all.tiktok_2k || TIKTOK_TIER_PRESETS.tiktok_2k;
  }
  const clean = String(presetId).trim().toLowerCase();

  // 1. Direct ID matching: "tiktok_2k", "tiktok_5k", etc.
  if (all[clean]) return all[clean];

  // 2. Shorthand matching: "2k", "5k", "10k", "15k", "50k"
  if (all[`tiktok_${clean}`]) return all[`tiktok_${clean}`];

  // 3. Numeric ID matching:
  // 101/1 -> 2k, 102/2 -> 5k, 103/3 -> 10k, 104/4 -> 15k, or view counts (2000, 5000, 10000, 15000)
  const num = parseInt(clean, 10);
  if (!isNaN(num)) {
    if (num === 1 || num === 101 || num === 2000 || (num > 100 && num <= 3000)) {
      return all.tiktok_2k || TIKTOK_TIER_PRESETS.tiktok_2k;
    }
    if (num === 2 || num === 102 || num === 5000 || (num > 3000 && num <= 7500)) {
      return all.tiktok_5k || TIKTOK_TIER_PRESETS.tiktok_5k;
    }
    if (num === 3 || num === 103 || num === 10000 || (num > 7500 && num <= 12500)) {
      return all.tiktok_10k || TIKTOK_TIER_PRESETS.tiktok_10k;
    }
    if (num === 4 || num === 104 || num === 15000 || (num > 12500 && num <= 25000)) {
      return all.tiktok_15k || TIKTOK_TIER_PRESETS.tiktok_15k;
    }
    if (num === 5 || num === 50000 || num > 25000) {
      return all.tiktok_50k || TIKTOK_TIER_PRESETS.tiktok_50k;
    }
  }

  // 4. Try matching by name or partial text
  const found = Object.values(all).find(
    (p) =>
      p.name.toLowerCase() === clean ||
      p.id.toLowerCase() === clean ||
      p.name.toLowerCase().includes(clean)
  );
  if (found) return found;

  return all.tiktok_2k || TIKTOK_TIER_PRESETS.tiktok_2k;
}

export async function saveAllTikTokPresetsAsync(
  newPresets: Record<string, TikTokTierPreset>,
  actor: string = "admin"
): Promise<Record<string, TikTokTierPreset>> {
  cachedTierPresets = { ...newPresets };
  lastTierPresetsFetch = Date.now();

  try {
    await prisma.auditLog.create({
      data: {
        action: "TIKTOK_TIER_PRESETS",
        actor,
        details: JSON.stringify(newPresets),
      },
    });
  } catch (err) {
    console.error("[TIKTOK_PRESETS] Failed to persist tier presets to database:", err);
  }

  const filePath = getTierPresetsFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(newPresets, null, 2), "utf-8");
  } catch {}

  return cachedTierPresets;
}

export async function saveTikTokPresetAsync(
  presetId: string,
  updates: Partial<TikTokTierPreset>,
  actor: string = "admin"
): Promise<TikTokTierPreset> {
  const all = { ...(await getAllTikTokPresetsRecordAsync(true)) };
  const current = all[presetId] || TIKTOK_TIER_PRESETS[presetId] || TIKTOK_TIER_PRESETS.tiktok_2k;

  const updated: TikTokTierPreset = {
    ...current,
    ...updates,
    views: { ...current.views, ...(updates.views || {}) },
    likes: { ...current.likes, ...(updates.likes || {}) },
    saves: updates.saves !== undefined ? (updates.saves ? { ...(current.saves || { enabled: false, providerName: "Engagement Engine", serviceId: "807", minQuantity: 10, maxQuantity: 12, runsCount: 4, waveOffsets: [240, 420, 600, 750] }), ...updates.saves } : undefined) : current.saves,
    shares: updates.shares !== undefined ? (updates.shares ? { ...(current.shares || { enabled: false, providerName: "Engagement Engine", serviceId: "718", minQuantity: 10, maxQuantity: 12, runsCount: 2, waveOffsets: [360, 660] }), ...updates.shares } : undefined) : current.shares,
    syncThreshold: { ...current.syncThreshold, ...(updates.syncThreshold || {}) },
  };

  all[presetId] = updated;
  await saveAllTikTokPresetsAsync(all, actor);
  return updated;
}

export function getAllTikTokPresetsRecord(): Record<string, TikTokTierPreset> {
  if (cachedTierPresets) {
    return cachedTierPresets;
  }

  const filePath = getTierPresetsFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === "object") {
        cachedTierPresets = {
          ...TIKTOK_TIER_PRESETS,
          ...parsed,
        };
        return cachedTierPresets!;
      }
    }
  } catch (err) {
    console.warn("[TIKTOK_PRESETS] Failed to read tier presets from disk, using defaults:", err);
  }

  cachedTierPresets = { ...TIKTOK_TIER_PRESETS };
  return cachedTierPresets;
}

export function getAllTikTokPresets(): TikTokTierPreset[] {
  return Object.values(getAllTikTokPresetsRecord());
}

export function getTikTokPresetById(presetId?: string): TikTokTierPreset {
  const all = getAllTikTokPresetsRecord();
  if (!presetId) {
    return all.tiktok_2k || TIKTOK_TIER_PRESETS.tiktok_2k;
  }
  const clean = String(presetId).trim().toLowerCase();

  // 1. Direct ID matching: "tiktok_2k", "tiktok_5k", etc.
  if (all[clean]) return all[clean];

  // 2. Shorthand matching: "2k", "5k", "10k", "15k", "50k"
  if (all[`tiktok_${clean}`]) return all[`tiktok_${clean}`];

  // 3. Numeric ID matching:
  // 101/1 -> 2k, 102/2 -> 5k, 103/3 -> 10k, 104/4 -> 15k, or view counts
  const num = parseInt(clean, 10);
  if (!isNaN(num)) {
    if (num === 1 || num === 101 || num === 2000 || (num > 100 && num <= 3000)) {
      return all.tiktok_2k || TIKTOK_TIER_PRESETS.tiktok_2k;
    }
    if (num === 2 || num === 102 || num === 5000 || (num > 3000 && num <= 7500)) {
      return all.tiktok_5k || TIKTOK_TIER_PRESETS.tiktok_5k;
    }
    if (num === 3 || num === 103 || num === 10000 || (num > 7500 && num <= 12500)) {
      return all.tiktok_10k || TIKTOK_TIER_PRESETS.tiktok_10k;
    }
    if (num === 4 || num === 104 || num === 15000 || (num > 12500 && num <= 25000)) {
      return all.tiktok_15k || TIKTOK_TIER_PRESETS.tiktok_15k;
    }
    if (num === 5 || num === 50000 || num > 25000) {
      return all.tiktok_50k || TIKTOK_TIER_PRESETS.tiktok_50k;
    }
  }

  // 4. Try matching by name or partial text
  const found = Object.values(all).find(
    (p) =>
      p.name.toLowerCase() === clean ||
      p.id.toLowerCase() === clean ||
      p.name.toLowerCase().includes(clean)
  );
  if (found) return found;

  return all.tiktok_2k || TIKTOK_TIER_PRESETS.tiktok_2k;
}

export function saveTikTokPreset(presetId: string, updates: Partial<TikTokTierPreset>): TikTokTierPreset {
  const all = { ...getAllTikTokPresetsRecord() };
  const current = all[presetId] || TIKTOK_TIER_PRESETS[presetId] || TIKTOK_TIER_PRESETS.tiktok_2k;

  const updated: TikTokTierPreset = {
    ...current,
    ...updates,
    views: { ...current.views, ...(updates.views || {}) },
    likes: { ...current.likes, ...(updates.likes || {}) },
    saves: updates.saves !== undefined ? (updates.saves ? { ...(current.saves || { enabled: false, providerName: "Engagement Engine", serviceId: "807", minQuantity: 10, maxQuantity: 12, runsCount: 4, waveOffsets: [240, 420, 600, 750] }), ...updates.saves } : undefined) : current.saves,
    shares: updates.shares !== undefined ? (updates.shares ? { ...(current.shares || { enabled: false, providerName: "Engagement Engine", serviceId: "718", minQuantity: 10, maxQuantity: 12, runsCount: 2, waveOffsets: [360, 660] }), ...updates.shares } : undefined) : current.shares,
    syncThreshold: { ...current.syncThreshold, ...(updates.syncThreshold || {}) },
  };

  all[presetId] = updated;
  cachedTierPresets = all;
  lastTierPresetsFetch = Date.now();

  prisma.auditLog
    .create({
      data: {
        action: "TIKTOK_TIER_PRESETS",
        actor: "system",
        details: JSON.stringify(all),
      },
    })
    .catch((err) => console.error("[TIKTOK_PRESETS] Sync save DB error:", err));

  const filePath = getTierPresetsFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(all, null, 2), "utf-8");
  } catch (err) {
    console.error("[TIKTOK_PRESETS] Failed to write presets to disk:", err);
  }

  return updated;
}

export function saveAllTikTokPresets(newPresets: Record<string, TikTokTierPreset>): Record<string, TikTokTierPreset> {
  cachedTierPresets = { ...newPresets };
  lastTierPresetsFetch = Date.now();

  prisma.auditLog
    .create({
      data: {
        action: "TIKTOK_TIER_PRESETS",
        actor: "system",
        details: JSON.stringify(newPresets),
      },
    })
    .catch((err) => console.error("[TIKTOK_PRESETS] Sync save DB error:", err));

  const filePath = getTierPresetsFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(newPresets, null, 2), "utf-8");
  } catch (err) {
    console.error("[TIKTOK_PRESETS] Failed to write all presets to disk:", err);
  }
  return cachedTierPresets;
}

// Backwards-compatible configuration interface
export interface MetricConfigItem {
  enabled: boolean;
  providerName: string;
  serviceId: string;
  minQuantity: number;
  maxQuantity: number;
  runsCount: number;
  intervalMinutes: number;
}

export interface EngagementPricingConfig {
  viewsUserRate: number;     // Rate charged to users per 1k views (INR ₹)
  likesUserRate: number;     // Rate charged to users per 1k likes (INR ₹)
  savesUserRate: number;     // Rate charged to users per 1k saves (INR ₹)
  sharesUserRate: number;    // Rate charged to users per 1k shares/reposts (INR ₹)
  commentsUserRate: number;  // Rate charged to users per 1k comments (INR ₹)
}

export interface TikTokEngagementPresetConfig {
  enabled: boolean;
  presetName: string;
  views: MetricConfigItem;
  likes: MetricConfigItem;
  saves: MetricConfigItem;
  shares: MetricConfigItem;
  pricing: EngagementPricingConfig;
  syncThreshold: {
    minViews: number;
    maxViews: number;
  };
}

export const DEFAULT_TIKTOK_ENGAGEMENT_CONFIG: TikTokEngagementPresetConfig = {
  enabled: true,
  presetName: "TikTok 1st Working 2K",
  views: {
    enabled: true,
    providerName: "Views Engine",
    serviceId: "897",
    minQuantity: 150,
    maxQuantity: 220,
    runsCount: 16,
    intervalMinutes: 20,
  },
  likes: {
    enabled: true,
    providerName: "Engagement Engine",
    serviceId: "1123",
    minQuantity: 12,
    maxQuantity: 16,
    runsCount: 3,
    intervalMinutes: 120,
  },
  saves: {
    enabled: true,
    providerName: "Engagement Engine",
    serviceId: "807",
    minQuantity: 5,
    maxQuantity: 10,
    runsCount: 4,
    intervalMinutes: 120,
  },
  shares: {
    enabled: true,
    providerName: "Engagement Engine",
    serviceId: "718",
    minQuantity: 3,
    maxQuantity: 8,
    runsCount: 3,
    intervalMinutes: 120,
  },
  pricing: {
    viewsUserRate: 4.50,
    likesUserRate: 2.00,
    savesUserRate: 0.80,
    sharesUserRate: 0.80,
    commentsUserRate: 15.00,
  },
  syncThreshold: {
    minViews: 500,
    maxViews: 700,
  },
};

let cachedConfig: TikTokEngagementPresetConfig | null = null;
let lastConfigFetch = 0;

function getConfigPath(): string {
  return path.join(process.cwd(), "data", "tiktok-engagement-config.json");
}

export async function getTikTokEngagementConfigAsync(force = false): Promise<TikTokEngagementPresetConfig> {
  const now = Date.now();
  if (!force && cachedConfig && lastConfigFetch + CACHE_TTL_MS > now) {
    return cachedConfig;
  }

  try {
    const log = await prisma.auditLog.findFirst({
      where: { action: "ENGAGEMENT_PRICING_CONFIG" },
      orderBy: { createdAt: "desc" },
    });

    if (log && log.details) {
      const parsed = JSON.parse(log.details);
      const merged: TikTokEngagementPresetConfig = {
        ...DEFAULT_TIKTOK_ENGAGEMENT_CONFIG,
        ...parsed,
        views: { ...DEFAULT_TIKTOK_ENGAGEMENT_CONFIG.views, ...(parsed.views || {}) },
        likes: { ...DEFAULT_TIKTOK_ENGAGEMENT_CONFIG.likes, ...(parsed.likes || {}) },
        saves: { ...DEFAULT_TIKTOK_ENGAGEMENT_CONFIG.saves, ...(parsed.saves || {}) },
        shares: { ...DEFAULT_TIKTOK_ENGAGEMENT_CONFIG.shares, ...(parsed.shares || {}) },
        pricing: { ...DEFAULT_TIKTOK_ENGAGEMENT_CONFIG.pricing, ...(parsed.pricing || {}) },
        syncThreshold: { ...DEFAULT_TIKTOK_ENGAGEMENT_CONFIG.syncThreshold, ...(parsed.syncThreshold || {}) },
      };
      cachedConfig = merged;
      lastConfigFetch = now;
      return merged;
    }
  } catch (err) {
    console.warn("[TIKTOK_CONFIG] Failed to read engagement config from database:", err);
  }

  const fallback = getTikTokEngagementConfig();
  cachedConfig = fallback;
  lastConfigFetch = now;
  return fallback;
}

export async function saveTikTokEngagementConfigAsync(
  newConfig: Partial<TikTokEngagementPresetConfig>,
  actor: string = "admin"
): Promise<TikTokEngagementPresetConfig> {
  const current = await getTikTokEngagementConfigAsync(true);
  const merged: TikTokEngagementPresetConfig = {
    ...current,
    ...newConfig,
    views: { ...current.views, ...(newConfig.views || {}) },
    likes: { ...current.likes, ...(newConfig.likes || {}) },
    saves: { ...current.saves, ...(newConfig.saves || {}) },
    shares: { ...current.shares, ...(newConfig.shares || {}) },
    pricing: { ...current.pricing, ...(newConfig.pricing || {}) },
    syncThreshold: { ...current.syncThreshold, ...(newConfig.syncThreshold || {}) },
  };

  cachedConfig = merged;
  lastConfigFetch = Date.now();

  try {
    await prisma.auditLog.create({
      data: {
        action: "ENGAGEMENT_PRICING_CONFIG",
        actor,
        details: JSON.stringify(merged),
      },
    });
  } catch (err) {
    console.error("[TIKTOK_CONFIG] Failed to persist engagement config to database:", err);
  }

  const filePath = getConfigPath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");
  } catch {}

  return merged;
}

export function getTikTokEngagementConfig(): TikTokEngagementPresetConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const filePath = getConfigPath();
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(data);
      cachedConfig = {
        ...DEFAULT_TIKTOK_ENGAGEMENT_CONFIG,
        ...parsed,
        views: { ...DEFAULT_TIKTOK_ENGAGEMENT_CONFIG.views, ...(parsed.views || {}) },
        likes: { ...DEFAULT_TIKTOK_ENGAGEMENT_CONFIG.likes, ...(parsed.likes || {}) },
        saves: { ...DEFAULT_TIKTOK_ENGAGEMENT_CONFIG.saves, ...(parsed.saves || {}) },
        shares: { ...DEFAULT_TIKTOK_ENGAGEMENT_CONFIG.shares, ...(parsed.shares || {}) },
        pricing: { ...DEFAULT_TIKTOK_ENGAGEMENT_CONFIG.pricing, ...(parsed.pricing || {}) },
        syncThreshold: { ...DEFAULT_TIKTOK_ENGAGEMENT_CONFIG.syncThreshold, ...(parsed.syncThreshold || {}) },
      };
      return cachedConfig!;
    }
  } catch (err) {
    console.warn("[TIKTOK_CONFIG] Failed to read config from disk, using defaults:", err);
  }

  cachedConfig = { ...DEFAULT_TIKTOK_ENGAGEMENT_CONFIG };
  return cachedConfig;
}

export function saveTikTokEngagementConfig(newConfig: Partial<TikTokEngagementPresetConfig>): TikTokEngagementPresetConfig {
  const current = getTikTokEngagementConfig();
  const merged: TikTokEngagementPresetConfig = {
    ...current,
    ...newConfig,
    views: { ...current.views, ...(newConfig.views || {}) },
    likes: { ...current.likes, ...(newConfig.likes || {}) },
    saves: { ...current.saves, ...(newConfig.saves || {}) },
    shares: { ...current.shares, ...(newConfig.shares || {}) },
    pricing: { ...current.pricing, ...(newConfig.pricing || {}) },
    syncThreshold: { ...current.syncThreshold, ...(newConfig.syncThreshold || {}) },
  };

  cachedConfig = merged;
  lastConfigFetch = Date.now();

  prisma.auditLog
    .create({
      data: {
        action: "ENGAGEMENT_PRICING_CONFIG",
        actor: "system",
        details: JSON.stringify(merged),
      },
    })
    .catch((err) => console.error("[TIKTOK_CONFIG] Sync save DB error:", err));

  const filePath = getConfigPath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");
  } catch (err) {
    console.error("[TIKTOK_CONFIG] Failed to write config to disk:", err);
  }

  return merged;
}

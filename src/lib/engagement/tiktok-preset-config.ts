import fs from "fs";
import path from "path";

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
    tagline: "Calibrated 5-Hour Organic Pacing for Starter Posts",
    badge: "5.0 Hours",
    targetViews: 2960,
    targetLikes: 42,
    targetSaves: 0,
    targetShares: 0,
    durationHours: 5.0,
    totalDurationMinutes: 300,
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
      waveOffsets: [120, 200, 280],
    },
    syncThreshold: {
      minViews: 500,
      maxViews: 700,
    },
  },

  tiktok_5k: {
    id: "tiktok_5k",
    name: "TikTok Organic Velocity 5K",
    tagline: "1-Day FYP Momentum with Smooth Co-Delivered Views, Likes, Saves & Reposts",
    badge: "1 Day (16h)",
    targetViews: 5100,
    targetLikes: 170,
    targetSaves: 44,
    targetShares: 22,
    durationHours: 16.0,
    totalDurationMinutes: 960,
    views: {
      enabled: true,
      providerName: "Views Engine",
      serviceId: "897",
      minQuantity: 230,
      maxQuantity: 280,
      runsCount: 20,
      intervalMinutes: 45,
    },
    likes: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "1123",
      minQuantity: 11,
      maxQuantity: 14,
      runsCount: 14,
      waveOffsets: [45, 105, 165, 225, 285, 345, 405, 465, 525, 585, 645, 705, 765, 810],
    },
    saves: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "807",
      minQuantity: 10,
      maxQuantity: 12,
      runsCount: 4,
      waveOffsets: [240, 420, 600, 750],
    },
    shares: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "718",
      minQuantity: 10,
      maxQuantity: 12,
      runsCount: 2,
      waveOffsets: [360, 660],
    },
    syncThreshold: {
      minViews: 1000,
      maxViews: 1500,
    },
  },

  tiktok_10k: {
    id: "tiktok_10k",
    name: "TikTok FYP Breakthrough 10K",
    tagline: "Full 24-Hour Virality with High-Retention Saves & Reposts",
    badge: "1 Day (22h)",
    targetViews: 10500,
    targetLikes: 384,
    targetSaves: 90,
    targetShares: 44,
    durationHours: 22.0,
    totalDurationMinutes: 1320,
    views: {
      enabled: true,
      providerName: "Views Engine",
      serviceId: "897",
      minQuantity: 380,
      maxQuantity: 430,
      runsCount: 26,
      intervalMinutes: 48,
    },
    likes: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "1123",
      minQuantity: 14,
      maxQuantity: 18,
      runsCount: 24,
      waveOffsets: [
        48, 96, 144, 192, 240, 288, 336, 384, 432, 480, 528, 576, 624, 672, 720, 768, 816, 864, 912, 960, 1008, 1056, 1104, 1152,
      ],
    },
    saves: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "807",
      minQuantity: 10,
      maxQuantity: 13,
      runsCount: 8,
      waveOffsets: [192, 336, 480, 624, 768, 912, 1008, 1104],
    },
    shares: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "718",
      minQuantity: 10,
      maxQuantity: 12,
      runsCount: 4,
      waveOffsets: [336, 576, 816, 1056],
    },
    syncThreshold: {
      minViews: 2000,
      maxViews: 3000,
    },
  },

  tiktok_50k: {
    id: "tiktok_50k",
    name: "TikTok Viral Mega 50K",
    tagline: "2-Day (48-Hour) Full Viral Simulation across International Timezones",
    badge: "2 Days (48h)",
    targetViews: 50600,
    targetLikes: 2000,
    targetSaves: 450,
    targetShares: 180,
    durationHours: 48.0,
    totalDurationMinutes: 2880,
    views: {
      enabled: true,
      providerName: "Views Engine",
      serviceId: "897",
      minQuantity: 1050,
      maxQuantity: 1250,
      runsCount: 44,
      intervalMinutes: 62,
    },
    likes: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "1123",
      minQuantity: 45,
      maxQuantity: 55,
      runsCount: 40,
      waveOffsets: [
        62, 124, 186, 248, 310, 372, 434, 496, 558, 620, 682, 744, 806, 868, 930, 992, 1054, 1116, 1178, 1240,
        1302, 1364, 1426, 1488, 1550, 1612, 1674, 1736, 1798, 1860, 1922, 1984, 2046, 2108, 2170, 2232, 2294, 2356, 2418, 2480,
      ],
    },
    saves: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "807",
      minQuantity: 13,
      maxQuantity: 17,
      runsCount: 30,
      waveOffsets: [
        248, 325, 402, 480, 558, 635, 712, 790, 868, 945, 1022, 1100, 1178, 1255, 1332, 1410, 1488, 1565, 1642, 1720,
        1798, 1875, 1952, 2030, 2108, 2185, 2262, 2340, 2418, 2496,
      ],
    },
    shares: {
      enabled: true,
      providerName: "Engagement Engine",
      serviceId: "718",
      minQuantity: 10,
      maxQuantity: 14,
      runsCount: 15,
      waveOffsets: [
        372, 520, 670, 820, 970, 1120, 1270, 1420, 1570, 1720, 1870, 2020, 2170, 2320, 2470,
      ],
    },
    syncThreshold: {
      minViews: 5000,
      maxViews: 8000,
    },
  },
};

export function getTikTokPresetById(presetId?: string): TikTokTierPreset {
  if (presetId && TIKTOK_TIER_PRESETS[presetId]) {
    return TIKTOK_TIER_PRESETS[presetId];
  }
  // Try matching by name
  if (presetId) {
    const found = Object.values(TIKTOK_TIER_PRESETS).find(
      (p) => p.name.toLowerCase() === presetId.toLowerCase() || p.id.toLowerCase() === presetId.toLowerCase()
    );
    if (found) return found;
  }
  return TIKTOK_TIER_PRESETS.tiktok_2k;
}

export function getAllTikTokPresets(): TikTokTierPreset[] {
  return Object.values(TIKTOK_TIER_PRESETS);
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

export interface TikTokEngagementPresetConfig {
  enabled: boolean;
  presetName: string;
  views: MetricConfigItem;
  likes: MetricConfigItem;
  saves: MetricConfigItem;
  shares: MetricConfigItem;
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
  syncThreshold: {
    minViews: 500,
    maxViews: 700,
  },
};

let cachedConfig: TikTokEngagementPresetConfig | null = null;

function getConfigPath(): string {
  return path.join(process.cwd(), "data", "tiktok-engagement-config.json");
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
    syncThreshold: { ...current.syncThreshold, ...(newConfig.syncThreshold || {}) },
  };

  cachedConfig = merged;
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

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
      providerName: "Xmedia",
      serviceId: "10322",
      minQuantity: 150,
      maxQuantity: 220,
      runsCount: 16,
      intervalMinutes: 20,
    },
    likes: {
      enabled: true,
      providerName: "Zeofame",
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
    tagline: "1-Day FYP Momentum with Natural Views, Likes, Saves & Reposts",
    badge: "1 Day (16h)",
    targetViews: 5200,
    targetLikes: 150,
    targetSaves: 36,
    targetShares: 16,
    durationHours: 16.0,
    totalDurationMinutes: 960,
    views: {
      enabled: true,
      providerName: "Xmedia",
      serviceId: "10322",
      minQuantity: 210,
      maxQuantity: 260,
      runsCount: 22,
      intervalMinutes: 40,
    },
    likes: {
      enabled: true,
      providerName: "Zeofame",
      serviceId: "1123",
      minQuantity: 26,
      maxQuantity: 34,
      runsCount: 5,
      waveOffsets: [120, 240, 400, 560, 720],
    },
    saves: {
      enabled: true,
      providerName: "Zeofame",
      serviceId: "807",
      minQuantity: 10,
      maxQuantity: 14,
      runsCount: 3,
      waveOffsets: [180, 360, 600],
    },
    shares: {
      enabled: true,
      providerName: "Zeofame",
      serviceId: "718",
      minQuantity: 6,
      maxQuantity: 10,
      runsCount: 2,
      waveOffsets: [300, 540],
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
    targetLikes: 385,
    targetSaves: 85,
    targetShares: 36,
    durationHours: 22.0,
    totalDurationMinutes: 1320,
    views: {
      enabled: true,
      providerName: "Xmedia",
      serviceId: "10322",
      minQuantity: 320,
      maxQuantity: 380,
      runsCount: 30,
      intervalMinutes: 40,
    },
    likes: {
      enabled: true,
      providerName: "Zeofame",
      serviceId: "1123",
      minQuantity: 50,
      maxQuantity: 60,
      runsCount: 7,
      waveOffsets: [120, 280, 440, 600, 760, 920, 1080],
    },
    saves: {
      enabled: true,
      providerName: "Zeofame",
      serviceId: "807",
      minQuantity: 15,
      maxQuantity: 19,
      runsCount: 5,
      waveOffsets: [200, 400, 640, 840, 1040],
    },
    shares: {
      enabled: true,
      providerName: "Zeofame",
      serviceId: "718",
      minQuantity: 10,
      maxQuantity: 14,
      runsCount: 3,
      waveOffsets: [360, 680, 1000],
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
    targetViews: 50000,
    targetLikes: 2100,
    targetSaves: 450,
    targetShares: 180,
    durationHours: 48.0,
    totalDurationMinutes: 2880,
    views: {
      enabled: true,
      providerName: "Xmedia",
      serviceId: "10322",
      minQuantity: 900,
      maxQuantity: 1100,
      runsCount: 50,
      intervalMinutes: 56, // spaced smoothly over 48 hours
    },
    likes: {
      enabled: true,
      providerName: "Zeofame",
      serviceId: "1123",
      minQuantity: 160,
      maxQuantity: 190,
      runsCount: 12,
      waveOffsets: [120, 360, 600, 840, 1080, 1320, 1560, 1800, 2040, 2280, 2520, 2760],
    },
    saves: {
      enabled: true,
      providerName: "Zeofame",
      serviceId: "807",
      minQuantity: 45,
      maxQuantity: 55,
      runsCount: 9,
      waveOffsets: [240, 540, 840, 1140, 1440, 1740, 2040, 2340, 2640],
    },
    shares: {
      enabled: true,
      providerName: "Zeofame",
      serviceId: "718",
      minQuantity: 25,
      maxQuantity: 35,
      runsCount: 6,
      waveOffsets: [360, 780, 1200, 1620, 2040, 2460],
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
export interface TikTokEngagementPresetConfig {
  enabled: boolean;
  presetName: string;
  views: {
    enabled: boolean;
    providerName: string;
    serviceId: string;
    minQuantity: number;
    maxQuantity: number;
    runsCount: number;
    intervalMinutes: number;
  };
  likes: {
    enabled: boolean;
    providerName: string;
    serviceId: string;
    minQuantity: number;
    maxQuantity: number;
    runsCount: number;
    intervalMinutes: number;
  };
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
    providerName: "Xmedia",
    serviceId: "10322",
    minQuantity: 150,
    maxQuantity: 220,
    runsCount: 16,
    intervalMinutes: 20,
  },
  likes: {
    enabled: true,
    providerName: "Zeofame",
    serviceId: "1123",
    minQuantity: 12,
    maxQuantity: 16,
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

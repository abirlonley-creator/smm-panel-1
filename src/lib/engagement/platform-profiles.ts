/**
 * Config-Driven Platform Profiles & Provider Service Mappings
 * 
 * Supports dynamic registration and admin editing of platforms:
 * - tiktok
 * - instagram_reel (default)
 * - instagram_post (photo/carousel)
 * 
 * Future platforms can be added purely by data/config without altering code.
 */

import { EngagementType, ServiceSpec } from "./planner";

export type ProfilePresetKey = "fast" | "normal" | "slow";

export interface PresetOption {
  key: ProfilePresetKey;
  label: string;
  hours: number;
  durationPreset: "24h" | "48h" | "72h" | "96h" | "168h";
  isDefault?: boolean;
}

export interface TypeConfig {
  baseRatio: number;
  ratioVariance: number; // e.g. 0.25 for ±25%
  slidingScale?: {
    lowViewsThreshold: number;
    lowViewsRatio: number;
    highViewsThreshold: number;
    highViewsRatio: number;
    midRatio: number;
  };
  lagMinutesRange: [number, number]; // [min, max]
  curveDelayFraction?: number; // e.g. 0.08 for 8%
  curveStretchFraction?: number;
  batchSizeRange?: [number, number]; // e.g. [1, 3] for comments
  sparse?: boolean;
}

export interface PeakHourWindow {
  startHour: number; // 0-23
  endHour: number;   // 0-23
}

export interface PlatformProfile {
  id: string; // e.g. "instagram_reel", "instagram_post", "tiktok"
  platform: "Instagram" | "TikTok" | string;
  name: string;
  badge: string;
  description: string;
  explainerText?: string;
  presets: Record<ProfilePresetKey, PresetOption>;
  defaultPreset: ProfilePresetKey;
  viewsEnvelope: {
    kRange: [number, number]; // [min, max]
    mRange: [number, number]; // [min, max]
    noiseAmplitudeMax: number; // <= 0.03
  };
  archetypeWeights: {
    classic: number;
    doubleWave: number;
    stallAndSurge: number;
    slowRamp: number;
    earlySpike: number;
  };
  doubleWaveConfig?: {
    secondWaveCenterRange: [number, number]; // e.g. [0.50, 0.65]
    secondWaveWeightRange: [number, number]; // e.g. [0.25, 0.35]
  };
  types: Record<EngagementType, TypeConfig>;
  peakHours: {
    enabled: boolean;
    multiplier: number; // e.g. 1.4 for +40%
    windows: PeakHourWindow[];
  };
  serviceMappings: Record<EngagementType, ServiceSpec>;
}

export const DEFAULT_PLATFORM_PROFILES: Record<string, PlatformProfile> = {
  instagram_reel: {
    id: "instagram_reel",
    platform: "Instagram",
    name: "Instagram Reel",
    badge: "Reel / Video",
    description: "Multi-wave organic algorithm pacing tailored for short-form Instagram Reels.",
    explainerText:
      "Instagram tests content in waves. Views come first, then likes, then saves and shares. Comments are rare. Our delivery follows this with smooth, uneven batches. Recommended: 72h for Reels, 48h for photo posts.",
    presets: {
      fast: { key: "fast", label: "Fast Paced (24h)", hours: 24, durationPreset: "24h" },
      normal: { key: "normal", label: "Normal Pace (72h)", hours: 72, durationPreset: "72h", isDefault: true },
      slow: { key: "slow", label: "Slow Organic (168h / 7d)", hours: 168, durationPreset: "168h" },
    },
    defaultPreset: "normal",
    viewsEnvelope: {
      kRange: [5.5, 7.5],
      mRange: [0.25, 0.35],
      noiseAmplitudeMax: 0.026,
    },
    archetypeWeights: {
      classic: 0.30,
      doubleWave: 0.40,
      stallAndSurge: 0.15,
      slowRamp: 0.10,
      earlySpike: 0.05,
    },
    doubleWaveConfig: {
      secondWaveCenterRange: [0.50, 0.65],
      secondWaveWeightRange: [0.25, 0.35],
    },
    types: {
      views: {
        baseRatio: 1.0,
        ratioVariance: 0,
        lagMinutesRange: [0, 0],
      },
      likes: {
        baseRatio: 0.045,
        ratioVariance: 0.25, // ±25%
        slidingScale: {
          lowViewsThreshold: 10000,
          lowViewsRatio: 0.050, // ~5% under 10k
          highViewsThreshold: 100000,
          highViewsRatio: 0.035, // ~3.5% above 100k
          midRatio: 0.045,       // ~4.5% at 10k-100k
        },
        lagMinutesRange: [5, 20], // 5-20 min
        curveDelayFraction: 0.08, // delayed 8% of duration
      },
      saves: {
        baseRatio: 0.012, // 1.2%
        ratioVariance: 0.30, // ±30%
        lagMinutesRange: [45, 90], // 45-90 min
        curveDelayFraction: 0.15, // delayed 15% and stretched
        curveStretchFraction: 1.15,
      },
      shares: {
        baseRatio: 0.005, // 0.5%
        ratioVariance: 0.30, // ±30%
        lagMinutesRange: [60, 240], // 1-4 h
        sparse: true,
      },
      comments: {
        baseRatio: 0.002, // 0.2%
        ratioVariance: 0.40, // ±40%
        lagMinutesRange: [120, 480], // 2-8 h
        batchSizeRange: [1, 3],
      },
    },
    peakHours: {
      enabled: true,
      multiplier: 1.40, // +40%
      windows: [
        { startHour: 12, endHour: 14 },
        { startHour: 19, endHour: 23 },
      ],
    },
    serviceMappings: {
      views: {
        id: "srv-ig-views",
        providerId: "prov-default",
        name: "Instagram Reel Views — Organic High Retention",
        minQuantity: 100,
        maxQuantity: 5000000,
        ratePer1000: 0.15,
      },
      likes: {
        id: "srv-ig-likes",
        providerId: "prov-default",
        name: "Instagram Natural Likes — Wave Paced",
        minQuantity: 20,
        maxQuantity: 250000,
        ratePer1000: 0.85,
      },
      saves: {
        id: "srv-ig-saves",
        providerId: "prov-default",
        name: "Instagram Post Saves & Bookmarks",
        minQuantity: 10,
        maxQuantity: 100000,
        ratePer1000: 1.40,
      },
      shares: {
        id: "srv-ig-shares",
        providerId: "prov-default",
        name: "Instagram Real Post Shares",
        minQuantity: 10,
        maxQuantity: 50000,
        ratePer1000: 2.10,
      },
      comments: {
        id: "srv-ig-comments",
        providerId: "prov-default",
        name: "Instagram Verified English Comments",
        minQuantity: 1,
        maxQuantity: 2500,
        ratePer1000: 8.50,
      },
    },
  },

  instagram_post: {
    id: "instagram_post",
    platform: "Instagram",
    name: "Instagram Post (Photo/Carousel)",
    badge: "Photo / Carousel",
    description: "Front-loaded engagement distribution matching audience interactions on feed photos & carousels.",
    explainerText:
      "Photo and carousel posts receive the bulk of their impressions in the first 24-48 hours. Our profile front-loads early delivery with higher initial steepness before smoothly tapering off. Recommended: 48h.",
    presets: {
      fast: { key: "fast", label: "Fast Feed (24h)", hours: 24, durationPreset: "24h" },
      normal: { key: "normal", label: "Normal Feed (48h)", hours: 48, durationPreset: "48h" as any, isDefault: true },
      slow: { key: "slow", label: "Extended Feed (96h)", hours: 96, durationPreset: "96h" as any },
    },
    defaultPreset: "normal",
    viewsEnvelope: {
      kRange: [5.5, 7.5],
      mRange: [0.18, 0.28], // More front-loaded
      noiseAmplitudeMax: 0.026,
    },
    archetypeWeights: {
      classic: 0.35,
      doubleWave: 0.35,
      stallAndSurge: 0.15,
      slowRamp: 0.10,
      earlySpike: 0.05,
    },
    doubleWaveConfig: {
      secondWaveCenterRange: [0.45, 0.60],
      secondWaveWeightRange: [0.20, 0.30],
    },
    types: {
      views: {
        baseRatio: 1.0,
        ratioVariance: 0,
        lagMinutesRange: [0, 0],
      },
      likes: {
        baseRatio: 0.045,
        ratioVariance: 0.25,
        slidingScale: {
          lowViewsThreshold: 10000,
          lowViewsRatio: 0.050,
          highViewsThreshold: 100000,
          highViewsRatio: 0.035,
          midRatio: 0.045,
        },
        lagMinutesRange: [5, 15], // Scaled for shorter post duration
        curveDelayFraction: 0.07,
      },
      saves: {
        baseRatio: 0.012,
        ratioVariance: 0.30,
        lagMinutesRange: [30, 60],
        curveDelayFraction: 0.12,
        curveStretchFraction: 1.10,
      },
      shares: {
        baseRatio: 0.005,
        ratioVariance: 0.30,
        lagMinutesRange: [45, 180],
        sparse: true,
      },
      comments: {
        baseRatio: 0.002,
        ratioVariance: 0.40,
        lagMinutesRange: [60, 300],
        batchSizeRange: [1, 3],
      },
    },
    peakHours: {
      enabled: true,
      multiplier: 1.40,
      windows: [
        { startHour: 12, endHour: 14 },
        { startHour: 19, endHour: 23 },
      ],
    },
    serviceMappings: {
      views: {
        id: "srv-ig-post-views",
        providerId: "prov-default",
        name: "Instagram Feed Post Views — Organic Pace",
        minQuantity: 100,
        maxQuantity: 5000000,
        ratePer1000: 0.15,
      },
      likes: {
        id: "srv-ig-post-likes",
        providerId: "prov-default",
        name: "Instagram Feed Post Likes",
        minQuantity: 20,
        maxQuantity: 250000,
        ratePer1000: 0.85,
      },
      saves: {
        id: "srv-ig-post-saves",
        providerId: "prov-default",
        name: "Instagram Post Saves & Bookmarks",
        minQuantity: 10,
        maxQuantity: 100000,
        ratePer1000: 1.40,
      },
      shares: {
        id: "srv-ig-post-shares",
        providerId: "prov-default",
        name: "Instagram Real Post Shares",
        minQuantity: 10,
        maxQuantity: 50000,
        ratePer1000: 2.10,
      },
      comments: {
        id: "srv-ig-post-comments",
        providerId: "prov-default",
        name: "Instagram Verified English Comments",
        minQuantity: 1,
        maxQuantity: 2500,
        ratePer1000: 8.50,
      },
    },
  },

  tiktok: {
    id: "tiktok",
    platform: "TikTok",
    name: "TikTok Video",
    badge: "FYP Video",
    description: "Viral FYP surge and retention algorithm pacing for TikTok short-form videos.",
    explainerText:
      "TikTok's recommendation engine evaluates initial watch-time completion before pushing videos to broader FYP test clusters. Our pacing starts with early views, cascading into likes and rapid shares.",
    presets: {
      fast: { key: "fast", label: "Fast FYP (24h)", hours: 24, durationPreset: "24h" },
      normal: { key: "normal", label: "Normal Growth (72h)", hours: 72, durationPreset: "72h", isDefault: true },
      slow: { key: "slow", label: "Long Tail (168h / 7d)", hours: 168, durationPreset: "168h" },
    },
    defaultPreset: "normal",
    viewsEnvelope: {
      kRange: [6.0, 8.0],
      mRange: [0.25, 0.30],
      noiseAmplitudeMax: 0.026,
    },
    archetypeWeights: {
      classic: 0.40,
      doubleWave: 0.25,
      stallAndSurge: 0.15,
      slowRamp: 0.10,
      earlySpike: 0.10,
    },
    doubleWaveConfig: {
      secondWaveCenterRange: [0.45, 0.60],
      secondWaveWeightRange: [0.25, 0.35],
    },
    types: {
      views: {
        baseRatio: 1.0,
        ratioVariance: 0,
        lagMinutesRange: [0, 0],
      },
      likes: {
        baseRatio: 0.060,
        ratioVariance: 0.25,
        slidingScale: {
          lowViewsThreshold: 5000,
          lowViewsRatio: 0.070, // ~7% under 5k
          highViewsThreshold: 100000,
          highViewsRatio: 0.035, // ~3.5% above 100k
          midRatio: 0.060,       // ~6% at 5k-100k
        },
        lagMinutesRange: [5, 15],
        curveDelayFraction: 0.10, // delayed 10%
      },
      saves: {
        baseRatio: 0.010, // 1.0%
        ratioVariance: 0.30,
        lagMinutesRange: [30, 60],
        curveDelayFraction: 0.12,
      },
      shares: {
        baseRatio: 0.005, // 0.5%
        ratioVariance: 0.30,
        lagMinutesRange: [60, 180], // 1-3 h
        sparse: true,
      },
      comments: {
        baseRatio: 0.002, // 0.2%
        ratioVariance: 0.40,
        lagMinutesRange: [120, 360], // 2-6 h
        batchSizeRange: [1, 3],
      },
    },
    peakHours: {
      enabled: true,
      multiplier: 1.40,
      windows: [
        { startHour: 12, endHour: 14 },
        { startHour: 19, endHour: 23 },
      ],
    },
    serviceMappings: {
      views: {
        id: "srv-tt-views",
        providerId: "prov-default",
        name: "TikTok High Retention For You Views",
        minQuantity: 200,
        maxQuantity: 10000000,
        ratePer1000: 0.18,
      },
      likes: {
        id: "srv-tt-likes",
        providerId: "prov-default",
        name: "TikTok Feed Boost Likes",
        minQuantity: 20,
        maxQuantity: 500000,
        ratePer1000: 0.95,
      },
      saves: {
        id: "srv-tt-saves",
        providerId: "prov-default",
        name: "TikTok Favorites & Saves",
        minQuantity: 10,
        maxQuantity: 150000,
        ratePer1000: 1.25,
      },
      shares: {
        id: "srv-tt-shares",
        providerId: "prov-default",
        name: "TikTok Viral Post Shares",
        minQuantity: 15,
        maxQuantity: 100000,
        ratePer1000: 1.80,
      },
      comments: {
        id: "srv-tt-comments",
        providerId: "prov-default",
        name: "TikTok Relevant Engaging Comments",
        minQuantity: 1,
        maxQuantity: 3000,
        ratePer1000: 9.00,
      },
    },
  },
};

// In-Memory Profile Store with File Persistence (Node environment only)
let profileCache: Record<string, PlatformProfile> | null = null;

function getNodeModules() {
  if (typeof window !== "undefined") return { fs: null, path: null };
  try {
    // Dynamic eval require prevents webpack from bundling node native modules in browser builds
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req: any = typeof eval !== "undefined" ? eval("require") : null;
    if (req) {
      return {
        fs: req("fs"),
        path: req("path"),
      };
    }
  } catch {
    // browser or sandboxed environment
  }
  return { fs: null, path: null };
}

function getConfigFilePath(): string {
  const { path } = getNodeModules();
  if (path) {
    return path.resolve(process.cwd(), "data", "platform-profiles.json");
  }
  return "data/platform-profiles.json";
}

function loadProfilesFromDisk(): Record<string, PlatformProfile> {
  if (profileCache) return profileCache;

  const { fs } = getNodeModules();
  const filePath = getConfigFilePath();

  if (fs) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw);
        profileCache = { ...DEFAULT_PLATFORM_PROFILES, ...parsed };
        return profileCache!;
      }
    } catch (err) {
      console.warn("[PLATFORM-PROFILES] Could not load from disk, using defaults", err);
    }
  }

  profileCache = { ...DEFAULT_PLATFORM_PROFILES };
  return profileCache;
}

function saveProfilesToDisk(profiles: Record<string, PlatformProfile>): void {
  profileCache = profiles;
  const { fs, path } = getNodeModules();
  const filePath = getConfigFilePath();

  if (fs && path) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(profiles, null, 2), "utf8");
    } catch (err) {
      console.error("[PLATFORM-PROFILES] Failed to save profiles to disk", err);
    }
  }
}

/**
 * Retrieves all registered platform profiles.
 */
export function getAllPlatformProfiles(): PlatformProfile[] {
  const map = loadProfilesFromDisk();
  return Object.values(map);
}

/**
 * Retrieves a platform profile by ID (e.g. "instagram_reel", "instagram_post", "tiktok").
 * Automatically falls back to "instagram_reel" or "tiktok" if a generic platform name is provided.
 */
export function getPlatformProfile(idOrPlatform?: string): PlatformProfile {
  const map = loadProfilesFromDisk();
  const id = idOrPlatform?.toLowerCase() || "instagram_reel";

  if (map[id]) return map[id];
  if (id === "instagram") return map["instagram_reel"];
  if (id === "tiktok") return map["tiktok"];

  // Fallback to first available
  return map["instagram_reel"] || Object.values(map)[0];
}

/**
 * Updates or registers a platform profile (Admin).
 */
export function savePlatformProfile(profile: PlatformProfile): PlatformProfile {
  const map = { ...loadProfilesFromDisk(), [profile.id]: profile };
  saveProfilesToDisk(map);
  return profile;
}

/**
 * Updates a specific service mapping for a platform and engagement type (Admin Remap).
 */
export function updateEngagementServiceMapping(
  profileId: string,
  type: EngagementType,
  mapping: Partial<ServiceSpec>
): ServiceSpec {
  const map = { ...loadProfilesFromDisk() };
  const profile = map[profileId] || map["instagram_reel"];

  const current = profile.serviceMappings[type] || {
    id: `srv-${profileId}-${type}`,
    providerId: "prov-default",
    name: `${profile.name} ${type}`,
    minQuantity: 10,
    maxQuantity: 100000,
    ratePer1000: 1.0,
  };

  const updated: ServiceSpec = {
    ...current,
    ...mapping,
  };

  profile.serviceMappings[type] = updated;
  map[profile.id] = profile;
  saveProfilesToDisk(map);
  return updated;
}

/**
 * Resolves the active service mapping for an engagement type on a platform profile.
 */
export function resolvePlatformService(profileId: string, type: EngagementType): ServiceSpec {
  const profile = getPlatformProfile(profileId);
  return profile.serviceMappings[type];
}

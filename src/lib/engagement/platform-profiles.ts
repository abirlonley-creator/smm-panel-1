/**
 * Config-Driven Platform Profiles, Realistic Tier Model & Provider Service Mappings
 * 
 * Supports dynamic registration and admin editing of platforms:
 * - tiktok
 * - instagram_reel (default)
 * - instagram_post (photo/carousel)
 * 
 * Features:
 * - Realistic viewer engagement model with tier tables per platform
 * - Interpolated tier checkpoints (1k, 2k, 5k, 10k, 50k+)
 * - Per-order seeded drawing with 30% zero probability for saves/comments at small counts
 * - Hard rule enforcement (shares <= likes, saves <= likes, comments <= maxComments)
 * - Composite keys (provider_id, provider_service_id) everywhere
 * - Automatic provider minimum detection and friendly auto-disabling
 */

import { EngagementType, ServiceSpec } from "./planner";

export type ProfilePresetKey = "fast" | "normal" | "slow";
export type EngagementSecondaryType = "likes" | "saves" | "shares" | "comments";

export interface PresetOption {
  key: ProfilePresetKey;
  label: string;
  hours: number;
  durationPreset: "24h" | "48h" | "72h" | "96h" | "168h";
  isDefault?: boolean;
}

export interface TierRange {
  min: number;
  max: number;
}

export interface PlatformTierCheckpoints {
  views1k: Record<EngagementSecondaryType, TierRange>;
  views2k: Record<EngagementSecondaryType, TierRange>;
  views5k: Record<EngagementSecondaryType, TierRange>;
  views10k: Record<EngagementSecondaryType, TierRange>;
  views50kPlusRatios: Record<EngagementSecondaryType, TierRange>; // min-max ratio fractions (e.g. 0.04 - 0.05)
}

export interface TypeConfig {
  baseRatio: number;
  ratioVariance: number;
  slidingScale?: {
    lowViewsThreshold: number;
    lowViewsRatio: number;
    highViewsThreshold: number;
    highViewsRatio: number;
    midRatio: number;
  };
  lagMinutesRange: [number, number];
  curveDelayFraction?: number;
  curveStretchFraction?: number;
  batchSizeRange?: [number, number];
  sparse?: boolean;
}

export interface PeakHourWindow {
  startHour: number; // 0-23
  endHour: number;   // 0-23
}

export interface AutoDurationRow {
  views: number;
  minHours: number;
  maxHours: number;
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
  autoDurationTable?: AutoDurationRow[];
  maxNaturalViewsPerHour?: number;
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
    secondWaveCenterRange: [number, number];
    secondWaveWeightRange: [number, number];
  };
  tiers: PlatformTierCheckpoints;
  types: Record<EngagementType, TypeConfig>;
  peakHours: {
    enabled: boolean;
    multiplier: number;
    windows: PeakHourWindow[];
  };
  serviceMappings: Record<EngagementType, ServiceSpec>;
}

// ----------------------------------------------------------------------------
// Tier Checkpoint Tables
// ----------------------------------------------------------------------------

export const TIKTOK_TIER_CHECKPOINTS: PlatformTierCheckpoints = {
  views1k: {
    likes: { min: 12, max: 16 },
    saves: { min: 0, max: 12 },
    shares: { min: 6, max: 14 },
    comments: { min: 0, max: 2 },
  },
  views2k: {
    likes: { min: 25, max: 35 },
    saves: { min: 5, max: 20 },
    shares: { min: 12, max: 25 },
    comments: { min: 1, max: 4 },
  },
  views5k: {
    likes: { min: 100, max: 250 },
    saves: { min: 25, max: 60 },
    shares: { min: 25, max: 60 },
    comments: { min: 4, max: 12 },
  },
  views10k: {
    likes: { min: 300, max: 600 },
    saves: { min: 50, max: 150 },
    shares: { min: 30, max: 100 },
    comments: { min: 10, max: 30 },
  },
  views50kPlusRatios: {
    likes: { min: 0.040, max: 0.050 },
    saves: { min: 0.008, max: 0.012 },
    shares: { min: 0.004, max: 0.007 },
    comments: { min: 0.001, max: 0.002 },
  },
};

export const INSTAGRAM_REEL_TIER_CHECKPOINTS: PlatformTierCheckpoints = {
  views1k: {
    likes: { min: 10, max: 15 },
    saves: { min: 2, max: 14 },
    shares: { min: 5, max: 12 },
    comments: { min: 0, max: 2 },
  },
  views2k: {
    likes: { min: 20, max: 32 },
    saves: { min: 8, max: 24 },
    shares: { min: 10, max: 22 },
    comments: { min: 1, max: 3 },
  },
  views5k: {
    likes: { min: 80, max: 220 },
    saves: { min: 30, max: 75 },
    shares: { min: 20, max: 55 },
    comments: { min: 3, max: 10 },
  },
  views10k: {
    likes: { min: 250, max: 520 },
    saves: { min: 70, max: 180 },
    shares: { min: 30, max: 90 },
    comments: { min: 8, max: 25 },
  },
  views50kPlusRatios: {
    likes: { min: 0.035, max: 0.045 },
    saves: { min: 0.010, max: 0.015 },
    shares: { min: 0.004, max: 0.007 },
    comments: { min: 0.001, max: 0.002 },
  },
};

export const INSTAGRAM_POST_TIER_CHECKPOINTS: PlatformTierCheckpoints = {
  views1k: {
    likes: { min: 12, max: 16 },
    saves: { min: 1, max: 10 },
    shares: { min: 4, max: 10 },
    comments: { min: 0, max: 2 },
  },
  views2k: {
    likes: { min: 24, max: 36 },
    saves: { min: 6, max: 18 },
    shares: { min: 8, max: 18 },
    comments: { min: 1, max: 3 },
  },
  views5k: {
    likes: { min: 90, max: 230 },
    saves: { min: 25, max: 65 },
    shares: { min: 18, max: 45 },
    comments: { min: 3, max: 9 },
  },
  views10k: {
    likes: { min: 280, max: 550 },
    saves: { min: 60, max: 160 },
    shares: { min: 25, max: 80 },
    comments: { min: 8, max: 22 },
  },
  views50kPlusRatios: {
    likes: { min: 0.035, max: 0.045 },
    saves: { min: 0.009, max: 0.014 },
    shares: { min: 0.003, max: 0.006 },
    comments: { min: 0.001, max: 0.002 },
  },
};

// ----------------------------------------------------------------------------
// Auto Duration Heuristic Tables & Interpolation (Change A)
// ----------------------------------------------------------------------------

export const TIKTOK_AUTO_DURATION_TABLE: AutoDurationRow[] = [
  { views: 1000, minHours: 0.5, maxHours: 1.5 },
  { views: 2500, minHours: 1.5, maxHours: 4.0 },
  { views: 5000, minHours: 3.0, maxHours: 10.0 },
  { views: 10000, minHours: 8.0, maxHours: 24.0 },
  { views: 50000, minHours: 24.0, maxHours: 60.0 },
  { views: 100000, minHours: 48.0, maxHours: 96.0 },
  { views: 500000, minHours: 96.0, maxHours: 200.0 },
  { views: 1000000, minHours: 150.0, maxHours: 400.0 },
];

export const INSTAGRAM_REEL_AUTO_DURATION_TABLE: AutoDurationRow[] = [
  { views: 1000, minHours: 0.75, maxHours: 2.0 },
  { views: 2500, minHours: 2.0, maxHours: 5.0 },
  { views: 5000, minHours: 4.0, maxHours: 12.0 },
  { views: 10000, minHours: 10.0, maxHours: 28.0 },
  { views: 50000, minHours: 28.0, maxHours: 72.0 },
  { views: 100000, minHours: 50.0, maxHours: 110.0 },
  { views: 500000, minHours: 100.0, maxHours: 240.0 },
  { views: 1000000, minHours: 160.0, maxHours: 450.0 },
];

export const INSTAGRAM_POST_AUTO_DURATION_TABLE: AutoDurationRow[] = [
  { views: 1000, minHours: 0.3, maxHours: 1.0 },
  { views: 2500, minHours: 1.0, maxHours: 2.5 },
  { views: 5000, minHours: 2.0, maxHours: 6.0 },
  { views: 10000, minHours: 5.0, maxHours: 16.0 },
  { views: 50000, minHours: 16.0, maxHours: 36.0 },
  { views: 100000, minHours: 24.0, maxHours: 60.0 },
  { views: 500000, minHours: 48.0, maxHours: 120.0 },
  { views: 1000000, minHours: 72.0, maxHours: 180.0 },
];

/**
 * Log-space interpolation of natural duration range [minHours, maxHours] by view count.
 */
export function interpolateAutoDurationRange(
  table: AutoDurationRow[],
  views: number
): { minHours: number; maxHours: number } {
  if (!table || table.length === 0) return { minHours: 24, maxHours: 72 };
  const v = Math.max(1, views);

  if (v <= table[0].views) {
    if (v === table[0].views) {
      return { minHours: table[0].minHours, maxHours: table[0].maxHours };
    }
    const factor = Math.max(0.25, Math.log(v + 10) / Math.log(table[0].views + 10));
    return {
      minHours: Math.max(0.25, Number((table[0].minHours * factor).toFixed(2))),
      maxHours: Math.max(0.5, Number((table[0].maxHours * factor).toFixed(2))),
    };
  }

  const last = table[table.length - 1];
  if (v >= last.views) {
    if (v === last.views) {
      return { minHours: last.minHours, maxHours: last.maxHours };
    }
    const factor = Math.log(v) / Math.log(last.views);
    return {
      minHours: Number((last.minHours * factor).toFixed(2)),
      maxHours: Number((last.maxHours * factor).toFixed(2)),
    };
  }

  for (let i = 0; i < table.length - 1; i++) {
    const rowA = table[i];
    const rowB = table[i + 1];
    if (v >= rowA.views && v <= rowB.views) {
      const logA = Math.log(rowA.views);
      const logB = Math.log(rowB.views);
      const t = (Math.log(v) - logA) / (logB - logA);

      const logMinA = Math.log(rowA.minHours);
      const logMinB = Math.log(rowB.minHours);
      const logMaxA = Math.log(rowA.maxHours);
      const logMaxB = Math.log(rowB.maxHours);

      const minHours = Math.exp(logMinA + t * (logMinB - logMinA));
      const maxHours = Math.exp(logMaxA + t * (logMaxB - logMaxA));

      return {
        minHours: Number(minHours.toFixed(2)),
        maxHours: Number(maxHours.toFixed(2)),
      };
    }
  }

  return { minHours: last.minHours, maxHours: last.maxHours };
}

/**
 * Computes natural auto-duration for an order based on view count and deterministic seed.
 */
export function computeAutoDuration(
  profile: PlatformProfile,
  views: number,
  seed: number
): { durationHours: number; minHours: number; maxHours: number } {
  const table = profile.autoDurationTable || (
    profile.id === "tiktok" ? TIKTOK_AUTO_DURATION_TABLE :
    profile.id === "instagram_post" ? INSTAGRAM_POST_AUTO_DURATION_TABLE :
    INSTAGRAM_REEL_AUTO_DURATION_TABLE
  );

  const { minHours, maxHours } = interpolateAutoDurationRange(table, views);

  // Derive PRNG from subseed
  let s = (seed ^ 0x9e3779b9) >>> 0;
  const key = "auto_duration_v2";
  for (let i = 0; i < key.length; i++) {
    s = (Math.imul(s ^ key.charCodeAt(i), 0x5bd1e995)) >>> 0;
    s ^= s >>> 15;
  }
  let state = (s >>> 0) || 123456789;
  const drawUniform = () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const u = drawUniform();
  // Interpolate in log-space within [minHours, maxHours]
  const logMin = Math.log(minHours);
  const logMax = Math.log(maxHours);
  const rawHours = Math.exp(logMin + u * (logMax - logMin));

  const durationHours = Math.max(0.25, Math.round(rawHours * 10) / 10);

  return {
    durationHours,
    minHours,
    maxHours,
  };
}

/**
 * Formats a duration in hours into user-friendly natural text.
 */
export function formatDurationHours(hours: number): string {
  if (hours < 1) {
    const mins = Math.max(15, Math.round(hours * 60));
    return `${mins} min`;
  }
  if (hours < 24) {
    const h = Math.round(hours * 10) / 10;
    return `${h % 1 === 0 ? h : h.toFixed(1)} hours`;
  }
  const days = Math.round((hours / 24) * 10) / 10;
  return `${days % 1 === 0 ? days : days.toFixed(1)} days (${Math.round(hours)}h)`;
}

/**
 * Validates a user-requested custom speed duration against natural delivery safety limits.
 */
export function validateCustomDuration(
  profile: PlatformProfile,
  views: number,
  customHours: number,
  typeQuantities?: Partial<Record<EngagementType, { total: number; minQuantity: number }>>
): { valid: boolean; shortestAllowedHours: number; reason?: string } {
  const maxNaturalViewsPerHour = profile.maxNaturalViewsPerHour || 2500;
  const minHoursByRate = Math.ceil((views / maxNaturalViewsPerHour) * 10) / 10;

  // Ensure duration can accommodate at least 3 runs per enabled type with service minimum
  let minHoursByRuns = 0.25; // 15 mins minimum
  if (typeQuantities) {
    for (const [_, info] of Object.entries(typeQuantities)) {
      if (info && info.minQuantity > 0 && info.total >= 3 * info.minQuantity) {
        // At least 3 runs spaced out
        const neededMinutes = 3 * 5; // 15 mins
        const neededHours = Math.ceil((neededMinutes / 60) * 10) / 10;
        if (neededHours > minHoursByRuns) minHoursByRuns = neededHours;
      }
    }
  }

  const shortestAllowedHours = Math.max(0.25, Math.max(minHoursByRate, minHoursByRuns));

  if (customHours < shortestAllowedHours) {
    return {
      valid: false,
      shortestAllowedHours,
      reason: `Shortest allowed duration for ${views.toLocaleString()} views is ${shortestAllowedHours} hours (platform limit).`,
    };
  }

  return { valid: true, shortestAllowedHours };
}

// ----------------------------------------------------------------------------
// Tier Interpolation & Drawing Helpers
// ----------------------------------------------------------------------------

function lcgRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hashSub(baseSeed: number, key: string): number {
  let h = (baseSeed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(h ^ key.charCodeAt(i), 0x5bd1e995)) >>> 0;
    h ^= h >>> 15;
  }
  return h >>> 0;
}

/**
 * Interpolates the expected [min, max] range for a given view count.
 */
export function getTierRangeForViews(
  tiers: PlatformTierCheckpoints,
  views: number,
  type: EngagementSecondaryType
): TierRange {
  const v = Math.max(1, views);

  if (v <= 1000) {
    const scale = Math.max(0.01, v / 1000);
    return {
      min: Math.max(0, Math.round(tiers.views1k[type].min * scale)),
      max: Math.max(1, Math.round(tiers.views1k[type].max * scale)),
    };
  }

  if (v <= 2000) {
    const t = (v - 1000) / 1000;
    const min1 = tiers.views1k[type].min;
    const max1 = tiers.views1k[type].max;
    const min2 = tiers.views2k[type].min;
    const max2 = tiers.views2k[type].max;
    return {
      min: Math.round(min1 + t * (min2 - min1)),
      max: Math.round(max1 + t * (max2 - max1)),
    };
  }

  if (v <= 5000) {
    const t = (v - 2000) / 3000;
    const min1 = tiers.views2k[type].min;
    const max1 = tiers.views2k[type].max;
    const min2 = tiers.views5k[type].min;
    const max2 = tiers.views5k[type].max;
    return {
      min: Math.round(min1 + t * (min2 - min1)),
      max: Math.round(max1 + t * (max2 - max1)),
    };
  }

  if (v <= 10000) {
    const t = (v - 5000) / 5000;
    const min1 = tiers.views5k[type].min;
    const max1 = tiers.views5k[type].max;
    const min2 = tiers.views10k[type].min;
    const max2 = tiers.views10k[type].max;
    return {
      min: Math.round(min1 + t * (min2 - min1)),
      max: Math.round(max1 + t * (max2 - max1)),
    };
  }

  if (v < 50000) {
    const t = (v - 10000) / 40000;
    const min1 = tiers.views10k[type].min;
    const max1 = tiers.views10k[type].max;
    const min50k = Math.round(50000 * tiers.views50kPlusRatios[type].min);
    const max50k = Math.round(50000 * tiers.views50kPlusRatios[type].max);
    return {
      min: Math.round(min1 + t * (min50k - min1)),
      max: Math.round(max1 + t * (max50k - max1)),
    };
  }

  // Views >= 50,000 (Sliding Ratios)
  return {
    min: Math.round(v * tiers.views50kPlusRatios[type].min),
    max: Math.round(v * tiers.views50kPlusRatios[type].max),
  };
}

export interface RealisticTotalsResult {
  plannedTotals: Record<EngagementType, number>;
  suggestedTotals: Record<EngagementType, number>;
  suggestedRanges: Record<EngagementType, TierRange>;
  sourceFlags: Record<EngagementType, "suggested" | "custom">;
  autoDisabledTypes: Record<EngagementType, boolean>;
  autoDisableNotes: Record<EngagementType, string | null>;
  softHints: Record<EngagementType, string | null>;
}

/**
 * Draws realistic viewer engagement totals using the seeded tier model.
 * Enforces hard constraints:
 * - shares <= likes
 * - saves <= likes
 * - comments <= 0.2 * shares OR <= 0.3% of views (whichever larger at small counts)
 * - 30% zero probability for saves and comments under 2,000 views
 * - Auto-disables types whose total is below the provider minimum
 */
export function drawRealisticTotals(
  profileOrId: PlatformProfile | string,
  views: number,
  seed: number,
  customQuantities?: Partial<Record<EngagementType, number>>,
  customSources?: Partial<Record<EngagementType, "suggested" | "custom">>,
  typeToggles?: Partial<Record<EngagementType, boolean>>
): RealisticTotalsResult {
  const profile = typeof profileOrId === "string" ? getPlatformProfile(profileOrId) : profileOrId;
  const baseViews = Math.max(1, Math.round(views));
  const types: EngagementSecondaryType[] = ["likes", "saves", "shares", "comments"];

  const suggestedTotals: Record<EngagementType, number> = {
    views: baseViews,
    likes: 0,
    saves: 0,
    shares: 0,
    comments: 0,
  };

  const suggestedRanges: Record<EngagementType, TierRange> = {
    views: { min: baseViews, max: baseViews },
    likes: { min: 0, max: 0 },
    saves: { min: 0, max: 0 },
    shares: { min: 0, max: 0 },
    comments: { min: 0, max: 0 },
  };

  const finalTotals: Record<EngagementType, number> = {
    views: baseViews,
    likes: 0,
    saves: 0,
    shares: 0,
    comments: 0,
  };

  const sourceFlags: Record<EngagementType, "suggested" | "custom"> = {
    views: customSources?.views || (customQuantities?.views !== undefined ? "custom" : "suggested"),
    likes: customSources?.likes || (customQuantities?.likes !== undefined ? "custom" : "suggested"),
    saves: customSources?.saves || (customQuantities?.saves !== undefined ? "custom" : "suggested"),
    shares: customSources?.shares || (customQuantities?.shares !== undefined ? "custom" : "suggested"),
    comments: customSources?.comments || (customQuantities?.comments !== undefined ? "custom" : "suggested"),
  };

  const autoDisabledTypes: Record<EngagementType, boolean> = {
    views: false,
    likes: false,
    saves: false,
    shares: false,
    comments: false,
  };

  const autoDisableNotes: Record<EngagementType, string | null> = {
    views: null,
    likes: null,
    saves: null,
    shares: null,
    comments: null,
  };

  const softHints: Record<EngagementType, string | null> = {
    views: null,
    likes: null,
    saves: null,
    shares: null,
    comments: null,
  };

  // 1. Draw raw suggested values from tier checkpoints
  for (const t of types) {
    const range = getTierRangeForViews(profile.tiers, baseViews, t);
    suggestedRanges[t] = range;

    const rng = lcgRng(hashSub(seed, t));
    let sampled = Math.round(range.min + rng() * (range.max - range.min));

    // Zero probability: at small view counts (<= 2000), 30% chance of 0 for saves and comments
    if (baseViews <= 2000 && (t === "saves" || t === "comments")) {
      const zeroRollRng = lcgRng(hashSub(seed + 999, `${t}_zero`));
      if (zeroRollRng() < 0.30) {
        sampled = 0;
      }
    }

    suggestedTotals[t] = Math.max(0, sampled);
  }

  // 2. Enforce hard rules on suggested numbers
  // shares <= likes
  if (suggestedTotals.shares > suggestedTotals.likes) {
    suggestedTotals.shares = suggestedTotals.likes;
  }
  // saves <= likes
  if (suggestedTotals.saves > suggestedTotals.likes) {
    suggestedTotals.saves = suggestedTotals.likes;
  }
  // comments <= 0.2 * shares OR <= 0.3% of views (whichever is larger at small counts)
  const maxComments = Math.max(
    Math.floor(0.20 * suggestedTotals.shares),
    Math.round(0.003 * baseViews)
  );
  if (suggestedTotals.comments > maxComments) {
    suggestedTotals.comments = maxComments;
  }

  // 3. Resolve Final Numbers (respecting custom user input where edited)
  for (const t of types) {
    const isCustom = sourceFlags[t] === "custom" && customQuantities?.[t] !== undefined;
    let chosen = isCustom ? Math.max(0, Math.round(customQuantities![t]!)) : suggestedTotals[t];

    const srv = profile.serviceMappings[t];
    const typeLabel = t.charAt(0).toUpperCase() + t.slice(1);

    // Check soft hint if user entered unusually high custom quantity
    if (isCustom && srv) {
      const range = suggestedRanges[t];
      if (chosen > range.max * 1.5 && chosen > 10) {
        softHints[t] = `This is a lot of ${t} for ${baseViews.toLocaleString()} views and may look less natural. Suggested: ${range.min}–${range.max}.`;
      }
    }

    // Check provider minimum rule
    if (srv && srv.minQuantity && chosen < srv.minQuantity && chosen > 0) {
      autoDisabledTypes[t] = true;
      if (baseViews < 3000 && t === "comments") {
        autoDisableNotes[t] = "Comments unlock around 3,000 views.";
      } else {
        const range = suggestedRanges[t];
        autoDisableNotes[t] = `${typeLabel} need at least ${srv.minQuantity} for this service. Your ${baseViews.toLocaleString()} views would normally get about ${range.min}–${range.max} ${t}, so ${t} are switched off.`;
      }
    }

    // If type toggle is explicitly false, final quantity is 0
    if (typeToggles?.[t] === false) {
      chosen = 0;
    }

    finalTotals[t] = chosen;
  }

  return {
    plannedTotals: finalTotals,
    suggestedTotals,
    suggestedRanges,
    sourceFlags,
    autoDisabledTypes,
    autoDisableNotes,
    softHints,
  };
}

// ----------------------------------------------------------------------------
// Default Config-Driven Profiles (Using seeded provider xmedia)
// ----------------------------------------------------------------------------

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
    autoDurationTable: INSTAGRAM_REEL_AUTO_DURATION_TABLE,
    maxNaturalViewsPerHour: 2000,
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
    tiers: INSTAGRAM_REEL_TIER_CHECKPOINTS,
    types: {
      views: {
        baseRatio: 1.0,
        ratioVariance: 0,
        lagMinutesRange: [0, 0],
      },
      likes: {
        baseRatio: 0.045,
        ratioVariance: 0.25,
        lagMinutesRange: [5, 20],
        curveDelayFraction: 0.08,
      },
      saves: {
        baseRatio: 0.012,
        ratioVariance: 0.30,
        lagMinutesRange: [45, 90],
        curveDelayFraction: 0.15,
        curveStretchFraction: 1.15,
      },
      shares: {
        baseRatio: 0.005,
        ratioVariance: 0.30,
        lagMinutesRange: [60, 240],
        sparse: true,
      },
      comments: {
        baseRatio: 0.002,
        ratioVariance: 0.40,
        lagMinutesRange: [120, 480],
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
        id: "cmvm1iusy0000j5quq9ozboir:101",
        providerId: "cmvm1iusy0000j5quq9ozboir",
        providerServiceId: "101",
        name: "Instagram Reel Views — Organic High Retention",
        minQuantity: 100,
        maxQuantity: 5000000,
        ratePer1000: 0.84,
      },
      likes: {
        id: "cmvm1iusy0000j5quq9ozboir:102",
        providerId: "cmvm1iusy0000j5quq9ozboir",
        providerServiceId: "102",
        name: "Instagram Natural Likes — Wave Paced",
        minQuantity: 10,
        maxQuantity: 250000,
        ratePer1000: 1.10,
      },
      saves: {
        id: "cmvm1iusy0000j5quq9ozboir:103",
        providerId: "cmvm1iusy0000j5quq9ozboir",
        providerServiceId: "103",
        name: "Instagram Post Saves & Bookmarks",
        minQuantity: 10,
        maxQuantity: 100000,
        ratePer1000: 1.45,
      },
      shares: {
        id: "cmvm1iusy0000j5quq9ozboir:104",
        providerId: "cmvm1iusy0000j5quq9ozboir",
        providerServiceId: "104",
        name: "Instagram Real Post Shares",
        minQuantity: 10,
        maxQuantity: 50000,
        ratePer1000: 2.20,
      },
      comments: {
        id: "cmvm1iusy0000j5quq9ozboir:105",
        providerId: "cmvm1iusy0000j5quq9ozboir",
        providerServiceId: "105",
        name: "Instagram Verified English Comments",
        minQuantity: 1,
        maxQuantity: 2500,
        ratePer1000: 8.00,
      },
    },
  },

  instagram_post: {
    id: "instagram_post",
    platform: "Instagram",
    name: "Instagram Photo / Carousel",
    badge: "Post (Photo)",
    description: "Front-loaded organic curve tailored for standard photo, carousel and grid posts.",
    explainerText:
      "Photo and carousel feed posts experience the vast majority of interactions within the first 48 hours. Our post pacing is front-loaded to match feed impression velocity.",
    presets: {
      fast: { key: "fast", label: "Fast Feed (24h)", hours: 24, durationPreset: "24h" },
      normal: { key: "normal", label: "Normal Pace (48h)", hours: 48, durationPreset: "48h", isDefault: true },
      slow: { key: "slow", label: "Sustained (96h / 4d)", hours: 96, durationPreset: "96h" },
    },
    defaultPreset: "normal",
    autoDurationTable: INSTAGRAM_POST_AUTO_DURATION_TABLE,
    maxNaturalViewsPerHour: 3000,
    viewsEnvelope: {
      kRange: [5.5, 7.5],
      mRange: [0.18, 0.28],
      noiseAmplitudeMax: 0.026,
    },
    archetypeWeights: {
      classic: 0.35,
      doubleWave: 0.30,
      stallAndSurge: 0.15,
      slowRamp: 0.10,
      earlySpike: 0.10,
    },
    tiers: INSTAGRAM_POST_TIER_CHECKPOINTS,
    types: {
      views: {
        baseRatio: 1.0,
        ratioVariance: 0,
        lagMinutesRange: [0, 0],
      },
      likes: {
        baseRatio: 0.045,
        ratioVariance: 0.25,
        lagMinutesRange: [5, 20],
        curveDelayFraction: 0.08,
      },
      saves: {
        baseRatio: 0.012,
        ratioVariance: 0.30,
        lagMinutesRange: [45, 90],
        curveDelayFraction: 0.15,
        curveStretchFraction: 1.15,
      },
      shares: {
        baseRatio: 0.005,
        ratioVariance: 0.30,
        lagMinutesRange: [60, 240],
        sparse: true,
      },
      comments: {
        baseRatio: 0.002,
        ratioVariance: 0.40,
        lagMinutesRange: [120, 480],
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
        id: "cmvm1iusy0000j5quq9ozboir:111",
        providerId: "cmvm1iusy0000j5quq9ozboir",
        providerServiceId: "111",
        name: "Instagram Post Impressions & Views",
        minQuantity: 100,
        maxQuantity: 10000000,
        ratePer1000: 0.84,
      },
      likes: {
        id: "cmvm1iusy0000j5quq9ozboir:112",
        providerId: "cmvm1iusy0000j5quq9ozboir",
        providerServiceId: "112",
        name: "Instagram Post Real Likes",
        minQuantity: 10,
        maxQuantity: 250000,
        ratePer1000: 1.10,
      },
      saves: {
        id: "cmvm1iusy0000j5quq9ozboir:113",
        providerId: "cmvm1iusy0000j5quq9ozboir",
        providerServiceId: "113",
        name: "Instagram Post Saves & Bookmarks",
        minQuantity: 10,
        maxQuantity: 100000,
        ratePer1000: 1.45,
      },
      shares: {
        id: "cmvm1iusy0000j5quq9ozboir:114",
        providerId: "cmvm1iusy0000j5quq9ozboir",
        providerServiceId: "114",
        name: "Instagram Real Post Shares",
        minQuantity: 10,
        maxQuantity: 50000,
        ratePer1000: 2.20,
      },
      comments: {
        id: "cmvm1iusy0000j5quq9ozboir:115",
        providerId: "cmvm1iusy0000j5quq9ozboir",
        providerServiceId: "115",
        name: "Instagram Verified English Comments",
        minQuantity: 1,
        maxQuantity: 2500,
        ratePer1000: 8.00,
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
    autoDurationTable: TIKTOK_AUTO_DURATION_TABLE,
    maxNaturalViewsPerHour: 2500,
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
    tiers: TIKTOK_TIER_CHECKPOINTS,
    types: {
      views: {
        baseRatio: 1.0,
        ratioVariance: 0,
        lagMinutesRange: [0, 0],
      },
      likes: {
        baseRatio: 0.060,
        ratioVariance: 0.25,
        lagMinutesRange: [5, 20],
        curveDelayFraction: 0.08,
      },
      saves: {
        baseRatio: 0.010,
        ratioVariance: 0.30,
        lagMinutesRange: [30, 90],
      },
      shares: {
        baseRatio: 0.005,
        ratioVariance: 0.30,
        lagMinutesRange: [60, 180],
        sparse: true,
      },
      comments: {
        baseRatio: 0.002,
        ratioVariance: 0.40,
        lagMinutesRange: [120, 360],
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
        id: "cmvm1iusy0000j5quq9ozboir:201",
        providerId: "cmvm1iusy0000j5quq9ozboir",
        providerServiceId: "201",
        name: "TikTok High Retention For You Views",
        minQuantity: 200,
        maxQuantity: 10000000,
        ratePer1000: 0.18,
      },
      likes: {
        id: "cmvm1iusy0000j5quq9ozboir:202",
        providerId: "cmvm1iusy0000j5quq9ozboir",
        providerServiceId: "202",
        name: "TikTok Feed Boost Likes",
        minQuantity: 20,
        maxQuantity: 500000,
        ratePer1000: 0.95,
      },
      saves: {
        id: "cmvm1iusy0000j5quq9ozboir:203",
        providerId: "cmvm1iusy0000j5quq9ozboir",
        providerServiceId: "203",
        name: "TikTok Favorites & Saves",
        minQuantity: 10,
        maxQuantity: 150000,
        ratePer1000: 1.25,
      },
      shares: {
        id: "cmvm1iusy0000j5quq9ozboir:204",
        providerId: "cmvm1iusy0000j5quq9ozboir",
        providerServiceId: "204",
        name: "TikTok Viral Post Shares",
        minQuantity: 15,
        maxQuantity: 100000,
        ratePer1000: 1.80,
      },
      comments: {
        id: "cmvm1iusy0000j5quq9ozboir:205",
        providerId: "cmvm1iusy0000j5quq9ozboir",
        providerServiceId: "205",
        name: "TikTok Relevant Engaging Comments",
        minQuantity: 1,
        maxQuantity: 3000,
        ratePer1000: 9.00,
      },
    },
  },
};

// ----------------------------------------------------------------------------
// In-Memory Profile Store with File Persistence (Node environment only)
// ----------------------------------------------------------------------------

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
 */
export function getPlatformProfile(idOrPlatform?: string): PlatformProfile {
  const map = loadProfilesFromDisk();
  const id = idOrPlatform?.toLowerCase() || "instagram_reel";

  if (map[id]) return map[id];
  if (id === "instagram") return map["instagram_reel"];
  if (id === "tiktok") return map["tiktok"];

  return map["instagram_reel"] || DEFAULT_PLATFORM_PROFILES.instagram_reel;
}

/**
 * Saves or registers a new platform profile entirely by config.
 */
export function savePlatformProfile(profile: PlatformProfile): void {
  const map = { ...loadProfilesFromDisk() };
  map[profile.id] = profile;
  saveProfilesToDisk(map);
}

/**
 * Updates the composite service mapping for a platform engagement type.
 */
export function updateEngagementServiceMapping(
  profileId: string,
  type: EngagementType,
  update: Partial<ServiceSpec>
): ServiceSpec {
  const map = { ...loadProfilesFromDisk() };
  const prof = map[profileId] || DEFAULT_PLATFORM_PROFILES[profileId];

  if (!prof) {
    throw new Error(`Platform profile not found: ${profileId}`);
  }

  const existing = prof.serviceMappings[type] || {
    providerId: "cmvm1iusy0000j5quq9ozboir",
    providerServiceId: "101",
    name: "Default Service",
    minQuantity: 10,
    maxQuantity: 100000,
    ratePer1000: 1.0,
  };

  const compositeId = update.id || `${update.providerId || existing.providerId}:${update.providerServiceId || existing.providerServiceId}`;

  const updated: ServiceSpec = {
    ...existing,
    ...update,
    id: compositeId,
    providerId: update.providerId || existing.providerId,
    providerServiceId: update.providerServiceId || existing.providerServiceId,
  };

  prof.serviceMappings[type] = updated;
  map[profileId] = prof;
  saveProfilesToDisk(map);

  return updated;
}

/**
 * Resolves the backend provider service for a given platform and engagement type.
 */
export function resolvePlatformService(profileId: string, type: EngagementType): ServiceSpec {
  const prof = getPlatformProfile(profileId);
  return prof.serviceMappings[type];
}

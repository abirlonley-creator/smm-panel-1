/**
 * AuraSMM Deterministic Pattern Engine (v2 Port)
 * 
 * 1) THE GOLDEN RULE: ONE PLAN OBJECT
 * generatePlan(platformConfig, packageKey, followers, baseSeed, options) returns one object:
 * viewsTotal, totals and rates per service, duration, rows[], trendCurve, chips, patternId.
 * - The graph is computed by accumulating rows[]. Graph point N = the cumulative sum through batch N.
 * - The batch table prints rows[], one row per batch. Row N in the table is exactly point N on the graph.
 * - Chips are sums of rows[]. The CSV prints rows[].
 * - At Launch, store the plan (planJson). The executor sends exactly those rows.
 * - "New Pattern" = new random seed = a completely new plan. Same seed = same plan.
 * - Zero hard-coded demo values.
 */

export type ServiceType = "views" | "likes" | "saves" | "reposts" | "shares" | "comments";
export type AuxiliaryServiceType = "likes" | "saves" | "reposts" | "shares" | "comments";
export const AUXILIARY_SERVICES: AuxiliaryServiceType[] = ["likes", "saves", "reposts", "shares", "comments"];

export type CommentsMode = "HYBRID" | "USER_ONLY" | "POOL_ONLY" | "DISABLED";

export interface PackageConfig {
  id: string;
  name: string;
  base_views?: number;
  views_total?: number; // fallback alias
  base_duration_hours?: number;
  duration_hours?: number; // fallback alias
  push_range?: [number, number];
  price_inr?: number;
  min_followers_note?: string;
  tagline?: string;
  badge?: string;
  enabled?: boolean;
  disabled?: boolean;
  // Legacy aliases
  likes?: number;
  saves?: number;
  shares?: number;
  comments?: number;
}

export interface ProviderMinimums {
  views: number;
  likes: number;
  saves: number;
  reposts: number;
  shares: number;
  comments: number;
}

export interface EffectiveMinimums {
  comments: number;
  saves: number;
  views?: number;
  likes?: number;
  shares?: number;
  reposts?: number;
}

export interface RateRanges {
  likes: [number, number];
  saves: [number, number];
  reposts: [number, number];
  comments: [number, number];
  shares: [number, number];
}

export interface EngineParams {
  LIKE_START: number; // default 0.02 (2%)
  GATE_VIEWS: number; // default 600
  GUARD: number; // default 1.6
  K_EXT: number; // default 260
  LIKES_CAP_REGULAR: number; // default 0.06 (6%)
  LIKES_CAP_LATE: number; // default 0.08 (8%)
  VIEW_BATCH_MIN: number; // default 100
  VIEW_BATCH_ENGAGEMENT_MIN: number; // default 200
  VIEW_BATCH_ENGAGEMENT_MIN_LATE: number; // default 150
  MAX_GAP_TICKS: number; // default 16 (4 hours)
  MAX_REPEAT_SIZE: number; // default 3
  CAP_FRACTION: number; // default 0.06
  CAP_MIN: number; // default 400
  GAP_WEIGHTS: number[]; // default [0.12, 0.20, 0.22, 0.20, 0.15, 0.11]
  SMALL_BATCH_THRESHOLD: number; // default 112
  SMALL_BATCH_JITTER: number; // default 75
  PUSH_SPLIT_MIN: number; // default 0.50
  PUSH_SPLIT_MAX: number; // default 0.65
  SHRINK_CAP_FACTOR: number; // default 0.67
  FINAL_FRACTION: number; // default 0.88 (late phase threshold)
}

export const DEFAULT_ENGINE_PARAMS: EngineParams = {
  LIKE_START: 0.02,
  GATE_VIEWS: 600,
  GUARD: 1.6,
  K_EXT: 260,
  LIKES_CAP_REGULAR: 0.06,
  LIKES_CAP_LATE: 0.08,
  VIEW_BATCH_MIN: 100,
  VIEW_BATCH_ENGAGEMENT_MIN: 200,
  VIEW_BATCH_ENGAGEMENT_MIN_LATE: 150,
  MAX_GAP_TICKS: 16,
  MAX_REPEAT_SIZE: 3,
  CAP_FRACTION: 0.06,
  CAP_MIN: 400,
  GAP_WEIGHTS: [0.12, 0.20, 0.22, 0.20, 0.15, 0.11],
  SMALL_BATCH_THRESHOLD: 112,
  SMALL_BATCH_JITTER: 75,
  PUSH_SPLIT_MIN: 0.50,
  PUSH_SPLIT_MAX: 0.65,
  SHRINK_CAP_FACTOR: 0.67,
  FINAL_FRACTION: 0.88,
};

export interface CommentPoolEntry {
  id?: string;
  commentText: string;
  category?: string;
  isActive?: boolean;
}

export interface PlatformConfig {
  id?: string;
  platform: "TikTok" | "Instagram";
  isEnabled?: boolean;
  pauseRunningOnDisable?: boolean;
  providerApiUrl?: string;
  providerApiKeyEnc?: string;
  providerTimeoutMs?: number;
  engineParams?: EngineParams;
  packages: Record<string, PackageConfig>;
  providerMinimums: ProviderMinimums;
  effectiveMinimums: EffectiveMinimums;
  rateRanges: RateRanges;
  commentsMode: CommentsMode;
  commentPool?: CommentPoolEntry[];
}

export interface PlanRow {
  index: number;
  tick: number;
  minuteOffset: number;
  clockTime: string;
  views: number;
  likes: number;
  saves: number;
  reposts: number;
  shares: number;
  comments: number;
  assignedComments?: string[];
  cumulativeViews: number;
  cumulativeLikes: number;
  cumulativeSaves: number;
  cumulativeReposts: number;
  cumulativeShares: number;
  cumulativeComments: number;
}

export interface PlanTotals {
  views: number;
  likes: number;
  saves: number;
  reposts: number;
  shares: number;
  comments: number;
}

export interface PlanRates {
  likes: number;
  saves: number;
  reposts: number;
  shares: number;
  comments: number;
}

export interface PlanChips {
  totalViews: number;
  totalBatches: number;
  durationHours: number;
  durationLabel: string;
  likes: number;
  saves: number;
  reposts: number;
  shares: number;
  comments: number;
}

export interface TrendPoint {
  pointIndex: number;
  tick: number;
  minuteOffset: number;
  clockTime: string;
  views: number;
  cumulativeViews: number;
  likes: number;
  cumulativeLikes: number;
  saves: number;
  cumulativeSaves: number;
  reposts: number;
  cumulativeReposts: number;
  shares: number;
  cumulativeShares: number;
  comments: number;
  cumulativeComments: number;
}

export interface ScheduledBatch {
  id?: string;
  tick: number;
  minuteOffset: number;
  clockTime?: string;
  service: ServiceType;
  quantity: number;
  cumulativeSoFar: number;
  cumulativeAfter?: number;
}

export interface PlanObject {
  patternId: string;
  seed: string;
  attempt: number;
  firstTryPass: boolean;
  engineVersion: string;
  packageId: string;
  packageName: string;
  viewsTotal: number;
  durationHours: number;
  durationLabel: string;
  totalDurationMinutes: number;
  rates: PlanRates;
  totals: PlanTotals;
  chips: PlanChips;
  rows: PlanRow[];
  trendCurve: TrendPoint[];
  batches: ScheduledBatch[];
  phases: Record<string, number>;
  engineParams: EngineParams;
  flushRows: Record<AuxiliaryServiceType, number[]>;
  flushAdds?: Record<AuxiliaryServiceType, Record<number, number>>;
  violations?: string[];
}

// DeterministicPlan alias for backward compatibility
export type DeterministicPlan = PlanObject;

// Default Constants
export const DEFAULT_PROVIDER_MINIMUMS: ProviderMinimums = {
  views: 100,
  likes: 10,
  saves: 10,
  reposts: 10,
  shares: 10,
  comments: 1,
};

export const DEFAULT_INSTAGRAM_PROVIDER_MINIMUMS: ProviderMinimums = {
  views: 100,
  likes: 10,
  saves: 1,
  reposts: 10,
  shares: 10,
  comments: 1,
};

export const DEFAULT_RATE_RANGES: RateRanges = {
  likes: [0.02, 0.035],
  saves: [0.003, 0.004],
  reposts: [0.0, 0.002],
  comments: [0.0, 0.001],
  shares: [0.0005, 0.003],
};

export const DEFAULT_PACKAGES: Record<string, PackageConfig> = {
  tiktok_2k: {
    id: "tiktok_2k",
    name: "2K Starter",
    base_views: 2000,
    views_total: 2000,
    base_duration_hours: 6,
    duration_hours: 6,
    push_range: [500, 700],
    price_inr: 16.91,
    min_followers_note: "< 1k followers",
    tagline: "Gradual, view-paced delivery",
    badge: "6 Hours",
  },
  tiktok_5k: {
    id: "tiktok_5k",
    name: "5K Velocity",
    base_views: 5000,
    views_total: 5000,
    base_duration_hours: 24,
    duration_hours: 24,
    push_range: [300, 500],
    price_inr: 29.24,
    min_followers_note: "Any follower count",
    tagline: "Gradual, view-paced delivery",
    badge: "24 Hours (1 Day)",
  },
  tiktok_10k: {
    id: "tiktok_10k",
    name: "10K Breakthrough",
    base_views: 10000,
    views_total: 10000,
    base_duration_hours: 48,
    duration_hours: 48,
    push_range: [300, 500],
    price_inr: 60.24,
    min_followers_note: "Any follower count",
    tagline: "Gradual, view-paced delivery",
    badge: "2 Days (48h)",
  },
  tiktok_15k: {
    id: "tiktok_15k",
    name: "15K Acceleration",
    base_views: 15000,
    views_total: 15000,
    base_duration_hours: 72,
    duration_hours: 72,
    push_range: [300, 500],
    price_inr: 87.24,
    min_followers_note: "Any follower count",
    tagline: "Gradual, view-paced delivery",
    badge: "3 Days (72h)",
  },
  tiktok_50k: {
    id: "tiktok_50k",
    name: "50K Mega Viral",
    base_views: 50000,
    views_total: 50000,
    base_duration_hours: 120,
    duration_hours: 120,
    push_range: [300, 500],
    price_inr: 290.75,
    min_followers_note: "Active posting accounts",
    tagline: "Gradual, view-paced delivery",
    badge: "5 Days (120h)",
  },
};

export const DEFAULT_TIKTOK_CONFIG: PlatformConfig = {
  platform: "TikTok",
  packages: DEFAULT_PACKAGES,
  providerMinimums: DEFAULT_PROVIDER_MINIMUMS,
  effectiveMinimums: { comments: 2, saves: 10, views: 100, likes: 10, shares: 10, reposts: 10 },
  rateRanges: DEFAULT_RATE_RANGES,
  commentsMode: "HYBRID",
  engineParams: DEFAULT_ENGINE_PARAMS,
};

export const DEFAULT_INSTAGRAM_CONFIG: PlatformConfig = {
  platform: "Instagram",
  packages: DEFAULT_PACKAGES,
  providerMinimums: DEFAULT_INSTAGRAM_PROVIDER_MINIMUMS,
  effectiveMinimums: { comments: 2, saves: 3, views: 100, likes: 10, shares: 10, reposts: 10 },
  rateRanges: DEFAULT_RATE_RANGES,
  commentsMode: "HYBRID",
  engineParams: DEFAULT_ENGINE_PARAMS,
};

// ============================================================================
// 2. MATHEMATICAL HELPERS, FNV-1a & MULBERRY32 PRNG
// ============================================================================

export function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export class Mulberry32 {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  nextU32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  uniform(low: number, high: number): number {
    return low + (this.nextU32() / 4294967296.0) * (high - low);
  }

  choice<T>(items: T[]): T {
    return items[Math.floor(this.uniform(0, items.length))];
  }

  weightedChoice<T>(items: T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    const r = this.uniform(0, total);
    let upto = 0;
    for (let i = 0; i < items.length; i++) {
      if (upto + weights[i] >= r) return items[i];
      upto += weights[i];
    }
    return items[items.length - 1];
  }

  lognormal(mu: number, sigma: number): number {
    const u1 = Math.max(1e-12, this.nextU32() / 4294967296.0);
    const u2 = this.nextU32() / 4294967296.0;
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return Math.exp(mu + sigma * z0);
  }
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3.0 - 2.0 * t);
}

export function formatDurationDaysHours(hours: number): string {
  const days = Math.floor(hours / 24);
  let remHours = Math.round(hours % 24);
  let actualDays = days;
  if (remHours === 24) {
    actualDays += 1;
    remHours = 0;
  }
  return `${actualDays} days ${remHours} hours`;
}

// ONE Shared Instantaneous Rate Function (Milestone 1 Correction 1 & Review Round 9 Item 4)
export function rateAt(
  service: string,
  cumViews: number,
  totalViews: number,
  pushViews: number,
  avgRate: number,
  phase: number,
  params: EngineParams = DEFAULT_ENGINE_PARAMS
): number {
  if (service === "likes") {
    const p = pushViews / Math.max(1, totalViews);
    const likeStart = Math.min(params.LIKE_START, 0.8 * avgRate);
    const R = (avgRate - p * likeStart - (1.0 - p) * 0.15 * likeStart) / Math.max(1e-6, (1.0 - p) * 0.85);
    if (cumViews <= pushViews) {
      return likeStart;
    }
    const postPushViews = totalViews - pushViews;
    const curPost = cumViews - pushViews;
    const fracPost = Math.min(1.0, Math.max(0, curPost / Math.max(1, postPushViews)));
    if (fracPost <= 0.3) {
      return likeStart + (R - likeStart) * (fracPost / 0.3);
    }
    return R;
  } else {
    const vFrac = cumViews / Math.max(1, totalViews);
    return avgRate * (1.0 + 0.2 * Math.sin(2.0 * Math.PI * vFrac + phase));
  }
}

// Pointwise modulation helper (Review Round 9 Item 1)
export function computeModulationPoint(
  t: number,
  waves: Array<{ depth: number; width: number; centre: number }>,
  tickHour: number,
  disableDiurnal = false
): number {
  let waveSum = 0;
  for (let w = 0; w < waves.length; w++) {
    const diff = (t - waves[w].centre) / waves[w].width;
    waveSum += waves[w].depth * Math.exp(-(diff * diff));
  }
  const diurnal = disableDiurnal ? 0 : 0.15 * Math.sin((2.0 * Math.PI * (tickHour - 14.0)) / 24.0);
  let m_t = 1.0 - waveSum + diurnal;
  m_t = Math.max(0.4, m_t);
  if (t >= 0.92) {
    m_t *= 1.0 - 0.3 * smoothstep(0.92, 1.0, t);
  }
  return m_t;
}

// ============================================================================
// 3. TARGET CUMULATIVE VIEWS CURVE C(t)
// ============================================================================

export function computeTargetCurve(
  T: number,
  pushTotal: number,
  viewsTotal: number,
  rng: Mulberry32,
  bdStartHour: number,
  disableDiurnal = false
): Float64Array {
  const numWaves = rng.choice([2, 3, 4]);
  const waves: Array<{ depth: number; width: number; centre: number }> = [];
  for (let w = 0; w < numWaves; w++) {
    waves.push({
      depth: rng.uniform(0.15, 0.5),
      width: rng.uniform(0.03, 0.07),
      centre: rng.uniform(0.12, 0.85),
    });
  }

  const rawRates = new Float64Array(T + 1);
  for (let tick = 0; tick <= T; tick++) {
    const t = tick / T;
    const g_t = 0.18 + 2.46 * (t * t);
    const tickHour = (bdStartHour + tick * 0.25) % 24.0;
    const m_t = computeModulationPoint(t, waves, tickHour, disableDiurnal);
    rawRates[tick] = g_t * m_t;
  }

  const cumRates = new Float64Array(T + 1);
  for (let i = 1; i <= T; i++) {
    cumRates[i] = cumRates[i - 1] + 0.5 * (rawRates[i - 1] + rawRates[i]);
  }

  const totalArea = cumRates[T];
  const C = new Float64Array(T + 1);
  const postPush = viewsTotal - pushTotal;
  for (let i = 0; i <= T; i++) {
    C[i] = pushTotal + postPush * (cumRates[i] / totalArea);
  }
  return C;
}

// ============================================================================
// 4. VIEWS BATCH GENERATION, DEDUPE & SAFE REBALANCE
// ============================================================================

export function generateViewsBatches(
  pushTotal: number,
  viewsTotal: number,
  T: number,
  C: Float64Array,
  rng: Mulberry32,
  params: EngineParams = DEFAULT_ENGINE_PARAMS
): Array<{ tick: number; views: number }> {
  const r1 = Math.max(params.VIEW_BATCH_MIN, Math.min(Math.round(pushTotal * rng.uniform(params.PUSH_SPLIT_MIN, params.PUSH_SPLIT_MAX)), pushTotal - params.VIEW_BATCH_MIN));
  const r2 = pushTotal - r1;
  const t2 = rng.choice([1, 2]);

  const batches: Array<{ tick: number; views: number }> = [
    { tick: 0, views: r1 },
    { tick: t2, views: r2 },
  ];
  let delivered = pushTotal;
  let currTick = t2;
  const CAP = Math.max(Math.floor(params.CAP_FRACTION * viewsTotal), params.CAP_MIN);
  const GAP_WEIGHTS = params.GAP_WEIGHTS;

  while (currTick < T) {
    let k = rng.weightedChoice([1, 2, 3, 4, 5, 6], GAP_WEIGHTS);

    while (currTick + k < T && C[Math.min(currTick + k, T)] - delivered < params.K_EXT && k < params.MAX_GAP_TICKS) {
      k++;
    }

    while (k > 1 && C[Math.min(currTick + k, T)] - delivered > params.SHRINK_CAP_FACTOR * CAP) {
      k--;
    }

    currTick = Math.min(T, currTick + k);

    if (currTick === T) {
      const remainder = viewsTotal - delivered;
      if (remainder <= 0) {
        delivered = viewsTotal;
        break;
      }

      if (remainder < params.VIEW_BATCH_MIN && batches.length > 0) {
        const lastIdx = batches.length - 1;
        const merged = batches[lastIdx].views + remainder;
        if (merged <= CAP) {
          batches[lastIdx].views = merged;
        } else {
          // Merging would exceed CAP: redistribute across previous batch and tick T
          let b2 = Math.max(params.VIEW_BATCH_MIN, Math.floor(merged / 2));
          let b1 = merged - b2;
          if (b1 > CAP) {
            b2 += (b1 - CAP);
            b1 = CAP;
          }
          if (b2 > CAP) {
            b1 += (b2 - CAP);
            b2 = CAP;
          }
          if (b1 === b2) {
            if (b1 < CAP) { b1++; b2--; } else { b1--; b2++; }
          }
          batches[lastIdx].views = b1;
          batches.push({ tick: T, views: b2 });
        }
      } else {
        if (remainder <= CAP) {
          batches.push({ tick: T, views: remainder });
        } else {
          let rem = remainder;
          while (rem > 0) {
            const b = Math.min(CAP, Math.max(params.VIEW_BATCH_MIN, rem));
            batches.push({ tick: T, views: b });
            rem -= b;
          }
        }
      }
      delivered = viewsTotal;
      break;
    }

    const targetBatch = C[currTick] - delivered;
    const noise = Math.max(0.55, Math.min(1.7, rng.lognormal(0.0, 0.4)));
    let size = Math.round(targetBatch * noise);
    if (size <= params.SMALL_BATCH_THRESHOLD) {
      size = params.VIEW_BATCH_MIN + Math.floor(rng.uniform(0, params.SMALL_BATCH_JITTER));
    }
    size = Math.max(params.VIEW_BATCH_MIN, Math.min(CAP, size));

    // Avoid consecutive duplicates and limit repeated values to at most 2 across plan
    const existingCount = batches.filter((b) => b.views === size).length;
    if ((batches.length > 0 && size === batches[batches.length - 1].views) || existingCount >= 2) {
      let adjusted = size;
      for (let delta = 1; delta <= 30; delta++) {
        const candidateDown = size - delta;
        if (candidateDown >= params.VIEW_BATCH_MIN) {
          const prevV = batches.length > 0 ? batches[batches.length - 1].views : -1;
          const cnt = batches.filter((b) => b.views === candidateDown).length;
          if (candidateDown !== prevV && cnt < 2) {
            adjusted = candidateDown;
            break;
          }
        }
        const candidateUp = size + delta;
        if (candidateUp <= CAP) {
          const prevV = batches.length > 0 ? batches[batches.length - 1].views : -1;
          const cnt = batches.filter((b) => b.views === candidateUp).length;
          if (candidateUp !== prevV && cnt < 2) {
            adjusted = candidateUp;
            break;
          }
        }
      }
      size = adjusted;
    }

    batches.push({ tick: currTick, views: size });
    delivered += size;
  }

  // Dedupe Pass BEFORE rebalance (Review Round 9 Item 2.d & Round 12 A.3)
  const valCounts: Record<number, number> = {};
  for (const b of batches) {
    valCounts[b.views] = (valCounts[b.views] || 0) + 1;
  }

  let dedupeIters = 0;
  for (let i = 0; i < batches.length; i++) {
    const b = batches[i];
    while (
      (i > 0 && b.views === batches[i - 1].views) ||
      (i + 1 < batches.length && b.views === batches[i + 1].views) ||
      valCounts[b.views] > 2
    ) {
      if (++dedupeIters > 5000) break;
      valCounts[b.views]--;
      let found = false;
      let candidate = b.views;
      for (let offset = 1; offset <= CAP; offset++) {
        const down = b.views - offset;
        if (down >= params.VIEW_BATCH_MIN) {
          const prevV = i > 0 ? batches[i - 1].views : -1;
          const nextV = i + 1 < batches.length ? batches[i + 1].views : -1;
          if (down !== prevV && down !== nextV && (valCounts[down] || 0) < 2) {
            candidate = down;
            found = true;
            break;
          }
        }
        const up = b.views + offset;
        if (up <= CAP) {
          const prevV = i > 0 ? batches[i - 1].views : -1;
          const nextV = i + 1 < batches.length ? batches[i + 1].views : -1;
          if (up !== prevV && up !== nextV && (valCounts[up] || 0) < 2) {
            candidate = up;
            found = true;
            break;
          }
        }
      }
      b.views = found ? candidate : (b.views < CAP ? b.views + 1 : b.views - 1);
      valCounts[b.views] = (valCounts[b.views] || 0) + 1;
    }
  }

  // Rebalance views difference across non-push batches (>= 2) with 5000 guard
  let diff = viewsTotal - batches.reduce((s, b) => s + b.views, 0);
  const rebalanceIndices: number[] = [];
  for (let i = 2; i < batches.length; i++) rebalanceIndices.push(i);

  let iterations = 0;
  while (diff !== 0 && rebalanceIndices.length > 0 && iterations < 5000) {
    iterations++;
    const idx = rng.choice(rebalanceIndices);
    let step = Math.floor(rng.uniform(1, 8)); // 1 to 7
    if (diff > 0) {
      step = Math.min(step, diff);
      const newV = batches[idx].views + step;
      if (newV <= CAP) {
        const prevV = idx > 0 ? batches[idx - 1].views : -1;
        const nextV = idx + 1 < batches.length ? batches[idx + 1].views : -1;
        if (newV !== prevV && newV !== nextV) {
          const cnt = batches.filter((b) => b.views === newV).length;
          if (cnt < 2) {
            batches[idx].views = newV;
            diff -= step;
          }
        }
      }
    } else {
      step = Math.min(step, Math.abs(diff));
      const newV = batches[idx].views - step;
      if (newV >= params.VIEW_BATCH_MIN) {
        const prevV = idx > 0 ? batches[idx - 1].views : -1;
        const nextV = idx + 1 < batches.length ? batches[idx + 1].views : -1;
        if (newV !== prevV && newV !== nextV) {
          const cnt = batches.filter((b) => b.views === newV).length;
          if (cnt < 2) {
            batches[idx].views = newV;
            diff += step;
          }
        }
      }
    }
  }

  // Final remainder merged or redistributed if < VIEW_BATCH_MIN
  if (batches.length > 1 && batches[batches.length - 1].views < params.VIEW_BATCH_MIN) {
    const lastV = batches[batches.length - 1].views;
    const prevV = batches[batches.length - 2].views;
    const merged = prevV + lastV;
    if (merged <= CAP) {
      batches[batches.length - 2].views = merged;
      batches.pop();
    } else {
      let b2 = Math.max(params.VIEW_BATCH_MIN, Math.floor(merged / 2));
      let b1 = merged - b2;
      batches[batches.length - 2].views = b1;
      batches[batches.length - 1].views = b2;
    }
  }

  return batches;
}

// ============================================================================
// 5. INFLOW CALCULATION & EXACT SUM SCALING
// ============================================================================

export function computeScaledInflows(
  batches: Array<{ tick: number; views: number }>,
  totals: PlanTotals,
  rates: PlanRates,
  viewsTotal: number,
  pushTotal: number,
  rng: Mulberry32,
  params: EngineParams = DEFAULT_ENGINE_PARAMS
): { inflows: Record<string, Float64Array>; phases: Record<string, number> } {
  const N = batches.length;
  const services: AuxiliaryServiceType[] = AUXILIARY_SERVICES;
  const inflows: Record<string, Float64Array> = {};
  for (const s of services) inflows[s] = new Float64Array(N);

  const phases: Record<string, number> = {};
  for (const s of services) phases[s] = rng.uniform(0.0, 2.0 * Math.PI);

  let cumV = 0;
  for (let i = 0; i < N; i++) {
    const b = batches[i];
    cumV += b.views;
    const prevV = i > 0 ? batches[i - 1].views : 0;

    let counted = 0;
    if (i === 0) {
      counted = 0.5 * b.views;
    } else if (i === N - 1) {
      counted = 0.5 * b.views + 0.5 * prevV + 0.5 * b.views;
    } else {
      counted = 0.5 * b.views + 0.5 * prevV;
    }

    for (const s of services) {
      if (!totals[s]) continue;
      const noise = rng.lognormal(0.0, 0.25);
      const instantRate = rateAt(s, cumV, viewsTotal, pushTotal, rates[s], phases[s], params);
      inflows[s][i] = counted * instantRate * noise;
    }
  }

  for (const s of services) {
    if (totals[s] > 0) {
      let rawSum = 0;
      for (let i = 0; i < N; i++) rawSum += inflows[s][i];
      if (rawSum > 0) {
        const scale = totals[s] / rawSum;
        for (let i = 0; i < N; i++) inflows[s][i] *= scale;
      }
    }
  }

  return { inflows, phases };
}

// ============================================================================
// 6. END FLUSH ALLOCATION WITH REPEAT CONTROL (Milestone 1 Correction 6)
// ============================================================================

export function applyEndFlush(
  rows: PlanRow[],
  remaining: Record<string, number>,
  totals: PlanTotals,
  config: PlatformConfig,
  viewsTotal: number,
  firstLikesIdx: number | null,
  releaseSizeCounts: Record<string, Record<number, number>>,
  params: EngineParams = config.engineParams || DEFAULT_ENGINE_PARAMS,
  flushRowsOut?: Record<AuxiliaryServiceType, number[]>,
  flushAddsOut?: Record<AuxiliaryServiceType, Record<number, number>>
): boolean {
  if (firstLikesIdx === null) return false;
  const N = rows.length;
  const cumArr = new Int32Array(N);
  let cV = 0;
  for (let i = 0; i < N; i++) {
    cV += rows[i].views;
    cumArr[i] = cV;
  }

  const candidates: number[] = [];
  for (let i = Math.max(0, N - 12); i < N; i++) {
    if (i > firstLikesIdx && cumArr[i] >= params.GATE_VIEWS) {
      const isFinal12 = cumArr[i] >= params.FINAL_FRACTION * viewsTotal;
      const minReq = isFinal12 ? params.VIEW_BATCH_ENGAGEMENT_MIN_LATE : params.VIEW_BATCH_ENGAGEMENT_MIN;
      if (rows[i].views >= minReq) {
        candidates.push(i);
      }
    }
  }

  if (candidates.length === 0) {
    return Object.values(remaining).every((r) => r === 0);
  }

  candidates.sort((a, b) => rows[b].views - rows[a].views);
  const top3 = candidates.slice(0, 3);

  const localFlushRows: Record<AuxiliaryServiceType, number[]> = {
    likes: [],
    saves: [],
    reposts: [],
    comments: [],
    shares: [],
  };
  const localFlushAdds: Record<AuxiliaryServiceType, Record<number, number>> = {
    likes: {},
    saves: {},
    reposts: {},
    comments: {},
    shares: {},
  };

  const services: AuxiliaryServiceType[] = AUXILIARY_SERVICES;
  for (const s of services) {
    let rem = remaining[s] || 0;
    if (rem <= 0) continue;
    const effMin = config.effectiveMinimums[s] ?? config.providerMinimums[s];
    const sFlush: number[] = [];

    if (s === "likes") {
      for (const idx of top3) {
        if (rem < effMin) break;
        const r = rows[idx];
        const isFinal12 = cumArr[idx] >= params.FINAL_FRACTION * viewsTotal;
        const cap = Math.floor((isFinal12 ? params.LIKES_CAP_LATE : params.LIKES_CAP_REGULAR) * r.views);
        const avail = Math.max(0, cap - r.likes);
        if (avail >= effMin) {
          const alloc = Math.min(rem, avail);
          if (r.likes === 0) {
            if ((releaseSizeCounts.likes[alloc] || 0) < params.MAX_REPEAT_SIZE) {
              r.likes = alloc;
              releaseSizeCounts.likes[alloc] = (releaseSizeCounts.likes[alloc] || 0) + 1;
              rem -= alloc;
              if (!sFlush.includes(idx)) sFlush.push(idx);
              localFlushAdds.likes[idx] = (localFlushAdds.likes[idx] || 0) + alloc;
            }
          } else {
            const oldVal = r.likes;
            const newVal = oldVal + alloc;
            if ((releaseSizeCounts.likes[newVal] || 0) < params.MAX_REPEAT_SIZE) {
              releaseSizeCounts.likes[oldVal]--;
              r.likes = newVal;
              releaseSizeCounts.likes[newVal] = (releaseSizeCounts.likes[newVal] || 0) + 1;
              rem -= alloc;
              if (!sFlush.includes(idx)) sFlush.push(idx);
              localFlushAdds.likes[idx] = (localFlushAdds.likes[idx] || 0) + alloc;
            }
          }
        }
      }
    } else {
      if (rem >= effMin) {
        const nParts = Math.min(top3.length, Math.max(1, Math.floor(rem / effMin)), 3);
        const partSize = Math.floor(rem / nParts);
        const leftover = rem % nParts;
        for (let pIdx = 0; pIdx < nParts; pIdx++) {
          const alloc = partSize + (pIdx === 0 ? leftover : 0);
          if (alloc >= effMin) {
            const idx = top3[pIdx];
            const r = rows[idx];
            if (r[s] === 0) {
              if (s === "comments" || (releaseSizeCounts[s][alloc] || 0) < params.MAX_REPEAT_SIZE) {
                r[s] = alloc;
                if (s !== "comments") releaseSizeCounts[s][alloc] = (releaseSizeCounts[s][alloc] || 0) + 1;
                rem -= alloc;
                if (!sFlush.includes(idx)) sFlush.push(idx);
                localFlushAdds[s][idx] = (localFlushAdds[s][idx] || 0) + alloc;
              }
            } else {
              const oldVal = r[s];
              const newVal = oldVal + alloc;
              if (s === "comments" || (releaseSizeCounts[s][newVal] || 0) < params.MAX_REPEAT_SIZE) {
                if (s !== "comments") releaseSizeCounts[s][oldVal]--;
                r[s] = newVal;
                if (s !== "comments") releaseSizeCounts[s][newVal] = (releaseSizeCounts[s][newVal] || 0) + 1;
                rem -= alloc;
                if (!sFlush.includes(idx)) sFlush.push(idx);
                localFlushAdds[s][idx] = (localFlushAdds[s][idx] || 0) + alloc;
              }
            }
          }
        }
      }
    }

    // Merge leftovers (< effMin) into existing qualifying releases among candidates in last 12 batches
    if (rem > 0) {
      const qualifying: Array<{ idx: number; r: PlanRow; oldVal: number; newVal: number; isTop3: boolean }> = [];
      for (const idx of candidates) {
        const r = rows[idx];
        if (r[s] >= effMin) {
          if (!sFlush.includes(idx) && sFlush.length >= 3) continue;
          const oldVal = r[s];
          const newVal = oldVal + rem;
          if (s !== "comments" && (releaseSizeCounts[s][newVal] || 0) >= params.MAX_REPEAT_SIZE) {
            continue;
          }
          const isTop3 = top3.includes(idx);
          if (s === "likes") {
            const isFinal = cumArr[idx] >= params.FINAL_FRACTION * viewsTotal;
            const cap = Math.floor((isFinal ? params.LIKES_CAP_LATE : params.LIKES_CAP_REGULAR) * r.views);
            if (newVal <= cap) {
              qualifying.push({ idx, r, oldVal, newVal, isTop3 });
            }
          } else {
            qualifying.push({ idx, r, oldVal, newVal, isTop3 });
          }
        }
      }

      if (qualifying.length > 0) {
        qualifying.sort((a, b) => (b.isTop3 ? 1 : 0) - (a.isTop3 ? 1 : 0) || b.oldVal - a.oldVal);
        const target = qualifying[0];
        if (s !== "comments") releaseSizeCounts[s][target.oldVal]--;
        target.r[s] = target.newVal;
        if (s !== "comments") releaseSizeCounts[s][target.newVal] = (releaseSizeCounts[s][target.newVal] || 0) + 1;
        if (!sFlush.includes(target.idx)) sFlush.push(target.idx);
        localFlushAdds[s][target.idx] = (localFlushAdds[s][target.idx] || 0) + rem;
        rem = 0;
      } else {
        return false;
      }
    }

    if (sFlush.length > 3) return false;
    localFlushRows[s] = sFlush.sort((a, b) => a - b);
  }

  if (flushRowsOut) {
    for (const s of services) {
      flushRowsOut[s] = localFlushRows[s] || [];
    }
  }
  if (flushAddsOut) {
    for (const s of services) {
      flushAddsOut[s] = localFlushAdds[s] || {};
    }
  }

  return true;
}

// ============================================================================
// 7. ENGAGEMENT DISTRIBUTION & REALISM RULES (Milestone 1 Corrections 1, 2, 3)
// ============================================================================

export function distributeEngagement(
  batches: Array<{ tick: number; views: number }>,
  totals: PlanTotals,
  rates: PlanRates,
  inflows: Record<string, Float64Array>,
  phases: Record<string, number>,
  config: PlatformConfig,
  viewsTotal: number,
  pushTotal: number,
  rng: Mulberry32,
  params: EngineParams = config.engineParams || DEFAULT_ENGINE_PARAMS
): { rows: PlanRow[]; flushRows: Record<AuxiliaryServiceType, number[]>; flushAdds: Record<AuxiliaryServiceType, Record<number, number>> } | null {
  const N = batches.length;
  const rows: PlanRow[] = batches.map((b, idx) => ({
    index: idx,
    tick: b.tick,
    minuteOffset: b.tick * 15,
    clockTime: `${String(Math.floor((b.tick * 15) / 60) % 24).padStart(2, "0")}:${String((b.tick * 15) % 60).padStart(2, "0")}`,
    views: b.views,
    likes: 0,
    saves: 0,
    shares: 0,
    reposts: 0,
    comments: 0,
    cumulativeViews: 0,
    cumulativeLikes: 0,
    cumulativeSaves: 0,
    cumulativeReposts: 0,
    cumulativeShares: 0,
    cumulativeComments: 0,
  }));

  const services: AuxiliaryServiceType[] = AUXILIARY_SERVICES;
  const buffers: Record<string, number> = {};
  const remaining: Record<string, number> = { ...totals };
  const lastReleaseViews: Record<string, number> = {};
  const countedViewsSinceLastRelease: Record<string, number> = {};
  const releaseSizeCounts: Record<string, Record<number, number>> = {};
  for (const s of services) {
    buffers[s] = 0;
    lastReleaseViews[s] = 0;
    countedViewsSinceLastRelease[s] = 0;
    releaseSizeCounts[s] = {};
  }

  let firstLikesIdx: number | null = null;
  let cumViews = 0;
  let lastMultiCombo = new Set<string>();
  let multiComboStreak = 0;

  // Small totals pre-scheduling
  const smallServices: Record<string, { releases: number[]; milestones: number[] }> = {};
  for (const s of services) {
    const tot = totals[s] || 0;
    const effMin = config.effectiveMinimums[s] ?? config.providerMinimums[s];
    if (tot > 0 && tot < config.providerMinimums[s]) {
      remaining[s] = 0;
    } else if (tot > 0 && tot < effMin) {
      smallServices[s] = { releases: [tot], milestones: [rng.uniform(0.4, 0.6)] };
    } else if (tot > 0 && tot < 3 * effMin) {
      const n = Math.floor(tot / effMin);
      const extra = tot % effMin;
      const parts = new Array(n).fill(effMin);
      for (let e = 0; e < extra; e++) {
        parts[Math.floor(rng.uniform(0, n))]++;
      }
      let milestones: number[] = [];
      if (n === 1) {
        milestones = [rng.uniform(0.4, 0.6)];
      } else {
        const step = (0.85 - 0.25) / (n - 1);
        for (let i = 0; i < n; i++) {
          milestones.push(0.25 + i * step + rng.uniform(-0.04, 0.04));
        }
      }
      smallServices[s] = { releases: parts, milestones };
    }
  }

  for (let i = 0; i < N; i++) {
    const b = rows[i];
    cumViews += b.views;
    const isFinal12 = cumViews >= params.FINAL_FRACTION * viewsTotal;

    const prevV = i > 0 ? rows[i - 1].views : 0;
    let counted = 0;
    if (i === 0) counted = 0.5 * b.views;
    else if (i === N - 1) counted = 0.5 * b.views + 0.5 * prevV + 0.5 * b.views;
    else counted = 0.5 * b.views + 0.5 * prevV;

    // Accumulate counted views since last release (Milestone 1 Correction 2)
    for (const s of services) {
      buffers[s] += inflows[s][i];
      countedViewsSinceLastRelease[s] += counted;
    }

    if (i === N - 1) continue;

    const minV = isFinal12 ? params.VIEW_BATCH_ENGAGEMENT_MIN_LATE : params.VIEW_BATCH_ENGAGEMENT_MIN;
    if (b.views < minV) {
      multiComboStreak = 0;
      continue;
    }

    const currentCombo = new Set<string>();
    const rateLikesI = rateAt("likes", cumViews, viewsTotal, pushTotal, rates.likes, phases.likes, params);

    // Snapshot state before release (Milestone 1 Correction 3)
    const prevBuffer = { ...buffers };
    const prevRemaining = { ...remaining };
    const prevCounted = { ...countedViewsSinceLastRelease };
    const prevLastRel = { ...lastReleaseViews };

    // --- LIKES RELEASE ---
    if (remaining.likes > 0) {
      const effMin = config.providerMinimums.likes;
      const prob = isFinal12 ? 0.95 : b.views >= 350 ? 0.85 : b.views >= 200 ? 0.55 : 0.25;
      const shouldRel = rng.uniform(0, 1) < prob || buffers.likes >= params.GUARD * effMin;

      if (shouldRel && buffers.likes >= effMin) {
        let cand = Math.max(effMin, Math.round(buffers.likes * rng.uniform(0.8, 1.0)));
        cand = Math.min(Math.floor(buffers.likes), cand, remaining.likes);

        const capPct = isFinal12 ? params.LIKES_CAP_LATE : params.LIKES_CAP_REGULAR;
        cand = Math.min(cand, Math.floor(capPct * b.views));
        const capDelta = Math.floor(params.GUARD * rateLikesI * countedViewsSinceLastRelease.likes);
        const v3 = b.views + (i > 0 ? rows[i - 1].views : 0) + (i > 1 ? rows[i - 2].views : 0);
        const cap3 = Math.floor(params.GUARD * rateLikesI * v3);
        cand = Math.min(cand, capDelta, cap3);

        if ((releaseSizeCounts.likes[cand] || 0) >= params.MAX_REPEAT_SIZE) {
          for (let probe = 1; probe <= 6; probe++) {
            const alt = cand + probe;
            if (
              alt <= buffers.likes &&
              alt <= Math.floor(capPct * b.views) &&
              alt <= capDelta &&
              alt <= cap3 &&
              (releaseSizeCounts.likes[alt] || 0) < params.MAX_REPEAT_SIZE
            ) {
              cand = alt;
              break;
            }
          }
        }

        if (cand >= effMin && (releaseSizeCounts.likes[cand] || 0) < params.MAX_REPEAT_SIZE) {
          b.likes = cand;
          buffers.likes -= cand;
          remaining.likes -= cand;
          lastReleaseViews.likes = cumViews;
          countedViewsSinceLastRelease.likes = 0;
          releaseSizeCounts.likes[cand] = (releaseSizeCounts.likes[cand] || 0) + 1;
          currentCombo.add("likes");
          if (firstLikesIdx === null) firstLikesIdx = i;
        }
      }
    }

    // --- NON-LIKES SERVICES (Strict Precedence: strictly after first likes batch) ---
    if (firstLikesIdx !== null && i > firstLikesIdx && cumViews >= params.GATE_VIEWS) {
      for (const s of ["saves", "shares", "reposts", "comments"] as AuxiliaryServiceType[]) {
        if (remaining[s] <= 0) continue;
        const effMin = config.effectiveMinimums[s] ?? config.providerMinimums[s];

        if (smallServices[s] && smallServices[s].milestones.length > 0) {
          const prog = cumViews / viewsTotal;
          if (prog >= smallServices[s].milestones[0]) {
            const rel = smallServices[s].releases.shift()!;
            smallServices[s].milestones.shift();
            b[s] = rel;
            buffers[s] -= rel;
            remaining[s] -= rel;
            lastReleaseViews[s] = cumViews;
            countedViewsSinceLastRelease[s] = 0;
            currentCombo.add(s);
          }
          continue;
        }

        const prob = isFinal12 ? 0.95 : b.views >= 350 ? 0.85 : b.views >= 200 ? 0.55 : 0.25;
        const shouldRel = rng.uniform(0, 1) < prob || buffers[s] >= params.GUARD * effMin;

        if (shouldRel && buffers[s] >= effMin) {
          let cand = Math.max(effMin, Math.round(buffers[s] * rng.uniform(0.8, 1.0)));
          cand = Math.min(Math.floor(buffers[s]), cand, remaining[s]);

          const rateSI = rateAt(s, cumViews, viewsTotal, pushTotal, rates[s], phases[s], params);
          const capDelta = Math.floor(params.GUARD * rateSI * countedViewsSinceLastRelease[s]);
          cand = Math.min(cand, capDelta);

          if (s !== "comments" && (releaseSizeCounts[s][cand] || 0) >= params.MAX_REPEAT_SIZE) {
            for (let probe = 1; probe <= 6; probe++) {
              const alt = cand + probe;
              if (
                alt <= buffers[s] &&
                alt <= capDelta &&
                (releaseSizeCounts[s][alt] || 0) < params.MAX_REPEAT_SIZE
              ) {
                cand = alt;
                break;
              }
            }
          }

          if (cand >= effMin && (s === "comments" || (releaseSizeCounts[s][cand] || 0) < params.MAX_REPEAT_SIZE)) {
            b[s] = cand;
            buffers[s] -= cand;
            remaining[s] -= cand;
            lastReleaseViews[s] = cumViews;
            countedViewsSinceLastRelease[s] = 0;
            releaseSizeCounts[s][cand] = (releaseSizeCounts[s][cand] || 0) + 1;
            currentCombo.add(s);
          }
        }
      }
    }

    // Invariant 10: Multi-service combination diversity (Rule Change E)
    if (currentCombo.size >= 2) {
      let isSame = currentCombo.size === lastMultiCombo.size;
      if (isSame) {
        const comboArr = Array.from(currentCombo);
        for (let k = 0; k < comboArr.length; k++) {
          if (!lastMultiCombo.has(comboArr[k])) {
            isSame = false;
            break;
          }
        }
      }

      if (isSame) {
        multiComboStreak++;
        if (multiComboStreak >= 2) {
          const removable = Array.from(currentCombo).filter((s) => s !== "likes") as ServiceType[];
          if (removable.length > 0) {
            const dropS = rng.choice(removable);
            const val = b[dropS];
            b[dropS] = 0;
            // Restore complete state (Milestone 1 Correction 3)
            buffers[dropS] = prevBuffer[dropS];
            remaining[dropS] = prevRemaining[dropS];
            countedViewsSinceLastRelease[dropS] = prevCounted[dropS];
            lastReleaseViews[dropS] = prevLastRel[dropS];
            releaseSizeCounts[dropS][val]--;
            currentCombo.delete(dropS);
            multiComboStreak = 0;
          }
        }
      } else {
        lastMultiCombo = new Set(currentCombo);
        multiComboStreak = 0;
      }
    } else {
      multiComboStreak = 0;
    }
  }

  const flushRows: Record<AuxiliaryServiceType, number[]> = {
    likes: [],
    saves: [],
    reposts: [],
    comments: [],
    shares: [],
  };
  const flushAdds: Record<AuxiliaryServiceType, Record<number, number>> = {
    likes: {},
    saves: {},
    reposts: {},
    comments: {},
    shares: {},
  };

  const flushOk = applyEndFlush(
    rows,
    remaining,
    totals,
    config,
    viewsTotal,
    firstLikesIdx,
    releaseSizeCounts,
    params,
    flushRows,
    flushAdds
  );
  if (!flushOk) return null;

  // Compute cumulative values
  let cV = 0, cL = 0, cS = 0, cR = 0, cSh = 0, cC = 0;
  for (let i = 0; i < N; i++) {
    cV += rows[i].views;
    cL += rows[i].likes;
    cS += rows[i].saves;
    cR += rows[i].reposts;
    cSh += rows[i].shares;
    cC += rows[i].comments;
    rows[i].cumulativeViews = cV;
    rows[i].cumulativeLikes = cL;
    rows[i].cumulativeSaves = cS;
    rows[i].cumulativeReposts = cR;
    rows[i].cumulativeShares = cSh;
    rows[i].cumulativeComments = cC;
  }

  return { rows, flushRows, flushAdds };
}

// ============================================================================
// 8. COMMENT SANITIZATION & ASSIGNMENT (Milestone 1 Correction 7 & Round 12 A.2)
// ============================================================================

export function sanitizeAndDedupeComments(lines: string[]): string[] {
  const sanitized = (lines || [])
    .map((l) =>
      l
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .replace(/[\x00-\x1F\x7F]/g, "")
        .trim()
    )
    .filter((l) => l.length > 0);

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const line of sanitized) {
    const lower = line.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      unique.push(line);
    }
  }
  return unique;
}

export function assignCommentsByMode(
  rows: PlanRow[],
  totalComments: number,
  mode: CommentsMode,
  pool: CommentPoolEntry[],
  userComments: string[] | undefined,
  rng: Mulberry32
): boolean {
  if (totalComments <= 0) return true;
  if (mode === "DISABLED") return false;

  const uniqueUser = sanitizeAndDedupeComments(userComments || []);
  const activePoolLines = (pool || [])
    .filter((c) => c.isActive !== false)
    .map((c) => c.commentText);
  const uniquePool = sanitizeAndDedupeComments(activePoolLines);

  let finalLines: string[] = [];
  if (mode === "USER_ONLY") {
    finalLines = uniqueUser;
  } else if (mode === "POOL_ONLY") {
    const shuffled = [...uniquePool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng.uniform(0, i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    finalLines = shuffled;
  } else {
    // HYBRID: User comments first, then unique pool lines
    const userLowers = new Set(uniqueUser.map((l) => l.toLowerCase()));
    const nonDupePool = uniquePool.filter((p) => !userLowers.has(p.toLowerCase()));
    for (let i = nonDupePool.length - 1; i > 0; i--) {
      const j = Math.floor(rng.uniform(0, i + 1));
      [nonDupePool[i], nonDupePool[j]] = [nonDupePool[j], nonDupePool[i]];
    }
    finalLines = [...uniqueUser, ...nonDupePool];
  }

  if (finalLines.length < totalComments) return false;

  let cursor = 0;
  for (const r of rows) {
    if (r.comments > 0) {
      r.assignedComments = finalLines.slice(cursor, cursor + r.comments);
      cursor += r.comments;
    }
  }

  return true;
}

// ============================================================================
// 9. VALIDATE PLAN (ALL 16 INVARIANTS) (Milestone 1 Correction 4 & Review Round 9 Items 5, 7, 8)
// ============================================================================

export function validatePlan(
  plan: {
    rows: PlanRow[];
    totals: PlanTotals;
    rates: PlanRates;
    viewsTotal: number;
    durationHours: number;
    batches?: ScheduledBatch[];
    trendCurve?: TrendPoint[];
    phases?: Record<string, number>;
    pushTotal?: number;
    engineParams?: EngineParams;
    flushRows?: Record<string, number[]>;
    flushAdds?: Record<AuxiliaryServiceType, Record<number, number>>;
  },
  config: PlatformConfig = DEFAULT_TIKTOK_CONFIG
): { isValid: boolean; violations: string[] } {
  const violations: string[] = [];
  const rows = plan.rows;
  const N = rows.length;
  const totals = plan.totals;
  const rates = plan.rates;
  const viewsTotal = plan.viewsTotal;
  const params = plan.engineParams || config.engineParams || DEFAULT_ENGINE_PARAMS;

  // 1. Exact Cumulative Totals (views + auxiliary services)
  const sumViews = rows.reduce((s, r) => s + r.views, 0);
  if (sumViews !== viewsTotal) violations.push("INVARIANT_1_VIEWS_TOTAL_MISMATCH");
  for (const s of AUXILIARY_SERVICES) {
    const sumS = rows.reduce((acc, r) => acc + r[s], 0);
    if (sumS !== (totals[s] || 0)) violations.push(`INVARIANT_1_${s.toUpperCase()}_TOTAL_MISMATCH`);
  }

  // 2. View boundaries (VIEW_BATCH_MIN <= views <= CAP)
  const CAP = Math.max(Math.floor(params.CAP_FRACTION * viewsTotal), params.CAP_MIN);
  for (let i = 0; i < N; i++) {
    if (rows[i].views < params.VIEW_BATCH_MIN) {
      violations.push(`INVARIANT_2_VIEW_BELOW_MIN_BATCH_${i}`);
    } else if (rows[i].views > CAP) {
      violations.push(`INVARIANT_2_VIEW_ABOVE_CAP_BATCH_${i}`);
    }
  }

  // 3. No adjacent equal batches & no value > twice
  const valCounts: Record<number, number> = {};
  for (let i = 0; i < N; i++) {
    const v = rows[i].views;
    if (i > 0 && v === rows[i - 1].views) violations.push(`INVARIANT_3_ADJACENT_EQUAL_BATCH_${i}`);
    valCounts[v] = (valCounts[v] || 0) + 1;
    if (valCounts[v] > 2) violations.push(`INVARIANT_3_VALUE_MORE_THAN_TWICE_${v}`);
  }

  // 4. Every batch has views > 0 (no engagement-only batches)
  for (let i = 0; i < N; i++) {
    if (rows[i].views <= 0) violations.push(`INVARIANT_4_ZERO_VIEW_BATCH_${i}`);
  }

  // Find first likes batch
  let firstLikesIdx: number | null = null;
  for (let i = 0; i < N; i++) {
    if (rows[i].likes > 0 && firstLikesIdx === null) {
      firstLikesIdx = i;
      break;
    }
  }

  // Pre-calculate cumulative views
  const cumArr = new Int32Array(N);
  let cV = 0;
  for (let i = 0; i < N; i++) {
    cV += rows[i].views;
    cumArr[i] = cV;
  }

  // Verify explicit flushRows (Review Round 10 Item 5)
  const flushRows = plan.flushRows || {
    likes: [],
    saves: [],
    reposts: [],
    comments: [],
    shares: [],
  };

  for (const s of AUXILIARY_SERVICES) {
    const sFlush = flushRows[s] || [];
    if (sFlush.length > 3) {
      violations.push(`INVARIANT_5_FLUSH_ROWS_EXCEEDED_COUNT_${s.toUpperCase()}`);
    }
    for (const idx of sFlush) {
      if (idx < 0 || idx >= N) {
        violations.push(`INVARIANT_5_FLUSH_ROW_OUT_OF_BOUNDS_${s.toUpperCase()}_${idx}`);
        continue;
      }
      if (idx < Math.max(0, N - 12)) {
        violations.push(`INVARIANT_5_FLUSH_ROW_NOT_IN_LAST_12_${s.toUpperCase()}_${idx}`);
      }
      if (firstLikesIdx === null || idx <= firstLikesIdx) {
        violations.push(`INVARIANT_5_FLUSH_ROW_BEFORE_FIRST_LIKES_${s.toUpperCase()}_${idx}`);
      }
      if (cumArr[idx] < params.GATE_VIEWS) {
        violations.push(`INVARIANT_5_FLUSH_ROW_BEFORE_GATE_VIEWS_${s.toUpperCase()}_${idx}`);
      }
      const isFinal = cumArr[idx] >= params.FINAL_FRACTION * viewsTotal;
      const minReq = isFinal ? params.VIEW_BATCH_ENGAGEMENT_MIN_LATE : params.VIEW_BATCH_ENGAGEMENT_MIN;
      if (rows[idx].views < minReq) {
        violations.push(`INVARIANT_5_FLUSH_ROW_BELOW_VIEW_GATE_${s.toUpperCase()}_${idx}`);
      }
      if (s === "likes") {
        const capPct = isFinal ? params.LIKES_CAP_LATE : params.LIKES_CAP_REGULAR;
        if (rows[idx].likes > Math.floor(capPct * rows[idx].views)) {
          violations.push(`INVARIANT_5_FLUSH_ROW_LIKES_CAP_EXCEEDED_${idx}`);
        }
      }
    }
  }

  const relCounts: Record<string, Record<number, number>> = {
    likes: {},
    saves: {},
    reposts: {},
    comments: {},
    shares: {},
  };

  let cumV = 0;
  for (let i = 0; i < N; i++) {
    const r = rows[i];
    cumV += r.views;
    const isFinal12 = cumV >= params.FINAL_FRACTION * viewsTotal;

    // 5. Batch view engagement gate
    const hasEngagement = r.likes > 0 || r.saves > 0 || r.reposts > 0 || r.comments > 0 || r.shares > 0;
    if (hasEngagement) {
      const minV = isFinal12 ? params.VIEW_BATCH_ENGAGEMENT_MIN_LATE : params.VIEW_BATCH_ENGAGEMENT_MIN;
      if (r.views < minV) {
        const servicesWithEngagement = AUXILIARY_SERVICES.filter((s) => r[s] > 0);
        const allInFlush = servicesWithEngagement.every((s) => flushRows[s]?.includes(i));
        if (!allInFlush) {
          violations.push(`INVARIANT_5_ENGAGEMENT_BELOW_VIEW_GATE_BATCH_${i}`);
        }
      }
    }

    // 12. Strict likes cap (6% regular, 8% final 12%)
    const capPct = isFinal12 ? params.LIKES_CAP_LATE : params.LIKES_CAP_REGULAR;
    if (r.likes > Math.floor(capPct * r.views)) {
      violations.push(`INVARIANT_12_LIKES_CAP_EXCEEDED_BATCH_${i}`);
    }

    if (r.likes > 0) {
      relCounts.likes[r.likes] = (relCounts.likes[r.likes] || 0) + 1;
    }

    // 6. Chronological precedence & 7. Effective minimums
    for (const s of ["saves", "reposts", "comments", "shares"] as AuxiliaryServiceType[]) {
      if (r[s] > 0) {
        relCounts[s][r[s]] = (relCounts[s][r[s]] || 0) + 1;
        if (firstLikesIdx === null || i <= firstLikesIdx || cumV < params.GATE_VIEWS) {
          violations.push(`INVARIANT_6_PRECEDENCE_VIOLATION_${s.toUpperCase()}_BATCH_${i}`);
        }
        const effMin = config.effectiveMinimums[s] ?? config.providerMinimums[s];
        const isSingleRel = (totals[s] || 0) > 0 && (totals[s] || 0) < effMin;
        if (!isSingleRel && r[s] < effMin) {
          violations.push(`INVARIANT_7_SUB_MINIMUM_${s.toUpperCase()}_BATCH_${i}`);
        }
      }
    }

    // 16. Comment Line Exactness (Row-level)
    if (r.comments > 0) {
      const lines = r.assignedComments || [];
      if (lines.length !== r.comments) {
        violations.push(`INVARIANT_16_COMMENT_LINES_COUNT_MISMATCH_BATCH_${i}`);
      }
      if (lines.some((l) => !l || l.trim().length === 0)) {
        violations.push(`INVARIANT_16_EMPTY_COMMENT_LINE_BATCH_${i}`);
      }
      const uniqueLines = new Set(lines.map((l) => l.toLowerCase()));
      if (uniqueLines.size !== lines.length) {
        violations.push(`INVARIANT_16_DUPLICATE_COMMENT_LINES_BATCH_${i}`);
      }
    }
  }

  // 16. ORDER-WIDE Invariant 16: No comment line appears twice in whole plan (Review Round 9 Item 7)
  const allAssignedComments: string[] = [];
  for (let i = 0; i < N; i++) {
    if (rows[i].comments > 0 && rows[i].assignedComments) {
      allAssignedComments.push(...rows[i].assignedComments!);
    }
  }
  if (totals.comments > 0 && allAssignedComments.length !== totals.comments) {
    violations.push("INVARIANT_16_TOTAL_ASSIGNED_COMMENTS_COUNT_MISMATCH");
  }
  const seenComments = new Set<string>();
  for (const c of allAssignedComments) {
    const lower = c.trim().toLowerCase();
    if (seenComments.has(lower)) {
      violations.push(`INVARIANT_16_ORDER_WIDE_DUPLICATE_COMMENT_${lower}`);
    }
    seenComments.add(lower);
  }

  // 8. Service rate ranges & Core engagement sum bounds
  for (const s of AUXILIARY_SERVICES) {
    const [minR, maxR] = config.rateRanges[s];
    if (rates[s] < minR - 1e-4 || rates[s] > maxR + 1e-4) {
      violations.push(`INVARIANT_8_RATE_OUT_OF_BOUNDS_${s.toUpperCase()}`);
    }
  }
  const coreSum = rates.likes + rates.saves + rates.reposts + rates.comments;
  if (coreSum < 0.023 || coreSum > 0.042) {
    violations.push("INVARIANT_8_CORE_ENGAGEMENT_SUM_OUT_OF_BOUNDS");
  }

  // 9. Increasing timestamps on 15-min grid, gaps <= MAX_GAP_TICKS
  for (let i = 1; i < N; i++) {
    const gap = rows[i].tick - rows[i - 1].tick;
    if (gap <= 0 || gap > params.MAX_GAP_TICKS) {
      violations.push(`INVARIANT_9_TICK_GAP_INVALID_BATCH_${i}`);
    }
  }

  // 10. Multi-service combination diversity (Rule Change E: applies only to |S| >= 2)
  for (let i = 0; i < N - 2; i++) {
    const s1 = new Set(AUXILIARY_SERVICES.filter((s) => rows[i][s] > 0));
    const s2 = new Set(AUXILIARY_SERVICES.filter((s) => rows[i + 1][s] > 0));
    const s3 = new Set(AUXILIARY_SERVICES.filter((s) => rows[i + 2][s] > 0));
    if (s1.size >= 2 && s1.size === s2.size && s2.size === s3.size) {
      let allMatch = true;
      const s1Arr = Array.from(s1);
      for (let k = 0; k < s1Arr.length; k++) {
        const e = s1Arr[k];
        if (!s2.has(e) || !s3.has(e)) allMatch = false;
      }
      if (allMatch) violations.push(`INVARIANT_10_REPEAT_MULTI_COMBO_BATCH_${i}`);
    }
  }

  // 11. Repeat limit (comments exempt)
  for (const s of ["likes", "saves", "reposts", "shares"] as AuxiliaryServiceType[]) {
    for (const [qty, count] of Object.entries(relCounts[s])) {
      if (count > params.MAX_REPEAT_SIZE) violations.push(`INVARIANT_11_REPEAT_SIZE_EXCEEDED_${s.toUpperCase()}_${qty}`);
    }
  }

  // 13. Pacing caps (excluding explicit flush additions)
  const pushViews = plan.pushTotal || (rows.length >= 2 ? rows[0].views + rows[1].views : 0);
  const phases = plan.phases || { likes: 0, saves: 0, reposts: 0, comments: 0, shares: 0 };
  const countedViewsSinceLastRel: Record<string, number> = { likes: 0, saves: 0, reposts: 0, comments: 0, shares: 0 };
  const flushAdds = plan.flushAdds || ({} as Record<AuxiliaryServiceType, Record<number, number>>);

  cumV = 0;
  for (let i = 0; i < N; i++) {
    const r = rows[i];
    cumV += r.views;
    const prevV = i > 0 ? rows[i - 1].views : 0;
    let counted = 0;
    if (i === 0) counted = 0.5 * r.views;
    else if (i === N - 1) counted = 0.5 * r.views + 0.5 * prevV + 0.5 * r.views;
    else counted = 0.5 * r.views + 0.5 * prevV;

    for (const s of AUXILIARY_SERVICES) {
      countedViewsSinceLastRel[s] += counted;
    }

    const flushAddLikes = flushAdds.likes?.[i] ?? (plan.flushAdds ? 0 : (flushRows.likes?.includes(i) ? r.likes : 0));
    const regularLikes = r.likes - flushAddLikes;
    if (regularLikes > 0) {
      const rateL = rateAt("likes", cumV, viewsTotal, pushViews, rates.likes, phases.likes, params);
      const capDelta = Math.floor(params.GUARD * rateL * countedViewsSinceLastRel.likes);
      const v3 = r.views + (i > 0 ? rows[i - 1].views : 0) + (i > 1 ? rows[i - 2].views : 0);
      const cap3 = Math.floor(params.GUARD * rateL * v3);
      if (regularLikes > capDelta || regularLikes > cap3) {
        violations.push(`INVARIANT_13_PACING_CAP_EXCEEDED_LIKES_BATCH_${i}`);
      }
      countedViewsSinceLastRel.likes = 0;
    }

    for (const s of ["saves", "reposts", "comments", "shares"] as AuxiliaryServiceType[]) {
      const flushAddS = flushAdds[s]?.[i] ?? (plan.flushAdds ? 0 : (flushRows[s]?.includes(i) ? r[s] : 0));
      const regularS = r[s] - flushAddS;
      if (regularS > 0) {
        const effMin = config.effectiveMinimums[s] ?? config.providerMinimums[s];
        const isSmallTotal = (totals[s] || 0) < 3 * effMin;
        if (!isSmallTotal) {
          const rateS = rateAt(s, cumV, viewsTotal, pushViews, rates[s], phases[s], params);
          const capDelta = Math.floor(params.GUARD * rateS * countedViewsSinceLastRel[s]);
          if (regularS > capDelta) {
            violations.push(`INVARIANT_13_PACING_CAP_EXCEEDED_${s.toUpperCase()}_BATCH_${i}`);
          }
        }
        countedViewsSinceLastRel[s] = 0;
      }
    }
  }

  // 14. Peak window rate constraint
  // In any sliding window W = max(1 hour, duration/8), views in W <= floor(3 * (W / duration) * viewsTotal)
  const durHours = plan.durationHours || 24;
  const windowHours = Math.max(1.0, durHours / 8.0);
  const windowTicks = Math.round(windowHours * 4);
  const maxViewsInWindow = Math.floor(3.0 * (windowHours / durHours) * viewsTotal + 1e-9);
  const maxTick = Math.max(Math.round(durHours * 4), N > 0 ? rows[N - 1].tick : 0);

  for (let t = 0; t <= maxTick; t++) {
    const endTick = t + windowTicks;
    let windowViews = 0;
    for (let i = 0; i < N; i++) {
      if (rows[i].tick >= t && rows[i].tick <= endTick) {
        windowViews += rows[i].views;
      }
    }
    if (windowViews > maxViewsInWindow) {
      violations.push(`INVARIANT_14_PEAK_WINDOW_RATE_EXCEEDED_TICK_${t}`);
      break;
    }
  }

  // 15. Monotonicity & Exact Cumulative Match (detects corrupted/edited plans - Review Round 9 Item 8)
  let runningV = 0;
  const runningAux: Record<AuxiliaryServiceType, number> = {
    likes: 0,
    saves: 0,
    reposts: 0,
    comments: 0,
    shares: 0,
  };

  for (let i = 0; i < N; i++) {
    runningV += rows[i].views;
    if (rows[i].cumulativeViews !== runningV) {
      violations.push(`INVARIANT_15_CUMULATIVE_VIEWS_MISMATCH_BATCH_${i}`);
    }
    if (i > 0 && rows[i].cumulativeViews < rows[i - 1].cumulativeViews) {
      violations.push(`INVARIANT_15_NON_MONOTONIC_VIEWS_BATCH_${i}`);
    }

    for (const s of AUXILIARY_SERVICES) {
      runningAux[s] += rows[i][s];
      const field = `cumulative${s.charAt(0).toUpperCase() + s.slice(1)}` as keyof PlanRow;
      if (rows[i][field] !== runningAux[s]) {
        violations.push(`INVARIANT_15_CUMULATIVE_${s.toUpperCase()}_MISMATCH_BATCH_${i}`);
      }
      if (i > 0 && (rows[i][field] as number) < (rows[i - 1][field] as number)) {
        violations.push(`INVARIANT_15_NON_MONOTONIC_${s.toUpperCase()}_BATCH_${i}`);
      }
    }
  }

  if (runningV !== viewsTotal) {
    violations.push("INVARIANT_15_FINAL_CUMULATIVE_VIEWS_NOT_EQUAL_TOTAL");
  }
  for (const s of AUXILIARY_SERVICES) {
    if (runningAux[s] !== (totals[s] || 0)) {
      violations.push(`INVARIANT_15_FINAL_CUMULATIVE_${s.toUpperCase()}_NOT_EQUAL_TOTAL`);
    }
  }

  return { isValid: violations.length === 0, violations };
}

// ============================================================================
// 10. MASTER PLAN GENERATION (UP TO 50 ATTEMPTS) (Milestone 1 Correction 9 & Review Round 9 Items 5, 6)
// ============================================================================

export interface GeneratePlanOptions {
  platformConfig?: PlatformConfig;
  bdStartHour?: number;
  bdHour?: number;
  userComments?: string[];
  userCommentLines?: string[];
  commentsMode?: CommentsMode;
  providerMinimums?: ProviderMinimums;
  startDate?: Date;
  [key: string]: any;
}

/**
 * Server-generated cryptographic seeds only (Review Round 9 Item 6).
 * In production, seeds must always be generated on the server using cryptographic randomness (16 bytes = 32 hex chars).
 */
export function generateCryptographicSeed(): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require("crypto");
    return nodeCrypto.randomBytes(16).toString("hex");
  } catch {
    throw new Error("Cryptographic random seed generation is not supported in this runtime environment.");
  }
}

export function generatePlan(
  arg1: PlatformConfig | PackageConfig | string,
  arg2?: PackageConfig | string | number,
  arg3?: number | string,
  arg4?: string | GeneratePlanOptions,
  arg5?: GeneratePlanOptions
): PlanObject {
  let config: PlatformConfig;
  let packageInput: PackageConfig | string;
  let followers: number;
  let baseSeedStr: string | undefined;
  let options: GeneratePlanOptions | undefined;

  if (typeof arg1 === "object" && arg1 !== null && "packages" in arg1 && "providerMinimums" in arg1) {
    config = arg1 as PlatformConfig;
    packageInput = arg2 as (PackageConfig | string);
    followers = typeof arg3 === "number" ? arg3 : 1000;
    baseSeedStr = typeof arg4 === "string" ? arg4 : undefined;
    options = arg5 || (typeof arg4 === "object" ? arg4 : undefined);
  } else {
    options = arg5 || (typeof arg4 === "object" ? arg4 : (typeof arg3 === "object" ? arg3 as any : undefined));
    config = options?.platformConfig || DEFAULT_TIKTOK_CONFIG;
    packageInput = arg1 as (PackageConfig | string);
    followers = typeof arg2 === "number" ? arg2 : 1000;
    baseSeedStr = typeof arg3 === "string" ? arg3 : (typeof arg2 === "string" && isNaN(Number(arg2)) ? arg2 : undefined);
  }

  let pkg: PackageConfig;
  if (typeof packageInput === "string") {
    const foundPkg = config.packages?.[packageInput] || DEFAULT_PACKAGES[packageInput];
    if (!foundPkg) {
      throw new Error(`Unknown package key: "${packageInput}". Available packages: ${Object.keys(config.packages || {}).join(", ")}`);
    }
    pkg = foundPkg;
  } else if (packageInput && typeof packageInput === "object") {
    pkg = packageInput;
  } else {
    throw new Error(`Invalid package input: ${String(packageInput)}`);
  }

  // Server-generated cryptographic seeds only. Never rely on client-side Math.random() in production.
  const baseSeed = baseSeedStr || generateCryptographicSeed();
  const params = config.engineParams || DEFAULT_ENGINE_PARAMS;

  // Milestone 1 Correction 9: Compute real BD clock hour at server time (UTC+6)
  let bdStartHour = options?.bdHour ?? options?.bdStartHour;
  if (bdStartHour === undefined) {
    const now = new Date();
    const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
    bdStartHour = (utcHours + 6.0) % 24.0;
  }

  const commentsMode: CommentsMode = options?.commentsMode || config.commentsMode || "HYBRID";
  const userCommentsList: string[] = options?.userCommentLines || options?.userComments || [];

  // Dedupe pool lines & user comments with unified sanitizer (Review Round 12 Item A.2)
  const pool = config.commentPool || [];
  const activePoolLines = pool
    .filter((c) => c.isActive !== false)
    .map((c) => c.commentText);
  const uniquePool = sanitizeAndDedupeComments(activePoolLines);
  const uniqueUser = sanitizeAndDedupeComments(userCommentsList);
  const userLowers = new Set(uniqueUser.map((l) => l.toLowerCase()));
  const nonDupePool = uniquePool.filter((p) => !userLowers.has(p.toLowerCase()));

  for (let attempt = 0; attempt < 50; attempt++) {
    const attemptSeedStr = `${baseSeed}:${attempt}`;
    const seedU32 = fnv1a32(attemptSeedStr);
    const rng = new Mulberry32(seedU32);

    const baseViews = pkg.base_views ?? pkg.views_total ?? 2000;
    const baseHours = pkg.base_duration_hours ?? pkg.duration_hours ?? 6;
    const pushBounds = pkg.push_range ?? [300, 500];

    const overshoot = rng.uniform(1.0, 1.3);
    const viewsTotal = Math.round(baseViews * overshoot);

    const durFactor = rng.uniform(0.85, 1.15);
    const T = Math.max(12, Math.round(baseHours * durFactor * 4));
    const durationHours = T / 4.0;

    // Draw push ONCE before curve generation (Milestone 1 Correction A.1)
    let pushMin = pushBounds[0];
    let pushMax = pushBounds[1];
    let pLow: number, pHigh: number;
    if (followers < 1000) {
      pLow = pushMin;
      pHigh = pushMin + (pushMax - pushMin) / 3.0;
    } else if (followers <= 10000) {
      pLow = pushMin + (pushMax - pushMin) / 3.0;
      pHigh = pushMin + (2.0 * (pushMax - pushMin)) / 3.0;
    } else {
      pLow = pushMin + (2.0 * (pushMax - pushMin)) / 3.0;
      pHigh = pushMax;
    }
    const pushTotal = Math.max(200, Math.min(Math.round(rng.uniform(pLow, pHigh)), viewsTotal - 200));

    // Sample rates & totals
    const rates: PlanRates = {
      likes: rng.uniform(config.rateRanges.likes[0], config.rateRanges.likes[1]),
      saves: rng.uniform(config.rateRanges.saves[0], config.rateRanges.saves[1]),
      reposts: rng.uniform(config.rateRanges.reposts[0], config.rateRanges.reposts[1]),
      comments: rng.uniform(config.rateRanges.comments[0], config.rateRanges.comments[1]),
      shares: rng.uniform(config.rateRanges.shares[0], config.rateRanges.shares[1]),
    };

    const totals: PlanTotals = {
      views: viewsTotal,
      likes: 0,
      saves: 0,
      reposts: 0,
      comments: 0,
      shares: 0,
    };

    for (const s of ["likes", "saves", "reposts", "comments", "shares"] as ServiceType[]) {
      if (s === "views") continue;
      let tot = Math.round(viewsTotal * rates[s]);
      if (s === "comments") {
        if (commentsMode === "DISABLED") {
          tot = 0;
        } else if (commentsMode === "USER_ONLY") {
          tot = Math.min(tot, uniqueUser.length);
        } else if (commentsMode === "POOL_ONLY") {
          tot = Math.min(tot, uniquePool.length);
        } else {
          tot = Math.min(tot, uniqueUser.length + nonDupePool.length);
        }
      }
      totals[s] = tot >= config.providerMinimums[s] ? tot : 0;
    }

    // Compute curve & batches
    const C = computeTargetCurve(T, pushTotal, viewsTotal, rng, bdStartHour);
    const batches = generateViewsBatches(pushTotal, viewsTotal, T, C, rng, params);

    // Inflows & distribution
    const { inflows, phases } = computeScaledInflows(batches, totals, rates, viewsTotal, pushTotal, rng, params);
    const dist = distributeEngagement(batches, totals, rates, inflows, phases, config, viewsTotal, pushTotal, rng, params);
    if (!dist) continue;
    const { rows, flushRows, flushAdds } = dist;

    // Assign comments by mode
    if (totals.comments > 0) {
      const ok = assignCommentsByMode(
        rows,
        totals.comments,
        commentsMode,
        pool,
        userCommentsList,
        rng
      );
      if (!ok) continue;
    }

    // Validation
    const val = validatePlan(
      { rows, totals, rates, viewsTotal, durationHours, phases, pushTotal, engineParams: params, flushRows, flushAdds },
      config
    );

    if (val.isValid) {
      // Build Chips, Curve & Batches
      const chips: PlanChips = {
        totalViews: viewsTotal,
        totalBatches: rows.length,
        durationHours,
        durationLabel: formatDurationDaysHours(durationHours),
        likes: totals.likes,
        saves: totals.saves,
        reposts: totals.reposts,
        shares: totals.shares,
        comments: totals.comments,
      };

      const trendCurve: TrendPoint[] = rows.map((r) => ({
        pointIndex: r.index,
        tick: r.tick,
        minuteOffset: r.minuteOffset,
        clockTime: r.clockTime,
        views: r.views,
        cumulativeViews: r.cumulativeViews,
        likes: r.likes,
        cumulativeLikes: r.cumulativeLikes,
        saves: r.saves,
        cumulativeSaves: r.cumulativeSaves,
        reposts: r.reposts,
        cumulativeReposts: r.cumulativeReposts,
        shares: r.shares,
        cumulativeShares: r.cumulativeShares,
        comments: r.comments,
        cumulativeComments: r.cumulativeComments,
      }));

      const scheduledBatches: ScheduledBatch[] = [];
      for (const r of rows) {
        if (r.views > 0) {
          scheduledBatches.push({
            tick: r.tick,
            minuteOffset: r.minuteOffset,
            clockTime: r.clockTime,
            service: "views",
            quantity: r.views,
            cumulativeSoFar: r.cumulativeViews,
          });
        }
        for (const s of ["likes", "saves", "reposts", "comments", "shares"] as ServiceType[]) {
          if (r[s] > 0) {
            scheduledBatches.push({
              tick: r.tick,
              minuteOffset: r.minuteOffset,
              clockTime: r.clockTime,
              service: s,
              quantity: r[s],
              cumulativeSoFar: (r as any)[`cumulative${s.charAt(0).toUpperCase() + s.slice(1)}`],
            });
          }
        }
      }

      return {
        patternId: `pattern_${attemptSeedStr}`,
        seed: attemptSeedStr,
        attempt,
        firstTryPass: attempt === 0,
        engineVersion: "2.0.0",
        packageId: pkg.id,
        packageName: pkg.name,
        viewsTotal,
        durationHours,
        durationLabel: formatDurationDaysHours(durationHours),
        totalDurationMinutes: T * 15,
        rates,
        totals,
        chips,
        rows,
        trendCurve,
        batches: scheduledBatches,
        phases,
        engineParams: params,
        flushRows,
        flushAdds,
      };
    }
  }

  throw new Error("Plan generation failed to converge within 50 attempts.");
}

// Backward-compatible alias
export const generatePattern = generatePlan;
export const generatePlanV2 = generatePlan;

// Test Helper (Milestone 1 Correction 10)
export function firstLikesCumulativeViews(plan: PlanObject): number | null {
  for (const r of plan.rows) {
    if (r.likes > 0) return r.cumulativeViews;
  }
  return null;
}

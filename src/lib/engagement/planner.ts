/**
 * Organic Full Engagement Delivery Pacing Plan Generator
 * 
 * Generates natural-looking, realistic S-curve delivery schedules
 * for views, likes, saves, shares, and comments.
 * 
 * Config-driven architecture supporting:
 * - TikTok FYP videos
 * - Instagram Reels (multi-wave organic algorithm)
 * - Instagram Posts (front-loaded photo/carousel feed delivery)
 * - Any future platform profile added purely by data/config.
 * 
 * Pure, deterministic, well-tested module shared directly between
 * the backend worker and frontend live preview (preview == real delivery).
 */

import {
  getPlatformProfile,
  PlatformProfile,
  ProfilePresetKey,
  resolvePlatformService,
  drawRealisticTotals,
  RealisticTotalsResult,
  TierRange,
  computeAutoDuration,
  formatDurationHours,
  validateCustomDuration,
} from "./platform-profiles";

export type EngagementType = "views" | "likes" | "shares" | "saves" | "comments";

export type DurationPreset = "24h" | "48h" | "72h" | "96h" | "168h";

export type PatternArchetype =
  | "classic"
  | "double-wave"
  | "stall-and-surge"
  | "slow-ramp"
  | "early-spike";

export interface ServiceSpec {
  id?: string;
  providerId?: string;
  providerServiceId?: string;
  name: string;
  minQuantity: number;
  maxQuantity: number;
  ratePer1000: number;
}

export interface PlannedRun {
  engagementType: EngagementType;
  runIndex: number;
  scheduledAt: string; // ISO UTC string
  minutesFromStart: number;
  quantity: number;
  cumulativeQuantity: number;
  cost: number;
  serviceId?: string;
  providerId?: string;
  providerServiceId?: string;
  minQuantityOverrideNote?: string;
  isPeak?: boolean;
  isNearMinimum?: boolean;
}

export interface TypeDeliveryPlan {
  engagementType: EngagementType;
  targetRatio: number;
  totalQuantity: number;
  runsCount: number;
  serviceName: string;
  minQuantity: number;
  maxQuantity: number;
  ratePer1000: number;
  totalCost: number;
  startLagMinutes: number;
  autoDisabled?: boolean;
  autoDisabledReason?: string | null;
  runs: PlannedRun[];
}

export interface CurvePoint {
  minutes: number;
  timeLabel: string;
  views: number;
  likes: number;
  shares: number;
  saves: number;
  comments: number;
}

export interface RatioPoint {
  minutes: number;
  timeLabel: string;
  likesRatioPct: number;
  savesRatioPct: number;
  sharesRatioPct: number;
  commentsRatioPct: number;
  targetLikesPct: number;
  targetSavesPct: number;
  targetSharesPct: number;
  targetCommentsPct: number;
}

export interface BatchTimelineEntry {
  type: EngagementType;
  runIndex: number;
  minutes: number;
  scheduledAt: string;
  quantity: number;
  isPeak: boolean;
}

export interface PlanParams {
  seed: number;
  k: number;
  m: number;
  archetype: PatternArchetype;
  noiseAmplitude: number;
  durationPreset: DurationPreset;
  durationHours: number;
  targetTz: string;
  profileId: string;
  profileName: string;
  ratios: Record<EngagementType, number>;
  finalRatios?: Record<EngagementType, number>;
  ratioCaps?: Record<EngagementType, number>;
  startLagsMinutes: Record<EngagementType, number>;
  plannedRunCounts: Record<EngagementType, number>;
  pausesCount: number;
  burstsCount: number;
  fingerprint: string;
}

export interface OrganicPlanResult {
  seed: number;
  seedString: string;
  platform: string;
  profileId: string;
  profileName: string;
  baseViews: number;
  isAutoDuration: boolean;
  autoDurationRange?: [number, number];
  durationPreset: DurationPreset;
  durationHours: number;
  durationLabel: string;
  estimatedFinishTime: string;
  targetTz: string;
  totalCost: number;
  params: PlanParams;
  plans: Record<EngagementType, TypeDeliveryPlan>;
  allRuns: PlannedRun[];
  curvePoints: CurvePoint[];
  ratioPoints: RatioPoint[];
  batchTimeline: BatchTimelineEntry[];
  summaryChips: {
    totalViews: number;
    totalRuns: number;
    durationHours: number;
    durationLabel: string;
    archetype: string;
    preset: string;
    totalCost: number;
  };
  realisticTotals?: RealisticTotalsResult;
  suggestedRanges?: Record<EngagementType, TierRange>;
  suggestedTotals?: Record<EngagementType, number>;
  sourceFlags?: Record<EngagementType, "suggested" | "custom">;
  autoDisabledTypes?: Record<EngagementType, boolean>;
  autoDisableNotes?: Record<EngagementType, string | null>;
  softHints?: Record<EngagementType, string | null>;
  providerMinNotes?: Record<EngagementType, string | null>;
}

export interface PlanOptions {
  platform?: "Instagram" | "TikTok" | string;
  profileId?: string; // "instagram_reel" | "instagram_post" | "tiktok"
  presetKey?: ProfilePresetKey; // "fast" | "normal" | "slow"
  pacingMode?: "auto" | "custom";
  customSpeedPreset?: "faster" | "slower" | "exact";
  customDurationHours?: number;
  baseViews: number;
  seed?: number | string;
  startTime?: Date | string;
  targetTz?: string;
  durationPreset?: DurationPreset;
  durationHours?: number; // legacy support: 24, 48, 72, 96, 168
  enabledTypes?: EngagementType[];
  peakHourWeighting?: boolean;
  services?: Partial<Record<EngagementType, ServiceSpec>>;
  customRatios?: Partial<Record<EngagementType, number>>;
  customQuantities?: Partial<Record<EngagementType, number>>;
  customSources?: Partial<Record<EngagementType, "suggested" | "custom">>;
  typeToggles?: Partial<Record<EngagementType, boolean>>;
  autoDisableBelowMin?: boolean;
}

/**
 * 32-bit FNV-1a Hash to normalize seed input into a deterministic unsigned 32-bit integer.
 */
export function normalizeSeed(seed: number | string | undefined): number {
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return (seed >>> 0) || 123456789;
  }
  const str = String(seed || "dhansmm_seed_1");
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) || 123456789;
}

/**
 * Derives an isolated sub-seed for an engagement type or subsystem.
 * Guarantees that changing one type's randomness never alters the others.
 */
export function hashSubSeed(seed: number, namespace: string): number {
  const str = `${seed}:${namespace}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) || 1;
}

/**
 * Mulberry32 PRNG for deterministic, high-quality pseudo-random numbers in [0, 1).
 */
export function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Normalized logistic S-curve component:
 * L(t) = 1 / (1 + exp(-k * (t - m)))
 * F(t) = (L(t) - L(0)) / (L(1) - L(0))
 */
export function normalizedLogistic(t: number, k: number, m: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  const L = (x: number) => 1 / (1 + Math.exp(-k * (x - m)));
  const L0 = L(0);
  const L1 = L(1);
  const val = (L(t) - L0) / (L1 - L0);
  return Math.max(0, Math.min(1, val));
}

/**
 * Generates smooth 1D value noise scaled to at most maxAmplitude (within ±3%).
 */
function generateValueNoise(rng: () => number, pointsCount = 10, maxAmplitude = 0.026): (t: number) => number {
  const nodes: number[] = [0]; // at t=0, noise=0
  for (let i = 1; i < pointsCount - 1; i++) {
    nodes.push((rng() * 2 - 1) * maxAmplitude);
  }
  nodes.push(0); // at t=1, noise=0

  return (t: number): number => {
    const clampedT = Math.max(0, Math.min(1, t));
    const scaled = clampedT * (pointsCount - 1);
    const index = Math.min(pointsCount - 2, Math.floor(scaled));
    const fraction = scaled - index;

    // Smoothstep interpolation
    const smooth = fraction * fraction * (3 - 2 * fraction);
    return nodes[index] + (nodes[index + 1] - nodes[index]) * smooth;
  };
}

/**
 * Computes audience local hour in target timezone, with daylight saving support.
 */
export function getHourInAudienceTz(date: Date, targetTz: string): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: targetTz,
      hour: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const hourPart = parts.find((p) => p.type === "hour");
    return hourPart ? parseInt(hourPart.value, 10) % 24 : date.getUTCHours();
  } catch {
    return date.getUTCHours();
  }
}

/**
 * Determines peak hour multiplier for audience time zone based on platform profile.
 * Default: +40% during 12:00-14:00 (lunch peak) and 19:00-23:00 (evening peak).
 */
export function getPeakHourMultiplier(
  date: Date,
  targetTz: string,
  enabled: boolean,
  profile?: PlatformProfile
): number {
  if (!enabled) return 1.0;
  const hour = getHourInAudienceTz(date, targetTz);
  const windows = profile?.peakHours?.windows || [
    { startHour: 12, endHour: 14 },
    { startHour: 19, endHour: 23 },
  ];
  const mult = profile?.peakHours?.multiplier ?? 1.4;

  const isPeak = windows.some((w) => hour >= w.startHour && hour < w.endHour);
  return isPeak ? mult : 1.0;
}

/**
 * Computes plan fingerprint for uniqueness comparison.
 */
export function computePlanFingerprint(
  archetype: PatternArchetype,
  k: number,
  m: number,
  sampledPoints: number[]
): string {
  const roundedK = k.toFixed(2);
  const roundedM = m.toFixed(2);
  return `${archetype}:${roundedK}:${roundedM}:${sampledPoints.join(",")}`;
}

/**
 * Computes cumulative curve area distance between two plans.
 */
export function computeCurveDistance(planA: OrganicPlanResult, planB: OrganicPlanResult): number {
  const ptsA = planA.curvePoints;
  const ptsB = planB.curvePoints;
  const count = Math.min(ptsA.length, ptsB.length);
  if (count === 0) return 1.0;

  let totalDiff = 0;
  for (let i = 0; i < count; i++) {
    const fractionA = ptsA[i].views / Math.max(1, planA.baseViews);
    const fractionB = ptsB[i].views / Math.max(1, planB.baseViews);
    totalDiff += Math.abs(fractionA - fractionB);
  }

  return totalDiff / count;
}

/**
 * Exact integer allocation using Largest Remainder (Hare-Niemeyer) Method.
 */
function allocateIntegersLargestRemainder(unrounded: number[], targetTotal: number): number[] {
  const floors = unrounded.map(Math.floor);
  let currentSum = floors.reduce((a, b) => a + b, 0);
  let remainder = targetTotal - currentSum;

  const remainders = unrounded.map((val, idx) => ({
    idx,
    fraction: val - floors[idx],
  }));
  remainders.sort((a, b) => b.fraction - a.fraction);

  const result = [...floors];
  for (let i = 0; i < remainder && i < remainders.length; i++) {
    result[remainders[i].idx]++;
  }

  return result;
}

/**
 * Box-Muller standard normal variate generator.
 */
export function drawNormal(rng: () => number): number {
  let u1 = 0;
  let u2 = 0;
  while (u1 === 0) u1 = rng();
  while (u2 === 0) u2 = rng();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * Checks for monotone streak longer than 3 in an array of batch sizes.
 * Returns true if any 4 consecutive elements are strictly increasing or strictly decreasing.
 */
export function hasMonotoneStreakLongerThan3(sizes: number[]): boolean {
  if (sizes.length < 4) return false;
  let incStreak = 1;
  let decStreak = 1;

  for (let i = 1; i < sizes.length; i++) {
    if (sizes[i] > sizes[i - 1]) {
      incStreak++;
      decStreak = 1;
      if (incStreak > 3) return true;
    } else if (sizes[i] < sizes[i - 1]) {
      decStreak++;
      incStreak = 1;
      if (decStreak > 3) return true;
    } else {
      incStreak = 1;
      decStreak = 1;
    }
  }
  return false;
}

/**
 * Computes lag-1 autocorrelation r1.
 */
export function computeAutocorrelation(sizes: number[]): number {
  if (sizes.length < 3) return 0;
  const n = sizes.length;
  const mean = sizes.reduce((a, b) => a + b, 0) / n;
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    const diff = sizes[i] - mean;
    denominator += diff * diff;
    if (i < n - 1) {
      numerator += diff * (sizes[i + 1] - mean);
    }
  }

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Generates an authentic batch size distribution per Change B & C:
 * - Target run count scaled by provider minimum: runs = min(floor(total / provider_min), target_runs).
 * - Log-normal batch size distribution clamped to [provider_min, provider_max].
 * - 15-25% of batches land at or very near provider minimum (randomly scattered, never 3 consecutive).
 * - Sizes are not sorted, alternating, or periodic (rejects monotone streaks > 3 and strong autocorrelation).
 * - Never create a run below provider minimum; merge sub-minimum batches; exact total conservation.
 */
export function generateAuthenticBatches(params: {
  total: number;
  minQuantity: number;
  maxQuantity: number;
  targetRuns: number;
  rng: () => number;
  envelopeWeights?: number[];
  maxSingleRunFrac?: number; // e.g. 0.25 for secondary types
  maxBatchCap?: number; // hard ceiling on individual batch size (e.g. 3 for comments)
}): number[] {
  const { total, minQuantity, maxQuantity, targetRuns, rng, envelopeWeights, maxSingleRunFrac, maxBatchCap } = params;
  if (total <= 0) return [];

  const maxPossibleRuns = Math.floor(total / minQuantity);
  if (maxPossibleRuns <= 1) {
    return [total];
  }

  const N = Math.max(1, Math.min(maxPossibleRuns, targetRuns));
  if (N === 1) {
    return [total];
  }

  // 15-25% of batches land at or very near provider minimum
  const nearFraction = 0.15 + rng() * 0.10;
  let nearCount = Math.round(N * nearFraction);
  if (N >= 4 && nearCount < 1) nearCount = 1;

  // Make sure we leave enough total for remaining batches to each be >= minQuantity
  while (nearCount > 0 && (total - nearCount * minQuantity) < (N - nearCount) * minQuantity) {
    nearCount--;
  }

  // Pick nearCount random indices without 3 consecutive
  // Prioritize off-peak indices if envelopeWeights are provided to preserve peak hour boosts
  const nearIndices = new Set<number>();
  const availableIndices = Array.from({ length: N }, (_, i) => i);
  if (envelopeWeights && envelopeWeights.length === N) {
    availableIndices.sort((a, b) => {
      const wa = (envelopeWeights[a] ?? 1.0) + (rng() - 0.5) * 0.05;
      const wb = (envelopeWeights[b] ?? 1.0) + (rng() - 0.5) * 0.05;
      return wa - wb;
    });
  } else {
    for (let i = availableIndices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [availableIndices[i], availableIndices[j]] = [availableIndices[j], availableIndices[i]];
    }
  }

  for (const idx of availableIndices) {
    if (nearIndices.size >= nearCount) break;
    if (nearIndices.has(idx - 1) && nearIndices.has(idx - 2)) continue;
    if (nearIndices.has(idx + 1) && nearIndices.has(idx + 2)) continue;
    if (nearIndices.has(idx - 1) && nearIndices.has(idx + 1)) continue;
    nearIndices.add(idx);
  }

  const batchSizes: number[] = new Array(N).fill(0);
  let assignedSum = 0;
  const nearMaxJitter = Math.max(1, Math.round(0.05 * minQuantity));

  nearIndices.forEach((idx) => {
    const jitter = Math.floor(rng() * nearMaxJitter);
    const sz = minQuantity + jitter;
    batchSizes[idx] = sz;
    assignedSum += sz;
  });

  const remainingCount = N - nearIndices.size;
  const remainingTotal = total - assignedSum;

  if (remainingCount > 0) {
    const nonNearIndices = Array.from({ length: N }, (_, i) => i).filter((i) => !nearIndices.has(i));
    const rawWeights: number[] = [];

    for (let k = 0; k < nonNearIndices.length; k++) {
      const idx = nonNearIndices[k];
      const env = envelopeWeights && envelopeWeights[idx] !== undefined ? envelopeWeights[idx] : 1.0;
      const z = drawNormal(rng);
      const logNormalMultiplier = Math.exp(z * 0.35);
      rawWeights.push(Math.max(0.1, env * logNormalMultiplier));
    }

    const weightSum = rawWeights.reduce((a, b) => a + b, 0);
    const unrounded = rawWeights.map((w) => (w / weightSum) * remainingTotal);
    const allocated = allocateIntegersLargestRemainder(unrounded, remainingTotal);

    for (let k = 0; k < nonNearIndices.length; k++) {
      batchSizes[nonNearIndices[k]] = allocated[k];
    }
  }

  // Cap per batch: if maxSingleRunFrac provided and total >= 4 * minQuantity, cap non-forced runs
  let cap = (maxSingleRunFrac && total >= 4 * minQuantity)
    ? Math.max(minQuantity, Math.ceil(maxSingleRunFrac * total))
    : maxQuantity;
  if (maxBatchCap !== undefined && maxBatchCap > 0) {
    cap = Math.min(cap, maxBatchCap);
  }

  for (let i = 0; i < N; i++) {
    if (batchSizes[i] < minQuantity) batchSizes[i] = minQuantity;
    if (batchSizes[i] > cap) batchSizes[i] = cap;
  }

  // Exact total conservation
  let curSum = batchSizes.reduce((a, b) => a + b, 0);
  let passes = 0;
  while (curSum !== total && passes < 300) {
    passes++;
    const diff = total - curSum;
    if (diff > 0) {
      const eligible = batchSizes
        .map((sz, idx) => ({ sz, idx }))
        .filter((item) => item.sz < cap);
      if (eligible.length > 0) {
        const target = eligible[Math.floor(rng() * eligible.length)];
        const step = Math.min(diff, Math.max(1, cap - target.sz));
        batchSizes[target.idx] += step;
        curSum += step;
      } else {
        if (maxBatchCap) {
          const addSz = Math.min(diff, cap);
          batchSizes.push(addSz);
          curSum += addSz;
        } else {
          batchSizes[0] += diff;
          curSum += diff;
        }
      }
    } else {
      const sub = -diff;
      const eligible = batchSizes
        .map((sz, idx) => ({ sz, idx }))
        .filter((item) => item.sz > minQuantity);
      if (eligible.length > 0) {
        const target = eligible[Math.floor(rng() * eligible.length)];
        const step = Math.min(sub, target.sz - minQuantity);
        if (step > 0) {
          batchSizes[target.idx] -= step;
          curSum -= step;
        } else {
          break;
        }
      } else {
        break;
      }
    }
  }

  // Merging pass: if any batch < minQuantity, merge into neighbor
  let list = [...batchSizes];
  let changed = true;
  while (changed && list.length > 1) {
    changed = false;
    for (let i = 0; i < list.length; i++) {
      if (list[i] < minQuantity) {
        if (i < list.length - 1) {
          list[i + 1] += list[i];
          list.splice(i, 1);
        } else {
          list[i - 1] += list[i];
          list.splice(i, 1);
        }
        changed = true;
        break;
      }
    }
  }

  // Fix monotone streaks > 3 and strong autocorrelation (|r1| > 0.65)
  let streakAttempts = 0;
  while (
    list.length >= 4 &&
    streakAttempts < 25 &&
    (hasMonotoneStreakLongerThan3(list) || Math.abs(computeAutocorrelation(list)) > 0.65)
  ) {
    streakAttempts++;
    for (let i = 1; i < list.length - 2; i++) {
      if (
        (list[i - 1] < list[i] && list[i] < list[i + 1] && list[i + 1] < list[i + 2]) ||
        (list[i - 1] > list[i] && list[i] > list[i + 1] && list[i + 1] > list[i + 2])
      ) {
        const swapTarget = Math.floor(rng() * list.length);
        const temp = list[i + 1];
        list[i + 1] = list[swapTarget];
        list[swapTarget] = temp;
      }
    }
  }

  let finalSum = list.reduce((a, b) => a + b, 0);
  let adjLoops = 0;
  while (finalSum !== total && list.length > 0 && adjLoops < 500) {
    adjLoops++;
    const diff = total - finalSum;
    if (diff > 0) {
      let added = false;
      for (let i = 0; i < list.length && finalSum < total; i++) {
        if (list[i] < cap) {
          list[i]++;
          finalSum++;
          added = true;
        }
      }
      if (!added) {
        if (maxBatchCap) {
          list.push(Math.min(diff, cap));
          finalSum += Math.min(diff, cap);
        } else {
          list[0] += diff;
          finalSum += diff;
        }
      }
    } else {
      let subtracted = false;
      for (let i = 0; i < list.length && finalSum > total; i++) {
        if (list[i] > minQuantity) {
          list[i]--;
          finalSum--;
          subtracted = true;
        }
      }
      if (!subtracted) break;
    }
  }

  return list;
}

/**
 * Enforces Provider Minimum & Maximum Order Size Rules:
 * - While any run < min, merge into nearest neighbor.
 * - Split runs above maxQuantity.
 * - Exact total conservation.
 */
export function mergeSubMinimumRuns(
  runs: { minute: number; quantity: number }[],
  minQuantity: number,
  maxQuantity: number,
  targetTotal: number
): { minute: number; quantity: number }[] {
  if (runs.length === 0) return [];

  if (runs.length === 1) {
    return [{ minute: runs[0].minute, quantity: targetTotal }];
  }

  let list = runs.map((r) => ({ ...r }));

  let changed = true;
  while (changed && list.length > 1) {
    changed = false;
    for (let i = 0; i < list.length; i++) {
      if (list[i].quantity < minQuantity) {
        if (i < list.length - 1) {
          list[i + 1].quantity += list[i].quantity;
          list.splice(i, 1);
        } else {
          list[i - 1].quantity += list[i].quantity;
          list.splice(i, 1);
        }
        changed = true;
        break;
      }
    }
  }

  if (list.length === 1) {
    list[0].quantity = targetTotal;
  }

  const bounded: { minute: number; quantity: number }[] = [];
  for (const b of list) {
    if (maxQuantity > 0 && b.quantity > maxQuantity) {
      let rem = b.quantity;
      let offset = 0;
      while (rem > 0) {
        const chunk = Math.min(rem, maxQuantity);
        bounded.push({ minute: b.minute + offset, quantity: chunk });
        rem -= chunk;
        offset++;
      }
    } else {
      bounded.push(b);
    }
  }

  const sum = bounded.reduce((acc, b) => acc + b.quantity, 0);
  if (sum !== targetTotal && bounded.length > 0) {
    bounded[bounded.length - 1].quantity += targetTotal - sum;
  }

  return bounded;
}

/**
 * Backward compatibility spec mapping
 */
export const DEFAULT_SERVICE_SPECS: Record<"Instagram" | "TikTok", Record<EngagementType, ServiceSpec>> = {
  Instagram: {
    views: { name: "Instagram Real Views — Organic Pace", minQuantity: 100, maxQuantity: 5000000, ratePer1000: 0.15 },
    likes: { name: "Instagram HQ Natural Likes", minQuantity: 20, maxQuantity: 250000, ratePer1000: 0.85 },
    shares: { name: "Instagram Real Post Shares", minQuantity: 10, maxQuantity: 50000, ratePer1000: 2.10 },
    saves: { name: "Instagram Post Saves & Bookmarks", minQuantity: 10, maxQuantity: 100000, ratePer1000: 1.40 },
    comments: { name: "Instagram Verified English Comments", minQuantity: 1, maxQuantity: 2500, ratePer1000: 8.50 },
  },
  TikTok: {
    views: { name: "TikTok High Retention For You Views", minQuantity: 200, maxQuantity: 10000000, ratePer1000: 0.18 },
    likes: { name: "TikTok Feed Boost Likes", minQuantity: 20, maxQuantity: 500000, ratePer1000: 0.95 },
    shares: { name: "TikTok Viral Post Shares", minQuantity: 15, maxQuantity: 100000, ratePer1000: 1.80 },
    saves: { name: "TikTok Favorites & Saves", minQuantity: 10, maxQuantity: 150000, ratePer1000: 1.25 },
    comments: { name: "TikTok Relevant Engaging Comments", minQuantity: 1, maxQuantity: 3000, ratePer1000: 9.00 },
  },
};

/**
 * Generates the deterministic organic delivery plan.
 * Pure, config-driven, and shared between worker and preview.
 */
export function generateOrganicPlan(options: PlanOptions): OrganicPlanResult {
  // Resolve Config-Driven Platform Profile
  const profileId = options.profileId || (options.platform?.toLowerCase() === "tiktok" ? "tiktok" : "instagram_reel");
  const profile = getPlatformProfile(profileId);
  const platform = profile.platform;

  const baseViews = Math.max(1, Math.round(options.baseViews));
  const rawSeed = options.seed ?? Math.floor(Math.random() * 100000000);
  const seedInt = normalizeSeed(rawSeed);

  // Duration Resolution per Change A: Auto-duration by view count is the recommended default
  let durationHours: number;
  let durationPreset: DurationPreset;
  let isAutoDuration = true;
  const autoDur = computeAutoDuration(profile, baseViews, seedInt);
  const autoDurationRange: [number, number] = [autoDur.minHours, autoDur.maxHours];

  const PRESET_HOURS: Record<DurationPreset, number> = {
    "24h": 24,
    "48h": 48,
    "72h": 72,
    "96h": 96,
    "168h": 168,
  };

  if (options.pacingMode === "custom" || (options.customDurationHours !== undefined && options.customDurationHours > 0)) {
    isAutoDuration = false;
    const requested = options.customDurationHours || (options.durationHours ?? autoDur.durationHours);
    const val = validateCustomDuration(profile, baseViews, requested);
    if (!val.valid) {
      throw new Error(`Validation error: ${val.reason}`);
    }
    durationHours = requested;
  } else if (options.presetKey && profile.presets[options.presetKey]) {
    isAutoDuration = false;
    const opt = profile.presets[options.presetKey];
    durationHours = opt.hours;
  } else if (options.durationPreset && PRESET_HOURS[options.durationPreset]) {
    isAutoDuration = false;
    durationHours = options.durationHours ?? PRESET_HOURS[options.durationPreset];
  } else if (options.durationHours && options.durationHours > 0) {
    isAutoDuration = false;
    durationHours = options.durationHours;
  } else {
    isAutoDuration = true;
    durationHours = autoDur.durationHours;
  }

  if (options.presetKey && profile.presets[options.presetKey]) {
    const opt = profile.presets[options.presetKey];
    durationPreset = opt.hours === 24 ? "24h" : opt.hours === 48 ? "48h" : opt.hours === 72 ? "72h" : opt.hours === 96 ? "96h" : "168h";
  } else if (options.durationPreset && PRESET_HOURS[options.durationPreset]) {
    durationPreset = options.durationPreset;
  } else if (durationHours <= 30) durationPreset = "24h";
  else if (durationHours <= 60) durationPreset = "48h";
  else if (durationHours <= 80) durationPreset = "72h";
  else if (durationHours <= 120) durationPreset = "96h";
  else durationPreset = "168h";

  const durationMinutes = Math.max(15, Math.round(durationHours * 60));
  const durationLabel = formatDurationHours(durationHours);
  const targetTz = options.targetTz || "Asia/Kolkata";
  const startTime = options.startTime ? new Date(options.startTime) : new Date();
  const peakHourEnabled = options.peakHourWeighting !== false;

  const enabledTypes: EngagementType[] = options.enabledTypes && options.enabledTypes.length > 0
    ? options.enabledTypes
    : ["views", "likes", "saves", "shares", "comments"];

  // Backend service resolution from profile settings
  const services: Record<EngagementType, ServiceSpec> = {
    views: options.services?.views || resolvePlatformService(profile.id, "views"),
    likes: options.services?.likes || resolvePlatformService(profile.id, "likes"),
    shares: options.services?.shares || resolvePlatformService(profile.id, "shares"),
    saves: options.services?.saves || resolvePlatformService(profile.id, "saves"),
    comments: options.services?.comments || resolvePlatformService(profile.id, "comments"),
  };

  // Main RNG for high-level parameters
  const mainRng = createSeededRng(hashSubSeed(seedInt, "archetype_and_envelope"));

  // 1. Pick Pattern Archetype from Profile Weights
  const weights = profile.archetypeWeights;
  const archRoll = mainRng();
  let archetype: PatternArchetype = "classic";

  const wClassic = weights.classic;
  const wDouble = wClassic + weights.doubleWave;
  const wStall = wDouble + weights.stallAndSurge;
  const wSlow = wStall + weights.slowRamp;

  if (archRoll < wClassic) archetype = "classic";
  else if (archRoll < wDouble) archetype = "double-wave";
  else if (archRoll < wStall) archetype = "stall-and-surge";
  else if (archRoll < wSlow) archetype = "slow-ramp";
  else archetype = "early-spike";

  // 2. Steepness k and Midpoint m within Profile Envelope
  const [kMin, kMax] = profile.viewsEnvelope.kRange;
  const [mMin, mMax] = profile.viewsEnvelope.mRange;
  const kSpan = kMax - kMin;
  const mSpan = mMax - mMin;

  let k: number;
  let m: number;

  if (archetype === "slow-ramp") {
    // k at low end, m at high end
    k = kMin + mainRng() * (kSpan * 0.35);
    m = mMin + mSpan * 0.65 + mainRng() * (mSpan * 0.35);
  } else if (archetype === "early-spike") {
    // k at high end, m at low end
    k = kMin + kSpan * 0.65 + mainRng() * (kSpan * 0.35);
    m = mMin + mainRng() * (mSpan * 0.35);
  } else {
    k = kMin + mainRng() * kSpan;
    m = mMin + mainRng() * mSpan;
  }

  // Double wave parameters
  const secondCenterRange = profile.doubleWaveConfig?.secondWaveCenterRange || [0.45, 0.65];
  const secondWeightRange = profile.doubleWaveConfig?.secondWaveWeightRange || [0.25, 0.35];
  const doubleWaveM2 = secondCenterRange[0] + mainRng() * (secondCenterRange[1] - secondCenterRange[0]);
  const doubleWaveWeight2 = secondWeightRange[0] + mainRng() * (secondWeightRange[1] - secondWeightRange[0]);
  const doubleWaveK2 = kMin + mainRng() * kSpan;

  const stallPlateauCenter = 0.35 + mainRng() * 0.20; // [0.35, 0.55]
  const stallPlateauWidth = 0.03 + mainRng() * 0.05;  // [0.03, 0.08]

  // Value noise within ±3%
  const noiseAmp = Math.min(profile.viewsEnvelope.noiseAmplitudeMax, 0.022 + mainRng() * 0.005);
  const noiseFunc = generateValueNoise(createSeededRng(hashSubSeed(seedInt, "views_noise")), 10, noiseAmp);

  // Unified Archetype Curve Function F(t)
  const computeArchetypeCurve = (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;

    let base: number;
    if (archetype === "double-wave") {
      base = (1 - doubleWaveWeight2) * normalizedLogistic(t, k, m) + doubleWaveWeight2 * normalizedLogistic(t, doubleWaveK2, doubleWaveM2);
    } else if (archetype === "stall-and-surge") {
      const p = stallPlateauCenter;
      const w = stallPlateauWidth;
      const sigma = w / 2;
      const damp = 0.70 * Math.exp(-Math.pow(t - p, 2) / (2 * sigma * sigma));
      const surge = 0.45 * Math.exp(-Math.pow(t - (p + w * 1.5), 2) / (2 * sigma * sigma));
      const warpedT = Math.max(0, Math.min(1, t - damp * 0.04 + surge * 0.04));
      base = normalizedLogistic(warpedT, k, m);
    } else {
      base = normalizedLogistic(t, k, m);
    }

    return Math.max(0, Math.min(1, base));
  };

  // Monotone Views Cumulative Target Function
  const viewsCumulativeFraction = (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const base = computeArchetypeCurve(t);
    const noise = noiseFunc(t);
    return Math.max(0, Math.min(1, base + noise));
  };

  // Pre-sample cumulative views at dense steps to enforce running maximum (monotonicity)
  const DENSE_STEPS = 200;
  const denseViewsCumulative: number[] = [0];
  let runningMax = 0;
  for (let i = 1; i <= DENSE_STEPS; i++) {
    const t = i / DENSE_STEPS;
    const rawVal = viewsCumulativeFraction(t);
    if (rawVal > runningMax) runningMax = rawVal;
    denseViewsCumulative.push(Math.min(1, runningMax));
  }
  denseViewsCumulative[DENSE_STEPS] = 1.0;

  const getMonotoneViewsFraction = (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const scaled = t * DENSE_STEPS;
    const idx = Math.min(DENSE_STEPS - 1, Math.floor(scaled));
    const rem = scaled - idx;
    return denseViewsCumulative[idx] + (denseViewsCumulative[idx + 1] - denseViewsCumulative[idx]) * rem;
  };

  // 3. Realistic Tier Model & Planned Totals
  const realisticModel = drawRealisticTotals(
    profile,
    baseViews,
    seedInt,
    options.customQuantities,
    options.customSources,
    options.typeToggles
  );

  const autoDisabledTypes = { ...realisticModel.autoDisabledTypes };
  const autoDisableNotes = { ...realisticModel.autoDisableNotes };
  const softHints = { ...realisticModel.softHints };

  // Base Views provider minimum check
  if (baseViews < services.views.minQuantity) {
    throw new Error(
      `Validation error: Views need at least ${services.views.minQuantity.toLocaleString()} for this service.`
    );
  }

  const typeConfigs = profile.types;
  const likesCfg = typeConfigs.likes;
  let baseLikesRatio = likesCfg.baseRatio;

  if (likesCfg.slidingScale) {
    const sc = likesCfg.slidingScale;
    if (baseViews < sc.lowViewsThreshold) baseLikesRatio = sc.lowViewsRatio;
    else if (baseViews > sc.highViewsThreshold) baseLikesRatio = sc.highViewsRatio;
    else baseLikesRatio = sc.midRatio;
  }

  const likesRng = createSeededRng(hashSubSeed(seedInt, "likes"));
  const savesRng = createSeededRng(hashSubSeed(seedInt, "saves"));
  const sharesRng = createSeededRng(hashSubSeed(seedInt, "shares"));
  const commentsRng = createSeededRng(hashSubSeed(seedInt, "comments"));

  const sampleRatioWithVariance = (base: number, variance: number, rng: () => number) => {
    return base * (1 - variance + rng() * (variance * 2));
  };

  const plannedTotals: Record<EngagementType, number> = {
    views: baseViews,
    likes: 0,
    saves: 0,
    shares: 0,
    comments: 0,
  };

  for (const t of (["likes", "saves", "shares", "comments"] as const)) {
    // If toggled off or not enabled
    if (options.typeToggles?.[t] === false || (options.enabledTypes && !options.enabledTypes.includes(t))) {
      plannedTotals[t] = 0;
      continue;
    }

    if (options.customRatios?.[t] !== undefined && options.customQuantities?.[t] === undefined) {
      plannedTotals[t] = Math.floor(baseViews * options.customRatios[t]! + 1e-9);
    } else {
      plannedTotals[t] = realisticModel.plannedTotals[t];
    }

    const srv = services[t];
    if (srv && srv.minQuantity && plannedTotals[t] < srv.minQuantity) {
      if (options.autoDisableBelowMin) {
        if (plannedTotals[t] > 0 || realisticModel.suggestedTotals[t] > 0) {
          autoDisabledTypes[t] = true;
          const typeLabel = t.charAt(0).toUpperCase() + t.slice(1);
          if (baseViews < 3000 && t === "comments") {
            autoDisableNotes[t] = "Comments unlock around 3,000 views.";
          } else {
            const range = realisticModel.suggestedRanges[t];
            autoDisableNotes[t] = `${typeLabel} need at least ${srv.minQuantity} for this service. Your ${baseViews.toLocaleString()} views would normally get about ${range.min}–${range.max} ${t}, so ${t} are switched off.`;
          }
        }
        plannedTotals[t] = 0;
      } else {
        const typeLabel = t.charAt(0).toUpperCase() + t.slice(1);
        throw new Error(
          `Validation error: ${typeLabel} need at least ${srv.minQuantity.toLocaleString()} for this service. Increase views or turn ${typeLabel} off.`
        );
      }
    }
  }

  // Target ratios: compute from final planned quantities so hard monotonic rule delivered <= ratio * views holds
  const sampledRatios: Record<EngagementType, number> = {
    views: 1.0,
    likes: baseViews > 0 ? plannedTotals.likes / baseViews : (options.customRatios?.likes ?? sampleRatioWithVariance(baseLikesRatio, likesCfg.ratioVariance, likesRng)),
    saves: baseViews > 0 ? plannedTotals.saves / baseViews : (options.customRatios?.saves ?? sampleRatioWithVariance(typeConfigs.saves.baseRatio, typeConfigs.saves.ratioVariance, savesRng)),
    shares: baseViews > 0 ? plannedTotals.shares / baseViews : (options.customRatios?.shares ?? sampleRatioWithVariance(typeConfigs.shares.baseRatio, typeConfigs.shares.ratioVariance, sharesRng)),
    comments: baseViews > 0 ? plannedTotals.comments / baseViews : (options.customRatios?.comments ?? sampleRatioWithVariance(typeConfigs.comments.baseRatio, typeConfigs.comments.ratioVariance, commentsRng)),
  };

  // 4. Start lags per type
  const sampleLag = (range: [number, number], rng: () => number) => {
    return Math.round(range[0] + rng() * (range[1] - range[0]));
  };

  const sampledLagsMinutes: Record<EngagementType, number> = {
    views: 0,
    likes: sampleLag(likesCfg.lagMinutesRange, likesRng),
    saves: sampleLag(typeConfigs.saves.lagMinutesRange, savesRng),
    shares: sampleLag(typeConfigs.shares.lagMinutesRange, sharesRng),
    comments: sampleLag(typeConfigs.comments.lagMinutesRange, commentsRng),
  };

  // 5. Scaled Views Run Count per Change B
  const viewsRng = createSeededRng(hashSubSeed(seedInt, "views"));
  const shortInterval = 2 + viewsRng() * 4; // 2-6 mins for short orders
  const longInterval = 10 + viewsRng() * 15; // 10-25 mins for multi-day orders
  const tDur = Math.max(0, Math.min(1, (durationHours - 4) / Math.max(1, 72 - 4)));
  const targetIntervalMins = shortInterval + tDur * (longInterval - shortInterval);
  const MAX_CONFIGURABLE_VIEWS_RUNS = 60; // configurable hard cap per Change B
  const targetViewsRuns = Math.max(3, Math.min(MAX_CONFIGURABLE_VIEWS_RUNS, Math.floor(durationMinutes / targetIntervalMins)));
  const viewsTotal = plannedTotals.views;
  const maxPossibleViewsRuns = Math.floor(viewsTotal / services.views.minQuantity);
  const viewsRunCount = Math.max(1, Math.min(maxPossibleViewsRuns, targetViewsRuns));

  const nominalRunCounts: Record<EngagementType, number> = {
    views: viewsRunCount,
    likes: Math.max(4, Math.round((durationHours / 72) * (15 + likesRng() * 15))),
    saves: Math.max(2, Math.round((durationHours / 72) * (6 + savesRng() * 9))),
    shares: Math.max(2, Math.round((durationHours / 72) * (6 + sharesRng() * 9))),
    comments: Math.max(2, Math.round((durationHours / 72) * (5 + commentsRng() * 7))),
  };

  const pausesCount = Math.floor(viewsRng() * 4); // 0-3 pauses
  const burstsCount = Math.floor(viewsRng() * 3); // 0-2 bursts

  // 7. Generate VIEWS Runs (Quantile inverse-transform + Peak-Hour Multipliers + Jitter)
  const rawViewMinutes: number[] = [];
  const firstViewMin = Math.max(1, Math.round(1 + viewsRng() * 3));
  rawViewMinutes.push(firstViewMin);

  for (let i = 2; i <= viewsRunCount; i++) {
    const qTarget = i / (viewsRunCount + 0.5);
    let low = 0;
    let high = 1;
    for (let iter = 0; iter < 18; iter++) {
      const mid = (low + high) / 2;
      if (getMonotoneViewsFraction(mid) < qTarget) low = mid;
      else high = mid;
    }
    const tBase = (low + high) / 2;
    const jitter = (viewsRng() - 0.5) * (0.4 / viewsRunCount);
    const clampedT = Math.max(0.005, Math.min(0.995, tBase + jitter));
    const targetMin = Math.round(clampedT * durationMinutes);
    rawViewMinutes.push(Math.max(firstViewMin + 1, targetMin));
  }
  rawViewMinutes.sort((a, b) => a - b);

  // Apply Pauses (0-3) and Bursts (0-2)
  for (let p = 0; p < pausesCount; p++) {
    const pauseIdx = Math.floor(viewsRng() * (rawViewMinutes.length - 2)) + 1;
    const pauseMins = Math.round(10 + viewsRng() * 20);
    for (let j = pauseIdx; j < rawViewMinutes.length; j++) {
      rawViewMinutes[j] = Math.min(durationMinutes - 1, rawViewMinutes[j] + pauseMins);
    }
  }
  for (let b = 0; b < burstsCount; b++) {
    if (rawViewMinutes.length > 2) {
      const burstIdx = Math.floor(viewsRng() * (rawViewMinutes.length - 1));
      rawViewMinutes[burstIdx + 1] = Math.max(rawViewMinutes[burstIdx] + 2, rawViewMinutes[burstIdx + 1] - 10);
    }
  }
  rawViewMinutes.sort((a, b) => a - b);

  // Compute Peak-Hour Multipliers for envelope weighting
  const envelopeWeights = rawViewMinutes.map((minute) => {
    const runDate = new Date(startTime.getTime() + minute * 60000);
    return getPeakHourMultiplier(runDate, targetTz, peakHourEnabled, profile);
  });

  // Generate Authentic Batch Sizes for Views per Change B
  const viewsBatches = generateAuthenticBatches({
    total: viewsTotal,
    minQuantity: services.views.minQuantity,
    maxQuantity: services.views.maxQuantity,
    targetRuns: viewsRunCount,
    rng: viewsRng,
    envelopeWeights,
  });

  // Build Final Views Planned Runs with Seconds-Precision Jitter
  let cumViews = 0;
  const viewsPlannedRuns: PlannedRun[] = viewsBatches.map((qty, idx) => {
    cumViews += qty;
    const minute = rawViewMinutes[idx] ?? Math.round((idx + 1) * (durationMinutes / viewsBatches.length));
    const jitterSec = Math.round((viewsRng() - 0.5) * 50);
    const runTime = new Date(startTime.getTime() + minute * 60000 + jitterSec * 1000);
    const isPeak = getPeakHourMultiplier(runTime, targetTz, true, profile) > 1.0;
    const isNearMin = qty <= services.views.minQuantity * 1.08;

    return {
      engagementType: "views",
      runIndex: idx + 1,
      scheduledAt: runTime.toISOString(),
      minutesFromStart: minute,
      quantity: qty,
      cumulativeQuantity: cumViews,
      cost: Number(((qty / 1000) * services.views.ratePer1000).toFixed(4)),
      serviceId: services.views.id,
      providerId: services.views.providerId,
      providerServiceId: services.views.providerServiceId,
      isPeak,
      isNearMinimum: isNearMin,
    };
  });

  const getViewsDeliveredSoFar = (minute: number): number => {
    let delivered = 0;
    for (const v of viewsPlannedRuns) {
      if (v.minutesFromStart <= minute) delivered = v.cumulativeQuantity;
      else break;
    }
    return delivered;
  };

  // 8. Generate Lumpy Secondary Types & Enforce Independent Schedules (Change C)
  const typePlans: Record<EngagementType, TypeDeliveryPlan> = {} as any;
  const allRuns: PlannedRun[] = [...viewsPlannedRuns];
  const providerMinNotes: Record<EngagementType, string | null> = {
    views: null,
    likes: null,
    saves: null,
    shares: null,
    comments: null,
  };

  typePlans.views = {
    engagementType: "views",
    targetRatio: 1.0,
    totalQuantity: viewsTotal,
    runsCount: viewsPlannedRuns.length,
    serviceName: services.views.name,
    minQuantity: services.views.minQuantity,
    maxQuantity: services.views.maxQuantity,
    ratePer1000: services.views.ratePer1000,
    totalCost: Number(((viewsTotal / 1000) * services.views.ratePer1000).toFixed(4)),
    startLagMinutes: 0,
    runs: viewsPlannedRuns,
  };

  const secondaryTypes: EngagementType[] = (["likes", "saves", "shares", "comments"] as const).filter((t) =>
    enabledTypes.includes(t)
  );

  for (const t of secondaryTypes) {
    const totalQty = plannedTotals[t];
    const s = services[t];
    const typeRng = t === "likes" ? likesRng : t === "saves" ? savesRng : t === "shares" ? sharesRng : commentsRng;
    const lagMinutes = sampledLagsMinutes[t];
    const targetRatio = sampledRatios[t];

    if (totalQty <= 0) {
      typePlans[t] = {
        engagementType: t,
        targetRatio: 0,
        totalQuantity: 0,
        runsCount: 0,
        serviceName: s.name,
        minQuantity: s.minQuantity,
        maxQuantity: s.maxQuantity,
        ratePer1000: s.ratePer1000,
        totalCost: 0,
        startLagMinutes: lagMinutes,
        autoDisabled: autoDisabledTypes[t] || false,
        autoDisabledReason: autoDisableNotes[t] || null,
        runs: [],
      };
      continue;
    }

    // Secondary interval: independent and sparser than views
    const targetSecInterval = t === "likes" ? (6 + typeRng() * 8) : t === "saves" ? (15 + typeRng() * 15) : t === "shares" ? (20 + typeRng() * 20) : (25 + typeRng() * 30);
    const availableMins = Math.max(30, durationMinutes - lagMinutes);
    const isCommentsMicro = t === "comments" && s.minQuantity <= 3;
    const targetRuns = isCommentsMicro
      ? Math.max(1, Math.min(totalQty, Math.ceil(totalQty / 2)))
      : Math.max(2, Math.floor(availableMins / targetSecInterval));
    const maxPossibleRuns = Math.floor(totalQty / s.minQuantity);
    const runCount = Math.max(1, Math.min(maxPossibleRuns, targetRuns));

    if (runCount <= 4 && totalQty < 4 * s.minQuantity) {
      const typeLabel = t.charAt(0).toUpperCase() + t.slice(1);
      providerMinNotes[t] = `${typeLabel}: ${runCount} delivery steps because the service minimum is ${s.minQuantity}`;
    }

    // Authentic batch distribution with maxSingleRunFrac 0.25 (no single run > 25% of total unless provider minimum forces it)
    const secondaryBatches = generateAuthenticBatches({
      total: totalQty,
      minQuantity: s.minQuantity,
      maxQuantity: s.maxQuantity,
      targetRuns: runCount,
      rng: typeRng,
      maxSingleRunFrac: isCommentsMicro ? undefined : 0.25,
      maxBatchCap: isCommentsMicro ? 3 : undefined,
    });

    const actualCount = secondaryBatches.length;
    const rawMinutes: number[] = [];
    const lastViewMin = viewsPlannedRuns[viewsPlannedRuns.length - 1]?.minutesFromStart ?? durationMinutes;

    for (let i = 1; i <= actualCount; i++) {
      const q = i / (actualCount + 0.5);
      let tFrac: number;
      if (t === "likes") {
        tFrac = Math.pow(q, 0.82); // front-weighted early test audience
      } else if (t === "saves" || t === "shares") {
        tFrac = Math.max(0.05, q * 0.90 + 0.10);
      } else {
        tFrac = Math.max(0.12, q * 0.85 + 0.15);
      }
      const jitter = (typeRng() - 0.5) * (0.35 / actualCount);
      const frac = Math.max(0.01, Math.min(0.99, tFrac + jitter));
      const minFromStart = Math.round(lagMinutes + frac * (durationMinutes - lagMinutes));
      rawMinutes.push(Math.min(durationMinutes - 1, minFromStart));
    }
    rawMinutes.sort((a, b) => a - b);

    // Fix screenshot bug: comments and shares must never reach 100% before views do!
    if (rawMinutes.length > 0) {
      rawMinutes[rawMinutes.length - 1] = Math.max(
        lastViewMin - 1,
        Math.min(durationMinutes - 1, rawMinutes[rawMinutes.length - 1])
      );
      rawMinutes.sort((a, b) => a - b);
    }

    let cumDelivered = 0;
    const finalRuns: PlannedRun[] = [];

    for (let i = 0; i < secondaryBatches.length; i++) {
      let bMinute = rawMinutes[i];
      const bQty = secondaryBatches[i];

      // Hard rule: delivered_so_far(type) <= ratio_cap * views_so_far
      let viewsAtTime = getViewsDeliveredSoFar(bMinute);
      const ratioCap = targetRatio;

      while (cumDelivered + bQty > ratioCap * viewsAtTime + 1e-9 && bMinute < durationMinutes) {
        const nextViewRun = viewsPlannedRuns.find(
          (v) => v.minutesFromStart >= bMinute && v.cumulativeQuantity > viewsAtTime
        );
        if (nextViewRun) {
          bMinute = Math.min(durationMinutes, nextViewRun.minutesFromStart + 1);
          viewsAtTime = getViewsDeliveredSoFar(bMinute);
        } else {
          bMinute = durationMinutes;
          viewsAtTime = viewsTotal;
          break;
        }
      }

      cumDelivered += bQty;
      const jitterSec = Math.round((typeRng() - 0.5) * 50);
      let scheduledMs = startTime.getTime() + bMinute * 60000 + jitterSec * 1000;

      // Ensure secondary run is scheduled after the view run that delivers prerequisite views
      let reqViewRun: PlannedRun | undefined;
      for (let vIdx = viewsPlannedRuns.length - 1; vIdx >= 0; vIdx--) {
        if (viewsPlannedRuns[vIdx].cumulativeQuantity >= viewsAtTime && viewsPlannedRuns[vIdx].minutesFromStart <= bMinute) {
          reqViewRun = viewsPlannedRuns[vIdx];
          break;
        }
      }
      if (reqViewRun) {
        const reqViewMs = new Date(reqViewRun.scheduledAt).getTime();
        if (scheduledMs <= reqViewMs) {
          scheduledMs = reqViewMs + 2000;
        }
      }
      const scheduledTime = new Date(scheduledMs);
      const isPeak = getPeakHourMultiplier(scheduledTime, targetTz, true, profile) > 1.0;
      const isNearMin = bQty <= s.minQuantity * 1.08;

      finalRuns.push({
        engagementType: t,
        runIndex: i + 1,
        scheduledAt: scheduledTime.toISOString(),
        minutesFromStart: bMinute,
        quantity: bQty,
        cumulativeQuantity: cumDelivered,
        cost: Number(((bQty / 1000) * s.ratePer1000).toFixed(4)),
        serviceId: s.id,
        providerId: s.providerId,
        providerServiceId: s.providerServiceId,
        isPeak,
        isNearMinimum: isNearMin,
      });
    }

    typePlans[t] = {
      engagementType: t,
      targetRatio,
      totalQuantity: totalQty,
      runsCount: finalRuns.length,
      serviceName: s.name,
      minQuantity: s.minQuantity,
      maxQuantity: s.maxQuantity,
      ratePer1000: s.ratePer1000,
      totalCost: Number(((totalQty / 1000) * s.ratePer1000).toFixed(4)),
      startLagMinutes: lagMinutes,
      runs: finalRuns,
    };

    allRuns.push(...finalRuns);
  }

  // Ensure all engagement types exist in typePlans even if disabled or zero quantity
  for (const t of (["likes", "saves", "shares", "comments"] as const)) {
    if (!typePlans[t]) {
      const s = services[t];
      typePlans[t] = {
        engagementType: t,
        targetRatio: 0,
        totalQuantity: 0,
        runsCount: 0,
        serviceName: s?.name || t,
        minQuantity: s?.minQuantity || 0,
        maxQuantity: s?.maxQuantity || 0,
        ratePer1000: s?.ratePer1000 || 0,
        totalCost: 0,
        startLagMinutes: sampledLagsMinutes[t] || 0,
        runs: [],
      };
    }
  }

  // Sort all runs chronologically; when timestamps tie, views always execute before secondary types
  const typeOrder: Record<EngagementType, number> = {
    views: 0,
    likes: 1,
    saves: 2,
    shares: 3,
    comments: 4,
  };

  allRuns.sort((a, b) => {
    const timeDiff = new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return typeOrder[a.engagementType] - typeOrder[b.engagementType];
  });

  // 9. Generate High-Resolution 100-Interval Curve Points for Stored Plan & Orders Chart
  const curvePoints: CurvePoint[] = [];
  const ratioPoints: RatioPoint[] = [];
  const SAMPLE_POINTS = 100;
  const sampledBuckets: number[] = [];

  for (let s = 0; s <= SAMPLE_POINTS; s++) {
    const mins = Math.round((s / SAMPLE_POINTS) * durationMinutes);
    const hrs = Math.floor(mins / 60);
    const mRem = mins % 60;
    const timeLabel = `+${hrs}h${mRem > 0 ? ` ${mRem}m` : ""}`;

    const pt: CurvePoint = {
      minutes: mins,
      timeLabel,
      views: 0,
      likes: 0,
      shares: 0,
      saves: 0,
      comments: 0,
    };

    for (const t of (["views", "likes", "shares", "saves", "comments"] as const)) {
      if (typePlans[t]) {
        let cum = 0;
        for (const r of typePlans[t].runs) {
          if (r.minutesFromStart <= mins) cum = r.cumulativeQuantity;
          else break;
        }
        pt[t] = cum;
      }
    }

    curvePoints.push(pt);
    if (s % 10 === 0) {
      sampledBuckets.push(Math.round(pt.views));
    }

    // Ratio-Over-Time Series
    const curV = Math.max(1, pt.views);
    ratioPoints.push({
      minutes: mins,
      timeLabel,
      likesRatioPct: Number(((pt.likes / curV) * 100).toFixed(2)),
      savesRatioPct: Number(((pt.saves / curV) * 100).toFixed(2)),
      sharesRatioPct: Number(((pt.shares / curV) * 100).toFixed(2)),
      commentsRatioPct: Number(((pt.comments / curV) * 100).toFixed(2)),
      targetLikesPct: Number((sampledRatios.likes * 100).toFixed(2)),
      targetSavesPct: Number((sampledRatios.saves * 100).toFixed(2)),
      targetSharesPct: Number((sampledRatios.shares * 100).toFixed(2)),
      targetCommentsPct: Number((sampledRatios.comments * 100).toFixed(2)),
    });
  }

  // 10. Batch Timeline Entries
  const batchTimeline: BatchTimelineEntry[] = allRuns.map((r) => ({
    type: r.engagementType,
    runIndex: r.runIndex,
    minutes: r.minutesFromStart,
    scheduledAt: r.scheduledAt,
    quantity: r.quantity,
    isPeak: Boolean(r.isPeak),
  }));

  // Compute Uniqueness Fingerprint
  const fingerprint = computePlanFingerprint(archetype, k, m, sampledBuckets);

  // Compute total package cost
  let overallCost = 0;
  for (const t of Object.keys(typePlans) as EngagementType[]) {
    overallCost += typePlans[t].totalCost;
  }
  overallCost = Number(overallCost.toFixed(2));

  const planParams: PlanParams = {
    seed: seedInt,
    k,
    m,
    archetype,
    noiseAmplitude: noiseAmp,
    durationPreset,
    durationHours,
    targetTz,
    profileId: profile.id,
    profileName: profile.name,
    ratios: {
      views: 1.0,
      likes: sampledRatios.likes * 1.15,
      saves: sampledRatios.saves * 1.15,
      shares: sampledRatios.shares * 1.15,
      comments: sampledRatios.comments * 1.15,
    },
    finalRatios: sampledRatios,
    ratioCaps: {
      views: 1.0,
      likes: sampledRatios.likes * 1.15,
      saves: sampledRatios.saves * 1.15,
      shares: sampledRatios.shares * 1.15,
      comments: sampledRatios.comments * 1.15,
    },
    startLagsMinutes: sampledLagsMinutes,
    plannedRunCounts: nominalRunCounts,
    pausesCount,
    burstsCount,
    fingerprint,
  };

  const summaryChips = {
    totalViews: viewsTotal,
    totalRuns: allRuns.length,
    durationHours,
    durationLabel,
    archetype: archetype.charAt(0).toUpperCase() + archetype.slice(1),
    preset: durationPreset,
    totalCost: overallCost,
  };

  return {
    seed: seedInt,
    seedString: String(rawSeed),
    platform,
    profileId: profile.id,
    profileName: profile.name,
    baseViews,
    isAutoDuration,
    autoDurationRange,
    durationPreset,
    durationHours,
    durationLabel,
    estimatedFinishTime: new Date(startTime.getTime() + durationMinutes * 60000).toISOString(),
    targetTz,
    totalCost: overallCost,
    params: planParams,
    plans: typePlans,
    allRuns,
    curvePoints,
    ratioPoints,
    batchTimeline,
    summaryChips,
    realisticTotals: {
      ...realisticModel,
      plannedTotals,
      autoDisabledTypes,
      autoDisableNotes,
      softHints,
    },
    suggestedRanges: realisticModel.suggestedRanges,
    suggestedTotals: realisticModel.suggestedTotals,
    sourceFlags: realisticModel.sourceFlags,
    autoDisabledTypes,
    autoDisableNotes,
    softHints,
    providerMinNotes,
  };
}

/**
 * Uniqueness Guard: Generates a plan guaranteed to be distinct from a previous fingerprint
 * by at least 15% cumulative curve area or a different archetype.
 */
export function generateUniqueOrganicPlan(
  options: PlanOptions,
  previousFingerprint?: string,
  maxAttempts = 50
): OrganicPlanResult {
  let initialSeed = options.seed ? normalizeSeed(options.seed) : Math.floor(Math.random() * 100000000);
  let plan = generateOrganicPlan({ ...options, seed: initialSeed });

  if (!previousFingerprint) return plan;

  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;
    const [prevArch] = previousFingerprint.split(":");
    if (plan.params.archetype !== prevArch) {
      break;
    }

    initialSeed = (initialSeed + 1013904223) >>> 0;
    const candidate = generateOrganicPlan({ ...options, seed: initialSeed });
    const dist = computeCurveDistance(plan, candidate);
    if (dist >= 0.15 || candidate.params.archetype !== prevArch) {
      plan = candidate;
      break;
    }
  }

  return plan;
}

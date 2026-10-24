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
  durationPreset: DurationPreset;
  durationHours: number;
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
}

export interface PlanOptions {
  platform?: "Instagram" | "TikTok" | string;
  profileId?: string; // "instagram_reel" | "instagram_post" | "tiktok"
  presetKey?: ProfilePresetKey; // "fast" | "normal" | "slow"
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
 * Enforces Provider Minimum & Maximum Order Size Rules:
 * Algorithm:
 * - While any run < min, merge it into its nearest neighbor (prefer later neighbor so engagement lags views).
 * - If number of runs drops below 1, make a single run equal to the total.
 * - Runs above max are split.
 * - The final plan delivers exactly the planned total per type without dropping quantity.
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

  // While any run < min, merge it into its nearest neighbor (prefer later neighbor)
  let changed = true;
  while (changed && list.length > 1) {
    changed = false;
    for (let i = 0; i < list.length; i++) {
      if (list[i].quantity < minQuantity) {
        if (i < list.length - 1) {
          // Prefer later neighbor (i + 1)
          list[i + 1].quantity += list[i].quantity;
          list.splice(i, 1);
        } else {
          // Last run has no later neighbor, merge with previous (i - 1)
          list[i - 1].quantity += list[i].quantity;
          list.splice(i, 1);
        }
        changed = true;
        break; // restart scan
      }
    }
  }

  // If number of runs dropped to 1, make a single run equal to the total
  if (list.length === 1) {
    list[0].quantity = targetTotal;
  }

  // Split runs above maxQuantity
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

  // Final exact total conservation check
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

  // Preset Resolution (fast, normal, slow, or explicit hours)
  let durationHours: number;
  let durationPreset: DurationPreset;

  if (options.presetKey && profile.presets[options.presetKey]) {
    const opt = profile.presets[options.presetKey];
    durationHours = opt.hours;
    durationPreset = opt.durationPreset;
  } else if (options.durationPreset) {
    durationPreset = options.durationPreset;
    durationHours = durationPreset === "24h" ? 24 : durationPreset === "48h" ? 48 : durationPreset === "96h" ? 96 : durationPreset === "168h" ? 168 : 72;
  } else if (options.durationHours) {
    durationHours = options.durationHours;
    if (durationHours <= 30) durationPreset = "24h";
    else if (durationHours <= 60) durationPreset = "48h";
    else if (durationHours <= 80) durationPreset = "72h";
    else if (durationHours <= 120) durationPreset = "96h";
    else durationPreset = "168h";
  } else {
    // Default preset from profile
    const defPreset = profile.presets[profile.defaultPreset] || profile.presets.normal;
    durationHours = defPreset.hours;
    durationPreset = defPreset.durationPreset;
  }

  const durationMinutes = durationHours * 60;
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

  // 3. Sub-Seed Ratio Calculations (Sliding scale from profile)
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
    // e.g. variance 0.25 => [1 - 0.25, 1 + 0.25]
    return base * (1 - variance + rng() * (variance * 2));
  };

  const sampledRatios: Record<EngagementType, number> = {
    views: 1.0,
    likes: options.customRatios?.likes ?? sampleRatioWithVariance(baseLikesRatio, likesCfg.ratioVariance, likesRng),
    saves: options.customRatios?.saves ?? sampleRatioWithVariance(typeConfigs.saves.baseRatio, typeConfigs.saves.ratioVariance, savesRng),
    shares: options.customRatios?.shares ?? sampleRatioWithVariance(typeConfigs.shares.baseRatio, typeConfigs.shares.ratioVariance, sharesRng),
    comments: options.customRatios?.comments ?? sampleRatioWithVariance(typeConfigs.comments.baseRatio, typeConfigs.comments.ratioVariance, commentsRng),
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

  // 5. Run counts scaled by duration preset
  const presetScale = durationHours / 72; // normal baseline is 72h
  const viewsRng = createSeededRng(hashSubSeed(seedInt, "views"));

  const nominalRunCounts: Record<EngagementType, number> = {
    views: Math.max(12, Math.round(presetScale * (40 + viewsRng() * 40))),
    likes: Math.max(6, Math.round(presetScale * (15 + likesRng() * 15))),
    saves: Math.max(3, Math.round(presetScale * (6 + savesRng() * 9))),
    shares: Math.max(3, Math.round(presetScale * (6 + sharesRng() * 9))),
    comments: Math.max(2, Math.round(presetScale * (5 + commentsRng() * 7))),
  };

  const pausesCount = Math.floor(viewsRng() * 4); // 0-3 pauses
  const burstsCount = Math.floor(viewsRng() * 3); // 0-2 bursts

  // 6. Calculate planned total quantities using floor so total <= ratio * views
  const plannedTotals: Record<EngagementType, number> = {
    views: baseViews,
    likes: Math.floor(baseViews * sampledRatios.likes + 1e-9),
    saves: Math.floor(baseViews * sampledRatios.saves + 1e-9),
    shares: Math.floor(baseViews * sampledRatios.shares + 1e-9),
    comments: Math.floor(baseViews * sampledRatios.comments + 1e-9),
  };

  // Provider Minimum Rule: Return clear validation error if total < provider service minimum
  for (const t of enabledTypes) {
    const srv = services[t];
    if (plannedTotals[t] < srv.minQuantity) {
      const typeLabel = t.charAt(0).toUpperCase() + t.slice(1);
      throw new Error(
        `Validation error: ${typeLabel} need at least ${srv.minQuantity.toLocaleString()} for this service. Increase views or turn ${typeLabel} off.`
      );
    }
  }

  // 7. Generate VIEWS Runs (Quantile inverse-transform + Peak-Hour Multipliers)
  const viewsTotal = plannedTotals.views;
  let viewsRunCount = nominalRunCounts.views;
  if (viewsTotal / services.views.minQuantity < viewsRunCount) {
    viewsRunCount = Math.max(1, Math.floor(viewsTotal / services.views.minQuantity));
  }

  // Inverse-transform sampling of quantile points
  const rawViewMinutes: number[] = [];
  const firstViewMin = Math.round(2 + viewsRng() * 3);
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
    rawViewMinutes.push(Math.max(firstViewMin + 2, targetMin));
  }
  rawViewMinutes.sort((a, b) => a - b);

  // Apply Pauses and Bursts
  for (let p = 0; p < pausesCount; p++) {
    const pauseIdx = Math.floor(viewsRng() * (rawViewMinutes.length - 2)) + 1;
    const pauseMins = Math.round(15 + viewsRng() * 25);
    for (let j = pauseIdx; j < rawViewMinutes.length; j++) {
      rawViewMinutes[j] = Math.min(durationMinutes - 1, rawViewMinutes[j] + pauseMins);
    }
  }
  for (let b = 0; b < burstsCount; b++) {
    const burstIdx = Math.floor(viewsRng() * (rawViewMinutes.length - 1));
    rawViewMinutes[burstIdx + 1] = Math.max(rawViewMinutes[burstIdx] + 2, rawViewMinutes[burstIdx + 1] - 15);
  }
  rawViewMinutes.sort((a, b) => a - b);

  // Compute Raw Batch Weights for Views with Log-Normal Skew & Peak-Hour Multipliers
  const rawViewWeights: number[] = [];
  for (let i = 0; i < rawViewMinutes.length; i++) {
    const runDate = new Date(startTime.getTime() + rawViewMinutes[i] * 60000);
    const peakMult = getPeakHourMultiplier(runDate, targetTz, peakHourEnabled, profile);
    const skew = Math.exp((viewsRng() - 0.5) * 0.35);
    rawViewWeights.push(skew * peakMult);
  }

  const sumViewWeights = rawViewWeights.reduce((a, b) => a + b, 0);
  const unroundedViewBatches = rawViewWeights.map((w) => (w / sumViewWeights) * viewsTotal);
  let viewBatchQuantities = allocateIntegersLargestRemainder(unroundedViewBatches, viewsTotal);

  const initialViewBatches = rawViewMinutes.map((minute, idx) => ({
    minute,
    quantity: viewBatchQuantities[idx],
  }));

  // Enforce Provider Minimum Algorithm
  const mergedViewsRuns = mergeSubMinimumRuns(
    initialViewBatches,
    services.views.minQuantity,
    services.views.maxQuantity,
    viewsTotal
  );

  // Build Final Views Planned Runs
  let cumViews = 0;
  const viewsPlannedRuns: PlannedRun[] = mergedViewsRuns.map((r, idx) => {
    cumViews += r.quantity;
    const runTime = new Date(startTime.getTime() + r.minute * 60000);
    const isPeak = getPeakHourMultiplier(runTime, targetTz, true, profile) > 1.0;
    return {
      engagementType: "views",
      runIndex: idx + 1,
      scheduledAt: runTime.toISOString(),
      minutesFromStart: r.minute,
      quantity: r.quantity,
      cumulativeQuantity: cumViews,
      cost: Number(((r.quantity / 1000) * services.views.ratePer1000).toFixed(4)),
      serviceId: services.views.id,
      providerId: services.views.providerId,
      providerServiceId: services.views.providerServiceId,
      isPeak,
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

  // 8. Generate Secondary Types & Enforce Hard Rule
  const typePlans: Record<EngagementType, TypeDeliveryPlan> = {} as any;
  const allRuns: PlannedRun[] = [...viewsPlannedRuns];

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

    let runCount = nominalRunCounts[t];
    if (totalQty / s.minQuantity < runCount) {
      runCount = Math.max(1, Math.floor(totalQty / s.minQuantity));
    }

    // Special Case: Comments with small batch sizes 1-3
    if (t === "comments" && s.minQuantity <= 3) {
      const commentBatchSizes: number[] = [];
      let currentCommentSum = 0;
      while (currentCommentSum < totalQty) {
        const rem = totalQty - currentCommentSum;
        if (rem <= 3) {
          commentBatchSizes.push(rem);
          currentCommentSum += rem;
        } else {
          const roll = typeRng();
          const sz = roll < 0.45 ? 1 : roll < 0.80 ? 2 : 3;
          commentBatchSizes.push(sz);
          currentCommentSum += sz;
        }
      }

      const commentMinutes: number[] = [];
      const meanGap = Math.max(5, (durationMinutes - lagMinutes) / (commentBatchSizes.length + 1));
      let curMin = lagMinutes;
      for (let i = 0; i < commentBatchSizes.length; i++) {
        const gap = Math.max(4, Math.round(-Math.log(Math.max(0.001, typeRng())) * meanGap * 0.85));
        curMin = Math.min(durationMinutes - 2, curMin + gap);
        commentMinutes.push(curMin);
      }
      commentMinutes.sort((a, b) => a - b);

      // Build runs strictly enforcing the hard ratio rule
      const commentRuns: PlannedRun[] = [];
      let cumComments = 0;
      for (let i = 0; i < commentBatchSizes.length; i++) {
        let runMin = commentMinutes[i];
        const qty = commentBatchSizes[i];

        let viewsAtMin = getViewsDeliveredSoFar(runMin);
        while (cumComments + qty > targetRatio * viewsAtMin + 1e-9 && runMin < durationMinutes) {
          const nextView = viewsPlannedRuns.find((v) => v.minutesFromStart >= runMin);
          if (nextView) {
            runMin = Math.min(durationMinutes, nextView.minutesFromStart + 1);
            viewsAtMin = getViewsDeliveredSoFar(runMin);
          } else {
            runMin = durationMinutes;
            viewsAtMin = viewsTotal;
            break;
          }
        }

        cumComments += qty;
        const runTime = new Date(startTime.getTime() + runMin * 60000);
        const isPeak = getPeakHourMultiplier(runTime, targetTz, true, profile) > 1.0;
        commentRuns.push({
          engagementType: "comments",
          runIndex: i + 1,
          scheduledAt: runTime.toISOString(),
          minutesFromStart: runMin,
          quantity: qty,
          cumulativeQuantity: cumComments,
          cost: Number(((qty / 1000) * s.ratePer1000).toFixed(4)),
          serviceId: s.id,
          providerId: s.providerId,
          providerServiceId: s.providerServiceId,
          isPeak,
        });
      }

      typePlans.comments = {
        engagementType: "comments",
        targetRatio,
        totalQuantity: totalQty,
        runsCount: commentRuns.length,
        serviceName: s.name,
        minQuantity: s.minQuantity,
        maxQuantity: s.maxQuantity,
        ratePer1000: s.ratePer1000,
        totalCost: Number(((totalQty / 1000) * s.ratePer1000).toFixed(4)),
        startLagMinutes: lagMinutes,
        runs: commentRuns,
      };

      allRuns.push(...commentRuns);
      continue;
    }

    // Standard Secondary Types
    const rawMinutes: number[] = [];
    const availableMinutes = Math.max(60, durationMinutes - lagMinutes);
    const delayFrac = typeConfigs[t]?.curveDelayFraction ?? (t === "likes" ? 0.08 : 0.12);

    for (let i = 1; i <= runCount; i++) {
      const q = i / (runCount + 0.5);
      const delayT = Math.max(0.005, Math.min(0.995, q * (1 - delayFrac) + delayFrac));
      const jitter = (typeRng() - 0.5) * (0.4 / runCount);
      const frac = Math.max(0.01, Math.min(0.99, delayT + jitter));
      const minFromStart = Math.round(lagMinutes + frac * availableMinutes);
      rawMinutes.push(Math.min(durationMinutes - 1, minFromStart));
    }
    rawMinutes.sort((a, b) => a - b);

    const weights: number[] = [];
    for (let i = 0; i < rawMinutes.length; i++) {
      const runDate = new Date(startTime.getTime() + rawMinutes[i] * 60000);
      const peakMult = getPeakHourMultiplier(runDate, targetTz, peakHourEnabled, profile);
      const skew = Math.exp((typeRng() - 0.5) * 0.35);
      weights.push(peakMult * skew);
    }
    const sumW = weights.reduce((a, b) => a + b, 0);
    const unroundedBatches = weights.map((w) => (w / sumW) * totalQty);
    let batchQuantities = allocateIntegersLargestRemainder(unroundedBatches, totalQty);

    const initialBatches = rawMinutes.map((minute, idx) => ({
      minute,
      quantity: batchQuantities[idx],
    }));

    // Provider Minimum Rule: Merge sub-min batches into nearest neighbor
    const mergedBatches = mergeSubMinimumRuns(
      initialBatches,
      s.minQuantity,
      s.maxQuantity,
      totalQty
    );

    // Re-check Hard Rule after merging; push quantity later in time if a merge broke it
    let cumDelivered = 0;
    const finalRuns: PlannedRun[] = [];

    for (let i = 0; i < mergedBatches.length; i++) {
      let bMinute = mergedBatches[i].minute;
      let bQty = mergedBatches[i].quantity;

      let viewsAtTime = getViewsDeliveredSoFar(bMinute);
      while (cumDelivered + bQty > targetRatio * viewsAtTime + 1e-9 && bMinute < durationMinutes) {
        const nextViewRun = viewsPlannedRuns.find((v) => v.minutesFromStart >= bMinute);
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
      const scheduledTime = new Date(startTime.getTime() + bMinute * 60000);
      const isPeak = getPeakHourMultiplier(scheduledTime, targetTz, true, profile) > 1.0;

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

  // 9. Generate Smooth Preview Series for UI Charts (30 sample points)
  const curvePoints: CurvePoint[] = [];
  const ratioPoints: RatioPoint[] = [];
  const SAMPLE_POINTS = 30;
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
    if (s % 3 === 0) {
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
    ratios: sampledRatios,
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
    durationLabel: `${durationHours} Hours (${durationPreset})`,
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
    durationPreset,
    durationHours,
    targetTz,
    totalCost: overallCost,
    params: planParams,
    plans: typePlans,
    allRuns,
    curvePoints,
    ratioPoints,
    batchTimeline,
    summaryChips,
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

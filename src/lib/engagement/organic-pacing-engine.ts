/**
 * Organic Pacing & Anti-Bot Evasion Delivery Engine
 * Fully reverse-engineered from organicsmm.online production distribution algorithms.
 *
 * Implements:
 * 1. Biological S-Curve Pacing (Ramp Up, Peak, Decline lifecycle).
 * 2. Circadian / Time-of-Day Multipliers (IST / UTC+5.5 platform peak weighting).
 * 3. Human Behavior Scoring (gt algorithm: evaluating variance, hour, day, sessions).
 * 4. Anti-Bot Pattern Desaturation (No round multiples of 5, no consecutive repeats).
 * 5. Periodicity Disruption (patternBreaker flags disrupting Fourier harmonic detection).
 * 6. Ke Conservation Equation (Exact sum redistribution preserving bounds & variance).
 * 7. Views-First Gating & Proportional Auxiliary Synchronicity.
 */

export type EngagementMetric = "views" | "likes" | "comments" | "saves" | "shares";

export type SessionType = "megaBurst" | "burst" | "normal" | "slow" | "pause" | "deadZone";

export type TimeOfDayLabel = "🔥 Peak" | "☀️ Morning" | "🌙 Night" | "📊 Normal";

export interface OrganicBatch {
  runNumber: number;
  scheduledAt: Date;
  minuteOffset: number;
  quantity: number;
  baseQuantity: number;
  varianceApplied: number;
  peakMultiplier: number;
  dayOfWeek: number;
  hourOfDay: number;
  sessionType: SessionType;
  humanBehaviorScore: number;
  patternBreaker: boolean;
  timeOfDayLabel: TimeOfDayLabel;
}

export interface OrganicPlanResult {
  engagementType: EngagementMetric;
  totalQuantity: number;
  runs: OrganicBatch[];
  totalDurationMinutes: number;
  avgHumanScore: number;
  varietyIndex: number;
  patternBreakCount: number;
  warnings: string[];
}

export interface OrganicPlanOptions {
  runsCount?: number;
  durationHours?: number;
  variancePercent?: number; // default ~25%
  peakHoursEnabled?: boolean; // default true
  providerMinimum?: number;
  startDate?: Date;
  applyInitialDelay?: boolean; // default true
}

// 1. Provider minimums per metric
export const PROVIDER_MINIMUMS: Record<EngagementMetric, number> = {
  views: 100,
  likes: 10,
  comments: 10,
  saves: 10,
  shares: 10,
};

// 2. Interval & Jitter configuration (in minutes)
export const INTERVAL_CONFIGS: Record<
  EngagementMetric,
  { min: number; max: number; jitter: number; chaosMultiplier: number }
> = {
  views: { min: 15, max: 120, jitter: 40, chaosMultiplier: 2.2 },
  likes: { min: 25, max: 180, jitter: 50, chaosMultiplier: 2.5 },
  comments: { min: 60, max: 360, jitter: 80, chaosMultiplier: 3.0 },
  saves: { min: 90, max: 480, jitter: 100, chaosMultiplier: 3.2 },
  shares: { min: 50, max: 240, jitter: 60, chaosMultiplier: 2.8 },
};

// 3. Batch bounds & scaling limits
export const BATCH_BOUNDS: Record<
  EngagementMetric,
  { min: number; max: number; variance: number; spikeMax: number; maxMultiplier: number; hardCap: number }
> = {
  views: { min: 100, max: 250, variance: 0.65, spikeMax: 350, maxMultiplier: 2.5, hardCap: 400 },
  likes: { min: 10, max: 45, variance: 0.70, spikeMax: 80, maxMultiplier: 4.0, hardCap: 100 },
  comments: { min: 10, max: 20, variance: 0.60, spikeMax: 35, maxMultiplier: 3.0, hardCap: 50 },
  saves: { min: 10, max: 25, variance: 0.65, spikeMax: 45, maxMultiplier: 3.0, hardCap: 60 },
  shares: { min: 10, max: 30, variance: 0.68, spikeMax: 55, maxMultiplier: 3.5, hardCap: 70 },
};

// 4. Initial start delays (in minutes before batch #1)
export const INITIAL_DELAYS_MINUTES: Record<EngagementMetric, { min: number; max: number }> = {
  views: { min: 1, max: 25 },
  likes: { min: 8, max: 90 },
  comments: { min: 20, max: 180 },
  saves: { min: 40, max: 280 },
  shares: { min: 25, max: 200 },
};

// 5. Pacing curve lifecycle (Ramp up, peak, decline, viral chances)
export const LIFECYCLE_CURVES: Record<
  EngagementMetric,
  {
    rampUpPercent: number;
    peakPercent: number;
    declinePercent: number;
    viralChance: number;
    dipChance: number;
    microPauseChance: number;
    megaSpikeChance: number;
  }
> = {
  views: { rampUpPercent: 12, peakPercent: 55, declinePercent: 33, viralChance: 0.18, dipChance: 0.12, microPauseChance: 0.08, megaSpikeChance: 0.04 },
  likes: { rampUpPercent: 20, peakPercent: 48, declinePercent: 32, viralChance: 0.15, dipChance: 0.15, microPauseChance: 0.10, megaSpikeChance: 0.03 },
  comments: { rampUpPercent: 30, peakPercent: 38, declinePercent: 32, viralChance: 0.08, dipChance: 0.20, microPauseChance: 0.15, megaSpikeChance: 0.02 },
  saves: { rampUpPercent: 35, peakPercent: 32, declinePercent: 33, viralChance: 0.05, dipChance: 0.22, microPauseChance: 0.18, megaSpikeChance: 0.01 },
  shares: { rampUpPercent: 25, peakPercent: 42, declinePercent: 33, viralChance: 0.12, dipChance: 0.18, microPauseChance: 0.12, megaSpikeChance: 0.025 },
};

// 6. Day of week multipliers (0 = Sunday, 1 = Monday ... 6 = Saturday)
export const DAY_OF_WEEK_MULTIPLIERS: Record<EngagementMetric, number[]> = {
  views: [1.30, 0.85, 0.90, 0.95, 1.00, 1.15, 1.35],
  likes: [1.25, 0.80, 0.88, 0.92, 0.98, 1.10, 1.28],
  comments: [1.10, 0.75, 0.85, 0.90, 0.95, 1.05, 1.15],
  saves: [1.00, 0.90, 0.95, 0.98, 1.00, 1.02, 1.05],
  shares: [1.20, 0.78, 0.85, 0.90, 0.95, 1.10, 1.25],
};

// 7. Hour of day multipliers (0 to 23 in IST UTC+5.5 / BST UTC+6)
export const HOUR_OF_DAY_MULTIPLIERS: Record<EngagementMetric, number[]> = {
  views: [
    0.18, 0.12, 0.08, 0.07, 0.12, 0.28, // 00:00 - 05:00 Night dead zone
    0.48, 0.68, 0.82, 0.93, 0.98, 1.08, // 06:00 - 11:00 Morning ramp
    0.98, 0.88, 0.83, 0.88, 0.93, 1.08, // 12:00 - 17:00 Afternoon steady
    1.38, 1.58, 1.72, 1.52, 1.18, 0.68, // 18:00 - 23:00 Evening prime peak
  ],
  likes: [
    0.13, 0.08, 0.06, 0.06, 0.10, 0.23,
    0.38, 0.58, 0.73, 0.83, 0.93, 1.03,
    0.93, 0.83, 0.78, 0.83, 0.88, 0.98,
    1.28, 1.48, 1.63, 1.58, 1.28, 0.78,
  ],
  comments: [
    0.08, 0.06, 0.04, 0.04, 0.08, 0.18,
    0.33, 0.48, 0.63, 0.73, 0.83, 0.93,
    0.88, 0.78, 0.73, 0.78, 0.83, 0.93,
    1.18, 1.38, 1.53, 1.68, 1.48, 0.88,
  ],
  saves: [
    0.28, 0.23, 0.18, 0.18, 0.23, 0.33,
    0.48, 0.58, 0.68, 0.78, 0.88, 0.98,
    0.93, 0.88, 0.83, 0.88, 0.93, 0.98,
    1.13, 1.23, 1.28, 1.23, 1.08, 0.68,
  ],
  shares: [
    0.10, 0.06, 0.04, 0.04, 0.08, 0.18,
    0.38, 0.53, 0.68, 0.83, 0.98, 1.18,
    1.28, 1.08, 0.88, 0.83, 0.88, 0.98,
    1.33, 1.53, 1.58, 1.43, 1.18, 0.73,
  ],
};

// 8. Session Types & Probabilities
export const ALL_SESSION_TYPES: SessionType[] = [
  "megaBurst",
  "burst",
  "normal",
  "slow",
  "pause",
  "deadZone",
];

export const SESSION_PROBABILITIES: Record<EngagementMetric, Record<SessionType, number>> = {
  views: { megaBurst: 0.06, burst: 0.18, normal: 0.48, slow: 0.18, pause: 0.07, deadZone: 0.03 },
  likes: { megaBurst: 0.04, burst: 0.15, normal: 0.45, slow: 0.22, pause: 0.10, deadZone: 0.04 },
  comments: { megaBurst: 0.02, burst: 0.08, normal: 0.40, slow: 0.30, pause: 0.15, deadZone: 0.05 },
  saves: { megaBurst: 0.02, burst: 0.06, normal: 0.38, slow: 0.32, pause: 0.16, deadZone: 0.06 },
  shares: { megaBurst: 0.03, burst: 0.12, normal: 0.42, slow: 0.25, pause: 0.13, deadZone: 0.05 },
};

export const SESSION_MULTIPLIERS: Record<SessionType, { interval: number; quantity: number }> = {
  megaBurst: { interval: 0.20, quantity: 3.0 },
  burst: { interval: 0.35, quantity: 2.0 },
  normal: { interval: 1.00, quantity: 1.0 },
  slow: { interval: 2.20, quantity: 0.6 },
  pause: { interval: 4.00, quantity: 0.35 },
  deadZone: { interval: 8.00, quantity: 0.20 },
};

/**
 * Normalizes metric key
 */
export function normalizeMetric(metric: string): EngagementMetric {
  const m = metric.toLowerCase();
  if (m.includes("like")) return "likes";
  if (m.includes("comment")) return "comments";
  if (m.includes("save")) return "saves";
  if (m.includes("share") || m.includes("repost")) return "shares";
  return "views";
}

/**
 * Picks random session type according to OrganicSMM's probability matrix
 */
export function pickSessionType(metric: EngagementMetric): SessionType {
  const table = SESSION_PROBABILITIES[metric] || SESSION_PROBABILITIES.views;
  const rand = Math.random();
  let cumulative = 0;
  for (const session of ALL_SESSION_TYPES) {
    cumulative += table[session];
    if (rand < cumulative) return session;
  }
  return "normal";
}

/**
 * Calculates human behavior score (0 to 100) exactly as OrganicSMM does (function gt).
 */
export function calculateHumanBehaviorScore(
  quantity: number,
  intervalMinutes: number,
  hourOfDay: number,
  dayOfWeek: number,
  sessionType: SessionType,
  metric: EngagementMetric
): number {
  let score = 50;
  const bounds = BATCH_BOUNDS[metric] || BATCH_BOUNDS.views;
  const median = (bounds.min + bounds.max) / 2;
  const deviation = Math.abs(quantity - median) / median;
  score += deviation * 20;

  const hourMult = (HOUR_OF_DAY_MULTIPLIERS[metric] || HOUR_OF_DAY_MULTIPLIERS.views)[hourOfDay] || 1.0;
  if (hourMult > 1) score += 10;
  if (hourOfDay >= 2 && hourOfDay <= 5 && quantity < median) score += 15;

  const dayMult = (DAY_OF_WEEK_MULTIPLIERS[metric] || DAY_OF_WEEK_MULTIPLIERS.views)[dayOfWeek] || 1.0;
  if ((dayOfWeek === 0 || dayOfWeek === 6) && dayMult > 1) score += 8;

  if (sessionType === "pause") score += 12;
  if (sessionType === "burst") score += 5;

  const minInterval = (INTERVAL_CONFIGS[metric] || INTERVAL_CONFIGS.views).min || 30;
  const intervalDeviation = Math.abs(intervalMinutes - minInterval) / minInterval;
  score += Math.min(intervalDeviation * 15, 15);

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Returns user-friendly time-of-day label based on IST/BST hour
 */
export function getTimeOfDayLabel(date: Date): TimeOfDayLabel {
  // IST offset is +5.5h (19800000 ms)
  const istDate = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const hour = istDate.getUTCHours();
  if (hour >= 18 && hour <= 22) return "🔥 Peak";
  if (hour >= 9 && hour <= 12) return "☀️ Morning";
  if (hour >= 23 || hour < 6) return "🌙 Night";
  return "📊 Normal";
}

/**
 * Scaled batch bounds for larger targets (function Ns)
 */
export function scaleBatchBounds(
  metric: EngagementMetric,
  totalQuantity: number,
  providerMin: number
): { min: number; max: number; spikeMax: number; ultraMax: number } {
  const a = BATCH_BOUNDS[metric] || BATCH_BOUNDS.views;
  const hardCap = a.hardCap || 400;
  const baseMax = Math.min(hardCap, Math.max(a.max, Math.round(providerMin * (a.maxMultiplier || 2.5))));
  const baseSpikeMax = Math.min(hardCap, Math.max(a.spikeMax, Math.round(baseMax * 1.3)));

  const threshold = { views: 50000, likes: 5000, comments: 500, saves: 1000, shares: 2000 }[metric] || 10000;
  if (totalQuantity <= threshold) {
    return {
      min: Math.max(a.min, providerMin),
      max: baseMax,
      spikeMax: baseSpikeMax,
      ultraMax: Math.min(hardCap, Math.round(baseMax * 1.2)),
    };
  }

  const ratio = Math.max(1, totalQuantity / threshold);
  const scale = Math.sqrt(ratio);
  const scaledMin = Math.max(providerMin, Math.round(a.min * scale));
  const scaledMax = Math.min(hardCap * 1.5, Math.round(baseMax * scale));
  const scaledSpike = Math.min(hardCap * 2.0, Math.round(baseSpikeMax * scale));
  const ultraMax = Math.min(hardCap * 2.5, Math.max(scaledMax * 1.5, Math.ceil(totalQuantity / 400)));

  return { min: scaledMin, max: scaledMax, spikeMax: scaledSpike, ultraMax };
}

/**
 * Anti-Bot Desaturator: Prevents round multiples of 5, consecutive identical numbers,
 * and duplicate numbers in recent batches (function Es).
 */
export function antiBotDesaturateQuantity(
  candidate: number,
  minBound: number,
  maxBound: number,
  usedSet: Set<number>,
  previousQuantity?: number
): number {
  const d = Math.round(Math.min(minBound, maxBound));
  const u = Math.round(Math.max(minBound, maxBound));
  const h = Math.round(Math.max(d, Math.min(u, candidate)));
  const proximityThreshold = previousQuantity != null ? Math.max(2, Math.floor(Math.max(d, previousQuantity) * 0.02)) : 0;

  let bestChoice = h;

  for (let step = 0; step <= u - d; step++) {
    const trials = step === 0 ? [h] : [h + step, h - step];
    for (const val of trials) {
      if (val < d || val > u) continue;
      const isAlreadyUsed = usedSet.has(val);
      const isTooCloseToPrevious = previousQuantity != null && Math.abs(val - previousQuantity) < proximityThreshold;
      const isRoundNumber = val % 5 === 0 && val !== d;

      if (!isAlreadyUsed && !isTooCloseToPrevious && !isRoundNumber) {
        return val;
      }

      if ((!isAlreadyUsed && !isTooCloseToPrevious && bestChoice === h) || (!isAlreadyUsed && bestChoice === h)) {
        bestChoice = val;
      }
    }
  }

  return bestChoice;
}

/**
 * Ke Conservation Equation Pass: Adjusts distributed batch quantities so the sum
 * strictly equals totalQuantity without leaving flat round numbers on the final batch (function Ke).
 */
export function solveKeConservationEquation<T extends { quantity: number; baseQuantity?: number; varianceApplied?: number }>(
  runs: T[],
  targetQuantity: number,
  minBound: number,
  maxBound: number
): T[] {
  if (runs.length <= 1) return runs;

  const result = runs.map((r) => ({ ...r }));
  const upperBound = Math.max(minBound, maxBound);
  const usedSet = new Set<number>();

  result.forEach((run, idx) => {
    const prevQty = idx > 0 ? result[idx - 1].quantity : undefined;
    run.quantity = antiBotDesaturateQuantity(run.quantity, minBound, upperBound, usedSet, prevQty);
    usedSet.add(run.quantity);
  });

  let remainder = targetQuantity - result.reduce((sum, r) => sum + r.quantity, 0);
  let iterations = 0;

  while (remainder !== 0 && iterations < 10000) {
    let changed = false;
    const sortedIndices = result
      .map((r, i) => ({ index: i, quantity: r.quantity }))
      .sort((a, b) => (remainder > 0 ? a.quantity - b.quantity : b.quantity - a.quantity))
      .map((item) => item.index);

    for (const idx of sortedIndices) {
      const step = remainder > 0 ? 1 : -1;
      const candidate = result[idx].quantity + step;
      const prevQty = idx > 0 ? result[idx - 1].quantity : undefined;

      const isWithinBounds = candidate >= minBound && candidate <= upperBound;
      const isDuplicate = result.some((r, i) => i !== idx && r.quantity === candidate);
      const isCloseToPrev = prevQty != null && Math.abs(candidate - prevQty) < 2;

      if (isWithinBounds && !isDuplicate && !isCloseToPrev) {
        result[idx].quantity = candidate;
        remainder += remainder > 0 ? -1 : 1;
        changed = true;
        if (remainder === 0) break;
      }
    }

    if (!changed) break;
    iterations++;
  }

  // If any remainder remains, distribute step-by-step respecting minBound & upperBound
  let guard = 0;
  while (remainder !== 0 && guard < result.length * 20) {
    if (remainder > 0) {
      const candidates = result.filter((r) => r.quantity < upperBound).sort((a, b) => a.quantity - b.quantity);
      if (candidates.length === 0) break;
      candidates[0].quantity++;
      remainder--;
    } else {
      const candidates = result.filter((r) => r.quantity > minBound).sort((a, b) => b.quantity - a.quantity);
      if (candidates.length === 0) break;
      candidates[0].quantity--;
      remainder++;
    }
    guard++;
  }

  result.forEach((r) => {
    r.quantity = Math.max(minBound, Math.min(upperBound, r.quantity));
    r.baseQuantity = r.quantity;
    r.varianceApplied = 0;
  });

  return result;
}

/**
 * Full Organic SMM Delivery Plan Generator (function Tt).
 * Generates an organic, anti-bot optimized delivery plan with human behavioral scores,
 * realistic session types, IST peak hours, and non-repeating desaturated quantities.
 */
export function generateOrganicDeliveryPlan(
  rawMetric: string,
  totalQuantity: number,
  options: OrganicPlanOptions = {}
): OrganicPlanResult {
  const metric = normalizeMetric(rawMetric);
  const warnings: string[] = [];

  const providerMin = options.providerMinimum || PROVIDER_MINIMUMS[metric] || 10;
  const intervalCfg = INTERVAL_CONFIGS[metric] || INTERVAL_CONFIGS.views;
  const bounds = BATCH_BOUNDS[metric] || BATCH_BOUNDS.views;
  const scaledBounds = scaleBatchBounds(metric, totalQuantity, providerMin);

  const variancePercent = options.variancePercent ?? 25;
  const peakHoursEnabled = options.peakHoursEnabled ?? true;
  const baseStartDate = options.startDate ? new Date(options.startDate.getTime()) : new Date();
  const applyInitialDelay = options.applyInitialDelay ?? true;

  const runs: OrganicBatch[] = [];
  let patternBreakCount = 0;

  // Check minimum total
  if (totalQuantity < providerMin) {
    warnings.push(`Total quantity ${totalQuantity} is below provider minimum ${providerMin}`);
    const istDate = new Date(baseStartDate.getTime() + 5.5 * 60 * 60 * 1000);
    const score = calculateHumanBehaviorScore(totalQuantity, 30, istDate.getUTCHours(), istDate.getUTCDay(), "normal", metric);
    runs.push({
      runNumber: 1,
      scheduledAt: baseStartDate,
      minuteOffset: 0,
      quantity: totalQuantity,
      baseQuantity: totalQuantity,
      varianceApplied: 0,
      peakMultiplier: 1.0,
      dayOfWeek: istDate.getUTCDay(),
      hourOfDay: istDate.getUTCHours(),
      sessionType: "normal",
      humanBehaviorScore: score,
      patternBreaker: false,
      timeOfDayLabel: getTimeOfDayLabel(baseStartDate),
    });

    return {
      engagementType: metric,
      totalQuantity,
      runs,
      totalDurationMinutes: 0,
      avgHumanScore: score,
      varietyIndex: 0,
      patternBreakCount: 0,
      warnings,
    };
  }

  // Initial delay jitter (prevent immediate 0s robotic trigger)
  let initialDelayMinutes = 0;
  if (applyInitialDelay) {
    const delayRange = INITIAL_DELAYS_MINUTES[metric] || { min: 2, max: 20 };
    initialDelayMinutes = Math.floor(delayRange.min + Math.random() * (delayRange.max - delayRange.min));
  }

  const effectiveStartTime = new Date(baseStartDate.getTime() + initialDelayMinutes * 60 * 1000);

  // PATH 1: Time-constrained / Preset runs delivery (e.g. 5h for 2K, 16h for 5K, 22h for 10K, etc.)
  if (options.durationHours && options.durationHours > 0) {
    const durationMinutes = options.durationHours * 60;
    const totalDurationMs = durationMinutes * 60 * 1000;
    const endTimeMs = effectiveStartTime.getTime() + totalDurationMs;

    let targetRunsCount = options.runsCount;
    if (!targetRunsCount || targetRunsCount <= 0) {
      const avgBatch = (scaledBounds.min + scaledBounds.max) / 2;
      targetRunsCount = Math.ceil(totalQuantity / Math.max(1, avgBatch));
      const maxPossibleBatches = Math.floor(totalQuantity / providerMin);
      targetRunsCount = Math.min(300, maxPossibleBatches, Math.max(2, targetRunsCount));
    }

    const runsCount = Math.max(2, targetRunsCount);
    const avgStepMs = (endTimeMs - effectiveStartTime.getTime()) / (runsCount - 1);
    const maxJitterMs = Math.min(2 * 60 * 1000, avgStepMs * 0.2);

    const hourMultipliers = HOUR_OF_DAY_MULTIPLIERS[metric] || HOUR_OF_DAY_MULTIPLIERS.views;
    const dayMultipliers = DAY_OF_WEEK_MULTIPLIERS[metric] || DAY_OF_WEEK_MULTIPLIERS.views;

    const weights: number[] = [];
    const scheduledTimes: number[] = [];
    let lastTime = effectiveStartTime.getTime();

    for (let i = 0; i < runsCount; i++) {
      const idealTime = effectiveStartTime.getTime() + i * avgStepMs;
      const jitter = (Math.random() * 2 - 1) * maxJitterMs;
      let scheduledMs = Math.round(idealTime + jitter);

      if (i === 0) scheduledMs = Math.max(scheduledMs, effectiveStartTime.getTime());
      if (i === runsCount - 1) scheduledMs = Math.min(scheduledMs, endTimeMs);
      scheduledMs = Math.max(scheduledMs, lastTime + 30 * 1000);
      lastTime = scheduledMs;

      // Calculate IST time for anti-bot multiplier
      const istDate = new Date(scheduledMs + 5.5 * 60 * 60 * 1000);
      const hour = istDate.getUTCHours();
      const day = istDate.getUTCDay();

      let weight = 1.0;
      if (peakHoursEnabled) {
        weight *= (hourMultipliers[hour] || 1.0) * (dayMultipliers[day] || 1.0);
      }

      // Add biological variance (±20%)
      const varianceRange = Math.min(0.25, Math.max(0.05, (variancePercent / 100) * 0.25));
      weight *= 1 + (Math.random() * 2 - 1) * varianceRange;

      weights.push(Math.max(0.05, weight));
      scheduledTimes.push(scheduledMs);
    }

    const sumWeights = weights.reduce((a, b) => a + b, 0) || 1.0;
    const upperLimit = Math.max(scaledBounds.ultraMax, Math.ceil((totalQuantity / runsCount) * 3));

    let rawQuantities = weights.map((w) => Math.round((w / sumWeights) * totalQuantity));

    // Anti-bot Scrambling Pass 1: Eliminate identical consecutive numbers & round numbers
    for (let i = 1; i < rawQuantities.length; i++) {
      if (rawQuantities[i] === rawQuantities[i - 1] && rawQuantities[i] > providerMin) {
        const delta = Math.ceil(Math.random() * Math.max(3, Math.floor(rawQuantities[i] * 0.15)));
        rawQuantities[i] = Math.random() > 0.5
          ? Math.max(providerMin, rawQuantities[i] - delta)
          : Math.min(upperLimit, rawQuantities[i] + delta);
      }

      // Disrupt multiples of 5 (Anti-Bot Pattern Evasion)
      if (rawQuantities[i] % 5 === 0 && rawQuantities[i] > providerMin) {
        const perturbation = Math.ceil(Math.random() * 3) * (Math.random() > 0.5 ? 1 : -1);
        rawQuantities[i] = Math.max(providerMin, Math.min(upperLimit, rawQuantities[i] + perturbation));
      }
    }

    // Exact Ke Conservation Equation
    const adjustedRuns = solveKeConservationEquation(
      rawQuantities.map((q, idx) => ({
        quantity: q,
        baseQuantity: q,
        varianceApplied: 0,
        idx,
      })),
      totalQuantity,
      providerMin,
      upperLimit
    );

    for (let i = 0; i < runsCount; i++) {
      const scheduledAt = new Date(scheduledTimes[i]);
      const minuteOffset = Math.round((scheduledTimes[i] - baseStartDate.getTime()) / (60 * 1000));
      const istDate = new Date(scheduledTimes[i] + 5.5 * 60 * 60 * 1000);
      const hour = istDate.getUTCHours();
      const day = istDate.getUTCDay();

      const stepMinutes = Math.round(
        i === 0 ? initialDelayMinutes : (scheduledTimes[i] - scheduledTimes[i - 1]) / 60000
      );

      const isPatternBreaker = Math.random() < 0.18;
      if (isPatternBreaker) patternBreakCount++;

      const sessionType = i === 0 ? "burst" : pickSessionType(metric);
      const qty = adjustedRuns[i].quantity;
      const score = calculateHumanBehaviorScore(qty, Math.max(1, stepMinutes), hour, day, sessionType, metric);

      runs.push({
        runNumber: i + 1,
        scheduledAt,
        minuteOffset,
        quantity: qty,
        baseQuantity: qty,
        varianceApplied: 0,
        peakMultiplier: Number(((hourMultipliers[hour] || 1.0) * (dayMultipliers[day] || 1.0)).toFixed(2)),
        dayOfWeek: day,
        hourOfDay: hour,
        sessionType,
        humanBehaviorScore: score,
        patternBreaker: isPatternBreaker,
        timeOfDayLabel: getTimeOfDayLabel(scheduledAt),
      });
    }

    const actualDurationMinutes =
      runs.length > 1
        ? Math.round((runs[runs.length - 1].scheduledAt.getTime() - runs[0].scheduledAt.getTime()) / 60000)
        : 0;

    const avgHumanScore = Math.round(runs.reduce((sum, r) => sum + r.humanBehaviorScore, 0) / runs.length);

    // Compute variety index (standard deviation normalized by mean)
    const quantities = runs.map((r) => r.quantity);
    const mean = quantities.reduce((a, b) => a + b, 0) / quantities.length;
    const variance = quantities.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / quantities.length;
    const varietyIndex = Math.min(100, Math.round((Math.sqrt(variance) / mean) * 100));

    return {
      engagementType: metric,
      totalQuantity,
      runs,
      totalDurationMinutes: actualDurationMinutes,
      avgHumanScore,
      varietyIndex,
      patternBreakCount,
      warnings,
    };
  }

  // PATH 2: Open-ended / Dynamic pacing based on session clustering
  let remainingQuantity = totalQuantity;
  let currentTime = new Date(effectiveStartTime.getTime());
  let runNumber = 1;
  let previousQuantity = 0;
  const maxRunsLimit = Math.min(800, Math.max(500, Math.ceil(totalQuantity / 1000)));

  const curveConfig = LIFECYCLE_CURVES[metric] || LIFECYCLE_CURVES.views;
  const hourMultipliers = HOUR_OF_DAY_MULTIPLIERS[metric] || HOUR_OF_DAY_MULTIPLIERS.views;
  const dayMultipliers = DAY_OF_WEEK_MULTIPLIERS[metric] || DAY_OF_WEEK_MULTIPLIERS.views;

  while (remainingQuantity > 0 && runNumber <= maxRunsLimit) {
    const session = pickSessionType(metric);
    const sessionMultipliers = SESSION_MULTIPLIERS[session];
    const isPatternBreaker = Math.random() < 0.18;

    let intervalStep = sessionMultipliers.interval;
    intervalStep *= 0.5 + Math.random() * intervalCfg.chaosMultiplier;

    if (isPatternBreaker) {
      patternBreakCount++;
      const rand = Math.random();
      if (rand < 0.3) intervalStep *= 0.15;
      else if (rand < 0.6) intervalStep *= 3.5;
      else intervalStep *= 0.2 + Math.random() * 2.8;
    }

    const baseIntervalMinutes = intervalCfg.min + Math.random() * (intervalCfg.max - intervalCfg.min);
    const finalIntervalMinutes = Math.max(3, baseIntervalMinutes * intervalStep);
    const intervalMs = finalIntervalMinutes * 60 * 1000;

    const jitterMs = (Math.random() > 0.5 ? 1 : -1) * Math.random() * intervalCfg.jitter * 1.5 * 60 * 1000;
    const scheduledAt = new Date(currentTime.getTime() + jitterMs);

    const istDate = new Date(scheduledAt.getTime() + 5.5 * 60 * 60 * 1000);
    const hour = istDate.getUTCHours();
    const day = istDate.getUTCDay();

    let timeMultiplier = (hourMultipliers[hour] || 1.0) * (dayMultipliers[day] || 1.0);

    // Lifecycle curve position
    const estimatedTotalRuns = Math.ceil(totalQuantity / ((scaledBounds.min + scaledBounds.max) / 2));
    const progress = runNumber / Math.max(estimatedTotalRuns, 1);

    let lifecycleMult = 1.0;
    const noise = 0.7 + Math.random() * 0.6;
    if (progress <= curveConfig.rampUpPercent / 100) {
      lifecycleMult = (0.3 + (progress / (curveConfig.rampUpPercent / 100)) * 0.7) * noise;
    } else if (progress <= (curveConfig.rampUpPercent + curveConfig.peakPercent) / 100) {
      lifecycleMult = (0.9 + Math.random() * 0.4) * noise;
    } else {
      const declineFrac = (progress - (curveConfig.rampUpPercent + curveConfig.peakPercent) / 100) / (curveConfig.declinePercent / 100);
      lifecycleMult = Math.max(0.3, (1 - declineFrac * 0.5) * noise);
    }

    // Rare viral / micro-event triggers
    let anomalyMult = 1.0;
    const eventRand = Math.random();
    if (eventRand < curveConfig.megaSpikeChance) {
      anomalyMult = 2.5 + Math.random() * 2.0;
    } else if (eventRand < curveConfig.megaSpikeChance + curveConfig.viralChance) {
      anomalyMult = 1.5 + Math.random() * 1.2;
    } else if (eventRand < curveConfig.megaSpikeChance + curveConfig.viralChance + curveConfig.microPauseChance) {
      anomalyMult = 0.15 + Math.random() * 0.25;
    } else if (eventRand < curveConfig.megaSpikeChance + curveConfig.viralChance + curveConfig.microPauseChance + curveConfig.dipChance) {
      anomalyMult = 0.25 + Math.random() * 0.35;
    }

    let combinedMultiplier = timeMultiplier * lifecycleMult * anomalyMult * (0.6 + Math.random() * 0.8);
    if (peakHoursEnabled) {
      combinedMultiplier = Math.max(0.1, Math.min(4.0, combinedMultiplier));
    }

    // Determine candidate quantity
    let baseQty = scaledBounds.min + Math.random() * (scaledBounds.max - scaledBounds.min);
    baseQty = Math.round(baseQty * sessionMultipliers.quantity);

    const varianceRange = Math.min(variancePercent * 1.8, 90);
    const varianceFactor = 1 + (Math.random() * 2 - 1) * (varianceRange / 100);
    let candidateQty = Math.round(baseQty * combinedMultiplier * varianceFactor);

    candidateQty = Math.max(candidateQty, providerMin);
    candidateQty = Math.min(candidateQty, scaledBounds.ultraMax);

    // Anti-bot desaturation: prevent round multiples of 5
    if (candidateQty % 5 === 0 && candidateQty > providerMin) {
      const shift = (Math.random() > 0.5 ? 1 : -1) * Math.ceil(Math.random() * 4);
      candidateQty = Math.max(providerMin, candidateQty + shift);
    }

    // Avoid proximity to previous batch
    if (previousQuantity > 0 && Math.abs(candidateQty - previousQuantity) / Math.max(candidateQty, previousQuantity) < 0.25) {
      candidateQty = Math.random() > 0.5
        ? Math.round(candidateQty * (1.5 + Math.random() * 1.5))
        : Math.max(providerMin, Math.round(candidateQty * (0.3 + Math.random() * 0.3)));
      candidateQty = Math.max(providerMin, Math.min(scaledBounds.ultraMax, candidateQty));
      if (candidateQty % 5 === 0 && candidateQty > providerMin) candidateQty += Math.ceil(Math.random() * 3);
    }

    candidateQty = Math.min(candidateQty, remainingQuantity);
    if (remainingQuantity < providerMin * 2) {
      candidateQty = remainingQuantity;
    }
    if (remainingQuantity - candidateQty > 0 && remainingQuantity - candidateQty < providerMin) {
      candidateQty = remainingQuantity;
    }

    if (candidateQty >= providerMin || remainingQuantity === candidateQty) {
      const score = calculateHumanBehaviorScore(candidateQty, finalIntervalMinutes, hour, day, session, metric);
      const minuteOffset = Math.round((scheduledAt.getTime() - baseStartDate.getTime()) / 60000);

      runs.push({
        runNumber,
        scheduledAt,
        minuteOffset,
        quantity: candidateQty,
        baseQuantity: baseQty,
        varianceApplied: candidateQty - baseQty,
        peakMultiplier: Number(combinedMultiplier.toFixed(2)),
        dayOfWeek: day,
        hourOfDay: hour,
        sessionType: session,
        humanBehaviorScore: score,
        patternBreaker: isPatternBreaker,
        timeOfDayLabel: getTimeOfDayLabel(scheduledAt),
      });

      previousQuantity = candidateQty;
      remainingQuantity -= candidateQty;
      runNumber++;

      if (remainingQuantity > 0 && remainingQuantity < providerMin) {
        runs[runs.length - 1].quantity += remainingQuantity;
        remainingQuantity = 0;
      }
    }

    currentTime = new Date(currentTime.getTime() + intervalMs);
  }

  // Final Ke Conservation Pass
  const finalizedRuns = solveKeConservationEquation(runs, totalQuantity, providerMin, scaledBounds.ultraMax);

  const actualDurationMinutes =
    finalizedRuns.length > 1
      ? Math.round((finalizedRuns[finalizedRuns.length - 1].scheduledAt.getTime() - finalizedRuns[0].scheduledAt.getTime()) / 60000)
      : 0;

  const avgHumanScore = Math.round(finalizedRuns.reduce((sum, r) => sum + r.humanBehaviorScore, 0) / finalizedRuns.length);

  const quantities = finalizedRuns.map((r) => r.quantity);
  const mean = quantities.reduce((a, b) => a + b, 0) / quantities.length;
  const variance = quantities.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / quantities.length;
  const varietyIndex = Math.min(100, Math.round((Math.sqrt(variance) / mean) * 100));

  return {
    engagementType: metric,
    totalQuantity,
    runs: finalizedRuns,
    totalDurationMinutes: actualDurationMinutes,
    avgHumanScore,
    varietyIndex,
    patternBreakCount,
    warnings,
  };
}

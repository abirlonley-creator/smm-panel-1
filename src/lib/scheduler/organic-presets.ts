/**
 * Organic Pacing Presets Engine
 * 
 * Defines continuous mathematical shape functions f(t) for t in [0, 1],
 * sampled across N batches with seeded PRNG (mulberry32), lognormal noise,
 * controlled spikes, and time jitter.
 */

export type OrganicPresetId =
  | "SLOW_BURN"
  | "TEST_BATCH_BREAKOUT"
  | "EVENING_SURGE"
  | "VIRAL_SPIKE"
  | "FRONT_LOADED_DECAY"
  | "DOUBLE_WAVE"
  | "HEARTBEAT"
  | "LATE_ROCKET"
  | "SLEEPER_HIT"
  | "LONG_TAIL";

export type SpikeIntensity = "off" | "low" | "medium" | "high";

export interface OrganicPresetConfig {
  id: OrganicPresetId;
  name: string;
  tag: string;
  description: string;
  asciiVisual: string;
  cumulativeDesc: string;
  fn: (t: number) => number;
}

/**
 * 32-bit Seeded PRNG (Mulberry32)
 * Produces deterministic pseudo-random numbers in [0, 1) from an integer seed.
 */
export function createMulberry32(seed: number): () => number {
  let s = Math.floor(seed) | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box-Muller transform for standard normal random variables using seeded PRNG.
 */
export function seededNormal(rng: () => number, mean = 0, stdDev = 1): number {
  const u1 = Math.max(1e-7, rng());
  const u2 = rng();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z0 * stdDev;
}

/**
 * Circadian Audience Activity Curve
 * Normalized relative audience activity throughout a 24-hour day (t from 0 to 1 = 0:00 to 24:00):
 * - Quiet overnight (00:00 - 06:00): ~15-25%
 * - Morning commute/start (08:00 - 10:30): ~65-75%
 * - Afternoon plateau & post-lunch dip (13:00 - 15:30): ~50-60%
 * - Evening peak primetime (19:00 - 22:30): 100% peak
 */
export function audienceCircadianActivity(t: number): number {
  // Normalize t in [0, 1] representing 24h
  const modT = ((t % 1) + 1) % 1;
  // Baseline night level
  const baseline = 0.18;
  // Morning bump at t = 9.5 / 24 ≈ 0.395
  const morningBump = 0.55 * Math.exp(-Math.pow((modT - 0.395) / 0.08, 2));
  // Evening surge at t = 20.5 / 24 ≈ 0.854
  const eveningSurge = 0.82 * Math.exp(-Math.pow((modT - 0.854) / 0.11, 2));
  // Late afternoon plateau
  const afternoonDip = 0.12 * Math.sin(modT * Math.PI * 2);
  return Math.min(1.0, Math.max(baseline, baseline + morningBump + eveningSurge + afternoonDip));
}

/**
 * Continuous Mathematical Shape Functions f(t) for t in [0, 1].
 * All functions return positive values >= 0.01.
 */
export const ORGANIC_PRESET_DEFINITIONS: Record<OrganicPresetId, OrganicPresetConfig> = {
  SLOW_BURN: {
    id: "SLOW_BURN",
    name: "Slow Burn",
    tag: "Organic Momentum",
    description: "Starts low, builds gradually, peaks around 55-65% of the window, then tapers.",
    asciiVisual: "▁ ▂ ▃ ▄ ▆ ▇ █ ▆ ▄ ▂",
    cumulativeDesc: "Gentle natural S-curve",
    fn: (t: number) => {
      // Skewed Gaussian centered at t = 0.60
      const center = 0.60;
      const width = t <= center ? 0.30 : 0.22;
      const g = Math.exp(-Math.pow((t - center) / width, 2));
      return 0.08 + 0.92 * g;
    },
  },

  TEST_BATCH_BREAKOUT: {
    id: "TEST_BATCH_BREAKOUT",
    name: "Test-Batch Breakout",
    tag: "Staircase Verification",
    description: "Tiny flat test phase start, sudden jump, plateau, then explosive second breakout.",
    asciiVisual: "▁ ▁ ▁ ▂ ▆ ▆ ▅ █ █ ▅",
    cumulativeDesc: "Flat start with distinct stair-step surges",
    fn: (t: number) => {
      if (t < 0.28) {
        // Initial test phase (small flat volume)
        return 0.12 + 0.04 * t;
      } else if (t < 0.65) {
        // First breakout plateau
        const step1 = 1 / (1 + Math.exp(-25 * (t - 0.32)));
        return 0.14 + 0.52 * step1;
      } else {
        // Second explosive breakout
        const step2 = 1 / (1 + Math.exp(-25 * (t - 0.70)));
        return 0.66 + 0.34 * step2;
      }
    },
  },

  EVENING_SURGE: {
    id: "EVENING_SURGE",
    name: "Evening Surge",
    tag: "Two Primetime Humps",
    description: "Small morning bump, afternoon dip, and a massive evening primetime hump.",
    asciiVisual: "▃ ▅ ▃ ▂ ▂ ▃ ▆ █ ▇ ▃",
    cumulativeDesc: "Slow early progress, then steep evening ascent",
    fn: (t: number) => {
      // Morning hump around t = 0.20
      const morning = 0.45 * Math.exp(-Math.pow((t - 0.20) / 0.10, 2));
      // Evening peak around t = 0.78
      const evening = 1.0 * Math.exp(-Math.pow((t - 0.78) / 0.14, 2));
      return 0.10 + morning + evening;
    },
  },

  VIRAL_SPIKE: {
    id: "VIRAL_SPIKE",
    name: "Viral Spike",
    tag: "Explosive Burst",
    description: "Low and quiet, a huge burst (25-30% volume), then fast decay with aftershocks.",
    asciiVisual: "▂ ▂ ▃ █ ▇ ▄ ▃ ▂ ▂ ▁",
    cumulativeDesc: "Sharp cliff surge in the middle",
    fn: (t: number) => {
      const peakTime = 0.35;
      if (t < peakTime) {
        return 0.10 + 0.25 * Math.pow(t / peakTime, 3);
      }
      // Fast exponential decay after peak
      const decay = Math.exp(-4.5 * (t - peakTime));
      // Small aftershocks at t = 0.62 and t = 0.82
      const aftershock1 = 0.25 * Math.exp(-Math.pow((t - 0.62) / 0.05, 2));
      const aftershock2 = 0.15 * Math.exp(-Math.pow((t - 0.82) / 0.04, 2));
      return 0.08 + 0.92 * decay + aftershock1 + aftershock2;
    },
  },

  FRONT_LOADED_DECAY: {
    id: "FRONT_LOADED_DECAY",
    name: "Front-Loaded Decay",
    tag: "Early Blast + Tail",
    description: "Strong first hours (~70% early volume), followed by a long, steady organic tail.",
    asciiVisual: "█ ▇ ▅ ▄ ▃ ▂ ▂ ▁ ▁ ▁",
    cumulativeDesc: "Steep initial rise that gracefully levels off",
    fn: (t: number) => {
      return 0.06 + 0.94 * Math.exp(-3.2 * t);
    },
  },

  DOUBLE_WAVE: {
    id: "DOUBLE_WAVE",
    name: "Double Wave",
    tag: "Algorithmic Re-Push",
    description: "First wave rises and fades, dips, then a solid second wave when the platform re-pushes.",
    asciiVisual: "▃ ▆ █ ▅ ▂ ▁ ▃ ▅ ▃ ▁",
    cumulativeDesc: "Two consecutive S-curves with plateau between",
    fn: (t: number) => {
      const wave1 = 0.95 * Math.exp(-Math.pow((t - 0.24) / 0.12, 2));
      const wave2 = 0.62 * Math.exp(-Math.pow((t - 0.74) / 0.14, 2));
      return 0.08 + wave1 + wave2;
    },
  },

  HEARTBEAT: {
    id: "HEARTBEAT",
    name: "Heartbeat",
    tag: "Living Pulse",
    description: "Low organic base with irregular small rhythmic waves and lifelike vitality pulses.",
    asciiVisual: "▃ ▅ ▂ ▆ ▃ ▂ ▇ ▃ ▄ ▂",
    cumulativeDesc: "Wobbly organic stair climb that constantly climbs",
    fn: (t: number) => {
      const p1 = 0.40 * Math.exp(-Math.pow((t - 0.18) / 0.05, 2));
      const p2 = 0.65 * Math.exp(-Math.pow((t - 0.38) / 0.06, 2));
      const p3 = 0.80 * Math.exp(-Math.pow((t - 0.68) / 0.06, 2));
      const p4 = 0.35 * Math.exp(-Math.pow((t - 0.88) / 0.05, 2));
      const wobble = 0.08 * Math.sin(t * Math.PI * 14);
      return 0.18 + p1 + p2 + p3 + p4 + wobble;
    },
  },

  LATE_ROCKET: {
    id: "LATE_ROCKET",
    name: "Late Rocket",
    tag: "Night Start Ramp",
    description: "Nearly silent overnight ramp-up, followed by an aggressive morning launch.",
    asciiVisual: "▁ ▁ ▁ ▂ ▄ ▆ █ ▇ ▅ ▃",
    cumulativeDesc: "Extended flat baseline followed by steep hockey stick",
    fn: (t: number) => {
      if (t < 0.35) {
        return 0.05 + 0.03 * (t / 0.35);
      }
      const progress = (t - 0.35) / 0.65;
      const shape = Math.sin(progress * Math.PI * 0.95);
      return 0.08 + 0.92 * Math.pow(shape, 1.4);
    },
  },

  SLEEPER_HIT: {
    id: "SLEEPER_HIT",
    name: "Sleeper Hit",
    tag: "Delayed Virality",
    description: "Quiet baseline for most of the window, followed by a dramatic late-breaking surge.",
    asciiVisual: "▁ ▁ ▂ ▁ ▂ ▃ ▄ ▆ █ ▇",
    cumulativeDesc: "Flat incubation period, then exponential late breakout",
    fn: (t: number) => {
      if (t < 0.55) {
        return 0.06 + 0.04 * Math.sin(t * Math.PI * 4);
      }
      const lateProgress = (t - 0.55) / 0.45;
      return 0.08 + 0.92 * Math.pow(lateProgress, 2.6);
    },
  },

  LONG_TAIL: {
    id: "LONG_TAIL",
    name: "Long Tail",
    tag: "Multi-Day Sustained",
    description: "High impact launch day, gentle decaying slope with weekend ripples and durable tail.",
    asciiVisual: "█ ▅ ▄ ▃ ▄ ▃ ▂ ▂ ▁ ▁",
    cumulativeDesc: "Sharp initial jump, then sustained gradual incline",
    fn: (t: number) => {
      const day1 = 0.90 * Math.exp(-7.0 * t);
      const weekendBump1 = 0.28 * Math.exp(-Math.pow((t - 0.40) / 0.08, 2));
      const weekendBump2 = 0.22 * Math.exp(-Math.pow((t - 0.75) / 0.09, 2));
      return 0.08 + day1 + weekendBump1 + weekendBump2 + 0.12 * (1 - t);
    },
  },
};

export interface OrganicSamplingOptions {
  batchCount: number;
  totalQuantity: number;
  totalDurationMinutes: number;
  minQuantityPerBatch?: number;
  maxQuantityPerBatch?: number;
  seed: number;
  smoothness?: number; // 0 = very random, 100 = perfectly smooth mathematical curve
  spikeIntensity?: SpikeIntensity; // off, low, medium, high
  lockedBatches?: { index: number; quantity: number }[];
  startDateTime?: Date;
  allowZeroBatches?: boolean; // When true or when quota/batch constraints would flatten the curve, allows valley batches to be 0 (idle/rest periods)
}

export interface SampledBatch {
  index: number;
  batchNumber: number;
  elapsedMinutes: number;
  intervalMinutes: number;
  scheduledTime: Date;
  quantity: number;
  cumulativeQuantity: number;
  cumulativePercent: number;
  rateUnitsPerHour: number;
  circadianMultiplier: number;
  isSpike: boolean;
  isLocked: boolean;
}

export interface OrganicPlanResult {
  batches: SampledBatch[];
  totalQuantity: number;
  totalDurationMinutes: number;
  seed: number;
  smoothness: number;
  spikeIntensity: SpikeIntensity;
  presetId: OrganicPresetId;
  points: { x: number; y: number }[]; // Normalized [0, 1] for visual display
}

/**
 * Builds an organic, reproducible delivery plan based on a continuous shape function.
 */
export function buildOrganicPlan(
  presetId: OrganicPresetId,
  options: OrganicSamplingOptions
): OrganicPlanResult {
  const {
    batchCount,
    totalQuantity,
    totalDurationMinutes,
    minQuantityPerBatch = 10,
    maxQuantityPerBatch = 1000000,
    seed,
    smoothness = 65,
    spikeIntensity = "medium",
    lockedBatches = [],
    startDateTime = new Date(),
  } = options;

  const N = Math.max(2, Math.min(30, batchCount));
  const rng = createMulberry32(seed);
  const presetConfig = ORGANIC_PRESET_DEFINITIONS[presetId] || ORGANIC_PRESET_DEFINITIONS.SLOW_BURN;

  // 1. Time Jitter across batches
  // First batch always t = 0 min.
  // Time jitter moves ±15-20% around the nominal grid, kept strictly increasing with >= 5 min intervals.
  const intervals: number[] = [0];
  const nominalStepDuration = totalDurationMinutes / (N - 1);
  const jitterAmount = (100 - smoothness) / 100; // 0 when smooth, up to 1.0 when noisy
  const minInterval = Math.max(1, Math.min(5, Math.floor(totalDurationMinutes / Math.max(1, N - 1))));

  let currentElapsed = 0;
  const elapsedTimes: number[] = [0];

  for (let i = 1; i < N; i++) {
    const nominalElapsed = (i / (N - 1)) * totalDurationMinutes;
    // Jitter nominal offset by ±18%
    const jitterFactor = (rng() - 0.5) * 0.36 * jitterAmount;
    let targetElapsed = Math.round(nominalElapsed + nominalStepDuration * jitterFactor);

    // Guarantee strictly increasing and >= minInterval from previous
    targetElapsed = Math.max(currentElapsed + minInterval, targetElapsed);
    
    // For the last batch, lock to totalDurationMinutes
    if (i === N - 1) {
      targetElapsed = Math.max(currentElapsed + minInterval, totalDurationMinutes);
    }

    const interval = targetElapsed - currentElapsed;
    intervals.push(interval);
    currentElapsed = targetElapsed;
    elapsedTimes.push(currentElapsed);
  }

  // 2. Base Shape Function Evaluation f(t)
  const baseWeights: number[] = [];
  for (let i = 0; i < N; i++) {
    const t = N > 1 ? elapsedTimes[i] / Math.max(1, currentElapsed) : 0;
    const baseVal = Math.max(0.01, presetConfig.fn(t));
    baseWeights.push(baseVal);
  }

  // 3. Lognormal Noise Application
  // Scale of noise determined by (100 - smoothness): 0 = 0% noise, 100 = 25% lognormal noise
  const noiseSigma = 0.22 * ((100 - smoothness) / 100);
  const noisyWeights: number[] = [];

  for (let i = 0; i < N; i++) {
    if (noiseSigma > 0.005) {
      // Sample lognormal: exp(normal(0, sigma))
      const lognFactor = Math.exp(seededNormal(rng, 0, noiseSigma));
      noisyWeights.push(baseWeights[i] * lognFactor);
    } else {
      noisyWeights.push(baseWeights[i]);
    }
  }

  // 4. Random Spikes Generation
  // 1-3 spikes per plan depending on spikeIntensity, each 2-4x neighbor, never two in a row, never at batch 1 (index 0)
  const isSpikeArr: boolean[] = new Array(N).fill(false);
  let spikeBudgetRatio = 0.15; // Max 15% of volume total in spikes

  if (spikeIntensity !== "off" && N >= 4) {
    const maxSpikes = spikeIntensity === "low" ? 1 : spikeIntensity === "medium" ? 2 : 3;
    const numSpikes = Math.min(maxSpikes, Math.floor(rng() * maxSpikes) + 1);

    // Eligible indices: 1 to N-1 (never batch 0)
    const eligibleIndices: number[] = [];
    for (let i = 1; i < N; i++) {
      eligibleIndices.push(i);
    }

    // Shuffle eligible indices with seeded rng
    for (let i = eligibleIndices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [eligibleIndices[i], eligibleIndices[j]] = [eligibleIndices[j], eligibleIndices[i]];
    }

    let spikesPlaced = 0;
    for (const candidateIdx of eligibleIndices) {
      if (spikesPlaced >= numSpikes) break;

      // Check not adjacent to an already placed spike
      if (
        (candidateIdx > 0 && isSpikeArr[candidateIdx - 1]) ||
        (candidateIdx < N - 1 && isSpikeArr[candidateIdx + 1])
      ) {
        continue;
      }

      // Intensity multiplier: 2.2x to 3.8x
      const spikeMultiplier = 2.2 + rng() * 1.6;
      noisyWeights[candidateIdx] *= spikeMultiplier;
      isSpikeArr[candidateIdx] = true;

      // Fast decay after shock on next batch if exists
      if (candidateIdx < N - 1 && !isSpikeArr[candidateIdx + 1]) {
        noisyWeights[candidateIdx + 1] *= 0.70;
      }

      spikesPlaced++;
    }
  }

  // 5. Locking and Largest-Remainder Integer Allocation
  // Respect locked batches: locked batch quantities are subtracted from total,
  // remaining units distributed over unlocked batches.
  const lockedMap = new Map<number, number>();
  for (const lb of lockedBatches) {
    if (lb.index >= 0 && lb.index < N) {
      lockedMap.set(lb.index, Math.max(0, Math.min(maxQuantityPerBatch, lb.quantity)));
    }
  }

  let lockedTotal = 0;
  for (const qty of Array.from(lockedMap.values())) {
    lockedTotal += qty;
  }

  const unlockedIndices: number[] = [];
  for (let i = 0; i < N; i++) {
    if (!lockedMap.has(i)) {
      unlockedIndices.push(i);
    }
  }

  const remainingQuantity = Math.max(0, totalQuantity - lockedTotal);
  const numUnlocked = unlockedIndices.length;

  // Decide whether to allow valley batches to drop to 0 (idle/rest periods) to avoid flat lines of 100s
  // Enabled if explicitly requested OR when high batch count constrains quota per batch close to min
  const shouldAllowZeroValleys = Boolean(
    options.allowZeroBatches === true ||
    (options.allowZeroBatches !== false && numUnlocked >= 12 && (remainingQuantity / Math.max(1, numUnlocked)) < minQuantityPerBatch * 2.0)
  );

  const zeroBatchSet = new Set<number>();

  if (shouldAllowZeroValleys && numUnlocked >= 6 && minQuantityPerBatch > 0) {
    // Sort unlocked batches by weight ascending (deepest valleys first)
    const sortedByWeight = [...unlockedIndices].sort((a, b) => noisyWeights[a] - noisyWeights[b]);

    // Target average active batch size so peaks have room to breathe (e.g. 1.6x to 2.2x minQuantity)
    const targetAvgPerActive = Math.max(minQuantityPerBatch * 1.5, 140);
    const maxActive = Math.max(2, Math.min(numUnlocked, Math.floor(remainingQuantity / Math.max(1, targetAvgPerActive))));
    const desiredZeros = Math.min(
      Math.floor(numUnlocked * 0.35), // At most 35% of batches are 0
      Math.max(0, numUnlocked - maxActive)
    );

    for (const idx of sortedByWeight) {
      if (zeroBatchSet.size >= desiredZeros) break;
      // Do not zero out batch 0 (immediate launch) unless total batches > 20
      if (idx === 0 && N <= 20) continue;
      // Avoid 3 consecutive zeros
      if (zeroBatchSet.has(idx - 1) && zeroBatchSet.has(idx - 2)) continue;
      if (zeroBatchSet.has(idx + 1) && zeroBatchSet.has(idx + 2)) continue;
      zeroBatchSet.add(idx);
    }
  }

  // Active unlocked batches that will receive volume
  const activeUnlocked = unlockedIndices.filter((idx) => !zeroBatchSet.has(idx));
  let activeWeightSum = 0;
  for (const idx of activeUnlocked) {
    activeWeightSum += noisyWeights[idx];
  }
  if (activeWeightSum <= 0) activeWeightSum = 1;

  // Initial float quantities and integer floored allocation
  const finalQuantities: number[] = new Array(N).fill(0);
  const remainders: { index: number; remainder: number }[] = [];

  for (let i = 0; i < N; i++) {
    if (lockedMap.has(i)) {
      finalQuantities[i] = lockedMap.get(i)!;
    } else if (zeroBatchSet.has(i)) {
      finalQuantities[i] = 0;
    } else {
      const share = (noisyWeights[i] / activeWeightSum) * remainingQuantity;
      const floored = Math.max(minQuantityPerBatch, Math.floor(share));
      finalQuantities[i] = floored;
      remainders.push({ index: i, remainder: share - floored });
    }
  }

  // Distribute residual units using Largest-Remainder Method across active batches
  let currentSum = finalQuantities.reduce((a, b) => a + b, 0);
  let discrepancy = totalQuantity - currentSum;

  remainders.sort((a, b) => b.remainder - a.remainder);

  let iter = 0;
  while (discrepancy > 0 && remainders.length > 0) {
    const targetIdx = remainders[iter % remainders.length].index;
    if (finalQuantities[targetIdx] < maxQuantityPerBatch) {
      finalQuantities[targetIdx]++;
      discrepancy--;
    }
    iter++;
    if (iter > 10000) break;
  }

  while (discrepancy < 0 && remainders.length > 0) {
    const reverseRemainders = [...remainders].reverse();
    const targetIdx = reverseRemainders[iter % reverseRemainders.length].index;
    if (finalQuantities[targetIdx] > minQuantityPerBatch) {
      finalQuantities[targetIdx]--;
      discrepancy++;
    }
    iter++;
    if (iter > 10000) break;
  }

  // Anti-clumping pass: "avoid 100 then second also 100, randomize every single order no matter how"
  // If adjacent active batches end up with the exact same quantity, perturb them organically!
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < N; i++) {
      if (
        finalQuantities[i] > 0 &&
        finalQuantities[i] === finalQuantities[i - 1] &&
        !lockedMap.has(i) &&
        !lockedMap.has(i - 1)
      ) {
        const delta = Math.max(3, Math.min(22, Math.floor(finalQuantities[i] * 0.12) + Math.floor(rng() * 7)));
        if (finalQuantities[i] - delta >= minQuantityPerBatch && finalQuantities[i - 1] + delta <= maxQuantityPerBatch) {
          finalQuantities[i] -= delta;
          finalQuantities[i - 1] += delta;
        } else if (finalQuantities[i - 1] - delta >= minQuantityPerBatch && finalQuantities[i] + delta <= maxQuantityPerBatch) {
          finalQuantities[i - 1] -= delta;
          finalQuantities[i] += delta;
        } else {
          // Find another batch with room to exchange delta
          for (let j = 0; j < N; j++) {
            if (j !== i && j !== i - 1 && !lockedMap.has(j) && finalQuantities[j] > minQuantityPerBatch + delta + 5) {
              finalQuantities[j] -= delta;
              finalQuantities[i] += delta;
              break;
            }
          }
        }
      }
    }
  }

  // 6. Build final SampledBatch array with cumulative metrics
  let runningCumulative = 0;
  const batches: SampledBatch[] = [];

  for (let i = 0; i < N; i++) {
    const qty = finalQuantities[i];
    runningCumulative += qty;
    const elapsed = elapsedTimes[i];
    const scheduledTime = new Date(startDateTime.getTime() + elapsed * 60 * 1000);

    // Real delivery rate in units/hour
    // For batch 0 or instantaneous start, base on duration of next interval or 1 hour
    const durationHours = (intervals[i] || intervals[1] || 30) / 60;
    const rateUnitsPerHour = Math.round(qty / Math.max(0.1, durationHours));

    // Circadian multiplier for audience comparison
    const circadianT = (scheduledTime.getUTCHours() + scheduledTime.getUTCMinutes() / 60) / 24;
    const circMult = audienceCircadianActivity(circadianT);

    batches.push({
      index: i,
      batchNumber: i + 1,
      elapsedMinutes: elapsed,
      intervalMinutes: intervals[i],
      scheduledTime,
      quantity: qty,
      cumulativeQuantity: runningCumulative,
      cumulativePercent: Number(((runningCumulative / totalQuantity) * 100).toFixed(1)),
      rateUnitsPerHour,
      circadianMultiplier: circMult,
      isSpike: isSpikeArr[i],
      isLocked: lockedMap.has(i),
    });
  }

  // 7. Visual normalized points for sparklines & SVG preview
  const maxQ = Math.max(...finalQuantities, 1);
  const points = batches.map((b) => ({
    x: N > 1 ? b.elapsedMinutes / Math.max(1, currentElapsed) : 0.5,
    y: b.quantity / maxQ,
  }));

  return {
    batches,
    totalQuantity,
    totalDurationMinutes: currentElapsed,
    seed,
    smoothness,
    spikeIntensity,
    presetId,
    points,
  };
}

/**
 * Generates an SVG path string for a mini sparkline preview of any organic preset.
 */
export function generatePresetSparklinePath(
  presetId: OrganicPresetId,
  width = 64,
  height = 24
): string {
  const preset = ORGANIC_PRESET_DEFINITIONS[presetId] || ORGANIC_PRESET_DEFINITIONS.SLOW_BURN;
  const steps = 18;
  const pts: { x: number; y: number }[] = [];

  let maxVal = 0.01;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const val = preset.fn(t);
    if (val > maxVal) maxVal = val;
    pts.push({ x: t, y: val });
  }

  const pad = 2;
  const plotW = width - pad * 2;
  const plotH = height - pad * 2;

  let d = "";
  for (let i = 0; i < pts.length; i++) {
    const px = pad + pts[i].x * plotW;
    const py = pad + plotH - (pts[i].y / maxVal) * plotH;
    if (i === 0) {
      d += `M ${px.toFixed(1)},${py.toFixed(1)}`;
    } else {
      const prevX = pad + pts[i - 1].x * plotW;
      const prevY = pad + plotH - (pts[i - 1].y / maxVal) * plotH;
      const cpx = (prevX + px) / 2;
      d += ` C ${cpx.toFixed(1)},${prevY.toFixed(1)} ${cpx.toFixed(1)},${py.toFixed(1)} ${px.toFixed(1)},${py.toFixed(1)}`;
    }
  }

  return d;
}

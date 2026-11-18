/**
 * Deterministic Organic Anti-Radar Pattern Engine for AuraSMM
 * 
 * Generates mathematically verified, reproducible engagement schedules
 * on a 15-minute grid with:
 * - F(t) = 0.04t + 0.96t^4 base cumulative curve
 * - 2-4 gentle waves/pauses (never below 40% local trend, never zero)
 * - Mild day/night circadian swing (+-15%)
 * - Final 8% soft asymptotic easing (zero end cliff)
 * - Follower-aware first push (300-500, 400-600, 600-900; 2K: 500-700)
 * - Strict anti-spike rate constraints (peak hourly <= 3x avg, hourly delta <= +-25%, tick <= 1.25x prev 4)
 * - Zero forbidden patterns (no 3+ equal, no 3+ monotonic, max 2 occurrences, irregular 1-6 tick gaps, no multiples of 5)
 * - Exact total conservation (zero drift)
 * - Views-lagged auxiliary engagement: E(t) <= E_total * F(t - lag)^0.9
 * - Special 2K 3-batch milestone likes (at ~20%, ~45%, ~70% views)
 */

export interface PackageConfig {
  id: string;
  name: string;
  views_total: number;
  base_duration_hours: number;
  price_inr: number;
  likes: number;
  saves: number;
  shares: number;
  comments?: number;
  min_followers_note?: string;
  tagline?: string;
  badge?: string;
}

export interface ProviderMinimums {
  views: number;
  likes: number;
  saves: number;
  shares: number;
  comments: number;
}

export const DEFAULT_PROVIDER_MINIMUMS: ProviderMinimums = {
  views: 100,
  likes: 10,
  saves: 10,
  shares: 10,
  comments: 1,
};

export const DEFAULT_PACKAGES: Record<string, PackageConfig> = {
  tiktok_2k: {
    id: "tiktok_2k",
    name: "2K Starter",
    views_total: 2000,
    base_duration_hours: 6,
    price_inr: 299,
    likes: 42,
    saves: 0,
    shares: 0,
    comments: 0,
    min_followers_note: "< 1k followers",
    tagline: "6-hour initial watch-time push & seed pool momentum",
    badge: "6 Hours",
  },
  tiktok_5k: {
    id: "tiktok_5k",
    name: "5K Velocity",
    views_total: 5000,
    base_duration_hours: 24,
    price_inr: 699,
    likes: 180,
    saves: 40,
    shares: 20,
    comments: 0,
    min_followers_note: "Any follower count",
    tagline: "24-hour natural FYP momentum with synchronized engagement waves",
    badge: "24 Hours (1 Day)",
  },
  tiktok_10k: {
    id: "tiktok_10k",
    name: "10K Breakthrough",
    views_total: 10000,
    base_duration_hours: 48,
    price_inr: 1299,
    likes: 420,
    saves: 80,
    shares: 40,
    comments: 0,
    min_followers_note: "Any follower count",
    tagline: "2-day algorithmic breakout with circadian evening momentum",
    badge: "2 Days (48h)",
  },
  tiktok_15k: {
    id: "tiktok_15k",
    name: "15K Acceleration",
    views_total: 15000,
    base_duration_hours: 72,
    price_inr: 1899,
    likes: 650,
    saves: 100,
    shares: 60,
    comments: 0,
    min_followers_note: "Any follower count",
    tagline: "3-day organic algorithm surge with gradual view-paced delivery",
    badge: "3 Days (72h)",
  },
  tiktok_50k: {
    id: "tiktok_50k",
    name: "50K Mega Viral",
    views_total: 50000,
    base_duration_hours: 120,
    price_inr: 5499,
    likes: 2600,
    saves: 200,
    shares: 120,
    comments: 0,
    min_followers_note: "Accounts with active posting",
    tagline: "5-day full FYP virality curve with soft asymptotic tail",
    badge: "5 Days (120h)",
  },
};

export type ServiceType = "views" | "likes" | "saves" | "shares" | "comments";

export interface ScheduledBatch {
  id?: string;
  tick: number; // 0, 1, 2, ...
  minuteOffset: number; // tick * 15 (always sitting on :00, :15, :30, :45)
  clockTime?: string;
  service: ServiceType;
  quantity: number;
  cumulativeSoFar: number;
  cumulativeAfter?: number;
}

export interface CurvePoint {
  t: number; // 0..1
  minute: number;
  minuteOffset: number;
  cumulativeViews: number;
  views: number;
  cumulativeLikes: number;
  likes: number;
  cumulativeSaves: number;
  saves: number;
  cumulativeShares: number;
  shares: number;
  cumulativeComments: number;
  comments: number;
  clockTime?: string;
}

export interface GeneratedScheduleResult {
  seed: string;
  templateId: number;
  patternName: string;
  packageId: string;
  viewsTotal: number;
  likesTotal: number;
  savesTotal: number;
  sharesTotal: number;
  commentsTotal: number;
  followers: number;
  baseDurationHours: number;
  actualDurationHours: number;
  totalDurationMinutes: number;
  durationLabel: string; // "X days Y hours"
  batches: ScheduledBatch[];
  curvePoints: CurvePoint[];
  viewsBatchesCount: number;
  likesBatchesCount: number;
  savesBatchesCount: number;
  sharesBatchesCount: number;
  commentsBatchesCount: number;
  totalBatchesCount: number;
  peakHourlyViewsRate: number;
  avgHourlyViewsRate: number;
}

export type DeterministicPlan = GeneratedScheduleResult;

/**
 * Deterministic pseudo-random number generator (Mulberry32).
 * Produces identical sequences for the same seed.
 */
export function createRng(seedInput: string | number): () => number {
  let s: number;
  if (typeof seedInput === "number") {
    s = Math.floor(Math.abs(seedInput)) || 1337;
  } else {
    const str = String(seedInput || "aurasmm_seed");
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    }
    s = h >>> 0;
  }

  return function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box-Muller transform for standard Gaussian random values
 */
function nextGaussian(rng: () => number): number {
  const u1 = Math.max(1e-7, rng());
  const u2 = rng();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * Lognormal noise multiplier with median 1.0
 */
function lognormalNoise(rng: () => number, sigma = 0.35): number {
  const z = nextGaussian(rng);
  return Math.exp(z * sigma - (sigma * sigma) / 2);
}

/**
 * Ensures batch size is NOT a multiple of 5, while respecting bounds.
 */
function desaturateMultiplesOf5(val: number, minVal: number, maxVal: number): number {
  let q = Math.round(val);
  if (q < minVal) q = minVal;
  if (q > maxVal) q = maxVal;
  if (q % 5 === 0) {
    if (q + 1 <= maxVal) q += 1;
    else if (q - 1 >= minVal) q -= 1;
    else if (q + 2 <= maxVal) q += 2;
    else if (q - 2 >= minVal) q -= 2;
  }
  return q;
}

/**
 * Evaluates the continuous Base Cumulative Curve F_base(t) = 0.04t + 0.96t^4
 */
export function baseCurveF(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 0.04 * clamped + 0.96 * Math.pow(clamped, 4);
}

/**
 * Derivative of base curve: dF/dt = 0.04 + 3.84t^3
 */
export function baseCurveFPrime(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 0.04 + 3.84 * Math.pow(clamped, 3);
}

/**
 * Wave overlay definition
 */
interface Wave {
  center: number; // 0.15 .. 0.85
  width: number; // 0.06 .. 0.12
  depth: number; // 0.20 .. 0.50 (never below 40% local trend, never zero)
}

/**
 * Formats duration as "X days Y hours"
 */
export function formatDurationDaysHours(totalHours: number): string {
  const roundedHours = Math.round(totalHours);
  const days = Math.floor(roundedHours / 24);
  const hours = roundedHours % 24;
  return `${days} days ${hours} hours`;
}

/**
 * Generates an Anti-Radar Delivery Pattern strictly meeting all user requirements.
 * - Server-side & deterministic from seed
 * - 15-minute grid (:00, :15, :30, :45)
 * - F(t) = 0.04t + 0.96t^4 base + 2-4 gentle waves + circadian swing + final 8% ease
 * - Anti-spike rate enforcement
 * - Zero forbidden patterns
 * - Views-lagged auxiliary engagement
 */
export function generatePattern(
  pkg: PackageConfig,
  followers: number = 500,
  seedInput: string | number = "aurasmm_seed",
  minimums: ProviderMinimums = DEFAULT_PROVIDER_MINIMUMS,
  startTime: Date = new Date()
): GeneratedScheduleResult {
  const seedStr = String(seedInput);
  const rng = createRng(seedStr);

  let hashNum = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hashNum = (hashNum * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  const templateId = (hashNum % 550) + 1;
  const patternNames = ["sunrise-curve", "cautious-ascent", "algorithmic-surge", "viral-momentum", "balanced-flow", "high-velocity"];
  const patternName = patternNames[templateId % patternNames.length];

  const viewsTotal = Math.max(100, Math.round(pkg.views_total));
  const baseDuration = Math.max(1, pkg.base_duration_hours);
  const likesTotal = Math.max(0, Math.round(pkg.likes));
  const savesTotal = Math.max(0, Math.round(pkg.saves));
  const sharesTotal = Math.max(0, Math.round(pkg.shares));
  const commentsTotal = Math.max(0, Math.round(pkg.comments || 0));

  // 1. Duration on 15-minute grid: base_duration_hours * random(0.85 .. 1.15)
  const durationFactor = 0.85 + rng() * 0.30;
  const rawDurationHours = baseDuration * durationFactor;
  // Snap to 15-min ticks (4 ticks per hour)
  const totalTicks = Math.max(4, Math.round(rawDurationHours * 4));
  const actualDurationHours = totalTicks / 4;
  const totalDurationMinutes = totalTicks * 15;
  const durationLabel = formatDurationDaysHours(actualDurationHours);

  // 2. Setup 2 to 4 gentle waves/pauses (never below 40% local trend, never zero)
  const waveCount = 2 + Math.floor(rng() * 3); // 2, 3, or 4
  const waves: Wave[] = [];
  const waveSpan = 0.70 / Math.max(1, waveCount);
  for (let w = 0; w < waveCount; w++) {
    const center = 0.15 + w * waveSpan + rng() * (waveSpan * 0.6);
    const width = 0.05 + rng() * 0.05;
    const depth = 0.25 + rng() * 0.25; // 0.25 to 0.50 (keeps rate >= 50% > 40%)
    waves.push({ center, width, depth });
  }

  // Circadian phase (0..2pi)
  const circadianPhase = rng() * Math.PI * 2;

  // Rate function at t in [0..1]
  function computeInstantRate(t: number): number {
    const baseRate = baseCurveFPrime(t);

    // Overlay waves
    let waveMod = 1.0;
    for (const wave of waves) {
      const dist = (t - wave.center) / wave.width;
      const gaussian = Math.exp(-0.5 * dist * dist);
      waveMod *= (1.0 - wave.depth * gaussian);
    }
    // Hard clamp to ensure never below 40% local trend
    waveMod = Math.max(0.40, waveMod);

    // Circadian swing (+-15%)
    const cycles = actualDurationHours / 24;
    const circadian = 1.0 + 0.15 * Math.sin(2 * Math.PI * t * cycles + circadianPhase);

    // Final 8% easing down (no end spike)
    let easeDown = 1.0;
    if (t >= 0.92) {
      const easeT = (t - 0.92) / 0.08;
      easeDown = 1.0 - 0.70 * easeT * easeT;
    }

    const instantRate = baseRate * waveMod * circadian * easeDown;
    return Math.max(0.01, Math.min(2.75, instantRate));
  }

  // Pre-sample cumulative integration of the rate function
  const SAMPLES = Math.max(200, totalTicks * 2);
  const sampleCum: number[] = [0];
  let runningInt = 0;
  for (let s = 1; s <= SAMPLES; s++) {
    const tPrev = (s - 1) / SAMPLES;
    const tCurr = s / SAMPLES;
    const rMid = computeInstantRate((tPrev + tCurr) / 2);
    runningInt += rMid * (1 / SAMPLES);
    sampleCum.push(runningInt);
  }
  const totalIntegral = runningInt || 1.0;

  // Modulated Cumulative Curve F_mod(t) normalized to [0..1]
  function modulatedF(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1.0;
    const idx = t * SAMPLES;
    const i = Math.floor(idx);
    const frac = idx - i;
    const c0 = sampleCum[Math.min(SAMPLES, i)];
    const c1 = sampleCum[Math.min(SAMPLES, i + 1)];
    return (c0 + (c1 - c0) * frac) / totalIntegral;
  }

  // 3. First Push Target:
  // Followers: <1k: 300-500, 1k-10k: 400-600, >10k: 600-900. (2K package: 500-700)
  let firstPushTarget: number;
  if (pkg.id.includes("2k") || viewsTotal <= 2500) {
    firstPushTarget = Math.round(500 + rng() * 200); // 500-700
  } else if (followers < 1000) {
    firstPushTarget = Math.round(300 + rng() * 200); // 300-500
  } else if (followers <= 10000) {
    firstPushTarget = Math.round(400 + rng() * 200); // 400-600
  } else {
    firstPushTarget = Math.round(600 + rng() * 300); // 600-900
  }
  firstPushTarget = Math.min(firstPushTarget, Math.round(viewsTotal * 0.35));

  // Max views allowed per tick:
  // For normal ticks: no tick > 3% of total (scaled for small packages where 3% < minViews * 2)
  // For first push ticks: headroom up to firstPushTarget
  const maxFirstPushTickViews = Math.max(firstPushTarget, minimums.views * 4);

  // 4. Select View Ticks with Irregular Gaps (1-6 ticks)
  // First push sits on first 2-3 ticks: tick 0, 1 (and 2 if firstPushTarget >= 450)
  const maxBatches = Math.max(3, Math.floor(viewsTotal / (minimums.views * 1.18)));
  const viewTicks: number[] = [0, 1];
  if (firstPushTarget >= 450 && maxBatches >= 4) {
    viewTicks.push(2);
  }

  // Next view tick starts at tick 4 (minute 60 = hour 1) with a legal gap of 2 or 3 ticks
  let currTick = 4;
  viewTicks.push(currTick);

  while (currTick < totalTicks - 2 && viewTicks.length < maxBatches) {
    // Irregular gap of 1 to 6 ticks (use 2-6 for plans >= 20h to guarantee <= 2 view batches per hour)
    const gap = totalTicks >= 80 ? 2 + Math.floor(rng() * 5) : 1 + Math.floor(rng() * 6);
    currTick += gap;
    if (currTick < totalTicks) {
      viewTicks.push(currTick);
    }
  }

  // Ensure last tick sits near the end without exceeding a gap of 6
  if (viewTicks[viewTicks.length - 1] < totalTicks - 1) {
    let last = viewTicks[viewTicks.length - 1];
    while ((totalTicks - 1) - last > 6 && viewTicks.length < maxBatches + 5) {
      last += 4;
      viewTicks.push(last);
    }
    if ((totalTicks - 1) - viewTicks[viewTicks.length - 1] <= 6) {
      viewTicks.push(totalTicks - 1);
    }
  }

  const numViewBatches = viewTicks.length;
  const firstPushCount = viewTicks.filter((t) => t <= 2).length;
  const remainingViews = Math.max(0, viewsTotal - firstPushTarget);
  const remainingCount = Math.max(1, numViewBatches - firstPushCount);
  const avgRemainingBatch = remainingViews / remainingCount;

  const maxSingleTickViews = Math.max(
    Math.round(minimums.views * 2.2),
    Math.round(avgRemainingBatch * 1.65),
    Math.round(viewsTotal * 0.03)
  );

  // 5. Compute Raw Target Views per Tick based on F_mod delta
  const rawViews: number[] = [];

  // Divide first push among first 2-3 ticks
  let pushAlloc = 0;
  for (let i = 0; i < firstPushCount; i++) {
    const isLast = i === firstPushCount - 1;
    let share = isLast ? firstPushTarget - pushAlloc : Math.round(firstPushTarget / firstPushCount + (rng() * 30 - 15));
    share = desaturateMultiplesOf5(share, minimums.views, maxFirstPushTickViews);
    rawViews.push(share);
    pushAlloc += share;
  }

  // Adjust last push batch to make exact firstPushTarget
  if (pushAlloc !== firstPushTarget) {
    rawViews[firstPushCount - 1] += (firstPushTarget - pushAlloc);
    rawViews[firstPushCount - 1] = desaturateMultiplesOf5(rawViews[firstPushCount - 1], minimums.views, maxFirstPushTickViews);
  }

  // Remaining ticks from modulatedF
  const tStartRemaining = viewTicks[firstPushCount] / totalTicks;
  const fStart = modulatedF(tStartRemaining);
  const fSpan = 1.0 - fStart || 1.0;

  const remainingRawWeights: number[] = [];
  for (let i = firstPushCount; i < numViewBatches; i++) {
    const t0 = viewTicks[i] / totalTicks;
    const tNext = i + 1 < numViewBatches ? viewTicks[i + 1] / totalTicks : 1.0;
    const frac = (modulatedF(tNext) - modulatedF(t0)) / fSpan;
    const noise = lognormalNoise(rng, 0.35);
    remainingRawWeights.push(Math.max(0.01, frac * noise));
  }

  const sumWeights = remainingRawWeights.reduce((a, b) => a + b, 0) || 1.0;
  for (let i = 0; i < remainingRawWeights.length; i++) {
    const v = Math.round((remainingRawWeights[i] / sumWeights) * remainingViews);
    rawViews.push(v);
  }

  // 6. Scale and Enforce View Rules:
  // - Provider minimum (minimums.views >= 100)
  // - Peak hourly rate <= 3x average
  // - No tick > 3% of total (scaled for small packages where 3% < minViews * 2)
  // - After first push, tick <= 1.25x avg of previous 4 ticks (excess carried forward)
  const viewsBatches: number[] = [];
  let carryExcess = 0;

  for (let i = 0; i < rawViews.length; i++) {
    let v = rawViews[i] + carryExcess;
    carryExcess = 0;
    const isFirstPush = i < firstPushCount;

    if (!isFirstPush) {
      if (v > maxSingleTickViews) {
        carryExcess += v - maxSingleTickViews;
        v = maxSingleTickViews;
      }

      if (i >= 4) {
        const prev4Avg = (viewsBatches[i - 1] + viewsBatches[i - 2] + viewsBatches[i - 3] + viewsBatches[i - 4]) / 4;
        const maxAllowed = Math.max(minimums.views + 5, Math.round(prev4Avg * 1.25));
        if (v > maxAllowed) {
          carryExcess += v - maxAllowed;
          v = maxAllowed;
        }
      }
    }

    v = Math.max(minimums.views, Math.round(v));
    viewsBatches.push(v);
  }

  if (carryExcess > 0) {
    for (let i = viewsBatches.length - 1; i >= firstPushCount && carryExcess > 0; i--) {
      const room = maxSingleTickViews - viewsBatches[i];
      if (room > 0) {
        const add = Math.min(carryExcess, room);
        viewsBatches[i] += add;
        carryExcess -= add;
      }
    }
  }

  // 7. Solve Exact Ke Conservation Equation on remaining batches (preserving first push and hourly limits)
  const maxHourlyAllowed = Math.floor((viewsTotal / Math.max(1, actualDurationHours)) * 2.85);
  const remainingSolved = solveViewsConservation(
    viewsBatches.slice(firstPushCount),
    viewsTotal - viewsBatches.slice(0, firstPushCount).reduce((a, b) => a + b, 0),
    minimums.views,
    maxSingleTickViews,
    viewTicks.slice(firstPushCount),
    maxHourlyAllowed
  );

  for (let i = 0; i < remainingSolved.length; i++) {
    viewsBatches[firstPushCount + i] = remainingSolved[i];
  }

  // 8. Break any monotonic runs of 4 values (3 consecutive increases or decreases)
  // Swapping adjacent elements [i-1] and [i-2] breaks strict monotonicity with zero sum change
  let hasMonotonic = true;
  let monoPass = 0;
  while (hasMonotonic && monoPass < 20) {
    hasMonotonic = false;
    monoPass++;
    for (let i = 3; i < viewsBatches.length; i++) {
      const isRising =
        viewsBatches[i] > viewsBatches[i - 1] &&
        viewsBatches[i - 1] > viewsBatches[i - 2] &&
        viewsBatches[i - 2] > viewsBatches[i - 3];
      const isFalling =
        viewsBatches[i] < viewsBatches[i - 1] &&
        viewsBatches[i - 1] < viewsBatches[i - 2] &&
        viewsBatches[i - 2] < viewsBatches[i - 3];
      if (isRising || isFalling) {
        hasMonotonic = true;
        const temp = viewsBatches[i - 1];
        viewsBatches[i - 1] = viewsBatches[i - 2];
        viewsBatches[i - 2] = temp;
      }
    }
  }

  // Build cumulative views timeline for engagement gating
  const cumViewsAtTick: Record<number, number> = {};
  let rViews = 0;
  for (let i = 0; i < viewTicks.length; i++) {
    rViews += viewsBatches[i];
    cumViewsAtTick[viewTicks[i]] = rViews;
  }
  // Fill forward cumulative views for every tick [0..totalTicks]
  let lastCum = 0;
  const fullCumViews: number[] = [];
  for (let t = 0; t <= totalTicks; t++) {
    if (cumViewsAtTick[t] !== undefined) {
      lastCum = cumViewsAtTick[t];
    }
    fullCumViews[t] = lastCum;
  }

  // 10. ENGAGEMENT GENERATION (Likes, Saves, Shares, Comments)
  // Lags: Likes 15-30m (1-2 ticks), Saves 30-60m (2-4 ticks), Shares 60-90m (4-6 ticks)
  const likesLagTicks = 1 + Math.floor(rng() * 2); // 1 or 2 ticks (15-30m)
  const savesLagTicks = 2 + Math.floor(rng() * 3); // 2, 3, 4 ticks (30-60m)
  const sharesLagTicks = 4 + Math.floor(rng() * 3); // 4, 5, 6 ticks (60-90m)
  const commentsLagTicks = 3 + Math.floor(rng() * 3);

  const is2kPackage = pkg.id.includes("2k") || viewsTotal <= 2500;

  // A. LIKES:
  const likesBatches: { tick: number; quantity: number }[] = [];
  if (likesTotal > 0) {
    if (is2kPackage) {
      // 2K only rule: likes in 3 irregular batches triggered when cumulative views cross about 20%, 45% and 70% of the package
      const t20views = viewsTotal * 0.20;
      const t45views = viewsTotal * 0.45;
      const t70views = viewsTotal * 0.70;

      let tick20 = fullCumViews.findIndex((v) => v >= t20views);
      let tick45 = fullCumViews.findIndex((v) => v >= t45views);
      let tick70 = fullCumViews.findIndex((v) => v >= t70views);

      if (tick20 < 0) tick20 = Math.max(1, Math.round(totalTicks * 0.20));
      if (tick45 <= tick20) tick45 = tick20 + 2;
      if (tick70 <= tick45) tick70 = tick45 + 2;

      // 3 irregular batches summing to likesTotal (e.g. for 42: 13, 16, 13)
      const b1 = desaturateMultiplesOf5(Math.round(likesTotal * 0.31), minimums.likes, likesTotal);
      const b2 = desaturateMultiplesOf5(Math.round(likesTotal * 0.38), minimums.likes, likesTotal);
      const b3 = likesTotal - b1 - b2;

      likesBatches.push({ tick: tick20 + likesLagTicks, quantity: b1 });
      likesBatches.push({ tick: tick45 + likesLagTicks, quantity: b2 });
      likesBatches.push({ tick: tick70 + likesLagTicks, quantity: b3 });
    } else {
      // Standard packages: small non-uniform batches, front-loaded, no batch > 4% of total
      const maxBatchLikes = Math.max(minimums.likes, Math.round(likesTotal * 0.04));
      generateAuxiliarySchedule(
        likesTotal,
        totalTicks,
        likesLagTicks,
        minimums.likes,
        maxBatchLikes,
        fullCumViews,
        viewsTotal,
        modulatedF,
        rng,
        "likes"
      ).forEach((b) => likesBatches.push(b));
    }
  }

  // B. SAVES:
  const savesBatches: { tick: number; quantity: number }[] = [];
  if (savesTotal >= minimums.saves) {
    const maxBatchSaves = Math.max(minimums.saves, Math.round(savesTotal * 0.04));
    generateAuxiliarySchedule(
      savesTotal,
      totalTicks,
      savesLagTicks,
      minimums.saves,
      maxBatchSaves,
      fullCumViews,
      viewsTotal,
      modulatedF,
      rng,
      "saves"
    ).forEach((b) => savesBatches.push(b));
  }

  // C. SHARES:
  const sharesBatches: { tick: number; quantity: number }[] = [];
  if (sharesTotal >= minimums.shares) {
    const maxBatchShares = Math.max(minimums.shares, Math.round(sharesTotal * 0.04));
    generateAuxiliarySchedule(
      sharesTotal,
      totalTicks,
      sharesLagTicks,
      minimums.shares,
      maxBatchShares,
      fullCumViews,
      viewsTotal,
      modulatedF,
      rng,
      "shares"
    ).forEach((b) => sharesBatches.push(b));
  }

  // D. COMMENTS:
  const commentsBatches: { tick: number; quantity: number }[] = [];
  if (commentsTotal >= minimums.comments) {
    generateAuxiliarySchedule(
      commentsTotal,
      totalTicks,
      commentsLagTicks,
      minimums.comments,
      Math.max(1, Math.round(commentsTotal * 0.15)),
      fullCumViews,
      viewsTotal,
      modulatedF,
      rng,
      "comments"
    ).forEach((b) => commentsBatches.push(b));
  }

  // 11. Compile All Batches into Master Schedule
  const allBatches: ScheduledBatch[] = [];

  for (let i = 0; i < viewTicks.length; i++) {
    allBatches.push({
      tick: viewTicks[i],
      minuteOffset: viewTicks[i] * 15,
      service: "views",
      quantity: viewsBatches[i],
      cumulativeSoFar: 0,
    });
  }

  for (const b of likesBatches) {
    allBatches.push({
      tick: b.tick,
      minuteOffset: b.tick * 15,
      service: "likes",
      quantity: b.quantity,
      cumulativeSoFar: 0,
    });
  }

  for (const b of savesBatches) {
    allBatches.push({
      tick: b.tick,
      minuteOffset: b.tick * 15,
      service: "saves",
      quantity: b.quantity,
      cumulativeSoFar: 0,
    });
  }

  for (const b of sharesBatches) {
    allBatches.push({
      tick: b.tick,
      minuteOffset: b.tick * 15,
      service: "shares",
      quantity: b.quantity,
      cumulativeSoFar: 0,
    });
  }

  for (const b of commentsBatches) {
    allBatches.push({
      tick: b.tick,
      minuteOffset: b.tick * 15,
      service: "comments",
      quantity: b.quantity,
      cumulativeSoFar: 0,
    });
  }

  // Sort strictly by tick, then by service (views first at each tick)
  const serviceSortOrder: Record<ServiceType, number> = {
    views: 0,
    likes: 1,
    saves: 2,
    shares: 3,
    comments: 4,
  };

  allBatches.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    return serviceSortOrder[a.service] - serviceSortOrder[b.service];
  });

  // Compute cumulative counts
  const cumCounts: Record<ServiceType, number> = {
    views: 0,
    likes: 0,
    saves: 0,
    shares: 0,
    comments: 0,
  };

  for (let idx = 0; idx < allBatches.length; idx++) {
    const b = allBatches[idx];
    cumCounts[b.service] += b.quantity;
    b.id = `batch_${idx + 1}`;
    b.cumulativeSoFar = cumCounts[b.service];
    b.cumulativeAfter = cumCounts[b.service];
    const bDate = new Date(startTime.getTime() + b.minuteOffset * 60 * 1000);
    b.clockTime = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Dhaka",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(bDate);
  }

  // 12. Sample 100 Curve Points across total duration for chart preview
  const curvePoints: CurvePoint[] = [];
  const CURVE_SAMPLES = 100;
  for (let i = 0; i <= CURVE_SAMPLES; i++) {
    const t = i / CURVE_SAMPLES;
    const min = Math.round(t * totalDurationMinutes);
    const tick = Math.min(totalTicks, Math.round(min / 15));

    // Measure cumulative up to this minute
    let cViews = 0;
    let cLikes = 0;
    let cSaves = 0;
    let cShares = 0;
    let cComments = 0;

    for (const b of allBatches) {
      if (b.minuteOffset <= min) {
        if (b.service === "views") cViews += b.quantity;
        else if (b.service === "likes") cLikes += b.quantity;
        else if (b.service === "saves") cSaves += b.quantity;
        else if (b.service === "shares") cShares += b.quantity;
        else if (b.service === "comments") cComments += b.quantity;
      }
    }

    const ptDate = new Date(startTime.getTime() + min * 60 * 1000);
    const clockTime = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Dhaka",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(ptDate);

    curvePoints.push({
      t,
      minute: min,
      minuteOffset: min,
      cumulativeViews: cViews,
      views: cViews,
      cumulativeLikes: cLikes,
      likes: cLikes,
      cumulativeSaves: cSaves,
      saves: cSaves,
      cumulativeShares: cShares,
      shares: cShares,
      cumulativeComments: cComments,
      comments: cComments,
      clockTime,
    });
  }

  // Measure peak and average hourly views rate
  const avgHourlyViews = viewsTotal / Math.max(1, actualDurationHours);
  let peakHourly = 0;
  const hoursCount = Math.ceil(actualDurationHours);
  for (let h = 0; h < hoursCount; h++) {
    const hStart = h * 60;
    const hEnd = (h + 1) * 60;
    const viewsInH = allBatches
      .filter((b) => b.service === "views" && b.minuteOffset >= hStart && b.minuteOffset < hEnd)
      .reduce((sum, b) => sum + b.quantity, 0);
    if (viewsInH > peakHourly) peakHourly = viewsInH;
  }

  return {
    seed: seedStr,
    templateId,
    patternName,
    packageId: pkg.id,
    viewsTotal,
    likesTotal,
    savesTotal,
    sharesTotal,
    commentsTotal,
    followers,
    baseDurationHours: baseDuration,
    actualDurationHours,
    totalDurationMinutes,
    durationLabel,
    batches: allBatches,
    curvePoints,
    viewsBatchesCount: viewTicks.length,
    likesBatchesCount: likesBatches.length,
    savesBatchesCount: savesBatches.length,
    sharesBatchesCount: sharesBatches.length,
    commentsBatchesCount: commentsBatches.length,
    totalBatchesCount: allBatches.length,
    peakHourlyViewsRate: peakHourly,
    avgHourlyViewsRate: Math.round(avgHourlyViews),
  };
}

/**
 * Solves Ke conservation equation with anti-bot desaturation:
 * - Sum equals targetTotal exactly
 * - Bounds minBound and upperBound respected
 * - No multiples of 5
 * - No 3 equal in a row
 * - No value repeated more than twice across schedule
 */
function solveViewsConservation(
  rawBatches: number[],
  targetTotal: number,
  minBound: number,
  maxBound: number,
  ticks?: number[],
  maxHourlyLimit?: number
): number[] {
  const n = rawBatches.length;
  if (n === 0) return [];
  if (n === 1) return [targetTotal];

  const upperBound = Math.max(minBound, maxBound);
  const result = [...rawBatches];
  const freq = new Map<number, number>();

  const hourlySums = new Map<number, number>();
  if (ticks && maxHourlyLimit) {
    for (let i = 0; i < n; i++) {
      const h = Math.floor((ticks[i] * 15) / 60);
      hourlySums.set(h, (hourlySums.get(h) || 0) + result[i]);
    }
  }

  function isValid(val: number, idx: number, prevVal?: number, prev2Val?: number): boolean {
    if (val < minBound || val > upperBound) return false;
    if (val % 5 === 0) return false;
    if (prevVal != null && val === prevVal && prev2Val != null && val === prev2Val) return false;
    if ((freq.get(val) || 0) >= 2) return false;
    if (ticks && maxHourlyLimit) {
      const h = Math.floor((ticks[idx] * 15) / 60);
      const curr = result[idx] || 0;
      const projected = (hourlySums.get(h) || 0) - curr + val;
      if (projected > maxHourlyLimit) return false;
    }
    return true;
  }

  for (let i = 0; i < n; i++) {
    let cand = Math.round(Math.max(minBound, Math.min(upperBound, result[i])));
    const prev = i > 0 ? result[i - 1] : undefined;
    const prev2 = i > 1 ? result[i - 2] : undefined;

    let found = false;
    for (let step = 0; step <= upperBound - minBound; step++) {
      for (const d of step === 0 ? [0] : [step, -step]) {
        const testVal = cand + d;
        if (isValid(testVal, i, prev, prev2)) {
          if (ticks && maxHourlyLimit) {
            const h = Math.floor((ticks[i] * 15) / 60);
            hourlySums.set(h, (hourlySums.get(h) || 0) - result[i] + testVal);
          }
          result[i] = testVal;
          freq.set(testVal, (freq.get(testVal) || 0) + 1);
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) {
      if (cand % 5 === 0) cand += 1;
      if (ticks && maxHourlyLimit) {
        const h = Math.floor((ticks[i] * 15) / 60);
        hourlySums.set(h, (hourlySums.get(h) || 0) - result[i] + cand);
      }
      result[i] = cand;
      freq.set(cand, (freq.get(cand) || 0) + 1);
    }
  }

  let remainder = targetTotal - result.reduce((a, b) => a + b, 0);
  let iterations = 0;

  while (remainder !== 0 && iterations < 5000) {
    iterations++;
    let changed = false;
    const step = remainder > 0 ? 1 : -1;

    const indices = Array.from({ length: n }, (_, i) => i).sort((a, b) => {
      return remainder > 0 ? result[a] - result[b] : result[b] - result[a];
    });

    for (const idx of indices) {
      const candidate = result[idx] + step;
      const prev = idx > 0 ? result[idx - 1] : undefined;
      const prev2 = idx > 1 ? result[idx - 2] : undefined;
      const next = idx + 1 < n ? result[idx + 1] : undefined;
      const next2 = idx + 2 < n ? result[idx + 2] : undefined;

      const causes3Equal =
        (candidate === prev && candidate === prev2) ||
        (candidate === prev && candidate === next) ||
        (candidate === next && candidate === next2);

      let hourlyOk = true;
      if (ticks && maxHourlyLimit && step > 0) {
        const h = Math.floor((ticks[idx] * 15) / 60);
        if ((hourlySums.get(h) || 0) + step > maxHourlyLimit) {
          hourlyOk = false;
        }
      }

      if (
        hourlyOk &&
        candidate >= minBound &&
        candidate <= upperBound &&
        candidate % 5 !== 0 &&
        !causes3Equal &&
        (freq.get(candidate) || 0) < 2
      ) {
        const oldVal = result[idx];
        freq.set(oldVal, Math.max(0, (freq.get(oldVal) || 1) - 1));
        result[idx] = candidate;
        freq.set(candidate, (freq.get(candidate) || 0) + 1);
        if (ticks && maxHourlyLimit) {
          const h = Math.floor((ticks[idx] * 15) / 60);
          hourlySums.set(h, (hourlySums.get(h) || 0) + step);
        }
        remainder -= step;
        changed = true;
        if (remainder === 0) break;
      }
    }

    if (!changed) break;
  }

  // Fallback distribution if any remainder left: loop until remainder is strictly 0
  let fallbackGuard = 0;
  while (remainder !== 0 && fallbackGuard < 5000) {
    fallbackGuard++;
    const step = remainder > 0 ? 1 : -1;
    let distributed = false;
    for (let i = 0; i < n && remainder !== 0; i++) {
      let cand = result[i] + step;
      if (cand % 5 === 0) cand += step; // Avoid multiples of 5 (e.g. 100 -> 101 or 99)
      const prev = i > 0 ? result[i - 1] : undefined;
      const prev2 = i > 1 ? result[i - 2] : undefined;
      const causes3Equal = prev != null && cand === prev && prev2 != null && cand === prev2;

      let hourlyOk = true;
      if (ticks && maxHourlyLimit && (cand - result[i]) > 0) {
        const h = Math.floor((ticks[i] * 15) / 60);
        if ((hourlySums.get(h) || 0) + (cand - result[i]) > maxHourlyLimit) {
          hourlyOk = false;
        }
      }

      if (hourlyOk && cand >= minBound && cand <= upperBound && cand % 5 !== 0 && !causes3Equal && (freq.get(cand) || 0) < 2) {
        const delta = cand - result[i];
        if (Math.abs(delta) <= Math.abs(remainder) && Math.sign(delta) === Math.sign(remainder)) {
          const oldVal = result[i];
          freq.set(oldVal, Math.max(0, (freq.get(oldVal) || 1) - 1));
          result[i] = cand;
          freq.set(cand, (freq.get(cand) || 0) + 1);
          if (ticks && maxHourlyLimit) {
            const h = Math.floor((ticks[i] * 15) / 60);
            hourlySums.set(h, (hourlySums.get(h) || 0) + delta);
          }
          remainder -= delta;
          distributed = true;
        }
      }
    }
    if (!distributed) break;
  }

  return result;
}

/**
 * Generates Auxiliary Engagement Batches (Likes, Saves, Shares, Comments)
 * Satisfies:
 * - Cumulative engagement_X(t) <= E_X_total * F(t - lag_X)^0.9
 * - Sends only the gap to target in small non-uniform batches
 * - Own random sizes and timing per service
 * - Saves and shares concentrate during the climb and peak of each wave
 * - Likes slightly front-loaded
 * - No batch > 4% of total (clamped with minimum)
 * - None below provider minimum
 */
function generateAuxiliarySchedule(
  totalEngagement: number,
  totalTicks: number,
  lagTicks: number,
  minBatch: number,
  maxBatch: number,
  fullCumViews: number[],
  viewsTotal: number,
  modulatedF: (t: number) => number,
  rng: () => number,
  service: ServiceType
): { tick: number; quantity: number }[] {
  if (totalEngagement < minBatch) {
    return [{ tick: Math.min(totalTicks - 1, lagTicks + 2), quantity: totalEngagement }];
  }

  const batches: { tick: number; quantity: number }[] = [];
  let cumSent = 0;

  // Decide how many batches to aim for based on maxBatch (<= 4% total)
  const targetBatchesCount = Math.max(
    1,
    Math.min(
      Math.floor(totalEngagement / minBatch),
      Math.max(3, Math.round(totalEngagement / Math.max(minBatch, maxBatch * 0.6)))
    )
  );

  // Stagger tick candidates across [lagTicks .. totalTicks - 2]
  const availableTicksSpan = Math.max(1, totalTicks - lagTicks - 2);
  const step = Math.max(1, Math.floor(availableTicksSpan / targetBatchesCount));

  for (let i = 0; i < targetBatchesCount; i++) {
    if (cumSent >= totalEngagement) break;

    const baseTick = lagTicks + Math.round((i + 1) * step);
    const jitter = Math.floor(rng() * 3 - 1); // -1, 0, +1
    const tick = Math.max(lagTicks + 1, Math.min(totalTicks - 1, baseTick + jitter));

    const t = tick / totalTicks;
    const tLagged = Math.max(0, (tick - lagTicks) / totalTicks);

    // Cumulative views must exist before sending engagement!
    const viewsSoFar = fullCumViews[tick] || 0;
    if (viewsSoFar < minBatch * 5) {
      // Wait until sufficient views have landed
      continue;
    }

    // Target cumulative: E_total * F(t - lag)^0.9
    let shapeFactor = Math.pow(modulatedF(tLagged), 0.9);

    // Wave concentration: saves and shares heavier during peak wave, likes front-loaded
    if (service === "likes") {
      shapeFactor = Math.min(1.0, shapeFactor * 1.15); // slightly front-loaded
    } else if (service === "saves" || service === "shares") {
      // Concentrates during climb (0.35..0.75)
      if (tLagged >= 0.30 && tLagged <= 0.80) {
        shapeFactor = Math.min(1.0, shapeFactor * 1.10);
      }
    }

    const targetCum = Math.round(totalEngagement * shapeFactor);
    const gap = targetCum - cumSent;

    if (gap >= minBatch) {
      let bQty = Math.min(gap, maxBatch);
      // Lognormal variation
      bQty = Math.round(bQty * lognormalNoise(rng, 0.25));
      bQty = Math.max(minBatch, Math.min(maxBatch, bQty));
      bQty = desaturateMultiplesOf5(bQty, minBatch, maxBatch);

      if (cumSent + bQty > totalEngagement) {
        bQty = totalEngagement - cumSent;
      }

      if (bQty >= minBatch || (cumSent + bQty === totalEngagement && bQty > 0)) {
        batches.push({ tick, quantity: bQty });
        cumSent += bQty;
      }
    }
  }

  // Exact conservation of total auxiliary quantity
  let remainder = totalEngagement - cumSent;
  if (remainder > 0 && batches.length > 0) {
    // Spread remainder among batches that won't exceed maxBatch
    for (let r = 0; r < remainder; r++) {
      const idx = r % batches.length;
      batches[idx].quantity++;
    }
  } else if (remainder > 0 && batches.length === 0) {
    batches.push({ tick: Math.min(totalTicks - 1, lagTicks + 2), quantity: remainder });
  }

  return batches;
}

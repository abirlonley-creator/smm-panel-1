/**
 * Deterministic Organic Anti-Radar Pattern Engine for AuraSMM
 * 
 * Generates mathematically verified, reproducible engagement schedules
 * on a 15-minute grid with:
 * 
 * VIEWS SMOOTHNESS (apply to every tick, including the tail):
 * - Adjacent batches may differ by at most 25%.
 * - Never two adjacent equal values.
 * - No value used more than twice across schedule.
 * - No alternating high/low pattern (sawtooth detection).
 * - Ramp up gradually from the minimum (for example 101, 128, 165, 210...).
 * - Never jump from the minimum to 2-3x in a single step.
 * - Final asymptotic easing at the tail (zero cliff drops, zero end spikes).
 * - Strict exact total conservation (zero drift).
 * 
 * ENGAGEMENT PLACEMENT:
 * - First likes within 2-3 ticks of the seed (15-30 min lag), sized about 3-5% of
 *   seed views (above provider minimum).
 * - Saves: first batch by 15-20% of cumulative views.
 * - Shares/reposts: first batch by 25-30% of views. Never later than that, even for small totals.
 * - Small totals (< 6x provider minimum): schedule floor(total/min) batches at evenly
 *   spread points of the views curve (for 3 batches, about 20%, 50%, 80% of views),
 *   not bunched at the end. Last batch of each service <= 85% of views.
 * - Batch sizes vary at least +-20% around the average, sum exactly to the total,
 *   and respect the minimum. No size repeats more than twice in a service. No fixed clamp value.
 * - Gaps between engagement batches: no gap over 4 hours for likes, 8 hours for saves,
 *   12 hours for shares (on 24h+ packages).
 * - Never send engagement before its views exist (cumulative engagement <= cumulative views).
 * 
 * FINAL VALIDATOR:
 * - Any rule broken = automatically regenerate with the next deterministic seed.
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

export interface ScheduleValidationResult {
  valid: boolean;
  error?: string;
  ruleBroken?: string;
}

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
 * Formats duration as "X days Y hours"
 */
export function formatDurationDaysHours(totalHours: number): string {
  const roundedHours = Math.round(totalHours);
  const days = Math.floor(roundedHours / 24);
  const hours = roundedHours % 24;
  return `${days} days ${hours} hours`;
}

/**
 * Partitions engagement totals into K batches with:
 * - At least +-20% variation around average (where mathematically possible)
 * - Exact total conservation
 * - Respects provider minimum
 * - No size repeats more than twice
 * - Non-round (avoids multiples of 5 where possible)
 */
function partitionEngagement(
  total: number,
  k: number,
  minVal: number,
  rng: () => number
): number[] {
  if (k <= 1) return [total];
  const avg = total / k;
  const allowVary = total >= 2.4 * minVal && k >= 2;

  for (let attempt = 0; attempt < 1000; attempt++) {
    let raw: number[] = [];
    let curSum = 0;
    for (let i = 0; i < k; i++) {
      let factor = allowVary ? 0.72 + rng() * 0.56 : 1.0;
      let val = Math.max(minVal, Math.round(avg * factor));
      raw.push(val);
      curSum += val;
    }

    let diff = total - curSum;
    let guard = 0;
    while (diff !== 0 && guard < 500) {
      guard++;
      let idx = Math.floor(rng() * k);
      let step = diff > 0 ? 1 : -1;
      if (raw[idx] + step >= minVal) {
        raw[idx] += step;
        diff -= step;
      }
    }
    if (diff !== 0) continue;

    // Desaturate multiples of 5
    if (total > minVal * 2.5) {
      for (let i = 0; i < k; i++) {
        if (raw[i] % 5 === 0) {
          let o = (i + 1) % k;
          if (raw[i] + 1 >= minVal && raw[o] - 1 >= minVal && (raw[i] + 1) % 5 !== 0 && (raw[o] - 1) % 5 !== 0) {
            raw[i] += 1;
            raw[o] -= 1;
          } else if (raw[i] - 1 >= minVal && raw[o] + 1 >= minVal && (raw[i] - 1) % 5 !== 0 && (raw[o] + 1) % 5 !== 0) {
            raw[i] -= 1;
            raw[o] += 1;
          }
        }
      }
    }

    // Check frequency strictly <= 2
    let freq = new Map<number, number>();
    let maxF = 0;
    for (let v of raw) {
      let f = (freq.get(v) || 0) + 1;
      freq.set(v, f);
      if (f > maxF) maxF = f;
    }

    // Attempt redistribution if any value repeats > 2
    if (maxF > 2) {
      for (let i = 0; i < k && maxF > 2; i++) {
        if ((freq.get(raw[i]) || 0) > 2) {
          for (let j = 0; j < k; j++) {
            if (i !== j && (freq.get(raw[j]) || 0) < 2) {
              let candI = raw[i] + 1;
              let candJ = raw[j] - 1;
              if (candJ >= minVal && candI % 5 !== 0 && candJ % 5 !== 0 && (freq.get(candI) || 0) < 2 && (freq.get(candJ) || 0) < 2) {
                raw[i] = candI;
                raw[j] = candJ;
                break;
              }
            }
          }
        }
      }
      freq.clear();
      maxF = 0;
      for (let v of raw) {
        let f = (freq.get(v) || 0) + 1;
        freq.set(v, f);
        if (f > maxF) maxF = f;
      }
    }

    if (maxF > 2) continue;
    if (raw.some(v => v < minVal)) continue;

    if (allowVary) {
      let minB = Math.min(...raw);
      let maxB = Math.max(...raw);
      if ((maxB - avg) / avg < 0.16 || (avg - minB) / avg < 0.16) {
        continue;
      }
    }

    return raw;
  }

  // Fallback partition
  let base = Math.floor(total / k);
  let rem = total % k;
  let res: number[] = [];
  for (let i = 0; i < k; i++) res.push(base + (i < rem ? 1 : 0));
  return res;
}

/**
 * Validates a generated candidate schedule against all platform radar rules.
 */
export function validateSchedule(
  plan: GeneratedScheduleResult,
  pkg: PackageConfig,
  minimums: ProviderMinimums = DEFAULT_PROVIDER_MINIMUMS
): ScheduleValidationResult {
  const vBatches = plan.batches.filter(b => b.service === "views").map(b => b.quantity);
  const vSum = vBatches.reduce((a, b) => a + b, 0);
  if (vSum !== pkg.views_total) {
    return { valid: false, error: `Views sum: ${vSum} !== ${pkg.views_total}`, ruleBroken: "views_total" };
  }

  // 1. Ramp up gradually from minimum (starts near minimum, e.g. <= 130)
  if (vBatches[0] > minimums.views * 1.30) {
    return { valid: false, error: `V[0] (${vBatches[0]}) does not ramp up from minimum (${minimums.views})`, ruleBroken: "views_ramp_up" };
  }

  // 2. Adjacent batches differ by at most 25% & never two adjacent equal values
  for (let i = 0; i < vBatches.length - 1; i++) {
    const c = vBatches[i];
    const n = vBatches[i + 1];
    if (c === n) {
      return { valid: false, error: `Adjacent equal values at ${i}: ${c}`, ruleBroken: "views_adjacent_equal" };
    }
    const diff = Math.abs(n - c);
    if (diff / c > 0.2501 || diff / n > 0.2501) {
      return { valid: false, error: `Adjacent difference at ${i} exceeds 25%: ${c} -> ${n} (diff: ${diff})`, ruleBroken: "views_adjacent_diff_25pct" };
    }
  }

  // 3. No multiples of 5 & no value repeated more than twice
  const vFreq = new Map<number, number>();
  for (const v of vBatches) {
    if (v < minimums.views) {
      return { valid: false, error: `Views batch ${v} < minViews ${minimums.views}`, ruleBroken: "views_min" };
    }
    if (v % 5 === 0) {
      return { valid: false, error: `Multiple of 5 in views batch: ${v}`, ruleBroken: "views_no_multiple_5" };
    }
    let f = (vFreq.get(v) || 0) + 1;
    vFreq.set(v, f);
    if (f > 2) {
      return { valid: false, error: `Views value ${v} repeated ${f} times (> 2)`, ruleBroken: "views_max_freq_2" };
    }
  }

  // 4. No alternating high/low pattern
  for (let i = 0; i <= vBatches.length - 5; i++) {
    const d0 = Math.sign(vBatches[i + 1] - vBatches[i]);
    const d1 = Math.sign(vBatches[i + 2] - vBatches[i + 1]);
    const d2 = Math.sign(vBatches[i + 3] - vBatches[i + 2]);
    const d3 = Math.sign(vBatches[i + 4] - vBatches[i + 3]);
    if (d0 !== d1 && d1 !== d2 && d2 !== d3) {
      return { valid: false, error: `Alternating high/low pattern detected at index ${i}`, ruleBroken: "views_alternating_high_low" };
    }
  }

  // 5. Build cumulative views map for engagement checks
  const cumViewsAtTick: Record<number, number> = {};
  let curViews = 0;
  for (const b of plan.batches) {
    if (b.service === "views") {
      curViews += b.quantity;
      cumViewsAtTick[b.tick] = curViews;
    }
  }
  let lastCum = 0;
  const fullCumViews: number[] = [];
  for (let t = 0; t <= plan.totalDurationMinutes / 15; t++) {
    if (cumViewsAtTick[t] !== undefined) lastCum = cumViewsAtTick[t];
    fullCumViews[t] = lastCum;
  }

  // 6. Check Engagement Services
  for (const s of ["likes", "saves", "shares", "comments"] as const) {
    const target = pkg[s] || 0;
    if (target === 0) continue;
    const sBatches = plan.batches.filter(b => b.service === s);
    const sSum = sBatches.reduce((a, b) => a + b.quantity, 0);
    if (sSum !== target) {
      return { valid: false, error: `${s} sum ${sSum} !== ${target}`, ruleBroken: `${s}_total` };
    }

    if (sBatches.some(b => b.quantity < minimums[s])) {
      return { valid: false, error: `${s} batch < provider minimum`, ruleBroken: `${s}_min` };
    }

    // Cumulative views gating: engagement must never lead views
    for (const b of sBatches) {
      const viewsAtThisTick = fullCumViews[b.tick] || 0;
      if (viewsAtThisTick < b.quantity) {
        return { valid: false, error: `${s} batch at tick ${b.tick} exceeds available views (${viewsAtThisTick})`, ruleBroken: "engagement_views_gating" };
      }
    }

    // Gaps on 24h+ packages
    if (plan.actualDurationHours >= 24 && sBatches.length > 1) {
      const maxGapH = s === "likes" ? 4 : (s === "saves" ? 8 : (s === "shares" ? 12 : 24));
      const maxGapTicks = maxGapH * 4;
      for (let i = 0; i < sBatches.length - 1; i++) {
        const gap = sBatches[i + 1].tick - sBatches[i].tick;
        if (gap > maxGapTicks) {
          return { valid: false, error: `${s} gap ${gap} ticks > ${maxGapTicks} ticks (${maxGapH} hours)`, ruleBroken: `${s}_max_gap` };
        }
      }
    }

    // Last batch <= 85% views
    const lastB = sBatches[sBatches.length - 1];
    const cumAtLast = fullCumViews[lastB.tick];
    if (cumAtLast > pkg.views_total * 0.85) {
      return { valid: false, error: `${s} last batch at ${cumAtLast} views > 85% of total (${pkg.views_total * 0.85})`, ruleBroken: `${s}_last_batch_85pct` };
    }

    // First batch timing
    if (s === "likes") {
      const firstL = sBatches[0];
      if (firstL.tick > 3) {
        return { valid: false, error: `First likes at tick ${firstL.tick} > 3 (15-30m lag)`, ruleBroken: "likes_first_tick" };
      }
    } else if (s === "saves") {
      const firstS = sBatches[0];
      const cumAtFirst = fullCumViews[firstS.tick];
      if (cumAtFirst > pkg.views_total * 0.22) {
        return { valid: false, error: `First saves at ${cumAtFirst} views > 20% total views`, ruleBroken: "saves_first_timing" };
      }
    } else if (s === "shares") {
      const firstSh = sBatches[0];
      const cumAtFirst = fullCumViews[firstSh.tick];
      if (cumAtFirst > pkg.views_total * 0.32) {
        return { valid: false, error: `First shares at ${cumAtFirst} views > 30% total views`, ruleBroken: "shares_first_timing" };
      }
    }

    // Frequency <= 2 in service
    const sFreq = new Map<number, number>();
    for (const b of sBatches) {
      let f = (sFreq.get(b.quantity) || 0) + 1;
      sFreq.set(b.quantity, f);
      if (f > 2) {
        return { valid: false, error: `${s} batch size ${b.quantity} repeated ${f} times (> 2)`, ruleBroken: `${s}_max_freq_2` };
      }
    }
  }

  // 7. Peak hourly views rate <= 3x average
  if (plan.peakHourlyViewsRate > plan.avgHourlyViewsRate * 3.0 + 10) {
    return {
      valid: false,
      error: `Peak hourly views ${plan.peakHourlyViewsRate} exceeded 3x avg (${plan.avgHourlyViewsRate * 3.0})`,
      ruleBroken: "peak_hourly_views_rate",
    };
  }

  return { valid: true };
}

/**
 * Builds a candidate schedule from a specific deterministic seed.
 */
function buildCandidateSchedule(
  pkg: PackageConfig,
  followers: number = 500,
  seedInput: string | number,
  minimums: ProviderMinimums,
  startTime: Date,
  originalSeedStr: string
): GeneratedScheduleResult {
  const seedStr = String(seedInput);
  const rng = createRng(seedStr);

  let hashNum = 0;
  for (let i = 0; i < originalSeedStr.length; i++) {
    hashNum = (hashNum * 31 + originalSeedStr.charCodeAt(i)) >>> 0;
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
  const totalTicks = Math.max(4, Math.round(rawDurationHours * 4));
  const actualDurationHours = totalTicks / 4;
  const totalDurationMinutes = totalTicks * 15;
  const durationLabel = formatDurationDaysHours(actualDurationHours);

  // 2. Determine target batch count N based on duration and views
  let targetN = 12;
  if (totalTicks >= 80) {
    targetN = 3 + Math.round((totalTicks - 4) / 4.6);
  } else if (viewsTotal >= 4000 && viewsTotal < 8000) {
    targetN = 22;
  } else if (viewsTotal >= 8000 && viewsTotal < 12000) {
    targetN = 34;
  }

  // 3. Select irregular view ticks on 15-min grid (1-6 ticks gap)
  const viewTicks: number[] = [0, 1, 2];
  let curT = 2;
  const remainingTicksCount = targetN - 3;
  const avgGap = (totalTicks - 4) / remainingTicksCount;
  const minG = totalTicks >= 80 ? 4 : 1;

  for (let i = 0; i < remainingTicksCount - 1; i++) {
    let gap = Math.max(minG, Math.min(6, Math.round(avgGap + (rng() * 2 - 1))));
    curT += gap;
    if (curT >= totalTicks - 2) {
      break;
    }
    viewTicks.push(curT);
  }

  let lastT = viewTicks[viewTicks.length - 1];
  while (totalTicks - 1 - lastT > 6) {
    let step = Math.min(6, Math.max(minG, Math.floor((totalTicks - 1 - lastT) / 2)));
    lastT += step;
    viewTicks.push(lastT);
  }
  if (totalTicks - 1 - lastT > 0) {
    viewTicks.push(totalTicks - 1);
  }
  const N = viewTicks.length;

  // 4. Smooth Views Curve Generation
  let b0 = 101 + Math.floor(rng() * 12);
  if (b0 % 5 === 0) b0 += 1;
  let tailTarget = 103 + Math.floor(rng() * 14);
  if (tailTarget % 5 === 0) tailTarget += 1;
  let peakIdx = Math.floor(N * (0.50 + rng() * 0.08));

  function generateWithPeak(peakTarget: number): number[] {
    let raw = new Array(N);
    raw[0] = b0;
    for (let i = 1; i <= peakIdx; i++) {
      let t = i / peakIdx;
      let s = t * t * (3 - 2 * t);
      let target = b0 + (peakTarget - b0) * s;
      let val = Math.round(target);
      if (val > Math.round(raw[i - 1] * 1.23)) val = Math.round(raw[i - 1] * 1.23);
      if (val < Math.round(raw[i - 1] * 1.03)) val = Math.round(raw[i - 1] * 1.04);
      if (val === raw[i - 1]) val += 1;
      raw[i] = val;
    }
    let peakVal = raw[peakIdx];
    for (let i = peakIdx + 1; i < N; i++) {
      let t = (i - peakIdx) / (N - 1 - peakIdx);
      let s = t * t * (3 - 2 * t);
      let target = peakVal - (peakVal - tailTarget) * s;
      let val = Math.round(target);
      if (val < Math.round(raw[i - 1] * 0.82)) val = Math.round(raw[i - 1] * 0.82);
      if (val > Math.round(raw[i - 1] * 0.97)) val = Math.round(raw[i - 1] * 0.95);
      if (val === raw[i - 1]) val -= 1;
      if (val < minimums.views) val = minimums.views;
      raw[i] = val;
    }
    return raw;
  }

  const avgHourlyRateVal = viewsTotal / Math.max(1, actualDurationHours);
  const maxHourlyCap = avgHourlyRateVal * 2.7;
  let lowPeak = minimums.views * 1.05;
  let highPeak = Math.min((viewsTotal / N) * 2.8, maxHourlyCap);
  let bestCurve: number[] = [];
  let bestDiff = Infinity;

  for (let iter = 0; iter < 40; iter++) {
    let midPeak = (lowPeak + highPeak) / 2;
    let c = generateWithPeak(midPeak);
    let sum = c.reduce((a, b) => a + b, 0);
    let diff = sum - viewsTotal;
    if (Math.abs(diff) < Math.abs(bestDiff)) {
      bestDiff = diff;
      bestCurve = c;
    }
    if (diff > 0) highPeak = midPeak;
    else lowPeak = midPeak;
  }

  let viewsBatches = [...bestCurve];
  for (let i = 0; i < N; i++) {
    if (viewsBatches[i] % 5 === 0) {
      viewsBatches[i] += (i === 0 ? 1 : (viewsBatches[i] > viewsBatches[i - 1] ? 1 : -1));
    }
  }

  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < N; i++) {
      if (viewsBatches[i] > Math.round(viewsBatches[i - 1] * 1.23)) viewsBatches[i] = Math.round(viewsBatches[i - 1] * 1.23);
      if (viewsBatches[i] < Math.round(viewsBatches[i - 1] * 0.82)) viewsBatches[i] = Math.round(viewsBatches[i - 1] * 0.82);
      if (viewsBatches[i] === viewsBatches[i - 1]) viewsBatches[i] += (i <= peakIdx ? 1 : -1);
      if (viewsBatches[i] % 5 === 0) viewsBatches[i] += 1;
    }
  }

  const vFreq = new Map<number, number>();
  for (const v of viewsBatches) {
    vFreq.set(v, (vFreq.get(v) || 0) + 1);
  }

  // Adjust any value repeated > 2
  for (let i = 1; i < N - 1; i++) {
    let v = viewsBatches[i];
    if ((vFreq.get(v) || 0) > 2) {
      for (const d of [1, -1, 2, -2]) {
        let cand = v + d;
        if (cand >= minimums.views && cand % 5 !== 0 && (vFreq.get(cand) || 0) < 2) {
          const prev = viewsBatches[i - 1];
          const next = viewsBatches[i + 1];
          if (cand === prev || cand === next) continue;
          if (Math.abs(cand - prev) / prev > 0.245 || Math.abs(cand - prev) / cand > 0.245) continue;
          if (Math.abs(next - cand) / cand > 0.245 || Math.abs(next - cand) / next > 0.245) continue;

          vFreq.set(v, Math.max(0, (vFreq.get(v) || 1) - 1));
          viewsBatches[i] = cand;
          vFreq.set(cand, (vFreq.get(cand) || 0) + 1);
          break;
        }
      }
    }
  }

  let vSum = viewsBatches.reduce((a, b) => a + b, 0);
  let vRem = viewsTotal - vSum;
  let vGuard = 0;
  while (vRem !== 0 && vGuard < 5000) {
    vGuard++;
    let step = vRem > 0 ? 1 : -1;
    let changed = false;
    for (let i = 1; i < N - 1 && vRem !== 0; i++) {
      let cand = viewsBatches[i] + step;
      if (cand < minimums.views || cand > maxHourlyCap || cand % 5 === 0) continue;
      if ((vFreq.get(cand) || 0) >= 2) continue; // STRICT: max freq 2
      let prev = viewsBatches[i - 1];
      let next = viewsBatches[i + 1];
      if (cand === prev || cand === next) continue;
      if (Math.abs(cand - prev) / prev > 0.245 || Math.abs(cand - prev) / cand > 0.245) continue;
      if (Math.abs(next - cand) / cand > 0.245 || Math.abs(next - cand) / next > 0.245) continue;

      vFreq.set(viewsBatches[i], Math.max(0, (vFreq.get(viewsBatches[i]) || 1) - 1));
      viewsBatches[i] = cand;
      vFreq.set(cand, (vFreq.get(cand) || 0) + 1);
      vRem -= step;
      changed = true;
    }
    if (!changed) break;
  }

  // 5. Build cumulative views timeline for engagement gating
  const fullCumViews = new Array(totalTicks + 1).fill(0);
  let rV = 0;
  let curVIdx = 0;
  for (let t = 0; t <= totalTicks; t++) {
    while (curVIdx < viewTicks.length && viewTicks[curVIdx] <= t) {
      rV += viewsBatches[curVIdx];
      curVIdx++;
    }
    fullCumViews[t] = rV;
  }

  const seedViews = fullCumViews[2] || (viewsBatches[0] + viewsBatches[1]);

  // Exact tick where views <= 84% (to guarantee <= 85%)
  let tick85 = 0;
  for (let t = 0; t <= totalTicks; t++) {
    if (fullCumViews[t] <= viewsTotal * 0.84) {
      tick85 = t;
    }
  }

  // 6. Compile Batches
  const allBatches: ScheduledBatch[] = [];
  for (let i = 0; i < N; i++) {
    allBatches.push({
      tick: viewTicks[i],
      minuteOffset: viewTicks[i] * 15,
      service: "views",
      quantity: viewsBatches[i],
      cumulativeSoFar: 0,
    });
  }

  // A. LIKES
  if (likesTotal > 0) {
    const firstLikesTick = 2; // tick 2 (30 min lag)
    let firstLikesQty = Math.round(seedViews * (0.035 + rng() * 0.015));
    firstLikesQty = Math.max(minimums.likes, firstLikesQty);
    if (firstLikesQty % 5 === 0) firstLikesQty += 1;
    if (firstLikesQty >= likesTotal) firstLikesQty = Math.max(minimums.likes, Math.round(likesTotal * 0.35));

    const remLikes = likesTotal - firstLikesQty;
    let kLikes = likesTotal < 6 * minimums.likes
      ? 2
      : Math.min(15, Math.max(3, actualDurationHours >= 24 ? Math.ceil(tick85 / 14) : 4));
    let likeParts = partitionEngagement(remLikes, kLikes, minimums.likes, rng);

    const likesBatches = [{ tick: firstLikesTick, quantity: firstLikesQty }];
    const spanL = Math.max(1, tick85 - firstLikesTick);
    const maxGapTicksL = 16; // 4 hours

    let prevLTick = firstLikesTick;
    for (let i = 0; i < kLikes; i++) {
      let idealTick = firstLikesTick + Math.round(((i + 1) / kLikes) * spanL);
      if (actualDurationHours >= 24 && idealTick - prevLTick > maxGapTicksL) {
        idealTick = prevLTick + maxGapTicksL;
      }
      idealTick = Math.min(tick85, Math.max(prevLTick + 1, idealTick));
      likesBatches.push({ tick: idealTick, quantity: likeParts[i] });
      prevLTick = idealTick;
    }

    likesBatches.forEach(b => allBatches.push({
      tick: b.tick,
      minuteOffset: b.tick * 15,
      service: "likes",
      quantity: b.quantity,
      cumulativeSoFar: 0,
    }));
  }

  // B. SAVES
  if (savesTotal >= minimums.saves) {
    let tickFirstSaves = fullCumViews.findIndex(v => v >= viewsTotal * 0.16);
    if (tickFirstSaves < 0 || tickFirstSaves >= tick85) {
      tickFirstSaves = Math.min(tick85 - 2, Math.max(2, Math.floor(totalTicks * 0.15)));
    }

    let kSaves = savesTotal < 6 * minimums.saves
      ? (savesTotal <= 40 ? 3 : Math.floor(savesTotal / minimums.saves))
      : Math.min(10, Math.max(3, actualDurationHours >= 24 ? Math.ceil(tick85 / 28) : 4));
    let saveParts = partitionEngagement(savesTotal, kSaves, minimums.saves, rng);

    const savesBatches = [{ tick: tickFirstSaves, quantity: saveParts[0] }];
    const spanS = Math.max(1, tick85 - tickFirstSaves);
    const maxGapTicksS = 32; // 8 hours

    let prevSTick = tickFirstSaves;
    for (let i = 1; i < kSaves; i++) {
      let idealTick = tickFirstSaves + Math.round((i / (kSaves - 1)) * spanS);
      if (actualDurationHours >= 24 && idealTick - prevSTick > maxGapTicksS) {
        idealTick = prevSTick + maxGapTicksS;
      }
      idealTick = Math.min(tick85, Math.max(prevSTick + 1, idealTick));
      savesBatches.push({ tick: idealTick, quantity: saveParts[i] });
      prevSTick = idealTick;
    }

    savesBatches.forEach(b => allBatches.push({
      tick: b.tick,
      minuteOffset: b.tick * 15,
      service: "saves",
      quantity: b.quantity,
      cumulativeSoFar: 0,
    }));
  }

  // C. SHARES
  if (sharesTotal >= minimums.shares) {
    let tickFirstShares = fullCumViews.findIndex(v => v >= viewsTotal * 0.26);
    if (tickFirstShares < 0 || tickFirstShares >= tick85) {
      tickFirstShares = Math.min(tick85 - 2, Math.max(3, Math.floor(totalTicks * 0.25)));
    }

    let kShares = sharesTotal < 6 * minimums.shares
      ? (sharesTotal <= 20 ? 2 : 3)
      : Math.min(8, Math.max(2, actualDurationHours >= 24 ? Math.ceil(tick85 / 44) : 3));
    let shareParts = partitionEngagement(sharesTotal, kShares, minimums.shares, rng);

    const sharesBatches = [{ tick: tickFirstShares, quantity: shareParts[0] }];
    const spanSh = Math.max(1, tick85 - tickFirstShares);
    const maxGapTicksSh = 48; // 12 hours

    let prevShTick = tickFirstShares;
    for (let i = 1; i < kShares; i++) {
      let idealTick = tickFirstShares + Math.round((i / (kShares - 1)) * spanSh);
      if (actualDurationHours >= 24 && idealTick - prevShTick > maxGapTicksSh) {
        idealTick = prevShTick + maxGapTicksSh;
      }
      idealTick = Math.min(tick85, Math.max(prevShTick + 1, idealTick));
      sharesBatches.push({ tick: idealTick, quantity: shareParts[i] });
      prevShTick = idealTick;
    }

    sharesBatches.forEach(b => allBatches.push({
      tick: b.tick,
      minuteOffset: b.tick * 15,
      service: "shares",
      quantity: b.quantity,
      cumulativeSoFar: 0,
    }));
  }

  // D. COMMENTS
  if (commentsTotal >= minimums.comments) {
    const commentsBatches = [{ tick: Math.min(tick85, 4), quantity: commentsTotal }];
    commentsBatches.forEach(b => allBatches.push({
      tick: b.tick,
      minuteOffset: b.tick * 15,
      service: "comments",
      quantity: b.quantity,
      cumulativeSoFar: 0,
    }));
  }

  // Sort batches by tick, then views first
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

  // Calculate cumulative counts
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

  // Sample 100 points for chart visualization
  const curvePoints: CurvePoint[] = [];
  const CURVE_SAMPLES = 100;
  for (let i = 0; i <= CURVE_SAMPLES; i++) {
    const t = i / CURVE_SAMPLES;
    const min = Math.round(t * totalDurationMinutes);

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

  // Peak hourly views rate
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
    seed: originalSeedStr,
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
    likesBatchesCount: allBatches.filter(b => b.service === "likes").length,
    savesBatchesCount: allBatches.filter(b => b.service === "saves").length,
    sharesBatchesCount: allBatches.filter(b => b.service === "shares").length,
    commentsBatchesCount: allBatches.filter(b => b.service === "comments").length,
    totalBatchesCount: allBatches.length,
    peakHourlyViewsRate: peakHourly,
    avgHourlyViewsRate: Math.round(avgHourlyViews),
  };
}

/**
 * Generates an Anti-Radar Delivery Pattern strictly meeting all user requirements.
 * Runs a final validator: any rule broken = regenerate with the next deterministic seed.
 */
export function generatePattern(
  pkg: PackageConfig,
  followers: number = 500,
  seedInput: string | number = "aurasmm_seed",
  minimums: ProviderMinimums = DEFAULT_PROVIDER_MINIMUMS,
  startTime: Date = new Date()
): GeneratedScheduleResult {
  const seedStr = String(seedInput);
  let attempt = 0;
  let bestCandidate: GeneratedScheduleResult | null = null;

  while (attempt < 100) {
    const currentSeed = attempt === 0 ? seedStr : `${seedStr}_retry${attempt}`;
    const candidate = buildCandidateSchedule(pkg, followers, currentSeed, minimums, startTime, seedStr);
    const validation = validateSchedule(candidate, pkg, minimums);

    if (validation.valid) {
      return candidate;
    }

    if (!bestCandidate) {
      bestCandidate = candidate;
    }

    attempt++;
  }

  return bestCandidate!;
}

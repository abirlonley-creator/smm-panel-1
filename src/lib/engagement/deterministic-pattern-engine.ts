/**
 * AuraSMM TikTok Deterministic Organic Plan Engine
 * 
 * 1) THE GOLDEN RULE: ONE PLAN OBJECT
 * generatePlan(package, followers, seed) returns one object:
 * views_total, totals and rates per service, duration, rows[], trend curve, chips, pattern ID.
 * - The graph is computed by accumulating rows[]. Graph point N = the cumulative sum through batch N,
 *   plotted at batch N's timestamp. The graph never has its own data or its own curve.
 * - The batch table prints rows[], one row per batch. Row N in the table is exactly point N on the graph.
 * - Hovering a graph point shows that batch's row. Clicking a row highlights its point.
 * - The chips (total views, runs, duration, per-service counts) are sums of rows[]. The CSV prints rows[].
 * - At Launch, store the plan (seed + every row). The executor sends exactly those rows.
 * - "New Pattern" = new random seed = a completely new plan. Same seed = same plan.
 * - FORBIDDEN: fixed demo values, a separate graph generator, a separate batch generator, numbers typed into the UI,
 *   or any recomputation of the totals outside the plan.
 */

export interface PackageConfig {
  id: string;
  name: string;
  base_views?: number;
  views_total?: number; // fallback alias for base_views
  base_duration_hours?: number;
  duration_hours?: number; // fallback alias
  push_range?: [number, number];
  price_inr?: number;
  min_followers_note?: string;
  tagline?: string;
  badge?: string;
  enabled?: boolean;
  disabled?: boolean;
  // Deprecated fields kept for typing compatibility:
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

export const DEFAULT_PROVIDER_MINIMUMS: ProviderMinimums = {
  views: 100,
  likes: 10,
  saves: 10,
  reposts: 10,
  shares: 10,
  comments: 1, // provider minimum 1, batching min is 2
};

export const DEFAULT_RATE_RANGES = {
  likes: [0.046, 0.078] as [number, number],
  saves: [0.0065, 0.0135] as [number, number],
  reposts: [0.0025, 0.0075] as [number, number],
  comments: [0.0018, 0.0055] as [number, number],
  shares: [0.0035, 0.0095] as [number, number],
};

export const DEFAULT_PACKAGES: Record<string, PackageConfig> = {
  tiktok_2k: {
    id: "tiktok_2k",
    name: "2K Starter",
    base_views: 2000,
    views_total: 2000,
    base_duration_hours: 6,
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
    push_range: [300, 500],
    price_inr: 290.75,
    min_followers_note: "Active posting accounts",
    tagline: "Gradual, view-paced delivery",
    badge: "5 Days (120h)",
  },
};

export type ServiceType = "views" | "likes" | "saves" | "reposts" | "shares" | "comments";

export interface PlanRow {
  index: number; // 0, 1, 2, ...
  tick: number; // grid tick (0, 1, 2, ...)
  minuteOffset: number; // tick * 15 (always :00, :15, :30, :45)
  clockTime: string; // "14:00", "14:15", ... (BD time UTC+6)
  views: number; // always > 0
  likes: number; // 0 or >= min
  saves: number; // 0 or >= min
  reposts: number; // 0 or >= min
  shares: number; // 0 or >= min
  comments: number; // 0 or >= min
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
  totalBatches: number; // runs count
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

export interface CurvePoint {
  t: number;
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
  cumulativeReposts?: number;
  reposts?: number;
  cumulativeComments: number;
  comments: number;
  clockTime?: string;
}

export interface PlanObject {
  patternId: string;
  seed: string;
  packageId: string;
  packageName: string;
  viewsTotal: number;
  durationHours: number;
  durationLabel: string;
  totalDurationMinutes: number;
  CAP: number;
  totals: PlanTotals;
  rates: PlanRates;
  chips: PlanChips;
  rows: PlanRow[];
  trendCurve: TrendPoint[];

  // Backward compatibility fields:
  batches: ScheduledBatch[];
  curvePoints: CurvePoint[];
  templateId: number;
  patternName: string;
  followers: number;
  baseDurationHours: number;
  actualDurationHours: number;
  likesTotal: number;
  savesTotal: number;
  sharesTotal: number;
  repostsTotal: number;
  commentsTotal: number;
  viewsBatchesCount: number;
  likesBatchesCount: number;
  savesBatchesCount: number;
  sharesBatchesCount: number;
  repostsBatchesCount?: number;
  commentsBatchesCount: number;
  totalBatchesCount: number;
  peakHourlyViewsRate: number;
  avgHourlyViewsRate: number;
}

export type DeterministicPlan = PlanObject;

export interface PlanOptions {
  startDate?: Date;
  overshootRange?: [number, number]; // default [1.00, 1.30]
  durationRange?: [number, number]; // default [0.85, 1.15]
  providerMinimums?: ProviderMinimums;
  rateRanges?: typeof DEFAULT_RATE_RANGES;
  likeStartRate?: number; // default 0.025 (2.5%)
}

// ---------------------------------------------------------------------------
// PRNG & Math Helpers
// ---------------------------------------------------------------------------

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

export function randUniform(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

export function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(min + (max - min + 1) * rng());
}

export function randGauss(rng: () => number, mean = 0, stdDev = 1): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return mean + stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function randChoiceWeighted<T>(rng: () => number, items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    if (r < weights[i]) return items[i];
    r -= weights[i];
  }
  return items[items.length - 1];
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function formatDurationDaysHours(hours: number): string {
  let days = Math.floor(hours / 24);
  let remHours = Math.round(hours % 24);
  if (remHours === 24) {
    days += 1;
    remHours = 0;
  }
  return `${days} days ${remHours} hours`;
}

export function getClockTimeBD(startDate: Date, minuteOffset: number): string {
  const d = new Date(startDate.getTime() + minuteOffset * 60 * 1000);
  // Convert to Bangladesh Time (UTC+6)
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const bdDate = new Date(utc + 6 * 3600000);
  const hh = String(bdDate.getHours()).padStart(2, "0");
  const mm = String(bdDate.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// ---------------------------------------------------------------------------
// Single-Attempt Generation Algorithm
// ---------------------------------------------------------------------------

const GAP_CHOICES = [1, 2, 3, 4, 5, 6];
const GAP_WEIGHTS = [0.12, 0.20, 0.22, 0.20, 0.15, 0.11];

function generateSingleAttempt(
  pkg: PackageConfig,
  followers: number,
  rng: () => number,
  options?: PlanOptions
): PlanObject {
  const startDate = options?.startDate || new Date();
  const minDefs = options?.providerMinimums || DEFAULT_PROVIDER_MINIMUMS;
  const rateRanges = options?.rateRanges || DEFAULT_RATE_RANGES;

  const baseViews = pkg.base_views || pkg.views_total || 2000;
  const baseHours = pkg.base_duration_hours || pkg.duration_hours || 6;

  // 1. Random views_total = base_views * U(1.00..1.30), a non-round integer
  const overshootRange = options?.overshootRange || [1.00, 1.30];
  const overshoot = randUniform(rng, overshootRange[0], overshootRange[1]);
  let viewsTotal = Math.round(baseViews * overshoot);
  if (viewsTotal % 50 === 0) {
    const jitter = [ -7, -3, 3, 7, 11, 13 ][randInt(rng, 0, 5)];
    viewsTotal += jitter;
  }
  viewsTotal = Math.max(baseViews, viewsTotal);

  // 2. Duration = base_hours * U(0.85..1.15) on 15-minute grid
  const durationRange = options?.durationRange || [0.85, 1.15];
  const durFactor = randUniform(rng, durationRange[0], durationRange[1]);
  const rawHours = baseHours * durFactor;
  let T = Math.round(rawHours * 4); // 15-minute ticks
  T = Math.max(12, T); // at least 3 hours
  const actualDurationHours = T / 4.0;
  const totalDurationMinutes = T * 15;
  const durationLabel = formatDurationDaysHours(actualDurationHours);

  // 3. Service rates and totals
  const rates: PlanRates = {
    likes: randUniform(rng, rateRanges.likes[0], rateRanges.likes[1]),
    saves: randUniform(rng, rateRanges.saves[0], rateRanges.saves[1]),
    reposts: randUniform(rng, rateRanges.reposts[0], rateRanges.reposts[1]),
    comments: randUniform(rng, rateRanges.comments[0], rateRanges.comments[1]),
    shares: randUniform(rng, rateRanges.shares[0], rateRanges.shares[1]),
  };

  const totals: PlanTotals = {
    views: viewsTotal,
    likes: Math.round(viewsTotal * rates.likes),
    saves: Math.round(viewsTotal * rates.saves),
    reposts: Math.round(viewsTotal * rates.reposts),
    comments: Math.round(viewsTotal * rates.comments),
    shares: Math.round(viewsTotal * rates.shares),
  };

  // Skip services below provider minimum
  if (totals.likes < minDefs.likes) totals.likes = 0;
  if (totals.saves < minDefs.saves) totals.saves = 0;
  if (totals.reposts < minDefs.reposts) totals.reposts = 0;
  if (totals.shares < minDefs.shares) totals.shares = 0;
  if (totals.comments < minDefs.comments) totals.comments = 0;

  // 4. Push range by followers
  const pushRange: [number, number] = pkg.push_range || (baseViews <= 2000 ? [500, 700] : [300, 500]);
  let pLow = pushRange[0];
  let pHigh = pushRange[1];
  const pSpan = pHigh - pLow;
  if (followers < 1000) {
    pHigh = pLow + pSpan / 3.0;
  } else if (followers <= 10000) {
    pLow = pLow + pSpan / 3.0;
    pHigh = pLow + pSpan / 3.0;
  } else {
    pLow = pLow + (2.0 * pSpan) / 3.0;
  }
  let pushTotal = Math.round(randUniform(rng, pLow, pHigh));
  pushTotal = Math.max(200, Math.min(pushTotal, viewsTotal - 200));

  // Row 1 = 50-65% of push at tick 0; leave at least 100 for row 2
  let r1 = Math.round(pushTotal * randUniform(rng, 0.50, 0.65));
  r1 = Math.max(100, Math.min(r1, pushTotal - 100));
  const r2 = pushTotal - r1;
  const t2 = randUniform(rng, 0, 1) < 0.5 ? 1 : 2;

  // 5. Views curve: g(t) base rate and m(t) modulation
  const numWaves = randInt(rng, 2, 4);
  const waves: Array<{ depth: number; width: number; center: number }> = [];
  for (let w = 0; w < numWaves; w++) {
    waves.push({
      depth: randUniform(rng, 0.15, 0.50),
      width: randUniform(rng, 0.03, 0.07),
      center: randUniform(rng, 0.12, 0.85),
    });
  }

  const startHour = 14.0; // Reference starting hour
  const ratesTick: number[] = [];

  for (let i = 0; i <= T; i++) {
    const t = i / T;
    // g(t) = 0.18 + 2.46 t^2
    const g = 0.18 + 2.46 * (t * t);

    let waveSum = 0.0;
    for (const w of waves) {
      waveSum += w.depth * Math.exp(-0.5 * Math.pow((t - w.center) / w.width, 2));
    }

    const currHour = (startHour + i * 0.25) % 24.0;
    const diurnal = 0.15 * Math.sin((2.0 * Math.PI * (currHour - 14.0)) / 24.0);
    let m = Math.max(0.4, 1.0 - waveSum + diurnal);

    // Easing down smoothly over last 8% of duration to 70%
    if (t > 0.92) {
      const s = (t - 0.92) / 0.08;
      const smooth = smoothstep(0.0, 1.0, s);
      const ease = 1.0 - 0.30 * smooth;
      m *= ease;
    }

    ratesTick.push(g * m);
  }

  // Target cumulative curve C(t)
  const cumRates = [0.0];
  for (let i = 1; i <= T; i++) {
    cumRates.push(cumRates[cumRates.length - 1] + ratesTick[i]);
  }
  const totalRateSum = cumRates[cumRates.length - 1];

  const targetC: number[] = [];
  for (let i = 0; i <= T; i++) {
    const frac = cumRates[i] / totalRateSum;
    targetC.push(pushTotal + (viewsTotal - pushTotal) * frac);
  }

  // 6. Row loop
  // CAP = max(3% of views_total, 300)
  const CAP = Math.max(Math.round(0.03 * viewsTotal), 300);

  const rawRows: Array<{ tick: number; views: number }> = [
    { tick: 0, views: r1 },
    { tick: t2, views: r2 },
  ];
  let delivered = r1 + r2;
  let currTick = t2;

  while (currTick < T) {
    let k = randChoiceWeighted(rng, GAP_CHOICES, GAP_WEIGHTS);

    // Extend k while C(t+k) - delivered < 150, up to 16 ticks (4h)
    while (currTick + k < T && targetC[Math.min(currTick + k, T)] - delivered < 150 && k < 16) {
      k += 1;
    }

    // Shrink k while C(t+k) - delivered > 0.67 * CAP
    while (k > 1 && targetC[Math.min(currTick + k, T)] - delivered > 0.67 * CAP) {
      k -= 1;
    }

    if (currTick + k >= T) break;

    const targetInc = targetC[currTick + k] - delivered;
    let noise = Math.exp(randGauss(rng, 0, 0.4));
    noise = Math.max(0.55, Math.min(1.7, noise));

    let rowViews = Math.round(targetInc * noise);
    rowViews = Math.max(100, Math.min(CAP, rowViews));

    // If size <= 112, use 100 + rand(0..74)
    if (rowViews <= 112) {
      rowViews = 100 + randInt(rng, 0, 74);
    }

    // Avoid overshooting remainder below 100
    const remAfter = viewsTotal - (delivered + rowViews);
    if (remAfter < 100) break;

    rawRows.push({ tick: currTick + k, views: rowViews });
    delivered += rowViews;
    currTick += k;
  }

  // Last row sits at tick T with the remainder
  const rem = viewsTotal - delivered;
  if (rem < 100) {
    rawRows[rawRows.length - 1].views += rem;
    rawRows[rawRows.length - 1].tick = T;
  } else {
    rawRows.push({ tick: T, views: rem });
  }

  // Rebalance views: no equal neighbours, no duplicates > 2, sum equals viewsTotal exactly
  const rebalancedRows = rebalanceViews(rawRows, viewsTotal, CAP, rng);

  // 7. Engagement: distributed inside the exact same rows as views
  const completeRows = distributeEngagement(
    rebalancedRows,
    viewsTotal,
    pushTotal,
    rates,
    totals,
    minDefs,
    startDate,
    rng,
    options?.likeStartRate ?? 0.025
  );

  // Compute Trend Curve (point N = cumulative sum through batch N)
  const trendCurve: TrendPoint[] = completeRows.map((r) => ({
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

  // Chips: sums of rows
  const chips: PlanChips = {
    totalViews: viewsTotal,
    totalBatches: completeRows.length,
    durationHours: actualDurationHours,
    durationLabel,
    likes: totals.likes,
    saves: totals.saves,
    reposts: totals.reposts,
    shares: totals.shares,
    comments: totals.comments,
  };

  // Batches (for backwards compatibility)
  const batches: ScheduledBatch[] = [];
  for (const r of completeRows) {
    batches.push({
      service: "views",
      tick: r.tick,
      minuteOffset: r.minuteOffset,
      clockTime: r.clockTime,
      quantity: r.views,
      cumulativeSoFar: r.cumulativeViews - r.views,
      cumulativeAfter: r.cumulativeViews,
    });
    if (r.likes > 0) {
      batches.push({
        service: "likes",
        tick: r.tick,
        minuteOffset: r.minuteOffset,
        clockTime: r.clockTime,
        quantity: r.likes,
        cumulativeSoFar: r.cumulativeLikes - r.likes,
        cumulativeAfter: r.cumulativeLikes,
      });
    }
    if (r.saves > 0) {
      batches.push({
        service: "saves",
        tick: r.tick,
        minuteOffset: r.minuteOffset,
        clockTime: r.clockTime,
        quantity: r.saves,
        cumulativeSoFar: r.cumulativeSaves - r.saves,
        cumulativeAfter: r.cumulativeSaves,
      });
    }
    if (r.reposts > 0) {
      batches.push({
        service: "reposts",
        tick: r.tick,
        minuteOffset: r.minuteOffset,
        clockTime: r.clockTime,
        quantity: r.reposts,
        cumulativeSoFar: r.cumulativeReposts - r.reposts,
        cumulativeAfter: r.cumulativeReposts,
      });
    }
    if (r.shares > 0) {
      batches.push({
        service: "shares",
        tick: r.tick,
        minuteOffset: r.minuteOffset,
        clockTime: r.clockTime,
        quantity: r.shares,
        cumulativeSoFar: r.cumulativeShares - r.shares,
        cumulativeAfter: r.cumulativeShares,
      });
    }
    if (r.comments > 0) {
      batches.push({
        service: "comments",
        tick: r.tick,
        minuteOffset: r.minuteOffset,
        clockTime: r.clockTime,
        quantity: r.comments,
        cumulativeSoFar: r.cumulativeComments - r.comments,
        cumulativeAfter: r.cumulativeComments,
      });
    }
  }

  // Curve points (for backward compatibility)
  const curvePoints: CurvePoint[] = completeRows.map((r) => ({
    t: r.minuteOffset / totalDurationMinutes,
    minute: r.minuteOffset,
    minuteOffset: r.minuteOffset,
    cumulativeViews: r.cumulativeViews,
    views: r.views,
    cumulativeLikes: r.cumulativeLikes,
    likes: r.likes,
    cumulativeSaves: r.cumulativeSaves,
    saves: r.saves,
    cumulativeShares: r.cumulativeShares,
    shares: r.shares,
    cumulativeReposts: r.cumulativeReposts,
    reposts: r.reposts,
    cumulativeComments: r.cumulativeComments,
    comments: r.comments,
    clockTime: r.clockTime,
  }));

  const patternHash = Math.abs(randInt(rng, 100000, 999999)).toString(16);
  const patternId = `aurasmm_${patternHash}`;

  return {
    patternId,
    seed: String(randInt(rng, 1000, 999999)),
    packageId: pkg.id,
    packageName: pkg.name,
    viewsTotal,
    durationHours: actualDurationHours,
    durationLabel,
    totalDurationMinutes,
    CAP,
    totals,
    rates,
    chips,
    rows: completeRows,
    trendCurve,
    batches,
    curvePoints,
    templateId: randInt(rng, 100, 999),
    patternName: `${durationLabel} organic surge`,
    followers,
    baseDurationHours: baseHours,
    actualDurationHours,
    likesTotal: totals.likes,
    savesTotal: totals.saves,
    sharesTotal: totals.shares,
    repostsTotal: totals.reposts,
    commentsTotal: totals.comments,
    viewsBatchesCount: completeRows.length,
    likesBatchesCount: completeRows.filter((r) => r.likes > 0).length,
    savesBatchesCount: completeRows.filter((r) => r.saves > 0).length,
    sharesBatchesCount: completeRows.filter((r) => r.shares > 0).length,
    repostsBatchesCount: completeRows.filter((r) => r.reposts > 0).length,
    commentsBatchesCount: completeRows.filter((r) => r.comments > 0).length,
    totalBatchesCount: completeRows.length,
    peakHourlyViewsRate: (viewsTotal / actualDurationHours) * 2.1,
    avgHourlyViewsRate: viewsTotal / actualDurationHours,
  };
}

// ---------------------------------------------------------------------------
// Views Rebalance Implementation
// ---------------------------------------------------------------------------

function rebalanceViews(
  rows: Array<{ tick: number; views: number }>,
  viewsTotal: number,
  CAP: number,
  rng: () => number
): Array<{ tick: number; views: number }> {
  // Step 1: Remove equal adjacent values and duplicate values > 2
  for (let pass = 0; pass < 50; pass++) {
    let hasIssue = false;
    const valCounts: Record<number, number> = {};
    for (const r of rows) {
      valCounts[r.views] = (valCounts[r.views] || 0) + 1;
    }

    for (let i = 0; i < rows.length; i++) {
      if (i > 0 && rows[i].views === rows[i - 1].views) {
        hasIssue = true;
        const delta = [-5, -3, 3, 5][randInt(rng, 0, 3)];
        if (rows[i].views + delta >= 100 && rows[i].views + delta <= CAP) {
          rows[i].views += delta;
        }
      }

      if ((valCounts[rows[i].views] || 0) > 2 && i > 1 && i < rows.length - 1) {
        hasIssue = true;
        const delta = [-7, -4, 4, 7][randInt(rng, 0, 3)];
        if (rows[i].views + delta >= 100 && rows[i].views + delta <= CAP) {
          valCounts[rows[i].views] -= 1;
          rows[i].views += delta;
          valCounts[rows[i].views] = (valCounts[rows[i].views] || 0) + 1;
        }
      }
    }
    if (!hasIssue) break;
  }

  // Step 2: Rebalance difference in steps of 1-7 over interior rows
  let diff = viewsTotal - rows.reduce((s, r) => s + r.views, 0);
  let attempts = 0;
  const interiorIndices = rows.length > 2 ? Array.from({ length: rows.length - 2 }, (_, i) => i + 1) : [0];

  while (diff !== 0 && attempts < 1000) {
    attempts++;
    const idx = interiorIndices[randInt(rng, 0, interiorIndices.length - 1)];
    const step = Math.min(Math.abs(diff), randInt(rng, 1, 7));
    const sign = diff > 0 ? 1 : -1;
    const candidate = rows[idx].views + sign * step;

    if (candidate >= 100 && candidate <= CAP) {
      const prevVal = idx > 0 ? rows[idx - 1].views : -1;
      const nextVal = idx < rows.length - 1 ? rows[idx + 1].views : -1;
      if (candidate !== prevVal && candidate !== nextVal) {
        const count = rows.filter((r) => r.views === candidate).length;
        if (count < 2) {
          rows[idx].views = candidate;
          diff -= sign * step;
        }
      }
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Engagement Distribution Implementation
// ---------------------------------------------------------------------------

function distributeEngagement(
  rows: Array<{ tick: number; views: number }>,
  viewsTotal: number,
  pushTotal: number,
  rates: PlanRates,
  totals: PlanTotals,
  minDefs: ProviderMinimums,
  startDate: Date,
  rng: () => number,
  likeStartRate = 0.025
): PlanRow[] {
  type EngSvc = "likes" | "saves" | "reposts" | "shares" | "comments";
  const services: EngSvc[] = ["likes", "saves", "reposts", "shares", "comments"];

  // Likes rate curve: start at LIKE_START (2.5%) during push,
  // then ramp over first 30% post-push views to plateau R
  const p = pushTotal / viewsTotal;
  const avgLikes = rates.likes;
  const RLikes = (avgLikes - p * likeStartRate - (1 - p) * 0.15 * likeStartRate) / Math.max(0.001, (1 - p) * 0.85);

  const servicePhases: Record<string, number> = {
    saves: randUniform(rng, 0, 2 * Math.PI),
    reposts: randUniform(rng, 0, 2 * Math.PI),
    shares: randUniform(rng, 0, 2 * Math.PI),
    comments: randUniform(rng, 0, 2 * Math.PI),
  };

  // 1. Inflow per service per row
  // inflow = counted_views * rate * lognormal(0, 0.25)
  // counted_views = 0.5 * views_this_row + 0.5 * views_previous_row (last row adds 0.5 * own views)
  const rawInflows: Record<string, number[]> = {
    likes: [],
    saves: [],
    reposts: [],
    shares: [],
    comments: [],
  };

  let cumV = 0;
  for (let i = 0; i < rows.length; i++) {
    const vCurr = rows[i].views;
    const vPrev = i > 0 ? rows[i - 1].views : 0;
    let countedV = 0.5 * vCurr + 0.5 * vPrev;
    if (i === rows.length - 1) {
      countedV += 0.5 * vCurr;
    }
    cumV += vCurr;
    const fViews = cumV / viewsTotal;

    for (const s of services) {
      if (totals[s] === 0) {
        rawInflows[s].push(0.0);
        continue;
      }

      let rS = rates[s];
      if (s === "likes") {
        if (cumV <= pushTotal) {
          rS = likeStartRate;
        } else {
          const fPost = (cumV - pushTotal) / Math.max(1, viewsTotal - pushTotal);
          if (fPost <= 0.30) {
            rS = likeStartRate + (fPost / 0.30) * (RLikes - likeStartRate);
          } else {
            rS = RLikes;
          }
        }
      } else {
        rS = rates[s] * (1.0 + 0.2 * Math.sin(2.0 * Math.PI * fViews + servicePhases[s]));
      }

      const noise = Math.exp(randGauss(rng, 0, 0.25));
      rawInflows[s].push(countedV * rS * noise);
    }
  }

  // Scale inflows so each service sums to total_X exactly
  const scaledInflows: Record<string, number[]> = {
    likes: [],
    saves: [],
    reposts: [],
    shares: [],
    comments: [],
  };

  for (const s of services) {
    const tot = totals[s];
    if (tot === 0) {
      scaledInflows[s] = new Array(rows.length).fill(0.0);
    } else {
      const sumRaw = rawInflows[s].reduce((a, b) => a + b, 0);
      const factor = sumRaw > 0 ? tot / sumRaw : 1.0;
      scaledInflows[s] = rawInflows[s].map((v) => v * factor);
    }
  }

  // 2. Services with total_X < 3 * mn:
  // schedule floor(total_X / mn) releases at ~25%, 55%, 85% of views (a single release at 40-60%)
  const smallScheduled: Record<string, Record<number, number>> = {
    likes: {},
    saves: {},
    reposts: {},
    shares: {},
    comments: {},
  };

  for (const s of services) {
    const tot = totals[s];
    const mn = minDefs[s];
    const batchMn = s === "comments" ? 2 : mn;

    if (tot > 0 && tot < 3 * batchMn) {
      const numRel = Math.max(1, Math.floor(tot / batchMn));
      let targetFracs: number[];
      if (numRel === 1) {
        targetFracs = [randUniform(rng, 0.40, 0.60)];
      } else if (numRel === 2) {
        targetFracs = [randUniform(rng, 0.25, 0.35), randUniform(rng, 0.65, 0.75)];
      } else {
        targetFracs = [
          randUniform(rng, 0.21, 0.29),
          randUniform(rng, 0.51, 0.59),
          randUniform(rng, 0.81, 0.85),
        ];
      }

      let cv = 0;
      const chosenRows: number[] = [];
      for (let idx = 0; idx < rows.length; idx++) {
        cv += rows[idx].views;
        const frac = cv / viewsTotal;
        if (targetFracs.length > 0 && frac >= targetFracs[0]) {
          chosenRows.push(idx);
          targetFracs.shift();
        }
      }
      while (chosenRows.length < numRel) {
        chosenRows.push(Math.min(rows.length - 2, Math.floor(rows.length / 2)));
      }

      let remTot = tot;
      const parts: number[] = [];
      for (let relI = 0; relI < numRel - 1; relI++) {
        const pVal = batchMn + randInt(rng, 0, Math.max(0, Math.floor((remTot - (numRel - relI) * batchMn) / 2)));
        parts.push(pVal);
        remTot -= pVal;
      }
      parts.push(remTot);

      for (let i = 0; i < chosenRows.length; i++) {
        smallScheduled[s][chosenRows[i]] = parts[i];
      }
    }
  }

  // 3. Buffer and release gate loop
  const buffers: Record<string, number> = {
    likes: 0.0,
    saves: 0.0,
    reposts: 0.0,
    shares: 0.0,
    comments: 0.0,
  };

  const servicePrevRelease: Record<string, number | null> = {
    likes: null,
    saves: null,
    reposts: null,
    shares: null,
    comments: null,
  };

  const serviceValCounts: Record<string, Record<number, number>> = {
    likes: {},
    saves: {},
    reposts: {},
    shares: {},
    comments: {},
  };

  let prevCombo: string | null = null;
  let comboRepeatCount = 0;

  const planRows: PlanRow[] = [];
  let cumViews = 0;
  let cumLikes = 0;
  let cumSaves = 0;
  let cumReposts = 0;
  let cumShares = 0;
  let cumComments = 0;

  for (let i = 0; i < rows.length; i++) {
    const vCurr = rows[i].views;
    const tick = rows[i].tick;
    const isLastRow = i === rows.length - 1;
    const minuteOffset = tick * 15;
    const clockTime = getClockTimeBD(startDate, minuteOffset);

    const releasedInRow: Record<string, number> = {
      likes: 0,
      saves: 0,
      reposts: 0,
      shares: 0,
      comments: 0,
    };

    const rowServices: string[] = [];

    for (const s of services) {
      const tot = totals[s];
      if (tot === 0) continue;

      const mn = minDefs[s];
      const batchMn = s === "comments" ? 2 : mn;

      // Small service handled separately
      if (tot < 3 * batchMn) {
        if (smallScheduled[s][i] !== undefined) {
          releasedInRow[s] = smallScheduled[s][i];
          rowServices.push(s);
        }
        continue;
      }

      buffers[s] += scaledInflows[s][i];

      // Gate probability: row views < 200 -> 0.25, 200-349 -> 0.55, 350+ -> 0.85
      let gateP = 0.85;
      if (vCurr < 200) gateP = 0.25;
      else if (vCurr < 350) gateP = 0.55;

      const gatePasses = rng() < gateP;
      const shouldRelease =
        buffers[s] >= batchMn && (buffers[s] >= 1.6 * batchMn || gatePasses);

      if (shouldRelease && !isLastRow) {
        let relSize = Math.max(batchMn, Math.round(buffers[s] * randUniform(rng, 0.80, 1.00)));
        relSize = Math.min(Math.floor(buffers[s]), relSize);

        // Variety: no repeated release size in consecutive releases (comments exempt)
        const maxRepeats = Math.max(2, Math.ceil(0.15 * Math.max(10, Math.floor(tot / batchMn))));
        if (s !== "comments" && relSize === servicePrevRelease[s]) {
          relSize += [1, 2, 3, 4, 5, 6][randInt(rng, 0, 5)];
        }
        if ((serviceValCounts[s][relSize] || 0) >= maxRepeats) {
          relSize += [1, 2, 3, 4, 5, 6][randInt(rng, 0, 5)];
        }

        if (relSize >= batchMn && relSize <= Math.floor(buffers[s])) {
          releasedInRow[s] = relSize;
          buffers[s] -= relSize;
          servicePrevRelease[s] = relSize;
          serviceValCounts[s][relSize] = (serviceValCounts[s][relSize] || 0) + 1;
          rowServices.push(s);
        }
      }
    }

    // Combo repeat rule: same combination of services in at most 2 rows in a row
    const comboKey = rowServices.slice().sort().join(",");
    if (comboKey === prevCombo) {
      comboRepeatCount++;
      if (comboRepeatCount >= 2) {
        if (rowServices.length === 0) {
          // Force one ready service to release
          for (const s of services) {
            const mn = minDefs[s];
            const batchMn = s === "comments" ? 2 : mn;
            if (totals[s] >= 3 * batchMn && buffers[s] >= batchMn && !isLastRow) {
              releasedInRow[s] = batchMn;
              buffers[s] -= batchMn;
              rowServices.push(s);
              break;
            }
          }
        } else if (rowServices.length > 1) {
          // Drop one non-forced release
          const dropS = rowServices.pop()!;
          buffers[dropS] += releasedInRow[dropS];
          releasedInRow[dropS] = 0;
        }
        comboRepeatCount = 0;
      }
    } else {
      prevCombo = comboKey;
      comboRepeatCount = 0;
    }

    cumViews += vCurr;
    cumLikes += releasedInRow.likes;
    cumSaves += releasedInRow.saves;
    cumReposts += releasedInRow.reposts;
    cumShares += releasedInRow.shares;
    cumComments += releasedInRow.comments;

    planRows.push({
      index: i,
      tick,
      minuteOffset,
      clockTime,
      views: vCurr,
      likes: releasedInRow.likes,
      saves: releasedInRow.saves,
      reposts: releasedInRow.reposts,
      shares: releasedInRow.shares,
      comments: releasedInRow.comments,
      cumulativeViews: cumViews,
      cumulativeLikes: cumLikes,
      cumulativeSaves: cumSaves,
      cumulativeReposts: cumReposts,
      cumulativeShares: cumShares,
      cumulativeComments: cumComments,
    });
  }

  // 4. Last row tops up each service to its exact total
  for (const s of services) {
    const tot = totals[s];
    if (tot === 0) continue;

    const mn = minDefs[s];
    const batchMn = s === "comments" ? 2 : mn;
    let deliveredS = planRows.reduce((sum, r) => sum + (r[s] as number), 0);
    let remS = tot - deliveredS;

    if (remS > 0) {
      if (remS >= batchMn) {
        planRows[planRows.length - 1][s] += remS;
      } else {
        // Merge into the latest release
        for (let rIdx = planRows.length - 2; rIdx >= 0; rIdx--) {
          if ((planRows[rIdx][s] as number) > 0) {
            planRows[rIdx][s] += remS;
            remS = 0;
            break;
          }
        }
        if (remS > 0) {
          planRows[planRows.length - 1][s] += remS;
        }
      }
    }
  }

  // Re-accumulate cumulative engagement values to be 100% exact through all rows
  let runningLikes = 0;
  let runningSaves = 0;
  let runningReposts = 0;
  let runningShares = 0;
  let runningComments = 0;

  for (let i = 0; i < planRows.length; i++) {
    runningLikes += planRows[i].likes;
    runningSaves += planRows[i].saves;
    runningReposts += planRows[i].reposts;
    runningShares += planRows[i].shares;
    runningComments += planRows[i].comments;

    planRows[i].cumulativeLikes = runningLikes;
    planRows[i].cumulativeSaves = runningSaves;
    planRows[i].cumulativeReposts = runningReposts;
    planRows[i].cumulativeShares = runningShares;
    planRows[i].cumulativeComments = runningComments;
  }

  return planRows;
}

// ---------------------------------------------------------------------------
// Final Plan Validator (All 10 Rules)
// ---------------------------------------------------------------------------

export function validatePlan(
  plan: PlanObject,
  pkg: PackageConfig,
  minDefs: ProviderMinimums = DEFAULT_PROVIDER_MINIMUMS
): { valid: boolean; error?: string } {
  const { viewsTotal, rows, durationHours, CAP, totals } = plan;

  // 1. Totals exact for views and every service
  const sumViews = rows.reduce((s, r) => s + r.views, 0);
  if (sumViews !== viewsTotal) {
    return { valid: false, error: `Views total mismatch: ${sumViews} != ${viewsTotal}` };
  }

  for (const s of ["likes", "saves", "reposts", "shares", "comments"] as const) {
    const sumS = rows.reduce((sum, r) => sum + r[s], 0);
    if (sumS !== totals[s]) {
      return { valid: false, error: `${s} total mismatch: ${sumS} != ${totals[s]}` };
    }
  }

  // 2. Each realized rate inside its range
  for (const s of ["likes", "saves", "reposts", "comments", "shares"] as const) {
    if (totals[s] > 0) {
      const realRate = totals[s] / viewsTotal;
      const [rMin, rMax] = DEFAULT_RATE_RANGES[s];
      if (realRate < rMin - 0.001 || realRate > rMax + 0.001) {
        return { valid: false, error: `Rate ${s} (${realRate.toFixed(4)}) out of range [${rMin}, ${rMax}]` };
      }
    }
  }

  // 3. Every batch views >= 100 and <= CAP (post-push rows <= CAP, push rows <= push_range[1])
  const pushMax = (pkg.push_range && pkg.push_range[1]) || (pkg.base_views && pkg.base_views <= 2000 ? 700 : 500);
  for (let i = 0; i < rows.length; i++) {
    const limit = i < 2 ? pushMax : CAP;
    if (rows[i].views < 100 || rows[i].views > limit) {
      return { valid: false, error: `Batch #${i} views ${rows[i].views} out of bounds [100, ${limit}]` };
    }
  }

  // 4. No engagement-only rows
  for (const r of rows) {
    if (r.views <= 0) {
      return { valid: false, error: "Engagement-only row found" };
    }
  }

  // 5. No equal adjacent view batches
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].views === rows[i - 1].views) {
      return { valid: false, error: `Equal adjacent view batches: ${rows[i].views} at row #${i}` };
    }
  }

  // 6. No release below provider minimum
  for (const r of rows) {
    for (const s of ["likes", "saves", "reposts", "shares", "comments"] as const) {
      if (r[s] > 0 && r[s] < minDefs[s]) {
        return { valid: false, error: `Release for ${s} (${r[s]}) below provider minimum (${minDefs[s]})` };
      }
    }
  }

  // 7. No gap over 4 hours (16 ticks)
  for (let i = 1; i < rows.length; i++) {
    const gapTicks = rows[i].tick - rows[i - 1].tick;
    if (gapTicks > 16) {
      return { valid: false, error: `Gap of ${gapTicks} ticks (> 16 ticks / 4h) between row #${i - 1} and #${i}` };
    }
  }

  // 8. All times on grid and strictly increasing
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].tick < 0) {
      return { valid: false, error: "Negative tick found" };
    }
    if (i > 0 && rows[i].tick <= rows[i - 1].tick) {
      return { valid: false, error: `Ticks not strictly increasing at row #${i}` };
    }
  }

  // 9. Same service combination in at most 2 rows in a row
  let prevCombo: string | null = null;
  let rep = 0;
  for (const r of rows) {
    const combo = (["views", "likes", "saves", "reposts", "shares", "comments"] as const)
      .filter((s) => r[s] > 0)
      .sort()
      .join(",");
    if (combo === prevCombo) {
      rep++;
      if (rep > 2) {
        return { valid: false, error: `Same service combination repeated ${rep} times in a row` };
      }
    } else {
      prevCombo = combo;
      rep = 0;
    }
  }

  // 10. Peak window rate <= 3x average rate, window = max(1 hour, duration / 8)
  const winHours = Math.max(1.0, durationHours / 8.0);
  const winTicks = Math.round(winHours * 4);
  const avgHourlyRate = viewsTotal / durationHours;

  for (let i = 0; i < rows.length; i++) {
    const startTick = rows[i].tick;
    const endTick = startTick + winTicks;
    const winViews = rows
      .filter((r) => r.tick >= startTick && r.tick <= endTick)
      .reduce((sum, r) => sum + r.views, 0);
    const winRate = winViews / winHours;
    if (winRate > 3.0 * avgHourlyRate + 1.0) {
      return { valid: false, error: `Peak window rate (${winRate.toFixed(1)}) > 3x average (${avgHourlyRate.toFixed(1)})` };
    }
  }

  return { valid: true };
}

export const validateSchedule = validatePlan;

// ---------------------------------------------------------------------------
// Main Public Function: generatePlan (with Seed Retry Loop)
// ---------------------------------------------------------------------------

export function generatePlan(
  packageConfig: PackageConfig,
  followers: number = 1000,
  seed: string | number = "aurasmm_seed",
  optionsOrMin?: PlanOptions | ProviderMinimums,
  legacyStartDate?: Date
): PlanObject {
  let options: PlanOptions | undefined;
  if (optionsOrMin && "views" in optionsOrMin && typeof (optionsOrMin as any).views === "number") {
    options = {
      providerMinimums: optionsOrMin as ProviderMinimums,
      startDate: legacyStartDate,
    };
  } else {
    options = optionsOrMin as PlanOptions | undefined;
  }

  let seedNum: number;
  if (typeof seed === "number") {
    seedNum = seed;
  } else {
    // Generate deterministic 32-bit integer from string
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    }
    seedNum = h >>> 0;
  }

  let lastError = "Validation failed";
  for (let attempt = 0; attempt < 50; attempt++) {
    const currentSeedNum = (seedNum + attempt) >>> 0;
    const rng = createRng(currentSeedNum);
    const plan = generateSingleAttempt(packageConfig, followers, rng, options);
    plan.seed = attempt === 0 ? String(seed) : `${seed}_${attempt}`;
    plan.patternId = `Pattern #${plan.seed.slice(0, 8)}`;

    const check = validatePlan(plan, packageConfig, options?.providerMinimums);
    if (check.valid) {
      return plan;
    }
    lastError = check.error || lastError;
  }

  throw new Error(`Failed to generate a valid organic plan after 50 attempts: ${lastError}`);
}

export const generatePattern = generatePlan;

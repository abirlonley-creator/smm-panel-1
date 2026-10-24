/**
 * Organic Full Engagement Plan Generator
 * 
 * Generates mathematically sound, realistic S-curve delivery schedules
 * for views, likes, shares, saves, and comments.
 * Shared directly between the frontend live preview and backend order processor.
 */

export type EngagementType = "views" | "likes" | "shares" | "saves" | "comments";

export interface ServiceSpec {
  id?: string;
  providerId?: string;
  name: string;
  minQuantity: number;
  maxQuantity: number;
  ratePer1000: number;
}

export interface PlannedRun {
  engagementType: EngagementType;
  runIndex: number;
  scheduledAt: string; // ISO string
  minutesFromStart: number;
  quantity: number;
  cumulativeQuantity: number;
  cost: number;
  serviceId?: string;
  providerId?: string;
}

export interface TypeDeliveryPlan {
  engagementType: EngagementType;
  totalQuantity: number;
  runsCount: number;
  serviceName: string;
  minQuantity: number;
  maxQuantity: number;
  ratePer1000: number;
  totalCost: number;
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

export interface OrganicPlanResult {
  seed: string;
  platform: "Instagram" | "TikTok";
  baseViews: number;
  durationHours: number;
  totalCost: number;
  plans: Record<EngagementType, TypeDeliveryPlan>;
  allRuns: PlannedRun[];
  curvePoints: CurvePoint[];
}

export interface PlanOptions {
  platform: "Instagram" | "TikTok";
  baseViews: number;
  durationHours?: number;
  seed?: string;
  startTime?: Date;
  peakHourWeighting?: boolean;
  services?: Partial<Record<EngagementType, ServiceSpec>>;
  customRatios?: Partial<Record<EngagementType, number>>;
}

/**
 * 32-bit Mulberry32 PRNG for deterministic, reproducible random sequences.
 */
export function createMulberry32(seedStr: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let s = h >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Default fallback service specs when database specs are not supplied.
 */
export const DEFAULT_SERVICE_SPECS: Record<"Instagram" | "TikTok", Record<EngagementType, ServiceSpec>> = {
  Instagram: {
    views: { name: "Instagram Real Views — Organic Pace", minQuantity: 100, maxQuantity: 5000000, ratePer1000: 0.15 },
    likes: { name: "Instagram HQ Natural Likes", minQuantity: 20, maxQuantity: 250000, ratePer1000: 0.85 },
    shares: { name: "Instagram Real Post Shares", minQuantity: 10, maxQuantity: 50000, ratePer1000: 2.10 },
    saves: { name: "Instagram Post Saves & Bookmarks", minQuantity: 10, maxQuantity: 100000, ratePer1000: 1.40 },
    comments: { name: "Instagram Verified English Comments", minQuantity: 5, maxQuantity: 2500, ratePer1000: 8.50 },
  },
  TikTok: {
    views: { name: "TikTok High Retention For You Views", minQuantity: 200, maxQuantity: 10000000, ratePer1000: 0.18 },
    likes: { name: "TikTok Feed Boost Likes", minQuantity: 20, maxQuantity: 500000, ratePer1000: 0.95 },
    shares: { name: "TikTok Viral Post Shares", minQuantity: 15, maxQuantity: 100000, ratePer1000: 1.80 },
    saves: { name: "TikTok Favorites & Saves", minQuantity: 10, maxQuantity: 150000, ratePer1000: 1.25 },
    comments: { name: "TikTok Relevant Engaging Comments", minQuantity: 5, maxQuantity: 3000, ratePer1000: 9.00 },
  },
};

/**
 * Baseline default engagement ratios relative to base views.
 */
export const DEFAULT_ENGAGEMENT_RATIOS: Record<EngagementType, number> = {
  views: 1.0,
  likes: 0.06,     // 6% of views
  shares: 0.02,    // 2% of views
  saves: 0.015,    // 1.5% of views
  comments: 0.004, // 0.4% of views
};

/**
 * Quintic smoothstep S-curve function: 6t^5 - 15t^4 + 10t^3.
 * Creates exceptionally smooth organic acceleration and deceleration.
 */
function quinticSmoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/**
 * Generates an organic delivery plan.
 */
export function generateOrganicPlan(options: PlanOptions): OrganicPlanResult {
  const platform = options.platform;
  const baseViews = Math.max(100, Math.round(options.baseViews));
  const durationHours = Math.max(1, Math.min(168, options.durationHours || 24));
  const durationMinutes = durationHours * 60;
  const seed = options.seed || `dhansmm_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const rng = createMulberry32(seed);
  const start = options.startTime ? new Date(options.startTime) : new Date();

  const services: Record<EngagementType, ServiceSpec> = {
    views: options.services?.views || DEFAULT_SERVICE_SPECS[platform].views,
    likes: options.services?.likes || DEFAULT_SERVICE_SPECS[platform].likes,
    shares: options.services?.shares || DEFAULT_SERVICE_SPECS[platform].shares,
    saves: options.services?.saves || DEFAULT_SERVICE_SPECS[platform].saves,
    comments: options.services?.comments || DEFAULT_SERVICE_SPECS[platform].comments,
  };

  const types: EngagementType[] = ["views", "likes", "shares", "saves", "comments"];

  // 1. Compute totals per type respecting ratios and ±25% seeded variance
  const totals: Record<EngagementType, number> = {
    views: baseViews,
    likes: 0,
    shares: 0,
    saves: 0,
    comments: 0,
  };

  for (const t of types) {
    if (t === "views") continue;
    const baseRatio = options.customRatios?.[t] ?? DEFAULT_ENGAGEMENT_RATIOS[t];
    // Seeded random variance ±25%: [0.75, 1.25]
    const varianceFactor = 0.75 + rng() * 0.5;
    let targetQty = Math.round(baseViews * baseRatio * varianceFactor);

    const s = services[t];
    // Clamp to min and max boundaries
    targetQty = Math.max(s.minQuantity, Math.min(s.maxQuantity, targetQty));
    totals[t] = targetQty;
  }

  // Target run counts per type (nominal targets for standard pacing)
  const nominalRunCounts: Record<EngagementType, number> = {
    views: Math.min(24, Math.max(6, Math.round(durationHours * 0.8))),
    likes: Math.min(18, Math.max(4, Math.round(durationHours * 0.6))),
    shares: Math.min(12, Math.max(3, Math.round(durationHours * 0.4))),
    saves: Math.min(12, Math.max(3, Math.round(durationHours * 0.4))),
    comments: Math.min(8, Math.max(2, Math.round(durationHours * 0.25))),
  };

  const plans: Record<EngagementType, TypeDeliveryPlan> = {} as any;
  const allRuns: PlannedRun[] = [];

  for (const t of types) {
    const totalQty = totals[t];
    const s = services[t];
    let runCount = nominalRunCounts[t];

    // HARD RULE: If totalQty is too small for planned run count, reduce run count
    if (totalQty / s.minQuantity < runCount) {
      runCount = Math.max(1, Math.floor(totalQty / s.minQuantity));
    }

    // Generate non-linear cumulative S-curve points
    // Batches vary in size, with small random noise, bursts, and pauses
    const rawBatches: { minute: number; qty: number }[] = [];

    // Distribute timestamps across duration with realistic non-uniform intervals
    const timestamps: number[] = [];
    for (let i = 0; i < runCount; i++) {
      const normalizedTime = (i + 0.5 + (rng() * 0.4 - 0.2)) / runCount;
      const clampedT = Math.max(0.02, Math.min(0.98, normalizedTime));
      timestamps.push(Math.round(clampedT * durationMinutes));
    }
    timestamps.sort((a, b) => a - b);

    // Compute S-curve weights
    const weights: number[] = [];
    for (let i = 0; i < runCount; i++) {
      const tNorm = timestamps[i] / durationMinutes;
      // S-curve cumulative at tNorm
      const sCurve = quinticSmoothstep(tNorm);
      // Small random noise: ±15%
      const noise = 0.85 + rng() * 0.3;
      // Occasional burst or pause
      const eventChance = rng();
      let burstMod = 1.0;
      if (eventChance > 0.85) {
        burstMod = 1.35; // Short burst
      } else if (eventChance < 0.12 && i > 0 && i < runCount - 1) {
        burstMod = 0.45; // Short pause/slowdown
      }

      // Peak hour weighting (simulated evening peak if enabled)
      let peakMod = 1.0;
      if (options.peakHourWeighting) {
        // e.g. midpoint peak
        const distFromMid = Math.abs(tNorm - 0.5);
        peakMod = 1.0 + (0.5 - distFromMid) * 0.4;
      }

      weights.push(Math.max(0.1, (sCurve + 0.1) * noise * burstMod * peakMod));
    }

    const totalWeight = weights.reduce((acc, w) => acc + w, 0);

    // Initial allocation
    let allocated = 0;
    const initialBatches: { minute: number; qty: number }[] = [];
    for (let i = 0; i < runCount; i++) {
      let bQty = Math.round((weights[i] / totalWeight) * totalQty);
      initialBatches.push({ minute: timestamps[i], qty: bQty });
      allocated += bQty;
    }

    // Adjust discrepancy on middle batches before min-check
    let diff = totalQty - allocated;
    if (diff !== 0 && initialBatches.length > 0) {
      initialBatches[initialBatches.length - 1].qty += diff;
    }

    // HARD RULE: No batch may be below s.minQuantity!
    // Merge sub-minimum batches with neighbors
    const finalBatches: { minute: number; qty: number }[] = [];
    for (let i = 0; i < initialBatches.length; i++) {
      const current = initialBatches[i];
      if (current.qty < s.minQuantity) {
        if (finalBatches.length > 0) {
          // Merge with previous
          finalBatches[finalBatches.length - 1].qty += current.qty;
        } else if (i + 1 < initialBatches.length) {
          // Merge forward into next
          initialBatches[i + 1].qty += current.qty;
        } else {
          // Only 1 batch total, clamp to totalQty
          finalBatches.push({ minute: current.minute, qty: totalQty });
        }
      } else {
        finalBatches.push(current);
      }
    }

    // Final sum adjustment: last batch must make total exactly match ordered quantity
    let currentSum = finalBatches.reduce((acc, b) => acc + b.qty, 0);
    let finalDiff = totalQty - currentSum;
    if (finalDiff !== 0 && finalBatches.length > 0) {
      const lastIdx = finalBatches.length - 1;
      finalBatches[lastIdx].qty += finalDiff;

      // If last batch dropped below minimum due to adjustment, merge with preceding
      if (finalBatches[lastIdx].qty < s.minQuantity && finalBatches.length > 1) {
        finalBatches[lastIdx - 1].qty += finalBatches[lastIdx].qty;
        finalBatches.pop();
      }
    }

    // Build runs list
    let cumulative = 0;
    const runs: PlannedRun[] = finalBatches.map((b, idx) => {
      cumulative += b.qty;
      const scheduledTime = new Date(start.getTime() + b.minute * 60000);
      const runCost = Number(((b.qty / 1000) * s.ratePer1000).toFixed(4));
      return {
        engagementType: t,
        runIndex: idx + 1,
        scheduledAt: scheduledTime.toISOString(),
        minutesFromStart: b.minute,
        quantity: b.qty,
        cumulativeQuantity: cumulative,
        cost: runCost,
        serviceId: s.id,
        providerId: s.providerId,
      };
    });

    const typeTotalCost = Number(((totalQty / 1000) * s.ratePer1000).toFixed(4));

    plans[t] = {
      engagementType: t,
      totalQuantity: totalQty,
      runsCount: runs.length,
      serviceName: s.name,
      minQuantity: s.minQuantity,
      maxQuantity: s.maxQuantity,
      ratePer1000: s.ratePer1000,
      totalCost: typeTotalCost,
      runs,
    };

    allRuns.push(...runs);
  }

  // Sort all runs chronologically
  allRuns.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  // 2. Generate smooth curve visualization points (30 evenly spaced time points)
  const curvePoints: CurvePoint[] = [];
  const sampleSteps = 30;
  for (let s = 0; s <= sampleSteps; s++) {
    const mins = Math.round((s / sampleSteps) * durationMinutes);
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    const timeLabel = `+${hrs}h${m > 0 ? ` ${m}m` : ""}`;

    const pt: CurvePoint = {
      minutes: mins,
      timeLabel,
      views: 0,
      likes: 0,
      shares: 0,
      saves: 0,
      comments: 0,
    };

    for (const t of types) {
      const typeRuns = plans[t].runs;
      let cumAtMin = 0;
      for (const r of typeRuns) {
        if (r.minutesFromStart <= mins) {
          cumAtMin = r.cumulativeQuantity;
        } else {
          break;
        }
      }
      pt[t] = cumAtMin;
    }

    curvePoints.push(pt);
  }

  const overallCost = Number(
    (plans.views.totalCost +
      plans.likes.totalCost +
      plans.shares.totalCost +
      plans.saves.totalCost +
      plans.comments.totalCost).toFixed(2)
  );

  return {
    seed,
    platform,
    baseViews,
    durationHours,
    totalCost: overallCost,
    plans,
    allRuns,
    curvePoints,
  };
}

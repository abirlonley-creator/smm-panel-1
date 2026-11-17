/**
 * Organic Anti-Radar Pattern Generator for TikTok/Instagram Growth
 * Simulates genuine organic platform recommendation feeds with named archetypes,
 * micro-bursts, realistic pauses, and views-proportional engagement milestones.
 */

import {
  solveKeConservationEquation,
  antiBotDesaturateQuantity,
  PROVIDER_MINIMUMS,
} from "./organic-pacing-engine";

export interface PatternArchetype {
  id: string;
  name: string;
  tagline: string;
  steepness: number; // Sigmoid steepness (strictly 4.0 - 5.8 to prevent spikes)
  midpoint: number;  // Shift midpoint (0.38 - 0.52)
  jitterRange: number; // Micro-variation (0.05 - 0.12)
  pauseWeight: number; // Probability of slightly elongated cluster pauses
}

export const PATTERN_ARCHETYPES: PatternArchetype[] = [
  {
    id: "sunrise-curve",
    name: "sunrise-curve",
    tagline: "Gentle dawn ramp-up with steady daytime acceleration and warm plateau",
    steepness: 4.8,
    midpoint: 0.46,
    jitterRange: 0.08,
    pauseWeight: 0.18,
  },
  {
    id: "viral-surge",
    name: "viral-surge",
    tagline: "Natural algorithmic discovery wave leading to sustained exponential ascent",
    steepness: 5.4,
    midpoint: 0.42,
    jitterRange: 0.09,
    pauseWeight: 0.15,
  },
  {
    id: "steady-climb",
    name: "steady-climb",
    tagline: "Continuous balanced human viewing pace with organic non-harmonic micro-ripples",
    steepness: 4.4,
    midpoint: 0.50,
    jitterRange: 0.07,
    pauseWeight: 0.20,
  },
  {
    id: "evening-momentum",
    name: "evening-momentum",
    tagline: "Prime-time viewing concentration (18–22h) with natural late-night taper",
    steepness: 5.1,
    midpoint: 0.48,
    jitterRange: 0.10,
    pauseWeight: 0.16,
  },
  {
    id: "stealth-whisper",
    name: "stealth-whisper",
    tagline: "Ultra-cautious micro-trickle delivery with zero algorithmic radar footprint",
    steepness: 4.2,
    midpoint: 0.52,
    jitterRange: 0.06,
    pauseWeight: 0.22,
  },
  {
    id: "biological-fyp",
    name: "biological-fyp",
    tagline: "Authentic TikTok recommendation feed simulation modeling human discovery",
    steepness: 5.2,
    midpoint: 0.45,
    jitterRange: 0.08,
    pauseWeight: 0.17,
  },
  {
    id: "golden-hour",
    name: "golden-hour",
    tagline: "Late afternoon momentum wave peaking at peak evening social media hours",
    steepness: 5.0,
    midpoint: 0.47,
    jitterRange: 0.09,
    pauseWeight: 0.19,
  },
  {
    id: "cascade-growth",
    name: "cascade-growth",
    tagline: "Multi-phase stepped expansion mimicking viral reposts and direct shares",
    steepness: 4.9,
    midpoint: 0.44,
    jitterRange: 0.11,
    pauseWeight: 0.14,
  },
  {
    id: "ocean-swell",
    name: "ocean-swell",
    tagline: "Rolling organic momentum waves with zero periodic harmonic frequencies",
    steepness: 4.6,
    midpoint: 0.49,
    jitterRange: 0.08,
    pauseWeight: 0.18,
  },
  {
    id: "fyp-breakthrough",
    name: "fyp-breakthrough",
    tagline: "Seed pool escape test transitioning smoothly into viral algorithmic push",
    steepness: 5.3,
    midpoint: 0.41,
    jitterRange: 0.10,
    pauseWeight: 0.15,
  },
  {
    id: "phantom-trickle",
    name: "phantom-trickle",
    tagline: "High-frequency micro-batches under 180 views with frequent natural pauses",
    steepness: 4.3,
    midpoint: 0.51,
    jitterRange: 0.07,
    pauseWeight: 0.24,
  },
  {
    id: "prime-velocity",
    name: "prime-velocity",
    tagline: "Prime evening FYP surge balanced by steady daytime baseline activity",
    steepness: 5.2,
    midpoint: 0.46,
    jitterRange: 0.09,
    pauseWeight: 0.16,
  },
  {
    id: "organic-drift",
    name: "organic-drift",
    tagline: "Dynamic human browsing cadence with strict anti-spike consecutive clamping",
    steepness: 4.5,
    midpoint: 0.48,
    jitterRange: 0.08,
    pauseWeight: 0.18,
  },
  {
    id: "cautious-ascent",
    name: "cautious-ascent",
    tagline: "Conservative organic trajectory with extended soft asymptotic tail decay",
    steepness: 4.1,
    midpoint: 0.53,
    jitterRange: 0.06,
    pauseWeight: 0.21,
  },
  {
    id: "midnight-drift",
    name: "midnight-drift",
    tagline: "Quiet late-night momentum building organically into daytime engagement",
    steepness: 4.7,
    midpoint: 0.45,
    jitterRange: 0.09,
    pauseWeight: 0.20,
  },
  {
    id: "custom",
    name: "custom",
    tagline: "Fine-tuned organic delivery curve tailored to unique video dynamics",
    steepness: 5.0,
    midpoint: 0.45,
    jitterRange: 0.08,
    pauseWeight: 0.18,
  },
];

export interface PatternMeta {
  templateId: number;
  id: string;
  name: string;
  fullName: string;
  tagline: string;
}

/**
 * Deterministically maps any template ID (1..550+) to a named pattern archetype
 */
export function getPatternMeta(templateId: number): PatternMeta {
  const cleanId = Math.max(1, Math.min(999, Math.round(templateId || 335)));

  // Preserve exact mappings for canonical templates shown in radar screenshots
  if (cleanId === 335) {
    const sunrise = PATTERN_ARCHETYPES.find((a) => a.id === "sunrise-curve") || PATTERN_ARCHETYPES[0];
    return {
      templateId: 335,
      id: sunrise.id,
      name: sunrise.name,
      fullName: `#335 • ${sunrise.name}`,
      tagline: sunrise.tagline,
    };
  }

  if (cleanId === 224) {
    const custom = PATTERN_ARCHETYPES.find((a) => a.id === "custom") || PATTERN_ARCHETYPES[0];
    return {
      templateId: 224,
      id: custom.id,
      name: "Custom",
      fullName: "#224 • Custom",
      tagline: custom.tagline,
    };
  }

  const archetypeIdx = (cleanId * 13 + 5) % PATTERN_ARCHETYPES.length;
  const archetype = PATTERN_ARCHETYPES[archetypeIdx];

  return {
    templateId: cleanId,
    id: archetype.id,
    name: archetype.name,
    fullName: `#${cleanId} • ${archetype.name}`,
    tagline: archetype.tagline,
  };
}

export interface GeneratedSchedulePlan {
  templateId: number;
  patternMeta: PatternMeta;
  targetViews: number;
  durationHours: number;
  totalDurationMinutes: number;
  runsCount: number;
  avgIntervalMinutes: number;
  views: number[];
  viewOffsets: number[];
  likes: number[];
  likeOffsets: number[];
  saves: number[];
  saveOffsets: number[];
  shares: number[];
  shareOffsets: number[];
  comments: number[];
  commentOffsets: number[];
  totalViews: number;
  totalLikes: number;
  totalSaves: number;
  totalShares: number;
  totalComments: number;
  totalEngagement: number;
}

/**
 * Deterministic pseudo-random generator seeded by templateId + salt
 */
function seededRandom(seed: number): () => number {
  let s = Math.abs(seed) % 2147483647;
  if (s <= 0) s = 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generates an Anti-Radar Delivery Schedule strictly conforming to the selected Pattern.
 * - S-Curve distribution with zero spikes
 * - Consecutive ratio clamped strictly between 0.70x and 1.50x
 * - Hard batch cap of 400 views maximum
 * - Views-proportional milestone auxiliary engagement
 * - Bursts + pauses micro-stepping
 */
export function generatePatternSchedule(
  templateId: number,
  targetViews: number,
  durationHours: number,
  options: {
    targetLikes?: number;
    targetSaves?: number;
    targetShares?: number;
    targetComments?: number;
    providerMinViews?: number;
  } = {}
): GeneratedSchedulePlan {
  const meta = getPatternMeta(templateId);
  const archetype = PATTERN_ARCHETYPES.find((a) => a.id === meta.id) || PATTERN_ARCHETYPES[0];
  const rand = seededRandom(meta.templateId * 31337 + targetViews);

  const durationMinutes = Math.max(60, Math.round(durationHours * 60));
  const minViews = Math.max(100, options.providerMinViews || PROVIDER_MINIMUMS.views);
  const minLikes = PROVIDER_MINIMUMS.likes; // 10
  const minSaves = PROVIDER_MINIMUMS.saves; // 10
  const minShares = PROVIDER_MINIMUMS.shares; // 10
  const minComments = 1;

  // 1. Determine optimal runs count for micro-batching
  let runsCount: number;
  if (targetViews <= 3500) {
    runsCount = 24; // avg ~123 views, ~15m
  } else if (targetViews <= 8000) {
    runsCount = 42; // avg ~121 views, ~34m
  } else if (targetViews <= 12000) {
    runsCount = 72; // avg ~146 views, ~40m
  } else if (targetViews <= 20000) {
    runsCount = 96; // avg ~158 views, ~45m
  } else {
    // 50K: 240 batches over 5 days (avg ~211 views, max <= 400)
    runsCount = Math.min(260, Math.max(180, Math.round(durationHours * 2.0)));
  }

  // 2. Generate raw weights using Sigmoid S-Curve modulated by archetype
  const k = archetype.steepness + (rand() * 0.4 - 0.2);
  const tMid = archetype.midpoint + (rand() * 0.04 - 0.02);

  const weights: number[] = [];
  for (let i = 0; i < runsCount; i++) {
    const t0 = i / runsCount;
    const t1 = (i + 1) / runsCount;
    const sig0 = 1 / (1 + Math.exp(-k * (t0 - tMid)));
    const sig1 = 1 / (1 + Math.exp(-k * (t1 - tMid)));
    const delta = sig1 - sig0;

    // 75% S-curve shape + 25% uniform baseline
    let w = Math.max(0.2, delta * 0.75 * runsCount + 0.25);

    // Subtle biological variation (±jitterRange)
    w *= 1 + (rand() * 2 - 1) * archetype.jitterRange;
    weights.push(w);
  }

  const sumWeights = weights.reduce((a, b) => a + b, 0) || 1.0;
  let rawQuantities = weights.map((w) => Math.round((w / sumWeights) * targetViews));

  // Stage 1 Seed Pool Test: Batch #1 strictly capped under 180 views
  if (rawQuantities.length > 2 && rawQuantities[0] > 180) {
    const excess = rawQuantities[0] - (minViews + Math.floor(rand() * 25));
    rawQuantities[0] -= excess;
    const midIdx = Math.floor(rawQuantities.length * 0.45);
    rawQuantities[midIdx] += excess;
  }

  // Anti-Spike Consecutive Clamping (0.70x to 1.50x)
  for (let i = 1; i < rawQuantities.length; i++) {
    const prev = rawQuantities[i - 1];
    const maxAllowed = Math.round(prev * 1.50);
    const minAllowed = Math.max(minViews, Math.round(prev * 0.70));
    if (rawQuantities[i] > maxAllowed) {
      const diff = rawQuantities[i] - maxAllowed;
      rawQuantities[i] = maxAllowed;
      if (i + 1 < rawQuantities.length) rawQuantities[i + 1] += diff;
      else if (i > 1) rawQuantities[i - 2] += diff;
    } else if (rawQuantities[i] < minAllowed && rawQuantities[i] >= minViews) {
      rawQuantities[i] = minAllowed;
    }
  }

  // Hard Batch Cap: Strictly <= 400 views per batch
  const maxViewCap = 400;
  for (let i = 0; i < rawQuantities.length; i++) {
    if (rawQuantities[i] > maxViewCap) {
      const excess = rawQuantities[i] - maxViewCap;
      rawQuantities[i] = maxViewCap;
      const spread = Math.min(3, rawQuantities.length - 1 - i);
      if (spread > 0) {
        const per = Math.floor(excess / spread);
        let r = excess;
        for (let j = 1; j <= spread; j++) {
          const a = j === spread ? r : per;
          rawQuantities[i + j] += a;
          r -= a;
        }
      } else if (i > 0) {
        rawQuantities[i - 1] += excess;
      }
    }
  }

  // Solve exact Ke conservation equation with sliding-window uniqueness
  const adjustedRuns = solveKeConservationEquation(
    rawQuantities.map((q) => ({ quantity: q })),
    targetViews,
    minViews,
    maxViewCap
  );
  const views = adjustedRuns.map((r) => r.quantity);

  // Soft tail decay guarantee: last batch < peak batch
  const peakView = Math.max(...views);
  if (views.length >= 4 && views[views.length - 1] >= peakView) {
    const targetTail = Math.max(minViews + 2, Math.round(peakView * 0.65));
    const excess = views[views.length - 1] - targetTail;
    views[views.length - 1] = targetTail;
    const midIdx = Math.floor(views.length * 0.5);
    views[midIdx] += excess;
  }

  // 3. Generate Timestamps & Minute Offsets with Natural Bursts + Pauses
  const viewOffsets: number[] = [0];
  const avgStep = durationMinutes / (views.length - 1);

  for (let i = 1; i < views.length; i++) {
    const idealOffset = i * avgStep;
    // Natural jitter + occasional cluster pause
    const isPause = rand() < archetype.pauseWeight;
    const jitterPercent = isPause ? 0.35 : 0.15;
    const jitter = (rand() * 2 - 1) * avgStep * jitterPercent;
    let offset = Math.round(idealOffset + jitter);
    offset = Math.max(viewOffsets[i - 1] + 5, Math.min(durationMinutes, offset));
    viewOffsets.push(offset);
  }

  // 4. Views-Proportional Auxiliary Engagement Milestones
  const defaultLikes = options.targetLikes || Math.round(targetViews * 0.022); // ~2.2% like ratio
  const defaultSaves = options.targetSaves || Math.round(targetViews * 0.012); // ~1.2% save ratio
  const defaultShares = options.targetShares || Math.round(targetViews * 0.005); // ~0.5% share ratio
  const defaultComments = options.targetComments || (targetViews >= 5000 ? Math.round(targetViews * 0.001) : 0);

  // Cumulative views array
  const cumViews: number[] = [];
  let runningViews = 0;
  for (const v of views) {
    runningViews += v;
    cumViews.push(runningViews);
  }

  // A. LIKES: Every ~1K cumulative views (17–25 likes / 1K)
  const likeOffsets: number[] = [];
  const likesRaw: number[] = [];
  const likeMilestoneGap = Math.max(800, Math.min(2000, Math.round(1000 + (rand() * 300 - 150))));
  let nextLikeMilestone = likeMilestoneGap;

  for (let i = 0; i < views.length; i++) {
    if (cumViews[i] >= nextLikeMilestone && likesRaw.length < Math.floor(defaultLikes / minLikes)) {
      const delay = 15 + Math.floor(rand() * 20); // 15-35m lag after view batch
      const offset = Math.min(durationMinutes - 10, viewOffsets[i] + delay);
      likeOffsets.push(offset);
      likesRaw.push(minLikes + Math.floor(rand() * 14));
      nextLikeMilestone = cumViews[i] + likeMilestoneGap + Math.floor(rand() * 200 - 100);
    }
  }

  if (likesRaw.length === 0) {
    likeOffsets.push(Math.min(durationMinutes - 10, viewOffsets[Math.min(2, views.length - 1)] + 25));
    likesRaw.push(minLikes + Math.floor(rand() * 8));
  }
  likeOffsets.sort((a, b) => a - b);

  const likesAdjusted = solveKeConservationEquation(
    likesRaw.map((q) => ({ quantity: q })),
    Math.max(minLikes * likesRaw.length, defaultLikes),
    minLikes,
    Math.max(minLikes * 4, Math.ceil((defaultLikes / Math.max(1, likesRaw.length)) * 2.5))
  );
  const likes = likesAdjusted.map((r) => r.quantity);

  // B. SAVES: Every ~3K cumulative views (~1.2% ratio)
  const saveOffsets: number[] = [];
  const savesRaw: number[] = [];
  const saveMilestoneGap = Math.max(2000, Math.min(5000, Math.round(3000 + (rand() * 500 - 250))));
  let nextSaveMilestone = saveMilestoneGap;

  for (let i = 0; i < views.length; i++) {
    if (cumViews[i] >= nextSaveMilestone && savesRaw.length < Math.floor(defaultSaves / minSaves)) {
      const delay = 30 + Math.floor(rand() * 35);
      const offset = Math.min(durationMinutes - 15, viewOffsets[i] + delay);
      saveOffsets.push(offset);
      savesRaw.push(minSaves + Math.floor(rand() * 6));
      nextSaveMilestone = cumViews[i] + saveMilestoneGap + Math.floor(rand() * 400 - 200);
    }
  }

  if (savesRaw.length === 0 && defaultSaves >= minSaves) {
    saveOffsets.push(Math.min(durationMinutes - 15, viewOffsets[Math.min(4, views.length - 1)] + 45));
    savesRaw.push(minSaves);
  }
  saveOffsets.sort((a, b) => a - b);

  const savesAdjusted = solveKeConservationEquation(
    savesRaw.map((q) => ({ quantity: q })),
    Math.max(minSaves * savesRaw.length, defaultSaves),
    minSaves,
    Math.max(minSaves * 3, Math.ceil((defaultSaves / Math.max(1, savesRaw.length)) * 2.0))
  );
  const saves = savesAdjusted.map((r) => r.quantity);

  // C. SHARES: Every ~5K cumulative views (~0.5% ratio)
  const shareOffsets: number[] = [];
  const sharesRaw: number[] = [];
  const shareMilestoneGap = Math.max(3000, Math.min(8000, Math.round(5000 + (rand() * 800 - 400))));
  let nextShareMilestone = shareMilestoneGap;

  for (let i = 0; i < views.length; i++) {
    if (cumViews[i] >= nextShareMilestone && sharesRaw.length < Math.floor(defaultShares / minShares)) {
      const delay = 45 + Math.floor(rand() * 45);
      const offset = Math.min(durationMinutes - 20, viewOffsets[i] + delay);
      shareOffsets.push(offset);
      sharesRaw.push(minShares + Math.floor(rand() * 4));
      nextShareMilestone = cumViews[i] + shareMilestoneGap + Math.floor(rand() * 600 - 300);
    }
  }

  if (sharesRaw.length === 0 && defaultShares >= minShares) {
    shareOffsets.push(Math.min(durationMinutes - 20, viewOffsets[Math.min(6, views.length - 1)] + 60));
    sharesRaw.push(minShares);
  }
  shareOffsets.sort((a, b) => a - b);

  const sharesAdjusted = solveKeConservationEquation(
    sharesRaw.map((q) => ({ quantity: q })),
    Math.max(minShares * sharesRaw.length, defaultShares),
    minShares,
    Math.max(minShares * 3, Math.ceil((defaultShares / Math.max(1, sharesRaw.length)) * 2.0))
  );
  const shares = sharesAdjusted.map((r) => r.quantity);

  // D. COMMENTS: Optional organic social proof (~0.1% or defaultComments)
  const commentOffsets: number[] = [];
  const commentsRaw: number[] = [];
  if (defaultComments > 0) {
    const commentWaveCount = Math.max(1, Math.min(10, Math.round(defaultComments / 3)));
    const cStep = durationMinutes / (commentWaveCount + 1);
    for (let c = 0; c < commentWaveCount; c++) {
      commentOffsets.push(Math.round((c + 1) * cStep + (rand() * 20 - 10)));
      commentsRaw.push(Math.max(1, Math.round(defaultComments / commentWaveCount)));
    }
  }
  const comments = commentsRaw;

  const totalViewsCalculated = views.reduce((a, b) => a + b, 0);
  const totalLikesCalculated = likes.reduce((a, b) => a + b, 0);
  const totalSavesCalculated = saves.reduce((a, b) => a + b, 0);
  const totalSharesCalculated = shares.reduce((a, b) => a + b, 0);
  const totalCommentsCalculated = comments.reduce((a, b) => a + b, 0);

  return {
    templateId: meta.templateId,
    patternMeta: meta,
    targetViews,
    durationHours,
    totalDurationMinutes: durationMinutes,
    runsCount: views.length,
    avgIntervalMinutes: Math.round(durationMinutes / Math.max(1, views.length)),
    views,
    viewOffsets,
    likes,
    likeOffsets,
    saves,
    saveOffsets,
    shares,
    shareOffsets,
    comments,
    commentOffsets,
    totalViews: totalViewsCalculated,
    totalLikes: totalLikesCalculated,
    totalSaves: totalSavesCalculated,
    totalShares: totalSharesCalculated,
    totalComments: totalCommentsCalculated,
    totalEngagement:
      totalViewsCalculated +
      totalLikesCalculated +
      totalSavesCalculated +
      totalSharesCalculated +
      totalCommentsCalculated,
  };
}

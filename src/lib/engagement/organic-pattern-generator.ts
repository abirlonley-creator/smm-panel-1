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
  // Max batches must allow headroom above provider minimum (avg >= minViews * 1.18) so variance doesn't dip below min
  const maxBatchesPossible = Math.max(1, Math.floor(targetViews / (minViews * 1.18)));
  let desiredRuns: number;
  if (targetViews <= 1500) {
    desiredRuns = Math.max(3, Math.floor(targetViews / 130)); // e.g. 1000 views -> 7-8 runs
  } else if (targetViews <= 3500) {
    desiredRuns = 24; // avg ~123 views, ~15m
  } else if (targetViews <= 8000) {
    desiredRuns = 42; // avg ~121 views, ~34m
  } else if (targetViews <= 12000) {
    desiredRuns = 72; // avg ~146 views, ~40m
  } else if (targetViews <= 20000) {
    desiredRuns = 96; // avg ~158 views, ~45m
  } else {
    // 50K: 240 batches over 5 days (avg ~211 views, max <= 400)
    desiredRuns = Math.min(260, Math.max(180, Math.round(durationHours * 2.0)));
  }

  const runsCount = Math.max(1, Math.min(maxBatchesPossible, desiredRuns));

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
  const defaultLikes = options.targetLikes ?? Math.round(targetViews * 0.022); // ~2.2% like ratio
  const defaultSaves = options.targetSaves ?? Math.round(targetViews * 0.012); // ~1.2% save ratio
  const defaultShares = options.targetShares ?? Math.round(targetViews * 0.005); // ~0.5% share ratio
  const defaultComments = options.targetComments ?? (targetViews >= 5000 ? Math.round(targetViews * 0.001) : 0);

  // Cumulative views array
  const cumViews: number[] = [];
  let runningViews = 0;
  for (const v of views) {
    runningViews += v;
    cumViews.push(runningViews);
  }

  // A. LIKES: Distributed organically behind views
  const likeOffsets: number[] = [];
  const likesRaw: number[] = [];
  if (defaultLikes >= minLikes) {
    const likeBatchesCount = Math.max(1, Math.min(Math.floor(defaultLikes / minLikes), Math.max(2, Math.round(defaultLikes / 25))));
    const step = Math.max(1, Math.floor(views.length / (likeBatchesCount + 1)));
    for (let b = 0; b < likeBatchesCount; b++) {
      const viewIdx = Math.min(views.length - 1, Math.max(1, (b + 1) * step));
      const lag = 12 + Math.floor(rand() * 20);
      likeOffsets.push(Math.min(durationMinutes - 5, (viewOffsets[viewIdx] || 0) + lag));
      likesRaw.push(minLikes);
    }
  } else if (defaultLikes > 0) {
    likeOffsets.push(Math.min(durationMinutes - 10, (viewOffsets[Math.min(2, views.length - 1)] || 0) + 20));
    likesRaw.push(defaultLikes);
  }
  likeOffsets.sort((a, b) => a - b);

  const likes = likesRaw.length > 0 && defaultLikes >= minLikes
    ? solveKeConservationEquation(
        likesRaw.map((q) => ({ quantity: q })),
        defaultLikes,
        minLikes,
        Math.max(minLikes * 3, Math.ceil((defaultLikes / likesRaw.length) * 2.2))
      ).map((r) => r.quantity)
    : likesRaw;

  // B. SAVES: Organic milestone saves
  const saveOffsets: number[] = [];
  const savesRaw: number[] = [];
  if (defaultSaves >= minSaves) {
    const saveBatchesCount = Math.max(1, Math.min(Math.floor(defaultSaves / minSaves), Math.max(1, Math.round(defaultSaves / 20))));
    const step = Math.max(1, Math.floor(views.length / (saveBatchesCount + 1)));
    for (let b = 0; b < saveBatchesCount; b++) {
      const viewIdx = Math.min(views.length - 1, Math.max(1, (b + 1) * step));
      const lag = 25 + Math.floor(rand() * 30);
      saveOffsets.push(Math.min(durationMinutes - 10, (viewOffsets[viewIdx] || 0) + lag));
      savesRaw.push(minSaves);
    }
  } else if (defaultSaves > 0) {
    saveOffsets.push(Math.min(durationMinutes - 10, (viewOffsets[Math.min(4, views.length - 1)] || 0) + 35));
    savesRaw.push(defaultSaves);
  }
  saveOffsets.sort((a, b) => a - b);

  const saves = savesRaw.length > 0 && defaultSaves >= minSaves
    ? solveKeConservationEquation(
        savesRaw.map((q) => ({ quantity: q })),
        defaultSaves,
        minSaves,
        Math.max(minSaves * 3, Math.ceil((defaultSaves / savesRaw.length) * 2.0))
      ).map((r) => r.quantity)
    : savesRaw;

  // C. SHARES: Organic milestone shares
  const shareOffsets: number[] = [];
  const sharesRaw: number[] = [];
  if (defaultShares >= minShares) {
    const shareBatchesCount = Math.max(1, Math.min(Math.floor(defaultShares / minShares), Math.max(1, Math.round(defaultShares / 20))));
    const step = Math.max(1, Math.floor(views.length / (shareBatchesCount + 1)));
    for (let b = 0; b < shareBatchesCount; b++) {
      const viewIdx = Math.min(views.length - 1, Math.max(1, (b + 1) * step));
      const lag = 40 + Math.floor(rand() * 40);
      shareOffsets.push(Math.min(durationMinutes - 15, (viewOffsets[viewIdx] || 0) + lag));
      sharesRaw.push(minShares);
    }
  } else if (defaultShares > 0) {
    shareOffsets.push(Math.min(durationMinutes - 15, (viewOffsets[Math.min(6, views.length - 1)] || 0) + 45));
    sharesRaw.push(defaultShares);
  }
  shareOffsets.sort((a, b) => a - b);

  const shares = sharesRaw.length > 0 && defaultShares >= minShares
    ? solveKeConservationEquation(
        sharesRaw.map((q) => ({ quantity: q })),
        defaultShares,
        minShares,
        Math.max(minShares * 3, Math.ceil((defaultShares / sharesRaw.length) * 2.0))
      ).map((r) => r.quantity)
    : sharesRaw;

  // D. COMMENTS: Optional organic social proof
  const commentOffsets: number[] = [];
  const commentsRaw: number[] = [];
  if (defaultComments > 0) {
    const commentWaveCount = Math.max(1, Math.min(defaultComments, Math.min(10, Math.round(defaultComments / 3))));
    const cStep = durationMinutes / (commentWaveCount + 1);
    for (let c = 0; c < commentWaveCount; c++) {
      commentOffsets.push(Math.round((c + 1) * cStep + (rand() * 20 - 10)));
      commentsRaw.push(Math.max(1, Math.floor(defaultComments / commentWaveCount)));
    }
    let rem = defaultComments - commentsRaw.reduce((a, b) => a + b, 0);
    let ci = 0;
    while (rem > 0) {
      commentsRaw[ci % commentsRaw.length]++;
      rem--;
      ci++;
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

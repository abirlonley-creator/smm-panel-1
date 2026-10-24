/**
 * Drip Feed Random Range Generator
 *
 * Implements random range run generation with anti-monotone streak constraints:
 * - Each run gets a random quantity between minQuantityPerRun and maxQuantityPerRun (inclusive)
 * - Anti-monotone rule: rejects any sequence with a monotone streak longer than 2 (e.g. 10, 11, 12, 13 rejected)
 * - Example acceptable sequence: 10, 13, 12, 16, 11, 15
 * - Validates provider service min/max constraints per run
 * - Computes estimated min/max totals and prices, and exact final charge
 */

export interface DripFeedParams {
  minQuantityPerRun: number;
  maxQuantityPerRun: number;
  runsCount: number;
  intervalMinutes: number;
  serviceMin: number;
  serviceMax: number;
  ratePer1000: number;
}

export interface DripFeedPlan {
  quantities: number[];
  runsCount: number;
  intervalMinutes: number;
  estimatedMinTotal: number;
  estimatedMaxTotal: number;
  estimatedMinPrice: number;
  estimatedMaxPrice: number;
  actualTotalQuantity: number;
  actualFinalCharge: number;
}

/**
 * Checks if a sequence contains any monotone streak longer than 2.
 * A monotone streak longer than 2 means 3 or more consecutive transitions
 * in the same direction (e.g. 10 -> 11 -> 12 -> 13, length 4 elements / 3 transitions).
 * Flat runs of 4 identical elements (12, 12, 12, 12) are also rejected.
 */
export function hasMonotoneStreakLongerThan2(seq: number[]): boolean {
  if (seq.length <= 3) return false;

  let streak = 0;
  let lastDir = 0; // 1 for up, -1 for down, 0 for flat

  for (let i = 1; i < seq.length; i++) {
    const diff = seq[i] - seq[i - 1];
    const dir = diff > 0 ? 1 : diff < 0 ? -1 : 0;

    if (i === 1) {
      streak = 1;
      lastDir = dir;
    } else if (dir === lastDir) {
      streak++;
      if (streak > 2) {
        return true; // 3 or more consecutive transitions in the same direction
      }
    } else {
      streak = 1;
      lastDir = dir;
    }
  }

  return false;
}

/**
 * Deterministic fallback to construct an alternating (zig-zag) sequence
 * that strictly adheres to the anti-monotone constraint.
 */
function constructSafeDripSequence(min: number, max: number, count: number): number[] {
  const result: number[] = [];
  let goUp = true;
  for (let i = 0; i < count; i++) {
    const span = max - min;
    const mid = Math.floor(span / 2);
    if (span === 0) {
      result.push(min);
    } else if (goUp) {
      result.push(min + Math.floor(Math.random() * (mid + 1)));
    } else {
      result.push(max - Math.floor(Math.random() * (mid + 1)));
    }
    goUp = !goUp;
  }
  return result;
}

/**
 * Generates the Drip Feed sequence and computes pricing.
 */
export function generateDripFeedSequence(params: DripFeedParams): DripFeedPlan {
  const {
    minQuantityPerRun,
    maxQuantityPerRun,
    runsCount,
    intervalMinutes,
    serviceMin,
    serviceMax,
    ratePer1000,
  } = params;

  if (minQuantityPerRun < serviceMin) {
    throw new Error(
      `Minimum quantity per run (${minQuantityPerRun.toLocaleString()}) cannot be below the provider service minimum of ${serviceMin.toLocaleString()}.`
    );
  }

  if (maxQuantityPerRun > serviceMax) {
    throw new Error(
      `Maximum quantity per run (${maxQuantityPerRun.toLocaleString()}) cannot exceed the provider service maximum of ${serviceMax.toLocaleString()}.`
    );
  }

  if (minQuantityPerRun > maxQuantityPerRun) {
    throw new Error(
      `Minimum quantity (${minQuantityPerRun}) cannot be greater than maximum quantity (${maxQuantityPerRun}).`
    );
  }

  if (runsCount < 1) {
    throw new Error("Number of runs must be at least 1.");
  }

  if (intervalMinutes < 1) {
    throw new Error("Interval between runs must be at least 1 minute.");
  }

  const estimatedMinTotal = minQuantityPerRun * runsCount;
  const estimatedMaxTotal = maxQuantityPerRun * runsCount;
  const estimatedMinPrice = Number(((estimatedMinTotal / 1000) * ratePer1000).toFixed(4));
  const estimatedMaxPrice = Number(((estimatedMaxTotal / 1000) * ratePer1000).toFixed(4));

  // Trivial or single-value cases
  if (runsCount <= 3 || minQuantityPerRun === maxQuantityPerRun) {
    const quantities = Array.from({ length: runsCount }, () => {
      if (minQuantityPerRun === maxQuantityPerRun) return minQuantityPerRun;
      return Math.floor(Math.random() * (maxQuantityPerRun - minQuantityPerRun + 1)) + minQuantityPerRun;
    });

    // Check if by chance a 3-element array violated anything (not possible with <= 3 elements)
    const actualTotalQuantity = quantities.reduce((a, b) => a + b, 0);
    const actualFinalCharge = Number(((actualTotalQuantity / 1000) * ratePer1000).toFixed(4));

    return {
      quantities,
      runsCount,
      intervalMinutes,
      estimatedMinTotal,
      estimatedMaxTotal,
      estimatedMinPrice,
      estimatedMaxPrice,
      actualTotalQuantity,
      actualFinalCharge,
    };
  }

  // Rejection sampling
  let quantities: number[] = [];
  const MAX_ATTEMPTS = 500;
  let attempt = 0;

  while (attempt < MAX_ATTEMPTS) {
    attempt++;
    const candidate: number[] = [];
    for (let r = 0; r < runsCount; r++) {
      const val = Math.floor(Math.random() * (maxQuantityPerRun - minQuantityPerRun + 1)) + minQuantityPerRun;
      candidate.push(val);
    }

    if (!hasMonotoneStreakLongerThan2(candidate)) {
      quantities = candidate;
      break;
    }
  }

  if (quantities.length === 0) {
    quantities = constructSafeDripSequence(minQuantityPerRun, maxQuantityPerRun, runsCount);
  }

  const actualTotalQuantity = quantities.reduce((a, b) => a + b, 0);
  const actualFinalCharge = Number(((actualTotalQuantity / 1000) * ratePer1000).toFixed(4));

  return {
    quantities,
    runsCount,
    intervalMinutes,
    estimatedMinTotal,
    estimatedMaxTotal,
    estimatedMinPrice,
    estimatedMaxPrice,
    actualTotalQuantity,
    actualFinalCharge,
  };
}

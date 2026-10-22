/**
 * Order Quantity Randomizer Engine
 *
 * Generates natural variance across order quantities centered on an average target.
 * Supports:
 * - Natural Gaussian/Uniform variance around average target
 * - Strict clamping between service minQuantity and maxQuantity
 * - Exact total preservation mode where sum(quantities) === targetTotal
 * - Reproducible seeded PRNG (Mulberry32) for deterministic tests
 * - Real-time manual edit recalculation
 */

export interface RandomizerParams {
  averageQuantity: number;
  rowCount: number;
  minQuantity: number;
  maxQuantity: number;
  variationPercent?: number; // e.g. 15 for +/-15%
  preserveExactTotal?: boolean;
  targetTotal?: number; // defaults to averageQuantity * rowCount if preserveExactTotal is true
  seed?: number;
}

export interface RandomizerResult {
  quantities: number[];
  average: number;
  totalQuantity: number;
  minGenerated: number;
  maxGenerated: number;
  preserveExactTotal: boolean;
  seed?: number;
}

/**
 * Mulberry32 32-bit PRNG
 * Produces deterministic pseudo-random floats between 0 and 1 given a seed.
 */
export function createSeededRandom(seed: number = 1337): () => number {
  let s = Math.floor(seed) >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates an array of randomized quantities according to the provided parameters.
 */
export function generateRandomizedQuantities(params: RandomizerParams): RandomizerResult {
  const {
    averageQuantity,
    rowCount,
    minQuantity,
    maxQuantity,
    variationPercent = 15,
    preserveExactTotal = false,
    targetTotal,
    seed,
  } = params;

  if (rowCount <= 0) {
    return {
      quantities: [],
      average: 0,
      totalQuantity: 0,
      minGenerated: 0,
      maxGenerated: 0,
      preserveExactTotal,
      seed,
    };
  }

  // Ensure bounds are valid
  const effectiveMin = Math.max(1, Math.floor(minQuantity));
  const effectiveMax = Math.max(effectiveMin, Math.floor(maxQuantity));
  const clampedAvg = Math.max(effectiveMin, Math.min(effectiveMax, Math.round(averageQuantity)));
  const rng = seed !== undefined ? createSeededRandom(seed) : Math.random;

  // Single row case
  if (rowCount === 1) {
    const singleVal = preserveExactTotal && targetTotal !== undefined
      ? Math.max(effectiveMin, Math.min(effectiveMax, Math.round(targetTotal)))
      : clampedAvg;
    return {
      quantities: [singleVal],
      average: singleVal,
      totalQuantity: singleVal,
      minGenerated: singleVal,
      maxGenerated: singleVal,
      preserveExactTotal,
      seed,
    };
  }

  const effectiveTargetTotal =
    preserveExactTotal && targetTotal !== undefined ? Math.round(targetTotal) : clampedAvg * rowCount;

  // Verify feasibility for exact total preservation
  const minPossibleTotal = effectiveMin * rowCount;
  const maxPossibleTotal = effectiveMax * rowCount;
  const boundedTargetTotal = Math.max(
    minPossibleTotal,
    Math.min(maxPossibleTotal, effectiveTargetTotal)
  );

  let quantities: number[] = [];

  if (!preserveExactTotal) {
    // Mode A: Variance around average (total does not have to be exact)
    const varianceRatio = Math.max(0.01, Math.min(1.0, variationPercent / 100));
    const deltaRange = Math.round(clampedAvg * varianceRatio);

    for (let i = 0; i < rowCount; i++) {
      // Box-Muller approximate normal distribution using two uniforms
      const u1 = Math.max(1e-6, rng());
      const u2 = rng();
      const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

      // Scale z0 to deltaRange (z0 is standard normal with stddev ~ 1)
      const offset = Math.round(z0 * (deltaRange / 2));
      const rawVal = clampedAvg + offset;
      const clampedVal = Math.max(effectiveMin, Math.min(effectiveMax, rawVal));
      quantities.push(clampedVal);
    }
  } else {
    // Mode B: Exact Total Preservation
    // Generate initial perturbed weights around average
    const varianceRatio = Math.max(0.01, Math.min(0.5, variationPercent / 100));
    const rawValues: number[] = [];

    for (let i = 0; i < rowCount; i++) {
      const jitter = (rng() * 2 - 1) * varianceRatio; // -varianceRatio to +varianceRatio
      const val = clampedAvg * (1 + jitter);
      rawValues.push(val);
    }

    const rawSum = rawValues.reduce((a, b) => a + b, 0);
    // Normalize and scale to boundedTargetTotal
    quantities = rawValues.map((v) =>
      Math.max(effectiveMin, Math.min(effectiveMax, Math.round((v / rawSum) * boundedTargetTotal)))
    );

    // Reconcile rounding discrepancy to ensure exact total match
    let currentSum = quantities.reduce((a, b) => a + b, 0);
    let diff = boundedTargetTotal - currentSum;
    let iterations = 0;
    const maxIterations = rowCount * 200;

    while (diff !== 0 && iterations < maxIterations) {
      iterations++;
      if (diff > 0) {
        // Find indices that can be incremented
        const eligible = [];
        for (let i = 0; i < rowCount; i++) {
          if (quantities[i] < effectiveMax) eligible.push(i);
        }
        if (eligible.length === 0) break;
        const pick = eligible[Math.floor(rng() * eligible.length)];
        quantities[pick]++;
        diff--;
      } else {
        // Find indices that can be decremented
        const eligible = [];
        for (let i = 0; i < rowCount; i++) {
          if (quantities[i] > effectiveMin) eligible.push(i);
        }
        if (eligible.length === 0) break;
        const pick = eligible[Math.floor(rng() * eligible.length)];
        quantities[pick]--;
        diff++;
      }
    }
  }

  const finalTotal = quantities.reduce((a, b) => a + b, 0);
  const finalAvg = Number((finalTotal / rowCount).toFixed(2));
  const minGen = Math.min(...quantities);
  const maxGen = Math.max(...quantities);

  return {
    quantities,
    average: finalAvg,
    totalQuantity: finalTotal,
    minGenerated: minGen,
    maxGenerated: maxGen,
    preserveExactTotal,
    seed,
  };
}

/**
 * Calculates current total from manual user edits.
 */
export function recalculateOrderQuantitiesTotal(quantities: number[]): {
  total: number;
  average: number;
  count: number;
} {
  const count = quantities.length;
  if (count === 0) return { total: 0, average: 0, count: 0 };
  const total = quantities.reduce((sum, q) => sum + (typeof q === "number" && !isNaN(q) ? q : 0), 0);
  const average = Number((total / count).toFixed(2));
  return { total, average, count };
}

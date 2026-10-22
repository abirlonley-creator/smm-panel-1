export const MIN_LIKE_VIEW_RATIO = 0.02;
export const MAX_LIKE_VIEW_RATIO = 0.05;

// Calibrated dynamic target ratio range for natural delivery:
// Naturally fluctuates between ~2.0% and ~2.7% (approx 37-50 views per like)
// so that 6 likes yields ~230–290 views and 7 likes yields ~265–330 views
export const CALIBRATED_MIN_RATIO = 0.020;
export const CALIBRATED_MAX_RATIO = 0.027;

/**
 * Controls what happens when the calculated batch quantity falls below the
 * provider minimum:
 *
 *   "skip"  — original behaviour: skip the entire interval and record a
 *             BATCH_SKIPPED audit event.  Nothing is sent to the provider.
 *
 *   "clamp" — lift the quantity to providerMinQuantity so a valid order can
 *             still be placed.  The actual likes/views ratio may deviate from
 *             the 2–5 % target but will never exceed it materially.
 *             Recorded as a BATCH_MINIMUM_APPLIED audit event.
 *
 * The active rule is read from the LIKES_ANALYZE_MINIMUM_BATCH_RULE env var
 * ("skip" | "clamp").  Defaults to "clamp" when not set.
 */
export type MinimumBatchRule = "skip" | "clamp";

export function getMinimumBatchRule(): MinimumBatchRule {
  const raw = (process.env.LIKES_ANALYZE_MINIMUM_BATCH_RULE ?? "").toLowerCase().trim();
  return raw === "skip" ? "skip" : "clamp";
}

export interface LikeDrivenViewBatch {
  /** Final validated quantity to submit to the provider (0 when skipped). */
  batchQuantity: number;
  /**
   * The raw quantity derived from the ratio calculation before minimum
   * enforcement.  Identical to batchQuantity when no clamping occurred.
   */
  rawCalculatedQuantity: number;
  /**
   * The quantity after provider-minimum enforcement (= batchQuantity when the
   * rule is "skip" and the raw value was below the minimum, this is 0).
   */
  validatedQuantity: number;
  targetLikeViewRatio: number;
  actualLikeViewRatio: number | null;
  desiredQuantity: number;
  minimumApplied: boolean;
  skipReason?: string;
}

/**
 * Convert likes gained in one observation interval into a view batch.
 *
 * Rules:
 * 1. Dynamic variance: Ratio naturally fluctuates on every interval so delivery
 *    never looks mechanical or fixed to a single multiplier.
 * 2. 1–2 likes: Varied dynamically within 100–200 views (1 like -> ~100–150 views,
 *    2 likes -> ~140–200 views), meeting provider minimums without skipping.
 * 3. 6–7 likes: Naturally fluctuates in the ~240–310 view range (~250–300 avg).
 * 4. General minimum: If raw calculated quantity is below providerMinQuantity,
 *    order at least the provider minimum (when rule is "clamp").
 * 5. Caps: Respects session availableQuantity and providerMaxQuantity.
 */
export function calculateLikeDrivenViewBatch(
  likesGained: number,
  limits: {
    providerMinQuantity: number;
    providerMaxQuantity: number;
    availableQuantity: number;
  },
  random: () => number = Math.random,
  minimumBatchRule: MinimumBatchRule = getMinimumBatchRule(),
): LikeDrivenViewBatch {
  const randomValue = random();
  const normalizedRandom = Number.isFinite(randomValue)
    ? Math.min(1, Math.max(0, randomValue))
    : 0.5;

  // Dynamic organic ratio: varies between 2.0% and 2.7% on each checkpoint
  const targetLikeViewRatio =
    CALIBRATED_MIN_RATIO + normalizedRandom * (CALIBRATED_MAX_RATIO - CALIBRATED_MIN_RATIO);

  // ── Guard: no positive likes delta → nothing to do ────────────────────────
  if (!Number.isSafeInteger(likesGained) || likesGained <= 0) {
    return {
      batchQuantity: 0,
      rawCalculatedQuantity: 0,
      validatedQuantity: 0,
      targetLikeViewRatio,
      actualLikeViewRatio: null,
      desiredQuantity: 0,
      minimumApplied: false,
      skipReason: "No positive verified likes increase was measured in this interval.",
    };
  }

  // ── Step 1: derive desired quantity from the randomized ratio ─────────────
  const rawCalculatedQuantity = Math.round(likesGained / targetLikeViewRatio);
  let desiredQuantity = rawCalculatedQuantity;
  let minimumApplied = false;

  // ── Step 2: Dynamic variance for 1–2 likes (fluctuates within 100–200 views)
  if (likesGained === 1) {
    // 1 like: dynamic natural variance between 100 and 150 views (respecting provider minimum)
    desiredQuantity = Math.max(limits.providerMinQuantity, Math.round(100 + normalizedRandom * 50));
    minimumApplied = true;
  } else if (likesGained === 2) {
    // 2 likes: dynamic natural variance between 140 and 200 views
    desiredQuantity = Math.max(limits.providerMinQuantity, Math.round(140 + normalizedRandom * 60));
    minimumApplied = true;
  } else if (desiredQuantity < limits.providerMinQuantity) {
    if (minimumBatchRule === "clamp") {
      desiredQuantity = limits.providerMinQuantity;
      minimumApplied = true;
    } else {
      // rule is "skip"
      return {
        batchQuantity: 0,
        rawCalculatedQuantity,
        validatedQuantity: 0,
        targetLikeViewRatio,
        actualLikeViewRatio: null,
        desiredQuantity,
        minimumApplied: false,
        skipReason:
          `The calculated ${rawCalculatedQuantity.toLocaleString()} views are below the provider ` +
          `minimum of ${limits.providerMinQuantity.toLocaleString()}.`,
      };
    }
  }

  // ── Step 3: Enforce caps (provider max & available session budget/quantity) ──
  const maxAllowedQuantity = Math.max(
    0,
    Math.floor(Math.min(limits.providerMaxQuantity, limits.availableQuantity)),
  );

  if (limits.availableQuantity < limits.providerMinQuantity) {
    return {
      batchQuantity: 0,
      rawCalculatedQuantity,
      validatedQuantity: 0,
      targetLikeViewRatio,
      actualLikeViewRatio: null,
      desiredQuantity,
      minimumApplied: false,
      skipReason:
        `Calculated ${desiredQuantity.toLocaleString()} views are needed for provider minimum ` +
        `of ${limits.providerMinQuantity.toLocaleString()}, but the remaining budget/quantity cap ` +
        `(${limits.availableQuantity.toLocaleString()}) is below the minimum.`,
    };
  }

  const validatedQuantity = Math.min(desiredQuantity, maxAllowedQuantity);
  if (validatedQuantity < limits.providerMinQuantity) {
    return {
      batchQuantity: 0,
      rawCalculatedQuantity,
      validatedQuantity: 0,
      targetLikeViewRatio,
      actualLikeViewRatio: null,
      desiredQuantity,
      minimumApplied: false,
      skipReason:
        `The capped quantity of ${validatedQuantity.toLocaleString()} views is below the provider ` +
        `minimum of ${limits.providerMinQuantity.toLocaleString()}.`,
    };
  }

  // ── Step 4: Actual ratio calculation ──────────────────────────────────────
  const actualLikeViewRatio = likesGained / validatedQuantity;

  // When minimum enforcement or small-like tier is applied, we don't reject
  // batches for falling below the 2% ratio (e.g. 1 like for 100 views is 1.0%),
  // since this is intentional to satisfy the minimum order requirement.
  // For standard larger batches without minimum clamping, verify ratio sanity.
  if (!minimumApplied) {
    if (
      actualLikeViewRatio < MIN_LIKE_VIEW_RATIO - Number.EPSILON ||
      actualLikeViewRatio > MAX_LIKE_VIEW_RATIO + Number.EPSILON
    ) {
      return {
        batchQuantity: 0,
        rawCalculatedQuantity,
        validatedQuantity: 0,
        targetLikeViewRatio,
        actualLikeViewRatio,
        desiredQuantity,
        minimumApplied: false,
        skipReason:
          `Provider or session limits would move the batch outside the 2–5 % likes-to-views ` +
          `range (actual ${(actualLikeViewRatio * 100).toFixed(2)} %).`,
      };
    }
  }

  return {
    batchQuantity: validatedQuantity,
    rawCalculatedQuantity,
    validatedQuantity,
    targetLikeViewRatio,
    actualLikeViewRatio,
    desiredQuantity,
    minimumApplied,
  };
}


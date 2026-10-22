import { Service } from "@prisma/client";
import { ScheduleCalculationResult, ScheduleMode, ScheduleStepPreview, SchedulingTimingMode } from "../types";
import { 
  buildOrganicPlan, 
  ORGANIC_PRESET_DEFINITIONS, 
  OrganicPresetId, 
  SpikeIntensity 
} from "./organic-presets";

export interface ScheduleCalculationInput {
  service: Pick<
    Service,
    | "id"
    | "name"
    | "minQuantity"
    | "maxQuantity"
    | "ratePer1000"
    | "dripFeedSupported"
    | "dripFeedMinInterval"
    | "dripFeedMaxInterval"
    | "restrictions"
  >;
  targetUrl: string;
  totalQuantity: number;
  scheduleMode: ScheduleMode;
  timingMode?: SchedulingTimingMode;
  stepsCount?: number;
  intervalMinutes?: number;
  totalDurationMinutes?: number;
  startDate?: Date;
  customStepQuantities?: number[];
  customIntervals?: number[]; // e.g. [0, 30, 21, 45, 18]
  enforceExactAllocation?: boolean;
  seed?: number;
  smoothness?: number;
  spikeIntensity?: SpikeIntensity;
  lockedBatches?: { index: number; quantity: number }[];
  allowZeroBatches?: boolean;
}

/**
 * Deterministic, mathematically balanced schedule calculator.
 * Strictly guarantees that sum(step.quantity) === totalQuantity for valid schedules.
 * Supports Mode A (Duration + Interval), Mode B (Batch count + Duration), and Custom Individual Intervals.
 */
export function calculateGrowthPlan(input: ScheduleCalculationInput): ScheduleCalculationResult {
  const {
    service,
    targetUrl,
    totalQuantity,
    scheduleMode,
    timingMode = "MODE_B",
    customStepQuantities,
    customIntervals,
    enforceExactAllocation = false,
  } = input;

  const start = input.startDate ? new Date(input.startDate) : new Date(Date.now() + 5 * 60 * 1000);
  const unitCost = service.ratePer1000 / 1000;
  const totalCost = Number(((totalQuantity / 1000) * service.ratePer1000).toFixed(4));
  const assumptions: string[] = [
    "Schedules are executed automatically by persistent worker ticks.",
    "Delivery pace depends on destination platform ingestion rate and provider network load.",
    "Calculated completion times represent estimated provider dispatch, not guaranteed network reflection.",
  ];

  // Helper for error returns
  const makeInvalid = (
    errorMessage: string,
    stepCount = 1,
    defaultInterval = 30,
    totalDur = 0,
    unallocated = 0
  ): ScheduleCalculationResult => ({
    valid: false,
    errorMessage,
    serviceId: service.id,
    serviceName: service.name,
    targetUrl,
    totalQuantity,
    unitCost,
    totalCost,
    scheduleMode,
    timingMode,
    stepCount,
    defaultIntervalMinutes: defaultInterval,
    totalDurationMinutes: totalDur,
    unallocatedQuantity: unallocated,
    startTime: start.toISOString(),
    estimatedCompletionTime: start.toISOString(),
    steps: [],
    minQuantityPerStep: 0,
    maxQuantityPerStep: 0,
    assumptions,
  });

  // Validation 1: Negative or non-positive total quantity
  if (totalQuantity <= 0) {
    return makeInvalid("Total quantity must be greater than 0.");
  }

  // Validation 2: Service total bounds
  if (totalQuantity < service.minQuantity) {
    return makeInvalid(
      `Total quantity (${totalQuantity.toLocaleString()}) is below service minimum of ${service.minQuantity.toLocaleString()}.`
    );
  }

  if (totalQuantity > service.maxQuantity) {
    return makeInvalid(
      `Total quantity (${totalQuantity.toLocaleString()}) exceeds service maximum of ${service.maxQuantity.toLocaleString()}.`
    );
  }

  // Validation 3: Instant mode
  if (scheduleMode === "INSTANT" || (input.stepsCount === 1 && !customIntervals && !customStepQuantities)) {
    const singleStep: ScheduleStepPreview = {
      stepNumber: 1,
      scheduledTime: start.toISOString(),
      scheduledTimeFormatted: formatStepDate(start),
      intervalMinutesFromPrev: 0,
      elapsedMinutes: 0,
      quantity: totalQuantity,
      cumulativeQuantity: totalQuantity,
      percentOfTotal: 100,
      stepCost: totalCost,
      status: "Preview",
    };

    return {
      valid: true,
      serviceId: service.id,
      serviceName: service.name,
      targetUrl,
      totalQuantity,
      unitCost,
      totalCost,
      scheduleMode: "INSTANT",
      timingMode,
      stepCount: 1,
      defaultIntervalMinutes: 0,
      totalDurationMinutes: 0,
      unallocatedQuantity: 0,
      startTime: start.toISOString(),
      estimatedCompletionTime: start.toISOString(),
      steps: [singleStep],
      minQuantityPerStep: totalQuantity,
      maxQuantityPerStep: totalQuantity,
      assumptions,
    };
  }

  // Validation: nonpositive duration or interval
  if (input.totalDurationMinutes !== undefined && input.totalDurationMinutes <= 0) {
    return makeInvalid("Total timeline duration must be greater than 0 minutes.");
  }
  if (input.intervalMinutes !== undefined && input.intervalMinutes <= 0) {
    return makeInvalid("Batch interval must be greater than 0 minutes.");
  }
  const allowZero = Boolean(
    input.allowZeroBatches === true ||
    (scheduleMode in ORGANIC_PRESET_DEFINITIONS && input.allowZeroBatches !== false)
  );

  if (customStepQuantities && customStepQuantities.some((q) => allowZero ? q < 0 : q <= 0)) {
    return makeInvalid(allowZero ? "Batch quantities cannot be negative." : "All batch quantities must be greater than 0.");
  }

  // Determine step count and intervals based on Timing Mode
  let resolvedStepCount = customStepQuantities && customStepQuantities.length > 0
    ? customStepQuantities.length
    : (input.stepsCount || 5);
  let resolvedDefaultInterval = input.intervalMinutes || 30;
  let resolvedTotalDuration = input.totalDurationMinutes || 0;
  const intervals: number[] = []; // intervals[i] = minutes between step i-1 and step i (intervals[0] = 0)

  if (timingMode === "MODE_A") {
    // Mode A: Duration and interval specified
    const dur = input.totalDurationMinutes ?? 240;
    const interval = input.intervalMinutes ?? 30;

    if (dur <= 0) {
      return makeInvalid("Total timeline duration must be greater than 0 minutes.");
    }
    if (interval <= 0) {
      return makeInvalid("Batch interval must be greater than 0 minutes.");
    }

    resolvedTotalDuration = dur;
    resolvedDefaultInterval = interval;

    // Convention: Batch 1 is at t=0. Each subsequent batch is spaced by interval.
    // Number of steps = floor(dur / interval) + 1. If stepCount is explicitly passed and valid, use it.
    if (input.stepsCount && input.stepsCount > 1) {
      resolvedStepCount = input.stepsCount;
    } else {
      resolvedStepCount = Math.max(2, Math.min(30, Math.floor(dur / interval) + 1));
    }

    intervals.push(0);
    for (let i = 1; i < resolvedStepCount; i++) {
      intervals.push(interval);
    }
    resolvedTotalDuration = (resolvedStepCount - 1) * interval;
  } else if (timingMode === "MODE_B") {
    // Mode B: Batch count and duration specified
    resolvedStepCount = customStepQuantities && customStepQuantities.length > 0
      ? customStepQuantities.length
      : Math.max(2, Math.min(30, input.stepsCount || 4));
    const dur = input.totalDurationMinutes ?? 240;

    if (dur <= 0) {
      return makeInvalid("Total timeline duration must be greater than 0 minutes.");
    }

    resolvedTotalDuration = dur;
    // Interval between batches to span the duration evenly from step 1 (t=0) to step N (t=dur)
    resolvedDefaultInterval = Math.max(1, Math.round(dur / (resolvedStepCount - 1)));

    intervals.push(0);
    for (let i = 1; i < resolvedStepCount; i++) {
      intervals.push(resolvedDefaultInterval);
    }
  } else {
    // CUSTOM Timing: custom intervals provided or derived
    if (customIntervals && customIntervals.length > 0) {
      resolvedStepCount = customIntervals.length;
      intervals.push(0);
      let cumulativeMins = 0;
      for (let i = 1; i < customIntervals.length; i++) {
        const intVal = customIntervals[i];
        if (intVal <= 0) {
          return makeInvalid(`Batch #${i + 1} interval must be greater than 0 minutes.`);
        }
        intervals.push(intVal);
        cumulativeMins += intVal;
      }
      resolvedTotalDuration = cumulativeMins;
      resolvedDefaultInterval = Math.round(cumulativeMins / Math.max(1, resolvedStepCount - 1));
    } else {
      resolvedStepCount = Math.max(2, Math.min(30, input.stepsCount || 5));
      resolvedDefaultInterval = Math.max(1, input.intervalMinutes || 30);
      intervals.push(0);
      for (let i = 1; i < resolvedStepCount; i++) {
        intervals.push(resolvedDefaultInterval);
      }
      resolvedTotalDuration = (resolvedStepCount - 1) * resolvedDefaultInterval;
    }
  }

  // Check drip-feed service limits
  const minAllowedInterval = typeof service.dripFeedMinInterval === "number" ? service.dripFeedMinInterval : 1;
  const maxAllowedInterval = service.dripFeedMaxInterval || 10080;

  for (let i = 1; i < intervals.length; i++) {
    if (intervals[i] < minAllowedInterval) {
      return makeInvalid(
        `Batch #${i + 1} interval (${intervals[i]}m) is below service minimum of ${minAllowedInterval}m.`
      );
    }
    if (intervals[i] > maxAllowedInterval) {
      return makeInvalid(
        `Batch #${i + 1} interval (${intervals[i]}m) exceeds service maximum of ${maxAllowedInterval}m.`
      );
    }
  }

  // Calculate step quantities
  let quantities: number[] = [];
  let unallocatedQuantity = 0;

  if (customStepQuantities && customStepQuantities.length === resolvedStepCount) {
    // Custom quantities provided directly
    quantities = [...customStepQuantities];
    const sumAssigned = quantities.reduce((a, b) => a + b, 0);
    unallocatedQuantity = totalQuantity - sumAssigned;

    // Check for negative quantities (and zero if not allowZero)
    const invalidQtyIdx = quantities.findIndex((q) => allowZero ? q < 0 : q <= 0);
    if (invalidQtyIdx !== -1) {
      return makeInvalid(
        `Batch #${invalidQtyIdx + 1} quantity must be ${allowZero ? "greater than or equal to 0" : "greater than 0"}.`,
        resolvedStepCount,
        resolvedDefaultInterval,
        resolvedTotalDuration,
        unallocatedQuantity
      );
    }

    if (enforceExactAllocation && unallocatedQuantity !== 0) {
      const diffWord = unallocatedQuantity > 0 ? "unallocated" : "overallocated";
      return makeInvalid(
        `Schedule has ${Math.abs(unallocatedQuantity).toLocaleString()} units ${diffWord}. Total must equal ${totalQuantity.toLocaleString()}.`,
        resolvedStepCount,
        resolvedDefaultInterval,
        resolvedTotalDuration,
        unallocatedQuantity
      );
    }
  } else if (scheduleMode === "EVEN_DRIP") {
    const basePerStep = Math.floor(totalQuantity / resolvedStepCount);
    const remainder = totalQuantity % resolvedStepCount;
    quantities = Array(resolvedStepCount).fill(basePerStep);
    // Add remainder to later steps to preserve exact sum
    for (let i = 0; i < remainder; i++) {
      quantities[resolvedStepCount - 1 - i] += 1;
    }
    unallocatedQuantity = 0;
  } else if (scheduleMode === "FRONT_LOADED") {
    // Decaying exponential weight distribution
    const weights: number[] = [];
    for (let i = 0; i < resolvedStepCount; i++) {
      weights.push(1 / (1 + i * 0.45));
    }
    const sumWeights = weights.reduce((a, b) => a + b, 0);
    quantities = weights.map((w) => Math.floor((w / sumWeights) * totalQuantity));
    // Reconcile rounding discrepancy to match totalQuantity strictly
    const sumAssigned = quantities.reduce((a, b) => a + b, 0);
    let diff = totalQuantity - sumAssigned;
    let idx = 0;
    while (diff > 0) {
      quantities[idx % resolvedStepCount]++;
      diff--;
      idx++;
    }
    unallocatedQuantity = 0;
  } else if (scheduleMode === "GRADUAL_RAMP") {
    // Linear organic growth ramp
    const weights: number[] = [];
    for (let i = 0; i < resolvedStepCount; i++) {
      weights.push(1 + i * 0.7);
    }
    const sumWeights = weights.reduce((a, b) => a + b, 0);
    quantities = weights.map((w) => Math.floor((w / sumWeights) * totalQuantity));
    const sumAssigned = quantities.reduce((a, b) => a + b, 0);
    let diff = totalQuantity - sumAssigned;
    let idx = resolvedStepCount - 1;
    while (diff > 0) {
      quantities[idx % resolvedStepCount]++;
      diff--;
      idx--;
    }
  } else if (scheduleMode in ORGANIC_PRESET_DEFINITIONS) {
    const organicResult = buildOrganicPlan(scheduleMode as OrganicPresetId, {
      batchCount: resolvedStepCount,
      totalQuantity,
      totalDurationMinutes: resolvedTotalDuration || 240,
      minQuantityPerBatch: service.minQuantity,
      maxQuantityPerBatch: service.maxQuantity,
      seed: input.seed ?? 12345,
      smoothness: input.smoothness ?? 65,
      spikeIntensity: input.spikeIntensity ?? "medium",
      lockedBatches: input.lockedBatches,
      startDateTime: start,
      allowZeroBatches: input.allowZeroBatches ?? true,
    });
    quantities = organicResult.batches.map((b) => b.quantity);
    if (!customIntervals || customIntervals.length === 0) {
      intervals.length = 0;
      organicResult.batches.forEach((b) => intervals.push(b.intervalMinutes));
    }
    unallocatedQuantity = 0;
  } else {
    // CUSTOM / default even distribution
    const base = Math.floor(totalQuantity / resolvedStepCount);
    quantities = Array(resolvedStepCount).fill(base);
    quantities[resolvedStepCount - 1] += totalQuantity - base * resolvedStepCount;
    unallocatedQuantity = 0;
  }

  // Validate every individual step against provider bounds
  const positiveSteps = quantities.filter((q) => q > 0);
  const minPositiveStep = positiveSteps.length > 0 ? Math.min(...positiveSteps) : 0;
  const maxStep = Math.max(...quantities);

  // If allowZero is active, batches of 0 are valid (idle/rest periods).
  // Active positive batches must meet service.minQuantity.
  const hasInvalidMin = allowZero
    ? minPositiveStep > 0 && minPositiveStep < service.minQuantity
    : Math.min(...quantities) < service.minQuantity;

  if (hasInvalidMin) {
    const minStepIndex = quantities.findIndex((quantity) =>
      allowZero ? quantity > 0 && quantity < service.minQuantity : quantity < service.minQuantity
    );
    const violatingQty = quantities[minStepIndex];
    const errorMessage = customStepQuantities && customStepQuantities.length > 0
      ? `Batch #${minStepIndex + 1} has ${violatingQty.toLocaleString()} units, below the provider minimum of ${service.minQuantity.toLocaleString()} per order. Increase this batch to at least ${service.minQuantity.toLocaleString()} units.`
      : `Schedule results in steps with ${violatingQty.toLocaleString()} units, below the provider minimum of ${service.minQuantity.toLocaleString()} per order. Increase the smallest batch or use no more than ${Math.max(1, Math.floor(totalQuantity / service.minQuantity))} batches.`;
    return makeInvalid(
      errorMessage,
      resolvedStepCount,
      resolvedDefaultInterval,
      resolvedTotalDuration,
      unallocatedQuantity
    );
  }

  if (maxStep > service.maxQuantity) {
    return makeInvalid(
      `Batch quantity (${maxStep.toLocaleString()}) exceeds service maximum of ${service.maxQuantity.toLocaleString()}.`,
      resolvedStepCount,
      resolvedDefaultInterval,
      resolvedTotalDuration,
      unallocatedQuantity
    );
  }

  // Build step previews with timestamps, cumulative totals, and percentages
  let runningElapsed = 0;
  let runningCumulative = 0;
  const timestampSet = new Set<string>();

  const steps: ScheduleStepPreview[] = quantities.map((qty, index) => {
    runningElapsed += intervals[index] || 0;
    runningCumulative += qty;

    const stepTime = new Date(start.getTime() + runningElapsed * 60 * 1000);
    const timeIso = stepTime.toISOString();

    timestampSet.add(timeIso);

    const stepCost = Number(((qty / 1000) * service.ratePer1000).toFixed(4));
    const percent = Number(((runningCumulative / totalQuantity) * 100).toFixed(1));

    return {
      stepNumber: index + 1,
      scheduledTime: timeIso,
      scheduledTimeFormatted: formatStepDate(stepTime),
      intervalMinutesFromPrev: intervals[index] || 0,
      elapsedMinutes: runningElapsed,
      quantity: qty,
      cumulativeQuantity: runningCumulative,
      percentOfTotal: percent,
      stepCost,
      status: "Preview",
    };
  });

  // Duplicate timestamp check
  if (timestampSet.size < steps.length) {
    return makeInvalid(
      "Duplicate execution timestamps detected. Each batch must have a distinct scheduled time.",
      resolvedStepCount,
      resolvedDefaultInterval,
      resolvedTotalDuration,
      unallocatedQuantity
    );
  }

  const completionTime = new Date(start.getTime() + runningElapsed * 60 * 1000);

  return {
    valid: true,
    serviceId: service.id,
    serviceName: service.name,
    targetUrl,
    totalQuantity,
    unitCost,
    totalCost,
    scheduleMode,
    timingMode,
    stepCount: resolvedStepCount,
    defaultIntervalMinutes: resolvedDefaultInterval,
    totalDurationMinutes: runningElapsed,
    unallocatedQuantity,
    startTime: start.toISOString(),
    estimatedCompletionTime: completionTime.toISOString(),
    steps,
    minQuantityPerStep: minPositiveStep,
    maxQuantityPerStep: maxStep,
    assumptions,
  };
}

/**
 * Deterministically redistributes remaining unallocated units across batch quantities.
 * Ensures all quantities remain >= minQty and <= maxQty.
 */
export function redistributeRemaining(
  currentQuantities: number[],
  totalQuantity: number,
  minQuantity: number,
  maxQuantity: number
): number[] {
  if (currentQuantities.length === 0) return [];
  const count = currentQuantities.length;
  const sumCurrent = currentQuantities.reduce((a, b) => a + b, 0);
  let remainder = totalQuantity - sumCurrent;

  if (remainder === 0) return [...currentQuantities];

  const result = [...currentQuantities];

  if (remainder > 0) {
    // Add evenly
    const perStep = Math.floor(remainder / count);
    let leftOver = remainder % count;

    for (let i = 0; i < count; i++) {
      const add = perStep + (leftOver > 0 ? 1 : 0);
      result[i] = Math.min(maxQuantity, result[i] + add);
      if (leftOver > 0) leftOver--;
    }
  } else {
    // Subtract evenly while respecting minQuantity
    let toSubtract = Math.abs(remainder);
    for (let i = count - 1; i >= 0 && toSubtract > 0; i--) {
      const maxSubFromThis = Math.max(0, result[i] - minQuantity);
      const sub = Math.min(maxSubFromThis, Math.ceil(toSubtract / (i + 1)));
      result[i] -= sub;
      toSubtract -= sub;
    }
  }

  // Ensure exact sum matches totalQuantity if possible
  const finalSum = result.reduce((a, b) => a + b, 0);
  let finalDiff = totalQuantity - finalSum;
  let idx = 0;
  while (finalDiff !== 0 && idx < count * 2) {
    const targetIdx = idx % count;
    if (finalDiff > 0 && result[targetIdx] < maxQuantity) {
      result[targetIdx]++;
      finalDiff--;
    } else if (finalDiff < 0 && result[targetIdx] > minQuantity) {
      result[targetIdx]--;
      finalDiff++;
    }
    idx++;
  }

  return result;
}

function formatStepDate(d: Date): string {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

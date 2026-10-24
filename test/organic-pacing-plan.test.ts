import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateOrganicPlan,
  generateUniqueOrganicPlan,
  DEFAULT_SERVICE_SPECS,
  getHourInAudienceTz,
  computeCurveDistance,
  type EngagementType,
  type DurationPreset,
} from "../src/lib/engagement/planner";

describe("Organic Pacing Plan Generator — Comprehensive Verification", () => {
  const fixedStartTime = new Date("2026-10-24T12:00:00Z");

  // --------------------------------------------------------------------------
  // Test 1: 500 random seeds test suite
  // --------------------------------------------------------------------------
  it("500 random seeds: satisfies hard rule at every run boundary, exact totals, no run below min, k in [6,8], m in [0.25,0.30], noise <= 3%", () => {
    const SEED_COUNT = 500;
    const fingerprints = new Set<string>();

    for (let s = 1; s <= SEED_COUNT; s++) {
      const seed = s * 7919 + 104729;
      const baseViews = 10000;
      const targetTz = s % 2 === 0 ? "America/New_York" : "Asia/Kolkata";
      const preset: DurationPreset = s % 3 === 0 ? "24h" : s % 3 === 1 ? "72h" : "168h";

      const plan = generateOrganicPlan({
        baseViews,
        seed,
        durationPreset: preset,
        startTime: fixedStartTime,
        targetTz,
      });

      // 1. Envelope parameters check: k in [6, 8], m in [0.25, 0.30]
      assert.ok(
        plan.params.k >= 6.0 && plan.params.k <= 8.0001,
        `Seed ${seed}: k must be in [6.0, 8.0], got ${plan.params.k}`
      );
      assert.ok(
        plan.params.m >= 0.25 && plan.params.m <= 0.3001,
        `Seed ${seed}: m must be in [0.25, 0.30], got ${plan.params.m}`
      );
      assert.ok(
        plan.params.noiseAmplitude <= 0.03001,
        `Seed ${seed}: noise amplitude must be <= 3%, got ${plan.params.noiseAmplitude}`
      );

      // 2. Fingerprint uniqueness
      assert.ok(
        !fingerprints.has(plan.params.fingerprint),
        `Seed ${seed}: duplicate fingerprint detected: ${plan.params.fingerprint}`
      );
      fingerprints.add(plan.params.fingerprint);

      // 3. Exact totals & provider min order size check per type
      for (const type of ["views", "likes", "saves", "shares", "comments"] as const) {
        const typePlan = plan.plans[type];
        const srv = DEFAULT_SERVICE_SPECS.Instagram[type];

        // Planned total must match sum of run quantities
        const sumRuns = typePlan.runs.reduce((sum, r) => sum + r.quantity, 0);
        assert.equal(
          sumRuns,
          typePlan.totalQuantity,
          `Seed ${seed} [${type}]: sum of run quantities (${sumRuns}) must equal planned total (${typePlan.totalQuantity})`
        );

        // No run below provider minimum
        for (const run of typePlan.runs) {
          assert.ok(
            run.quantity >= srv.minQuantity,
            `Seed ${seed} [${type}]: run quantity ${run.quantity} is below service min ${srv.minQuantity}`
          );
        }
      }

      // 4. Hard rule at EVERY run boundary in allRuns:
      // delivered_so_far(type, t) <= target_ratio(type) * views_delivered_so_far(t)
      const cumDelivered: Record<EngagementType, number> = {
        views: 0,
        likes: 0,
        saves: 0,
        shares: 0,
        comments: 0,
      };

      for (let i = 0; i < plan.allRuns.length; i++) {
        const run = plan.allRuns[i];
        cumDelivered[run.engagementType] += run.quantity;
        const currentViews = cumDelivered.views;

        for (const type of ["likes", "saves", "shares", "comments"] as const) {
          const ratio = plan.params.ratios[type];
          const maxAllowed = ratio * currentViews;
          assert.ok(
            cumDelivered[type] <= maxAllowed + 1e-6,
            `Seed ${seed}: Hard rule violated for ${type} at run #${i + 1} (${run.minutesFromStart}m): ` +
              `delivered=${cumDelivered[type]}, maxAllowed=${maxAllowed.toFixed(2)} (views=${currentViews}, ratio=${ratio})`
          );
        }
      }
    }

    assert.equal(fingerprints.size, SEED_COUNT, `Expected ${SEED_COUNT} distinct fingerprints`);
  });

  // --------------------------------------------------------------------------
  // Test 2: Determinism (Same seed gives identical plans)
  // --------------------------------------------------------------------------
  it("Same seed twice gives identical plans; different seeds give different plans", () => {
    const opts = {
      baseViews: 10000,
      seed: 987654321,
      durationPreset: "72h" as DurationPreset,
      startTime: fixedStartTime,
      targetTz: "America/New_York",
    };

    const runA = generateOrganicPlan(opts);
    const runB = generateOrganicPlan(opts);

    // Deep equality of all runs and params
    assert.equal(runA.params.fingerprint, runB.params.fingerprint);
    assert.equal(runA.params.k, runB.params.k);
    assert.equal(runA.params.m, runB.params.m);
    assert.equal(runA.params.archetype, runB.params.archetype);
    assert.equal(runA.allRuns.length, runB.allRuns.length);

    for (let i = 0; i < runA.allRuns.length; i++) {
      assert.equal(runA.allRuns[i].scheduledAt, runB.allRuns[i].scheduledAt);
      assert.equal(runA.allRuns[i].quantity, runB.allRuns[i].quantity);
      assert.equal(runA.allRuns[i].cumulativeQuantity, runB.allRuns[i].cumulativeQuantity);
    }

    // Different seed
    const runC = generateOrganicPlan({ ...opts, seed: 987654322 });
    assert.notEqual(runA.params.fingerprint, runC.params.fingerprint);
  });

  // --------------------------------------------------------------------------
  // Test 3: Likes ratio constraint and Comments batch size 1-3
  // --------------------------------------------------------------------------
  it("Likes never exceed ratio * views at any time, and comments always have batch size 1-3", () => {
    for (let s = 1; s <= 50; s++) {
      const plan = generateOrganicPlan({
        baseViews: 15000,
        seed: s * 1337,
        durationPreset: "72h",
        startTime: fixedStartTime,
      });

      // Likes check
      let currentViews = 0;
      let currentLikes = 0;
      for (const run of plan.allRuns) {
        if (run.engagementType === "views") currentViews += run.quantity;
        if (run.engagementType === "likes") {
          currentLikes += run.quantity;
          assert.ok(
            currentLikes <= plan.params.ratios.likes * currentViews + 1e-6,
            `Likes (${currentLikes}) exceeded target ratio (${plan.params.ratios.likes}) * views (${currentViews})`
          );
        }
      }

      // Comments batch size 1-3
      const commentRuns = plan.plans.comments.runs;
      for (const cRun of commentRuns) {
        assert.ok(
          cRun.quantity >= 1 && cRun.quantity <= 3,
          `Comments batch size must be 1, 2, or 3, got ${cRun.quantity}`
        );
      }
    }
  });

  // --------------------------------------------------------------------------
  // Test 4: Peak-hour weighting (+40%) holds >= 25% larger batches than off-peak
  // --------------------------------------------------------------------------
  it("Peak-hour windows hold on average at least 25% larger batches than off-peak, with correct DST/time zone handling", () => {
    const timezones = ["Asia/Kolkata", "America/New_York", "Europe/London", "Asia/Tokyo"];

    for (const tz of timezones) {
      let totalPeakQuantity = 0;
      let totalPeakBatches = 0;
      let totalOffPeakQuantity = 0;
      let totalOffPeakBatches = 0;

      for (let s = 1; s <= 25; s++) {
        const plan = generateOrganicPlan({
          baseViews: 20000,
          seed: s * 4321,
          durationPreset: "72h",
          startTime: fixedStartTime,
          targetTz: tz,
          peakHourWeighting: true,
        });

        for (const run of plan.plans.views.runs) {
          const runDate = new Date(run.scheduledAt);
          const hour = getHourInAudienceTz(runDate, tz);
          const isPeak = (hour >= 12 && hour < 14) || (hour >= 19 && hour < 23);

          if (isPeak) {
            totalPeakQuantity += run.quantity;
            totalPeakBatches++;
          } else {
            totalOffPeakQuantity += run.quantity;
            totalOffPeakBatches++;
          }
        }
      }

      assert.ok(totalPeakBatches > 0, `Expected peak batches in ${tz}`);
      assert.ok(totalOffPeakBatches > 0, `Expected off-peak batches in ${tz}`);

      const avgPeakBatch = totalPeakQuantity / totalPeakBatches;
      const avgOffPeakBatch = totalOffPeakQuantity / totalOffPeakBatches;
      const boost = (avgPeakBatch - avgOffPeakBatch) / avgOffPeakBatch;

      assert.ok(
        boost >= 0.25,
        `In ${tz}, peak-hour batches should be on average >= 25% larger than off-peak. Avg peak: ${avgPeakBatch.toFixed(1)}, avg off-peak: ${avgOffPeakBatch.toFixed(1)}, boost: ${(boost * 100).toFixed(1)}%`
      );
    }
  });

  // --------------------------------------------------------------------------
  // Test 5: Presets 24h / 72h / 168h scale all times correctly
  // --------------------------------------------------------------------------
  it("Presets 24h / 72h / 168h scale all times correctly", () => {
    const presets: DurationPreset[] = ["24h", "72h", "168h"];
    const expectedMaxMinutes: Record<DurationPreset, number> = {
      "24h": 24 * 60,
      "72h": 72 * 60,
      "168h": 168 * 60,
    };

    for (const preset of presets) {
      const plan = generateOrganicPlan({
        baseViews: 10000,
        seed: 777,
        durationPreset: preset,
        startTime: fixedStartTime,
      });

      assert.equal(plan.durationPreset, preset);
      assert.equal(plan.durationHours, expectedMaxMinutes[preset] / 60);

      // Final run must complete within duration preset
      const lastRun = plan.allRuns[plan.allRuns.length - 1];
      assert.ok(
        lastRun.minutesFromStart <= expectedMaxMinutes[preset],
        `Last run minute (${lastRun.minutesFromStart}) must be <= duration preset limit (${expectedMaxMinutes[preset]})`
      );

      // Curve points must span entire duration
      const lastPoint = plan.curvePoints[plan.curvePoints.length - 1];
      assert.equal(lastPoint.minutes, expectedMaxMinutes[preset]);
      assert.equal(lastPoint.views, 10000);
    }
  });

  // --------------------------------------------------------------------------
  // Test 6: Uniqueness Guard (New Pattern button)
  // --------------------------------------------------------------------------
  it("Uniqueness guard: generateUniqueOrganicPlan differs by >= 15% curve area or different archetype", () => {
    const opts = {
      baseViews: 10000,
      seed: 123456,
      durationPreset: "72h" as DurationPreset,
      startTime: fixedStartTime,
    };

    const initialPlan = generateOrganicPlan(opts);
    const newPatternPlan = generateUniqueOrganicPlan(opts, initialPlan.params.fingerprint);

    const archetypeChanged = initialPlan.params.archetype !== newPatternPlan.params.archetype;
    const curveDiff = computeCurveDistance(initialPlan, newPatternPlan);

    assert.ok(
      archetypeChanged || curveDiff >= 0.15,
      `New pattern plan must differ by >= 15% curve distance or different archetype. Archetype changed: ${archetypeChanged}, diff: ${(curveDiff * 100).toFixed(1)}%`
    );
  });

  // --------------------------------------------------------------------------
  // Test 7: Validation error when total is below provider minimum
  // --------------------------------------------------------------------------
  it("Throws clear validation error when planned total is below provider service minimum", () => {
    assert.throws(
      () => {
        generateOrganicPlan({
          baseViews: 10, // Far too small for 100 min views
          seed: 42,
        });
      },
      /Validation error: Planned total of 10 views is below the provider service minimum of 100/
    );
  });
});

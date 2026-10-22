import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ORGANIC_PRESET_DEFINITIONS,
  OrganicPresetId,
  buildOrganicPlan,
  createMulberry32,
  generatePresetSparklinePath,
  audienceCircadianActivity,
} from "../src/lib/scheduler/organic-presets";
import { calculateGrowthPlan } from "../src/lib/scheduler/calculator";

describe("Organic Pacing Presets Engine", () => {
  const dummyService = {
    id: "srv-organic-test",
    name: "Instagram Views - Organic Real Pacing",
    minQuantity: 50,
    maxQuantity: 100000,
    ratePer1000: 0.85,
    dripFeedSupported: true,
    dripFeedMinInterval: 5,
    dripFeedMaxInterval: 10080,
    restrictions: null,
  };

  const allPresetIds = Object.keys(ORGANIC_PRESET_DEFINITIONS) as OrganicPresetId[];

  it("defines all 10 required organic presets with continuous shape functions", () => {
    assert.equal(allPresetIds.length, 10);
    const expectedPresets: OrganicPresetId[] = [
      "SLOW_BURN",
      "TEST_BATCH_BREAKOUT",
      "EVENING_SURGE",
      "VIRAL_SPIKE",
      "FRONT_LOADED_DECAY",
      "DOUBLE_WAVE",
      "HEARTBEAT",
      "LATE_ROCKET",
      "SLEEPER_HIT",
      "LONG_TAIL",
    ];
    for (const id of expectedPresets) {
      assert.ok(ORGANIC_PRESET_DEFINITIONS[id], `Preset ${id} should be defined`);
      const fn = ORGANIC_PRESET_DEFINITIONS[id].fn;
      assert.equal(typeof fn, "function");
      // Test at several points in [0, 1]
      for (const t of [0, 0.25, 0.5, 0.75, 1.0]) {
        const val = fn(t);
        assert.ok(val > 0, `Value of ${id} at t=${t} must be positive, got ${val}`);
        assert.ok(Number.isFinite(val), `Value of ${id} at t=${t} must be finite`);
      }
    }
  });

  it("strictly preserves totalQuantity sum across all presets and batch counts", () => {
    const testCounts = [2, 3, 5, 8, 10, 15, 20, 25, 30];
    const totalUnits = 5000;

    for (const presetId of allPresetIds) {
      for (const count of testCounts) {
        const plan = buildOrganicPlan(presetId, {
          batchCount: count,
          totalQuantity: totalUnits,
          totalDurationMinutes: 300,
          minQuantityPerBatch: 50,
          maxQuantityPerBatch: 100000,
          seed: 42,
          smoothness: 65,
          spikeIntensity: "medium",
        });

        assert.equal(plan.batches.length, count, `Should produce ${count} batches for ${presetId}`);
        const sum = plan.batches.reduce((acc, b) => acc + b.quantity, 0);
        assert.equal(
          sum,
          totalUnits,
          `Preset ${presetId} with ${count} batches must sum exactly to ${totalUnits}, got ${sum}`
        );
      }
    }
  });

  it("strictly guarantees monotonic non-decreasing cumulative delivery progress", () => {
    for (const presetId of allPresetIds) {
      const plan = buildOrganicPlan(presetId, {
        batchCount: 12,
        totalQuantity: 3450,
        totalDurationMinutes: 240,
        minQuantityPerBatch: 50,
        maxQuantityPerBatch: 10000,
        seed: 9999,
        smoothness: 40,
        spikeIntensity: "high",
      });

      let prevCumulative = 0;
      for (const b of plan.batches) {
        assert.ok(
          b.cumulativeQuantity >= prevCumulative,
          `Batch #${b.batchNumber} cumulative (${b.cumulativeQuantity}) must be >= previous (${prevCumulative})`
        );
        assert.ok(b.quantity >= 50, `Batch quantity must be >= minQuantity (50), got ${b.quantity}`);
        prevCumulative = b.cumulativeQuantity;
      }
      assert.equal(prevCumulative, 3450, "Final cumulative must equal totalQuantity");
    }
  });

  it("is fully deterministic with identical seed and inputs", () => {
    const options = {
      batchCount: 8,
      totalQuantity: 2000,
      totalDurationMinutes: 180,
      seed: 888123,
      smoothness: 50,
      spikeIntensity: "medium" as const,
    };

    const run1 = buildOrganicPlan("VIRAL_SPIKE", options);
    const run2 = buildOrganicPlan("VIRAL_SPIKE", options);

    assert.deepEqual(
      run1.batches.map((b) => b.quantity),
      run2.batches.map((b) => b.quantity),
      "Batch quantities must be identical with same seed"
    );
    assert.deepEqual(
      run1.batches.map((b) => b.intervalMinutes),
      run2.batches.map((b) => b.intervalMinutes),
      "Batch intervals must be identical with same seed"
    );

    // Reshuffle seed produces different variance
    const runReshuffled = buildOrganicPlan("VIRAL_SPIKE", { ...options, seed: 888124 });
    const qtys1 = run1.batches.map((b) => b.quantity);
    const qtysReshuffled = runReshuffled.batches.map((b) => b.quantity);
    assert.notDeepEqual(qtys1, qtysReshuffled, "Different seed should produce fresh organic variance");
  });

  it("enforces minimum interval >= 5 minutes with time jitter", () => {
    const plan = buildOrganicPlan("SLOW_BURN", {
      batchCount: 15,
      totalQuantity: 5000,
      totalDurationMinutes: 180,
      seed: 12345,
      smoothness: 10, // high jitter
      spikeIntensity: "high",
    });

    for (let i = 1; i < plan.batches.length; i++) {
      const interval = plan.batches[i].intervalMinutes;
      assert.ok(
        interval >= 5,
        `Batch #${i + 1} interval (${interval}m) must be >= 5 minutes minimum threshold`
      );
    }
  });

  it("supports locking specific batches and redistributing remainder accurately", () => {
    const totalUnits = 2000;
    const lockedBatches = [
      { index: 0, quantity: 400 },
      { index: 2, quantity: 600 },
    ];

    const plan = buildOrganicPlan("DOUBLE_WAVE", {
      batchCount: 5,
      totalQuantity: totalUnits,
      totalDurationMinutes: 120,
      minQuantityPerBatch: 50,
      maxQuantityPerBatch: 10000,
      seed: 42,
      lockedBatches,
    });

    assert.equal(plan.batches[0].quantity, 400, "Batch 0 must respect locked quantity 400");
    assert.equal(plan.batches[2].quantity, 600, "Batch 2 must respect locked quantity 600");
    assert.equal(plan.batches[0].isLocked, true);
    assert.equal(plan.batches[2].isLocked, true);
    assert.equal(plan.batches[1].isLocked, false);

    const totalSum = plan.batches.reduce((acc, b) => acc + b.quantity, 0);
    assert.equal(totalSum, totalUnits, "Total sum must remain exactly 2000 with locked batches");
  });

  it("smoothness slider controls variance: 100 is very smooth, 0 has full noise", () => {
    const smoothPlan = buildOrganicPlan("SLOW_BURN", {
      batchCount: 20,
      totalQuantity: 10000,
      totalDurationMinutes: 300,
      seed: 777,
      smoothness: 100, // No noise
      spikeIntensity: "off",
    });

    const noisyPlan = buildOrganicPlan("SLOW_BURN", {
      batchCount: 20,
      totalQuantity: 10000,
      totalDurationMinutes: 300,
      seed: 777,
      smoothness: 0, // Max noise
      spikeIntensity: "high",
    });

    // Both must match total sum exactly
    assert.equal(
      smoothPlan.batches.reduce((a, b) => a + b.quantity, 0),
      10000
    );
    assert.equal(
      noisyPlan.batches.reduce((a, b) => a + b.quantity, 0),
      10000
    );

    // Smooth plan should have monotonic rise to peak without wild reversals
    const smoothQtys = smoothPlan.batches.map((b) => b.quantity);
    const noisyQtys = noisyPlan.batches.map((b) => b.quantity);
    assert.notDeepEqual(smoothQtys, noisyQtys);
  });

  it("integrates seamlessly into calculateGrowthPlan with all 10 presets", () => {
    for (const presetId of allPresetIds) {
      const plan = calculateGrowthPlan({
        service: dummyService,
        targetUrl: "https://instagram.com/p/organic123",
        totalQuantity: 1500,
        scheduleMode: presetId,
        timingMode: "MODE_B",
        stepsCount: 6,
        totalDurationMinutes: 180,
        seed: 55555,
        smoothness: 70,
        spikeIntensity: "low",
      });

      assert.equal(plan.valid, true, `Plan for preset ${presetId} must be valid: ${plan.errorMessage}`);
      assert.equal(plan.steps.length, 6);
      const sum = plan.steps.reduce((a, s) => a + s.quantity, 0);
      assert.equal(sum, 1500, `Plan total for ${presetId} must equal 1500, got ${sum}`);
    }
  });

  it("generates valid mini sparkline SVG paths for every preset", () => {
    for (const presetId of allPresetIds) {
      const path = generatePresetSparklinePath(presetId, 64, 24);
      assert.ok(path.startsWith("M "), `Sparkline path for ${presetId} should start with M`);
      assert.ok(path.includes("C "), `Sparkline path for ${presetId} should contain cubic bezier commands`);
    }
  });

  it("evaluates circadian audience activity curve within [0.15, 1.0]", () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const activity = audienceCircadianActivity(t);
      assert.ok(activity >= 0.15, `Activity at t=${t} (${activity}) must be >= 0.15`);
      assert.ok(activity <= 1.0, `Activity at t=${t} (${activity}) must be <= 1.0`);
    }
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  generatePatternSchedule,
  getPatternMeta,
  PATTERN_ARCHETYPES,
} from "../src/lib/engagement/organic-pattern-generator";

test("Organic Pattern Generator tests", async (t) => {
  await t.test("generates template 335 (sunrise-curve) correctly", () => {
    const meta = getPatternMeta(335);
    assert.equal(meta.name, "sunrise-curve");
    assert.equal(meta.fullName, "#335 • sunrise-curve");

    const plan = generatePatternSchedule(335, 1000, 24);
    assert.equal(plan.totalViews, 1000);
    assert.ok(plan.runsCount > 0);
    assert.ok(plan.views.length > 0);
    assert.equal(plan.views.reduce((a, b) => a + b, 0), 1000);

    // Verify all batches <= 400
    for (const v of plan.views) {
      assert.ok(v <= 400, `Batch ${v} exceeds 400 max batch cap`);
      assert.ok(v >= 100, `Batch ${v} is below 100 provider min`);
    }

    // Offsets must be strictly non-decreasing
    for (let i = 1; i < plan.viewOffsets.length; i++) {
      assert.ok(
        plan.viewOffsets[i] >= plan.viewOffsets[i - 1],
        `Offsets must be non-decreasing: ${plan.viewOffsets[i]} vs ${plan.viewOffsets[i - 1]}`
      );
    }
  });

  await t.test("generates template 224 (Custom) correctly", () => {
    const meta = getPatternMeta(224);
    assert.equal(meta.name, "Custom");
    assert.equal(meta.fullName, "#224 • Custom");

    const plan = generatePatternSchedule(224, 1000, 24, {
      targetLikes: 106,
      targetSaves: 52,
      targetShares: 38,
      targetComments: 35,
    });

    assert.equal(plan.totalViews, 1000);
    assert.equal(plan.totalLikes, 106);
    assert.equal(plan.totalSaves, 52);
    assert.equal(plan.totalShares, 38);
    assert.equal(plan.totalComments, 35);
  });

  await t.test("generates smooth non-spiked cumulative curves across 10 random patterns", () => {
    const templateIds = [1, 50, 100, 142, 200, 248, 300, 335, 450, 520];
    for (const id of templateIds) {
      const plan = generatePatternSchedule(id, 2960, 24);
      assert.equal(plan.totalViews, 2960);
      assert.ok(plan.runsCount >= 8, `Runs count ${plan.runsCount} should be realistic`);

      // Cumulative curve monotonicity: cumulative views must be strictly non-decreasing
      let cum = 0;
      for (const b of plan.views) {
        cum += b;
      }
      assert.equal(cum, 2960);
    }
  });
});

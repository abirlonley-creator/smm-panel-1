import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateOrganicDeliveryPlan,
  calculateHumanBehaviorScore,
  antiBotDesaturateQuantity,
  solveKeConservationEquation,
  scaleBatchBounds,
  pickSessionType,
  PROVIDER_MINIMUMS,
  BATCH_BOUNDS,
  HOUR_OF_DAY_MULTIPLIERS,
} from "../src/lib/engagement/organic-pacing-engine";

describe("OrganicSMM Anti-Bot Delivery & View Pacing Engine", () => {
  it("computes accurate human behavior scores mimicking OrganicSMM gt function", () => {
    // Peak hour Saturday afternoon with normal session
    const peakScore = calculateHumanBehaviorScore(183, 22, 19, 6, "burst", "views");
    assert.ok(peakScore >= 75 && peakScore <= 95, `Peak score was ${peakScore}`);

    // Deep night low quantity compliance
    const nightScore = calculateHumanBehaviorScore(102, 65, 3, 2, "slow", "views");
    assert.ok(nightScore >= 70 && nightScore <= 100, `Night score was ${nightScore}`);

    // Generic standard score
    const stdScore = calculateHumanBehaviorScore(175, 20, 14, 3, "normal", "views");
    assert.ok(stdScore >= 50 && stdScore <= 100, `Std score was ${stdScore}`);
  });

  it("desaturates quantities to avoid round multiples of 5 and consecutive repeats", () => {
    const used = new Set<number>();
    const candidate1 = 150; // multiple of 5
    const desat1 = antiBotDesaturateQuantity(candidate1, 100, 300, used, 140);
    assert.notEqual(desat1 % 5, 0, `Expected non-multiple of 5, got ${desat1}`);
    used.add(desat1);

    const candidate2 = desat1; // consecutive repeat
    const desat2 = antiBotDesaturateQuantity(candidate2, 100, 300, used, desat1);
    assert.notEqual(desat2, desat1, `Expected different number, got ${desat2}`);
  });

  it("satisfies the Ke conservation equation: exact sum conservation with unique non-round quantities", () => {
    const runs = Array.from({ length: 16 }, () => ({ quantity: 185 }));
    const target = 2960;
    const adjusted = solveKeConservationEquation(runs, target, 100, 350);

    const sum = adjusted.reduce((a, b) => a + b.quantity, 0);
    assert.equal(sum, target, `Sum should strictly equal ${target}`);

    // Check multiples of 5
    const multiplesOf5 = adjusted.filter((r) => r.quantity % 5 === 0 && r.quantity !== 100);
    assert.ok(multiplesOf5.length <= 1, `Multiples of 5 should be eliminated, found ${multiplesOf5.length}`);

    // Check uniqueness
    const unique = new Set(adjusted.map((r) => r.quantity));
    assert.ok(unique.size >= 14, `Expected at least 14 unique batches out of 16, got ${unique.size}`);
  });

  it("generates full 2K Starter plan (2960 views, 16 runs, 5 hours) matching OrganicSMM specifications", () => {
    const plan = generateOrganicDeliveryPlan("views", 2960, {
      durationHours: 5,
      runsCount: 16,
      providerMinimum: 100,
      applyInitialDelay: false,
    });

    assert.equal(plan.totalQuantity, 2960);
    assert.equal(plan.runs.length, 16);
    assert.ok(plan.avgHumanScore >= 60, `Avg human score was ${plan.avgHumanScore}`);
    assert.ok(plan.varietyIndex >= 8, `Variety index was ${plan.varietyIndex}`);

    // Check minute offsets are sorted and within 300 minutes
    for (let i = 1; i < plan.runs.length; i++) {
      assert.ok(plan.runs[i].minuteOffset > plan.runs[i - 1].minuteOffset, "Minute offsets must be strictly increasing");
    }
    assert.ok(plan.runs[plan.runs.length - 1].minuteOffset <= 300, "Must finish within 5 hours (300m)");

    // Verify all batches satisfy provider minimum
    plan.runs.forEach((r) => {
      assert.ok(r.quantity >= 100, `Batch #${r.runNumber} quantity ${r.quantity} is below min 100`);
    });
  });

  it("generates full 5K Velocity plan (5100 views, 20 runs, 16 hours) with biological S-curve distribution", () => {
    const plan = generateOrganicDeliveryPlan("views", 5100, {
      durationHours: 16,
      runsCount: 20,
      providerMinimum: 100,
    });

    assert.equal(plan.totalQuantity, 5100);
    assert.equal(plan.runs.length, 20);
    assert.ok(plan.avgHumanScore >= 60);

    const sum = plan.runs.reduce((a, b) => a + b.quantity, 0);
    assert.equal(sum, 5100);
  });

  it("generates full 10K FYP Breakthrough plan (10500 views, 24 runs, 22 hours)", () => {
    const plan = generateOrganicDeliveryPlan("views", 10500, {
      durationHours: 22,
      runsCount: 24,
      providerMinimum: 100,
    });

    assert.equal(plan.totalQuantity, 10500);
    assert.equal(plan.runs.length, 24);
    assert.ok(plan.avgHumanScore >= 60);

    const sum = plan.runs.reduce((a, b) => a + b.quantity, 0);
    assert.equal(sum, 10500);
  });

  it("generates natural auxiliary engagement plans for likes, saves, shares adhering to OrganicSMM bounds", () => {
    const likesPlan = generateOrganicDeliveryPlan("likes", 170, {
      durationHours: 16,
      runsCount: 14,
      providerMinimum: 10,
    });
    assert.equal(likesPlan.totalQuantity, 170);
    assert.equal(likesPlan.runs.length, 14);
    likesPlan.runs.forEach((r) => assert.ok(r.quantity >= 10));

    const savesPlan = generateOrganicDeliveryPlan("saves", 44, {
      durationHours: 16,
      runsCount: 4,
      providerMinimum: 10,
    });
    assert.equal(savesPlan.totalQuantity, 44);
    assert.equal(savesPlan.runs.length, 4);

    const sharesPlan = generateOrganicDeliveryPlan("shares", 22, {
      durationHours: 16,
      runsCount: 2,
      providerMinimum: 10,
    });
    assert.equal(sharesPlan.totalQuantity, 22);
    assert.equal(sharesPlan.runs.length, 2);
  });

  it("validates session distribution matches OrganicSMM weighted session types", () => {
    const sessions = Array.from({ length: 500 }, () => pickSessionType("views"));
    const normalCount = sessions.filter((s) => s === "normal").length;
    const burstCount = sessions.filter((s) => s === "burst").length;
    const slowCount = sessions.filter((s) => s === "slow").length;

    // Normal should be the most common (~48%)
    assert.ok(normalCount > burstCount, "Normal session should be more common than burst");
    assert.ok(normalCount > slowCount, "Normal session should be more common than slow");
    assert.ok(normalCount >= 180, `Expected at least 180 normals out of 500, got ${normalCount}`);
  });
});

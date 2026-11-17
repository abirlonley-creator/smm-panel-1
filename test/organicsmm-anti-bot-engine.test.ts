import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateOrganicDeliveryPlan,
  generateTikTokAlgorithmicPlan,
  generateOrganicSchedule,
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

  it("supports user-selected pacing strategies: s_curve, burst, normal, peak_hours, stealth", () => {
    const strategies = ["s_curve", "burst", "normal", "peak_hours", "stealth"] as const;
    const target = 5100;

    strategies.forEach((strat) => {
      const plan = generateOrganicDeliveryPlan("views", target, {
        durationHours: 16,
        runsCount: 20,
        providerMinimum: 100,
        pacingStrategy: strat,
        peakHoursEnabled: true,
      });

      assert.equal(plan.totalQuantity, target, `Strategy ${strat} must strictly conserve target quantity ${target}`);
      assert.equal(plan.runs.length, 20, `Strategy ${strat} must produce 20 runs`);
      assert.ok(plan.avgHumanScore >= 60, `Strategy ${strat} avgHumanScore ${plan.avgHumanScore} should be >= 60`);

      const sum = plan.runs.reduce((a, b) => a + b.quantity, 0);
      assert.equal(sum, target, `Strategy ${strat} sum must equal ${target}`);
      plan.runs.forEach((r) => {
        assert.ok(r.quantity >= 100, `Strategy ${strat} batch ${r.runNumber} quantity ${r.quantity} should be >= 100`);
      });
    });

    // Verify burst strategy is front-loaded
    const burstPlan = generateOrganicDeliveryPlan("views", target, {
      durationHours: 16,
      runsCount: 20,
      providerMinimum: 100,
      pacingStrategy: "burst",
    });
    const earlySum = burstPlan.runs.slice(0, 5).reduce((a, b) => a + b.quantity, 0);
    const lateSum = burstPlan.runs.slice(15, 20).reduce((a, b) => a + b.quantity, 0);
    assert.ok(earlySum > lateSum, `Burst strategy should front-load early runs: early ${earlySum} vs late ${lateSum}`);
  });

  it("generates TikTok algorithmic anti-radar plan with seed pool test (<240 views) and views-first gated likes", () => {
    const algo = generateTikTokAlgorithmicPlan(2960, {
      durationHours: 6,
      targetLikes: 42,
    });

    // 1. Initial batch must be a realistic test pool
    assert.ok(algo.views.quantities[0] <= 240, `Batch #1 views must be <= 240, was ${algo.views.quantities[0]}`);
    assert.ok(algo.views.quantities[0] >= 100, `Batch #1 views must be >= 100, was ${algo.views.quantities[0]}`);

    // 2. Likes must land AFTER initial views (views-first gating)
    assert.ok(algo.likes.minuteOffsets[0] >= 25, `Like wave #1 offset must be >= 25m, was ${algo.likes.minuteOffsets[0]}`);

    // 3. Strict conservation of target views
    const totalV = algo.views.quantities.reduce((a, b) => a + b, 0);
    assert.equal(totalV, 2960, "Total views must strictly equal 2960");

    // 4. Provider minimums respected
    algo.views.quantities.forEach((v) => assert.ok(v >= 100, `View batch ${v} below 100`));
    algo.likes.quantities.forEach((l) => assert.ok(l >= 10, `Like wave ${l} below 10`));
  });

  it("generates multi-day anti-radar 50K plan over 5 days (120h) with soft tail decay to evade radar detection", () => {
    const algo = generateTikTokAlgorithmicPlan(50600, {
      durationHours: 120,
      targetLikes: 2600,
      targetSaves: 520,
      targetShares: 210,
    });

    assert.equal(algo.metadata.totalDurationHours, 120, "Duration must be 120 hours (5 Days)");

    // Views sum conservation
    const sumViews = algo.views.quantities.reduce((a, b) => a + b, 0);
    assert.equal(sumViews, 50600, "Must conserve 50,600 views");

    // All provider minimums respected
    algo.views.quantities.forEach((v) => assert.ok(v >= 100, `View batch ${v} below 100`));
    algo.likes.quantities.forEach((l) => assert.ok(l >= 10, `Like wave ${l} below 10`));
    algo.saves.quantities.forEach((s) => assert.ok(s >= 10, `Save wave ${s} below 10`));
    algo.shares.quantities.forEach((sh) => assert.ok(sh >= 10, `Share wave ${sh} below 10`));

    // Must span across the full 5 days (> 100 hours of offsets)
    const maxOffsetMinutes = Math.max(...algo.views.minuteOffsets);
    assert.ok(maxOffsetMinutes >= 100 * 60, `Last batch offset should span multi-day, was ${maxOffsetMinutes / 60}h`);

    // Must have long-tail decay (final batch is smaller than peak batch)
    const peakBatch = Math.max(...algo.views.quantities);
    const lastBatch = algo.views.quantities[algo.views.quantities.length - 1];
    assert.ok(lastBatch < peakBatch, `Last batch (${lastBatch}) must be smaller than peak batch (${peakBatch}) to prevent cliff`);

    // Must NOT have massive view chunks (anti-radar micro-batching capped at 400)
    assert.ok(peakBatch <= 400, `Peak view batch (${peakBatch}) must be <= 400 to prevent radar spike`);
  });

  it("generates organic schedule using pure mathematical logistic S-curve with anti-spike clamping", () => {
    // 1. 2K views over 6 hours (360 mins)
    const schedule2k = generateOrganicSchedule(2000, 360, "views");
    assert.ok(schedule2k.length >= 8, `Expected >= 8 batches, got ${schedule2k.length}`);
    const sum2k = schedule2k.reduce((a, b) => a + b.quantity, 0);
    assert.equal(sum2k, 2000, `Sum must strictly equal 2000, got ${sum2k}`);

    schedule2k.forEach((b, idx) => {
      assert.ok(b.quantity >= 100, `Batch #${idx} quantity ${b.quantity} must be >= 100 (provider min)`);
      if (idx > 0) {
        assert.ok(b.minuteOffset > schedule2k[idx - 1].minuteOffset, "Minute offsets must be strictly increasing");
        const ratio = b.quantity / schedule2k[idx - 1].quantity;
        assert.ok(ratio <= 1.65, `Batch #${idx} jump ratio ${ratio.toFixed(2)} exceeds 1.65x`);
      }
    });

    // 2. 50K views over 120 hours (7200 mins) - Anti-radar micro-batching test
    const schedule50k = generateOrganicSchedule(50000, 7200, "views");
    const sum50k = schedule50k.reduce((a, b) => a + b.quantity, 0);
    assert.equal(sum50k, 50000, `Sum must strictly equal 50000, got ${sum50k}`);
    const peak50k = Math.max(...schedule50k.map((b) => b.quantity));
    assert.ok(peak50k <= 650, `Peak batch in 50k (${peak50k}) must be <= 650 to prevent bot radar triggers`);

    // Check no massive jumps in 50K
    for (let i = 1; i < schedule50k.length; i++) {
      const ratio = schedule50k[i].quantity / schedule50k[i - 1].quantity;
      assert.ok(ratio <= 1.65, `Batch #${i} jump ratio in 50k (${ratio.toFixed(2)}) exceeds 1.65x`);
    }

    // 3. Comments provider minimum test (min = 1)
    const commentsSchedule = generateOrganicSchedule(15, 360, "comments");
    const sumComments = commentsSchedule.reduce((a, b) => a + b.quantity, 0);
    assert.equal(sumComments, 15);
    commentsSchedule.forEach((c) => {
      assert.ok(c.quantity >= 1, `Comment quantity ${c.quantity} must be >= 1`);
    });
  });
});

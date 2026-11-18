import test from "node:test";
import assert from "node:assert/strict";
import {
  generatePattern,
  DEFAULT_PACKAGES,
  DEFAULT_PROVIDER_MINIMUMS,
  baseCurveF,
  baseCurveFPrime,
  formatDurationDaysHours,
} from "../src/lib/engagement/deterministic-pattern-engine";

test("Deterministic Anti-Radar Pattern Engine tests", async (t) => {
  await t.test("base curve F(t) = 0.04t + 0.96t^4 satisfies boundary conditions", () => {
    assert.equal(baseCurveF(0), 0);
    assert.equal(baseCurveF(1), 1.0);
    assert.equal(baseCurveFPrime(0), 0.04);
    assert.equal(baseCurveFPrime(1), 3.88);
    // Monotonicity
    for (let i = 0; i < 100; i++) {
      const t1 = i / 100;
      const t2 = (i + 1) / 100;
      assert.ok(baseCurveF(t2) >= baseCurveF(t1));
    }
  });

  await t.test("formats duration as 'X days Y hours'", () => {
    assert.equal(formatDurationDaysHours(6), "0 days 6 hours");
    assert.equal(formatDurationDaysHours(24), "1 days 0 hours");
    assert.equal(formatDurationDaysHours(48), "2 days 0 hours");
    assert.equal(formatDurationDaysHours(72), "3 days 0 hours");
    assert.equal(formatDurationDaysHours(120), "5 days 0 hours");
  });

  await t.test("same seed produces 100% identical schedule (deterministic)", () => {
    const pkg = DEFAULT_PACKAGES.tiktok_5k;
    const planA = generatePattern(pkg, 1500, "seed_alpha_123");
    const planB = generatePattern(pkg, 1500, "seed_alpha_123");

    assert.equal(planA.totalBatchesCount, planB.totalBatchesCount);
    assert.equal(planA.actualDurationHours, planB.actualDurationHours);
    assert.deepEqual(planA.batches, planB.batches);
  });

  await t.test("different seeds produce unique schedules", () => {
    const pkg = DEFAULT_PACKAGES.tiktok_5k;
    const planA = generatePattern(pkg, 1500, "seed_1");
    const planB = generatePattern(pkg, 1500, "seed_2");

    assert.notDeepEqual(planA.batches, planB.batches);
  });

  await t.test("2K Starter package matches all specifications", () => {
    const pkg = DEFAULT_PACKAGES.tiktok_2k;
    const plan = generatePattern(pkg, 500, "seed_2k_test");

    // Exact totals
    assert.equal(plan.viewsTotal, 2000);
    assert.equal(plan.likesTotal, 42);
    assert.equal(plan.savesTotal, 0);
    assert.equal(plan.sharesTotal, 0);

    const sumViews = plan.batches.filter((b) => b.service === "views").reduce((a, b) => a + b.quantity, 0);
    assert.equal(sumViews, 2000, "Views sum must equal 2000 exactly");

    const sumLikes = plan.batches.filter((b) => b.service === "likes").reduce((a, b) => a + b.quantity, 0);
    assert.equal(sumLikes, 42, "Likes sum must equal 42 exactly");

    // 2K only rule: likes in 3 irregular batches triggered at ~20%, ~45%, ~70% views
    const likesBatches = plan.batches.filter((b) => b.service === "likes");
    assert.equal(likesBatches.length, 3, "2K must have exactly 3 likes batches");

    // All on 15-minute grid (:00, :15, :30, :45)
    for (const b of plan.batches) {
      assert.equal(b.minuteOffset % 15, 0, `Batch minute ${b.minuteOffset} must be divisible by 15`);
    }

    // Provider minimums met (views >= 100, likes >= 10)
    for (const b of plan.batches) {
      if (b.service === "views") assert.ok(b.quantity >= 100, `View batch ${b.quantity} >= 100`);
      if (b.service === "likes") assert.ok(b.quantity >= 10, `Like batch ${b.quantity} >= 10`);
    }
  });

  await t.test("5K Velocity package matches all specifications", () => {
    const pkg = DEFAULT_PACKAGES.tiktok_5k;
    const plan = generatePattern(pkg, 2500, "seed_5k_test");

    // Exact totals
    assert.equal(plan.viewsTotal, 5000);
    assert.equal(plan.likesTotal, 180);
    assert.equal(plan.savesTotal, 40);
    assert.equal(plan.sharesTotal, 20);

    const sumViews = plan.batches.filter((b) => b.service === "views").reduce((a, b) => a + b.quantity, 0);
    const sumLikes = plan.batches.filter((b) => b.service === "likes").reduce((a, b) => a + b.quantity, 0);
    const sumSaves = plan.batches.filter((b) => b.service === "saves").reduce((a, b) => a + b.quantity, 0);
    const sumShares = plan.batches.filter((b) => b.service === "shares").reduce((a, b) => a + b.quantity, 0);

    assert.equal(sumViews, 5000);
    assert.equal(sumLikes, 180);
    assert.equal(sumSaves, 40);
    assert.equal(sumShares, 20);

    // Engagement never ahead of views
    let runningViews = 0;
    for (const b of plan.batches) {
      if (b.service === "views") runningViews += b.quantity;
      if (b.service === "likes" || b.service === "saves" || b.service === "shares") {
        assert.ok(runningViews > 0, "Engagement batch sent before any views arrived");
      }
    }
  });

  await t.test("10K, 15K, and 50K packages have exact totals and provider minimums", () => {
    for (const key of ["tiktok_10k", "tiktok_15k", "tiktok_50k"] as const) {
      const pkg = DEFAULT_PACKAGES[key];
      const plan = generatePattern(pkg, 8000, `seed_${key}`);

      const sumViews = plan.batches.filter((b) => b.service === "views").reduce((a, b) => a + b.quantity, 0);
      const sumLikes = plan.batches.filter((b) => b.service === "likes").reduce((a, b) => a + b.quantity, 0);
      const sumSaves = plan.batches.filter((b) => b.service === "saves").reduce((a, b) => a + b.quantity, 0);
      const sumShares = plan.batches.filter((b) => b.service === "shares").reduce((a, b) => a + b.quantity, 0);

      assert.equal(sumViews, pkg.views_total, `Views total exact for ${key}`);
      assert.equal(sumLikes, pkg.likes, `Likes total exact for ${key}`);
      assert.equal(sumSaves, pkg.saves, `Saves total exact for ${key}`);
      assert.equal(sumShares, pkg.shares, `Shares total exact for ${key}`);

      // All batches on 15m grid
      for (const b of plan.batches) {
        assert.equal(b.minuteOffset % 15, 0);
      }
    }
  });

  await t.test("No forbidden patterns in view batches", () => {
    const pkg = DEFAULT_PACKAGES.tiktok_10k;
    const plan = generatePattern(pkg, 5000, "seed_forbidden_check");
    const vBatches = plan.batches.filter((b) => b.service === "views").map((b) => b.quantity);

    // 1. No 3+ equal in a row
    for (let i = 2; i < vBatches.length; i++) {
      const threeEqual = vBatches[i] === vBatches[i - 1] && vBatches[i] === vBatches[i - 2];
      assert.ok(!threeEqual, `Found 3 equal batches in a row at index ${i}: ${vBatches[i]}`);
    }

    // 2. No monotonic run of 4 values (3 consecutive increases or decreases)
    for (let i = 3; i < vBatches.length; i++) {
      const rising = vBatches[i] > vBatches[i - 1] && vBatches[i - 1] > vBatches[i - 2] && vBatches[i - 2] > vBatches[i - 3];
      const falling = vBatches[i] < vBatches[i - 1] && vBatches[i - 1] < vBatches[i - 2] && vBatches[i - 2] < vBatches[i - 3];
      assert.ok(!rising, `Found 4 rising batches in a row at index ${i}`);
      assert.ok(!falling, `Found 4 falling batches in a row at index ${i}`);
    }

    // 3. No value repeated more than twice
    const freq = new Map<number, number>();
    for (const v of vBatches) {
      freq.set(v, (freq.get(v) || 0) + 1);
      assert.ok(freq.get(v)! <= 2, `Value ${v} repeated more than twice (${freq.get(v)} times)`);
    }

    // 4. Irregular gaps (1-6 ticks)
    const vTicks = plan.batches.filter((b) => b.service === "views").map((b) => b.tick);
    for (let i = 1; i < vTicks.length; i++) {
      const gap = vTicks[i] - vTicks[i - 1];
      assert.ok(gap >= 1 && gap <= 6, `Gap ${gap} between ticks ${vTicks[i - 1]} and ${vTicks[i]} outside 1-6`);
    }
  });

  await t.test("Peak hourly rate <= 3x average views rate", () => {
    for (const key of ["tiktok_5k", "tiktok_10k", "tiktok_15k", "tiktok_50k"] as const) {
      const pkg = DEFAULT_PACKAGES[key];
      const plan = generatePattern(pkg, 5000, `seed_peak_${key}`);
      assert.ok(
        plan.peakHourlyViewsRate <= plan.avgHourlyViewsRate * 3.0 + 10,
        `Peak hourly rate ${plan.peakHourlyViewsRate} exceeded 3x avg ${plan.avgHourlyViewsRate}`
      );
    }
  });

  await t.test("Engagement lags behind views and never leads", () => {
    const pkg = DEFAULT_PACKAGES.tiktok_15k;
    const plan = generatePattern(pkg, 5000, "seed_lag_test");

    let viewsSoFar = 0;
    for (const b of plan.batches) {
      if (b.service === "views") viewsSoFar += b.quantity;
      if (b.service !== "views") {
        assert.ok(viewsSoFar >= 100, `Engagement batch ${b.service} at tick ${b.tick} sent with only ${viewsSoFar} views`);
        assert.ok(b.minuteOffset >= 15, `Engagement cannot be sent at minute 0`);
      }
    }
  });

  await t.test("First push views match follower tiers", () => {
    const pkg = DEFAULT_PACKAGES.tiktok_10k;

    // < 1k followers: 300-500
    const planLow = generatePattern(pkg, 500, "seed_f_low");
    const pushLow = planLow.batches.filter((b) => b.service === "views" && b.tick <= 2).reduce((a, b) => a + b.quantity, 0);
    assert.ok(pushLow >= 290 && pushLow <= 550, `Push low was ${pushLow}`);

    // 1k-10k followers: 400-600
    const planMid = generatePattern(pkg, 5000, "seed_f_mid");
    const pushMid = planMid.batches.filter((b) => b.service === "views" && b.tick <= 2).reduce((a, b) => a + b.quantity, 0);
    assert.ok(pushMid >= 390 && pushMid <= 650, `Push mid was ${pushMid}`);

    // > 10k followers: 600-900
    const planHigh = generatePattern(pkg, 25000, "seed_f_high");
    const pushHigh = planHigh.batches.filter((b) => b.service === "views" && b.tick <= 2).reduce((a, b) => a + b.quantity, 0);
    assert.ok(pushHigh >= 580 && pushHigh <= 950, `Push high was ${pushHigh}`);
  });
});

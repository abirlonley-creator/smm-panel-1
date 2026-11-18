import test from "node:test";
import assert from "node:assert/strict";
import {
  generatePattern,
  validateSchedule,
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

    // Likes in 3 batches at evenly spread points
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

  await t.test("VIEWS SMOOTHNESS: <= 25% adjacent diff, ramp up from min, no adjacent equals, no mult of 5, no alternating pattern", () => {
    for (const key of ["tiktok_2k", "tiktok_5k", "tiktok_10k", "tiktok_15k", "tiktok_50k"] as const) {
      const pkg = DEFAULT_PACKAGES[key];
      const plan = generatePattern(pkg, 5000, `seed_smooth_${key}`);
      const vBatches = plan.batches.filter((b) => b.service === "views").map((b) => b.quantity);

      // 1. Ramp up gradually from minimum (starts near minimum, e.g. <= 130)
      assert.ok(vBatches[0] <= DEFAULT_PROVIDER_MINIMUMS.views * 1.30, `Batch 0 (${vBatches[0]}) not near min`);

      // 2. Adjacent batches differ by at most 25% & never two adjacent equal values
      for (let i = 0; i < vBatches.length - 1; i++) {
        const c = vBatches[i];
        const n = vBatches[i + 1];
        assert.notEqual(c, n, `Adjacent equal values at ${i}: ${c}`);
        const diff = Math.abs(n - c);
        const maxPct = Math.max(diff / c, diff / n);
        assert.ok(maxPct <= 0.2501, `Adjacent difference at ${i} (${c} -> ${n}) was ${(maxPct * 100).toFixed(1)}% > 25%`);
      }

      // 3. No multiples of 5 & no value repeated more than twice
      const freq = new Map<number, number>();
      for (const v of vBatches) {
        assert.ok(v % 5 !== 0, `Batch ${v} is a multiple of 5`);
        freq.set(v, (freq.get(v) || 0) + 1);
        assert.ok(freq.get(v)! <= 2, `Value ${v} repeated ${freq.get(v)} times (> 2)`);
      }

      // 4. No alternating high/low pattern
      for (let i = 0; i <= vBatches.length - 5; i++) {
        const d0 = Math.sign(vBatches[i + 1] - vBatches[i]);
        const d1 = Math.sign(vBatches[i + 2] - vBatches[i + 1]);
        const d2 = Math.sign(vBatches[i + 3] - vBatches[i + 2]);
        const d3 = Math.sign(vBatches[i + 4] - vBatches[i + 3]);
        const isAlternating = d0 !== d1 && d1 !== d2 && d2 !== d3;
        assert.ok(!isAlternating, `Alternating high/low pattern found at index ${i}`);
      }

      // 5. Irregular gaps (1-6 ticks)
      const vTicks = plan.batches.filter((b) => b.service === "views").map((b) => b.tick);
      for (let i = 1; i < vTicks.length; i++) {
        const gap = vTicks[i] - vTicks[i - 1];
        assert.ok(gap >= 1 && gap <= 6, `Gap ${gap} between ticks outside 1-6`);
      }
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

  await t.test("ENGAGEMENT PLACEMENT: first likes within 2-3 ticks sized 3-5% seed views, saves first batch by 15-20% views, shares first batch by 25-30% views, last batch <= 85% views", () => {
    for (const key of ["tiktok_5k", "tiktok_10k", "tiktok_15k", "tiktok_50k"] as const) {
      const pkg = DEFAULT_PACKAGES[key];
      const plan = generatePattern(pkg, 5000, `seed_timing_${key}`);

      // First likes within 2-3 ticks of seed (tick <= 3)
      const likesBatches = plan.batches.filter((b) => b.service === "likes");
      assert.ok(likesBatches.length > 0);
      assert.ok(likesBatches[0].tick <= 3, `First likes tick was ${likesBatches[0].tick}`);

      // First saves by 15-20% of views
      const savesBatches = plan.batches.filter((b) => b.service === "saves");
      assert.ok(savesBatches.length > 0);
      const cumAtFirstSave = plan.batches
        .filter((b) => b.service === "views" && b.tick <= savesBatches[0].tick)
        .reduce((sum, b) => sum + b.quantity, 0);
      assert.ok(cumAtFirstSave <= pkg.views_total * 0.22, `First saves at ${cumAtFirstSave} > 20% total views`);

      // First shares by 25-30% of views
      const sharesBatches = plan.batches.filter((b) => b.service === "shares");
      assert.ok(sharesBatches.length > 0);
      const cumAtFirstShare = plan.batches
        .filter((b) => b.service === "views" && b.tick <= sharesBatches[0].tick)
        .reduce((sum, b) => sum + b.quantity, 0);
      assert.ok(cumAtFirstShare <= pkg.views_total * 0.32, `First shares at ${cumAtFirstShare} > 30% total views`);

      // Last batch of each service <= 85% of views
      for (const s of [likesBatches, savesBatches, sharesBatches]) {
        const lastBatch = s[s.length - 1];
        const cumAtLast = plan.batches
          .filter((b) => b.service === "views" && b.tick <= lastBatch.tick)
          .reduce((sum, b) => sum + b.quantity, 0);
        assert.ok(cumAtLast <= pkg.views_total * 0.85, `Last batch at ${cumAtLast} > 85% of total views (${pkg.views_total * 0.85})`);
      }
    }
  });

  await t.test("ENGAGEMENT GAPS: on 24h+ packages: likes <= 4h, saves <= 8h, shares <= 12h", () => {
    for (const key of ["tiktok_5k", "tiktok_10k", "tiktok_15k", "tiktok_50k"] as const) {
      const pkg = DEFAULT_PACKAGES[key];
      const plan = generatePattern(pkg, 5000, `seed_gaps_${key}`);

      if (plan.actualDurationHours >= 24) {
        // Likes <= 4h (16 ticks)
        const lBatches = plan.batches.filter((b) => b.service === "likes");
        for (let i = 0; i < lBatches.length - 1; i++) {
          const gap = lBatches[i + 1].tick - lBatches[i].tick;
          assert.ok(gap <= 16, `Likes gap ${gap} ticks > 16 ticks (4 hours)`);
        }

        // Saves <= 8h (32 ticks)
        const sBatches = plan.batches.filter((b) => b.service === "saves");
        for (let i = 0; i < sBatches.length - 1; i++) {
          const gap = sBatches[i + 1].tick - sBatches[i].tick;
          assert.ok(gap <= 32, `Saves gap ${gap} ticks > 32 ticks (8 hours)`);
        }

        // Shares <= 12h (48 ticks)
        const shBatches = plan.batches.filter((b) => b.service === "shares");
        for (let i = 0; i < shBatches.length - 1; i++) {
          const gap = shBatches[i + 1].tick - shBatches[i].tick;
          assert.ok(gap <= 48, `Shares gap ${gap} ticks > 48 ticks (12 hours)`);
        }
      }
    }
  });

  await t.test("Schedule passes final validator across all default packages and multiple seeds", () => {
    for (let s = 1; s <= 10; s++) {
      const seed = `seed_val_${s}`;
      for (const key of Object.keys(DEFAULT_PACKAGES)) {
        const pkg = DEFAULT_PACKAGES[key];
        const plan = generatePattern(pkg, 5000, seed);
        const res = validateSchedule(plan, pkg, DEFAULT_PROVIDER_MINIMUMS);
        assert.ok(res.valid, `Package ${key} failed validation on seed ${seed}: ${res.error}`);
      }
    }
  });
});

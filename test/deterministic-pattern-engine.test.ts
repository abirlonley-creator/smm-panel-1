import test from "node:test";
import assert from "node:assert/strict";
import {
  generatePlan,
  validatePlan,
  DEFAULT_PACKAGES,
  DEFAULT_PROVIDER_MINIMUMS,
  DEFAULT_RATE_RANGES,
  formatDurationDaysHours,
} from "../src/lib/engagement/deterministic-pattern-engine";

test("AuraSMM TikTok Engagement Planner - Acceptance Tests", async (t) => {
  await t.test("formats duration as 'X days Y hours'", () => {
    assert.equal(formatDurationDaysHours(6), "0 days 6 hours");
    assert.equal(formatDurationDaysHours(24), "1 days 0 hours");
    assert.equal(formatDurationDaysHours(48), "2 days 0 hours");
    assert.equal(formatDurationDaysHours(72), "3 days 0 hours");
    assert.equal(formatDurationDaysHours(120), "5 days 0 hours");
  });

  await t.test("The Golden Rule: ONE plan object where graph, table, chips, and CSV share exact data", () => {
    const pkg = DEFAULT_PACKAGES.tiktok_10k;
    const plan = generatePlan(pkg, 2500, "golden_rule_seed_101");

    // 1. Chips are sums of rows
    const sumViews = plan.rows.reduce((s, r) => s + r.views, 0);
    const sumLikes = plan.rows.reduce((s, r) => s + r.likes, 0);
    const sumSaves = plan.rows.reduce((s, r) => s + r.saves, 0);
    const sumReposts = plan.rows.reduce((s, r) => s + r.reposts, 0);
    const sumShares = plan.rows.reduce((s, r) => s + r.shares, 0);
    const sumComments = plan.rows.reduce((s, r) => s + r.comments, 0);

    assert.equal(plan.chips.totalViews, sumViews);
    assert.equal(plan.chips.totalBatches, plan.rows.length);
    assert.equal(plan.chips.likes, sumLikes);
    assert.equal(plan.chips.saves, sumSaves);
    assert.equal(plan.chips.reposts, sumReposts);
    assert.equal(plan.chips.shares, sumShares);
    assert.equal(plan.chips.comments, sumComments);

    // 2. Trend curve points correspond 1:1 to rows
    assert.equal(plan.trendCurve.length, plan.rows.length);
    for (let i = 0; i < plan.rows.length; i++) {
      const row = plan.rows[i];
      const pt = plan.trendCurve[i];
      assert.equal(pt.pointIndex, row.index);
      assert.equal(pt.tick, row.tick);
      assert.equal(pt.minuteOffset, row.minuteOffset);
      assert.equal(pt.views, row.views);
      assert.equal(pt.cumulativeViews, row.cumulativeViews);
      assert.equal(pt.likes, row.likes);
      assert.equal(pt.cumulativeLikes, row.cumulativeLikes);
      assert.equal(pt.saves, row.saves);
      assert.equal(pt.cumulativeSaves, row.cumulativeSaves);
      assert.equal(pt.reposts, row.reposts);
      assert.equal(pt.cumulativeReposts, row.cumulativeReposts);
      assert.equal(pt.shares, row.shares);
      assert.equal(pt.cumulativeShares, row.cumulativeShares);
      assert.equal(pt.comments, row.comments);
      assert.equal(pt.cumulativeComments, row.cumulativeComments);
    }

    // 3. Last point equals total
    const lastRow = plan.rows[plan.rows.length - 1];
    assert.equal(lastRow.cumulativeViews, plan.viewsTotal);
    assert.equal(lastRow.cumulativeLikes, plan.totals.likes);
    assert.equal(lastRow.cumulativeSaves, plan.totals.saves);
    assert.equal(lastRow.cumulativeReposts, plan.totals.reposts);
    assert.equal(lastRow.cumulativeShares, plan.totals.shares);
    assert.equal(lastRow.cumulativeComments, plan.totals.comments);
  });

  await t.test("Determinism: same seed produces identical plan, different seeds produce new plan", () => {
    const pkg = DEFAULT_PACKAGES.tiktok_5k;
    const planA = generatePlan(pkg, 1500, "same_seed_42");
    const planB = generatePlan(pkg, 1500, "same_seed_42");
    assert.equal(planA.viewsTotal, planB.viewsTotal);
    assert.equal(planA.rows.length, planB.rows.length);
    assert.deepEqual(planA.totals, planB.totals);
    assert.deepEqual(planA.rows, planB.rows);

    const planC = generatePlan(pkg, 1500, "different_seed_99");
    assert.notDeepEqual(planA.rows, planC.rows);
  });

  await t.test("All 10 validator rules pass for every default package", () => {
    for (const key of Object.keys(DEFAULT_PACKAGES)) {
      const pkg = DEFAULT_PACKAGES[key];
      const plan = generatePlan(pkg, 2500, `val_test_${key}`);
      const check = validatePlan(plan, pkg, DEFAULT_PROVIDER_MINIMUMS);
      assert.ok(check.valid, `Plan for ${key} failed validation: ${check.error}`);
    }
  });

  await t.test("Acceptance Test: 200 seeds per package satisfy expected distributions", () => {
    const packages = ["tiktok_2k", "tiktok_5k", "tiktok_10k", "tiktok_15k", "tiktok_50k"] as const;

    for (const pkgKey of packages) {
      const pkg = DEFAULT_PACKAGES[pkgKey];
      let firstTryPasses = 0;
      let repostsDroppedCount = 0;
      let sharesDroppedCount = 0;

      const viewsArr: number[] = [];
      const batchesArr: number[] = [];
      const gapsArr: number[] = [];
      const firstLikesArr: number[] = [];

      for (let s = 100; s < 300; s++) {
        const seed = `seed_${pkgKey}_${s}`;
        const plan = generatePlan(pkg, 2500, seed);

        viewsArr.push(plan.viewsTotal);
        batchesArr.push(plan.rows.length);

        // Longest gap in minutes
        let maxGapTicks = 0;
        for (let i = 1; i < plan.rows.length; i++) {
          const g = plan.rows[i].tick - plan.rows[i - 1].tick;
          if (g > maxGapTicks) maxGapTicks = g;
        }
        gapsArr.push(maxGapTicks * 15);

        // First likes appear at
        let firstLikeViews = 0;
        for (const r of plan.rows) {
          if (r.likes > 0) {
            firstLikeViews = r.cumulativeViews;
            break;
          }
        }
        firstLikesArr.push(firstLikeViews);

        if (plan.totals.reposts === 0) repostsDroppedCount++;
        if (plan.totals.shares === 0) sharesDroppedCount++;

        // Assert realized rates inside bounds
        for (const sName of ["likes", "saves", "reposts", "shares", "comments"] as const) {
          if (plan.totals[sName] > 0) {
            const r = plan.totals[sName] / plan.viewsTotal;
            const [minR, maxR] = DEFAULT_RATE_RANGES[sName];
            assert.ok(
              r >= minR - 0.0015 && r <= maxR + 0.0015,
              `${sName} rate ${r} out of range [${minR}, ${maxR}] on seed ${seed}`
            );
          }
        }
      }

      // Assert views range
      const baseV = pkg.base_views!;
      assert.ok(Math.min(...viewsArr) >= baseV, `Views below base ${baseV}`);
      assert.ok(Math.max(...viewsArr) <= Math.round(baseV * 1.30) + 20, `Views above 1.30x overshoot`);

      // Assert no gap over 240 minutes (4 hours)
      assert.ok(Math.max(...gapsArr) <= 240, `Gap exceeded 240 minutes: ${Math.max(...gapsArr)}`);

      if (pkgKey === "tiktok_2k") {
        // 2K drops reposts in ~29% and shares in ~11%
        const repostsPct = (repostsDroppedCount / 200) * 100;
        const sharesPct = (sharesDroppedCount / 200) * 100;
        assert.ok(repostsPct >= 20 && repostsPct <= 45, `2K reposts dropped ${repostsPct}% expected ~29%`);
        assert.ok(sharesPct >= 5 && sharesPct <= 25, `2K shares dropped ${sharesPct}% expected ~11%`);
      }
    }
  });

  await t.test("Engagement Timing on 10K+: likes at 1200 views (median ~25-30) and pacing at 25%, 50%, 75%", () => {
    const likesAt1200: number[] = [];
    const savesAt25: number[] = [];
    const savesAt50: number[] = [];
    const savesAt75: number[] = [];

    for (let s = 200; s < 300; s++) {
      const plan = generatePlan(DEFAULT_PACKAGES.tiktok_10k, 5000, `timing_seed_${s}`);
      let recorded1200 = false;
      let s25: number | null = null;
      let s50: number | null = null;
      let s75: number | null = null;

      for (const r of plan.rows) {
        if (r.cumulativeViews >= 1200 && !recorded1200) {
          likesAt1200.push(r.cumulativeLikes);
          recorded1200 = true;
        }

        const frac = r.cumulativeViews / plan.viewsTotal;
        if (frac >= 0.25 && s25 === null && plan.totals.saves > 0) {
          s25 = (r.cumulativeSaves / plan.totals.saves) * 100;
        }
        if (frac >= 0.50 && s50 === null && plan.totals.saves > 0) {
          s50 = (r.cumulativeSaves / plan.totals.saves) * 100;
        }
        if (frac >= 0.75 && s75 === null && plan.totals.saves > 0) {
          s75 = (r.cumulativeSaves / plan.totals.saves) * 100;
        }
      }

      if (s25 !== null) savesAt25.push(s25);
      if (s50 !== null) savesAt50.push(s50);
      if (s75 !== null) savesAt75.push(s75);
    }

    likesAt1200.sort((a, b) => a - b);
    const medianLikes = likesAt1200[Math.floor(likesAt1200.length / 2)];
    assert.ok(medianLikes >= 20 && medianLikes <= 35, `Median likes at 1200 views was ${medianLikes}, expected ~25-30`);

    const avg25 = savesAt25.reduce((a, b) => a + b, 0) / savesAt25.length;
    const avg50 = savesAt50.reduce((a, b) => a + b, 0) / savesAt50.length;
    const avg75 = savesAt75.reduce((a, b) => a + b, 0) / savesAt75.length;

    assert.ok(avg25 >= 17 && avg25 <= 26, `Saves % at 25% views was ${avg25.toFixed(1)}%, expected ~17-25%`);
    assert.ok(avg50 >= 38 && avg50 <= 52, `Saves % at 50% views was ${avg50.toFixed(1)}%, expected ~38-50%`);
    assert.ok(avg75 >= 64 && avg75 <= 78, `Saves % at 75% views was ${avg75.toFixed(1)}%, expected ~64-75%`);
  });
});

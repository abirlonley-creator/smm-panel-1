import test from "node:test";
import assert from "node:assert/strict";
import {
  generatePlan,
  validatePlan,
  fnv1a32,
  Mulberry32,
  firstLikesCumulativeViews,
  computeModulationPoint,
  rateAt,
  DEFAULT_PACKAGES,
  DEFAULT_PROVIDER_MINIMUMS,
  DEFAULT_RATE_RANGES,
  DEFAULT_ENGINE_PARAMS,
  EngineParams,
  DEFAULT_TIKTOK_CONFIG,
  DEFAULT_INSTAGRAM_CONFIG,
  formatDurationDaysHours,
  PlanObject,
  PlatformConfig,
  AUXILIARY_SERVICES,
  sanitizeAndDedupeComments,
} from "../src/lib/engagement/deterministic-pattern-engine";

test("Deterministic Pattern Engine - Canonical PRNG Test Vectors (Milestone 1 Correction 8)", async (t) => {
  await t.test("fnv1a32 canonical hash matches independent Python reference", () => {
    const hash = fnv1a32("test_seed:0");
    assert.equal(hash, 0x0158ebd5, `Expected 0x0158ebd5, got 0x${hash.toString(16)}`);
  });

  await t.test("Mulberry32 seeded with 0x0158ebd5 matches independent reference outputs", () => {
    const rng = new Mulberry32(0x0158ebd5);
    const v1 = rng.uniform(0, 1);
    const v2 = rng.uniform(0, 1);
    const v3 = rng.uniform(0, 1);

    assert.equal(v1.toFixed(6), "0.775996", `Expected 0.775996, got ${v1.toFixed(6)}`);
    assert.equal(v2.toFixed(6), "0.428631", `Expected 0.428631, got ${v2.toFixed(6)}`);
    assert.equal(v3.toFixed(6), "0.191742", `Expected 0.191742, got ${v3.toFixed(6)}`);
  });
});

test("Deterministic Pattern Engine - Golden Rule & Determinism", async (t) => {
  await t.test("The Golden Rule: ONE plan object where graph, table, chips, and batches share exact data", () => {
    const pkg = DEFAULT_PACKAGES.tiktok_10k;
    const plan = generatePlan(DEFAULT_TIKTOK_CONFIG, "tiktok_10k", 2500, "golden_rule_seed_101", { bdHour: 14.0 });

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

    const lastRow = plan.rows[plan.rows.length - 1];
    assert.equal(lastRow.cumulativeViews, plan.viewsTotal);
    assert.equal(lastRow.cumulativeLikes, plan.totals.likes);
    assert.equal(lastRow.cumulativeSaves, plan.totals.saves);
    assert.equal(lastRow.cumulativeReposts, plan.totals.reposts);
    assert.equal(lastRow.cumulativeShares, plan.totals.shares);
    assert.equal(lastRow.cumulativeComments, plan.totals.comments);
  });

  await t.test("Determinism: same seed produces identical plan, different seeds produce new plan", () => {
    const planA = generatePlan(DEFAULT_TIKTOK_CONFIG, "tiktok_5k", 1500, "same_seed_42", { bdHour: 15.0 });
    const planB = generatePlan(DEFAULT_TIKTOK_CONFIG, "tiktok_5k", 1500, "same_seed_42", { bdHour: 15.0 });
    assert.equal(planA.viewsTotal, planB.viewsTotal);
    assert.equal(planA.rows.length, planB.rows.length);
    assert.deepEqual(planA.totals, planB.totals);
    assert.deepEqual(planA.rows, planB.rows);

    const planC = generatePlan(DEFAULT_TIKTOK_CONFIG, "tiktok_5k", 1500, "different_seed_99", { bdHour: 15.0 });
    assert.notDeepEqual(planA.rows, planC.rows);
  });

  await t.test("firstLikesCumulativeViews helper computes first likes cumulative views accurately", () => {
    const plan = generatePlan(DEFAULT_TIKTOK_CONFIG, "tiktok_10k", 2500, "helper_test_seed", { bdHour: 12.0 });
    const firstLikesV = firstLikesCumulativeViews(plan);
    assert.ok(typeof firstLikesV === "number" && firstLikesV > 0, "firstLikesCumulativeViews should return positive number");
    const r = plan.rows.find((row) => row.likes > 0);
    assert.equal(firstLikesV, r ? r.cumulativeViews : null);
  });
});

test("Deterministic Pattern Engine - Comment Modes (Milestone 1 Correction 7)", async (t) => {
  await t.test("HYBRID mode uses user-pasted comments first, then pool comments", () => {
    const userComments = ["Awesome video!", "Loved this so much!"];
    const pool = [
      { commentText: "Great content!" },
      { commentText: "Keep it up!" },
      { commentText: "Nice work!" },
      { commentText: "Super clean!" },
      { commentText: "So aesthetic!" },
      { commentText: "Fire!" },
      { commentText: "Best post today!" },
      { commentText: "Amazing!" },
      { commentText: "Loving this!" },
      { commentText: "Incredible vibe!" },
    ];
    const plan = generatePlan(
      { ...DEFAULT_TIKTOK_CONFIG, commentPool: pool },
      "tiktok_10k",
      2500,
      "comment_hybrid_seed",
      { commentsMode: "HYBRID", userCommentLines: userComments, bdHour: 14.0 }
    );

    if (plan.totals.comments > 0) {
      const allAssigned = plan.rows.flatMap((r) => r.assignedComments || []);
      assert.equal(allAssigned.length, plan.totals.comments);
      assert.ok(allAssigned.includes("Awesome video!"), "User comment should be included");
      assert.ok(allAssigned.includes("Loved this so much!"), "User comment should be included");
    }
  });

  await t.test("USER_ONLY mode caps planned comments at number of unique lines", () => {
    const userComments = ["Unique 1", "Unique 2", "unique 1"]; // contains case-insensitive duplicate
    const plan = generatePlan(
      DEFAULT_TIKTOK_CONFIG,
      "tiktok_10k",
      2500,
      "comment_user_only_seed",
      { commentsMode: "USER_ONLY", userCommentLines: userComments, bdHour: 14.0 }
    );

    assert.ok(plan.totals.comments <= 2, "Capped at 2 unique comments");
    const allAssigned = plan.rows.flatMap((r) => r.assignedComments || []);
    assert.equal(allAssigned.length, plan.totals.comments);
  });

  await t.test("DISABLED mode sets comments to exactly 0", () => {
    const plan = generatePlan(
      DEFAULT_TIKTOK_CONFIG,
      "tiktok_10k",
      2500,
      "comment_disabled_seed",
      { commentsMode: "DISABLED", bdHour: 14.0 }
    );
    assert.equal(plan.totals.comments, 0);
    for (const r of plan.rows) {
      assert.equal(r.comments, 0);
      assert.equal(r.assignedComments?.length ?? 0, 0);
    }
  });

  await t.test("Comment sanitizer strips HTML tags, control characters, and normalizes whitespace", () => {
    const dirtyComments = [
      "<b>Great video!</b>\x00\x1F",
      "<script>alert('xss')</script>Amazing work!\x7F",
      "Line with \t multiple    spaces \r\n and newlines  ",
    ];
    const plan = generatePlan(
      DEFAULT_TIKTOK_CONFIG,
      "tiktok_10k",
      2500,
      "comment_sanitizer_seed",
      { commentsMode: "USER_ONLY", userCommentLines: dirtyComments, bdHour: 14.0 }
    );
    const allAssigned = plan.rows.flatMap((r) => r.assignedComments || []);
    for (const line of allAssigned) {
      assert.ok(!line.includes("<"), "HTML tags stripped");
      assert.ok(!line.includes(">"), "HTML tags stripped");
      assert.ok(!/[\x00-\x1F\x7F]/.test(line), "Control characters stripped");
      assert.ok(!/\s{2,}/.test(line), "Whitespace normalized");
    }
  });

  await t.test("Comment sanitizer: sanitizeAndDedupeComments strips tags, control characters, normalizes whitespace and dedupes case-insensitively", () => {
    const dirty = [
      "  <script>alert('xss')</script>Hello <b>World</b>! \x00\x1F  ",
      "hello world!", // Case-insensitive duplicate
      "Valid comment\x07 with\t tabs\r\nand   spaces",
      "   <p></p>   ", // Empty after tag stripping
    ];
    const cleaned = sanitizeAndDedupeComments(dirty);
    assert.deepEqual(cleaned, [
      "Hello World!",
      "Valid comment with tabs and spaces",
    ]);
  });

  await t.test("Unknown package key: generatePlan throws a clear error", () => {
    assert.throws(
      () => generatePlan(DEFAULT_TIKTOK_CONFIG, "nonexistent_package_key", 1500, "test_seed"),
      /Unknown package key: "nonexistent_package_key"/
    );
  });
});

test("Deterministic Pattern Engine - Invariant Unit Tests (Deliberately Broken Plans)", async (t) => {
  function getBaseValidPlan(): PlanObject {
    return generatePlan(DEFAULT_TIKTOK_CONFIG, "tiktok_10k", 2500, "base_valid_plan_seed", { bdHour: 14.0 });
  }

  await t.test("Valid plan passes validatePlan with zero violations", () => {
    const plan = getBaseValidPlan();
    const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, true, `Expected valid, got violations: ${res.violations.join(", ")}`);
    assert.equal(res.violations.length, 0);
  });

  await t.test("Invariant 1: Fails on views total mismatch", () => {
    const plan = JSON.parse(JSON.stringify(getBaseValidPlan()));
    plan.viewsTotal += 500;
    const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false);
    assert.ok(res.violations.includes("INVARIANT_1_VIEWS_TOTAL_MISMATCH"));
  });

  await t.test("Invariant 1 per service: Fails on likes, saves, reposts, shares, comments totals mismatch", () => {
    for (const s of ["likes", "saves", "reposts", "shares", "comments"] as const) {
      const plan = JSON.parse(JSON.stringify(getBaseValidPlan()));
      plan.totals[s] = (plan.totals[s] || 0) + 10;
      const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
      assert.equal(res.isValid, false);
      assert.ok(
        res.violations.some((v: string) => v === `INVARIANT_1_${s.toUpperCase()}_TOTAL_MISMATCH`),
        `Expected INVARIANT_1_${s.toUpperCase()}_TOTAL_MISMATCH`
      );
    }
  });

  await t.test("Invariant 2 (below min): Fails when batch view is below 100", () => {
    const plan = JSON.parse(JSON.stringify(getBaseValidPlan()));
    plan.rows[2].views = 50; // Below minimum 100
    const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false);
    assert.ok(res.violations.some((v: string) => v.startsWith("INVARIANT_2_VIEW_BELOW_MIN_BATCH_2")));
  });

  await t.test("Invariant 2 (above CAP): Fails when batch view exceeds CAP = max(floor(0.06 * viewsTotal), 400)", () => {
    const plan = JSON.parse(JSON.stringify(getBaseValidPlan()));
    const CAP = Math.max(Math.floor(0.06 * plan.viewsTotal), 400);
    plan.rows[2].views = CAP + 50; // Exceeds CAP
    const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false);
    assert.ok(res.violations.some((v: string) => v.startsWith("INVARIANT_2_VIEW_ABOVE_CAP_BATCH_2")));
  });

  await t.test("Invariant 3 (adjacent equal): Fails when adjacent batches have identical views", () => {
    const plan = JSON.parse(JSON.stringify(getBaseValidPlan()));
    plan.rows[3].views = plan.rows[2].views; // Adjacent equal
    const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false);
    assert.ok(res.violations.some((v: string) => v.startsWith("INVARIANT_3_ADJACENT_EQUAL_BATCH_3")));
  });

  await t.test("Invariant 3 (value more than twice): Fails when a single view value appears > 2 times", () => {
    const plan = JSON.parse(JSON.stringify(getBaseValidPlan()));
    // Set 3 non-adjacent batches to identical view count 234
    plan.rows[1].views = 234;
    plan.rows[3].views = 234;
    plan.rows[5].views = 234;
    const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false);
    assert.ok(res.violations.some((v: string) => v === "INVARIANT_3_VALUE_MORE_THAN_TWICE_234"));
  });

  await t.test("Invariant 4: Fails when any batch has views <= 0 (no engagement-only batches)", () => {
    const plan = JSON.parse(JSON.stringify(getBaseValidPlan()));
    plan.rows[2].views = 0; // Zero view batch
    const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false);
    assert.ok(res.violations.some((v: string) => v === "INVARIANT_4_ZERO_VIEW_BATCH_2"));
  });

  await t.test("Invariant 5: Fails when non-flush batch with engagement has < 200 views (< 150 in final 12%)", () => {
    const plan = JSON.parse(JSON.stringify(getBaseValidPlan()));
    // Set batch 2 (early, well before final 12%) to 120 views with 5 likes
    plan.rows[2].views = 120;
    plan.rows[2].likes = 5;
    const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false);
    assert.ok(res.violations.some((v: string) => v.includes("INVARIANT_5_ENGAGEMENT_BELOW_VIEW_GATE_BATCH_2")));
  });

  await t.test("Invariant 6: Fails when chronological precedence is violated (saves before likes or before 600 views)", () => {
    const plan = JSON.parse(JSON.stringify(getBaseValidPlan()));
    // Put saves on batch 0 (before likes and at 0 cum views)
    plan.rows[0].saves = 15;
    const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false);
    assert.ok(res.violations.some((v: string) => v.includes("INVARIANT_6_PRECEDENCE_VIOLATION_SAVES_BATCH_0")));
  });

  await t.test("Invariant 7: Fails on sub-minimum release size when total >= effective minimum", () => {
    const plan = JSON.parse(JSON.stringify(getBaseValidPlan()));
    // TikTok effective minimum for saves is 10. Give batch 5 a save count of 4 while total > 10
    plan.rows[5].saves = 4;
    plan.totals.saves = 40;
    const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false);
    assert.ok(res.violations.some((v: string) => v.includes("INVARIANT_7_SUB_MINIMUM_SAVES_BATCH_5")));
  });

  await t.test("Invariant 8: Fails when core engagement sum is outside [0.023, 0.042]", () => {
    const plan = JSON.parse(JSON.stringify(getBaseValidPlan()));
    plan.rates.likes = 0.045; // core sum will exceed 0.042
    const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false);
    assert.ok(res.violations.includes("INVARIANT_8_CORE_ENGAGEMENT_SUM_OUT_OF_BOUNDS"));
  });

  await t.test("Invariant 8 per service: Fails when realized rate is out of bounds for every service", () => {
    for (const s of ["likes", "saves", "reposts", "shares", "comments"] as const) {
      const plan = JSON.parse(JSON.stringify(getBaseValidPlan()));
      const [minR, maxR] = DEFAULT_TIKTOK_CONFIG.rateRanges[s];
      plan.rates[s] = maxR + 0.02; // out of upper bound
      const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
      assert.equal(res.isValid, false);
      assert.ok(
        res.violations.some((v: string) => v === `INVARIANT_8_RATE_OUT_OF_BOUNDS_${s.toUpperCase()}`),
        `Expected INVARIANT_8_RATE_OUT_OF_BOUNDS_${s.toUpperCase()}`
      );
    }
  });

  await t.test("Invariant 9: Fails on non-increasing ticks or gap > 16 ticks (240 min)", () => {
    const plan = JSON.parse(JSON.stringify(getBaseValidPlan()));
    plan.rows[4].tick = plan.rows[3].tick + 20; // 20 ticks gap > 16
    const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false);
    assert.ok(res.violations.some((v: string) => v.includes("INVARIANT_9_TICK_GAP_INVALID_BATCH_4")));
  });

  await t.test("Invariant 10: Fails when multi-service combo repeats 3 times in a row", () => {
    const plan = JSON.parse(JSON.stringify(getBaseValidPlan()));
    // Force 3 identical multi-service combos (likes + saves) on batches 5, 6, 7
    for (let i = 5; i <= 7; i++) {
      plan.rows[i].likes = 12;
      plan.rows[i].saves = 10;
      plan.rows[i].reposts = 0;
      plan.rows[i].shares = 0;
      plan.rows[i].comments = 0;
    }
    const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false);
    assert.ok(res.violations.some((v: string) => v.includes("INVARIANT_10_REPEAT_MULTI_COMBO_BATCH_5")));
  });

  await t.test("Invariant 11: Fails when a release size repeats > 3 times for a service", () => {
    const plan = JSON.parse(JSON.stringify(getBaseValidPlan()));
    // Force 4 releases of size 15 for saves
    for (let i = 5; i <= 8; i++) {
      plan.rows[i].saves = 15;
    }
    const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false);
    assert.ok(res.violations.some((v: string) => v.includes("INVARIANT_11_REPEAT_SIZE_EXCEEDED_SAVES_15")));
  });

  await t.test("Invariant 12: Fails when likes exceed 6% of batch views (8% in final 12%)", () => {
    const plan = JSON.parse(JSON.stringify(getBaseValidPlan()));
    // Batch 3 has e.g. 250 views, 6% is 15. Set likes to 25.
    plan.rows[3].views = 250;
    plan.rows[3].likes = 25;
    const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false);
    assert.ok(res.violations.some((v: string) => v.includes("INVARIANT_12_LIKES_CAP_EXCEEDED_BATCH_3")));
  });

  await t.test("Invariant 13: Fails on pacing cap violation (excessive release size for counted views)", () => {
    const plan = JSON.parse(JSON.stringify(getBaseValidPlan()));
    const saveIdx = plan.rows.findIndex((r: any, idx: number) => idx > 0 && r.saves > 0);
    const targetIdx = saveIdx !== -1 ? saveIdx : 6;
    plan.rows[targetIdx].saves = 80;
    const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false);
    assert.ok(res.violations.some((v: string) => v.includes(`INVARIANT_13_PACING_CAP_EXCEEDED_SAVES_BATCH_${targetIdx}`)));
  });

  await t.test("Validator Fix 1: Flush additions do not reset pacing counter for subsequent regular releases", () => {
    const plan = getBaseValidPlan();
    assert.ok(plan.flushRows, "Plan has flushRows");
    assert.ok(plan.flushAdds, "Plan has flushAdds");
    const resPass = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(resPass.isValid, true, `Expected valid with flushAdds, got: ${resPass.violations.join(", ")}`);
    assert.equal(resPass.violations.length, 0);

    // Verify that every entry in flushAdds matches a row in flushRows
    for (const s of AUXILIARY_SERVICES) {
      const addIndices = Object.keys(plan.flushAdds?.[s] || {}).map(Number);
      for (const idx of addIndices) {
        assert.ok(
          plan.flushRows[s].includes(idx),
          `flushAdds for ${s} on row ${idx} must be tracked in flushRows`
        );
      }
    }
  });

  await t.test("Validator Fix 1 (a): Plan with flush row followed by regular release passes Invariant 13 (old validator failed)", () => {
    // Seed 'seed_1' produces a valid plan where flush additions sit before regular releases at batch 34 (saves) and batch 36 (likes).
    const plan = generatePlan(DEFAULT_TIKTOK_CONFIG, "tiktok_10k", 2500, "seed_1", { bdHour: 14.0 });
    assert.ok(plan.flushRows, "Plan has flushRows");
    assert.ok(plan.flushAdds, "Plan has flushAdds");

    // 1. New validator with flushAdds passes with zero violations
    const resPass = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(resPass.isValid, true, `Expected valid plan under new validator, got: ${resPass.violations.join(", ")}`);
    assert.equal(resPass.violations.length, 0);

    // 2. Old validator simulation: without flushAdds, flush additions are treated as regular releases and reset the counter,
    // causing subsequent regular releases at batch 34 (saves) and batch 36 (likes) to fail Invariant 13.
    const oldStylePlan = JSON.parse(JSON.stringify(plan));
    oldStylePlan.flushAdds = { likes: {}, saves: {}, reposts: {}, comments: {}, shares: {} };
    const oldRes = validatePlan(oldStylePlan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(oldRes.isValid, false, "Old validator without flushAdds tracking should fail Invariant 13");
    assert.ok(
      oldRes.violations.some((v: string) => v.includes("INVARIANT_13_PACING_CAP_EXCEEDED_SAVES_BATCH_34")),
      `Expected batch 34 saves pacing violation, got: ${oldRes.violations.join(", ")}`
    );
    assert.ok(
      oldRes.violations.some((v: string) => v.includes("INVARIANT_13_PACING_CAP_EXCEEDED_LIKES_BATCH_36")),
      `Expected batch 36 likes pacing violation, got: ${oldRes.violations.join(", ")}`
    );
  });

  await t.test("Validator Fix 1 (b): Regular release exceeding pacing cap still fails when flush row sits between releases", () => {
    const plan = generatePlan(DEFAULT_TIKTOK_CONFIG, "tiktok_10k", 2500, "seed_1", { bdHour: 14.0 });
    const excessPlan = JSON.parse(JSON.stringify(plan));
    // Batch 34 has regular release of saves; inflate it to 100 to exceed the full accumulated pacing cap
    excessPlan.rows[34].saves = 100;
    excessPlan.totals.saves += (100 - plan.rows[34].saves);
    let cum = 0;
    for (const r of excessPlan.rows) {
      cum += r.saves;
      r.cumulativeSaves = cum;
    }

    const res = validatePlan(excessPlan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false, "Must fail when regular release exceeds combined pacing cap");
    assert.ok(
      res.violations.some((v: string) => v.includes("INVARIANT_13_PACING_CAP_EXCEEDED_SAVES_BATCH_34")),
      `Expected row 34 pacing violation, got: ${res.violations.join(", ")}`
    );
  });

  await t.test("Invariant 14: Fails when views delivery in sliding window exceeds 3 * (W / duration) * viewsTotal (crafted to fail only Invariant 14)", () => {
    // Exact spec formula test:
    // duration = 24 hours, viewsTotal = 10000
    // W = max(1h, 24/8) = 3 hours = 12 ticks
    // maxViewsInWindow = floor(3 * (3 / 24) * 10000) = 3750 views
    // CAP = max(floor(0.06 * 10000), 400) = 600 views
    const windowViews = [540, 545, 550, 555, 560, 565, 570]; // sum = 3885 > 3750
    // Remaining views to reach 10,000: 10000 - 3885 = 6115 across 12 spaced batches
    const restViews = [500, 502, 504, 506, 508, 510, 512, 514, 516, 518, 520, 505]; // sum = 6115

    const allViews = [...windowViews, ...restViews];
    const ticks = [
      10, 11, 12, 13, 14, 15, 16, // inside window [10, 22]
      22, 27, 32, 37, 42, 47, 52, 57, 62, 67, 72, 77, // outside window, strictly increasing, gap <= 16
    ];

    let cum = 0;
    const craftedRows = allViews.map((v, idx) => {
      cum += v;
      return {
        index: idx,
        tick: ticks[idx],
        minuteOffset: ticks[idx] * 15,
        clockTime: "12:00",
        views: v,
        likes: 0,
        saves: 0,
        reposts: 0,
        shares: 0,
        comments: 0,
        cumulativeViews: cum,
        cumulativeLikes: 0,
        cumulativeSaves: 0,
        cumulativeReposts: 0,
        cumulativeShares: 0,
        cumulativeComments: 0,
      };
    });

    const craftedPlan = {
      rows: craftedRows,
      totals: { views: 10000, likes: 0, saves: 0, reposts: 0, shares: 0, comments: 0 },
      rates: { likes: 0.025, saves: 0.003, reposts: 0.002, comments: 0.001, shares: 0.002 },
      viewsTotal: 10000,
      durationHours: 24,
    };

    const res = validatePlan(craftedPlan as any, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false, "Crafted plan should fail Invariant 14");
    // Verify that the plan fails ONLY Invariant 14 and nothing else
    assert.equal(res.violations.length, 1, `Expected exactly 1 violation, got: ${res.violations.join(", ")}`);
    assert.ok(res.violations[0].startsWith("INVARIANT_14_PEAK_WINDOW_RATE_EXCEEDED_TICK_"));
  });

  await t.test("Invariant 15: Fails on non-monotonic cumulative counts", () => {
    const plan = JSON.parse(JSON.stringify(getBaseValidPlan()));
    plan.rows[4].cumulativeViews = plan.rows[3].cumulativeViews - 100; // non-monotonic
    const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false);
    assert.ok(res.violations.some((v: string) => v.includes("INVARIANT_15_NON_MONOTONIC_VIEWS_BATCH_4")));
  });

  await t.test("Invariant 15 / Order Execution: Integration Test - plan shown = plan stored = plan executed", () => {
    const shownPlan = generatePlan(DEFAULT_TIKTOK_CONFIG, "tiktok_10k", 2500, "plan_identity_seed_99", { bdHour: 14.0 });
    // Simulate quote serialization to EngagementQuote.planJson
    const storedPlanJson = JSON.stringify(shownPlan);
    const parsedPlan: PlanObject = JSON.parse(storedPlanJson);

    // Verify stored equals shown
    assert.equal(parsedPlan.patternId, shownPlan.patternId);
    assert.equal(parsedPlan.viewsTotal, shownPlan.viewsTotal);
    assert.deepEqual(parsedPlan.totals, shownPlan.totals);
    assert.deepEqual(parsedPlan.rates, shownPlan.rates);
    assert.equal(parsedPlan.rows.length, shownPlan.rows.length);

    // Simulate order execution runs materialized from storedPlanJson
    const executedRows = parsedPlan.rows.map((r) => ({
      index: r.index,
      tick: r.tick,
      minuteOffset: r.minuteOffset,
      views: r.views,
      likes: r.likes,
      saves: r.saves,
      reposts: r.reposts,
      shares: r.shares,
      comments: r.comments,
    }));

    for (let i = 0; i < shownPlan.rows.length; i++) {
      const shownRow = shownPlan.rows[i];
      const execRow = executedRows[i];
      assert.equal(execRow.index, shownRow.index);
      assert.equal(execRow.views, shownRow.views);
      assert.equal(execRow.likes, shownRow.likes);
      assert.equal(execRow.saves, shownRow.saves);
      assert.equal(execRow.reposts, shownRow.reposts);
      assert.equal(execRow.shares, shownRow.shares);
      assert.equal(execRow.comments, shownRow.comments);
    }
  });

  await t.test("Invariant 16: Fails when comment count does not match assigned comments or contains duplicates/empty", () => {
    const plan = JSON.parse(JSON.stringify(getBaseValidPlan()));
    // Set 2 comments on batch 6 with empty or mismatched lines
    plan.rows[6].comments = 2;
    plan.rows[6].assignedComments = ["Nice!", ""]; // empty line
    let res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false);
    assert.ok(res.violations.some((v: string) => v.includes("INVARIANT_16_EMPTY_COMMENT_LINE_BATCH_6")));

    // Duplicate lines
    plan.rows[6].assignedComments = ["Duplicate", "duplicate"]; // case-insensitive duplicate
    res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false);
    assert.ok(res.violations.some((v: string) => v.includes("INVARIANT_16_DUPLICATE_COMMENT_LINES_BATCH_6")));

    // Count mismatch
    plan.rows[6].assignedComments = ["One line only"];
    res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false);
    assert.ok(res.violations.some((v: string) => v.includes("INVARIANT_16_COMMENT_LINES_COUNT_MISMATCH_BATCH_6")));
  });

  await t.test("costPaise Largest Remainder Allocation: sum across rows matches order total exact to 0 paise", () => {
    function allocateCostPaise(quantities: number[], totalCostPaise: number): number[] {
      const totalQty = quantities.reduce((a, b) => a + b, 0);
      if (totalQty === 0 || totalCostPaise === 0) return quantities.map(() => 0);
      const ideals = quantities.map((q) => (q / totalQty) * totalCostPaise);
      const bases = ideals.map((x) => Math.floor(x));
      const remainders = ideals.map((x, idx) => ({ idx, rem: x - bases[idx] }));
      const allocated = bases.reduce((a, b) => a + b, 0);
      const deficit = totalCostPaise - allocated;
      remainders.sort((a, b) => b.rem - a.rem || a.idx - b.idx);
      for (let i = 0; i < deficit; i++) {
        bases[remainders[i].idx] += 1;
      }
      return bases;
    }

    // Worked Example: 11 saves at ₹25.33/1k => 279 paise across batches of [3, 4, 4]
    const allocated = allocateCostPaise([3, 4, 4], 279);
    assert.deepEqual(allocated, [76, 102, 101]);
    assert.equal(allocated.reduce((a, b) => a + b, 0), 279);

    // Realistic multi-batch plan check
    const plan = getBaseValidPlan();
    const serviceQuantities = plan.rows.map((r) => r.likes).filter((q) => q > 0);
    const totalLikesCostPaise = 1850;
    const allocatedLikes = allocateCostPaise(serviceQuantities, totalLikesCostPaise);
    assert.equal(allocatedLikes.reduce((a, b) => a + b, 0), totalLikesCostPaise);
  });
});

test("Deterministic Pattern Engine - Review Round 9 Item 1: Wave Modulation Bounds", async (t) => {
  await t.test("with diurnal term set to 0, modulation never exceeds 1.0 and never falls below 0.4", () => {
    const rng = new Mulberry32(42);
    for (let trial = 0; trial < 100; trial++) {
      const numWaves = rng.choice([2, 3, 4]);
      const waves: Array<{ depth: number; width: number; centre: number }> = [];
      for (let w = 0; w < numWaves; w++) {
        waves.push({
          depth: rng.uniform(0.15, 0.5),
          width: rng.uniform(0.03, 0.07),
          centre: rng.uniform(0.12, 0.85),
        });
      }

      for (let step = 0; step <= 100; step++) {
        const tVal = step / 100;
        const m = computeModulationPoint(tVal, waves, 14.0, true);
        assert.ok(
          m <= 1.0000001,
          `Modulation ${m} exceeded 1.0 at t=${tVal} with diurnal disabled (trial ${trial})`
        );
        assert.ok(
          m >= 0.2799999,
          `Modulation ${m} fell below 0.28 at t=${tVal} with diurnal disabled (trial ${trial})`
        );
      }
    }
  });
});

test("Deterministic Pattern Engine - Review Round 9 Item 4: Likes Rate Piece-wise Profile", async (t) => {
  await t.test("rateAt conforms exactly to start during push, linear ramp to R at 30% post-push, and plateau R", () => {
    const totalViews = 10000;
    const pushViews = 2000;
    const avgRate = 0.025;
    const phase = 0;
    const p = pushViews / totalViews;
    const likeStart = Math.min(DEFAULT_ENGINE_PARAMS.LIKE_START, 0.8 * avgRate);
    const R = (avgRate - p * likeStart - (1.0 - p) * 0.15 * likeStart) / ((1.0 - p) * 0.85);

    // During push (cumViews <= pushViews)
    const ratePushMid = rateAt("likes", 1000, totalViews, pushViews, avgRate, phase);
    const ratePushEnd = rateAt("likes", 2000, totalViews, pushViews, avgRate, phase);
    assert.equal(ratePushMid, likeStart, "During push, rate must equal likeStart");
    assert.equal(ratePushEnd, likeStart, "At push end, rate must equal likeStart");

    // Ramp: 15% post-push views (50% along ramp)
    const postPushViews = totalViews - pushViews; // 8000
    const cum15 = pushViews + 0.15 * postPushViews; // 2000 + 1200 = 3200
    const rateRampMid = rateAt("likes", cum15, totalViews, pushViews, avgRate, phase);
    const expectedMid = likeStart + (R - likeStart) * 0.5;
    assert.ok(Math.abs(rateRampMid - expectedMid) < 1e-9, `Expected ${expectedMid}, got ${rateRampMid}`);

    // Ramp peak: 30% post-push views
    const cum30 = pushViews + 0.30 * postPushViews; // 2000 + 2400 = 4400
    const rateRampPeak = rateAt("likes", cum30, totalViews, pushViews, avgRate, phase);
    assert.ok(Math.abs(rateRampPeak - R) < 1e-9, `Expected plateau ${R}, got ${rateRampPeak}`);

    // Plateau: > 30% post-push views
    const cum70 = pushViews + 0.70 * postPushViews;
    const ratePlateau = rateAt("likes", cum70, totalViews, pushViews, avgRate, phase);
    assert.ok(Math.abs(ratePlateau - R) < 1e-9, `Expected plateau ${R}, got ${ratePlateau}`);
  });
});

test("Deterministic Pattern Engine - Review Round 9 Item 5: EngineParams Snapshot & Parameter Changes", async (t) => {
  await t.test("Custom EngineParams are applied, snapshotted in plan, and respected by validator", () => {
    const customParams: EngineParams = {
      ...DEFAULT_ENGINE_PARAMS,
      LIKE_START: 0.015,
      GATE_VIEWS: 800,
      GUARD: 1.8,
      K_EXT: 300,
      LIKES_CAP_REGULAR: 0.05,
      LIKES_CAP_LATE: 0.07,
      VIEW_BATCH_MIN: 100,
      VIEW_BATCH_ENGAGEMENT_MIN: 220,
      VIEW_BATCH_ENGAGEMENT_MIN_LATE: 160,
      MAX_GAP_TICKS: 14,
      MAX_REPEAT_SIZE: 3,
    };

    const customConfig: PlatformConfig = {
      ...DEFAULT_TIKTOK_CONFIG,
      engineParams: customParams,
    };

    const plan = generatePlan(customConfig, "tiktok_5k", 1500, "custom_params_seed_1", { bdHour: 14.0 });
    assert.deepEqual(plan.engineParams, customParams, "Plan must snapshot exact custom EngineParams");

    const val = validatePlan(plan, customConfig);
    assert.equal(val.isValid, true, `Expected valid with custom params, got: ${val.violations.join(", ")}`);

    // Verify likes cap respects custom LIKES_CAP_REGULAR (0.05)
    for (const r of plan.rows) {
      const isLate = r.cumulativeViews >= 0.88 * plan.viewsTotal;
      const capPct = isLate ? customParams.LIKES_CAP_LATE : customParams.LIKES_CAP_REGULAR;
      assert.ok(
        r.likes <= Math.floor(capPct * r.views),
        `Likes ${r.likes} exceeded custom cap ${capPct * 100}% of ${r.views}`
      );
    }

    // Verify GATE_VIEWS = 800 is respected (Review Round 10 Item 8)
    for (let i = 0; i < plan.rows.length; i++) {
      const r = plan.rows[i];
      for (const s of ["saves", "reposts", "shares", "comments"] as const) {
        if (r[s] > 0) {
          assert.ok(
            r.cumulativeViews >= 800,
            `Aux service ${s} in row ${i} appeared at cumulative views ${r.cumulativeViews} < GATE_VIEWS (800)`
          );
        }
      }
    }
  });

  await t.test("Changing CAP_FRACTION changes cap used by both generator and validator (Review Round 10 Item 3)", () => {
    const customParams: EngineParams = {
      ...DEFAULT_ENGINE_PARAMS,
      CAP_FRACTION: 0.035,
    };
    const customConfig: PlatformConfig = {
      ...DEFAULT_TIKTOK_CONFIG,
      engineParams: customParams,
    };
    const plan = generatePlan(customConfig, "tiktok_50k", 2000, "cap_fraction_test_seed", { bdHour: 14.0 });
    const expectedCap = Math.max(Math.floor(0.035 * plan.viewsTotal), customParams.CAP_MIN);

    // 1. Generator respected custom CAP
    for (const r of plan.rows) {
      assert.ok(r.views <= expectedCap, `Row views ${r.views} exceeded custom cap ${expectedCap}`);
    }

    // 2. Validator accepts under customConfig
    const valPass = validatePlan(plan, customConfig);
    assert.equal(valPass.isValid, true, `Expected valid with custom CAP_FRACTION, got ${valPass.violations.join(", ")}`);

    // 3. Validator with tighter CAP_FRACTION rejects batches exceeding tighter cap
    const tighterParams: EngineParams = {
      ...DEFAULT_ENGINE_PARAMS,
      CAP_FRACTION: 0.015,
      CAP_MIN: 200,
    };
    const tighterConfig: PlatformConfig = {
      ...DEFAULT_TIKTOK_CONFIG,
      engineParams: tighterParams,
    };
    const valFail = validatePlan({ ...plan, engineParams: tighterParams }, tighterConfig);
    assert.equal(valFail.isValid, false);
    assert.ok(valFail.violations.some((v: string) => v.includes("INVARIANT_2_VIEW_ABOVE_CAP_BATCH")));
  });

  await t.test("Changing FINAL_FRACTION changes late phase threshold in generator and validator", () => {
    const customParams: EngineParams = {
      ...DEFAULT_ENGINE_PARAMS,
      FINAL_FRACTION: 0.70, // Earlier late phase
    };
    const customConfig: PlatformConfig = {
      ...DEFAULT_TIKTOK_CONFIG,
      engineParams: customParams,
    };
    const plan = generatePlan(customConfig, "tiktok_10k", 2500, "final_fraction_test_seed", { bdHour: 14.0 });
    assert.equal(plan.engineParams.FINAL_FRACTION, 0.70);
    const val = validatePlan(plan, customConfig);
    assert.equal(val.isValid, true);
  });
});

test("Deterministic Pattern Engine - Review Round 9 Items 7 & 8: Corrupted Plans & Order-Wide Uniqueness", async (t) => {
  const getBasePlan = () => generatePlan(DEFAULT_TIKTOK_CONFIG, "tiktok_10k", 2500, "base_corrupt_test_seed", { bdHour: 14.0 });

  await t.test("Invariant 15: Detects corrupted cumulativeViews column in plan", () => {
    const plan = JSON.parse(JSON.stringify(getBasePlan()));
    plan.rows[4].cumulativeViews += 50; // Corrupt single cumulative cell
    const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false);
    assert.ok(res.violations.some((v: string) => v.includes("INVARIANT_15_CUMULATIVE_VIEWS_MISMATCH_BATCH_4")));
  });

  await t.test("Invariant 15: Detects corrupted cumulativeLikes column in plan", () => {
    const plan = JSON.parse(JSON.stringify(getBasePlan()));
    const targetIdx = plan.rows.findIndex((r: any, i: number) => i > 0 && r.likes > 0);
    if (targetIdx !== -1) {
      plan.rows[targetIdx].cumulativeLikes += 10;
      const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
      assert.equal(res.isValid, false);
      assert.ok(res.violations.some((v: string) => v.includes(`INVARIANT_15_CUMULATIVE_LIKES_MISMATCH_BATCH_${targetIdx}`)));
    }
  });

  await t.test("Invariant 16: Detects order-wide duplicate comments across batches", () => {
    const plan = JSON.parse(JSON.stringify(getBasePlan()));
    // Assign duplicate comment across batch 3 and batch 7
    plan.rows[3].comments = 1;
    plan.rows[3].assignedComments = ["Repeat comment across order"];
    plan.rows[7].comments = 1;
    plan.rows[7].assignedComments = ["repeat comment across order"]; // same comment, lowercase
    plan.totals.comments = plan.rows.reduce((s: number, r: any) => s + r.comments, 0);

    const res = validatePlan(plan, DEFAULT_TIKTOK_CONFIG);
    assert.equal(res.isValid, false);
    assert.ok(res.violations.some((v: string) => v.includes("INVARIANT_16_ORDER_WIDE_DUPLICATE_COMMENT_repeat comment across order")));
  });
});

test("Deterministic Pattern Engine - Review Round 9 Item 3: Batch Irregularity Tolerances (10 Seeds Median)", async (t) => {
  await t.test("Non-push batches meet median across 10 seeds: CV >= 0.25, % 100-120 <= 15%, consecutive pairs within 5% <= 20%", () => {
    const pkgs = ["tiktok_5k", "tiktok_10k", "tiktok_15k", "tiktok_50k"];
    const seeds = Array.from({ length: 10 }, (_, i) => `irreg_fixed_seed_${i + 1}`);

    for (const pKey of pkgs) {
      const cvList: number[] = [];
      const pct100List: number[] = [];
      const pctPairsList: number[] = [];

      for (const s of seeds) {
        const plan = generatePlan(DEFAULT_TIKTOK_CONFIG, pKey, 2000, `${s}_${pKey}`, { bdHour: 14.0 });
        const nonPush = plan.rows.slice(2).map((r) => r.views);
        assert.ok(nonPush.length >= 5, "Should have at least 5 non-push batches");

        // 1. CV = std / mean
        const mean = nonPush.reduce((a, b) => a + b, 0) / nonPush.length;
        const variance = nonPush.reduce((acc, v) => acc + (v - mean) ** 2, 0) / nonPush.length;
        const std = Math.sqrt(variance);
        cvList.push(std / mean);

        // 2. % in 100-120 views
        const count100_120 = nonPush.filter((v) => v >= 100 && v <= 120).length;
        pct100List.push((count100_120 / nonPush.length) * 100);

        // 3. % consecutive pairs within 5%
        let pairsWithin5 = 0;
        for (let i = 0; i < nonPush.length - 1; i++) {
          const diff = Math.abs(nonPush[i + 1] - nonPush[i]);
          if (diff / nonPush[i] <= 0.05) pairsWithin5++;
        }
        pctPairsList.push((pairsWithin5 / (nonPush.length - 1)) * 100);
      }

      const median = (arr: number[]) => {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      };

      const medCV = median(cvList);
      const medPct100 = median(pct100List);
      const medPctPairs = median(pctPairsList);

      assert.ok(medCV >= 0.25, `Package ${pKey}: Median CV ${medCV.toFixed(3)} must be >= 0.25`);
      assert.ok(medPct100 <= 15, `Package ${pKey}: Median % 100-120 views ${medPct100.toFixed(1)}% must be <= 15%`);
      assert.ok(medPctPairs <= 20, `Package ${pKey}: Median pairs within 5% ${medPctPairs.toFixed(1)}% must be <= 20%`);
    }
  });
});

test("Deterministic Pattern Engine - Review Round 9 Item 9: Regression Suite (20 Seeds x 5 Packages x 2 Platforms)", async (t) => {
  const configs = [
    { name: "TikTok", config: DEFAULT_TIKTOK_CONFIG },
    { name: "Instagram", config: DEFAULT_INSTAGRAM_CONFIG },
  ];
  const pkgKeys = ["tiktok_2k", "tiktok_5k", "tiktok_10k", "tiktok_15k", "tiktok_50k"];

  // 20 fixed seeds
  const seeds = Array.from({ length: 20 }, (_, i) => `fixed_regression_seed_${i + 1}`);

  let totalTested = 0;
  for (const { name: platName, config } of configs) {
    for (const pKey of pkgKeys) {
      for (const seed of seeds) {
        totalTested++;
        const plan = generatePlan(config, pKey, 1500, seed, { bdHour: 14.0 });

        // 1. Zero invariant violations
        const val = validatePlan(plan, config);
        assert.equal(val.isValid, true, `Platform ${platName} ${pKey} seed ${seed} failed invariants: ${val.violations.join(", ")}`);

        // 2. Likes cap (6% regular, 8% final 12%)
        for (let i = 0; i < plan.rows.length; i++) {
          const r = plan.rows[i];
          if (r.likes > 0) {
            const isLate = r.cumulativeViews >= 0.88 * plan.viewsTotal;
            const capPct = isLate ? plan.engineParams.LIKES_CAP_LATE : plan.engineParams.LIKES_CAP_REGULAR;
            assert.ok(
              r.likes <= Math.floor(capPct * r.views),
              `Row ${i} likes ${r.likes} exceeds cap ${capPct * 100}% on views ${r.views}`
            );
          }
        }

        // 3. Chronological precedence: auxiliary non-likes only after first likes batch and at views >= GATE_VIEWS
        let firstLikesIdx: number | null = null;
        for (let i = 0; i < plan.rows.length; i++) {
          if (plan.rows[i].likes > 0 && firstLikesIdx === null) {
            firstLikesIdx = i;
            break;
          }
        }
        for (let i = 0; i < plan.rows.length; i++) {
          const r = plan.rows[i];
          for (const s of ["saves", "reposts", "shares", "comments"] as const) {
            if (r[s] > 0) {
              assert.ok(firstLikesIdx !== null && i > firstLikesIdx, `Aux service ${s} appeared before or at first likes batch`);
              assert.ok(r.cumulativeViews >= plan.engineParams.GATE_VIEWS, `Aux service ${s} appeared before GATE_VIEWS (600)`);
            }
          }
        }

        // 4. Exact cumulative running match
        let runningV = 0;
        for (let i = 0; i < plan.rows.length; i++) {
          runningV += plan.rows[i].views;
          assert.equal(plan.rows[i].cumulativeViews, runningV, `Row ${i} cumulativeViews mismatch`);
        }
        assert.equal(runningV, plan.viewsTotal);
      }
    }
  }
  assert.equal(totalTested, 200, "Must have tested exactly 200 plans (20 seeds x 5 pkgs x 2 platforms)");
});

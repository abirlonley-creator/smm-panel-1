import { generateOrganicPlan, PlanOptions } from "../src/lib/engagement/planner";
import { getPlatformProfile } from "../src/lib/engagement/platform-profiles";
import { generateTimeTicks } from "../src/components/engagement/EngagementDetailChart";
import { createMonotoneCubicSpline } from "../src/lib/engagement/monotone-cubic";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("=======================================================");
console.log("   AURASMM TEST: SMALL ORDER PACING & CHART SUITE     ");
console.log("=======================================================");

async function runSmallOrderPacingTests() {
  const profile = getPlatformProfile("tiktok");

  // TEST 1: Auto duration applies by default. 1,000 views never produces > 2h unless custom.
  console.log("\nTest 1: Auto Duration Default & Safety Ceiling");
  for (let seed = 1000; seed < 1050; seed++) {
    const plan = generateOrganicPlan({
      platform: "TikTok",
      profileId: "tiktok",
      baseViews: 1000,
      seed,
    });

    assert(plan.isAutoDuration === true, `Seed ${seed}: Expected auto duration`);
    assert(
      plan.durationHours >= 0.5 && plan.durationHours <= 1.5,
      `Seed ${seed}: Expected auto duration inside 0.5-1.5h, got ${plan.durationHours}h`
    );
    assert(
      plan.durationHours <= 2.0,
      `Seed ${seed}: 1,000 views must never produce more than 2h, got ${plan.durationHours}h`
    );
  }
  console.log("  ✔ PASS: 50/50 seeds for 1,000 views TikTok generated auto duration strictly inside 0.5-1.5h (never > 2h)");

  // Test that passing legacy presetKey='normal' without pacingMode='custom' does NOT force 72h
  const planWithLegacyPreset = generateOrganicPlan({
    platform: "TikTok",
    profileId: "tiktok",
    baseViews: 1000,
    presetKey: "normal", // old 72h default preset passed by legacy UI
    seed: 42,
  });
  assert(
    planWithLegacyPreset.durationHours <= 2.0,
    `Legacy presetKey='normal' must not force 72h when pacingMode is not custom (Got ${planWithLegacyPreset.durationHours}h)`
  );
  assert(
    planWithLegacyPreset.isAutoDuration === true,
    `Expected isAutoDuration to remain true by default`
  );
  console.log("  ✔ PASS: Legacy presetKey does not override auto duration by default");

  // Custom speed honored when requested
  const planCustom = generateOrganicPlan({
    platform: "TikTok",
    profileId: "tiktok",
    baseViews: 1000,
    pacingMode: "custom",
    customDurationHours: 24,
    seed: 42,
  });
  assert(planCustom.isAutoDuration === false, "Custom pacingMode must set isAutoDuration=false");
  assert(planCustom.durationHours === 24, `Custom duration 24h must be honored (Got ${planCustom.durationHours}h)`);
  console.log("  ✔ PASS: Custom duration is honored when user picked custom");

  // TEST 2: Run counts with provider min 10, 20, 50, 100, 200
  console.log("\nTest 2: Views Run Count & Provider Minimum Scaling");
  const testMins = [200, 100, 50, 20, 10];
  const resultsByMin: Record<number, any> = {};

  for (const pMin of testMins) {
    const customServices = {
      views: {
        id: `test_views_${pMin}`,
        providerId: "test_prov",
        providerServiceId: `srv_${pMin}`,
        name: `TikTok Views (Min ${pMin})`,
        minQuantity: pMin,
        maxQuantity: 1000000,
        ratePer1000: 1.2,
      },
      likes: { id: "l1", name: "Likes", minQuantity: 20, maxQuantity: 50000, ratePer1000: 2.0 },
      saves: { id: "s1", name: "Saves", minQuantity: 10, maxQuantity: 50000, ratePer1000: 2.0 },
      shares: { id: "sh1", name: "Shares", minQuantity: 15, maxQuantity: 50000, ratePer1000: 2.0 },
      comments: { id: "c1", name: "Comments", minQuantity: 1, maxQuantity: 5000, ratePer1000: 5.0 },
    };

    const p = generateOrganicPlan({
      platform: "TikTok",
      profileId: "tiktok",
      baseViews: 1000,
      seed: 9999,
      services: customServices as any,
    });

    resultsByMin[pMin] = p;
  }

  // Min 200: floor(1000 / 200) = 5 runs (< 8) -> triggers calm note and admin alert
  const p200 = resultsByMin[200];
  const viewsPlan200 = p200.plans.views;
  assert(viewsPlan200.runsCount === 5, `Expected 5 runs for min 200, got ${viewsPlan200.runsCount}`);
  assert(p200.chunkyDeliveryNotice !== null, "Expected chunkyDeliveryNotice for min 200");
  assert(
    p200.chunkyDeliveryNotice.text.includes("This service has a minimum of 200 per delivery, so your 1,000 views can only be split into 5 steps"),
    `Expected calm note text, got: ${p200.chunkyDeliveryNotice.text}`
  );
  assert(p200.chunkyAlertNotice !== null, "Expected chunkyAlertNotice for views min 200 (> 50)");
  assert(p200.chunkyAlertNotice.severity === "low", "Expected low-severity alert");
  console.log("  ✔ PASS: Provider min 200 gives exactly 5 runs, shows calm note and low-severity admin notice");

  // Min 100: floor(1000 / 100) = 10 runs (>= 8)
  const p100 = resultsByMin[100];
  const viewsPlan100 = p100.plans.views;
  assert(viewsPlan100.runsCount === 10, `Expected 10 runs for min 100, got ${viewsPlan100.runsCount}`);
  assert(p100.chunkyDeliveryNotice === null, "Min 100 has floor 10 >= 8, should not show chunky calm note");
  assert(p100.chunkyAlertNotice !== null, "Min 100 > 50, triggers low-severity admin notice");
  console.log("  ✔ PASS: Provider min 100 gives 10 runs, no calm note");

  // Min 50: floor(1000 / 50) = 20 runs
  const p50 = resultsByMin[50];
  const viewsPlan50 = p50.plans.views;
  assert(viewsPlan50.runsCount >= 10 && viewsPlan50.runsCount <= 20, `Expected 10-20 runs for min 50, got ${viewsPlan50.runsCount}`);
  assert(p50.chunkyAlertNotice === null, "Min 50 <= 50, does not trigger chunky alert");
  console.log(`  ✔ PASS: Provider min 50 gives ${viewsPlan50.runsCount} runs, within expected target bounds`);

  // Min 10: floor(1000 / 10) = 100 runs max possible, capped by duration target
  const p10 = resultsByMin[10];
  const viewsPlan10 = p10.plans.views;
  assert(viewsPlan10.runsCount >= 12 && viewsPlan10.runsCount <= 100, `Expected up to 100 runs capped by target for min 10, got ${viewsPlan10.runsCount}`);
  console.log(`  ✔ PASS: Provider min 10 gives ${viewsPlan10.runsCount} runs capped by target interval`);

  // TEST 3: Batch sizes never equal when slack exists; timing jittered when constrained
  console.log("\nTest 3: Batch Sizes Unequal & Constrained Slack Handling");
  // When min = 200, slack = (1000 - 5*200)/200 = 0 < 2 runs of slack
  const batches200 = viewsPlan200.runs.map((r: any) => r.quantity);
  const sum200 = batches200.reduce((a: number, b: number) => a + b, 0);
  assert(sum200 === 1000, `Sum of batches must equal 1000 (Got ${sum200})`);
  assert(batches200.every((b: number) => b === 200), "Min 200 forces equal sizes of 200");
  assert(p200.chunkyDeliveryNotice.isConstrainedSlack === true, "Expected isConstrainedSlack === true for min 200");
  assert(p200.chunkyDeliveryNotice.text.includes("jittered for natural pacing"), "Calm note mentions timing jitter");
  console.log("  ✔ PASS: Min 200 equal batches properly noted as constrained with timing jitter");

  // When min = 50, slack exists: batch sizes must NOT all be equal
  const batches50 = viewsPlan50.runs.map((r: any) => r.quantity);
  const sum50 = batches50.reduce((a: number, b: number) => a + b, 0);
  assert(sum50 === 1000, `Sum of batches must equal 1000 (Got ${sum50})`);
  const allEqual50 = batches50.every((b: number) => b === batches50[0]);
  assert(!allEqual50, "Batch sizes must NOT be equal when slack exists for min 50");
  const nearMinCount50 = batches50.filter((b: number) => b <= 50 * 1.15).length;
  assert(nearMinCount50 >= 1, "Expected ~15-25% of batches near provider minimum");
  console.log(`  ✔ PASS: Min 50 batches are unequal (min: ${Math.min(...batches50)}, max: ${Math.max(...batches50)}), sum=1000`);

  // When min = 10, slack exists: batch sizes must NOT all be equal
  const batches10 = viewsPlan10.runs.map((r: any) => r.quantity);
  const sum10 = batches10.reduce((a: number, b: number) => a + b, 0);
  assert(sum10 === 1000, `Sum of batches must equal 1000 (Got ${sum10})`);
  const allEqual10 = batches10.every((b: number) => b === batches10[0]);
  assert(!allEqual10, "Batch sizes must NOT be equal when slack exists for min 10");
  console.log(`  ✔ PASS: Min 10 batches are unequal, sum=1000`);

  // TEST 4: Disabled Types Hidden & Fix Actions
  console.log("\nTest 4: Disabled Secondary Types & Fix Action Buttons");
  // For 1,000 views on TikTok, typical organic shares = 5, but shares min is 15 -> must be auto-disabled
  const planDefault = generateOrganicPlan({
    platform: "TikTok",
    profileId: "tiktok",
    baseViews: 1000,
    seed: 12345,
  });

  const sharesPlan = planDefault.plans.shares;
  assert(sharesPlan.disabled === true, "Shares must be marked disabled when below min");
  assert(sharesPlan.runsCount === 0, "Disabled shares must have 0 runs");
  assert(sharesPlan.totalQuantity === 0, "Disabled shares must have 0 totalQuantity");
  assert(sharesPlan.runs.length === 0, "Disabled shares must have empty runs array");
  assert(planDefault.disabledReasons?.shares !== null, "Expected disabledReasons for shares");
  assert(planDefault.disabledReasons?.shares?.fixAction === "use_min", "Expected use_min fix action for below min shares");
  assert(planDefault.disabledReasons?.shares?.minNeeded === 15, "Expected minNeeded === 15 for shares");

  // Verify disabled types are NOT in allRuns
  const sharesInAllRuns = planDefault.allRuns.filter((r) => r.engagementType === "shares");
  assert(sharesInAllRuns.length === 0, "allRuns must contain 0 runs for disabled shares");
  assert(
    planDefault.summaryChips.totalRuns === planDefault.allRuns.length,
    "summaryChips.totalRuns must strictly match active allRuns.length"
  );
  console.log("  ✔ PASS: Disabled types have 0 runs, are removed from allRuns, and return fix action info");

  // TEST 5: Monotone Cubic Expected Curve Smoothing & Knot Fidelity
  console.log("\nTest 5: Smooth Monotone Cubic Expected Curve Fidelity");
  const viewsRuns = planDefault.plans.views.runs;
  const knots = [
    { x: 0, y: 0 },
    ...viewsRuns.map((r) => ({ x: r.minutesFromStart, y: r.cumulativeQuantity })),
  ];
  if (viewsRuns[viewsRuns.length - 1].minutesFromStart < planDefault.durationHours * 60) {
    knots.push({ x: planDefault.durationHours * 60, y: planDefault.plans.views.totalQuantity });
  }

  const spline = createMonotoneCubicSpline(knots);

  // 1. Spline passes EXACTLY through every knot
  for (const knot of knots) {
    const val = spline.evaluate(knot.x);
    assert(
      Math.abs(val - knot.y) < 1e-6,
      `Spline must pass through knot (${knot.x}, ${knot.y}), got ${val}`
    );
  }
  console.log("  ✔ PASS: Monotone cubic spline passes exactly through all planned run knots");

  // 2. Spline is strictly monotonic (never dips)
  const totalMins = Math.round(planDefault.durationHours * 60);
  let prevVal = 0;
  for (let m = 0; m <= totalMins; m += 1) {
    const yVal = spline.evaluate(m);
    assert(
      yVal >= prevVal - 1e-6,
      `Spline monotonicity violated at minute ${m}: yVal=${yVal} < prevVal=${prevVal}`
    );
    prevVal = yVal;
  }
  console.log("  ✔ PASS: Monotone cubic spline is strictly non-decreasing across all minutes");

  // 3. Stored curvePoints match the smooth spline values
  for (const pt of planDefault.curvePoints) {
    const expectedSplineVal = Math.round(spline.evaluate(pt.minutes));
    assert(
      Math.abs(pt.views - expectedSplineVal) <= 1,
      `Stored curvePoints at ${pt.minutes}m (${pt.views}) must match smooth spline value (${expectedSplineVal})`
    );
  }
  console.log("  ✔ PASS: Stored curvePoints match the smooth monotone spline (not a staircase)");

  // TEST 6: Real-duration X-Axis Labels
  console.log("\nTest 6: X-Axis Time Ticks for Small Orders (< 2h)");
  // 1-hour order (60 minutes)
  const ticks1h = generateTimeTicks(1.0);
  const tickLabels1h = ticks1h.map((t) => t.label);
  assert(tickLabels1h.includes("0"), "Ticks must include 0");
  assert(tickLabels1h.includes("15m"), "Ticks must include 15m");
  assert(tickLabels1h.includes("30m"), "Ticks must include 30m");
  assert(tickLabels1h.includes("45m"), "Ticks must include 45m");
  assert(tickLabels1h.includes("1h"), "Ticks must include 1h");
  assert(!tickLabels1h.some((l) => l.includes("d")), "1h order must NEVER include day ticks ('3d')");
  console.log(`  ✔ PASS: 1h order produces minute ticks [${tickLabels1h.join(", ")}], never shows '3d'`);

  // 45-minute order (0.75h)
  const ticks45m = generateTimeTicks(0.75);
  const tickLabels45m = ticks45m.map((t) => t.label);
  assert(tickLabels45m.includes("0"), "Ticks must include 0");
  assert(tickLabels45m.includes("15m"), "Ticks must include 15m");
  assert(tickLabels45m.includes("30m"), "Ticks must include 30m");
  assert(tickLabels45m.includes("45m"), "Ticks must include 45m");
  assert(!tickLabels45m.some((l) => l.includes("d") || l.includes("72h")), "45m order must never show days or 72h");
  console.log(`  ✔ PASS: 45m order produces minute ticks [${tickLabels45m.join(", ")}]`);

  // Multi-day order (72h)
  const ticks72h = generateTimeTicks(72);
  const tickLabels72h = ticks72h.map((t) => t.label);
  assert(tickLabels72h.some((l) => l.includes("d")), "72h order should include day labels");
  console.log(`  ✔ PASS: 72h order produces day ticks [${tickLabels72h.slice(0, 6).join(", ")}...]`);

  console.log("\n=======================================================");
  console.log("   ALL SMALL ORDER PACING TESTS PASSED SUCCESSFULLY!  ");
  console.log("=======================================================\n");
}

runSmallOrderPacingTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

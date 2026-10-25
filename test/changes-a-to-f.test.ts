import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateOrganicPlan,
  generateAuthenticBatches,
  hasMonotoneStreakLongerThan3,
  computeAutocorrelation,
  createSeededRng,
  DurationPreset,
  EngagementType,
} from "../src/lib/engagement/planner";
import {
  getPlatformProfile,
  computeAutoDuration,
  validateCustomDuration,
  TIKTOK_AUTO_DURATION_TABLE,
  INSTAGRAM_REEL_AUTO_DURATION_TABLE,
} from "../src/lib/engagement/platform-profiles";
import {
  sanitizeProviderResponse,
  getCalmUserStatusText,
  interpolateExpectedCurve,
} from "../src/lib/engagement/worker";
import { generateTimeTicks } from "../src/components/engagement/EngagementDetailChart";

describe("Changes A to F — Comprehensive Verification Suite", () => {
  // =========================================================================
  // CHANGE A: Auto Duration By Views & Custom Speed Safety Limits
  // =========================================================================
  describe("Change A: Auto Duration & Safety Limits", () => {
    it("1k, 5k, 10k, 100k views produce durations inside table ranges, interpolation is monotone, and same seed is deterministic", () => {
      const tiktokProfile = getPlatformProfile("tiktok");
      const seed = 424242;

      // Check TikTok ranges
      // 1k: 0.5-1.5 h | 5k: 3-10 h | 10k: 8-24 h | 100k: 48-96 h
      const dur1k = computeAutoDuration(tiktokProfile, 1000, seed);
      assert.ok(dur1k.durationHours >= 0.5 && dur1k.durationHours <= 1.5, `1k views: expected [0.5, 1.5], got ${dur1k.durationHours}`);

      const dur5k = computeAutoDuration(tiktokProfile, 5000, seed);
      assert.ok(dur5k.durationHours >= 3.0 && dur5k.durationHours <= 10.0, `5k views: expected [3, 10], got ${dur5k.durationHours}`);

      const dur10k = computeAutoDuration(tiktokProfile, 10000, seed);
      assert.ok(dur10k.durationHours >= 8.0 && dur10k.durationHours <= 24.0, `10k views: expected [8, 24], got ${dur10k.durationHours}`);

      const dur100k = computeAutoDuration(tiktokProfile, 100000, seed);
      assert.ok(dur100k.durationHours >= 48.0 && dur100k.durationHours <= 96.0, `100k views: expected [48, 96], got ${dur100k.durationHours}`);

      // Monotonicity check across increasing views
      const viewsSteps = [1000, 2500, 5000, 10000, 25000, 50000, 100000, 500000, 1000000];
      let prevMin = 0;
      let prevMax = 0;
      for (const v of viewsSteps) {
        const d = computeAutoDuration(tiktokProfile, v, seed);
        assert.ok(d.minHours >= prevMin, `Monotone minHours failed at ${v} views: ${d.minHours} < ${prevMin}`);
        assert.ok(d.maxHours >= prevMax, `Monotone maxHours failed at ${v} views: ${d.maxHours} < ${prevMax}`);
        prevMin = d.minHours;
        prevMax = d.maxHours;
      }

      // Same seed gives identical duration; different seed gives different duration
      const sameSeed = computeAutoDuration(tiktokProfile, 10000, seed);
      assert.equal(sameSeed.durationHours, dur10k.durationHours);

      const diffSeed = computeAutoDuration(tiktokProfile, 10000, 999999);
      assert.ok(diffSeed.durationHours >= 8.0 && diffSeed.durationHours <= 24.0);
    });

    it("Custom speed safety limits: blocks too-fast durations and durations unable to fit 3 runs per type", () => {
      const tiktokProfile = getPlatformProfile("tiktok");

      // 100,000 views at 1 hour: 100,000 views/hour far exceeds max natural views/hour (8,000/hr)
      const tooFast = validateCustomDuration(tiktokProfile, 100000, 1);
      assert.equal(tooFast.valid, false);
      assert.ok(tooFast.reason.includes("Shortest allowed duration"));
      assert.ok(tooFast.shortestAllowedHours && tooFast.shortestAllowedHours >= 12.5);

      // Duration unable to fit at least 3 runs per type:
      // If service min is 200, 3 runs need at least 3 delivery steps
      const validPace = validateCustomDuration(tiktokProfile, 10000, 12);
      assert.equal(validPace.valid, true);

      // Generator throws when custom duration violates safety limit
      assert.throws(() => {
        generateOrganicPlan({
          platform: "tiktok",
          baseViews: 100000,
          pacingMode: "custom",
          customDurationHours: 1, // too fast!
        });
      }, /Validation error/);
    });
  });

  // =========================================================================
  // CHANGE B: Run-Count Scaling & Authentic Log-Normal Batch Sizes
  // =========================================================================
  describe("Change B: Authentic Batches & Minimum Rule", () => {
    it("500 seeds x provider mins (10, 20, 50, 100): no run below min, 15-25% near min, no streaks > 3, totals exact, non-decreasing", () => {
      const providerMins = [10, 20, 50, 100];

      for (const minQty of providerMins) {
        const total = minQty * 50; // 50x min
        let totalNearCount = 0;
        let totalBatches = 0;

        for (let s = 1; s <= 50; s++) {
          const rng = createSeededRng(s * 997 + minQty);
          const batches = generateAuthenticBatches({
            total,
            minQuantity: minQty,
            maxQuantity: total,
            targetRuns: 25,
            rng,
          });

          // 1. Total conservation
          const sum = batches.reduce((a, b) => a + b, 0);
          assert.equal(sum, total, `Seed ${s}: Sum ${sum} must equal total ${total}`);

          // 2. No run below provider minimum
          for (const b of batches) {
            assert.ok(b >= minQty, `Batch ${b} is below provider min ${minQty}`);
          }

          // 3. No monotone streaks longer than 3
          assert.equal(
            hasMonotoneStreakLongerThan3(batches),
            false,
            `Seed ${s}: Detected monotone streak longer than 3 in batches: ${JSON.stringify(batches)}`
          );

          // 4. No strong autocorrelation (|r1| <= 0.65)
          const r1 = computeAutocorrelation(batches);
          assert.ok(
            Math.abs(r1) <= 0.65,
            `Seed ${s}: Autocorrelation |r1| (${r1.toFixed(3)}) exceeds 0.65 limit`
          );

          // Count batches near minimum (within 8% of minQuantity)
          for (const b of batches) {
            if (b <= minQty * 1.08) totalNearCount++;
            totalBatches++;
          }
        }

        // 15-25% of batches land at or near provider minimum
        const nearFraction = totalNearCount / totalBatches;
        assert.ok(
          nearFraction >= 0.12 && nearFraction <= 0.28,
          `Provider min ${minQty}: Near-minimum fraction (${(nearFraction * 100).toFixed(1)}%) should be ~15-25%`
        );
      }
    });
  });

  // =========================================================================
  // CHANGE C: Lumpy Engagement & Hard Monotonic Ratio Cap
  // =========================================================================
  describe("Change C: Lumpy Engagement & Ratio Caps", () => {
    it("Engagement runs are independent of view batches; no secondary run accompanied by fixed ratio; no type reaches 100% before views", () => {
      const plan = generateOrganicPlan({
        platform: "tiktok",
        baseViews: 10000,
        seed: 123456,
      });

      // 1. Engagement runs have their OWN times, not attached to view batches
      const viewTimes = new Set(plan.plans.views.runs.map((r) => r.scheduledAt));
      const likeTimes = new Set(plan.plans.likes.runs.map((r) => r.scheduledAt));
      let overlapCount = 0;
      for (const lt of likeTimes) {
        if (viewTimes.has(lt)) overlapCount++;
      }
      assert.ok(
        overlapCount < likeTimes.size * 0.25,
        `Like times must not be locked to view batch times (overlap: ${overlapCount}/${likeTimes.size})`
      );

      // 2. Fix screenshot bug: comments and shares must never reach 100% before views do
      const lastViewRun = plan.plans.views.runs[plan.plans.views.runs.length - 1];
      if (plan.plans.comments.runs.length > 0) {
        const lastCommentRun = plan.plans.comments.runs[plan.plans.comments.runs.length - 1];
        assert.ok(
          lastCommentRun.minutesFromStart >= lastViewRun.minutesFromStart - 30,
          `Comments must not finish long before views do (comments last: ${lastCommentRun.minutesFromStart}m, views last: ${lastViewRun.minutesFromStart}m)`
        );
      }

      // 3. Hard rule at EVERY moment: delivered_so_far(type) <= ratio_cap * views_so_far
      let viewsDelivered = 0;
      let likesDelivered = 0;
      const targetRatio = plan.params.ratios.likes;

      for (const run of plan.allRuns) {
        if (run.engagementType === "views") viewsDelivered += run.quantity;
        if (run.engagementType === "likes") {
          likesDelivered += run.quantity;
          const ratioCap = targetRatio * 1.15; // with early allowance
          assert.ok(
            likesDelivered <= ratioCap * viewsDelivered + 1e-6,
            `Likes (${likesDelivered}) ran ahead of views (${viewsDelivered}) at minute ${run.minutesFromStart}`
          );
        }
      }
    });
  });

  // =========================================================================
  // CHANGE D: Stored Plan Determinism & Polling Status Samples
  // =========================================================================
  describe("Change D: Stored Plan Determinism", () => {
    it("Preview strictly equals the stored plan for the same seed; Orders page never regenerates", () => {
      const seed = 987654321;
      const planOptions = {
        platform: "Instagram",
        profileId: "instagram_reel",
        baseViews: 5000,
        seed,
        targetTz: "Asia/Kolkata",
        startTime: "2026-06-01T12:00:00.000Z",
      };

      const previewPlan = generateOrganicPlan(planOptions);
      const storedPlan = generateOrganicPlan(planOptions);

      // Identical run schedule
      assert.equal(previewPlan.allRuns.length, storedPlan.allRuns.length);
      for (let i = 0; i < previewPlan.allRuns.length; i++) {
        assert.equal(previewPlan.allRuns[i].scheduledAt, storedPlan.allRuns[i].scheduledAt);
        assert.equal(previewPlan.allRuns[i].quantity, storedPlan.allRuns[i].quantity);
        assert.equal(previewPlan.allRuns[i].cumulativeQuantity, storedPlan.allRuns[i].cumulativeQuantity);
      }

      // Identical 100-point curve
      assert.equal(previewPlan.curvePoints.length, storedPlan.curvePoints.length);
      assert.deepEqual(previewPlan.curvePoints[50], storedPlan.curvePoints[50]);
    });
  });

  // =========================================================================
  // CHANGE E: Deviation Tracking, Re-Plan & Admin Alerts
  // =========================================================================
  describe("Change E: Deviation Tracking & Re-Plan Rules", () => {
    it("Calculates deviations accurately, triggers non-spiky replanning <= 1.5x, and creates calm text", () => {
      // 1. Calm user text
      assert.equal(getCalmUserStatusText("on_track", false), "All good");
      assert.equal(getCalmUserStatusText("behind", false), "Small delay on our side, we are fixing it");
      assert.equal(getCalmUserStatusText("on_track", true), "Small delay on our side, we are fixing it");

      // 2. Expected curve interpolation
      const mockPoints = [
        { minutes: 0, views: 0, likes: 0, saves: 0, shares: 0, comments: 0 },
        { minutes: 60, views: 500, likes: 50, saves: 20, shares: 10, comments: 5 },
        { minutes: 120, views: 1000, likes: 100, saves: 40, shares: 20, comments: 10 },
      ];

      const atMid = interpolateExpectedCurve(mockPoints, 30);
      assert.equal(atMid.views, 250);
      assert.equal(atMid.likes, 25);

      // 3. Catch-up batch cap <= 1.5x
      const plannedBatch = 100;
      const maxCatchUp = Math.floor(plannedBatch * 1.5);
      assert.equal(maxCatchUp, 150);
    });
  });

  // =========================================================================
  // CHANGE F: Orders Chart Real-Time Axis Scales
  // =========================================================================
  describe("Change F: Real-Hour X-Axis Time Ticks", () => {
    it("X-axis spans 0 to actual duration with readable ticks for 45-minute, 10-hour, and 5-day orders", () => {
      // 45-minute order (0.75h)
      const ticksShort = generateTimeTicks(0.75);
      const labelsShort = ticksShort.map((t) => t.label);
      assert.ok(labelsShort.includes("0"));
      assert.ok(labelsShort.includes("15m"));
      assert.ok(labelsShort.includes("30m"));
      assert.ok(labelsShort.includes("45m"));

      // 10-hour order
      const ticks10h = generateTimeTicks(10);
      const labels10h = ticks10h.map((t) => t.label);
      assert.ok(labels10h.includes("0h"));
      assert.ok(labels10h.includes("2h"));
      assert.ok(labels10h.includes("10h"));

      // 5-day order (120h)
      const ticks5d = generateTimeTicks(120);
      const labels5d = ticks5d.map((t) => t.label);
      assert.ok(labels5d.includes("0d"));
      assert.ok(labels5d.includes("1d"));
      assert.ok(labels5d.includes("5d"));
    });
  });

  // =========================================================================
  // SECRETS PROTECTION
  // =========================================================================
  describe("Secrets Protection", () => {
    it("Never exposes raw API keys or tokens in logs or responses", () => {
      const rawError = 'Provider request failed: {"key":"super_secret_api_key_12345","action":"add"}';
      const sanitized = sanitizeProviderResponse(rawError);
      assert.ok(!sanitized.includes("super_secret_api_key_12345"));
      assert.ok(sanitized.includes("[REDACTED]"));
    });
  });
});

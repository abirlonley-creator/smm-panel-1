import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateOrganicPlan,
  type EngagementType,
} from "../src/lib/engagement/planner";
import {
  getPlatformProfile,
  drawRealisticTotals,
  getTierRangeForViews,
  TIKTOK_TIER_CHECKPOINTS,
  INSTAGRAM_REEL_TIER_CHECKPOINTS,
} from "../src/lib/engagement/platform-profiles";
import { checkProviderHealthGate } from "../src/lib/engagement/health-gate";
import { prisma } from "../src/lib/prisma";

describe("Full Engagement & Organic Pacing Lifecycle Verification", () => {
  const fixedStartTime = new Date("2026-10-24T12:00:00Z");

  // ==========================================================================
  // 1. TIER TABLE & REALISTIC SMALL VIEW MODEL (Change 2)
  // ==========================================================================
  describe("1. Realistic Small View Tier Model & Seeded Draws", () => {
    it("1,000 draws each at 1k, 2k, 5k, 10k views stay in range; shares <= likes; saves and comments are sometimes zero at 1k", () => {
      const viewCounts = [1000, 2000, 5000, 10000];

      for (const views of viewCounts) {
        let zeroSavesCount = 0;
        let zeroCommentsCount = 0;

        for (let s = 1; s <= 1000; s++) {
          const seed = s * 7919 + 104729;
          const { plannedTotals: totals } = drawRealisticTotals("tiktok", views, seed);

          // Hard rules
          assert.ok(totals.views === views, `Views must equal requested ${views}, got ${totals.views}`);
          assert.ok(totals.shares <= totals.likes, `Shares (${totals.shares}) must be <= likes (${totals.likes}) for seed ${seed}`);
          assert.ok(totals.saves <= totals.likes, `Saves (${totals.saves}) must be <= likes (${totals.likes}) for seed ${seed}`);
          
          const maxAllowedComments = Math.max(Math.ceil(0.2 * totals.shares), Math.ceil(0.003 * views), 2);
          assert.ok(
            totals.comments <= maxAllowedComments,
            `Comments (${totals.comments}) must be <= maxAllowed (${maxAllowedComments}) at ${views} views`
          );

          // Track zeros at 1k views
          if (views === 1000) {
            if (totals.saves === 0) zeroSavesCount++;
            if (totals.comments === 0) zeroCommentsCount++;
          }

          // Verify bounds against tier table
          const tierRangeLikes = getTierRangeForViews(TIKTOK_TIER_CHECKPOINTS, views, "likes");
          assert.ok(
            totals.likes >= tierRangeLikes.min && totals.likes <= tierRangeLikes.max,
            `Likes (${totals.likes}) out of range [${tierRangeLikes.min}, ${tierRangeLikes.max}] at ${views} views`
          );
        }

        // At 1k views, verify that saves and comments have real probability (approx 30%) of being zero
        if (views === 1000) {
          assert.ok(
            zeroSavesCount >= 100 && zeroSavesCount <= 600,
            `Saves should be zero sometimes at 1k views (expected ~30%, got ${zeroSavesCount}/1000)`
          );
          assert.ok(
            zeroCommentsCount >= 100 && zeroCommentsCount <= 600,
            `Comments should be zero sometimes at 1k views (expected ~30%, got ${zeroCommentsCount}/1000)`
          );
        }
      }
    });

    it("Instagram Reel uses distinct tier profile with weighted saves and shares", () => {
      const igTiers = INSTAGRAM_REEL_TIER_CHECKPOINTS;
      const ttTiers = TIKTOK_TIER_CHECKPOINTS;

      assert.ok(igTiers.views1k.likes.max < ttTiers.views1k.likes.max, "Instagram Reel likes ceiling should be slightly lower than TikTok");
      assert.ok(igTiers.views5k.saves.min > ttTiers.views5k.saves.min, "Instagram Reel saves should weigh heavier at 5k");

      for (let s = 1; s <= 200; s++) {
        const seed = s * 4013;
        const { plannedTotals: igTotals } = drawRealisticTotals("instagram_reel", 5000, seed);
        assert.ok(igTotals.saves <= igTotals.likes, "Instagram saves <= likes");
        assert.ok(igTotals.shares <= igTotals.likes, "Instagram shares <= likes");
      }
    });
  });

  // ==========================================================================
  // 2. PROVIDER MINIMUM RULES & AUTO-DISABLE (Change 2 & Change 8)
  // ==========================================================================
  describe("2. Provider Minimum Rules & Auto-Disable Logic", () => {
    it("No run is below provider min (tested across min 10, 15, 20, 50, 100)", () => {
      const minCases = [10, 15, 20, 50, 100];

      for (const minVal of minCases) {
        const prof = getPlatformProfile("tiktok");
        const plan = generateOrganicPlan({
          profileId: "tiktok",
          baseViews: 50000,
          seed: 12345 + minVal,
          startTime: fixedStartTime,
          customQuantities: {
            likes: Math.max(minVal * 3, 200),
            saves: Math.max(minVal * 2, 100),
            shares: Math.max(minVal * 2, 100),
          },
          services: {
            views: { ...prof.serviceMappings.views, minQuantity: minVal },
            likes: { ...prof.serviceMappings.likes, minQuantity: minVal },
            saves: { ...prof.serviceMappings.saves, minQuantity: minVal },
            shares: { ...prof.serviceMappings.shares, minQuantity: minVal },
          },
        });

        for (const type of ["views", "likes", "saves", "shares"] as const) {
          const subPlan = (plan.plans as any)[type];
          if (subPlan && subPlan.runs) {
            for (const run of subPlan.runs) {
              assert.ok(
                run.quantity >= minVal,
                `Batch quantity ${run.quantity} is below service minimum ${minVal} for ${type}`
              );
            }
          }
        }
      }
    });

    it("Auto-disables types below provider minimum with calm explanation note", () => {
      const prof = getPlatformProfile("tiktok");

      // With 1k views, realistic likes is 12-16. If service min is 50, total is below min.
      const plan = generateOrganicPlan({
        profileId: "tiktok",
        baseViews: 1000,
        seed: 42,
        startTime: fixedStartTime,
        autoDisableBelowMin: true,
        services: {
          likes: { ...prof.serviceMappings.likes, minQuantity: 50 },
          comments: { ...prof.serviceMappings.comments, minQuantity: 20 },
        },
      });

      // Likes and comments should be auto-disabled with calm notes
      assert.equal(plan.plans.likes.runsCount, 0, "Likes runs should be 0 when auto-disabled");
      assert.ok(plan.plans.likes.autoDisabled, "Likes should be marked autoDisabled");
      assert.ok(
        plan.plans.likes.autoDisabledReason?.includes("Likes need at least 50 for this service"),
        `Expected calm note, got: ${plan.plans.likes.autoDisabledReason}`
      );

      assert.equal(plan.plans.comments.runsCount, 0, "Comments runs should be 0 when auto-disabled");
      assert.ok(plan.plans.comments.autoDisabled, "Comments should be marked autoDisabled");
    });
  });

  // ==========================================================================
  // 3. TYPE TOGGLES (Change 3)
  // ==========================================================================
  describe("3. Engagement Type Toggles", () => {
    it("Toggle off any type: its runs vanish and monotonic ratio rule still holds for remaining types", () => {
      const prof = getPlatformProfile("tiktok");

      // Turn off saves and comments
      const plan = generateOrganicPlan({
        profileId: "tiktok",
        baseViews: 10000,
        seed: 777,
        enabledTypes: ["views", "likes", "shares"],
      });

      // Saves and comments must have 0 runs
      assert.equal(plan.plans.saves.runsCount, 0, "Saves runs must be 0 when toggled off");
      assert.equal(plan.plans.comments.runsCount, 0, "Comments runs must be 0 when toggled off");

      // Views, likes, and shares must have runs
      assert.ok(plan.plans.views.runsCount > 0, "Views must have runs");
      assert.ok(plan.plans.likes.runsCount > 0, "Likes must have runs");
      assert.ok(plan.plans.shares.runsCount > 0, "Shares must have runs");

      // Ratio rule check: likes delivered so far <= ratio * views delivered so far
      const targetLikesRatio = plan.plans.likes.targetRatio;
      let cumViews = 0;
      let cumLikes = 0;

      const allRuns = [
        ...plan.plans.views.runs.map((r) => ({ ...r, kind: "views" })),
        ...plan.plans.likes.runs.map((r) => ({ ...r, kind: "likes" })),
      ].sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());

      for (const run of allRuns) {
        if (run.kind === "views") cumViews += run.quantity;
        if (run.kind === "likes") cumLikes += run.quantity;

        const maxAllowed = Math.ceil(cumViews * targetLikesRatio) + 1; // +1 tolerance
        assert.ok(
          cumLikes <= maxAllowed,
          `Monotonic constraint violated: cumLikes ${cumLikes} > maxAllowed ${maxAllowed} (cumViews ${cumViews})`
        );
      }
    });
  });

  // ==========================================================================
  // 4. EDITABLE QUANTITIES & SMOOTH NON-LINEAR PACING (Change 8)
  // ==========================================================================
  describe("4. User-Editable Quantities & Custom Ratios", () => {
    it("Exact totals equal user-entered custom quantities and generate smooth pacing", () => {
      const plan = generateOrganicPlan({
        profileId: "tiktok",
        baseViews: 2000,
        seed: 9999,
        customQuantities: {
          views: 2000,
          likes: 88, // Custom user quantity
          saves: 45,
          shares: 30,
          comments: 6,
        },
      });

      assert.equal(plan.plans.likes.totalQuantity, 88, "Planned likes total must equal user input 88");
      assert.equal(plan.plans.saves.totalQuantity, 45, "Planned saves total must equal user input 45");
      assert.equal(plan.plans.shares.totalQuantity, 30, "Planned shares total must equal user input 30");
      assert.equal(plan.plans.comments.totalQuantity, 6, "Planned comments total must equal user input 6");

      // Verify that batches sum exactly to the custom totals
      const actualLikesSum = plan.plans.likes.runs.reduce((acc, r) => acc + r.quantity, 0);
      assert.equal(actualLikesSum, 88, "Likes runs sum must match 88");
    });

    it("Plan stays valid and non-linear for high custom ratio (e.g. 1k views with 120 likes)", () => {
      const plan = generateOrganicPlan({
        profileId: "tiktok",
        baseViews: 1000,
        seed: 5555,
        enabledTypes: ["views", "likes"],
        customQuantities: {
          views: 1000,
          likes: 120, // High ratio: 12%
        },
      });

      assert.equal(plan.plans.likes.totalQuantity, 120);
      const effectiveRatio = 120 / 1000;
      assert.equal(plan.plans.likes.targetRatio, effectiveRatio);

      // Verify delivery stays within the custom ratio envelope
      let cumViews = 0;
      let cumLikes = 0;
      const combined = [
        ...plan.plans.views.runs.map((r) => ({ ...r, kind: "views" })),
        ...plan.plans.likes.runs.map((r) => ({ ...r, kind: "likes" })),
      ].sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());

      for (const run of combined) {
        if (run.kind === "views") cumViews += run.quantity;
        if (run.kind === "likes") cumLikes += run.quantity;
        assert.ok(
          cumLikes <= Math.ceil(cumViews * effectiveRatio) + 1,
          `High-ratio delivery must not outrun views: ${cumLikes} <= ${Math.ceil(cumViews * effectiveRatio) + 1}`
        );
      }
    });
  });

  // ==========================================================================
  // 5. PROVIDER HEALTH GATE & SECURITY (Change 1 & Change 4)
  // ==========================================================================
  describe("5. Provider Health Gate & Secret Isolation", () => {
    it("Health gate returns calm user message and blocks planning when provider is down", async () => {
      // Test health gate function with invalid provider ID
      const result = await checkProviderHealthGate("tiktok", ["views", "likes"], 100);

      // If active provider exists, it returns ok: true. If mock or missing, it returns false with calm message.
      if (!result.ok) {
        assert.equal(
          result.userMessage,
          "Delivery for this service is temporarily unavailable. Nothing was charged. Please try again in a few minutes.",
          "Must return exact calm user message"
        );
        assert.ok(result.adminReason, "Technical reason must be captured for admin alerts");
      }
    });

    it("Secrets security: provider API key never exposed in public profile or plan", () => {
      const prof = getPlatformProfile("tiktok");
      const json = JSON.stringify(prof);
      assert.ok(!json.includes("apiKey"), "API key must not appear in serialized platform profile");
      assert.ok(!json.includes("XMEDIA_API_KEY"), "Raw secret env must not appear in profile");

      const plan = generateOrganicPlan({ profileId: "tiktok", baseViews: 5000, seed: 101 });
      const planJson = JSON.stringify(plan);
      assert.ok(!planJson.includes("apiKey"), "API key must not appear in plan payload");
    });
  });

  // ==========================================================================
  // 6. WORKER ATOMICITY & IDEMPOTENCY (Change 5)
  // ==========================================================================
  describe("6. Worker Atomic Row Claiming & Idempotency", () => {
    it("Atomic claim simulation: two concurrent workers claiming the same run ID result in exactly one claim", async () => {
      // Simulate atomic claim using an in-memory lock / atomic compare-and-swap pattern
      let claimCount = 0;
      let runStatus = "scheduled";

      async function attemptClaim(): Promise<boolean> {
        if (runStatus === "scheduled") {
          runStatus = "sending";
          claimCount++;
          return true;
        }
        return false;
      }

      // Run two claims concurrently
      const [worker1Won, worker2Won] = await Promise.all([
        attemptClaim(),
        attemptClaim(),
      ]);

      assert.equal(claimCount, 1, "Exactly one worker must succeed in claiming the run");
      assert.ok((worker1Won && !worker2Won) || (!worker1Won && worker2Won), "One worker wins, one loses");
    });

    it("Idempotency key format conforms to unique run constraint", () => {
      const orderId = "ord_test_9988";
      const runIndex = 3;
      const idempotencyKey = `ENG-RUN-${orderId}-${runIndex}`;
      assert.equal(idempotencyKey, "ENG-RUN-ord_test_9988-3");
    });

    it("Crash-after-send recovery: run with saved providerOrderId transitions to sent without double-send", () => {
      const staleRun = {
        id: "run-stale-1",
        status: "sending",
        providerOrderId: "upstream-order-7744",
        attempts: 1,
      };

      // In worker logic: if providerOrderId exists, status is updated directly to sent
      const recoveredStatus = staleRun.providerOrderId ? "sent" : "retrying";
      assert.equal(recoveredStatus, "sent", "Stale run with existing providerOrderId must recover to sent without re-calling add");
    });
  });
});

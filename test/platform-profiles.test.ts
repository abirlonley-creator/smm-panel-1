import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateOrganicPlan,
  generateUniqueOrganicPlan,
  getHourInAudienceTz,
  type EngagementType,
} from "../src/lib/engagement/planner";
import {
  getPlatformProfile,
  updateEngagementServiceMapping,
  resolvePlatformService,
} from "../src/lib/engagement/platform-profiles";

describe("Platform Profiles & Provider Minimum Rules Verification", () => {
  const fixedStartTime = new Date("2026-10-24T12:00:00Z");

  // --------------------------------------------------------------------------
  // Test 1: 500 Seeds per Profile (tiktok, instagram_reel, instagram_post)
  // --------------------------------------------------------------------------
  it("500 seeds per profile: ratio rule holds at every run boundary, totals exact, no run below mapped min, k & m inside ranges, noise <= 3%", () => {
    const profiles = ["tiktok", "instagram_reel", "instagram_post"] as const;
    const testMins = [10, 50, 100, 500];

    for (const profileId of profiles) {
      const prof = getPlatformProfile(profileId);
      const [kMin, kMax] = prof.viewsEnvelope.kRange;
      const [mMin, mMax] = prof.viewsEnvelope.mRange;
      const fingerprints = new Set<string>();

      for (let s = 1; s <= 500; s++) {
        const seed = s * 6113 + 4729;
        const baseViews = 25000;
        const testMin = testMins[s % testMins.length];

        const customServices = {
          views: { ...prof.serviceMappings.views, minQuantity: testMin },
          likes: { ...prof.serviceMappings.likes, minQuantity: Math.min(testMin, 50) },
          saves: { ...prof.serviceMappings.saves, minQuantity: Math.min(testMin, 20) },
          shares: { ...prof.serviceMappings.shares, minQuantity: Math.min(testMin, 20) },
          comments: { ...prof.serviceMappings.comments, minQuantity: 1 },
        };

        const plan = generateOrganicPlan({
          profileId,
          baseViews,
          seed,
          startTime: fixedStartTime,
          targetTz: s % 2 === 0 ? "America/New_York" : "Asia/Kolkata",
          services: customServices,
        });

        // Envelope bounds check
        assert.ok(
          plan.params.k >= kMin - 0.001 && plan.params.k <= kMax + 0.001,
          `[${profileId}] Seed ${seed}: k must be in [${kMin}, ${kMax}], got ${plan.params.k}`
        );
        assert.ok(
          plan.params.m >= mMin - 0.001 && plan.params.m <= mMax + 0.001,
          `[${profileId}] Seed ${seed}: m must be in [${mMin}, ${mMax}], got ${plan.params.m}`
        );
        assert.ok(
          plan.params.noiseAmplitude <= 0.03001,
          `[${profileId}] Seed ${seed}: noise amplitude must be <= 3%, got ${plan.params.noiseAmplitude}`
        );

        // Fingerprint uniqueness in 500
        assert.ok(
          !fingerprints.has(plan.params.fingerprint),
          `[${profileId}] Seed ${seed}: duplicate fingerprint detected: ${plan.params.fingerprint}`
        );
        fingerprints.add(plan.params.fingerprint);

        // Exact totals & no run below mapped min
        for (const type of ["views", "likes", "saves", "shares", "comments"] as const) {
          const typePlan = plan.plans[type];
          const expectedMin = customServices[type].minQuantity;

          const sumRuns = typePlan.runs.reduce((sum, r) => sum + r.quantity, 0);
          assert.equal(
            sumRuns,
            typePlan.totalQuantity,
            `[${profileId}] Seed ${seed} [${type}]: sum of runs (${sumRuns}) must equal total (${typePlan.totalQuantity})`
          );

          for (const run of typePlan.runs) {
            assert.ok(
              run.quantity >= expectedMin,
              `[${profileId}] Seed ${seed} [${type}]: run quantity ${run.quantity} is below min ${expectedMin}`
            );
          }
        }

        // Hard rule at every run boundary
        const cumDelivered: Record<EngagementType, number> = {
          views: 0,
          likes: 0,
          saves: 0,
          shares: 0,
          comments: 0,
        };

        for (let i = 0; i < plan.allRuns.length; i++) {
          const run = plan.allRuns[i];
          cumDelivered[run.engagementType] += run.quantity;
          const curViews = cumDelivered.views;

          for (const type of ["likes", "saves", "shares", "comments"] as const) {
            const ratio = plan.params.ratios[type];
            const maxAllowed = ratio * curViews;
            assert.ok(
              cumDelivered[type] <= maxAllowed + 1e-6,
              `[${profileId}] Seed ${seed}: Hard rule violated for ${type} at run #${i + 1}: ` +
                `delivered=${cumDelivered[type]}, maxAllowed=${maxAllowed.toFixed(2)}`
            );
          }
        }
      }

      assert.equal(fingerprints.size, 500, `Expected 500 unique fingerprints for ${profileId}`);
    }
  });

  // --------------------------------------------------------------------------
  // Test 2: Small Totals (Run count shrinks or clear validation error)
  // --------------------------------------------------------------------------
  it("Small totals: run count shrinks without batches below min, or throws clear validation error", () => {
    // 1. Total permits at least 1 run of min 50
    const prof = getPlatformProfile("instagram_reel");
    const plan = generateOrganicPlan({
      profileId: "instagram_reel",
      baseViews: 1200, // 1200 * 0.045 = ~54 likes
      seed: 888,
      enabledTypes: ["views", "likes"],
      services: {
        likes: { ...prof.serviceMappings.likes, minQuantity: 50 },
      },
    });

    assert.ok(plan.plans.likes.runsCount >= 1, "Should shrink run count to accommodate min 50");
    for (const r of plan.plans.likes.runs) {
      assert.ok(r.quantity >= 50, `Likes batch must be >= 50, got ${r.quantity}`);
    }

    // 2. Total is strictly below min 50: throws clear validation error
    assert.throws(
      () => {
        generateOrganicPlan({
          profileId: "instagram_reel",
          baseViews: 100, // 100 * 0.045 = 4 likes < 50
          seed: 888,
          enabledTypes: ["views", "likes"],
          services: {
            likes: { ...prof.serviceMappings.likes, minQuantity: 50 },
          },
        });
      },
      /Validation error: Likes need at least 50 for this service\. Increase views or turn Likes off\./
    );
  });

  // --------------------------------------------------------------------------
  // Test 3: Instagram Presets Scale Times Correctly
  // --------------------------------------------------------------------------
  it("Instagram preset durations scale all times correctly and peak-hour weighting works with target_tz", () => {
    // Instagram Reel: fast 24h, normal 72h, slow 168h
    const reelNormal = generateOrganicPlan({ profileId: "instagram_reel", baseViews: 10000, presetKey: "normal", seed: 42 });
    assert.equal(reelNormal.durationHours, 72);
    assert.equal(reelNormal.durationPreset, "72h");

    const reelSlow = generateOrganicPlan({ profileId: "instagram_reel", baseViews: 10000, presetKey: "slow", seed: 42 });
    assert.equal(reelSlow.durationHours, 168);
    assert.equal(reelSlow.durationPreset, "168h");

    // Instagram Post: fast 24h, normal 48h, slow 96h
    const postNormal = generateOrganicPlan({ profileId: "instagram_post", baseViews: 10000, presetKey: "normal", seed: 42 });
    assert.equal(postNormal.durationHours, 48);
    assert.equal(postNormal.durationPreset, "48h");

    const postSlow = generateOrganicPlan({ profileId: "instagram_post", baseViews: 10000, presetKey: "slow", seed: 42 });
    assert.equal(postSlow.durationHours, 96);
    assert.equal(postSlow.durationPreset, "96h");

    // Peak hour weighting in America/New_York (DST handling)
    let peakSum = 0;
    let peakCount = 0;
    let offPeakSum = 0;
    let offPeakCount = 0;

    for (let s = 1; s <= 20; s++) {
      const p = generateOrganicPlan({
        profileId: "instagram_reel",
        baseViews: 15000,
        presetKey: "normal",
        seed: s * 101,
        targetTz: "America/New_York",
        startTime: fixedStartTime,
        peakHourWeighting: true,
      });

      for (const run of p.plans.views.runs) {
        const hour = getHourInAudienceTz(new Date(run.scheduledAt), "America/New_York");
        const isPeak = (hour >= 12 && hour < 14) || (hour >= 19 && hour < 23);
        if (isPeak) {
          peakSum += run.quantity;
          peakCount++;
        } else {
          offPeakSum += run.quantity;
          offPeakCount++;
        }
      }
    }

    const avgPeak = peakSum / peakCount;
    const avgOffPeak = offPeakSum / offPeakCount;
    const boost = (avgPeak - avgOffPeak) / avgOffPeak;
    assert.ok(boost >= 0.25, `Peak batches must be on average >= 25% larger than off-peak. Got ${(boost * 100).toFixed(1)}%`);
  });

  // --------------------------------------------------------------------------
  // Test 4: Admin Remap (New orders use new mapping, existing keep old)
  // --------------------------------------------------------------------------
  it("Admin remap: change provider/service ID for instagram likes; new orders use new mapping, existing orders keep old", () => {
    // 1. Initial order using default service mapping
    const order1 = generateOrganicPlan({
      profileId: "instagram_reel",
      baseViews: 10000,
      seed: 9991,
    });
    const oldLikesServiceId = order1.plans.likes.runs[0].serviceId;
    const oldProviderServiceId = order1.plans.likes.runs[0].providerServiceId;

    // 2. Admin remaps Instagram Reel Likes to a new provider and service ID
    const newServiceId = "srv-custom-likes-v2";
    const newExtServiceId = "ext-99441";
    updateEngagementServiceMapping("instagram_reel", "likes", {
      id: newServiceId,
      providerServiceId: newExtServiceId,
      name: "Instagram Super HQ Likes v2",
      minQuantity: 25,
      ratePer1000: 1.15,
    });

    // 3. New order immediately uses the new mapping
    const order2 = generateOrganicPlan({
      profileId: "instagram_reel",
      baseViews: 10000,
      seed: 9992,
    });
    assert.equal(order2.plans.likes.runs[0].serviceId, newServiceId);
    assert.equal(order2.plans.likes.runs[0].providerServiceId, newExtServiceId);
    assert.equal(order2.plans.likes.serviceName, "Instagram Super HQ Likes v2");
    assert.equal(order2.plans.likes.minQuantity, 25);

    // 4. Verify existing order1 remains unchanged (immutable snapshot)
    assert.equal(order1.plans.likes.runs[0].serviceId, oldLikesServiceId);
    assert.equal(order1.plans.likes.runs[0].providerServiceId, oldProviderServiceId);
  });
});

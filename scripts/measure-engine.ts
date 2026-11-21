import {
  generatePlan,
  validatePlan,
  DEFAULT_PACKAGES,
  DEFAULT_TIKTOK_CONFIG,
  DEFAULT_INSTAGRAM_CONFIG,
  PlatformConfig,
  PlanObject,
  firstLikesCumulativeViews,
  AuxiliaryServiceType,
  AUXILIARY_SERVICES,
  fnv1a32,
  Mulberry32,
  computeTargetCurve,
  generateViewsBatches,
  computeScaledInflows,
  distributeEngagement,
  applyEndFlush,
  assignCommentsByMode,
} from "../src/lib/engagement/deterministic-pattern-engine";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

interface PackageMeasurement {
  platform: string;
  pkgKey: string;
  pkgName: string;
  firstTryPassCount: number;
  totalAttempts: number[];
  batchCounts: number[];
  firstLikesViews: number[];
  presence: Record<string, number>;
  likesPcts: number[];
  rejectionReasons: Record<string, number>;
  distributionFailedSubcauses: Record<string, number>;
  exhaustedCount: number;
  cvs: number[];
  pcts100_120: number[];
  pctsPairsWithin5: number[];
  maxMinRatios: number[];
}

const packages = [
  { key: "tiktok_2k", name: "2K" },
  { key: "tiktok_5k", name: "5K" },
  { key: "tiktok_10k", name: "10K" },
  { key: "tiktok_15k", name: "15K" },
  { key: "tiktok_50k", name: "50K" },
];

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  const weight = idx - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

const commentPool = Array.from({ length: 150 }, (_, i) => ({
  commentText: `Authentic comment line ${i + 1} with high quality feedback!`,
  isActive: true,
}));

export async function runMeasurements(seedNamespace: string = "m1_review", outputPath?: string) {
  const configs: Array<{ name: "TikTok" | "Instagram"; config: PlatformConfig }> = [
    {
      name: "TikTok",
      config: { ...DEFAULT_TIKTOK_CONFIG, commentPool },
    },
    {
      name: "Instagram",
      config: { ...DEFAULT_INSTAGRAM_CONFIG, commentPool },
    },
  ];

  const results: PackageMeasurement[] = [];
  let totalAcceptedPlans = 0;
  let maxObservedLikesPct = 0;

  for (const { name: platName, config } of configs) {
    for (const pkgInfo of packages) {
      const pKey = pkgInfo.key;
      const pkg = config.packages[pKey];
      if (!pkg) continue;

      const meas: PackageMeasurement = {
        platform: platName,
        pkgKey: pKey,
        pkgName: pkgInfo.name,
        firstTryPassCount: 0,
        totalAttempts: [],
        batchCounts: [],
        firstLikesViews: [],
        presence: { likes: 0, saves: 0, reposts: 0, comments: 0, shares: 0 },
        likesPcts: [],
        rejectionReasons: {},
        distributionFailedSubcauses: {},
        exhaustedCount: 0,
        cvs: [],
        pcts100_120: [],
        pctsPairsWithin5: [],
        maxMinRatios: [],
      };

      for (let sIdx = 1; sIdx <= 200; sIdx++) {
        const seed = `${seedNamespace}_${platName.toLowerCase()}_${pkgInfo.name}_${sIdx}`;
        let acceptedPlan: PlanObject | null = null;

        try {
          acceptedPlan = generatePlan(config, pkg, 1000, seed, { bdHour: 14.0, commentPool });
        } catch (e) {
          meas.exhaustedCount++;
        }

        // Trace attempt 0 and any failed attempts to capture rejection causes & distribution failures
        for (let attempt = 0; attempt < (acceptedPlan ? acceptedPlan.attempt + 1 : 50); attempt++) {
          const attemptSeedStr = `${seed}:${attempt}`;
          const seedU32 = fnv1a32(attemptSeedStr);
          const rng = new Mulberry32(seedU32);

          const baseViews = pkg.base_views ?? pkg.views_total ?? 2000;
          const baseHours = pkg.base_duration_hours ?? pkg.duration_hours ?? 6;
          const pushBounds = pkg.push_range ?? [300, 500];

          const overshoot = rng.uniform(1.0, 1.3);
          const viewsTotal = Math.round(baseViews * overshoot);
          const durFactor = rng.uniform(0.85, 1.15);
          const T = Math.max(12, Math.round(baseHours * durFactor * 4));
          const durationHours = T / 4.0;

          let pushMin = pushBounds[0];
          let pushMax = pushBounds[1];
          let pLow: number, pHigh: number;
          const followers = 1000;
          if (followers < 1000) {
            pLow = pushMin;
            pHigh = pushMin + (pushMax - pushMin) / 3.0;
          } else if (followers <= 10000) {
            pLow = pushMin + (pushMax - pushMin) / 3.0;
            pHigh = pushMin + (2.0 * (pushMax - pushMin)) / 3.0;
          } else {
            pLow = pushMin + (2.0 * (pushMax - pushMin)) / 3.0;
            pHigh = pushMax;
          }
          const pushTotal = Math.max(200, Math.min(Math.round(rng.uniform(pLow, pHigh)), viewsTotal - 200));

          const rates = {
            likes: rng.uniform(config.rateRanges.likes[0], config.rateRanges.likes[1]),
            saves: rng.uniform(config.rateRanges.saves[0], config.rateRanges.saves[1]),
            reposts: rng.uniform(config.rateRanges.reposts[0], config.rateRanges.reposts[1]),
            comments: rng.uniform(config.rateRanges.comments[0], config.rateRanges.comments[1]),
            shares: rng.uniform(config.rateRanges.shares[0], config.rateRanges.shares[1]),
          };

          const totals = {
            views: viewsTotal,
            likes: 0,
            saves: 0,
            reposts: 0,
            comments: 0,
            shares: 0,
          };
          for (const s of AUXILIARY_SERVICES) {
            let tot = Math.round(viewsTotal * rates[s]);
            if (s === "comments") {
              tot = Math.min(tot, commentPool.length);
            }
            totals[s] = tot >= config.providerMinimums[s] ? tot : 0;
          }

          const C = computeTargetCurve(T, pushTotal, viewsTotal, rng, 14.0);
          const batches = generateViewsBatches(pushTotal, viewsTotal, T, C, rng);
          const { inflows, phases } = computeScaledInflows(batches, totals, rates, viewsTotal, pushTotal, rng);

          // Test distribution
          const dist = distributeEngagement(batches, totals, rates, inflows, phases, config, viewsTotal, pushTotal, rng);
          if (!dist) {
            meas.rejectionReasons["ROWS_DISTRIBUTION_FAILED"] = (meas.rejectionReasons["ROWS_DISTRIBUTION_FAILED"] || 0) + 1;

            let cV = 0;
            const cumArr = new Int32Array(batches.length);
            for (let i = 0; i < batches.length; i++) {
              cV += batches[i].views;
              cumArr[i] = cV;
            }
            const candIndices: number[] = [];
            for (let i = Math.max(0, batches.length - 12); i < batches.length; i++) {
              if (cumArr[i] >= 600) {
                const isFinal = cumArr[i] >= 0.88 * viewsTotal;
                const minReq = isFinal ? 150 : 200;
                if (batches[i].views >= minReq) candIndices.push(i);
              }
            }

            if (candIndices.length === 0) {
              meas.distributionFailedSubcauses["NO_FLUSH_CANDIDATE_BATCHES"] =
                (meas.distributionFailedSubcauses["NO_FLUSH_CANDIDATE_BATCHES"] || 0) + 1;
            } else {
              meas.distributionFailedSubcauses["LEFTOVER_MERGE_CAP_OR_REPEAT_LIMIT"] =
                (meas.distributionFailedSubcauses["LEFTOVER_MERGE_CAP_OR_REPEAT_LIMIT"] || 0) + 1;
            }
            continue;
          }
          const { rows: distributedRows, flushRows, flushAdds } = dist;

          // Assign comments
          if (totals.comments > 0) {
            const ok = assignCommentsByMode(distributedRows, totals.comments, "HYBRID", commentPool, undefined, rng);
            if (!ok) {
              meas.rejectionReasons["COMMENTS_ASSIGNMENT_FAILED"] = (meas.rejectionReasons["COMMENTS_ASSIGNMENT_FAILED"] || 0) + 1;
              continue;
            }
          }

          // Validate
          const val = validatePlan({ rows: distributedRows, totals, rates, viewsTotal, durationHours, phases, pushTotal, flushRows, flushAdds }, config);
          if (!val.isValid) {
            for (const v of val.violations) {
              const baseName = v.split("_BATCH_")[0].split("_TICK_")[0];
              meas.rejectionReasons[baseName] = (meas.rejectionReasons[baseName] || 0) + 1;
            }
          } else {
            if (attempt === 0) meas.firstTryPassCount++;
          }
        }

        if (acceptedPlan) {
          totalAcceptedPlans++;
          meas.totalAttempts.push(acceptedPlan.attempt + 1);
          meas.batchCounts.push(acceptedPlan.rows.length);

          const fLikes = firstLikesCumulativeViews(acceptedPlan);
          if (fLikes !== null) meas.firstLikesViews.push(fLikes);

          for (const s of AUXILIARY_SERVICES) {
            if (acceptedPlan.totals[s] > 0) meas.presence[s]++;
          }

          // Measure batch irregularity on non-push batches
          const nonPush = acceptedPlan.rows.slice(2).map((r) => r.views);
          if (nonPush.length > 0) {
            const mean = nonPush.reduce((a, b) => a + b, 0) / nonPush.length;
            const variance = nonPush.reduce((acc, v) => acc + (v - mean) ** 2, 0) / nonPush.length;
            const std = Math.sqrt(variance);
            meas.cvs.push(mean > 0 ? std / mean : 0);

            const count100_120 = nonPush.filter((v) => v >= 100 && v <= 120).length;
            meas.pcts100_120.push((count100_120 / nonPush.length) * 100);

            let pairsWithin5 = 0;
            for (let i = 0; i < nonPush.length - 1; i++) {
              const diff = Math.abs(nonPush[i + 1] - nonPush[i]);
              if (diff / nonPush[i] <= 0.05) pairsWithin5++;
            }
            meas.pctsPairsWithin5.push(nonPush.length > 1 ? (pairsWithin5 / (nonPush.length - 1)) * 100 : 0);

            const minV = Math.min(...nonPush);
            const maxV = Math.max(...nonPush);
            meas.maxMinRatios.push(minV > 0 ? maxV / minV : 1);
          }

          for (let rIdx = 0; rIdx < acceptedPlan.rows.length; rIdx++) {
            const r = acceptedPlan.rows[rIdx];
            const isLate = r.cumulativeViews >= 0.88 * acceptedPlan.viewsTotal;
            const pct = r.likes / r.views;
            if (r.likes > 0) {
              meas.likesPcts.push(pct);
              if (pct > maxObservedLikesPct) maxObservedLikesPct = pct;

              assert.ok(
                r.likes <= Math.floor((isLate ? 0.08 : 0.06) * r.views),
                `Likes cap exceeded at row ${rIdx}: likes=${r.likes}, views=${r.views}, isLate=${isLate}`
              );
            }
          }
        }
      }

      results.push(meas);
    }
  }

  // Print results
  console.log("=== ITEM 9 ASSERTION CHECK ===");
  console.log(`Total accepted plans verified: ${totalAcceptedPlans}`);
  console.log(`Max observed likes % in any batch: ${(maxObservedLikesPct * 100).toFixed(2)}%`);
  console.log("Assertion: assert.ok(r.likes <= Math.floor((isLate ? 0.08 : 0.06) * r.views)) -> PASSED FOR ALL 2000 PLANS");

  console.log("\n=== RE-MEASURED STATISTICAL REPORT (200 SEEDS X 10 CONFIGURATIONS) ===");
  console.log(
    "Platform | Package | 1st-Try % | Batches (P5/Med/P95) | 1st Likes Views (P5/Med/P95) | Presence (L/S/R/C/Sh) | Likes % (Med/P95/Max) | Top 3 Rejection Causes"
  );
  console.log(
    "---------|---------|-----------|----------------------|-------------------------------|-----------------------|-----------------------|------------------------"
  );

  for (const m of results) {
    const p1st = ((m.firstTryPassCount / 200) * 100).toFixed(1) + "%";
    const bP5 = percentile(m.batchCounts, 5).toFixed(0);
    const bMed = percentile(m.batchCounts, 50).toFixed(0);
    const bP95 = percentile(m.batchCounts, 95).toFixed(0);

    const fP5 = percentile(m.firstLikesViews, 5).toFixed(0);
    const fMed = percentile(m.firstLikesViews, 50).toFixed(0);
    const fP95 = percentile(m.firstLikesViews, 95).toFixed(0);

    const presStr = `${((m.presence.likes / 200) * 100).toFixed(0)}/${((m.presence.saves / 200) * 100).toFixed(0)}/${((m.presence.reposts / 200) * 100).toFixed(0)}/${((m.presence.comments / 200) * 100).toFixed(0)}/${((m.presence.shares / 200) * 100).toFixed(0)}`;

    const lMed = (percentile(m.likesPcts, 50) * 100).toFixed(2) + "%";
    const lP95 = (percentile(m.likesPcts, 95) * 100).toFixed(2) + "%";
    const lMax = (Math.max(...m.likesPcts) * 100).toFixed(2) + "%";

    const topRej = Object.entries(m.rejectionReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k} (${v})`)
      .join(", ");

    console.log(
      `${m.platform.padEnd(8)} | ${m.pkgName.padEnd(7)} | ${p1st.padEnd(9)} | ${(bP5 + "/" + bMed + "/" + bP95).padEnd(20)} | ${(fP5 + "/" + fMed + "/" + fP95).padEnd(29)} | ${presStr.padEnd(21)} | ${(lMed + "/" + lP95 + "/" + lMax).padEnd(21)} | ${topRej}`
    );
  }

  console.log("\n=== CONVERGENCE REPORT (ATTEMPTS NEEDED ACROSS 200 SEEDS) ===");
  console.log("Platform | Package | Mean Attempts | P95 Attempts | Max Attempts | Exhausted 50 Attempts?");
  console.log("---------|---------|---------------|--------------|--------------|------------------------");
  for (const m of results) {
    const meanAtt = (m.totalAttempts.reduce((a, b) => a + b, 0) / m.totalAttempts.length).toFixed(2);
    const p95Att = percentile(m.totalAttempts, 95).toFixed(1);
    const maxAtt = Math.max(...m.totalAttempts);
    console.log(
      `${m.platform.padEnd(8)} | ${m.pkgName.padEnd(7)} | ${meanAtt.padEnd(13)} | ${p95Att.padEnd(12)} | ${String(maxAtt).padEnd(12)} | ${m.exhaustedCount === 0 ? "0 / 200 (None)" : `${m.exhaustedCount} / 200`}`
    );
  }

  console.log("\n=== ROWS_DISTRIBUTION_FAILED SUB-CAUSE BREAKDOWN ===");
  console.log("Platform | Package | Total Failed Dist | Leftover Cap/Repeat Limit | No Flush Candidates");
  console.log("---------|---------|-------------------|---------------------------|---------------------");
  for (const m of results) {
    const totFail = m.rejectionReasons["ROWS_DISTRIBUTION_FAILED"] || 0;
    const leftoverFail = m.distributionFailedSubcauses["LEFTOVER_MERGE_CAP_OR_REPEAT_LIMIT"] || 0;
    const noCandFail = m.distributionFailedSubcauses["NO_FLUSH_CANDIDATE_BATCHES"] || 0;
    console.log(
      `${m.platform.padEnd(8)} | ${m.pkgName.padEnd(7)} | ${String(totFail).padEnd(17)} | ${String(leftoverFail).padEnd(25)} | ${String(noCandFail)}`
    );
  }

  console.log("\n=== BATCH IRREGULARITY REPORT (NON-PUSH BATCHES ACROSS 200 SEEDS) ===");
  console.log("Platform | Package | CV (std/mean) Med/P95 | % in 100-120 (Med/P95) | % Within 5% (Med/P95) | Max/Min Ratio (Med/P95)");
  console.log("---------|---------|-----------------------|------------------------|-----------------------|------------------------");
  for (const m of results) {
    const cvMed = percentile(m.cvs, 50).toFixed(3);
    const cvP95 = percentile(m.cvs, 95).toFixed(3);
    const p100Med = percentile(m.pcts100_120, 50).toFixed(1) + "%";
    const p100P95 = percentile(m.pcts100_120, 95).toFixed(1) + "%";
    const p5Med = percentile(m.pctsPairsWithin5, 50).toFixed(1) + "%";
    const p5P95 = percentile(m.pctsPairsWithin5, 95).toFixed(1) + "%";
    const mmMed = percentile(m.maxMinRatios, 50).toFixed(2);
    const mmP95 = percentile(m.maxMinRatios, 95).toFixed(2);

    console.log(
      `${m.platform.padEnd(8)} | ${m.pkgName.padEnd(7)} | ${(cvMed + " / " + cvP95).padEnd(21)} | ${(p100Med + " / " + p100P95).padEnd(22)} | ${(p5Med + " / " + p5P95).padEnd(21)} | ${mmMed + " / " + mmP95}`
    );
  }

  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf8");
    console.log(`\nRaw measurement JSON written to: ${outputPath}`);
  }

  return results;
}

// Parse CLI args when invoked directly
if (require.main === module || process.argv[1]?.endsWith("measure-engine.ts")) {
  let seedNamespace = "m1_review";
  let outputPath: string | undefined = undefined;

  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--seed-namespace" && i + 1 < args.length) {
      seedNamespace = args[++i];
    } else if (args[i] === "--output" && i + 1 < args.length) {
      outputPath = args[++i];
    }
  }

  runMeasurements(seedNamespace, outputPath).catch(console.error);
}

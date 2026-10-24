/**
 * Visualizer for Instagram Organic Delivery Plans (Reels vs Posts)
 * 
 * Plots 10 distinct Instagram plans for 10,000 views across seeds,
 * outputs an ASCII summary table, and renders an SVG chart file.
 */

import fs from "fs";
import path from "path";
import { generateOrganicPlan } from "../src/lib/engagement/planner";

const SEEDS = [
  51920, 84012, 13948, 67204, 30192,
  92831, 41029, 78201, 24910, 88102,
];

const COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#f97316", // orange
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#ef4444", // red
];

console.log("================================================================================");
console.log(" DHANSMM INSTAGRAM ORGANIC PACING VISUALIZER — 10 PLANS (10,000 VIEWS)");
console.log(" Platform: Instagram Reel (72h) vs Post (48h)");
console.log("================================================================================\n");

const plans = SEEDS.map((seed, idx) => {
  const isPost = idx >= 7; // show Reel for first 7, Post for last 3
  const profileId = isPost ? "instagram_post" : "instagram_reel";
  const plan = generateOrganicPlan({
    profileId,
    baseViews: 10000,
    seed,
    targetTz: "Asia/Kolkata",
    startTime: new Date("2026-10-24T12:00:00Z"),
  });
  return { idx: idx + 1, seed, profileId, plan, color: COLORS[idx] };
});

console.log("| #  | Seed   | Format        | Archetype       | k    | m    | Runs | Likes | Saves | Shares | Comm | Fingerprint (prefix)");
console.log("|----|--------|---------------|-----------------|------|------|------|-------|-------|--------|------|---------------------");
for (const item of plans) {
  const p = item.plan.params;
  const pl = item.plan.plans;
  const fpPrefix = p.fingerprint.split(":").slice(0, 3).join(":");
  const format = item.profileId === "instagram_post" ? "Post (48h)" : "Reel (72h)";
  console.log(
    `| ${String(item.idx).padStart(2)} | ${String(item.seed).padEnd(6)} | ${format.padEnd(13)} | ${p.archetype.padEnd(15)} | ${p.k.toFixed(2)} | ${p.m.toFixed(2)} | ${String(item.plan.allRuns.length).padStart(4)} | ${String(pl.likes.totalQuantity).padStart(5)} | ${String(pl.saves.totalQuantity).padStart(5)} | ${String(pl.shares.totalQuantity).padStart(6)} | ${String(pl.comments.totalQuantity).padStart(4)} | ${fpPrefix}`
  );
}

// Generate SVG Chart
const width = 1000;
const height = 620;
const padLeft = 80;
const padRight = 240;
const padTop = 60;
const padBottom = 70;
const chartW = width - padLeft - padRight;
const chartH = height - padTop - padBottom;

const maxViews = 10000;
const maxMinutes = 72 * 60;

function mapX(minutes: number) {
  return padLeft + (Math.min(maxMinutes, minutes) / maxMinutes) * chartW;
}

function mapY(views: number) {
  return padTop + chartH - (views / maxViews) * chartH;
}

const polylines = plans.map((item) => {
  const pts = item.plan.curvePoints.map((pt) => `${mapX(pt.minutes).toFixed(1)},${mapY(pt.views).toFixed(1)}`);
  return { ...item, pointsStr: pts.join(" ") };
});

let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="background:#0f172a; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <rect width="${width}" height="${height}" fill="#0f172a" />

  <text x="${padLeft}" y="32" fill="#f8fafc" font-size="18" font-weight="700">DhanSMM Instagram Organic Delivery — 10 Distinct Plans (10,000 Views)</text>
  <text x="${padLeft}" y="50" fill="#94a3b8" font-size="12">Multi-wave Reels (72h) vs front-loaded Feed Posts (48h) • S-curve k ∈ [5.5, 7.5], circadian peak weighting (+40%)</text>
`;

// Horizontal Grid
for (let v = 0; v <= 10000; v += 2000) {
  const y = mapY(v);
  svgContent += `  <line x1="${padLeft}" y1="${y}" x2="${padLeft + chartW}" y2="${y}" stroke="#334155" stroke-dasharray="4,4" stroke-width="1" />
  <text x="${padLeft - 12}" y="${y + 4}" fill="#64748b" font-size="11" text-anchor="end">${v.toLocaleString()}</text>\n`;
}

// Vertical Grid (12h steps)
for (let h = 0; h <= 72; h += 12) {
  const x = mapX(h * 60);
  svgContent += `  <line x1="${x}" y1="${padTop}" x2="${x}" y2="${padTop + chartH}" stroke="#334155" stroke-dasharray="4,4" stroke-width="1" />
  <text x="${x}" y="${padTop + chartH + 20}" fill="#64748b" font-size="11" text-anchor="middle">+${h}h</text>\n`;
}

// Peak Hour Shading
for (let d = 0; d < 3; d++) {
  const dayStartMin = d * 24 * 60;
  const xLunchStart = mapX(dayStartMin + 12 * 60);
  const xLunchEnd = mapX(dayStartMin + 14 * 60);
  svgContent += `  <rect x="${xLunchStart}" y="${padTop}" width="${xLunchEnd - xLunchStart}" height="${chartH}" fill="#38bdf8" fill-opacity="0.05" />\n`;

  const xEveStart = mapX(dayStartMin + 19 * 60);
  const xEveEnd = mapX(dayStartMin + 23 * 60);
  svgContent += `  <rect x="${xEveStart}" y="${padTop}" width="${xEveEnd - xEveStart}" height="${chartH}" fill="#38bdf8" fill-opacity="0.08" />\n`;
}

// Render Curves
for (const p of polylines) {
  const isDashed = p.profileId === "instagram_post";
  svgContent += `  <polyline fill="none" stroke="${p.color}" stroke-width="${isDashed ? 3 : 2.5}" stroke-dasharray="${isDashed ? "6,3" : "none"}" stroke-linecap="round" stroke-linejoin="round" points="${p.pointsStr}" opacity="0.9" />\n`;
}

// Legend
const legendX = padLeft + chartW + 20;
let legendY = padTop + 10;
svgContent += `  <text x="${legendX}" y="${legendY}" fill="#e2e8f0" font-size="13" font-weight="700">Instagram Plans:</text>\n`;
legendY += 20;

for (const p of polylines) {
  const isPost = p.profileId === "instagram_post";
  const name = `#${p.idx} ${isPost ? "Post" : "Reel"} (${p.plan.params.archetype})`;
  svgContent += `  <circle cx="${legendX + 6}" cy="${legendY - 4}" r="5" fill="${p.color}" />
  <text x="${legendX + 18}" y="${legendY}" fill="#cbd5e1" font-size="11">${name}</text>\n`;
  legendY += 19;
}

legendY += 15;
svgContent += `  <text x="${legendX}" y="${legendY}" fill="#94a3b8" font-size="10" font-weight="600">Style Legend:</text>\n`;
legendY += 16;
svgContent += `  <line x1="${legendX}" y1="${legendY - 4}" x2="${legendX + 20}" y2="${legendY - 4}" stroke="#cbd5e1" stroke-width="2" />
  <text x="${legendX + 28}" y="${legendY}" fill="#cbd5e1" font-size="10">Reel 72h (Solid)</text>\n`;
legendY += 16;
svgContent += `  <line x1="${legendX}" y1="${legendY - 4}" x2="${legendX + 20}" y2="${legendY - 4}" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="4,2" />
  <text x="${legendX + 28}" y="${legendY}" fill="#cbd5e1" font-size="10">Post 48h (Dashed)</text>\n`;

svgContent += `</svg>`;

const outputPath = path.resolve(process.cwd(), "instagram_pacing_comparison.svg");
fs.writeFileSync(outputPath, svgContent, "utf8");

console.log(`\n✔ Successfully generated SVG visualization at: ${outputPath}\n`);

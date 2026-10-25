/**
 * Visualizer for Organic Pacing Plans
 * 
 * Generates 10 plans for 10,000 views with different seeds over 72 hours,
 * demonstrates archetype diversity, and outputs both an ASCII progress summary
 * and a standalone SVG chart file.
 */

import fs from "fs";
import path from "path";
import { generateOrganicPlan } from "../src/lib/engagement/planner";

const SEEDS = [
  48201, 91823, 14902, 63819, 29011,
  77492, 51028, 83471, 36294, 99182,
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
console.log(" AURASMM ORGANIC PACING PLAN GENERATOR — 10 PLANS VISUAL CONFIRMATION");
console.log(" Base Views: 10,000 | Duration: 72 Hours | Platform: Instagram");
console.log("================================================================================\n");

const plans = SEEDS.map((seed, idx) => {
  const plan = generateOrganicPlan({
    baseViews: 10000,
    seed,
    durationPreset: "72h",
    startTime: new Date("2026-10-24T12:00:00Z"),
    targetTz: "Asia/Kolkata",
  });
  return { idx: idx + 1, seed, plan, color: COLORS[idx] };
});

// Print Plan Profiles
console.log("| #  | Seed   | Archetype       | k    | m    | Runs | Likes | Saves | Shares | Comm | Fingerprint (prefix)");
console.log("|----|--------|-----------------|------|------|------|-------|-------|--------|------|---------------------");
for (const item of plans) {
  const p = item.plan.params;
  const pl = item.plan.plans;
  const fpPrefix = p.fingerprint.split(":").slice(0, 3).join(":");
  console.log(
    `| ${String(item.idx).padStart(2)} | ${String(item.seed).padEnd(6)} | ${p.archetype.padEnd(15)} | ${p.k.toFixed(2)} | ${p.m.toFixed(2)} | ${String(item.plan.allRuns.length).padStart(4)} | ${String(pl.likes.totalQuantity).padStart(5)} | ${String(pl.saves.totalQuantity).padStart(5)} | ${String(pl.shares.totalQuantity).padStart(6)} | ${String(pl.comments.totalQuantity).padStart(4)} | ${fpPrefix}`
  );
}

// Generate Standalone SVG Chart
const width = 1000;
const height = 600;
const padLeft = 80;
const padRight = 240;
const padTop = 60;
const padBottom = 70;
const chartW = width - padLeft - padRight;
const chartH = height - padTop - padBottom;

const maxViews = 10000;
const maxMinutes = 72 * 60;

function mapX(minutes: number) {
  return padLeft + (minutes / maxMinutes) * chartW;
}

function mapY(views: number) {
  return padTop + chartH - (views / maxViews) * chartH;
}

// Build SVG Paths for each plan
const polylines = plans.map((item) => {
  const pts = item.plan.curvePoints.map((pt) => `${mapX(pt.minutes).toFixed(1)},${mapY(pt.views).toFixed(1)}`);
  return {
    ...item,
    pointsStr: pts.join(" "),
  };
});

// SVG Grid and Axis
let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="background:#0f172a; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <defs>
    <linearGradient id="bgGlow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bgGlow)" />

  <!-- Title & Subtitle -->
  <text x="${padLeft}" y="32" fill="#f8fafc" font-size="18" font-weight="700">AuraSMM Organic Pacing Plan Generator — 10 Distinct Plans (10,000 Views, 72h)</text>
  <text x="${padLeft}" y="50" fill="#94a3b8" font-size="12">Natural S-curve growth, bounded parameters (k ∈ [6, 8], m ∈ [0.25, 0.30]), ±3% smooth noise, peak-hour circadian boost</text>

  <!-- Grid Lines (Horizontal) -->
`;

for (let v = 0; v <= 10000; v += 2000) {
  const y = mapY(v);
  svgContent += `  <line x1="${padLeft}" y1="${y}" x2="${padLeft + chartW}" y2="${y}" stroke="#334155" stroke-dasharray="4,4" stroke-width="1" />
  <text x="${padLeft - 12}" y="${y + 4}" fill="#64748b" font-size="11" text-anchor="end">${v.toLocaleString()}</text>\n`;
}

// Grid Lines (Vertical - 12h intervals)
for (let h = 0; h <= 72; h += 12) {
  const x = mapX(h * 60);
  svgContent += `  <line x1="${x}" y1="${padTop}" x2="${x}" y2="${padTop + chartH}" stroke="#334155" stroke-dasharray="4,4" stroke-width="1" />
  <text x="${x}" y="${padTop + chartH + 20}" fill="#64748b" font-size="11" text-anchor="middle">+${h}h</text>\n`;
}

// Peak Hour Window Shading (12-14 and 19-23 for each 24h cycle)
for (let d = 0; d < 3; d++) {
  const dayStartMin = d * 24 * 60;
  // 12:00 - 14:00 (hours 12 to 14)
  const xLunchStart = mapX(dayStartMin + 12 * 60);
  const xLunchEnd = mapX(dayStartMin + 14 * 60);
  svgContent += `  <rect x="${xLunchStart}" y="${padTop}" width="${xLunchEnd - xLunchStart}" height="${chartH}" fill="#38bdf8" fill-opacity="0.04" />\n`;

  // 19:00 - 23:00 (hours 19 to 23)
  const xEveStart = mapX(dayStartMin + 19 * 60);
  const xEveEnd = mapX(dayStartMin + 23 * 60);
  svgContent += `  <rect x="${xEveStart}" y="${padTop}" width="${xEveEnd - xEveStart}" height="${chartH}" fill="#38bdf8" fill-opacity="0.06" />\n`;
}

// Render Curves
for (const p of polylines) {
  svgContent += `  <polyline fill="none" stroke="${p.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${p.pointsStr}" opacity="0.9" />\n`;
}

// Legend
const legendX = padLeft + chartW + 24;
let legendY = padTop + 10;
svgContent += `  <text x="${legendX}" y="${legendY}" fill="#e2e8f0" font-size="13" font-weight="600">Generated Plans:</text>\n`;
legendY += 20;

for (const p of polylines) {
  const name = `Plan #${p.idx} (${p.plan.params.archetype})`;
  svgContent += `  <circle cx="${legendX + 6}" cy="${legendY - 4}" r="5" fill="${p.color}" />
  <text x="${legendX + 18}" y="${legendY}" fill="#cbd5e1" font-size="11">${name}</text>\n`;
  legendY += 20;
}

// Legend footnotes
legendY += 15;
svgContent += `  <text x="${legendX}" y="${legendY}" fill="#94a3b8" font-size="10" font-weight="600">Peak Hour Shading:</text>\n`;
legendY += 16;
svgContent += `  <rect x="${legendX}" y="${legendY - 9}" width="12" height="10" fill="#38bdf8" fill-opacity="0.25" />
  <text x="${legendX + 18}" y="${legendY}" fill="#94a3b8" font-size="10">12:00-14:00 & 19:00-23:00 (+40%)</text>\n`;

svgContent += `</svg>`;

const outputPath = path.resolve(process.cwd(), "pacing_comparison_chart.svg");
fs.writeFileSync(outputPath, svgContent, "utf8");

console.log(`\n✔ Successfully generated SVG chart visualization at: ${outputPath}`);
console.log("Open 'pacing_comparison_chart.svg' in any browser to inspect the 10 distinct organic delivery curves.\n");

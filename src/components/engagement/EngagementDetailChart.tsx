"use client";

import React, { useState, useMemo } from "react";
import { EngagementType } from "@/lib/engagement/planner";
import { createMonotoneCubicSpline, SplinePoint } from "@/lib/engagement/monotone-cubic";

export interface ChartCurvePoint {
  minutes: number;
  timeLabel?: string;
  views: number;
  likes: number;
  saves: number;
  shares: number;
  comments: number;
}

export interface ChartStatusSample {
  timestamp: string;
  views: number;
  likes: number;
  saves: number;
  shares: number;
  comments: number;
}

export interface ChartRunItem {
  engagementType: EngagementType | string;
  runIndex?: number;
  runNumber?: number;
  scheduledAt: string | Date;
  minutesFromStart?: number;
  quantity: number;
  plannedCumulative?: number;
  cumulativeQuantity?: number;
  deliveredQuantity?: number;
  deliveredCumulative?: number;
  status?: string;
}

export interface EngagementDetailChartProps {
  durationHours: number;
  expectedCurve: ChartCurvePoint[];
  statusSamples?: ChartStatusSample[];
  runs?: ChartRunItem[];
  createdAt?: string | Date;
  visibleTypes: Record<EngagementType, boolean>;
  onToggleType?: (type: EngagementType) => void;
  showDelivered?: boolean;
  showNowMarker?: boolean;
  height?: number;
}

const ALL_ENGAGEMENT_TYPES: EngagementType[] = ["views", "likes", "saves", "shares", "comments"];

const TYPE_COLORS: Record<EngagementType, { stroke: string; lightBg: string; text: string }> = {
  views: { stroke: "#3A4EFB", lightBg: "#EFF2FE", text: "text-[#3A4EFB]" },
  likes: { stroke: "#E11D48", lightBg: "#FFE4E6", text: "text-[#E11D48]" },
  saves: { stroke: "#D97706", lightBg: "#FEF3C7", text: "text-[#D97706]" },
  shares: { stroke: "#7C3AED", lightBg: "#EDE9FE", text: "text-[#7C3AED]" },
  comments: { stroke: "#059669", lightBg: "#D1FAE5", text: "text-[#059669]" },
};

/**
 * Generates clean, readable time ticks for real duration x-axis.
 * - Under 2 hours: minutes (0, 15m, 30m, 45m, 1h, 1h 15m, 1h 30m, ...)
 * - Under 2 days (48h): hours (0, 3h, 6h, 12h, 24h, 36h, 48h)
 * - 2 days and up: days (0, 1d, 2d, 3d, ...)
 * Never shows "3d" for an order under an hour.
 */
export function generateTimeTicks(durationHours: number): Array<{ minutes: number; label: string }> {
  const totalMinutes = Math.max(15, Math.round(durationHours * 60));
  const ticks: Array<{ minutes: number; label: string }> = [];

  if (durationHours < 2) {
    // Under 2 hours: every 15 minutes (0, 15m, 30m, 45m, 1h, 1h 15m, ...)
    for (let m = 0; m <= totalMinutes; m += 15) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      let label = "0";
      if (m > 0) {
        if (h > 0 && min > 0) label = `${h}h ${min}m`;
        else if (h > 0) label = `${h}h`;
        else label = `${min}m`;
      }
      ticks.push({ minutes: m, label });
    }
  } else if (durationHours < 48) {
    // Under 2 days: hours format
    const stepHours = durationHours <= 6 ? 1 : durationHours <= 18 ? 3 : 6;
    for (let h = 0; h * 60 <= totalMinutes; h += stepHours) {
      ticks.push({ minutes: h * 60, label: `${h}h` });
    }
  } else {
    // 2 days and up: days format
    const stepDays = durationHours <= 120 ? 1 : 2;
    for (let d = 0; d * 24 * 60 <= totalMinutes; d += stepDays) {
      ticks.push({ minutes: d * 24 * 60, label: `${d}d` });
    }
  }

  // Ensure last tick captures end if not close to previous tick
  const last = ticks[ticks.length - 1];
  if (last && totalMinutes - last.minutes > totalMinutes * 0.12) {
    if (durationHours < 2) {
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      const label = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
      ticks.push({ minutes: totalMinutes, label });
    } else if (durationHours < 48) {
      const h = Math.round(durationHours * 10) / 10;
      ticks.push({ minutes: totalMinutes, label: `${h % 1 === 0 ? h : h.toFixed(1)}h` });
    } else {
      const d = Math.round((durationHours / 24) * 10) / 10;
      ticks.push({ minutes: totalMinutes, label: `${d % 1 === 0 ? d : d.toFixed(1)}d` });
    }
  }

  return ticks;
}

export function EngagementDetailChart({
  durationHours,
  expectedCurve = [],
  statusSamples = [],
  runs = [],
  createdAt,
  visibleTypes,
  onToggleType,
  showDelivered = true,
  showNowMarker = true,
  height = 260,
}: EngagementDetailChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [scalePerType, setScalePerType] = useState<boolean>(false);

  const totalMinutes = Math.max(15, Math.round(durationHours * 60));
  const timeTicks = useMemo(() => generateTimeTicks(durationHours), [durationHours]);

  // SVG Geometry
  const width = 760;
  const paddingLeft = 46;
  const paddingRight = 24;
  const paddingTop = 26;
  const paddingBottom = 34;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Compute maximums per type and overall
  const { maxYPerType, overallMaxY, typesInPlan } = useMemo(() => {
    const maxByType: Record<EngagementType, number> = {
      views: 0,
      likes: 0,
      saves: 0,
      shares: 0,
      comments: 0,
    };

    // From expectedCurve
    for (const pt of expectedCurve) {
      for (const t of ALL_ENGAGEMENT_TYPES) {
        if (pt[t] && pt[t] > maxByType[t]) maxByType[t] = pt[t];
      }
    }

    // From planned runs
    for (const r of runs) {
      const t = r.engagementType as EngagementType;
      const cum = r.plannedCumulative || r.cumulativeQuantity || 0;
      if (t && ALL_ENGAGEMENT_TYPES.includes(t) && cum > maxByType[t]) {
        maxByType[t] = cum;
      }
    }

    // From status samples
    for (const s of statusSamples) {
      for (const t of ALL_ENGAGEMENT_TYPES) {
        if (s[t] && s[t] > maxByType[t]) maxByType[t] = s[t];
      }
    }

    // Identify types that actually exist in the plan with quantity > 0
    // Requirement 4: Disabled types must be removed from chart, legend, and counts
    const inPlan = ALL_ENGAGEMENT_TYPES.filter((t) => maxByType[t] > 0);

    let overall = 0;
    for (const t of inPlan) {
      if (visibleTypes[t] && maxByType[t] > overall) overall = maxByType[t];
    }

    return {
      maxYPerType: maxByType,
      overallMaxY: overall > 0 ? overall : 100,
      typesInPlan: inPlan,
    };
  }, [expectedCurve, runs, statusSamples, visibleTypes]);

  // Coordinate transforms
  const getX = (minutes: number) => {
    const clamped = Math.max(0, Math.min(totalMinutes, minutes));
    return paddingLeft + (clamped / totalMinutes) * chartWidth;
  };

  const getY = (val: number, type?: EngagementType) => {
    const targetMax = scalePerType && type && maxYPerType[type] > 0
      ? maxYPerType[type]
      : overallMaxY;
    const clamped = Math.max(0, Math.min(targetMax, val));
    return paddingTop + chartHeight - (clamped / targetMax) * chartHeight;
  };

  // Build Monotone Cubic Hermite Splines for smooth expected curves
  // Requirement 5: Smooth monotone interpolation through stored plan points, NOT step shape
  const expectedSplines = useMemo(() => {
    const splines: Partial<Record<EngagementType, ReturnType<typeof createMonotoneCubicSpline>>> = {};

    for (const t of typesInPlan) {
      if (!visibleTypes[t]) continue;

      // Filter planned runs for this type to form spline knots
      const typeRuns = runs
        .filter((r) => r.engagementType === t)
        .sort((a, b) => (a.minutesFromStart ?? 0) - (b.minutesFromStart ?? 0));

      const knots: SplinePoint[] = [{ x: 0, y: 0 }];

      if (typeRuns.length > 0) {
        for (const r of typeRuns) {
          const m = r.minutesFromStart ?? 0;
          const cum = r.plannedCumulative || r.cumulativeQuantity || 0;
          knots.push({ x: m, y: cum });
        }
        const lastRunMin = typeRuns[typeRuns.length - 1].minutesFromStart ?? 0;
        if (lastRunMin < totalMinutes) {
          knots.push({ x: totalMinutes, y: maxYPerType[t] });
        }
      } else if (expectedCurve.length > 0) {
        // Fallback to expectedCurve if runs are not populated
        for (const pt of expectedCurve) {
          knots.push({ x: pt.minutes, y: pt[t] || 0 });
        }
      }

      splines[t] = createMonotoneCubicSpline(knots);
    }

    return splines;
  }, [typesInPlan, visibleTypes, runs, expectedCurve, totalMinutes, maxYPerType]);

  // Convert splines to SVG path strings
  const expectedPaths = useMemo(() => {
    const paths: Partial<Record<EngagementType, string>> = {};

    for (const t of typesInPlan) {
      if (!visibleTypes[t]) continue;
      const spline = expectedSplines[t];
      if (!spline || spline.points.length === 0) continue;

      paths[t] = spline.toSvgPath(getX, (yVal) => getY(yVal, t));
    }

    return paths;
  }, [typesInPlan, visibleTypes, expectedSplines, scalePerType, maxYPerType, overallMaxY, totalMinutes]);

  // Build Confirmed Delivered Curve SVG paths (truthful step-accurate solid line)
  // Requirement 5: Step-accurate, only moves when delivery is confirmed
  const deliveredPaths = useMemo(() => {
    if (!showDelivered || statusSamples.length === 0 || !createdAt) return {};
    const paths: Partial<Record<EngagementType, string>> = {};
    const startMs = new Date(createdAt).getTime();

    for (const t of typesInPlan) {
      if (!visibleTypes[t]) continue;
      let d = "";
      // Start at t=0, qty=0
      d += `M ${paddingLeft.toFixed(1)} ${getY(0, t).toFixed(1)}`;

      for (let i = 0; i < statusSamples.length; i++) {
        const sample = statusSamples[i];
        const sampleMs = new Date(sample.timestamp).getTime();
        const mins = Math.max(0, (sampleMs - startMs) / 60000);
        const x = getX(mins);
        const y = getY(sample[t] || 0, t);
        // Step accurate: horizontal line to x, then vertical jump to new quantity
        d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      paths[t] = d;
    }
    return paths;
  }, [statusSamples, showDelivered, createdAt, typesInPlan, visibleTypes, scalePerType, maxYPerType, overallMaxY, totalMinutes]);

  // Calculate "Now" position
  const nowMarker = useMemo(() => {
    if (!showNowMarker || !createdAt) return null;
    const startMs = new Date(createdAt).getTime();
    const elapsedMinutes = (Date.now() - startMs) / 60000;
    if (elapsedMinutes < 0 || elapsedMinutes > totalMinutes * 1.05) return null;
    const x = getX(elapsedMinutes);
    return { x, elapsedMinutes };
  }, [showNowMarker, createdAt, totalMinutes]);

  // Hover position & active data slice
  const hoverData = useMemo(() => {
    if (hoverIndex === null || !expectedCurve[hoverIndex]) return null;
    const pt = expectedCurve[hoverIndex];
    const x = getX(pt.minutes);

    // Find nearest status sample at or before this minute
    let nearestSample: ChartStatusSample | null = null;
    if (createdAt && statusSamples.length > 0) {
      const startMs = new Date(createdAt).getTime();
      for (const s of statusSamples) {
        const sMins = (new Date(s.timestamp).getTime() - startMs) / 60000;
        if (sMins <= pt.minutes) nearestSample = s;
        else break;
      }
    }

    return { pt, x, nearestSample };
  }, [hoverIndex, expectedCurve, statusSamples, createdAt]);

  return (
    <div className="w-full space-y-3">
      {/* Controls Bar: Type Toggles, Scale Per Type Toggle, and Legend */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {typesInPlan.map((t) => {
            const isVis = visibleTypes[t];
            const cfg = TYPE_COLORS[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => onToggleType && onToggleType(t)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                  isVis
                    ? "bg-white border-[#DEE0ED] shadow-xs text-[#252943]"
                    : "bg-gray-100/60 border-transparent text-[#252943]/40 line-through"
                }`}
              >
                <span className="w-2.5 h-1.5 rounded-sm" style={{ backgroundColor: cfg.stroke }} />
                <span className="capitalize">{t}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-semibold text-[#252943]/70">
          {/* Scale Per Type Toggle */}
          <button
            type="button"
            onClick={() => setScalePerType(!scalePerType)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
              scalePerType
                ? "bg-[#3A4EFB] text-white border-[#3A4EFB] shadow-xs"
                : "bg-white text-[#252943]/70 border-[#DEE0ED] hover:text-[#252943]"
            }`}
            title="Scale each engagement type to its own maximum for clear viewing"
          >
            Scale per type
          </button>

          <span className="flex items-center gap-1">
            <span className="w-4 h-0 border-t-2 border-dashed border-[#252943]/60" />
            <span>Expected</span>
          </span>
          {showDelivered && (
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 bg-[#252943]" />
              <span>Delivered (Confirmed)</span>
            </span>
          )}
        </div>
      </div>

      {/* SVG Chart Frame */}
      <div className="relative w-full overflow-hidden rounded-2xl bg-white border border-[#DEE0ED] p-2 shadow-subtle">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * width;
            if (mouseX >= paddingLeft && mouseX <= paddingLeft + chartWidth) {
              const frac = (mouseX - paddingLeft) / chartWidth;
              const targetMin = frac * totalMinutes;
              let bestIdx = 0;
              let bestDiff = Infinity;
              for (let i = 0; i < expectedCurve.length; i++) {
                const diff = Math.abs(expectedCurve[i].minutes - targetMin);
                if (diff < bestDiff) {
                  bestDiff = diff;
                  bestIdx = i;
                }
              }
              setHoverIndex(bestIdx);
            }
          }}
        >
          {/* Horizontal Grid Lines & Y-axis labels */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((frac, i) => {
            const y = paddingTop + chartHeight * (1 - frac);
            const val = Math.round(overallMaxY * frac);
            return (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={paddingLeft + chartWidth}
                  y2={y}
                  stroke="#F0F1F7"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="text-[9px] fill-[#252943]/50 font-mono font-semibold"
                >
                  {scalePerType
                    ? `${Math.round(frac * 100)}%`
                    : val >= 1000
                    ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`
                    : val}
                </text>
              </g>
            );
          })}

          {/* Real-time Vertical Grid Lines & X-axis Labels */}
          {timeTicks.map((tick, i) => {
            const x = getX(tick.minutes);
            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={paddingTop}
                  x2={x}
                  y2={paddingTop + chartHeight}
                  stroke="#F0F1F7"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={paddingTop + chartHeight + 16}
                  textAnchor="middle"
                  className="text-[10px] fill-[#252943]/70 font-bold font-mono"
                >
                  {tick.label}
                </text>
              </g>
            );
          })}

          {/* Expected Curves: Smooth Monotone Cubic Bézier Lines */}
          {typesInPlan.map((t) => {
            const pathD = expectedPaths[t];
            if (!pathD) return null;
            return (
              <path
                key={`exp-${t}`}
                d={pathD}
                fill="none"
                stroke={TYPE_COLORS[t].stroke}
                strokeWidth="2"
                strokeDasharray="4 3"
                opacity={0.9}
              />
            );
          })}

          {/* Confirmed Delivered Curves: Truthful Step-Accurate Solid Line */}
          {showDelivered &&
            typesInPlan.map((t) => {
              const pathD = deliveredPaths[t];
              if (!pathD) return null;
              return (
                <path
                  key={`del-${t}`}
                  d={pathD}
                  fill="none"
                  stroke={TYPE_COLORS[t].stroke}
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}

          {/* Scheduled Run Dots: Exactly One Dot Per Planned Run on that Curve */}
          {runs.map((r, i) => {
            const t = r.engagementType as EngagementType;
            if (!typesInPlan.includes(t) || !visibleTypes[t]) return null;

            const scheduledMs = new Date(r.scheduledAt).getTime();
            const startMs = createdAt ? new Date(createdAt).getTime() : scheduledMs - (r.minutesFromStart || 0) * 60000;
            const mins = r.minutesFromStart ?? Math.max(0, (scheduledMs - startMs) / 60000);
            const x = getX(mins);
            const cum = r.plannedCumulative || r.cumulativeQuantity || 0;
            const y = getY(cum, t);

            const isDone = r.status === "completed";
            const isSent = r.status === "sent" || r.status === "sending";
            const dotFill = isDone ? "#059669" : isSent ? "#D97706" : "#FFFFFF";
            const dotStroke = isDone ? "#059669" : isSent ? "#D97706" : TYPE_COLORS[t].stroke;

            return (
              <circle
                key={`dot-${i}`}
                cx={x}
                cy={y}
                r={3}
                fill={dotFill}
                stroke={dotStroke}
                strokeWidth="1.6"
                className="transition-all hover:scale-125"
              />
            );
          })}

          {/* "Now" Marker Line with Badge */}
          {nowMarker && (
            <g>
              <line
                x1={nowMarker.x}
                y1={paddingTop - 6}
                x2={nowMarker.x}
                y2={paddingTop + chartHeight}
                stroke="#D97706"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <rect
                x={nowMarker.x - 18}
                y={paddingTop - 18}
                width={36}
                height={15}
                rx={4}
                fill="#D97706"
              />
              <text
                x={nowMarker.x}
                y={paddingTop - 7}
                textAnchor="middle"
                className="text-[9px] fill-white font-extrabold uppercase tracking-wider"
              >
                Now
              </text>
            </g>
          )}

          {/* Hover Crosshair */}
          {hoverData && (
            <g>
              <line
                x1={hoverData.x}
                y1={paddingTop}
                x2={hoverData.x}
                y2={paddingTop + chartHeight}
                stroke="#3A4EFB"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity={0.6}
              />
            </g>
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoverData && (
          <div
            className="pointer-events-none absolute z-20 rounded-xl bg-[#252943] text-white p-2.5 text-xs shadow-xl animate-scaleUp space-y-1.5"
            style={{
              left: Math.min(width - 180, Math.max(10, hoverData.x - 70)),
              top: 14,
            }}
          >
            <div className="flex items-center justify-between gap-3 pb-1 border-b border-white/10 text-[11px] font-mono font-bold text-white/70">
              <span>+{Math.floor(hoverData.pt.minutes / 60)}h {hoverData.pt.minutes % 60}m</span>
              <span>Timeline Slice</span>
            </div>
            <div className="space-y-1 text-[11px] font-medium">
              {typesInPlan.map((t) => {
                if (!visibleTypes[t]) return null;
                const expVal = hoverData.pt[t] || 0;
                const delVal = hoverData.nearestSample ? hoverData.nearestSample[t] : null;
                return (
                  <div key={t} className="flex items-center justify-between gap-3">
                    <span className="capitalize text-white/70">{t}:</span>
                    <span className="font-mono font-bold">
                      {delVal !== null && showDelivered ? (
                        <span>
                          <span className="text-emerald-400">{delVal.toLocaleString()}</span>
                          <span className="text-white/40"> / {expVal.toLocaleString()}</span>
                        </span>
                      ) : (
                        <span>{expVal.toLocaleString()}</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

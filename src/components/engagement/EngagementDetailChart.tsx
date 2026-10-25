"use client";

import React, { useState, useMemo } from "react";
import { EngagementType } from "@/lib/engagement/planner";

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

const TYPE_COLORS: Record<EngagementType, { stroke: string; lightBg: string; text: string }> = {
  views: { stroke: "#3A4EFB", lightBg: "#EFF2FE", text: "text-[#3A4EFB]" },
  likes: { stroke: "#E11D48", lightBg: "#FFE4E6", text: "text-[#E11D48]" },
  saves: { stroke: "#D97706", lightBg: "#FEF3C7", text: "text-[#D97706]" },
  shares: { stroke: "#7C3AED", lightBg: "#EDE9FE", text: "text-[#7C3AED]" },
  comments: { stroke: "#059669", lightBg: "#D1FAE5", text: "text-[#059669]" },
};

/**
 * Generates clean, readable time ticks for real-time x-axis spanning from 0 to total duration.
 */
export function generateTimeTicks(durationHours: number): Array<{ minutes: number; label: string }> {
  const totalMinutes = Math.max(15, Math.round(durationHours * 60));
  const ticks: Array<{ minutes: number; label: string }> = [];

  if (durationHours <= 1.5) {
    // Short orders: every 15 minutes (0, 15m, 30m, 45m, 1h...)
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
  } else if (durationHours <= 6) {
    // 2-6 hour orders: every 1 hour
    for (let h = 0; h <= Math.ceil(durationHours); h += 1) {
      ticks.push({ minutes: h * 60, label: `${h}h` });
    }
  } else if (durationHours <= 18) {
    // 7-18 hour orders: every 2 or 3 hours
    const step = durationHours <= 12 ? 2 : 3;
    for (let h = 0; h <= Math.ceil(durationHours); h += step) {
      ticks.push({ minutes: h * 60, label: `${h}h` });
    }
  } else if (durationHours <= 48) {
    // 1-2 day orders: every 6 hours
    for (let h = 0; h <= Math.ceil(durationHours); h += 6) {
      ticks.push({ minutes: h * 60, label: `${h}h` });
    }
  } else if (durationHours <= 96) {
    // 3-4 day orders: every 12 hours or 1 day
    for (let h = 0; h <= Math.ceil(durationHours); h += 12) {
      const d = h / 24;
      const label = Number.isInteger(d) ? `${d}d` : `${h}h`;
      ticks.push({ minutes: h * 60, label });
    }
  } else {
    // Multi-day orders (5-7+ days): every 24 hours / 1 day
    for (let d = 0; d * 24 <= Math.ceil(durationHours); d += 1) {
      ticks.push({ minutes: d * 24 * 60, label: `${d}d` });
    }
  }

  // Ensure last tick captures end if not within 5%
  const last = ticks[ticks.length - 1];
  if (last && totalMinutes - last.minutes > totalMinutes * 0.15) {
    const h = Math.round(durationHours * 10) / 10;
    ticks.push({ minutes: totalMinutes, label: `${h}h` });
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

  const totalMinutes = Math.max(15, Math.round(durationHours * 60));
  const timeTicks = useMemo(() => generateTimeTicks(durationHours), [durationHours]);

  // SVG Coordinate Geometry
  const width = 760;
  const paddingLeft = 46;
  const paddingRight = 24;
  const paddingTop = 26;
  const paddingBottom = 34;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Maximum value for y-axis normalization
  const maxY = useMemo(() => {
    let max = 0;
    for (const pt of expectedCurve) {
      if (visibleTypes.views && pt.views > max) max = pt.views;
      if (visibleTypes.likes && pt.likes > max) max = pt.likes;
      if (visibleTypes.saves && pt.saves > max) max = pt.saves;
      if (visibleTypes.shares && pt.shares > max) max = pt.shares;
      if (visibleTypes.comments && pt.comments > max) max = pt.comments;
    }
    for (const s of statusSamples) {
      if (visibleTypes.views && s.views > max) max = s.views;
      if (visibleTypes.likes && s.likes > max) max = s.likes;
      if (visibleTypes.saves && s.saves > max) max = s.saves;
      if (visibleTypes.shares && s.shares > max) max = s.shares;
      if (visibleTypes.comments && s.comments > max) max = s.comments;
    }
    return max > 0 ? max : 100;
  }, [expectedCurve, statusSamples, visibleTypes]);

  // Coordinate transforms
  const getX = (minutes: number) => {
    const clamped = Math.max(0, Math.min(totalMinutes, minutes));
    return paddingLeft + (clamped / totalMinutes) * chartWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(maxY, val));
    return paddingTop + chartHeight - (clamped / maxY) * chartHeight;
  };

  // Build Expected Curve SVG paths (thin dashed line)
  const expectedPaths = useMemo(() => {
    const paths: Partial<Record<EngagementType, string>> = {};
    const types: EngagementType[] = ["views", "likes", "saves", "shares", "comments"];

    for (const t of types) {
      if (!visibleTypes[t] || expectedCurve.length === 0) continue;
      let d = "";
      for (let i = 0; i < expectedCurve.length; i++) {
        const pt = expectedCurve[i];
        const x = getX(pt.minutes);
        const y = getY(pt[t] || 0);
        d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      paths[t] = d;
    }
    return paths;
  }, [expectedCurve, visibleTypes, maxY, totalMinutes]);

  // Build Confirmed Delivered Curve SVG paths (truthful step-accurate solid line)
  const deliveredPaths = useMemo(() => {
    if (!showDelivered || statusSamples.length === 0 || !createdAt) return {};
    const paths: Partial<Record<EngagementType, string>> = {};
    const types: EngagementType[] = ["views", "likes", "saves", "shares", "comments"];
    const startMs = new Date(createdAt).getTime();

    for (const t of types) {
      if (!visibleTypes[t]) continue;
      let d = "";
      // Start at t=0, qty=0
      d += `M ${paddingLeft.toFixed(1)} ${(paddingTop + chartHeight).toFixed(1)}`;

      for (let i = 0; i < statusSamples.length; i++) {
        const sample = statusSamples[i];
        const sampleMs = new Date(sample.timestamp).getTime();
        const mins = Math.max(0, (sampleMs - startMs) / 60000);
        const x = getX(mins);
        const y = getY(sample[t] || 0);
        // Truthful step: horizontal to x, then vertical to y
        d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      paths[t] = d;
    }
    return paths;
  }, [statusSamples, showDelivered, createdAt, visibleTypes, maxY, totalMinutes]);

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
      {/* Type Toggles Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["views", "likes", "saves", "shares", "comments"] as EngagementType[]).map((t) => {
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

        <div className="flex items-center gap-3 text-[11px] font-semibold text-[#252943]/60">
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
          {/* Subtle Horizontal Grid Lines & Y-axis labels */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((frac, i) => {
            const y = paddingTop + chartHeight * (1 - frac);
            const val = Math.round(maxY * frac);
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
                  {val >= 1000 ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k` : val}
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

          {/* Expected Curves (thin dashed lines) */}
          {(["views", "likes", "saves", "shares", "comments"] as EngagementType[]).map((t) => {
            const pathD = expectedPaths[t];
            if (!pathD) return null;
            return (
              <path
                key={`exp-${t}`}
                d={pathD}
                fill="none"
                stroke={TYPE_COLORS[t].stroke}
                strokeWidth="1.8"
                strokeDasharray="4 3"
                opacity={0.85}
              />
            );
          })}

          {/* Confirmed Delivered Curves (truthful solid step-line) */}
          {showDelivered &&
            (["views", "likes", "saves", "shares", "comments"] as EngagementType[]).map((t) => {
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

          {/* Scheduled Run Dots */}
          {runs.map((r, i) => {
            const t = r.engagementType as EngagementType;
            if (!visibleTypes[t]) return null;
            const scheduledMs = new Date(r.scheduledAt).getTime();
            const startMs = createdAt ? new Date(createdAt).getTime() : scheduledMs - (r.minutesFromStart || 0) * 60000;
            const mins = r.minutesFromStart ?? Math.max(0, (scheduledMs - startMs) / 60000);
            const x = getX(mins);
            const cum = r.plannedCumulative || r.cumulativeQuantity || 0;
            const y = getY(cum);

            const isDone = r.status === "completed";
            const isSent = r.status === "sent" || r.status === "sending";
            const dotFill = isDone ? "#059669" : isSent ? "#D97706" : "#FFFFFF";
            const dotStroke = isDone ? "#059669" : isSent ? "#D97706" : "#94A3B8";

            return (
              <circle
                key={`dot-${i}`}
                cx={x}
                cy={y}
                r={2.8}
                fill={dotFill}
                stroke={dotStroke}
                strokeWidth="1.5"
                className="transition-all"
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

          {/* Hover Crosshair & Indicator */}
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
              {(["views", "likes", "saves", "shares", "comments"] as EngagementType[]).map((t) => {
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

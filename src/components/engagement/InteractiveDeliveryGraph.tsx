"use client";

import React, { useState, useRef, useMemo, useCallback } from "react";
import {
  Flame,
  Zap,
  Activity,
  Moon,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Info,
  ChevronRight,
} from "lucide-react";
import { PacingStrategy } from "@/lib/engagement/organic-pacing-engine";

interface Point {
  x: number;
  y: number;
}

/**
 * Catmull-Rom to Cubic Bézier spline generator for organic, smooth non-linear curves.
 */
function getSmoothSplinePath(points: Point[], tension: number = 0.22): string {
  if (!points || points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function getClosedAreaPath(points: Point[], baselineY: number, tension: number = 0.22): string {
  const lineD = getSmoothSplinePath(points, tension);
  if (!lineD || points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${lineD} L ${last.x.toFixed(1)} ${baselineY.toFixed(1)} L ${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
}

export interface InteractiveDeliveryGraphProps {
  durationHours: number;
  strategy: PacingStrategy;
  views: number[];
  viewOffsets: number[];
  likes?: number[];
  likeOffsets?: number[];
  saves?: number[];
  saveOffsets?: number[];
  shares?: number[];
  shareOffsets?: number[];
  providerMinimum?: number;
  planTimestamp?: Date;
  onUpdateViews: (newViews: number[]) => void;
  onUpdateLikes?: (newLikes: number[]) => void;
  onUpdateSaves?: (newSaves: number[]) => void;
  onUpdateShares?: (newShares: number[]) => void;
  onResetPlan?: () => void;
}

export function InteractiveDeliveryGraph({
  durationHours,
  strategy,
  views,
  viewOffsets,
  likes = [],
  likeOffsets = [],
  saves = [],
  saveOffsets = [],
  shares = [],
  shareOffsets = [],
  providerMinimum = 100,
  planTimestamp,
  onUpdateViews,
  onUpdateLikes,
  onUpdateSaves,
  onUpdateShares,
  onResetPlan,
}: InteractiveDeliveryGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // SVG dimensions
  const SVG_WIDTH = 800;
  const SVG_HEIGHT = 240;
  const padLeft = 45;
  const padRight = 24;
  const padTop = 26;
  const padBottom = 34;

  const plotWidth = SVG_WIDTH - padLeft - padRight;
  const plotHeight = SVG_HEIGHT - padTop - padBottom;
  const baselineY = padTop + plotHeight;

  // Active dragging state
  const [activeDrag, setActiveDrag] = useState<{
    type: "views" | "likes" | "saves" | "shares";
    index: number;
  } | null>(null);

  // Hovered item for tooltip
  const [hoveredNode, setHoveredNode] = useState<{
    type: "views" | "likes" | "saves" | "shares";
    index: number;
    x: number;
    y: number;
    qty: number;
    minute: number;
  } | null>(null);

  // Time bounds
  const totalMinutes = Math.max(60, (durationHours || 5) * 60);

  const getX = useCallback(
    (minute: number) => {
      const clamped = Math.max(0, Math.min(totalMinutes, minute));
      return padLeft + (clamped / totalMinutes) * plotWidth;
    },
    [totalMinutes, plotWidth, padLeft]
  );

  // Max views ceiling for Y axis
  const maxViews = useMemo(() => {
    return Math.max(...views, 250);
  }, [views]);

  const yCeil = useMemo(() => {
    return Math.ceil((maxViews * 1.25) / 50) * 50;
  }, [maxViews]);

  const getY = useCallback(
    (qty: number) => {
      const clamped = Math.max(0, qty);
      return padTop + plotHeight - (clamped / yCeil) * plotHeight;
    },
    [yCeil, plotHeight, padTop]
  );

  const getQtyFromY = useCallback(
    (yVal: number) => {
      const ratio = (baselineY - yVal) / plotHeight;
      return Math.round(Math.max(providerMinimum, ratio * yCeil));
    },
    [baselineY, plotHeight, yCeil, providerMinimum]
  );

  // Auxiliary engagement scaling (Likes, Saves, Shares)
  const maxLikes = useMemo(() => Math.max(...likes, 20), [likes]);
  const getLikeY = useCallback(
    (qty: number) => {
      const ratio = Math.max(0, qty) / (maxLikes * 1.35);
      return padTop + plotHeight - ratio * (plotHeight * 0.52);
    },
    [maxLikes, plotHeight, padTop]
  );
  const getLikeQtyFromY = useCallback(
    (yVal: number) => {
      const ratio = (baselineY - yVal) / (plotHeight * 0.52);
      return Math.round(Math.max(10, Math.min(200, ratio * (maxLikes * 1.35))));
    },
    [baselineY, plotHeight, maxLikes]
  );

  const maxSaves = useMemo(() => Math.max(...saves, 15), [saves]);
  const getSaveY = useCallback(
    (qty: number) => {
      const ratio = Math.max(0, qty) / (maxSaves * 1.35);
      return padTop + plotHeight - ratio * (plotHeight * 0.42);
    },
    [maxSaves, plotHeight, padTop]
  );
  const getSaveQtyFromY = useCallback(
    (yVal: number) => {
      const ratio = (baselineY - yVal) / (plotHeight * 0.42);
      return Math.round(Math.max(10, Math.min(100, ratio * (maxSaves * 1.35))));
    },
    [baselineY, plotHeight, maxSaves]
  );

  const maxShares = useMemo(() => Math.max(...shares, 12), [shares]);
  const getShareY = useCallback(
    (qty: number) => {
      const ratio = Math.max(0, qty) / (maxShares * 1.35);
      return padTop + plotHeight - ratio * (plotHeight * 0.36);
    },
    [maxShares, plotHeight, padTop]
  );
  const getShareQtyFromY = useCallback(
    (yVal: number) => {
      const ratio = (baselineY - yVal) / (plotHeight * 0.36);
      return Math.round(Math.max(10, Math.min(80, ratio * (maxShares * 1.35))));
    },
    [baselineY, plotHeight, maxShares]
  );

  // Compute points
  const viewPoints: Point[] = useMemo(() => {
    return views.map((val, idx) => ({
      x: getX(viewOffsets[idx] ?? idx * (totalMinutes / Math.max(1, views.length))),
      y: getY(val),
    }));
  }, [views, viewOffsets, getX, getY, totalMinutes]);

  const likePoints: Point[] = useMemo(() => {
    return likes.map((val, idx) => ({
      x: getX(likeOffsets[idx] ?? idx * 60),
      y: getLikeY(val),
    }));
  }, [likes, likeOffsets, getX, getLikeY]);

  const savePoints: Point[] = useMemo(() => {
    return saves.map((val, idx) => ({
      x: getX(saveOffsets[idx] ?? idx * 90),
      y: getSaveY(val),
    }));
  }, [saves, saveOffsets, getX, getSaveY]);

  const sharePoints: Point[] = useMemo(() => {
    return shares.map((val, idx) => ({
      x: getX(shareOffsets[idx] ?? idx * 120),
      y: getShareY(val),
    }));
  }, [shares, shareOffsets, getX, getShareY]);

  // Smooth spline curves
  const viewsPath = useMemo(() => getSmoothSplinePath(viewPoints), [viewPoints]);
  const viewsArea = useMemo(() => getClosedAreaPath(viewPoints, baselineY), [viewPoints, baselineY]);

  const likesPath = useMemo(() => getSmoothSplinePath(likePoints), [likePoints]);
  const likesArea = useMemo(() => getClosedAreaPath(likePoints, baselineY), [likePoints, baselineY]);

  const savesPath = useMemo(() => getSmoothSplinePath(savePoints), [savePoints]);
  const sharesPath = useMemo(() => getSmoothSplinePath(sharePoints), [sharePoints]);

  // Time axis ticks
  const timeTicks = useMemo(() => {
    const ticks: { minute: number; label: string }[] = [];
    const stepHours = durationHours <= 5 ? 1 : durationHours <= 16 ? 4 : durationHours <= 24 ? 6 : 12;

    for (let h = 0; h <= durationHours; h += stepHours) {
      ticks.push({
        minute: h * 60,
        label: `${h}h`,
      });
    }

    if (ticks[ticks.length - 1].minute !== totalMinutes) {
      ticks.push({
        minute: totalMinutes,
        label: `${Math.round(durationHours)}h`,
      });
    }
    return ticks;
  }, [durationHours, totalMinutes]);

  // Y-axis grid ticks
  const yTicks = useMemo(() => {
    const count = 4;
    const ticks: { val: number; y: number }[] = [];
    for (let i = 0; i <= count; i++) {
      const val = Math.round((yCeil / count) * i);
      ticks.push({ val, y: getY(val) });
    }
    return ticks;
  }, [yCeil, getY]);

  // Drag handler
  const handlePointerDown = (
    type: "views" | "likes" | "saves" | "shares",
    index: number,
    e: React.PointerEvent<SVGCircleElement>
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setActiveDrag({ type, index });
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!activeDrag || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleY = SVG_HEIGHT / rect.height;
    const svgY = (e.clientY - rect.top) * scaleY;

    if (activeDrag.type === "views") {
      const newQty = getQtyFromY(svgY);
      const next = [...views];
      next[activeDrag.index] = newQty;
      onUpdateViews(next);
      setHoveredNode({
        type: "views",
        index: activeDrag.index,
        x: viewPoints[activeDrag.index]?.x ?? 0,
        y: getY(newQty),
        qty: newQty,
        minute: viewOffsets[activeDrag.index] ?? 0,
      });
    } else if (activeDrag.type === "likes" && onUpdateLikes) {
      const newQty = getLikeQtyFromY(svgY);
      const next = [...likes];
      next[activeDrag.index] = newQty;
      onUpdateLikes(next);
    } else if (activeDrag.type === "saves" && onUpdateSaves) {
      const newQty = getSaveQtyFromY(svgY);
      const next = [...saves];
      next[activeDrag.index] = newQty;
      onUpdateSaves(next);
    } else if (activeDrag.type === "shares" && onUpdateShares) {
      const newQty = getShareQtyFromY(svgY);
      const next = [...shares];
      next[activeDrag.index] = newQty;
      onUpdateShares(next);
    }
  };

  const handlePointerUp = () => {
    setActiveDrag(null);
  };

  // Format minute offset to relative string
  const formatOffsetTime = (min: number) => {
    if (min === 0) return "Launch (0m)";
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `+${m}m`;
    if (m === 0) return `+${h}h`;
    return `+${h}h ${m}m`;
  };

  // Strategy badge meta
  const strategyMeta = useMemo(() => {
    switch (strategy) {
      case "s_curve":
        return { name: "S-Curve", desc: "Biological FYP Bell Curve" };
      case "burst":
        return { name: "Burst", desc: "Front-Loaded Viral Wave" };
      case "normal":
        return { name: "Normal", desc: "Steady Human Cadence" };
      case "peak_hours":
        return { name: "Peak Hours", desc: "Prime Evening Concentration" };
      case "stealth":
        return { name: "Stealth", desc: "Low-Velocity Trickle" };
      default:
        return { name: "Organic", desc: "Smooth Algorithm Curve" };
    }
  }, [strategy]);

  const totalCalculatedViews = useMemo(() => {
    return views.reduce((a, b) => a + b, 0);
  }, [views]);

  return (
    <div className="bg-white rounded-3xl border border-[#DEE0ED] p-4 sm:p-5 shadow-subtle space-y-3 font-sans select-none">
      {/* Top Header: Title, Live Strategy & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DEE0ED]/80">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#1A1D31] font-sans">
              Live Delivery Process ({strategyMeta.name})
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#3A4EFB]/10 text-[#3A4EFB]">
              Interactive Spline
            </span>
          </div>
          <p className="text-[11px] text-[#64748B] font-sans">
            {strategyMeta.desc} across {durationHours}h. Drag any circle point to reshape delivery volume.
          </p>
        </div>

        {/* Legend Chips with colors */}
        <div className="flex items-center flex-wrap gap-2 text-[11px] font-bold">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-[#3A4EFB] border border-blue-200/60 shadow-2xs font-sans">
            <span className="w-2 h-2 rounded-full bg-[#3A4EFB]" />
            <span>Views ({totalCalculatedViews.toLocaleString()})</span>
          </span>

          {likes.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200/60 shadow-2xs font-sans">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Likes ({likes.reduce((a, b) => a + b, 0)})</span>
            </span>
          )}

          {saves.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60 shadow-2xs font-sans">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Saves ({saves.reduce((a, b) => a + b, 0)})</span>
            </span>
          )}

          {shares.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60 shadow-2xs font-sans">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span>Reposts ({shares.reduce((a, b) => a + b, 0)})</span>
            </span>
          )}

          {onResetPlan && (
            <button
              type="button"
              onClick={onResetPlan}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#F8F9FD] text-[#64748B] hover:text-[#3A4EFB] hover:bg-white border border-[#DEE0ED] transition-all cursor-pointer press-scale"
              title="Re-roll algorithmic curve"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>Reset Curve</span>
            </button>
          )}
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative w-full overflow-hidden rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED]/80 p-1 sm:p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full h-48 sm:h-60 touch-none overflow-visible cursor-crosshair"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            if (!activeDrag) setHoveredNode(null);
          }}
        >
          <defs>
            {/* Views Blue Gradient */}
            <linearGradient id="viewsAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3A4EFB" stopOpacity="0.22" />
              <stop offset="85%" stopColor="#3A4EFB" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#3A4EFB" stopOpacity="0" />
            </linearGradient>

            {/* Likes Red Gradient */}
            <linearGradient id="likesAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
            </linearGradient>

            {/* Filter for glowing circle handle when dragging */}
            <filter id="handleShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Horizontal Grid Lines & Y-axis Labels */}
          {yTicks.map((tick, i) => (
            <g key={`ytick-${i}`}>
              <line
                x1={padLeft}
                y1={tick.y}
                x2={SVG_WIDTH - padRight}
                y2={tick.y}
                stroke="#E2E8F0"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text
                x={padLeft - 8}
                y={tick.y + 3.5}
                textAnchor="end"
                className="font-sans font-mono text-[9px] font-bold fill-[#94A3B8]"
              >
                {tick.val}
              </text>
            </g>
          ))}

          {/* Vertical Time Lines & X-axis Labels */}
          {timeTicks.map((tick, i) => {
            const xVal = getX(tick.minute);
            return (
              <g key={`xtick-${i}`}>
                <line
                  x1={xVal}
                  y1={padTop}
                  x2={xVal}
                  y2={baselineY}
                  stroke="#E2E8F0"
                  strokeWidth="1"
                  strokeDasharray="2 4"
                  opacity="0.7"
                />
                <text
                  x={xVal}
                  y={baselineY + 16}
                  textAnchor="middle"
                  className="font-sans font-mono text-[10px] font-bold fill-[#64748B]"
                >
                  {tick.label}
                </text>
              </g>
            );
          })}

          {/* Baseline */}
          <line
            x1={padLeft}
            y1={baselineY}
            x2={SVG_WIDTH - padRight}
            y2={baselineY}
            stroke="#CBD5E1"
            strokeWidth="1.5"
          />

          {/* 1. LIKES CURVE & AREA (RED) */}
          {likesArea && <path d={likesArea} fill="url(#likesAreaGrad)" />}
          {likesPath && (
            <path
              d={likesPath}
              fill="none"
              stroke="#EF4444"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* 2. SAVES CURVE (YELLOW) */}
          {savesPath && (
            <path
              d={savesPath}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="4 2"
            />
          )}

          {/* 3. SHARES CURVE (PURPLE) */}
          {sharesPath && (
            <path
              d={sharesPath}
              fill="none"
              stroke="#A855F7"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="3 3"
            />
          )}

          {/* 4. MAIN VIEWS CURVE & AREA (BLUE) */}
          {viewsArea && <path d={viewsArea} fill="url(#viewsAreaGrad)" />}
          {viewsPath && (
            <path
              d={viewsPath}
              fill="none"
              stroke="#3A4EFB"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* 5. AUXILIARY CIRCLE NODES (Saves & Shares) */}
          {savePoints.map((pt, idx) => (
            <g key={`save-node-${idx}`}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r="3.5"
                fill="#FFFFFF"
                stroke="#F59E0B"
                strokeWidth="2"
              />
            </g>
          ))}

          {sharePoints.map((pt, idx) => (
            <g key={`share-node-${idx}`}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r="3"
                fill="#FFFFFF"
                stroke="#A855F7"
                strokeWidth="2"
              />
            </g>
          ))}

          {/* 6. LIKES INTERACTIVE CIRCLE NODES (RED) */}
          {likePoints.map((pt, idx) => {
            const isHovered = hoveredNode?.type === "likes" && hoveredNode?.index === idx;
            const isDragging = activeDrag?.type === "likes" && activeDrag?.index === idx;
            return (
              <g key={`like-node-${idx}`}>
                {/* Generous hit area for effortless touch/pointer grabbing */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="14"
                  fill="transparent"
                  className="cursor-grab active:cursor-grabbing"
                  onPointerDown={(e) => handlePointerDown("likes", idx, e)}
                  onMouseEnter={() =>
                    setHoveredNode({
                      type: "likes",
                      index: idx,
                      x: pt.x,
                      y: pt.y,
                      qty: likes[idx] ?? 0,
                      minute: likeOffsets[idx] ?? idx * 60,
                    })
                  }
                />
                {/* Visual node */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isDragging ? 6.5 : isHovered ? 5.5 : 4}
                  fill="#FFFFFF"
                  stroke="#EF4444"
                  strokeWidth="2.5"
                  filter="url(#handleShadow)"
                  className="transition-all duration-150 pointer-events-none"
                />
              </g>
            );
          })}

          {/* 7. VIEWS PRIMARY DRAGGABLE CIRCLE HANDLES (BLUE) */}
          {viewPoints.map((pt, idx) => {
            const isHovered = hoveredNode?.type === "views" && hoveredNode?.index === idx;
            const isDragging = activeDrag?.type === "views" && activeDrag?.index === idx;
            return (
              <g key={`view-node-${idx}`}>
                {/* Generous 18px invisible touch hit target */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="18"
                  fill="transparent"
                  className="cursor-grab active:cursor-grabbing"
                  onPointerDown={(e) => handlePointerDown("views", idx, e)}
                  onMouseEnter={() =>
                    setHoveredNode({
                      type: "views",
                      index: idx,
                      x: pt.x,
                      y: pt.y,
                      qty: views[idx] ?? 0,
                      minute: viewOffsets[idx] ?? 0,
                    })
                  }
                />
                {/* Pulse ring when dragging */}
                {isDragging && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="12"
                    fill="none"
                    stroke="#3A4EFB"
                    strokeWidth="1.5"
                    opacity="0.4"
                    className="animate-ping"
                  />
                )}
                {/* Center Circle Node */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isDragging ? 7.5 : isHovered ? 6.5 : 5}
                  fill="#FFFFFF"
                  stroke="#3A4EFB"
                  strokeWidth={isDragging ? 3.5 : 3}
                  filter="url(#handleShadow)"
                  className="transition-all duration-150 pointer-events-none"
                />
              </g>
            );
          })}

          {/* Floating Pill Tooltip inside SVG */}
          {hoveredNode && (
            <g
              transform={`translate(${Math.min(
                SVG_WIDTH - 120,
                Math.max(10, hoveredNode.x - 55)
              )}, ${Math.max(10, hoveredNode.y - 36)})`}
              className="pointer-events-none transition-transform"
            >
              <rect
                x="0"
                y="0"
                width="110"
                height="28"
                rx="8"
                fill="#1A1D31"
                filter="url(#handleShadow)"
              />
              <text
                x="55"
                y="17"
                textAnchor="middle"
                className="font-sans font-bold text-[10px] fill-white"
              >
                {hoveredNode.type === "views"
                  ? `Batch #${hoveredNode.index + 1}: ${hoveredNode.qty} Views`
                  : hoveredNode.type === "likes"
                  ? `Wave #${hoveredNode.index + 1}: ${hoveredNode.qty} Likes`
                  : `${hoveredNode.qty} items`}
              </text>
            </g>
          )}
        </svg>

        {/* Bottom Micro Guide */}
        <div className="flex items-center justify-between px-2 pt-1.5 text-[10px] font-semibold text-[#64748B] font-sans">
          <span>0h (Campaign Start)</span>
          <span className="flex items-center gap-1 text-[#3A4EFB] font-bold">
            <span>↑ Drag handles vertically to sculpt delivery flow</span>
          </span>
          <span>{durationHours}h (Completed)</span>
        </div>
      </div>
    </div>
  );
}

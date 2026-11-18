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
  TrendingUp,
  BarChart3,
  CheckCircle2,
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

  // View Mode: "rate" (delivery flow pacing with draggable anchors) vs "cumulative" (total growth S-curve)
  const [viewMode, setViewMode] = useState<"rate" | "cumulative">("rate");

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
    type: "views" | "likes";
    index: number;
  } | null>(null);

  // Hovered item for tooltip
  const [hoveredNode, setHoveredNode] = useState<{
    type: "views" | "likes" | "saves" | "shares";
    label: string;
    x: number;
    y: number;
    qty: number;
    cumQty?: number;
  } | null>(null);

  // Total duration in minutes
  const totalMinutes = Math.max(60, (durationHours || 5) * 60);

  const getX = useCallback(
    (minute: number) => {
      const clamped = Math.max(0, Math.min(totalMinutes, minute));
      return padLeft + (clamped / totalMinutes) * plotWidth;
    },
    [totalMinutes, plotWidth, padLeft]
  );

  // 1. CUMULATIVE DATA (For radar verification view)
  const cumViews = useMemo(() => {
    let running = 0;
    return views.map((v) => (running += v));
  }, [views]);

  const totalViews = cumViews[cumViews.length - 1] || 1;

  const cumLikes = useMemo(() => {
    let running = 0;
    return likes.map((l) => (running += l));
  }, [likes]);
  const totalLikes = cumLikes[cumLikes.length - 1] || 1;

  const cumSaves = useMemo(() => {
    let running = 0;
    return saves.map((s) => (running += s));
  }, [saves]);
  const totalSaves = cumSaves[cumSaves.length - 1] || 1;

  const cumShares = useMemo(() => {
    let running = 0;
    return shares.map((s) => (running += s));
  }, [shares]);
  const totalShares = cumShares[cumShares.length - 1] || 1;

  // 2. RATE SCALING
  const maxViews = useMemo(() => Math.max(...views, 250), [views]);
  const yCeil = useMemo(() => Math.ceil((maxViews * 1.25) / 50) * 50, [maxViews]);

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

  // Auxiliary scaling
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
      return Math.round(Math.max(10, Math.min(250, ratio * (maxLikes * 1.35))));
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

  const maxShares = useMemo(() => Math.max(...shares, 12), [shares]);
  const getShareY = useCallback(
    (qty: number) => {
      const ratio = Math.max(0, qty) / (maxShares * 1.35);
      return padTop + plotHeight - ratio * (plotHeight * 0.36);
    },
    [maxShares, plotHeight, padTop]
  );

  // 3. CUMULATIVE SCALING
  const getCumY = useCallback(
    (val: number, max: number) => {
      const ratio = Math.max(0, val) / (max * 1.08);
      return padTop + plotHeight - ratio * plotHeight;
    },
    [plotHeight, padTop]
  );

  // 4. KEYFRAME CONTROL ANCHORS: select 10 to 12 evenly-spaced points for clean interaction
  const anchorIndices = useMemo(() => {
    if (views.length <= 14) {
      return views.map((_, i) => i);
    }
    const count = 11; // 11 clean keyframes across the curve
    const step = (views.length - 1) / (count - 1);
    const indices: number[] = [];
    for (let k = 0; k < count; k++) {
      indices.push(Math.round(k * step));
    }
    return Array.from(new Set(indices));
  }, [views.length]);

  const likeAnchorIndices = useMemo(() => {
    if (likes.length <= 10) {
      return likes.map((_, i) => i);
    }
    const count = 8;
    const step = (likes.length - 1) / (count - 1);
    const indices: number[] = [];
    for (let k = 0; k < count; k++) {
      indices.push(Math.round(k * step));
    }
    return Array.from(new Set(indices));
  }, [likes.length]);

  // Smooth Gaussian Anchor Propagation
  const handleUpdateViewAnchor = useCallback(
    (anchorIdx: number, newQty: number) => {
      const next = [...views];
      const oldVal = next[anchorIdx] || 1;
      const delta = newQty - oldVal;
      const radius = Math.max(2, Math.floor(views.length * 0.12));

      for (
        let i = Math.max(0, anchorIdx - radius);
        i <= Math.min(views.length - 1, anchorIdx + radius);
        i++
      ) {
        const dist = Math.abs(i - anchorIdx);
        const falloff = Math.cos((dist / (radius + 1)) * (Math.PI / 2));
        next[i] = Math.max(providerMinimum, Math.round(next[i] + delta * falloff));
      }
      onUpdateViews(next);
    },
    [views, providerMinimum, onUpdateViews]
  );

  const handleUpdateLikeAnchor = useCallback(
    (likeIdx: number, newQty: number) => {
      if (!onUpdateLikes) return;
      const next = [...likes];
      const oldVal = next[likeIdx] || 1;
      const delta = newQty - oldVal;
      const radius = Math.max(1, Math.floor(likes.length * 0.15));

      for (
        let i = Math.max(0, likeIdx - radius);
        i <= Math.min(likes.length - 1, likeIdx + radius);
        i++
      ) {
        const dist = Math.abs(i - likeIdx);
        const falloff = Math.cos((dist / (radius + 1)) * (Math.PI / 2));
        next[i] = Math.max(10, Math.round(next[i] + delta * falloff));
      }
      onUpdateLikes(next);
    },
    [likes, onUpdateLikes]
  );

  // 5. POINTS CALCULATION
  // A. Rate Points
  const rateViewPoints: Point[] = useMemo(() => {
    return views.map((val, idx) => ({
      x: getX(viewOffsets[idx] ?? idx * (totalMinutes / Math.max(1, views.length))),
      y: getY(val),
    }));
  }, [views, viewOffsets, getX, getY, totalMinutes]);

  const rateLikePoints: Point[] = useMemo(() => {
    if (!likes || likes.length === 0) return [];
    return likes.map((val, idx) => {
      const minute =
        likeOffsets && typeof likeOffsets[idx] === "number" && likeOffsets[idx] <= totalMinutes
          ? likeOffsets[idx]
          : Math.round(((idx + 0.5) / likes.length) * totalMinutes);
      return {
        x: getX(minute),
        y: getLikeY(val),
      };
    });
  }, [likes, likeOffsets, getX, getLikeY, totalMinutes]);

  const rateSavePoints: Point[] = useMemo(() => {
    if (!saves || saves.length === 0) return [];
    return saves.map((val, idx) => {
      const minute =
        saveOffsets && typeof saveOffsets[idx] === "number" && saveOffsets[idx] <= totalMinutes
          ? saveOffsets[idx]
          : Math.round(((idx + 0.5) / saves.length) * totalMinutes);
      return {
        x: getX(minute),
        y: getSaveY(val),
      };
    });
  }, [saves, saveOffsets, getX, getSaveY, totalMinutes]);

  const rateSharePoints: Point[] = useMemo(() => {
    if (!shares || shares.length === 0) return [];
    return shares.map((val, idx) => {
      const minute =
        shareOffsets && typeof shareOffsets[idx] === "number" && shareOffsets[idx] <= totalMinutes
          ? shareOffsets[idx]
          : Math.round(((idx + 0.5) / shares.length) * totalMinutes);
      return {
        x: getX(minute),
        y: getShareY(val),
      };
    });
  }, [shares, shareOffsets, getX, getShareY, totalMinutes]);

  // B. Cumulative Points (Radar Curve)
  const cumViewPoints: Point[] = useMemo(() => {
    const pts: Point[] = [{ x: padLeft, y: baselineY }];
    views.forEach((_, idx) => {
      const minute = viewOffsets[idx] ?? idx * (totalMinutes / Math.max(1, views.length));
      pts.push({
        x: getX(minute),
        y: getCumY(cumViews[idx], totalViews),
      });
    });
    return pts;
  }, [views, viewOffsets, cumViews, totalViews, getX, getCumY, totalMinutes, baselineY, padLeft]);

  const cumLikePoints: Point[] = useMemo(() => {
    if (!likes || likes.length === 0) return [];
    const pts: Point[] = [{ x: padLeft, y: baselineY }];
    likes.forEach((_, idx) => {
      const minute =
        likeOffsets && typeof likeOffsets[idx] === "number" && likeOffsets[idx] <= totalMinutes
          ? likeOffsets[idx]
          : Math.round(((idx + 0.5) / likes.length) * totalMinutes);
      pts.push({
        x: getX(minute),
        y: getCumY(cumLikes[idx], totalLikes),
      });
    });
    return pts;
  }, [likes, likeOffsets, cumLikes, totalLikes, getX, getCumY, totalMinutes, baselineY, padLeft]);

  // Selected Points depending on viewMode
  const activeViewPoints = viewMode === "cumulative" ? cumViewPoints : rateViewPoints;
  const activeLikePoints = viewMode === "cumulative" ? cumLikePoints : rateLikePoints;
  const activeSavePoints = rateSavePoints;
  const activeSharePoints = rateSharePoints;

  // Splines
  const viewsPath = useMemo(() => getSmoothSplinePath(activeViewPoints), [activeViewPoints]);
  const viewsArea = useMemo(
    () => getClosedAreaPath(activeViewPoints, baselineY),
    [activeViewPoints, baselineY]
  );

  const likesPath = useMemo(() => getSmoothSplinePath(activeLikePoints), [activeLikePoints]);
  const likesArea = useMemo(
    () => getClosedAreaPath(activeLikePoints, baselineY),
    [activeLikePoints, baselineY]
  );

  const savesPath = useMemo(() => getSmoothSplinePath(activeSavePoints), [activeSavePoints]);
  const sharesPath = useMemo(() => getSmoothSplinePath(activeSharePoints), [activeSharePoints]);

  // Time axis ticks
  const timeTicks = useMemo(() => {
    const ticks: { minute: number; label: string }[] = [];
    const stepHours =
      durationHours <= 6
        ? 1
        : durationHours <= 24
        ? 4
        : durationHours <= 48
        ? 12
        : 24;

    for (let h = 0; h <= durationHours; h += stepHours) {
      let label = `${h}h`;
      if (durationHours >= 48) {
        if (h === 0) label = "0h";
        else if (h % 24 === 0) label = `Day ${h / 24}`;
        else label = `${h}h`;
      }
      ticks.push({
        minute: h * 60,
        label,
      });
    }

    if (ticks.length > 0 && ticks[ticks.length - 1].minute !== totalMinutes) {
      let label = `${Math.round(durationHours)}h`;
      if (durationHours >= 48 && durationHours % 24 === 0) {
        label = `Day ${durationHours / 24}`;
      }
      ticks.push({
        minute: totalMinutes,
        label,
      });
    }
    return ticks;
  }, [durationHours, totalMinutes]);

  // Y-axis grid ticks
  const yTicks = useMemo(() => {
    const count = 4;
    const ticks: { val: number | string; y: number }[] = [];
    if (viewMode === "cumulative") {
      for (let i = 0; i <= count; i++) {
        const val = Math.round((totalViews / count) * i);
        const yPos = padTop + plotHeight - (i / count) * (plotHeight / 1.08);
        ticks.push({
          val: val >= 1000 ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k` : val,
          y: yPos,
        });
      }
    } else {
      for (let i = 0; i <= count; i++) {
        const val = Math.round((yCeil / count) * i);
        ticks.push({ val, y: getY(val) });
      }
    }
    return ticks;
  }, [viewMode, totalViews, yCeil, getY, padTop, plotHeight]);

  // Drag handler
  const handlePointerDown = (
    type: "views" | "likes",
    index: number,
    e: React.PointerEvent<SVGCircleElement>
  ) => {
    if (viewMode === "cumulative") return; // Keyframe dragging active in Rate mode
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setActiveDrag({ type, index });
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!activeDrag || !svgRef.current || viewMode === "cumulative") return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleY = SVG_HEIGHT / rect.height;
    const svgY = (e.clientY - rect.top) * scaleY;

    if (activeDrag.type === "views") {
      const newQty = getQtyFromY(svgY);
      handleUpdateViewAnchor(activeDrag.index, newQty);
      setHoveredNode({
        type: "views",
        label: `Phase #${activeDrag.index + 1}`,
        x: rateViewPoints[activeDrag.index]?.x ?? 0,
        y: getY(newQty),
        qty: newQty,
      });
    } else if (activeDrag.type === "likes") {
      const newQty = getLikeQtyFromY(svgY);
      handleUpdateLikeAnchor(activeDrag.index, newQty);
    }
  };

  const handlePointerUp = () => {
    setActiveDrag(null);
  };

  // Strategy badge meta
  const strategyMeta = useMemo(() => {
    switch (strategy) {
      case "s_curve":
        return { name: "S-Curve", desc: "Biological FYP Sigmoid Curve" };
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

  return (
    <div className="bg-white rounded-3xl border border-[#E4E0D3] p-4 sm:p-5 shadow-subtle space-y-3 font-sans select-none">
      {/* Top Header: Title, Live Strategy, Mode Switcher & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E4E0D3]/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[#1A1D31] font-sans">
              Delivery Curve ({strategyMeta.name})
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2F6B3A]/10 text-[#2F6B3A] font-sans">
              Organic Spline
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 hidden sm:inline-flex items-center gap-1 font-sans">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Anti-Radar Approved</span>
            </span>
          </div>
          <p className="text-[11px] text-[#64748B] font-sans">
            {viewMode === "rate"
              ? `${strategyMeta.desc} across ${durationHours}h. Drag handles to sculpt delivery volume.`
              : `Cumulative growth trajectory across ${durationHours}h. Smooth derivative evades bot detection.`}
          </p>
        </div>

        {/* Controls: Mode Switcher & Legend */}
        <div className="flex items-center flex-wrap gap-2 text-[11px] font-bold">
          {/* View Mode Toggle */}
          <div className="flex items-center p-0.5 rounded-lg bg-[#F3F1EA] border border-[#E4E0D3]">
            <button
              type="button"
              onClick={() => setViewMode("rate")}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer font-sans ${
                viewMode === "rate"
                  ? "bg-white text-[#2F6B3A] shadow-2xs border border-[#E4E0D3]/70"
                  : "text-[#64748B] hover:text-[#1A1D31]"
              }`}
              title="Show batch delivery pacing rate"
            >
              <BarChart3 className="w-3 h-3" />
              <span>Pacing</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cumulative")}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer font-sans ${
                viewMode === "cumulative"
                  ? "bg-white text-[#2F6B3A] shadow-2xs border border-[#E4E0D3]/70"
                  : "text-[#64748B] hover:text-[#1A1D31]"
              }`}
              title="Show total cumulative growth curve (TikTok Radar View)"
            >
              <TrendingUp className="w-3 h-3" />
              <span>Radar S-Curve</span>
            </button>
          </div>

          {/* Metric Legend Chips */}
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-50 text-[#2F6B3A] border border-blue-200/60 shadow-2xs font-sans">
            <span className="w-2 h-2 rounded-full bg-[#2F6B3A]" />
            <span>Views ({totalViews.toLocaleString()})</span>
          </span>

          {likes.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-50 text-rose-600 border border-rose-200/60 shadow-2xs font-sans">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Likes ({totalLikes})</span>
            </span>
          )}

          {saves.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60 shadow-2xs font-sans">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Saves ({totalSaves})</span>
            </span>
          )}

          {shares.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60 shadow-2xs font-sans">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span>Reposts ({totalShares})</span>
            </span>
          )}

          {onResetPlan && viewMode === "rate" && (
            <button
              type="button"
              onClick={onResetPlan}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-[#F3F1EA] text-[#64748B] hover:text-[#2F6B3A] hover:bg-white border border-[#E4E0D3] transition-all cursor-pointer press-scale font-sans"
              title="Re-roll algorithmic curve"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative w-full overflow-hidden rounded-2xl bg-[#F3F1EA] border border-[#E4E0D3]/80 p-1 sm:p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full h-48 sm:h-60 touch-none overflow-visible cursor-crosshair font-sans"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            if (!activeDrag) setHoveredNode(null);
          }}
        >
          <defs>
            {/* Views Blue Gradient */}
            <linearGradient id="viewsAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2F6B3A" stopOpacity="0.12" />
              <stop offset="85%" stopColor="#2F6B3A" stopOpacity="0.03" />
              <stop offset="100%" stopColor="#2F6B3A" stopOpacity="0" />
            </linearGradient>

            {/* Likes Red Gradient */}
            <linearGradient id="likesAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
            </linearGradient>

            {/* Drop Shadow for Handles */}
            <filter id="handleShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodOpacity="0.28" />
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
                className="font-sans text-[9px] font-bold fill-[#94A3B8]"
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
                  className="font-sans text-[10px] font-bold fill-[#64748B]"
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
              strokeWidth={viewMode === "cumulative" ? 2.5 : 2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* 2. SAVES CURVE (YELLOW / AMBER) */}
          {viewMode === "rate" && savesPath && (
            <path
              d={savesPath}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="4 2.5"
            />
          )}

          {/* 3. SHARES / REPOSTS CURVE (PURPLE) */}
          {viewMode === "rate" && sharesPath && (
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
              stroke="#2F6B3A"
              strokeWidth={viewMode === "cumulative" ? 3.6 : 3.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* 5. RATE MODE: DRAGGABLE KEYFRAME ANCHORS (Clean 10-12 handles) */}
          {viewMode === "rate" &&
            anchorIndices.map((idx) => {
              const pt = rateViewPoints[idx];
              if (!pt) return null;
              const isHovered = hoveredNode?.type === "views" && hoveredNode?.label === `Phase #${idx + 1}`;
              const isDragging = activeDrag?.type === "views" && activeDrag?.index === idx;

              return (
                <g key={`anchor-view-${idx}`}>
                  {/* Generous touch hit area */}
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
                        label: `Phase #${idx + 1}`,
                        x: pt.x,
                        y: pt.y,
                        qty: views[idx] ?? 0,
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
                      stroke="#2F6B3A"
                      strokeWidth="1.5"
                      opacity="0.4"
                      className="animate-ping"
                    />
                  )}

                  {/* Visual Node Handle */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isDragging ? 7.5 : isHovered ? 6.5 : 5}
                    fill="#FFFFFF"
                    stroke="#2F6B3A"
                    strokeWidth={isDragging ? 3.5 : 3}
                    filter="url(#handleShadow)"
                    className="transition-all duration-150 pointer-events-none"
                  />
                </g>
              );
            })}

          {/* 6. RATE MODE: LIKES KEYFRAME HANDLES */}
          {viewMode === "rate" &&
            likeAnchorIndices.map((idx) => {
              const pt = rateLikePoints[idx];
              if (!pt) return null;
              const isHovered = hoveredNode?.type === "likes" && hoveredNode?.label === `Like #${idx + 1}`;
              const isDragging = activeDrag?.type === "likes" && activeDrag?.index === idx;

              return (
                <g key={`anchor-like-${idx}`}>
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
                        label: `Like #${idx + 1}`,
                        x: pt.x,
                        y: pt.y,
                        qty: likes[idx] ?? 0,
                      })
                    }
                  />
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

          {/* Floating Pill Tooltip inside SVG */}
          {hoveredNode && (
            <g
              transform={`translate(${Math.min(
                SVG_WIDTH - 140,
                Math.max(10, hoveredNode.x - 65)
              )}, ${Math.max(10, hoveredNode.y - 36)})`}
              className="pointer-events-none transition-transform font-sans"
            >
              <rect
                x="0"
                y="0"
                width="130"
                height="28"
                rx="8"
                fill="#1A1D31"
                filter="url(#handleShadow)"
              />
              <text
                x="65"
                y="17"
                textAnchor="middle"
                className="font-sans font-bold text-[10px] fill-white"
              >
                {hoveredNode.type === "views"
                  ? `${hoveredNode.qty.toLocaleString()} Views`
                  : hoveredNode.type === "likes"
                  ? `${hoveredNode.qty.toLocaleString()} Likes`
                  : `${hoveredNode.qty} items`}
              </text>
            </g>
          )}
        </svg>

        {/* Bottom Micro Guide & Anti-Radar Signal */}
        <div className="flex items-center justify-between px-2 pt-1.5 text-[10px] font-semibold text-[#64748B] font-sans">
          <span>0h (Launch Pool)</span>
          <span className="flex items-center gap-1.5 text-[#2F6B3A] font-bold">
            {viewMode === "rate" ? (
              <span>↑ Drag handles vertically to sculpt organic delivery curve</span>
            ) : (
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Sigmoid derivative dV/dt &gt; 0 • Zero detection cliffs</span>
              </span>
            )}
          </span>
          <span>{durationHours}h (Completed)</span>
        </div>
      </div>
    </div>
  );
}

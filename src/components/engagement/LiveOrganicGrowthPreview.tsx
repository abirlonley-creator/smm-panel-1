"use client";

import React, { useState, useRef, useMemo, useCallback } from "react";
import {
  Activity,
  RefreshCw,
  Sparkles,
  Zap,
  Clock,
  TrendingUp,
  Eye,
  Heart,
  Bookmark,
  Share2,
  MessageCircle,
} from "lucide-react";
import {
  GeneratedSchedulePlan,
  generatePatternSchedule,
  getPatternMeta,
} from "@/lib/engagement/organic-pattern-generator";

export interface LiveOrganicGrowthPreviewProps {
  initialTemplateId?: number;
  targetViews: number;
  durationHours: number;
  targetLikes?: number;
  targetSaves?: number;
  targetShares?: number;
  targetComments?: number;
  providerMinViews?: number;
  planTimestamp?: Date;
  onScheduleChange?: (schedule: GeneratedSchedulePlan) => void;
}

export function LiveOrganicGrowthPreview({
  initialTemplateId = 335,
  targetViews,
  durationHours,
  targetLikes,
  targetSaves,
  targetShares,
  targetComments,
  providerMinViews = 100,
  planTimestamp = new Date(),
  onScheduleChange,
}: LiveOrganicGrowthPreviewProps) {
  const [templateId, setTemplateId] = useState<number>(initialTemplateId);
  const [templateInput, setTemplateInput] = useState<string>(String(initialTemplateId));
  const [isGenerating, setIsGenerating] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Generate the active deterministic pattern schedule
  const schedulePlan = useMemo(() => {
    return generatePatternSchedule(templateId, targetViews, durationHours, {
      targetLikes,
      targetSaves,
      targetShares,
      targetComments,
      providerMinViews,
    });
  }, [templateId, targetViews, durationHours, targetLikes, targetSaves, targetShares, targetComments, providerMinViews]);

  // Notify parent on change so actual order payload has these exact runs
  React.useEffect(() => {
    if (onScheduleChange) {
      onScheduleChange(schedulePlan);
    }
  }, [schedulePlan, onScheduleChange]);

  // Click "New Pattern": pick a fresh random template number (1..550+)
  const handleNewPattern = useCallback(() => {
    setIsGenerating(true);
    // Pick another template ID different from current
    let nextId = Math.floor(Math.random() * 550) + 1;
    if (nextId === templateId) {
      nextId = (nextId % 550) + 1;
    }
    setTemplateId(nextId);
    setTemplateInput(String(nextId));
    setTimeout(() => setIsGenerating(false), 200);
  }, [templateId]);

  // User typing in Template ID input
  const handleTemplateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTemplateInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 999) {
      setTemplateId(parsed);
    }
  };

  // SVG dimensions
  const SVG_WIDTH = 800;
  const SVG_HEIGHT = 260;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 25;
  const padBottom = 35;

  const plotWidth = SVG_WIDTH - padLeft - padRight;
  const plotHeight = SVG_HEIGHT - padTop - padBottom;
  const baselineY = padTop + plotHeight;

  // Cumulative trajectories
  const totalMinutes = schedulePlan.totalDurationMinutes;

  const cumViews = useMemo(() => {
    let running = 0;
    return schedulePlan.views.map((v) => (running += v));
  }, [schedulePlan.views]);

  const cumLikes = useMemo(() => {
    let running = 0;
    return schedulePlan.likes.map((l) => (running += l));
  }, [schedulePlan.likes]);

  const cumSaves = useMemo(() => {
    let running = 0;
    return schedulePlan.saves.map((s) => (running += s));
  }, [schedulePlan.saves]);

  const cumShares = useMemo(() => {
    let running = 0;
    return schedulePlan.shares.map((s) => (running += s));
  }, [schedulePlan.shares]);

  const cumComments = useMemo(() => {
    let running = 0;
    return schedulePlan.comments.map((c) => (running += c));
  }, [schedulePlan.comments]);

  const maxTotalViews = Math.max(1, schedulePlan.totalViews);

  // Coordinate mappers
  const getX = useCallback(
    (minute: number) => {
      const clamped = Math.max(0, Math.min(totalMinutes, minute));
      return padLeft + (clamped / totalMinutes) * plotWidth;
    },
    [totalMinutes, plotWidth, padLeft]
  );

  const getYViews = useCallback(
    (val: number) => {
      const fraction = Math.max(0, Math.min(1, val / maxTotalViews));
      return baselineY - fraction * plotHeight;
    },
    [maxTotalViews, baselineY, plotHeight]
  );

  // Auxiliary metrics sit gently at the bottom (max 10% of graph height for natural scale)
  const getYAux = useCallback(
    (val: number, maxAux: number) => {
      const fraction = maxAux > 0 ? Math.max(0, Math.min(1, val / maxAux)) : 0;
      return baselineY - fraction * (plotHeight * 0.12);
    },
    [baselineY, plotHeight]
  );

  // Stepped Cumulative Paths ("Bursts + pauses • Service-wise natural steps")
  const viewsSteppedPath = useMemo(() => {
    if (schedulePlan.views.length === 0) return "";
    let d = `M ${padLeft.toFixed(1)} ${baselineY.toFixed(1)}`;
    let currentY = baselineY;

    for (let i = 0; i < schedulePlan.views.length; i++) {
      const minute = schedulePlan.viewOffsets[i] || 0;
      const x = getX(minute);
      const nextY = getYViews(cumViews[i]);
      // Step horizontally to the batch minute, then step up
      d += ` L ${x.toFixed(1)} ${currentY.toFixed(1)} L ${x.toFixed(1)} ${nextY.toFixed(1)}`;
      currentY = nextY;
    }
    // Continue to the right edge
    d += ` L ${(padLeft + plotWidth).toFixed(1)} ${currentY.toFixed(1)}`;
    return d;
  }, [schedulePlan.views, schedulePlan.viewOffsets, cumViews, getX, getYViews, padLeft, baselineY, plotWidth]);

  const viewsSteppedArea = useMemo(() => {
    if (!viewsSteppedPath) return "";
    const rightX = padLeft + plotWidth;
    return `${viewsSteppedPath} L ${rightX.toFixed(1)} ${baselineY.toFixed(1)} L ${padLeft.toFixed(1)} ${baselineY.toFixed(1)} Z`;
  }, [viewsSteppedPath, padLeft, plotWidth, baselineY]);

  // Auxiliary stepped paths (Likes, Saves, Shares, Comments)
  const likesSteppedPath = useMemo(() => {
    if (schedulePlan.likes.length === 0) return "";
    const maxLikes = schedulePlan.totalLikes || 1;
    let d = `M ${padLeft.toFixed(1)} ${baselineY.toFixed(1)}`;
    let currentY = baselineY;

    for (let i = 0; i < schedulePlan.likes.length; i++) {
      const minute = schedulePlan.likeOffsets[i] || 0;
      const x = getX(minute);
      const nextY = getYAux(cumLikes[i], maxLikes);
      d += ` L ${x.toFixed(1)} ${currentY.toFixed(1)} L ${x.toFixed(1)} ${nextY.toFixed(1)}`;
      currentY = nextY;
    }
    d += ` L ${(padLeft + plotWidth).toFixed(1)} ${currentY.toFixed(1)}`;
    return d;
  }, [schedulePlan.likes, schedulePlan.likeOffsets, cumLikes, schedulePlan.totalLikes, getX, getYAux, padLeft, baselineY, plotWidth]);

  const savesSteppedPath = useMemo(() => {
    if (schedulePlan.saves.length === 0) return "";
    const maxSaves = schedulePlan.totalSaves || 1;
    let d = `M ${padLeft.toFixed(1)} ${baselineY.toFixed(1)}`;
    let currentY = baselineY;

    for (let i = 0; i < schedulePlan.saves.length; i++) {
      const minute = schedulePlan.saveOffsets[i] || 0;
      const x = getX(minute);
      const nextY = getYAux(cumSaves[i], maxSaves) + 2; // subtle offset
      d += ` L ${x.toFixed(1)} ${currentY.toFixed(1)} L ${x.toFixed(1)} ${nextY.toFixed(1)}`;
      currentY = nextY;
    }
    d += ` L ${(padLeft + plotWidth).toFixed(1)} ${currentY.toFixed(1)}`;
    return d;
  }, [schedulePlan.saves, schedulePlan.saveOffsets, cumSaves, schedulePlan.totalSaves, getX, getYAux, padLeft, baselineY, plotWidth]);

  const sharesSteppedPath = useMemo(() => {
    if (schedulePlan.shares.length === 0) return "";
    const maxShares = schedulePlan.totalShares || 1;
    let d = `M ${padLeft.toFixed(1)} ${baselineY.toFixed(1)}`;
    let currentY = baselineY;

    for (let i = 0; i < schedulePlan.shares.length; i++) {
      const minute = schedulePlan.shareOffsets[i] || 0;
      const x = getX(minute);
      const nextY = getYAux(cumShares[i], maxShares) + 4;
      d += ` L ${x.toFixed(1)} ${currentY.toFixed(1)} L ${x.toFixed(1)} ${nextY.toFixed(1)}`;
      currentY = nextY;
    }
    d += ` L ${(padLeft + plotWidth).toFixed(1)} ${currentY.toFixed(1)}`;
    return d;
  }, [schedulePlan.shares, schedulePlan.shareOffsets, cumShares, schedulePlan.totalShares, getX, getYAux, padLeft, baselineY, plotWidth]);

  // Interactive Hover / Pointer Tooltip State
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    timeLabel: string;
    views: number;
    likes: number;
    saves: number;
    shares: number;
    comments: number;
  } | null>(null);

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * SVG_WIDTH;

    if (svgX < padLeft || svgX > padLeft + plotWidth) {
      setHoveredPoint(null);
      return;
    }

    const minute = Math.round(((svgX - padLeft) / plotWidth) * totalMinutes);

    // Compute cumulative metrics at this specific minute
    let vAtMinute = 0;
    for (let i = 0; i < schedulePlan.viewOffsets.length; i++) {
      if (schedulePlan.viewOffsets[i] <= minute) vAtMinute = cumViews[i];
      else break;
    }

    let lAtMinute = 0;
    for (let i = 0; i < schedulePlan.likeOffsets.length; i++) {
      if (schedulePlan.likeOffsets[i] <= minute) lAtMinute = cumLikes[i];
      else break;
    }

    let sAtMinute = 0;
    for (let i = 0; i < schedulePlan.saveOffsets.length; i++) {
      if (schedulePlan.saveOffsets[i] <= minute) sAtMinute = cumSaves[i];
      else break;
    }

    let shAtMinute = 0;
    for (let i = 0; i < schedulePlan.shareOffsets.length; i++) {
      if (schedulePlan.shareOffsets[i] <= minute) shAtMinute = cumShares[i];
      else break;
    }

    const cAtMinute = schedulePlan.totalComments > 0 ? Math.round(schedulePlan.totalComments * (minute / totalMinutes)) : 0;

    const timeDate = new Date(planTimestamp.getTime() + minute * 60 * 1000);
    const timeLabel = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(timeDate);

    setHoveredPoint({
      x: svgX,
      y: getYViews(vAtMinute),
      timeLabel,
      views: vAtMinute,
      likes: lAtMinute,
      saves: sAtMinute,
      shares: shAtMinute,
      comments: cAtMinute,
    });
  };

  // Horizontal Grid Ticks (0, 25%, 50%, 75%, 100%)
  const yTicks = useMemo(() => {
    return [0.25, 0.5, 0.75, 1.0].map((frac) => ({
      val: Math.round(maxTotalViews * frac),
      label: frac === 1.0 && maxTotalViews >= 1000 ? `${(maxTotalViews / 1000).toFixed(0)}K` : `${Math.round(maxTotalViews * frac)}`,
      y: baselineY - frac * plotHeight,
    }));
  }, [maxTotalViews, baselineY, plotHeight]);

  // Bottom Timeline Labels (spaced evenly across total duration)
  const timeLabels = useMemo(() => {
    const count = 12;
    const labels: Array<{ x: number; text: string }> = [];
    for (let i = 0; i < count; i++) {
      const frac = i / (count - 1);
      const minute = frac * totalMinutes;
      const targetDate = new Date(planTimestamp.getTime() + minute * 60 * 1000);
      const text = new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(targetDate);
      labels.push({ x: getX(minute), text });
    }
    return labels;
  }, [totalMinutes, planTimestamp, getX]);

  return (
    <div className="bg-white rounded-3xl border border-[#DEE0ED] p-5 sm:p-6 shadow-subtle space-y-4 font-sans select-none">
      {/* 1. TOP HEADER: Live Organic Growth Preview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DEE0ED]/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-2xs">
            <Activity className="w-5 h-5 stroke-[2.3]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1A1D31] font-sans">
              Live Organic Growth Preview
            </h2>
            <p className="text-xs text-[#64748B] font-medium font-sans">
              Bursts + pauses • Service-wise natural steps
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* New Pattern Button */}
          <button
            type="button"
            onClick={handleNewPattern}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-gray-50 border border-[#DEE0ED] text-[#1A1D31] flex items-center gap-1.5 shadow-2xs hover:border-[#3A4EFB]/50 transition-all press-scale cursor-pointer"
            title="Generate a fresh, unique anti-radar delivery pattern"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin text-[#3A4EFB]" : "text-[#64748B]"}`} />
            <span>New Pattern</span>
          </button>

          {/* 99% Organic Badge */}
          <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1 shadow-2xs font-sans">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 fill-emerald-500/20" />
            <span>99% Organic</span>
          </span>
        </div>
      </div>

      {/* 2. TEMPLATE / PATTERN SELECTOR BAR */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#64748B] font-sans"># Template:</span>
          <input
            type="number"
            min="1"
            max="999"
            value={templateInput}
            onChange={handleTemplateInputChange}
            className="w-16 px-2.5 py-1 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs font-bold text-[#1A1D31] text-center focus:outline-none focus:border-[#3A4EFB] focus:bg-white shadow-inner font-sans transition-all"
            title="Enter any template number (1 to 550+)"
          />

          {/* Named Archetype Badge */}
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-[#0284C7] border border-sky-200/60 shadow-2xs font-sans">
            {schedulePlan.patternMeta.fullName}
          </span>
        </div>

        <span className="text-xs font-semibold text-[#94A3B8] font-sans">
          550+ patterns
        </span>
      </div>

      {/* 3. METRIC SUMMARY ROW (Pills) */}
      <div className="flex items-center flex-wrap gap-2 text-xs font-sans">
        {/* Total Metric Pill */}
        <span className="px-3 py-1 rounded-xl bg-[#0284C7] text-white font-bold flex items-center gap-1 shadow-2xs font-sans">
          <Zap className="w-3.5 h-3.5 fill-white" />
          <span>{schedulePlan.totalEngagement.toLocaleString()} total</span>
        </span>

        {/* Runs Count */}
        <span className="px-2.5 py-1 rounded-xl bg-white border border-[#DEE0ED] text-[#1A1D31] font-bold shadow-2xs flex items-center gap-1 font-sans">
          <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
          <span>{schedulePlan.runsCount} runs</span>
        </span>

        {/* Interval */}
        <span className="px-2.5 py-1 rounded-xl bg-white border border-[#DEE0ED] text-[#1A1D31] font-bold shadow-2xs flex items-center gap-1 font-sans">
          <Clock className="w-3.5 h-3.5 text-[#64748B]" />
          <span>~{schedulePlan.avgIntervalMinutes} min</span>
        </span>

        {/* Service Dots */}
        <div className="flex items-center flex-wrap gap-1.5 ml-auto text-[11px] font-bold">
          {/* Views Dot */}
          <span className="px-2.5 py-1 rounded-xl bg-white border border-blue-200 text-blue-800 shadow-2xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0284C7]" />
            <span>{schedulePlan.totalViews.toLocaleString()}</span>
          </span>

          {/* Comments Dot */}
          {schedulePlan.totalComments > 0 && (
            <span className="px-2.5 py-1 rounded-xl bg-white border border-sky-200 text-sky-800 shadow-2xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#38BDF8]" />
              <span>{schedulePlan.totalComments}</span>
            </span>
          )}

          {/* Likes Dot */}
          {schedulePlan.totalLikes > 0 && (
            <span className="px-2.5 py-1 rounded-xl bg-white border border-emerald-200 text-emerald-800 shadow-2xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10B981]" />
              <span>{schedulePlan.totalLikes.toLocaleString()}</span>
            </span>
          )}

          {/* Saves Dot */}
          {schedulePlan.totalSaves > 0 && (
            <span className="px-2.5 py-1 rounded-xl bg-white border border-amber-200 text-amber-800 shadow-2xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
              <span>{schedulePlan.totalSaves}</span>
            </span>
          )}

          {/* Shares Dot */}
          {schedulePlan.totalShares > 0 && (
            <span className="px-2.5 py-1 rounded-xl bg-white border border-purple-200 text-purple-800 shadow-2xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#A855F7]" />
              <span>{schedulePlan.totalShares}</span>
            </span>
          )}
        </div>
      </div>

      {/* 4. THE GRAPH SVG (Cumulative Natural Stepped Anti-Radar Curve) */}
      <div className="relative w-full overflow-hidden bg-gradient-to-b from-[#FAFBFD] to-white rounded-2xl border border-[#DEE0ED]/80 p-2 sm:p-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full h-56 sm:h-64 touch-none cursor-crosshair font-sans overflow-visible"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoveredPoint(null)}
        >
          <defs>
            {/* Soft Blue Gradient for Cumulative Views */}
            <linearGradient id="viewsAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.4" />
              <stop offset="60%" stopColor="#38BDF8" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.01" />
            </linearGradient>

            {/* Drop Shadow for Tooltip */}
            <filter id="tooltipShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* Horizontal Grid Lines */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padLeft}
                y1={tick.y}
                x2={padLeft + plotWidth}
                y2={tick.y}
                stroke="#E2E8F0"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text
                x={padLeft - 8}
                y={tick.y + 3.5}
                textAnchor="end"
                className="fill-[#94A3B8] text-[10px] font-bold font-sans"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Baseline Axis */}
          <line
            x1={padLeft}
            y1={baselineY}
            x2={padLeft + plotWidth}
            y2={baselineY}
            stroke="#CBD5E1"
            strokeWidth="1.5"
          />

          {/* 1. VIEWS AREA FILL */}
          {viewsSteppedArea && <path d={viewsSteppedArea} fill="url(#viewsAreaGrad)" />}

          {/* 2. AUXILIARY METRIC STEPPED LINES */}
          {sharesSteppedPath && (
            <path
              d={sharesSteppedPath}
              fill="none"
              stroke="#A855F7"
              strokeWidth="1.6"
              strokeDasharray="3 2"
            />
          )}

          {savesSteppedPath && (
            <path
              d={savesSteppedPath}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="1.6"
              strokeDasharray="3 2"
            />
          )}

          {likesSteppedPath && (
            <path
              d={likesSteppedPath}
              fill="none"
              stroke="#10B981"
              strokeWidth="1.8"
            />
          )}

          {/* 3. MAIN VIEWS STEPPED LINE (Solid Blue) */}
          {viewsSteppedPath && (
            <path
              d={viewsSteppedPath}
              fill="none"
              stroke="#0284C7"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="miter"
            />
          )}

          {/* 4. HOVER GUIDELINE & DATA POINTS */}
          {hoveredPoint && (
            <g className="pointer-events-none">
              {/* Vertical Crosshair Line */}
              <line
                x1={hoveredPoint.x}
                y1={padTop}
                x2={hoveredPoint.x}
                y2={baselineY}
                stroke="#64748B"
                strokeWidth="1"
                strokeDasharray="3 3"
              />

              {/* Point on Views Curve */}
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="4.5"
                fill="#0284C7"
                stroke="#FFFFFF"
                strokeWidth="2"
              />

              {/* Interactive Tooltip Card (Styled identically to screenshot) */}
              <g
                transform={`translate(${Math.min(
                  padLeft + plotWidth - 110,
                  Math.max(padLeft + 10, hoveredPoint.x + 12)
                )}, ${Math.max(padTop + 5, hoveredPoint.y - 45)})`}
              >
                <rect
                  width="105"
                  height="120"
                  rx="12"
                  fill="#FFFFFF"
                  stroke="#DEE0ED"
                  strokeWidth="1"
                  filter="url(#tooltipShadow)"
                />
                {/* Time header */}
                <text x="14" y="20" className="fill-[#1A1D31] text-[11px] font-black font-sans">
                  {hoveredPoint.timeLabel}
                </text>

                {/* Views row */}
                <circle cx="18" cy="38" r="3" fill="#0284C7" />
                <text x="28" y="41" className="fill-[#475569] text-[10px] font-bold font-sans">
                  {hoveredPoint.views.toLocaleString()}
                </text>

                {/* Comments row */}
                <circle cx="18" cy="56" r="3" fill="#38BDF8" />
                <text x="28" y="59" className="fill-[#475569] text-[10px] font-bold font-sans">
                  {hoveredPoint.comments}
                </text>

                {/* Likes row */}
                <circle cx="18" cy="74" r="3" fill="#10B981" />
                <text x="28" y="77" className="fill-[#475569] text-[10px] font-bold font-sans">
                  {hoveredPoint.likes.toLocaleString()}
                </text>

                {/* Saves row */}
                <circle cx="18" cy="92" r="3" fill="#F59E0B" />
                <text x="28" y="95" className="fill-[#475569] text-[10px] font-bold font-sans">
                  {hoveredPoint.saves}
                </text>

                {/* Shares row */}
                <circle cx="18" cy="110" r="3" fill="#A855F7" />
                <text x="28" y="113" className="fill-[#475569] text-[10px] font-bold font-sans">
                  {hoveredPoint.shares}
                </text>
              </g>
            </g>
          )}

          {/* 5. BOTTOM TIME AXIS LABELS */}
          {timeLabels.map((lbl, idx) => (
            <text
              key={idx}
              x={lbl.x}
              y={baselineY + 16}
              textAnchor="middle"
              className="fill-[#94A3B8] text-[9px] font-semibold font-sans"
            >
              {lbl.text}
            </text>
          ))}
        </svg>
      </div>

      {/* 5. BOTTOM LEGEND (Identical to screenshot) */}
      <div className="flex items-center justify-center flex-wrap gap-4 pt-1 text-xs font-bold text-[#64748B] font-sans">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#0284C7]" />
          <span>Views</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8]" />
          <span>Comments</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
          <span>Likes</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
          <span>Saves</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#A855F7]" />
          <span>Shares</span>
        </span>
      </div>
    </div>
  );
}

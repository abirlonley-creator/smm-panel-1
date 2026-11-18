"use client";

import React, { useState, useRef, useMemo, useCallback } from "react";
import {
  Activity,
  RefreshCw,
  Clock,
  TrendingUp,
  Download,
  Filter,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  Heart,
  Bookmark,
  Share2,
  MessageCircle,
  Eye,
  Zap,
} from "lucide-react";
import {
  DeterministicPlan,
  ScheduledBatch,
  formatDurationDaysHours,
} from "@/lib/engagement/deterministic-pattern-engine";

interface Point {
  x: number;
  y: number;
}

/**
 * Catmull-Rom to Cubic Bézier spline generator for 100% smooth, anti-radar non-spiked curves.
 * Guarantees zero perpendicular spikes or staircase jumps, matching organic TikTok FYP trajectory.
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

export interface LiveOrganicGrowthPreviewProps {
  plan: DeterministicPlan;
  startDate?: Date;
  isAdmin?: boolean;
  onNewPattern?: () => void;
  onSelectTemplate?: (templateNumber: number) => void;
}

export function LiveOrganicGrowthPreview({
  plan,
  startDate = new Date(),
  isAdmin = false,
  onNewPattern,
  onSelectTemplate,
}: LiveOrganicGrowthPreviewProps) {
  const [showEngagementOverlay, setShowEngagementOverlay] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [filterService, setFilterService] = useState<string>("ALL");
  const [templateInput, setTemplateInput] = useState<string>("335");
  const [isGenerating, setIsGenerating] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // SVG dimensions
  const SVG_WIDTH = 800;
  const SVG_HEIGHT = 260;
  const padLeft = 50;
  const padRight = 25;
  const padTop = 25;
  const padBottom = 35;

  const plotWidth = SVG_WIDTH - padLeft - padRight;
  const plotHeight = SVG_HEIGHT - padTop - padBottom;
  const baselineY = padTop + plotHeight;
  const totalMinutes = Math.max(60, plan.totalDurationMinutes);

  // Separate batches by service
  const viewBatches = useMemo(
    () => plan.batches.filter((b) => b.service === "views"),
    [plan.batches]
  );
  const likeBatches = useMemo(
    () => plan.batches.filter((b) => b.service === "likes"),
    [plan.batches]
  );
  const saveBatches = useMemo(
    () => plan.batches.filter((b) => b.service === "saves"),
    [plan.batches]
  );
  const shareBatches = useMemo(
    () => plan.batches.filter((b) => b.service === "shares"),
    [plan.batches]
  );
  const commentBatches = useMemo(
    () => plan.batches.filter((b) => b.service === "comments"),
    [plan.batches]
  );

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
      const fraction = Math.max(0, Math.min(1, val / Math.max(1, plan.viewsTotal)));
      return baselineY - fraction * plotHeight;
    },
    [plan.viewsTotal, baselineY, plotHeight]
  );

  const getYAux = useCallback(
    (val: number, maxAux: number) => {
      const fraction = maxAux > 0 ? Math.max(0, Math.min(1, val / maxAux)) : 0;
      return baselineY - fraction * (plotHeight * 0.16);
    },
    [baselineY, plotHeight]
  );

  // Build Spline Curve Points from plan.curvePoints
  const viewPoints: Point[] = useMemo(() => {
    if (!plan.curvePoints || plan.curvePoints.length === 0) {
      return [{ x: padLeft, y: baselineY }, { x: padLeft + plotWidth, y: getYViews(plan.viewsTotal) }];
    }
    const pts: Point[] = [{ x: padLeft, y: baselineY }];
    for (const cp of plan.curvePoints) {
      pts.push({
        x: getX(cp.minuteOffset),
        y: getYViews(cp.views),
      });
    }
    const lastX = padLeft + plotWidth;
    if (pts[pts.length - 1].x < lastX) {
      pts.push({ x: lastX, y: getYViews(plan.viewsTotal) });
    }
    return pts;
  }, [plan.curvePoints, plan.viewsTotal, getX, getYViews, padLeft, baselineY, plotWidth]);

  const viewsSmoothPath = useMemo(() => getSmoothSplinePath(viewPoints, 0.22), [viewPoints]);
  const viewsSmoothArea = useMemo(() => getClosedAreaPath(viewPoints, baselineY, 0.22), [viewPoints, baselineY]);

  // Engagement auxiliary spline curves
  const likePoints: Point[] = useMemo(() => {
    if (plan.likesTotal === 0 || !plan.curvePoints) return [];
    const pts: Point[] = [{ x: padLeft, y: baselineY }];
    for (const cp of plan.curvePoints) {
      pts.push({
        x: getX(cp.minuteOffset),
        y: getYAux(cp.likes, plan.likesTotal),
      });
    }
    const lastX = padLeft + plotWidth;
    if (pts[pts.length - 1].x < lastX) {
      pts.push({ x: lastX, y: getYAux(plan.likesTotal, plan.likesTotal) });
    }
    return pts;
  }, [plan.curvePoints, plan.likesTotal, getX, getYAux, padLeft, baselineY, plotWidth]);

  const likesSmoothPath = useMemo(() => getSmoothSplinePath(likePoints, 0.20), [likePoints]);

  const savePoints: Point[] = useMemo(() => {
    if (plan.savesTotal === 0 || !plan.curvePoints) return [];
    const pts: Point[] = [{ x: padLeft, y: baselineY }];
    for (const cp of plan.curvePoints) {
      pts.push({
        x: getX(cp.minuteOffset),
        y: getYAux(cp.saves, plan.savesTotal) - 2,
      });
    }
    const lastX = padLeft + plotWidth;
    if (pts[pts.length - 1].x < lastX) {
      pts.push({ x: lastX, y: getYAux(plan.savesTotal, plan.savesTotal) - 2 });
    }
    return pts;
  }, [plan.curvePoints, plan.savesTotal, getX, getYAux, padLeft, baselineY, plotWidth]);

  const savesSmoothPath = useMemo(() => getSmoothSplinePath(savePoints, 0.20), [savePoints]);

  const sharePoints: Point[] = useMemo(() => {
    if (plan.sharesTotal === 0 || !plan.curvePoints) return [];
    const pts: Point[] = [{ x: padLeft, y: baselineY }];
    for (const cp of plan.curvePoints) {
      pts.push({
        x: getX(cp.minuteOffset),
        y: getYAux(cp.shares, plan.sharesTotal) - 4,
      });
    }
    const lastX = padLeft + plotWidth;
    if (pts[pts.length - 1].x < lastX) {
      pts.push({ x: lastX, y: getYAux(plan.sharesTotal, plan.sharesTotal) - 4 });
    }
    return pts;
  }, [plan.curvePoints, plan.sharesTotal, getX, getYAux, padLeft, baselineY, plotWidth]);

  const sharesSmoothPath = useMemo(() => getSmoothSplinePath(sharePoints, 0.20), [sharePoints]);

  // Interactive Hover Tooltip State
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

    // Cumulative at this specific minute
    let vAtMinute = 0;
    let lAtMinute = 0;
    let sAtMinute = 0;
    let shAtMinute = 0;
    let cAtMinute = 0;

    for (const b of plan.batches) {
      if (b.minuteOffset <= minute) {
        if (b.service === "views") vAtMinute += b.quantity;
        if (b.service === "likes") lAtMinute += b.quantity;
        if (b.service === "saves") sAtMinute += b.quantity;
        if (b.service === "shares") shAtMinute += b.quantity;
        if (b.service === "comments") cAtMinute += b.quantity;
      }
    }

    const timeDate = new Date(startDate.getTime() + minute * 60 * 1000);
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
      val: Math.round(plan.viewsTotal * frac),
      label:
        frac === 1.0 && plan.viewsTotal >= 1000
          ? `${(plan.viewsTotal / 1000).toFixed(0)}K`
          : `${Math.round(plan.viewsTotal * frac)}`,
      y: baselineY - frac * plotHeight,
    }));
  }, [plan.viewsTotal, baselineY, plotHeight]);

  // Bottom Timeline Labels
  const timeLabels = useMemo(() => {
    const count = 10;
    const labels: Array<{ x: number; text: string }> = [];
    for (let i = 0; i < count; i++) {
      const frac = i / (count - 1);
      const minute = frac * totalMinutes;
      const targetDate = new Date(startDate.getTime() + minute * 60 * 1000);
      const text = new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(targetDate);
      labels.push({ x: getX(minute), text });
    }
    return labels;
  }, [totalMinutes, startDate, getX]);

  // Filtered batches for Schedule Panel
  const filteredBatches = useMemo(() => {
    if (filterService === "ALL") return plan.batches;
    return plan.batches.filter((b) => b.service === filterService.toLowerCase());
  }, [plan.batches, filterService]);

  // CSV Export
  const handleDownloadCsv = () => {
    const headers = ["Batch Number", "Time Offset (min)", "Scheduled Clock Time", "Service", "Quantity", "15m Grid Snapped"];
    const rows = plan.batches.map((b, i) => {
      const batchTime = new Date(startDate.getTime() + b.minuteOffset * 60 * 1000);
      const timeStr = new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(batchTime);

      return [
        i + 1,
        `+${b.minuteOffset}m`,
        timeStr,
        b.service,
        b.quantity,
        b.minuteOffset % 15 === 0 ? "YES (:00/:15/:30/:45)" : "NO",
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `aurasmm-schedule-${plan.seed}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNewPatternClick = () => {
    setIsGenerating(true);
    if (onNewPattern) onNewPattern();
    setTimeout(() => setIsGenerating(false), 250);
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E4E0D3] p-5 sm:p-6 shadow-subtle space-y-4 font-sans select-none">
      {/* 1. TOP HEADER: Live Growth Preview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E4E0D3]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#F3F1EA] border border-[#E4E0D3] flex items-center justify-center text-[#5E8C1F] shadow-2xs">
            <Activity className="w-5 h-5 stroke-[2.3]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#111413] font-sans">
              Live Growth Preview
            </h2>
            <p className="text-xs text-[#5B625F] font-medium font-sans">
              Gradual, view-paced delivery • Monotonic continuous S-curve
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* New Pattern Button */}
          <button
            type="button"
            onClick={handleNewPatternClick}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-[#F3F1EA] border border-[#E4E0D3] text-[#111413] flex items-center gap-1.5 shadow-2xs hover:border-[#111413]/40 transition-all press-scale cursor-pointer"
            title="Generate a fresh, unique delivery pattern schedule"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin text-[#5E8C1F]" : "text-[#5B625F]"}`} />
            <span>New Pattern</span>
          </button>

          {/* Delivery Quality Pill */}
          <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-[#5E8C1F] border border-emerald-200/80 flex items-center gap-1 shadow-2xs font-sans">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#5E8C1F]" />
            <span>Gradual, view-paced delivery</span>
          </span>
        </div>
      </div>

      {/* 2. PATTERN ID & DURATION BAR */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-white text-[#111413] border border-[#E4E0D3] shadow-2xs font-sans">
            Pattern #{plan.seed.slice(-8)}
          </span>

          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-[#5E8C1F] border border-emerald-200/60 shadow-2xs font-sans flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#5E8C1F]" />
            <span>{plan.durationLabel} finish</span>
          </span>

          {/* Engagement Overlay Toggle */}
          <button
            type="button"
            onClick={() => setShowEngagementOverlay(!showEngagementOverlay)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all border cursor-pointer ${
              showEngagementOverlay
                ? "bg-[#111413] text-[#D4F04F] border-[#111413] shadow-2xs"
                : "bg-white text-[#5B625F] border-[#E4E0D3] hover:bg-[#F3F1EA]"
            }`}
          >
            {showEngagementOverlay ? "Engagement: Shown" : "Engagement: Hidden"}
          </button>
        </div>

        {/* Admin Only: Template Number & Count */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#5B625F] font-sans"># Template:</span>
            <input
              type="number"
              min="1"
              max="999"
              value={templateInput}
              onChange={(e) => {
                setTemplateInput(e.target.value);
                const num = parseInt(e.target.value, 10);
                if (!isNaN(num) && onSelectTemplate) onSelectTemplate(num);
              }}
              className="w-16 px-2.5 py-1 rounded-xl bg-white border border-[#E4E0D3] text-xs font-bold text-[#111413] text-center focus:outline-none focus:border-[#111413] font-sans"
              title="Admin control: Select template (1 to 550+)"
            />
            <span className="text-xs font-semibold text-[#5B625F] font-sans">
              550+ patterns
            </span>
          </div>
        )}
      </div>

      {/* 3. METRIC CHIPS SUMMARY ROW */}
      <div className="flex items-center flex-wrap gap-2 text-xs font-sans">
        {/* Total Views Chip */}
        <span className="px-3 py-1 rounded-xl bg-[#2F6B3A] text-white font-bold flex items-center gap-1.5 shadow-2xs font-sans">
          <Eye className="w-3.5 h-3.5 fill-white" />
          <span>{plan.viewsTotal.toLocaleString()} Views</span>
        </span>

        {/* Likes Chip */}
        <span className="px-3 py-1 rounded-xl bg-white border border-[#C4552D]/30 text-[#C4552D] font-bold flex items-center gap-1.5 shadow-2xs font-sans">
          <Heart className="w-3.5 h-3.5 fill-[#C4552D] text-[#C4552D]" />
          <span>{plan.likesTotal.toLocaleString()} Likes</span>
        </span>

        {/* Saves Chip */}
        {plan.savesTotal > 0 && (
          <span className="px-3 py-1 rounded-xl bg-white border border-[#E0A030]/30 text-[#E0A030] font-bold flex items-center gap-1.5 shadow-2xs font-sans">
            <Bookmark className="w-3.5 h-3.5 fill-[#E0A030] text-[#E0A030]" />
            <span>{plan.savesTotal.toLocaleString()} Saves</span>
          </span>
        )}

        {/* Shares Chip */}
        {plan.sharesTotal > 0 && (
          <span className="px-3 py-1 rounded-xl bg-white border border-[#7C5CBF]/30 text-[#7C5CBF] font-bold flex items-center gap-1.5 shadow-2xs font-sans">
            <Share2 className="w-3.5 h-3.5 text-[#7C5CBF]" />
            <span>{plan.sharesTotal.toLocaleString()} Shares</span>
          </span>
        )}

        {/* Comments Chip */}
        {plan.commentsTotal > 0 && (
          <span className="px-3 py-1 rounded-xl bg-white border border-[#2A9D8F]/30 text-[#2A9D8F] font-bold flex items-center gap-1.5 shadow-2xs font-sans">
            <MessageCircle className="w-3.5 h-3.5 text-[#2A9D8F]" />
            <span>{plan.commentsTotal.toLocaleString()} Comments</span>
          </span>
        )}

        {/* Batches Count Chip */}
        <span className="px-2.5 py-1 rounded-xl bg-white border border-[#E4E0D3] text-[#111413] font-bold shadow-2xs flex items-center gap-1 font-sans ml-auto">
          <TrendingUp className="w-3.5 h-3.5 text-[#5E8C1F]" />
          <span>{plan.totalBatchesCount} batches on 15m grid</span>
        </span>
      </div>

      {/* 4. THE GRAPH SVG (100% Smooth Anti-Radar Non-Spiked S-Curve) */}
      <div className="relative w-full overflow-hidden bg-gradient-to-b from-[#F3F1EA]/40 to-white rounded-2xl border border-[#E4E0D3] p-2 sm:p-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full h-56 sm:h-64 touch-none cursor-crosshair font-sans overflow-visible"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id="viewsAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2F6B3A" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#2F6B3A" stopOpacity="0.01" />
            </linearGradient>

            <filter id="tooltipShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.12" />
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
                stroke="#E4E0D3"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text
                x={padLeft - 8}
                y={tick.y + 3.5}
                textAnchor="end"
                className="fill-[#5B625F] text-[10px] font-bold font-sans"
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
            stroke="#E4E0D3"
            strokeWidth="1.5"
          />

          {/* 1. SMOOTH VIEWS AREA FILL & LINE */}
          {viewsSmoothArea && <path d={viewsSmoothArea} fill="url(#viewsAreaGrad)" />}
          {viewsSmoothPath && (
            <path
              d={viewsSmoothPath}
              fill="none"
              stroke="#2F6B3A"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          )}

          {/* 2. SMOOTH AUXILIARY METRIC LINES (when overlay enabled) */}
          {showEngagementOverlay && (
            <>
              {sharesSmoothPath && (
                <path
                  d={sharesSmoothPath}
                  fill="none"
                  stroke="#7C5CBF"
                  strokeWidth="1.6"
                  strokeDasharray="3 2"
                />
              )}
              {savesSmoothPath && (
                <path
                  d={savesSmoothPath}
                  fill="none"
                  stroke="#E0A030"
                  strokeWidth="1.6"
                  strokeDasharray="3 2"
                />
              )}
              {likesSmoothPath && (
                <path
                  d={likesSmoothPath}
                  fill="none"
                  stroke="#C4552D"
                  strokeWidth="1.8"
                  strokeDasharray="3 2"
                />
              )}
            </>
          )}

          {/* Bottom Time Labels */}
          {timeLabels.map((lbl, idx) => (
            <text
              key={idx}
              x={lbl.x}
              y={baselineY + 18}
              textAnchor="middle"
              className="fill-[#5B625F] text-[9.5px] font-semibold font-sans"
            >
              {lbl.text}
            </text>
          ))}

          {/* Interactive Hover Crosshair & Tooltip */}
          {hoveredPoint && (
            <g>
              <line
                x1={hoveredPoint.x}
                y1={padTop}
                x2={hoveredPoint.x}
                y2={baselineY}
                stroke="#2F6B3A"
                strokeWidth="1.2"
                strokeDasharray="2 2"
                opacity="0.8"
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="4.5"
                fill="#2F6B3A"
                stroke="#FFFFFF"
                strokeWidth="2"
              />

              {/* Tooltip Card */}
              <g
                transform={`translate(${
                  hoveredPoint.x > SVG_WIDTH - 160
                    ? hoveredPoint.x - 145
                    : hoveredPoint.x + 12
                }, ${Math.max(padTop + 10, Math.min(baselineY - 100, hoveredPoint.y - 45))})`}
                filter="url(#tooltipShadow)"
              >
                <rect
                  width="135"
                  height="115"
                  rx="14"
                  fill="#FFFFFF"
                  stroke="#E4E0D3"
                  strokeWidth="1"
                />
                <text x="12" y="20" className="fill-[#111413] text-[11px] font-black font-sans">
                  {hoveredPoint.timeLabel}
                </text>
                <line x1="12" y1="26" x2="123" y2="26" stroke="#E4E0D3" strokeWidth="1" />

                <circle cx="16" cy="40" r="3" fill="#2F6B3A" />
                <text x="24" y="43" className="fill-[#5B625F] text-[10px] font-semibold font-sans">Views</text>
                <text x="123" y="43" textAnchor="end" className="fill-[#2F6B3A] text-[10px] font-bold font-sans">
                  {hoveredPoint.views.toLocaleString()}
                </text>

                <circle cx="16" cy="58" r="3" fill="#C4552D" />
                <text x="24" y="61" className="fill-[#5B625F] text-[10px] font-semibold font-sans">Likes</text>
                <text x="123" y="61" textAnchor="end" className="fill-[#C4552D] text-[10px] font-bold font-sans">
                  {hoveredPoint.likes.toLocaleString()}
                </text>

                <circle cx="16" cy="76" r="3" fill="#E0A030" />
                <text x="24" y="79" className="fill-[#5B625F] text-[10px] font-semibold font-sans">Saves</text>
                <text x="123" y="79" textAnchor="end" className="fill-[#E0A030] text-[10px] font-bold font-sans">
                  {hoveredPoint.saves.toLocaleString()}
                </text>

                <circle cx="16" cy="94" r="3" fill="#7C5CBF" />
                <text x="24" y="97" className="fill-[#5B625F] text-[10px] font-semibold font-sans">Shares</text>
                <text x="123" y="97" textAnchor="end" className="fill-[#7C5CBF] text-[10px] font-bold font-sans">
                  {hoveredPoint.shares.toLocaleString()}
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>

      {/* 5. VIEW SCHEDULE BUTTON & COLLAPSIBLE PANEL */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setShowScheduleModal(!showScheduleModal)}
          className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F3F1EA] border border-[#E4E0D3] text-xs font-bold text-[#111413] flex items-center gap-2 shadow-2xs transition-all press-scale cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5 text-[#5E8C1F]" />
          <span>View Schedule ({plan.totalBatchesCount} Batches)</span>
          {showScheduleModal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <button
          type="button"
          onClick={handleDownloadCsv}
          className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F3F1EA] border border-[#E4E0D3] text-xs font-bold text-[#111413] flex items-center gap-1.5 shadow-2xs hover:border-[#111413]/40 transition-all press-scale cursor-pointer"
          title="Download schedule CSV"
        >
          <Download className="w-3.5 h-3.5 text-[#5B625F]" />
          <span>Download CSV</span>
        </button>
      </div>

      {/* SCHEDULE PANEL (Filters & Table) */}
      {showScheduleModal && (
        <div className="p-4 rounded-2xl bg-[#F3F1EA]/50 border border-[#E4E0D3] space-y-3 animate-fadeIn">
          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-[#5B625F] mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            {["ALL", "VIEWS", "LIKES", "SAVES", "SHARES", "COMMENTS"].map((svc) => (
              <button
                key={svc}
                type="button"
                onClick={() => setFilterService(svc)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  filterService === svc
                    ? "bg-[#111413] text-[#D4F04F] shadow-2xs"
                    : "bg-white text-[#5B625F] border border-[#E4E0D3] hover:bg-[#F3F1EA]"
                }`}
              >
                {svc}
              </button>
            ))}
          </div>

          {/* Schedule Table */}
          <div className="max-h-64 overflow-y-auto rounded-xl border border-[#E4E0D3] bg-white divide-y divide-[#E4E0D3]/60 font-sans text-xs">
            {filteredBatches.map((b, idx) => {
              const batchDate = new Date(startDate.getTime() + b.minuteOffset * 60 * 1000);
              const clockTime = new Intl.DateTimeFormat("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }).format(batchDate);

              return (
                <div
                  key={b.id || idx}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-2 hover:bg-[#F3F1EA] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-[#F3F1EA] text-[#111413] font-bold text-[10px] flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-[#111413]">+{b.minuteOffset}m</span>
                    <span className="text-[10px] text-[#5B625F]">({clockTime})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        b.service === "views"
                          ? "bg-emerald-50 text-[#2F6B3A] border border-emerald-200"
                          : b.service === "likes"
                          ? "bg-rose-50 text-[#C4552D] border border-rose-200"
                          : b.service === "saves"
                          ? "bg-amber-50 text-[#E0A030] border border-amber-200"
                          : b.service === "shares"
                          ? "bg-purple-50 text-[#7C5CBF] border border-purple-200"
                          : "bg-teal-50 text-[#2A9D8F] border border-teal-200"
                      }`}
                    >
                      {b.service}
                    </span>

                    <span className="font-black text-[#111413] min-w-[50px] text-right">
                      {b.quantity.toLocaleString()}
                    </span>

                    <span className="text-[9px] font-bold text-[#5E8C1F] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50 hidden sm:inline-block">
                      :{(b.minuteOffset % 60).toString().padStart(2, "0")} grid
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

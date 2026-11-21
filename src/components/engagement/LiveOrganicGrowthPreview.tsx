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
  Repeat,
  Info,
} from "lucide-react";
import {
  PlanObject,
  PlanRow,
  TrendPoint,
} from "@/lib/engagement/deterministic-pattern-engine";

export interface LiveOrganicGrowthPreviewProps {
  plan: PlanObject;
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
  const [showScheduleModal, setShowScheduleModal] = useState(true);
  const [filterType, setFilterType] = useState<
    "ALL" | "VIEWS_ONLY" | "LIKES" | "SAVES" | "REPOSTS" | "SHARES" | "COMMENTS"
  >("ALL");
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const [templateInput, setTemplateInput] = useState<string>("335");
  const [isGenerating, setIsGenerating] = useState(false);
  const [mobileGraphView, setMobileGraphView] = useState<"detailed" | "fit">("detailed");
  const svgRef = useRef<SVGSVGElement | null>(null);

  // SVG dimensions (Spec: 900 x 320)
  const SVG_WIDTH = 900;
  const SVG_HEIGHT = 320;
  const padLeft = 60;
  const padRight = 55;
  const padTop = 35;
  const padBottom = 45;

  const plotWidth = SVG_WIDTH - padLeft - padRight;
  const plotHeight = SVG_HEIGHT - padTop - padBottom;
  const baselineY = padTop + plotHeight;
  const totalMinutes = Math.max(60, plan.totalDurationMinutes);

  const viewsTotal = Math.max(1, plan.totals.views);
  const maxEngagement = Math.max(
    10,
    plan.totals.likes,
    plan.totals.saves,
    plan.totals.reposts,
    plan.totals.shares,
    plan.totals.comments
  );

  const peakViewBatch = useMemo(
    () => Math.max(1, ...plan.rows.map((r) => r.views)),
    [plan.rows]
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
      const fraction = Math.max(0, Math.min(1, val / viewsTotal));
      return baselineY - fraction * plotHeight;
    },
    [viewsTotal, baselineY, plotHeight]
  );

  const getYEng = useCallback(
    (val: number) => {
      const fraction = maxEngagement > 0 ? Math.max(0, Math.min(1, val / maxEngagement)) : 0;
      return baselineY - fraction * (plotHeight * 0.88);
    },
    [maxEngagement, baselineY, plotHeight]
  );

  // 1. Continuous faint background trend curve C(t)
  const trendCurvePath = useMemo(() => {
    if (!plan.trendCurve || plan.trendCurve.length === 0) return "";
    let d = `M ${padLeft.toFixed(1)} ${baselineY.toFixed(1)}`;
    for (const pt of plan.trendCurve) {
      d += ` L ${getX(pt.minuteOffset).toFixed(1)} ${getYViews(pt.cumulativeViews).toFixed(1)}`;
    }
    return d;
  }, [plan.trendCurve, getX, getYViews, padLeft, baselineY]);

  // 2. Monotonic Cumulative Views Line directly through each row's batch point
  const viewsLinePath = useMemo(() => {
    if (!plan.rows || plan.rows.length === 0) return "";
    let d = `M ${padLeft.toFixed(1)} ${baselineY.toFixed(1)}`;
    for (const r of plan.rows) {
      d += ` L ${getX(r.minuteOffset).toFixed(1)} ${getYViews(r.cumulativeViews).toFixed(1)}`;
    }
    return d;
  }, [plan.rows, getX, getYViews, padLeft, baselineY]);

  // Area under views curve
  const viewsAreaPath = useMemo(() => {
    if (!viewsLinePath || plan.rows.length === 0) return "";
    const lastRow = plan.rows[plan.rows.length - 1];
    const lastX = getX(lastRow.minuteOffset);
    return `${viewsLinePath} L ${lastX.toFixed(1)} ${baselineY.toFixed(1)} L ${padLeft.toFixed(1)} ${baselineY.toFixed(1)} Z`;
  }, [viewsLinePath, plan.rows, getX, baselineY, padLeft]);

  // 3. Engagement Cumulative Lines (plotted against Right Y-axis)
  const likesPath = useMemo(() => {
    if (plan.totals.likes === 0 || !plan.rows || plan.rows.length === 0) return "";
    let d = `M ${padLeft.toFixed(1)} ${baselineY.toFixed(1)}`;
    for (const r of plan.rows) {
      d += ` L ${getX(r.minuteOffset).toFixed(1)} ${getYEng(r.cumulativeLikes).toFixed(1)}`;
    }
    return d;
  }, [plan.rows, plan.totals.likes, getX, getYEng, padLeft, baselineY]);

  const savesPath = useMemo(() => {
    if (plan.totals.saves === 0 || !plan.rows || plan.rows.length === 0) return "";
    let d = `M ${padLeft.toFixed(1)} ${baselineY.toFixed(1)}`;
    for (const r of plan.rows) {
      d += ` L ${getX(r.minuteOffset).toFixed(1)} ${getYEng(r.cumulativeSaves).toFixed(1)}`;
    }
    return d;
  }, [plan.rows, plan.totals.saves, getX, getYEng, padLeft, baselineY]);

  const repostsPath = useMemo(() => {
    if (plan.totals.reposts === 0 || !plan.rows || plan.rows.length === 0) return "";
    let d = `M ${padLeft.toFixed(1)} ${baselineY.toFixed(1)}`;
    for (const r of plan.rows) {
      d += ` L ${getX(r.minuteOffset).toFixed(1)} ${getYEng(r.cumulativeReposts).toFixed(1)}`;
    }
    return d;
  }, [plan.rows, plan.totals.reposts, getX, getYEng, padLeft, baselineY]);

  const sharesPath = useMemo(() => {
    if (plan.totals.shares === 0 || !plan.rows || plan.rows.length === 0) return "";
    let d = `M ${padLeft.toFixed(1)} ${baselineY.toFixed(1)}`;
    for (const r of plan.rows) {
      d += ` L ${getX(r.minuteOffset).toFixed(1)} ${getYEng(r.cumulativeShares).toFixed(1)}`;
    }
    return d;
  }, [plan.rows, plan.totals.shares, getX, getYEng, padLeft, baselineY]);

  const commentsPath = useMemo(() => {
    if (plan.totals.comments === 0 || !plan.rows || plan.rows.length === 0) return "";
    let d = `M ${padLeft.toFixed(1)} ${baselineY.toFixed(1)}`;
    for (const r of plan.rows) {
      d += ` L ${getX(r.minuteOffset).toFixed(1)} ${getYEng(r.cumulativeComments).toFixed(1)}`;
    }
    return d;
  }, [plan.rows, plan.totals.comments, getX, getYEng, padLeft, baselineY]);

  // Left Y-Axis Ticks (Views)
  const leftYTicks = useMemo(() => {
    return [0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
      const val = Math.round(viewsTotal * frac);
      let label = `${val}`;
      if (val >= 1000) {
        label = frac === 1.0 || val % 1000 === 0
          ? `${(val / 1000).toFixed(0)}k`
          : `${(val / 1000).toFixed(1)}k`;
      }
      return {
        val,
        label,
        y: baselineY - frac * plotHeight,
      };
    });
  }, [viewsTotal, baselineY, plotHeight]);

  // Right Y-Axis Ticks (Engagement)
  const rightYTicks = useMemo(() => {
    return [0, 0.33, 0.66, 1.0].map((frac) => {
      const val = Math.round(maxEngagement * frac);
      return {
        val,
        label: `${val}`,
        y: baselineY - frac * (plotHeight * 0.88),
      };
    });
  }, [maxEngagement, baselineY, plotHeight]);

  // Bottom Timeline Labels
  const timeLabels = useMemo(() => {
    const count = 9;
    const labels: Array<{ x: number; text: string }> = [];
    for (let i = 0; i < count; i++) {
      const frac = i / (count - 1);
      const minute = frac * totalMinutes;
      const targetDate = new Date(startDate.getTime() + minute * 60 * 1000);
      const text = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Dhaka",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(targetDate);
      labels.push({ x: getX(minute), text });
    }
    return labels;
  }, [totalMinutes, startDate, getX]);

  // Row filtering counts and list
  const filteredRows = useMemo(() => {
    if (filterType === "ALL") return plan.rows;
    if (filterType === "VIEWS_ONLY") {
      return plan.rows.filter(
        (r) =>
          r.likes === 0 &&
          r.saves === 0 &&
          r.reposts === 0 &&
          r.shares === 0 &&
          r.comments === 0
      );
    }
    if (filterType === "LIKES") return plan.rows.filter((r) => r.likes > 0);
    if (filterType === "SAVES") return plan.rows.filter((r) => r.saves > 0);
    if (filterType === "REPOSTS") return plan.rows.filter((r) => r.reposts > 0);
    if (filterType === "SHARES") return plan.rows.filter((r) => r.shares > 0);
    if (filterType === "COMMENTS") return plan.rows.filter((r) => r.comments > 0);
    return plan.rows;
  }, [plan.rows, filterType]);

  const countsByFilter = useMemo(() => {
    const viewsOnly = plan.rows.filter(
      (r) =>
        r.likes === 0 &&
        r.saves === 0 &&
        r.reposts === 0 &&
        r.shares === 0 &&
        r.comments === 0
    ).length;
    return {
      all: plan.rows.length,
      viewsOnly,
      likes: plan.rows.filter((r) => r.likes > 0).length,
      saves: plan.rows.filter((r) => r.saves > 0).length,
      reposts: plan.rows.filter((r) => r.reposts > 0).length,
      shares: plan.rows.filter((r) => r.shares > 0).length,
      comments: plan.rows.filter((r) => r.comments > 0).length,
    };
  }, [plan.rows]);

  // Check if a row matches the current filter
  const isRowMatchingFilter = useCallback(
    (r: PlanRow) => {
      if (filterType === "ALL") return true;
      if (filterType === "VIEWS_ONLY") {
        return (
          r.likes === 0 &&
          r.saves === 0 &&
          r.reposts === 0 &&
          r.shares === 0 &&
          r.comments === 0
        );
      }
      if (filterType === "LIKES") return r.likes > 0;
      if (filterType === "SAVES") return r.saves > 0;
      if (filterType === "REPOSTS") return r.reposts > 0;
      if (filterType === "SHARES") return r.shares > 0;
      if (filterType === "COMMENTS") return r.comments > 0;
      return true;
    },
    [filterType]
  );

  // Active highlighted row (hovered takes priority, else selected)
  const activeRow = useMemo(() => {
    const idx = hoveredRowIndex ?? selectedRowIndex;
    if (idx === null || idx === undefined) return null;
    return plan.rows.find((r) => r.index === idx) || null;
  }, [hoveredRowIndex, selectedRowIndex, plan.rows]);

  // Pointer hover on SVG to find nearest row
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * SVG_WIDTH;

    if (svgX < padLeft - 10 || svgX > padLeft + plotWidth + 10) {
      setHoveredRowIndex(null);
      return;
    }

    // Find nearest row by x
    let nearestIdx = 0;
    let minDiff = Infinity;
    for (const r of plan.rows) {
      const rx = getX(r.minuteOffset);
      const diff = Math.abs(rx - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        nearestIdx = r.index;
      }
    }
    setHoveredRowIndex(nearestIdx);
  };

  // CSV Export (Section 5)
  const handleDownloadCsv = () => {
    const headers = [
      "batch_number",
      "minute_offset",
      "clock_time_bd",
      "views",
      "cum_views",
      "likes",
      "cum_likes",
      "saves",
      "cum_saves",
      "reposts",
      "cum_reposts",
      "shares",
      "cum_shares",
      "comments",
      "cum_comments",
    ];

    const csvRows = plan.rows.map((r) => [
      r.index + 1,
      r.minuteOffset,
      r.clockTime,
      r.views,
      r.cumulativeViews,
      r.likes,
      r.cumulativeLikes,
      r.saves,
      r.cumulativeSaves,
      r.reposts,
      r.cumulativeReposts,
      r.shares,
      r.cumulativeShares,
      r.comments,
      r.cumulativeComments,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...csvRows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `aurasmm-plan-${plan.seed.slice(0, 8)}.csv`);
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
    <div className="bg-white rounded-3xl border border-[#E4E0D3] p-3.5 sm:p-6 shadow-subtle space-y-4 font-sans select-none">
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
              Gradual, view-paced delivery • Monotonic continuous plan execution
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
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isGenerating ? "animate-spin text-[#5E8C1F]" : "text-[#5B625F]"
              }`}
            />
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
            Pattern #{plan.seed.slice(0, 8)}
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

          {isAdmin && (
            <span className="text-[11px] font-mono text-[#5B625F] bg-[#F3F1EA] px-2 py-0.5 rounded border border-[#E4E0D3]">
              rebalanced: views exact
            </span>
          )}
        </div>

        {/* Admin Template Selector */}
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

      {/* 3. METRIC CHIPS SUMMARY ROW (Section 6: Exact sums of rows[]) */}
      <div className="flex items-center flex-wrap gap-2 text-xs font-sans">
        {/* Total Views Chip */}
        <span className="px-3 py-1 rounded-xl bg-[#2F6B3A] text-white font-bold flex items-center gap-1.5 shadow-2xs font-sans">
          <Eye className="w-3.5 h-3.5 fill-white" />
          <span>{plan.totals.views.toLocaleString()} Views</span>
        </span>

        {/* Likes Chip */}
        {plan.totals.likes > 0 ? (
          <span className="px-3 py-1 rounded-xl bg-white border border-[#C4552D]/30 text-[#C4552D] font-bold flex items-center gap-1.5 shadow-2xs font-sans">
            <Heart className="w-3.5 h-3.5 fill-[#C4552D] text-[#C4552D]" />
            <span>{plan.totals.likes.toLocaleString()} Likes</span>
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-xl bg-[#F3F1EA] text-[#5B625F] border border-[#E4E0D3] font-semibold text-[11px] font-sans">
            Likes: not included in this order (below min 10)
          </span>
        )}

        {/* Saves Chip */}
        {plan.totals.saves > 0 ? (
          <span className="px-3 py-1 rounded-xl bg-white border border-[#E0A030]/30 text-[#E0A030] font-bold flex items-center gap-1.5 shadow-2xs font-sans">
            <Bookmark className="w-3.5 h-3.5 fill-[#E0A030] text-[#E0A030]" />
            <span>{plan.totals.saves.toLocaleString()} Saves</span>
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-xl bg-[#F3F1EA] text-[#5B625F] border border-[#E4E0D3] font-semibold text-[11px] font-sans">
            Saves: not included in this order (below min 10)
          </span>
        )}

        {/* Reposts Chip */}
        {plan.totals.reposts > 0 ? (
          <span className="px-3 py-1 rounded-xl bg-white border border-[#2A9D8F]/30 text-[#2A9D8F] font-bold flex items-center gap-1.5 shadow-2xs font-sans">
            <Repeat className="w-3.5 h-3.5 text-[#2A9D8F]" />
            <span>{plan.totals.reposts.toLocaleString()} Reposts</span>
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-xl bg-[#F3F1EA] text-[#5B625F] border border-[#E4E0D3] font-semibold text-[11px] font-sans">
            Reposts: not included in this order (below min 10)
          </span>
        )}

        {/* Shares Chip */}
        {plan.totals.shares > 0 ? (
          <span className="px-3 py-1 rounded-xl bg-white border border-[#7C5CBF]/30 text-[#7C5CBF] font-bold flex items-center gap-1.5 shadow-2xs font-sans">
            <Share2 className="w-3.5 h-3.5 text-[#7C5CBF]" />
            <span>{plan.totals.shares.toLocaleString()} Shares</span>
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-xl bg-[#F3F1EA] text-[#5B625F] border border-[#E4E0D3] font-semibold text-[11px] font-sans">
            Shares: not included in this order (below min 10)
          </span>
        )}

        {/* Comments Chip */}
        {plan.totals.comments > 0 ? (
          <span className="px-3 py-1 rounded-xl bg-white border border-[#3D82A2]/30 text-[#3D82A2] font-bold flex items-center gap-1.5 shadow-2xs font-sans">
            <MessageCircle className="w-3.5 h-3.5 text-[#3D82A2]" />
            <span>{plan.totals.comments.toLocaleString()} Comments</span>
          </span>
        ) : null}

        {/* Runs Count Chip */}
        <span className="px-2.5 py-1 rounded-xl bg-white border border-[#E4E0D3] text-[#111413] font-bold shadow-2xs flex items-center gap-1 font-sans ml-auto">
          <TrendingUp className="w-3.5 h-3.5 text-[#5E8C1F]" />
          <span>{plan.rows.length} batches on 15m grid</span>
        </span>
      </div>

      {/* 4. THE GRAPH SVG (Section 4: Direct render of rows[], viewBox 0 0 900 320) */}
      <div className="relative w-full bg-gradient-to-b from-[#F3F1EA]/40 to-white rounded-2xl border border-[#E4E0D3] p-2.5 sm:p-3 space-y-2">
        {/* Mobile View Switcher & Timeline Hint */}
        <div className="sm:hidden flex items-center justify-between px-1 text-xs text-[#5B625F]">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#111413]/70">Timeline:</span>
            <div className="inline-flex rounded-lg bg-[#F3F1EA] p-0.5 border border-[#E4E0D3]">
              <button
                type="button"
                onClick={() => setMobileGraphView("detailed")}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  mobileGraphView === "detailed"
                    ? "bg-[#111413] text-[#D4F04F] shadow-xs"
                    : "text-[#5B625F] hover:text-[#111413]"
                }`}
              >
                Detailed (Swipe ↔)
              </button>
              <button
                type="button"
                onClick={() => setMobileGraphView("fit")}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  mobileGraphView === "fit"
                    ? "bg-[#111413] text-[#D4F04F] shadow-xs"
                    : "text-[#5B625F] hover:text-[#111413]"
                }`}
              >
                Fit Screen
              </button>
            </div>
          </div>
          {mobileGraphView === "detailed" && (
            <span className="text-[10px] text-[#5E8C1F] font-bold flex items-center gap-0.5 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
              <span>↔</span> Swipe timeline
            </span>
          )}
        </div>

        {/* Scrollable Container on Mobile for Detailed, or Responsive Fit */}
        <div
          className={`w-full ${
            mobileGraphView === "detailed"
              ? "overflow-x-auto overflow-y-hidden pb-1 -mx-0.5 px-0.5 scrollbar-thin"
              : "overflow-hidden"
          }`}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className={`${
              mobileGraphView === "detailed"
                ? "min-w-[650px] sm:min-w-0 w-full h-[225px] sm:h-72 touch-pan-x"
                : "w-full h-auto aspect-[900/320]"
            } cursor-crosshair font-sans overflow-visible select-none`}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoveredRowIndex(null)}
            onClick={(e) => {
              if (!svgRef.current) return;
              const rect = svgRef.current.getBoundingClientRect();
              const svgX = ((e.clientX - rect.left) / rect.width) * SVG_WIDTH;
              let nearestIdx = 0;
              let minDiff = Infinity;
              for (const r of plan.rows) {
                const rx = getX(r.minuteOffset);
                const diff = Math.abs(rx - svgX);
                if (diff < minDiff) {
                  minDiff = diff;
                  nearestIdx = r.index;
                }
              }
              setSelectedRowIndex(nearestIdx);
              setHoveredRowIndex(nearestIdx);
            }}
          >
          <defs>
            <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2F6B3A" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#2F6B3A" stopOpacity="0.01" />
            </linearGradient>

            <filter id="tooltipShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.15" />
            </filter>
          </defs>

          {/* Left Y-Axis Horizontal Grid Lines (Views) */}
          {leftYTicks.map((tick, i) => (
            <g key={`ly-${i}`}>
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

          {/* Right Y-Axis Grid Labels (Engagement) */}
          {showEngagementOverlay &&
            rightYTicks.map((tick, i) => (
              <g key={`ry-${i}`}>
                <text
                  x={padLeft + plotWidth + 8}
                  y={tick.y + 3.5}
                  textAnchor="start"
                  className="fill-[#C4552D] text-[9.5px] font-mono font-bold"
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

          {/* Axis Labels */}
          <text
            x={padLeft - 8}
            y={padTop - 12}
            textAnchor="end"
            className="fill-[#2F6B3A] text-[10px] font-black uppercase tracking-wider font-sans"
          >
            Views
          </text>
          {showEngagementOverlay && (
            <text
              x={padLeft + plotWidth + 8}
              y={padTop - 12}
              textAnchor="start"
              className="fill-[#C4552D] text-[10px] font-black uppercase tracking-wider font-sans"
            >
              Engagement
            </text>
          )}

          {/* A. FAINT CONTINUOUS TREND CURVE C(t) */}
          {trendCurvePath && (
            <path
              d={trendCurvePath}
              fill="none"
              stroke="#D8D4C7"
              strokeWidth="1.5"
              strokeDasharray="2 2"
              opacity="0.75"
            />
          )}

          {/* B. VIEWS AREA GRADIENT & CUMULATIVE LINE */}
          {viewsAreaPath && <path d={viewsAreaPath} fill="url(#viewsGrad)" />}
          {viewsLinePath && (
            <path
              d={viewsLinePath}
              fill="none"
              stroke="#2F6B3A"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* C. ENGAGEMENT SERIES DASHED LINES (overlay enabled) */}
          {showEngagementOverlay && (
            <>
              {/* Reposts: #2A9D8F */}
              {repostsPath && (
                <path
                  d={repostsPath}
                  fill="none"
                  stroke="#2A9D8F"
                  strokeWidth="1.6"
                  strokeDasharray="4 3"
                />
              )}
              {/* Shares: #7C5CBF */}
              {sharesPath && (
                <path
                  d={sharesPath}
                  fill="none"
                  stroke="#7C5CBF"
                  strokeWidth="1.6"
                  strokeDasharray="4 3"
                />
              )}
              {/* Saves: #E0A030 */}
              {savesPath && (
                <path
                  d={savesPath}
                  fill="none"
                  stroke="#E0A030"
                  strokeWidth="1.6"
                  strokeDasharray="4 3"
                />
              )}
              {/* Comments: #3D82A2 */}
              {commentsPath && (
                <path
                  d={commentsPath}
                  fill="none"
                  stroke="#3D82A2"
                  strokeWidth="1.6"
                  strokeDasharray="4 3"
                />
              )}
              {/* Likes: #C4552D */}
              {likesPath && (
                <path
                  d={likesPath}
                  fill="none"
                  stroke="#C4552D"
                  strokeWidth="1.8"
                  strokeDasharray="4 3"
                />
              )}
            </>
          )}

          {/* D. BOTTOM BARS: view size of each batch at bottom */}
          {plan.rows.map((r) => {
            const bx = getX(r.minuteOffset) - 2;
            const barHeight = Math.max(2, (r.views / peakViewBatch) * 36);
            const by = baselineY - barHeight;
            const isSelected = selectedRowIndex === r.index;
            const isHovered = hoveredRowIndex === r.index;
            const matchesFilter = isRowMatchingFilter(r);

            return (
              <rect
                key={`bar-${r.index}`}
                x={bx}
                y={by}
                width="4"
                height={barHeight}
                rx="1"
                fill={
                  isSelected
                    ? "#111413"
                    : isHovered
                    ? "#2F6B3A"
                    : "rgba(47, 107, 58, 0.38)"
                }
                opacity={matchesFilter ? 1 : 0.25}
                className="transition-colors cursor-pointer"
                onClick={() => setSelectedRowIndex(r.index)}
                onMouseEnter={() => setHoveredRowIndex(r.index)}
              />
            );
          })}

          {/* E. BATCH DATA POINTS on Views Cumulative Line */}
          {plan.rows.map((r) => {
            const cx = getX(r.minuteOffset);
            const cy = getYViews(r.cumulativeViews);
            const isSelected = selectedRowIndex === r.index;
            const isHovered = hoveredRowIndex === r.index;
            const matchesFilter = isRowMatchingFilter(r);

            let radius = 3.5;
            let fill = "#2F6B3A";
            let stroke = "#FFFFFF";
            let strokeWidth = 1.5;

            if (isSelected) {
              radius = 6.5;
              fill = "#D4F04F";
              stroke = "#111413";
              strokeWidth = 3;
            } else if (isHovered) {
              radius = 5.5;
              fill = "#2F6B3A";
              stroke = "#111413";
              strokeWidth = 2;
            }

            return (
              <circle
                key={`pt-${r.index}`}
                cx={cx}
                cy={cy}
                r={radius}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                opacity={matchesFilter ? 1 : 0.25}
                className="cursor-pointer transition-transform"
                onClick={() => setSelectedRowIndex(r.index)}
                onMouseEnter={() => setHoveredRowIndex(r.index)}
              />
            );
          })}

          {/* F. BOTTOM TIME LABELS */}
          {timeLabels.map((lbl, idx) => (
            <text
              key={`time-${idx}`}
              x={lbl.x}
              y={baselineY + 18}
              textAnchor="middle"
              className="fill-[#5B625F] text-[9.5px] font-semibold font-sans"
            >
              {lbl.text}
            </text>
          ))}

          {/* G. INTERACTIVE CROSSHAIR & TOOLTIP */}
          {activeRow && (
            <g>
              {/* Vertical Guide Line */}
              <line
                x1={getX(activeRow.minuteOffset)}
                y1={padTop}
                x2={getX(activeRow.minuteOffset)}
                y2={baselineY}
                stroke="#111413"
                strokeWidth="1.2"
                strokeDasharray="2 2"
                opacity="0.75"
              />

              {/* Tooltip Card */}
              <g
                transform={`translate(${
                  getX(activeRow.minuteOffset) > SVG_WIDTH - 200
                    ? getX(activeRow.minuteOffset) - 185
                    : getX(activeRow.minuteOffset) + 12
                }, ${Math.max(
                  padTop + 5,
                  Math.min(baselineY - 145, getYViews(activeRow.cumulativeViews) - 60)
                )})`}
                filter="url(#tooltipShadow)"
              >
                <rect
                  width="175"
                  height="138"
                  rx="14"
                  fill="#FFFFFF"
                  stroke="#E4E0D3"
                  strokeWidth="1.2"
                />
                <text
                  x="12"
                  y="18"
                  className="fill-[#111413] text-[11px] font-black font-sans"
                >
                  Batch #{activeRow.index + 1} • +{activeRow.minuteOffset}m ({activeRow.clockTime} BD)
                </text>
                <line
                  x1="12"
                  y1="25"
                  x2="163"
                  y2="25"
                  stroke="#E4E0D3"
                  strokeWidth="1"
                />

                {/* Views */}
                <circle cx="16" cy="38" r="3" fill="#2F6B3A" />
                <text x="24" y="41" className="fill-[#5B625F] text-[10px] font-semibold font-sans">
                  Views Batch
                </text>
                <text
                  x="163"
                  y="41"
                  textAnchor="end"
                  className="fill-[#2F6B3A] text-[10px] font-bold font-sans"
                >
                  {activeRow.views.toLocaleString()} (+{activeRow.cumulativeViews.toLocaleString()})
                </text>

                {/* Likes */}
                <circle cx="16" cy="56" r="3" fill="#C4552D" />
                <text x="24" y="59" className="fill-[#5B625F] text-[10px] font-semibold font-sans">
                  Likes
                </text>
                <text
                  x="163"
                  y="59"
                  textAnchor="end"
                  className={`text-[10px] font-bold font-sans ${
                    activeRow.likes > 0 ? "fill-[#C4552D]" : "fill-[#5B625F]/40"
                  }`}
                >
                  {activeRow.likes > 0
                    ? `${activeRow.likes} (cum ${activeRow.cumulativeLikes})`
                    : "—"}
                </text>

                {/* Saves */}
                <circle cx="16" cy="74" r="3" fill="#E0A030" />
                <text x="24" y="77" className="fill-[#5B625F] text-[10px] font-semibold font-sans">
                  Saves
                </text>
                <text
                  x="163"
                  y="77"
                  textAnchor="end"
                  className={`text-[10px] font-bold font-sans ${
                    activeRow.saves > 0 ? "fill-[#E0A030]" : "fill-[#5B625F]/40"
                  }`}
                >
                  {activeRow.saves > 0
                    ? `${activeRow.saves} (cum ${activeRow.cumulativeSaves})`
                    : "—"}
                </text>

                {/* Reposts */}
                <circle cx="16" cy="92" r="3" fill="#2A9D8F" />
                <text x="24" y="95" className="fill-[#5B625F] text-[10px] font-semibold font-sans">
                  Reposts
                </text>
                <text
                  x="163"
                  y="95"
                  textAnchor="end"
                  className={`text-[10px] font-bold font-sans ${
                    activeRow.reposts > 0 ? "fill-[#2A9D8F]" : "fill-[#5B625F]/40"
                  }`}
                >
                  {activeRow.reposts > 0
                    ? `${activeRow.reposts} (cum ${activeRow.cumulativeReposts})`
                    : "—"}
                </text>

                {/* Shares */}
                <circle cx="16" cy="110" r="3" fill="#7C5CBF" />
                <text x="24" y="113" className="fill-[#5B625F] text-[10px] font-semibold font-sans">
                  Shares
                </text>
                <text
                  x="163"
                  y="113"
                  textAnchor="end"
                  className={`text-[10px] font-bold font-sans ${
                    activeRow.shares > 0 ? "fill-[#7C5CBF]" : "fill-[#5B625F]/40"
                  }`}
                >
                  {activeRow.shares > 0
                    ? `${activeRow.shares} (cum ${activeRow.cumulativeShares})`
                    : "—"}
                </text>

                {/* Comments (if any) */}
                {plan.totals.comments > 0 && (
                  <>
                    <circle cx="16" cy="126" r="3" fill="#3D82A2" />
                    <text x="24" y="129" className="fill-[#5B625F] text-[9px] font-semibold font-sans">
                      Comments
                    </text>
                    <text
                      x="163"
                      y="129"
                      textAnchor="end"
                      className={`text-[9px] font-bold font-sans ${
                        activeRow.comments > 0 ? "fill-[#3D82A2]" : "fill-[#5B625F]/40"
                      }`}
                    >
                      {activeRow.comments > 0
                        ? `${activeRow.comments} (cum ${activeRow.cumulativeComments})`
                        : "—"}
                    </text>
                  </>
                )}
              </g>
            </g>
          )}
        </svg>
        </div>
      </div>

      {/* 5. VIEW SCHEDULE BUTTON & COLLAPSIBLE PANEL */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setShowScheduleModal(!showScheduleModal)}
          className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F3F1EA] border border-[#E4E0D3] text-xs font-bold text-[#111413] flex items-center gap-2 shadow-2xs transition-all press-scale cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5 text-[#5E8C1F]" />
          <span>Batch Schedule ({plan.rows.length} Rows)</span>
          {showScheduleModal ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        <button
          type="button"
          onClick={handleDownloadCsv}
          className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F3F1EA] border border-[#E4E0D3] text-xs font-bold text-[#111413] flex items-center gap-1.5 shadow-2xs hover:border-[#111413]/40 transition-all press-scale cursor-pointer"
          title="Download schedule CSV with exact row data"
        >
          <Download className="w-3.5 h-3.5 text-[#5B625F]" />
          <span>Download CSV</span>
        </button>
      </div>

      {/* 6. THE BATCH TABLE (Section 5: Scrollable table rendered directly from rows[]) */}
      {showScheduleModal && (
        <div className="p-4 rounded-2xl bg-[#F3F1EA]/50 border border-[#E4E0D3] space-y-3 animate-fadeIn font-sans">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-[#5B625F] mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            <button
              type="button"
              onClick={() => setFilterType("ALL")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filterType === "ALL"
                  ? "bg-[#111413] text-[#D4F04F] shadow-2xs"
                  : "bg-white text-[#5B625F] border border-[#E4E0D3] hover:bg-[#F3F1EA]"
              }`}
            >
              All ({countsByFilter.all})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("VIEWS_ONLY")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filterType === "VIEWS_ONLY"
                  ? "bg-[#111413] text-[#D4F04F] shadow-2xs"
                  : "bg-white text-[#5B625F] border border-[#E4E0D3] hover:bg-[#F3F1EA]"
              }`}
            >
              Views only ({countsByFilter.viewsOnly})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("LIKES")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filterType === "LIKES"
                  ? "bg-[#111413] text-[#D4F04F] shadow-2xs"
                  : "bg-white text-[#5B625F] border border-[#E4E0D3] hover:bg-[#F3F1EA]"
              }`}
            >
              With Likes ({countsByFilter.likes})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("SAVES")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filterType === "SAVES"
                  ? "bg-[#111413] text-[#D4F04F] shadow-2xs"
                  : "bg-white text-[#5B625F] border border-[#E4E0D3] hover:bg-[#F3F1EA]"
              }`}
            >
              With Saves ({countsByFilter.saves})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("REPOSTS")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filterType === "REPOSTS"
                  ? "bg-[#111413] text-[#D4F04F] shadow-2xs"
                  : "bg-white text-[#5B625F] border border-[#E4E0D3] hover:bg-[#F3F1EA]"
              }`}
            >
              With Reposts ({countsByFilter.reposts})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("SHARES")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filterType === "SHARES"
                  ? "bg-[#111413] text-[#D4F04F] shadow-2xs"
                  : "bg-white text-[#5B625F] border border-[#E4E0D3] hover:bg-[#F3F1EA]"
              }`}
            >
              With Shares ({countsByFilter.shares})
            </button>
            {plan.totals.comments > 0 && (
              <button
                type="button"
                onClick={() => setFilterType("COMMENTS")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  filterType === "COMMENTS"
                    ? "bg-[#111413] text-[#D4F04F] shadow-2xs"
                    : "bg-white text-[#5B625F] border border-[#E4E0D3] hover:bg-[#F3F1EA]"
                }`}
              >
                With Comments ({countsByFilter.comments})
              </button>
            )}
          </div>

          {/* Table Container */}
          <div className="max-h-72 overflow-y-auto rounded-xl border border-[#E4E0D3] bg-white">
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead className="bg-[#F3F1EA] text-[#5B625F] sticky top-0 z-10 border-b border-[#E4E0D3] text-[11px] uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3">Offset</th>
                  <th className="py-2.5 px-3">Clock Time (BD)</th>
                  <th className="py-2.5 px-3 text-right">Views</th>
                  <th className="py-2.5 px-3 text-right">Likes</th>
                  <th className="py-2.5 px-3 text-right">Saves</th>
                  <th className="py-2.5 px-3 text-right">Reposts</th>
                  <th className="py-2.5 px-3 text-right">Shares</th>
                  <th className="py-2.5 px-3 text-right">Comments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E0D3]/60">
                {filteredRows.map((r) => {
                  const isSelected = selectedRowIndex === r.index;
                  const isHovered = hoveredRowIndex === r.index;

                  return (
                    <tr
                      key={`row-${r.index}`}
                      onClick={() => setSelectedRowIndex(r.index)}
                      onMouseEnter={() => setHoveredRowIndex(r.index)}
                      onMouseLeave={() => setHoveredRowIndex(null)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-[#D4F04F]/20 font-bold border-l-4 border-l-[#111413]"
                          : isHovered
                          ? "bg-[#F3F1EA]"
                          : "hover:bg-[#F3F1EA]/60"
                      }`}
                    >
                      <td className="py-2 px-3 text-center font-mono text-[11px] text-[#5B625F]">
                        #{r.index + 1}
                      </td>
                      <td className="py-2 px-3 font-semibold text-[#111413]">
                        +{r.minuteOffset}m
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-[#5B625F]">
                        {r.clockTime}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-[#2F6B3A]">
                        {r.views.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-medium">
                        {r.likes > 0 ? (
                          <span className="text-[#C4552D] font-bold font-mono">
                            {r.likes.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-[#5B625F]/40 font-mono">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-medium">
                        {r.saves > 0 ? (
                          <span className="text-[#E0A030] font-bold font-mono">
                            {r.saves.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-[#5B625F]/40 font-mono">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-medium">
                        {r.reposts > 0 ? (
                          <span className="text-[#2A9D8F] font-bold font-mono">
                            {r.reposts.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-[#5B625F]/40 font-mono">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-medium">
                        {r.shares > 0 ? (
                          <span className="text-[#7C5CBF] font-bold font-mono">
                            {r.shares.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-[#5B625F]/40 font-mono">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-medium">
                        {r.comments > 0 ? (
                          <span className="text-[#3D82A2] font-bold font-mono">
                            {r.comments.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-[#5B625F]/40 font-mono">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#5B625F] pt-1">
            <span>
              Click any row to pinpoint its batch in the graph above. Hovering shows live sync.
            </span>
            <span className="font-mono font-bold">
              {filteredRows.length} of {plan.rows.length} rows displayed
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

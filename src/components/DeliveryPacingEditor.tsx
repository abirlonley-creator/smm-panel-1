"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  BarChart2, 
  BarChart3,
  Clock, 
  Layers, 
  TrendingUp, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Sliders, 
  ChevronDown, 
  ChevronUp,
  Lock,
  Unlock,
  Dices,
  Sparkles,
  Activity,
  Check,
  Calculator,
  Plus,
  Minus,
  Info,
  Calendar
} from "lucide-react";
import { ScheduleMode, SchedulingTimingMode, ScheduleStepPreview } from "@/lib/types";
import { calculateGrowthPlan, redistributeRemaining } from "@/lib/scheduler/calculator";
import {
  ORGANIC_PRESET_DEFINITIONS,
  OrganicPresetId,
  SpikeIntensity,
  generatePresetSparklinePath,
  audienceCircadianActivity,
} from "@/lib/scheduler/organic-presets";

export interface DeliveryPacingEditorProps {
  service: {
    id: string;
    name: string;
    minQuantity: number;
    maxQuantity: number;
    ratePer1000: number;
    dripFeedSupported?: boolean;
    dripFeedMinInterval?: number;
    dripFeedMaxInterval?: number;
    restrictions?: string | null;
  };
  totalQuantity: number;
  onTotalQuantityChange?: (qty: number) => void;
  targetUrl?: string;
  onPlanChange?: (plan: ReturnType<typeof calculateGrowthPlan>) => void;
  className?: string;
}

type GraphTab = "volume" | "cumulative" | "rate" | "actual";

function haveSameNumbers(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export function DeliveryPacingEditor({
  service,
  totalQuantity,
  onTotalQuantityChange,
  targetUrl = "https://instagram.com/example",
  onPlanChange,
  className = "",
}: DeliveryPacingEditorProps) {
  // Strategy Preset (Defaults to organic SLOW_BURN)
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("SLOW_BURN");

  // Controls State: Batch Count & Start Interval (Users define interval, system auto-calculates duration)
  const [stepCount, setStepCount] = useState<number>(8);
  const [defaultInterval, setDefaultInterval] = useState<number>(15); // minutes between batch starts (1, 5, 15, etc.)

  // Custom Overrides (Per-batch)
  const [customQuantities, setCustomQuantities] = useState<number[]>([]);
  const [customIntervals, setCustomIntervals] = useState<number[]>([]);
  const [isCustomManual, setIsCustomManual] = useState<boolean>(false);

  // Auto-calculated Total Delivery Window: batches * repeat interval (e.g. 8 batches * 3m = 24 mins)
  const totalDeliveryWindow = useMemo(() => {
    if (isCustomManual && customIntervals.length > 1) {
      const sumIntervals = customIntervals.slice(1).reduce((sum, val) => sum + (val || 0), 0);
      const lastSpan = customIntervals[customIntervals.length - 1] || defaultInterval;
      return sumIntervals + lastSpan;
    }
    return Math.max(1, stepCount * defaultInterval);
  }, [stepCount, defaultInterval, isCustomManual, customIntervals]);

  // Duration between first batch start (t=0) and last batch start (t=(N-1)*interval)
  const totalDuration = useMemo(() => {
    if (isCustomManual && customIntervals.length > 1) {
      return customIntervals.slice(1).reduce((sum, val) => sum + (val || 0), 0);
    }
    return Math.max(1, (stepCount - 1) * defaultInterval);
  }, [stepCount, defaultInterval, isCustomManual, customIntervals]);

  // Organic Engine Controls
  const [seed, setSeed] = useState<number>(12345);
  const [smoothness, setSmoothness] = useState<number>(65); // 0 (noisy/jitter) to 100 (glass smooth)
  const [spikeIntensity, setSpikeIntensity] = useState<SpikeIntensity>("medium");
  const [lockedBatchesMap, setLockedBatchesMap] = useState<Record<number, number>>({});

  // Graph Views
  const [activeGraphTab, setActiveGraphTab] = useState<GraphTab>("volume");

  // Accessible Per-Batch Table (Main Focus #2) - open by default for immediate clarity
  const [showBatchList, setShowBatchList] = useState<boolean>(true);

  // Drag interaction state
  const [draggingStepIdx, setDraggingStepIdx] = useState<number | null>(null);
  const chartSvgRef = useRef<SVGSVGElement | null>(null);
  const draggingIdxRef = useRef<number | null>(null);

  // Convert locked map to array for calculator
  const lockedBatchesArray = useMemo(() => {
    return Object.entries(lockedBatchesMap).map(([k, v]) => ({
      index: Number(k),
      quantity: v,
    }));
  }, [lockedBatchesMap]);

  // Only feed the manual overrides into the plan while manual editing is active.
  // Keeping these stable (undefined) otherwise prevents the plan memo from
  // recomputing every time the derived custom arrays are refreshed below.
  const appliedCustomQuantities = isCustomManual ? customQuantities : undefined;
  const appliedCustomIntervals = isCustomManual ? customIntervals : undefined;

  // Calculate plan reactively
  const planResult = useMemo(() => {
    return calculateGrowthPlan({
      service: {
        id: service.id,
        name: service.name,
        minQuantity: service.minQuantity,
        maxQuantity: service.maxQuantity,
        ratePer1000: service.ratePer1000,
        dripFeedSupported: Boolean(service.dripFeedSupported),
        dripFeedMinInterval: service.dripFeedMinInterval ?? 10,
        dripFeedMaxInterval: service.dripFeedMaxInterval ?? 10080,
        restrictions: service.restrictions ?? null,
      },
      targetUrl,
      totalQuantity,
      scheduleMode: isCustomManual ? "CUSTOM" : scheduleMode,
      timingMode: isCustomManual ? "CUSTOM" : "MODE_B",
      stepsCount: stepCount,
      intervalMinutes: defaultInterval,
      totalDurationMinutes: totalDuration,
      seed,
      smoothness,
      spikeIntensity,
      lockedBatches: lockedBatchesArray.length > 0 ? lockedBatchesArray : undefined,
      customStepQuantities:
        appliedCustomQuantities && appliedCustomQuantities.length > 0
          ? appliedCustomQuantities
          : undefined,
      customIntervals:
        appliedCustomIntervals && appliedCustomIntervals.length > 0
          ? appliedCustomIntervals
          : undefined,
      enforceExactAllocation: false,
      allowZeroBatches: true,
    });
  }, [
    service,
    targetUrl,
    totalQuantity,
    scheduleMode,
    stepCount,
    defaultInterval,
    totalDuration,
    seed,
    smoothness,
    spikeIntensity,
    lockedBatchesArray,
    isCustomManual,
    appliedCustomQuantities,
    appliedCustomIntervals,
  ]);

  const effectiveBatchCount = planResult.stepCount || stepCount;

  function getCurrentBatchQuantities(): number[] {
    if (customQuantities.length === effectiveBatchCount) return [...customQuantities];
    return planResult.steps.map((step: ScheduleStepPreview) => step.quantity);
  }

  const commitCustomQuantities = useCallback(
    (quantities: number[]) => {
      const normalized = quantities.map((quantity) =>
        Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0
      );
      setCustomQuantities(normalized);
      setIsCustomManual(true);
      setScheduleMode("CUSTOM");
      const sum = normalized.reduce((a, b) => a + b, 0);
      onTotalQuantityChange?.(sum);
    },
    [onTotalQuantityChange]
  );

  useEffect(() => {
    setIsCustomManual(false);
    setCustomQuantities([]);
    setCustomIntervals([]);
    setLockedBatchesMap({});
  }, [service.id]);

  const onPlanChangeRef = useRef(onPlanChange);
  useEffect(() => {
    onPlanChangeRef.current = onPlanChange;
  }, [onPlanChange]);

  // Sync upstream when plan changes
  useEffect(() => {
    onPlanChangeRef.current?.(planResult);
  }, [planResult]);

  // Sync custom arrays whenever preset or step count changes.
  // Bail out when the derived values are unchanged so this effect can never
  // feed new state back into the plan memo on every render.
  useEffect(() => {
    if (isCustomManual || planResult.steps.length === 0) return;
    const nextQuantities = planResult.steps.map((s: ScheduleStepPreview) => s.quantity);
    const nextIntervals = planResult.steps.map((s: ScheduleStepPreview) => s.intervalMinutesFromPrev);
    setCustomQuantities((prev) => (haveSameNumbers(prev, nextQuantities) ? prev : nextQuantities));
    setCustomIntervals((prev) => (haveSameNumbers(prev, nextIntervals) ? prev : nextIntervals));
  }, [planResult.steps, isCustomManual]);

  // Preset selector
  const handleSelectPreset = (mode: ScheduleMode) => {
    setScheduleMode(mode);
    setIsCustomManual(false);
    setLockedBatchesMap({});
  };

  // Reshuffle seed for fresh organic variance
  const handleReshuffleSeed = () => {
    const nextSeed = Math.floor(Math.random() * 900000) + 10000;
    setSeed(nextSeed);
    setIsCustomManual(false);
  };

  // Toggle lock on a batch
  const handleToggleLockBatch = (index: number) => {
    const currentQtys = getCurrentBatchQuantities();
    const currentQty = currentQtys[index] ?? service.minQuantity;
    setLockedBatchesMap((prev) => {
      const copy = { ...prev };
      if (index in copy) {
        delete copy[index];
      } else {
        copy[index] = currentQty;
      }
      return copy;
    });
  };

  const handleUnlockAll = () => {
    setLockedBatchesMap({});
  };

  // Change individual batch quantity
  const handleBatchQuantityChange = (index: number, newQty: number) => {
    const updated = getCurrentBatchQuantities();
    if (index < 0 || index >= updated.length) return;
    const clamped = Number.isFinite(newQty) ? Math.max(0, Math.floor(newQty)) : 0;
    updated[index] = clamped;
    commitCustomQuantities(updated);
  };

  // Nudge batch quantity with micro-buttons (+50 / -50)
  const handleBatchQuantityNudge = (index: number, delta: number) => {
    const updated = getCurrentBatchQuantities();
    if (index < 0 || index >= updated.length) return;
    const currentVal = updated[index] || 0;
    const nextVal = Math.max(
      0,
      Math.min(service.maxQuantity, currentVal + delta)
    );
    updated[index] = nextVal;
    commitCustomQuantities(updated);
  };

  // Change individual batch interval
  const handleBatchIntervalChange = (index: number, newInterval: number) => {
    const updated = [...customIntervals];
    updated[index] = Math.max(1, Math.floor(newInterval || 1));
    setCustomIntervals(updated);
    setIsCustomManual(true);
    setScheduleMode("CUSTOM");
  };

  // Redistribute unallocated units
  const handleRedistribute = () => {
    const redistributed = redistributeRemaining(
      getCurrentBatchQuantities(),
      totalQuantity,
      service.minQuantity,
      service.maxQuantity
    );
    commitCustomQuantities(redistributed);
  };

  // -------------------------------------------------------------
  // Pointer-based Dragging for Volume Bars with Auto-Redistribution
  // -------------------------------------------------------------
  const handleBarPointerDown = (index: number, e: React.PointerEvent<SVGGElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // fallback
    }
    draggingIdxRef.current = index;
    setDraggingStepIdx(index);
  };

  const handleBarPointerMove = (index: number, e: React.PointerEvent<SVGGElement>) => {
    if (draggingIdxRef.current !== index || !chartSvgRef.current) return;
    const svgRect = chartSvgRef.current.getBoundingClientRect();
    const relativeY = e.clientY - svgRect.top;
    const padT = 30;
    const padB = 40;
    const plotH = Math.max(1, svgRect.height - padT - padB);
    const fraction = Math.max(0.0, Math.min(0.98, 1 - (relativeY - padT) / plotH));

    const currentQtys = getCurrentBatchQuantities();
    const maxQ = Math.max(...currentQtys, service.minQuantity * 2, 100);
    const scaleMax = Math.max(maxQ * 1.35, service.minQuantity * 3);

    const calculatedQty = Math.round((fraction * scaleMax) / 25) * 25;
    // Snap to 0 when near baseline, or clamp within bounds
    const clampedQty = fraction < 0.05 || calculatedQty < Math.round(service.minQuantity / 2)
      ? 0
      : Math.max(service.minQuantity, Math.min(service.maxQuantity, calculatedQty));

    const updated = [...currentQtys];
    updated[index] = clampedQty;

    const newLocked = { ...lockedBatchesMap, [index]: clampedQty };
    setLockedBatchesMap(newLocked);

    const lockedIndices = Object.keys(newLocked).map(Number);
    const lockedSum = lockedIndices.reduce((sum, idx) => sum + (newLocked[idx] || 0), 0);
    const remainingToDistribute = totalQuantity - lockedSum;

    const unlockedIndices = updated
      .map((_, i) => i)
      .filter((i) => !lockedIndices.includes(i));

    if (unlockedIndices.length > 0 && remainingToDistribute > 0) {
      const currentUnlockedSum = unlockedIndices.reduce((sum, i) => sum + updated[i], 0);
      let assignedSum = 0;
      unlockedIndices.forEach((i, pos) => {
        if (pos === unlockedIndices.length - 1) {
          updated[i] = Math.max(service.minQuantity, remainingToDistribute - assignedSum);
        } else {
          const ratio = currentUnlockedSum > 0 ? updated[i] / currentUnlockedSum : 1 / unlockedIndices.length;
          const share = Math.max(service.minQuantity, Math.floor(ratio * remainingToDistribute));
          updated[i] = share;
          assignedSum += share;
        }
      });
    }

    commitCustomQuantities(updated);
  };

  const handleBarPointerUp = (index: number, e: React.PointerEvent<SVGGElement>) => {
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    draggingIdxRef.current = null;
    setDraggingStepIdx(null);
  };

  // Derived values for chart plotting
  const steps = planResult.steps;
  const currentQtys = getCurrentBatchQuantities();
  const sumAssigned = currentQtys.reduce((a, b) => a + b, 0);
  const unallocated = totalQuantity - sumAssigned;
  const isFullyAllocated = unallocated === 0;

  const editableBatches = currentQtys.map((quantity, index) => ({
    quantity,
    step: steps[index],
    index,
    isLocked: index in lockedBatchesMap,
  }));

  const organicPresets = Object.values(ORGANIC_PRESET_DEFINITIONS);

  const formatDurationDisplay = (mins: number) => {
    if (mins < 1) return "< 1 min";
    if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"}`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return `${h} hr${h === 1 ? "" : "s"}`;
    return `${h} hr${h === 1 ? "" : "s"} ${m} min${m === 1 ? "" : "s"} (${mins}m)`;
  };

  return (
    <div
      className={`bg-white rounded-2xl border border-[#DEE0ED] p-5 shadow-subtle space-y-6 text-xs text-[#252943] ${className}`}
    >
      {/* ── TOP HEADER & ALLOCATION STATUS ────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DEE0ED]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#3A4EFB]/10 text-[#3A4EFB] flex items-center justify-center">
            <BarChart2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#252943]">
              Plan your batches
            </h3>
            <p className="text-[11px] text-[#252943]/60">
              Choose how many batches to send and how to spread them across the delivery window.
            </p>
          </div>
        </div>

        {/* Allocation Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isFullyAllocated ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              All {totalQuantity.toLocaleString()} units assigned
            </span>
          ) : unallocated > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                {unallocated.toLocaleString()} units left to assign
              </span>
              <button
                type="button"
                onClick={handleRedistribute}
                className="px-2.5 py-1 rounded-lg bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-[11px] font-semibold transition-all press-scale flex items-center gap-1"
                title="Evenly distribute remaining units across batches"
              >
                  <RefreshCw className="w-3 h-3" /> Auto-fill
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                  {Math.abs(unallocated).toLocaleString()} units over target
              </span>
              <button
                type="button"
                onClick={handleRedistribute}
                className="px-2.5 py-1 rounded-lg bg-[#252943] hover:bg-[#1A1D31] text-white text-[11px] font-semibold transition-all press-scale"
              >
                  Balance batches
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 1. SCHEDULING CALCULATION (BATCHES & REPEAT INTERVAL) ────────────────────────── */}
      <div className="p-4 bg-[#F8F9FD] rounded-2xl border border-[#DEE0ED] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#3A4EFB]/10 text-[#3A4EFB] flex items-center justify-center">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#252943]">
                Scheduling Calculation (Batches & Repeat Interval)
              </h4>
            </div>
            <p className="text-[11px] text-[#252943]/60 mt-0.5">
              Set how many batches and how often they repeat. Total delivery window is auto-calculated (<strong className="text-[#252943]">Batches × Repeat Interval</strong>).
            </p>
          </div>

          {/* Auto-Calculated Total Delivery Window Highlight Badge */}
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white border border-[#DEE0ED] shadow-xs self-start sm:self-auto">
            <Calendar className="w-4 h-4 text-[#3A4EFB] shrink-0" />
            <div>
              <span className="text-[10px] text-[#252943]/60 uppercase font-semibold block leading-tight">
                Total Delivery Window
              </span>
              <span className="text-xs font-bold text-[#3A4EFB] font-mono">
                {formatDurationDisplay(totalDeliveryWindow)}
              </span>
            </div>
          </div>
        </div>

        {/* Input Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          {/* 1. Batch Count */}
          <div className="sm:col-span-4 bg-white p-3.5 rounded-xl border border-[#DEE0ED]/80 space-y-1.5 flex flex-col justify-between">
            <div>
              <label className="text-[11px] font-bold text-[#252943] block mb-1">
                1. Number of Batches
              </label>
              <select
                value={stepCount}
                onChange={(e) => {
                  const count = parseInt(e.target.value, 10);
                  setStepCount(count);
                  setIsCustomManual(false);
                }}
                className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-lg px-2.5 py-1.5 text-xs text-[#252943] font-semibold focus:border-[#3A4EFB] focus:bg-white transition-colors"
              >
                {[2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30].map((n) => (
                  <option key={n} value={n}>
                    {n} Batches
                  </option>
                ))}
              </select>
            </div>
            <span className="text-[10px] text-[#252943]/50 block">
              Total quantity will be split into {stepCount} scheduled runs.
            </span>
          </div>

          {/* 2. Repeat Interval */}
          <div className="sm:col-span-8 bg-white p-3.5 rounded-xl border border-[#DEE0ED]/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-[#252943]">
                2. Repeat Interval
              </label>
              <span className="text-[10px] font-mono text-[#3A4EFB] font-bold bg-[#3A4EFB]/10 px-2 py-0.5 rounded-md">
                Every {defaultInterval} min{defaultInterval === 1 ? "" : "s"}
              </span>
            </div>

            {/* Quick Preset Buttons + Custom Input */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[1, 3, 5, 10, 15, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    setDefaultInterval(mins);
                    setIsCustomManual(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all press-scale ${
                    defaultInterval === mins && !isCustomManual
                      ? "bg-[#3A4EFB] text-white shadow-xs"
                      : "bg-[#F8F9FD] border border-[#DEE0ED] text-[#252943]/70 hover:bg-[#DEE0ED]/40"
                  }`}
                >
                  {mins === 1 ? "1 min" : `${mins} mins`}
                </button>
              ))}

              {/* Direct Custom Minutes Input */}
              <div className="flex items-center gap-1 sm:ml-auto">
                <span className="text-[10px] text-[#252943]/60 font-semibold">Custom:</span>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={defaultInterval}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                    setDefaultInterval(val);
                    setIsCustomManual(false);
                  }}
                  className="w-16 bg-[#F8F9FD] border border-[#DEE0ED] rounded-lg px-2 py-1 text-xs text-[#252943] font-mono text-center font-bold focus:border-[#3A4EFB] focus:bg-white"
                />
                <span className="text-[10px] text-[#252943]/60 font-medium">mins</span>
              </div>
            </div>

            {/* Auto-Calculated Formula Explanation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-2 border-t border-[#DEE0ED]/60 text-[10.5px] text-[#252943]/70">
              <div>
                Formula: <strong className="text-[#252943]">{stepCount} batches × every {defaultInterval}m</strong> = <strong className="text-[#3A4EFB]">{totalDeliveryWindow} mins total delivery window</strong>
              </div>
              <div className="font-semibold text-emerald-700 flex items-center gap-1">
                <span>Delivery complete:</span>
                <span className="font-mono">{new Date(Date.now() + totalDeliveryWindow * 60 * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. ORGANIC GROWTH SHAPES & SEED CONTROLS ────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#252943] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
            Choose a delivery pattern
          </label>

          {/* Seed Reshuffle & Locks status */}
          <div className="flex items-center gap-2">
            {Object.keys(lockedBatchesMap).length > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                <Lock className="w-3 h-3 text-amber-600" />
                <span>{Object.keys(lockedBatchesMap).length} locked</span>
                <button
                  type="button"
                  onClick={handleUnlockAll}
                  className="ml-1 text-[10px] font-bold underline hover:text-amber-900"
                >
                  Reset
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleReshuffleSeed}
              className="px-2.5 py-1 rounded-lg bg-[#FAF5FF] hover:bg-[#F3E8FF] border border-[#D8B4FE] text-[#6D28D9] text-[11px] font-semibold transition-all press-scale flex items-center gap-1"
              title="Generate another version of this delivery pattern"
            >
              <Dices className="w-3.5 h-3.5 text-[#7C3AED]" />
              Try another version
            </button>
          </div>
        </div>

        {/* 10 ORGANIC PRESET CARDS WITH MINI SPARKLINES */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {organicPresets.map((preset) => {
            const isSelected = !isCustomManual && scheduleMode === preset.id;
            const sparklinePath = generatePresetSparklinePath(preset.id, 68, 26);

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id)}
                className={`p-2.5 rounded-xl text-left border transition-all relative flex flex-col justify-between overflow-hidden press-scale ${
                  isSelected
                    ? "border-[#A855F7] bg-[#FAF5FF] text-[#581C87] shadow-sm ring-1 ring-[#A855F7]"
                    : "border-[#DEE0ED] bg-[#F8F9FD] text-[#252943]/75 hover:bg-[#FAF5FF]/50 hover:border-[#D8B4FE]"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs truncate text-[#1E1B4B]">
                      {preset.name}
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[#9333EA] shrink-0" />
                    )}
                  </div>
                  <div className="text-[10px] font-medium text-[#7C3AED] truncate">
                    {preset.tag}
                  </div>
                </div>

                {/* Sparkline Thumbnail */}
                <div className="py-1.5 flex items-center justify-center">
                  <svg width="68" height="26" className="overflow-visible">
                    <path
                      d={sparklinePath}
                      fill="none"
                      stroke={isSelected ? "#9333EA" : "#8B5CF6"}
                      strokeWidth={isSelected ? "2.2" : "1.6"}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                {/* Description */}
                <div className="pt-1 border-t border-[#E9D5FF]/60 text-[9.5px] text-[#475569] leading-tight line-clamp-2">
                  {preset.description}
                </div>
              </button>
            );
          })}
        </div>

        {/* Smoothness & Spike Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-[#FAF5FF] rounded-xl border border-[#E9D5FF]/60">
          <div>
            <div className="flex items-center justify-between text-[11px] font-medium text-[#581C87] mb-1">
              <span title="Controls how much batch sizes vary around the selected pattern">Batch size variation</span>
              <span className="font-bold text-[#7C3AED]">{smoothness}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={smoothness}
              onChange={(e) => setSmoothness(parseInt(e.target.value, 10))}
              className="w-full accent-[#7C3AED] h-1.5 bg-[#E9D5FF] rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-[#6B21A8] mt-0.5">
              <span>More varied</span>
              <span>More even</span>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#581C87] block mb-1">
              Larger batches
            </label>
            <div className="grid grid-cols-4 gap-1">
              {(["off", "low", "medium", "high"] as SpikeIntensity[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setSpikeIntensity(level)}
                  className={`py-1 text-[10px] font-semibold rounded-lg uppercase transition-all ${
                    spikeIntensity === level
                      ? "bg-[#7C3AED] text-white shadow-xs"
                      : "bg-white border border-[#D8B4FE] text-[#581C87] hover:bg-[#F3E8FF]"
                  }`}
                >
                  {level === "off" ? "None" : level}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Validation Alert */}
      {!planResult.valid && planResult.errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>Invalid Delivery Schedule</span>
          </div>
          <p className="text-[11px] leading-relaxed">{planResult.errorMessage}</p>
        </div>
      )}

      {/* ── 3. LIVE REACTIVE GRAPHS CANVAS CARD ────────────────────────── */}
      <div className="relative min-w-0 bg-[#0B0A16] border border-[#231E3D] rounded-3xl p-4 sm:p-6 select-none shadow-2xl overflow-hidden text-white">
        {/* Top Header & Graph View Tabs */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] items-start gap-4 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                Delivery schedule graph
              </h3>
              <span className="max-w-[40%] truncate px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#2A1B4E] text-[#D8B4FE] border border-[#581C87]">
                {scheduleMode in ORGANIC_PRESET_DEFINITIONS
                  ? ORGANIC_PRESET_DEFINITIONS[scheduleMode as OrganicPresetId].name
                  : scheduleMode}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#B6AFCB] mt-1">
              {activeGraphTab === "volume" && "Each bar is one batch. Bar height shows its quantity; drag a bar to change it."}
              {activeGraphTab === "cumulative" && "The line adds each batch to show the running total across the delivery window."}
              {activeGraphTab === "rate" && "Compare the planned delivery rate with estimated audience activity over time."}
              {activeGraphTab === "actual" && "See the quantity and current status of each batch."}
            </p>
          </div>

          {/* View Tabs */}
          <div role="group" aria-label="Choose chart view" className="grid grid-cols-2 sm:grid-cols-4 xl:flex xl:flex-wrap items-stretch gap-1.5 bg-[#140F26] p-1 rounded-xl border border-[#231E3D]">
            {[
              { id: "volume", label: "Batch sizes", icon: BarChart3 },
              { id: "cumulative", label: "Running total", icon: TrendingUp },
              { id: "rate", label: "Audience & Rate", icon: Activity },
              { id: "actual", label: "Batch status", icon: Layers },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeGraphTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveGraphTab(tab.id as GraphTab)}
                  className={`min-w-0 justify-center px-2.5 py-2 xl:py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                    isActive
                      ? "bg-[#6D28D9] text-white shadow-[0_0_12px_rgba(168,85,247,0.45)]"
                      : "text-[#A697D0] hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[10px] text-[#B6AFCB]">
          <span><strong className="text-white">Horizontal:</strong> {activeGraphTab === "volume" || activeGraphTab === "actual" ? "batch number" : "time"}</span>
          <span><strong className="text-white">Vertical:</strong> {activeGraphTab === "volume" || activeGraphTab === "actual" ? "units per batch" : activeGraphTab === "cumulative" ? "total units" : "units per hour"}</span>
          {activeGraphTab === "volume" && <span><strong className="text-white">Purple line:</strong> cumulative share of target</span>}
          {activeGraphTab === "rate" && <span><strong className="text-white">Blue line:</strong> planned delivery rate · shaded area: audience activity</span>}
          {activeGraphTab === "actual" && <span><strong className="text-white">Colors:</strong> batch delivery status</span>}
        </div>

        {/* Canvas SVG Area */}
        {(() => {
          const pW = 680;
          const pH = 250;
          const padL = 52;
          const padR = 48;
          const padT = 30;
          const padB = 38;
          const plotW = pW - padL - padR;
          const plotH = pH - padT - padB;

          const count = currentQtys.length;
          const maxQ = Math.max(...currentQtys, service.minQuantity * 2, 100);
          const scaleMax = Math.max(maxQ * 1.3, service.minQuantity * 3);

          let cumulativeRunning = 0;
          const cumulativeValues = currentQtys.map((qty) => {
            cumulativeRunning += qty;
            return cumulativeRunning;
          });
          const targetTotal = Math.max(totalQuantity, cumulativeRunning, 1);

          let elapsedSum = 0;
          const batchElapsedMins = currentQtys.map((_, idx) => {
            const stepInterval =
              idx === 0
                ? 0
                : steps[idx]?.intervalMinutesFromPrev ??
                  customIntervals[idx] ??
                  defaultInterval;
            elapsedSum += stepInterval;
            return elapsedSum;
          });
          const totalElapsedWindow = Math.max(1, elapsedSum);

          // 1. VOLUME BARS + CUMULATIVE LINE VIEW
          const renderVolumeView = () => {
            const barSlotWidth = plotW / Math.max(1, count);
            const barWidth = Math.max(14, Math.min(42, barSlotWidth * 0.58));

            const linePoints = currentQtys.map((_, idx) => {
              const cx = padL + (idx + 0.5) * barSlotWidth;
              const cumRatio = cumulativeValues[idx] / targetTotal;
              const cy = padT + plotH - cumRatio * plotH;
              return { x: cx, y: cy };
            });

            return (
              <g>
                {[1, 0.75, 0.5, 0.25, 0].map((frac) => {
                  const gy = padT + plotH - frac * plotH;
                  return (
                    <g key={frac}>
                      {frac > 0 && frac < 1 && (
                        <line
                          x1={padL}
                          y1={gy}
                          x2={pW - padR}
                          y2={gy}
                          stroke="#1C1838"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                      )}
                      <text
                        x={padL - 8}
                        y={gy + 3.5}
                        fontSize="9.5"
                        fontWeight="600"
                        textAnchor="end"
                        fill="#7C6E9B"
                      >
                        {Math.round(frac * scaleMax).toLocaleString()}
                      </text>
                      <text
                        x={pW - padR + 8}
                        y={gy + 3.5}
                        fontSize="9.5"
                        fontWeight="600"
                        textAnchor="start"
                        fill="#9333EA"
                      >
                        {Math.round(frac * 100)}%
                      </text>
                    </g>
                  );
                })}

                {currentQtys.map((qty, idx) => {
                  const cx = padL + (idx + 0.5) * barSlotWidth;
                  const barX = cx - barWidth / 2;
                  const isZero = qty === 0;
                  const ratio = isZero ? 0.015 : Math.max(0.04, Math.min(0.97, qty / scaleMax));
                  const barH = isZero ? 3.5 : ratio * plotH;
                  const barY = padT + plotH - barH;
                  const isLocked = idx in lockedBatchesMap;
                  const isDragging = draggingStepIdx === idx;

                  return (
                    <g
                      key={idx}
                      onPointerDown={(e) => handleBarPointerDown(idx, e)}
                      onPointerMove={(e) => handleBarPointerMove(idx, e)}
                      onPointerUp={(e) => handleBarPointerUp(idx, e)}
                      onPointerCancel={(e) => handleBarPointerUp(idx, e)}
                      onLostPointerCapture={(e) => handleBarPointerUp(idx, e)}
                      onClick={() => handleToggleLockBatch(idx)}
                      className="cursor-ns-resize touch-none select-none"
                    >
                      <rect
                        x={barX - 8}
                        y={padT}
                        width={barWidth + 16}
                        height={plotH + 20}
                        fill="transparent"
                        pointerEvents="all"
                      />

                      <rect
                        x={barX}
                        y={barY}
                        width={barWidth}
                        height={barH}
                        rx={isZero ? "1.5" : "5"}
                        fill={isZero ? "#2E234D" : isLocked ? "url(#lockedBarGrad)" : "url(#barGrad)"}
                        opacity={isZero ? 0.6 : 1}
                        stroke={isDragging ? "#F3E8FF" : isLocked ? "#38BDF8" : isZero ? "#4C3875" : "#A855F7"}
                        strokeWidth={isDragging ? "2" : "1"}
                        className="transition-colors"
                      />

                      {!isZero && (
                        <rect
                          x={barX + 2}
                          y={barY - 3}
                          width={barWidth - 4}
                          height={6}
                          rx="3"
                          fill={isDragging ? "#FFFFFF" : isLocked ? "#7DD3FC" : "#E9D5FF"}
                        />
                      )}

                      <text
                        x={cx}
                        y={barY - 9}
                        fontSize="9.5"
                        fontWeight="700"
                        textAnchor="middle"
                        fill={isZero ? "#8E84B8" : isLocked ? "#38BDF8" : "#EDE9FE"}
                      >
                        {qty.toLocaleString()}
                      </text>

                      <text
                        x={cx}
                        y={padT + plotH + 16}
                        fontSize="9.5"
                        fontWeight="600"
                        textAnchor="middle"
                        fill="#8E84B8"
                      >
                        #{idx + 1}
                      </text>
                      {isLocked && (
                        <circle
                          cx={cx}
                          cy={padT + plotH + 26}
                          r="3"
                          fill="#38BDF8"
                        >
                          <title>Locked batch</title>
                        </circle>
                      )}
                    </g>
                  );
                })}

                {linePoints.length >= 2 && (
                  <>
                    <polyline
                      points={linePoints.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill="none"
                      stroke="#C084FC"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="url(#neonGlow)"
                    />
                    {linePoints.map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r="4"
                        fill="#FAF5FF"
                        stroke="#9333EA"
                        strokeWidth="2"
                      />
                    ))}
                  </>
                )}
              </g>
            );
          };

          // 2. CUMULATIVE S-CURVE VIEW
          const renderCumulativeView = () => {
            const pts = currentQtys.map((_, idx) => {
              const elapsed = batchElapsedMins[idx];
              const x = padL + (elapsed / totalElapsedWindow) * plotW;
              const cumRatio = cumulativeValues[idx] / targetTotal;
              const y = padT + plotH - cumRatio * plotH;
              return { x, y, elapsed, cumVal: cumulativeValues[idx] };
            });

            let d = `M ${padL},${padT + plotH}`;
            if (pts.length > 0) {
              d += ` L ${pts[0].x},${pts[0].y}`;
              for (let i = 1; i < pts.length; i++) {
                const prev = pts[i - 1];
                const curr = pts[i];
                const cpx1 = prev.x + (curr.x - prev.x) * 0.45;
                const cpy1 = prev.y;
                const cpx2 = prev.x + (curr.x - prev.x) * 0.55;
                const cpy2 = curr.y;
                d += ` C ${cpx1},${cpy1} ${cpx2},${cpy2} ${curr.x},${curr.y}`;
              }
            }

            const areaPath = `${d} L ${pts[pts.length - 1]?.x ?? padL},${padT + plotH} Z`;

            return (
              <g>
                {[1, 0.75, 0.5, 0.25, 0].map((frac) => {
                  const gy = padT + plotH - frac * plotH;
                  return (
                    <g key={frac}>
                      {frac > 0 && frac < 1 && (
                        <line
                          x1={padL}
                          y1={gy}
                          x2={pW - padR}
                          y2={gy}
                          stroke="#1C1838"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                      )}
                      <text
                        x={padL - 8}
                        y={gy + 3.5}
                        fontSize="9.5"
                        fontWeight="600"
                        textAnchor="end"
                        fill="#7C6E9B"
                      >
                        {Math.round(frac * targetTotal).toLocaleString()}
                      </text>
                      <text
                        x={pW - padR + 8}
                        y={gy + 3.5}
                        fontSize="9.5"
                        fontWeight="600"
                        textAnchor="start"
                        fill="#A855F7"
                      >
                        {Math.round(frac * 100)}%
                      </text>
                    </g>
                  );
                })}

                {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
                  const gx = padL + frac * plotW;
                  const mins = Math.round(frac * totalElapsedWindow);
                  const label = mins >= 60 ? `${(mins / 60).toFixed(1)}h` : `${mins}m`;
                  return (
                    <text
                      key={frac}
                      x={gx}
                      y={padT + plotH + 18}
                      fontSize="9.5"
                      fontWeight="600"
                      textAnchor="middle"
                      fill="#7C6E9B"
                    >
                      {label}
                    </text>
                  );
                })}

                <path d={areaPath} fill="url(#cumAreaGrad)" />

                <path
                  d={d}
                  fill="none"
                  stroke="#C084FC"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#neonGlow)"
                />

                {pts.map((p, idx) => (
                  <g key={idx}>
                    <circle cx={p.x} cy={p.y} r="4.5" fill="#FAF5FF" stroke="#7C3AED" strokeWidth="2" />
                  </g>
                ))}
              </g>
            );
          };

          // 3. AUDIENCE & DELIVERY RATE VIEW
          const renderRateView = () => {
            const rates = currentQtys.map((qty, idx) => {
              const intervalMins =
                idx === 0
                  ? defaultInterval
                  : steps[idx]?.intervalMinutesFromPrev ??
                    customIntervals[idx] ??
                    defaultInterval;
              return (qty / Math.max(1, intervalMins)) * 60;
            });
            const maxRate = Math.max(...rates, 100);
            const scaleMaxRate = maxRate * 1.35;

            const sampleSteps = 24;
            const circadianPts: { x: number; y: number }[] = [];
            for (let i = 0; i <= sampleSteps; i++) {
              const t = i / sampleSteps;
              const cx = padL + t * plotW;
              const act = audienceCircadianActivity(t);
              const cy = padT + plotH - act * plotH;
              circadianPts.push({ x: cx, y: cy });
            }
            let circadianPath = `M ${padL},${padT + plotH}`;
            circadianPts.forEach((p) => {
              circadianPath += ` L ${p.x},${p.y}`;
            });
            circadianPath += ` L ${padL + plotW},${padT + plotH} Z`;

            const ratePts = rates.map((rate, idx) => {
              const cx = padL + (batchElapsedMins[idx] / totalElapsedWindow) * plotW;
              const cy = padT + plotH - (rate / scaleMaxRate) * plotH;
              return { x: cx, y: cy, rate };
            });

            return (
              <g>
                <path d={circadianPath} fill="url(#circadianGrad)" opacity="0.45" />

                {[1, 0.75, 0.5, 0.25, 0].map((frac) => {
                  const gy = padT + plotH - frac * plotH;
                  return (
                    <g key={frac}>
                      {frac > 0 && frac < 1 && (
                        <line
                          x1={padL}
                          y1={gy}
                          x2={pW - padR}
                          y2={gy}
                          stroke="#1C1838"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                      )}
                      <text
                        x={padL - 8}
                        y={gy + 3.5}
                        fontSize="9.5"
                        fontWeight="600"
                        textAnchor="end"
                        fill="#7C6E9B"
                      >
                        {Math.round(frac * scaleMaxRate).toLocaleString()}
                      </text>
                    </g>
                  );
                })}

                <text
                  x={padL + plotW - 6}
                  y={padT + 14}
                  fontSize="9.5"
                  fontWeight="600"
                  textAnchor="end"
                  fill="#818CF8"
                >
                  Audience Primetime Curve (Band)
                </text>

                {ratePts.length >= 2 && (
                  <polyline
                    points={ratePts.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {ratePts.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r="4"
                    fill="#E0F2FE"
                    stroke="#0284C7"
                    strokeWidth="2"
                  />
                ))}
              </g>
            );
          };

          // 4. PLANNED VS ACTUAL STATUS VIEW
          const renderActualView = () => {
            const barSlotWidth = plotW / Math.max(1, count);
            const barWidth = Math.max(12, Math.min(38, barSlotWidth * 0.55));

            return (
              <g>
                {[1, 0.75, 0.5, 0.25, 0].map((frac) => {
                  const gy = padT + plotH - frac * plotH;
                  return (
                    <g key={frac}>
                      {frac > 0 && frac < 1 && (
                        <line
                          x1={padL}
                          y1={gy}
                          x2={pW - padR}
                          y2={gy}
                          stroke="#1C1838"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                      )}
                      <text
                        x={padL - 8}
                        y={gy + 3.5}
                        fontSize="9.5"
                        fontWeight="600"
                        textAnchor="end"
                        fill="#7C6E9B"
                      >
                        {Math.round(frac * scaleMax).toLocaleString()}
                      </text>
                    </g>
                  );
                })}

                {currentQtys.map((qty, idx) => {
                  const cx = padL + (idx + 0.5) * barSlotWidth;
                  const barX = cx - barWidth / 2;
                  const ratio = Math.max(0.04, Math.min(0.96, qty / scaleMax));
                  const barH = ratio * plotH;
                  const barY = padT + plotH - barH;

                  let color = "#3B82F6";
                  let label = "PENDING";
                  if (idx === 0) {
                    color = "#10B981";
                    label = "SENT";
                  } else if (idx === 1) {
                    color = "#38BDF8";
                    label = "NEXT";
                  }

                  return (
                    <g key={idx}>
                      <rect
                        x={barX}
                        y={barY}
                        width={barWidth}
                        height={barH}
                        rx="4"
                        fill={color}
                        opacity="0.85"
                      />
                      <text
                        x={cx}
                        y={barY - 8}
                        fontSize="9"
                        fontWeight="700"
                        textAnchor="middle"
                        fill={color}
                      >
                        {label}
                      </text>
                      <text
                        x={cx}
                        y={padT + plotH + 16}
                        fontSize="9.5"
                        fontWeight="600"
                        textAnchor="middle"
                        fill="#8E84B8"
                      >
                        #{idx + 1}
                      </text>
                    </g>
                  );
                })}

                <line
                  x1={padL}
                  y1={padT + plotH}
                  x2={padL + barSlotWidth}
                  y2={padT + plotH - (currentQtys[0] / scaleMax) * plotH}
                  stroke="#10B981"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </g>
            );
          };

          return (
            <div className="relative overflow-x-auto rounded-xl border border-[#231E3D] bg-[#080712]">
              <svg
                ref={chartSvgRef}
                viewBox={`0 0 ${pW} ${pH}`}
                className="block w-full min-w-[680px] max-w-[1000px] mx-auto overflow-visible select-none"
                style={{ height: "auto" }}
              >
                <defs>
                  <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="4.5" floodColor="#A855F7" floodOpacity="0.85" />
                  </filter>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C084FC" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#6D28D9" stopOpacity="0.5" />
                  </linearGradient>
                  <linearGradient id="lockedBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#0284C7" stopOpacity="0.6" />
                  </linearGradient>
                  <linearGradient id="cumAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#A855F7" stopOpacity="0.38" />
                    <stop offset="80%" stopColor="#6D28D9" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#0B0A16" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="circadianGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818CF8" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#312E81" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#231E3D" strokeWidth="1.5" />
                <line x1={padL} y1={padT + plotH} x2={pW - padR} y2={padT + plotH} stroke="#231E3D" strokeWidth="1.5" />

                {activeGraphTab === "volume" && renderVolumeView()}
                {activeGraphTab === "cumulative" && renderCumulativeView()}
                {activeGraphTab === "rate" && renderRateView()}
                {activeGraphTab === "actual" && renderActualView()}
              </svg>

              {/* Chart Footer Stats */}
              <div className="flex flex-wrap items-center justify-between gap-3 mt-2 pt-3 border-t border-[#1C1736] text-[11px] text-[#8E84B8]">
                <div className="flex items-center gap-4">
                  <div>
                    Batches: <span className="text-white font-bold">{count}</span>
                  </div>
                  <div>
                    Window:{" "}
                    <span className="text-white font-bold">
                      {formatDurationDisplay(totalElapsedWindow)}
                    </span>
                  </div>
                  <div>
                    Quantity assigned:{" "}
                    <span className="text-white font-bold">
                      {sumAssigned.toLocaleString()}
                    </span>{" "}
                    / {totalQuantity.toLocaleString()}
                  </div>
                </div>

                {activeGraphTab === "actual" && (
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Sent
                    </span>
                    <span className="flex items-center gap-1 text-blue-400">
                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Pending
                    </span>
                    <span className="flex items-center gap-1 text-amber-400">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Delayed
                    </span>
                    <span className="flex items-center gap-1 text-red-400">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Failed
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── 4. ACCESSIBLE PER-BATCH NUMERIC INPUTS (MAIN FOCUS #2) ────────────────────────── */}
      <div className="space-y-3">
        {/* Collapsible Trigger / Header */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#3A4EFB]/10 text-[#3A4EFB] flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-[#252943]">
                  Edit batch quantities and times
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#3A4EFB]/10 text-[#3A4EFB]">
                  {editableBatches.length} Batches
                </span>
                {Object.keys(lockedBatchesMap).length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    {Object.keys(lockedBatchesMap).length} Locked
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#252943]/60">
                Direct numeric control over every individual batch quantity, timing offset, and locking.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {Object.keys(lockedBatchesMap).length > 0 && (
              <button
                type="button"
                onClick={handleUnlockAll}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
              >
                Unlock All
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowBatchList(!showBatchList)}
              className="p-1.5 rounded-lg bg-white border border-[#DEE0ED] text-[#252943]/70 hover:text-[#252943] transition-colors"
              aria-label="Toggle batch table"
            >
              {showBatchList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Polished Data Table */}
        {showBatchList && (
          <div className="p-4 bg-[#F8F9FD] rounded-2xl border border-[#DEE0ED] space-y-3 animate-fadeIn">
            {/* Table Column Headers */}
            <div className="grid grid-cols-12 gap-3 text-[10px] font-bold uppercase tracking-wider text-[#252943]/60 px-3 pb-2 border-b border-[#DEE0ED]">
              <div className="col-span-3 sm:col-span-2">Batch #</div>
              <div className="col-span-3 sm:col-span-3">Timing Offset</div>
              <div className="col-span-4 sm:col-span-4 text-center sm:text-left">Quantity & Stepper</div>
              <div className="hidden sm:block col-span-2 text-right">Cost</div>
              <div className="col-span-2 sm:col-span-1 text-center">Lock</div>
            </div>

            {/* Batch Rows */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {editableBatches.map(({ quantity, step, index: idx, isLocked }) => {
                const percentOfTotal = totalQuantity > 0 ? Math.round((quantity / totalQuantity) * 100) : 0;
                const batchCost = ((quantity / 1000) * service.ratePer1000).toFixed(2);
                const elapsedMin = idx === 0 ? 0 : (step?.elapsedMinutes ?? (idx * defaultInterval));

                return (
                  <div
                    key={step?.stepNumber ?? idx + 1}
                    className={`grid grid-cols-12 gap-3 items-center p-2.5 rounded-xl border text-xs transition-all ${
                      isLocked
                        ? "bg-[#F0F9FF] border-[#BAE6FD] shadow-xs"
                        : "bg-white border-[#DEE0ED]/70 hover:border-[#3A4EFB]/40 hover:shadow-xs"
                    }`}
                  >
                    {/* 1. Batch Sequence & Timeline Label */}
                    <div className="col-span-3 sm:col-span-2">
                      <div className="font-bold text-[#252943] flex items-center gap-1.5">
                        <span>Batch #{idx + 1}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#252943]/50 block">
                        t = {elapsedMin}m
                      </span>
                    </div>

                    {/* 2. Interval Offset Input */}
                    <div className="col-span-3 sm:col-span-3">
                      {idx === 0 ? (
                        <div className="inline-flex items-center px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
                          Immediate Start (t=0)
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-[#252943]/40 text-xs font-mono">+</span>
                          <input
                            type="number"
                            min={1}
                            max={service.dripFeedMaxInterval || 10080}
                            step={1}
                            value={customIntervals[idx] ?? step?.intervalMinutesFromPrev ?? defaultInterval}
                            onChange={(e) =>
                              handleBatchIntervalChange(idx, parseInt(e.target.value, 10))
                            }
                            className="w-16 sm:w-20 bg-white border border-[#DEE0ED] rounded-lg px-2 py-1 text-xs text-[#252943] font-mono tabular-nums focus:border-[#3A4EFB] focus:ring-1 focus:ring-[#3A4EFB]"
                          />
                          <span className="text-[11px] text-[#252943]/60 font-medium">mins</span>
                        </div>
                      )}
                    </div>

                    {/* 3. Quantity Controls with Tactile Nudge Buttons (-50 / +50) */}
                    <div className="col-span-4 sm:col-span-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleBatchQuantityNudge(idx, -50)}
                          disabled={quantity <= 0}
                          className="w-6 h-6 rounded-md bg-[#F4F5FB] hover:bg-[#DEE0ED] text-[#252943] flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed press-scale shrink-0"
                          title="Decrease by 50 units (down to 0 for rest batch)"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        <input
                          type="number"
                          min={0}
                          max={service.maxQuantity}
                          step={50}
                          value={quantity}
                          onChange={(e) =>
                            handleBatchQuantityChange(idx, parseInt(e.target.value, 10))
                          }
                          className="w-full bg-white border border-[#DEE0ED] rounded-lg px-2 py-1 text-xs text-right font-bold text-[#252943] font-mono tabular-nums focus:border-[#3A4EFB] focus:ring-1 focus:ring-[#3A4EFB]"
                        />

                        <button
                          type="button"
                          onClick={() => handleBatchQuantityNudge(idx, 50)}
                          disabled={quantity >= service.maxQuantity}
                          className="w-6 h-6 rounded-md bg-[#F4F5FB] hover:bg-[#DEE0ED] text-[#252943] flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed press-scale shrink-0"
                          title="Increase by 50 units"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Mini Percentage Bar */}
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="flex-1 h-1 rounded-full bg-[#DEE0ED] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isLocked ? "bg-[#0284C7]" : "bg-[#7C3AED]"
                            }`}
                            style={{ width: `${Math.min(100, percentOfTotal)}%` }}
                          />
                        </div>
                        <span className="text-[9.5px] font-mono text-[#252943]/60 shrink-0">
                          {percentOfTotal}%
                        </span>
                      </div>
                    </div>

                    {/* 4. Cost */}
                    <div className="hidden sm:block col-span-2 text-right">
                      <div className="font-bold text-[#3A4EFB] font-mono text-xs">
                        ₹{batchCost}
                      </div>
                      <span className="text-[9.5px] text-[#252943]/50">est. fee</span>
                    </div>

                    {/* 5. Tactile Lock Toggle */}
                    <div className="col-span-2 sm:col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleLockBatch(idx)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all press-scale ${
                          isLocked
                            ? "bg-[#0284C7] text-white shadow-xs"
                            : "bg-[#F4F5FB] text-[#64748B] hover:text-[#252943] hover:bg-[#DEE0ED]"
                        }`}
                        title={
                          isLocked
                            ? "Batch is locked (keeps fixed size while other batches adjust)"
                            : "Batch floats (adjusts automatically with curve)"
                        }
                      >
                        {isLocked ? (
                          <>
                            <Lock className="w-3 h-3" />
                            <span className="hidden sm:inline">Locked</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="w-3 h-3" />
                            <span className="hidden sm:inline">Float</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Allocation Meter & Actions */}
            <div className="pt-3 border-t border-[#DEE0ED] space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <span className="text-[#252943]/60">Total Batch Sum:</span>
                  <span
                    className={
                      isFullyAllocated
                        ? "text-emerald-700 font-bold"
                        : "text-amber-800 font-bold"
                    }
                  >
                    {sumAssigned.toLocaleString()} / {totalQuantity.toLocaleString()} units
                  </span>
                  {isFullyAllocated && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Balanced
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#252943]/60">
                    Total Estimated Cost:
                  </span>
                  <span className="text-sm font-bold text-[#3A4EFB] font-mono">
                    ₹{planResult.totalCost.toFixed(4)}
                  </span>
                </div>
              </div>

              {/* Visual Balance Progress Meter */}
              <div className="w-full h-1.5 rounded-full bg-[#DEE0ED] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isFullyAllocated
                      ? "bg-emerald-500"
                      : unallocated > 0
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                  style={{
                    width: `${Math.min(100, Math.round((sumAssigned / totalQuantity) * 100))}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. SCHEDULE SUMMARY STATS BAR ────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-[#F8F9FD] p-3.5 rounded-xl border border-[#DEE0ED] text-xs">
        <div>
          <span className="text-[10px] text-[#252943]/50 block">Start Time</span>
          <span className="font-semibold text-[#252943]">
            {new Date(planResult.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-[#252943]/50 block">Est. Completion</span>
          <span className="font-semibold text-[#252943]">
            {new Date(planResult.estimatedCompletionTime).toLocaleDateString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-[#252943]/50 block">Batch Range</span>
          <span className="font-semibold text-[#252943]">
            {planResult.minQuantityPerStep.toLocaleString()} – {planResult.maxQuantityPerStep.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-[#252943]/50 block">Total Est. Cost</span>
          <span className="font-bold text-[#3A4EFB] font-mono">
            ₹{planResult.totalCost.toFixed(4)}
          </span>
        </div>
      </div>
    </div>
  );
}

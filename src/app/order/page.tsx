"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  ShieldCheck,
  ChevronRight, 
  ExternalLink,
  Loader2,
  Search,
  RotateCcw, 
  Check,
  Copy,
  Wallet,
  Zap,
  ListPlus,
  Dices,
  Boxes,
  CalendarClock,
  Trash2,
  X,
  Send,
  Pause,
  Play,
  Clock,
  Sparkles,
  Info
} from "lucide-react";
import Link from "next/link";
import { DeliveryPacingEditor } from "@/components/DeliveryPacingEditor";
import { ScheduleCalculationResult, ScheduleStepPreview } from "@/lib/types";
import { formatCurrency, formatProviderBalance } from "@/lib/currency";
import { generateRandomizedQuantities, recalculateOrderQuantitiesTotal } from "@/lib/randomizer/distributor";
import { BulkValidationSummary, ParsedBulkRow } from "@/lib/orders/bulk-service";

export interface GeneratedOrderItem {
  id: string;
  lineNumber: number;
  url: string;
  rawUrl: string;
  canonicalKey: string;
  serviceId: string;
  serviceExternalId: string;
  serviceName: string;
  platform: string;
  minQuantity: number;
  maxQuantity: number;
  ratePer1000: number;
  quantity: number;
  defaultQuantity: number;
  status: "VALID" | "BATCH_DUPLICATE" | "EXISTING_ACTIVE_ORDER" | "INVALID_URL" | "UNSUPPORTED_LINK" | "INVALID_QUANTITY";
  statusLabel: string;
  canSubmit: boolean;
  errorMessage?: string;
  existingOrderId?: string;
}

interface ServiceItem {
  id: string;
  externalId: string;
  providerServiceId?: string;
  providerId?: string;
  providerName?: string;
  name: string;
  type?: string;
  platform: string;
  category: string;
  description: string;
  minQuantity: number;
  maxQuantity: number;
  ratePer1000: number;
  refillSupported?: boolean;
  cancelSupported?: boolean;
  dripFeedSupported: boolean;
  dripFeedMinInterval: number;
  restrictions?: string;
  isMock: boolean;
}

interface ComboItem {
  id: string;
  serviceId: string;
  defaultQuantity: number;
  targetType: "SAME_URL" | "CUSTOM_URL";
  service: ServiceItem;
}

interface Combo {
  id: string;
  comboRef: string;
  name: string;
  description: string | null;
  active: boolean;
  items: ComboItem[];
}

interface ScheduledJobItem {
  id: string;
  jobRef: string;
  jobType: string;
  status: string;
  scheduledFor: string;
  timezone: string;
  payload: string;
  createdAt: string;
  retryCount: number;
  errorMessage: string | null;
}

function compactVideoUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/@([^/]+)\/(video|photo)\/(\d+)/i);
    if (match) {
      return `@${match[1]}/${match[2]}/${match[3]}`;
    }
    const shortMatch = parsed.pathname.match(/^\/t\/([^/]+)/i);
    if (shortMatch) {
      return `${parsed.hostname}/t/${shortMatch[1]}`;
    }
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function NewOrderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Core Catalog State
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("All");
  const [idSearchInput, setIdSearchInput] = useState("");
  const [idLookupError, setIdLookupError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Single Order Form State
  const [targetUrl, setTargetUrl] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [isPacingMode, setIsPacingMode] = useState(false);
  const [pacingPlan, setPacingPlan] = useState<ScheduleCalculationResult | null>(null);

  // Feature 3: Drip Feed Random Range State
  const [deliveryStrategy, setDeliveryStrategy] = useState<"INSTANT" | "PACING" | "DRIP_FEED">("INSTANT");
  const [dripMinQty, setDripMinQty] = useState<number>(10);
  const [dripMaxQty, setDripMaxQty] = useState<number>(16);
  const [dripRunsCount, setDripRunsCount] = useState<number>(6);
  const [dripInterval, setDripInterval] = useState<number>(60);
  const [dripPreviewPlan, setDripPreviewPlan] = useState<any>(null);
  const [loadingDripPreview, setLoadingDripPreview] = useState(false);

  // Live Balance State
  const [providerBalance, setProviderBalance] = useState<number | null>(null);
  const [providerCurrency, setProviderCurrency] = useState<string | null>(null);
  const [providerBalanceStale, setProviderBalanceStale] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(true);

  // UI / Submission States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResultMsg, setSuccessResultMsg] = useState<string | null>(null);

  // =========================================================================
  // FEATURE TOGGLES (100% Independent Enable/Disable Controls)
  // When all enabled, displayed strictly in this vertical order:
  // 1. Combo Maker
  // 2. Bulk Add
  // 3. Randomizer
  // 4. Scheduler
  // =========================================================================
  const [comboMakerEnabled, setComboMakerEnabled] = useState(false);
  const [bulkAddEnabled, setBulkAddEnabled] = useState(false);
  const [randomizerEnabled, setRandomizerEnabled] = useState(false);
  const [schedulerEnabled, setSchedulerEnabled] = useState(false);

  // =========================================================================
  // FEATURE 1: COMBO MAKER STATE
  // =========================================================================
  const [combos, setCombos] = useState<Combo[]>([]);
  const [selectedComboId, setSelectedComboId] = useState<string>("");
  const [comboTargetUrl, setComboTargetUrl] = useState("");
  const [comboCustomQtys, setComboCustomQtys] = useState<Record<string, number>>({});

  // =========================================================================
  // FEATURE 2: BULK ADD STATE
  // =========================================================================
  const [bulkRawLinks, setBulkRawLinks] = useState("");
  const [bulkDefaultQty, setBulkDefaultQty] = useState<number>(1000);
  const [bulkSummary, setBulkSummary] = useState<BulkValidationSummary | null>(null);
  const [bulkParsing, setBulkParsing] = useState(false);
  const [generatedOrders, setGeneratedOrders] = useState<GeneratedOrderItem[]>([]);
  const [bulkSubmissionOutcomes, setBulkSubmissionOutcomes] = useState<any[] | null>(null);
  const [singleVideoInput, setSingleVideoInput] = useState("");
  const [singleVideoAdding, setSingleVideoAdding] = useState(false);
  const [singleVideoError, setSingleVideoError] = useState<string | null>(null);
  const [copiedVideoKey, setCopiedVideoKey] = useState<string | null>(null);
  const videoLabelMapRef = useRef<Map<string, number>>(new Map());
  const nextVideoLabelRef = useRef(1);

  // =========================================================================
  // FEATURE 3: ORDER RANDOMIZER STATE
  // =========================================================================
  const [randomizerAvg, setRandomizerAvg] = useState<number>(1200);
  const [randomizerMin, setRandomizerMin] = useState<number>(100);
  const [randomizerMax, setRandomizerMax] = useState<number>(5000);
  const [randomizerVariation, setRandomizerVariation] = useState<number>(15);
  const [randomizerExactTotal, setRandomizerExactTotal] = useState<boolean>(false);

  // =========================================================================
  // FEATURE 4: PERSISTENT ORDER SCHEDULER STATE
  // =========================================================================
  const [userTimezone, setUserTimezone] = useState("UTC");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduledJobsList, setScheduledJobsList] = useState<ScheduledJobItem[]>([]);
  const [showScheduledDrawer, setShowScheduledDrawer] = useState(false);

  // Detect user's local timezone and set default future execution time (+1 hr)
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      setUserTimezone(tz);

      const future = new Date(Date.now() + 60 * 60 * 1000);
      const dateStr = future.toISOString().split("T")[0];
      const hours = String(future.getHours()).padStart(2, "0");
      const mins = String(future.getMinutes()).padStart(2, "0");
      setScheduledDate(dateStr);
      setScheduledTime(`${hours}:${mins}`);
    } catch {
      setUserTimezone("UTC");
    }
  }, []);

  async function loadBalance(refresh = false) {
    try {
      const res = await fetch(`/api/balance${refresh ? "?refresh=true" : ""}`);
      const data = await res.json();
      if (typeof data.balance === "number" && typeof data.currency === "string") {
        setProviderBalance(data.balance);
        setProviderCurrency(data.currency);
      } else if (data.success !== true && data.balance === null) {
        setProviderBalance(null);
        setProviderCurrency(null);
      }
      setProviderBalanceStale(data.stale === true || data.success !== true);
    } catch (err) {
      console.warn("Failed to load provider balance", err);
      setProviderBalanceStale(true);
    } finally {
      setLoadingBalance(false);
    }
  }

  async function loadScheduledJobs() {
    try {
      const res = await fetch("/api/scheduled-jobs?limit=10");
      const data = await res.json();
      if (data.success) {
        setScheduledJobsList(data.jobs);
      }
    } catch (err) {
      console.warn("Failed to load scheduled jobs", err);
    }
  }

  useEffect(() => {
    loadBalance();
    loadScheduledJobs();

    const handleBalanceUpdate = () => loadBalance(true);
    window.addEventListener("balance-updated", handleBalanceUpdate);
    return () => window.removeEventListener("balance-updated", handleBalanceUpdate);
  }, []);

  // Fetch Services Catalog & Combos
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoadingServices(true);
        const [servicesRes, combosRes] = await Promise.all([
          fetch("/api/services"),
          fetch("/api/combos?activeOnly=true"),
        ]);

        const sData = await servicesRes.json();
        const cData = await combosRes.json();

        if (sData.success && Array.isArray(sData.services)) {
          setServices(sData.services);
          const paramId = searchParams.get("serviceId");
          const targetSrv = paramId
            ? sData.services.find((s: ServiceItem) => s.id === paramId || s.externalId === paramId)
            : sData.services[0];
          if (targetSrv) {
            setSelectedServiceId(targetSrv.id);
            setSelectedPlatform(targetSrv.platform);
            setQuantity(targetSrv.minQuantity);
            setBulkDefaultQty(targetSrv.minQuantity);
          }
        }

        if (cData.success && Array.isArray(cData.combos)) {
          setCombos(cData.combos);
          const paramComboId = searchParams.get("comboId");
          const targetCombo = paramComboId
            ? cData.combos.find((c: Combo) => c.id === paramComboId)
            : cData.combos[0];
          if (targetCombo) {
            setSelectedComboId(targetCombo.id);
            const qtys: Record<string, number> = {};
            targetCombo.items.forEach((it: ComboItem) => {
              qtys[it.serviceId] = it.defaultQuantity;
            });
            setComboCustomQtys(qtys);
          }
        }
      } catch (err) {
        console.error("Failed to load catalog data", err);
      } finally {
        setLoadingServices(false);
      }
    }
    loadInitialData();
  }, [searchParams]);

  const hasFavourites = services.some((s: any) => s.isFavourite);
  const platforms = [
    ...(hasFavourites ? ["Favourites"] : []),
    "All",
    ...Array.from(new Set(services.map((s) => s.platform))),
  ];
  const filteredServices = selectedPlatform === "Favourites"
    ? services.filter((s: any) => s.isFavourite)
    : selectedPlatform === "All"
    ? services
    : services.filter((s) => s.platform === selectedPlatform);

  const activeService = services.find((s) => s.id === selectedServiceId) || services[0];
  const activeCombo = combos.find((c) => c.id === selectedComboId) || combos[0];

  // Update Randomizer bounds when active service changes
  useEffect(() => {
    if (activeService) {
      setRandomizerMin(activeService.minQuantity);
      setRandomizerMax(activeService.maxQuantity);
      setRandomizerAvg((prev) =>
        Math.min(activeService.maxQuantity, Math.max(activeService.minQuantity, prev))
      );
      if (generatedOrders.length === 0) {
        setBulkDefaultQty(activeService.minQuantity);
      }
      setDripMinQty(activeService.minQuantity);
      setDripMaxQty(Math.min(activeService.maxQuantity, Math.max(activeService.minQuantity, activeService.minQuantity + 6)));
    }
  }, [activeService?.id]);

  async function refreshDripPreview() {
    if (!activeService) return;
    try {
      setLoadingDripPreview(true);
      const res = await fetch("/api/orders/drip-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: activeService.id,
          minQuantity: Number(dripMinQty) || activeService.minQuantity,
          maxQuantity: Number(dripMaxQty) || activeService.minQuantity,
          runs: Number(dripRunsCount) || 5,
          intervalMinutes: Number(dripInterval) || 60,
        }),
      });
      const data = await res.json();
      if (data.success && data.plan) {
        setDripPreviewPlan(data.plan);
      }
    } catch (err) {
      console.warn("Failed to generate drip preview", err);
    } finally {
      setLoadingDripPreview(false);
    }
  }

  useEffect(() => {
    if (deliveryStrategy === "DRIP_FEED" && activeService) {
      refreshDripPreview();
    }
  }, [deliveryStrategy, activeService?.id, dripMinQty, dripMaxQty, dripRunsCount, dripInterval]);

  // Quick ID Lookup Handler
  function handleIdLookup(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setIdLookupError(null);
    const query = idSearchInput.trim();
    if (!query) return;

    const matched = services.find(
      (s) => s.externalId === query || s.id === query || s.externalId.toLowerCase() === query.toLowerCase()
    );

    if (matched) {
      setSelectedServiceId(matched.id);
      setSelectedPlatform("All");
      setIdLookupError(null);
    } else {
      setIdLookupError(`No service found with ID #${query}`);
    }
  }

  // =========================================================================
  // BULK LINK PARSING & VALIDATION HANDLERS
  // =========================================================================
  function ensureVideoLabel(canonicalKey: string): number {
    const existing = videoLabelMapRef.current.get(canonicalKey);
    if (existing) return existing;

    const label = nextVideoLabelRef.current;
    nextVideoLabelRef.current += 1;
    videoLabelMapRef.current.set(canonicalKey, label);
    return label;
  }

  function buildGeneratedRows(summaryRows: ParsedBulkRow[]): GeneratedOrderItem[] {
    return summaryRows.map((r, idx) => {
      const srvId = r.serviceId || (activeService ? activeService.id : "");
      const srvName = r.serviceName || (activeService ? activeService.name : "Service");
      const srvExtId = r.serviceExternalId || (activeService ? activeService.externalId : "");
      const minQ = r.minQuantity ?? (activeService ? activeService.minQuantity : 50);
      const maxQ = r.maxQuantity ?? (activeService ? activeService.maxQuantity : 50000);
      const rate = r.ratePer1000 ?? (activeService ? activeService.ratePer1000 : 1);
      const defaultQ = r.quantity || Number(bulkDefaultQty) || minQ;
      const canonicalKey = r.canonicalKey || (r.normalizedUrl || r.rawUrl).toLowerCase();

      ensureVideoLabel(canonicalKey);

      return {
        id: `ord-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
        lineNumber: r.lineNumber,
        url: r.normalizedUrl || r.rawUrl,
        rawUrl: r.rawUrl,
        canonicalKey,
        serviceId: srvId,
        serviceExternalId: srvExtId,
        serviceName: srvName,
        platform: r.platform || "TikTok",
        minQuantity: minQ,
        maxQuantity: maxQ,
        ratePer1000: rate,
        quantity: defaultQ,
        defaultQuantity: defaultQ,
        status: r.status,
        statusLabel: r.statusLabel,
        canSubmit: r.canSubmit,
        errorMessage: r.errorMessage,
        existingOrderId: r.existingOrderId,
      };
    });
  }

  async function handleParseBulkLinks() {
    if (!bulkRawLinks.trim()) return;
    setBulkParsing(true);
    setBulkSubmissionOutcomes(null);
    setErrorMsg(null);

    try {
      const body: any = {
        rawText: bulkRawLinks,
        defaultQuantity: Number(bulkDefaultQty) || (activeService ? activeService.minQuantity : 1000),
      };

      if (comboMakerEnabled && activeCombo) {
        body.comboId = activeCombo.id;
      } else if (activeService) {
        body.serviceId = activeService.id;
      } else {
        throw new Error("Please select a combo or a service.");
      }

      const res = await fetch("/api/orders/bulk/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to validate bulk links");
      }

      setBulkSummary(data.summary);

      // Convert parsed rows into grouped video order items
      let rows = buildGeneratedRows(data.summary.rows);

      // If Randomizer is enabled, randomize newly parsed rows immediately
      if (randomizerEnabled) {
        rows = applyRandomizationToRows(rows);
      }

      setGeneratedOrders(rows);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to parse links");
    } finally {
      setBulkParsing(false);
    }
  }

  async function handleAddSingleVideo(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const input = singleVideoInput.trim();
    if (!input || singleVideoAdding) return;

    setSingleVideoAdding(true);
    setSingleVideoError(null);

    try {
      const body: any = {
        url: input,
        defaultQuantity: Number(bulkDefaultQty) || (activeService ? activeService.minQuantity : 1000),
      };

      if (comboMakerEnabled && activeCombo) {
        body.comboId = activeCombo.id;
      } else if (activeService) {
        body.serviceId = activeService.id;
      } else {
        throw new Error("Please select a combo or a service.");
      }

      const res = await fetch("/api/urls/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to resolve this TikTok link");
      }

      const newRows = buildGeneratedRows(data.summary?.rows || []);
      if (newRows.length === 0) {
        throw new Error("This link did not produce a valid order.");
      }

      const existingKeys = new Set(generatedOrders.map((r) => r.canonicalKey));
      if (newRows.some((r) => existingKeys.has(r.canonicalKey))) {
        throw new Error("This video is already in the prepared list.");
      }

      if (!newRows.some((r) => r.canSubmit)) {
        setSingleVideoError(newRows[0].errorMessage || newRows[0].statusLabel || "This link cannot be ordered.");
        return;
      }

      const rowsToAdd = randomizerEnabled ? applyRandomizationToRows(newRows) : newRows;

      setGeneratedOrders((prev) => [...prev, ...rowsToAdd]);
      setBulkSummary((prev) => {
        if (!prev) return data.summary as BulkValidationSummary;

        return {
          ...prev,
          totalRows: prev.totalRows + data.summary.totalRows,
          validRows: prev.validRows + data.summary.validRows,
          duplicateRows: prev.duplicateRows + data.summary.duplicateRows,
          activeOrderRows: prev.activeOrderRows + data.summary.activeOrderRows,
          invalidRows: prev.invalidRows + data.summary.invalidRows,
          readyToSubmitRows: prev.readyToSubmitRows + data.summary.validRows,
          rows: [...prev.rows, ...data.summary.rows],
          totalQuantity: prev.totalQuantity + data.summary.totalQuantity,
          estimatedCost: Number((prev.estimatedCost + data.summary.estimatedCost).toFixed(4)),
        };
      });
      setBulkSubmissionOutcomes(null);
      setSingleVideoInput("");
    } catch (err: any) {
      setSingleVideoError(err.message || "Failed to add this video link.");
    } finally {
      setSingleVideoAdding(false);
    }
  }

  // When active combo changes, automatically update the generated orders if links are present
  useEffect(() => {
    if (bulkAddEnabled && bulkRawLinks.trim() && comboMakerEnabled && activeCombo) {
      handleParseBulkLinks();
    }
  }, [selectedComboId, comboMakerEnabled]);

  function handleUpdateRowQuantity(rowId: string, newQty: number) {
    setGeneratedOrders((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;

        let status = row.status;
        let statusLabel = row.statusLabel;
        let canSubmit = row.canSubmit;
        let errorMessage = row.errorMessage;

        if (newQty < row.minQuantity) {
          status = "INVALID_QUANTITY";
          statusLabel = "Invalid quantity";
          canSubmit = false;
          errorMessage = `Below service minimum (${row.minQuantity.toLocaleString()})`;
        } else if (newQty > row.maxQuantity) {
          status = "INVALID_QUANTITY";
          statusLabel = "Invalid quantity";
          canSubmit = false;
          errorMessage = `Exceeds service maximum (${row.maxQuantity.toLocaleString()})`;
        } else if (row.status === "INVALID_QUANTITY") {
          status = "VALID";
          statusLabel = "Ready to submit";
          canSubmit = true;
          errorMessage = undefined;
        }

        return {
          ...row,
          quantity: newQty,
          status,
          statusLabel,
          canSubmit,
          errorMessage,
        };
      })
    );
  }

  function handleRemoveRow(rowId: string) {
    setGeneratedOrders((prev) => prev.filter((row) => row.id !== rowId));
  }

  function handleRemoveVideo(canonicalKey: string) {
    setGeneratedOrders((prev) => prev.filter((row) => row.canonicalKey !== canonicalKey));
  }

  function handleClearAllBulk() {
    setBulkRawLinks("");
    setBulkSummary(null);
    setGeneratedOrders([]);
    setBulkSubmissionOutcomes(null);
    setSingleVideoInput("");
    setSingleVideoError(null);
    videoLabelMapRef.current.clear();
    nextVideoLabelRef.current = 1;
  }

  // =========================================================================
  // RANDOMIZER ENGINE & ACTIONS
  // =========================================================================
  function applyRandomizationToRows(rows: GeneratedOrderItem[] = generatedOrders): GeneratedOrderItem[] {
    const variationFraction = (randomizerVariation || 15) / 100;

    return rows.map((row) => {
      if (!row.canSubmit) return row;

      const baseQty = randomizerAvg > 0 ? randomizerAvg : row.defaultQuantity;
      const minBound = Math.max(row.minQuantity, Math.round(baseQty * (1 - variationFraction)));
      const maxBound = Math.min(row.maxQuantity, Math.round(baseQty * (1 + variationFraction)));

      const rand = Math.floor(minBound + Math.random() * (maxBound - minBound + 1));
      const clamped = Math.max(row.minQuantity, Math.min(row.maxQuantity, rand));

      return {
        ...row,
        quantity: clamped,
      };
    });
  }

  function handleToggleRandomizer(nextState: boolean) {
    setRandomizerEnabled(nextState);
    if (!nextState) {
      // Revert to configured defaults without clearing links, combo, or rows!
      setGeneratedOrders((prev) =>
        prev.map((row) => ({
          ...row,
          quantity: row.defaultQuantity,
        }))
      );
      if (!bulkAddEnabled && !comboMakerEnabled && activeService) {
        setQuantity(activeService.minQuantity);
      }
    } else {
      // Apply randomization to current rows
      setGeneratedOrders((prev) => applyRandomizationToRows(prev));
      if (!bulkAddEnabled && !comboMakerEnabled && activeService) {
        handleRandomizeSingleOrder();
      }
    }
  }

  function handleRegenerateRandomizer() {
    setGeneratedOrders((prev) => applyRandomizationToRows(prev));
  }

  function handleResetToDefault() {
    setGeneratedOrders((prev) =>
      prev.map((row) => ({
        ...row,
        quantity: row.defaultQuantity,
      }))
    );
  }

  function handleRandomizeSingleOrder() {
    if (!activeService) return;
    const variationFraction = (randomizerVariation || 15) / 100;
    const avg = randomizerAvg > 0 ? randomizerAvg : activeService.minQuantity;
    const minBound = Math.max(activeService.minQuantity, Math.round(avg * (1 - variationFraction)));
    const maxBound = Math.min(activeService.maxQuantity, Math.round(avg * (1 + variationFraction)));
    const rand = Math.floor(minBound + Math.random() * (maxBound - minBound + 1));
    const clamped = Math.max(activeService.minQuantity, Math.min(activeService.maxQuantity, rand));
    setQuantity(clamped);
  }

  // =========================================================================
  // CALCULATIONS (Single, Bulk, Combo, and Combined)
  // =========================================================================
  const numQty = typeof quantity === "number" ? quantity : 0;
  const isBelowMin = activeService ? numQty > 0 && numQty < activeService.minQuantity : false;
  const isAboveMax = activeService ? numQty > activeService.maxQuantity : false;
  const isValidQty = activeService ? numQty >= activeService.minQuantity && numQty <= activeService.maxQuantity : false;

  const singleEstimatedCost = activeService && numQty > 0
    ? Number(((numQty / 1000) * activeService.ratePer1000).toFixed(4))
    : 0;

  // Filter ready orders for submission
  const readyOrders = generatedOrders.filter((o) => o.canSubmit);

  const videoGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        canonicalKey: string;
        label: number;
        url: string;
        platform: string;
        rows: GeneratedOrderItem[];
      }
    >();

    for (const row of generatedOrders) {
      const key = row.canonicalKey || row.url.toLowerCase();
      let group = groups.get(key);

      if (!group) {
        let label = videoLabelMapRef.current.get(key);
        if (!label) {
          label = nextVideoLabelRef.current;
          nextVideoLabelRef.current += 1;
          videoLabelMapRef.current.set(key, label);
        }

        group = {
          canonicalKey: key,
          label,
          url: row.url,
          platform: row.platform,
          rows: [],
        };
        groups.set(key, group);
      }

      group.rows.push(row);
    }

    return Array.from(groups.values());
  }, [generatedOrders]);

  let totalOrdersCount = 0;
  let totalOrderQuantity = 0;
  let effectiveCost = 0;

  if (bulkAddEnabled) {
    totalOrdersCount = readyOrders.length;
    totalOrderQuantity = readyOrders.reduce((sum, o) => sum + o.quantity, 0);
    effectiveCost = readyOrders.reduce(
      (sum, o) => sum + (o.quantity / 1000) * o.ratePer1000,
      0
    );
  } else if (comboMakerEnabled) {
    if (activeCombo) {
      totalOrdersCount = activeCombo.items.length;
      totalOrderQuantity = activeCombo.items.reduce(
        (sum, it) => sum + (comboCustomQtys[it.serviceId] || it.defaultQuantity),
        0
      );
      effectiveCost = activeCombo.items.reduce(
        (sum, it) =>
          sum +
          ((comboCustomQtys[it.serviceId] || it.defaultQuantity) / 1000) *
            it.service.ratePer1000,
        0
      );
    }
  } else if (deliveryStrategy === "DRIP_FEED") {
    totalOrdersCount = dripRunsCount;
    totalOrderQuantity = dripPreviewPlan ? dripPreviewPlan.actualTotalQuantity : (dripMinQty * dripRunsCount);
    effectiveCost = dripPreviewPlan ? dripPreviewPlan.actualFinalCharge : Number(((totalOrderQuantity / 1000) * (activeService?.ratePer1000 || 0)).toFixed(4));
  } else {
    totalOrdersCount = numQty > 0 ? 1 : 0;
    totalOrderQuantity = numQty;
    effectiveCost = isPacingMode && pacingPlan ? pacingPlan.totalCost : singleEstimatedCost;
  }

  effectiveCost = Number(effectiveCost.toFixed(4));

  const projectedBalance = providerBalance === null ? null : Number((providerBalance - effectiveCost).toFixed(2));
  const hasInsufficientBalance = providerBalance !== null && effectiveCost > 0 && providerBalance < effectiveCost;

  // Feasibility Check
  let canProceed = false;
  if (bulkAddEnabled) {
    if (comboMakerEnabled) {
      canProceed = Boolean(activeCombo && readyOrders.length > 0);
    } else {
      canProceed = Boolean(activeService && readyOrders.length > 0);
    }
  } else if (comboMakerEnabled) {
    canProceed = Boolean(activeCombo && comboTargetUrl.trim().length > 5);
  } else if (deliveryStrategy === "DRIP_FEED") {
    canProceed = Boolean(
      activeService &&
      targetUrl.trim().length > 5 &&
      dripMinQty >= activeService.minQuantity &&
      dripMaxQty <= activeService.maxQuantity &&
      dripMinQty <= dripMaxQty &&
      dripRunsCount >= 1
    );
  } else {
    canProceed = Boolean(
      activeService && targetUrl.trim().length > 5 && (isPacingMode ? pacingPlan?.valid : isValidQty)
    );
  }

  if (schedulerEnabled) {
    canProceed = canProceed && Boolean(scheduledDate && scheduledTime);
  }

  // =========================================================================
  // SUBMISSION LOGIC (All Features Combined or Independent)
  // =========================================================================
  async function handleSubmitOrder() {
    if (!canProceed) return;
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessResultMsg(null);

    // Prepare UTC scheduled execution timestamp if Scheduler feature is enabled
    let scheduledUtcString: string | null = null;
    if (schedulerEnabled) {
      if (!scheduledDate || !scheduledTime) {
        setErrorMsg("Please select a valid scheduled date and time.");
        setSubmitting(false);
        return;
      }
      const combinedLocal = new Date(`${scheduledDate}T${scheduledTime}:00`);
      if (isNaN(combinedLocal.getTime())) {
        setErrorMsg("Invalid scheduled execution time.");
        setSubmitting(false);
        return;
      }
      if (combinedLocal.getTime() < Date.now() - 30000) {
        setErrorMsg("Scheduled execution time must be in the future.");
        setSubmitting(false);
        return;
      }
      scheduledUtcString = combinedLocal.toISOString();
    }

    try {
      if (comboMakerEnabled) {
        // =====================================================================
        // COMBO WORKFLOW (Combined with Bulk Add or Single Target URL)
        // =====================================================================
        if (!activeCombo) throw new Error("Please select a combo");

        const validUrls = bulkAddEnabled
          ? Array.from(new Set(readyOrders.map((o) => o.url)))
          : [comboTargetUrl.trim()];

        const orderItems = bulkAddEnabled
          ? readyOrders.map((o) => ({
              url: o.url,
              serviceId: o.serviceId,
              quantity: o.quantity,
            }))
          : activeCombo.items.map((it) => ({
              url: comboTargetUrl.trim(),
              serviceId: it.serviceId,
              quantity: comboCustomQtys[it.serviceId] || it.defaultQuantity,
            }));

        if (schedulerEnabled && scheduledUtcString) {
          // Scheduled Combo Order (Persistent Backend Worker)
          const res = await fetch("/api/scheduled-jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobType: "COMBO",
              scheduledFor: scheduledUtcString,
              timezone: userTimezone,
              payload: {
                comboId: activeCombo.id,
                targetUrls: validUrls,
                orderItems,
              },
            }),
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || "Failed to persist scheduled combo order");
          }

          setShowConfirmModal(false);
          setSuccessResultMsg(
            `Scheduled combo job #${data.job.jobRef} registered successfully! The persistent backend worker will execute it at ${new Date(data.job.scheduledFor).toLocaleString()} (${userTimezone}) even if you close this browser.`
          );
          await loadScheduledJobs();
        } else {
          // Immediate Combo Execution
          const res = await fetch("/api/combos/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              comboId: activeCombo.id,
              targetUrls: validUrls,
              orderItems,
              idempotencyToken: `combo-submit-${Date.now()}`,
            }),
          });

          const data = await res.json();
          if (!res.ok && !data.success) {
            throw new Error(data.error || "Combo execution failed");
          }

          window.dispatchEvent(new Event("balance-updated"));
          setShowConfirmModal(false);
          setSuccessResultMsg(
            `Combo execution ${data.executionRef} created! ${data.successfulServices} of ${data.totalServices} child services submitted successfully.`
          );
        }
      } else if (bulkAddEnabled) {
        // =====================================================================
        // BULK ADD STANDALONE (Single Catalog Service)
        // =====================================================================
        if (!activeService) throw new Error("Please select a service");
        const rows = readyOrders.map((o) => ({
          rawUrl: o.rawUrl,
          normalizedUrl: o.url,
          quantity: o.quantity,
        }));

        if (schedulerEnabled && scheduledUtcString) {
          const res = await fetch("/api/scheduled-jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobType: "BULK",
              scheduledFor: scheduledUtcString,
              timezone: userTimezone,
              payload: {
                serviceId: activeService.id,
                rows,
              },
            }),
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || "Failed to persist scheduled bulk order");
          }

          setShowConfirmModal(false);
          setSuccessResultMsg(
            `Scheduled bulk job #${data.job.jobRef} registered successfully! The persistent backend worker will execute it at ${new Date(data.job.scheduledFor).toLocaleString()} (${userTimezone}) even if you close this browser.`
          );
          await loadScheduledJobs();
        } else {
          const res = await fetch("/api/orders/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              serviceId: activeService.id,
              rows,
              idempotencyToken: `bulk-submit-${Date.now()}`,
            }),
          });

          const data = await res.json();
          if (!res.ok && !data.success) {
            throw new Error(data.error || "Bulk order submission failed");
          }

          window.dispatchEvent(new Event("balance-updated"));
          setShowConfirmModal(false);
          setBulkSubmissionOutcomes(data.outcomes);
          setSuccessResultMsg(
            `Bulk Batch ${data.batchRef} submitted: ${data.successOrders} of ${data.totalOrders} orders accepted by provider.`
          );
        }
      } else {
        // =====================================================================
        // SINGLE ORDER FLOW
        // =====================================================================
        if (schedulerEnabled && scheduledUtcString) {
          const res = await fetch("/api/scheduled-jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobType: "SINGLE",
              scheduledFor: scheduledUtcString,
              timezone: userTimezone,
              payload: {
                serviceId: activeService.id,
                targetUrl: targetUrl.trim(),
                requestedQuantity: numQty,
                scheduleMode: "INSTANT",
              },
            }),
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || "Failed to persist scheduled order");
          }

          setShowConfirmModal(false);
          setSuccessResultMsg(
            `Scheduled order job #${data.job.jobRef} registered successfully! The persistent backend worker will execute it at ${new Date(data.job.scheduledFor).toLocaleString()} (${userTimezone}) even if you close this browser.`
          );
          await loadScheduledJobs();
        } else if (deliveryStrategy === "DRIP_FEED") {
          const payload = {
            serviceId: activeService.id,
            targetUrl: targetUrl.trim(),
            scheduleMode: "DRIP_FEED",
            dripMinQuantity: Number(dripMinQty),
            dripMaxQuantity: Number(dripMaxQty),
            dripRuns: Number(dripRunsCount),
            dripIntervalMinutes: Number(dripInterval),
          };

          const res = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || "Drip Feed order placement failed");
          }

          window.dispatchEvent(new Event("balance-updated"));
          setShowConfirmModal(false);
          router.push(`/orders/${data.order.id}`);
          return;
        } else {
          const payload: any = isPacingMode && pacingPlan ? {
            serviceId: activeService.id,
            targetUrl: targetUrl.trim(),
            requestedQuantity: pacingPlan.totalQuantity,
            scheduleMode: pacingPlan.scheduleMode,
            timingMode: pacingPlan.timingMode,
            stepsCount: pacingPlan.stepCount,
            intervalMinutes: pacingPlan.defaultIntervalMinutes,
            totalDurationMinutes: pacingPlan.totalDurationMinutes,
            customStepQuantities: pacingPlan.steps.map((s: ScheduleStepPreview) => s.quantity),
            customIntervals: pacingPlan.steps.map((s: ScheduleStepPreview) => s.intervalMinutesFromPrev),
          } : {
            serviceId: activeService.id,
            targetUrl: targetUrl.trim(),
            requestedQuantity: numQty,
            scheduleMode: "INSTANT",
          };

          const res = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || "Order placement failed");
          }

          window.dispatchEvent(new Event("balance-updated"));
          setShowConfirmModal(false);
          router.push(`/orders/${data.order.id}`);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred during submission.");
    } finally {
      setSubmitting(false);
    }
  }

  // Scheduled job actions: Cancel, Pause, Resume
  async function handleCancelScheduledJob(id: string) {
    try {
      const res = await fetch(`/api/scheduled-jobs/${id}`, { method: "DELETE" });
      if (res.ok) await loadScheduledJobs();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleTogglePauseScheduledJob(id: string, currentStatus: string) {
    try {
      const endpoint = currentStatus === "PAUSED" ? `/api/scheduled-jobs/${id}/resume` : `/api/scheduled-jobs/${id}/pause`;
      const res = await fetch(endpoint, { method: "POST" });
      if (res.ok) await loadScheduledJobs();
    } catch (err) {
      console.error(err);
    }
  }

  if (loadingServices) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-2 text-sm text-[#252943]/60">
          <Loader2 className="w-5 h-5 animate-spin text-[#3A4EFB]" />
          <span>Loading verified service catalog...</span>
        </div>
      </div>
    );
  }

  const executionModeLabel = comboMakerEnabled && bulkAddEnabled
    ? "Combo Bundle + Bulk Add"
    : comboMakerEnabled
    ? "Combo Order"
    : bulkAddEnabled
    ? `Bulk Batch (${readyOrders.length} orders)`
    : "Single Order";

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-16">
      {/* Top Breadcrumb & Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#DEE0ED]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#252943]">
            New Order Placement
          </h1>
          <p className="text-xs text-[#252943]/60 mt-0.5">
            Configure standalone catalog services, bundle combos, multi-link bulk batches, and scheduled runs.
          </p>
        </div>

        {/* Quick Presets Bar */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F8F9FD] rounded-xl border border-[#DEE0ED]">
          <button
            type="button"
            id="preset-single-order-btn"
            onClick={() => {
              setComboMakerEnabled(false);
              setBulkAddEnabled(false);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all press-scale flex items-center gap-1.5 ${
              !comboMakerEnabled && !bulkAddEnabled
                ? "bg-[#252943] text-white shadow-subtle"
                : "text-[#252943]/70 hover:text-[#252943]"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Single Order
          </button>
          <button
            type="button"
            id="preset-bulk-add-btn"
            onClick={() => {
              setBulkAddEnabled(true);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all press-scale flex items-center gap-1.5 ${
              bulkAddEnabled && !comboMakerEnabled
                ? "bg-[#252943] text-white shadow-subtle"
                : "text-[#252943]/70 hover:text-[#252943]"
            }`}
          >
            <ListPlus className="w-3.5 h-3.5" />
            Bulk Add
          </button>
          <button
            type="button"
            id="preset-combo-order-btn"
            onClick={() => {
              setComboMakerEnabled(true);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all press-scale flex items-center gap-1.5 ${
              comboMakerEnabled
                ? "bg-[#252943] text-white shadow-subtle"
                : "text-[#252943]/70 hover:text-[#252943]"
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            Combo Orders
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* INDEPENDENT FEATURE CONTROLS BAR (All 4 can be ON simultaneously) */}
      {/* ========================================================================= */}
      <div className="bg-white p-3.5 rounded-2xl border border-[#DEE0ED] shadow-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#252943]">Feature Toggles:</span>
          <span className="text-[11px] text-[#252943]/50">Enable or disable features independently</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Combo Maker Toggle */}
          <button
            type="button"
            id="toggle-combo-maker-btn"
            onClick={() => setComboMakerEnabled(!comboMakerEnabled)}
            className={`px-3 py-1.5 rounded-lg font-bold border transition-all press-scale flex items-center gap-1.5 ${
              comboMakerEnabled
                ? "bg-emerald-50 border-emerald-400 text-emerald-700 shadow-sm"
                : "bg-[#F8F9FD] border-[#DEE0ED] text-[#252943]/60 hover:text-[#252943]"
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Combo Maker: {comboMakerEnabled ? "ON" : "OFF"}</span>
          </button>

          {/* Bulk Add Toggle */}
          <button
            type="button"
            id="toggle-bulk-add-btn"
            onClick={() => setBulkAddEnabled(!bulkAddEnabled)}
            className={`px-3 py-1.5 rounded-lg font-bold border transition-all press-scale flex items-center gap-1.5 ${
              bulkAddEnabled
                ? "bg-[#3A4EFB]/10 border-[#3A4EFB] text-[#3A4EFB] shadow-sm"
                : "bg-[#F8F9FD] border-[#DEE0ED] text-[#252943]/60 hover:text-[#252943]"
            }`}
          >
            <ListPlus className="w-3.5 h-3.5" />
            <span>Bulk Add: {bulkAddEnabled ? "ON" : "OFF"}</span>
          </button>

          {/* Randomizer Toggle */}
          <button
            type="button"
            id="toggle-randomizer-btn"
            onClick={() => handleToggleRandomizer(!randomizerEnabled)}
            className={`px-3 py-1.5 rounded-lg font-bold border transition-all press-scale flex items-center gap-1.5 ${
              randomizerEnabled
                ? "bg-purple-50 border-purple-400 text-purple-700 shadow-sm"
                : "bg-[#F8F9FD] border-[#DEE0ED] text-[#252943]/60 hover:text-[#252943]"
            }`}
          >
            <Dices className="w-3.5 h-3.5" />
            <span>Randomizer: {randomizerEnabled ? "ON" : "OFF"}</span>
          </button>

          {/* Scheduler Toggle */}
          <button
            type="button"
            id="toggle-scheduler-btn"
            onClick={() => setSchedulerEnabled(!schedulerEnabled)}
            className={`px-3 py-1.5 rounded-lg font-bold border transition-all press-scale flex items-center gap-1.5 ${
              schedulerEnabled
                ? "bg-amber-50 border-amber-400 text-amber-700 shadow-sm"
                : "bg-[#F8F9FD] border-[#DEE0ED] text-[#252943]/60 hover:text-[#252943]"
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span>Scheduler: {schedulerEnabled ? "ON" : "OFF"}</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successResultMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start justify-between gap-3 animate-fadeIn">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-sm">Action Confirmed</span>
              <p className="mt-0.5 leading-relaxed">{successResultMsg}</p>
            </div>
          </div>
          <button onClick={() => setSuccessResultMsg(null)} className="text-emerald-600 hover:text-emerald-900 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Form (2 Cols) + Side Summary Panel (1 Col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">

          {/* ========================================================================= */}
          {/* SECTION 1: COMBO MAKER (TOP SECTION) OR CATALOG SELECTOR */}
          {/* Exact Vertical Position 1 */}
          {/* ========================================================================= */}
          {comboMakerEnabled ? (
            <div id="section-combo-maker" className="bg-white rounded-2xl border border-emerald-300 p-6 shadow-subtle space-y-5 animate-fadeIn">
              <div className="pb-3 border-b border-[#DEE0ED] flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-emerald-600" />
                  1. Combo Maker — Bundle Selection
                </span>
                <Link
                  href="/combos"
                  className="text-xs font-bold text-[#3A4EFB] hover:underline flex items-center gap-1"
                >
                  Manage / Create Combos <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              {combos.length === 0 ? (
                <div className="p-8 text-center bg-[#F8F9FD] rounded-xl border border-[#DEE0ED] space-y-2">
                  <p className="text-xs text-[#252943]/70">No active combo bundles available yet.</p>
                  <Link
                    href="/combos"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#3A4EFB] text-white text-xs font-bold"
                  >
                    Create a Combo in Combo Maker
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#252943]">Choose Saved Combo Bundle</label>
                    <select
                      id="combo-select-dropdown"
                      value={selectedComboId}
                      onChange={(e) => {
                        setSelectedComboId(e.target.value);
                        const c = combos.find((cb) => cb.id === e.target.value);
                        if (c) {
                          const qtys: Record<string, number> = {};
                          c.items.forEach((it) => (qtys[it.serviceId] = it.defaultQuantity));
                          setComboCustomQtys(qtys);
                        }
                      }}
                      className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2.5 text-xs text-[#252943] font-bold focus:border-[#3A4EFB] focus:bg-white"
                    >
                      {combos.map((cb) => (
                        <option key={cb.id} value={cb.id}>
                          [{cb.comboRef}] {cb.name} ({cb.items.length} child services)
                        </option>
                      ))}
                    </select>
                  </div>

                  {activeCombo && (
                    <div className="p-4 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#252943]">
                          Configured Services in [{activeCombo.comboRef}] {activeCombo.name}
                        </span>
                        <span className="text-[#3A4EFB] font-semibold text-xs">
                          {activeCombo.items.length} services applied to each link
                        </span>
                      </div>
                      <div className="space-y-2">
                        {activeCombo.items.map((it) => (
                          <div
                            key={it.id}
                            className="bg-white p-3 rounded-xl border border-[#DEE0ED]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-[#252943] text-white text-[11px] font-bold">
                                  #{it.service.externalId}
                                </span>
                                <span className="font-bold text-[#252943]">{it.service.name}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3A4EFB]/10 text-[#3A4EFB] font-semibold">
                                  {it.service.platform}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#252943]/60 flex items-center gap-3">
                                <span>Rate: ₹{it.service.ratePer1000.toFixed(2)} / 1k</span>
                                <span>Min: {it.service.minQuantity.toLocaleString()}</span>
                                <span>Max: {it.service.maxQuantity.toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-center">
                              <span className="text-[11px] text-[#252943]/60">Default:</span>
                              <span className="px-2.5 py-1 rounded-lg bg-[#F8F9FD] border border-[#DEE0ED] font-mono font-bold text-xs text-[#252943]">
                                {it.defaultQuantity.toLocaleString()} units
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Standalone Service Catalog Item Selector */
            <div id="section-catalog-selector" className="bg-white rounded-2xl border border-[#DEE0ED] p-6 shadow-subtle space-y-5">
              <div className="pb-3 border-b border-[#DEE0ED]">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#3A4EFB] flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#3A4EFB]/10 text-[#3A4EFB] flex items-center justify-center text-[11px] font-bold">1</span>
                  Select Service Catalog Item
                </span>
              </div>

              {/* Quick ID Search */}
              <form onSubmit={handleIdLookup} className="bg-[#F8F9FD] p-3 rounded-xl border border-[#DEE0ED] space-y-2">
                <label htmlFor="quick-service-id" className="text-xs font-semibold text-[#252943] flex items-center justify-between">
                  <span>Quick Lookup by Service ID</span>
                  <span className="text-[10px] text-[#252943]/50 font-normal">e.g. 1, 101, 201, 301, 302</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#252943]/40" />
                    <input
                      id="quick-service-id"
                      type="text"
                      placeholder="Enter Service ID number..."
                      value={idSearchInput}
                      onChange={(e) => setIdSearchInput(e.target.value)}
                      className="w-full bg-white border border-[#DEE0ED] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#252943] focus:border-[#3A4EFB]"
                    />
                  </div>
                  <button
                    type="submit"
                    id="lookup-service-id-btn"
                    className="px-3.5 py-1.5 rounded-lg bg-[#252943] hover:bg-[#1A1D31] text-white text-xs font-semibold transition-all press-scale flex items-center gap-1.5 shrink-0"
                  >
                    <Search className="w-3.5 h-3.5 text-[#E3FF3B]" />
                    <span>Lookup ID</span>
                  </button>
                </div>
                {idLookupError && (
                  <p className="text-[11px] text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {idLookupError}
                  </p>
                )}
              </form>

              {/* Platform Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {platforms.map((platform) => {
                  const isFav = platform === "Favourites";
                  const isSelected = selectedPlatform === platform;
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => {
                        setSelectedPlatform(platform);
                        const firstInPlatform = platform === "Favourites"
                          ? services.find((s: any) => s.isFavourite)
                          : platform === "All" 
                          ? services[0] 
                          : services.find((s) => s.platform === platform);
                        if (firstInPlatform) setSelectedServiceId(firstInPlatform.id);
                      }}
                      className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap transition-all press-scale flex items-center gap-1.5 ${
                        isSelected
                          ? isFav
                            ? "bg-amber-400 text-[#252943] font-bold"
                            : "bg-[#252943] text-white font-medium"
                          : isFav
                          ? "bg-amber-50 text-amber-800 font-bold border border-amber-200 hover:bg-amber-100"
                          : "bg-[#F8F9FD] text-[#252943]/70 hover:bg-[#DEE0ED]/50"
                      }`}
                    >
                      {isFav && <span className="text-amber-500">★</span>}
                      <span>{platform}</span>
                    </button>
                  );
                })}
              </div>

              {/* Service Dropdown */}
              <div className="space-y-1.5">
                <label htmlFor="service-select" className="text-xs font-medium text-[#252943]">
                  Service Item ({filteredServices.length} available)
                </label>
                <select
                  id="service-select"
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#252943] focus:border-[#3A4EFB] focus:bg-white transition-colors font-medium"
                >
                  {filteredServices.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.isFavourite ? "★ " : ""}{s.providerName ? `[${s.providerName}] ` : ""}#{s.externalId} — [{s.platform}] {s.name} (₹{s.ratePer1000.toFixed(2)}/1k)
                    </option>
                  ))}
                </select>
              </div>

              {/* Service Specs Details */}
              {activeService && (
                <div className="p-4 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]/80 text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(activeService.externalId);
                          setCopiedId(true);
                          setTimeout(() => setCopiedId(false), 1500);
                        }}
                        className="px-2.5 py-1 rounded-md bg-[#252943] text-white text-xs font-bold flex items-center gap-1.5 shadow-subtle hover:bg-[#1A1D31] transition-colors"
                        title="Click to copy Service ID"
                      >
                        <span>ID #{activeService.externalId}</span>
                        {copiedId ? <Check className="w-3 h-3 text-[#E3FF3B]" /> : <Copy className="w-3 h-3 text-white/60" />}
                      </button>
                      {activeService.providerName && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {activeService.providerName}
                        </span>
                      )}
                      <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-[#3A4EFB]/10 text-[#3A4EFB] font-semibold">
                        {activeService.type || "Default"}
                      </span>
                    </div>
                    <div className="font-bold text-[#3A4EFB] text-sm">
                      ₹{Number(activeService.ratePer1000).toFixed(2)} / 1,000
                    </div>
                  </div>
                  <p className="text-[#252943]/80 leading-relaxed font-normal">
                    {activeService.description}
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#DEE0ED]/60 text-xs">
                    <div>
                      <span className="text-[#252943]/50 text-[11px] block">Min Quantity</span>
                      <span className="font-bold text-[#252943]">{activeService.minQuantity.toLocaleString()} units</span>
                    </div>
                    <div>
                      <span className="text-[#252943]/50 text-[11px] block">Max Quantity</span>
                      <span className="font-bold text-[#252943]">{activeService.maxQuantity.toLocaleString()} units</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 2: BULK ADD (SECOND SECTION) OR SINGLE TARGET INPUT */}
          {/* Exact Vertical Position 2 */}
          {/* ========================================================================= */}
          {bulkAddEnabled ? (
            <div id="section-bulk-add" className="bg-white rounded-2xl border border-blue-300 p-6 shadow-subtle space-y-5 animate-fadeIn">
              <div className="pb-3 border-b border-[#DEE0ED] flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#3A4EFB] flex items-center gap-1.5">
                  <ListPlus className="w-4 h-4" />
                  2. Bulk Add — Multi-Link Batch Preparation
                </span>
                <button
                  type="button"
                  id="bulk-clear-all-btn"
                  onClick={handleClearAllBulk}
                  className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All Links
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="bulk-tiktok-urls" className="text-xs font-semibold text-[#252943]">
                    Paste Video Links (One link per line)
                  </label>
                  <span className="text-[11px] text-[#252943]/50">
                    Long, mobile, photo, and short TikTok links supported
                  </span>
                </div>

                <form onSubmit={handleAddSingleVideo} className="space-y-1.5">
                  <div className="flex flex-col sm:flex-row items-stretch gap-2">
                    <input
                      id="single-video-url"
                      type="text"
                      placeholder="Paste one TikTok link and press Enter (vm., vt., /t/ links supported)"
                      value={singleVideoInput}
                      onChange={(e) => {
                        setSingleVideoInput(e.target.value);
                        setSingleVideoError(null);
                      }}
                      disabled={singleVideoAdding}
                      className="flex-1 bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#252943] placeholder-[#252943]/40 focus:border-[#3A4EFB] focus:bg-white transition-colors disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      id="add-single-video-btn"
                      disabled={singleVideoAdding || !singleVideoInput.trim()}
                      className="px-4 py-2.5 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-xs font-bold transition-all press-scale flex items-center justify-center gap-1.5 shadow-subtle disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {singleVideoAdding ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Resolving...
                        </>
                      ) : (
                        <>
                          <ListPlus className="w-3.5 h-3.5" />
                          Add Video
                        </>
                      )}
                    </button>
                  </div>
                  {singleVideoError && (
                    <p className="text-[11px] text-red-600 flex items-start gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{singleVideoError}</span>
                    </p>
                  )}
                </form>

                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-[#252943]/40">
                  <span className="h-px flex-1 bg-[#DEE0ED]" />
                  Or paste multiple links
                  <span className="h-px flex-1 bg-[#DEE0ED]" />
                </div>

                {/* Multiline Textarea supporting long URLs with horizontal scrolling */}
                <textarea
                  id="bulk-tiktok-urls"
                  rows={6}
                  wrap="off"
                  placeholder={`https://www.tiktok.com/@studyora.co/video/7698652584520813844\nhttps://vt.tiktok.com/ZMabc123/\nhttps://m.tiktok.com/v/7123456789012345678.html`}
                  value={bulkRawLinks}
                  onChange={(e) => setBulkRawLinks(e.target.value)}
                  style={{
                    whiteSpace: "pre",
                    overflowX: "auto",
                    wordBreak: "normal",
                    overflowWrap: "normal",
                  }}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl p-3.5 text-xs font-mono text-[#252943] focus:border-[#3A4EFB] focus:bg-white leading-relaxed resize-y min-h-[140px]"
                />

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <label htmlFor="bulk-default-qty" className="text-xs font-medium text-[#252943] whitespace-nowrap">
                      Default Quantity:
                    </label>
                    <input
                      id="bulk-default-qty"
                      type="number"
                      min={1}
                      max={100000}
                      value={bulkDefaultQty}
                      onChange={(e) => setBulkDefaultQty(parseInt(e.target.value, 10) || 0)}
                      className="w-28 bg-[#F8F9FD] border border-[#DEE0ED] rounded-lg px-2.5 py-1 text-xs font-bold"
                    />
                  </div>

                  <button
                    type="button"
                    id="parse-bulk-links-btn"
                    onClick={handleParseBulkLinks}
                    disabled={bulkParsing || !bulkRawLinks.trim()}
                    className="px-4 py-2 rounded-xl bg-[#252943] hover:bg-[#1A1D31] text-white text-xs font-bold transition-all press-scale flex items-center justify-center gap-1.5 shadow-subtle disabled:opacity-50"
                  >
                    {bulkParsing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Validating Links...
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5 text-[#E3FF3B]" />
                        Parse & Check Links
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Bulk Summary Bar */}
              {bulkSummary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-[#DEE0ED] text-xs">
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] text-emerald-800 uppercase font-bold block">Ready to Submit</span>
                    <span className="text-base font-extrabold text-emerald-700">{readyOrders.length}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="text-[10px] text-amber-800 uppercase font-bold block">Duplicates</span>
                    <span className="text-base font-extrabold text-amber-700">{bulkSummary.duplicateRows}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                    <span className="text-[10px] text-blue-800 uppercase font-bold block">Active Orders</span>
                    <span className="text-base font-extrabold text-blue-700">{bulkSummary.activeOrderRows}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-red-50 border border-red-200">
                    <span className="text-[10px] text-red-800 uppercase font-bold block">Invalid Rows</span>
                    <span className="text-base font-extrabold text-red-700">{bulkSummary.invalidRows}</span>
                  </div>
                </div>
              )}

              {/* Prepared Video Cards */}
              {generatedOrders.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-[#252943]">
                        Prepared Orders — {videoGroups.length} {videoGroups.length === 1 ? "Video" : "Videos"},{" "}
                        {generatedOrders.length} Service Orders
                      </span>
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold text-[10px] border border-emerald-200">
                        {readyOrders.length} Ready
                      </span>
                      {randomizerEnabled && (
                        <span className="text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded font-semibold text-[10px] border border-purple-200">
                          Randomizer Active
                        </span>
                      )}
                    </div>
                    {comboMakerEnabled && activeCombo && (
                      <span className="text-[#3A4EFB] text-[11px]">
                        {activeCombo.items.length} combo services per video
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                    {videoGroups.map((group) => (
                      <div
                        key={group.canonicalKey}
                        className="rounded-xl border border-[#DEE0ED] bg-white overflow-hidden"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 bg-[#F8F9FD] border-b border-[#DEE0ED]">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-extrabold uppercase tracking-wide whitespace-nowrap">
                              Video {group.label}
                            </span>
                            <span
                              className="font-mono text-[11px] text-[#252943] truncate"
                              title={group.url}
                            >
                              {compactVideoUrl(group.url)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(group.url);
                                setCopiedVideoKey(group.canonicalKey);
                                setTimeout(() => setCopiedVideoKey(null), 1500);
                              }}
                              className="p-1.5 rounded-lg text-[#252943]/60 hover:text-[#3A4EFB] hover:bg-white transition-colors"
                              title="Copy video link"
                            >
                              {copiedVideoKey === group.canonicalKey ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <a
                              href={group.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg text-[#252943]/60 hover:text-[#3A4EFB] hover:bg-white transition-colors"
                              title="Open video"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleRemoveVideo(group.canonicalKey)}
                              className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-white transition-colors"
                              title="Remove video"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="divide-y divide-[#DEE0ED]/60">
                          {group.rows.map((row) => {
                            const quantityInvalid =
                              row.quantity < row.minQuantity || row.quantity > row.maxQuantity;
                            const rowCost = (row.quantity / 1000) * row.ratePer1000;

                            return (
                              <div key={row.id} className="p-3.5 space-y-2">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                  <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-[#252943] text-xs">
                                        #{row.serviceExternalId}
                                      </span>
                                      <span
                                        className="text-[11px] text-[#252943]/80 truncate max-w-[220px]"
                                        title={row.serviceName}
                                      >
                                        {row.serviceName}
                                      </span>
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3A4EFB]/10 text-[#3A4EFB] font-semibold">
                                        {row.platform}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-[#252943]/50">
                                      ₹{row.ratePer1000.toFixed(2)} / 1k · Min{" "}
                                      {row.minQuantity.toLocaleString()} · Max{" "}
                                      {row.maxQuantity.toLocaleString()}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <label
                                      htmlFor={`video-qty-${row.id}`}
                                      className="text-[10px] font-semibold text-[#252943]/60 uppercase"
                                    >
                                      Qty
                                    </label>
                                    <input
                                      id={`video-qty-${row.id}`}
                                      type="number"
                                      min={row.minQuantity}
                                      max={row.maxQuantity}
                                      value={row.quantity}
                                      onChange={(e) =>
                                        handleUpdateRowQuantity(row.id, parseInt(e.target.value, 10) || 0)
                                      }
                                      className={`w-24 bg-white border rounded-lg px-2 py-1 text-xs font-bold text-right focus:outline-none ${
                                        quantityInvalid
                                          ? "border-red-400 focus:border-red-500 text-red-700"
                                          : "border-[#DEE0ED] focus:border-[#3A4EFB]"
                                      }`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveRow(row.id)}
                                      className="p-1 rounded text-red-400 hover:text-red-700"
                                      title="Remove service row"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded inline-block ${
                                        row.status === "VALID"
                                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                          : row.status === "BATCH_DUPLICATE"
                                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                                          : row.status === "EXISTING_ACTIVE_ORDER"
                                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                                          : "bg-red-50 text-red-700 border border-red-200"
                                      }`}
                                    >
                                      {row.statusLabel}
                                    </span>
                                    {row.errorMessage && (
                                      <span className="text-[10px] text-red-600">
                                        {row.errorMessage}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] font-bold text-[#252943]/70">
                                    ₹{rowCost.toFixed(rowCost < 0.01 ? 4 : 2)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submission Outcomes Table (After Submit) */}
              {bulkSubmissionOutcomes && (
                <div className="p-4 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-2">
                  <span className="text-xs font-bold text-[#252943] block">
                    Submission Outcomes Per Row
                  </span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {bulkSubmissionOutcomes.map((out, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg text-xs flex items-center justify-between ${
                          out.success ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                        }`}
                      >
                        <span className="font-mono text-[11px] truncate max-w-[240px]">
                          {out.url}
                        </span>
                        <span className="font-bold text-[10px]">
                          {out.success ? `Accepted (${out.orderRef})` : `Failed: ${out.errorMessage}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Single Target URL Configuration (when Bulk Add is OFF) */
            <div id="section-single-order" className="bg-white rounded-2xl border border-[#DEE0ED] p-6 shadow-subtle space-y-5">
              <div className="pb-3 border-b border-[#DEE0ED]">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#3A4EFB] flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#3A4EFB]/10 text-[#3A4EFB] flex items-center justify-center text-[11px] font-bold">2</span>
                  {comboMakerEnabled ? "Combo Campaign Target Link" : "Single Order Target & Quantity"}
                </span>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="target-url" className="text-xs font-medium text-[#252943]">
                    Target Link / Profile URL
                  </label>
                  <input
                    id="target-url"
                    type="url"
                    placeholder="https://www.tiktok.com/@creator/video/7123456789012345678"
                    value={comboMakerEnabled ? comboTargetUrl : targetUrl}
                    onChange={(e) =>
                      comboMakerEnabled ? setComboTargetUrl(e.target.value) : setTargetUrl(e.target.value)
                    }
                    className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#252943] placeholder-[#252943]/40 focus:border-[#3A4EFB] focus:bg-white transition-colors"
                  />
                </div>

                {!comboMakerEnabled && (
                  <>
                    {deliveryStrategy !== "DRIP_FEED" && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label htmlFor="quantity-input" className="text-xs font-medium text-[#252943]">
                            Requested Quantity
                          </label>
                          {activeService && (
                            <span className="text-[11px] text-[#252943]/60 font-medium">
                              Allowed: {activeService.minQuantity.toLocaleString()} – {activeService.maxQuantity.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <input
                          id="quantity-input"
                          type="number"
                          min={activeService?.minQuantity || 1}
                          max={activeService?.maxQuantity || 100000}
                          placeholder={`e.g. ${activeService?.minQuantity || 100}`}
                          value={quantity}
                          onChange={(e) => {
                            const val = e.target.value === "" ? "" : parseInt(e.target.value, 10);
                            setQuantity(isNaN(val as number) ? "" : val);
                          }}
                          className={`w-full bg-[#F8F9FD] border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#252943] font-semibold focus:bg-white transition-colors ${
                            isBelowMin || isAboveMax
                              ? "border-red-400 focus:border-red-500"
                              : "border-[#DEE0ED] focus:border-[#3A4EFB]"
                          }`}
                        />
                        {isBelowMin && (
                          <p className="text-xs text-red-600 flex items-center gap-1 mt-1 font-medium">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            Quantity is below minimum allowed ({activeService?.minQuantity.toLocaleString()}).
                          </p>
                        )}
                        {isAboveMax && (
                          <p className="text-xs text-red-600 flex items-center gap-1 mt-1 font-medium">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            Quantity exceeds maximum allowed ({activeService?.maxQuantity.toLocaleString()}).
                          </p>
                        )}
                      </div>
                    )}

                    {/* Delivery Strategy Selector */}
                    <div className="space-y-2.5 pt-3 border-t border-[#DEE0ED]">
                      <label className="text-xs font-semibold text-[#252943] block">
                        Delivery Strategy
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setDeliveryStrategy("INSTANT");
                            setIsPacingMode(false);
                          }}
                          className={`p-3 rounded-xl border text-left transition-all press-scale ${
                            deliveryStrategy === "INSTANT"
                              ? "border-[#3A4EFB] bg-[#3A4EFB]/10 text-[#3A4EFB] font-semibold"
                              : "border-[#DEE0ED] bg-[#F8F9FD] text-[#252943]/70 hover:bg-[#DEE0ED]/30"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <Zap className="w-3.5 h-3.5 text-[#3A4EFB]" /> Instant Delivery
                          </div>
                          <div className="text-[10px] text-[#252943]/50 font-normal mt-0.5">
                            Submit single immediate batch
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setDeliveryStrategy("PACING");
                            setIsPacingMode(true);
                          }}
                          className={`p-3 rounded-xl border text-left transition-all press-scale ${
                            deliveryStrategy === "PACING"
                              ? "border-[#3A4EFB] bg-[#3A4EFB]/10 text-[#3A4EFB] font-semibold"
                              : "border-[#DEE0ED] bg-[#F8F9FD] text-[#252943]/70 hover:bg-[#DEE0ED]/30"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <TrendingUp className="w-3.5 h-3.5 text-[#3A4EFB]" /> Delivery Pacing
                          </div>
                          <div className="text-[10px] text-[#252943]/50 font-normal mt-0.5">
                            Smooth algorithmic growth curves
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setDeliveryStrategy("DRIP_FEED");
                            setIsPacingMode(false);
                          }}
                          className={`p-3 rounded-xl border text-left transition-all press-scale ${
                            deliveryStrategy === "DRIP_FEED"
                              ? "border-[#3A4EFB] bg-[#3A4EFB]/10 text-[#3A4EFB] font-semibold ring-2 ring-[#3A4EFB]/20"
                              : "border-[#DEE0ED] bg-[#F8F9FD] text-[#252943]/70 hover:bg-[#DEE0ED]/30"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <CalendarClock className="w-3.5 h-3.5 text-[#3A4EFB]" /> Drip Feed (Random)
                          </div>
                          <div className="text-[10px] text-[#252943]/50 font-normal mt-0.5">
                            Random range anti-monotone batches
                          </div>
                        </button>
                      </div>

                      {/* Delivery Pacing Mode */}
                      {deliveryStrategy === "PACING" && activeService && (
                        <div className="pt-2 animate-fadeIn">
                          <DeliveryPacingEditor
                            service={activeService}
                            totalQuantity={numQty > 0 ? numQty : activeService.minQuantity}
                            onTotalQuantityChange={(qty) => setQuantity(qty)}
                            targetUrl={targetUrl}
                            onPlanChange={(plan) => setPacingPlan(plan)}
                          />
                        </div>
                      )}

                      {/* Drip Feed Random Range Mode */}
                      {deliveryStrategy === "DRIP_FEED" && activeService && (
                        <div className="pt-3 p-4 bg-gradient-to-br from-[#F8F9FD] to-indigo-50/40 rounded-xl border border-indigo-200/80 space-y-4 animate-fadeIn">
                          <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                            <div>
                              <h4 className="text-xs font-bold text-[#252943] flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-[#3A4EFB]" />
                                Drip Feed Random Range Configuration
                              </h4>
                              <p className="text-[11px] text-[#252943]/60">
                                Each run receives an independent random quantity within your range. Anti-monotone constraint guarantees no streaks &gt; 2.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={refreshDripPreview}
                              disabled={loadingDripPreview}
                              className="px-2.5 py-1 text-xs font-bold bg-[#3A4EFB] text-white rounded-lg hover:bg-[#2A3EDB] transition-all flex items-center gap-1 shrink-0"
                            >
                              <RotateCcw className={`w-3 h-3 ${loadingDripPreview ? "animate-spin" : ""}`} />
                              <span>Re-draw Pattern</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div>
                              <label className="text-[11px] font-semibold text-[#252943] block mb-1">
                                Min Per Run
                              </label>
                              <input
                                type="number"
                                min={activeService.minQuantity}
                                max={dripMaxQty}
                                value={dripMinQty}
                                onChange={(e) => setDripMinQty(Number(e.target.value))}
                                className="w-full bg-white border border-[#DEE0ED] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#252943] focus:border-[#3A4EFB]"
                              />
                              <span className="text-[10px] text-[#252943]/50">Min: {activeService.minQuantity}</span>
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-[#252943] block mb-1">
                                Max Per Run
                              </label>
                              <input
                                type="number"
                                min={dripMinQty}
                                max={activeService.maxQuantity}
                                value={dripMaxQty}
                                onChange={(e) => setDripMaxQty(Number(e.target.value))}
                                className="w-full bg-white border border-[#DEE0ED] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#252943] focus:border-[#3A4EFB]"
                              />
                              <span className="text-[10px] text-[#252943]/50">Max: {activeService.maxQuantity}</span>
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-[#252943] block mb-1">
                                Number of Runs
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={50}
                                value={dripRunsCount}
                                onChange={(e) => setDripRunsCount(Number(e.target.value))}
                                className="w-full bg-white border border-[#DEE0ED] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#252943] focus:border-[#3A4EFB]"
                              />
                              <span className="text-[10px] text-[#252943]/50">Runs to schedule</span>
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-[#252943] block mb-1">
                                Interval (Minutes)
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={1440}
                                value={dripInterval}
                                onChange={(e) => setDripInterval(Number(e.target.value))}
                                className="w-full bg-white border border-[#DEE0ED] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#252943] focus:border-[#3A4EFB]"
                              />
                              <span className="text-[10px] text-[#252943]/50">Between each run</span>
                            </div>
                          </div>

                          {/* Estimated Range & Final Price Summary Card */}
                          <div className="p-3 bg-white rounded-xl border border-indigo-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">Est. Total Range</span>
                              <span className="font-bold text-[#252943]">
                                {(dripMinQty * dripRunsCount).toLocaleString()} – {(dripMaxQty * dripRunsCount).toLocaleString()} units
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[#252943]/50 block">Est. Price Range</span>
                              <span className="font-bold text-[#252943]">
                                ₹{(((dripMinQty * dripRunsCount) / 1000) * activeService.ratePer1000).toFixed(2)} – ₹{(((dripMaxQty * dripRunsCount) / 1000) * activeService.ratePer1000).toFixed(2)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-indigo-600 block">Actual Generated Total</span>
                              <span className="font-bold text-indigo-700">
                                {dripPreviewPlan ? `${dripPreviewPlan.actualTotalQuantity.toLocaleString()} units` : "Generating..."}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-emerald-600 block">Actual Final Charge</span>
                              <span className="font-extrabold text-emerald-700 text-sm">
                                ₹{dripPreviewPlan ? dripPreviewPlan.actualFinalCharge.toFixed(2) : "0.00"}
                              </span>
                            </div>
                          </div>

                          {/* Generated Sequence Chips */}
                          {dripPreviewPlan && Array.isArray(dripPreviewPlan.quantities) && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-semibold text-[#252943]">Generated Execution Sequence:</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Anti-monotone pattern: Verified (streak &le; 2)
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {dripPreviewPlan.quantities.map((qty: number, idx: number) => (
                                  <div
                                    key={idx}
                                    className="px-2.5 py-1.5 rounded-lg bg-white border border-[#DEE0ED] shadow-sm flex items-center gap-1.5 text-xs font-mono"
                                  >
                                    <span className="text-[10px] font-bold text-[#3A4EFB]">#{idx + 1}</span>
                                    <span className="font-bold text-[#252943]">{qty}</span>
                                    <span className="text-[10px] text-[#252943]/40">
                                      (+{idx * dripInterval}m)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 3: RANDOMIZER (THIRD SECTION) */}
          {/* Exact Vertical Position 3 */}
          {/* ========================================================================= */}
          {randomizerEnabled && (
            <div id="section-randomizer" className="bg-white rounded-2xl border border-purple-200 p-6 shadow-subtle space-y-4 animate-fadeIn">
              <div className="pb-3 border-b border-purple-100 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                  <Dices className="w-4 h-4 text-purple-600" />
                  3. Order Quantity Randomizer
                </span>
                <span className="text-[11px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full font-bold">
                  Active
                </span>
              </div>

              <p className="text-xs text-[#252943]/70 leading-relaxed font-normal">
                Generate natural, non-uniform order quantities centered on an average target. Prevents bot pattern detection across batch orders while strictly respecting each service&apos;s provider minimum and maximum.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label htmlFor="randomizer-avg-qty" className="text-[11px] font-semibold text-[#252943] block mb-1">
                    Average Target Quantity
                  </label>
                  <input
                    id="randomizer-avg-qty"
                    type="number"
                    min={1}
                    max={100000}
                    value={randomizerAvg}
                    onChange={(e) => setRandomizerAvg(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-lg px-2.5 py-1.5 font-bold text-[#252943]"
                  />
                </div>

                <div>
                  <label htmlFor="randomizer-variation" className="text-[11px] font-semibold text-[#252943] block mb-1">
                    Variation (+/- %)
                  </label>
                  <input
                    id="randomizer-variation"
                    type="number"
                    min={1}
                    max={50}
                    value={randomizerVariation}
                    onChange={(e) => setRandomizerVariation(parseInt(e.target.value, 10) || 15)}
                    className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-lg px-2.5 py-1.5 font-bold text-[#252943]"
                  />
                </div>

                <div>
                  <label htmlFor="randomizer-total-mode" className="text-[11px] font-semibold text-[#252943] block mb-1">
                    Total Sum Mode
                  </label>
                  <select
                    id="randomizer-total-mode"
                    value={randomizerExactTotal ? "EXACT" : "NATURAL"}
                    onChange={(e) => setRandomizerExactTotal(e.target.value === "EXACT")}
                    className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-lg px-2 py-1.5 font-bold text-[#252943]"
                  >
                    <option value="NATURAL">Natural Variance</option>
                    <option value="EXACT">Preserve Exact Total</option>
                  </select>
                </div>
              </div>

              {/* Randomizer Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {bulkAddEnabled && generatedOrders.length > 0 ? (
                  <>
                    <button
                      type="button"
                      id="randomize-all-bulk-btn"
                      onClick={handleRegenerateRandomizer}
                      className="px-3.5 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition-all press-scale flex items-center gap-1.5 shadow-subtle"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#E3FF3B]" />
                      <span>Randomize All Quantities</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRegenerateRandomizer}
                      className="px-3 py-1.5 rounded-lg bg-[#F8F9FD] border border-[#DEE0ED] text-[#252943] text-xs font-semibold hover:bg-[#DEE0ED]/50 transition-all flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" /> Regenerate
                    </button>
                    <button
                      type="button"
                      onClick={handleResetToDefault}
                      className="px-3 py-1.5 rounded-lg bg-[#F8F9FD] border border-[#DEE0ED] text-[#252943]/70 text-xs font-medium hover:bg-[#DEE0ED]/50"
                    >
                      Reset to Configured Default
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleRandomizeSingleOrder}
                    className="px-3.5 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition-all press-scale flex items-center gap-1.5 shadow-subtle"
                  >
                    <Dices className="w-3.5 h-3.5 text-[#E3FF3B]" />
                    <span>Randomize Quantity</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 4: PERSISTENT ORDER SCHEDULER (BOTTOM SECTION) */}
          {/* Exact Vertical Position 4 */}
          {/* ========================================================================= */}
          {schedulerEnabled && (
            <div id="section-scheduler" className="bg-white rounded-2xl border border-amber-300 p-6 shadow-subtle space-y-4 animate-fadeIn">
              <div className="pb-3 border-b border-amber-200 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4 text-amber-600" />
                  4. Persistent Order Scheduler
                </span>
                <span className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full font-bold border border-amber-300">
                  Worker-Backed Execution
                </span>
              </div>

              {/* Reliability Policy Banner */}
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 leading-relaxed flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong>Persistent Execution Guarantee:</strong> Scheduled jobs are stored in the backend database with UTC timestamps.
                  The backend worker daemon executes them automatically at the scheduled time — <strong>even if you close your browser or turn off your computer</strong> (provided the server/worker process remains running).
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label htmlFor="scheduler-date-input" className="text-[11px] font-semibold text-[#252943] block mb-1">
                    Scheduled Date
                  </label>
                  <input
                    id="scheduler-date-input"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-lg px-2.5 py-1.5 font-bold"
                  />
                </div>

                <div>
                  <label htmlFor="scheduler-time-input" className="text-[11px] font-semibold text-[#252943] block mb-1">
                    Scheduled Time ({userTimezone})
                  </label>
                  <input
                    id="scheduler-time-input"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-lg px-2.5 py-1.5 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#252943] block mb-1">
                    UTC Execution Target
                  </label>
                  <div className="p-1.5 rounded-lg bg-[#F8F9FD] border border-[#DEE0ED] font-mono text-[11px] text-[#252943]/80 truncate">
                    {scheduledDate && scheduledTime
                      ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString().replace(".000Z", " UTC")
                      : "—"}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-amber-100 text-xs">
                <span className="text-[#252943]/70">
                  Active jobs in queue: <strong>{scheduledJobsList.filter(j => j.status === "SCHEDULED" || j.status === "PROCESSING").length}</strong>
                </span>
                <button
                  type="button"
                  id="toggle-scheduled-drawer-btn"
                  onClick={() => setShowScheduledDrawer(!showScheduledDrawer)}
                  className="text-amber-800 hover:text-amber-900 font-bold flex items-center gap-1"
                >
                  <Clock className="w-3.5 h-3.5" />
                  {showScheduledDrawer ? "Hide Scheduled Jobs Queue" : "View Scheduled Jobs Queue"}
                </button>
              </div>

              {/* Drawer displaying scheduled jobs */}
              {showScheduledDrawer && (
                <div className="space-y-2 pt-2 border-t border-amber-200">
                  {scheduledJobsList.length === 0 ? (
                    <p className="text-xs text-[#252943]/60 italic py-2 text-center">
                      No jobs currently queued. New scheduled jobs will appear here upon submission.
                    </p>
                  ) : (
                    scheduledJobsList.map((job) => (
                      <div
                        key={job.id}
                        className="bg-[#F8F9FD] p-2.5 rounded-xl border border-[#DEE0ED] flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#252943]">{job.jobRef}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-[#252943] text-white">
                              {job.jobType}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                job.status === "COMPLETED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : job.status === "SCHEDULED"
                                  ? "bg-amber-100 text-amber-800"
                                  : job.status === "PAUSED"
                                  ? "bg-gray-200 text-gray-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {job.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#252943]/60">
                            Due: {new Date(job.scheduledFor).toLocaleString()} ({job.timezone})
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {job.status !== "COMPLETED" && job.status !== "CANCELLED" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleTogglePauseScheduledJob(job.id, job.status)}
                                title={job.status === "PAUSED" ? "Resume job" : "Pause job"}
                                className="p-1 rounded text-[#252943]/60 hover:text-[#252943]"
                              >
                                {job.status === "PAUSED" ? <Play className="w-3.5 h-3.5 text-emerald-600" /> : <Pause className="w-3.5 h-3.5 text-[#252943]" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelScheduledJob(job.id)}
                                title="Cancel scheduled job"
                                className="p-1 rounded text-red-500 hover:text-red-700"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* ========================================================================= */}
        {/* SIDE PANEL: ORDER SUMMARY & SUBMISSION */}
        {/* ========================================================================= */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#DEE0ED] p-6 shadow-subtle space-y-5 sticky top-20">
            <h2 className="text-sm font-semibold text-[#252943] pb-3 border-b border-[#DEE0ED]">
              Order Summary
            </h2>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-start justify-between gap-2 text-[#252943]/70">
                <span className="shrink-0 pt-0.5">Execution Mode</span>
                <span className="font-bold text-[#252943] text-right">
                  {executionModeLabel}
                </span>
              </div>

              {comboMakerEnabled ? (
                <div className="flex items-start justify-between gap-2 text-[#252943]/70">
                  <span className="shrink-0 pt-0.5">Combo Bundle</span>
                  <span className="font-semibold text-[#252943] text-right truncate max-w-[170px]" title={activeCombo?.name}>
                    [{activeCombo?.comboRef}] {activeCombo?.name}
                  </span>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2 text-[#252943]/70">
                  <span className="shrink-0 pt-0.5">Selected Service</span>
                  {activeService ? (
                    <span className="font-semibold text-[#252943] text-right truncate max-w-[170px]" title={`#${activeService.externalId} — ${activeService.name}`}>
                      #{activeService.externalId} {activeService.name}
                    </span>
                  ) : (
                    <span className="text-[#252943]/40 italic">Select a service</span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-[#252943]/70">
                <span>Total Orders Count</span>
                <span className="font-semibold text-[#252943]">
                  {totalOrdersCount > 0 ? `${totalOrdersCount} child order${totalOrdersCount > 1 ? "s" : ""}` : "—"}
                </span>
              </div>

              <div className="flex items-center justify-between text-[#252943]/70">
                <span>Total Quantity</span>
                <span className="font-semibold text-[#252943] tracking-tight text-sm">
                  {totalOrderQuantity > 0 ? `${totalOrderQuantity.toLocaleString()} units` : "—"}
                </span>
              </div>

              <div className="flex items-center justify-between text-[#252943]/70">
                <span>Randomizer</span>
                <span className={`font-medium flex items-center gap-1 text-[11px] ${randomizerEnabled ? "text-purple-700 font-bold" : "text-[#252943]/60"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${randomizerEnabled ? "bg-purple-500" : "bg-gray-300"}`} />
                  {randomizerEnabled ? "Enabled (Variance Active)" : "Disabled (Default Qty)"}
                </span>
              </div>

              <div className="flex items-center justify-between text-[#252943]/70">
                <span>Scheduler</span>
                <span className="font-medium text-[#252943] flex items-center gap-1 text-[11px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${schedulerEnabled ? "bg-amber-500" : "bg-emerald-500"}`} />
                  {schedulerEnabled ? "Future Persistent Run" : "Immediate Run"}
                </span>
              </div>

              <div className="pt-3 border-t border-[#DEE0ED] flex items-baseline justify-between">
                <div>
                  <span className="text-xs font-bold text-[#252943] block">Estimated Total</span>
                  <p className="text-[11px] text-[#252943]/50">
                    {effectiveCost > 0 ? "Exact charge upon confirmation" : "Based on service pricing"}
                  </p>
                </div>
                <div className="text-2xl font-extrabold text-[#3A4EFB] tracking-tight">
                  ₹{effectiveCost > 0 ? (effectiveCost < 0.01 ? effectiveCost.toFixed(4) : effectiveCost.toFixed(2)) : "0.00"}
                </div>
              </div>

              {/* Balance Before & After */}
              <div className="pt-3 border-t border-[#DEE0ED] space-y-2 text-xs bg-[#F8F9FD] p-3 rounded-xl border border-[#DEE0ED]/80">
                <div className="flex items-center justify-between text-[#252943]/70">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Wallet className="w-3.5 h-3.5 text-[#3A4EFB]" />
                    Provider Balance
                  </span>
                  <span className="font-bold text-[#252943]">
                    {loadingBalance ? "..." : formatProviderBalance(providerBalance, providerCurrency)}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-[#DEE0ED]/60 pt-1.5">
                  <span className="font-semibold text-[#252943]">Balance After Order</span>
                  <span className={`font-bold text-xs tracking-tight ${
                    projectedBalance === null ? "text-[#252943]/50" : projectedBalance >= 0 ? "text-emerald-700" : "text-red-600"
                  }`}>
                    {loadingBalance ? "..." : projectedBalance === null ? "Unavailable" : (
                      projectedBalance >= 0
                        ? formatCurrency(projectedBalance, 2, providerCurrency || "INR")
                        : `-${formatCurrency(Math.abs(projectedBalance), 2, providerCurrency || "INR")}`
                    )}
                  </span>
                </div>

                {hasInsufficientBalance && (
                  <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-700 flex items-start gap-1.5 mt-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                    <span>Insufficient balance. You need {formatCurrency(Math.abs(projectedBalance ?? 0), 2, providerCurrency || "INR")} more.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Submission Button */}
            <button
              type="button"
              id="review-order-submit-btn"
              disabled={!canProceed}
              onClick={() => setShowConfirmModal(true)}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-all press-scale flex items-center justify-center gap-2 shadow-subtle ${
                canProceed
                  ? schedulerEnabled
                    ? "bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                    : "bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white cursor-pointer"
                  : "bg-[#DEE0ED] text-[#252943]/40 cursor-not-allowed"
              }`}
            >
              {schedulerEnabled ? (
                <>
                  <CalendarClock className="w-4 h-4 text-[#E3FF3B]" />
                  Schedule Persistent Order
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Review & Confirm Order
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-[#252943]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full border border-[#DEE0ED] p-6 shadow-dropdown space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
              <h3 className="text-base font-semibold text-[#252943] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#3A4EFB]" />
                {schedulerEnabled ? "Confirm Scheduled Order" : "Confirm Order Placement"}
              </h3>
              <button
                id="close-confirm-modal-btn"
                onClick={() => setShowConfirmModal(false)}
                className="text-[#252943]/40 hover:text-[#252943] text-sm font-medium"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-2.5 text-xs bg-[#F8F9FD] p-4 rounded-xl border border-[#DEE0ED]/70">
              <div className="flex justify-between">
                <span className="text-[#252943]/60">Order Mode</span>
                <span className="font-bold text-[#252943]">{executionModeLabel}</span>
              </div>

              {comboMakerEnabled && activeCombo && (
                <div className="flex justify-between">
                  <span className="text-[#252943]/60">Combo Bundle</span>
                  <span className="font-bold text-[#252943]">
                    [{activeCombo.comboRef}] {activeCombo.name}
                  </span>
                </div>
              )}

              {!comboMakerEnabled && activeService && (
                <div className="flex justify-between">
                  <span className="text-[#252943]/60">Service</span>
                  <span className="font-semibold text-[#252943] text-right truncate max-w-[200px]">
                    #{activeService.externalId} {activeService.name}
                  </span>
                </div>
              )}

              {bulkAddEnabled ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-[#252943]/60">Prepared Videos</span>
                    <span className="font-bold text-[#252943]">
                      {videoGroups.length} video{videoGroups.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#252943]/60">Valid Prepared Orders</span>
                    <span className="font-bold text-[#252943]">
                      {readyOrders.length} order{readyOrders.length > 1 ? "s" : ""}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-[#252943]/60">Target Link</span>
                  <span className="font-medium text-[#252943] text-right truncate max-w-[200px] break-all">
                    {comboMakerEnabled ? comboTargetUrl : targetUrl}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-[#252943]/60">Total Quantity</span>
                <span className="font-bold text-[#252943]">
                  {totalOrderQuantity.toLocaleString()} units
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-[#252943]/60">Randomizer Status</span>
                <span className={`font-bold ${randomizerEnabled ? "text-purple-700" : "text-[#252943]/70"}`}>
                  {randomizerEnabled ? "Active (Quantities Randomized)" : "Inactive (Configured Defaults)"}
                </span>
              </div>

              {schedulerEnabled && (
                <div className="flex justify-between border-t border-[#DEE0ED]/60 pt-2 text-amber-800">
                  <span className="font-semibold">Execution Time</span>
                  <span className="font-bold">
                    {scheduledDate} {scheduledTime} ({userTimezone})
                  </span>
                </div>
              )}

              <div className="flex justify-between border-t border-[#DEE0ED]/60 pt-2 items-baseline">
                <span className="font-semibold text-[#252943]">Total Charge</span>
                <span className="font-bold text-[#3A4EFB] text-base">
                  ₹{effectiveCost > 0 ? (effectiveCost < 0.01 ? effectiveCost.toFixed(4) : effectiveCost.toFixed(2)) : "0.00"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl border border-[#DEE0ED] text-xs font-semibold text-[#252943] hover:bg-[#F8F9FD] transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                id="final-submit-order-btn"
                onClick={handleSubmitOrder}
                disabled={submitting}
                className={`flex-1 py-2.5 rounded-xl text-white text-xs font-semibold transition-all press-scale flex items-center justify-center gap-1.5 shadow-subtle ${
                  schedulerEnabled ? "bg-amber-600 hover:bg-amber-700" : "bg-[#3A4EFB] hover:bg-[#2C3FE0]"
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#E3FF3B]" />
                    {schedulerEnabled ? "Confirm Schedule" : "Confirm & Submit"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="flex items-center gap-2 text-sm text-[#252943]/60">
            <Loader2 className="w-5 h-5 animate-spin text-[#3A4EFB]" />
            <span>Loading order system...</span>
          </div>
        </div>
      }
    >
      <NewOrderPageContent />
    </Suspense>
  );
}

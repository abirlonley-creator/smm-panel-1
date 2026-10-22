"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  AlertCircle,
  Activity,
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  Heart,
  Key,
  Layers,
  Loader2,
  LogIn,
  Pause,
  Play,
  Radar,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Square,
  Timer,
  TrendingUp,
  Zap,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types (mirror of /api/likes-analyze responses)
// ---------------------------------------------------------------------------

interface MonitorService {
  id: string;
  externalId?: string;
  name: string;
  platform?: string;
  category?: string;
  ratePer1000: number;
  minQuantity: number;
  maxQuantity: number;
  isMock?: boolean;
}

interface MonitoringSession {
  id: string;
  orderRef: string;
  videoUrl: string;
  videoIdentifier: string;
  status: string;
  analyticsSource: string;
  durationMinutes: number;
  intervalMinutes: number;
  budgetCap: number;
  quantityCap: number;
  startedAt: string;
  expiresAt: string;
  lastCheckpointAt?: string | null;
  nextCheckpointAt?: string | null;
  initialLikes?: number | null;
  initialViews?: number | null;
  snapshotCount: number;
  missedCheckpoints: number;
  scheduleReviserCount: number;
  stopNote?: string | null;
  service: MonitorService;
  checkpoints: Array<{ id: string; sequence: number; plannedAt: string; executedAt?: string | null; delayMs?: number | null; status: string }>;
  snapshots: Array<{
    id: string;
    sequence: number;
    plannedAt: string;
    executedAt: string;
    delayMs: number;
    likes?: number | null;
    views?: number | null;
    likesDelta?: number | null;
    viewsDelta?: number | null;
    ratio?: number | null;
    source: string;
    isFresh: boolean;
    reliabilityNote?: string | null;
  }>;
  events: Array<{ id: string; action: string; details: string; createdAt: string }>;
  order?: {
    id: string;
    orderRef: string;
    status: string;
    submittedQuantity: number;
    deliveredQuantity: number;
    remainingQuantity: number;
    providerOrderId?: string | null;
    steps: Array<{ id: string; stepNumber: number; quantity: number; status: string; idempotencyKey?: string; providerOrderId?: string | null; scheduledTime: string; errorMessage?: string | null }>;
  } | null;
}

interface OrderStep {
  id: string;
  stepNumber: number;
  quantity: number;
  status: string;
  idempotencyKey?: string;
  providerOrderId?: string | null;
  scheduledTime: string;
  errorMessage?: string | null;
}

interface SessionStateResponse {
  success: boolean;
  session: MonitoringSession;
  analytics: {
    totalLikesGained: number | null;
    totalViewsGained: number | null;
    observedRatio: number | null;
    dataFreshness: { freshCount: number; totalSnapshots: number };
  };
  budget: { cap: number; spent: number; remaining: number; unitCost: number };
  quantity: { cap: number; committed: number; remaining: number; pendingQuantity: number };
  jobs: {
    pending: OrderStep[];
    inProgress: OrderStep[];
    submitted: OrderStep[];
    failed: OrderStep[];
  };
  missedCheckpointCount: number;
  warnings: string[];
}

export interface LikesAnalyzeMonitorProps {
  service: MonitorService | null;
  targetUrl: string;
}

const DURATION_PRESETS = [
  { value: 60, label: "1h" },
  { value: 120, label: "2h" },
  { value: 240, label: "4h" },
  { value: 480, label: "8h" },
  { value: 1440, label: "24h" },
];

const INTERVAL_PRESETS = [
  { value: 15, label: "15m" },
  { value: 21, label: "21m" },
  { value: 25, label: "25m" },
  { value: 30, label: "30m" },
  { value: 45, label: "45m" },
  { value: 60, label: "60m" },
];

const STATUS_DOT: Record<string, string> = {
  RUNNING: "bg-emerald-400",
  PAUSED: "bg-amber-400",
  COMPLETED: "bg-[#3A4EFB]",
  STOPPED: "bg-gray-400",
  EXPIRED: "bg-gray-400",
};

const STATUS_BADGE: Record<string, string> = {
  RUNNING: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PAUSED: "bg-amber-50 text-amber-700 border-amber-200",
  COMPLETED: "bg-blue-50 text-blue-700 border-blue-200",
  STOPPED: "bg-gray-100 text-gray-600 border-gray-200",
  EXPIRED: "bg-gray-100 text-gray-600 border-gray-200",
};

const SESSION_STATUS_STYLES = STATUS_BADGE;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatK(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}

function formatRatio(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(2)}%`;
}

function formatDelay(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtCountdown(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LikesAnalyzeMonitor({ service, targetUrl }: LikesAnalyzeMonitorProps) {
  const [sessions, setSessions] = useState<MonitoringSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [state, setState] = useState<SessionStateResponse | null>(null);
  const [loadingState, setLoadingState] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  // Auth
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authKeyInput, setAuthKeyInput] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Create form
  const [urlInput, setUrlInput] = useState(targetUrl);
  const [availableServices, setAvailableServices] = useState<MonitorService[]>(service ? [service] : []);
  const [selectedServiceId, setSelectedServiceId] = useState(service?.id || "");
  const [serviceSearchInput, setServiceSearchInput] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [searchingServices, setSearchingServices] = useState(false);
  const [serviceSearchMessage, setServiceSearchMessage] = useState<string | null>(null);
  const [durationMode, setDurationMode] = useState(240);
  const [customDurationMinutes, setCustomDurationMinutes] = useState(240);
  const [intervalMode, setIntervalMode] = useState(30);
  const [customIntervalMinutes, setCustomIntervalMinutes] = useState(30);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Controls
  const [acting, setActing] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Clock
  const [nowMs, setNowMs] = useState(Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync prop URL
  useEffect(() => {
    if (targetUrl?.trim()) setUrlInput(targetUrl.trim());
  }, [targetUrl]);

  // Load services catalog
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCatalogLoading(true);
      try {
        const res = await fetch("/api/services?page=1&pageSize=15");
        const data = await res.json();
        if (!res.ok || !data.success || !Array.isArray(data.services)) return;
        if (!cancelled) {
          setAvailableServices((cur) => {
            const byId = new Map(cur.map((i) => [i.id, i]));
            for (const i of data.services as MonitorService[]) byId.set(i.id, i);
            return Array.from(byId.values());
          });
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedServiceId && service?.id) setSelectedServiceId(service.id);
  }, [service, selectedServiceId]);

  // Auth check
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/auth");
      const data = await res.json();
      setIsAuthenticated(!!data.authenticated);
    } catch { setIsAuthenticated(false); }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  async function handleLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!authKeyInput.trim()) { setLoginError("Enter your access key."); return; }
    setLoggingIn(true); setLoginError(null);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: authKeyInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Auth failed.");
      setIsAuthenticated(true);
      setShowLoginModal(false);
      setAuthKeyInput("");
    } catch (err: any) {
      setLoginError(err.message || "Failed to authenticate.");
    } finally { setLoggingIn(false); }
  }

  async function handleServiceSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = serviceSearchInput.trim();
    if (!q) { setServiceSearchMessage("Enter a service ID or name."); return; }
    setSearchingServices(true); setServiceSearchMessage(null);
    try {
      let results: MonitorService[] = [];
      const exactRes = await fetch(`/api/services?serviceId=${encodeURIComponent(q)}`);
      const exactData = await exactRes.json();
      if (exactRes.ok && exactData.success && Array.isArray(exactData.services)) results = exactData.services;
      if (results.length === 0) {
        const res = await fetch(`/api/services?search=${encodeURIComponent(q)}&page=1&pageSize=15`);
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.services)) results = data.services;
      }
      setAvailableServices((cur) => {
        const byId = new Map(cur.map((i) => [i.id, i]));
        for (const i of results) byId.set(i.id, i);
        return Array.from(byId.values());
      });
      setServiceSearchMessage(results.length > 0 ? `${results.length} service${results.length === 1 ? "" : "s"} found.` : "No services found.");
    } catch { setServiceSearchMessage("Search failed."); }
    finally { setSearchingServices(false); }
  }

  // Sessions
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch("/api/likes-analyze", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success || !Array.isArray(data.sessions)) throw new Error(data.error || "Failed.");
      setSessions(data.sessions);
      setSessionsError(null);
      return data.sessions as MonitoringSession[];
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : "Failed to load.");
      return [];
    } finally { setSessionsLoading(false); }
  }, []);

  const loadSessionState = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/likes-analyze/${id}`);
      const data = await res.json();
      if (data.success) setState(data);
    } catch { /* keep last known */ }
  }, []);

  const selectSession = useCallback(async (id: string) => {
    setSelectedSessionId(id);
    setState(null);
    setLoadingState(true);
    try { await loadSessionState(id); }
    finally { setLoadingState(false); }
  }, [loadSessionState]);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  // Polling
  useEffect(() => {
    if (!selectedSessionId) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => loadSessionState(selectedSessionId), 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedSessionId, loadSessionState]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const effectiveDuration = durationMode === 0 ? customDurationMinutes : durationMode;
  const effectiveInterval = intervalMode === 0 ? customIntervalMinutes : intervalMode;

  async function handleCreate() {
    const svc = availableServices.find((i) => i.id === selectedServiceId) ?? (service?.id === selectedServiceId ? service : null);
    if (!svc) { setCreateError("Select a provider service."); return; }
    const url = urlInput.trim();
    if (!/^https?:\/\/.{5,}/i.test(url)) { setCreateError("Enter a valid video URL."); return; }
    if (effectiveDuration <= 0) { setCreateError("Duration must be > 0."); return; }
    if (effectiveInterval <= 0 || effectiveInterval > effectiveDuration) { setCreateError("Interval must be between 1 and the total duration."); return; }
    setCreating(true); setCreateError(null); setActionMsg(null);
    try {
      const res = await fetch("/api/likes-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: svc.id, videoUrl: url, durationMinutes: effectiveDuration, intervalMinutes: effectiveInterval }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to start.");
      await loadSessions();
      setSelectedSessionId(null);
      setState(null);
      setActionMsg({ text: "Monitoring session started.", type: "success" });
    } catch (err: any) {
      setCreateError(err.message || "Failed to start.");
    } finally { setCreating(false); }
  }

  async function handleControl(action: "pause" | "resume" | "stop") {
    if (!state) return;
    setActing(action); setActionMsg(null);
    try {
      const res = await fetch(`/api/likes-analyze/${state.session.id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `${action} failed`);
      await loadSessionState(state.session.id);
      await loadSessions();
      setActionMsg({ text: data.message || `Session ${action} applied.`, type: "success" });
    } catch (err: any) {
      setActionMsg({ text: err.message || "Action failed.", type: "error" });
    } finally { setActing(null); }
  }

  // Derived
  const session = state?.session;
  const selectedService = availableServices.find((i) => i.id === selectedServiceId) ?? (service?.id === selectedServiceId ? service : null);
  const isRunning = session?.status === "RUNNING";
  const timeLeftMs = session ? Math.max(0, new Date(session.expiresAt).getTime() - nowMs) : 0;

  const timeLeftLabel = useMemo(() => {
    if (!session) return "—";
    if (["EXPIRED", "STOPPED", "COMPLETED"].includes(session.status)) return "Ended";
    return fmtCountdown(timeLeftMs);
  }, [session, timeLeftMs]);

  const nextCpCountdown = useMemo(() => {
    if (!session?.nextCheckpointAt || !isRunning) return null;
    const ms = Math.max(0, new Date(session.nextCheckpointAt).getTime() - nowMs);
    if (ms <= 0) return "Evaluating...";
    return fmtCountdown(ms);
  }, [session, isRunning, nowMs]);

  // Likes trend chart
  const chart = useMemo(() => {
    if (!session) return null;
    const fresh = session.snapshots.filter((s) => s.isFresh && s.likes != null);
    if (fresh.length === 0) return null;

    const totalPlanCount = session.checkpoints?.length || 0;
    const totalSlots = Math.max(totalPlanCount, fresh.length, 2);

    const maxL = Math.max(...fresh.map((s) => s.likes as number), 1);
    const minL = Math.min(...fresh.map((s) => s.likes as number), 0);
    const range = Math.max(maxL - minL, 1);

    const W = 1000;
    const H = 180;
    const padLeft = 48;
    const padRight = 48;
    const padTop = 36;
    const padBottom = 36;
    const plotW = W - padLeft - padRight;
    const plotH = H - padTop - padBottom;

    const getX = (seq: number) => {
      const idx = Math.max(0, seq - 1);
      return padLeft + (idx / (totalSlots - 1)) * plotW;
    };

    const getY = (likes: number) => {
      if (maxL === minL) return padTop + plotH * 0.5;
      return padTop + plotH - ((likes - minL) / range) * plotH;
    };

    const pts = fresh.map((s) => {
      const x = getX(s.sequence);
      const y = getY(s.likes as number);
      const pctX = (x / W) * 100;
      const pctY = (y / H) * 100;
      return { s, x, y, pctX, pctY };
    });

    const baselineY = padTop + plotH;
    const lastPt = pts[pts.length - 1];

    let line = "";
    let area = "";

    if (pts.length >= 2) {
      line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
      area = `M ${pts[0].x.toFixed(1)} ${baselineY.toFixed(1)} ` +
        pts.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") +
        ` L ${lastPt.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
    }

    // Future planned checkpoints (if any)
    const futureCheckpoints = (session.checkpoints || [])
      .filter((cp) => cp.sequence > lastPt.s.sequence)
      .map((cp) => {
        const x = getX(cp.sequence);
        const pctX = (x / W) * 100;
        return { cp, x, pctX };
      });

    // Future dashed guide line extending from last executed point
    let futureLine = "";
    if (futureCheckpoints.length > 0 && lastPt) {
      const endX = getX(totalSlots);
      futureLine = `M ${lastPt.x.toFixed(1)} ${lastPt.y.toFixed(1)} L ${endX.toFixed(1)} ${lastPt.y.toFixed(1)}`;
    }

    // Timeline slots for bottom axis
    const slots = Array.from({ length: totalSlots }, (_, i) => {
      const sequence = i + 1;
      const x = getX(sequence);
      const pctX = (x / W) * 100;
      const matchedSnapshot = fresh.find((s) => s.sequence === sequence);
      const matchedCp = session.checkpoints?.find((c) => c.sequence === sequence);
      const timeStr = matchedSnapshot
        ? fmtTime(matchedSnapshot.executedAt)
        : matchedCp?.plannedAt
        ? fmtTime(matchedCp.plannedAt)
        : `T+${sequence * (session.intervalMinutes || 15)}m`;

      return {
        sequence,
        pctX,
        isExecuted: !!matchedSnapshot,
        time: timeStr,
      };
    });

    return {
      pts,
      area,
      line,
      futureLine,
      futureCheckpoints,
      slots,
      maxL,
      minL,
      lastPt,
      W,
      H,
      totalSlots,
    };
  }, [session]);

  // Interval log rows (most recent 8)
  const intervalRows = useMemo(() => {
    if (!session) return [];
    return [...session.snapshots].reverse().slice(0, 8).map((s) => {
      const matchedStep = session.order?.steps?.find(
        (step) => step.idempotencyKey === `${session.orderRef}-chk-${s.sequence}`
      ) ?? null;
      const eventForCheckpoint = (action: string) => session.events?.find(
        (event) => event.action === action && event.details.includes(`Checkpoint #${s.sequence}:`)
      );
      const assessment = eventForCheckpoint("SCHEDULE_ASSESSED");
      const skipped = eventForCheckpoint("BATCH_SKIPPED");
      const appliedRatio = assessment?.details.match(/(\d+\.\d+)%\sratio/)?.[1] ?? null;
      const selectedRatio = assessment?.details.match(/selected (\d+\.\d+)% target/)?.[1] ?? null;
      return { s, matchedStep, skipped, appliedRatio, selectedRatio };
    });
  }, [session]);

  const totalSubmitted = useMemo(() =>
    (state?.jobs.submitted ?? []).reduce((a, s) => a + s.quantity, 0),
    [state]
  );

  return (
    <div className="space-y-4 text-[#252943]">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#3A4EFB]/10 flex items-center justify-center">
            <Radar className="w-4 h-4 text-[#3A4EFB]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#252943] leading-none">Likes Analyze</h2>
            <p className="text-[11px] text-[#252943]/50 mt-0.5">Real-time interval monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" /> Admin
            </div>
          ) : (
            <button
              onClick={() => setShowLoginModal((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#DEE0ED] text-[11px] text-[#252943]/60 hover:border-[#3A4EFB] hover:text-[#3A4EFB] transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" /> Login
            </button>
          )}
        </div>
      </div>

      {/* ─── Login inline ─── */}
      {showLoginModal && (
        <div className="p-4 rounded-2xl border border-[#DEE0ED] bg-[#F8F9FD] space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#252943]">
            <Key className="w-3.5 h-3.5 text-[#3A4EFB]" /> Admin Authorization
          </div>
          <form onSubmit={handleLogin} className="flex gap-2">
            <input
              type="password"
              value={authKeyInput}
              onChange={(e) => setAuthKeyInput(e.target.value)}
              placeholder="Access key"
              className="flex-1 bg-white border border-[#DEE0ED] rounded-xl px-3 py-2 text-xs focus:border-[#3A4EFB] outline-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={loggingIn}
              className="px-4 py-2 bg-[#3A4EFB] text-white rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
            >
              {loggingIn ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Sign In
            </button>
          </form>
          {loginError && <p className="text-[11px] text-red-600">{loginError}</p>}
        </div>
      )}

      {/* ─── Action banner ─── */}
      {actionMsg && (
        <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs ${
          actionMsg.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {actionMsg.type === "success"
            ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
          {actionMsg.text}
        </div>
      )}

      {/* ─────────────────────────────────── */}
      {/* CREATE FORM */}
      {/* ─────────────────────────────────── */}
      {!selectedSessionId && (
        <div className="bg-white rounded-2xl border border-[#DEE0ED] divide-y divide-[#DEE0ED] overflow-hidden">
          {/* Video URL */}
          <div className="p-5 space-y-2">
            <label className="text-[11px] font-semibold text-[#252943]/60 uppercase tracking-wider block">
              Target Video URL
            </label>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://youtube.com/watch?v=... or TikTok / Instagram"
              className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2.5 text-xs text-[#252943] focus:border-[#3A4EFB] focus:bg-white transition-colors outline-none"
            />
            <p className="text-[10px] text-[#252943]/55">
              Each checkpoint compares this reading with the immediately previous one, using your selected interval. A missed or unavailable reading is skipped so Likes Analyze never stretches the measurement over a longer period.
            </p>
          </div>

          {/* Service */}
          <div className="p-5 space-y-3">
            <label className="text-[11px] font-semibold text-[#252943]/60 uppercase tracking-wider block">
              Provider Service
            </label>
            <form onSubmit={handleServiceSearch} className="flex gap-2">
              <input
                type="search"
                value={serviceSearchInput}
                onChange={(e) => setServiceSearchInput(e.target.value)}
                placeholder="Search service ID or name"
                className="flex-1 bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2 text-xs focus:border-[#3A4EFB] outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={searchingServices}
                className="px-4 py-2 bg-[#252943] text-white rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
              >
                {searchingServices ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radar className="w-3 h-3" />}
                Search
              </button>
            </form>
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              disabled={catalogLoading && availableServices.length === 0}
              className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2.5 text-xs focus:border-[#3A4EFB] outline-none disabled:opacity-50"
            >
              <option value="">{catalogLoading ? "Loading..." : "Choose a provider service"}</option>
              {availableServices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.externalId ? `#${i.externalId} — ` : ""}{i.platform ? `[${i.platform}] ` : ""}{i.name} (₹{i.ratePer1000.toFixed(2)}/1k)
                </option>
              ))}
            </select>
            {selectedService && (
              <div className="flex items-center justify-between text-[10px] text-[#252943]/55 bg-[#F8F9FD] rounded-lg px-3 py-2 border border-[#DEE0ED]/60">
                <span className="font-medium text-[#252943]">{selectedService.name}</span>
                <span>Min {selectedService.minQuantity.toLocaleString()} · Max {selectedService.maxQuantity.toLocaleString()}</span>
              </div>
            )}
            {selectedService && selectedService.minQuantity > 0 && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-800">
                <ShieldAlert className="w-3 h-3 shrink-0 mt-0.5 text-amber-500" />
                <span>
                  Provider minimum is <strong>{selectedService.minQuantity.toLocaleString()}</strong>. If a checkpoint&apos;s calculated quantity is below this minimum, the system will clamp it up to {selectedService.minQuantity.toLocaleString()} (minimum-batch rule). No order below the provider minimum is ever sent to the provider.
                </span>
              </div>
            )}
            {serviceSearchMessage && <p className="text-[10px] text-[#252943]/50">{serviceSearchMessage}</p>}
            <p className="text-[10px] text-[#252943]/55">
              Each batch uses a randomly selected 2–5% likes-to-views ratio calculated from the <em>interval likes change</em> (new likes since the previous checkpoint). For example, 50 new likes → about 1,000–2,500 views, subject to the provider minimum/maximum and your quantity cap.
            </p>
          </div>

          {/* Duration */}
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#252943]/60 uppercase tracking-wider">Duration</label>
              <span className="text-[11px] font-semibold text-[#3A4EFB]">
                {effectiveDuration >= 60 ? `${(effectiveDuration / 60).toFixed(1)}h` : `${effectiveDuration}m`}
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {DURATION_PRESETS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => { setDurationMode(d.value); setCustomDurationMinutes(d.value); }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    durationMode === d.value
                      ? "bg-[#252943] border-[#252943] text-white"
                      : "bg-[#F8F9FD] border-[#DEE0ED] text-[#252943]/60 hover:border-[#252943]/30"
                  }`}
                >
                  {d.label}
                </button>
              ))}
              <button
                onClick={() => setDurationMode(0)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  durationMode === 0
                    ? "bg-[#252943] border-[#252943] text-white"
                    : "bg-[#F8F9FD] border-[#DEE0ED] text-[#252943]/60 hover:border-[#252943]/30"
                }`}
              >
                Custom
              </button>
            </div>
            {durationMode === 0 && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={10} max={10080}
                  value={customDurationMinutes}
                  onChange={(e) => setCustomDurationMinutes(parseInt(e.target.value, 10) || 60)}
                  className="w-24 bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2 text-xs outline-none focus:border-[#3A4EFB]"
                />
                <span className="text-[11px] text-[#252943]/50">minutes</span>
              </div>
            )}
          </div>

          {/* Interval */}
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#252943]/60 uppercase tracking-wider">Check Interval</label>
              <span className="text-[11px] font-semibold text-[#3A4EFB]">Every {effectiveInterval}m</span>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {INTERVAL_PRESETS.map((i) => (
                <button
                  key={i.value}
                  onClick={() => { setIntervalMode(i.value); setCustomIntervalMinutes(i.value); }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    intervalMode === i.value
                      ? "bg-[#252943] border-[#252943] text-white"
                      : "bg-[#F8F9FD] border-[#DEE0ED] text-[#252943]/60 hover:border-[#252943]/30"
                  }`}
                >
                  {i.label}
                </button>
              ))}
              <input
                type="number"
                min={5} max={720}
                value={effectiveInterval}
                onChange={(e) => { setIntervalMode(0); setCustomIntervalMinutes(parseInt(e.target.value, 10) || 30); }}
                placeholder="min"
                className="w-16 bg-[#F8F9FD] border border-[#DEE0ED] rounded-lg px-2 py-1.5 text-xs text-center outline-none focus:border-[#3A4EFB]"
              />
            </div>
          </div>

          {/* Summary strip */}
          <div className="px-5 py-3 bg-[#F8F9FD] flex items-center justify-between text-[11px] text-[#252943]/55">
            <span>{Math.floor(effectiveDuration / effectiveInterval) + 1} checkpoints planned</span>
            <span>Runs until ~{new Date(nowMs + effectiveDuration * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>

          {/* Error + Launch */}
          {createError && (
            <div className="mx-5 py-3">
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {createError}
              </div>
            </div>
          )}
          <div className="p-5">
            <button
              onClick={handleCreate}
              disabled={creating || !selectedService}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Start Monitoring
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────── */}
      {/* LIVE SESSION VIEW */}
      {/* ─────────────────────────────────── */}
      {selectedSessionId && (
        <div className="space-y-4">
          {loadingState && !state ? (
            <div className="py-16 flex items-center justify-center gap-2 text-[#252943]/40">
              <Loader2 className="w-4 h-4 animate-spin text-[#3A4EFB]" />
              <span className="text-xs">Loading...</span>
            </div>
          ) : state && session ? (
            <>
              {/* ─── Status bar ─── */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[session.status] ?? "bg-gray-300"} ${isRunning ? "animate-pulse" : ""}`} />
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_BADGE[session.status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                    {session.status}
                  </span>
                  <a
                    href={session.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[#3A4EFB] hover:underline truncate max-w-[200px]"
                    title={session.videoUrl}
                  >
                    {session.videoIdentifier || session.videoUrl}
                  </a>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-[#252943]/50 shrink-0">
                  <Timer className="w-3 h-3" />
                  {timeLeftLabel}
                </div>
              </div>

              {/* ─── Key metrics ─── */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-[#DEE0ED] rounded-2xl p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#252943]/50 uppercase tracking-wider">
                    <Heart className="w-3.5 h-3.5 text-rose-400" /> Likes
                  </div>
                  <div className="text-xl font-bold text-[#252943] tracking-tight">
                    {formatK(state.analytics.totalLikesGained)}
                  </div>
                  <div className="text-[10px] text-[#252943]/40">gained total</div>
                </div>

                <div className="bg-white border border-[#DEE0ED] rounded-2xl p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#252943]/50 uppercase tracking-wider">
                    <Eye className="w-3.5 h-3.5 text-[#3A4EFB]" /> Views
                  </div>
                  <div className="text-xl font-bold text-[#252943] tracking-tight">
                    {formatK(state.analytics.totalViewsGained)}
                  </div>
                  <div className="text-[10px] text-[#252943]/40">gained total</div>
                </div>

                <div className="bg-white border border-[#DEE0ED] rounded-2xl p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#252943]/50 uppercase tracking-wider">
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> Orders
                  </div>
                  <div className="text-xl font-bold text-[#252943] tracking-tight">
                    {formatK(totalSubmitted)}
                  </div>
                  <div className="text-[10px] text-[#252943]/40">units sent</div>
                </div>
              </div>

              {/* ─── Secondary info strip ─── */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#F8F9FD] border border-[#DEE0ED]/60 rounded-xl px-3 py-2.5">
                  <div className="text-[10px] text-[#252943]/45">Next checkpoint</div>
                  <div className={`text-xs font-semibold mt-0.5 ${isRunning ? "text-[#3A4EFB]" : "text-[#252943]/40"}`}>
                    {nextCpCountdown ?? "—"}
                  </div>
                </div>
                <div className="bg-[#F8F9FD] border border-[#DEE0ED]/60 rounded-xl px-3 py-2.5">
                  <div className="text-[10px] text-[#252943]/45">Checkpoints</div>
                  <div className="text-xs font-semibold text-[#252943] mt-0.5">
                    {session.snapshots.length} / {session.checkpoints.length}
                  </div>
                </div>
                <div className="bg-[#F8F9FD] border border-[#DEE0ED]/60 rounded-xl px-3 py-2.5">
                  <div className="text-[10px] text-[#252943]/45">Missed</div>
                  <div className={`text-xs font-semibold mt-0.5 ${state.missedCheckpointCount > 0 ? "text-orange-600" : "text-[#252943]"}`}>
                    {state.missedCheckpointCount}
                  </div>
                </div>
              </div>

              {/* ─── Trend chart ─── */}
              {chart ? (
                <div className="bg-white border border-[#DEE0ED] rounded-2xl p-5 space-y-4 shadow-sm">
                  {/* Header */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#3A4EFB]/10 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-[#3A4EFB]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#252943]">Likes Growth Trajectory</span>
                          {(state.analytics.totalLikesGained ?? 0) > 0 && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              +{state.analytics.totalLikesGained?.toLocaleString()} likes gained
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#252943]/45 mt-0.5">
                          {session.snapshots.length} of {session.checkpoints.length} checkpoints recorded · Next checkpoint in {nextCpCountdown ?? "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-[#252943]/50">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#3A4EFB]" />
                        Recorded
                      </span>
                      {chart.futureCheckpoints.length > 0 && (
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full border border-dashed border-[#252943]/40 bg-white" />
                          Upcoming ({chart.futureCheckpoints.length} checks)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Chart Stage */}
                  <div className="relative w-full h-44 select-none pt-2 pb-6">
                    {/* Background Grid Lines & Y-Axis Labels */}
                    <div className="absolute inset-x-0 top-2 bottom-7 flex flex-col justify-between pointer-events-none">
                      <div className="flex items-center justify-between border-b border-dashed border-[#DEE0ED]/60 pb-1">
                        <span className="text-[9px] font-mono text-[#252943]/40">
                          {formatCount(chart.maxL)} likes {chart.maxL > chart.minL ? "(peak)" : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-dashed border-[#DEE0ED]/40 pb-1">
                        <span className="text-[9px] font-mono text-[#252943]/25">
                          {formatCount(Math.round((chart.maxL + chart.minL) / 2))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-dashed border-[#DEE0ED]/60 pb-1">
                        <span className="text-[9px] font-mono text-[#252943]/40">
                          {formatCount(chart.minL)} (baseline)
                        </span>
                      </div>
                    </div>

                    {/* SVG Vector Layer (only for paths, never distorting circles) */}
                    <svg
                      viewBox={`0 0 ${chart.W} ${chart.H}`}
                      className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="likesGrowthFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3A4EFB" stopOpacity="0.18" />
                          <stop offset="100%" stopColor="#3A4EFB" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Future dashed guide line */}
                      {chart.futureLine && (
                        <path
                          d={chart.futureLine}
                          fill="none"
                          stroke="#94A3B8"
                          strokeWidth="1.5"
                          strokeDasharray="4 4"
                          vectorEffect="non-scaling-stroke"
                          opacity="0.6"
                        />
                      )}

                      {/* Area under curve */}
                      {chart.area && (
                        <path d={chart.area} fill="url(#likesGrowthFill)" />
                      )}

                      {/* Main trend line */}
                      {chart.line && (
                        <path
                          d={chart.line}
                          fill="none"
                          stroke="#3A4EFB"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}
                    </svg>

                    {/* CSS Markers Layer: Guaranteed perfect circles, never squished */}
                    <div className="absolute inset-0 pointer-events-none">
                      {chart.pts.map((p, idx) => {
                        const isLatest = idx === chart.pts.length - 1;
                        const delta = p.s.likesDelta ?? 0;
                        return (
                          <div
                            key={p.s.id}
                            className="absolute -translate-x-1/2 -translate-y-1/2 group pointer-events-auto"
                            style={{ left: `${p.pctX}%`, top: `${p.pctY}%` }}
                          >
                            {/* Pulsing ring for latest active checkpoint */}
                            {isLatest && isRunning && (
                              <span className="absolute -inset-1 rounded-full bg-[#3A4EFB]/30 animate-ping" />
                            )}

                            {/* Core Circular Dot */}
                            <div className={`relative w-3.5 h-3.5 rounded-full border-2 transition-transform duration-150 group-hover:scale-125 shadow-sm ${
                              isLatest
                                ? "bg-[#3A4EFB] border-white ring-2 ring-[#3A4EFB]/20"
                                : "bg-white border-[#3A4EFB]"
                            }`} />

                            {/* Value badge: always visible for latest point, on hover for others */}
                            <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-xl shadow-lg whitespace-nowrap transition-all z-20 pointer-events-none ${
                              isLatest
                                ? "bg-[#252943] text-white opacity-100"
                                : "bg-[#252943] text-white opacity-0 group-hover:opacity-100"
                            }`}>
                              <div className="text-[10px] font-bold leading-tight flex items-center gap-1">
                                <span>{formatCount(p.s.likes)} likes</span>
                                {delta > 0 && <span className="text-emerald-300 font-semibold">(+{delta})</span>}
                              </div>
                              <div className="text-[9px] text-white/60 text-center">
                                Check #{p.s.sequence} · {fmtTime(p.s.executedAt)}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Future Checkpoint Indicators */}
                      {chart.futureCheckpoints.map(({ cp, pctX }) => (
                        <div
                          key={cp.id}
                          className="absolute -translate-x-1/2 -translate-y-1/2 group pointer-events-auto"
                          style={{ left: `${pctX}%`, top: `${(chart.lastPt.y / chart.H) * 100}%` }}
                        >
                          <div className="w-2.5 h-2.5 rounded-full border border-dashed border-[#252943]/40 bg-white group-hover:scale-125 transition-transform" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-0.5 rounded-md bg-[#252943] text-white text-[9px] shadow-md opacity-0 group-hover:opacity-100 whitespace-nowrap z-20 pointer-events-none">
                            Check #{cp.sequence} (Planned {fmtTime(cp.plannedAt)})
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* X-Axis Checkpoint Timeline Ticks */}
                    <div className="absolute inset-x-0 bottom-0 flex pointer-events-none">
                      {chart.slots.map((slot) => {
                        const showLabel = chart.totalSlots <= 10 || slot.sequence === 1 || slot.sequence === chart.totalSlots || slot.sequence % Math.ceil(chart.totalSlots / 6) === 0;
                        if (!showLabel) return null;
                        return (
                          <div
                            key={slot.sequence}
                            className="absolute flex flex-col items-center -translate-x-1/2 text-center"
                            style={{ left: `${slot.pctX}%` }}
                          >
                            <span className={`text-[9px] font-bold ${slot.isExecuted ? "text-[#252943]" : "text-[#252943]/35"}`}>
                              #{slot.sequence}
                            </span>
                            <span className={`text-[8px] font-mono ${slot.isExecuted ? "text-[#252943]/60" : "text-[#252943]/30"}`}>
                              {slot.time}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : session.snapshots.length > 0 ? (
                <div className="bg-[#F8F9FD] border border-[#DEE0ED] rounded-2xl p-6 text-center text-xs text-[#252943]/40">
                  Waiting for first checkpoint snapshot to initialize trend...
                </div>
              ) : null}

              {/* ─── Interval log ─── */}
              {intervalRows.length > 0 && (
                <div className="bg-white border border-[#DEE0ED] rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#DEE0ED] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#3A4EFB]" />
                    <span className="text-[11px] font-semibold text-[#252943]">Interval Log</span>
                    <span className="text-[10px] text-[#252943]/40 ml-auto">Recent {intervalRows.length} checkpoints</span>
                  </div>
                  <div className="divide-y divide-[#DEE0ED]/50">
                    {intervalRows.map(({ s, matchedStep, skipped, appliedRatio, selectedRatio }) => (
                      <div key={s.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-[#F8F9FD] transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 rounded-full bg-[#3A4EFB]/8 text-[#3A4EFB] text-[10px] font-bold flex items-center justify-center">
                            {s.sequence}
                          </span>
                          <span className="text-[11px] text-[#252943]/60">{fmtTime(s.executedAt)}</span>
                        </div>
                        <div className="flex items-center gap-5">
                          <div className="text-right">
                            <div className={`text-[11px] font-bold ${(s.likesDelta ?? 0) > 0 ? "text-rose-500" : "text-[#252943]/30"}`}>
                              {(s.likesDelta ?? 0) > 0 ? `+${s.likesDelta?.toLocaleString()}` : "—"}
                            </div>
                            <div className="text-[9px] text-[#252943]/35">likes in interval</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] font-bold text-[#252943]">
                              {matchedStep ? matchedStep.quantity.toLocaleString() : skipped ? "0 (skipped)" : "—"}
                            </div>
                            <div className="text-[9px] text-[#252943]/35">views queued</div>
                          </div>
                          <div className="text-right min-w-14">
                            <div className="text-[10px] font-semibold text-[#252943]/65">{appliedRatio ? `${appliedRatio}%` : "—"}</div>
                            <div className="text-[9px] text-[#252943]/35">{selectedRatio ? `target ${selectedRatio}%` : "applied ratio"}</div>
                          </div>
                          <span title={skipped?.details || undefined} className={`w-2 h-2 rounded-full ${
                            skipped ? "bg-amber-400" : !matchedStep ? "bg-gray-200" :
                            matchedStep.status === "COMPLETED" ? "bg-emerald-400" :
                            matchedStep.status === "SUBMITTED" ? "bg-blue-400" :
                            matchedStep.status === "FAILED" ? "bg-red-400" :
                            "bg-amber-400"
                          }`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── Warnings ─── */}
              {state.warnings.length > 0 && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <div className="space-y-0.5">
                    {state.warnings.map((w, i) => <p key={i}>{w}</p>)}
                  </div>
                </div>
              )}

              {/* ─── Controls ─── */}
              <div className="flex items-center gap-2 flex-wrap">
                {session.status === "PAUSED" ? (
                  <button
                    onClick={() => handleControl("resume")}
                    disabled={acting !== null}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {acting === "resume" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Resume
                  </button>
                ) : (
                  <button
                    onClick={() => handleControl("pause")}
                    disabled={acting !== null || !isRunning}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold transition-colors disabled:opacity-40"
                  >
                    {acting === "pause" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
                    Pause
                  </button>
                )}
                <button
                  onClick={() => handleControl("stop")}
                  disabled={acting !== null || ["STOPPED", "EXPIRED", "COMPLETED"].includes(session.status)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors disabled:opacity-40"
                >
                  {acting === "stop" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                  Stop
                </button>
                <button
                  onClick={() => { setState(null); setSelectedSessionId(null); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#DEE0ED] text-[#252943]/60 hover:bg-[#F8F9FD] text-xs font-semibold transition-colors ml-auto"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
              </div>

              {/* ─── Audit trail (collapsed) ─── */}
              {session.events.length > 0 && (
                <details className="text-[11px]">
                  <summary className="cursor-pointer text-[#252943]/40 hover:text-[#3A4EFB] select-none transition-colors">
                    View audit trail ({session.events.length} events)
                  </summary>
                  <div className="mt-2 p-3 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]/60 font-mono text-[10px] space-y-1 max-h-36 overflow-y-auto">
                    {session.events.map((e) => (
                      <div key={e.id}>
                        <span className="text-[#3A4EFB] font-bold">[{e.action}]</span>{" "}
                        <span className="text-[#252943]/60">{e.details}</span>{" "}
                        <span className="text-[#252943]/30">({fmtTime(e.createdAt)})</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {isRunning && (
                <p className="text-center text-[10px] text-[#252943]/35">
                  Auto-refreshes every 10s · Monitoring daemon runs in background
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4" /> Unable to load session state.
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────── */}
      {/* SESSION LIST */}
      {/* ─────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[#252943]/50 uppercase tracking-wider">
            Monitored Sessions
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#252943]/35">
              {sessionsLoading && sessions.length === 0
                ? "Loading..."
                : `${sessions.length} session${sessions.length === 1 ? "" : "s"}`}
            </span>
            <button
              onClick={() => void loadSessions()}
              disabled={sessionsLoading}
              className="p-1.5 rounded-lg border border-[#DEE0ED] text-[#252943]/40 hover:text-[#252943] hover:bg-[#F8F9FD] transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${sessionsLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {sessionsLoading && sessions.length === 0 ? (
          <div className="py-8 flex items-center justify-center gap-2 text-[#252943]/35 text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-[#252943]/35 border border-dashed border-[#DEE0ED] rounded-2xl">
            No sessions yet. Configure and start monitoring above.
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((item) => {
              const isSelected = selectedSessionId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => void selectSession(item.id)}
                  className={`w-full text-left flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? "border-[#3A4EFB] bg-[#3A4EFB]/5"
                      : "border-[#DEE0ED] bg-white hover:border-[#3A4EFB]/40 hover:bg-[#F8F9FD]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[item.status] ?? "bg-gray-300"} ${item.status === "RUNNING" ? "animate-pulse" : ""}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#252943]">{item.orderRef}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${STATUS_BADGE[item.status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                          {item.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#252943]/45 truncate mt-0.5">
                        {item.videoIdentifier || item.videoUrl} · Every {item.intervalMinutes}m · {item.snapshotCount} checks
                      </div>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 ml-2 transition-colors ${isSelected ? "text-[#3A4EFB]" : "text-[#252943]/25"}`} />
                </button>
              );
            })}
          </div>
        )}

        {sessionsError && sessions.length > 0 && (
          <p className="text-[10px] text-amber-700">{sessionsError}</p>
        )}
      </div>
    </div>
  );
}


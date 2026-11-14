"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ShieldCheck, 
  Key, 
  Server, 
  RefreshCw, 
  Play, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  Copy, 
  Lock, 
  Loader2, 
  Activity,
  Users,
  Clock,
  Send,
  Plus,
  Sliders,
  Check,
  XCircle,
  AlertTriangle,
  FileText,
  Calendar,
  ChevronDown,
  Layers,
  Edit3,
  Search,
  Zap,
  Sparkles,
  Eye,
  Heart,
  Bookmark,
  Share2,
} from "lucide-react";
import { formatProviderBalance } from "@/lib/currency";
import { OrderMonitorTab } from "@/components/admin/OrderMonitorTab";
import { AlertsHealthTab } from "@/components/admin/AlertsHealthTab";

interface PasskeyData {
  id: string;
  label: string;
  keyPrefix: string;
  role: string;
  status: string;
  durationDays: number | null;
  expiresAt: string | null;
  remainingDays: number | null;
  remainingHours: number | null;
  isExpired: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

interface DiagnosticsData {
  systemStatus: {
    backendStatus: string;
    workerStatus: string;
    lastWorkerHeartbeat: string | null;
    activeWorkers: number;
    lastHealthCheckAt: string;
    lastSuccessfulProviderOp: {
      action: string;
      endpoint: string;
      createdAt: string;
      durationMs: number;
    } | null;
    pendingJobsCount: number;
    processingJobsCount: number;
    completedJobsCount: number;
    failedJobsCount: number;
    mostRecentError: {
      message: string;
      orderRef: string;
      timestamp: string;
    } | null;
  };
  orderProcessing: {
    totalOrders: number;
    processingOrders: number;
    completedOrders: number;
    awaitingExecution: number;
    failedOrders: number;
    cancelledOrders: number;
    breakdownByStatus: Record<string, number>;
  };
  userStatistics: {
    totalUsers: number;
    activeUsers: number;
    disabledUsers: number;
    totalConfiguredProviders: number;
    workingProviders: number;
  };
  providerHealth: {
    systemConfig: any;
    userProviders: Array<{
      id: string;
      username: string;
      name: string;
      apiUrl: string;
      isMock: boolean;
      balance: number | null;
      currency: string;
      lastSyncAt: string | null;
      lastError: string | null;
      status: string;
    }>;
  };
  ordersNeedingAttention: Array<{
    id: string;
    orderRef: string;
    status: string;
    errorMessage?: string;
    targetUrl: string;
    service: { name: string };
    user?: { username: string };
  }>;
  failedSteps: Array<{
    id: string;
    stepNumber: number;
    errorMessage?: string;
    order: { orderRef: string; targetUrl: string };
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    actor: string;
    details: string;
    createdAt: string;
  }>;
}

export default function AdminPage() {
  const [session, setSession] = useState<{ authenticated: boolean; label?: string; role?: string } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Login form state
  const [accessKeyInput, setAccessKeyInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Admin Data state
  const [activeTab, setActiveTab] = useState<"keys" | "ordermonitor" | "monitoring" | "provider" | "audit" | "engagement" | "alerts">("keys");
  const [passkeys, setPasskeys] = useState<PasskeyData[]>([]);
  const [passkeySearchQuery, setPasskeySearchQuery] = useState("");
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [engagementProfiles, setEngagementProfiles] = useState<any[]>([]);
  const [engagementOrders, setEngagementOrders] = useState<any[]>([]);
  const [editingMapping, setEditingMapping] = useState<{ profileId: string; type: string; providerId: string; providerServiceId: string; name: string; minQuantity: number; maxQuantity: number; ratePer1000: number } | null>(null);
  const [savingMapping, setSavingMapping] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Alerts & Delivery Health state
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertsMetrics, setAlertsMetrics] = useState<any>(null);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<{ exists: boolean; message: string; service?: any } | null>(null);

  // Action status states
  const [actionMsg, setActionMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [runningTick, setRunningTick] = useState(false);

  // Create Key Form Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeyRole, setNewKeyRole] = useState<"USER" | "ADMIN">("USER");
  const [newKeyDuration, setNewKeyDuration] = useState<number | "custom" | "permanent">(30);
  const [customDaysInput, setCustomDaysInput] = useState("30");
  const [customPasskeyString, setCustomPasskeyString] = useState("");
  const [newKeyUsername, setNewKeyUsername] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<{ key: string; label: string; role: string; expiresAt?: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Edit Key Form Modal state
  const [editingPasskey, setEditingPasskey] = useState<PasskeyData | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editRole, setEditRole] = useState<"USER" | "ADMIN">("USER");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "DISABLED" | "REVOKED">("ACTIVE");
  const [editDurationType, setEditDurationType] = useState<"keep" | "preset" | "permanent" | "customDate">("keep");
  const [editPresetDays, setEditPresetDays] = useState<number>(30);
  const [editCustomDate, setEditCustomDate] = useState<string>("");
  const [editNewCustomKey, setEditNewCustomKey] = useState<string>("");
  const [savingEditKey, setSavingEditKey] = useState<boolean>(false);
  const [editResultSecret, setEditResultSecret] = useState<string | null>(null);

  // System Provider Config state
  const [providerConfig, setProviderConfig] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editApiUrl, setEditApiUrl] = useState("");
  const [editApiKey, setEditApiKey] = useState("");
  const [editIsMock, setEditIsMock] = useState(true);
  const [savingProvider, setSavingProvider] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // TikTok Engagement Preset Config state
  const [tiktokConfig, setTiktokConfig] = useState<any>(null);
  const [savingTiktokConfig, setSavingTiktokConfig] = useState(false);

  // Check auth on load
  async function checkAuth() {
    try {
      const res = await fetch("/api/admin/auth");
      const data = await res.json();
      setSession(data);
      if (data.authenticated) {
        await loadAllAdminData();
      }
    } catch (err) {
      console.error("Auth check failed", err);
    } finally {
      setCheckingAuth(false);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  // Auto-refresh diagnostics
  useEffect(() => {
    if (!autoRefresh || !session?.authenticated) return;
    const interval = setInterval(() => {
      fetch("/api/admin/diagnostics")
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setDiagnostics(data);
        })
        .catch(() => {});
      loadAlerts();
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, session?.authenticated]);

  async function loadAlerts() {
    setLoadingAlerts(true);
    try {
      const res = await fetch("/api/admin/alerts");
      const data = await res.json();
      if (data.success) {
        setAlerts(data.alerts || []);
        setAlertsMetrics(data.metrics || null);
      }
    } catch (err) {
      console.error("Failed to load alerts", err);
    } finally {
      setLoadingAlerts(false);
    }
  }

  async function handleAlertAction(alertId: string, action: string) {
    setActionLoadingId(alertId);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/admin/alerts/${alertId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Action failed");
      }
      setActionMsg({ text: data.message || "Action completed", type: "success" });
      await loadAlerts();
    } catch (err: any) {
      setActionMsg({ text: err.message || "Failed to execute action", type: "error" });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleLookupService(providerId: string, serviceId: string) {
    if (!providerId || !serviceId) return;
    setLookupLoading(true);
    setLookupStatus(null);
    try {
      const res = await fetch(`/api/admin/engagement-profiles/lookup?providerId=${encodeURIComponent(providerId)}&serviceId=${encodeURIComponent(serviceId)}`);
      const data = await res.json();
      if (data.success && data.exists && data.service) {
        setLookupStatus({
          exists: true,
          message: `Found: ${data.service.name}`,
          service: data.service,
        });
        if (editingMapping) {
          setEditingMapping((prev) => prev ? {
            ...prev,
            name: data.service.name,
            minQuantity: data.service.minQuantity,
            maxQuantity: data.service.maxQuantity,
            ratePer1000: data.service.ratePer1000,
          } : null);
        }
      } else {
        setLookupStatus({
          exists: false,
          message: data.message || `Service ID "${serviceId}" does not exist on this provider`,
        });
      }
    } catch (err: any) {
      setLookupStatus({
        exists: false,
        message: err.message || "Verification request failed",
      });
    } finally {
      setLookupLoading(false);
    }
  }

  async function loadAllAdminData() {
    setLoadingData(true);
    try {
      const [keysRes, diagRes, provRes, engRes, alertsRes, engOrdersRes, tiktokRes] = await Promise.all([
        fetch("/api/admin/keys").then((r) => r.json()),
        fetch("/api/admin/diagnostics").then((r) => r.json()),
        fetch("/api/admin/provider").then((r) => r.json()),
        fetch("/api/admin/engagement-profiles").then((r) => r.json()).catch(() => ({ success: false })),
        fetch("/api/admin/alerts").then((r) => r.json()).catch(() => ({ success: false })),
        fetch("/api/engagement/orders").then((r) => r.json()).catch(() => ({ success: false })),
        fetch("/api/admin/engagement-config").then((r) => r.json()).catch(() => ({ success: false })),
      ]);

      if (keysRes.success) setPasskeys(keysRes.keys);
      if (diagRes.success) setDiagnostics(diagRes);
      if (engRes.success && engRes.profiles) setEngagementProfiles(engRes.profiles);
      if (engOrdersRes.success && Array.isArray(engOrdersRes.orders)) setEngagementOrders(engOrdersRes.orders);
      if (tiktokRes.success && tiktokRes.config) setTiktokConfig(tiktokRes.config);
      if (alertsRes.success) {
        setAlerts(alertsRes.alerts || []);
        setAlertsMetrics(alertsRes.metrics || null);
      }
      if (provRes.success && provRes.config) {
        setProviderConfig(provRes.config);
        setEditName(provRes.config.name);
        setEditApiUrl(provRes.config.apiUrl);
        setEditIsMock(provRes.config.isMock);
      }
    } catch (err) {
      console.error("Failed to load admin data", err);
    } finally {
      setLoadingData(false);
    }
  }

  async function handleSaveTiktokConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!tiktokConfig) return;
    setSavingTiktokConfig(true);
    setActionMsg(null);
    try {
      const res = await fetch("/api/admin/engagement-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tiktokConfig),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update TikTok engagement configuration");
      }
      setTiktokConfig(data.config);
      setActionMsg({ text: "TikTok Engagement configuration saved successfully.", type: "success" });
    } catch (err: any) {
      setActionMsg({ text: err.message || "Failed to save configuration", type: "error" });
    } finally {
      setSavingTiktokConfig(false);
    }
  }

  async function handleSaveEngagementMapping(e: React.FormEvent) {
    e.preventDefault();
    if (!editingMapping) return;
    setSavingMapping(true);
    setActionMsg(null);
    try {
      const res = await fetch("/api/admin/engagement-profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingMapping),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update mapping");
      }
      setActionMsg({ text: data.message || "Mapping updated successfully", type: "success" });
      setEditingMapping(null);
      await loadAllAdminData();
    } catch (err: any) {
      setActionMsg({ text: err.message || "Failed to save mapping", type: "error" });
    } finally {
      setSavingMapping(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: accessKeyInput }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSession({ authenticated: true, label: data.label, role: data.role });
        setAccessKeyInput("");
        await loadAllAdminData();
        window.dispatchEvent(new CustomEvent("auth-changed"));
      } else {
        setLoginError(data.error || "Authentication failed.");
      }
    } catch (err: any) {
      setLoginError(err.message || "Login exception");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession({ authenticated: false });
    window.dispatchEvent(new CustomEvent("auth-changed"));
  }

  // Passkey Actions
  async function handleCreatePasskey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyLabel.trim()) return;

    setCreatingKey(true);
    setActionMsg(null);

    try {
      const days = newKeyDuration === "permanent" 
        ? null 
        : newKeyDuration === "custom" 
          ? parseInt(customDaysInput, 10) 
          : newKeyDuration;
      const res = await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newKeyLabel.trim(),
          role: newKeyRole,
          durationDays: days && days > 0 ? days : null,
          customKey: customPasskeyString.trim() || undefined,
          username: newKeyUsername.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create passkey");
      }

      setCreatedSecret({
        key: data.key.secretKey,
        label: data.key.label,
        role: data.key.role,
        expiresAt: data.key.expiresAt,
      });

      setNewKeyLabel("");
      setCustomPasskeyString("");
      setNewKeyUsername("");
      await loadAllAdminData();
    } catch (err: any) {
      setActionMsg({ text: err.message || "Failed to create passkey", type: "error" });
    } finally {
      setCreatingKey(false);
    }
  }

  // Open Edit Passkey Modal
  function openEditPasskeyModal(pk: PasskeyData) {
    setEditingPasskey(pk);
    setEditLabel(pk.label);
    setEditRole(pk.role as "ADMIN" | "USER");
    setEditStatus((pk.status === "EXPIRED" ? "ACTIVE" : pk.status) as "ACTIVE" | "DISABLED" | "REVOKED");
    setEditDurationType("keep");
    setEditPresetDays(30);
    setEditCustomDate(pk.expiresAt ? new Date(pk.expiresAt).toISOString().split("T")[0] : "");
    setEditNewCustomKey("");
    setEditResultSecret(null);
  }

  // Save Edited Passkey
  async function handleSaveEditedPasskey(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPasskey) return;
    setSavingEditKey(true);
    setActionMsg(null);

    try {
      const payload: any = {
        id: editingPasskey.id,
        action: "edit",
        label: editLabel.trim(),
        role: editRole,
        status: editStatus,
      };

      if (editDurationType === "permanent") {
        payload.expiresAt = null;
        payload.durationDays = null;
      } else if (editDurationType === "preset") {
        payload.expiresAt = new Date(Date.now() + editPresetDays * 24 * 60 * 60 * 1000).toISOString();
        payload.durationDays = editPresetDays;
      } else if (editDurationType === "customDate" && editCustomDate) {
        payload.expiresAt = new Date(`${editCustomDate}T23:59:59Z`).toISOString();
      }

      if (editNewCustomKey.trim()) {
        payload.newCustomKey = editNewCustomKey.trim();
      }

      const res = await fetch("/api/admin/keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update passkey.");
      }

      if (data.updatedSecretKey) {
        setEditResultSecret(data.updatedSecretKey);
      } else {
        setEditingPasskey(null);
      }

      setActionMsg({ text: `Passkey "${editLabel}" updated successfully.`, type: "success" });
      await loadAllAdminData();
    } catch (err: any) {
      setActionMsg({ text: err.message || "Failed to update passkey.", type: "error" });
    } finally {
      setSavingEditKey(false);
    }
  }

  async function handlePasskeyAction(id: string, action: "renew" | "revoke" | "disable" | "enable", additionalDays?: number) {
    setActionLoadingId(id);
    setActionMsg(null);
    try {
      const res = await fetch("/api/admin/keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, additionalDays }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Action failed");

      setActionMsg({ text: data.message || "Action completed", type: "success" });
      await loadAllAdminData();
    } catch (err: any) {
      setActionMsg({ text: err.message || "Action failed", type: "error" });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDeletePasskey(id: string) {
    if (!confirm("Are you sure you want to permanently delete this passkey?")) return;
    setActionLoadingId(id);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/admin/keys?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Deletion failed");

      setActionMsg({ text: "Passkey deleted safely.", type: "success" });
      await loadAllAdminData();
    } catch (err: any) {
      setActionMsg({ text: err.message || "Deletion failed", type: "error" });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleTriggerWorkerTick() {
    setRunningTick(true);
    setActionMsg(null);
    try {
      const res = await fetch("/api/scheduler/tick", { method: "POST" });
      const data = await res.json();
      setActionMsg({
        text: `Worker tick complete: ${data.processedSteps || 0} steps, ${data.successfulSteps || 0} successful.`,
        type: "success",
      });
      await loadAllAdminData();
    } catch (err: any) {
      setActionMsg({ text: err.message || "Tick failed", type: "error" });
    } finally {
      setRunningTick(false);
    }
  }

  async function handleSaveSystemProvider(e: React.FormEvent) {
    e.preventDefault();
    setSavingProvider(true);
    setActionMsg(null);
    try {
      const res = await fetch("/api/admin/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          apiUrl: editApiUrl,
          apiKey: editApiKey,
          isMock: editIsMock,
          active: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Save failed");

      setActionMsg({ text: "System provider settings saved.", type: "success" });
      setEditApiKey("");
      await loadAllAdminData();
    } catch (err: any) {
      setActionMsg({ text: err.message || "Save failed", type: "error" });
    } finally {
      setSavingProvider(false);
    }
  }

  if (checkingAuth) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#252943]/60 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#3A4EFB]" />
        <span className="text-sm font-semibold">Verifying administrative credentials...</span>
      </div>
    );
  }

  // If not authenticated as ADMIN, display Admin Login Gate
  if (!session?.authenticated || session.role !== "ADMIN") {
    return (
      <div className="max-w-md mx-auto py-12 animate-fadeIn">
        <div className="bg-white rounded-3xl border border-[#DEE0ED] p-8 shadow-subtle space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#252943] text-[#E3FF3B] flex items-center justify-center mx-auto shadow-subtle">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-extrabold text-[#252943] tracking-tight">
              Administration Gate
            </h1>
            <p className="text-xs text-[#252943]/60">
              Administrative role required. Enter your administrator passkey.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#252943] mb-1.5">
                Admin Passkey
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={accessKeyInput}
                  onChange={(e) => setAccessKeyInput(e.target.value)}
                  placeholder="Enter administrator passkey..."
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-mono font-bold text-[#252943] focus:border-[#3A4EFB] outline-none"
                  autoFocus
                />
                <Key className="w-4 h-4 text-[#252943]/40 absolute left-3 top-3" />
              </div>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-800 border border-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn || !accessKeyInput.trim()}
              className="w-full py-2.5 rounded-xl bg-[#252943] hover:bg-[#1A1D31] text-white text-xs font-bold transition-all shadow-subtle flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : "Authenticate as Admin"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filteredPasskeys = passkeys.filter((pk) => {
    if (!passkeySearchQuery.trim()) return true;
    const q = passkeySearchQuery.toLowerCase();
    return (
      pk.label.toLowerCase().includes(q) ||
      (pk.user?.username && pk.user.username.toLowerCase().includes(q)) ||
      pk.keyPrefix.toLowerCase().includes(q) ||
      pk.role.toLowerCase().includes(q) ||
      pk.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8 animate-fadeIn max-w-6xl mx-auto pb-16">
      {/* Admin Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#DEE0ED]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-[#252943] text-[#E3FF3B]">
              SUPERADMIN CONSOLE
            </span>
            <span className="text-xs text-[#252943]/60">• AuraSMM v2</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#252943] tracking-tight">
            Administration & Monitoring
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadAllAdminData}
            disabled={loadingData}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#DEE0ED] text-xs font-bold text-[#252943] hover:border-[#3A4EFB] shadow-subtle transition-all press-scale"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#3A4EFB] ${loadingData ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleTriggerWorkerTick}
            disabled={runningTick}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#252943] text-white text-xs font-bold shadow-subtle hover:bg-[#1A1D31] transition-all press-scale"
          >
            <Play className={`w-3.5 h-3.5 text-[#E3FF3B] ${runningTick ? "animate-spin" : ""}`} />
            <span>Force Worker Tick</span>
          </button>
        </div>
      </div>

      {actionMsg && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs font-semibold animate-fadeIn ${
            actionMsg.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-red-50 text-red-900 border border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{actionMsg.text}</span>
          </div>
          <button onClick={() => setActionMsg(null)} className="text-gray-400 hover:text-gray-700">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-[#DEE0ED] pb-px overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("keys")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === "keys"
              ? "border-[#3A4EFB] text-[#3A4EFB] bg-[#3A4EFB]/5"
              : "border-transparent text-[#252943]/60 hover:text-[#252943]"
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Passkeys & Users ({passkeys.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ordermonitor")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === "ordermonitor"
              ? "border-[#3A4EFB] text-[#3A4EFB] bg-[#3A4EFB]/5"
              : "border-transparent text-[#252943]/60 hover:text-[#252943]"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Order Monitor</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("monitoring")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === "monitoring"
              ? "border-[#3A4EFB] text-[#3A4EFB] bg-[#3A4EFB]/5"
              : "border-transparent text-[#252943]/60 hover:text-[#252943]"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Backend Monitoring</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("provider")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === "provider"
              ? "border-[#3A4EFB] text-[#3A4EFB] bg-[#3A4EFB]/5"
              : "border-transparent text-[#252943]/60 hover:text-[#252943]"
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Fallback System Provider</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === "audit"
              ? "border-[#3A4EFB] text-[#3A4EFB] bg-[#3A4EFB]/5"
              : "border-transparent text-[#252943]/60 hover:text-[#252943]"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Audit Log</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("engagement")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === "engagement"
              ? "border-[#3A4EFB] text-[#3A4EFB] bg-[#3A4EFB]/5"
              : "border-transparent text-[#252943]/60 hover:text-[#252943]"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Full Engagement Profiles</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("alerts");
            loadAlerts();
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
            activeTab === "alerts"
              ? "border-[#3A4EFB] text-[#3A4EFB] bg-[#3A4EFB]/5"
              : "border-transparent text-[#252943]/60 hover:text-[#252943]"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Alerts & Delivery Health</span>
          {alertsMetrics?.openAlertsCount ? (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
              {alertsMetrics.openAlertsCount}
            </span>
          ) : null}
        </button>
      </div>

      {/* =====================================================================
          TAB 0: ORDER MONITOR (Change H)
      ====================================================================== */}
      {activeTab === "ordermonitor" && (
        <OrderMonitorTab />
      )}

      {/* =====================================================================
          TAB 1: PASSKEY & USER MANAGEMENT
      ====================================================================== */}
      {activeTab === "keys" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle">
              <span className="text-[10px] uppercase font-bold text-[#252943]/60 block mb-1">Total Passkeys</span>
              <span className="text-2xl font-black text-[#252943]">{passkeys.length}</span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle">
              <span className="text-[10px] uppercase font-bold text-[#252943]/60 block mb-1">Active Accounts</span>
              <span className="text-2xl font-black text-emerald-600">
                {passkeys.filter((p) => p.status === "ACTIVE").length}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle">
              <span className="text-[10px] uppercase font-bold text-[#252943]/60 block mb-1">Expired Passkeys</span>
              <span className="text-2xl font-black text-amber-600">
                {passkeys.filter((p) => p.status === "EXPIRED" || p.isExpired).length}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle">
              <span className="text-[10px] uppercase font-bold text-[#252943]/60 block mb-1">Admin Passkeys</span>
              <span className="text-2xl font-black text-[#3A4EFB]">
                {passkeys.filter((p) => p.role === "ADMIN").length}
              </span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#252943]">Configured Passkeys</h2>
              <p className="text-xs text-[#252943]/60">
                Manage access duration, assign roles, edit details, revoke or renew access for botters and admins.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#252943]/40" />
                <input
                  type="text"
                  value={passkeySearchQuery}
                  onChange={(e) => setPasskeySearchQuery(e.target.value)}
                  placeholder="Search passkey, user..."
                  className="bg-white border border-[#DEE0ED] rounded-xl pl-8 pr-3 py-2 text-xs text-[#252943] placeholder-[#252943]/40 focus:border-[#3A4EFB] outline-none w-44 sm:w-56 shadow-subtle"
                />
              </div>
              <button
                type="button"
                id="create-passkey-btn"
                onClick={() => {
                  setCreatedSecret(null);
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3A4EFB] hover:bg-[#2F40DB] text-white text-xs font-bold shadow-subtle transition-all press-scale shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Passkey</span>
              </button>
            </div>
          </div>

          {/* Passkeys Table */}
          <div className="bg-white rounded-3xl border border-[#DEE0ED] shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FD] text-[#252943]/60 uppercase text-[10px] font-bold border-b border-[#DEE0ED]">
                  <tr>
                    <th className="px-5 py-3.5">Label / User</th>
                    <th className="px-4 py-3.5">Prefix</th>
                    <th className="px-4 py-3.5">Role</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Remaining Access</th>
                    <th className="px-4 py-3.5">Expires</th>
                    <th className="px-4 py-3.5">Last Used</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DEE0ED]/60 font-medium">
                  {filteredPasskeys.map((pk) => {
                    const isExp = pk.isExpired || pk.status === "EXPIRED";
                    return (
                      <tr key={pk.id} className="hover:bg-[#F8F9FD]/60 transition-colors">
                        <td className="px-5 py-3">
                          <span className="font-bold text-[#252943] block">{pk.label}</span>
                          <span className="text-[10px] text-[#252943]/50">
                            User: {pk.user?.username || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-[#252943]/70">
                          ••••••••
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wide ${
                              pk.role === "ADMIN"
                                ? "bg-[#252943] text-[#E3FF3B]"
                                : "bg-[#3A4EFB]/10 text-[#3A4EFB]"
                            }`}
                          >
                            {pk.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isExp
                                ? "bg-amber-100 text-amber-800"
                                : pk.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800"
                                : pk.status === "REVOKED"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {isExp ? "EXPIRED" : pk.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#3A4EFB]">
                          {pk.remainingDays !== null ? (
                            pk.remainingDays > 0 ? (
                              `${pk.remainingDays}d remaining`
                            ) : (
                              `${pk.remainingHours || 0}h remaining`
                            )
                          ) : (
                            <span className="text-gray-400">Unlimited</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-[#252943]/70">
                          {pk.expiresAt ? new Date(pk.expiresAt).toLocaleDateString() : "Permanent"}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-[#252943]/50">
                          {pk.lastUsedAt ? new Date(pk.lastUsedAt).toLocaleDateString() : "Never"}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit Passkey */}
                            <button
                              type="button"
                              onClick={() => openEditPasskeyModal(pk)}
                              title="Edit Passkey & Access"
                              className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[#3A4EFB] font-bold text-[10px] border border-indigo-200 transition-colors flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>

                            {/* Renew / Extend */}
                            <button
                              type="button"
                              onClick={() => handlePasskeyAction(pk.id, "renew", 30)}
                              disabled={actionLoadingId === pk.id}
                              title="Renew access (+30 days)"
                              className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-200 transition-colors"
                            >
                              +30d
                            </button>

                            {/* Toggle Disable / Enable */}
                            {pk.status === "DISABLED" ? (
                              <button
                                type="button"
                                onClick={() => handlePasskeyAction(pk.id, "enable")}
                                disabled={actionLoadingId === pk.id}
                                className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200 hover:bg-blue-100"
                              >
                                Enable
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handlePasskeyAction(pk.id, "disable")}
                                disabled={actionLoadingId === pk.id}
                                className="px-2 py-1 rounded-lg bg-gray-50 text-gray-600 font-bold text-[10px] border border-gray-200 hover:bg-gray-100"
                              >
                                Disable
                              </button>
                            )}

                            {/* Revoke */}
                            {pk.status !== "REVOKED" && (
                              <button
                                type="button"
                                onClick={() => handlePasskeyAction(pk.id, "revoke")}
                                disabled={actionLoadingId === pk.id}
                                className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 font-bold text-[10px] border border-amber-200 hover:bg-amber-100"
                              >
                                Revoke
                              </button>
                            )}

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleDeletePasskey(pk.id)}
                              disabled={actionLoadingId === pk.id}
                              title="Safely Delete Passkey"
                              className="p-1 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPasskeys.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-[#252943]/50">
                        {passkeys.length === 0
                          ? 'No passkeys found. Click "Create New Passkey" above.'
                          : `No passkeys match "${passkeySearchQuery}".`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: LIVE BACKEND MONITORING
      ====================================================================== */}
      {activeTab === "monitoring" && diagnostics && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Controls */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#252943]">Operational Monitoring Dashboard</h2>
              <p className="text-xs text-[#252943]/60">
                Real-time daemon, order queue, worker concurrency, and provider API diagnostics.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-bold text-[#252943]/70 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded text-[#3A4EFB]"
                />
                <span>Auto-refresh (15s)</span>
              </label>
            </div>
          </div>

          {/* System Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#252943]/60 uppercase">
                <span>Backend Service</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
              <div className="text-xl font-extrabold text-[#252943]">
                {diagnostics.systemStatus.backendStatus}
              </div>
              <span className="text-[11px] text-[#252943]/50 block">Node.js + SQLite Engine</span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#252943]/60 uppercase">
                <span>Background Worker</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
              <div className="text-xl font-extrabold text-[#252943]">
                {diagnostics.systemStatus.workerStatus}
              </div>
              <span className="text-[11px] text-[#252943]/50 block">
                {diagnostics.systemStatus.lastWorkerHeartbeat
                  ? `Heartbeat ${new Date(diagnostics.systemStatus.lastWorkerHeartbeat).toLocaleTimeString()}`
                  : "Worker Daemon Running"}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#252943]/60 uppercase">
                <span>Scheduled Jobs Queue</span>
                <Clock className="w-3.5 h-3.5 text-[#3A4EFB]" />
              </div>
              <div className="text-xl font-extrabold text-[#252943]">
                {diagnostics.systemStatus.pendingJobsCount} Pending
              </div>
              <span className="text-[11px] text-[#252943]/50 block">
                {diagnostics.systemStatus.completedJobsCount} completed, {diagnostics.systemStatus.failedJobsCount} failed
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#252943]/60 uppercase">
                <span>Last Provider Op</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-base font-extrabold text-[#252943] truncate">
                {diagnostics.systemStatus.lastSuccessfulProviderOp?.action || "Verified"}
              </div>
              <span className="text-[11px] text-[#252943]/50 block">
                {diagnostics.systemStatus.lastSuccessfulProviderOp
                  ? `${diagnostics.systemStatus.lastSuccessfulProviderOp.durationMs}ms latency`
                  : "All endpoints operational"}
              </span>
            </div>
          </div>

          {/* Order Processing Metrics & User Statistics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Order Processing Breakdown */}
            <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
                <h3 className="text-sm font-bold text-[#252943]">Order Processing Breakdown</h3>
                <span className="text-xs font-extrabold text-[#3A4EFB]">
                  {diagnostics.orderProcessing.totalOrders} Total Orders
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <span className="text-[#3A4EFB] font-bold block mb-1">Processing</span>
                  <span className="text-xl font-extrabold text-blue-900">
                    {diagnostics.orderProcessing.processingOrders}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <span className="text-emerald-700 font-bold block mb-1">Completed</span>
                  <span className="text-xl font-extrabold text-emerald-900">
                    {diagnostics.orderProcessing.completedOrders}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <span className="text-amber-700 font-bold block mb-1">Awaiting</span>
                  <span className="text-xl font-extrabold text-amber-900">
                    {diagnostics.orderProcessing.awaitingExecution}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                  <span className="text-red-700 font-bold block mb-1">Failed</span>
                  <span className="text-xl font-extrabold text-red-900">
                    {diagnostics.orderProcessing.failedOrders}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <span className="text-gray-600 font-bold block mb-1">Cancelled</span>
                  <span className="text-xl font-extrabold text-gray-800">
                    {diagnostics.orderProcessing.cancelledOrders}
                  </span>
                </div>
              </div>
            </div>

            {/* User Account Statistics */}
            <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
                <h3 className="text-sm font-bold text-[#252943]">User & Provider Isolation Stats</h3>
                <span className="text-xs font-extrabold text-emerald-600">
                  {diagnostics.userStatistics.workingProviders} Live Connected Providers
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]">
                  <span className="text-[#252943]/60 font-semibold block mb-1">Registered Users</span>
                  <span className="text-2xl font-black text-[#252943]">
                    {diagnostics.userStatistics.totalUsers}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]">
                  <span className="text-[#252943]/60 font-semibold block mb-1">Active Accounts</span>
                  <span className="text-2xl font-black text-emerald-600">
                    {diagnostics.userStatistics.activeUsers}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]">
                  <span className="text-[#252943]/60 font-semibold block mb-1">Configured Provider APIs</span>
                  <span className="text-2xl font-black text-[#3A4EFB]">
                    {diagnostics.userStatistics.totalConfiguredProviders}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]">
                  <span className="text-[#252943]/60 font-semibold block mb-1">Disabled Accounts</span>
                  <span className="text-2xl font-black text-amber-700">
                    {diagnostics.userStatistics.disabledUsers}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* User Provider Isolated Connections Table */}
          <div className="bg-white rounded-3xl border border-[#DEE0ED] shadow-subtle p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#252943]">User Provider API Connections</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FD] text-[#252943]/60 uppercase text-[10px] font-bold border-b border-[#DEE0ED]">
                  <tr>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Provider Name</th>
                    <th className="px-4 py-3">API Endpoint</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DEE0ED]/60 font-medium">
                  {diagnostics.providerHealth.userProviders.map((up) => (
                    <tr key={up.id}>
                      <td className="px-4 py-2.5 font-bold text-[#252943]">{up.username}</td>
                      <td className="px-4 py-2.5">{up.name}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-[#252943]/70">{up.apiUrl}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${up.isMock ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                          {up.isMock ? "Mock" : "Live"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-extrabold text-[#252943]">
                        {formatProviderBalance(up.balance, up.currency)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${up.status === "Connected" ? "bg-emerald-100 text-emerald-800" : up.status === "Error" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-700"}`}>
                          {up.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {diagnostics.providerHealth.userProviders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-[#252943]/50">
                        No active user provider configurations.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: SYSTEM PROVIDER FALLBACK
      ====================================================================== */}
      {activeTab === "provider" && (
        <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 sm:p-8 shadow-subtle space-y-6 animate-fadeIn">
          <div>
            <h2 className="text-base font-bold text-[#252943]">Fallback System Provider Configuration</h2>
            <p className="text-xs text-[#252943]/60">
              Used as a fallback for background tasks and automated tests when no specific user configuration is supplied.
            </p>
          </div>

          <form onSubmit={handleSaveSystemProvider} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-bold text-[#252943] mb-1">Provider Label</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#252943]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#252943] mb-1">API Endpoint URL</label>
              <input
                type="url"
                value={editApiUrl}
                onChange={(e) => setEditApiUrl(e.target.value)}
                className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2.5 text-xs font-mono font-semibold text-[#252943]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#252943] mb-1">API Key</label>
              <input
                type="password"
                value={editApiKey}
                onChange={(e) => setEditApiKey(e.target.value)}
                placeholder="Enter new key to replace existing"
                className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#252943]"
              />
            </div>

            <div className="p-3 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] flex items-center justify-between">
              <span className="text-xs font-bold text-[#252943]">System Mock Mode</span>
              <input
                type="checkbox"
                checked={editIsMock}
                onChange={(e) => setEditIsMock(e.target.checked)}
                className="rounded text-[#3A4EFB]"
              />
            </div>

            <button
              type="submit"
              disabled={savingProvider}
              className="px-6 py-2.5 rounded-xl bg-[#252943] text-white text-xs font-bold shadow-subtle hover:bg-[#1A1D31]"
            >
              {savingProvider ? "Saving..." : "Save System Config"}
            </button>
          </form>
        </div>
      )}

      {/* =====================================================================
          TAB 4: AUDIT LOG
      ====================================================================== */}
      {activeTab === "audit" && diagnostics && (
        <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-4 animate-fadeIn">
          <h2 className="text-base font-bold text-[#252943]">Administrative Audit Trail</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FD] text-[#252943]/60 uppercase text-[10px] font-bold border-b border-[#DEE0ED]">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEE0ED]/60 font-medium">
                {diagnostics.recentAuditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-2.5 text-[11px] text-[#252943]/50">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-[#3A4EFB]">{log.action}</td>
                    <td className="px-4 py-2.5">{log.actor}</td>
                    <td className="px-4 py-2.5 text-[#252943]/80">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 5: FULL ENGAGEMENT PROFILES & SERVICE MAPPINGS
      ====================================================================== */}
      {activeTab === "engagement" && (
        <div className="space-y-6 animate-fadeIn">
          {/* TikTok Organic Engagement System Admin Configuration (Section 8) */}
          <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 sm:p-8 shadow-subtle space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DEE0ED]">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#3A4EFB]/10 text-[#3A4EFB] flex items-center justify-center font-bold">
                    <Zap className="w-4 h-4" />
                  </div>
                  <h2 className="text-base font-black text-[#252943]">
                    TikTok Organic Engagement Automation Preset
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#E3FF3B]/30 border border-[#252943]/20 text-[#252943] text-[10px] font-black uppercase">
                    Admin Controlled
                  </span>
                </div>
                <p className="text-xs text-[#252943]/60 max-w-2xl">
                  Configure delivery quantities, run counts, intervals, and Delayed Likes Protection thresholds for the standalone TikTok Organic Working Preset.
                </p>
              </div>

              {tiktokConfig && (
                <button
                  type="button"
                  onClick={handleSaveTiktokConfig}
                  disabled={savingTiktokConfig}
                  className="px-4 py-2 rounded-xl bg-[#3A4EFB] hover:bg-[#252943] text-white text-xs font-bold transition-all shadow-subtle flex items-center gap-1.5 self-start sm:self-center"
                >
                  {savingTiktokConfig ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Save Preset Settings</span>
                </button>
              )}
            </div>

            {tiktokConfig ? (
              <form onSubmit={handleSaveTiktokConfig} className="space-y-6 text-xs">
                {/* Master Switch & Preset Name */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED]">
                  <div className="flex items-center justify-between sm:justify-start gap-4">
                    <div>
                      <span className="font-bold text-[#252943] block">Engagement System</span>
                      <span className="text-[11px] text-[#252943]/60">Allow users to place organic orders</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tiktokConfig.enabled}
                        onChange={(e) => setTiktokConfig({ ...tiktokConfig, enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-[#252943] mb-1">Preset Display Name</label>
                    <input
                      type="text"
                      value={tiktokConfig.presetName}
                      onChange={(e) => setTiktokConfig({ ...tiktokConfig, presetName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold text-[#252943]"
                      required
                    />
                  </div>
                </div>

                {/* Two Column Grid: Views vs Likes Configurations */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* VIEWS CONFIGURATION */}
                  <div className="p-5 rounded-2xl border border-[#DEE0ED] bg-[#F8F9FD]/50 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[#DEE0ED]">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-[#3A4EFB]" />
                        <span className="font-bold text-sm text-[#252943]">TikTok Views Configuration</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                        {tiktokConfig.views?.providerName || "Views Provider"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Provider Name</label>
                        <input
                          type="text"
                          value={tiktokConfig.views?.providerName || "Views Provider"}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              views: { ...tiktokConfig.views, providerName: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-medium"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Service ID</label>
                        <input
                          type="text"
                          value={tiktokConfig.views?.serviceId || "10322"}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              views: { ...tiktokConfig.views, serviceId: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-mono font-bold text-[#3A4EFB]"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Min Batch Quantity</label>
                        <input
                          type="number"
                          value={tiktokConfig.views?.minQuantity ?? 150}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              views: { ...tiktokConfig.views, minQuantity: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold"
                          min={1}
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Max Batch Quantity</label>
                        <input
                          type="number"
                          value={tiktokConfig.views?.maxQuantity ?? 220}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              views: { ...tiktokConfig.views, maxQuantity: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold"
                          min={1}
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Number of Runs</label>
                        <input
                          type="number"
                          value={tiktokConfig.views?.runsCount ?? 16}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              views: { ...tiktokConfig.views, runsCount: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold"
                          min={1}
                          max={100}
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Interval (Minutes)</label>
                        <input
                          type="number"
                          value={tiktokConfig.views?.intervalMinutes ?? 20}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              views: { ...tiktokConfig.views, intervalMinutes: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold"
                          min={1}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* LIKES CONFIGURATION */}
                  <div className="p-5 rounded-2xl border border-[#DEE0ED] bg-[#F8F9FD]/50 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[#DEE0ED]">
                      <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-rose-600" />
                        <span className="font-bold text-sm text-[#252943]">TikTok Likes Configuration</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                        {tiktokConfig.likes?.providerName || "Likes Provider"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Provider Name</label>
                        <input
                          type="text"
                          value={tiktokConfig.likes?.providerName || "Likes Provider"}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              likes: { ...tiktokConfig.likes, providerName: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-medium"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Service ID</label>
                        <input
                          type="text"
                          value={tiktokConfig.likes?.serviceId || "1123"}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              likes: { ...tiktokConfig.likes, serviceId: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-mono font-bold text-[#3A4EFB]"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Min Batch Quantity</label>
                        <input
                          type="number"
                          value={tiktokConfig.likes?.minQuantity ?? 12}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              likes: { ...tiktokConfig.likes, minQuantity: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold"
                          min={1}
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Max Batch Quantity</label>
                        <input
                          type="number"
                          value={tiktokConfig.likes?.maxQuantity ?? 16}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              likes: { ...tiktokConfig.likes, maxQuantity: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold"
                          min={1}
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Number of Runs</label>
                        <input
                          type="number"
                          value={tiktokConfig.likes?.runsCount ?? 3}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              likes: { ...tiktokConfig.likes, runsCount: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold"
                          min={1}
                          max={50}
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Interval (Minutes)</label>
                        <input
                          type="number"
                          value={tiktokConfig.likes?.intervalMinutes ?? 120}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              likes: { ...tiktokConfig.likes, intervalMinutes: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold"
                          min={1}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* SAVES CONFIGURATION */}
                  <div className="p-5 rounded-2xl border border-[#DEE0ED] bg-[#F8F9FD]/50 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[#DEE0ED]">
                      <div className="flex items-center gap-2">
                        <Bookmark className="w-4 h-4 text-amber-600" />
                        <span className="font-bold text-sm text-[#252943]">TikTok Saves Configuration</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                        {tiktokConfig.saves?.providerName || "Engagement Engine"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Provider Name</label>
                        <input
                          type="text"
                          value={tiktokConfig.saves?.providerName || "Engagement Engine"}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              saves: { ...(tiktokConfig.saves || {}), providerName: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-medium"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Service ID</label>
                        <input
                          type="text"
                          value={tiktokConfig.saves?.serviceId || "807"}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              saves: { ...(tiktokConfig.saves || {}), serviceId: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-mono font-bold text-[#3A4EFB]"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Min Batch Quantity</label>
                        <input
                          type="number"
                          value={tiktokConfig.saves?.minQuantity ?? 5}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              saves: { ...(tiktokConfig.saves || {}), minQuantity: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold"
                          min={1}
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Max Batch Quantity</label>
                        <input
                          type="number"
                          value={tiktokConfig.saves?.maxQuantity ?? 10}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              saves: { ...(tiktokConfig.saves || {}), maxQuantity: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold"
                          min={1}
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Number of Runs</label>
                        <input
                          type="number"
                          value={tiktokConfig.saves?.runsCount ?? 4}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              saves: { ...(tiktokConfig.saves || {}), runsCount: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold"
                          min={1}
                          max={50}
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Interval (Minutes)</label>
                        <input
                          type="number"
                          value={tiktokConfig.saves?.intervalMinutes ?? 120}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              saves: { ...(tiktokConfig.saves || {}), intervalMinutes: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold"
                          min={1}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* SHARES / REPOSTS CONFIGURATION */}
                  <div className="p-5 rounded-2xl border border-[#DEE0ED] bg-[#F8F9FD]/50 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[#DEE0ED]">
                      <div className="flex items-center gap-2">
                        <Share2 className="w-4 h-4 text-purple-600" />
                        <span className="font-bold text-sm text-[#252943]">TikTok Reposts / Shares Configuration</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold">
                        {tiktokConfig.shares?.providerName || "Engagement Engine"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Provider Name</label>
                        <input
                          type="text"
                          value={tiktokConfig.shares?.providerName || "Engagement Engine"}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              shares: { ...(tiktokConfig.shares || {}), providerName: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-medium"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Service ID</label>
                        <input
                          type="text"
                          value={tiktokConfig.shares?.serviceId || "718"}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              shares: { ...(tiktokConfig.shares || {}), serviceId: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-mono font-bold text-[#3A4EFB]"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Min Batch Quantity</label>
                        <input
                          type="number"
                          value={tiktokConfig.shares?.minQuantity ?? 3}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              shares: { ...(tiktokConfig.shares || {}), minQuantity: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold"
                          min={1}
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Max Batch Quantity</label>
                        <input
                          type="number"
                          value={tiktokConfig.shares?.maxQuantity ?? 8}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              shares: { ...(tiktokConfig.shares || {}), maxQuantity: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold"
                          min={1}
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Number of Runs</label>
                        <input
                          type="number"
                          value={tiktokConfig.shares?.runsCount ?? 3}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              shares: { ...(tiktokConfig.shares || {}), runsCount: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold"
                          min={1}
                          max={50}
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-[#252943]/70 mb-1">Interval (Minutes)</label>
                        <input
                          type="number"
                          value={tiktokConfig.shares?.intervalMinutes ?? 120}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              shares: { ...(tiktokConfig.shares || {}), intervalMinutes: Number(e.target.value) },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-semibold"
                          min={1}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 4: Delayed Likes Protection Synchronization Threshold */}
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-300 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <span className="font-bold text-sm text-amber-950">
                      Delayed Likes Protection Synchronization Threshold
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900/80 leading-relaxed">
                    If confirmed views delivered reach between the configured min and max threshold while likes delivery is lagging or pending beyond the scheduled interval, the system triggers the next eligible likes delivery immediately.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                    <div>
                      <label className="block font-bold text-amber-950 mb-1">Min Views Threshold</label>
                      <input
                        type="number"
                        value={tiktokConfig.syncThreshold?.minViews ?? 500}
                        onChange={(e) =>
                          setTiktokConfig({
                            ...tiktokConfig,
                            syncThreshold: {
                              ...tiktokConfig.syncThreshold,
                              minViews: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-bold text-[#252943]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-amber-950 mb-1">Max Views Threshold</label>
                      <input
                        type="number"
                        value={tiktokConfig.syncThreshold?.maxViews ?? 700}
                        onChange={(e) =>
                          setTiktokConfig({
                            ...tiktokConfig,
                            syncThreshold: {
                              ...tiktokConfig.syncThreshold,
                              maxViews: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-bold text-[#252943]"
                        required
                      />
                    </div>
                  </div>
                </div>
              </form>
            ) : (
              <div className="p-8 text-center text-xs text-[#252943]/60 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#3A4EFB]" />
                <span>Loading TikTok Engagement configuration...</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 sm:p-8 shadow-subtle space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DEE0ED]">
              <div>
                <h2 className="text-base font-bold text-[#252943]">Platform Profiles & Provider Service Mappings</h2>
                <p className="text-xs text-[#252943]/60">
                  Config-driven pacing profiles. Each engagement type is mapped to a backend provider service with strictly enforced minimum batch sizes.
                </p>
              </div>
              <button
                type="button"
                onClick={loadAllAdminData}
                disabled={loadingData}
                className="px-3.5 py-2 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs font-bold text-[#252943] hover:bg-[#DEE0ED]/50 flex items-center gap-1.5 self-start"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? "animate-spin text-[#3A4EFB]" : ""}`} />
                <span>Reload Config</span>
              </button>
            </div>

            <div className="space-y-6">
              {engagementProfiles.map((prof: any) => (
                <div key={prof.id} className="rounded-2xl border border-[#DEE0ED] p-5 space-y-4 bg-[#F8F9FD]/40">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DEE0ED]/80">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#252943]">{prof.name}</span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                          {prof.badge}
                        </span>
                        <span className="text-[11px] font-mono text-[#252943]/50">ID: {prof.id}</span>
                      </div>
                      <p className="text-xs text-[#252943]/70 mt-0.5">{prof.description}</p>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#252943]/70 font-medium">
                      <span>k ∈ [{prof.viewsEnvelope.kRange.join(", ")}]</span>
                      <span>•</span>
                      <span>m ∈ [{prof.viewsEnvelope.mRange.join(", ")}]</span>
                    </div>
                  </div>

                  {/* Service Mapping Table */}
                  <div className="overflow-x-auto bg-white rounded-xl border border-[#DEE0ED]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8F9FD] text-[#252943]/60 uppercase text-[10px] font-bold border-b border-[#DEE0ED]">
                        <tr>
                          <th className="px-3 py-2.5">Type</th>
                          <th className="px-3 py-2.5">Mapped Service Name</th>
                          <th className="px-3 py-2.5">Provider ID</th>
                          <th className="px-3 py-2.5">External ID</th>
                          <th className="px-3 py-2.5">Min / Max</th>
                          <th className="px-3 py-2.5">Rate / 1k</th>
                          <th className="px-3 py-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DEE0ED]/60 font-medium">
                        {Object.entries(prof.serviceMappings || {}).map(([type, srv]: any) => (
                          <tr key={type} className="hover:bg-[#F8F9FD]">
                            <td className="px-3 py-2 font-bold capitalize text-[#252943]">{type}</td>
                            <td className="px-3 py-2 max-w-xs truncate text-[#252943]/90">{srv.name}</td>
                            <td className="px-3 py-2 font-mono text-[11px] text-[#252943]/60">{srv.providerId || "default"}</td>
                            <td className="px-3 py-2 font-mono text-[11px] font-bold text-[#3A4EFB]">{srv.providerServiceId || srv.id || "—"}</td>
                            <td className="px-3 py-2">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold">
                                {srv.minQuantity} - {srv.maxQuantity?.toLocaleString()}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-bold text-[#252943]">₹{srv.ratePer1000}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMapping({
                                    profileId: prof.id,
                                    type,
                                    providerId: srv.providerId || "prov-default",
                                    providerServiceId: srv.providerServiceId || srv.id || "",
                                    name: srv.name || "",
                                    minQuantity: srv.minQuantity || 10,
                                    maxQuantity: srv.maxQuantity || 100000,
                                    ratePer1000: srv.ratePer1000 || 1.0,
                                  });
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#F8F9FD] hover:bg-[#DEE0ED] text-[11px] font-bold text-[#3A4EFB] transition-colors"
                              >
                                Remap
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Campaigns with Custom vs Suggested Breakdown */}
            <div className="bg-white rounded-2xl border border-[#DEE0ED] p-6 shadow-subtle space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#252943]">
                    Active Natural-Looking Delivery Campaigns
                  </h3>
                  <p className="text-xs text-[#252943]/60">
                    Live client orders showing breakdown quantities and user customization (Suggested vs Custom).
                  </p>
                </div>
                <a
                  href="/engagement/orders"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl border border-[#DEE0ED] text-xs font-bold text-[#3A4EFB] hover:bg-[#F8F9FD]"
                >
                  View All Orders
                </a>
              </div>

              {engagementOrders.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#252943]/60">
                  No active natural-looking delivery campaigns found.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#DEE0ED]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8F9FD] text-[#252943]/70 font-bold border-b border-[#DEE0ED]">
                      <tr>
                        <th className="py-2.5 px-3">Order Ref</th>
                        <th className="py-2.5 px-3">Platform</th>
                        <th className="py-2.5 px-3">Views</th>
                        <th className="py-2.5 px-3">Likes</th>
                        <th className="py-2.5 px-3">Saves</th>
                        <th className="py-2.5 px-3">Shares</th>
                        <th className="py-2.5 px-3">Comments</th>
                        <th className="py-2.5 px-3">Progress</th>
                        <th className="py-2.5 px-3 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DEE0ED]">
                      {engagementOrders.slice(0, 10).map((ord: any) => (
                        <tr key={ord.id} className="hover:bg-[#F8F9FD]/50">
                          <td className="py-2.5 px-3 font-mono font-bold text-[#252943]">
                            <Link
                              href={`/engagement/orders/${ord.id}`}
                              className="text-[#3A4EFB] hover:underline"
                              title="Open Live Delivery Dashboard"
                            >
                              {ord.orderRef}
                            </Link>
                          </td>
                          <td className="py-2.5 px-3 capitalize font-semibold text-[#252943]">
                            {ord.platform?.replace(/_/g, " ")}
                          </td>
                          <td className="py-2.5 px-3 font-medium">
                            <span className="font-bold">{ord.breakdown?.views?.planned?.toLocaleString()}</span>
                            {ord.sources?.views === "custom" && (
                              <span className="ml-1 px-1 py-0.2 rounded text-[9px] bg-amber-100 text-amber-800 font-bold">Custom</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-medium">
                            <span className="font-bold">{ord.breakdown?.likes?.planned?.toLocaleString()}</span>
                            {ord.sources?.likes === "custom" && (
                              <span className="ml-1 px-1 py-0.2 rounded text-[9px] bg-amber-100 text-amber-800 font-bold">Custom</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-medium">
                            <span className="font-bold">{ord.breakdown?.saves?.planned?.toLocaleString()}</span>
                            {ord.sources?.saves === "custom" && (
                              <span className="ml-1 px-1 py-0.2 rounded text-[9px] bg-amber-100 text-amber-800 font-bold">Custom</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-medium">
                            <span className="font-bold">{ord.breakdown?.shares?.planned?.toLocaleString()}</span>
                            {ord.sources?.shares === "custom" && (
                              <span className="ml-1 px-1 py-0.2 rounded text-[9px] bg-amber-100 text-amber-800 font-bold">Custom</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-medium">
                            <span className="font-bold">{ord.breakdown?.comments?.planned?.toLocaleString()}</span>
                            {ord.sources?.comments === "custom" && (
                              <span className="ml-1 px-1 py-0.2 rounded text-[9px] bg-amber-100 text-amber-800 font-bold">Custom</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-[#3A4EFB]">
                            {ord.progressPercent}% ({ord.completedRuns}/{ord.runsCount})
                          </td>
                          <td className="py-2.5 px-3 font-bold text-right text-[#252943]">
                            ₹{ord.totalCost?.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 6: ALERTS & DELIVERY HEALTH (Change J)
      ====================================================================== */}
      {activeTab === "alerts" && (
        <AlertsHealthTab />
      )}

      {/* Remap Service Modal */}
      {editingMapping && (
        <div className="fixed inset-0 z-50 bg-[#252943]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#DEE0ED] max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#3A4EFB]" />
                <h3 className="text-base font-bold text-[#252943]">
                  Remap Service ({editingMapping.profileId} • {editingMapping.type})
                </h3>
              </div>
              <button
                onClick={() => {
                  setEditingMapping(null);
                  setLookupStatus(null);
                }}
                className="text-[#252943]/40 hover:text-[#252943] text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEngagementMapping} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#252943] mb-1">Service Display Name</label>
                <input
                  type="text"
                  required
                  value={editingMapping.name}
                  onChange={(e) => setEditingMapping({ ...editingMapping, name: e.target.value })}
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2 font-semibold text-[#252943]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#252943] mb-1">Provider (Connected)</label>
                  <select
                    value={editingMapping.providerId}
                    onChange={(e) => {
                      const newProvId = e.target.value;
                      setEditingMapping({ ...editingMapping, providerId: newProvId });
                      handleLookupService(newProvId, editingMapping.providerServiceId);
                    }}
                    className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2 font-bold text-[#252943] outline-none"
                  >
                    {alertsMetrics?.providersStatus?.length > 0 ? (
                      alertsMetrics.providersStatus.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.active ? "• Active" : "• Paused"}
                        </option>
                      ))
                    ) : (
                      <option value="cmvm1iusy0000j5quq9ozboir">Primary Provider (Live)</option>
                    )}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-[#252943]">Provider Service ID</label>
                    <button
                      type="button"
                      onClick={() => handleLookupService(editingMapping.providerId, editingMapping.providerServiceId)}
                      disabled={lookupLoading}
                      className="text-[10px] text-[#3A4EFB] font-bold hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${lookupLoading ? "animate-spin" : ""}`} />
                      Re-sync
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 101"
                    value={editingMapping.providerServiceId}
                    onChange={(e) => {
                      const newSrvId = e.target.value;
                      setEditingMapping({ ...editingMapping, providerServiceId: newSrvId });
                    }}
                    onBlur={() => handleLookupService(editingMapping.providerId, editingMapping.providerServiceId)}
                    className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2 font-mono font-bold text-[#252943]"
                  />
                </div>
              </div>

              {/* Service Verification Status Display */}
              {lookupLoading && (
                <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 flex items-center gap-2 text-xs font-semibold text-blue-800">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3A4EFB]" />
                  <span>Verifying service ID on provider...</span>
                </div>
              )}
              {!lookupLoading && lookupStatus && (
                <div
                  className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                    lookupStatus.exists
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-rose-50 border-rose-200 text-rose-800"
                  }`}
                >
                  {lookupStatus.exists ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{lookupStatus.message}</span>
                </div>
              )}

              {/* Read-only Min, Max and Rate per 1k */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-[#252943]/60 mb-1">Min Batch (Read-only)</label>
                  <input
                    type="number"
                    readOnly
                    value={editingMapping.minQuantity}
                    className="w-full bg-gray-100/80 border border-[#DEE0ED] rounded-xl px-2.5 py-2 font-bold text-[#252943]/80 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#252943]/60 mb-1">Max Batch (Read-only)</label>
                  <input
                    type="number"
                    readOnly
                    value={editingMapping.maxQuantity}
                    className="w-full bg-gray-100/80 border border-[#DEE0ED] rounded-xl px-2.5 py-2 font-bold text-[#252943]/80 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#252943]/60 mb-1">Rate / 1k ₹ (Read-only)</label>
                  <input
                    type="number"
                    step="0.01"
                    readOnly
                    value={editingMapping.ratePer1000}
                    className="w-full bg-gray-100/80 border border-[#DEE0ED] rounded-xl px-2.5 py-2 font-bold text-[#252943]/80 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingMapping(null);
                    setLookupStatus(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-[#DEE0ED] text-xs font-semibold text-[#252943]/70 hover:bg-[#F8F9FD]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMapping || (lookupStatus !== null && !lookupStatus.exists)}
                  className="px-5 py-2 rounded-xl bg-[#3A4EFB] text-white text-xs font-bold shadow-subtle hover:bg-[#2A3DE0] disabled:opacity-50"
                >
                  {savingMapping ? "Saving..." : "Save Mapping"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          CREATE PASSKEY MODAL
      ====================================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-[#252943]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#DEE0ED] max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 animate-scaleUp">
            {!createdSecret ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
                  <div className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-[#3A4EFB]" />
                    <h3 className="text-base font-bold text-[#252943]">Generate Access Passkey</h3>
                  </div>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="p-1 rounded-lg text-gray-400 hover:text-gray-700"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreatePasskey} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#252943] mb-1">
                      Passkey Label *
                    </label>
                    <input
                      type="text"
                      required
                      value={newKeyLabel}
                      onChange={(e) => setNewKeyLabel(e.target.value)}
                      placeholder="e.g. Whop Subscriber #120"
                      className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#252943] focus:border-[#3A4EFB] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#252943] mb-1">
                      Account Role
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewKeyRole("USER")}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                          newKeyRole === "USER"
                            ? "bg-[#3A4EFB] text-white border-[#3A4EFB]"
                            : "bg-[#F8F9FD] text-[#252943]/70 border-[#DEE0ED]"
                        }`}
                      >
                        USER (Standard Panel)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewKeyRole("ADMIN")}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                          newKeyRole === "ADMIN"
                            ? "bg-[#252943] text-[#E3FF3B] border-[#252943]"
                            : "bg-[#F8F9FD] text-[#252943]/70 border-[#DEE0ED]"
                        }`}
                      >
                        ADMIN (Full Access)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#252943] mb-1">
                      Access Duration
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-2">
                      {[
                        { label: "1 Day", val: 1 },
                        { label: "7 Days", val: 7 },
                        { label: "14 Days", val: 14 },
                        { label: "30 Days", val: 30 },
                        { label: "90 Days", val: 90 },
                        { label: "365 Days", val: 365 },
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setNewKeyDuration(item.val)}
                          className={`py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                            newKeyDuration === item.val
                              ? "bg-[#3A4EFB] text-white border-[#3A4EFB] shadow-sm"
                              : "bg-[#F8F9FD] text-[#252943]/70 border-[#DEE0ED] hover:bg-white"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setNewKeyDuration("permanent")}
                        className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                          newKeyDuration === "permanent"
                            ? "bg-[#252943] text-[#E3FF3B] border-[#252943] shadow-sm"
                            : "bg-[#F8F9FD] text-[#252943]/70 border-[#DEE0ED] hover:bg-white"
                        }`}
                      >
                        Permanent / Unlimited
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewKeyDuration("custom")}
                        className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                          newKeyDuration === "custom"
                            ? "bg-[#3A4EFB] text-white border-[#3A4EFB]"
                            : "bg-[#F8F9FD] text-[#252943]/70 border-[#DEE0ED] hover:bg-white"
                        }`}
                      >
                        Custom Days:
                      </button>
                      {newKeyDuration === "custom" && (
                        <input
                          type="number"
                          min={1}
                          max={3650}
                          value={customDaysInput}
                          onChange={(e) => setCustomDaysInput(e.target.value)}
                          className="w-24 bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-2.5 py-1 text-xs font-bold outline-none focus:border-[#3A4EFB]"
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#252943] mb-1">
                      Custom Passkey String (Optional)
                    </label>
                    <input
                      type="text"
                      value={customPasskeyString}
                      onChange={(e) => setCustomPasskeyString(e.target.value)}
                      placeholder="Leave blank to auto-generate secure key"
                      className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#252943]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 rounded-xl border border-[#DEE0ED] text-xs font-bold text-[#252943]/70"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creatingKey || !newKeyLabel.trim()}
                      className="px-5 py-2 rounded-xl bg-[#3A4EFB] text-white text-xs font-bold hover:bg-[#2F40DB] shadow-subtle disabled:opacity-50"
                    >
                      {creatingKey ? "Generating..." : "Generate Passkey"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              /* Newly Generated Passkey Reveal View */
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold">Passkey Successfully Created!</h4>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Copy this passkey now. For security, the plaintext key cannot be retrieved later.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-[#252943] block">Secret Passkey</span>
                  <div className="p-3.5 rounded-2xl bg-[#141624] text-white flex items-center justify-between font-mono text-sm border border-[#323758]">
                    <span className="break-all">{createdSecret.key}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(createdSecret.key);
                        setCopiedKey(true);
                        setTimeout(() => setCopiedKey(false), 2500);
                      }}
                      className="p-1.5 ml-2 rounded-lg bg-[#3A4EFB] hover:bg-[#2F40DB] text-white shrink-0"
                    >
                      {copiedKey ? <Check className="w-4 h-4 text-[#E3FF3B]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  {copiedKey && (
                    <span className="text-[11px] font-bold text-emerald-600 block">
                      Copied to clipboard!
                    </span>
                  )}
                </div>

                <div className="text-xs text-[#252943]/70 space-y-1 bg-[#F8F9FD] p-3 rounded-xl border border-[#DEE0ED]">
                  <div>Label: <strong>{createdSecret.label}</strong></div>
                  <div>Role: <strong>{createdSecret.role}</strong></div>
                  <div>Expires: <strong>{createdSecret.expiresAt ? new Date(createdSecret.expiresAt).toLocaleDateString() : "Permanent"}</strong></div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-full py-2.5 rounded-xl bg-[#252943] text-white text-xs font-bold hover:bg-[#1A1D31]"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* =====================================================================
          EDIT PASSKEY MODAL
      ====================================================================== */}
      {editingPasskey && (
        <div className="fixed inset-0 z-50 bg-[#252943]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#DEE0ED] max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 animate-scaleUp">
            {editResultSecret ? (
              /* Success View if Secret Passkey was Changed */
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold">Passkey Secret Updated!</h4>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      The passkey secret was reset. Copy the new secret string now.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-[#252943] block">New Secret Passkey</span>
                  <div className="p-3.5 rounded-2xl bg-[#141624] text-white flex items-center justify-between font-mono text-sm border border-[#323758]">
                    <span className="break-all">{editResultSecret}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(editResultSecret);
                        setCopiedKey(true);
                        setTimeout(() => setCopiedKey(false), 2500);
                      }}
                      className="p-1.5 ml-2 rounded-lg bg-[#3A4EFB] hover:bg-[#2F40DB] text-white shrink-0"
                    >
                      {copiedKey ? <Check className="w-4 h-4 text-[#E3FF3B]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  {copiedKey && (
                    <span className="text-[11px] font-bold text-emerald-600 block">
                      Copied to clipboard!
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingPasskey(null);
                    setEditResultSecret(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#252943] text-white text-xs font-bold hover:bg-[#1A1D31]"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-5 h-5 text-[#3A4EFB]" />
                    <h3 className="text-base font-bold text-[#252943]">
                      Edit Passkey: <span className="text-[#3A4EFB]">{editingPasskey.label}</span>
                    </h3>
                  </div>
                  <button
                    onClick={() => setEditingPasskey(null)}
                    className="p-1 rounded-lg text-gray-400 hover:text-gray-700"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveEditedPasskey} className="space-y-4">
                  {/* Label */}
                  <div>
                    <label className="block text-xs font-bold text-[#252943] mb-1">
                      Passkey Label *
                    </label>
                    <input
                      type="text"
                      required
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#252943] focus:border-[#3A4EFB] outline-none"
                    />
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block text-xs font-bold text-[#252943] mb-1">
                      Account Role
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditRole("USER")}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                          editRole === "USER"
                            ? "bg-[#3A4EFB] text-white border-[#3A4EFB]"
                            : "bg-[#F8F9FD] text-[#252943]/70 border-[#DEE0ED]"
                        }`}
                      >
                        USER (Standard Panel)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditRole("ADMIN")}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                          editRole === "ADMIN"
                            ? "bg-[#252943] text-[#E3FF3B] border-[#252943]"
                            : "bg-[#F8F9FD] text-[#252943]/70 border-[#DEE0ED]"
                        }`}
                      >
                        ADMIN (Full Access)
                      </button>
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-xs font-bold text-[#252943] mb-1">
                      Status
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["ACTIVE", "DISABLED", "REVOKED"] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setEditStatus(st)}
                          className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                            editStatus === st
                              ? st === "ACTIVE"
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : st === "DISABLED"
                                ? "bg-gray-600 text-white border-gray-600"
                                : "bg-red-600 text-white border-red-600"
                              : "bg-[#F8F9FD] text-[#252943]/70 border-[#DEE0ED]"
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Expiration / Duration */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-[#252943]">
                        Access Expiration
                      </label>
                      <span className="text-[11px] text-[#252943]/50">
                        Current: {editingPasskey.expiresAt ? new Date(editingPasskey.expiresAt).toLocaleDateString() : "Permanent"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
                      <button
                        type="button"
                        onClick={() => setEditDurationType("keep")}
                        className={`py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                          editDurationType === "keep"
                            ? "bg-[#3A4EFB] text-white border-[#3A4EFB]"
                            : "bg-[#F8F9FD] text-[#252943]/70 border-[#DEE0ED]"
                        }`}
                      >
                        Keep Current
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditDurationType("permanent")}
                        className={`py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                          editDurationType === "permanent"
                            ? "bg-[#252943] text-[#E3FF3B] border-[#252943]"
                            : "bg-[#F8F9FD] text-[#252943]/70 border-[#DEE0ED]"
                        }`}
                      >
                        Permanent
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditDurationType("preset")}
                        className={`py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                          editDurationType === "preset"
                            ? "bg-[#3A4EFB] text-white border-[#3A4EFB]"
                            : "bg-[#F8F9FD] text-[#252943]/70 border-[#DEE0ED]"
                        }`}
                      >
                        Preset Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditDurationType("customDate")}
                        className={`py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                          editDurationType === "customDate"
                            ? "bg-[#3A4EFB] text-white border-[#3A4EFB]"
                            : "bg-[#F8F9FD] text-[#252943]/70 border-[#DEE0ED]"
                        }`}
                      >
                        Specific Date
                      </button>
                    </div>

                    {editDurationType === "preset" && (
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
                        {[
                          { label: "1d", val: 1 },
                          { label: "7d", val: 7 },
                          { label: "14d", val: 14 },
                          { label: "30d", val: 30 },
                          { label: "90d", val: 90 },
                          { label: "365d", val: 365 },
                        ].map((item) => (
                          <button
                            key={item.val}
                            type="button"
                            onClick={() => setEditPresetDays(item.val)}
                            className={`py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                              editPresetDays === item.val
                                ? "bg-[#3A4EFB] text-white border-[#3A4EFB]"
                                : "bg-[#F8F9FD] text-[#252943]/70 border-[#DEE0ED]"
                            }`}
                          >
                            +{item.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {editDurationType === "customDate" && (
                      <div className="pt-1">
                        <input
                          type="date"
                          value={editCustomDate}
                          onChange={(e) => setEditCustomDate(e.target.value)}
                          className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3 py-2 text-xs font-bold text-[#252943] outline-none focus:border-[#3A4EFB]"
                        />
                      </div>
                    )}
                  </div>

                  {/* Reset/Change Passkey String (Optional) */}
                  <div className="border-t border-[#DEE0ED] pt-3">
                    <label className="block text-xs font-bold text-[#252943] mb-1">
                      Reset Passkey Secret String (Optional)
                    </label>
                    <input
                      type="text"
                      value={editNewCustomKey}
                      onChange={(e) => setEditNewCustomKey(e.target.value)}
                      placeholder="Leave blank to keep existing secret key"
                      className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#252943] outline-none focus:border-[#3A4EFB]"
                    />
                    <p className="text-[10px] text-[#252943]/50 mt-1">
                      Enter a new passkey secret if you want to replace the current secret key for this passkey.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setEditingPasskey(null)}
                      className="px-4 py-2 rounded-xl border border-[#DEE0ED] text-xs font-bold text-[#252943]/70"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingEditKey || !editLabel.trim()}
                      className="px-5 py-2 rounded-xl bg-[#3A4EFB] text-white text-xs font-bold hover:bg-[#2F40DB] shadow-subtle disabled:opacity-50"
                    >
                      {savingEditKey ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

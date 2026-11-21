"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EngagementServicesManager } from "@/components/admin/EngagementServicesManager";
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
  MessageCircle,
  Eye,
  Heart,
  Bookmark,
  Share2,
  CreditCard,
  Percent,
  Coins,
  MessageSquare,
  TrendingUp,
  Save,
  Wrench,
  Hammer,
  LogOut,
  Megaphone,
} from "lucide-react";
import { formatProviderBalance } from "@/lib/currency";
import { OrderMonitorTab } from "@/components/admin/OrderMonitorTab";
import { AlertsHealthTab } from "@/components/admin/AlertsHealthTab";
import { BinanceDepositsTab } from "@/components/admin/BinanceDepositsTab";
import { RevenueProfitTab } from "@/components/admin/RevenueProfitTab";
import { UsersLiveActivityTab } from "@/components/admin/UsersLiveActivityTab";
import { SiteAnnouncementTab } from "@/components/admin/SiteAnnouncementTab";

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

export type AdminCategory = "customers" | "financials" | "operations" | "settings";
export type CustomersSubTab = "directory" | "passkeys";
export type FinancialsSubTab = "revenue" | "deposits";
export type OperationsSubTab = "orders" | "alerts";
export type SettingsSubTab = "engagement" | "provider" | "announcement";

export default function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState<{ authenticated: boolean; label?: string; role?: string } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Announcement Active State for Quick Header Pill
  const [announcementActive, setAnnouncementActive] = useState<boolean>(false);

  // Login form state
  const [accessKeyInput, setAccessKeyInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // 4 Unified Admin Categories & Sub-tabs state
  const [category, setCategory] = useState<AdminCategory>("customers");
  const [customersSubTab, setCustomersSubTab] = useState<CustomersSubTab>("directory");
  const [financialsSubTab, setFinancialsSubTab] = useState<FinancialsSubTab>("revenue");
  const [operationsSubTab, setOperationsSubTab] = useState<OperationsSubTab>("orders");
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>("engagement");

  const [passkeys, setPasskeys] = useState<PasskeyData[]>([]);
  const [passkeySearchQuery, setPasskeySearchQuery] = useState("");
  const [engagementProfiles, setEngagementProfiles] = useState<any[]>([]);
  const [engagementOrders, setEngagementOrders] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Alerts & Delivery Health state
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertsMetrics, setAlertsMetrics] = useState<any>(null);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

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

  // TikTok & Instagram Engagement Preset Config state
  const [adminPlatformTab, setAdminPlatformTab] = useState<"tiktok" | "instagram">("tiktok");
  const [tiktokPricingTab, setTiktokPricingTab] = useState<"standard" | "vip">("standard");
  const [instagramPricingTab, setInstagramPricingTab] = useState<"standard" | "vip">("standard");
  const [tiktokConfig, setTiktokConfig] = useState<any>(null);
  const [tiktokTierPresets, setTiktokTierPresets] = useState<Record<string, any>>({});
  const [selectedAdminPresetKey, setSelectedAdminPresetKey] = useState<string>("tiktok_2k");
  const [savingTiktokConfig, setSavingTiktokConfig] = useState(false);
  const [originalRates, setOriginalRates] = useState<{
    views: number;
    likes: number;
    saves: number;
    shares: number;
    comments: number;
  }>({
    views: 2.23,
    likes: 0.88,
    saves: 0.22,
    shares: 0.22,
    comments: 5.00,
  });
  const [instagramOriginalRates, setInstagramOriginalRates] = useState<{
    views: number;
    likes: number;
    saves: number;
    shares: number;
    comments: number;
  }>({
    views: 0.84,
    likes: 1.10,
    saves: 1.45,
    shares: 1.50,
    comments: 5.00,
  });

  // Maintenance (Under Update) State
  const [maintenance, setMaintenance] = useState<{
    enabled: boolean;
    title: string;
    message: string;
    supportTelegram: string;
    updatedAt?: string;
  }>({
    enabled: false,
    title: "Currently we're updating the website",
    message: "Please hold on for a moment while admin completes updates. Your orders are actively being delivered in the backend.",
    supportTelegram: "Ghostfinds",
  });
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);
  const [maintTitleInput, setMaintTitleInput] = useState("");
  const [maintMessageInput, setMaintMessageInput] = useState("");

  function getEffectiveRate(metric: "views" | "likes" | "saves" | "shares" | "comments", platform: "tiktok" | "instagram", isVip: boolean) {
    if (platform === "tiktok") {
      const orig = originalRates[metric] ?? 0;
      if (isVip) {
        if (tiktokConfig?.tiktokZeroProfitVip ?? true) return { rate: orig, profit: 0, margin: 0, isZero: true };
        const rate = Number(tiktokConfig?.tiktokVipPricing?.[`${metric}UserRate`] ?? orig);
        const profit = Number((rate - orig).toFixed(2));
        const margin = orig > 0 ? Math.round(((rate - orig) / orig) * 100) : 0;
        return { rate, profit, margin, isZero: false };
      }
      const rate = Number(tiktokConfig?.pricing?.[`${metric}UserRate`] ?? (metric === "views" ? 4.5 : metric === "likes" ? 2.0 : metric === "saves" ? 0.8 : metric === "shares" ? 0.8 : 15.0));
      const profit = Number((rate - orig).toFixed(2));
      const margin = orig > 0 ? Math.round(((rate - orig) / orig) * 100) : 0;
      return { rate, profit, margin, isZero: false };
    } else {
      const orig = instagramOriginalRates[metric] ?? 0;
      if (isVip) {
        if (tiktokConfig?.instagramZeroProfitVip ?? true) return { rate: orig, profit: 0, margin: 0, isZero: true };
        const rate = Number(tiktokConfig?.instagramVipPricing?.[`${metric}UserRate`] ?? orig);
        const profit = Number((rate - orig).toFixed(2));
        const margin = orig > 0 ? Math.round(((rate - orig) / orig) * 100) : 0;
        return { rate, profit, margin, isZero: false };
      }
      const rate = Number(tiktokConfig?.instagramPricing?.[`${metric}UserRate`] ?? (metric === "views" ? 3.5 : metric === "likes" ? 2.2 : metric === "saves" ? 2.5 : metric === "shares" ? 2.5 : 20.0));
      const profit = Number((rate - orig).toFixed(2));
      const margin = orig > 0 ? Math.round(((rate - orig) / orig) * 100) : 0;
      return { rate, profit, margin, isZero: false };
    }
  }

  function updateEffectiveRate(metric: string, platform: "tiktok" | "instagram", isVip: boolean, val: number) {
    if (platform === "tiktok") {
      if (isVip) {
        setTiktokConfig({
          ...tiktokConfig,
          tiktokVipPricing: {
            ...(tiktokConfig?.tiktokVipPricing || {}),
            [`${metric}UserRate`]: val,
          },
        });
      } else {
        setTiktokConfig({
          ...tiktokConfig,
          pricing: {
            ...(tiktokConfig?.pricing || {}),
            [`${metric}UserRate`]: val,
          },
        });
      }
    } else {
      if (isVip) {
        setTiktokConfig({
          ...tiktokConfig,
          instagramVipPricing: {
            ...(tiktokConfig?.instagramVipPricing || {}),
            [`${metric}UserRate`]: val,
          },
        });
      } else {
        setTiktokConfig({
          ...tiktokConfig,
          instagramPricing: {
            ...(tiktokConfig?.instagramPricing || {}),
            [`${metric}UserRate`]: val,
          },
        });
      }
    }
  }

  async function handleToggleMaintenance(nextEnabled: boolean) {
    setTogglingMaintenance(true);
    try {
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: nextEnabled,
          title: maintTitleInput.trim() || undefined,
          message: maintMessageInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to toggle maintenance mode");
      }
      setMaintenance(data.maintenance);
      setShowMaintenanceModal(false);
      setActionMsg({
        type: "success",
        text: nextEnabled
          ? "Website is now in Under Update mode. Regular users are blocked, but administrator has full access to all panels and backend order deliveries continue active."
          : "Website is now LIVE! User access has been fully restored.",
      });
    } catch (err: any) {
      setActionMsg({ type: "error", text: err.message || "Failed to update maintenance mode" });
    } finally {
      setTogglingMaintenance(false);
    }
  }

  // Check auth on load
  async function checkAuth() {
    try {
      const res = await fetch("/api/admin/auth");
      const data = await res.json();
      setSession(data);
      if (data.authenticated && data.role === "ADMIN") {
        await loadAllAdminData();
      } else {
        router.replace("/engagement");
      }
    } catch (err) {
      router.replace("/engagement");
    } finally {
      setCheckingAuth(false);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  // Direct Category & Sub-tab Navigator
  const navigateTo = (target: "directory" | "passkeys" | "revenue" | "deposits" | "orders" | "alerts" | "engagement" | "provider" | "announcement") => {
    if (target === "directory" || target === "passkeys") {
      setCategory("customers");
      setCustomersSubTab(target);
    } else if (target === "revenue" || target === "deposits") {
      setCategory("financials");
      setFinancialsSubTab(target);
    } else if (target === "orders" || target === "alerts") {
      setCategory("operations");
      setOperationsSubTab(target);
      if (target === "alerts") loadAlerts();
    } else if (target === "engagement" || target === "provider" || target === "announcement") {
      setCategory("settings");
      setSettingsSubTab(target);
    }
  };

  useEffect(() => {
    const handleAnnUpdate = () => {
      fetch("/api/admin/announcement")
        .then((r) => r.json())
        .then((data) => {
          if (data?.success && data?.announcement) {
            setAnnouncementActive(Boolean(data.announcement.enabled));
          }
        })
        .catch(() => {});
    };
    window.addEventListener("announcement-updated", handleAnnUpdate);
    return () => window.removeEventListener("announcement-updated", handleAnnUpdate);
  }, []);

  // Auto-refresh alerts
  useEffect(() => {
    if (!autoRefresh || !session?.authenticated) return;
    const interval = setInterval(() => {
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

  async function loadAllAdminData() {
    setLoadingData(true);
    try {
      const [keysRes, provRes, engRes, alertsRes, engOrdersRes, tiktokRes, maintRes, annRes] = await Promise.all([
        fetch("/api/admin/keys").then((r) => r.json()),
        fetch("/api/admin/provider").then((r) => r.json()),
        fetch("/api/admin/engagement-profiles").then((r) => r.json()).catch(() => ({ success: false })),
        fetch("/api/admin/alerts").then((r) => r.json()).catch(() => ({ success: false })),
        fetch("/api/engagement/orders").then((r) => r.json()).catch(() => ({ success: false })),
        fetch("/api/admin/engagement-config").then((r) => r.json()).catch(() => ({ success: false })),
        fetch("/api/admin/maintenance").then((r) => r.json()).catch(() => ({ success: false })),
        fetch("/api/admin/announcement").then((r) => r.json()).catch(() => ({ success: false })),
      ]);

      if (annRes?.success && annRes.announcement) {
        setAnnouncementActive(Boolean(annRes.announcement.enabled));
      }

      if (maintRes?.success && maintRes.maintenance) {
        setMaintenance(maintRes.maintenance);
        setMaintTitleInput(maintRes.maintenance.title);
        setMaintMessageInput(maintRes.maintenance.message);
      }

      if (keysRes.success) setPasskeys(keysRes.keys);
      if (engRes.success && engRes.profiles) setEngagementProfiles(engRes.profiles);
      if (engOrdersRes.success && Array.isArray(engOrdersRes.orders)) setEngagementOrders(engOrdersRes.orders);
      if (tiktokRes.success) {
        if (tiktokRes.config) setTiktokConfig(tiktokRes.config);
        if (tiktokRes.presets) setTiktokTierPresets(tiktokRes.presets);
        if (tiktokRes.originalRates) setOriginalRates(tiktokRes.originalRates);
        if (tiktokRes.instagramOriginalRates) setInstagramOriginalRates(tiktokRes.instagramOriginalRates);
      }
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

  async function handleSaveTiktokConfig(e?: React.SyntheticEvent) {
    if (e) e.preventDefault();
    if (!tiktokConfig) return;
    setSavingTiktokConfig(true);
    setActionMsg(null);
    try {
      const res = await fetch("/api/admin/engagement-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: tiktokConfig,
          presets: tiktokTierPresets,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update TikTok engagement configuration");
      }
      if (data.config) setTiktokConfig(data.config);
      if (data.presets) setTiktokTierPresets(data.presets);
      setActionMsg({ text: "TikTok Engagement presets and pricing configuration saved successfully.", type: "success" });
    } catch (err: any) {
      setActionMsg({ text: err.message || "Failed to save configuration", type: "error" });
    } finally {
      setSavingTiktokConfig(false);
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

  // If not authenticated as ADMIN, redirect away and render nothing (never show passkey input to users)
  if (!session?.authenticated || session.role !== "ADMIN") {
    return null;
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
    <div className="space-y-6 animate-fadeIn max-w-6xl mx-auto pb-16">
      {/* ── Minimalist Admin Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DEE0ED]">
        <div>
          <h1 className="text-xl font-bold text-[#252943] tracking-tight">
            Admin Console
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Announcement Quick Pill */}
          <button
            type="button"
            onClick={() => navigateTo("announcement")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 ${
              announcementActive
                ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-bold"
                : "bg-white border-[#DEE0ED] text-[#252943]/70 hover:text-[#252943]"
            }`}
            title="Configure Site Announcement Header Ticker"
          >
            <Megaphone className={`w-3.5 h-3.5 ${announcementActive ? "text-emerald-600" : "text-[#252943]/50"}`} />
            <span>Announcement: {announcementActive ? "LIVE" : "OFF"}</span>
          </button>

          {/* Under Update toggle button */}
          <button
            type="button"
            onClick={() => setShowMaintenanceModal(true)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              maintenance.enabled
                ? "bg-rose-50 border-rose-300 text-rose-700 font-bold"
                : "bg-white border-[#DEE0ED] text-[#252943]/70 hover:text-[#252943]"
            }`}
          >
            {maintenance.enabled ? "Update Mode: ON" : "Update Mode: OFF"}
          </button>

          {/* Refresh Data */}
          <button
            type="button"
            onClick={loadAllAdminData}
            disabled={loadingData}
            className="p-2 rounded-xl border border-[#DEE0ED] bg-white hover:bg-slate-50 text-[#252943]/70 hover:text-[#252943] transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#3A4EFB] ${loadingData ? "animate-spin" : ""}`} />
          </button>

          {/* Force Worker Tick */}
          <button
            type="button"
            onClick={handleTriggerWorkerTick}
            disabled={runningTick}
            className="px-3 py-1.5 rounded-xl border border-[#DEE0ED] bg-white hover:bg-slate-50 text-[#252943]/70 text-xs font-semibold transition-colors flex items-center gap-1.5"
            title="Execute Delivery Tick"
          >
            <Play className={`w-3 h-3 text-emerald-600 ${runningTick ? "animate-spin" : ""}`} />
            <span>Tick</span>
          </button>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-xl border border-[#DEE0ED] bg-white hover:bg-rose-50 text-rose-600 hover:border-rose-200 transition-colors"
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {actionMsg && (
        <div
          className={`p-3 rounded-xl flex items-center justify-between text-xs font-medium animate-fadeIn ${actionMsg.type === "success"
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

      {/* ── Quiet Banners (Only when active) ── */}
      {maintenance.enabled && (
        <div className="px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-fadeIn">
          <span>Website is in update mode. Regular users are shielded while background orders deliver.</span>
          <div className="flex items-center gap-3 shrink-0 text-xs">
            <Link
              href="/maintenance"
              target="_blank"
              className="font-bold underline hover:text-amber-950"
            >
              Preview User Window ↗
            </Link>
            <button
              type="button"
              onClick={() => handleToggleMaintenance(false)}
              disabled={togglingMaintenance}
              className="font-bold text-rose-700 hover:underline"
            >
              Turn Off
            </button>
          </div>
        </div>
      )}

      {alertsMetrics?.openAlertsCount > 0 && (
        <div className="px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center justify-between gap-3 animate-fadeIn">
          <span>Provider balance alert: {alertsMetrics.openAlertsCount} issue(s) need attention.</span>
          <button
            type="button"
            onClick={() => navigateTo("alerts")}
            className="font-bold text-rose-700 underline shrink-0"
          >
            Review Alerts
          </button>
        </div>
      )}

      {/* ── Minimalist Segmented Navigation ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DEE0ED] pb-3">
        {/* 4 Primary Categories */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#F4F5F9] border border-[#DEE0ED] w-fit overflow-x-auto">
          <button
            type="button"
            onClick={() => setCategory("customers")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              category === "customers"
                ? "bg-white text-[#252943] shadow-xs"
                : "text-[#252943]/60 hover:text-[#252943]"
            }`}
          >
            Customers
          </button>

          <button
            type="button"
            onClick={() => setCategory("financials")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              category === "financials"
                ? "bg-white text-[#252943] shadow-xs"
                : "text-[#252943]/60 hover:text-[#252943]"
            }`}
          >
            Finances
          </button>

          <button
            type="button"
            onClick={() => setCategory("operations")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              category === "operations"
                ? "bg-white text-[#252943] shadow-xs"
                : "text-[#252943]/60 hover:text-[#252943]"
            }`}
          >
            Orders
          </button>

          <button
            type="button"
            onClick={() => setCategory("settings")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              category === "settings"
                ? "bg-white text-[#252943] shadow-xs"
                : "text-[#252943]/60 hover:text-[#252943]"
            }`}
          >
            Settings
          </button>
        </div>

        {/* Sub-tabs for Current Category */}
        <div className="flex items-center gap-1 text-xs">
          {category === "customers" && (
            <>
              <button
                type="button"
                onClick={() => setCustomersSubTab("directory")}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                  customersSubTab === "directory"
                    ? "bg-[#252943] text-white"
                    : "text-[#252943]/70 hover:bg-gray-100"
                }`}
              >
                Directory
              </button>
              <button
                type="button"
                onClick={() => setCustomersSubTab("passkeys")}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                  customersSubTab === "passkeys"
                    ? "bg-[#252943] text-white"
                    : "text-[#252943]/70 hover:bg-gray-100"
                }`}
              >
                Passkeys ({passkeys.length})
              </button>
            </>
          )}

          {category === "financials" && (
            <>
              <button
                type="button"
                onClick={() => setFinancialsSubTab("revenue")}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                  financialsSubTab === "revenue"
                    ? "bg-[#252943] text-white"
                    : "text-[#252943]/70 hover:bg-gray-100"
                }`}
              >
                Revenue & Profit
              </button>
              <button
                type="button"
                onClick={() => setFinancialsSubTab("deposits")}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                  financialsSubTab === "deposits"
                    ? "bg-[#252943] text-white"
                    : "text-[#252943]/70 hover:bg-gray-100"
                }`}
              >
                Binance Deposits
              </button>
            </>
          )}

          {category === "operations" && (
            <>
              <button
                type="button"
                onClick={() => setOperationsSubTab("orders")}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                  operationsSubTab === "orders"
                    ? "bg-[#252943] text-white"
                    : "text-[#252943]/70 hover:bg-gray-100"
                }`}
              >
                Order Monitor
              </button>
              <button
                type="button"
                onClick={() => {
                  setOperationsSubTab("alerts");
                  loadAlerts();
                }}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
                  operationsSubTab === "alerts"
                    ? "bg-[#252943] text-white"
                    : "text-[#252943]/70 hover:bg-gray-100"
                }`}
              >
                <span>Alerts</span>
                {alertsMetrics?.openAlertsCount ? (
                  <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {alertsMetrics.openAlertsCount}
                  </span>
                ) : null}
              </button>
            </>
          )}

          {category === "settings" && (
            <>
              <button
                type="button"
                onClick={() => setSettingsSubTab("engagement")}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                  settingsSubTab === "engagement"
                    ? "bg-[#252943] text-white"
                    : "text-[#252943]/70 hover:bg-gray-100"
                }`}
              >
                TikTok Presets
              </button>
              <button
                type="button"
                onClick={() => setSettingsSubTab("provider")}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                  settingsSubTab === "provider"
                    ? "bg-[#252943] text-white"
                    : "text-[#252943]/70 hover:bg-gray-100"
                }`}
              >
                Provider API
              </button>
              <button
                type="button"
                onClick={() => setSettingsSubTab("announcement")}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
                  settingsSubTab === "announcement"
                    ? "bg-[#252943] text-white"
                    : "text-[#252943]/70 hover:bg-gray-100"
                }`}
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span>Site Announcement</span>
                {announcementActive && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* =====================================================================
          CATEGORY 1: CUSTOMERS & ACCESS
      ====================================================================== */}
      {category === "customers" && (
        <div className="space-y-6 animate-fadeIn">
          {customersSubTab === "directory" ? (
            <UsersLiveActivityTab />
          ) : (
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
                            className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wide ${pk.role === "ADMIN"
                              ? "bg-[#252943] text-[#E3FF3B]"
                              : "bg-[#3A4EFB]/10 text-[#3A4EFB]"
                              }`}
                          >
                            {pk.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isExp
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
        </div>
      )}

      {/* =====================================================================
          CATEGORY 2: FINANCES & CAPITAL
      ====================================================================== */}
      {category === "financials" && (
        <div className="space-y-6 animate-fadeIn">
          {financialsSubTab === "revenue" ? (
            <RevenueProfitTab />
          ) : (
            <BinanceDepositsTab />
          )}
        </div>
      )}

      {/* =====================================================================
          CATEGORY 3: ORDERS & OPERATIONS
      ====================================================================== */}
      {category === "operations" && (
        <div className="space-y-6 animate-fadeIn">
          {operationsSubTab === "orders" ? (
            <OrderMonitorTab />
          ) : (
            <AlertsHealthTab />
          )}
        </div>
      )}

      {/* =====================================================================
          CATEGORY 4: SERVICES & ENGINE
      ====================================================================== */}
      {category === "settings" && (
        <div className="space-y-6 animate-fadeIn">
          {settingsSubTab === "engagement" ? (
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
                {/* Master Switch & Preset Navigation Bar */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED]">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="font-bold text-[#252943] block text-sm">Engagement System Master Switch</span>
                        <span className="text-[11px] text-[#252943]/60">Allow users to place organic orders globally</span>
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

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#252943]/60">Live Status:</span>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                        tiktokConfig.enabled ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-rose-100 text-rose-800 border border-rose-300"
                      }`}>
                        {tiktokConfig.enabled ? "Active & Accepting Orders" : "Maintenance / Paused"}
                      </span>
                    </div>
                  </div>

                  {/* Dedicated Platform Ordering Access Switches (TikTok & Instagram) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* TikTok Switch */}
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-[#DEE0ED] shadow-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#252943] text-xs">TikTok Engagement Orders</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            (tiktokConfig.tiktokEnabled ?? tiktokConfig.enabled) ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                          }`}>
                            {(tiktokConfig.tiktokEnabled ?? tiktokConfig.enabled) ? "Enabled" : "Paused"}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#252943]/60 block">Allow users to order TikTok views, likes, saves & reposts</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={tiktokConfig.tiktokEnabled ?? tiktokConfig.enabled}
                          onChange={(e) => setTiktokConfig({ ...tiktokConfig, tiktokEnabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>

                    {/* Instagram Switch */}
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-[#DEE0ED] shadow-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#252943] text-xs">Instagram Engagement Orders</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            (tiktokConfig.instagramEnabled ?? true) ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                          }`}>
                            {(tiktokConfig.instagramEnabled ?? true) ? "Enabled" : "Paused"}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#252943]/60 block">Allow users to order Instagram reels & posts wave delivery</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={tiktokConfig.instagramEnabled ?? true}
                          onChange={(e) => setTiktokConfig({ ...tiktokConfig, instagramEnabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>
                  </div>
                </div>

                  {/* Platform Selector Tabs: TikTok vs Instagram */}
                  <div className="flex items-center gap-2 p-1.5 bg-white border border-[#DEE0ED] rounded-2xl w-fit shadow-xs">
                    <button
                      type="button"
                      onClick={() => setAdminPlatformTab("tiktok")}
                      className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                        adminPlatformTab === "tiktok"
                          ? "bg-[#111413] text-[#D4F04F] shadow-xs"
                          : "text-[#252943]/70 hover:text-[#252943]"
                      }`}
                    >
                      <Zap className="w-4 h-4" />
                      <span>TikTok Services & Margins</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminPlatformTab("instagram")}
                      className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                        adminPlatformTab === "instagram"
                          ? "bg-[#111413] text-[#D4F04F] shadow-xs"
                          : "text-[#252943]/70 hover:text-[#252943]"
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Instagram Services & Margins</span>
                    </button>
                  </div>

                  {adminPlatformTab === "tiktok" && (
                    <>
                      {/* Preset Selector Tabs */}
                      <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#3A4EFB]" />
                        <span className="font-bold text-xs text-[#252943]">Choose Preset to Configure</span>
                      </div>
                      <span className="text-[11px] text-[#252943]/50">Edit any preset's services, turn services On/Off, or adjust quantities</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      {[
                        { id: "tiktok_2k", defaultLabel: "2K Starter", defaultBadge: "6h", defaultDuration: "6.0 Hours" },
                        { id: "tiktok_5k", defaultLabel: "5K Velocity", defaultBadge: "24h", defaultDuration: "24.0 Hours (1 Day)" },
                        { id: "tiktok_10k", defaultLabel: "10K Breakthrough", defaultBadge: "48h", defaultDuration: "48.0 Hours (2 Days)" },
                        { id: "tiktok_15k", defaultLabel: "15K Acceleration", defaultBadge: "72h", defaultDuration: "72.0 Hours (3 Days)" },
                        { id: "tiktok_50k", defaultLabel: "50K Mega Viral", defaultBadge: "120h", defaultDuration: "120.0 Hours (5 Days)" },
                      ].map((tab) => {
                        const isTabActive = selectedAdminPresetKey === tab.id;
                        const presetData = tiktokTierPresets[tab.id];
                        const displayName = presetData?.name || tab.defaultLabel;
                        const badgeText = presetData?.badge || tab.defaultBadge;
                        const isPkgDisabled = presetData?.disabled === true || presetData?.enabled === false;

                        const viewsOn = presetData?.views ? presetData.views.enabled !== false : true;
                        const likesOn = presetData?.likes ? presetData.likes.enabled !== false : true;
                        const savesOn = presetData?.saves ? Boolean(presetData.saves.enabled) : tab.id !== "tiktok_2k";
                        const sharesOn = presetData?.shares ? Boolean(presetData.shares.enabled) : tab.id !== "tiktok_2k";
                        const activeCount = [viewsOn, likesOn, savesOn, sharesOn].filter(Boolean).length;

                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setSelectedAdminPresetKey(tab.id)}
                            className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                              isTabActive
                                ? "bg-[#3A4EFB] text-white border-[#3A4EFB] shadow-md shadow-[#3A4EFB]/20 ring-2 ring-[#3A4EFB]"
                                : isPkgDisabled
                                ? "bg-rose-50/50 border-rose-200 hover:bg-rose-50 text-[#252943]"
                                : "bg-white border-[#DEE0ED] hover:bg-[#F8F9FD] text-[#252943]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 w-full mb-1.5">
                              <span className="font-black text-xs truncate">{displayName}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                isPkgDisabled
                                  ? "bg-rose-500 text-white"
                                  : isTabActive ? "bg-white/20 text-white" : "bg-[#DEE0ED] text-[#252943]"
                              }`}>
                                {isPkgDisabled ? "Disabled" : badgeText}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] opacity-80 pt-1.5 border-t border-current/20">
                              <span className={isPkgDisabled ? "text-rose-600 font-bold" : ""}>
                                {isPkgDisabled ? "Hidden for Users" : `${activeCount} / 4 On`}
                              </span>
                              <span className="font-mono font-bold">{isTabActive ? "Editing" : "Select"}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                {/* Preset Editor Section */}
                {(() => {
                  const fallbackPreset = {
                    id: selectedAdminPresetKey,
                    name: selectedAdminPresetKey === "tiktok_2k" ? "2K Starter" : selectedAdminPresetKey === "tiktok_5k" ? "5K Velocity" : selectedAdminPresetKey === "tiktok_10k" ? "10K Breakthrough" : selectedAdminPresetKey === "tiktok_15k" ? "15K Acceleration" : "50K Mega Viral",
                    tagline: selectedAdminPresetKey === "tiktok_2k" ? "6-hour initial watch-time push & seed pool momentum" : selectedAdminPresetKey === "tiktok_5k" ? "24-hour natural FYP momentum with synchronized engagement waves" : selectedAdminPresetKey === "tiktok_10k" ? "2-day algorithmic breakout with circadian evening momentum" : selectedAdminPresetKey === "tiktok_15k" ? "3-day organic algorithm surge with gradual view-paced delivery" : "5-day full FYP virality curve with soft asymptotic tail",
                    badge: selectedAdminPresetKey === "tiktok_2k" ? "6h" : selectedAdminPresetKey === "tiktok_5k" ? "24h" : selectedAdminPresetKey === "tiktok_10k" ? "48h" : selectedAdminPresetKey === "tiktok_15k" ? "72h" : "120h",
                    durationLabel: selectedAdminPresetKey === "tiktok_2k" ? "6.0 Hours" : selectedAdminPresetKey === "tiktok_5k" ? "24.0 Hours (1 Day)" : selectedAdminPresetKey === "tiktok_10k" ? "48.0 Hours (2 Days)" : selectedAdminPresetKey === "tiktok_15k" ? "72.0 Hours (3 Days)" : "120.0 Hours (5 Days)",
                    durationHours: selectedAdminPresetKey === "tiktok_2k" ? 6.0 : selectedAdminPresetKey === "tiktok_5k" ? 24.0 : selectedAdminPresetKey === "tiktok_10k" ? 48.0 : selectedAdminPresetKey === "tiktok_15k" ? 72.0 : 120.0,
                    targetViews: selectedAdminPresetKey === "tiktok_2k" ? 2000 : selectedAdminPresetKey === "tiktok_5k" ? 5000 : selectedAdminPresetKey === "tiktok_10k" ? 10000 : selectedAdminPresetKey === "tiktok_15k" ? 15000 : 50000,
                    targetLikes: selectedAdminPresetKey === "tiktok_2k" ? 42 : selectedAdminPresetKey === "tiktok_5k" ? 180 : selectedAdminPresetKey === "tiktok_10k" ? 420 : selectedAdminPresetKey === "tiktok_15k" ? 650 : 2600,
                    enabled: true,
                    disabled: false,
                    views: {
                      enabled: true,
                      providerName: tiktokConfig?.views?.providerName || "Views Provider",
                      serviceId: tiktokConfig?.views?.serviceId || "10322",
                      minQuantity: selectedAdminPresetKey === "tiktok_2k" ? 150 : selectedAdminPresetKey === "tiktok_5k" ? 230 : selectedAdminPresetKey === "tiktok_10k" ? 380 : 1050,
                      maxQuantity: selectedAdminPresetKey === "tiktok_2k" ? 220 : selectedAdminPresetKey === "tiktok_5k" ? 280 : selectedAdminPresetKey === "tiktok_10k" ? 430 : 1250,
                      runsCount: selectedAdminPresetKey === "tiktok_2k" ? 16 : selectedAdminPresetKey === "tiktok_5k" ? 20 : selectedAdminPresetKey === "tiktok_10k" ? 26 : 44,
                      intervalMinutes: selectedAdminPresetKey === "tiktok_2k" ? 20 : selectedAdminPresetKey === "tiktok_5k" ? 45 : selectedAdminPresetKey === "tiktok_10k" ? 48 : 62,
                    },
                    likes: {
                      enabled: true,
                      providerName: tiktokConfig?.likes?.providerName || "Likes Provider",
                      serviceId: tiktokConfig?.likes?.serviceId || "1123",
                      minQuantity: selectedAdminPresetKey === "tiktok_2k" ? 12 : selectedAdminPresetKey === "tiktok_5k" ? 11 : selectedAdminPresetKey === "tiktok_10k" ? 14 : 45,
                      maxQuantity: selectedAdminPresetKey === "tiktok_2k" ? 16 : selectedAdminPresetKey === "tiktok_5k" ? 14 : selectedAdminPresetKey === "tiktok_10k" ? 18 : 55,
                      runsCount: selectedAdminPresetKey === "tiktok_2k" ? 3 : selectedAdminPresetKey === "tiktok_5k" ? 14 : selectedAdminPresetKey === "tiktok_10k" ? 24 : 40,
                      waveOffsets: [120, 200, 280],
                    },
                    saves: {
                      enabled: selectedAdminPresetKey !== "tiktok_2k",
                      providerName: tiktokConfig?.saves?.providerName || "Engagement Engine",
                      serviceId: tiktokConfig?.saves?.serviceId || "807",
                      minQuantity: 10,
                      maxQuantity: 12,
                      runsCount: selectedAdminPresetKey === "tiktok_50k" ? 30 : selectedAdminPresetKey === "tiktok_10k" ? 8 : 4,
                      waveOffsets: [240, 420, 600, 750],
                    },
                    shares: {
                      enabled: selectedAdminPresetKey !== "tiktok_2k",
                      providerName: tiktokConfig?.shares?.providerName || "Engagement Engine",
                      serviceId: tiktokConfig?.shares?.serviceId || "718",
                      minQuantity: 10,
                      maxQuantity: 12,
                      runsCount: selectedAdminPresetKey === "tiktok_50k" ? 15 : selectedAdminPresetKey === "tiktok_10k" ? 4 : 2,
                      waveOffsets: [360, 660],
                    },
                    syncThreshold: { minViews: 500, maxViews: 700 },
                  };

                  const activePreset = {
                    ...fallbackPreset,
                    ...(tiktokTierPresets[selectedAdminPresetKey] || {}),
                    views: { ...fallbackPreset.views, ...(tiktokTierPresets[selectedAdminPresetKey]?.views || {}) },
                    likes: { ...fallbackPreset.likes, ...(tiktokTierPresets[selectedAdminPresetKey]?.likes || {}) },
                    saves: { ...fallbackPreset.saves, ...(tiktokTierPresets[selectedAdminPresetKey]?.saves || {}) },
                    shares: { ...fallbackPreset.shares, ...(tiktokTierPresets[selectedAdminPresetKey]?.shares || {}) },
                    syncThreshold: { ...fallbackPreset.syncThreshold, ...(tiktokTierPresets[selectedAdminPresetKey]?.syncThreshold || {}) },
                  };

                  const updateActiveField = (field: string, val: any) => {
                    const updated = { ...activePreset, [field]: val };
                    setTiktokTierPresets((prev) => ({ ...prev, [selectedAdminPresetKey]: updated }));
                    if (selectedAdminPresetKey === "tiktok_2k" && field === "name") {
                      setTiktokConfig((prev: any) => ({ ...prev, presetName: val }));
                    }
                  };

                  const updateServiceField = (svc: "views" | "likes" | "saves" | "shares", field: string, val: any) => {
                    const currentSvc = activePreset[svc] || {};
                    const updatedSvc = { ...currentSvc, [field]: val };
                    const updated = { ...activePreset, [svc]: updatedSvc };
                    setTiktokTierPresets((prev) => ({ ...prev, [selectedAdminPresetKey]: updated }));
                    if (selectedAdminPresetKey === "tiktok_2k") {
                      setTiktokConfig((prev: any) => ({
                        ...prev,
                        [svc]: { ...(prev?.[svc] || {}), [field]: val },
                      }));
                    }
                  };

                  return (
                    <div className="space-y-6">
                      {/* Preset Metadata Card */}
                      <div className="p-5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]/80">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-[#3A4EFB] text-white text-xs font-black flex items-center justify-center">
                              P
                            </span>
                            <div>
                              <h3 className="font-black text-sm text-[#252943]">
                                Preset Details: {activePreset.name}
                              </h3>
                              <span className="text-[11px] text-[#252943]/60">
                                This preset's values and active services will be shown live to users on /engagement
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                            Key: {selectedAdminPresetKey}
                          </span>
                        </div>

                        {/* Package Enable / Disable Toggle Banner */}
                        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                          activePreset.disabled === true || activePreset.enabled === false
                            ? "bg-rose-50 border-rose-200"
                            : "bg-emerald-50 border-emerald-200"
                        }`}>
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              activePreset.disabled === true || activePreset.enabled === false
                                ? "bg-rose-100 text-rose-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}>
                              {activePreset.disabled === true || activePreset.enabled === false ? (
                                <XCircle className="w-4 h-4" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold ${
                                  activePreset.disabled === true || activePreset.enabled === false
                                    ? "text-rose-900"
                                    : "text-emerald-900"
                                }`}>
                                  Package Status: {activePreset.disabled === true || activePreset.enabled === false ? "Disabled (Hidden from Users)" : "Active & Live for Users"}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  activePreset.disabled === true || activePreset.enabled === false
                                    ? "bg-rose-200 text-rose-800"
                                    : "bg-emerald-200 text-emerald-800"
                                }`}>
                                  {activePreset.disabled === true || activePreset.enabled === false ? "Disabled" : "Active"}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#252943]/70 mt-0.5">
                                {activePreset.disabled === true || activePreset.enabled === false
                                  ? "Users CANNOT view, see, or order this package on /engagement. Orders for this package are blocked."
                                  : "Users can view, select, preview, and purchase this growth package normally."}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const isCurrentlyDisabled = activePreset.disabled === true || activePreset.enabled === false;
                              const newDisabled = !isCurrentlyDisabled;
                              updateActiveField("disabled", newDisabled);
                              updateActiveField("enabled", !newDisabled);
                            }}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all shadow-subtle shrink-0 flex items-center gap-1.5 cursor-pointer ${
                              activePreset.disabled === true || activePreset.enabled === false
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : "bg-rose-600 hover:bg-rose-700 text-white"
                            }`}
                          >
                            {activePreset.disabled === true || activePreset.enabled === false ? (
                              <>
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                <span>Enable Package For Users</span>
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Disable / Remove For Users</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block font-bold text-[#252943]/80 mb-1">Preset Display Name</label>
                            <input
                              type="text"
                              value={activePreset.name}
                              onChange={(e) => updateActiveField("name", e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-bold text-[#252943]"
                              required
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-[#252943]/80 mb-1">Badge Tag</label>
                            <input
                              type="text"
                              value={activePreset.badge}
                              onChange={(e) => updateActiveField("badge", e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-mono font-bold text-[#3A4EFB]"
                              required
                            />
                          </div>

                          <div>
                            <label className="block font-bold text-[#252943]/80 mb-1">Duration (Hours)</label>
                            <input
                              type="number"
                              step="0.5"
                              value={activePreset.durationHours}
                              onChange={(e) => {
                                const h = Number(e.target.value);
                                updateActiveField("durationHours", h);
                                updateActiveField("durationLabel", `${h.toFixed(1)} Hours`);
                              }}
                              className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-bold text-[#252943]"
                              min={0.5}
                              required
                            />
                          </div>

                          <div className="sm:col-span-4">
                            <label className="block font-bold text-[#252943]/80 mb-1">Tagline (Shown on User Card)</label>
                            <input
                              type="text"
                              value={activePreset.tagline}
                              onChange={(e) => updateActiveField("tagline", e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-medium text-[#252943]"
                              placeholder="e.g. 5-hour organic pacing for new posts"
                              required
                            />
                          </div>
                        </div>
                      </div>

                      {/* Four Service Cards with Individual ON / OFF TOGGLES */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 1. VIEWS SERVICE CARD */}
                        <div className={`p-5 rounded-2xl border transition-all ${
                          activePreset.views?.enabled !== false
                            ? "bg-[#F8F9FD]/60 border-[#DEE0ED]"
                            : "bg-slate-50 border-slate-300 opacity-75"
                        } space-y-4`}>
                          <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                                activePreset.views?.enabled !== false ? "bg-blue-100 text-[#3A4EFB]" : "bg-slate-200 text-slate-500"
                              }`}>
                                <Eye className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-[#252943]">TikTok Views Service</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    activePreset.views?.enabled !== false
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                      : "bg-rose-100 text-rose-800 border border-rose-300"
                                  }`}>
                                    {activePreset.views?.enabled !== false ? "✓ Included" : "✕ Turned Off"}
                                  </span>
                                </div>
                                <span className="text-[11px] text-[#252943]/60">
                                  {activePreset.views?.enabled !== false
                                    ? "Active in cards, batches & orders"
                                    : "Removed from user card, batches & orders"}
                                </span>
                              </div>
                            </div>

                            {/* Service On/Off Switch */}
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-[#252943]/70">
                                {activePreset.views?.enabled !== false ? "On" : "Off"}
                              </span>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={activePreset.views?.enabled !== false}
                                  onChange={(e) => updateServiceField("views", "enabled", e.target.checked)}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                              </label>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block font-bold text-[#252943]/70 mb-1">Provider Name</label>
                              <input
                                type="text"
                                value={activePreset.views?.providerName || "Views Provider"}
                                onChange={(e) => updateServiceField("views", "providerName", e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-medium"
                                required
                              />
                            </div>
                            <div>
                              <label className="block font-bold text-[#252943]/70 mb-1">Service ID</label>
                              <input
                                type="text"
                                value={activePreset.views?.serviceId || "10322"}
                                onChange={(e) => updateServiceField("views", "serviceId", e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-mono font-bold text-[#3A4EFB]"
                                required
                              />
                            </div>
                            <div className="col-span-2 p-3 rounded-xl bg-[#D4F04F]/20 border border-[#D4F04F]/60 text-[11px] text-[#111413] font-semibold flex items-start gap-2">
                              <span className="text-base leading-none mt-0.5">📋</span>
                              <span>Batch sizes, run count, and intervals are <strong>plan-driven</strong>. Every order uses the exact schedule generated by the deterministic plan engine — no manual min/max needed.</span>
                            </div>
                            <div className="col-span-2 pt-2 border-t border-[#DEE0ED]/60 flex items-center justify-between gap-3">
                              <div className="flex-1">
                                <label className="block font-bold text-[#252943]/80 mb-1">Target Total Views (Planned)</label>
                                <input
                                  type="number"
                                  value={activePreset.targetViews ?? 2960}
                                  onChange={(e) => updateActiveField("targetViews", Number(e.target.value))}
                                  className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-mono font-bold text-blue-700"
                                  min={100}
                                  required
                                />
                              </div>
                              <div className="text-[11px] text-[#252943]/60 self-end pb-2 font-mono">
                                plan-paced delivery
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 2. LIKES SERVICE CARD */}
                        <div className={`p-5 rounded-2xl border transition-all ${
                          activePreset.likes?.enabled !== false
                            ? "bg-[#F8F9FD]/60 border-[#DEE0ED]"
                            : "bg-slate-50 border-slate-300 opacity-75"
                        } space-y-4`}>
                          <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                                activePreset.likes?.enabled !== false ? "bg-rose-100 text-rose-600" : "bg-slate-200 text-slate-500"
                              }`}>
                                <Heart className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-[#252943]">TikTok Likes Service</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    activePreset.likes?.enabled !== false
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                      : "bg-rose-100 text-rose-800 border border-rose-300"
                                  }`}>
                                    {activePreset.likes?.enabled !== false ? "✓ Included" : "✕ Turned Off"}
                                  </span>
                                </div>
                                <span className="text-[11px] text-[#252943]/60">
                                  {activePreset.likes?.enabled !== false
                                    ? "Active in cards, batches & orders"
                                    : "Removed from user card, batches & orders"}
                                </span>
                              </div>
                            </div>

                            {/* Service On/Off Switch */}
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-[#252943]/70">
                                {activePreset.likes?.enabled !== false ? "On" : "Off"}
                              </span>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={activePreset.likes?.enabled !== false}
                                  onChange={(e) => updateServiceField("likes", "enabled", e.target.checked)}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                              </label>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block font-bold text-[#252943]/70 mb-1">Provider Name</label>
                              <input
                                type="text"
                                value={activePreset.likes?.providerName || "Likes Provider"}
                                onChange={(e) => updateServiceField("likes", "providerName", e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-medium"
                                required
                              />
                            </div>
                            <div>
                              <label className="block font-bold text-[#252943]/70 mb-1">Service ID</label>
                              <input
                                type="text"
                                value={activePreset.likes?.serviceId || "1123"}
                                onChange={(e) => updateServiceField("likes", "serviceId", e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-mono font-bold text-[#3A4EFB]"
                                required
                              />
                            </div>
                            <div className="col-span-2 p-3 rounded-xl bg-[#D4F04F]/20 border border-[#D4F04F]/60 text-[11px] text-[#111413] font-semibold flex items-start gap-2">
                              <span className="text-base leading-none mt-0.5">📋</span>
                              <span>Batch sizes, run count, and intervals are <strong>plan-driven</strong>. Every order uses the exact schedule generated by the deterministic plan engine — no manual min/max needed.</span>
                            </div>
                            <div className="col-span-2 pt-2 border-t border-[#DEE0ED]/60 flex items-center justify-between gap-3">
                              <div className="flex-1">
                                <label className="block font-bold text-[#252943]/80 mb-1">Target Total Likes (Planned)</label>
                                <input
                                  type="number"
                                  value={activePreset.targetLikes ?? 42}
                                  onChange={(e) => updateActiveField("targetLikes", Number(e.target.value))}
                                  className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-mono font-bold text-rose-600"
                                  min={1}
                                  required
                                />
                              </div>
                              <div className="text-[11px] text-[#252943]/60 self-end pb-2 font-mono">
                                plan-paced delivery
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 3. SAVES SERVICE CARD */}
                        <div className={`p-5 rounded-2xl border transition-all ${
                          Boolean(activePreset.saves?.enabled)
                            ? "bg-[#F8F9FD]/60 border-[#DEE0ED]"
                            : "bg-slate-50 border-slate-300 opacity-75"
                        } space-y-4`}>
                          <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                                Boolean(activePreset.saves?.enabled) ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-500"
                              }`}>
                                <Bookmark className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-[#252943]">TikTok Saves Service</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    Boolean(activePreset.saves?.enabled)
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                      : "bg-rose-100 text-rose-800 border border-rose-300"
                                  }`}>
                                    {Boolean(activePreset.saves?.enabled) ? "✓ Included" : "✕ Turned Off"}
                                  </span>
                                </div>
                                <span className="text-[11px] text-[#252943]/60">
                                  {Boolean(activePreset.saves?.enabled)
                                    ? "Active in cards, batches & orders"
                                    : "Removed from user card, batches & orders"}
                                </span>
                              </div>
                            </div>

                            {/* Service On/Off Switch */}
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-[#252943]/70">
                                {Boolean(activePreset.saves?.enabled) ? "On" : "Off"}
                              </span>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(activePreset.saves?.enabled)}
                                  onChange={(e) => updateServiceField("saves", "enabled", e.target.checked)}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                              </label>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block font-bold text-[#252943]/70 mb-1">Provider Name</label>
                              <input
                                type="text"
                                value={activePreset.saves?.providerName || "Engagement Engine"}
                                onChange={(e) => updateServiceField("saves", "providerName", e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-medium"
                                required
                              />
                            </div>
                            <div>
                              <label className="block font-bold text-[#252943]/70 mb-1">Service ID</label>
                              <input
                                type="text"
                                value={activePreset.saves?.serviceId || "807"}
                                onChange={(e) => updateServiceField("saves", "serviceId", e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-mono font-bold text-[#3A4EFB]"
                                required
                              />
                            </div>
                            <div className="col-span-2 p-3 rounded-xl bg-[#D4F04F]/20 border border-[#D4F04F]/60 text-[11px] text-[#111413] font-semibold flex items-start gap-2">
                              <span className="text-base leading-none mt-0.5">📋</span>
                              <span>Batch sizes, run count, and intervals are <strong>plan-driven</strong>. Every order uses the exact schedule generated by the deterministic plan engine — no manual min/max needed.</span>
                            </div>
                          </div>
                        </div>

                        {/* 4. SHARES / REPOSTS SERVICE CARD */}
                        <div className={`p-5 rounded-2xl border transition-all ${
                          Boolean(activePreset.shares?.enabled)
                            ? "bg-[#F8F9FD]/60 border-[#DEE0ED]"
                            : "bg-slate-50 border-slate-300 opacity-75"
                        } space-y-4`}>
                          <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                                Boolean(activePreset.shares?.enabled) ? "bg-purple-100 text-purple-700" : "bg-slate-200 text-slate-500"
                              }`}>
                                <Share2 className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-[#252943]">TikTok Reposts Service</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    Boolean(activePreset.shares?.enabled)
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                      : "bg-rose-100 text-rose-800 border border-rose-300"
                                  }`}>
                                    {Boolean(activePreset.shares?.enabled) ? "✓ Included" : "✕ Turned Off"}
                                  </span>
                                </div>
                                <span className="text-[11px] text-[#252943]/60">
                                  {Boolean(activePreset.shares?.enabled)
                                    ? "Active in cards, batches & orders"
                                    : "Removed from user card, batches & orders"}
                                </span>
                              </div>
                            </div>

                            {/* Service On/Off Switch */}
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-[#252943]/70">
                                {Boolean(activePreset.shares?.enabled) ? "On" : "Off"}
                              </span>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(activePreset.shares?.enabled)}
                                  onChange={(e) => updateServiceField("shares", "enabled", e.target.checked)}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                              </label>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block font-bold text-[#252943]/70 mb-1">Provider Name</label>
                              <input
                                type="text"
                                value={activePreset.shares?.providerName || "Engagement Engine"}
                                onChange={(e) => updateServiceField("shares", "providerName", e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-medium"
                                required
                              />
                            </div>
                            <div>
                              <label className="block font-bold text-[#252943]/70 mb-1">Service ID</label>
                              <input
                                type="text"
                                value={activePreset.shares?.serviceId || "718"}
                                onChange={(e) => updateServiceField("shares", "serviceId", e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] bg-white text-xs font-mono font-bold text-[#3A4EFB]"
                                required
                              />
                            </div>
                            <div className="col-span-2 p-3 rounded-xl bg-[#D4F04F]/20 border border-[#D4F04F]/60 text-[11px] text-[#111413] font-semibold flex items-start gap-2">
                              <span className="text-base leading-none mt-0.5">📋</span>
                              <span>Batch sizes, run count, and intervals are <strong>plan-driven</strong>. Every order uses the exact schedule generated by the deterministic plan engine — no manual min/max needed.</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Section 4: Engagement Retail Pricing & Profit Margin Manager */}
                <div className="p-6 rounded-3xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50/40 via-white to-emerald-50/20 space-y-6 shadow-subtle">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-emerald-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-subtle shrink-0">
                        <Coins className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-[#252943]">
                            Engagement Retail Pricing & Profit Margin Manager
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider border border-emerald-300">
                            Profit & Margins
                          </span>
                        </div>
                        <p className="text-xs text-[#252943]/70">
                          Set the exact retail rate charged to users per 1,000 for Views, Likes, Comments, Saves, and Reposts. Pick your profit range and control your margins.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveTiktokConfig()}
                      disabled={savingTiktokConfig}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-subtle flex items-center gap-1.5 self-start sm:self-center shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {savingTiktokConfig ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>Save Pricing & Profit Margins</span>
                    </button>
                  </div>

                  {/* Tier Selector & VIP Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white/80 rounded-2xl border border-emerald-200">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTiktokPricingTab("standard")}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          tiktokPricingTab === "standard"
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-[#F8F9FD] text-[#252943]/70 hover:bg-slate-200"
                        }`}
                      >
                        Standard Rates (Regular Signups)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTiktokPricingTab("vip")}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          tiktokPricingTab === "vip"
                            ? "bg-amber-500 text-white shadow-sm"
                            : "bg-[#F8F9FD] text-[#252943]/70 hover:bg-slate-200"
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>VIP Passkey Rates</span>
                      </button>
                    </div>

                    {tiktokPricingTab === "vip" && (
                      <label className="flex items-center gap-2 cursor-pointer bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-300">
                        <input
                          type="checkbox"
                          checked={Boolean(tiktokConfig.tiktokZeroProfitVip ?? true)}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              tiktokZeroProfitVip: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                        />
                        <span className="text-xs font-bold text-amber-900">
                          0% Admin Profit (Direct Wholesale Provider Rates)
                        </span>
                      </label>
                    )}
                  </div>

                  {/* 5-Metric Pricing Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(
                      [
                        { key: "views", label: "TikTok Views", icon: Eye, color: "text-[#3A4EFB]", bg: "bg-blue-50 text-blue-800 border-blue-200", orig: originalRates?.views ?? 2.23, multipliers: [25, 50, 100, 150, 200] },
                        { key: "likes", label: "TikTok Likes", icon: Heart, color: "text-rose-600", bg: "bg-rose-50 text-rose-800 border-rose-200", orig: originalRates?.likes ?? 0.88, multipliers: [25, 50, 100, 150, 200] },
                        { key: "saves", label: "TikTok Saves", icon: Bookmark, color: "text-amber-600", bg: "bg-amber-50 text-amber-800 border-amber-200", orig: originalRates?.saves ?? 0.22, multipliers: [50, 100, 200, 300, 400] },
                        { key: "shares", label: "TikTok Reposts / Shares", icon: Share2, color: "text-indigo-600", bg: "bg-indigo-50 text-indigo-800 border-indigo-200", orig: originalRates?.shares ?? 0.22, multipliers: [50, 100, 200, 300, 400] },
                        { key: "comments", label: "TikTok Comments", icon: MessageSquare, color: "text-cyan-600", bg: "bg-cyan-50 text-cyan-800 border-cyan-200", orig: originalRates?.comments ?? 5.00, multipliers: [50, 100, 150, 200, 300] },
                      ] as const
                    ).map((m) => {
                      const isVip = tiktokPricingTab === "vip";
                      const effective = getEffectiveRate(m.key, "tiktok", isVip);
                      const origCost = m.orig;
                      const userRate = effective.rate;
                      const profit = effective.profit;
                      const marginPct = effective.margin;
                      const isZeroVip = isVip && Boolean(tiktokConfig.tiktokZeroProfitVip ?? true);

                      return (
                        <div key={m.key} className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-[#DEE0ED]/60">
                            <div className="flex items-center gap-2">
                              <m.icon className={`w-4 h-4 ${m.color}`} />
                              <span className="font-bold text-xs text-[#252943]">{m.label}</span>
                            </div>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${m.bg}`}>
                              Wholesale: ₹{origCost.toFixed(2)}/1k
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[11px] font-bold text-[#252943]/80">
                                {isVip ? "VIP Selling Rate (₹ / 1,000)" : "User Selling Rate (₹ / 1,000)"}
                              </label>
                              {isZeroVip && (
                                <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  0% Profit Wholesale
                                </span>
                              )}
                            </div>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#252943]/50">₹</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0.1"
                                disabled={isZeroVip}
                                value={userRate}
                                onChange={(e) => updateEffectiveRate(m.key, "tiktok", isVip, Number(e.target.value))}
                                className={`w-full pl-7 pr-3 py-2 rounded-xl border-2 text-xs font-black font-mono outline-none ${
                                  isZeroVip
                                    ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                                    : "border-[#DEE0ED] focus:border-emerald-500 bg-white text-[#252943]"
                                }`}
                                required
                              />
                            </div>
                          </div>

                          {/* Quick Margin Multipliers */}
                          {!isZeroVip ? (
                            <div className="space-y-1">
                              <span className="text-[10px] text-[#252943]/60 font-semibold block">Quick Profit Range:</span>
                              <div className="flex items-center flex-wrap gap-1">
                                {m.multipliers.map((pct) => (
                                  <button
                                    key={pct}
                                    type="button"
                                    onClick={() =>
                                      updateEffectiveRate(
                                        m.key,
                                        "tiktok",
                                        isVip,
                                        Number((origCost * (1 + pct / 100)).toFixed(2))
                                      )
                                    }
                                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#F8F9FD] hover:bg-emerald-100 hover:text-emerald-900 text-[#252943]/70 border border-[#DEE0ED] transition-colors cursor-pointer"
                                  >
                                    +{pct}%
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-900 font-medium">
                              Activated passkey users pay exact wholesale cost ₹{origCost.toFixed(2)}/1k with zero markup.
                            </div>
                          )}

                          {/* Profit feedback */}
                          <div
                            className={`p-2 rounded-xl text-[11px] flex items-center justify-between font-bold ${
                              isZeroVip
                                ? "bg-amber-50 text-amber-900 border border-amber-200"
                                : profit >= 0
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-rose-50 text-rose-800 border border-rose-200"
                            }`}
                          >
                            <span>
                              Profit: {isZeroVip ? "₹0.00 (Wholesale)" : profit >= 0 ? `+₹${profit.toFixed(2)}` : `-₹${Math.abs(profit).toFixed(2)}`}/1k
                            </span>
                            <span>{isZeroVip ? "VIP Wholesale" : profit >= 0 ? `+${marginPct}% Margin` : "Loss"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Profit Projection Simulator for Standard Campaigns */}
                  {(() => {
                    const vOrig = originalRates?.views ?? 2.23;
                    const lOrig = originalRates?.likes ?? 0.88;

                    // 2K Starter — use the admin-set price_inr as "Customer Pays"
                    const preset2k = tiktokTierPresets?.tiktok_2k;
                    const cost2kUser = typeof preset2k?.price_inr === "number" && preset2k.price_inr > 0
                      ? preset2k.price_inr
                      : Number(((2960 / 1000) * Number(tiktokConfig.pricing?.viewsUserRate ?? 4.50) + (42 / 1000) * Number(tiktokConfig.pricing?.likesUserRate ?? 2.00)).toFixed(2));
                    const cost2kWholesale = Number(((2960 / 1000) * vOrig + (42 / 1000) * lOrig).toFixed(2));
                    const profit2k = Number((cost2kUser - cost2kWholesale).toFixed(2));
                    const margin2k = cost2kWholesale > 0 ? Math.round((profit2k / cost2kWholesale) * 100) : 0;

                    return (
                      <div className="p-4 rounded-2xl bg-white border border-emerald-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#252943] flex items-center gap-1.5">
                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                            <span>Live Profit Simulator: Standard 2K Campaign (~2,960 Views + 42 Likes)</span>
                          </span>
                          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            +{margin2k}% Overall Return
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="p-3 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]">
                            <span className="text-[10px] text-[#252943]/60 font-semibold block">Customer Pays</span>
                            <span className="text-base font-black text-[#3A4EFB] font-mono">₹{cost2kUser.toFixed(2)}</span>
                          </div>
                          <div className="p-3 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED]">
                            <span className="text-[10px] text-[#252943]/60 font-semibold block">Wholesale API Cost</span>
                            <span className="text-base font-black text-[#252943]/80 font-mono">₹{cost2kWholesale.toFixed(2)}</span>
                          </div>
                          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                            <span className="text-[10px] text-emerald-900 font-semibold block">Your Net Profit</span>
                            <span className="text-base font-black text-emerald-700 font-mono">+₹{profit2k.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Section 4 Save Actions Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-emerald-200">
                    <span className="text-[11px] text-emerald-950/70 font-medium">
                      Rates and margins are persisted directly to the database and will charge users accurately on every new campaign order.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSaveTiktokConfig()}
                      disabled={savingTiktokConfig}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-subtle flex items-center gap-2 self-start sm:self-center shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {savingTiktokConfig ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>Save Pricing & Margins</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {adminPlatformTab === "instagram" && (
              <div className="space-y-6 animate-fadeIn">
                {/* Section 1: Instagram Upstream Services Mapping & Configuration */}
                <div className="p-6 rounded-3xl border border-[#DEE0ED] bg-[#F8F9FD]/60 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DEE0ED]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm text-[#252943]">
                          Instagram Upstream Provider Services
                        </h3>
                        <p className="text-[11px] text-[#252943]/60">
                          Set the upstream provider service IDs dispatched for Instagram views, likes, saves, shares, and comments.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveTiktokConfig()}
                      disabled={savingTiktokConfig}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-subtle flex items-center gap-1.5 self-start sm:self-center shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {savingTiktokConfig ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>Save Instagram Services</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {/* 1. Instagram Views Service */}
                    <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-purple-600" />
                          <span className="font-bold text-xs text-[#252943]">Reel Views Service</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          Min: 100
                        </span>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#252943]/70 mb-1">
                          Provider Service ID
                        </label>
                        <input
                          type="text"
                          placeholder="101"
                          value={tiktokConfig.instagramViews?.serviceId ?? "101"}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              instagramViews: {
                                ...(tiktokConfig.instagramViews || { enabled: true, minQuantity: 100, maxQuantity: 10000000 }),
                                serviceId: e.target.value,
                              },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] focus:border-purple-500 font-mono text-xs font-bold text-[#252943] bg-white outline-none"
                        />
                      </div>
                      <span className="text-[10px] text-[#252943]/50 block">High retention reel & video views</span>
                    </div>

                    {/* 2. Instagram Likes Service */}
                    <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Heart className="w-4 h-4 text-rose-500" />
                          <span className="font-bold text-xs text-[#252943]">Likes Service</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Min: 10
                        </span>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#252943]/70 mb-1">
                          Provider Service ID
                        </label>
                        <input
                          type="text"
                          placeholder="102"
                          value={tiktokConfig.instagramLikes?.serviceId ?? "102"}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              instagramLikes: {
                                ...(tiktokConfig.instagramLikes || { enabled: true, minQuantity: 10, maxQuantity: 500000 }),
                                serviceId: e.target.value,
                              },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] focus:border-rose-500 font-mono text-xs font-bold text-[#252943] bg-white outline-none"
                        />
                      </div>
                      <span className="text-[10px] text-[#252943]/50 block">Natural wave-paced post/reel likes</span>
                    </div>

                    {/* 3. Instagram Saves Service */}
                    <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bookmark className="w-4 h-4 text-amber-500" />
                          <span className="font-bold text-xs text-[#252943]">Saves & Bookmarks Service</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Min: 1
                        </span>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#252943]/70 mb-1">
                          Provider Service ID
                        </label>
                        <input
                          type="text"
                          placeholder="103"
                          value={tiktokConfig.instagramSaves?.serviceId ?? "103"}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              instagramSaves: {
                                ...(tiktokConfig.instagramSaves || { enabled: true, minQuantity: 1, maxQuantity: 200000 }),
                                serviceId: e.target.value,
                              },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] focus:border-amber-500 font-mono text-xs font-bold text-[#252943] bg-white outline-none"
                        />
                      </div>
                      <span className="text-[10px] text-[#252943]/50 block">High algorithmic weight post saves</span>
                    </div>

                    {/* 4. Instagram Shares Service */}
                    <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Share2 className="w-4 h-4 text-blue-500" />
                          <span className="font-bold text-xs text-[#252943]">Shares Service</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Min: 10
                        </span>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#252943]/70 mb-1">
                          Provider Service ID
                        </label>
                        <input
                          type="text"
                          placeholder="104"
                          value={tiktokConfig.instagramShares?.serviceId ?? "104"}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              instagramShares: {
                                ...(tiktokConfig.instagramShares || { enabled: true, minQuantity: 10, maxQuantity: 100000 }),
                                serviceId: e.target.value,
                              },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] focus:border-blue-500 font-mono text-xs font-bold text-[#252943] bg-white outline-none"
                        />
                      </div>
                      <span className="text-[10px] text-[#252943]/50 block">Post & reel shares distribution</span>
                    </div>

                    {/* 5. Instagram Comments Service */}
                    <div className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="w-4 h-4 text-emerald-600" />
                          <span className="font-bold text-xs text-[#252943]">Custom Comments Service</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Min: 1
                        </span>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#252943]/70 mb-1">
                          Provider Service ID
                        </label>
                        <input
                          type="text"
                          placeholder="950"
                          value={tiktokConfig.instagramComments?.serviceId ?? "950"}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              instagramComments: {
                                ...(tiktokConfig.instagramComments || { enabled: true, minQuantity: 1, maxQuantity: 10000 }),
                                serviceId: e.target.value,
                              },
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-[#DEE0ED] focus:border-emerald-500 font-mono text-xs font-bold text-[#252943] bg-white outline-none"
                        />
                      </div>
                      <span className="text-[10px] text-[#252943]/50 block">Verified English organic comments</span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Instagram Retail Pricing & Profit Margin Manager */}
                <div className="p-6 rounded-3xl border-2 border-purple-300 bg-gradient-to-br from-purple-50/40 via-white to-purple-50/20 space-y-6 shadow-subtle">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-purple-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black shadow-subtle shrink-0">
                        <Coins className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-[#252943]">
                            Instagram Retail Pricing & Profit Margin Manager
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-black uppercase tracking-wider border border-purple-300">
                            Instagram Margins
                          </span>
                        </div>
                        <p className="text-xs text-[#252943]/70">
                          Set the exact retail rate charged to users per 1,000 for Instagram Views, Likes, Saves, Shares, and Comments. Control your profits.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveTiktokConfig()}
                      disabled={savingTiktokConfig}
                      className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-subtle flex items-center gap-1.5 self-start sm:self-center shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {savingTiktokConfig ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>Save Instagram Pricing</span>
                    </button>
                  </div>

                  {/* Tier Selector & VIP Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white/80 rounded-2xl border border-purple-200">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInstagramPricingTab("standard")}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          instagramPricingTab === "standard"
                            ? "bg-purple-600 text-white shadow-sm"
                            : "bg-[#F8F9FD] text-[#252943]/70 hover:bg-slate-200"
                        }`}
                      >
                        Standard Rates (Regular Signups)
                      </button>
                      <button
                        type="button"
                        onClick={() => setInstagramPricingTab("vip")}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          instagramPricingTab === "vip"
                            ? "bg-amber-500 text-white shadow-sm"
                            : "bg-[#F8F9FD] text-[#252943]/70 hover:bg-slate-200"
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>VIP Passkey Rates</span>
                      </button>
                    </div>

                    {instagramPricingTab === "vip" && (
                      <label className="flex items-center gap-2 cursor-pointer bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-300">
                        <input
                          type="checkbox"
                          checked={Boolean(tiktokConfig.instagramZeroProfitVip ?? true)}
                          onChange={(e) =>
                            setTiktokConfig({
                              ...tiktokConfig,
                              instagramZeroProfitVip: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                        />
                        <span className="text-xs font-bold text-amber-900">
                          0% Admin Profit (Direct Wholesale Provider Rates)
                        </span>
                      </label>
                    )}
                  </div>

                  {/* 5-Metric Instagram Pricing Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(
                      [
                        { key: "views", label: "Instagram Views", icon: Eye, color: "text-purple-600", bg: "bg-purple-50 text-purple-800 border-purple-200", orig: instagramOriginalRates?.views ?? 0.84, multipliers: [50, 100, 150, 200, 300] },
                        { key: "likes", label: "Instagram Likes", icon: Heart, color: "text-rose-500", bg: "bg-rose-50 text-rose-800 border-rose-200", orig: instagramOriginalRates?.likes ?? 1.10, multipliers: [25, 50, 100, 150, 200] },
                        { key: "saves", label: "Instagram Saves", icon: Bookmark, color: "text-amber-500", bg: "bg-amber-50 text-amber-800 border-amber-200", orig: instagramOriginalRates?.saves ?? 1.45, multipliers: [25, 50, 100, 150, 200] },
                        { key: "shares", label: "Instagram Shares", icon: Share2, color: "text-blue-500", bg: "bg-blue-50 text-blue-800 border-blue-200", orig: instagramOriginalRates?.shares ?? 1.50, multipliers: [25, 50, 100, 150, 200] },
                        { key: "comments", label: "Instagram Comments", icon: MessageCircle, color: "text-emerald-600", bg: "bg-emerald-50 text-emerald-800 border-emerald-200", orig: instagramOriginalRates?.comments ?? 5.00, multipliers: [50, 100, 150, 200, 300] },
                      ] as const
                    ).map((m) => {
                      const isVip = instagramPricingTab === "vip";
                      const effective = getEffectiveRate(m.key, "instagram", isVip);
                      const origCost = m.orig;
                      const userRate = effective.rate;
                      const profit = effective.profit;
                      const marginPct = effective.margin;
                      const isZeroVip = isVip && Boolean(tiktokConfig.instagramZeroProfitVip ?? true);

                      return (
                        <div key={m.key} className="p-4 rounded-2xl bg-white border border-[#DEE0ED] shadow-subtle space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-[#DEE0ED]/60">
                            <div className="flex items-center gap-2">
                              <m.icon className={`w-4 h-4 ${m.color}`} />
                              <span className="font-bold text-xs text-[#252943]">{m.label}</span>
                            </div>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${m.bg}`}>
                              Wholesale: ₹{origCost.toFixed(2)}/1k
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[11px] font-bold text-[#252943]/80">
                                {isVip ? "VIP Selling Rate (₹ / 1,000)" : "User Selling Rate (₹ / 1,000)"}
                              </label>
                              {isZeroVip && (
                                <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  0% Profit Wholesale
                                </span>
                              )}
                            </div>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#252943]/50">₹</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0.1"
                                disabled={isZeroVip}
                                value={userRate}
                                onChange={(e) => updateEffectiveRate(m.key, "instagram", isVip, Number(e.target.value))}
                                className={`w-full pl-7 pr-3 py-2 rounded-xl border-2 text-xs font-black font-mono outline-none ${
                                  isZeroVip
                                    ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                                    : "border-[#DEE0ED] focus:border-purple-500 bg-white text-[#252943]"
                                }`}
                                required
                              />
                            </div>
                          </div>

                          {/* Quick Margin Multipliers */}
                          {!isZeroVip ? (
                            <div className="space-y-1">
                              <span className="text-[10px] text-[#252943]/60 font-semibold block">Quick Profit Range:</span>
                              <div className="flex items-center flex-wrap gap-1">
                                {m.multipliers.map((pct) => (
                                  <button
                                    key={pct}
                                    type="button"
                                    onClick={() =>
                                      updateEffectiveRate(
                                        m.key,
                                        "instagram",
                                        isVip,
                                        Number((origCost * (1 + pct / 100)).toFixed(2))
                                      )
                                    }
                                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#F8F9FD] hover:bg-purple-100 hover:text-purple-900 text-[#252943]/70 border border-[#DEE0ED] transition-colors cursor-pointer"
                                  >
                                    +{pct}%
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-900 font-medium">
                              Activated passkey users pay exact wholesale cost ₹{origCost.toFixed(2)}/1k with zero markup.
                            </div>
                          )}

                          {/* Profit feedback */}
                          <div
                            className={`p-2 rounded-xl text-[11px] flex items-center justify-between font-bold ${
                              isZeroVip
                                ? "bg-amber-50 text-amber-900 border border-amber-200"
                                : profit >= 0
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-rose-50 text-rose-800 border border-rose-200"
                            }`}
                          >
                            <span>
                              Profit: {isZeroVip ? "₹0.00 (Wholesale)" : profit >= 0 ? `+₹${profit.toFixed(2)}` : `-₹${Math.abs(profit).toFixed(2)}`}/1k
                            </span>
                            <span>{isZeroVip ? "VIP Wholesale" : profit >= 0 ? `+${marginPct}% Margin` : "Loss"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-purple-200">
                    <span className="text-[11px] text-purple-950/70 font-medium">
                      Instagram retail pricing and provider service IDs are persisted directly to the system config and charge users on every Instagram campaign order.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSaveTiktokConfig()}
                      disabled={savingTiktokConfig}
                      className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-subtle flex items-center gap-2 self-start sm:self-center shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {savingTiktokConfig ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>Save Instagram Pricing & Services</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

                {/* Section 4b: Universal Engagement Services & API Catalog Manager */}
                <EngagementServicesManager />

                {/* Section 5: Delayed Likes Protection Synchronization Threshold */}
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

          {/* Active Campaigns Breakdown */}
          <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 sm:p-8 shadow-subtle space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DEE0ED]">
              <div>
                <h2 className="text-base font-bold text-[#252943]">
                  Active Natural-Looking Delivery Campaigns
                </h2>
                <p className="text-xs text-[#252943]/60">
                  Live client orders showing breakdown quantities and user customization (Suggested vs Custom).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadAllAdminData}
                  disabled={loadingData}
                  className="px-3.5 py-2 rounded-xl bg-[#F8F9FD] border border-[#DEE0ED] text-xs font-bold text-[#252943] hover:bg-[#DEE0ED]/50 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? "animate-spin text-[#3A4EFB]" : ""}`} />
                  <span>Refresh</span>
                </button>
                <a
                  href="/engagement/orders"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl border border-[#DEE0ED] text-xs font-bold text-[#3A4EFB] hover:bg-[#F8F9FD]"
                >
                  View All Orders
                </a>
              </div>
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
      ) : settingsSubTab === "provider" ? (
            <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 sm:p-8 shadow-subtle space-y-6 animate-fadeIn">
              <div className="pb-4 border-b border-[#DEE0ED]">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-xl bg-[#252943] text-white flex items-center justify-center font-bold">
                    <Server className="w-4 h-4" />
                  </div>
                  <h2 className="text-base font-black text-[#252943]">
                    Fallback System Provider Configuration
                  </h2>
                </div>
                <p className="text-xs text-[#252943]/60 max-w-2xl">
                  Used as the primary upstream connection for background tasks and automated orders.
                </p>
              </div>

              <form onSubmit={handleSaveSystemProvider} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-bold text-[#252943] mb-1">Provider Label</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#252943] outline-none focus:border-[#3A4EFB]"
                    placeholder="e.g. Standard SMM Provider"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#252943] mb-1">API Endpoint URL</label>
                  <input
                    type="url"
                    value={editApiUrl}
                    onChange={(e) => setEditApiUrl(e.target.value)}
                    className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2.5 text-xs font-mono font-semibold text-[#252943] outline-none focus:border-[#3A4EFB]"
                    placeholder="https://provider-api.com/api/v2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#252943] mb-1">API Key</label>
                  <input
                    type="password"
                    value={editApiKey}
                    onChange={(e) => setEditApiKey(e.target.value)}
                    placeholder="Enter new key to replace existing secret"
                    className="w-full bg-[#F8F9FD] border border-[#DEE0ED] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#252943] outline-none focus:border-[#3A4EFB]"
                  />
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#252943] block">System Mock Mode</span>
                    <span className="text-[11px] text-[#252943]/60">Deliver simulated orders in staging/development</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editIsMock}
                    onChange={(e) => setEditIsMock(e.target.checked)}
                    className="rounded text-[#3A4EFB] w-4 h-4 cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingProvider}
                  className="px-6 py-2.5 rounded-xl bg-[#252943] text-white text-xs font-bold shadow-subtle hover:bg-[#1A1D31] transition-all press-scale disabled:opacity-50"
                >
                  {savingProvider ? "Saving..." : "Save System Config"}
                </button>
              </form>
            </div>
          ) : (
            <SiteAnnouncementTab />
          )}
        </div>
      )}

      {/* =====================================================================
          CREATE PASSKEY MODAL
      ====================================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-[#252943]/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-[#DEE0ED] max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 my-auto max-h-[calc(100vh-2rem)] overflow-y-auto animate-scaleUp">
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
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${newKeyRole === "USER"
                          ? "bg-[#3A4EFB] text-white border-[#3A4EFB]"
                          : "bg-[#F8F9FD] text-[#252943]/70 border-[#DEE0ED]"
                          }`}
                      >
                        USER (Standard Panel)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewKeyRole("ADMIN")}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${newKeyRole === "ADMIN"
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
                          className={`py-1.5 rounded-xl text-[11px] font-bold border transition-all ${newKeyDuration === item.val
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
                        className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all ${newKeyDuration === "permanent"
                          ? "bg-[#252943] text-[#E3FF3B] border-[#252943] shadow-sm"
                          : "bg-[#F8F9FD] text-[#252943]/70 border-[#DEE0ED] hover:bg-white"
                          }`}
                      >
                        Permanent / Unlimited
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewKeyDuration("custom")}
                        className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all ${newKeyDuration === "custom"
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
        <div className="fixed inset-0 z-50 bg-[#252943]/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-[#DEE0ED] max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 my-auto max-h-[calc(100vh-2rem)] overflow-y-auto animate-scaleUp">
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
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${editRole === "USER"
                          ? "bg-[#3A4EFB] text-white border-[#3A4EFB]"
                          : "bg-[#F8F9FD] text-[#252943]/70 border-[#DEE0ED]"
                          }`}
                      >
                        USER (Standard Panel)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditRole("ADMIN")}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${editRole === "ADMIN"
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
                          className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${editStatus === st
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
                        className={`py-1.5 rounded-xl text-[11px] font-bold border transition-all ${editDurationType === "keep"
                          ? "bg-[#3A4EFB] text-white border-[#3A4EFB]"
                          : "bg-[#F8F9FD] text-[#252943]/70 border-[#DEE0ED]"
                          }`}
                      >
                        Keep Current
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditDurationType("permanent")}
                        className={`py-1.5 rounded-xl text-[11px] font-bold border transition-all ${editDurationType === "permanent"
                          ? "bg-[#252943] text-[#E3FF3B] border-[#252943]"
                          : "bg-[#F8F9FD] text-[#252943]/70 border-[#DEE0ED]"
                          }`}
                      >
                        Permanent
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditDurationType("preset")}
                        className={`py-1.5 rounded-xl text-[11px] font-bold border transition-all ${editDurationType === "preset"
                          ? "bg-[#3A4EFB] text-white border-[#3A4EFB]"
                          : "bg-[#F8F9FD] text-[#252943]/70 border-[#DEE0ED]"
                          }`}
                      >
                        Preset Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditDurationType("customDate")}
                        className={`py-1.5 rounded-xl text-[11px] font-bold border transition-all ${editDurationType === "customDate"
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
                            className={`py-1.5 rounded-xl text-[11px] font-bold border transition-all ${editPresetDays === item.val
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

      {/* Maintenance Mode Configuration Modal */}
      {showMaintenanceModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowMaintenanceModal(false)}
          className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl border border-[#DEE0ED] max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scaleUp"
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    maintenance.enabled ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
                  }`}
                >
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#252943]">
                    Under Update / Maintenance Control
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Control public site access while keeping backend order delivery active
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMaintenanceModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Current Status Badge */}
            <div
              className={`p-4 rounded-2xl border flex items-center justify-between ${
                maintenance.enabled
                  ? "bg-rose-50 border-rose-200 text-rose-900"
                  : "bg-emerald-50 border-emerald-200 text-emerald-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-3 h-3 rounded-full ${
                    maintenance.enabled ? "bg-rose-600 animate-ping" : "bg-emerald-500"
                  }`}
                />
                <div>
                  <span className="text-xs font-black uppercase tracking-wider block">
                    Current Mode: {maintenance.enabled ? "UNDER UPDATE (ACTIVE)" : "NORMAL SITE LIVE"}
                  </span>
                  <span className="text-[11px] opacity-80">
                    {maintenance.enabled
                      ? "Standard users are locked out and see the update window. As administrator, you have full access to the admin panel and every other panel (Engagement, Orders, Wallet, Services, etc.)."
                      : "All users can login and access the panel normally."}
                  </span>
                </div>
              </div>
            </div>

            {/* Guarantees Callout */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-[#F8F9FD] border border-gray-100 text-xs text-gray-700">
              <div className="flex items-center gap-1.5 font-bold text-gray-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Backend Delivery Protection</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                When enabled, cron workers (`/api/scheduler/tick`), TikTok S-Curve delivery runs, and upstream provider dispatches continue to process in the background. Only front-end user access is shielded.
              </p>
            </div>

            {/* Custom Message Inputs */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Window Headline
                </label>
                <input
                  type="text"
                  value={maintTitleInput}
                  onChange={(e) => setMaintTitleInput(e.target.value)}
                  placeholder="Currently we're updating the website"
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] focus:border-[#3A4EFB] rounded-xl px-3.5 py-2 text-xs font-semibold text-[#252943] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Window Description & Reassurance Message
                </label>
                <textarea
                  rows={3}
                  value={maintMessageInput}
                  onChange={(e) => setMaintMessageInput(e.target.value)}
                  placeholder="Please hold on for a moment while admin updates the website..."
                  className="w-full bg-[#F8F9FD] border border-[#DEE0ED] focus:border-[#3A4EFB] rounded-xl p-3 text-xs font-medium text-[#252943] outline-none resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
              <Link
                href="/maintenance"
                target="_blank"
                className="text-xs font-bold text-[#3A4EFB] hover:underline flex items-center gap-1"
              >
                <span>Preview Window</span>
                <span>↗</span>
              </Link>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMaintenanceModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 transition-colors"
                >
                  Cancel
                </button>
                {maintenance.enabled ? (
                  <button
                    type="button"
                    onClick={() => handleToggleMaintenance(false)}
                    disabled={togglingMaintenance}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-subtle transition-all press-scale flex items-center gap-1.5"
                  >
                    {togglingMaintenance && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Disable & Restore Site</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleToggleMaintenance(true)}
                    disabled={togglingMaintenance}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-subtle transition-all press-scale flex items-center gap-1.5"
                  >
                    {togglingMaintenance && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Enable Under Update Mode</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

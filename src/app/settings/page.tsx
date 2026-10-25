"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Clock,
  Send,
  Star,
  CheckCircle2,
  AlertTriangle,
  Server,
  ArrowRight,
  RefreshCw,
  Wallet,
  Sparkles,
  Layers,
  Check,
  X,
} from "lucide-react";

interface DiffDetail {
  key: string;
  providerId: string;
  providerServiceId: string;
  name: string;
  platform: string;
}

interface PreferencesState {
  onlyFavourites: boolean;
  activeProviderId: string | null;
  snapshotConfirmedAt: string | null;
  snapshotCount: number;
  currentCount: number;
  hasSnapshot: boolean;
  hasDiff: boolean;
  diff: {
    addedCount: number;
    removedCount: number;
    added: string[];
    removed: string[];
    addedDetails: DiffDetail[];
    removedDetails: DiffDetail[];
  };
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmingDiff, setConfirmingDiff] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [userSession, setUserSession] = useState<any>(null);

  const [prefData, setPrefData] = useState<PreferencesState | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      // 1. Load session
      const sessRes = await fetch("/api/auth/session");
      const sessData = await sessRes.json();
      if (sessData.authenticated) {
        setUserSession(sessData);
      }

      // 2. Load preferences & favourites snapshot diff
      const prefRes = await fetch("/api/user/preferences");
      const pData = await prefRes.json();
      if (pData.success) {
        setPrefData(pData);
      }
    } catch (err: any) {
      console.warn("Error loading settings:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleToggleOnlyFavourites(enabled: boolean) {
    setSaving(true);
    setNotification(null);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyFavourites: enabled }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update preference");
      }

      setNotification({
        type: "success",
        message: enabled
          ? "Favourites-only mode enabled! Only confirmed favourite services will appear in pickers and catalog."
          : "Favourites-only mode disabled. Full catalog will now be visible.",
      });

      // Reload fresh diff
      await loadData();
      window.dispatchEvent(new CustomEvent("preferences-updated"));
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to save preference" });
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmSnapshot() {
    setConfirmingDiff(true);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirmSnapshot" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update snapshot");
      }

      setShowConfirmModal(false);
      setNotification({
        type: "success",
        message: "Favourites-only view updated successfully! Your catalog view now matches your current favourites.",
      });

      await loadData();
      window.dispatchEvent(new CustomEvent("preferences-updated"));
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to update snapshot" });
    } finally {
      setConfirmingDiff(false);
    }
  }

  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-[#3A4EFB]">User Preferences</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#252943] tracking-tight">
          Settings & Preferences
        </h1>
        <p className="text-xs sm:text-sm text-[#252943]/60 mt-1">
          Customize your catalog display preferences and review your active passkey session access.
        </p>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-semibold ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Grid: Left Preferences, Right Passkey & Wallet Shortcut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Preferences (Col-span-2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Provider Management Moved Notice */}
          <div className="bg-gradient-to-r from-[#252943] to-[#1A1D31] rounded-3xl p-6 text-white border border-[#323758] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-subtle">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-[#3A4EFB]/20 border border-[#3A4EFB]/30 flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5 text-[#E3FF3B]" />
              </div>
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <span>SMM Providers Managed in Wallet</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#E3FF3B] text-[#252943]">
                    Multi-Provider
                  </span>
                </h3>
                <p className="text-xs text-[#DEE0ED]/75 mt-0.5">
                  Connect multiple SMM providers, test credentials, and monitor individual live balances in the Wallet tab.
                </p>
              </div>
            </div>
            <Link
              href="/wallet"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-xs font-bold text-white transition-all press-scale shrink-0 shadow-sm"
            >
              <span>Open Wallet Tab</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#E3FF3B]" />
            </Link>
          </div>

          {/* Preferences Card */}
          <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 sm:p-7 shadow-subtle space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#DEE0ED]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#3A4EFB]/10 text-[#3A4EFB] flex items-center justify-center">
                  <Star className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#252943] tracking-tight">
                    Catalog Display Mode
                  </h2>
                  <p className="text-xs text-[#252943]/60">
                    Control which services are shown in your Services Catalog and order pickers.
                  </p>
                </div>
              </div>
              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                  prefData?.onlyFavourites
                    ? "bg-amber-50 text-amber-800 border-amber-300"
                    : "bg-blue-50 text-blue-800 border-blue-200"
                }`}
              >
                {prefData?.onlyFavourites ? "Favourites Only" : "Full Catalog"}
              </span>
            </div>

            {/* Toggle Switch */}
            <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-[#252943] block">
                  Show only my favourite services
                </span>
                <p className="text-[11px] text-[#252943]/60 leading-relaxed">
                  When enabled, the catalog and all order pickers show only services from your confirmed favourites snapshot. New providers still import all services in the background, but they stay hidden until favourited and confirmed.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={prefData?.onlyFavourites ?? false}
                  disabled={saving || loading}
                  onChange={(e) => handleToggleOnlyFavourites(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3A4EFB]"></div>
              </label>
            </div>

            {/* Snapshot Status Card */}
            <div className="p-4 rounded-2xl bg-[#F8F9FD] border border-[#DEE0ED] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#252943]/60 font-semibold">Active Snapshot Count:</span>
                <span className="font-bold text-[#252943]">
                  {prefData?.snapshotCount ?? 0} confirmed service{prefData?.snapshotCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#252943]/60 font-semibold">Current Favourites Count:</span>
                <span className="font-bold text-[#3A4EFB]">
                  {prefData?.currentCount ?? 0} service{prefData?.currentCount === 1 ? "" : "s"}
                </span>
              </div>
              {prefData?.snapshotConfirmedAt && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-[#DEE0ED]/60">
                  <span className="text-[#252943]/60">Last Confirmed:</span>
                  <span className="text-[#252943]/80 font-medium">
                    {new Date(prefData.snapshotConfirmedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Yellow Diff Notice & Confirm Button (Change 12 Requirement) */}
            {prefData?.hasDiff && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 space-y-3 animate-fadeIn">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Your favourites changed since your last confirmed view</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  You have {prefData.diff.addedCount} newly favourited service{prefData.diff.addedCount === 1 ? "" : "s"} and {prefData.diff.removedCount} removed service{prefData.diff.removedCount === 1 ? "" : "s"}. Your catalog currently displays the previous snapshot until you update it.
                </p>

                <button
                  type="button"
                  id="update-favourites-snapshot-btn"
                  onClick={() => setShowConfirmModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-[#252943] font-bold text-xs transition-all shadow-subtle press-scale flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-[#252943]" />
                  <span>Your favourites changed. Update the favourites-only view?</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Account Details & Telegram Assistance */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 shadow-subtle space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-[#DEE0ED]">
              <div className="w-9 h-9 rounded-xl bg-[#3A4EFB]/10 text-[#3A4EFB] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#252943]">
                  Passkey Session Details
                </h3>
                <span className="text-[11px] text-[#252943]/60">
                  {userSession?.user?.username || "Authenticated User"}
                </span>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#252943]/60">Assigned Role</span>
                <span
                  className={`font-bold px-2.5 py-0.5 rounded-md text-[10px] uppercase ${
                    userSession?.role === "ADMIN"
                      ? "bg-[#252943] text-[#E3FF3B]"
                      : "bg-[#3A4EFB]/10 text-[#3A4EFB]"
                  }`}
                >
                  {userSession?.role || "USER"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#252943]/60">Remaining Access</span>
                <span className="font-extrabold text-[#3A4EFB] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {userSession?.remainingDays !== null && userSession?.remainingDays !== undefined ? (
                    userSession.remainingDays > 0 ? (
                      `${userSession.remainingDays} days remaining`
                    ) : (
                      `${userSession.remainingHours || 0} hours remaining`
                    )
                  ) : (
                    "Unlimited Access"
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#252943]/60">Expires On</span>
                <span className="font-semibold text-[#252943]">
                  {userSession?.expiresAt
                    ? new Date(userSession.expiresAt).toLocaleDateString()
                    : "Permanent Key"}
                </span>
              </div>
            </div>
          </div>

          {/* Telegram Assistance Banner */}
          <div className="bg-[#1A1D31] border border-[#323758] rounded-3xl p-5 text-white shadow-subtle flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-[#3A4EFB]/20 border border-[#3A4EFB]/40 text-[#E3FF3B] flex items-center justify-center shrink-0 mt-0.5">
              <Send className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold tracking-tight text-white">
                Need Help Setting Up Your Provider API?
              </h3>
              <p className="text-xs text-[#DEE0ED]/75 leading-relaxed">
                Need help connecting your SMM provider API or managing orders? Message{" "}
                <a
                  href="https://t.me/Ghostfinds"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#3A4EFB] font-bold underline hover:text-blue-400 transition-colors"
                >
                  @Ghostfinds
                </a>{" "}
                on Telegram.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Snapshot Diff Modal (Change 12) */}
      {showConfirmModal && prefData && (
        <div className="fixed inset-0 z-50 bg-[#252943]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-[#DEE0ED]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#252943]">
                    Update Favourites-Only View
                  </h3>
                  <p className="text-[11px] text-[#252943]/60">
                    Review what will be added and removed from your active catalog view.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="p-1.5 rounded-lg text-[#252943]/60 hover:text-[#252943]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 max-h-72 overflow-y-auto text-xs">
              {/* To be Added */}
              {prefData.diff.addedDetails.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                    + Services to be added ({prefData.diff.addedDetails.length}):
                  </span>
                  <div className="space-y-1.5 bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200">
                    {prefData.diff.addedDetails.map((item) => (
                      <div key={item.key} className="flex items-center justify-between text-emerald-900">
                        <span className="font-semibold truncate max-w-xs">{item.name}</span>
                        <span className="text-[10px] font-mono bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-800">
                          #{item.providerServiceId}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* To be Removed */}
              {prefData.diff.removedDetails.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">
                    - Services to be removed ({prefData.diff.removedDetails.length}):
                  </span>
                  <div className="space-y-1.5 bg-rose-50/60 p-2.5 rounded-xl border border-rose-200">
                    {prefData.diff.removedDetails.map((item) => (
                      <div key={item.key} className="flex items-center justify-between text-rose-900">
                        <span className="font-semibold truncate max-w-xs">{item.name}</span>
                        <span className="text-[10px] font-mono bg-rose-100 px-1.5 py-0.5 rounded text-rose-800">
                          #{item.providerServiceId}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#DEE0ED] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl border border-[#DEE0ED] text-xs font-semibold text-[#252943]/70 hover:bg-[#F8F9FD]"
              >
                Keep Old View
              </button>
              <button
                type="button"
                id="confirm-snapshot-diff-btn"
                onClick={handleConfirmSnapshot}
                disabled={confirmingDiff}
                className="px-4 py-2 rounded-xl bg-[#3A4EFB] hover:bg-[#2C3FE0] text-white text-xs font-bold transition-all press-scale shadow-subtle flex items-center gap-1.5 disabled:opacity-50"
              >
                {confirmingDiff && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm & Apply Snapshot</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

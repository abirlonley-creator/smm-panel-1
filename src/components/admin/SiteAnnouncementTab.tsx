"use client";

import React, { useState, useEffect } from "react";
import {
  Megaphone,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Eye,
  Radio,
  Sliders,
  X,
  Volume2,
} from "lucide-react";

interface AnnouncementConfig {
  enabled: boolean;
  message: string;
  badge?: string;
  link?: string;
  linkText?: string;
  speed?: "slow" | "normal" | "fast";
  allowDismiss?: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

const TEMPLATES = [
  {
    title: "⚡ Organic Algorithm Active",
    badge: "ALGORITHM",
    message:
      "⚡ System Notice: S-Curve gradual organic delivery algorithm is running optimally. Real-time view pacing active on all tiers.",
    link: "https://t.me/Ghostfinds",
    linkText: "24/7 Support",
  },
  {
    title: "💬 Dedicated Support Online",
    badge: "24/7 SUPPORT",
    message:
      "💬 Need assistance, custom follower numbers, or instant approvals? Live Telegram support is online @Ghostfinds.",
    link: "https://t.me/Ghostfinds",
    linkText: "Chat on Telegram",
  },
  {
    title: "🚀 Server Maintenance Complete",
    badge: "UPDATE",
    message:
      "🚀 System enhancements completed! High-speed automated batching and scheduled campaigns are delivering at 100% capacity.",
    link: "",
    linkText: "",
  },
  {
    title: "🎉 Weekend Bonus Added",
    badge: "BONUS",
    message:
      "🎉 Weekend Boost: Extra organic view buffers and priority queueing automatically applied to all new growth campaigns.",
    link: "/engagement",
    linkText: "Launch Campaign",
  },
];

export function SiteAnnouncementTab() {
  const [config, setConfig] = useState<AnnouncementConfig>({
    enabled: false,
    message: "",
    badge: "ANNOUNCEMENT",
    link: "https://t.me/Ghostfinds",
    linkText: "24/7 Support",
    speed: "normal",
    allowDismiss: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);

  async function loadConfig() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/announcement", { cache: "no-store" });
      const data = await res.json();
      if (data?.success && data.announcement) {
        setConfig({
          enabled: Boolean(data.announcement.enabled),
          message: data.announcement.message || "",
          badge: data.announcement.badge || "ANNOUNCEMENT",
          link: data.announcement.link || "",
          linkText: data.announcement.linkText || "",
          speed: data.announcement.speed || "normal",
          allowDismiss: data.announcement.allowDismiss !== false,
          updatedAt: data.announcement.updatedAt,
          updatedBy: data.announcement.updatedBy,
        });
      }
    } catch (err: any) {
      setFeedback({ text: err.message || "Failed to load announcement config", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConfig();
  }, []);

  async function handleSave(updatedConfig?: AnnouncementConfig) {
    setSaving(true);
    setFeedback(null);
    const toSave = updatedConfig || config;
    try {
      const res = await fetch("/api/admin/announcement", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSave),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update announcement");
      }
      setConfig(data.announcement);
      setFeedback({
        text: data.announcement.enabled
          ? "Announcement saved! It is now loop-playing live across the website header."
          : "Announcement saved and disabled (hidden from users).",
        type: "success",
      });

      // Notify any live ticker on the page
      window.dispatchEvent(new CustomEvent("announcement-updated"));
    } catch (err: any) {
      setFeedback({ text: err.message || "Failed to save announcement", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  function handleToggleEnabled() {
    const next = { ...config, enabled: !config.enabled };
    setConfig(next);
    handleSave(next);
  }

  function applyTemplate(tpl: (typeof TEMPLATES)[0]) {
    setConfig((prev) => ({
      ...prev,
      message: tpl.message,
      badge: tpl.badge,
      link: tpl.link,
      linkText: tpl.linkText,
    }));
  }

  const speedClass =
    config.speed === "slow"
      ? "animate-marquee-slow"
      : config.speed === "fast"
      ? "animate-marquee-fast"
      : "animate-marquee";

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-[#DEE0ED] p-8 text-center space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#111413] mx-auto" />
        <p className="text-xs font-semibold text-[#5B625F]">Loading announcement configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Info Card */}
      <div className="bg-white rounded-3xl border border-[#DEE0ED] p-6 sm:p-8 shadow-subtle space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DEE0ED]">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#111413] text-[#D4F04F] flex items-center justify-center font-bold shadow-sm">
                <Megaphone className="w-4 h-4 text-[#D4F04F]" />
              </div>
              <h2 className="text-base font-black text-[#111413]">Site-Wide Announcement & Header Ticker</h2>
            </div>
            <p className="text-xs text-[#5B625F]">
              Broadcast notices, algorithm updates, or promotions. The text loops smoothly in the header for all users without distracting them.
            </p>
          </div>

          {/* Quick Toggle Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleEnabled}
              disabled={saving}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border shadow-subtle press-scale cursor-pointer ${
                config.enabled
                  ? "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100"
                  : "bg-[#111413] text-[#D4F04F] border-[#222826] hover:bg-[#1B201E]"
              }`}
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Radio className={`w-3.5 h-3.5 ${config.enabled ? "text-rose-600 animate-pulse" : "text-[#D4F04F]"}`} />
              )}
              <span>{config.enabled ? "Disable Announcement" : "Broadcast Announcement"}</span>
            </button>
          </div>
        </div>

        {/* Status Callout Banner */}
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            config.enabled
              ? "bg-emerald-50/60 border-emerald-200 text-emerald-950"
              : "bg-[#F3F1EA] border-[#E4E0D3] text-[#5B625F]"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`w-3 h-3 rounded-full shrink-0 ${
                config.enabled ? "bg-emerald-500 animate-pulse" : "bg-gray-400"
              }`}
            />
            <div>
              <span className="font-bold text-xs block text-[#111413]">
                Status: {config.enabled ? "LIVE & BROADCASTING TO USERS" : "INACTIVE (HIDDEN FROM USERS)"}
              </span>
              <span className="text-[11px] text-[#5B625F]">
                {config.enabled
                  ? "Playing continuously in the header ticker across all pages. Users can pause on hover."
                  : "Turn on the announcement whenever you want to display an alert or message."}
              </span>
            </div>
          </div>

          {config.updatedAt && (
            <span className="text-[10px] font-mono text-[#5B625F] bg-white/70 px-2.5 py-1 rounded-lg border border-[#E4E0D3] self-start sm:self-auto">
              Last saved: {new Date(config.updatedAt).toLocaleTimeString()} by {config.updatedBy || "admin"}
            </span>
          )}
        </div>

        {/* Live Interactive Preview Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#111413] flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-[#5E8C1F]" />
              Live Visitor Preview (How it looks & loops in the header)
            </span>
            <span className="text-[11px] text-[#5B625F] italic">Hover over ticker to test pause</span>
          </div>

          <div className="rounded-2xl border border-[#222826] bg-[#111413] text-[#F3F1EA] overflow-hidden shadow-card">
            {config.message?.trim() ? (
              <div className="flex items-stretch overflow-hidden select-none">
                {/* Badge */}
                <div className="shrink-0 flex items-center gap-2 pl-3 sm:pl-4 pr-3 py-2 bg-[#111413] z-10 border-r border-[#222826]">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#D4F04F] text-[#111413] shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#111413] animate-pulse" />
                    {config.badge || "ANNOUNCEMENT"}
                  </span>
                </div>

                {/* Looping Marquee */}
                <div
                  className="flex-1 overflow-hidden relative flex items-center"
                  style={{
                    maskImage: "linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)",
                    WebkitMaskImage: "linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)",
                  }}
                >
                  <div className={`${speedClass} py-2 cursor-default`}>
                    {[0, 1].map((copyIndex) => (
                      <div
                        key={copyIndex}
                        className="flex items-center gap-8 shrink-0 pr-8 text-[12px] font-medium text-[#F3F1EA]/90 tracking-tight"
                      >
                        <span className="hover:text-white transition-colors">{config.message}</span>
                        {config.link && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#D4F04F] underline underline-offset-2">
                            <span>{config.linkText || "Learn More"}</span>
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        )}
                        <span className="text-[#D4F04F]/60 text-[10px]">✦</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dismiss X */}
                {config.allowDismiss !== false && (
                  <div className="shrink-0 flex items-center pr-3 pl-2 z-10 bg-[#111413] border-l border-[#222826]">
                    <span className="p-1 rounded text-[#9AA39F]" title="Users can dismiss this">
                      <X className="w-3.5 h-3.5" />
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-3 px-4 text-center text-xs text-[#9AA39F]">
                Type an announcement message below to preview the header loop
              </div>
            )}
          </div>
        </div>

        {/* Quick Suggestion Templates */}
        <div className="space-y-2 pt-2">
          <span className="text-xs font-bold text-[#111413] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#D4F04F]" />
            Quick Templates (Click to fill)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {TEMPLATES.map((tpl, i) => (
              <button
                key={i}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="text-left p-2.5 rounded-xl border border-[#E4E0D3] bg-[#F8F7F2] hover:bg-white hover:border-[#111413] transition-all press-scale text-xs cursor-pointer group"
              >
                <span className="font-bold text-[#111413] block group-hover:text-[#5E8C1F]">{tpl.title}</span>
                <span className="text-[11px] text-[#5B625F] line-clamp-2 mt-0.5">{tpl.message}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Announcement Form Inputs */}
        <div className="space-y-4 pt-2">
          {/* Message Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#111413]">
                Announcement Message *
              </label>
              <span className="text-[11px] text-[#5B625F]">{config.message.length} characters</span>
            </div>
            <textarea
              rows={3}
              value={config.message}
              onChange={(e) => setConfig({ ...config, message: e.target.value })}
              placeholder="e.g. ⚡ System Notice: All TikTok delivery algorithms are active. Reach out to @Ghostfinds on Telegram for 24/7 support."
              className="w-full bg-[#F3F1EA]/60 border border-[#E4E0D3] focus:border-[#111413] focus:bg-white rounded-2xl p-3 text-xs font-medium text-[#111413] outline-none transition-all placeholder:text-[#5B625F]/60"
            />
          </div>

          {/* Badge & Speed Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Badge Tag */}
            <div>
              <label className="block text-xs font-bold text-[#111413] mb-1.5">
                Badge Label
              </label>
              <input
                type="text"
                value={config.badge || ""}
                onChange={(e) => setConfig({ ...config, badge: e.target.value })}
                placeholder="ANNOUNCEMENT"
                className="w-full bg-[#F3F1EA]/60 border border-[#E4E0D3] focus:border-[#111413] focus:bg-white rounded-xl px-3 py-2 text-xs font-black uppercase text-[#111413] outline-none transition-all"
              />
              <span className="text-[10px] text-[#5B625F] mt-1 block">Tag shown on the left of ticker</span>
            </div>

            {/* Loop Speed */}
            <div>
              <label className="block text-xs font-bold text-[#111413] mb-1.5">
                Scroll Loop Speed
              </label>
              <select
                value={config.speed || "normal"}
                onChange={(e) => setConfig({ ...config, speed: e.target.value as any })}
                className="w-full bg-[#F3F1EA]/60 border border-[#E4E0D3] focus:border-[#111413] focus:bg-white rounded-xl px-3 py-2 text-xs font-bold text-[#111413] outline-none transition-all cursor-pointer"
              >
                <option value="slow">Slow (48s) — Very relaxed reading</option>
                <option value="normal">Normal (30s) — Recommended</option>
                <option value="fast">Fast (18s) — Energetic / Short notices</option>
              </select>
              <span className="text-[10px] text-[#5B625F] mt-1 block">Full-width loop duration</span>
            </div>

            {/* User Dismissible */}
            <div>
              <label className="block text-xs font-bold text-[#111413] mb-1.5">
                User Dismissal
              </label>
              <label className="flex items-center gap-2.5 p-2 bg-[#F3F1EA]/60 border border-[#E4E0D3] rounded-xl cursor-pointer hover:bg-[#F3F1EA] transition-all">
                <input
                  type="checkbox"
                  checked={config.allowDismiss !== false}
                  onChange={(e) => setConfig({ ...config, allowDismiss: e.target.checked })}
                  className="rounded text-[#111413] focus:ring-[#111413] cursor-pointer"
                />
                <span className="text-xs font-semibold text-[#111413]">Allow users to close [X]</span>
              </label>
              <span className="text-[10px] text-[#5B625F] mt-1 block">Allows users to hide banner for session</span>
            </div>
          </div>

          {/* Action Link Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-[#111413] mb-1.5">
                Action Link (Optional URL or Telegram)
              </label>
              <input
                type="text"
                value={config.link || ""}
                onChange={(e) => setConfig({ ...config, link: e.target.value })}
                placeholder="e.g. https://t.me/Ghostfinds or /wallet"
                className="w-full bg-[#F3F1EA]/60 border border-[#E4E0D3] focus:border-[#111413] focus:bg-white rounded-xl px-3 py-2 text-xs font-mono text-[#111413] outline-none transition-all placeholder:text-[#5B625F]/60"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#111413] mb-1.5">
                Link Button Text
              </label>
              <input
                type="text"
                value={config.linkText || ""}
                onChange={(e) => setConfig({ ...config, linkText: e.target.value })}
                placeholder="e.g. 24/7 Support, Add Funds, View Details"
                className="w-full bg-[#F3F1EA]/60 border border-[#E4E0D3] focus:border-[#111413] focus:bg-white rounded-xl px-3 py-2 text-xs font-semibold text-[#111413] outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Feedback message */}
        {feedback && (
          <div
            className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 animate-fadeIn ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                : "bg-rose-50 text-rose-800 border-rose-300"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#DEE0ED]">
          <span className="text-[11px] text-[#5B625F]">
            {config.enabled
              ? "🟢 Announcement is active and will immediately update for all active visitors."
              : "⚪ Announcement is currently paused. Saving will update the draft."}
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#D4F04F] text-[#111413] hover:bg-[#C5E23A] text-xs font-black transition-all shadow-subtle flex items-center justify-center gap-2 press-scale cursor-pointer"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saving ? "Saving Announcement..." : "Save Announcement Settings"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

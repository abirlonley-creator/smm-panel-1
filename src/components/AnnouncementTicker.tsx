"use client";

import React, { useState, useEffect } from "react";
import { ArrowRight, X } from "lucide-react";

export interface AnnouncementData {
  enabled: boolean;
  message: string;
  badge?: string;
  link?: string;
  linkText?: string;
  speed?: "slow" | "normal" | "fast";
  allowDismiss?: boolean;
  updatedAt?: string;
}

export function AnnouncementTicker() {
  const [announcement, setAnnouncement] = useState<AnnouncementData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchAnnouncement() {
    try {
      const res = await fetch("/api/announcement", { cache: "no-store" });
      const data = await res.json();
      if (data?.success && data.announcement) {
        const item: AnnouncementData = data.announcement;
        setAnnouncement(item);

        // Check if user previously dismissed this exact version
        if (typeof window !== "undefined" && item.allowDismiss !== false) {
          const dismissedId = sessionStorage.getItem("aurasmm_announcement_dismissed");
          if (dismissedId && (dismissedId === item.updatedAt || dismissedId === item.message)) {
            setDismissed(true);
          } else {
            setDismissed(false);
          }
        }
      }
    } catch {
      // ignore network errors
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAnnouncement();

    // Check periodically for updates
    const interval = setInterval(fetchAnnouncement, 30000);

    // Also listen for instant updates dispatched by the admin panel
    const handleUpdate = () => fetchAnnouncement();
    window.addEventListener("announcement-updated", handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener("announcement-updated", handleUpdate);
    };
  }, []);

  function handleDismiss() {
    setDismissed(true);
    if (typeof window !== "undefined" && announcement) {
      sessionStorage.setItem(
        "aurasmm_announcement_dismissed",
        announcement.updatedAt || announcement.message
      );
    }
  }

  // If not loaded yet, or disabled, or empty message, or dismissed by user: render nothing
  if (loading || !announcement || !announcement.enabled || !announcement.message?.trim() || dismissed) {
    return null;
  }

  const speedClass =
    announcement.speed === "slow"
      ? "animate-marquee-slow"
      : announcement.speed === "fast"
      ? "animate-marquee-fast"
      : "animate-marquee";

  return (
    <aside
      aria-label="Site Announcement"
      className="w-full bg-[#111413] text-[#F3F1EA] border-b border-[#222826] relative z-30 flex items-stretch overflow-hidden select-none"
    >
      {/* Pinned Left Badge */}
      <div className="shrink-0 flex items-center gap-2 pl-3 sm:pl-4 pr-3 py-1.5 bg-[#111413] z-10 border-r border-[#222826]">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#D4F04F] text-[#111413] shadow-sm select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-[#111413] animate-pulse" />
          {announcement.badge || "ANNOUNCEMENT"}
        </span>
      </div>

      {/* Seamless Looping Marquee Track */}
      <div
        className="flex-1 overflow-hidden relative flex items-center"
        style={{
          maskImage: "linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)",
        }}
        title="Hover to pause ticker"
      >
        <div className={`${speedClass} py-1.5 cursor-default`}>
          {/* Render duplicated track for continuous seamless loop */}
          {[0, 1].map((copyIndex) => (
            <div
              key={copyIndex}
              className="flex items-center gap-8 shrink-0 pr-8 text-[12px] font-medium text-[#F3F1EA]/90 tracking-tight"
            >
              <span className="hover:text-white transition-colors">{announcement.message}</span>

              {announcement.link && (
                <a
                  href={announcement.link}
                  target={announcement.link.startsWith("http") ? "_blank" : undefined}
                  rel={announcement.link.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#D4F04F] hover:text-[#C5E23A] underline underline-offset-2 transition-colors cursor-pointer"
                >
                  <span>{announcement.linkText || "Learn More"}</span>
                  <ArrowRight className="w-3 h-3" />
                </a>
              )}

              <span className="text-[#D4F04F]/60 text-[10px] select-none">✦</span>
            </div>
          ))}
        </div>
      </div>

      {/* Optional Dismiss Action Button */}
      {announcement.allowDismiss !== false && (
        <div className="shrink-0 flex items-center pr-2.5 sm:pr-3 pl-2 z-10 bg-[#111413] border-l border-[#222826]">
          <button
            type="button"
            onClick={handleDismiss}
            title="Dismiss announcement for this session"
            className="p-1 rounded-md text-[#9AA39F] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </aside>
  );
}

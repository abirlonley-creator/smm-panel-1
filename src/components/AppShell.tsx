"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { AppHeader } from "@/components/AppHeader";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import { ShieldAlert, ArrowRight } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const isMaintenancePage = pathname === "/maintenance";

  const [underMaintenance, setUnderMaintenance] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [maintInfo, setMaintInfo] = useState<{ title?: string; message?: string; supportTelegram?: string }>({});

  // Monitor maintenance and admin status continuously
  useEffect(() => {
    let active = true;

    async function checkMaintenance() {
      try {
        const res = await fetch("/api/system/maintenance", { cache: "no-store" });
        const data = await res.json();
        if (active && data.success) {
          setUnderMaintenance(Boolean(data.underMaintenance));
          setIsAdmin(Boolean(data.isAdmin));
          if (data.title || data.message) {
            setMaintInfo({
              title: data.title,
              message: data.message,
              supportTelegram: data.supportTelegram,
            });
          }
        }
      } catch (err) {
        // ignore network hiccup
      }
    }

    checkMaintenance();
    const interval = setInterval(checkMaintenance, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (isLoginPage || isMaintenancePage) {
    return <>{children}</>;
  }

  // If Under Update mode is enabled and user is NOT an admin:
  // Lock standard user access completely across all pages.
  // The administrator is NEVER locked out and can view and use every single panel!
  if (underMaintenance && !isAdmin) {
    return (
      <MaintenanceScreen
        customTitle={maintInfo.title}
        customMessage={maintInfo.message}
        supportTelegram={maintInfo.supportTelegram}
        onRestored={() => setUnderMaintenance(false)}
      />
    );
  }

  return (
    <>
      <Navigation />
      <div className="lg:pl-64 flex flex-col min-h-screen overflow-x-hidden">
        {/* Administrator Under Update Mode Alert Banner */}
        {underMaintenance && isAdmin && (
          <div className="bg-[#FBF0DC] border-b border-[#B7791F]/30 px-4 py-2.5 text-xs text-[#B7791F] flex flex-col sm:flex-row sm:items-center justify-between gap-2 z-30 animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B7791F] animate-pulse shrink-0" />
              <span className="font-semibold text-amber-950">
                Under Update Mode Active: Standard users are locked out and see the update screen. As administrator, you have full access to every panel.
              </span>
            </div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 font-bold text-amber-950 underline hover:text-amber-800 text-[11px] shrink-0"
            >
              <span>Admin Panel Controls</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        <AppHeader />
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
          {children}
        </main>
        <footer className="border-t border-[#E4E0D3] py-4 sm:py-6 px-4 sm:px-8 text-xs text-[#5B625F] flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <img
              src="/brand/logos/mark-on-light.svg"
              alt="AuraSMM"
              className="w-4 h-4 inline-block shrink-0"
            />
            <span className="font-medium text-[#111413]">AuraSMM Minimalist Panel & Growth Planner</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#5B625F]/60">
            <span>{underMaintenance ? "Under Update (Admin Mode)" : "All systems operational"}</span>
          </div>
        </footer>
      </div>
    </>
  );
}

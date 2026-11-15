"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { AppHeader } from "@/components/AppHeader";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const isMaintenancePage = pathname === "/maintenance";
  const isAdminPage = pathname.startsWith("/admin");

  const [underMaintenance, setUnderMaintenance] = useState(false);
  const [maintInfo, setMaintInfo] = useState<{ title?: string; message?: string; supportTelegram?: string }>({});

  // Monitor maintenance status for regular user pages
  useEffect(() => {
    if (isAdminPage || isMaintenancePage) return;

    let active = true;
    async function checkMaintenance() {
      try {
        const res = await fetch("/api/system/maintenance", { cache: "no-store" });
        const data = await res.json();
        if (active && data.success) {
          setUnderMaintenance(Boolean(data.underMaintenance));
          if (data.title || data.message) {
            setMaintInfo({
              title: data.title,
              message: data.message,
              supportTelegram: data.supportTelegram,
            });
          }
        }
      } catch (err) {
        // ignore
      }
    }

    checkMaintenance();
    const interval = setInterval(checkMaintenance, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isAdminPage, isMaintenancePage]);

  if (isLoginPage || isMaintenancePage) {
    return <>{children}</>;
  }

  // If Under Update mode is enabled and user is on a non-admin page, lock access completely
  if (underMaintenance && !isAdminPage) {
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
        <AppHeader />
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
          {children}
        </main>
        <footer className="border-t border-[#DEE0ED]/80 py-4 sm:py-6 px-4 sm:px-8 text-xs text-[#252943]/60 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#3A4EFB]"></span>
            <span>AuraSMM Minimalist Panel & Growth Planner</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#252943]/40">
            <span>All systems operational</span>
          </div>
        </footer>
      </div>
    </>
  );
}

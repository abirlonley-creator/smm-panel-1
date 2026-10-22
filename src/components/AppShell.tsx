"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { AppHeader } from "@/components/AppHeader";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Navigation />
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <AppHeader />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-[#DEE0ED]/80 py-6 px-6 sm:px-8 text-xs text-[#252943]/60 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#3A4EFB]"></span>
            <span>AuraSMM Minimalist Panel & Growth Planner</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#252943]/60 font-medium">
            <span>Color Palette: #3A4EFB / #E3FF3B / #252943</span>
            <span>Deterministic Scheduler</span>
          </div>
        </footer>
      </div>
    </>
  );
}

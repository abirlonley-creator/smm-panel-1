import { Suspense } from "react";
import Link from "next/link";
import { Radar, ChevronRight, Activity } from "lucide-react";
import { LikesAnalyzeMonitor } from "@/components/LikesAnalyzeMonitor";

export const metadata = {
  title: "Likes Analyze — Surveillance & Monitoring Engine",
  description: "Continuous delivery monitoring, interval checkpoints, and live delivery surveillance.",
};

export default function LikesAnalyzePage({
  searchParams,
}: {
  searchParams?: { serviceId?: string; url?: string };
}) {
  const initialUrl = searchParams?.url || "";

  return (
    <div className="space-y-6 animate-fadeIn max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 text-xs text-[#252943]/60 mb-1">
          <Link href="/" className="hover:text-[#3A4EFB]">
            Dashboard
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span>Likes Analyze</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#252943] flex items-center gap-2">
              <Radar className="w-6 h-6 text-[#3A4EFB]" />
              Likes Analyze Monitoring Engine
            </h1>
            <p className="text-xs sm:text-sm text-[#252943]/60 mt-0.5">
              Live automated surveillance, checkpoint tracking, velocity auditing, and adaptive pacing.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E3FF3B]/30 border border-[#E3FF3B] text-xs font-semibold text-[#252943]">
            <Activity className="w-3.5 h-3.5 text-[#3A4EFB] animate-pulse" />
            <span>Real-time Inspection Active</span>
          </div>
        </div>
      </div>

      {/* Main Likes Analyze Monitor Component */}
      <Suspense fallback={<div className="py-12 text-center text-xs text-[#252943]/50">Loading monitor...</div>}>
        <LikesAnalyzeMonitor service={null} targetUrl={initialUrl} />
      </Suspense>
    </div>
  );
}

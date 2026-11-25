import React from "react";

export default function RootLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F3F1EA] px-4 select-none">
      {/* Subtle Ambient Lime Aura */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute w-[320px] h-[320px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(212, 240, 79, 0.26) 0%, rgba(212, 240, 79, 0) 68%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Clean Ink Vessel with Official Dark-Mode Leaf & Lime Dot */}
        <div className="relative flex items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute -inset-2 rounded-[26px] bg-[#D4F04F]/25 blur-xl animate-aura-breathe"
          />
          <div className="relative w-16 h-16 rounded-[20px] bg-[#111413] border border-[#222826] shadow-[0_20px_50px_-12px_rgba(17,20,19,0.34),inset_0_1px_0_rgba(255,255,255,0.12)] flex items-center justify-center">
            <img
              src="/brand/logos/mark-on-dark.svg"
              alt="AuraSMM"
              className="w-8 h-8 object-contain animate-aura-breathe"
            />
          </div>
        </div>

        {/* Official Brand Lockup + Hairline Sweep Bar */}
        <div className="flex flex-col items-center gap-4">
          <img
            src="/brand/logos/lockup-horizontal-on-light.svg"
            alt="AuraSMM"
            className="h-6 w-auto"
          />

          <div
            role="progressbar"
            aria-label="Loading"
            className="w-36 h-[3px] rounded-full bg-[#E4E0D3]/90 overflow-hidden relative"
          >
            <div
              className="absolute inset-y-0 left-0 w-1/2 rounded-full animate-aura-sweep"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, #111413 38%, #5E8C1F 72%, #D4F04F 100%)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

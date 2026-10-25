"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function ServiceWorkerRegister() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Register service worker if supported
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .catch((err) => console.warn("SW registration error:", err));
      });
    }

    // Monitor online / offline status
    const updateOnlineStatus = () => {
      setIsOffline(!navigator.onLine);
    };

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#252943] text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-[#3A4EFB]/40 flex items-center gap-2.5 text-xs font-semibold animate-bounce">
      <WifiOff className="w-4 h-4 text-[#E3FF3B]" />
      <span>Reconnecting... Low network detected. Your inputs are saved.</span>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

// Top-of-page banner that surfaces when the browser reports offline. Auto-
// hides 2.5s after coming back online. Uses `navigator.onLine` + the
// `online` / `offline` events.
export default function OnlineStatus() {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  // Tri-state: null = unknown (SSR), true = online, false = offline
  const [online, setOnline] = useState<boolean | null>(null);
  // When the network just came back, briefly show the "back online" banner.
  const [showReconnect, setShowReconnect] = useState(false);

  useEffect(() => {
    // Initialize from the browser's actual state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOnline(navigator.onLine);

    const handleOffline = () => setOnline(false);
    const handleOnline = () => {
      setOnline(true);
      setShowReconnect(true);
      setTimeout(() => setShowReconnect(false), 2500);
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (online === null || (online && !showReconnect)) return null;

  const offline = online === false;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[150] px-4 py-2 text-center text-xs font-medium transition-all ${
        offline
          ? "bg-danger text-white"
          : "bg-success text-white"
      }`}
      role="status"
      aria-live="polite"
      style={{ paddingTop: `calc(env(safe-area-inset-top) + 0.5rem)` }}
    >
      <div className="flex items-center justify-center gap-2">
        {offline ? <WifiOff size={14} aria-hidden="true" /> : <Wifi size={14} aria-hidden="true" />}
        <span>
          {offline
            ? (isZh ? "网络已断开 · 已显示缓存数据" : "You're offline · showing cached data")
            : (isZh ? "网络已恢复" : "Back online")}
        </span>
      </div>
    </div>
  );
}

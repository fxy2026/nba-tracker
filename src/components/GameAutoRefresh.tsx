"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Radio } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

const INTERVAL = 30;

export default function GameAutoRefresh({ isLive }: { isLive: boolean }) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(INTERVAL);
  // Single source of truth shared by the tick and the manual button so a
  // manual refresh resets the countdown without the next tick snapping back.
  const remainingRef = useRef(INTERVAL);
  const { t } = useLocale();

  useEffect(() => {
    if (!isLive) return;
    remainingRef.current = INTERVAL;

    const tick = setInterval(() => {
      remainingRef.current--;
      setCountdown(remainingRef.current);
      if (remainingRef.current <= 0) {
        if (typeof navigator === "undefined" || navigator.onLine !== false) {
          router.refresh();
        }
        remainingRef.current = INTERVAL;
        setCountdown(INTERVAL);
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [isLive, router]);

  if (!isLive) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-success mb-3 mt-2">
      <Radio size={12} className="animate-pulse" />
      <span>{t.liveScore.autoRefreshing}</span>
      <button
        onClick={() => {
          if (typeof navigator === "undefined" || navigator.onLine !== false) {
            router.refresh();
          }
          remainingRef.current = INTERVAL;
          setCountdown(INTERVAL);
        }}
        className="text-text-secondary hover:text-accent transition-colors underline decoration-dashed"
      >
        {t.liveScore.refreshNow}
      </button>
      <span className="text-text-secondary tabular-nums">({countdown}s)</span>
    </div>
  );
}

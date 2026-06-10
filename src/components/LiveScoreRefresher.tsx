"use client";

import { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

const REFRESH_INTERVAL = 30;

export default function LiveScoreRefresher({ hasLiveGames, onRefresh }: { hasLiveGames: boolean; onRefresh: () => void }) {
  const { t } = useLocale();
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  // Single source of truth shared by the tick and the manual button so a
  // manual refresh resets the countdown without the next tick snapping back.
  const remainingRef = useRef(REFRESH_INTERVAL);

  useEffect(() => {
    if (!hasLiveGames) return;

    // Add ±3s jitter to avoid thundering herd
    const jitter = Math.floor(Math.random() * 6) - 3;
    const interval = REFRESH_INTERVAL + jitter;
    remainingRef.current = interval;

    const tick = setInterval(() => {
      remainingRef.current--;
      setCountdown(remainingRef.current);
      if (remainingRef.current <= 0) {
        onRefresh();
        remainingRef.current = interval;
        setCountdown(interval);
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [hasLiveGames, onRefresh]);

  if (!hasLiveGames) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-success mb-4">
      <Radio size={12} className="animate-pulse" />
      <span>{t.liveScore.autoRefreshing}</span>
      <button
        onClick={() => {
          onRefresh();
          remainingRef.current = REFRESH_INTERVAL;
          setCountdown(REFRESH_INTERVAL);
        }}
        className="text-text-secondary hover:text-accent transition-colors underline decoration-dashed"
      >
        {t.liveScore.refreshNow}
      </button>
      <span className="text-text-secondary tabular-nums">({countdown}s)</span>
    </div>
  );
}

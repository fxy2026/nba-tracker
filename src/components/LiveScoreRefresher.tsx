"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Radio } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

const REFRESH_INTERVAL = 30;

export default function LiveScoreRefresher({ hasLiveGames }: { hasLiveGames: boolean }) {
  const { t } = useLocale();
  const router = useRouter();
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (!hasLiveGames) return;

    // Add ±3s jitter to avoid thundering herd
    const jitter = Math.floor(Math.random() * 6) - 3;
    const interval = REFRESH_INTERVAL + jitter;
    let remaining = interval;

    const tick = setInterval(() => {
      remaining--;
      setCountdown(remaining);
      if (remaining <= 0) {
        routerRef.current.refresh();
        remaining = interval;
        setCountdown(remaining);
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [hasLiveGames]);

  if (!hasLiveGames) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-success mb-4">
      <Radio size={12} className="animate-pulse" />
      <span>{t.liveScore.autoRefreshing}</span>
      <button
        onClick={() => {
          routerRef.current.refresh();
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

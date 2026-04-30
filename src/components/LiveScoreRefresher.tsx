"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Radio } from "lucide-react";

export default function LiveScoreRefresher({ hasLiveGames }: { hasLiveGames: boolean }) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(30);

  const doRefresh = useCallback(() => {
    router.refresh();
    setCountdown(30);
  }, [router]);

  useEffect(() => {
    if (!hasLiveGames) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          doRefresh();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [hasLiveGames, doRefresh]);

  if (!hasLiveGames) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-success mb-4">
      <Radio size={12} className="animate-pulse" />
      <span>Live — auto-refreshing</span>
      <button
        onClick={doRefresh}
        className="text-text-secondary hover:text-accent transition-colors underline decoration-dashed"
      >
        refresh now
      </button>
      <span className="text-text-secondary tabular-nums">({countdown}s)</span>
    </div>
  );
}

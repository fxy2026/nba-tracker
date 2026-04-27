"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Radio } from "lucide-react";

export default function LiveScoreRefresher({ hasLiveGames }: { hasLiveGames: boolean }) {
  const router = useRouter();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    if (!hasLiveGames) return;

    const interval = setInterval(() => {
      router.refresh();
      setLastRefresh(new Date());
    }, 30000); // Refresh every 30s

    return () => clearInterval(interval);
  }, [hasLiveGames, router]);

  if (!hasLiveGames) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-success mb-4">
      <Radio size={12} className="animate-pulse" />
      <span>Live — auto-refreshing every 30s</span>
      <span className="text-text-secondary ml-1">
        (last: {lastRefresh.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })})
      </span>
    </div>
  );
}

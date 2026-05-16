"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Radio } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

const INTERVAL = 15;

export default function GameAutoRefresh({ isLive }: { isLive: boolean }) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(INTERVAL);
  const { t } = useLocale();

  useEffect(() => {
    if (!isLive) return;
    let remaining = INTERVAL;

    const tick = setInterval(() => {
      remaining--;
      setCountdown(remaining);
      if (remaining <= 0) {
        if (typeof navigator === "undefined" || navigator.onLine !== false) {
          router.refresh();
        }
        remaining = INTERVAL;
        setCountdown(remaining);
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [isLive, router]);

  if (!isLive) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-success mb-3 mt-2">
      <Radio size={12} className="animate-pulse" />
      <span>{t.liveScore.autoRefreshing}</span>
      <span className="text-text-secondary tabular-nums">({countdown}s)</span>
    </div>
  );
}

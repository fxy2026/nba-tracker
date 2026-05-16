"use client";

import { useEffect, useState, memo } from "react";
import { Clock } from "lucide-react";

export default memo(function GameCountdown({ gameTimeUTC }: { gameTimeUTC: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const target = new Date(gameTimeUTC).getTime();
      const diff = target - now;
      if (diff <= 0) { setTimeLeft(""); return; }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      if (days > 0) setTimeLeft(`${days}d ${hours}h`);
      else if (hours > 0) setTimeLeft(`${hours}h ${minutes}m`);
      else setTimeLeft(`${minutes}m`);
    };
    update();

    let interval: ReturnType<typeof setInterval> | null = setInterval(update, 60000);

    const handleVisibility = () => {
      if (document.hidden) {
        if (interval) { clearInterval(interval); interval = null; }
      } else {
        update();
        if (!interval) interval = setInterval(update, 60000);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [gameTimeUTC]);

  if (!timeLeft) return null;

  return (
    <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.15em] text-accent-amber bg-accent-amber/10 px-2 py-0.5 rounded-full border border-accent-amber/30">
      <Clock size={10} />
      <span className="tabular-nums font-bold">{timeLeft}</span>
    </span>
  );
});

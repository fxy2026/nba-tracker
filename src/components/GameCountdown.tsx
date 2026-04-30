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
      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${minutes}m`);
      }
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [gameTimeUTC]);

  if (!timeLeft) return null;

  return (
    <span className="flex items-center gap-1 text-[10px] text-accent">
      <Clock size={10} />
      <span className="tabular-nums">{timeLeft}</span>
    </span>
  );
});

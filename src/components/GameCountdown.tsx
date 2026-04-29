"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export default function GameCountdown({ gameTimeUTC }: { gameTimeUTC: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const target = new Date(gameTimeUTC).getTime();
      const diff = target - now;
      if (diff <= 0) { setTimeLeft(""); return; }
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      if (hours > 0) {
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
      {timeLeft}
    </span>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Radio } from "lucide-react";

export default function GameAutoRefresh({ isLive }: { isLive: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(interval);
  }, [isLive, router]);

  if (!isLive) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-success mb-3 mt-2">
      <Radio size={12} className="animate-pulse" />
      <span>LIVE — auto-refreshing every 15s</span>
    </div>
  );
}

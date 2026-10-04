"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { formatCacheAge, formatRelative } from "@/lib/dates";

interface UpdatedPillProps {
  ageMs: number | null;
  meaning?: "source" | "cache";
}

// Live-updating "X mins ago" badge. Re-renders every 30s so the displayed
// elapsed time stays approximately current without forcing a page reload.
export default function UpdatedPill({ ageMs, meaning = "source" }: UpdatedPillProps) {
  const { locale } = useLocale();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (ageMs === null) return null;
  // ageMs grows with wall clock; add elapsed since mount via `tick`.
  const total = ageMs + tick * 30_000;
  const isZh = locale === "zh";
  const label = meaning === "cache" ? formatCacheAge(total, locale) : formatRelative(total, locale, "freshness");

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary/70"
      title={meaning === "cache" ? (isZh ? "距服务器载入赛程缓存的时间，并非 NBA 来源的更新时间。" : "Time since the server loaded its schedule cache, not when the NBA source was updated.") : (isZh ? "数据更新时间" : "Data freshness")}
    >
      <Clock size={10} aria-hidden="true" />
      <span>{meaning === "cache" ? (isZh ? "赛程缓存载入于 " : "Schedule cache loaded ") : ""}{label}</span>
    </span>
  );
}

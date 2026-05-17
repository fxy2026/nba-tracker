"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

interface UpdatedPillProps {
  ageMs: number | null;
}

// Live-updating "X mins ago" badge. Re-renders every 30s so the displayed
// freshness stays approximately current without forcing a page reload.
export default function UpdatedPill({ ageMs }: UpdatedPillProps) {
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

  let label: string;
  if (total < 60_000) label = isZh ? "刚刚更新" : "Just now";
  else if (total < 60 * 60_000) {
    const m = Math.floor(total / 60_000);
    label = isZh ? `${m} 分钟前` : `${m}m ago`;
  } else if (total < 24 * 60 * 60_000) {
    const h = Math.floor(total / (60 * 60_000));
    label = isZh ? `${h} 小时前` : `${h}h ago`;
  } else {
    label = isZh ? "数据较旧" : "Stale";
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary/70"
      title={isZh ? "数据更新时间" : "Data freshness"}
    >
      <Clock size={10} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

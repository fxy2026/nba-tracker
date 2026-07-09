"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { formatRelative } from "@/lib/dates";

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
  const label = formatRelative(total, locale, "freshness");

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

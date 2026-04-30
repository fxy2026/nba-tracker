"use client";

import Link from "next/link";
import { useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DateNavProps {
  selectedDate: string;
}

function offsetDate(base: string, offset: number): string {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}

export default function DateNav({ selectedDate }: DateNavProps) {
  const router = useRouter();

  // Keyboard navigation: left/right arrows
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); router.push(`/?date=${offsetDate(selectedDate, -1)}`); }
      if (e.key === "ArrowRight") { e.preventDefault(); router.push(`/?date=${offsetDate(selectedDate, 1)}`); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedDate, router]);

  // Mobile swipe navigation
  const touchStart = useRef<number | null>(null);
  const handleSwipe = useCallback((dir: number) => {
    router.push(`/?date=${offsetDate(selectedDate, dir)}`);
  }, [selectedDate, router]);

  useEffect(() => {
    const el = document.getElementById("main-content");
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => { touchStart.current = e.touches[0].clientX; };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchStart.current === null) return;
      const diff = e.changedTouches[0].clientX - touchStart.current;
      touchStart.current = null;
      if (Math.abs(diff) > 80) handleSwipe(diff > 0 ? -1 : 1);
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => { el.removeEventListener("touchstart", onTouchStart); el.removeEventListener("touchend", onTouchEnd); };
  }, [handleSwipe]);

  // Memoize the 7-day array — only recomputes when selectedDate changes
  const days = useMemo(() => {
    const result: { date: string; label: string; weekday: string }[] = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(selectedDate + "T12:00:00");
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      result.push({
        date: dateStr,
        label: d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }),
        weekday: d.toLocaleDateString("zh-CN", { weekday: "short" }),
      });
    }
    return result;
  }, [selectedDate]);

  const today = useMemo(() => new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()), []);

  const prevDate = offsetDate(selectedDate, -1);
  const nextDate = offsetDate(selectedDate, 1);

  return (
    <div className="flex items-center justify-center gap-1" role="navigation" aria-label="Date navigation">
      <Link
        href={`/?date=${prevDate}`}
        className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        aria-label="Previous day"
      >
        <ChevronLeft size={20} />
      </Link>

      <div className="flex gap-1 overflow-x-auto scrollbar-hide scroll-snap-x">
        {days.map((day) => {
          const isSelected = day.date === selectedDate;
          const isToday = day.date === today;
          return (
            <Link
              key={day.date}
              href={`/?date=${day.date}`}
              aria-current={isSelected ? "date" : undefined}
              className={`flex flex-col items-center px-3 py-2 rounded-lg text-xs font-medium transition-colors min-w-[56px] ${
                isSelected
                  ? "bg-accent text-white"
                  : isToday
                  ? "bg-accent/15 text-accent hover:bg-accent/25"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <span>{day.weekday}</span>
              <span className="text-sm mt-0.5">{day.label}</span>
            </Link>
          );
        })}
      </div>

      <Link
        href={`/?date=${nextDate}`}
        className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        aria-label="Next day"
      >
        <ChevronRight size={20} />
      </Link>

      {selectedDate !== today && (
        <Link
          href={`/?date=${today}`}
          className="ml-2 px-3 py-1.5 text-xs bg-bg-card border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-accent/50 transition-colors"
        >
          今天
        </Link>
      )}
    </div>
  );
}

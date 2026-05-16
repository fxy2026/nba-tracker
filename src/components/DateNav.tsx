"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

interface DateNavProps {
  selectedDate: string;
  onDateChange?: (date: string) => void;
}

function offsetDate(base: string, offset: number): string {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}

export default function DateNav({ selectedDate, onDateChange }: DateNavProps) {
  const { t } = useLocale();
  const router = useRouter();

  const navigate = useCallback((date: string) => {
    if (onDateChange) {
      onDateChange(date);
    }
    // Update URL without full page reload — shallow push
    router.push(`/?date=${date}`, { scroll: false });
  }, [onDateChange, router]);

  // Keyboard navigation: left/right arrows
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); navigate(offsetDate(selectedDate, -1)); }
      if (e.key === "ArrowRight") { e.preventDefault(); navigate(offsetDate(selectedDate, 1)); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedDate, navigate]);

  // Mobile swipe navigation
  const touchStart = useRef<number | null>(null);
  useEffect(() => {
    const el = document.getElementById("main-content");
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => { touchStart.current = e.touches[0].clientX; };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchStart.current === null) return;
      const diff = e.changedTouches[0].clientX - touchStart.current;
      touchStart.current = null;
      if (Math.abs(diff) > 80) navigate(offsetDate(selectedDate, diff > 0 ? -1 : 1));
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => { el.removeEventListener("touchstart", onTouchStart); el.removeEventListener("touchend", onTouchEnd); };
  }, [selectedDate, navigate]);

  // Memoize the 7-day array
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
      <button
        onClick={() => navigate(prevDate)}
        className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        aria-label="Previous day"
      >
        <ChevronLeft size={20} />
      </button>

      <div className="flex gap-1 overflow-x-auto scrollbar-hide scroll-snap-x">
        {days.map((day) => {
          const isSelected = day.date === selectedDate;
          const isToday = day.date === today;
          return (
            <button
              key={day.date}
              onClick={() => navigate(day.date)}
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
            </button>
          );
        })}
      </div>

      <button
        onClick={() => navigate(nextDate)}
        className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        aria-label="Next day"
      >
        <ChevronRight size={20} />
      </button>

      {selectedDate !== today && (
        <button
          onClick={() => navigate(today)}
          className="ml-2 px-3 py-1.5 text-xs bg-bg-card border border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-accent/50 transition-colors"
        >
          {t.dateNav.today}
        </button>
      )}
    </div>
  );
}

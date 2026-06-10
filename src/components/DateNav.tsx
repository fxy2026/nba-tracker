"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { localToday, localTz } from "@/lib/timezone";

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
  const { t, locale } = useLocale();
  const router = useRouter();

  // Timezone caption: localTz() reads Intl at runtime, so it can differ between
  // SSR and client. Defer to a post-mount flag to avoid a hydration mismatch on
  // this display-only label; the chip row itself renders unchanged on the server.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot post-hydration flag: localTz() is unknowable during SSR
  useEffect(() => setMounted(true), []);
  const tzLabel = useMemo(() => {
    const tz = localTz();
    if (tz === "Asia/Shanghai" || tz === "Asia/Hong_Kong" || tz === "Asia/Macau") {
      return t.common.beijingTime;
    }
    const short = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
      timeZoneName: "short",
      timeZone: tz,
    })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value;
    return short ? `${t.dateNav.localTimeZone} ${short}` : t.dateNav.localTimeZone;
  }, [locale, t]);

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
      // Modifier combos (Alt+Left = browser Back) must reach the browser
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.target instanceof HTMLElement && (e.target.isContentEditable || e.target.closest('[role="dialog"]'))) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); navigate(offsetDate(selectedDate, -1)); }
      if (e.key === "ArrowRight") { e.preventDefault(); navigate(offsetDate(selectedDate, 1)); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedDate, navigate]);

  // Mobile swipe navigation
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  useEffect(() => {
    const el = document.getElementById("main-content");
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const diff = e.changedTouches[0].clientX - touchStartX.current;
      const diffY = e.changedTouches[0].clientY - touchStartY.current;
      touchStartX.current = null;
      touchStartY.current = null;
      // Only trigger date change on mostly-horizontal swipes (Y delta < 50px)
      // so vertical scrolls don't accidentally navigate.
      if (Math.abs(diff) > 80 && Math.abs(diffY) < 50) {
        navigate(offsetDate(selectedDate, diff > 0 ? -1 : 1));
      }
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

  // Local timezone "today" — for a Beijing user, this is YYYY-MM-DD in Beijing
  // time, matching the timezone-aware grouping in /api/games and /api/calendar.
  const today = useMemo(() => localToday(), []);

  const prevDate = offsetDate(selectedDate, -1);
  const nextDate = offsetDate(selectedDate, 1);

  return (
    <div
      className="sticky top-[calc(env(safe-area-inset-top)+3rem)] sm:top-[calc(env(safe-area-inset-top)+4rem)] z-30 flex items-center justify-center gap-1 -mx-4 px-4 py-2 bg-bg-primary border-b border-border/60"
      role="navigation"
      aria-label="Date navigation"
    >
      <button
        onClick={() => navigate(prevDate)}
        className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
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
              className={`flex flex-col items-center px-3 py-2 rounded-lg text-xs font-medium transition-all min-w-[56px] cursor-pointer relative ${
                isSelected
                  ? "bg-accent-gradient text-white shadow-md shadow-accent/30"
                  : isToday
                  ? "bg-accent/10 text-accent hover:bg-accent/20"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <span className="font-mono uppercase tracking-[0.1em] text-[10px]">{day.weekday}</span>
              <span className="text-sm mt-0.5 font-mono tabular-nums">{day.label}</span>
              {isToday && !isSelected && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent-amber" />
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => navigate(nextDate)}
        className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Next day"
      >
        <ChevronRight size={20} />
      </button>

      {selectedDate !== today && (
        <button
          onClick={() => navigate(today)}
          className="ml-2 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.15em] glass-tile text-text-secondary hover:text-accent transition-colors cursor-pointer"
        >
          {t.dateNav.today}
        </button>
      )}

      {/* Which timezone the date chips are grouped by — removes "is this last
          night or tonight?" ambiguity for non-ET (e.g. Beijing) users. */}
      {mounted && (
        <span
          aria-hidden
          className="shrink-0 ml-2 text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60 hidden sm:inline"
        >
          {tzLabel}
        </span>
      )}
    </div>
  );
}

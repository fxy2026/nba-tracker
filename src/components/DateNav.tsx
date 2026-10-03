"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { offsetCalendarDate, calendarDateLabels } from "@/lib/calendar-date";
import { homeDateUrl } from "@/lib/date-navigation";
import { dateInTz, localTz } from "@/lib/timezone";

interface DateNavProps {
  selectedDate: string;
  timeZone?: string;
  onDateChange?: (date: string) => void;
}

// Sentinel that no real "YYYY-MM-DD" can equal — used pre-mount so the
// tz-dependent "today" highlight stays absent until hydration (avoids a mismatch).
const NO_TODAY = "";


export default function DateNav({ selectedDate, onDateChange, timeZone }: DateNavProps) {
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const router = useRouter();
  const navRef = useRef<HTMLDivElement>(null);

  // Timezone caption: localTz() reads Intl at runtime, so it can differ between
  // SSR and client. Defer to a post-mount flag to avoid a hydration mismatch on
  // this display-only label; the chip row itself renders unchanged on the server.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot post-hydration flag: localTz() is unknowable during SSR
  useEffect(() => setMounted(true), []);
  const tzLabel = useMemo(() => {
    const tz = timeZone ?? localTz();
    if (tz === "Asia/Shanghai" || tz === "Asia/Hong_Kong" || tz === "Asia/Macau") {
      return t.common.beijingTime;
    }
    const short = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
      timeZoneName: "short",
      timeZone: tz,
    })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value;
    return timeZone ? `${isZh ? "日期时区" : "Date timezone"}: ${timeZone} (${short ?? timeZone})` : short ? `${t.dateNav.localTimeZone} ${short}` : t.dateNav.localTimeZone;
  }, [locale, t, timeZone, isZh]);

  const navigate = useCallback((date: string) => {
    if (onDateChange) {
      onDateChange(date);
    }
    // Update URL without full page reload — shallow push
    router.push(homeDateUrl(date, timeZone), { scroll: false });
  }, [onDateChange, router, timeZone]);

  // Keyboard navigation: left/right arrows
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Modifier combos (Alt+Left = browser Back) must reach the browser
      if (e.defaultPrevented || e.isComposing || e.keyCode === 229 || e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.target instanceof HTMLElement) {
        if (e.target.isContentEditable || e.target.closest('[role="dialog"], [role="combobox"], [role="slider"]')) return;
        if (e.target.closest('button, a') && !navRef.current?.contains(e.target)) return;
      }
      if (e.key === "ArrowLeft") { e.preventDefault(); navigate(offsetCalendarDate(selectedDate, -1)); }
      if (e.key === "ArrowRight") { e.preventDefault(); navigate(offsetCalendarDate(selectedDate, 1)); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedDate, navigate]);

  const daysRef = useRef<HTMLDivElement>(null);
  // Center the active day within this scroller only; do not scroll the page.
  useEffect(() => {
    const row = daysRef.current;
    const selected = row?.querySelector<HTMLElement>('[aria-current="date"]');
    if (!row || !selected) return;
    const center = () => { row.scrollLeft = selected.offsetLeft - (row.clientWidth - selected.offsetWidth) / 2; };
    center();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(center);
    observer?.observe(row);
    return () => observer?.disconnect();
  }, [selectedDate, mounted, locale]);

  // Memoize the 7-day array
  const days = useMemo(() => {
    const result: { date: string; label: string; weekday: string }[] = [];
    for (let i = -3; i <= 3; i++) {
      const date = offsetCalendarDate(selectedDate, i);
      result.push({ date, ...calendarDateLabels(date, isZh ? "zh-CN" : "en-US") });
    }
    return result;
  }, [selectedDate, isZh]);

  // Local timezone "today" — for a Beijing user, this is YYYY-MM-DD in Beijing
  // time, matching the timezone-aware grouping in /api/games and /api/calendar.
  // localToday() reads Intl at runtime (UTC on the server, browser tz on the
  // client), so it's only safe to compare against post-mount; pre-mount we use a
  // sentinel that matches no date, keeping the chip highlight + reset chip absent
  // on first paint to match the server HTML.
  const today = useMemo(() => (mounted ? dateInTz(new Date(), timeZone ?? localTz()) : NO_TODAY), [mounted, timeZone]);

  const prevDate = offsetCalendarDate(selectedDate, -1);
  const nextDate = offsetCalendarDate(selectedDate, 1);

  return (
    <div
      ref={navRef}
      className="sticky site-sticky-offset z-30 flex items-center justify-center gap-1 -mx-4 px-4 py-2 bg-bg-primary border-b border-border/60"
      role="navigation"
      aria-label={isZh ? "日期导航" : "Date navigation"}
    >
      <button
        onClick={() => navigate(prevDate)}
        className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label={isZh ? "前一天" : "Previous day"}
      >
        <ChevronLeft size={20} />
      </button>

      <div ref={daysRef} className="relative flex min-w-0 gap-1 overflow-x-auto overscroll-x-contain scrollbar-hide scroll-snap-x">
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
        className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label={isZh ? "后一天" : "Next day"}
      >
        <ChevronRight size={20} />
      </button>

      {today && selectedDate !== today && (
        <button
          onClick={() => navigate(today)}
          className="shrink-0 min-h-11 px-2 sm:ml-2 sm:px-3 py-1.5 text-xs sm:text-[10px] font-mono uppercase tracking-[0.15em] glass-tile text-text-secondary hover:text-accent transition-colors cursor-pointer"
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

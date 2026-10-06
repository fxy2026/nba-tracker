"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import DateNav from "./DateNav";
import FollowStrip from "./FollowStrip";
import GamesList from "./GamesList";
import HomeExtra from "./HomeExtra";
import SeasonProgress from "./SeasonProgress";
import StandingsMini from "./StandingsMini";
import RecentlyViewed from "./RecentlyViewed";
import { useLocale } from "@/components/LocaleProvider";
import { localTz as getLocalTz, dateInTz } from "@/lib/timezone";
import { offsetCalendarDate } from "@/lib/calendar-date";
import { explicitTimeZone, homeDateUrl } from "@/lib/date-navigation";
import { selectedDateFromUrl } from "@/lib/schedule-navigation";
import { observeLocalDay, type LocalDay } from "@/lib/local-day-clock";
import type { ScheduleGame } from "@/lib/nba-contracts";

interface HomeClientProps {
  initialDate: string;
  initialGames?: ScheduleGame[];
  // Server-rendered supplemental content stays after the selected games.
  afterGames?: ReactNode;
  // Whether initialDate was the server's ET-today. Used as the server-stable
  // first-paint value for isToday so the SSR HTML and the client's pre-effect
  // render agree (the real local-tz "today" is unknowable until mount).
  initialIsToday: boolean;
}

export default function HomeClient({ initialDate, initialGames, initialIsToday, afterGames }: HomeClientProps) {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const explicitDate = searchParams.get("date");
  const chosenTimeZone = explicitTimeZone(searchParams.get("tz"));
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [localDay, setLocalDay] = useState<LocalDay | null>(null);
  // An explicit date, including a clicked Today chip, is a pinned calendar
  // view. Only the undated URL (or its existing invalid-date fallback) follows
  // the clock. The ref also protects a click before router.push has committed.
  const followsToday = useRef(!selectedDateFromUrl(explicitDate, ""));
  const selectDate = useCallback((date: string) => {
    followsToday.current = false;
    setSelectedDate(date);
  }, [setSelectedDate]);
  // localTz() reads Intl at runtime → unknowable during SSR (server resolves to
  // UTC, client to the browser tz). Gate every tz-dependent branch behind this
  // post-mount flag so server HTML and the client's first paint agree; otherwise
  // an ET viewer in the prime NBA window (e.g. 9pm ET = next-day UTC) gets a
  // hydration mismatch that discards the warm SSR'd scoreboard.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot post-hydration flag: local tz is unknowable during SSR
  useEffect(() => setMounted(true), []);

  // The server seed describes an ET day, not an implicit browser-local day.
  // Preserve that identity through the first hydration render, then remount
  // GamesList if the browser's real zone differs, even for the same date string.
  const gamesTimeZone = chosenTimeZone ?? (mounted ? localDay?.timeZone ?? getLocalTz() : "America/New_York");

  // Keep explicit date links and browser Back/Forward in sync. A bare Home URL
  // resolves to local today only after mount, preserving the SSR first paint.
  useEffect(() => {
    followsToday.current = !selectedDateFromUrl(explicitDate, "");
    const nextDate = selectedDateFromUrl(explicitDate, dateInTz(new Date(), chosenTimeZone ?? getLocalTz()));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync controlled date from navigation after hydration
    setSelectedDate(nextDate);
  }, [explicitDate, chosenTimeZone]);

  useEffect(() => observeLocalDay(chosenTimeZone, day => {
    setLocalDay(previous => previous?.date === day.date && previous.timeZone === day.timeZone ? previous : day);
    if (followsToday.current) setSelectedDate(day.date);
  }), [chosenTimeZone]);

  // Server-stable on first paint (uses the server's own isToday verdict), then
  // switch to the real local tz post-mount so the snap-to-local-today correction
  // and a tz-shifted user's true "today" are honored.
  const today = mounted
    ? localDay?.timeZone === gamesTimeZone ? localDay.date : dateInTz(new Date(), gamesTimeZone)
    : "";
  const isToday = mounted ? selectedDate === today : initialIsToday;
  const yesterdayDate = mounted && isToday ? offsetCalendarDate(selectedDate, -1) : null;

  return (
    <>
      <DateNav timeZone={chosenTimeZone} todayDate={today} selectedDate={selectedDate} onDateChange={selectDate} />
      {/* Personalized "Following" strip — renders nothing for users without
          followed teams, so the scoreboard stays at the top for everyone else. */}
      <FollowStrip />
      {yesterdayDate && (
        <div className="mt-2 mb-1">
          {/* The single most common morning action for a tz-shifted audience —
              "show me last night's finals" — promoted from a footnote link to a
              prominent glass-tile pill matching the DateNav "Today" reset chip. */}
          <button
            onClick={() => { selectDate(yesterdayDate); router.push(homeDateUrl(yesterdayDate, chosenTimeZone), { scroll: false }); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 glass-tile text-xs font-medium text-text-primary hover:border-accent/50 hover:text-accent transition-colors cursor-pointer"
          >
            <ChevronLeft size={14} className="shrink-0" />
            {t.home.yesterdayResults}
            <span className="text-text-secondary font-mono tabular-nums">{yesterdayDate}</span>
          </button>
        </div>
      )}
      {/* A non-ET browser needs the complete local day, which can overlap two
          ET days. Filtering this seed alone cannot establish that coverage. */}
      <GamesList
        key={gamesTimeZone}
        timeZone={chosenTimeZone}
        selectedDate={selectedDate}
        initialGames={gamesTimeZone === "America/New_York" && selectedDate === initialDate ? initialGames : undefined}
        readyToFetch={mounted}
        isToday={isToday}
      />

      {/* Date-independent extras keep their viewport gate and request state
          while GamesList loads a new date or remounts for a timezone change. */}
      <HomeExtra />

      {afterGames}

      {/* User's recent visits — only renders when localStorage has data */}
      <RecentlyViewed />

      {/* Bottom rail — Standings + Season Progress side-by-side */}
      <div className="mt-10 mb-4">
        <div className="mb-3">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ 02</p>
          <h2 className="text-base font-semibold text-text-primary tracking-tight">League Pulse</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <StandingsMini />
          </div>
          <SeasonProgress />
        </div>
      </div>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import DateNav from "./DateNav";
import GamesList from "./GamesList";
import SeasonProgress from "./SeasonProgress";
import StandingsMini from "./StandingsMini";
import RecentlyViewed from "./RecentlyViewed";
import { useLocale } from "@/components/LocaleProvider";
import { localTz as getLocalTz, dateInTz } from "@/lib/timezone";
import type { ScheduleGame } from "@/lib/api";

interface HomeClientProps {
  initialDate: string;
  initialGames?: ScheduleGame[];
  // Whether initialDate was the server's ET-today. Used as the server-stable
  // first-paint value for isToday so the SSR HTML and the client's pre-effect
  // render agree (the real local-tz "today" is unknowable until mount).
  initialIsToday: boolean;
}

export default function HomeClient({ initialDate, initialGames, initialIsToday }: HomeClientProps) {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  // localTz() reads Intl at runtime → unknowable during SSR (server resolves to
  // UTC, client to the browser tz). Gate every tz-dependent branch behind this
  // post-mount flag so server HTML and the client's first paint agree; otherwise
  // an ET viewer in the prime NBA window (e.g. 9pm ET = next-day UTC) gets a
  // hydration mismatch that discards the warm SSR'd scoreboard.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot post-hydration flag: local tz is unknowable during SSR
  useEffect(() => setMounted(true), []);

  // On mount, if the URL has no explicit ?date and the server-rendered initial
  // (ET-today) differs from the user's local "today", jump to local today.
  useEffect(() => {
    if (searchParams.get("date")) return;
    const localToday = dateInTz(new Date(), getLocalTz());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot client correction: local tz is unknowable during SSR
    if (localToday !== initialDate) setSelectedDate(localToday);
  // Run once on mount — searchParams updating shouldn't re-snap to "today".
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Server-stable on first paint (uses the server's own isToday verdict), then
  // switch to the real local tz post-mount so the snap-to-local-today correction
  // and a tz-shifted user's true "today" are honored.
  const isToday = mounted
    ? selectedDate === dateInTz(new Date(), getLocalTz())
    : initialIsToday;

  return (
    <>
      <DateNav selectedDate={selectedDate} onDateChange={setSelectedDate} />
      {mounted && isToday && (() => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = dateInTz(yesterday, getLocalTz());
        return (
          <div className="mt-2 mb-1">
            {/* The single most common morning action for a tz-shifted audience —
                "show me last night's finals" — promoted from a footnote link to a
                prominent glass-tile pill matching the DateNav "Today" reset chip. */}
            <button
              onClick={() => setSelectedDate(yStr)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 glass-tile text-xs font-medium text-text-primary hover:border-accent/50 hover:text-accent transition-colors cursor-pointer"
            >
              <ChevronLeft size={14} className="shrink-0" />
              {t.home.yesterdayResults}
              <span className="text-text-secondary font-mono tabular-nums">{yStr}</span>
            </button>
          </div>
        );
      })()}
      {/* SSR'd games only apply to the server-rendered date. If the client
          tz-correction snapped to a different local "today", GamesList falls
          back to its own fetch for the new date. */}
      <GamesList
        selectedDate={selectedDate}
        initialGames={selectedDate === initialDate ? initialGames : undefined}
        isToday={isToday}
      />

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

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DateNav from "./DateNav";
import GamesList from "./GamesList";
import SeasonProgress from "./SeasonProgress";
import StandingsMini from "./StandingsMini";
import { useLocale } from "@/components/LocaleProvider";
import { localTz as getLocalTz, dateInTz } from "@/lib/timezone";

interface HomeClientProps {
  initialDate: string;
}

export default function HomeClient({ initialDate }: HomeClientProps) {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(initialDate);

  // On mount, if the URL has no explicit ?date and the server-rendered initial
  // (ET-today) differs from the user's local "today", jump to local today.
  useEffect(() => {
    if (searchParams.get("date")) return;
    const localToday = dateInTz(new Date(), getLocalTz());
    if (localToday !== initialDate) setSelectedDate(localToday);
  // Run once on mount — searchParams updating shouldn't re-snap to "today".
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = dateInTz(new Date(), getLocalTz());
  const isToday = selectedDate === today;

  return (
    <>
      <DateNav selectedDate={selectedDate} onDateChange={setSelectedDate} />
      {isToday && (() => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = dateInTz(yesterday, getLocalTz());
        return (
          <div className="mt-1 mb-1">
            <button onClick={() => setSelectedDate(yStr)} className="text-xs text-text-secondary hover:text-accent transition-colors cursor-pointer">
              {t.home.yesterdayLink}{yStr})
            </button>
          </div>
        );
      })()}
      <GamesList selectedDate={selectedDate} />

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

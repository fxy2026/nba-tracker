"use client";

import { useState } from "react";
import DateNav from "./DateNav";
import GamesList from "./GamesList";
import SeasonProgress from "./SeasonProgress";
import StandingsMini from "./StandingsMini";
import { formatDate } from "@/lib/api";
import { useLocale } from "@/components/LocaleProvider";

interface HomeClientProps {
  initialDate: string;
}

export default function HomeClient({ initialDate }: HomeClientProps) {
  const { t } = useLocale();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const today = formatDate(new Date());
  const isToday = selectedDate === today;

  return (
    <>
      <DateNav selectedDate={selectedDate} onDateChange={setSelectedDate} />
      {isToday && (() => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = formatDate(yesterday);
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

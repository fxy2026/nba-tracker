"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import DateNav from "./DateNav";
import GamesList from "./GamesList";
import SeasonProgress from "./SeasonProgress";
import StandingsMini from "./StandingsMini";
import { formatDate } from "@/lib/api";

interface HomeClientProps {
  initialDate: string;
}

export default function HomeClient({ initialDate }: HomeClientProps) {
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
            <button onClick={() => setSelectedDate(yStr)} className="text-xs text-text-secondary hover:text-accent transition-colors">
              &larr; Yesterday&apos;s Results ({yStr})
            </button>
          </div>
        );
      })()}
      <SeasonProgress />
      <StandingsMini />
      <GamesList selectedDate={selectedDate} />
    </>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarGame {
  gameId: string;
  homeTricode: string;
  awayTricode: string;
  gameStatus: number;
  homeScore: number;
  awayScore: number;
}

interface CalendarDay {
  date: string;
  gameCount: number;
  games: CalendarGame[];
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getMonthStr(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);

  const today = getTodayStr();

  const fetchMonth = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar?month=${getMonthStr(y, m)}`);
      if (res.ok) {
        const json = await res.json();
        setDays(json.data || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    setTimeout(() => fetchMonth(year, month), 0);
  }, [year, month, fetchMonth]);

  const goToPrevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
  };

  const goToNextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
  };

  // Build calendar grid
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dayMap = new Map<string, CalendarDay>();
  for (const d of days) {
    dayMap.set(d.date, d);
  }

  const cells: { day: number | null; date: string | null; calDay: CalendarDay | null }[] = [];
  // Leading empty cells
  for (let i = 0; i < firstDayOfMonth; i++) {
    cells.push({ day: null, date: null, calDay: null });
  }
  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, date: dateStr, calDay: dayMap.get(dateStr) || null });
  }

  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Season Calendar</h1>
        <div className="flex items-center gap-3">
          <button onClick={goToPrevMonth} className="p-2 rounded-lg bg-bg-card border border-border hover:bg-bg-hover transition-colors">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium min-w-[140px] text-center">{monthLabel}</span>
          <button onClick={goToNextMonth} className="p-2 rounded-lg bg-bg-card border border-border hover:bg-bg-hover transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Month Summary */}
      {!loading && days.length > 0 && (
        <div className="flex items-center gap-4 mb-4 text-xs text-text-secondary">
          <span>{days.reduce((s, d) => s + d.gameCount, 0)} games this month</span>
          <span>{days.filter((d) => d.gameCount > 0).length} game days</span>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAYS_OF_WEEK.map((d) => (
            <div key={d} className="text-center py-2.5 text-xs font-medium text-text-secondary">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        {loading ? (
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="border-b border-r border-border/50 p-2 h-20 animate-pulse">
                <div className="h-4 w-4 rounded bg-bg-hover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              const isToday = cell.date === today;
              const hasGames = cell.calDay && cell.calDay.gameCount > 0;
              return (
                <div
                  key={i}
                  className={`border-b border-r border-border/50 p-2 min-h-[80px] transition-colors ${
                    cell.day ? "cursor-pointer hover:bg-bg-hover" : ""
                  } ${isToday ? "bg-accent/10" : hasGames ? (cell.calDay!.gameCount >= 8 ? "bg-green-500/15" : cell.calDay!.gameCount >= 4 ? "bg-green-500/10" : "bg-green-500/5") : ""}`}
                  onClick={() => {
                    if (cell.date) router.push(`/?date=${cell.date}`);
                  }}
                >
                  {cell.day && (
                    <>
                      <span className={`text-xs font-medium ${isToday ? "text-accent font-bold" : "text-text-primary"}`}>
                        {cell.day}
                      </span>
                      {hasGames && (
                        <div className="mt-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-medium">
                            {cell.calDay!.gameCount} {cell.calDay!.gameCount === 1 ? "game" : "games"}
                          </span>
                          <div className="mt-1 space-y-0.5">
                            {cell.calDay!.games.slice(0, 2).map((g) => (
                              <div key={g.gameId} className="text-[9px] text-text-secondary truncate">
                                {g.awayTricode} @ {g.homeTricode}
                                {g.gameStatus === 3 && (
                                  <span className={`ml-1 font-medium ${g.awayScore > g.homeScore ? "text-text-secondary" : "text-text-secondary"}`}>
                                    {g.awayScore}-{g.homeScore}
                                  </span>
                                )}
                                {g.gameStatus === 3 && (
                                  <span className={`ml-0.5 font-bold ${g.homeScore > g.awayScore ? "text-success" : "text-danger"}`}>
                                    {g.homeScore > g.awayScore ? "W" : "L"}
                                  </span>
                                )}
                              </div>
                            ))}
                            {cell.calDay!.games.length > 2 && (
                              <div className="text-[9px] text-text-secondary/60">
                                +{cell.calDay!.games.length - 2} more
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

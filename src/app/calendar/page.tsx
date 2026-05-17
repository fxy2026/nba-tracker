"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";
import { ChevronLeft, ChevronRight, CalendarDays, ListOrdered, Calendar, Repeat, Crown } from "lucide-react";
import { CURRENT_SEASON } from "@/lib/constants";
import Image from "next/image";
import { TEAM_META } from "@/lib/teams";
import { useLocale } from "@/components/LocaleProvider";
import { teamLogoUrl } from "@/lib/teamUrls";
import { localTz } from "@/lib/timezone";

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

function getMonthStr(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

// Resolve "today" + current month in the user's local timezone. The calendar
// API groups games by this same timezone, so dates always line up with what
// the user actually experienced (e.g. a NBA game on ET May 15 evening shows
// on the May 16 cell for a Beijing user — that's when it was played there).
function getLocalParts(tz: string): { year: number; month: number; day: number; todayStr: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const m = parseInt(parts.find((p) => p.type === "month")!.value, 10);
  const d = parseInt(parts.find((p) => p.type === "day")!.value, 10);
  return {
    year: y,
    month: m - 1,
    day: d,
    todayStr: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
  };
}

export default function CalendarPage() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const tz = localTz();
  const et = getLocalParts(tz);
  const [year, setYear] = useState(et.year);
  const [month, setMonth] = useState(et.month); // 0-indexed (local tz)
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);

  const today = et.todayStr;

  const DAYS_OF_WEEK = [
    t.calendarPage.sun,
    t.calendarPage.mon,
    t.calendarPage.tue,
    t.calendarPage.wed,
    t.calendarPage.thu,
    t.calendarPage.fri,
    t.calendarPage.sat,
  ];

  // Data fetch with loading reset on dep change. Initial render already has loading=true,
  // so the setLoading(true) only fires on subsequent month changes (intentional).
  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/calendar?month=${getMonthStr(year, month)}&tz=${encodeURIComponent(tz)}`, { signal: controller.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { if (json && !controller.signal.aborted) setDays(json.data || []); })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [year, month, tz]);

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
      <Breadcrumbs
        items={[
          { label: isZh ? "赛程" : "Schedule" },
          { label: isZh ? "赛季日历" : "Season calendar" },
        ]}
      />
      {/* Header */}
      <PageHeader
        eyebrow={`${CURRENT_SEASON} ${t.calendarPage.nbaSeason}`}
        icon={CalendarDays}
        title={t.calendarPage.seasonCalendar}
        action={
          <div className="flex items-center gap-2">
            <button onClick={goToPrevMonth} className="p-2 rounded-lg glass-tile hover:bg-bg-hover transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center">
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium font-mono tabular-nums min-w-[140px] text-center">{monthLabel}</span>
            <button onClick={goToNextMonth} className="p-2 rounded-lg glass-tile hover:bg-bg-hover transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center">
              <ChevronRight size={18} />
            </button>
            {(year !== et.year || month !== et.month) && (
              <button
                onClick={() => { setYear(et.year); setMonth(et.month); }}
                className="chip chip-active cursor-pointer"
              >
                {t.common.today}
              </button>
            )}
          </div>
        }
      />
      {/* Season Phase Label */}
      {(() => {
        // Approximate NBA season phases based on month
        const m = month; // 0-indexed
        let phase = t.common.offseason;
        if (m === 9) phase = t.common.preseason; // October
        else if (m >= 10 || (m >= 0 && m <= 1)) phase = t.common.regularSeason; // Nov-Feb
        else if (m === 2) phase = t.common.allStarBreak; // March
        else if (m === 3) phase = t.common.regularSeason; // April (end of regular season)
        else if (m === 4) phase = t.common.playoffs; // May
        else if (m === 5) phase = t.common.nbaFinals; // June
        else if (m >= 6 && m <= 8) phase = t.common.offseason; // Jul-Sep
        const phaseColor = phase === t.common.playoffs || phase === t.common.nbaFinals ? "text-accent bg-accent/10" :
          phase === t.common.regularSeason || phase === t.common.allStarBreak ? "text-success bg-success/10" :
          phase === t.common.preseason ? "text-accent-amber bg-accent-amber/10" :
          "text-text-secondary bg-bg-hover";
        return (
          <div className="mb-4">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${phaseColor}`}>
              {phase}
            </span>
          </div>
        );
      })()}

      {/* Month Summary */}
      {!loading && days.length > 0 && (() => {
        const totalGames = days.reduce((s, d) => s + d.gameCount, 0);
        const gameDays = days.filter((d) => d.gameCount > 0).length;
        const busiestDay = days.reduce((best, d) => d.gameCount > best.gameCount ? d : best, days[0]);
        return (
          <div className="flex items-center gap-4 mb-4 text-xs text-text-secondary flex-wrap">
            <span><span className="font-bold text-accent">{totalGames}</span> {t.calendarPage.gamesThisMonth}</span>
            <span><span className="font-bold text-text-primary">{gameDays}</span> {t.calendarPage.gameDays}</span>
            {busiestDay.gameCount > 0 && (
              <span>{t.calendarPage.busiest}<span className="font-bold text-text-primary">{busiestDay.date}</span> ({busiestDay.gameCount} {t.common.games})</span>
            )}
            <span>{t.calendarPage.avg}<span className="font-bold text-text-primary">{gameDays > 0 ? (totalGames / gameDays).toFixed(1) : 0}</span> {t.calendarPage.gamesPerDay}</span>
          </div>
        );
      })()}

      {/* Calendar Grid */}
      <div className="glass-tile overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAYS_OF_WEEK.map((d, idx) => (
            <div key={d} className={`text-center py-2.5 text-xs font-medium ${idx === 0 || idx === 6 ? "text-accent/70" : "text-text-secondary"}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        {loading ? (
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="border-b border-r border-border/50 p-2 h-20 skeleton-shimmer">
                <div className="h-4 w-4 rounded bg-bg-hover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              const isToday = cell.date === today;
              const hasGames = cell.calDay && cell.calDay.gameCount > 0;
              const dayOfWeek = i % 7;
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              return (
                <div
                  key={i}
                  className={`border-b border-r border-border/50 p-2 min-h-[80px] transition-colors ${
                    cell.day ? "cursor-pointer hover:bg-bg-hover" : ""
                  } ${isToday ? "bg-accent/10" : hasGames ? (cell.calDay!.gameCount >= 8 ? "bg-success/15" : cell.calDay!.gameCount >= 4 ? "bg-success/10" : "bg-success/5") : isWeekend && cell.day ? "bg-bg-secondary/40" : ""}`}
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
                            {cell.calDay!.gameCount} {cell.calDay!.gameCount === 1 ? t.common.game : t.common.games}
                          </span>
                          {(() => {
                            const completedGames = cell.calDay!.games.filter(g => g.gameStatus === 3);
                            if (completedGames.length === 0) return null;
                            const totalPts = completedGames.reduce((s, g) => s + g.homeScore + g.awayScore, 0);
                            return (
                              <span className="block text-[8px] text-text-secondary mt-0.5">
                                {totalPts} {t.common.points}
                              </span>
                            );
                          })()}
                          <div className="mt-1 space-y-0.5">
                            {cell.calDay!.games.slice(0, 2).map((g) => (
                              <div key={g.gameId} className="text-[9px] text-text-secondary truncate flex items-center gap-0.5">
                                {TEAM_META[g.awayTricode] && (
                                  <Image src={teamLogoUrl(TEAM_META[g.awayTricode].teamId)} alt={g.awayTricode} width={10} height={10} unoptimized className="inline-block" />
                                )}
                                {g.awayTricode} @{" "}
                                {TEAM_META[g.homeTricode] && (
                                  <Image src={teamLogoUrl(TEAM_META[g.homeTricode].teamId)} alt={g.homeTricode} width={10} height={10} unoptimized className="inline-block" />
                                )}
                                {g.homeTricode}
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
                                +{cell.calDay!.games.length - 2} {t.calendarPage.more}
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

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/schedule", label: isZh ? "全部赛程" : "All games", icon: ListOrdered },
          { href: "/schedule-heatmap", label: isZh ? "赛程热力图" : "Schedule heatmap", icon: Calendar },
          { href: "/back-to-back", label: isZh ? "背靠背" : "B2B fatigue", icon: Repeat },
          { href: "/this-day", label: isZh ? "历史上的今天" : "This day in history", icon: Crown },
          { href: "/standings", label: isZh ? "排行榜" : "Standings", icon: ListOrdered },
        ]}
      />
    </div>
  );
}

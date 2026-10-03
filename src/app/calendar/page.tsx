"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";
import { ChevronLeft, ChevronRight, CalendarDays, ListOrdered, Calendar, Repeat, Crown } from "lucide-react";
import { calendarSeason, homeDateUrl } from "@/lib/date-navigation";
import { normalizeCalendarMonth, type CalendarDay } from "@/lib/calendar-month";
import Image from "next/image";
import { TEAM_META } from "@/lib/teams";
import { useLocale } from "@/components/LocaleProvider";
import { teamLogoUrl } from "@/lib/teamUrls";
import { localTz } from "@/lib/timezone";

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
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const [tz, setTz] = useState("UTC");
  const [ready, setReady] = useState(false);
  const et = getLocalParts(tz);
  const [year, setYear] = useState(et.year);
  const [month, setMonth] = useState(et.month); // 0-indexed (local tz)
  const [response, setResponse] = useState<{key:string;days:CalendarDay[];loading:boolean;error:boolean}>({key:"",days:[],loading:true,error:false});
  const [retry, setRetry] = useState(0);
  const requestKey = `${getMonthStr(year,month)}:${tz}`;
  const current = response.key === requestKey ? response : {days:[],loading:true,error:false};
  const {days,loading,error} = current;
  useEffect(() => {
    const zone=localTz(), local=getLocalParts(zone);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate browser timezone without SSR mismatch
    setTz(zone);setYear(local.year);setMonth(local.month);setReady(true);
  }, []);

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

  useEffect(() => {
    if(!ready)return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keyed async request state
    setResponse({key:requestKey,days:[],loading:true,error:false});
    fetch(`/api/calendar?month=${getMonthStr(year,month)}&tz=${encodeURIComponent(tz)}`,{signal:controller.signal})
      .then(async response => {
        if(!response.ok)throw new Error("Calendar unavailable");
        const data=normalizeCalendarMonth(await response.json(),getMonthStr(year,month));
        if(!data)throw new Error("Invalid calendar response");
        if(!controller.signal.aborted)setResponse({key:requestKey,days:data,loading:false,error:false});
      })
      .catch(()=>{if(!controller.signal.aborted)setResponse({key:requestKey,days:[],loading:false,error:true});});
    return ()=>controller.abort();
  },[year,month,tz,requestKey,retry,ready]);

  const goToPrevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
  };

  const goToNextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
  };

  // Build calendar grid
  const firstDayOfMonth = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0=Sun
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

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

  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString(isZh ? "zh-CN" : "en-US", {
    timeZone: "UTC",
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
        eyebrow={`${calendarSeason(year,month)} ${t.calendarPage.nbaSeason}`}
        icon={CalendarDays}
        title={t.calendarPage.seasonCalendar}
        action={
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <button aria-label={isZh ? "上个月" : "Previous month"} onClick={goToPrevMonth} className="p-2 rounded-lg glass-tile hover:bg-bg-hover transition-colors cursor-pointer min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center">
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-medium font-mono tabular-nums min-w-[140px] text-center">{monthLabel}</span>
              <button aria-label={isZh ? "下个月" : "Next month"} onClick={goToNextMonth} className="p-2 rounded-lg glass-tile hover:bg-bg-hover transition-colors cursor-pointer min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center">
                <ChevronRight size={18} />
              </button>
            </div>
            {(year !== et.year || month !== et.month) && (
              <button
                onClick={() => { setYear(et.year); setMonth(et.month); }}
                className="chip chip-active min-h-[44px] shrink-0 cursor-pointer"
              >
                {t.common.today}
              </button>
            )}
          </div>
        }
      />
      {ready && <p className="mb-4 text-xs text-text-secondary">{isZh ? "日期时区" : "Date timezone"}: {tz}</p>}
      {error && <div role="alert" className="glass-tile p-4 mb-4 text-sm">
        <p>{isZh ? "本月赛程加载失败，请重试。" : "This month's schedule could not be loaded. Please retry."}</p>
        <button className="mt-2 text-accent" onClick={()=>setRetry(value=>value+1)}>{isZh ? "重试" : "Retry"}</button>
      </div>}

      {/* Month Summary */}
      {!loading && !error && days.length > 0 && (() => {
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

      <p className="mb-3 text-xs text-text-secondary sm:hidden">
        {isZh ? "点击日期查看当天全部比赛，数字为比赛场数。" : "Tap a date for all games. Counts show games that day."}
      </p>

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
              if (!cell.date) return <div key={i} aria-hidden="true" className="border-b border-r border-border/50 min-h-[80px]" />;
              const isToday = cell.date === today;
              const hasGames = cell.calDay && cell.calDay.gameCount > 0;
              const dayOfWeek = i % 7;
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              return (
                <Link
                  href={homeDateUrl(cell.date)}
                  prefetch={false}
                  aria-label={`${cell.date} · ${error ? (isZh ? "赛程数据不可用" : "Schedule unavailable") : `${cell.calDay?.gameCount ?? 0} ${isZh ? "场已列比赛" : "listed games"}`}`}
                  key={i}
                  className={`border-b border-r border-border/50 min-w-0 px-1 py-2 sm:p-2 min-h-[80px] text-center sm:text-left transition-colors ${
                    cell.day ? "cursor-pointer hover:bg-bg-hover" : ""
                  } ${isToday ? "bg-accent/10" : hasGames ? (cell.calDay!.gameCount >= 8 ? "bg-success/15" : cell.calDay!.gameCount >= 4 ? "bg-success/10" : "bg-success/5") : isWeekend && cell.day ? "bg-bg-secondary/40" : ""}`}

                >
                  {cell.day && (
                    <>
                      <span className={`text-xs font-medium ${isToday ? "text-accent font-bold" : "text-text-primary"}`}>
                        {cell.day}
                      </span>
                      {hasGames && (
                        <div className="mt-1">
                          <span aria-hidden="true" className="inline-block max-w-full whitespace-nowrap rounded-full bg-accent/15 px-1 py-0.5 text-[10px] font-medium leading-tight text-accent sm:hidden">
                            {cell.calDay!.gameCount}{isZh ? "场" : ""}
                          </span>
                          <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-medium">
                            {cell.calDay!.gameCount} {cell.calDay!.gameCount === 1 ? t.common.game : t.common.games}
                          </span>
                          <div className="hidden sm:block">
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
                        </div>
                      )}
                    </>
                  )}
                </Link>
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

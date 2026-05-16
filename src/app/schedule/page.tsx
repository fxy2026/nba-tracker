import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CalendarX } from "lucide-react";
import { getFullSchedule, type ScheduleGame } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import GameCard from "@/components/GameCard";
import DateJumper from "@/components/DateJumper";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getTranslations(locale);
  return {
    title: t.meta.scheduleTitle,
    description: t.meta.scheduleDesc,
  };
}

// Serve stale page instantly, revalidate in background every 10 min
export const revalidate = 600;

interface PageProps {
  searchParams: Promise<{ team?: string }>;
}

export default async function SchedulePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filterTeam = params.team?.toUpperCase() || "";

  const locale = await getLocale();
  const t = getTranslations(locale);

  const allDates = await getFullSchedule();

  // Find dates with completed/in-progress games, show recent ones
  const today = new Date();

  // Get recent 14 days of games
  const recentDates: { dateStr: string; displayDate: string; games: ScheduleGame[] }[] = [];

  for (const gd of allDates) {
    const datePart = gd.gameDate.split(" ")[0]; // "04/25/2026"
    const [month, day, year] = datePart.split("/");
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const diffDays = Math.floor((today.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays >= -7 && diffDays <= 14 && gd.games.length > 0) {
      let filteredGames = gd.games;
      if (filterTeam && TEAM_META[filterTeam]) {
        filteredGames = gd.games.filter(
          (g) => g.homeTeam.teamTricode === filterTeam || g.awayTeam.teamTricode === filterTeam
        );
      }
      if (filteredGames.length > 0) {
        recentDates.push({
          dateStr: `${year}-${month}-${day}`,
          displayDate: dateObj.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long",
          }),
          games: filteredGames,
        });
      }
    }
  }

  // Sort by date descending (most recent first)
  recentDates.sort((a, b) => b.dateStr.localeCompare(a.dateStr));

  const teamsList = Object.values(TEAM_META).sort((a, b) => a.city.localeCompare(b.city));

  const totalGames = recentDates.reduce((s, d) => s + d.games.length, 0);
  const finishedGames = recentDates.reduce((s, d) => s + d.games.filter(g => g.gameStatus === 3).length, 0);
  const upcomingGames = totalGames - finishedGames;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <PageHeader eyebrow="Schedule" icon={CalendarDays} title={t.schedulePage.recentSchedule} />

      {/* Quick stats — chip strip */}
      {recentDates.length > 0 && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className="chip">{recentDates.length} {t.schedulePage.days}</span>
          <span className="chip"><span className="font-mono tabular-nums">{totalGames}</span> {t.common.games}</span>
          {finishedGames > 0 && (
            <span className="chip chip-active" style={{ borderColor: "var(--success)", color: "var(--success)", background: "color-mix(in srgb, var(--success) 12%, transparent)" }}>
              <span className="font-mono tabular-nums">{finishedGames}</span> {t.schedulePage.completed}
            </span>
          )}
          {upcomingGames > 0 && (
            <span className="chip chip-active">
              <span className="font-mono tabular-nums">{upcomingGames}</span> {t.common.upcoming}
            </span>
          )}
        </div>
      )}

      {/* Date jump */}
      <DateJumper />

      {/* Team filter */}
      <div className="mb-6 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary/70 mr-2">{t.schedulePage.filterByTeam}</span>
        <Link href="/schedule" className={`chip ${!filterTeam ? "chip-active" : ""}`}>
          {t.schedulePage.all}
        </Link>
        {teamsList.map((t_team) => (
          <Link
            key={t_team.tricode}
            href={`/schedule?team=${t_team.tricode}`}
            className={`chip font-mono ${filterTeam === t_team.tricode ? "chip-active" : ""}`}
          >
            {t_team.tricode}
          </Link>
        ))}
      </div>

      {recentDates.length > 0 ? (
        <div className="space-y-8">
          {recentDates.map(({ dateStr, displayDate, games }) => (
            <div key={dateStr} className="schedule-section">
              <div className="sticky top-16 bg-bg-primary/85 backdrop-blur-md py-2 z-10 mb-3 flex items-center gap-3">
                <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-primary">
                  {displayDate}
                </h2>
                <span className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-mono tabular-nums text-text-secondary/70">
                  {games.length} {t.common.games}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {games.map((game) => (
                  <GameCard key={game.gameId} game={game} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CalendarX}
          title={`${t.schedulePage.noGamesFound}${filterTeam ? ` ${filterTeam}` : ""}`}
          description="Try clearing the team filter or jumping to a different date."
          action={filterTeam ? { label: "Clear filter", href: "/schedule" } : { label: "Go to today", href: "/" }}
        />
      )}
    </div>
  );
}

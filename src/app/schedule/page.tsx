import type { Metadata } from "next";
import Link from "next/link";
import { getFullSchedule, type ScheduleGame } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import GameCard from "@/components/GameCard";
import DateJumper from "@/components/DateJumper";
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-2">{t.schedulePage.recentSchedule}</h1>
      {/* Quick stats */}
      {recentDates.length > 0 && (() => {
        const totalGames = recentDates.reduce((s, d) => s + d.games.length, 0);
        const finishedGames = recentDates.reduce((s, d) => s + d.games.filter(g => g.gameStatus === 3).length, 0);
        const upcomingGames = totalGames - finishedGames;
        return (
          <div className="flex items-center gap-3 mb-4 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-bg-card border border-border text-text-secondary">
              {recentDates.length} {t.schedulePage.days}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-bg-card border border-border text-text-secondary">
              {totalGames} {t.common.games}
            </span>
            {finishedGames > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-success/15 text-success font-medium">
                {finishedGames} {t.schedulePage.completed}
              </span>
            )}
            {upcomingGames > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-accent/15 text-accent font-medium">
                {upcomingGames} {t.common.upcoming}
              </span>
            )}
          </div>
        );
      })()}

      {/* Date jump */}
      <DateJumper />

      {/* Team filter */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-secondary font-medium">{t.schedulePage.filterByTeam}</span>
        <Link
          href="/schedule"
          className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
            !filterTeam ? "bg-accent/20 text-accent border border-accent/30" : "bg-bg-card border border-border hover:bg-bg-hover text-text-secondary"
          }`}
        >
          {t.schedulePage.all}
        </Link>
        {teamsList.map((t_team) => (
          <Link
            key={t_team.tricode}
            href={`/schedule?team=${t_team.tricode}`}
            className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
              filterTeam === t_team.tricode
                ? "bg-accent/20 text-accent border border-accent/30"
                : "bg-bg-card border border-border hover:bg-bg-hover text-text-secondary"
            }`}
          >
            {t_team.tricode}
          </Link>
        ))}
      </div>

      {recentDates.length > 0 ? (
        <div className="space-y-8">
          {recentDates.map(({ dateStr, displayDate, games }) => (
            <div key={dateStr} className="schedule-section">
              <h2 className="text-sm font-medium text-text-secondary mb-3 sticky top-16 bg-bg-primary py-2 z-10">
                {displayDate}
                {" "}
                <span className="text-xs text-accent font-medium">
                  {new Date(dateStr).toLocaleDateString("en-US", { weekday: "long" })}
                </span>
                <span className="ml-2 text-xs text-text-secondary/60">
                  ({games.length} {t.common.games})
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {games.map((game) => (
                  <GameCard key={game.gameId} game={game} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-text-secondary">
          <p className="text-lg">{t.schedulePage.noGamesFound}{filterTeam ? ` ${filterTeam}` : ""}</p>
        </div>
      )}
    </div>
  );
}

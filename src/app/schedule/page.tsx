import type { Metadata } from "next";
import Link from "next/link";
import { getFullSchedule, type ScheduleGame } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import GameCard from "@/components/GameCard";

export const metadata: Metadata = {
  title: "赛程",
  description: "NBA 完整赛程，包括常规赛和季后赛日程安排。",
};

// Serve stale page instantly, revalidate in background every 10 min
export const revalidate = 600;

interface PageProps {
  searchParams: Promise<{ team?: string }>;
}

export default async function SchedulePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filterTeam = params.team?.toUpperCase() || "";

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
          displayDate: dateObj.toLocaleDateString("zh-CN", {
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
      <h1 className="text-2xl font-bold mb-4">Recent Schedule</h1>

      {/* Date jump */}
      <div className="mb-4 flex items-center gap-3">
        <label htmlFor="date-jump" className="text-xs text-text-secondary font-medium">Jump to date:</label>
        <input
          type="date"
          id="date-jump"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="bg-bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
        />
        <script dangerouslySetInnerHTML={{ __html: `document.getElementById('date-jump').addEventListener('change',function(e){window.location.href='/?date='+e.target.value;})` }} />
      </div>

      {/* Team filter */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-secondary font-medium">Filter by team:</span>
        <Link
          href="/schedule"
          className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
            !filterTeam ? "bg-accent/20 text-accent border border-accent/30" : "bg-bg-card border border-border hover:bg-bg-hover text-text-secondary"
          }`}
        >
          All
        </Link>
        {teamsList.map((t) => (
          <Link
            key={t.tricode}
            href={`/schedule?team=${t.tricode}`}
            className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
              filterTeam === t.tricode
                ? "bg-accent/20 text-accent border border-accent/30"
                : "bg-bg-card border border-border hover:bg-bg-hover text-text-secondary"
            }`}
          >
            {t.tricode}
          </Link>
        ))}
      </div>

      {recentDates.length > 0 ? (
        <div className="space-y-8">
          {recentDates.map(({ dateStr, displayDate, games }) => (
            <div key={dateStr} className="schedule-section">
              <h2 className="text-sm font-medium text-text-secondary mb-3 sticky top-16 bg-bg-primary py-2 z-10">
                {displayDate}
                <span className="ml-2 text-xs text-text-secondary/60">
                  ({games.length} games)
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
          <p className="text-lg">No games found{filterTeam ? ` for ${filterTeam}` : ""}</p>
        </div>
      )}
    </div>
  );
}

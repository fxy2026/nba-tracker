import {
  getGamesByDate,
  getTodayScoreboard,
  formatDate,
  type ScheduleGame,
} from "@/lib/api";
import { getAllReplayGameIds } from "@/lib/supabase";
import GameCard from "@/components/GameCard";
import DateNav from "@/components/DateNav";
import HomeExtra from "@/components/HomeExtra";
import LiveScoreRefresher from "@/components/LiveScoreRefresher";
import TopPerformers from "@/components/TopPerformers";
import NbaNews from "@/components/NbaNews";
import StandingsMini from "@/components/StandingsMini";
import HotStreaks from "@/components/HotStreaks";
import SeasonLeaders from "@/components/SeasonLeaders";

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

function mapLiveGame(g: {
  gameId: string;
  gameCode: string;
  gameStatus: number;
  gameStatusText: string;
  gameTimeUTC: string;
  homeTeam: { teamId: number; teamTricode: string; teamName: string; teamCity: string; score: number; wins: number; losses: number; seed: number };
  awayTeam: { teamId: number; teamTricode: string; teamName: string; teamCity: string; score: number; wins: number; losses: number; seed: number };
  seriesText?: string;
}): ScheduleGame {
  return {
    gameId: g.gameId,
    gameCode: g.gameCode,
    gameStatus: g.gameStatus,
    gameStatusText: g.gameStatusText,
    gameDateTimeUTC: g.gameTimeUTC,
    homeTeam: { ...g.homeTeam, teamSlug: "", wins: g.homeTeam.wins || 0, losses: g.homeTeam.losses || 0, seed: g.homeTeam.seed || 0 },
    awayTeam: { ...g.awayTeam, teamSlug: "", wins: g.awayTeam.wins || 0, losses: g.awayTeam.losses || 0, seed: g.awayTeam.seed || 0 },
    seriesText: g.seriesText,
  };
}

// Revalidate homepage every 30s when dynamic
export const revalidate = 30;

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const today = formatDate(new Date());
  const selectedDate = params.date || today;
  const isToday = selectedDate === today;

  // Fetch games (critical path) + replay IDs (timeout at 2s so it never blocks long)
  const [liveGames, scheduledGames, replayGameIds] = await Promise.all([
    isToday ? getTodayScoreboard() : Promise.resolve([]),
    !isToday ? getGamesByDate(selectedDate) : Promise.resolve([]),
    Promise.race([
      getAllReplayGameIds().catch(() => [] as string[]),
      new Promise<string[]>((r) => setTimeout(() => r([]), 2000)),
    ]),
  ]);

  const games = isToday ? liveGames.map(mapLiveGame) : scheduledGames;
  const replaySet = new Set(replayGameIds);

  const hasLiveGames = isToday && games.some((g) => g.gameStatus === 2);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <DateNav selectedDate={selectedDate} />
      <StandingsMini />
      <LiveScoreRefresher hasLiveGames={hasLiveGames} />

      {games.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {games.map((game) => (
            <GameCard key={game.gameId} game={game} hasReplay={replaySet.has(game.gameId)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
          <p className="text-lg">{selectedDate} 没有比赛</p>
          <p className="text-sm mt-1">试试选择其他日期</p>
        </div>
      )}

      {/* Top Performers */}
      <TopPerformers />

      {/* NBA News from ESPN */}
      <NbaNews />

      {/* Playoff Hot Streaks */}
      <HotStreaks />

      {/* Season Leaders */}
      <SeasonLeaders />

      {/* Lazy-loaded playoff bracket + recent results */}
      <HomeExtra />
    </div>
  );
}

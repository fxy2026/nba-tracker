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
import TodayStars from "@/components/TodayStars";
import SeasonProgress from "@/components/SeasonProgress";
import LiveScoreRefresher from "@/components/LiveScoreRefresher";
import StandingsMini from "@/components/StandingsMini";

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
      <SeasonProgress />
      <StandingsMini />
      <LiveScoreRefresher hasLiveGames={hasLiveGames} />

      {/* Last updated timestamp */}
      {isToday && games.length > 0 && (
        <p className="text-[10px] text-text-secondary text-right mt-4">
          Updated: {new Date().toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit" })} (Beijing)
        </p>
      )}

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

      {/* Today's top performers */}
      {isToday && <TodayStars />}

      {/* Lazy-loaded playoff bracket + recent results — only client fetch on page */}
      <HomeExtra />
    </div>
  );
}

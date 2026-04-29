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
        <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
          <svg viewBox="0 0 80 80" className="w-16 h-16 mb-4 opacity-20">
            <circle cx="40" cy="40" r="30" fill="none" stroke="currentColor" strokeWidth="2" />
            <line x1="40" y1="10" x2="40" y2="70" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10,40 Q40,15 70,40" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10,40 Q40,65 70,40" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <p className="text-lg font-medium text-text-primary">{selectedDate} 没有比赛</p>
          <p className="text-sm mt-1 mb-4">试试选择其他日期，或浏览以下内容</p>
          <div className="flex items-center gap-3 text-xs">
            <a href="/standings" className="px-3 py-1.5 bg-bg-card border border-border rounded-lg hover:border-accent/50 transition-colors">排名</a>
            <a href="/search" className="px-3 py-1.5 bg-bg-card border border-border rounded-lg hover:border-accent/50 transition-colors">搜索球员</a>
            <a href="/injuries" className="px-3 py-1.5 bg-bg-card border border-border rounded-lg hover:border-accent/50 transition-colors">伤病报告</a>
          </div>
        </div>
      )}

      {/* Today's top performers */}
      {isToday && <TodayStars />}

      {/* Lazy-loaded playoff bracket + recent results — only client fetch on page */}
      <HomeExtra />
    </div>
  );
}

import {
  getGamesByDate,
  getTodayScoreboard,
  formatDate,
  type ScheduleGame,
} from "@/lib/api";
import { getAllReplayGameIds } from "@/lib/supabase";
import Link from "next/link";
import GameCard from "@/components/GameCard";
import DateNav from "@/components/DateNav";
import HomeExtra from "@/components/HomeExtra";
import TodayStars from "@/components/TodayStars";
import SeasonProgress from "@/components/SeasonProgress";
import LiveScoreRefresher from "@/components/LiveScoreRefresher";
import StandingsMini from "@/components/StandingsMini";
import ScoreTicker from "@/components/ScoreTicker";

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

// Dynamic page — reads searchParams for date navigation
export const dynamic = "force-dynamic";

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

  const unsortedGames = isToday ? liveGames.map(mapLiveGame) : scheduledGames;
  // Sort: live games first, then scheduled, then final
  const games = [...unsortedGames].sort((a, b) => {
    const order = (s: number) => s === 2 ? 0 : s === 1 ? 1 : 2;
    return order(a.gameStatus) - order(b.gameStatus);
  });
  const replaySet = new Set(replayGameIds);

  const hasLiveGames = isToday && games.some((g) => g.gameStatus === 2);
  const liveNow = games.filter((g) => g.gameStatus === 2);
  const upcoming = games.filter((g) => g.gameStatus === 1);
  const final = games.filter((g) => g.gameStatus === 3);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Feature 5: Live game score ticker */}
      {hasLiveGames && (
        <ScoreTicker
          games={liveNow
            .map((g) => ({
              gameId: g.gameId,
              awayTricode: g.awayTeam.teamTricode,
              homeTricode: g.homeTeam.teamTricode,
              awayScore: g.awayTeam.score,
              homeScore: g.homeTeam.score,
              gameStatusText: g.gameStatusText,
            }))}
        />
      )}
      <DateNav selectedDate={selectedDate} />
      {isToday && (() => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = formatDate(yesterday);
        return (
          <div className="mt-1 mb-1">
            <a href={`/?date=${yStr}`} className="text-xs text-text-secondary hover:text-accent transition-colors">
              &larr; Yesterday&apos;s Results ({yStr})
            </a>
          </div>
        );
      })()}
      <SeasonProgress />
      <StandingsMini />
      <LiveScoreRefresher hasLiveGames={hasLiveGames} />

      {/* Last updated timestamp */}
      {isToday && games.length > 0 && (
        <p className="text-[10px] text-text-secondary text-right mt-4">
          Updated: {new Date().toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit" })} (Beijing)
        </p>
      )}

      {/* Game of the Day */}
      {(() => {
        if (final.length === 0) return null;
        const closest = final.reduce((best, g) => {
          const diff = Math.abs(g.homeTeam.score - g.awayTeam.score);
          const bestDiff = Math.abs(best.homeTeam.score - best.awayTeam.score);
          return diff < bestDiff ? g : best;
        });
        const diff = Math.abs(closest.homeTeam.score - closest.awayTeam.score);
        if (diff > 20) return null; // skip blowouts
        return (
          <Link href={`/game/${closest.gameId}`} className="block mt-6 mb-2 px-4 py-2.5 bg-accent/10 border border-accent/20 rounded-xl hover:bg-accent/15 transition-colors">
            <p className="text-sm text-center">
              <span className="text-accent font-bold">Game of the Day: </span>
              <span className="text-text-primary font-medium">
                {closest.awayTeam.teamTricode} {closest.awayTeam.score} - {closest.homeTeam.score} {closest.homeTeam.teamTricode}
              </span>
              <span className="text-text-secondary ml-1">(margin: {diff})</span>
            </p>
          </Link>
        );
      })()}

      {games.length > 0 ? (
        <div className="mt-6 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">{games.length} Games</span>
            {games.length >= 10 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">
                Packed Slate
              </span>
            )}
            {games.length > 0 && games.length <= 3 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-500 font-medium">
                Light Day
              </span>
            )}
            {liveNow.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-medium">
                {liveNow.length} Live
              </span>
            )}
            {final.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-text-secondary/10 text-text-secondary">
                {final.length} Final
              </span>
            )}
          </div>
          {final.length > 0 && (() => {
            const totalPts = final.reduce((s, g) => s + g.homeTeam.score + g.awayTeam.score, 0);
            return (
              <p className="text-xs text-text-secondary mt-1">
                Total Points: <span className="font-bold text-accent">{totalPts}</span> across {final.length} finished game{final.length !== 1 ? "s" : ""}
              </p>
            );
          })()}
        </div>
      ) : null}
      {games.length > 0 ? (
        <div className="space-y-6">
          {/* Playoff banner */}
          {games.some((g) => g.gameId.startsWith("004")) && (
            <div className="bg-gradient-to-r from-accent/10 to-yellow-500/10 border border-accent/20 rounded-xl px-4 py-2 text-center">
              <span className="text-xs font-bold text-accent uppercase tracking-wide">Playoff Games Today</span>
            </div>
          )}
          {/* Live Now */}
          {liveNow.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-success flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" />
                Live Now
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {liveNow.map((game) => (
                  <GameCard key={game.gameId} game={game} hasReplay={replaySet.has(game.gameId)} />
                ))}
              </div>
            </>
          )}
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-text-secondary flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-text-secondary/50" />
                Upcoming
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcoming.map((game) => (
                  <GameCard key={game.gameId} game={game} hasReplay={replaySet.has(game.gameId)} />
                ))}
              </div>
            </>
          )}
          {/* Final */}
          {final.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-text-secondary flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-text-secondary/30" />
                Final
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {final.map((game) => (
                  <GameCard key={game.gameId} game={game} hasReplay={replaySet.has(game.gameId)} />
                ))}
              </div>
            </>
          )}
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
          {/* NBA Fun Fact */}
          {(() => {
            const facts = [
              "Wilt Chamberlain scored 100 points in a single game on March 2, 1962.",
              "The NBA three-point line was introduced in the 1979-80 season.",
              "Kareem Abdul-Jabbar holds the all-time regular season scoring record with 38,387 points (surpassed by LeBron in 2023).",
              "The longest NBA game lasted 6 overtimes — Indianapolis vs Rochester in 1951.",
              "The NBA has had 30 teams since the 2004-05 season.",
              "Michael Jordan has 6 NBA Finals MVP awards — the most in history.",
              "The shot clock was introduced in 1954 to speed up the game.",
              "Tim Duncan was drafted #1 overall in 1997 and won 5 championships with the Spurs.",
            ];
            const idx = new Date(selectedDate).getDate() % facts.length;
            return (
              <div className="bg-bg-card border border-border rounded-xl p-4 mb-4 max-w-md text-center">
                <p className="text-[10px] text-text-secondary uppercase font-medium mb-1">NBA Fun Fact</p>
                <p className="text-xs text-text-primary">{facts[idx]}</p>
              </div>
            );
          })()}
          <div className="flex items-center gap-3 text-xs">
            <a href="/standings" className="px-3 py-1.5 bg-bg-card border border-border rounded-lg hover:border-accent/50 transition-colors">排名</a>
            <a href="/search" className="px-3 py-1.5 bg-bg-card border border-border rounded-lg hover:border-accent/50 transition-colors">搜索球员</a>
            <a href="/injuries" className="px-3 py-1.5 bg-bg-card border border-border rounded-lg hover:border-accent/50 transition-colors">伤病报告</a>
          </div>
          {/* No games today? Try these — suggested links as cards */}
          {isToday && (
            <div className="mt-6 w-full max-w-lg">
              <p className="text-xs text-text-secondary uppercase font-medium mb-3 text-center">No games today? Try these</p>
              <div className="grid grid-cols-2 gap-3">
                <Link href={`/?date=${(() => { const d = new Date(); d.setDate(d.getDate() - 1); return formatDate(d); })()}`} className="flex flex-col items-center gap-1.5 p-4 bg-bg-card border border-border rounded-xl hover:border-accent/50 transition-colors">
                  <span className="text-sm font-medium text-text-primary">Browse Recent Games</span>
                  <span className="text-[10px] text-text-secondary">Yesterday&apos;s results</span>
                </Link>
                <Link href="/standings" className="flex flex-col items-center gap-1.5 p-4 bg-bg-card border border-border rounded-xl hover:border-accent/50 transition-colors">
                  <span className="text-sm font-medium text-text-primary">Check Standings</span>
                  <span className="text-[10px] text-text-secondary">Conference rankings</span>
                </Link>
                <Link href="/search" className="flex flex-col items-center gap-1.5 p-4 bg-bg-card border border-border rounded-xl hover:border-accent/50 transition-colors">
                  <span className="text-sm font-medium text-text-primary">Player Search</span>
                  <span className="text-[10px] text-text-secondary">Find any NBA player</span>
                </Link>
                <Link href="/injuries" className="flex flex-col items-center gap-1.5 p-4 bg-bg-card border border-border rounded-xl hover:border-accent/50 transition-colors">
                  <span className="text-sm font-medium text-text-primary">Injury Report</span>
                  <span className="text-[10px] text-text-secondary">Latest injury updates</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Game insights for the day */}
      {final.length > 0 && (() => {
        const avgScore = final.reduce((s, g) => s + g.homeTeam.score + g.awayTeam.score, 0) / final.length;
        const blowouts = final.filter((g) => Math.abs(g.homeTeam.score - g.awayTeam.score) >= 20);
        const thrillers = final.filter((g) => Math.abs(g.homeTeam.score - g.awayTeam.score) <= 5);
        const homeWins = final.filter((g) => g.homeTeam.score > g.awayTeam.score).length;
        const awayWins = final.length - homeWins;
        return (
          <div className="mt-6 bg-bg-card border border-border rounded-xl p-4">
            <h3 className="text-xs font-medium text-text-secondary uppercase mb-3">Day Insights</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
              <div>
                <p className="text-lg font-bold text-accent">{avgScore.toFixed(0)}</p>
                <p className="text-text-secondary">Avg Total Pts</p>
              </div>
              <div>
                <p className="text-lg font-bold text-text-primary">{homeWins}-{awayWins}</p>
                <p className="text-text-secondary">Home-Away</p>
              </div>
              <div>
                <p className="text-lg font-bold text-yellow-500">{thrillers.length}</p>
                <p className="text-text-secondary">Thrillers (&le;5)</p>
              </div>
              <div>
                <p className="text-lg font-bold text-danger">{blowouts.length}</p>
                <p className="text-text-secondary">Blowouts (&ge;20)</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Today's top performers */}
      {isToday && <TodayStars />}

      {/* Lazy-loaded playoff bracket + recent results — only client fetch on page */}
      <HomeExtra />
    </div>
  );
}

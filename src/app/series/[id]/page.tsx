import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Crown, Trophy, Target, Flame, Calendar, MapPin, Activity, type LucideIcon } from "lucide-react";
import {
  getFullSchedule,
  getBoxScore,
  type ScheduleGame,
  type BoxScore,
  type PlayerStats,
} from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import { getLocale } from "@/lib/locale";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import PlayerHeadshot from "@/components/PlayerHeadshot";

export const revalidate = 600;

// Round name from gameId char 7
function roundName(gameId: string, isZh: boolean): { full: string; short: string } {
  const r = parseInt(gameId.charAt(7)) || 0;
  if (r === 1) return { full: isZh ? "首轮" : "First Round", short: "R1" };
  if (r === 2) return { full: isZh ? "半决赛" : "Conference Semifinals", short: "R2" };
  if (r === 3) return { full: isZh ? "分区决赛" : "Conference Finals", short: "CF" };
  if (r === 4) return { full: isZh ? "总决赛" : "NBA Finals", short: "F" };
  return { full: isZh ? "季后赛" : "Playoffs", short: "P" };
}

interface SeriesData {
  seriesId: string;
  team1: { tricode: string; teamId: number; city: string; name: string; wins: number; seed: number };
  team2: { tricode: string; teamId: number; city: string; name: string; wins: number; seed: number };
  games: ScheduleGame[];
  boxScores: (BoxScore | null)[];
}

async function loadSeries(seriesId: string): Promise<SeriesData | null> {
  const schedule = await getFullSchedule().catch(() => []);
  const matchingGames: ScheduleGame[] = [];
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameId.startsWith(seriesId)) {
        matchingGames.push(g);
      }
    }
  }
  if (matchingGames.length === 0) return null;

  matchingGames.sort((a, b) => (a.gameCode || a.gameId).localeCompare(b.gameCode || b.gameId));
  const first = matchingGames[0];
  const codes = [first.homeTeam.teamTricode, first.awayTeam.teamTricode].sort();
  let team1Wins = 0, team2Wins = 0;
  let team1Info = { teamId: 0, city: "", name: "", seed: 0 };
  let team2Info = { teamId: 0, city: "", name: "", seed: 0 };

  for (const g of matchingGames) {
    if (g.gameStatus !== 3) continue;
    const homeWon = g.homeTeam.score > g.awayTeam.score;
    const winner = homeWon ? g.homeTeam : g.awayTeam;
    if (winner.teamTricode === codes[0]) team1Wins++; else team2Wins++;
    // Populate team info from any game
    for (const t of [g.homeTeam, g.awayTeam]) {
      if (t.teamTricode === codes[0]) team1Info = { teamId: t.teamId, city: t.teamCity, name: t.teamName, seed: t.seed || team1Info.seed };
      if (t.teamTricode === codes[1]) team2Info = { teamId: t.teamId, city: t.teamCity, name: t.teamName, seed: t.seed || team2Info.seed };
    }
  }

  // Fetch box scores for finished games in parallel
  const finishedGameIds = matchingGames.filter((g) => g.gameStatus === 3).map((g) => g.gameId);
  const boxScores = await Promise.all(finishedGameIds.map((id) => getBoxScore(id).catch(() => null)));

  return {
    seriesId,
    team1: { tricode: codes[0], ...team1Info, wins: team1Wins },
    team2: { tricode: codes[1], ...team2Info, wins: team2Wins },
    games: matchingGames,
    boxScores,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await loadSeries(id).catch(() => null);
  if (!data) return { title: "Series" };
  const desc = `${data.team1.tricode} vs ${data.team2.tricode} · series at ${data.team1.wins}-${data.team2.wins}`;
  return {
    title: `${data.team1.tricode} vs ${data.team2.tricode} — ${roundName(id, false).full}`,
    description: desc,
  };
}

function StatTile({
  label, value, sub, color,
}: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="glass-tile p-3 flex-1 min-w-[100px]">
      <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary/60">{label}</p>
      <p className="text-2xl font-light font-mono tabular-nums" style={color ? { color } : undefined}>{value}</p>
      {sub && <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary/60 mt-0.5">{sub}</p>}
    </div>
  );
}

export default async function SeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const isZh = locale === "zh";

  if (!/^004\d{6}$/.test(id)) notFound();

  const data = await loadSeries(id);
  if (!data) notFound();

  const { team1, team2, games, boxScores } = data;
  const meta1 = TEAM_META[team1.tricode];
  const meta2 = TEAM_META[team2.tricode];
  const team1Color = meta1?.primaryColor || "#3B82F6";
  const team2Color = meta2?.primaryColor || "#F59E0B";

  const finishedGames = games.filter((g) => g.gameStatus === 3);
  const winsToClinch = 4;
  const finished = team1.wins >= winsToClinch || team2.wins >= winsToClinch;
  const winnerCode = team1.wins >= winsToClinch ? team1.tricode : team2.wins >= winsToClinch ? team2.tricode : null;

  // Aggregate series stats
  let totalPtsT1 = 0;
  let totalPtsT2 = 0;
  let largestMargin = 0;
  let largestMarginGame: ScheduleGame | null = null;
  let closestMargin = 1000;
  let closestGame: ScheduleGame | null = null;
  let otCount = 0;
  let highestTotal = 0;
  let highestTotalGame: ScheduleGame | null = null;

  for (const g of finishedGames) {
    const isT1Home = g.homeTeam.teamTricode === team1.tricode;
    const t1Score = isT1Home ? g.homeTeam.score : g.awayTeam.score;
    const t2Score = isT1Home ? g.awayTeam.score : g.homeTeam.score;
    totalPtsT1 += t1Score;
    totalPtsT2 += t2Score;
    const margin = Math.abs(t1Score - t2Score);
    if (margin > largestMargin) {
      largestMargin = margin;
      largestMarginGame = g;
    }
    if (margin < closestMargin) {
      closestMargin = margin;
      closestGame = g;
    }
    const total = t1Score + t2Score;
    if (total > highestTotal) {
      highestTotal = total;
      highestTotalGame = g;
    }
    if (/ot/i.test(g.gameStatusText || "")) otCount++;
  }

  const avgPts1 = finishedGames.length > 0 ? totalPtsT1 / finishedGames.length : 0;
  const avgPts2 = finishedGames.length > 0 ? totalPtsT2 / finishedGames.length : 0;

  // Aggregate player performance across the series (per team)
  type AggPlayer = { personId: number; name: string; tricode: string; pts: number; reb: number; ast: number; games: number };
  const playerAgg = new Map<number, AggPlayer>();
  for (const bx of boxScores) {
    if (!bx) continue;
    const teams: [BoxScoreTeamLike, string][] = [
      [bx.homeTeam, bx.homeTeam.teamTricode],
      [bx.awayTeam, bx.awayTeam.teamTricode],
    ];
    for (const [tm, tri] of teams) {
      for (const p of tm.players as PlayerStats[]) {
        if (p.played !== "1") continue;
        const cur = playerAgg.get(p.personId) || {
          personId: p.personId,
          name: p.name,
          tricode: tri,
          pts: 0, reb: 0, ast: 0, games: 0,
        };
        cur.pts += p.statistics.points;
        cur.reb += p.statistics.reboundsTotal;
        cur.ast += p.statistics.assists;
        cur.games += 1;
        playerAgg.set(p.personId, cur);
      }
    }
  }
  const allPlayers = [...playerAgg.values()];
  const team1Top = allPlayers
    .filter((p) => p.tricode === team1.tricode)
    .sort((a, b) => b.pts / Math.max(b.games, 1) - a.pts / Math.max(a.games, 1))
    .slice(0, 3);
  const team2Top = allPlayers
    .filter((p) => p.tricode === team2.tricode)
    .sort((a, b) => b.pts / Math.max(b.games, 1) - a.pts / Math.max(a.games, 1))
    .slice(0, 3);

  const round = roundName(id, isZh);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.15em] text-text-secondary mb-4">
        <Link href="/" className="hover:text-accent transition-colors cursor-pointer">{isZh ? "首页" : "Home"}</Link>
        <span className="text-text-secondary/40">/</span>
        <span className="text-text-primary">{round.full}</span>
        <span className="text-text-secondary/40">/</span>
        <span className="text-text-primary">{team1.tricode} vs {team2.tricode}</span>
      </nav>

      <PageHeader
        eyebrow={round.full}
        icon={Trophy}
        title={`${team1.tricode} vs ${team2.tricode}`}
        subtitle={
          finished
            ? `${winnerCode} ${isZh ? "胜出" : "wins"} ${Math.max(team1.wins, team2.wins)}-${Math.min(team1.wins, team2.wins)} · ${finishedGames.length} ${isZh ? "场比赛" : "games played"}`
            : `${team1.tricode} ${team1.wins} - ${team2.wins} ${team2.tricode} · ${isZh ? "进行中" : "in progress"}`
        }
      />

      {/* Hero — both teams large */}
      <div className="glass-tile p-6 mb-6 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            background: `linear-gradient(90deg, ${team1Color}66 0%, transparent 35%, transparent 65%, ${team2Color}66 100%)`,
          }}
        />
        <div className="relative flex items-center justify-between gap-4">
          {/* Team 1 */}
          <Link href={`/team/${team1.tricode}`} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
            <Image
              src={`https://cdn.nba.com/logos/nba/${team1.teamId}/global/L/logo.svg`}
              alt={team1.tricode} width={88} height={88} unoptimized
              className={finished && winnerCode !== team1.tricode ? "opacity-50" : ""}
            />
            <div className="text-center">
              {team1.seed > 0 && (
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">{isZh ? "种子" : "Seed"} #{team1.seed}</p>
              )}
              <p className="text-lg font-bold text-text-primary group-hover:text-accent transition-colors">{team1.city} {team1.name}</p>
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">{meta1?.conference}</p>
            </div>
            <p
              className="text-6xl font-light font-mono tabular-nums leading-none"
              style={{ color: team1.wins >= winsToClinch ? "#FFD700" : team1.wins > team2.wins ? team1Color : "var(--text-secondary)" }}
            >
              {team1.wins}
            </p>
            {team1.wins >= winsToClinch && (
              <Crown size={20} className="text-[#FFD700]" />
            )}
          </Link>

          {/* VS */}
          <div className="flex flex-col items-center text-text-secondary/40 px-4">
            <p className="text-xs font-mono uppercase tracking-[0.3em]">VS</p>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] mt-1">{round.short}</p>
            <p className="text-[10px] font-mono tabular-nums mt-2">{games.length}/{winsToClinch + 3}</p>
          </div>

          {/* Team 2 */}
          <Link href={`/team/${team2.tricode}`} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
            <Image
              src={`https://cdn.nba.com/logos/nba/${team2.teamId}/global/L/logo.svg`}
              alt={team2.tricode} width={88} height={88} unoptimized
              className={finished && winnerCode !== team2.tricode ? "opacity-50" : ""}
            />
            <div className="text-center">
              {team2.seed > 0 && (
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">{isZh ? "种子" : "Seed"} #{team2.seed}</p>
              )}
              <p className="text-lg font-bold text-text-primary group-hover:text-accent transition-colors">{team2.city} {team2.name}</p>
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">{meta2?.conference}</p>
            </div>
            <p
              className="text-6xl font-light font-mono tabular-nums leading-none"
              style={{ color: team2.wins >= winsToClinch ? "#FFD700" : team2.wins > team1.wins ? team2Color : "var(--text-secondary)" }}
            >
              {team2.wins}
            </p>
            {team2.wins >= winsToClinch && (
              <Crown size={20} className="text-[#FFD700]" />
            )}
          </Link>
        </div>
      </div>

      {/* Series totals stat strip */}
      {finishedGames.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <StatTile
            label={`${team1.tricode} ${isZh ? "场均" : "PPG"}`}
            value={avgPts1.toFixed(1)}
            sub={`${totalPtsT1} ${isZh ? "总分" : "pts"}`}
            color={team1Color}
          />
          <StatTile
            label={`${team2.tricode} ${isZh ? "场均" : "PPG"}`}
            value={avgPts2.toFixed(1)}
            sub={`${totalPtsT2} ${isZh ? "总分" : "pts"}`}
            color={team2Color}
          />
          <StatTile
            label={isZh ? "场均差" : "Avg Margin"}
            value={`±${Math.abs(avgPts1 - avgPts2).toFixed(1)}`}
          />
          {otCount > 0 && (
            <StatTile label={isZh ? "加时" : "OT Games"} value={String(otCount)} color="#F59E0B" />
          )}
          <StatTile
            label={isZh ? "最大胜差" : "Largest Margin"}
            value={`${largestMargin}`}
            sub={largestMarginGame ? `${getWinnerTri(largestMarginGame)}` : undefined}
          />
          <StatTile
            label={isZh ? "最接近" : "Closest"}
            value={`${closestMargin}`}
            sub={closestGame ? `${getWinnerTri(closestGame)}` : undefined}
          />
        </div>
      )}

      {/* Game-by-game */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent flex items-center gap-2">
            <Calendar size={14} />
            {isZh ? "逐场战果" : "Game by game"}
          </h2>
          <span className="h-px flex-1 bg-accent/30" />
          <span className="text-[10px] font-mono tabular-nums text-text-secondary">{games.length} {isZh ? "场" : "games"}</span>
        </div>
        <div className="space-y-2">
          {games.map((g, i) => {
            const gameNum = i + 1;
            const isFinished = g.gameStatus === 3;
            const isT1Home = g.homeTeam.teamTricode === team1.tricode;
            const t1Score = isT1Home ? g.homeTeam.score : g.awayTeam.score;
            const t2Score = isT1Home ? g.awayTeam.score : g.homeTeam.score;
            const t1Won = isFinished && t1Score > t2Score;
            const isOT = /ot/i.test(g.gameStatusText || "");
            const dateStr = g.gameCode ? g.gameCode.slice(0, 8) : "";
            const formatted = dateStr ? `${dateStr.slice(4, 6)}/${dateStr.slice(6, 8)}` : "";

            return (
              <Link
                key={g.gameId}
                href={`/game/${g.gameId}`}
                className="glass-tile p-3 flex items-center gap-3 group cursor-pointer"
              >
                <div className="shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center bg-bg-hover/60">
                  <p className="text-[8px] font-mono uppercase text-text-secondary/60">G</p>
                  <p className="text-xl font-bold font-mono tabular-nums leading-none">{gameNum}</p>
                </div>
                <div className="flex-1 flex items-center gap-3 min-w-0">
                  <div className="text-right shrink-0 w-20">
                    <p className={`text-base font-bold font-mono ${t1Won ? "text-text-primary" : isFinished ? "text-text-secondary opacity-60" : "text-text-secondary"}`}>
                      {team1.tricode}
                    </p>
                    <p className="text-[9px] font-mono text-text-secondary/50 uppercase">{isT1Home ? (isZh ? "主" : "Home") : (isZh ? "客" : "Away")}</p>
                  </div>
                  <div className="flex items-baseline gap-2 px-2">
                    <span className={`text-2xl font-light font-mono tabular-nums ${t1Won ? "text-accent-amber" : "text-text-secondary"}`}>
                      {isFinished ? t1Score : "—"}
                    </span>
                    <span className="text-text-secondary/40 text-sm">·</span>
                    <span className={`text-2xl font-light font-mono tabular-nums ${!t1Won && isFinished ? "text-accent-amber" : "text-text-secondary"}`}>
                      {isFinished ? t2Score : "—"}
                    </span>
                  </div>
                  <div className="shrink-0 w-20">
                    <p className={`text-base font-bold font-mono ${!t1Won && isFinished ? "text-text-primary" : isFinished ? "text-text-secondary opacity-60" : "text-text-secondary"}`}>
                      {team2.tricode}
                    </p>
                    <p className="text-[9px] font-mono text-text-secondary/50 uppercase">{!isT1Home ? (isZh ? "主" : "Home") : (isZh ? "客" : "Away")}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-mono tabular-nums text-text-secondary">{formatted}</p>
                  {isFinished && (
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      {isOT && <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-accent-amber font-bold">OT</span>}
                      <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">{isZh ? "最终" : "Final"}</span>
                    </div>
                  )}
                  {!isFinished && g.gameStatus === 1 && (
                    <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">{isZh ? "未开始" : "scheduled"}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Top performers per team */}
      {(team1Top.length > 0 || team2Top.length > 0) && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent flex items-center gap-2">
              <Activity size={14} />
              {isZh ? "系列赛核心球员" : "Top performers"}
            </h2>
            <span className="h-px flex-1 bg-accent/30" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TeamTopList title={team1.tricode} color={team1Color} players={team1Top} isZh={isZh} />
            <TeamTopList title={team2.tricode} color={team2Color} players={team2Top} isZh={isZh} />
          </div>
        </section>
      )}

      {/* Notable game callouts */}
      {finishedGames.length > 1 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent flex items-center gap-2">
              <Flame size={14} />
              {isZh ? "亮点之战" : "Notable games"}
            </h2>
            <span className="h-px flex-1 bg-accent/30" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {largestMarginGame && (
              <NotableCard
                icon={Target}
                label={isZh ? "最大胜差" : "Biggest blowout"}
                value={`+${largestMargin}`}
                game={largestMarginGame}
                team1={team1.tricode}
                team2={team2.tricode}
              />
            )}
            {closestGame && closestMargin < largestMargin && (
              <NotableCard
                icon={Trophy}
                label={isZh ? "最接近" : "Closest game"}
                value={`+${closestMargin}`}
                game={closestGame}
                team1={team1.tricode}
                team2={team2.tricode}
              />
            )}
            {highestTotalGame && (
              <NotableCard
                icon={Flame}
                label={isZh ? "得分大战" : "Highest scoring"}
                value={String(highestTotal)}
                game={highestTotalGame}
                team1={team1.tricode}
                team2={team2.tricode}
              />
            )}
          </div>
        </section>
      )}

      {finishedGames.length === 0 && (
        <EmptyState
          icon={Trophy}
          title={isZh ? "系列赛尚未开打" : "Series hasn't started"}
          description={isZh ? "首场比赛开打后，统计和回顾会显示在这里。" : "Stats and recaps will appear here after Game 1 tips off."}
        />
      )}
    </div>
  );
}

// --- helpers ---

type BoxScoreTeamLike = { teamId: number; teamTricode: string; teamName: string; teamCity: string; score: number; players: PlayerStats[] };

function getWinnerTri(g: ScheduleGame): string {
  return g.homeTeam.score > g.awayTeam.score ? g.homeTeam.teamTricode : g.awayTeam.teamTricode;
}

function TeamTopList({
  title, color, players, isZh,
}: {
  title: string;
  color: string;
  players: { personId: number; name: string; pts: number; reb: number; ast: number; games: number }[];
  isZh: boolean;
}) {
  return (
    <div className="glass-tile p-4 relative overflow-hidden">
      <div className="absolute inset-y-0 left-0 w-1.5 opacity-80" style={{ background: color }} />
      <div className="relative">
        <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color }}>{title}</p>
        {players.length === 0 ? (
          <p className="text-[11px] font-mono text-text-secondary/60">{isZh ? "暂无数据" : "No data yet"}</p>
        ) : (
          <div className="space-y-1.5">
            {players.map((p, i) => {
              const ppg = p.games > 0 ? p.pts / p.games : 0;
              const rpg = p.games > 0 ? p.reb / p.games : 0;
              const apg = p.games > 0 ? p.ast / p.games : 0;
              return (
                <Link
                  key={p.personId}
                  href={`/player/${p.personId}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-hover transition-colors group cursor-pointer"
                >
                  <span className="w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold font-mono tabular-nums bg-bg-hover/60 text-text-secondary shrink-0">
                    {i + 1}
                  </span>
                  <PlayerHeadshot personId={p.personId} name={p.name} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors truncate">{p.name}</p>
                    <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
                      <span className="text-text-primary tabular-nums">{ppg.toFixed(1)}</span>{" / "}
                      <span className="tabular-nums">{rpg.toFixed(1)}</span>{" / "}
                      <span className="tabular-nums">{apg.toFixed(1)}</span>
                      <span className="text-text-secondary/40 ml-1.5">· {p.games}g</span>
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function NotableCard({
  icon: Icon, label, value, game, team1, team2,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  game: ScheduleGame;
  team1: string;
  team2: string;
}) {
  const winner = getWinnerTri(game);
  const isT1Home = game.homeTeam.teamTricode === team1;
  void team2;
  const t1 = isT1Home ? game.homeTeam : game.awayTeam;
  const t2 = isT1Home ? game.awayTeam : game.homeTeam;
  return (
    <Link
      href={`/game/${game.gameId}`}
      className="glass-tile p-4 group cursor-pointer"
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-accent-amber" />
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary">{label}</p>
      </div>
      <p className="text-3xl font-light font-mono tabular-nums text-accent-amber mb-2">{value}</p>
      <div className="flex items-center gap-2 text-[11px] font-mono">
        <MapPin size={10} className="text-text-secondary/50" />
        <span className={`tabular-nums ${winner === team1 ? "text-text-primary font-bold" : "text-text-secondary"}`}>
          {t1.teamTricode} {t1.score}
        </span>
        <span className="text-text-secondary/40">·</span>
        <span className={`tabular-nums ${winner !== team1 ? "text-text-primary font-bold" : "text-text-secondary"}`}>
          {t2.teamTricode} {t2.score}
        </span>
      </div>
    </Link>
  );
}

import { getBoxScore, getPlayByPlay, getPlayerIndex, parseMinutes, toBeijingTime, type PlayerStats, type ShotAction, type PlayerInfo } from "@/lib/api";
import { getReplayLinks } from "@/lib/supabase";
import TeamLogo from "@/components/TeamLogo";
import QuarterScores from "@/components/QuarterScores";
import ShotChart from "@/components/ShotChart";
import PlayerShotChart from "@/components/PlayerShotChart";
import { Play, ExternalLink } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

function StatsTable({ players, shots, playerInfoMap }: { players: PlayerStats[]; shots: ShotAction[]; playerInfoMap: Map<number, PlayerInfo> }) {
  const starters = players.filter((p) => p.starter === "1");
  const bench = players.filter((p) => p.starter !== "1" && p.played === "1");
  const dnp = players.filter((p) => p.played !== "1" && p.starter !== "1");

  const renderRow = (p: PlayerStats) => {
    const s = p.statistics;
    const mins = parseMinutes(s.minutes);
    return (
      <tr key={p.personId} className="border-b border-border/30 hover:bg-bg-hover/50">
        <td className="py-2.5 px-2 sticky left-0 bg-bg-card z-10">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-secondary w-5 text-right">#{p.jerseyNum}</span>
            <div>
              <p className="font-medium text-text-primary text-sm">
                <PlayerShotChart playerName={p.name} playerId={p.personId} shots={shots} playerInfo={playerInfoMap.get(p.personId)} />
              </p>
              <p className="text-xs text-text-secondary">{p.position || "-"}</p>
            </div>
          </div>
        </td>
        <td className="text-center py-2.5 px-1 text-text-secondary text-sm">{mins}</td>
        <td className="text-center py-2.5 px-1 font-bold text-sm">{s.points}</td>
        <td className="text-center py-2.5 px-1 text-sm">{s.reboundsTotal}</td>
        <td className="text-center py-2.5 px-1 text-sm">{s.assists}</td>
        <td className="text-center py-2.5 px-1 text-text-secondary text-sm">
          {s.fieldGoalsMade}-{s.fieldGoalsAttempted}
        </td>
        <td className="text-center py-2.5 px-1 text-text-secondary text-sm">
          {s.threePointersMade}-{s.threePointersAttempted}
        </td>
        <td className="text-center py-2.5 px-1 text-text-secondary text-sm">
          {s.freeThrowsMade}-{s.freeThrowsAttempted}
        </td>
        <td className="text-center py-2.5 px-1 text-sm">{s.steals}</td>
        <td className="text-center py-2.5 px-1 text-sm">{s.blocks}</td>
        <td className="text-center py-2.5 px-1 text-sm">{s.turnovers}</td>
        <td className="text-center py-2.5 px-1 text-sm">{s.foulsPersonal}</td>
        <td className={`text-center py-2.5 px-1 text-sm ${s.plusMinusPoints > 0 ? "text-success" : s.plusMinusPoints < 0 ? "text-danger" : "text-text-secondary"}`}>
          {s.plusMinusPoints > 0 ? "+" : ""}{s.plusMinusPoints}
        </td>
      </tr>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-text-secondary text-xs">
            <th className="text-left py-3 px-2 font-medium sticky left-0 bg-bg-card z-10 min-w-[160px]">Player</th>
            <th className="text-center py-3 px-1 font-medium w-14">MIN</th>
            <th className="text-center py-3 px-1 font-medium w-12">PTS</th>
            <th className="text-center py-3 px-1 font-medium w-12">REB</th>
            <th className="text-center py-3 px-1 font-medium w-12">AST</th>
            <th className="text-center py-3 px-1 font-medium w-14">FG</th>
            <th className="text-center py-3 px-1 font-medium w-14">3PT</th>
            <th className="text-center py-3 px-1 font-medium w-14">FT</th>
            <th className="text-center py-3 px-1 font-medium w-12">STL</th>
            <th className="text-center py-3 px-1 font-medium w-12">BLK</th>
            <th className="text-center py-3 px-1 font-medium w-12">TO</th>
            <th className="text-center py-3 px-1 font-medium w-12">PF</th>
            <th className="text-center py-3 px-1 font-medium w-12">+/-</th>
          </tr>
        </thead>
        <tbody>
          {starters.length > 0 && (
            <tr>
              <td colSpan={13} className="py-1.5 px-2 text-xs font-medium text-accent bg-accent/5 sticky left-0">
                Starters
              </td>
            </tr>
          )}
          {starters.map(renderRow)}
          {bench.length > 0 && (
            <tr>
              <td colSpan={13} className="py-1.5 px-2 text-xs font-medium text-text-secondary bg-bg-hover/30 sticky left-0">
                Bench
              </td>
            </tr>
          )}
          {bench.map(renderRow)}
          {dnp.length > 0 && (
            <tr>
              <td colSpan={13} className="py-1.5 px-2 text-xs text-text-secondary/60 sticky left-0">
                DNP: {dnp.map((p) => p.nameI).join(", ")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default async function GamePage({ params }: PageProps) {
  const { id } = await params;

  const [boxScore, shots, replayLinks, playerIndex] = await Promise.all([
    getBoxScore(id),
    getPlayByPlay(id).catch(() => []),
    getReplayLinks(id).catch(() => []),
    getPlayerIndex().catch(() => []),
  ]);

  // Build player info lookup
  const playerInfoMap = new Map<number, PlayerInfo>();
  for (const pi of playerIndex) {
    playerInfoMap.set(pi.personId, pi);
  }

  if (!boxScore) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Link href="/" className="text-sm text-text-secondary hover:text-accent transition-colors">
          &larr; Back
        </Link>
        <div className="flex flex-col items-center justify-center py-24 text-text-secondary">
          <p className="text-lg">Box Score not available yet</p>
          <p className="text-sm mt-1">The game may not have started</p>
        </div>
      </div>
    );
  }

  const isFinal = boxScore.gameStatus === 3;
  const homeWon = boxScore.homeTeam.score > boxScore.awayTeam.score;
  const isPlayoffs = boxScore.gameId.startsWith("004");

  const dateFromCode = boxScore.gameCode.split("/")[0];
  const backDate = `${dateFromCode.slice(0, 4)}-${dateFromCode.slice(4, 6)}-${dateFromCode.slice(6, 8)}`;

  const beijingTime = toBeijingTime(boxScore.gameTimeUTC);

  // Players for shot chart filter
  const allPlayers = [
    ...boxScore.awayTeam.players.filter((p) => p.played === "1").map((p) => ({
      personId: p.personId, nameI: p.nameI, teamTricode: boxScore.awayTeam.teamTricode,
    })),
    ...boxScore.homeTeam.players.filter((p) => p.played === "1").map((p) => ({
      personId: p.personId, nameI: p.nameI, teamTricode: boxScore.homeTeam.teamTricode,
    })),
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Link
        href={`/?date=${backDate}`}
        className="text-sm text-text-secondary hover:text-accent transition-colors"
      >
        &larr; Back to games
      </Link>

      {/* Scoreboard */}
      <div className="bg-bg-card rounded-xl border border-border p-6 mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {isPlayoffs && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">
                Playoffs
              </span>
            )}
            <span className="text-xs text-text-secondary">
              {boxScore.arena.arenaName}, {boxScore.arena.arenaCity}
            </span>
            {beijingTime && (
              <span className="text-xs text-text-secondary">
                &middot; 北京时间 {beijingTime}
              </span>
            )}
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            boxScore.gameStatus === 2
              ? "bg-success/15 text-success animate-pulse"
              : "text-text-secondary"
          }`}>
            {boxScore.gameStatusText.trim()}
          </span>
        </div>

        <div className="flex items-center justify-center gap-6 sm:gap-10 py-4">
          <div className="flex flex-col items-center gap-2">
            <TeamLogo teamId={boxScore.awayTeam.teamId} tricode={boxScore.awayTeam.teamTricode} size={56} />
            <p className="font-semibold text-sm text-center">
              {boxScore.awayTeam.teamCity}<br/>{boxScore.awayTeam.teamName}
            </p>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <span className={`text-4xl sm:text-5xl font-bold tabular-nums ${
              isFinal && !homeWon ? "text-text-primary" : isFinal ? "text-text-secondary" : "text-text-primary"
            }`}>
              {boxScore.awayTeam.score}
            </span>
            <span className="text-text-secondary text-2xl">-</span>
            <span className={`text-4xl sm:text-5xl font-bold tabular-nums ${
              isFinal && homeWon ? "text-text-primary" : isFinal ? "text-text-secondary" : "text-text-primary"
            }`}>
              {boxScore.homeTeam.score}
            </span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <TeamLogo teamId={boxScore.homeTeam.teamId} tricode={boxScore.homeTeam.teamTricode} size={56} />
            <p className="font-semibold text-sm text-center">
              {boxScore.homeTeam.teamCity}<br/>{boxScore.homeTeam.teamName}
            </p>
          </div>
        </div>

        {/* Quarter Scores */}
        {boxScore.homeTeam.periods?.length > 0 && (
          <div className="mt-2 border-t border-border pt-3">
            <QuarterScores homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} />
          </div>
        )}
      </div>

      {/* Replay links */}
      {replayLinks.length > 0 && (
        <div className="bg-bg-card rounded-xl border border-accent/30 p-4 mt-4">
          <h3 className="text-sm font-semibold text-accent flex items-center gap-1.5 mb-3">
            <Play size={14} fill="currentColor" />
            比赛回放
          </h3>
          <div className="flex flex-wrap gap-2">
            {replayLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-bg-hover rounded-lg text-sm text-text-primary hover:bg-accent/20 hover:text-accent transition-colors"
              >
                <ExternalLink size={14} />
                {link.title}
                <span className="text-xs text-text-secondary ml-1">({link.source})</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Shot Chart + Box Score side by side on large screens */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shot Chart */}
        {shots.length > 0 && (
          <div className="lg:col-span-1">
            <div className="bg-bg-card rounded-xl border border-border p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-accent rounded-full" />
                Shot Chart
              </h3>
              <ShotChart
                shots={shots}
                homeTricode={boxScore.homeTeam.teamTricode}
                awayTricode={boxScore.awayTeam.teamTricode}
                players={allPlayers}
              />
            </div>
          </div>
        )}

        {/* Box Score Tables */}
        <div className={shots.length > 0 ? "lg:col-span-2 space-y-6" : "lg:col-span-3 space-y-6"}>
          {/* Away team */}
          <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <TeamLogo teamId={boxScore.awayTeam.teamId} tricode={boxScore.awayTeam.teamTricode} size={24} />
              <h2 className="font-semibold">
                {boxScore.awayTeam.teamCity} {boxScore.awayTeam.teamName}
              </h2>
              <span className="text-text-secondary text-sm ml-auto">{boxScore.awayTeam.score} pts</span>
            </div>
            <StatsTable players={boxScore.awayTeam.players} shots={shots} playerInfoMap={playerInfoMap} />
          </div>

          {/* Home team */}
          <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <TeamLogo teamId={boxScore.homeTeam.teamId} tricode={boxScore.homeTeam.teamTricode} size={24} />
              <h2 className="font-semibold">
                {boxScore.homeTeam.teamCity} {boxScore.homeTeam.teamName}
              </h2>
              <span className="text-text-secondary text-sm ml-auto">{boxScore.homeTeam.score} pts</span>
            </div>
            <StatsTable players={boxScore.homeTeam.players} shots={shots} playerInfoMap={playerInfoMap} />
          </div>
        </div>
      </div>
    </div>
  );
}

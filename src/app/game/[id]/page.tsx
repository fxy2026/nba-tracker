import { Suspense } from "react";
import { getBoxScore, getPlayByPlay, getPlayerIndex, parseMinutes, toBeijingTime, type PlayerStats, type ShotAction, type PlayerInfo, type BoxScoreTeam } from "@/lib/api";
import { getReplayLinks } from "@/lib/supabase";
import TeamLogo from "@/components/TeamLogo";
import QuarterScores from "@/components/QuarterScores";
import WinProbability from "@/components/WinProbability";
import ShotChart from "@/components/ShotChart";
import PlayerShotChart from "@/components/PlayerShotChart";
import TeamCompare from "@/components/TeamCompare";
import PlayByPlay from "@/components/PlayByPlay";
import KeyMoments from "@/components/KeyMoments";
import { Play, ExternalLink } from "lucide-react";
import ShareButton from "@/components/ShareButton";
import Link from "next/link";
import GameAutoRefresh from "@/components/GameAutoRefresh";

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
    const pts = s.points;
    const reb = s.reboundsTotal;
    const ast = s.assists;
    const isDoubleDouble = [pts, reb, ast, s.steals, s.blocks].filter(v => v >= 10).length >= 2;
    const isTripleDouble = [pts, reb, ast, s.steals, s.blocks].filter(v => v >= 10).length >= 3;

    return (
      <tr key={p.personId} className="border-b border-border/30 hover:bg-bg-hover/50">
        <td className="py-2.5 px-2 sticky left-0 bg-bg-card z-10">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-secondary w-5 text-right">#{p.jerseyNum}</span>
            <div>
              <p className="font-medium text-text-primary text-sm flex items-center gap-1">
                <PlayerShotChart playerName={p.name} playerId={p.personId} shots={shots} playerInfo={playerInfoMap.get(p.personId)} />
                {isTripleDouble && <span className="text-[9px] px-1 py-0.5 rounded bg-accent/20 text-accent font-bold">3D</span>}
                {isDoubleDouble && !isTripleDouble && <span className="text-[9px] px-1 py-0.5 rounded bg-accent/10 text-accent">DD</span>}
                {pts >= 30 && <span className="text-[9px] px-1 py-0.5 rounded bg-success/10 text-success">30+</span>}
              </p>
              <p className="text-xs text-text-secondary">{p.position || "-"}</p>
            </div>
          </div>
        </td>
        <td className="text-center py-2.5 px-1 text-text-secondary text-sm">{mins}</td>
        <td className="text-center py-2.5 px-1 font-bold text-sm">{pts}</td>
        <td className="text-center py-2.5 px-1 text-sm">{reb}</td>
        <td className="text-center py-2.5 px-1 text-sm">{ast}</td>
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
    <div className="overflow-x-auto box-score-wrap">
      <table className="w-full text-sm box-score-table">
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
            <tr><td colSpan={13} className="py-1.5 px-2 text-xs font-medium text-accent bg-accent/5 sticky left-0">Starters</td></tr>
          )}
          {starters.map(renderRow)}
          {bench.length > 0 && (
            <tr><td colSpan={13} className="py-1.5 px-2 text-xs font-medium text-text-secondary bg-bg-hover/30 sticky left-0">Bench</td></tr>
          )}
          {bench.map(renderRow)}
          {dnp.length > 0 && (
            <tr><td colSpan={13} className="py-1.5 px-2 text-xs text-text-secondary/60 sticky left-0">DNP: {dnp.map((p) => p.nameI).join(", ")}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ShotChartSection({ shots, homeTricode, awayTricode, allPlayers }: {
  shots: ShotAction[]; homeTricode: string; awayTricode: string;
  allPlayers: { personId: number; nameI: string; teamTricode: string }[];
}) {
  if (shots.length === 0) return null;
  return (
    <div className="bg-bg-card rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-accent rounded-full" />
        Shot Chart
      </h3>
      <ShotChart shots={shots} homeTricode={homeTricode} awayTricode={awayTricode} players={allPlayers} />
    </div>
  );
}

async function PlayByPlaySection({ gameId }: { gameId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let actions: any[] = [];
  try {
    const res = await fetch(
      `https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${gameId}.json`,
      { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.nba.com/" }, next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    actions = data.game?.actions || [];
  } catch {
    return null;
  }
  if (actions.length === 0) return null;
  return <PlayByPlay actions={actions} />;
}

async function ReplaySection({ gameId }: { gameId: string }) {
  const replayLinks = await getReplayLinks(gameId).catch(() => []);
  if (replayLinks.length === 0) return null;
  return (
    <div className="bg-bg-card rounded-xl border border-accent/30 p-4 mt-4">
      <h3 className="text-sm font-semibold text-accent flex items-center gap-1.5 mb-3">
        <Play size={14} fill="currentColor" />
        比赛回放
      </h3>
      <div className="flex flex-wrap gap-2">
        {replayLinks.map((link) => (
          <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-bg-hover rounded-lg text-sm text-text-primary hover:bg-accent/20 hover:text-accent transition-colors">
            <ExternalLink size={14} />
            {link.title}
            <span className="text-xs text-text-secondary ml-1">({link.source})</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function GameSummary({ homeTeam, awayTeam }: { homeTeam: BoxScoreTeam; awayTeam: BoxScoreTeam }) {
  // Find highest scorer from each team
  const getTopScorer = (team: BoxScoreTeam) => {
    const played = team.players.filter((p) => p.played === "1");
    if (played.length === 0) return null;
    return played.reduce((best, p) => p.statistics.points > best.statistics.points ? p : best);
  };

  // Find double-doubles and triple-doubles
  const getSpecialPerformances = (team: BoxScoreTeam) => {
    return team.players.filter((p) => {
      if (p.played !== "1") return false;
      const s = p.statistics;
      const doubleDigits = [s.points, s.reboundsTotal, s.assists, s.steals, s.blocks].filter(v => v >= 10).length;
      return doubleDigits >= 2;
    }).map((p) => {
      const s = p.statistics;
      const doubleDigits = [s.points, s.reboundsTotal, s.assists, s.steals, s.blocks].filter(v => v >= 10).length;
      return { name: p.nameI, isTriple: doubleDigits >= 3, pts: s.points, reb: s.reboundsTotal, ast: s.assists };
    });
  };

  // Compute largest lead for each team using period scores
  const getLargestLead = (team: BoxScoreTeam, opponent: BoxScoreTeam) => {
    // Approximate from period cumulative scores
    let teamTotal = 0;
    let oppTotal = 0;
    let maxLead = 0;
    for (let i = 0; i < team.periods.length; i++) {
      teamTotal += team.periods[i]?.score || 0;
      oppTotal += opponent.periods[i]?.score || 0;
      const lead = teamTotal - oppTotal;
      if (lead > maxLead) maxLead = lead;
    }
    return maxLead;
  };

  const homeTopScorer = getTopScorer(homeTeam);
  const awayTopScorer = getTopScorer(awayTeam);
  const homeSpecial = getSpecialPerformances(homeTeam);
  const awaySpecial = getSpecialPerformances(awayTeam);
  const homeLargestLead = getLargestLead(homeTeam, awayTeam);
  const awayLargestLead = getLargestLead(awayTeam, homeTeam);

  return (
    <div className="bg-bg-card rounded-xl border border-border p-4 mt-4">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <span className="w-1 h-4 bg-accent rounded-full" />
        Game Summary
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        {/* Away team summary */}
        <div>
          <p className="text-xs font-medium text-text-secondary mb-1.5">{awayTeam.teamCity} {awayTeam.teamName}</p>
          {awayTopScorer && (
            <p className="text-text-primary">
              <span className="font-medium">{awayTopScorer.nameI}</span>
              <span className="text-text-secondary ml-1">
                {awayTopScorer.statistics.points} PTS, {awayTopScorer.statistics.reboundsTotal} REB, {awayTopScorer.statistics.assists} AST
              </span>
            </p>
          )}
          {awaySpecial.length > 0 && (
            <div className="mt-1">
              {awaySpecial.map((p) => (
                <span key={p.name} className={`inline-block text-[10px] px-1.5 py-0.5 rounded mr-1 ${p.isTriple ? "bg-accent/20 text-accent" : "bg-accent/10 text-accent"}`}>
                  {p.name}: {p.isTriple ? "Triple-Double" : "Double-Double"} ({p.pts}/{p.reb}/{p.ast})
                </span>
              ))}
            </div>
          )}
          {awayLargestLead > 0 && (
            <p className="text-xs text-text-secondary mt-1">Largest lead: {awayLargestLead} pts</p>
          )}
        </div>
        {/* Home team summary */}
        <div>
          <p className="text-xs font-medium text-text-secondary mb-1.5">{homeTeam.teamCity} {homeTeam.teamName}</p>
          {homeTopScorer && (
            <p className="text-text-primary">
              <span className="font-medium">{homeTopScorer.nameI}</span>
              <span className="text-text-secondary ml-1">
                {homeTopScorer.statistics.points} PTS, {homeTopScorer.statistics.reboundsTotal} REB, {homeTopScorer.statistics.assists} AST
              </span>
            </p>
          )}
          {homeSpecial.length > 0 && (
            <div className="mt-1">
              {homeSpecial.map((p) => (
                <span key={p.name} className={`inline-block text-[10px] px-1.5 py-0.5 rounded mr-1 ${p.isTriple ? "bg-accent/20 text-accent" : "bg-accent/10 text-accent"}`}>
                  {p.name}: {p.isTriple ? "Triple-Double" : "Double-Double"} ({p.pts}/{p.reb}/{p.ast})
                </span>
              ))}
            </div>
          )}
          {homeLargestLead > 0 && (
            <p className="text-xs text-text-secondary mt-1">Largest lead: {homeLargestLead} pts</p>
          )}
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function KeyMomentsSection({ gameId }: { gameId: string }) {
  try {
    const res = await fetch(
      `https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${gameId}.json`,
      { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.nba.com/" }, next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const actions = data.game?.actions || [];
    if (actions.length === 0) return null;
    return <KeyMoments actions={actions} />;
  } catch {
    return null;
  }
}

function SectionSkeleton() {
  return <div className="h-48 bg-bg-card rounded-xl border border-border animate-pulse" />;
}

export default async function GamePage({ params }: PageProps) {
  const { id } = await params;

  // Fetch boxScore + shots + playerIndex in parallel
  const [boxScore, shots, playerIndex] = await Promise.all([
    getBoxScore(id),
    getPlayByPlay(id).catch(() => []),
    getPlayerIndex().catch(() => []),
  ]);

  const playerInfoMap = new Map<number, PlayerInfo>();
  for (const pi of playerIndex) {
    playerInfoMap.set(pi.personId, pi);
  }

  if (!boxScore) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Link href="/" className="text-sm text-text-secondary hover:text-accent transition-colors">&larr; Back</Link>
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
      <Link href={`/?date=${backDate}`} className="text-sm text-text-secondary hover:text-accent transition-colors">&larr; Back to games</Link>
      <GameAutoRefresh isLive={boxScore.gameStatus === 2} />

      {/* Scoreboard — renders immediately */}
      <div className="bg-bg-card rounded-xl border border-border p-6 mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {isPlayoffs && <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">Playoffs</span>}
            <span className="text-xs text-text-secondary">{boxScore.arena.arenaName}, {boxScore.arena.arenaCity}</span>
            {beijingTime && <span className="text-xs text-text-secondary">&middot; 北京时间 {beijingTime}</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${boxScore.gameStatus === 2 ? "bg-success/15 text-success animate-pulse" : "text-text-secondary"}`}>
              {boxScore.gameStatusText.trim()}
            </span>
            {isFinal && (
              <ShareButton text={`${boxScore.awayTeam.teamTricode} ${boxScore.awayTeam.score} - ${boxScore.homeTeam.score} ${boxScore.homeTeam.teamTricode} | NBA Tracker`} />
            )}
          </div>
        </div>
        <div className="flex items-center justify-center gap-6 sm:gap-10 py-4">
          <div className="flex flex-col items-center gap-2">
            <TeamLogo teamId={boxScore.awayTeam.teamId} tricode={boxScore.awayTeam.teamTricode} size={56} />
            <Link href={`/team/${boxScore.awayTeam.teamTricode}`} className="font-semibold text-sm text-center hover:text-accent transition-colors">
              {boxScore.awayTeam.teamCity}<br/>{boxScore.awayTeam.teamName}
            </Link>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <span className={`text-4xl sm:text-5xl font-bold tabular-nums ${isFinal && !homeWon ? "text-text-primary" : isFinal ? "text-text-secondary" : "text-text-primary"}`}>
              {boxScore.awayTeam.score}
            </span>
            <span className="text-text-secondary text-2xl">-</span>
            <span className={`text-4xl sm:text-5xl font-bold tabular-nums ${isFinal && homeWon ? "text-text-primary" : isFinal ? "text-text-secondary" : "text-text-primary"}`}>
              {boxScore.homeTeam.score}
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <TeamLogo teamId={boxScore.homeTeam.teamId} tricode={boxScore.homeTeam.teamTricode} size={56} />
            <Link href={`/team/${boxScore.homeTeam.teamTricode}`} className="font-semibold text-sm text-center hover:text-accent transition-colors">
              {boxScore.homeTeam.teamCity}<br/>{boxScore.homeTeam.teamName}
            </Link>
          </div>
        </div>
        {boxScore.homeTeam.periods?.length > 0 && (
          <div className="mt-2 border-t border-border pt-3">
            <QuarterScores homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} />
            {isFinal && boxScore.homeTeam.periods.length > 0 && (
              <WinProbability
                periods={boxScore.homeTeam.periods.map((p, i) => ({
                  period: p.period,
                  homeScore: p.score,
                  awayScore: boxScore.awayTeam.periods[i]?.score || 0,
                }))}
              />
            )}
          </div>
        )}
      </div>

      {/* Game Summary — right after scoreboard for final games */}
      {isFinal && (
        <GameSummary homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} />
      )}

      {/* Replay links — streamed */}
      <Suspense fallback={null}>
        <ReplaySection gameId={id} />
      </Suspense>

      {/* Team Stats Comparison */}
      {isFinal && (
        <div className="mt-6">
          <TeamCompare homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} />
        </div>
      )}

      {/* Key Moments — between TeamCompare and Shot Chart */}
      {isFinal && (
        <Suspense fallback={<SectionSkeleton />}>
          <KeyMomentsSection gameId={id} />
        </Suspense>
      )}

      {/* Shot Chart + Box Score + Play-by-Play */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shot Chart */}
        <div className="lg:col-span-1 space-y-6">
          <ShotChartSection shots={shots} homeTricode={boxScore.homeTeam.teamTricode} awayTricode={boxScore.awayTeam.teamTricode} allPlayers={allPlayers} />
        </div>

        {/* Box Score Tables — immediate */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <TeamLogo teamId={boxScore.awayTeam.teamId} tricode={boxScore.awayTeam.teamTricode} size={24} />
              <h2 className="font-semibold">{boxScore.awayTeam.teamCity} {boxScore.awayTeam.teamName}</h2>
              <span className="text-text-secondary text-sm ml-auto">{boxScore.awayTeam.score} pts</span>
            </div>
            <StatsTable players={boxScore.awayTeam.players} shots={shots} playerInfoMap={playerInfoMap} />
          </div>
          <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <TeamLogo teamId={boxScore.homeTeam.teamId} tricode={boxScore.homeTeam.teamTricode} size={24} />
              <h2 className="font-semibold">{boxScore.homeTeam.teamCity} {boxScore.homeTeam.teamName}</h2>
              <span className="text-text-secondary text-sm ml-auto">{boxScore.homeTeam.score} pts</span>
            </div>
            <StatsTable players={boxScore.homeTeam.players} shots={shots} playerInfoMap={playerInfoMap} />
          </div>
        </div>
      </div>

      {/* Play-by-Play Timeline — streamed */}
      <div className="mt-6">
        <Suspense fallback={<SectionSkeleton />}>
          <PlayByPlaySection gameId={id} />
        </Suspense>
      </div>
    </div>
  );
}

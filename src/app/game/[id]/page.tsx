import type { Metadata } from "next";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { getBoxScore, getPlayByPlay, getPlayerIndex, parseMinutes, toBeijingTime, type PlayerStats, type ShotAction, type PlayerInfo, type BoxScoreTeam } from "@/lib/api";
import { getReplayLinks } from "@/lib/supabase";
import TeamLogo from "@/components/TeamLogo";
import QuarterScores from "@/components/QuarterScores";
import TeamCompare from "@/components/TeamCompare";
import KeyMoments from "@/components/KeyMoments";
import { Play, ExternalLink } from "lucide-react";
import ShareButton from "@/components/ShareButton";
import QuarterBars from "@/components/QuarterBars";
import Link from "next/link";
import GameAutoRefresh from "@/components/GameAutoRefresh";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";
import type { Translations } from "@/locales";

const ChartPlaceholder = () => <div className="h-64 bg-bg-card rounded-xl skeleton-shimmer" />;
const WinProbability = dynamic(() => import("@/components/WinProbability"), { loading: ChartPlaceholder });
const ShotChart = dynamic(() => import("@/components/ShotChart"), { loading: ChartPlaceholder });
const PlayerShotChart = dynamic(() => import("@/components/PlayerShotChart"), { loading: ChartPlaceholder });
const PlayByPlay = dynamic(() => import("@/components/PlayByPlay"), { loading: ChartPlaceholder });
const RadarChart = dynamic(() => import("@/components/RadarChart"), { loading: ChartPlaceholder });
const ScoringFlow = dynamic(() => import("@/components/ScoringFlow"), { loading: ChartPlaceholder });
const ShotHeatmap = dynamic(() => import("@/components/ShotHeatmap"), { loading: ChartPlaceholder });

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const [box, locale] = await Promise.all([getBoxScore(id), getLocale()]);
  const t = getTranslations(locale);
  if (!box) return {};
  const away = box.awayTeam;
  const home = box.homeTeam;
  const score = box.gameStatus >= 2 ? ` ${away.score}-${home.score}` : "";
  const desc = locale === "zh"
    ? `${away.teamCity} ${away.teamName} vs ${home.teamCity} ${home.teamName} — Box Score、投篮图、逐球回放。`
    : `${away.teamCity} ${away.teamName} vs ${home.teamCity} ${home.teamName} — ${t.gameDetail.boxScore}, ${t.gameDetail.shotChart}, ${t.gameDetail.playByPlay}.`;
  return {
    title: `${away.teamTricode} vs ${home.teamTricode}${score}`,
    description: desc,
    openGraph: {
      title: `${away.teamTricode}${score ? " " + away.score : ""} vs ${home.teamTricode}${score ? " " + home.score : ""} | NBA Tracker`,
      description: `${away.teamCity} ${away.teamName} vs ${home.teamCity} ${home.teamName}`,
    },
  };
}

export const revalidate = 60;

function StatsTable({ players, shots, playerInfoMap, t }: { players: PlayerStats[]; shots: ShotAction[]; playerInfoMap: Map<number, PlayerInfo>; t: Translations }) {
  const starters = players.filter((p) => p.starter === "1");
  const bench = players.filter((p) => p.starter !== "1" && p.played === "1");
  const dnp = players.filter((p) => p.played !== "1" && p.starter !== "1");
  const played = players.filter((p) => p.played === "1");

  // Team totals
  const totals = played.reduce((acc, p) => {
    const s = p.statistics;
    return {
      pts: acc.pts + s.points,
      reb: acc.reb + s.reboundsTotal,
      ast: acc.ast + s.assists,
      stl: acc.stl + s.steals,
      blk: acc.blk + s.blocks,
      tov: acc.tov + s.turnovers,
      pf: acc.pf + s.foulsPersonal,
      fgm: acc.fgm + s.fieldGoalsMade,
      fga: acc.fga + s.fieldGoalsAttempted,
      tpm: acc.tpm + s.threePointersMade,
      tpa: acc.tpa + s.threePointersAttempted,
      ftm: acc.ftm + s.freeThrowsMade,
      fta: acc.fta + s.freeThrowsAttempted,
    };
  }, { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 });

  const renderRow = (p: PlayerStats) => {
    const s = p.statistics;
    const mins = parseMinutes(s.minutes);
    const pts = s.points;
    const reb = s.reboundsTotal;
    const ast = s.assists;
    const isDoubleDouble = [pts, reb, ast, s.steals, s.blocks].filter(v => v >= 10).length >= 2;
    const isTripleDouble = [pts, reb, ast, s.steals, s.blocks].filter(v => v >= 10).length >= 3;
    // Simple efficiency: (PTS + REB + AST + STL + BLK - TOV - missed FG) / minutes
    const minsNum = parseFloat(mins.replace(":", ".")) || 0;
    const eff = minsNum > 10 ? (pts + reb + ast + s.steals + s.blocks - s.turnovers - (s.fieldGoalsAttempted - s.fieldGoalsMade)) / minsNum : 0;
    const isEfficient = eff > 1.2;
    const isInefficient = minsNum > 15 && eff < 0.3;

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
                {isEfficient && <span className="text-[9px] px-1 py-0.5 rounded bg-success/10 text-success">EFF</span>}
                {isInefficient && <span className="text-[9px] px-1 py-0.5 rounded bg-danger/10 text-danger">LOW</span>}
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
            <tr><td colSpan={13} className="py-1.5 px-2 text-xs font-medium text-accent bg-accent/5 sticky left-0">{t.gameDetail.starters}</td></tr>
          )}
          {starters.map(renderRow)}
          {bench.length > 0 && (
            <tr><td colSpan={13} className="py-1.5 px-2 text-xs font-medium text-text-secondary bg-bg-hover/30 sticky left-0">{t.gameDetail.bench}</td></tr>
          )}
          {bench.map(renderRow)}
          {dnp.length > 0 && (
            <tr><td colSpan={13} className="py-1.5 px-2 text-xs text-text-secondary/60 sticky left-0">{t.gameDetail.dnp} {dnp.map((p) => p.nameI).join(", ")}</td></tr>
          )}
          {/* Team Totals */}
          <tr className="border-t-2 border-border bg-bg-secondary/50 font-medium">
            <td className="py-2.5 px-2 sticky left-0 bg-bg-secondary/50 z-10 text-sm font-bold text-text-primary">TEAM</td>
            <td className="text-center py-2.5 px-1 text-sm text-text-secondary">-</td>
            <td className="text-center py-2.5 px-1 text-sm font-bold">{totals.pts}</td>
            <td className="text-center py-2.5 px-1 text-sm">{totals.reb}</td>
            <td className="text-center py-2.5 px-1 text-sm">{totals.ast}</td>
            <td className="text-center py-2.5 px-1 text-sm text-text-secondary">{totals.fgm}-{totals.fga} <span className="text-[9px] text-accent">{totals.fga > 0 ? ((totals.fgm / totals.fga) * 100).toFixed(0) + "%" : ""}</span></td>
            <td className="text-center py-2.5 px-1 text-sm text-text-secondary">{totals.tpm}-{totals.tpa} <span className="text-[9px] text-accent">{totals.tpa > 0 ? ((totals.tpm / totals.tpa) * 100).toFixed(0) + "%" : ""}</span></td>
            <td className="text-center py-2.5 px-1 text-sm text-text-secondary">{totals.ftm}-{totals.fta} <span className="text-[9px] text-accent">{totals.fta > 0 ? ((totals.ftm / totals.fta) * 100).toFixed(0) + "%" : ""}</span></td>
            <td className="text-center py-2.5 px-1 text-sm">{totals.stl}</td>
            <td className="text-center py-2.5 px-1 text-sm">{totals.blk}</td>
            <td className="text-center py-2.5 px-1 text-sm">{totals.tov}</td>
            <td className="text-center py-2.5 px-1 text-sm">{totals.pf}</td>
            <td className="text-center py-2.5 px-1 text-sm text-text-secondary">-</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ShotChartSection({ shots, homeTricode, awayTricode, allPlayers, t }: {
  shots: ShotAction[]; homeTricode: string; awayTricode: string;
  allPlayers: { personId: number; nameI: string; teamTricode: string }[];
  t: Translations;
}) {
  if (shots.length === 0) return null;
  return (
    <div className="bg-bg-card rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-accent rounded-full" />
        {t.gameDetail.shotChart}
      </h3>
      <ShotChart shots={shots} homeTricode={homeTricode} awayTricode={awayTricode} players={allPlayers} />
      <div className="mt-4 pt-4 border-t border-border">
        <ShotHeatmap shots={shots} />
      </div>
    </div>
  );
}

function PlayByPlaySection({ actions }: { actions: Record<string, unknown>[] }) {
  if (actions.length === 0) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <PlayByPlay actions={actions as any} />;
}

async function ReplaySection({ gameId, t }: { gameId: string; t: Translations }) {
  const replayLinks = await getReplayLinks(gameId).catch(() => []);
  if (replayLinks.length === 0) return null;
  return (
    <div className="bg-bg-card rounded-xl border border-accent/30 p-4 mt-4">
      <h3 className="text-sm font-semibold text-accent flex items-center gap-1.5 mb-3">
        <Play size={14} fill="currentColor" />
        {t.gameDetail.gameReplay}
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

function GameSummary({ homeTeam, awayTeam, shots, t }: { homeTeam: BoxScoreTeam; awayTeam: BoxScoreTeam; shots: ShotAction[]; t: Translations }) {
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

  // Find top assist man from each team
  const getTopAssist = (team: BoxScoreTeam) => {
    const played = team.players.filter((p) => p.played === "1");
    if (played.length === 0) return null;
    return played.reduce((best, p) => p.statistics.assists > best.statistics.assists ? p : best);
  };
  const homeTopAssist = getTopAssist(homeTeam);
  const awayTopAssist = getTopAssist(awayTeam);
  const homeSpecial = getSpecialPerformances(homeTeam);
  const awaySpecial = getSpecialPerformances(awayTeam);
  const homeLargestLead = getLargestLead(homeTeam, awayTeam);
  const awayLargestLead = getLargestLead(awayTeam, homeTeam);

  // Feature 1: Biggest scoring run from shots data
  const biggestRun = (() => {
    if (shots.length === 0) return null;
    const madeShots = shots.filter(s => s.shotResult === "Made").sort((a, b) => {
      if (a.period !== b.period) return a.period - b.period;
      // clock is descending within a period (12:00 -> 0:00), so reverse compare
      return (b.clock || "").localeCompare(a.clock || "");
    });
    let bestRun = { team: "", points: 0, period: 0 };
    let currentTeam = "";
    let currentPoints = 0;
    let currentPeriod = 0;
    for (const shot of madeShots) {
      const teamKey = shot.teamTricode;
      const is3 = shot.subType?.toLowerCase().includes("3pt") || shot.shotDistance > 22;
      const pts = is3 ? 3 : 2;
      if (teamKey === currentTeam) {
        currentPoints += pts;
      } else {
        if (currentPoints > bestRun.points) {
          bestRun = { team: currentTeam, points: currentPoints, period: currentPeriod };
        }
        currentTeam = teamKey;
        currentPoints = pts;
        currentPeriod = shot.period;
      }
    }
    if (currentPoints > bestRun.points) {
      bestRun = { team: currentTeam, points: currentPoints, period: currentPeriod };
    }
    if (bestRun.points < 4) return null;
    const qLabel = bestRun.period <= 4 ? `Q${bestRun.period}` : `OT${bestRun.period - 4}`;
    return { teamTricode: bestRun.team, points: bestRun.points, qLabel };
  })();

  // Pace indicator
  const totalPoints = homeTeam.score + awayTeam.score;
  const numPeriods = Math.max(homeTeam.periods?.length || 4, 4);
  const pacePerQ = numPeriods > 0 ? totalPoints / numPeriods : 0;
  const paceLabel = pacePerQ > 55 ? "Fast Pace" : pacePerQ < 45 ? "Slow" : "Normal";
  const paceColor = pacePerQ > 55 ? "text-success bg-success/10" : pacePerQ < 45 ? "text-yellow-400 bg-yellow-400/10" : "text-text-secondary bg-bg-hover";

  // Feature 7: Team foul comparison
  const homeFouls = homeTeam.players.filter(p => p.played === "1").reduce((s, p) => s + p.statistics.foulsPersonal, 0);
  const awayFouls = awayTeam.players.filter(p => p.played === "1").reduce((s, p) => s + p.statistics.foulsPersonal, 0);

  return (
    <div className="bg-bg-card rounded-xl border border-border p-4 mt-4">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <span className="w-1 h-4 bg-accent rounded-full" />
        {t.gameDetail.gameSummary}
      </h3>
      {/* Game Hero */}
      {(() => {
        const allPlayed = [...homeTeam.players, ...awayTeam.players].filter(p => p.played === "1");
        if (allPlayed.length === 0) return null;
        const hero = allPlayed.reduce((best, p) => {
          const score = p.statistics.points + p.statistics.reboundsTotal * 1.2 + p.statistics.assists * 1.5;
          const bestScore = best.statistics.points + best.statistics.reboundsTotal * 1.2 + best.statistics.assists * 1.5;
          return score > bestScore ? p : best;
        });
        return (
          <div className="bg-accent/5 border border-accent/20 rounded-lg px-4 py-2.5 mb-3 flex items-center gap-2">
            <span className="text-accent text-sm">&#9733;</span>
            <span className="text-sm">
              <span className="font-bold text-accent">{hero.nameI}</span>
              <span className="text-text-secondary ml-2">{hero.statistics.points} PTS · {hero.statistics.reboundsTotal} REB · {hero.statistics.assists} AST</span>
            </span>
          </div>
        );
      })()}
      {/* Pace Indicator */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary rounded-lg text-xs mb-3">
        <span className="text-text-secondary">{t.gameDetail.pace}</span>
        <span className={`font-bold px-1.5 py-0.5 rounded ${paceColor}`}>{paceLabel}</span>
        <span className="text-text-secondary">({pacePerQ.toFixed(1)} {t.gameDetail.ptsPerQ})</span>
      </div>
      {/* Biggest Run & Foul Comparison */}
      <div className="flex flex-wrap gap-3 mb-3">
        {biggestRun && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary rounded-lg text-xs">
            <span className="text-text-secondary">{t.gameDetail.biggestRun}</span>
            <span className="font-bold text-accent">{biggestRun.teamTricode} {biggestRun.points}-0</span>
            <span className="text-text-secondary">in {biggestRun.qLabel}</span>
          </div>
        )}
        {/* AST/TO Ratio */}
        {(() => {
          const awayAST = awayTeam.players.filter(p => p.played === "1").reduce((s, p) => s + p.statistics.assists, 0);
          const awayTO = awayTeam.players.filter(p => p.played === "1").reduce((s, p) => s + p.statistics.turnovers, 0);
          const homeAST = homeTeam.players.filter(p => p.played === "1").reduce((s, p) => s + p.statistics.assists, 0);
          const homeTO = homeTeam.players.filter(p => p.played === "1").reduce((s, p) => s + p.statistics.turnovers, 0);
          const awayRatio = awayTO > 0 ? (awayAST / awayTO).toFixed(2) : "-";
          const homeRatio = homeTO > 0 ? (homeAST / homeTO).toFixed(2) : "-";
          return (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary rounded-lg text-xs">
              <span className="text-text-secondary">{t.gameDetail.astTo}</span>
              <span className="font-bold text-text-primary">{awayTeam.teamTricode} {awayRatio}</span>
              <span className="text-text-secondary">-</span>
              <span className="font-bold text-text-primary">{homeRatio} {homeTeam.teamTricode}</span>
            </div>
          );
        })()}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary rounded-lg text-xs">
          <span className="text-text-secondary">{t.gameDetail.fouls}</span>
          <span className={`font-bold ${awayFouls > homeFouls ? "text-danger" : "text-text-primary"}`}>{awayTeam.teamTricode} {awayFouls}</span>
          <span className="text-text-secondary">-</span>
          <span className={`font-bold ${homeFouls > awayFouls ? "text-danger" : "text-text-primary"}`}>{homeFouls} {homeTeam.teamTricode}</span>
        </div>
      </div>
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
                  {p.name}: {p.isTriple ? t.gameDetail.tripleDouble : t.gameDetail.doubleDouble} ({p.pts}/{p.reb}/{p.ast})
                </span>
              ))}
            </div>
          )}
          {awayTopAssist && awayTopAssist.personId !== awayTopScorer?.personId && awayTopAssist.statistics.assists >= 5 && (
            <p className="text-text-secondary text-xs mt-0.5">
              {t.gameDetail.dimes} <span className="text-text-primary font-medium">{awayTopAssist.nameI}</span> {awayTopAssist.statistics.assists} AST
            </p>
          )}
          {awayLargestLead > 0 && (
            <p className="text-xs text-text-secondary mt-1">{t.gameDetail.largestLead} {awayLargestLead} pts</p>
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
          {homeTopAssist && homeTopAssist.personId !== homeTopScorer?.personId && homeTopAssist.statistics.assists >= 5 && (
            <p className="text-text-secondary text-xs mt-0.5">
              {t.gameDetail.dimes} <span className="text-text-primary font-medium">{homeTopAssist.nameI}</span> {homeTopAssist.statistics.assists} AST
            </p>
          )}
          {homeSpecial.length > 0 && (
            <div className="mt-1">
              {homeSpecial.map((p) => (
                <span key={p.name} className={`inline-block text-[10px] px-1.5 py-0.5 rounded mr-1 ${p.isTriple ? "bg-accent/20 text-accent" : "bg-accent/10 text-accent"}`}>
                  {p.name}: {p.isTriple ? t.gameDetail.tripleDouble : t.gameDetail.doubleDouble} ({p.pts}/{p.reb}/{p.ast})
                </span>
              ))}
            </div>
          )}
          {homeLargestLead > 0 && (
            <p className="text-xs text-text-secondary mt-1">{t.gameDetail.largestLead} {homeLargestLead} pts</p>
          )}
        </div>
      </div>
    </div>
  );
}

function KeyMomentsSection({ actions }: { actions: Record<string, unknown>[] }) {
  if (actions.length === 0) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <KeyMoments actions={actions as any} />;
}

export default async function GamePage({ params }: PageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const t = getTranslations(locale);

  // Fetch boxScore + shots + playerIndex + full PBP in parallel
  const [boxScore, shots, playerIndex, pbpActions] = await Promise.all([
    getBoxScore(id),
    getPlayByPlay(id).catch(() => []),
    getPlayerIndex().catch(() => []),
    fetch(`https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${id}.json`, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.nba.com/" },
      next: { revalidate: 60 },
    }).then(r => r.ok ? r.json() : null).then(d => d?.game?.actions || []).catch(() => []),
  ]);
  // Extract score events from PBP for ScoringFlow
  const scoreEvents = (pbpActions as { period: number; clock: string; scoreHome: string; scoreAway: string }[])
    .filter((a: { scoreHome: string; scoreAway: string }) => a.scoreHome != null && a.scoreAway != null)
    .map((a: { period: number; clock: string; scoreHome: string; scoreAway: string }) => ({
      period: a.period, clock: a.clock,
      scoreHome: parseInt(a.scoreHome) || 0,
      scoreAway: parseInt(a.scoreAway) || 0,
    }));

  const playerInfoMap = new Map<number, PlayerInfo>();
  for (const pi of playerIndex) {
    playerInfoMap.set(pi.personId, pi);
  }

  if (!boxScore) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Link href="/" className="text-sm text-text-secondary hover:text-accent transition-colors">&larr; {t.common.back}</Link>
        <div className="flex flex-col items-center justify-center py-24 text-text-secondary">
          <p className="text-lg">{t.gameDetail.boxScoreNotAvailable}</p>
          <p className="text-sm mt-1">{t.gameDetail.gameNotStarted}</p>
        </div>
      </div>
    );
  }

  const isFinal = boxScore.gameStatus === 3;
  const homeWon = boxScore.homeTeam.score > boxScore.awayTeam.score;
  const scoreDiff = Math.abs(boxScore.homeTeam.score - boxScore.awayTeam.score);
  const isCloseGame = isFinal && scoreDiff <= 5;
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
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Link href="/" className="hover:text-accent transition-colors">{t.common.home}</Link>
        <span>/</span>
        <Link href={`/?date=${backDate}`} className="hover:text-accent transition-colors">{backDate}</Link>
        <span>/</span>
        <span className="text-text-primary">{boxScore.awayTeam.teamTricode} {t.common.vs} {boxScore.homeTeam.teamTricode}</span>
      </nav>
      <GameAutoRefresh isLive={boxScore.gameStatus === 2} />

      {/* Scoreboard — renders immediately */}
      <div className="bg-bg-card rounded-xl border border-border p-6 mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {isPlayoffs && <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">{t.common.playoffs}</span>}
            {isCloseGame && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-danger/15 text-danger font-medium">{t.gameDetail.thriller}</span>
            )}
            {isFinal && scoreDiff >= 20 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-500 font-medium">{t.gameDetail.blowout}</span>
            )}
            {boxScore.homeTeam.periods?.length > 4 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-500 font-medium">
                {boxScore.homeTeam.periods.length - 4}{t.gameDetail.ot}
              </span>
            )}
            <span className="text-xs text-text-secondary">{boxScore.arena.arenaName}, {boxScore.arena.arenaCity}</span>
            {beijingTime && <span className="text-xs text-text-secondary">&middot; {t.common.beijingTime} {beijingTime}</span>}
            {isFinal && (() => {
              const periodsCount = boxScore.homeTeam.periods?.length || 4;
              const otPeriods = Math.max(periodsCount - 4, 0);
              const durationMin = 150 + otPeriods * 5; // ~2.5h regulation + 5min per OT
              const hours = Math.floor(durationMin / 60);
              const mins = durationMin % 60;
              return (
                <span className="text-xs text-text-secondary">&middot; ~{hours}h{mins > 0 ? `${mins}m` : ""}</span>
              );
            })()}
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
            {/* Lead Changes count */}
            {isFinal && (() => {
              let leadChanges = 0;
              let homeCum = 0;
              let awayCum = 0;
              let prevLeader: "home" | "away" | "tie" = "tie";
              for (let i = 0; i < boxScore.homeTeam.periods.length; i++) {
                homeCum += boxScore.homeTeam.periods[i]?.score || 0;
                awayCum += boxScore.awayTeam.periods[i]?.score || 0;
                const leader = homeCum > awayCum ? "home" : awayCum > homeCum ? "away" : "tie";
                if (leader !== "tie" && leader !== prevLeader && prevLeader !== "tie") {
                  leadChanges++;
                }
                if (leader !== "tie") prevLeader = leader;
              }
              return (
                <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-text-secondary">
                  <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 font-medium">Lead Changes: {leadChanges}</span>
                </div>
              );
            })()}
            {/* Quarter MVP - best player in highest-scoring quarter */}
            {isFinal && shots.length > 0 && (() => {
              // Calculate per-quarter scoring from made shots
              const quarterScoring: Record<number, Record<string, { name: string; pts: number }>> = {};
              for (const shot of shots) {
                if (shot.shotResult !== "Made") continue;
                const period = shot.period;
                if (!quarterScoring[period]) quarterScoring[period] = {};
                if (!quarterScoring[period][shot.personId]) {
                  quarterScoring[period][shot.personId] = { name: shot.playerNameI, pts: 0 };
                }
                // Estimate points: 3-pointer if subType contains "3pt" or distance > 22ft, else 2
                const is3 = shot.subType?.toLowerCase().includes("3pt") || shot.shotDistance > 22;
                quarterScoring[period][shot.personId].pts += is3 ? 3 : 2;
              }
              // Find highest-scoring quarter
              let bestQuarter = 0;
              let bestQuarterTotal = 0;
              for (const [q, players] of Object.entries(quarterScoring)) {
                const total = Object.values(players).reduce((s, p) => s + p.pts, 0);
                if (total > bestQuarterTotal) { bestQuarterTotal = total; bestQuarter = parseInt(q); }
              }
              if (bestQuarter === 0) return null;
              // Find best player in that quarter
              const qPlayers = quarterScoring[bestQuarter];
              let mvpName = "";
              let mvpPts = 0;
              for (const p of Object.values(qPlayers)) {
                if (p.pts > mvpPts) { mvpPts = p.pts; mvpName = p.name; }
              }
              if (!mvpName) return null;
              const qLabel = bestQuarter <= 4 ? `Q${bestQuarter}` : `OT${bestQuarter - 4}`;
              return (
                <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-text-secondary">
                  <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">{qLabel} {t.gameDetail.mvp}</span>
                  <span className="font-medium text-text-primary">{mvpName}</span>
                  <span>({mvpPts} pts from FG in highest-scoring quarter)</span>
                </div>
              );
            })()}
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

      {/* Quarter Bars + Scoring Flow */}
      {isFinal && boxScore.homeTeam.periods?.length > 0 && (
        <QuarterBars
          homePeriods={boxScore.homeTeam.periods}
          awayPeriods={boxScore.awayTeam.periods}
          homeTricode={boxScore.homeTeam.teamTricode}
          awayTricode={boxScore.awayTeam.teamTricode}
        />
      )}
      {isFinal && boxScore.homeTeam.periods?.length > 0 && (
        <ScoringFlow
          homePeriods={boxScore.homeTeam.periods}
          awayPeriods={boxScore.awayTeam.periods}
          homeTricode={boxScore.homeTeam.teamTricode}
          awayTricode={boxScore.awayTeam.teamTricode}
          scoreEvents={scoreEvents}
        />
      )}

      {/* Pace & Bench Scoring — quick insights */}
      {isFinal && (() => {
        const totalPts = boxScore.homeTeam.score + boxScore.awayTeam.score;
        const periodsCount = boxScore.homeTeam.periods?.length || 4;
        const otPeriods = Math.max(periodsCount - 4, 0);
        const pace = Math.round(totalPts / (48 + otPeriods * 5) * 48); // normalize to 48 min

        const benchPts = (team: BoxScoreTeam) =>
          team.players.filter((p) => p.starter !== "1" && p.played === "1")
            .reduce((s, p) => s + p.statistics.points, 0);
        const homeBench = benchPts(boxScore.homeTeam);
        const awayBench = benchPts(boxScore.awayTeam);

        const homeFTA = boxScore.homeTeam.players.filter(p => p.played === "1").reduce((s, p) => s + p.statistics.freeThrowsAttempted, 0);
        const awayFTA = boxScore.awayTeam.players.filter(p => p.played === "1").reduce((s, p) => s + p.statistics.freeThrowsAttempted, 0);

        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="bg-bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-accent">{pace}</p>
              <p className="text-[10px] text-text-secondary uppercase">{t.gameDetail.estPace}</p>
            </div>
            <div className="bg-bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-text-primary">{totalPts}</p>
              <p className="text-[10px] text-text-secondary uppercase">{t.gameDetail.totalPoints}</p>
            </div>
            <div className="bg-bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-sm font-bold">
                <span className="text-text-secondary">{boxScore.awayTeam.teamTricode}</span>{" "}
                <span className="text-accent">{awayBench}</span>
                <span className="text-text-secondary mx-1">-</span>
                <span className="text-accent">{homeBench}</span>{" "}
                <span className="text-text-secondary">{boxScore.homeTeam.teamTricode}</span>
              </p>
              <p className="text-[10px] text-text-secondary uppercase">{t.gameDetail.benchPoints}</p>
            </div>
            <div className="bg-bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-sm font-bold">
                <span className="text-text-secondary">{boxScore.awayTeam.teamTricode}</span>{" "}
                <span className={awayFTA > homeFTA ? "text-accent" : "text-text-primary"}>{awayFTA}</span>
                <span className="text-text-secondary mx-1">-</span>
                <span className={homeFTA > awayFTA ? "text-accent" : "text-text-primary"}>{homeFTA}</span>{" "}
                <span className="text-text-secondary">{boxScore.homeTeam.teamTricode}</span>
              </p>
              <p className="text-[10px] text-text-secondary uppercase">{t.gameDetail.freeThrowAtt}</p>
            </div>
          </div>
        );
      })()}

      {/* Game Summary — right after scoreboard for final games */}
      {isFinal && (
        <GameSummary homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} shots={shots} t={t} />
      )}

      {/* Player Ratings — for final games */}
      {isFinal && (() => {
        const allPlayedPlayers = [
          ...boxScore.awayTeam.players.filter(p => p.played === "1").map(p => ({ ...p, teamTricode: boxScore.awayTeam.teamTricode })),
          ...boxScore.homeTeam.players.filter(p => p.played === "1").map(p => ({ ...p, teamTricode: boxScore.homeTeam.teamTricode })),
        ];
        const scored = allPlayedPlayers.map(p => {
          const s = p.statistics;
          const gameScore = s.points + 0.4 * s.fieldGoalsMade - 0.7 * s.fieldGoalsAttempted + 0.3 * s.freeThrowsMade + s.reboundsTotal + s.steals + s.blocks - 0.7 * s.turnovers;
          return { name: p.nameI, teamTricode: p.teamTricode, gameScore: Math.round(gameScore * 10) / 10 };
        }).sort((a, b) => b.gameScore - a.gameScore).slice(0, 5);
        if (scored.length === 0) return null;
        return (
          <div className="bg-bg-card rounded-xl border border-border p-4 mt-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <span className="w-1 h-4 bg-accent rounded-full" />
              {t.gameDetail.playerRatings}
            </h3>
            <div className="space-y-2">
              {scored.map((p, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 bg-bg-secondary rounded-lg">
                  <span className={`text-sm font-bold w-6 text-center ${i === 0 ? "text-accent" : "text-text-secondary"}`}>#{i + 1}</span>
                  <span className="text-sm font-medium text-text-primary flex-1">{p.name}</span>
                  <span className="text-[10px] text-text-secondary">{p.teamTricode}</span>
                  <span className={`text-sm font-bold tabular-nums ${i === 0 ? "text-accent" : "text-text-primary"}`}>{p.gameScore}</span>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-text-secondary mt-2">Game Score = PTS + 0.4*FG - 0.7*FGA + 0.3*FT + REB + STL + BLK - 0.7*TO</p>
          </div>
        );
      })()}

      {/* Replay links — streamed */}
      <Suspense fallback={null}>
        <ReplaySection gameId={id} t={t} />
      </Suspense>

      {/* Team Stats Comparison */}
      {isFinal && (
        <div className="mt-6">
          <TeamCompare homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} />
        </div>
      )}

      {/* Radar Chart */}
      {isFinal && boxScore.homeTeam.statistics && boxScore.awayTeam.statistics && (() => {
        const hStats = boxScore.homeTeam.statistics as Record<string, number>;
        const aStats = boxScore.awayTeam.statistics as Record<string, number>;
        return (
          <div className="mt-6 bg-bg-card rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-accent rounded-full" />
              {t.gameDetail.statsRadar}
            </h3>
            <div className="flex justify-center">
              <RadarChart
                homeLabel={boxScore.homeTeam.teamTricode}
                awayLabel={boxScore.awayTeam.teamTricode}
                stats={[
                  { label: "FG%", home: (hStats.fieldGoalsPercentage ?? 0) * 100, away: (aStats.fieldGoalsPercentage ?? 0) * 100, max: 70 },
                  { label: "3P%", home: (hStats.threePointersPercentage ?? 0) * 100, away: (aStats.threePointersPercentage ?? 0) * 100, max: 60 },
                  { label: "REB", home: hStats.reboundsTotal ?? 0, away: aStats.reboundsTotal ?? 0, max: 70 },
                  { label: "AST", home: hStats.assists ?? 0, away: aStats.assists ?? 0, max: 40 },
                  { label: "STL", home: hStats.steals ?? 0, away: aStats.steals ?? 0, max: 20 },
                  { label: "BLK", home: hStats.blocks ?? 0, away: aStats.blocks ?? 0, max: 15 },
                ]}
              />
            </div>
          </div>
        );
      })()}

      {/* Shooting Efficiency */}
      {isFinal && boxScore.homeTeam.statistics && boxScore.awayTeam.statistics && (() => {
        const hStats = boxScore.homeTeam.statistics as Record<string, number>;
        const aStats = boxScore.awayTeam.statistics as Record<string, number>;
        const metrics = [
          { label: "FG%", home: (hStats.fieldGoalsPercentage ?? 0) * 100, away: (aStats.fieldGoalsPercentage ?? 0) * 100 },
          { label: "3P%", home: (hStats.threePointersPercentage ?? 0) * 100, away: (aStats.threePointersPercentage ?? 0) * 100 },
          { label: "FT%", home: (hStats.freeThrowsPercentage ?? 0) * 100, away: (aStats.freeThrowsPercentage ?? 0) * 100 },
        ];
        return (
          <div className="mt-6 bg-bg-card rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-accent rounded-full" />
              {t.gameDetail.shootingEfficiency}
            </h3>
            <div className="space-y-4">
              {metrics.map((m) => (
                <div key={m.label}>
                  <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                    <span>{boxScore.awayTeam.teamTricode} {m.away.toFixed(1)}%</span>
                    <span className="font-medium text-text-primary">{m.label}</span>
                    <span>{m.home.toFixed(1)}% {boxScore.homeTeam.teamTricode}</span>
                  </div>
                  <div className="flex gap-1 h-4">
                    <div className="flex-1 flex justify-end">
                      <div
                        className={`h-full rounded-l-full ${m.away >= m.home ? "bg-accent" : "bg-bg-hover"}`}
                        style={{ width: `${Math.min(m.away, 100)}%` }}
                      />
                    </div>
                    <div className="flex-1">
                      <div
                        className={`h-full rounded-r-full ${m.home >= m.away ? "bg-accent" : "bg-bg-hover"}`}
                        style={{ width: `${Math.min(m.home, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Key Moments */}
      {isFinal && <KeyMomentsSection actions={pbpActions as Record<string, unknown>[]} />}

      {/* Shot Chart + Box Score + Play-by-Play */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shot Chart */}
        <div className="lg:col-span-1 space-y-6">
          <ShotChartSection shots={shots} homeTricode={boxScore.homeTeam.teamTricode} awayTricode={boxScore.awayTeam.teamTricode} allPlayers={allPlayers} t={t} />
        </div>

        {/* Box Score Tables — immediate */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <TeamLogo teamId={boxScore.awayTeam.teamId} tricode={boxScore.awayTeam.teamTricode} size={24} />
              <h2 className="font-semibold">{boxScore.awayTeam.teamCity} {boxScore.awayTeam.teamName}</h2>
              <span className="text-text-secondary text-sm ml-auto">{boxScore.awayTeam.score} pts</span>
            </div>
            <StatsTable players={boxScore.awayTeam.players} shots={shots} playerInfoMap={playerInfoMap} t={t} />
          </div>
          <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <TeamLogo teamId={boxScore.homeTeam.teamId} tricode={boxScore.homeTeam.teamTricode} size={24} />
              <h2 className="font-semibold">{boxScore.homeTeam.teamCity} {boxScore.homeTeam.teamName}</h2>
              <span className="text-text-secondary text-sm ml-auto">{boxScore.homeTeam.score} pts</span>
            </div>
            <StatsTable players={boxScore.homeTeam.players} shots={shots} playerInfoMap={playerInfoMap} t={t} />
          </div>
        </div>
      </div>

      {/* Play-by-Play Timeline */}
      <div className="mt-6">
        <PlayByPlaySection actions={pbpActions as Record<string, unknown>[]} />
      </div>
    </div>
  );
}

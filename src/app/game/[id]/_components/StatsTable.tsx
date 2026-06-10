import dynamic from "next/dynamic";
import { parseMinutes, type PlayerStats, type ShotAction, type PlayerInfo } from "@/lib/api";
import type { Translations } from "@/locales";

const NamePlaceholder = () => <span className="skeleton-shimmer inline-block h-4 w-24 rounded" />;
const PlayerShotChart = dynamic(() => import("@/components/PlayerShotChart"), { loading: NamePlaceholder });

export default function StatsTable({
  players,
  shots,
  playerInfoMap,
  t,
}: {
  players: PlayerStats[];
  shots: ShotAction[];
  playerInfoMap: Map<number, PlayerInfo>;
  t: Translations;
}) {
  const starters = players.filter((p) => p.starter === "1");
  const bench = players.filter((p) => p.starter !== "1" && p.played === "1");
  const dnp = players.filter((p) => p.played !== "1" && p.starter !== "1");
  const played = players.filter((p) => p.played === "1");

  const totals = played.reduce(
    (acc, p) => {
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
    },
    { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 },
  );

  const renderRow = (p: PlayerStats) => {
    const s = p.statistics;
    const mins = parseMinutes(s.minutes);
    const pts = s.points;
    const reb = s.reboundsTotal;
    const ast = s.assists;
    const isDoubleDouble = [pts, reb, ast, s.steals, s.blocks].filter((v) => v >= 10).length >= 2;
    const isTripleDouble = [pts, reb, ast, s.steals, s.blocks].filter((v) => v >= 10).length >= 3;
    // Simple efficiency: (PTS + REB + AST + STL + BLK - TOV - missed FG) / minutes
    const minsNum = parseFloat(mins.replace(":", ".")) || 0;
    const eff =
      minsNum > 10
        ? (pts + reb + ast + s.steals + s.blocks - s.turnovers - (s.fieldGoalsAttempted - s.fieldGoalsMade)) / minsNum
        : 0;
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
          {s.plusMinusPoints > 0 ? "+" : ""}
          {s.plusMinusPoints}
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
            <tr>
              <td colSpan={13} className="py-1.5 px-2 text-xs font-medium text-accent bg-accent/5 sticky left-0">
                {t.gameDetail.starters}
              </td>
            </tr>
          )}
          {starters.map(renderRow)}
          {bench.length > 0 && (
            <tr>
              <td colSpan={13} className="py-1.5 px-2 text-xs font-medium text-text-secondary bg-bg-hover/30 sticky left-0">
                {t.gameDetail.bench}
              </td>
            </tr>
          )}
          {bench.map(renderRow)}
          {dnp.length > 0 && (
            <tr>
              <td colSpan={13} className="py-1.5 px-2 text-xs text-text-secondary/60 sticky left-0">
                {t.gameDetail.dnp} {dnp.map((p) => p.nameI).join(", ")}
              </td>
            </tr>
          )}
          <tr className="border-t-2 border-border bg-bg-secondary/50 font-medium">
            <td className="py-2.5 px-2 sticky left-0 bg-bg-secondary/50 z-10 text-sm font-bold text-text-primary">TEAM</td>
            <td className="text-center py-2.5 px-1 text-sm text-text-secondary">-</td>
            <td className="text-center py-2.5 px-1 text-sm font-bold">{totals.pts}</td>
            <td className="text-center py-2.5 px-1 text-sm">{totals.reb}</td>
            <td className="text-center py-2.5 px-1 text-sm">{totals.ast}</td>
            <td className="text-center py-2.5 px-1 text-sm text-text-secondary">
              {totals.fgm}-{totals.fga} <span className="text-[9px] text-accent">{totals.fga > 0 ? ((totals.fgm / totals.fga) * 100).toFixed(0) + "%" : ""}</span>
            </td>
            <td className="text-center py-2.5 px-1 text-sm text-text-secondary">
              {totals.tpm}-{totals.tpa} <span className="text-[9px] text-accent">{totals.tpa > 0 ? ((totals.tpm / totals.tpa) * 100).toFixed(0) + "%" : ""}</span>
            </td>
            <td className="text-center py-2.5 px-1 text-sm text-text-secondary">
              {totals.ftm}-{totals.fta} <span className="text-[9px] text-accent">{totals.fta > 0 ? ((totals.ftm / totals.fta) * 100).toFixed(0) + "%" : ""}</span>
            </td>
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

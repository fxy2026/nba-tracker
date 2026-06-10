"use client";

import { memo } from "react";
import type { PeriodScore } from "@/lib/api";
import TeamLogo from "./TeamLogo";
import { useLocale } from "@/components/LocaleProvider";

interface Props {
  homeTeam: { teamId: number; teamTricode: string; teamCity: string; teamName: string; score: number; periods: PeriodScore[] };
  awayTeam: { teamId: number; teamTricode: string; teamCity: string; teamName: string; score: number; periods: PeriodScore[] };
  /** Tight paddings, smaller type, no halftime/best-quarter footnotes — for embedding inside GameCard */
  compact?: boolean;
}

export default memo(function QuarterScores({ homeTeam, awayTeam, compact }: Props) {
  const { t } = useLocale();
  const periods = Math.max(homeTeam.periods.length, awayTeam.periods.length);
  if (periods === 0) return null;

  // Compute halftime scores
  const homeHalf = homeTeam.periods.slice(0, 2).reduce((s, p) => s + p.score, 0);
  const awayHalf = awayTeam.periods.slice(0, 2).reduce((s, p) => s + p.score, 0);
  const showHalftime = periods >= 4;

  // Find best quarter (highest combined score)
  let bestQuarterIdx = -1;
  let bestQuarterTotal = 0;
  for (let i = 0; i < homeTeam.periods.length; i++) {
    const total = (homeTeam.periods[i]?.score || 0) + (awayTeam.periods[i]?.score || 0);
    if (total > bestQuarterTotal) { bestQuarterTotal = total; bestQuarterIdx = i; }
  }

  const teamCell = compact ? "py-1 px-1.5" : "py-2.5 px-3";
  const scoreCell = compact ? "py-1 px-1" : "py-2.5 px-2";

  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${compact ? "text-xs" : "text-sm"}`}>
        <thead>
          <tr className="border-b border-border text-text-secondary text-[10px] font-mono uppercase tracking-[0.15em]">
            <th className={`text-left ${teamCell} ${compact ? "" : "min-w-[140px]"}`}>{t.common.team}</th>
            {homeTeam.periods.map((p, i) => (
              <th key={i} className={`text-center ${scoreCell} ${compact ? "w-7" : "w-12"} ${i === bestQuarterIdx ? "text-accent-amber font-bold" : ""}`}>
                {p.periodType === "OVERTIME" ? `${t.playByPlayComp.overtime}${p.period - 4}` : `${t.playByPlayComp.quarter}${p.period}`}
              </th>
            ))}
            <th className={`text-center ${teamCell} font-bold ${compact ? "w-9" : "w-14"} text-text-primary`}>{t.gameDetail.total}</th>
          </tr>
        </thead>
        <tbody>
          {/* Away team */}
          <tr className="border-b border-border/30 hover:bg-bg-hover/30">
            <td className={teamCell}>
              <div className="flex items-center gap-2">
                <TeamLogo teamId={awayTeam.teamId} tricode={awayTeam.teamTricode} size={compact ? 16 : 20} />
                <span className={`font-medium ${compact ? "text-xs" : "text-sm"}`}>{awayTeam.teamTricode}</span>
              </div>
            </td>
            {awayTeam.periods.map((p, i) => {
              const homeQ = homeTeam.periods[i]?.score || 0;
              const won = p.score > homeQ;
              return (
                <td key={i} className={`text-center ${scoreCell} font-mono tabular-nums ${won ? "text-text-primary font-semibold" : "text-text-secondary"}`}>
                  {p.score}
                </td>
              );
            })}
            <td className={`text-center ${teamCell} font-mono tabular-nums font-bold ${awayTeam.score > homeTeam.score ? "text-accent" : ""}`}>
              {awayTeam.score}
            </td>
          </tr>

          {/* Home team */}
          <tr className="hover:bg-bg-hover/30">
            <td className={teamCell}>
              <div className="flex items-center gap-2">
                <TeamLogo teamId={homeTeam.teamId} tricode={homeTeam.teamTricode} size={compact ? 16 : 20} />
                <span className={`font-medium ${compact ? "text-xs" : "text-sm"}`}>{homeTeam.teamTricode}</span>
              </div>
            </td>
            {homeTeam.periods.map((p, i) => {
              const awayQ = awayTeam.periods[i]?.score || 0;
              const won = p.score > awayQ;
              return (
                <td key={i} className={`text-center ${scoreCell} font-mono tabular-nums ${won ? "text-text-primary font-semibold" : "text-text-secondary"}`}>
                  {p.score}
                </td>
              );
            })}
            <td className={`text-center ${teamCell} font-mono tabular-nums font-bold ${homeTeam.score > awayTeam.score ? "text-accent" : ""}`}>
              {homeTeam.score}
            </td>
          </tr>
        </tbody>
      </table>
      {/* Halftime score */}
      {!compact && showHalftime && (
        <div className="flex items-center justify-center gap-3 mt-2 text-[10px] text-text-secondary">
          <span>{t.quarterScores.halftime}{awayTeam.teamTricode} <span className={awayHalf > homeHalf ? "font-bold text-accent" : ""}>{awayHalf}</span> - <span className={homeHalf > awayHalf ? "font-bold text-accent" : ""}>{homeHalf}</span> {homeTeam.teamTricode}</span>
          {awayHalf !== homeHalf && (
            <span className="px-1.5 py-0.5 rounded bg-bg-hover text-text-secondary">
              {awayHalf > homeHalf ? awayTeam.teamTricode : homeTeam.teamTricode} led by {Math.abs(awayHalf - homeHalf)}
            </span>
          )}
        </div>
      )}
      {/* Best quarter indicator */}
      {!compact && bestQuarterIdx >= 0 && (
        <div className="text-center mt-1 text-[10px] text-text-secondary">
          {t.quarterScores.highestScoring}<span className="text-accent font-medium">{bestQuarterIdx < 4 ? `${t.playByPlayComp.quarter}${bestQuarterIdx + 1}` : `${t.playByPlayComp.overtime}${bestQuarterIdx - 3}`}</span> ({bestQuarterTotal} pts)
        </div>
      )}
    </div>
  );
});

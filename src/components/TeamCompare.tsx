"use client";

import { memo } from "react";
import type { BoxScoreTeam } from "@/lib/api";
import { useLocale } from "@/components/LocaleProvider";

interface Props {
  homeTeam: BoxScoreTeam;
  awayTeam: BoxScoreTeam;
}

export default memo(function TeamCompare({ homeTeam, awayTeam }: Props) {
  const { t } = useLocale();
  const hStats = homeTeam.statistics as Record<string, number>;
  const aStats = awayTeam.statistics as Record<string, number>;

  const STATS = [
    { key: "fieldGoalsPercentage", label: "FG%", fmt: (v: number) => `${(v * 100).toFixed(1)}%` },
    { key: "threePointersPercentage", label: "3P%", fmt: (v: number) => `${(v * 100).toFixed(1)}%` },
    { key: "freeThrowsPercentage", label: "FT%", fmt: (v: number) => `${(v * 100).toFixed(1)}%` },
    { key: "reboundsTotal", label: t.teamCompare.rebounds, fmt: (v: number) => String(v) },
    { key: "assists", label: t.teamCompare.assists, fmt: (v: number) => String(v) },
    { key: "steals", label: t.teamCompare.stealsLabel, fmt: (v: number) => String(v) },
    { key: "blocks", label: t.teamCompare.blocks, fmt: (v: number) => String(v) },
    { key: "turnovers", label: t.teamCompare.turnovers, fmt: (v: number) => String(v) },
    { key: "pointsInThePaint", label: t.teamCompare.paintPts, fmt: (v: number) => String(v) },
    { key: "fastBreakPoints", label: t.teamCompare.fastBreak, fmt: (v: number) => String(v) },
  ] as const;

  if (!hStats || !aStats) return null;

  // Compute per-stat values and category-win counts in a single pass.
  let homeWins = 0, awayWins = 0;
  const rows = STATS.map(({ key, label, fmt }) => {
    const hVal = hStats[key] ?? 0;
    const aVal = aStats[key] ?? 0;
    const isTurnover = key === "turnovers";
    const hBetter = isTurnover ? hVal < aVal : hVal > aVal;
    const aBetter = isTurnover ? aVal < hVal : aVal > hVal;
    if (hBetter) homeWins++;
    else if (aBetter) awayWins++;
    return { key, label, fmt, hVal, aVal, hBetter, aBetter, max: Math.max(hVal, aVal, 0.01) };
  });

  return (
    <div className="glass-tile p-5">
      <div className="mb-4">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ Comparison</p>
        <h3 className="text-sm font-semibold text-text-primary tracking-tight flex items-center gap-2 mt-1">
          <span className="w-1 h-4 bg-accent-amber rounded-full" />
          {t.teamCompare.title}
        </h3>
      </div>
      <div className="flex items-center justify-between mb-4 text-[10px] font-mono uppercase tracking-[0.2em]">
        <span className="text-text-primary font-bold">{awayTeam.teamTricode}</span>
        <span className="text-accent-amber">{t.common.vs}</span>
        <span className="text-text-primary font-bold">{homeTeam.teamTricode}</span>
      </div>
      <div className="space-y-3">
        {rows.map(({ key, label, fmt, hVal, aVal, hBetter, aBetter, max }) => (
          <div key={key}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className={`font-medium font-mono tabular-nums ${aBetter ? "text-accent-amber font-bold" : "text-text-secondary"}`}>{fmt(aVal)}</span>
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary/70">{label}</span>
              <span className={`font-medium font-mono tabular-nums ${hBetter ? "text-accent-amber font-bold" : "text-text-secondary"}`}>{fmt(hVal)}</span>
            </div>
            <div className="flex gap-1 h-1.5">
              <div className="flex-1 flex justify-end">
                <div
                  className={`h-full rounded-l-full transition-all ${aBetter ? "bg-accent-amber" : "bg-bg-hover"}`}
                  style={{ width: `${(aVal / max) * 100}%` }}
                />
              </div>
              <div className="flex-1">
                <div
                  className={`h-full rounded-r-full transition-all ${hBetter ? "bg-accent-amber" : "bg-bg-hover"}`}
                  style={{ width: `${(hVal / max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 pt-3 border-t border-border flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em]">
        <span className={`font-bold ${awayWins > homeWins ? "text-accent-amber" : "text-text-secondary"}`}>
          {awayTeam.teamTricode} <span className="tabular-nums">{awayWins}</span> categories
        </span>
        <span className={`font-bold ${homeWins > awayWins ? "text-accent-amber" : "text-text-secondary"}`}>
          {homeTeam.teamTricode} <span className="tabular-nums">{homeWins}</span> categories
        </span>
      </div>
    </div>
  );
});

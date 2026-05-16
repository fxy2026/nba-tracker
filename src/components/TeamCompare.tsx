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
    <div className="bg-bg-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <span className="w-1 h-4 bg-accent rounded-full" />
        {t.teamCompare.title}
      </h3>
      <div className="flex items-center justify-between mb-4 text-xs font-medium">
        <span className="text-text-primary">{awayTeam.teamTricode}</span>
        <span className="text-text-secondary">{t.common.vs}</span>
        <span className="text-text-primary">{homeTeam.teamTricode}</span>
      </div>
      <div className="space-y-3">
        {rows.map(({ key, label, fmt, hVal, aVal, hBetter, aBetter, max }) => (
          <div key={key}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className={`font-medium tabular-nums ${aBetter ? "text-accent" : "text-text-primary"}`}>{fmt(aVal)}</span>
              <span className="text-text-secondary">{label}</span>
              <span className={`font-medium tabular-nums ${hBetter ? "text-accent" : "text-text-primary"}`}>{fmt(hVal)}</span>
            </div>
            <div className="flex gap-1 h-2">
              <div className="flex-1 flex justify-end">
                <div
                  className={`h-full rounded-l-full transition-all ${aBetter ? "bg-accent" : "bg-bg-hover"}`}
                  style={{ width: `${(aVal / max) * 100}%` }}
                />
              </div>
              <div className="flex-1">
                <div
                  className={`h-full rounded-r-full transition-all ${hBetter ? "bg-accent" : "bg-bg-hover"}`}
                  style={{ width: `${(hVal / max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
        <span className={`font-bold ${awayWins > homeWins ? "text-accent" : "text-text-secondary"}`}>
          {awayTeam.teamTricode}: {awayWins} categories
        </span>
        <span className={`font-bold ${homeWins > awayWins ? "text-accent" : "text-text-secondary"}`}>
          {homeTeam.teamTricode}: {homeWins} categories
        </span>
      </div>
    </div>
  );
});

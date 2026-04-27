import type { BoxScoreTeam } from "@/lib/api";

interface Props {
  homeTeam: BoxScoreTeam;
  awayTeam: BoxScoreTeam;
}

const STATS = [
  { key: "fieldGoalsPercentage", label: "FG%", fmt: (v: number) => `${(v * 100).toFixed(1)}%` },
  { key: "threePointersPercentage", label: "3P%", fmt: (v: number) => `${(v * 100).toFixed(1)}%` },
  { key: "freeThrowsPercentage", label: "FT%", fmt: (v: number) => `${(v * 100).toFixed(1)}%` },
  { key: "reboundsTotal", label: "Rebounds", fmt: (v: number) => String(v) },
  { key: "assists", label: "Assists", fmt: (v: number) => String(v) },
  { key: "steals", label: "Steals", fmt: (v: number) => String(v) },
  { key: "blocks", label: "Blocks", fmt: (v: number) => String(v) },
  { key: "turnovers", label: "Turnovers", fmt: (v: number) => String(v) },
  { key: "pointsInThePaint", label: "Paint Pts", fmt: (v: number) => String(v) },
  { key: "fastBreakPoints", label: "Fast Break", fmt: (v: number) => String(v) },
] as const;

export default function TeamCompare({ homeTeam, awayTeam }: Props) {
  const hStats = homeTeam.statistics as Record<string, number>;
  const aStats = awayTeam.statistics as Record<string, number>;

  if (!hStats || !aStats) return null;

  return (
    <div className="bg-bg-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <span className="w-1 h-4 bg-accent rounded-full" />
        Team Stats Comparison
      </h3>
      <div className="flex items-center justify-between mb-4 text-xs font-medium">
        <span className="text-text-primary">{awayTeam.teamTricode}</span>
        <span className="text-text-secondary">VS</span>
        <span className="text-text-primary">{homeTeam.teamTricode}</span>
      </div>
      <div className="space-y-3">
        {STATS.map(({ key, label, fmt }) => {
          const hVal = hStats[key] ?? 0;
          const aVal = aStats[key] ?? 0;
          const max = Math.max(hVal, aVal, 0.01);
          // For turnovers, less is better
          const isTurnover = key === "turnovers";
          const hBetter = isTurnover ? hVal < aVal : hVal > aVal;
          const aBetter = isTurnover ? aVal < hVal : aVal > hVal;

          return (
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
          );
        })}
      </div>
    </div>
  );
}

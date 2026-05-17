import type { BoxScoreTeam } from "@/lib/api";
import type { Translations } from "@/locales";

export default function ShootingEfficiency({ homeTeam, awayTeam, t }: { homeTeam: BoxScoreTeam; awayTeam: BoxScoreTeam; t: Translations }) {
  if (!homeTeam.statistics || !awayTeam.statistics) return null;
  const hStats = homeTeam.statistics as Record<string, number>;
  const aStats = awayTeam.statistics as Record<string, number>;
  const metrics = [
    { label: "FG%", home: (hStats.fieldGoalsPercentage ?? 0) * 100, away: (aStats.fieldGoalsPercentage ?? 0) * 100 },
    { label: "3P%", home: (hStats.threePointersPercentage ?? 0) * 100, away: (aStats.threePointersPercentage ?? 0) * 100 },
    { label: "FT%", home: (hStats.freeThrowsPercentage ?? 0) * 100, away: (aStats.freeThrowsPercentage ?? 0) * 100 },
  ];
  return (
    <div className="mt-6 glass-tile p-5">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <span className="w-1 h-4 bg-accent rounded-full" />
        {t.gameDetail.shootingEfficiency}
      </h3>
      <div className="space-y-4">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
              <span>
                {awayTeam.teamTricode} {m.away.toFixed(1)}%
              </span>
              <span className="font-medium text-text-primary">{m.label}</span>
              <span>
                {m.home.toFixed(1)}% {homeTeam.teamTricode}
              </span>
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
}

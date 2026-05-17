import dynamic from "next/dynamic";
import type { BoxScoreTeam } from "@/lib/api";
import type { Translations } from "@/locales";

const ChartPlaceholder = () => <div className="h-64 bg-bg-card rounded-xl skeleton-shimmer" />;
const RadarChart = dynamic(() => import("@/components/RadarChart"), { loading: ChartPlaceholder });

export default function StatsRadar({ homeTeam, awayTeam, t }: { homeTeam: BoxScoreTeam; awayTeam: BoxScoreTeam; t: Translations }) {
  if (!homeTeam.statistics || !awayTeam.statistics) return null;
  const hStats = homeTeam.statistics as Record<string, number>;
  const aStats = awayTeam.statistics as Record<string, number>;
  return (
    <div className="mt-6 glass-tile p-5">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <span className="w-1 h-4 bg-accent rounded-full" />
        {t.gameDetail.statsRadar}
      </h3>
      <div className="flex justify-center">
        <RadarChart
          homeLabel={homeTeam.teamTricode}
          awayLabel={awayTeam.teamTricode}
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
}

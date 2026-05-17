import dynamic from "next/dynamic";
import type { BoxScoreTeam } from "@/lib/api";

const ChartPlaceholder = () => <div className="h-64 bg-bg-card rounded-xl skeleton-shimmer" />;
const ScoringFlow = dynamic(() => import("@/components/ScoringFlow"), { loading: ChartPlaceholder });

export default function ScoringFlowSection({
  homeTeam,
  awayTeam,
  scoreEvents,
}: {
  homeTeam: BoxScoreTeam;
  awayTeam: BoxScoreTeam;
  scoreEvents: { period: number; clock: string; scoreHome: number; scoreAway: number }[];
}) {
  if (!(homeTeam.periods?.length > 0)) return null;
  return (
    <ScoringFlow
      homePeriods={homeTeam.periods}
      awayPeriods={awayTeam.periods}
      homeTricode={homeTeam.teamTricode}
      awayTricode={awayTeam.teamTricode}
      scoreEvents={scoreEvents}
    />
  );
}

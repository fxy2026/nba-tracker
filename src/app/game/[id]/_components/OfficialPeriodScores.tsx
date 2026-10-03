import QuarterBars from "@/components/QuarterBars";
import type { OfficialPeriodScores as PeriodScores } from "@/lib/official-period-score-validation";

export default function OfficialPeriodScores({ scores, isZh }: { scores: PeriodScores; isZh: boolean }) {
  return (
    <section aria-label={isZh ? "官方报告每节得分" : "Official report quarter scores"}>
      <QuarterBars
        homePeriods={scores.home.periodPoints.map((score, index) => ({ period: index + 1, periodType: index < 4 ? "REGULAR" : "OVERTIME", score }))}
        awayPeriods={scores.away.periodPoints.map((score, index) => ({ period: index + 1, periodType: index < 4 ? "REGULAR" : "OVERTIME", score }))}
        homeTricode={scores.home.teamTricode}
        awayTricode={scores.away.teamTricode}
      />
      <p className="mt-2 text-xs text-text-secondary text-center">
        <a href={scores.source.reportUrl} target="_blank" rel="noopener noreferrer" className="hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-4">
          {isZh
            ? `每节得分：NBA 官方赛后报告 · 第 ${scores.source.page} 页 · 核验于 ${scores.source.verifiedOn}（外部 PDF）`
            : `Quarter scores: NBA official final report · page ${scores.source.page} · verified ${scores.source.verifiedOn} (external PDF)`} ↗
        </a>
      </p>
    </section>
  );
}

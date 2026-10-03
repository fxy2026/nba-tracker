import type { OfficialPeriodScores as PeriodScores } from "@/lib/official-period-score-validation";
import ScoreSummaryTable from "./ScoreSummaryTable";

export default function OfficialPeriodScores({ scores, isZh }: { scores: PeriodScores; isZh: boolean }) {
  return (
    <section className="glass-tile mt-6 p-4 sm:p-6" aria-label={isZh ? "官方报告每节得分" : "Official report quarter scores"}>
      <h2 className="mb-3 text-base font-semibold text-text-primary">{isZh ? "每节得分" : "Points by quarter"}</h2>
      <ScoreSummaryTable scores={scores} isZh={isZh} />
      <p className="mt-3 text-[11px] text-text-secondary">
        <a href={scores.source.reportUrl} target="_blank" rel="noopener noreferrer" className="hover:text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
          aria-label={isZh ? `NBA 官方赛后报告，第 ${scores.source.page} 页，核验于 ${scores.source.verifiedOn}（外部 PDF）` : `NBA official final report, page ${scores.source.page}, verified ${scores.source.verifiedOn} (external PDF)`}>
          {isZh ? "NBA 官方赛后报告" : "Official NBA final report"} ↗
        </a>
      </p>
    </section>
  );
}

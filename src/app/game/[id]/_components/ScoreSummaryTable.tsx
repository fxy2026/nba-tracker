import type { OfficialPeriodScores } from "@/lib/official-period-score-validation";
import { scoreTeamName, scoreTeamStyle } from "@/lib/score-team-presentation";
import styles from "./ScorePanel.module.css";

/** Server-rendered only: reviewed quarter totals never become timed chart rows. */
export default function ScoreSummaryTable({ scores, isZh }: { scores: OfficialPeriodScores; isZh: boolean }) {
  return (
    <div className={styles.colors} style={scoreTeamStyle(scores.home.teamTricode, scores.away.teamTricode)}>
      <table className={styles.table} data-score-summary>
        <caption className="sr-only">{isZh ? "官方每节得分与总分" : "Official quarter scores and final totals"}</caption>
        <thead><tr>
          <th scope="col" className={styles.teamColumn}>{isZh ? "球队" : "Team"}</th>
          {scores.home.periodPoints.map((_, index) => <th key={index} scope="col">{index < 4 ? (isZh ? `${index + 1}节` : `Q${index + 1}`) : `OT${index - 3}`}</th>)}
          <th scope="col" className={styles.total}>{isZh ? "总分" : "Total"}</th>
        </tr></thead>
        <tbody>{(["away", "home"] as const).map(side => {
          const team = scores[side];
          return <tr key={side} data-score-team={team.teamTricode}>
            <th scope="row">
              <span className="flex items-center gap-1.5">
                <span className={`h-3 w-1 shrink-0 rounded-full bg-current ${styles[side]}`} aria-hidden="true" />
                <span title={scoreTeamName(team.teamTricode, isZh)}>{team.teamTricode}<span className="ml-1 text-[9px] font-normal text-text-secondary">{side === "home" ? (isZh ? "主" : "H") : (isZh ? "客" : "A")}</span></span>
              </span>
            </th>
            {team.periodPoints.map((score, index) => <td key={index}>{score}</td>)}
            <td className={styles.total}>{team.reportedFinalScore}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  );
}

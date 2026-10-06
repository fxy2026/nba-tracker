import type { CompletedTeamArchiveCoverage } from "@/lib/player-box-coverage";
import type { TeamPlayerBoxCoverage } from "@/lib/player-box-coverage-contract";

function coverageLabel(row: TeamPlayerBoxCoverage, isZh: boolean) {
  if (row.expectedGames === 0) return isZh ? "已存赛程中无该阶段比赛" : "No games in the saved schedule";
  if (row.expectedGames === null) return isZh ? `已归档 ${row.archivedGames} 场；完整赛程未知` : `${row.archivedGames} games archived; full schedule unavailable`;
  return isZh ? `已归档 ${row.archivedGames} / ${row.expectedGames} 场` : `${row.archivedGames} of ${row.expectedGames} games archived`;
}
export default function TeamArchiveCoverage({ coverage, isZh }: { coverage: CompletedTeamArchiveCoverage | null; isZh: boolean }) {
  const labels = isZh ? { regular: "常规赛", playoffs: "季后赛" } : { regular: "Regular season", playoffs: "Playoffs" };
  return <section aria-label={isZh ? "球员单场数据归档覆盖" : "Player-box archive coverage"} className="mt-6 rounded-xl border border-border bg-bg-card px-4 pt-4 pb-1 text-sm">
    <h2 className="font-semibold text-text-primary">{isZh ? "球员单场数据归档" : "Player-box archive"}{coverage && ` · ${coverage.season.replace("-", "–")}`}</h2>
    {!coverage ? <p className="mt-2 mb-3 text-xs text-text-secondary">{isZh ? "暂无经核实的完整赛季赛程覆盖信息。" : "Completed-season schedule coverage is unavailable."}</p> : <>
      <dl className="mt-2 space-y-2">
        {([coverage.regular, coverage.playoffs] as const).map(row => <div key={row.phase} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <dt className="text-text-secondary">{labels[row.phase as "regular" | "playoffs"]}</dt>
          <dd className="text-text-primary tabular-nums">{coverageLabel(row, isZh)}</dd>
        </div>)}
      </dl>
      <details className="mt-1 text-xs text-text-secondary">
        <summary className="min-h-11 cursor-pointer content-center rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{isZh ? "来源与覆盖说明" : "Sources and coverage notes"}</summary>
        <div className="space-y-3 pb-3 leading-relaxed">
          {[coverage.regular, coverage.playoffs].filter(row => row.archivedGames > 0).map(row => {
            const sources = [
              [row.evidence.officialReport, isZh ? "NBA 官方报告数据" : "NBA report projections"],
              [row.evidence.recordedReportReview, isZh ? "已记录报告复核" : "Recorded report reviews"],
              [row.evidence.legacyManualReview, isZh ? "早期人工复核记录" : "Legacy manual reviews"],
              [row.evidence.espnAssigned, isZh ? "ESPN 单场球队标注" : "ESPN game-team assignments"],
              [row.evidence.unassignedProvider, isZh ? "球员球队未分配" : "Player teams unassigned"],
            ].filter(([count]) => Number(count) > 0);
            return <div key={row.phase}>
              <p className="font-medium text-text-primary">{labels[row.phase as "regular" | "playoffs"]} · {isZh ? `${row.teamAssignedGames} 场含球员球队标注` : `${row.teamAssignedGames} games with player-team labels`}</p>
              <p>{sources.map(([count, label]) => `${label}: ${count}`).join(" · ")}</p>
              <p>{row.firstGameDate} – {row.lastGameDate}</p>
              {row.evidence.unassignedProvider > 0 && <p>{isZh ? "未分配记录只计入比赛归档数，不能归为本队球员数据。" : "Unassigned boxes count as archived games; their player rows cannot be attributed to this team."}</p>}
              {row.evidence.legacyManualReview > 0 && <p>{isZh ? "早期人工复核仅有说明文档记录，没有后续复核使用的逐场报告哈希。" : "Legacy manual checks are documented in archive notes and lack the per-game report hashes used by later reviews."}</p>}
              {row.evidence.espnAssigned > 0 && <p>{isZh ? "ESPN 的单场球队标注未逐行通过 NBA 官方报告独立复核。" : "ESPN game-team assignments are not independently checked row by row against NBA reports."}</p>}
              {row.partialPlayerBoxGames > 0 && <p>{isZh ? `${row.partialPlayerBoxGames} 场已知缺少部分出场球员。` : `${row.partialPlayerBoxGames} game boxes are known to omit some players who appeared.`}</p>}
            </div>;
          })}
          <p>{isZh ? "此处仅统计已归档比赛，不代表完整球员赛季数据。缺失字段与球员出场状态以各场来源说明为准。" : "These counts describe archived game boxes, not complete player-season statistics. Missing fields and participation status remain subject to each game's source notes."}</p>
        </div>
      </details>
    </>}
  </section>;
}

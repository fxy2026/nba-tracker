import type { ReportedScoreSequence as ScoreSequence } from "@/lib/reported-score-sequence";
import ReportedScoreChart from "./ReportedScoreChart";

/** Native disclosures retain source order without a client-side replay/feed. */
export default function ReportedScoreSequence({ sequence, isZh }: { sequence: ScoreSequence; isZh: boolean }) {
  const sourceLink = (page: number) => (
    <a href={`${sequence.source.url}#page=${page}`} target="_blank" rel="noopener noreferrer"
      className="text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
      aria-label={isZh ? `NBA 官方赛后报告 PDF 第 ${page} 页（外部链接）` : `NBA official gamebook PDF page ${page} (external link)`}>
      {isZh ? `第 ${page} 页` : `Page ${page}`} ↗
    </a>
  );
  return (
    <section className="glass-tile mt-6 p-4 sm:p-6" aria-labelledby="reported-score-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="reported-score-title" className="text-lg font-semibold text-text-primary">
            {isZh ? "比分走势" : "Score trend"}
          </h2>
          <p className="mt-1 text-xs text-text-secondary">
            {isZh ? `NBA 官方赛后报告 · ${sequence.reportedScoreRows.length} 条比分记录` : `Official NBA gamebook · ${sequence.reportedScoreRows.length} score observations`}
          </p>
        </div>
        <span className="rounded-full border border-border px-2.5 py-1 text-[10px] text-text-secondary">{sequence.gameDate}</span>
      </div>
      <ReportedScoreChart
        rows={sequence.reportedScoreRows.map(({ period, clockAsPrinted, homeScore, awayScore, sourcePage }) => ({ period, clockAsPrinted, homeScore, awayScore, sourcePage }))}
        homeTricode={sequence.home.teamTricode} awayTricode={sequence.away.teamTricode}
        sourceUrl={sequence.source.url} isZh={isZh}
      />
      <p className="mt-3 text-xs leading-relaxed text-text-secondary">
        {isZh
          ? "点标记为报告中的比分记录，虚线仅连接记录，不代表完整逐回合或实时事件。"
          : "Markers are printed score observations. Dashed lines only connect records; this is not a complete play-by-play or live event feed."}
      </p>
      <details className="mt-4 border-t border-border pt-1">
        <summary className="min-h-11 cursor-pointer content-center py-3 text-sm font-medium text-text-primary">
          {isZh ? "查看原始记录与来源" : "View exact records and sources"}
        </summary>
        <p className="mb-3 text-xs leading-relaxed text-text-secondary">
          {isZh
            ? "124 行原文明确印有时间与比分的记录，其中包括 3 行球权记录。重复时间与小数秒按原文顺序保留；未补全缺失事件。节末摘要原文未印时间，单独列出，不补写 00:00。"
            : "124 explicitly printed timed score rows, including 3 possession rows. Repeated clocks and decimal precision stay in source order; missing events are not filled in. Period-end summaries have no printed clock and remain separate, without an invented 00:00."}
        </p>
        <p className="mb-4 text-xs text-text-secondary">
          {isZh ? "来源：NBA 官方赛后报告，PDF 第 9–19 页。" : "Source: NBA official gamebook, PDF pages 9–19."} {sourceLink(9)}
        </p>
        <div className="space-y-5">
        {sequence.reportedPeriodEnds.map(endpoint => {
          const rows = sequence.reportedScoreRows.filter(row => row.period === endpoint.period);
          const periodLabel = isZh ? `第 ${endpoint.period} 节` : `Q${endpoint.period}`;
          return (
            <div key={endpoint.period} className="rounded-lg border border-border">
              <h3 className="px-3 py-3 text-sm font-medium text-text-primary">
                {periodLabel} · {isZh ? `${rows.length} 行带时间的比分记录` : `${rows.length} printed timed score rows`}
              </h3>
              <div className="overflow-x-auto px-3 pb-3">
                <table className="w-full text-left text-xs tabular-nums">
                  <caption className="sr-only">{periodLabel} · {isZh ? "报告记载的累计比分" : "Cumulative scores as printed"}</caption>
                  <thead className="border-b border-border text-text-secondary">
                    <tr>
                      <th scope="col" className="px-2 py-2">{isZh ? "原文时间" : "Printed clock"}</th>
                      <th scope="col" className="px-2 py-2">{sequence.home.teamTricode} ({isZh ? "主" : "home"})</th>
                      <th scope="col" className="px-2 py-2">{sequence.away.teamTricode} ({isZh ? "客" : "away"})</th>
                      <th scope="col" className="px-2 py-2">{isZh ? "PDF 来源" : "PDF source"}</th>
                    </tr>
                  </thead>
                  <tbody className="text-text-primary">
                    {rows.map((row, index) => (
                      <tr key={index} className="border-b border-border">
                        <td className="px-2 py-2 font-mono">{row.clockAsPrinted}</td>
                        <td className="px-2 py-2 font-mono">{row.homeScore}</td>
                        <td className="px-2 py-2 font-mono">{row.awayScore}</td>
                        <td className="whitespace-nowrap px-2 py-2">{sourceLink(row.sourcePage)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 border-t border-border pt-3 text-xs text-text-secondary">
                  {isZh ? "节末摘要（原文未印时间）" : "Period-end summary (no printed clock)"}: {sequence.home.teamTricode} {endpoint.homeScore}, {sequence.away.teamTricode} {endpoint.awayScore}. {sourceLink(endpoint.sourcePage)}
                </p>
              </div>
            </div>
          );
        })}
        </div>
      </details>
    </section>
  );
}

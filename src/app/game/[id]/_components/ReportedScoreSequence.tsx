import type { ReportedScoreSequence as ScoreSequence } from "@/lib/reported-score-sequence";

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
      <h2 id="reported-score-title" className="text-lg font-semibold text-text-primary">
        {isZh ? "官方赛后报告记载的比分序列" : "Reported score sequence from the official gamebook"}
      </h2>
      <p className="mt-2 text-sm text-text-secondary">
        {isZh
          ? "124 行原文明确印有时间与比分的记录，其中包括 3 行球权记录。仅含球队比分，不是完整逐回合或实时事件数据。"
          : "124 explicitly printed timed score rows, including 3 possession rows. Team scores only; not a complete play-by-play or live event feed."}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-text-secondary">
        {isZh
          ? "按报告原始顺序保留重复时间与小数秒。未补全缺失事件；本节不提供球员动作、投篮、回放、领先变化或连续得分分析。节末比分另列为无时间的摘要，不补写 00:00。"
          : "Repeated clocks and decimal precision stay in source order. Missing events are not filled in. This section does not provide player actions, shots, replay, lead-change or scoring-run analysis. Period-end scores are separate untimed summaries; no 00:00 clock is invented."}
      </p>
      <p className="mt-2 text-xs text-text-secondary">
        {isZh ? "来源：NBA 官方赛后报告（2026-03-13），PDF 第 9–19 页。" : "Source: NBA official gamebook (2026-03-13), PDF pages 9–19."}{" "}
        {sourceLink(9)}
      </p>
      <div className="mt-4 space-y-3">
        {sequence.reportedPeriodEnds.map(endpoint => {
          const rows = sequence.reportedScoreRows.filter(row => row.period === endpoint.period);
          const periodLabel = isZh ? `第 ${endpoint.period} 节` : `Q${endpoint.period}`;
          return (
            <details key={endpoint.period} className="rounded-lg border border-white/10">
              <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2">
                {periodLabel} · {isZh ? `${rows.length} 行带时间的比分记录` : `${rows.length} printed timed score rows`}
              </summary>
              <div className="overflow-x-auto px-3 pb-3">
                <table className="w-full text-left text-xs tabular-nums">
                  <caption className="sr-only">{periodLabel} · {isZh ? "报告记载的累计比分" : "Cumulative scores as printed"}</caption>
                  <thead className="border-b border-white/10 text-text-secondary">
                    <tr>
                      <th scope="col" className="px-2 py-2">{isZh ? "原文时间" : "Printed clock"}</th>
                      <th scope="col" className="px-2 py-2">{sequence.home.teamTricode} ({isZh ? "主" : "home"})</th>
                      <th scope="col" className="px-2 py-2">{sequence.away.teamTricode} ({isZh ? "客" : "away"})</th>
                      <th scope="col" className="px-2 py-2">{isZh ? "PDF 来源" : "PDF source"}</th>
                    </tr>
                  </thead>
                  <tbody className="text-text-primary">
                    {rows.map((row, index) => (
                      <tr key={index} className="border-b border-white/5">
                        <td className="px-2 py-2 font-mono">{row.clockAsPrinted}</td>
                        <td className="px-2 py-2 font-mono">{row.homeScore}</td>
                        <td className="px-2 py-2 font-mono">{row.awayScore}</td>
                        <td className="whitespace-nowrap px-2 py-2">{sourceLink(row.sourcePage)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 border-t border-white/10 pt-3 text-xs text-text-secondary">
                  {isZh ? "节末摘要（原文未印时间）" : "Period-end summary (no printed clock)"}: {sequence.home.teamTricode} {endpoint.homeScore}, {sequence.away.teamTricode} {endpoint.awayScore}. {sourceLink(endpoint.sourcePage)}
                </p>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

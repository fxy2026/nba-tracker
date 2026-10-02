import type { RecoveredPlayerBox as RecoveredBox, RecoveredPlayerLine } from "@/lib/recovered-player-box";

const value = (v: number | null) => v === null ? "—" : String(v);
const split = (made: number | null, attempted: number | null) => `${value(made)}–${value(attempted)}`;

export default function RecoveredPlayerBox({ box, isZh }: { box: RecoveredBox; isZh: boolean }) {
  const columns = ["MIN ≈", "PTS", "REB", "AST", "FG", "3PT", "FT", "OREB", "DREB", "STL", "BLK", "TO", "PF", "+/−"];
  const cells = (p: RecoveredPlayerLine) => [value(p.minutes), value(p.points), value(p.rebounds), value(p.assists), split(p.fieldGoalsMade, p.fieldGoalsAttempted), split(p.threePointersMade, p.threePointersAttempted), split(p.freeThrowsMade, p.freeThrowsAttempted), value(p.offensiveRebounds), value(p.defensiveRebounds), value(p.steals), value(p.blocks), value(p.turnovers), value(p.fouls), value(p.plusMinus)];
  return <section className="mt-6 space-y-4" aria-label={isZh ? "补充球员技术统计" : "Recovered player box score"}>
    <div className="glass-tile p-4 space-y-2">
      <h2 className="text-lg font-semibold">{isZh ? "球员技术统计" : "Player box score"}</h2>
      <p className="text-xs text-text-secondary">
        {isZh ? "来源：" : "Source: "}<a href="https://bigballsdata.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">BigBallsData</a>
        {` · ${box.season} · ${box.gameDate}`}
      </p>
      <p className="text-xs text-text-secondary">{isZh
        ? "本场历史球队归属与球员得分已对照 NBA 官方报告核验。分钟为数据源提供的取整值；未列出未出场球员。"
        : "Historical team assignments and player points were checked against the NBA official report. Minutes are rounded by the source; non-playing roster members are not listed."}</p>
      <a href={box.reportUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">{isZh ? "核验依据：NBA 官方赛后报告（PDF）" : "Reference: NBA official final report (PDF)"}</a>
      <p className="text-xs text-text-secondary">{isZh ? "快照获取时间（约）" : "Snapshot retrieved (approximately)"}: {box.retrievedAt.replace("T", " ").replace(":00Z", " UTC")}</p>
    </div>
    {[box.away, box.home].map(team => <div key={team} className="glass-tile overflow-hidden">
      <h3 className="p-4 font-semibold border-b border-border">{team} · {team === box.home ? box.homeScore : box.awayScore}</h3>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${team} ${isZh ? "球员数据，可横向滚动" : "player stats, scroll horizontally"}`}>
        <table className="w-full text-xs whitespace-nowrap tabular-nums">
          <caption className="sr-only">{team} {isZh ? "本场球员技术统计" : "game player box score"}</caption>
          <thead><tr className="border-b border-border text-text-secondary"><th scope="col" className="text-left p-3 sticky left-0 bg-bg-card">{isZh ? "球员" : "Player"}</th>{columns.map(c => <th key={c} scope="col" className="p-3 text-right">{c}</th>)}</tr></thead>
          <tbody>{box.players.filter(p => p.team === team).map(p => <tr key={p.name} className="border-b border-border/50">
            <th scope="row" className="p-3 text-left font-medium sticky left-0 bg-bg-card">{p.name}{p.starter === true && <span className="ml-1 text-text-secondary" title={isZh ? "首发" : "Starter"}>*</span>}</th>
            {cells(p).map((cell, i) => <td key={columns[i]} className={`p-3 text-right ${i === 1 ? "font-bold" : "text-text-secondary"}`}>{cell}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </div>)}
  </section>;
}

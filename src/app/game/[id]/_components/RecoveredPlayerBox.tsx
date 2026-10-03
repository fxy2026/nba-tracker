import type { RecoveredPlayerBox as RecoveredBox, RecoveredPlayerLine } from "@/lib/recovered-player-box";

const value = (v: number | null) => v === null ? "—" : String(v);
const split = (made: number | null, attempted: number | null) => `${value(made)}–${value(attempted)}`;

export default function RecoveredPlayerBox({ box, isZh }: { box: RecoveredBox; isZh: boolean }) {
  const officialOnly = box.provider === "NBA official final report";
  const hasOfficialRows = box.players.some(player => player.source === "NBA official final report");
  const supplementDurations = box.players.filter(player => player.source === "NBA official final report").map(player => `${player.name} ${player.officialSource?.officialDuration}`).join(", ");
  const hasBlockCorrections = box.players.some(player => player.blocksCorrection);
  const hasMinuteCorrections = box.players.some(player => player.minutesCorrection);
  const columns = [officialOnly ? "MIN" : "MIN ≈", "PTS", "REB", "AST", "FG", "3PT", "FT", "OREB", "DREB", "STL", "BLK", "TO", "PF", "+/−"];
  const cells = (p: RecoveredPlayerLine) => [officialOnly ? p.officialSource!.officialDuration : `${value(p.minutes)}${p.minutesCorrection ? "†" : ""}`, value(p.points), value(p.rebounds), value(p.assists), split(p.fieldGoalsMade, p.fieldGoalsAttempted), split(p.threePointersMade, p.threePointersAttempted), split(p.freeThrowsMade, p.freeThrowsAttempted), value(p.offensiveRebounds), value(p.defensiveRebounds), value(p.steals), `${value(p.blocks)}${p.blocksCorrection ? "†" : ""}`, value(p.turnovers), value(p.fouls), value(p.plusMinus)];
  return <section className="mt-6 space-y-4" aria-label={isZh ? "补充球员技术统计" : "Recovered player box score"}>
    <div className="glass-tile p-4 space-y-2">
      <h2 className="text-lg font-semibold">{isZh ? "球员技术统计" : "Player box score"}</h2>
      <p className="text-xs text-text-secondary">
        {isZh ? "来源：" : "Source: "}<a href={officialOnly ? box.reportUrl : "https://bigballsdata.com"} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{officialOnly ? (isZh ? "NBA 官方赛后报告" : "NBA official final report") : "BigBallsData"}</a>
        {hasOfficialRows && !officialOnly && <> + <a href={box.reportUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{isZh ? "NBA 官方赛后报告" : "NBA official final report"}</a></>}
        {` · ${box.season} · ${box.gameDate}`}
      </p>
      <p className="text-xs text-text-secondary">{officialOnly
        ? (isZh ? `本场全部 ${box.players.length} 名实际出场球员的记录独立取自 NBA 官方赛后报告。MIN 为报告原始分:秒；未列出未出场球员。`
          : `All ${box.players.length} played player records are independently sourced from the NBA official final report. MIN shows the printed minutes:seconds; non-playing roster members are not listed.`)
        : (isZh ? "本场历史球队归属与球员得分已对照 NBA 官方报告核验。分钟为取整值（标记 † 的校正见下方）；未列出未出场球员。"
          : "Historical team assignments and player points were checked against the NBA official report. Minutes are rounded (see any † corrections below); non-playing roster members are not listed.")}</p>
      {hasOfficialRows && !officialOnly && !box.sourceSupplement && <p className="text-sm text-text-secondary">{isZh
        ? "原数据源存在球员身份错误。标记 ‡ 的整条球员记录独立取自本场 NBA 官方报告，未沿用错误的数据源身份编号；其余数据源记录也已逐项核验。原始错误记录保留在公开历史证据中。"
        : "The original provider had a player identity error. Each ‡ player line is independently sourced from this game's NBA official report, without reusing the incorrect provider identity. Other provider rows were also checked field by field; the original records remain in the public audit history."}</p>}
      {box.sourceSupplement && <p className="text-sm text-text-secondary">{isZh
        ? `已按本场 NBA 官方报告独立补全 ${box.sourceSupplement.addedOfficialPlayerNames.join("、")} 的出场记录，现显示 ${box.players.length}/${box.sourceSupplement.officialPlayedPlayerCount} 人。标记 ‡ 的记录未使用数据源身份编号；原有 ${box.sourceSupplement.originalProviderPlayerCount} 条记录与此前缺项说明保留在历史存档。官方出场时间：${supplementDurations}；MIN 按最近分钟取整，0 不代表 DNP 或缺失值。`
        : `Missing appearances for ${box.sourceSupplement.addedOfficialPlayerNames.join(", ")} were independently added from this game's NBA official report: ${box.players.length} of ${box.sourceSupplement.officialPlayedPlayerCount} played players are shown. Each ‡ row has no provider identity; the original ${box.sourceSupplement.originalProviderPlayerCount} rows and prior coverage note remain in history. Official durations: ${supplementDurations}. MIN is rounded to the nearest minute; 0 is not a DNP or missing value.`}</p>}
      {hasMinuteCorrections && <p className="text-xs text-text-secondary">{isZh
        ? "† 分钟已按本场 NBA 官方报告校正并四舍五入；原始数据源分钟保留在公开存档的校正记录中，其他统计未作推算。"
        : "† Minutes corrected from this game's NBA official report and rounded to the nearest minute. Original provider minutes are retained in the public archive correction record; no other stats were estimated."}</p>}
      {hasBlockCorrections && <p className="text-xs text-text-secondary">{isZh
        ? "† 标记的盖帽数已按本场 NBA 官方报告校正；原始数据源数值和报告依据保留在公开存档中。"
        : "† Marked block counts were corrected from this game's NBA official report; original provider values and report references are retained in the public archive."}</p>}
      {box.playedCoverage && <p className="text-sm font-medium text-accent-amber">{isZh
        ? `部分球员数据：已显示 ${box.players.length}/${box.playedCoverage.officialPlayedPlayerCount} 名实际出场球员。缺少 ${box.playedCoverage.missingOfficialPlayedPlayers.map(player => `${player.officialName}（${player.team}）`).join("、")} 的数据源记录；未补造统计，也不将其列为 DNP，请参阅官方报告。`
        : `Partial player box score: ${box.players.length} of ${box.playedCoverage.officialPlayedPlayerCount} played players. Saved records are missing for ${box.playedCoverage.missingOfficialPlayedPlayers.map(player => `${player.officialName} (${player.team})`).join(", ")}. No stats or DNP status were invented; see the official report.`}</p>}
      {!!box.excludedProviderRecords && <p className="text-xs text-text-secondary">{isZh
        ? `已排除 ${box.excludedProviderRecords} 条未获官方报告支持的数据源记录；原始记录单独保留，不将其认定为出场或 DNP。`
        : `${box.excludedProviderRecords} provider records unsupported by the official report were excluded and retained separately; no played or DNP status is inferred for them.`}</p>}
      <a href={box.reportUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">{isZh ? "核验依据：NBA 官方赛后报告（PDF）" : "Reference: NBA official final report (PDF)"}</a>
      <p className="text-xs text-text-secondary">{officialOnly
        ? (isZh ? `官方报告第 ${box.officialReport!.page} 页 · 核验日期：${box.officialReport!.verifiedOn}` : `Official report page ${box.officialReport!.page} · Verified ${box.officialReport!.verifiedOn}`)
        : `${isZh ? "数据源快照获取时间（约）" : "Provider snapshot retrieved (approximately)"}: ${box.retrievedAt.replace("T", " ").replace(":00Z", " UTC")}`}</p>
    </div>
    {[box.away, box.home].map(team => <div key={team} className="glass-tile overflow-hidden">
      <h3 className="p-4 font-semibold border-b border-border">{team} · {team === box.home ? box.homeScore : box.awayScore}</h3>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${team} ${isZh ? "球员数据，可横向滚动" : "player stats, scroll horizontally"}`}>
        <table className="w-full text-xs whitespace-nowrap tabular-nums">
          <caption className="sr-only">{team} {isZh ? "本场球员技术统计" : "game player box score"}</caption>
          <thead><tr className="border-b border-border text-text-secondary"><th scope="col" className="text-left p-3 sticky left-0 bg-bg-card">{isZh ? "球员" : "Player"}</th>{columns.map(c => <th key={c} scope="col" className="p-3 text-right">{c}</th>)}</tr></thead>
          <tbody>{box.players.filter(p => p.team === team).map(p => <tr key={p.name} className="border-b border-border/50">
            <th scope="row" className="p-3 text-left font-medium sticky left-0 bg-bg-card">{p.name}{!officialOnly && p.source === "NBA official final report" && <span title={isZh ? "独立官方报告记录" : "Independent official report record"}>‡</span>}{p.starter === true && <span className="ml-1 text-text-secondary" title={isZh ? "首发" : "Starter"}>*</span>}</th>
            {cells(p).map((cell, i) => <td key={columns[i]} className={`p-3 text-right ${i === 1 ? "font-bold" : "text-text-secondary"}`}>{cell}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </div>)}
  </section>;
}

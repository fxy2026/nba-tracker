"use client";

import { useState } from "react";
import { historicalCareerAverage, historicalCareerPercentage, sumHistoricalCareerTotals, type HistoricalCareerData, type HistoricalCareerSeasonType, type HistoricalCareerTotalKey, type HistoricalCareerTotals } from "@/lib/historical-career-data";
import styles from "./historical-career.module.css";

type Mode = "per-game" | "totals";
interface Props { data: HistoricalCareerData; locale: "en" | "zh" }
const columns: { key: HistoricalCareerTotalKey; averageLabel: string; totalLabel: string; en: string; zh: string }[] = [
  { key: "GP", averageLabel: "GP", totalLabel: "GP", en: "Games played", zh: "出场数" },
  { key: "PTS", averageLabel: "PPG", totalLabel: "PTS", en: "Points", zh: "得分" },
  { key: "REB", averageLabel: "RPG", totalLabel: "REB", en: "Rebounds", zh: "篮板" },
  { key: "AST", averageLabel: "APG", totalLabel: "AST", en: "Assists", zh: "助攻" },
  { key: "STL", averageLabel: "SPG", totalLabel: "STL", en: "Steals", zh: "抢断" },
  { key: "BLK", averageLabel: "BPG", totalLabel: "BLK", en: "Blocks", zh: "盖帽" },
  { key: "MIN", averageLabel: "MPG", totalLabel: "MIN", en: "Minutes", zh: "上场时间" },
  { key: "TOV", averageLabel: "TOV", totalLabel: "TOV", en: "Turnovers", zh: "失误" },
  { key: "OREB", averageLabel: "ORB", totalLabel: "ORB", en: "Offensive rebounds", zh: "进攻篮板" },
  { key: "DREB", averageLabel: "DRB", totalLabel: "DRB", en: "Defensive rebounds", zh: "防守篮板" },
];
const number = (value: number | null, places = 0): string => value === null ? "—" : value.toFixed(places);
const seasonTypeLabel = (type: HistoricalCareerSeasonType, zh: boolean) => type === "Regular Season" ? (zh ? "常规赛" : "Regular season") : (zh ? "季后赛" : "Playoffs");

export function HistoricalCareerTable({ data, locale, seasonType, mode }: Props & { seasonType: HistoricalCareerSeasonType; mode: Mode }) {
  const isZh = locale === "zh";
  const rows = data.rows.filter(row => row.seasonType === seasonType).sort((a, b) => a.season.localeCompare(b.season));
  const totals = sumHistoricalCareerTotals(rows);
  const label = seasonTypeLabel(seasonType, isZh);
  const scopeId = `historical-career-${data.playerId}`;
  const cells = (stats: HistoricalCareerTotals) => <>
    {columns.map(column => <td key={column.key} className={column.key === "PTS" ? styles.points : undefined}>{number(mode === "totals" || column.key === "GP" ? stats[column.key] : historicalCareerAverage(stats, column.key), mode === "per-game" && column.key !== "GP" ? 1 : 0)}</td>)}
    {(["FG", "FG3", "FT"] as const).map(kind => <td key={kind}>{number(historicalCareerPercentage(stats, kind), 1)}</td>)}
    {mode === "totals" && (["FGM", "FGA", "FG3M", "FG3A", "FTM", "FTA"] as const).map(key => <td key={key}>{number(stats[key])}</td>)}
  </>;
  if (!rows.length) return <p className="mt-4 text-sm text-text-secondary" role="status">{isZh ? "此赛事类型的逐赛季统计暂未收录；不代表零次出场。" : "Season statistics for this competition are not recorded; this does not imply zero appearances."}</p>;
  return <>
    <dl className="mt-4 grid grid-cols-3 gap-2">
      {(["PTS", "REB", "AST"] as const).map((key, index) => <div key={key} className="min-w-0 rounded-xl bg-bg-secondary p-3">
        <dt className="text-[11px] text-text-secondary">{["PPG", "RPG", "APG"][index]}</dt>
        <dd className="mt-1 text-2xl font-mono font-semibold text-text-primary">{number(historicalCareerAverage(totals, key), 1)}</dd>
      </div>)}
    </dl>
    <p className="mt-3 text-xs text-text-secondary" role="status" aria-live="polite">{label} · {rows.length} {isZh ? "个已收录赛季" : "recorded seasons"} · {number(totals.GP)} {isZh ? "场" : "games"} · {number(totals.PTS)} {isZh ? "分" : "points"}</p>
    <p id={`${scopeId}-scroll`} className="mt-3 mb-2 text-xs text-text-secondary">{isZh ? "左右滑动查看全部数据，赛季列保持可见。— 表示未知或有争议，不是 0。" : "Scroll horizontally for every stat; season labels stay visible. — means unknown or disputed, not 0."}</p>
    <div key={`${seasonType}:${mode}`} className={styles.scroller} tabIndex={0} role="region" aria-label={isZh ? `${label}逐赛季统计表` : `${label} statistics table`} aria-describedby={`${scopeId}-scroll`}>
      <table className={styles.table}>
        <caption className="sr-only">{data.playerName} · {label} · {mode === "per-game" ? (isZh ? "场均数据，出场数除外" : "Per game, except games played") : (isZh ? "赛季总计" : "Season totals")}</caption>
        <thead><tr>
          <th scope="col" className={styles.season}>{isZh ? "赛季 / 球队" : "Season / team"}</th>
          {columns.map(column => <th scope="col" key={column.key} title={isZh ? column.zh : column.en}>{mode === "per-game" ? column.averageLabel : column.totalLabel}</th>)}
          {(["FG%", "3P%", "FT%"] as const).map((key, index) => <th scope="col" key={key} title={(isZh ? ["投篮命中率", "三分命中率", "罚球命中率"] : ["Field goal percentage", "Three-point percentage", "Free throw percentage"])[index]}>{key}</th>)}
          {mode === "totals" && ["FGM", "FGA", "3PM", "3PA", "FTM", "FTA"].map(key => <th scope="col" key={key}>{key}</th>)}
        </tr></thead>
        <tbody>{rows.map(row => <tr key={row.season}>
          <th scope="row" className={styles.season}><span className="font-mono text-text-primary">{row.season}</span><span className="mt-1 block text-[10px] text-text-secondary">{row.teamAbbreviation}</span></th>
          {cells(row.totals)}
        </tr>)}</tbody>
        <tfoot><tr><th scope="row" className={styles.season}><span className="block">{isZh ? "已收录" : "Recorded"}</span><span className="mt-1 block">{isZh ? "合计" : "total"}</span></th>{cells(totals)}</tr></tfoot>
      </table>
    </div>
  </>;
}

export default function HistoricalPlayerCareer({ data, locale }: Props) {
  const [seasonType, setSeasonType] = useState<HistoricalCareerSeasonType>("Regular Season");
  const [mode, setMode] = useState<Mode>("per-game");
  const isZh = locale === "zh";
  const sources = data.sources;
  const buttonClass = (selected: boolean) => `min-h-11 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selected ? "bg-accent text-white" : "text-text-secondary hover:bg-bg-secondary"}`;
  return <div className="mt-4 min-w-0" data-historical-career={data.playerId}>
    <p className="mb-2 text-sm text-text-secondary">{isZh
      ? `常规赛 ${data.rows.filter(row => row.seasonType === "Regular Season").length} 季 · 季后赛 ${data.rows.filter(row => row.seasonType === "Playoffs").length} 季`
      : `Regular season: ${data.rows.filter(row => row.seasonType === "Regular Season").length} seasons · Playoffs: ${data.rows.filter(row => row.seasonType === "Playoffs").length} seasons`}</p>
    <p className="text-xs leading-relaxed text-text-secondary">{isZh ? "StatMuse 逐赛季总计 · 第三方来源存档" : "StatMuse season totals · Secondary-source archive"} · <time dateTime={data.retrievedAt}>{isZh ? "检索于 " : "Retrieved "}{data.retrievedAt.slice(0, 10)}</time></p>
    <div className="mt-3 flex flex-wrap gap-2">
      <div className="inline-flex rounded-xl bg-bg-secondary p-1" role="group" aria-label={isZh ? "赛事类型" : "Competition"}>
        {(["Regular Season", "Playoffs"] as const).map(type => <button key={type} type="button" className={buttonClass(seasonType === type)} aria-pressed={seasonType === type} onClick={() => setSeasonType(type)}>{seasonTypeLabel(type, isZh)}</button>)}
      </div>
      <div className="inline-flex rounded-xl bg-bg-secondary p-1" role="group" aria-label={isZh ? "统计口径" : "Stat display"}>
        {(["per-game", "totals"] as const).map(value => <button key={value} type="button" className={buttonClass(mode === value)} aria-pressed={mode === value} onClick={() => setMode(value)}>{value === "per-game" ? (isZh ? "场均" : "Per game") : (isZh ? "总计" : "Totals")}</button>)}
      </div>
    </div>
    <HistoricalCareerTable data={data} locale={locale} seasonType={seasonType} mode={mode} />
    <details className="mt-3 text-xs leading-relaxed text-text-secondary">
      <summary className="min-h-11 cursor-pointer py-3 font-medium">{isZh ? "统计口径、来源与缺失项" : "Calculation, sources and missing fields"}</summary>
      <div className="space-y-2 pb-2">
        <p>{isZh ? "场均值由来源中的赛季总计除以出场数计算，命中率由命中数除以出手数计算。合计行先相加总计再计算，不对赛季场均值做平均；上方三项摘要始终为所选赛事的场均值。" : "Per-game values divide source season totals by games played; shooting percentages divide makes by attempts. The recorded-total row aggregates totals before calculating averages, rather than averaging season averages. The three summary cards always show per-game values for the selected competition."}</p>
        <p>{isZh ? "这是固定日期的第三方统计存档，并非 NBA 官方核验数据。仅列出已收录赛季，不补造缺席赛季；常规赛与季后赛独立统计。这些总计不代表投篮坐标或完整投篮记录覆盖。" : "This is a dated third-party statistical archive, not an NBA-officially verified dataset. Only recorded seasons are listed; absent seasons are not filled in. Regular season and playoffs are separate. These totals do not establish shot-coordinate or full shooting-record coverage."}</p>
        {data.disputes.some(dispute => dispute.field === "MIN") && <p>{isZh ? "部分赛季上场时间有来源争议，暂记为 —；包含该赛季的合计上场时间与场均时间也保持未知。详见来源记录。" : "Some season minutes are disputed across sources and remain —. Aggregate minutes and minutes per game that include those seasons also remain unknown. See the source records."}</p>}
        {data.disputes.map(dispute => <p key={`${dispute.seasonType}:${dispute.season}:${dispute.field}`}>
          {dispute.season} · {seasonTypeLabel(dispute.seasonType, isZh)} · {dispute.field}: {dispute.observations.map(observation => `${sources.find(source => source.id === observation.sourceId)?.publisher}: ${observation.value}`).join(" / ")}. {isZh ? "暂未解决，显示为 —。" : "Unresolved; displayed as —."}
        </p>)}
        <p>{isZh ? "固定检索时间（UTC）：" : "Fixed retrieval time (UTC): "}<time dateTime={data.retrievedAt}>{data.retrievedAt}</time></p>
        <ul className="space-y-1">{sources.map(source => <li key={source.id}><a className="inline-flex min-h-11 items-center text-accent underline underline-offset-4" href={source.url} target="_blank" rel="noopener noreferrer">{source.publisher} · {data.rows.some(row => row.sourceId === source.id) ? seasonTypeLabel(data.rows.find(row => row.sourceId === source.id)!.seasonType, isZh) : (isZh ? "交叉核对来源" : "Corroborating source")}</a></li>)}</ul>
      </div>
    </details>
  </div>;
}

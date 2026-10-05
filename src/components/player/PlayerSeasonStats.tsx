"use client";

import { useState, type ReactNode } from "react";
import { usePlayerCareer } from "@/lib/usePlayerCareer";
import type { PlayerCareerData } from "@/lib/player-career-data";
import { careerSourceUrl, type PlayerCareerProvenance } from "@/lib/player-career-provenance";
import type { HistoricalCareerData, HistoricalCareerSeasonType } from "@/lib/historical-career-data";
import { careerSeasonStats, historicalSeasonStats, selectPlayerSeason, type PlayerSeasonStatsRow, type SeasonStatKey } from "@/lib/player-season-stats";
import PlayerCareerSource from "./PlayerCareerSource";

interface Props {
  playerId: number;
  playerName?: string;
  teamTricode?: string;
  locale: "en" | "zh";
  initialData?: PlayerCareerData | null;
  historicalCareer?: HistoricalCareerData | null;
}

const labels: Record<SeasonStatKey, [string, string]> = {
  GP: ["Games played", "出场数"], MIN: ["Minutes", "上场时间"], PTS: ["Points", "得分"],
  REB: ["Rebounds", "篮板"], AST: ["Assists", "助攻"], STL: ["Steals", "抢断"], BLK: ["Blocks", "盖帽"],
  GS: ["Games started", "首发场次"], TOV: ["Turnovers", "失误"], PF: ["Fouls", "犯规"],
  OREB: ["Offensive rebounds", "进攻篮板"], DREB: ["Defensive rebounds", "防守篮板"],
  FGM: ["Field goals made", "投篮命中"], FGA: ["Field goal attempts", "投篮出手"],
  FG3M: ["Threes made", "三分命中"], FG3A: ["Three-point attempts", "三分出手"],
  FTM: ["Free throws made", "罚球命中"], FTA: ["Free throw attempts", "罚球出手"],
};
const number = (value: number | null, places = 1) => value === null ? "—" : value.toFixed(places);
const controlClass = "min-h-11 min-w-0 w-full rounded-lg border border-border bg-bg-secondary px-3 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const typeLabel = (type: HistoricalCareerSeasonType, isZh: boolean) => type === "Regular Season" ? (isZh ? "常规赛" : "Regular season") : (isZh ? "季后赛" : "Playoffs");

/** One selected season, deliberately separate from the full career table. */
export function SeasonStatsContent({ playerId, rows, locale, seasonType = "Regular Season", provenance, historicalCareer, checkingLive = false, children }: {
  playerId: number;
  rows: PlayerSeasonStatsRow[];
  locale: "en" | "zh";
  seasonType?: HistoricalCareerSeasonType;
  provenance?: PlayerCareerProvenance;
  historicalCareer?: HistoricalCareerData;
  checkingLive?: boolean;
  children?: ReactNode;
}) {
  const isZh = locale === "zh";
  const [selection, setSelection] = useState({ season: "", team: "" });
  const { seasons, teams, row } = selectPlayerSeason(rows, selection.season, selection.team);
  const scope = `season-stats-${playerId}`;
  if (!row) return <p role="status" className="py-4 text-sm text-text-secondary">{isZh ? "此赛事类型暂无已收录的赛季统计，不代表零出场。" : "No recorded season statistics for this competition; this does not mean zero appearances."}</p>;
  const historicalRow = historicalCareer?.rows.find(candidate => candidate.season === row.season && candidate.seasonType === seasonType && candidate.teamAbbreviation === row.team);
  const historicalSource = historicalCareer?.sources.find(source => source.id === historicalRow?.sourceId);
  const archived = provenance?.source === "nba-com";
  const date = historicalRow?.retrievedAt ?? (archived ? provenance.capturedAt : provenance?.retrievedAt);
  const sourceName = historicalSource?.publisher ?? (provenance?.source === "nba-stats" ? "NBA Stats" : provenance?.source === "espn" ? "ESPN" : archived ? "NBA.com" : null);
  const sourceUrl = historicalRow?.sourceUrl ?? (provenance ? careerSourceUrl(provenance) : null);
  const extras = (["GS", "TOV", "PF", "OREB", "DREB"] as const).filter(key => row.stats[key] !== null);
  const stat = (key: SeasonStatKey, prominent = false) => <div key={key} className={`min-w-0 rounded-xl border border-border/60 bg-bg-secondary/50 ${prominent ? "p-3 sm:p-4" : "p-2.5 sm:p-3"}`} data-season-stat={key}>
    <dt className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] sm:text-xs text-text-secondary"><span className="font-mono">{key}</span><span className={prominent ? "" : "sr-only sm:not-sr-only"}>{labels[key][isZh ? 1 : 0]}</span></dt>
    <dd className={`mt-1 font-mono font-semibold tabular-nums ${prominent ? "text-2xl sm:text-3xl text-accent-amber" : "text-lg sm:text-xl text-text-primary"}`}>{number(row.stats[key], key === "GP" || key === "GS" ? 0 : 1)}</dd>
  </div>;

  return <div className="min-w-0 space-y-4" data-player-season-stats={playerId}>
    <div className={`grid min-w-0 gap-3 ${teams.length > 1 ? "grid-cols-2" : "grid-cols-1 sm:max-w-64"}`}>
      <label htmlFor={`${scope}-season`} className="min-w-0 space-y-1.5 text-xs text-text-secondary"><span>{isZh ? "赛季" : "Season"}</span>
        <select id={`${scope}-season`} className={controlClass} value={row.season} onChange={event => setSelection({ season: event.target.value, team: "" })}>
          {seasons.map(season => <option key={season} value={season}>{season}{season === seasons[0] ? (isZh ? " · 最新收录" : " · Latest recorded") : ""}</option>)}
        </select>
      </label>
      {teams.length > 1 && <label htmlFor={`${scope}-team`} className="min-w-0 space-y-1.5 text-xs text-text-secondary"><span>{isZh ? "球队范围" : "Team scope"}</span>
        <select id={`${scope}-team`} className={controlClass} value={row.team} onChange={event => setSelection({ season: row.season, team: event.target.value })}>
          {teams.map((team, index) => <option key={`${team.team}:${index}`} value={team.team}>{team.team === "TOT" ? (isZh ? "TOT · 全赛季" : "TOT · All teams") : team.team || (isZh ? "球队未标注" : "Team unlabelled")}</option>)}
        </select>
      </label>}
    </div>
    <p className="text-xs leading-relaxed text-text-secondary" role="status" aria-live="polite">
      <span className="font-medium text-text-primary">{row.season} · {typeLabel(seasonType, isZh)} · {row.team || (isZh ? "球队未标注" : "Team unlabelled")}{row.teamName ? ` · ${row.teamName}` : ""}</span>
      <span className="mt-1 block">{isZh ? "场均数据 · GP / GS 为赛季场次" : "Per game · GP / GS are season counts"}{row.team === "TOT" ? (isZh ? " · 跨球队全赛季总计" : " · Whole season across teams") : teams.length > 1 ? (isZh ? " · 所选球队阶段" : " · Selected team stint") : ""}</span>
    </p>
    <dl className="grid grid-cols-3 gap-2">{(["PTS", "REB", "AST"] as const).map(key => stat(key, true))}</dl>
    <dl className="grid grid-cols-4 gap-2">{(["GP", "MIN", "STL", "BLK"] as const).map(key => stat(key))}</dl>
    <div>
      <h3 className="mb-2 text-sm font-semibold text-text-primary">{isZh ? "投篮效率" : "Shooting"}</h3>
      <div className="grid grid-cols-3 gap-2">
        {(["FG", "FG3", "FT"] as const).map(kind => <div key={kind} className="min-w-0 rounded-xl border border-border/60 p-2.5 sm:p-3" data-season-shooting={kind}>
          <p className="text-xs font-mono text-text-secondary">{kind === "FG3" ? "3P" : kind}%</p>
          <p className="mt-1 font-mono text-lg sm:text-2xl font-semibold tabular-nums text-text-primary">{number(row.percentages[kind])}{row.percentages[kind] !== null && <span className="ml-0.5 text-xs text-text-secondary">%</span>}</p>
          <dl className="mt-2 space-y-1 text-[10px] sm:text-xs">
            {(["M", "A"] as const).map(suffix => {
              const key = `${kind}${suffix}` as SeasonStatKey;
              return <div key={key} className="flex flex-wrap justify-between gap-x-1"><dt className="text-text-secondary" title={labels[key][isZh ? 1 : 0]}>{isZh ? suffix === "M" ? "命中" : "出手" : suffix === "M" ? "Made" : "Attempts"}</dt><dd className="font-mono tabular-nums text-text-primary">{number(row.stats[key])}</dd></div>;
            })}
          </dl>
        </div>)}
      </div>
      <p className="mt-2 text-[11px] text-text-secondary">{isZh ? "命中与出手为场均值；— 表示未收录、有争议或无出手。" : "Makes and attempts are per game. — means unrecorded, disputed or no attempts."}</p>
    </div>
    {extras.length > 0 && <dl className="grid grid-cols-3 sm:grid-cols-5 gap-2">{extras.map(key => stat(key))}</dl>}
    {children}
    <div className="border-t border-border/60 pt-3 text-xs leading-relaxed text-text-secondary">
      <p>{sourceName && sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{sourceName}</a> : (isZh ? "来源未标注" : "Source unlabelled")}{historicalCareer ? (isZh ? " · 第三方总计存档" : " · Secondary-source totals archive") : archived ? (isZh ? " · 网页存档快照" : " · Archived page snapshot") : provenance?.source === "espn" ? (isZh ? " · 备用来源" : " · Fallback source") : ""}
        {date && <> · {historicalCareer ? (isZh ? "检索于 " : "Retrieved ") : archived ? (isZh ? "采集于 " : "Captured ") : (isZh ? "API 获取于 " : "API retrieved ")}<time dateTime={date}>{date.slice(0, 10)}</time></>}
      </p>
      {historicalCareer ? <p className="mt-1">{isZh ? "场均由赛季总计 ÷ 出场数计算，命中率由总命中 ÷ 总出手计算。争议与早期缺失项保留 —。" : "Averages use season totals ÷ games; percentages use total makes ÷ attempts. Disputed and early-era missing fields remain —."}</p> : <details className="mt-1"><summary className="min-h-11 cursor-pointer py-3 focus-visible:outline-2 focus-visible:outline-accent">{isZh ? "来源与时间说明" : "Source and date details"}</summary><PlayerCareerSource provenance={provenance} isZh={isZh} checkingLive={checkingLive} /></details>}
    </div>
  </div>;
}

function CurrentSeasonStats({ playerId, playerName, teamTricode, locale, initialData }: Props) {
  const { data, loading, error, stale, retry } = usePlayerCareer(playerId, playerName ?? "", teamTricode ?? "", initialData);
  const isZh = locale === "zh";
  const retryButton = <button type="button" disabled={loading} onClick={retry} className="min-h-11 rounded-lg px-3 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50">{loading ? (isZh ? "检查中…" : "Checking…") : (isZh ? "重试" : "Retry")}</button>;
  if (!data?.careerSeasons.length) return <div className="rounded-xl border border-border/60 bg-bg-secondary/40 p-4 space-y-2">
    <p role="status" className="text-sm text-text-secondary">{loading ? (isZh ? "正在载入赛季统计…" : "Loading season statistics…") : error ? (isZh ? "赛季统计暂时不可用，请稍后重试。" : "Season statistics are temporarily unavailable. Please retry shortly.") : (isZh ? "数据源已响应，但未返回常规赛赛季记录。" : "The source responded with no regular-season records.")}</p>
    {!loading && <>{retryButton}<a className="inline-flex min-h-11 items-center px-3 text-xs text-accent" href={`https://www.nba.com/stats/player/${playerId}/traditional`} target="_blank" rel="noopener noreferrer">{isZh ? "查看 NBA 球员统计" : "View NBA player stats"}</a></>}
    {data?.provenance && <PlayerCareerSource provenance={data.provenance} isZh={isZh} checkingLive={loading} />}
  </div>;
  return <SeasonStatsContent playerId={playerId} rows={data.careerSeasons.map(careerSeasonStats)} locale={locale} provenance={data.provenance} checkingLive={loading}>
    {(stale || data.stale) && <div className="flex flex-wrap items-center gap-x-2 text-xs text-text-secondary" role="status"><p className="flex-1 min-w-0">{loading ? (isZh ? "正在检查实时来源；先显示已有数据。" : "Checking live sources; showing available data meanwhile.") : data.stale ? (isZh ? "显示固定日期的存档，可能缺少后续更新。可在 30 秒后重试。" : "Showing a dated archive that may miss later updates. Retry after 30 seconds.") : (isZh ? "刷新失败，保留上次成功的数据。可在 30 秒后重试。" : "Refresh unavailable; keeping the last successful data. Retry after 30 seconds.")}</p>{retryButton}</div>}
  </SeasonStatsContent>;
}

function HistoricalSeasonStats({ playerId, locale, historicalCareer }: Props & { historicalCareer: HistoricalCareerData }) {
  const [seasonType, setSeasonType] = useState<HistoricalCareerSeasonType>("Regular Season");
  const isZh = locale === "zh";
  return <div className="space-y-3">
    <div className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-bg-secondary p-1" role="group" aria-label={isZh ? "赛事类型" : "Competition"}>
      {(["Regular Season", "Playoffs"] as const).map(type => <button key={type} type="button" aria-pressed={seasonType === type} onClick={() => setSeasonType(type)} className={`min-h-11 rounded-lg px-3 text-sm font-medium ${type === seasonType ? "bg-accent text-white" : "text-text-secondary hover:bg-bg-card"}`}>{typeLabel(type, isZh)}</button>)}
    </div>
    <SeasonStatsContent key={seasonType} playerId={playerId} rows={historicalCareer.rows.filter(row => row.seasonType === seasonType).map(historicalSeasonStats)} locale={locale} seasonType={seasonType} historicalCareer={historicalCareer} />
  </div>;
}

export default function PlayerSeasonStats(props: Props) {
  return <section className="mt-4 min-w-0 rounded-2xl border border-border bg-bg-card p-3 sm:p-5" aria-label={props.locale === "zh" ? "详细赛季统计" : "Detailed season statistics"}>
    <h2 className="mb-3 text-base font-semibold text-text-primary">{props.locale === "zh" ? "赛季数据" : "Season statistics"}</h2>
    {props.historicalCareer ? <HistoricalSeasonStats key={props.playerId} {...props} historicalCareer={props.historicalCareer} /> : <CurrentSeasonStats key={props.playerId} {...props} />}
  </section>;
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import { CURRENT_SEASON } from "@/lib/constants";
import { normalizePlayerGameLog, validLogSeason, type PlayerGameLogData, type PlayerLogRow, type PlayerLogSeasonType, type PlayerLogStat } from "@/lib/player-game-log-data";
import { commitPlayerProfileUrl, usePlayerProfileLocation } from "./PlayerProfilePanels";

interface Props {
  playerId: number;
  playerName?: string;
  seasons?: string[];
  initialData?: PlayerGameLogData | null;
  initialSearch?: string;
  defaultSeason?: string;
}
interface LoadState { key: string; data: PlayerGameLogData | null; loading: boolean; error: boolean; }
const cache = new Map<string, PlayerGameLogData>();
const requests = new Map<string, Promise<PlayerGameLogData | null>>();
const show = (value: number | null) => value === null ? "—" : Number.isInteger(value) ? String(value) : value.toFixed(1);
const average = (rows: PlayerLogRow[], key: PlayerLogStat) => rows.length && rows.every(row => row[key] !== null) ? (rows.reduce((sum, row) => sum + row[key]!, 0) / rows.length).toFixed(1) : "—";
const pct = (rows: PlayerLogRow[], made: PlayerLogStat, attempts: PlayerLogStat) => {
  if (!rows.length || rows.some(row => row[made] === null || row[attempts] === null)) return "—";
  const attemptsTotal = rows.reduce((sum, row) => sum + row[attempts]!, 0);
  return attemptsTotal > 0 ? `${(rows.reduce((sum, row) => sum + row[made]!, 0) / attemptsTotal * 100).toFixed(1)}%` : "—";
};
export default function PlayerGameLog({ playerId, playerName, seasons = [], initialData = null, initialSearch = "", defaultSeason: preferredSeason }: Props) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const available = [...new Set([...seasons, initialData?.season, CURRENT_SEASON].filter(validLogSeason))].sort().reverse();
  const defaultSeason = initialData?.season ?? (validLogSeason(preferredSeason) ? preferredSeason : null) ?? seasons.filter(validLogSeason).sort().at(-1) ?? CURRENT_SEASON;
  const location = usePlayerProfileLocation(playerId, initialSearch);
  const query = new URLSearchParams(location.split("#")[0]);
  const requestedSeason = query.get("gameSeason");
  const season = requestedSeason && available.includes(requestedSeason) ? requestedSeason : defaultSeason;
  const seasonType: PlayerLogSeasonType = query.get("gameType") === "Playoffs" ? "Playoffs" : query.get("gameType") === "Pre Season" ? "Pre Season" : "Regular Season";
  const key = `${playerId}:${season}:${seasonType}`;
  const seed = initialData && initialData.playerId === playerId && initialData.season === season && initialData.seasonType === seasonType ? initialData : null;
  const [state, setState] = useState<LoadState>({ key, data: seed, loading: !seed, error: false });
  const [retry, setRetry] = useState(0);
  const [limit, setLimit] = useState(20);
  useEffect(() => {
    let cancelled = false;
    const saved = cache.get(key) ?? seed ?? null;
    // Each request owns its identity; a previous season/player can never leak.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ key, data: saved, loading: !saved, error: false });
    setLimit(20);
    if (saved && retry === 0) return;
    const identity = { playerId, season, seasonType };
    let request = requests.get(key);
    if (!request) {
      const params = new URLSearchParams({ playerId: String(playerId), season, seasonType });
      if (retry) params.set("refresh", "1");
      request = (async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 32000);
          try {
            const response = await fetch(`/api/player-game-log?${params}`, { signal: controller.signal });
            if (!response.ok) return null;
            const data = normalizePlayerGameLog(await response.json(), identity);
            if (data && !controller.signal.aborted) cache.set(key, data);
            return controller.signal.aborted ? null : data;
          } finally { clearTimeout(timeout); }
        } catch { return null; }
      })().finally(() => { requests.delete(key); });
      requests.set(key, request);
    }
    request.then(data => { if (!cancelled) setState({ key, data: data ?? saved, loading: false, error: !data }); });
    return () => { cancelled = true; };
  }, [key, playerId, season, seasonType, seed, retry]);
  const visible = state.key === key ? state : { key, data: cache.get(key) ?? seed ?? null, loading: !seed && !cache.has(key), error: false };
  const data = visible.data;
  const rows = data?.rows ?? [];
  const monthly = [...new Set(rows.map(row => row.date.slice(0, 7)))].sort().map(month => ({ month, rows: rows.filter(row => row.date.startsWith(month)) }));
  const choose = (field: "gameSeason" | "gameType", value: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set(field, value);
    commitPlayerProfileUrl(`${url.pathname}${url.search}${url.hash}`);
    setRetry(0);
  };
  const labelForType = (value: PlayerLogSeasonType) => value === "Playoffs" ? (isZh ? "季后赛" : "Playoffs") : value === "Pre Season" ? (isZh ? "季前赛" : "Preseason") : (isZh ? "常规赛" : "Regular season");
  const typeLabel = labelForType(seasonType);
  return <section className="mt-4 space-y-4" aria-label={isZh ? "球员逐场比赛" : "Player game logs"}>
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-xs text-text-secondary">{isZh ? "赛季" : "Season"}
        <select value={season} onChange={event => choose("gameSeason", event.target.value)} className="min-h-11 rounded-lg border border-border bg-bg-card px-3 text-sm text-text-primary">
          {available.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <div role="group" aria-label={isZh ? "赛事类型" : "Season type"} className="flex rounded-lg border border-border p-1">
        {(["Regular Season", "Playoffs", "Pre Season"] as const).map(value => <button key={value} type="button" aria-pressed={value === seasonType} onClick={() => choose("gameType", value)} className={`min-h-11 rounded-md px-3 text-xs ${value === seasonType ? "bg-accent text-white" : "text-text-secondary"}`}>{labelForType(value)}</button>)}
      </div>
    </div>
    <h2 className="text-base font-semibold">{season} · {typeLabel} · {isZh ? "逐场数据" : "Game by game"}</h2>
    <p className="text-xs leading-relaxed text-text-secondary">{isZh ? "默认显示最近已收录赛季，可切换赛季。常规赛不含季前赛、附加赛与全明星赛。" : "The latest recorded season opens by default. Regular season excludes preseason, play-in and All-Star games."}</p>
    {visible.loading && <div role="status" aria-busy="true" className="space-y-2"><p className="text-sm text-text-secondary">{isZh ? "正在加载该赛季比赛…" : "Loading this season’s games…"}</p>{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-10 rounded-lg bg-bg-secondary skeleton-shimmer" />)}</div>}
    {visible.error && <div role="status" className="rounded-lg border border-border p-4 text-sm text-text-secondary"><p>{data ? (isZh ? "刷新未成功，保留已加载记录。" : "Refresh failed; keeping the loaded records.") : (isZh ? "所选赛季的比赛来源暂时不可用，不代表没有出场。可切换赛季或重试。" : "The game-log source is unavailable for this selection. This does not mean no games were played. Choose another season or retry.")}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 min-h-11 text-accent">{isZh ? "重试" : "Retry"}</button></div>}
    {data && <>
      <p role="status" className="text-xs leading-relaxed text-text-secondary">{isZh ? `已收录 ${rows.length}${data.expectedGames ? ` / ${data.expectedGames}` : ""} 场` : `${rows.length}${data.expectedGames ? ` / ${data.expectedGames}` : ""} recorded games`} · {data.source.provider} · {data.source.archived ? (isZh ? "存档" : "Archive") : (isZh ? "来源响应" : "Source response")} {data.source.retrievedAt.slice(0, 10)}{data.coverage === "partial-source" ? (isZh ? " · 部分记录，不代表完整赛季" : " · Partial records, not a complete season") : ""}</p>
      {rows.length === 0 ? <div className="glass-tile p-5 text-sm text-text-secondary">{isZh ? "来源未返回此赛季 / 赛事的比赛记录。可切换到有记录的赛季；空白不等于球员零出场。" : "The source returned no game records for this season and competition. Choose another recorded season; an empty source does not establish zero appearances."}</div> : <>
        <dl className="grid grid-cols-3 gap-2">{[[isZh ? "场均得分" : "PTS / game", average(rows, "pts")], [isZh ? "场均篮板" : "REB / game", average(rows, "reb")], [isZh ? "场均助攻" : "AST / game", average(rows, "ast")], ["FG%", pct(rows, "fgm", "fga")], ["3P%", pct(rows, "fg3m", "fg3a")], ["FT%", pct(rows, "ftm", "fta")]].map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-border bg-bg-card p-3"><dt className="text-[10px] text-text-secondary">{label}</dt><dd className="mt-1 text-xl font-mono font-semibold tabular-nums">{value}</dd></div>)}</dl>
        <p className="text-xs text-text-secondary">{isZh ? "摘要仅按下方已收录比赛计算；MIN 为来源显示的单场分钟，可能经过取整。— 表示该项未提供。左右滑动查看全部数据。" : "Summary uses only the recorded games below. Individual MIN values may be rounded by the source. — means unavailable. Scroll horizontally for all columns."}</p>
        <details className="rounded-xl border border-border p-3" open={undefined}><summary className="min-h-11 cursor-pointer text-sm font-medium">{isZh ? "月度拆分" : "Monthly splits"}</summary><div className="mt-2 flex gap-2 overflow-x-auto pb-2">{monthly.map(bucket => <div key={bucket.month} className="min-w-36 rounded-lg bg-bg-secondary p-3 text-xs"><h3 className="font-semibold">{bucket.month}</h3><p className="mt-1 text-text-secondary">{bucket.rows.length} {isZh ? "场" : "games"} · {bucket.rows.filter(row => row.wl === "W").length} W / {bucket.rows.filter(row => row.wl === "L").length} L</p><p className="mt-2 font-mono">{average(bucket.rows, "pts")} / {average(bucket.rows, "reb")} / {average(bucket.rows, "ast")}</p><p className="mt-1 text-text-secondary">PTS / REB / AST · FG {pct(bucket.rows, "fgm", "fga")}</p></div>)}</div></details>
        <div className="glass-tile overflow-hidden"><div className="table-scroll-x overflow-x-auto overscroll-x-contain" role="region" aria-label={isZh ? "逐场比赛数据表，可横向滚动" : "Game log table, horizontally scrollable"} tabIndex={0}>
          <table className="w-full whitespace-nowrap text-xs"><caption className="sr-only">{playerName} · {season} · {typeLabel}</caption><thead><tr className="border-b border-border text-text-secondary"><th className="sticky left-0 z-10 bg-bg-card px-3 py-3 text-left">{isZh ? "日期 / 对手" : "Date / opponent"}</th>{["W/L", "MIN", "PTS", "REB", "AST", "STL", "BLK", "FG", "3P", "FT", "OREB", "DREB", "TOV", "PF", "+/−"].map(label => <th key={label} className="px-3 py-3 text-center">{label}</th>)}</tr></thead>
            <tbody>{rows.slice(0, limit).map(row => <tr key={row.id} className="border-b border-border/40"><td className="sticky left-0 bg-bg-card px-3 py-3"><GameLink row={row}><span className="block font-medium">{row.home ? "vs" : "@"} {row.opponent}</span><span className="mt-1 block text-[10px] text-text-secondary">{row.date}</span></GameLink></td><td className={`px-3 text-center ${row.wl === "W" ? "text-success" : row.wl === "L" ? "text-danger" : ""}`}>{row.wl ?? "—"}</td>{["min", "pts", "reb", "ast", "stl", "blk"].map(key => <td key={key} className={`px-3 text-center font-mono tabular-nums ${key === "pts" ? "font-semibold text-accent" : ""}`}>{show(row[key as PlayerLogStat])}</td>)}{([['fgm','fga'],['fg3m','fg3a'],['ftm','fta']] as const).map(([made, attempt]) => <td key={made} className="px-3 text-center font-mono tabular-nums">{show(row[made])}/{show(row[attempt])}</td>)}{["oreb", "dreb", "tov", "pf", "plusMinus"].map(key => <td key={key} className="px-3 text-center font-mono tabular-nums">{show(row[key as PlayerLogStat])}</td>)}</tr>)}</tbody>
            <tfoot><tr className="border-t-2 border-border bg-bg-secondary font-medium"><th className="sticky left-0 bg-bg-card px-3 py-3 text-left">{isZh ? "已收录场均" : "Recorded averages"}</th><td className="px-3 text-center">—</td>{(["min", "pts", "reb", "ast", "stl", "blk"] as const).map(key => <td key={key} className="px-3 text-center font-mono">{average(rows, key)}</td>)}{([['fgm','fga'],['fg3m','fg3a'],['ftm','fta']] as const).map(([made, attempt]) => <td key={made} className="px-3 text-center font-mono">{average(rows, made)}/{average(rows, attempt)}</td>)}{(["oreb", "dreb", "tov", "pf", "plusMinus"] as const).map(key => <td key={key} className="px-3 text-center font-mono">{average(rows, key)}</td>)}</tr></tfoot>
          </table>
        </div></div>
        {limit < rows.length && <button type="button" onClick={() => setLimit(value => value + 20)} className="min-h-11 w-full rounded-lg border border-border text-sm text-accent">{isZh ? `加载更多 (${limit} / ${rows.length})` : `Show more (${limit} / ${rows.length})`}</button>}
      </>}
      <div className="flex flex-wrap items-center gap-4 text-xs"><a href={data.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-accent">{isZh ? "查看来源" : "View source"} ↗</a><button type="button" onClick={() => setRetry(value => value + 1)} className="min-h-11 text-text-secondary">{isZh ? "刷新来源" : "Refresh source"}</button></div>
    </>}
  </section>;
}
function GameLink({ row, children }: { row: PlayerLogRow; children: React.ReactNode }) {
  return row.nbaGameId ? <Link href={`/game/${row.nbaGameId}`} className="block min-h-11 hover:text-accent">{children}</Link> : <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="block min-h-11 hover:text-accent">{children}</a>;
}

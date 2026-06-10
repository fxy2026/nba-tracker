"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CalendarRange } from "lucide-react";
import { CURRENT_SEASON } from "@/lib/constants";
import { useLocale } from "@/components/LocaleProvider";
import { TEAM_META } from "@/lib/teams";
import { teamLogoUrl } from "@/lib/teamUrls";
import EmptyState from "@/components/EmptyState";

interface LogRow {
  gameId: string;
  date: Date;
  opponent: string;
  home: boolean;
  wl: string;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  plusMinus: number | null;
}

interface MonthSplit {
  key: number;
  month: number; // 0-based
  gp: number;
  wins: number;
  losses: number;
  ppg: number;
  rpg: number;
  apg: number;
  fgPct: number | null;
}

const SEASON_TYPES = ["Regular Season", "Playoffs"] as const;
type SeasonType = (typeof SEASON_TYPES)[number];

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};
const MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// playergamelog GAME_DATE looks like "APR 09, 2026" — parse manually so we
// don't depend on engine-specific Date string parsing.
function parseGameDate(s: string): Date | null {
  const m = /^([A-Z]{3})\s+(\d{1,2}),\s*(\d{4})$/i.exec(s.trim());
  if (m) {
    const mo = MONTHS[m[1].toUpperCase()];
    if (mo != null) return new Date(Number(m[3]), mo, Number(m[2]));
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseRows(data: unknown): LogRow[] {
  const rs = (data as { resultSets?: { headers?: string[]; rowSet?: unknown[][] }[] })
    ?.resultSets?.[0];
  if (!Array.isArray(rs?.headers) || !Array.isArray(rs?.rowSet)) return [];
  const headers = rs.headers;
  const col = (name: string) => headers.indexOf(name);
  // playergamelog uses mixed-case "Game_ID" (see /api/player-shots) — accept both.
  const gi = col("Game_ID") >= 0 ? col("Game_ID") : col("GAME_ID");
  const di = col("GAME_DATE");
  const mi = col("MATCHUP");
  if (gi < 0 || di < 0 || mi < 0) return [];
  const num = (row: unknown[], i: number) => (i >= 0 && typeof row[i] === "number" ? (row[i] as number) : 0);
  const idx = {
    wl: col("WL"), min: col("MIN"), pts: col("PTS"), reb: col("REB"), ast: col("AST"),
    stl: col("STL"), blk: col("BLK"), fgm: col("FGM"), fga: col("FGA"),
    fg3m: col("FG3M"), fg3a: col("FG3A"), pm: col("PLUS_MINUS"),
  };
  const rows: LogRow[] = [];
  for (const row of rs.rowSet) {
    const gameId = row[gi];
    const date = parseGameDate(String(row[di] ?? ""));
    if (!gameId || !date) continue;
    const matchup = String(row[mi] ?? "");
    const opponent = matchup.split(" ").pop() || "";
    rows.push({
      gameId: String(gameId),
      date,
      opponent,
      home: matchup.includes(" vs"),
      wl: idx.wl >= 0 ? String(row[idx.wl] ?? "") : "",
      min: num(row, idx.min),
      pts: num(row, idx.pts),
      reb: num(row, idx.reb),
      ast: num(row, idx.ast),
      stl: num(row, idx.stl),
      blk: num(row, idx.blk),
      fgm: num(row, idx.fgm),
      fga: num(row, idx.fga),
      fg3m: num(row, idx.fg3m),
      fg3a: num(row, idx.fg3a),
      plusMinus: idx.pm >= 0 && typeof row[idx.pm] === "number" ? (row[idx.pm] as number) : null,
    });
  }
  return rows;
}

interface Props {
  playerId: number;
  playerName?: string;
}

export default function PlayerGameLog({ playerId, playerName }: Props) {
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const [seasonType, setSeasonType] = useState<SeasonType>("Regular Season");
  const [rows, setRows] = useState<LogRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // Loading state reset on playerId/seasonType/retry change — intentional
  // dep-change refetch pattern (same as PlayerStatsBundle).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    (async () => {
      try {
        const qs = new URLSearchParams({
          endpoint: "playergamelog",
          PlayerID: String(playerId),
          Season: CURRENT_SEASON,
          SeasonType: seasonType,
        });
        const res = await fetch(`/api/stats?${qs}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) {
          if (!controller.signal.aborted) { setError(true); setLoading(false); }
          return;
        }
        const data = await res.json();
        if (!controller.signal.aborted) setRows(parseRows(data));
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
      if (!controller.signal.aborted) setLoading(false);
    })();
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [playerId, seasonType, retryKey]);

  // Monthly splits (chronological) + season aggregate, from the loaded rows.
  const { splits, season } = useMemo(() => {
    const empty = { splits: [] as MonthSplit[], season: null as MonthSplit | null };
    if (!rows || rows.length === 0) return empty;
    const byMonth = new Map<number, LogRow[]>();
    for (const g of [...rows].reverse()) {
      const key = g.date.getFullYear() * 12 + g.date.getMonth();
      const bucket = byMonth.get(key);
      if (bucket) bucket.push(g);
      else byMonth.set(key, [g]);
    }
    const aggregate = (key: number, month: number, games: LogRow[]): MonthSplit => {
      let pts = 0, reb = 0, ast = 0, fgm = 0, fga = 0, wins = 0, losses = 0;
      for (const g of games) {
        pts += g.pts; reb += g.reb; ast += g.ast; fgm += g.fgm; fga += g.fga;
        if (g.wl === "W") wins++;
        else if (g.wl === "L") losses++;
      }
      const gp = games.length;
      return {
        key, month, gp, wins, losses,
        ppg: pts / gp, rpg: reb / gp, apg: ast / gp,
        fgPct: fga > 0 ? fgm / fga : null,
      };
    };
    const splits = [...byMonth.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([key, games]) => aggregate(key, key % 12, games));
    return { splits, season: aggregate(-1, -1, rows) };
  }, [rows]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-tile h-28 w-32 shrink-0 skeleton-shimmer" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="glass-tile h-10 skeleton-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    const encodedName = encodeURIComponent(playerName || "");
    return (
      <div className="bg-bg-secondary/60 rounded-xl p-4 text-center space-y-3">
        <p className="text-sm text-text-secondary">{t.playerStats.detailedUnavailable}</p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <a href={`https://www.nba.com/player/${playerId}`} target="_blank" rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 bg-bg-card border border-border rounded-lg hover:border-accent/50 text-text-primary transition-colors">
            {t.playerStats.viewOnNba}
          </a>
          <a href={`https://www.basketball-reference.com/search/search.fcgi?search=${encodedName}`} target="_blank" rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 bg-bg-card border border-border rounded-lg hover:border-accent/50 text-text-primary transition-colors">
            {t.playerStats.basketballRef}
          </a>
          <button onClick={() => setRetryKey((k) => k + 1)} className="text-xs px-3 py-1.5 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors cursor-pointer">
            {t.common.retry}
          </button>
        </div>
      </div>
    );
  }

  const monthLabel = (m: number) => (isZh ? `${m + 1}月` : MONTH_EN[m]);

  return (
    <div className="space-y-6">
      {/* Season type toggle */}
      <div className="glass-tile inline-flex overflow-hidden p-1">
        {SEASON_TYPES.map((st) => (
          <button
            key={st}
            onClick={() => setSeasonType(st)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
              seasonType === st
                ? "bg-accent text-white shadow-md"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            }`}
          >
            {st === "Regular Season" ? t.statsPage.regularSeason : t.statsPage.playoffs}
          </button>
        ))}
      </div>

      {!rows || rows.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          tone="neutral"
          title={
            seasonType === "Playoffs"
              ? (isZh ? "暂无季后赛比赛" : "No playoff games yet")
              : (isZh ? "本赛季暂无比赛数据" : "No games this season")
          }
          description={
            isZh
              ? `${CURRENT_SEASON} 赛季还没有该类型的比赛记录。`
              : `No ${seasonType === "Playoffs" ? "playoff" : "regular season"} games recorded for ${CURRENT_SEASON} yet.`
          }
        />
      ) : (
        <>
          {/* ─── Monthly splits strip ─────────────────────── */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary/60 shrink-0">
                / {isZh ? "月度拆分" : "Monthly splits"}
              </h2>
              <span className="h-px flex-1 bg-border" />
              <span className="text-[10px] text-text-secondary shrink-0">
                {isZh ? "场均 得分 / 篮板 / 助攻" : "Per-game PTS / REB / AST"}
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {season && (
                <SplitTile
                  label={isZh ? "赛季" : "Season"}
                  split={season}
                  isZh={isZh}
                  featured
                />
              )}
              {splits.map((s) => (
                <SplitTile key={s.key} label={monthLabel(s.month)} split={s} isZh={isZh} />
              ))}
            </div>
          </div>

          {/* ─── Full game-by-game table ──────────────────── */}
          <div className="glass-tile overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <h3 className="text-sm font-semibold">
                {isZh ? "逐场数据" : "Game by game"} ({CURRENT_SEASON})
              </h3>
              <span className="ml-auto text-[10px] font-mono tabular-nums text-text-secondary">
                {isZh ? `${rows.length} 场` : `${rows.length} games`}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-text-secondary">
                    <th className="text-left py-2.5 px-3 sticky left-0 bg-bg-card">{t.playerStats.date}</th>
                    <th className="text-left py-2.5 px-2">{isZh ? "对手" : "OPP"}</th>
                    <th className="text-center py-2.5 px-2">{t.playerStats.wl}</th>
                    <th className="text-center py-2.5 px-2">MIN</th>
                    <th className="text-center py-2.5 px-2 text-accent font-bold">PTS</th>
                    <th className="text-center py-2.5 px-2">REB</th>
                    <th className="text-center py-2.5 px-2">AST</th>
                    <th className="text-center py-2.5 px-2">STL</th>
                    <th className="text-center py-2.5 px-2">BLK</th>
                    <th className="text-center py-2.5 px-2">FG</th>
                    <th className="text-center py-2.5 px-2">3P</th>
                    <th className="text-center py-2.5 px-2">+/-</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((g) => {
                    const oppMeta = TEAM_META[g.opponent];
                    return (
                      <tr key={g.gameId} className="border-b border-border/30 hover:bg-bg-hover/50">
                        <td className="py-2 px-3 text-text-secondary sticky left-0 bg-bg-card whitespace-nowrap font-mono tabular-nums">
                          {g.date.toLocaleDateString(isZh ? "zh-CN" : "en-US", { month: "short", day: "numeric" })}
                        </td>
                        <td className="py-2 px-2">
                          <Link
                            href={`/game/${g.gameId}`}
                            className="inline-flex items-center gap-1.5 text-text-primary hover:text-accent transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <span className="text-[9px] text-text-secondary w-4 shrink-0">
                              {g.home ? (isZh ? "主" : "vs") : (isZh ? "客" : "@")}
                            </span>
                            {oppMeta && (
                              <Image
                                src={teamLogoUrl(oppMeta.teamId)}
                                alt={g.opponent}
                                width={18}
                                height={18}
                                unoptimized
                                className="shrink-0"
                              />
                            )}
                            <span className="font-medium">{g.opponent}</span>
                          </Link>
                        </td>
                        <td className={`text-center py-2 px-2 font-bold ${g.wl === "W" ? "text-success" : g.wl === "L" ? "text-danger" : "text-text-secondary"}`}>
                          {g.wl || "-"}
                        </td>
                        <td className="text-center py-2 px-2 text-text-secondary font-mono tabular-nums">{g.min}</td>
                        <td className="text-center py-2 px-2 font-bold text-accent font-mono tabular-nums">
                          {g.pts}
                          {g.pts >= 40 && <span className="ml-0.5 text-[8px] text-accent-amber">&#9733;</span>}
                        </td>
                        <td className="text-center py-2 px-2 font-mono tabular-nums">{g.reb}</td>
                        <td className="text-center py-2 px-2 font-mono tabular-nums">{g.ast}</td>
                        <td className="text-center py-2 px-2 text-text-secondary font-mono tabular-nums">{g.stl}</td>
                        <td className="text-center py-2 px-2 text-text-secondary font-mono tabular-nums">{g.blk}</td>
                        <td className="text-center py-2 px-2 text-text-secondary font-mono tabular-nums whitespace-nowrap">{g.fgm}-{g.fga}</td>
                        <td className="text-center py-2 px-2 text-text-secondary font-mono tabular-nums whitespace-nowrap">{g.fg3m}-{g.fg3a}</td>
                        <td className={`text-center py-2 px-2 font-mono tabular-nums ${
                          g.plusMinus == null ? "text-text-secondary"
                            : g.plusMinus > 0 ? "text-success"
                            : g.plusMinus < 0 ? "text-danger" : "text-text-secondary"
                        }`}>
                          {g.plusMinus == null ? "-" : `${g.plusMinus > 0 ? "+" : ""}${g.plusMinus}`}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Season averages footer */}
                  {season && (
                    <tr className="border-t-2 border-border bg-bg-secondary/50 font-medium">
                      <td className="py-2 px-3 sticky left-0 bg-bg-secondary/50 text-text-primary font-bold whitespace-nowrap">
                        {isZh ? "场均" : "Avg"}
                      </td>
                      <td className="py-2 px-2 text-text-secondary whitespace-nowrap">
                        {season.gp} {isZh ? "场" : "GP"}
                      </td>
                      <td className="text-center py-2 px-2 font-mono tabular-nums whitespace-nowrap">
                        <span className="text-success">{season.wins}</span>
                        <span className="text-text-secondary">-</span>
                        <span className="text-danger">{season.losses}</span>
                      </td>
                      <td className="text-center py-2 px-2 text-text-secondary font-mono tabular-nums">
                        {(rows.reduce((s, g) => s + g.min, 0) / season.gp).toFixed(1)}
                      </td>
                      <td className="text-center py-2 px-2 font-bold text-accent font-mono tabular-nums">{season.ppg.toFixed(1)}</td>
                      <td className="text-center py-2 px-2 font-mono tabular-nums">{season.rpg.toFixed(1)}</td>
                      <td className="text-center py-2 px-2 font-mono tabular-nums">{season.apg.toFixed(1)}</td>
                      <td className="text-center py-2 px-2 text-text-secondary font-mono tabular-nums">
                        {(rows.reduce((s, g) => s + g.stl, 0) / season.gp).toFixed(1)}
                      </td>
                      <td className="text-center py-2 px-2 text-text-secondary font-mono tabular-nums">
                        {(rows.reduce((s, g) => s + g.blk, 0) / season.gp).toFixed(1)}
                      </td>
                      <td className="text-center py-2 px-2 text-text-secondary font-mono tabular-nums">
                        {season.fgPct != null ? (season.fgPct * 100).toFixed(1) + "%" : "-"}
                      </td>
                      <td className="text-center py-2 px-2 text-text-secondary font-mono tabular-nums">
                        {(() => {
                          const m3 = rows.reduce((s, g) => s + g.fg3m, 0);
                          const a3 = rows.reduce((s, g) => s + g.fg3a, 0);
                          return a3 > 0 ? ((m3 / a3) * 100).toFixed(1) + "%" : "-";
                        })()}
                      </td>
                      <td className="text-center py-2 px-2 text-text-secondary font-mono tabular-nums">
                        {(() => {
                          const withPm = rows.filter((g) => g.plusMinus != null);
                          if (withPm.length === 0) return "-";
                          const avg = withPm.reduce((s, g) => s + (g.plusMinus as number), 0) / withPm.length;
                          return `${avg > 0 ? "+" : ""}${avg.toFixed(1)}`;
                        })()}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SplitTile({ label, split, isZh, featured = false }: {
  label: string;
  split: MonthSplit;
  isZh: boolean;
  featured?: boolean;
}) {
  return (
    <div className={`glass-tile ${featured ? "glass-tile-featured" : ""} p-3 min-w-[128px] shrink-0`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className={`text-[10px] font-mono uppercase tracking-[0.2em] ${featured ? "text-accent-amber" : "text-text-secondary"}`}>
          {label}
        </p>
        <p className="text-[9px] font-mono tabular-nums text-text-secondary whitespace-nowrap">
          {split.gp} {isZh ? "场" : "GP"}
        </p>
      </div>
      <p className="text-[10px] font-mono tabular-nums mt-0.5">
        <span className="text-success">{split.wins}{isZh ? "胜" : "W"}</span>
        <span className="text-text-secondary"> · </span>
        <span className="text-danger">{split.losses}{isZh ? "负" : "L"}</span>
      </p>
      <div className="mt-2 space-y-1 text-[11px] font-mono tabular-nums">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[9px] uppercase tracking-[0.15em] text-text-secondary">PTS</span>
          <span className="font-bold text-accent-amber">{split.ppg.toFixed(1)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[9px] uppercase tracking-[0.15em] text-text-secondary">REB</span>
          <span className="text-text-primary">{split.rpg.toFixed(1)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[9px] uppercase tracking-[0.15em] text-text-secondary">AST</span>
          <span className="text-text-primary">{split.apg.toFixed(1)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[9px] uppercase tracking-[0.15em] text-text-secondary">FG%</span>
          <span className="text-text-secondary">{split.fgPct != null ? (split.fgPct * 100).toFixed(1) : "-"}</span>
        </div>
      </div>
    </div>
  );
}

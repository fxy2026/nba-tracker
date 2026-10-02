"use client";

// Career Arc — the interactive heart of the tool. Two linked visualizations:
//   (1) CareerTrendChart — per-season stat trend (metric toggle, peak season)
//   (2) a season SCRUBBER driving CareerCourt — a half-court shot-zone heatmap
//       for the scrubbed season, with that season's shooting splits beside it.
// Career rows come from /api/player (the proxy with the breaker + ESPN
// fallback); per-season shots come from /api/player-shots. Both endpoints work
// from the browser; stats.nba.com blocks the server, so all fetching is here.

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import { usePlayerCareer } from "@/lib/usePlayerCareer";
import { playerShotRequestUrl, requestPlayerShotData } from "@/lib/player-shot-request";
import { createLatestRequestGate } from "@/lib/latest-request";
import { useLocale } from "@/components/LocaleProvider";
import { playerHeadshotUrl } from "@/lib/teamUrls";
import { aggregateZoneStats } from "@/lib/shot-zones";
import CareerTrendChart, { type MetricKey } from "./CareerTrendChart";
import CareerCourt from "./CareerCourt";
import PlayerPicker from "./PlayerPicker";
import type { CareerSeason } from "./types";

interface Props {
  playerId: number;
  playerName: string;
  teamTricode: string;
}

interface ShotRow {
  x: number;
  y: number;
  shotDistance: number;
  shotResult: string;
}

// Traded seasons yield one row per team plus a combined "TOT" row. Keep one
// point per season (prefer TOT, else the longest stint) so the x-axis is clean.
function dedupeSeasons(rows: CareerSeason[]): CareerSeason[] {
  const bySeason = new Map<string, CareerSeason>();
  const order: string[] = [];
  for (const r of rows) {
    if (!r.SEASON_ID) continue;
    const prev = bySeason.get(r.SEASON_ID);
    if (!prev) {
      bySeason.set(r.SEASON_ID, r);
      order.push(r.SEASON_ID);
    } else if (
      r.TEAM_ABBREVIATION === "TOT" ||
      (prev.TEAM_ABBREVIATION !== "TOT" && (r.GP ?? 0) > (prev.GP ?? 0))
    ) {
      bySeason.set(r.SEASON_ID, r);
    }
  }
  return order.map((s) => bySeason.get(s)!);
}

const LEAGUE_AVG = 46; // league-average FG% baseline for the zone color scale

export default function CareerArc({ playerId, playerName, teamTricode }: Props) {
  const { locale } = useLocale();
  const isZh = locale === "zh";

  // ---- Career rows ----
  const { data: career, loading: careerLoading, error: careerError, stale: careerStale, retry: retryCareer } = usePlayerCareer(playerId, playerName, teamTricode);
  const seasons = useMemo(() => dedupeSeasons(career?.careerSeasons ?? []), [career]);

  // ---- UI state ----
  const [metric, setMetric] = useState<MetricKey>("PTS");
  const [selection, setSelection] = useState<number | null>(null);
  const selectedIndex = Math.min(selection ?? Math.max(0, seasons.length - 1), Math.max(0, seasons.length - 1));
  const setSelectedIndex = (value: number) => setSelection(value);

  // ---- Shots for the selected season ----
  const [rawShots, setShots] = useState<ShotRow[]>([]);
  const [shotContext, setShotContext] = useState("");
  const [shotLoading, setShotLoading] = useState(false);
  const [shotError, setShotError] = useState("");
  const [shotGames, setShotGames] = useState({ loaded: 0, total: 0 });
  const shotGate = useRef(createLatestRequestGate());

  const selectedSeason = seasons && seasons[selectedIndex] ? seasons[selectedIndex] : null;
  const seasonId = selectedSeason?.SEASON_ID ?? "";
  const seasonTeam = selectedSeason?.TEAM_ABBREVIATION ?? "";
  // "TOT" (traded) has no single team for the shot API — fall back to the
  // player's current tricode so we at least try the current season.
  const shotTeam = seasonTeam && seasonTeam !== "TOT" ? seasonTeam : teamTricode;
  const shotKey = `${playerId}:${seasonId}:${shotTeam}`;
  const shots = useMemo(() => shotContext === shotKey ? rawShots : [], [shotContext, shotKey, rawShots]);
  const displayShotLoading = shotLoading || (!!seasonId && shotContext !== shotKey);
  const displayShotError = shotContext === shotKey ? shotError : "";

  const fetchShots = useCallback(async () => {
    setShotContext(shotKey);
    setShots([]);
    if (!seasonId || !shotTeam) {
      shotGate.current.cancel();
      setShotLoading(false);
      setShots([]);
      setShotError(isZh ? "该赛季无投篮数据" : "No shot data for this season");
      return;
    }
    const request = shotGate.current.begin();
    setShotLoading(true);
    setShotError("");
    setShotGames({ loaded: 0, total: 0 });
    try {
      const data = await requestPlayerShotData(playerShotRequestUrl(playerId, seasonTeam === "TOT" ? "TOT" : shotTeam, seasonId, "regular"), request.signal);
      if (!request.isCurrent()) return;
      const list = data.shots;
      setShots(list);
      setShotGames({ loaded: data.gamesLoaded, total: data.totalGames });
      if (list.length === 0) {
        setShotError(isZh ? "可用比赛中没有该球员的投篮出手记录。" : "No field-goal shot records for this player in the available games.");
      }
    } catch {
      if (!request.isCurrent()) return;
      setShots([]);
      setShotError(isZh ? "加载投篮数据失败" : "Failed to load shot data");
    } finally {
      if (request.isCurrent()) setShotLoading(false);
    }
  }, [playerId, shotTeam, seasonTeam, seasonId, shotKey, isZh]);

  useEffect(() => {
    if (!seasonId) return;
    // fetchShots is memoized on [playerId, shotTeam, seasonId, isZh], so this
    // re-runs exactly when the scrubbed season changes. It toggles its own
    // loading state — intentional dep-change refetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchShots();
    const gate = shotGate.current;
    return () => gate.cancel();
  }, [fetchShots, seasonId]);

  const zoneStats = useMemo(() => aggregateZoneStats(shots), [shots]);
  const overallMade = useMemo(() => shots.filter((s) => s.shotResult === "Made").length, [shots]);
  const overallPct = shots.length > 0 ? (overallMade / shots.length) * 100 : 0;

  const fmtPct = (v: number | null | undefined) =>
    typeof v === "number" && Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : "—";
  const fmtNum = (v: number | null | undefined) =>
    typeof v === "number" && Number.isFinite(v) ? v.toFixed(1) : "—";

  // ---- Render guards ----
  if (careerLoading && seasons.length === 0) {
    return (
      <div className="space-y-4">
        <PlayerPicker isZh={isZh} currentName={playerName} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="h-[260px] glass-tile skeleton-shimmer" />
          <div className="h-[260px] glass-tile skeleton-shimmer" />
        </div>
      </div>
    );
  }

  if (seasons.length === 0) {
    const encodedName = encodeURIComponent(playerName || "");
    return (
      <div className="space-y-4">
        <PlayerPicker isZh={isZh} currentName={playerName} />
        <div className="glass-tile p-6 text-center space-y-3">
          <p className="text-sm text-text-secondary">
            {careerError ? (isZh ? "暂时无法加载该球员的生涯数据。" : "Couldn't load this player's career data right now.") : (isZh ? "数据源已响应，但没有可用的生涯赛季记录。" : "The source responded without any available career season records.")}
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <a
              href={`https://www.nba.com/player/${playerId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 bg-bg-card border border-border rounded-lg hover:border-accent/50 text-text-primary transition-colors"
            >
              NBA.com
            </a>
            {playerName && (
              <a
                href={`https://www.basketball-reference.com/search/search.fcgi?search=${encodedName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 bg-bg-card border border-border rounded-lg hover:border-accent/50 text-text-primary transition-colors"
              >
                Basketball-Reference
              </a>
            )}
            <button
              onClick={retryCareer}
              className="text-xs px-3 py-1.5 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors cursor-pointer"
            >
              {isZh ? "重试" : "Retry"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const firstSeason = seasons[0].SEASON_ID;
  const lastSeason = seasons[seasons.length - 1].SEASON_ID;
  const singleSeason = seasons.length === 1;

  return (
    <div className="space-y-5">
      {(careerStale || careerError) && <div role="status" className="glass-tile p-3 text-sm text-text-secondary">
        <p>{isZh ? "保留上次成功加载的生涯数据，可能已过时。" : "Showing the last successfully loaded career data; it may be stale."}</p>
        <button type="button" disabled={careerLoading} onClick={retryCareer} className="text-accent hover:underline">{isZh ? "重试" : "Retry"}</button>
      </div>}
      {/* Picker + identity */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-bg-secondary shrink-0">
            <Image
              src={playerHeadshotUrl(playerId)}
              alt={playerName}
              width={48}
              height={48}
              unoptimized
              className="w-full h-full object-cover object-top"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-text-primary truncate">
              {playerName || (isZh ? "球员" : "Player")}
            </p>
            <p className="text-[11px] text-text-secondary">
              {seasons.length} {isZh ? "个赛季" : seasons.length === 1 ? "season" : "seasons"} · {firstSeason} – {lastSeason}
            </p>
          </div>
        </div>
        <div className="sm:ml-auto w-full sm:w-auto">
          <PlayerPicker isZh={isZh} currentName={playerName} />
        </div>
      </div>

      {/* (1) Career trend */}
      <CareerTrendChart
        seasons={seasons}
        metric={metric}
        onMetricChange={setMetric}
        selectedIndex={selectedIndex}
        onSelectIndex={setSelectedIndex}
        isZh={isZh}
      />

      {/* (2) Season scrubber → shot-zone heatmap + splits */}
      <div className="glass-tile p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span className="w-1 h-4 bg-accent rounded-full" />
            {isZh ? "赛季投篮热区" : "Season Shot Zones"}
          </h3>
          {shots.length > 0 && (
            <span className="text-xs text-text-secondary">
              {overallMade}/{shots.length} FG ({overallPct.toFixed(1)}%)
              {shotGames.loaded > 0 && (
                <span className="text-text-secondary/60 ml-1">
                  · {shotGames.loaded}/{shotGames.total} {isZh ? "场" : "games"}
                </span>
              )}
            </span>
          )}
        </div>

        {/* Scrubber */}
        <div className="mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-text-secondary shrink-0 w-14">{firstSeason}</span>
            <input
              type="range"
              min={0}
              max={seasons.length - 1}
              step={1}
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(Number(e.target.value))}
              disabled={singleSeason}
              aria-label={isZh ? "选择赛季" : "Select season"}
              className="flex-1 accent-[var(--accent)] cursor-pointer disabled:cursor-default"
            />
            <span className="text-xs font-mono text-text-secondary shrink-0 w-14 text-right">{lastSeason}</span>
          </div>
          <div className="mt-2 flex items-center justify-center gap-2 text-sm">
            <button
              onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
              disabled={selectedIndex === 0}
              aria-label={isZh ? "上一个赛季" : "Previous season"}
              className="px-2 py-0.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-default"
            >
              ‹
            </button>
            <span className="font-mono text-sm font-bold text-accent tabular-nums">{seasonId}</span>
            <span className="text-xs text-text-secondary">· {seasonTeam}</span>
            <button
              onClick={() => setSelectedIndex(Math.min(seasons.length - 1, selectedIndex + 1))}
              disabled={selectedIndex === seasons.length - 1}
              aria-label={isZh ? "下一个赛季" : "Next season"}
              className="px-2 py-0.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-default"
            >
              ›
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(200px,260px)] gap-4 items-start">
          {/* Court */}
          <div className="relative min-h-[260px]">
            {displayShotLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-card/60 rounded-lg text-text-secondary text-sm">
                {isZh ? "加载投篮数据…" : "Loading shots…"}
              </div>
            )}
            {!displayShotLoading && shots.length === 0 ? (
              <div className="h-[300px] flex flex-col items-center justify-center text-center gap-2 border border-dashed border-border rounded-lg">
                <p className="text-text-secondary text-sm">{displayShotError || (isZh ? "该赛季无投篮数据" : "No shot data for this season")}</p>
                {displayShotError && <button type="button" onClick={() => void fetchShots()} className="text-accent text-xs hover:underline">{isZh ? "重试投篮数据" : "Retry shot data"}</button>}
                <p className="text-text-secondary/60 text-xs max-w-[280px]">
                  {isZh
                    ? "逐球投篮记录仅覆盖近年的赛季；早期赛季无数据时此处留空。"
                    : "Shot-by-shot data only covers recent seasons; older seasons show no zones."}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-3 mb-2 text-[10px] text-text-secondary">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm" style={{ background: "rgb(59,130,246)" }} />
                    {isZh ? "低于均值" : "Below avg"}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm" style={{ background: "rgb(245,158,11)" }} />
                    {isZh ? "联盟均值" : "League avg"}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm" style={{ background: "rgb(239,68,68)" }} />
                    {isZh ? "高于均值" : "Above avg"}
                  </span>
                </div>
                <CareerCourt
                  zoneStats={zoneStats}
                  overallPct={overallPct}
                  leagueAvg={LEAGUE_AVG}
                  isZh={isZh}
                  seasonLabel={seasonId}
                />
              </>
            )}
          </div>

          {/* Season shooting splits */}
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary/70">
              {seasonId} · {seasonTeam} · {isZh ? "赛季数据" : "Season splits"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {([
                [isZh ? "出场" : "GP", selectedSeason?.GP != null ? String(selectedSeason.GP) : "—"],
                ["MIN", fmtNum(selectedSeason?.MIN)],
                ["PPG", fmtNum(selectedSeason?.PTS)],
                ["RPG", fmtNum(selectedSeason?.REB)],
                ["APG", fmtNum(selectedSeason?.AST)],
                ["FG%", fmtPct(selectedSeason?.FG_PCT)],
                ["3P%", fmtPct(selectedSeason?.FG3_PCT)],
                ["FT%", fmtPct(selectedSeason?.FT_PCT)],
              ] as const).map(([label, value]) => (
                <div key={label} className="bg-bg-secondary/50 rounded-lg px-2.5 py-2">
                  <p className="text-[9px] font-mono uppercase tracking-wider text-text-secondary/70">{label}</p>
                  <p className="text-sm font-bold font-mono tabular-nums text-text-primary">{value}</p>
                </div>
              ))}
            </div>
            {shots.length > 0 && (
              <div className="bg-accent/5 border border-accent/15 rounded-lg px-2.5 py-2 mt-2">
                <p className="text-[9px] font-mono uppercase tracking-wider text-text-secondary/70">
                  {isZh ? "本赛季逐球命中率" : "Tracked FG this season"}
                </p>
                <p className="text-sm font-bold font-mono tabular-nums text-accent">
                  {overallPct.toFixed(1)}% <span className="text-text-secondary font-normal">({overallMade}/{shots.length})</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

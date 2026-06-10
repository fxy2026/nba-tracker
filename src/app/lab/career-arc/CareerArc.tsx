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
import { CURRENT_SEASON } from "@/lib/constants";
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
  const [seasons, setSeasons] = useState<CareerSeason[] | null>(null);
  const [careerLoading, setCareerLoading] = useState(true);
  const [careerError, setCareerError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // ---- UI state ----
  const [metric, setMetric] = useState<MetricKey>("PTS");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // ---- Shots for the selected season ----
  const [shots, setShots] = useState<ShotRow[]>([]);
  const [shotLoading, setShotLoading] = useState(false);
  const [shotError, setShotError] = useState("");
  const [shotGames, setShotGames] = useState({ loaded: 0, total: 0 });
  const shotReqId = useRef(0);

  // Fetch career rows whenever the player (or a manual retry) changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCareerLoading(true);
    setCareerError(false);
    setSeasons(null);
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 9000);

    (async () => {
      try {
        const qs = new URLSearchParams({ id: String(playerId) });
        if (playerName) qs.set("name", playerName);
        if (teamTricode) qs.set("team", teamTricode);
        const res = await fetch(`/api/player?${qs}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) { if (timedOut || !controller.signal.aborted) { setCareerError(true); setCareerLoading(false); } return; }
        const data = await res.json();
        if (!controller.signal.aborted) {
          const rows = dedupeSeasons((data.careerSeasons || []) as CareerSeason[]);
          setSeasons(rows);
          // Default the scrubber to the most recent season.
          setSelectedIndex(rows.length > 0 ? rows.length - 1 : 0);
        }
      } catch {
        if (timedOut || !controller.signal.aborted) setCareerError(true);
      }
      if (timedOut || !controller.signal.aborted) setCareerLoading(false);
    })();

    return () => { controller.abort(); clearTimeout(timeout); };
  }, [playerId, playerName, teamTricode, retryKey]);

  const selectedSeason = seasons && seasons[selectedIndex] ? seasons[selectedIndex] : null;
  const seasonId = selectedSeason?.SEASON_ID ?? "";
  const seasonTeam = selectedSeason?.TEAM_ABBREVIATION ?? "";
  // "TOT" (traded) has no single team for the shot API — fall back to the
  // player's current tricode so we at least try the current season.
  const shotTeam = seasonTeam && seasonTeam !== "TOT" ? seasonTeam : teamTricode;

  const fetchShots = useCallback(async () => {
    if (!seasonId || !shotTeam) {
      setShots([]);
      setShotError(isZh ? "该赛季无投篮数据" : "No shot data for this season");
      return;
    }
    const reqId = ++shotReqId.current;
    setShotLoading(true);
    setShotError("");
    setShotGames({ loaded: 0, total: 0 });
    try {
      const params = new URLSearchParams({ playerId: String(playerId), team: shotTeam, seasonType: "regular" });
      // Current season → omit season (CDN schedule path); historical → pass it.
      if (seasonId !== CURRENT_SEASON) params.set("season", seasonId);
      const res = await fetch(`/api/player-shots?${params}`);
      if (reqId !== shotReqId.current) return; // a newer scrub superseded us
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      if (reqId !== shotReqId.current) return;
      const list = (data.shots || []) as ShotRow[];
      setShots(list);
      setShotGames({ loaded: data.gamesLoaded || 0, total: data.totalGames || 0 });
      if (list.length === 0) {
        setShotError(isZh ? "该赛季无投篮数据（年代较早或无逐球记录）" : "No shot data for this season (too old or no play-by-play)");
      }
    } catch {
      if (reqId !== shotReqId.current) return;
      setShots([]);
      setShotError(isZh ? "加载投篮数据失败" : "Failed to load shot data");
    } finally {
      if (reqId === shotReqId.current) setShotLoading(false);
    }
  }, [playerId, shotTeam, seasonId, isZh]);

  useEffect(() => {
    if (!seasonId) return;
    // fetchShots is memoized on [playerId, shotTeam, seasonId, isZh], so this
    // re-runs exactly when the scrubbed season changes. It toggles its own
    // loading state — intentional dep-change refetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchShots();
  }, [fetchShots, seasonId]);

  const zoneStats = useMemo(() => aggregateZoneStats(shots), [shots]);
  const overallMade = useMemo(() => shots.filter((s) => s.shotResult === "Made").length, [shots]);
  const overallPct = shots.length > 0 ? (overallMade / shots.length) * 100 : 0;

  const fmtPct = (v: number | null | undefined) =>
    typeof v === "number" && Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : "—";
  const fmtNum = (v: number | null | undefined) =>
    typeof v === "number" && Number.isFinite(v) ? v.toFixed(1) : "—";

  // ---- Render guards ----
  if (careerLoading) {
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

  if (careerError || !seasons || seasons.length === 0) {
    const encodedName = encodeURIComponent(playerName || "");
    return (
      <div className="space-y-4">
        <PlayerPicker isZh={isZh} currentName={playerName} />
        <div className="glass-tile p-6 text-center space-y-3">
          <p className="text-sm text-text-secondary">
            {isZh ? "暂时无法加载该球员的生涯数据。" : "Couldn't load this player's career data right now."}
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
              onClick={() => setRetryKey((k) => k + 1)}
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
              onClick={() => setSelectedIndex((i) => Math.max(0, i - 1))}
              disabled={selectedIndex === 0}
              aria-label={isZh ? "上一个赛季" : "Previous season"}
              className="px-2 py-0.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-default"
            >
              ‹
            </button>
            <span className="font-mono text-sm font-bold text-accent tabular-nums">{seasonId}</span>
            <span className="text-xs text-text-secondary">· {seasonTeam}</span>
            <button
              onClick={() => setSelectedIndex((i) => Math.min(seasons.length - 1, i + 1))}
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
            {shotLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-card/60 rounded-lg text-text-secondary text-sm">
                {isZh ? "加载投篮数据…" : "Loading shots…"}
              </div>
            )}
            {!shotLoading && shots.length === 0 ? (
              <div className="h-[300px] flex flex-col items-center justify-center text-center gap-2 border border-dashed border-border rounded-lg">
                <p className="text-text-secondary text-sm">{shotError || (isZh ? "该赛季无投篮数据" : "No shot data for this season")}</p>
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

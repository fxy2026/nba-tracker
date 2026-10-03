"use client";

// The career scrubber owns selection; the linked court reads validated local
// archive summaries for that exact player and regular season.

import { useState, useMemo } from "react";
import Image from "next/image";
import CareerArchiveNotice from "./CareerArchiveNotice";
import type { PlayerCareerData } from "@/lib/player-career-data";
import { usePlayerCareer } from "@/lib/usePlayerCareer";
import { useLocale } from "@/components/LocaleProvider";
import { playerHeadshotUrl } from "@/lib/teamUrls";
import CareerTrendChart, { type MetricKey } from "./CareerTrendChart";
import CareerSeasonHeatmap from "./CareerSeasonHeatmap";
import PlayerPicker from "./PlayerPicker";
import type { CareerSeason } from "./types";

interface Props {
  playerId: number;
  playerName: string;
  teamTricode: string;
  initialCareer?: PlayerCareerData;
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

export default function CareerArc({ playerId, playerName, teamTricode, initialCareer }: Props) {
  const { locale } = useLocale();
  const isZh = locale === "zh";

  // ---- Career rows ----
  const { data: career, loading: careerLoading, error: careerError, stale: careerStale, retry: retryCareer } = usePlayerCareer(playerId, playerName, teamTricode, initialCareer);
  const seasons = useMemo(() => dedupeSeasons(career?.careerSeasons ?? []), [career]);

  // ---- UI state ----
  const [metric, setMetric] = useState<MetricKey>("PTS");
  const [selection, setSelection] = useState<number | null>(null);
  const selectedIndex = Math.min(selection ?? Math.max(0, seasons.length - 1), Math.max(0, seasons.length - 1));
  const setSelectedIndex = (value: number) => setSelection(value);

  const selectedSeason = seasons[selectedIndex] ?? null;
  const seasonId = selectedSeason?.SEASON_ID ?? "";
  const seasonTeam = selectedSeason?.TEAM_ABBREVIATION ?? "";

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
      {(careerStale || careerError) && career?.provenance?.source !== "nba-com" && <div role="status" className="glass-tile p-3 text-sm text-text-secondary">
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

      {career?.provenance?.source === "nba-com" && <CareerArchiveNotice
        provenance={career.provenance}
        isZh={isZh}
        checkingLive={careerLoading}
        onRetry={retryCareer}
      />}

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
              className="min-h-11 sm:min-h-0 flex-1 accent-[var(--accent)] cursor-pointer disabled:cursor-default"
            />
            <span className="text-xs font-mono text-text-secondary shrink-0 w-14 text-right">{lastSeason}</span>
          </div>
          <div className="mt-2 flex items-center justify-center gap-2 text-sm">
            <button
              onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
              disabled={selectedIndex === 0}
              aria-label={isZh ? "上一个赛季" : "Previous season"}
              className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 px-2 py-0.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-default"
            >
              ‹
            </button>
            <span className="font-mono text-sm font-bold text-accent tabular-nums">{seasonId}</span>
            <span className="text-xs text-text-secondary">· {seasonTeam}</span>
            <button
              onClick={() => setSelectedIndex(Math.min(seasons.length - 1, selectedIndex + 1))}
              disabled={selectedIndex === seasons.length - 1}
              aria-label={isZh ? "下一个赛季" : "Next season"}
              className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 px-2 py-0.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-default"
            >
              ›
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_220px] gap-4 items-start">
          <CareerSeasonHeatmap playerId={playerId} season={seasonId} locale={isZh ? "zh" : "en"} />

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

          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback, useId } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { GitCompareArrows, ArrowLeftRight, Users, Award, TrendingUp, Crown, Activity, Share2, ThumbsUp } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { useToast } from "@/components/ToastProvider";
import { playerHeadshotUrl } from "@/lib/teamUrls";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";
import RadarChart from "@/components/RadarChart";
import type { PlayerAccolades } from "@/lib/playerAccolades";
import type { PlayStyle } from "@/lib/iconicSeasons";
import { PLAY_STYLE_LABEL } from "@/lib/iconicSeasons";
import { getLeagueEra } from "@/lib/leagueEra";
import { playerIndexLabel, type PlayerIndexProvenance } from "@/lib/player-index-provenance";
import { compareStatPair, displayCompareStat, isCompareStat, productionScore, productionShares, uniqueStatLeader, type CompareStat } from "@/lib/compare-stat-values";

export interface PlayerData {
  personId: number;
  firstName: string;
  lastName: string;
  teamAbbr: string;
  teamName: string;
  teamCity: string;
  jersey: string;
  position: string;
  pts: CompareStat;
  reb: CompareStat;
  ast: CompareStat;
  // Set by /api/search for retired legends — used to badge them in results
  // and skip jersey/position display (which we don't carry for legends).
  isLegend?: boolean;
  // Iconic-season snapshot (e.g., 2016 LeBron, 2018 Harden). Differs from
  // legend in that the stats are SINGLE-season, not career, and there are
  // trophy flags + a narrative line to surface in the comparison panel.
  isIconicSeason?: boolean;
  iconicId?: string;
  season?: string;
  seasonYear?: number;
  story?: string;
  storyZh?: string;
  styles?: PlayStyle[];
  // Shooting splits (decimals 0-1)
  fgPct?: CompareStat;
  tpPct?: CompareStat;
  ftPct?: CompareStat;
  // Single-season defensive stats — only iconic-season + legends carry these
  spg?: CompareStat;
  bpg?: CompareStat;
  // Playoff per-game for the same season
  playoffPpg?: CompareStat;
  playoffRpg?: CompareStat;
  playoffApg?: CompareStat;
  playoffGp?: CompareStat;
  mvp?: boolean;
  champion?: boolean;
  finalsMvp?: boolean;
  dpoy?: boolean;
  scoringTitle?: boolean;
  // Career-level accolade counts — populated for any player our static
  // table knows (most legends + ~20 superstars). Drives the trophy strip
  // and the "MVPs/rings/All-Stars" tiles below the radar chart.
  accolades?: Partial<PlayerAccolades> | null;
  indexProvenance?: PlayerIndexProvenance;
}

type PlayerSlots = [PlayerData | null, PlayerData | null, PlayerData | null];
type PlayerIds = [string | null, string | null, string | null];
type PlayerLookup = { controller: AbortController; promise: Promise<PlayerData | null> };
const comparisonPlayerId = (player: PlayerData) => player.iconicId ?? String(player.personId);
const comparisonIds = (query: string): PlayerIds => {
  const params = new URLSearchParams(query);
  return [params.get("p1"), params.get("p2"), params.get("p3")];
};
const comparisonQuery = (ids: PlayerIds) => {
  const params = new URLSearchParams();
  ids.forEach((id, index) => { if (id) params.set(`p${index + 1}`, id); });
  return params.toString();
};

const COMPARE_STATS = [
  { key: "pts", label: "PPG", color: "text-accent", barColor: "var(--accent)" },
  { key: "reb", label: "RPG", color: "text-success", barColor: "var(--success)" },
  { key: "ast", label: "APG", color: "text-accent", barColor: "#60a5fa" },
] as const;

export function comparisonSourceLabel(player: PlayerData, isZh: boolean): string {
  if (player.isIconicSeason) return isZh ? `${player.season ?? "赛季未注明"} · 人工整理的单赛季数据` : `${player.season ?? "season unspecified"} · curated single-season stats`;
  if (player.isLegend) return isZh ? "人工整理的生涯场均" : "Curated career averages";
  return player.indexProvenance
    ? playerIndexLabel(player.indexProvenance, isZh ? "zh" : "en")
    : (isZh ? "来源信息暂不可用" : "Source information unavailable");
}

/** Career averages compare with career averages; season stats need the same declared season. */
export function comparisonPeriodsCompatible(players: readonly PlayerData[]): boolean {
  if (players.length < 2) return false;
  const periods = players.map(player => player.isIconicSeason
    ? (player.season ? `season:${player.season}` : null)
    : player.isLegend ? "career"
    : (player.indexProvenance?.season ? `season:${player.indexProvenance.season}` : null));
  return periods[0] !== null && periods.every(period => period === periods[0]);
}

function SourceLabel({ player, isZh }: { player: PlayerData; isZh: boolean }) {
  return <p className="text-[10px] text-text-secondary mt-1">{comparisonSourceLabel(player, isZh)}</p>;
}

function honorsSourceLabel(isZh: boolean): string {
  return isZh ? "人工整理 · 截至 2025-26 赛季开始 · — 表示未知" : "Curated · as of the start of 2025-26 · — means unknown";
}

// Only complete pairs become radar axes. Real zero remains a known value.
export function buildRadarStats(p1: PlayerData, p2: PlayerData, mode: "RS" | "PO") {
  const axes: { label: string; home: number; away: number; max: number }[] = [];
  const push = (label: string, a: CompareStat, b: CompareStat) => {
    const pair = compareStatPair(a, b);
    if (pair) axes.push({ label, home: pair.a, away: pair.b, max: pair.max });
  };
  if (mode === "PO") {
    push("PPG", p1.playoffPpg, p2.playoffPpg);
    push("RPG", p1.playoffRpg, p2.playoffRpg);
    push("APG", p1.playoffApg, p2.playoffApg);
  } else {
    push("PPG", p1.pts, p2.pts);
    push("RPG", p1.reb, p2.reb);
    push("APG", p1.ast, p2.ast);
    push("SPG", p1.spg, p2.spg);
    push("BPG", p1.bpg, p2.bpg);
  }
  return axes;
}

// 3-way compact comparison block — three player cards stacked horizontally,
// each with headshot + name + key stats. Highlight columns where a player
// has the highest value across all three.
type CompareTranslations = {
  comparePage: { samePosition: string; statsComparison: string };
  common: { vs: string };
};
export function ThreeWayCompare({ p1, p2, p3, isZh, t }: { p1: PlayerData; p2: PlayerData; p3: PlayerData; isZh: boolean; t: CompareTranslations }) {
  void t;
  const playersArr = [p1, p2, p3];
  const leaderIdx = uniqueStatLeader;
  const statRows: { label: string; values: CompareStat[]; fmt?: (v: number) => string }[] = [
    { label: "PPG", values: [p1.pts, p2.pts, p3.pts], fmt: (v) => v.toFixed(1) },
    { label: "RPG", values: [p1.reb, p2.reb, p3.reb], fmt: (v) => v.toFixed(1) },
    { label: "APG", values: [p1.ast, p2.ast, p3.ast], fmt: (v) => v.toFixed(1) },
  ];
  const optionalRows = [
    { key: "spg", label: "SPG", percent: false },
    { key: "bpg", label: "BPG", percent: false },
    { key: "fgPct", label: "FG%", percent: true },
    { key: "tpPct", label: "3P%", percent: true },
    { key: "ftPct", label: "FT%", percent: true },
  ] as const;
  for (const { key, label, percent } of optionalRows) {
    const values = playersArr.map(player => player[key]);
    if (values.some(value => value !== undefined)) {
      statRows.push({ label, values, fmt: value => percent ? `${(value * 100).toFixed(1)}%` : value.toFixed(1) });
    }
  }

  // Tally categorical wins (highlight whoever leads the most rows)
  const wins = [0, 0, 0];
  for (const row of statRows) {
    const idx = leaderIdx(row.values);
    if (idx >= 0) wins[idx]++;
  }
  const completeComparison = statRows.every(row => row.values.every(isCompareStat));
  const samePeriod = comparisonPeriodsCompatible(playersArr);
  const overallLeader = completeComparison && samePeriod ? leaderIdx(wins) : -1;

  const accRows: { label: string; key: keyof PlayerAccolades }[] = [
    { label: isZh ? "总冠军" : "Rings", key: "championships" },
    { label: "MVP", key: "mvps" },
    { label: "FMVP", key: "finalsMvps" },
    { label: isZh ? "全明星" : "All-Star", key: "allStars" },
    { label: "All-NBA", key: "allNba" },
  ];

  return (
    <div className="glass-tile overflow-hidden">
      <div className="grid grid-cols-3 gap-px bg-border">
        {playersArr.map((p, i) => (
          <div key={i} className={`bg-bg-card p-4 flex flex-col items-center text-center ${overallLeader === i ? "ring-1 ring-accent-amber/40" : ""}`}>
            <div className="w-16 h-16 rounded-full overflow-hidden bg-bg-secondary mb-2">
              <Image src={playerHeadshotUrl(p.personId, "260x190")} alt={`${p.firstName} ${p.lastName}`} width={64} height={64} unoptimized className="w-full h-full object-cover object-top" />
            </div>
            <p className="font-bold text-text-primary text-sm truncate w-full">{p.firstName} {p.lastName}</p>
            {p.isIconicSeason ? (
              <span className="text-[9px] font-mono tabular-nums px-1.5 py-0.5 rounded mt-1 bg-accent/15 text-accent">{p.season}</span>
            ) : p.isLegend ? (
              <span className="text-[9px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-full mt-1 bg-accent-amber/15 text-accent-amber">{isZh ? "传奇" : "Legend"}</span>
            ) : null}
            <p className="text-[10px] text-text-secondary mt-1">{p.teamAbbr}</p>
            <SourceLabel player={p} isZh={isZh} />
          </div>
        ))}
      </div>

      {/* Stat rows */}
      <div className="divide-y divide-border/40">
        {statRows.map((row) => {
          const idx = samePeriod ? leaderIdx(row.values) : -1;
          return (
            <div key={row.label} className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-2 px-4 py-2.5">
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary w-12">{row.label}</span>
              {row.values.map((v, i) => {
                const fmt = row.fmt ?? ((x: number) => String(x));
                const isLeader = idx === i;
                return (
                  <span key={i} className={`text-center text-sm font-mono tabular-nums ${isLeader ? "text-accent-amber font-bold" : "text-text-primary"}`}>
                    {isCompareStat(v) ? fmt(v) : "—"}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Accolades row */}
      {(p1.accolades || p2.accolades || p3.accolades) && (
        <div className="border-t border-border bg-bg-secondary/20">
          <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary/60 px-4 pt-3">
            / {isZh ? "生涯成就" : "Career Accolades"}
          </p>
          <p className="text-[9px] text-text-secondary px-4 mt-1">{honorsSourceLabel(isZh)}</p>
          <div className="divide-y divide-border/40 mt-1">
            {accRows.map((acc) => {
              const vals = [p1.accolades?.[acc.key], p2.accolades?.[acc.key], p3.accolades?.[acc.key]];
              const idx = leaderIdx(vals);
              return (
                <div key={acc.key} className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-2 px-4 py-2">
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary w-16">{acc.label}</span>
                  {vals.map((v, i) => (
                    <span key={i} className={`text-center text-sm font-light font-mono tabular-nums ${idx === i ? "text-accent-amber font-bold" : "text-text-primary"}`}>
                      {displayCompareStat(v)}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Overall verdict */}
      <div className="px-4 py-3 bg-bg-secondary/40 border-t border-border text-center">
        {overallLeader >= 0 ? (
          <p className="text-sm">
            <span className="text-accent-amber font-bold">
              {playersArr[overallLeader].firstName} {playersArr[overallLeader].lastName}
            </span>
            <span className="text-text-secondary"> {isZh ? `统治 ${wins[overallLeader]}/${statRows.length} 项数据` : `leads ${wins[overallLeader]}/${statRows.length} categories`}</span>
          </p>
        ) : (
          <p className="text-sm text-text-secondary">
            {!completeComparison
              ? (isZh ? "数据不完整，无法判定整体领先者" : "Incomplete stats: overall comparison unavailable")
              : !samePeriod
                ? (isZh ? "数据时期不同或未知，无法判定整体领先者" : "Different or unknown periods: overall comparison unavailable")
                : (isZh ? "数据各有千秋——平分秋色" : "Each holds their own")}
          </p>
        )}
      </div>
    </div>
  );
}

// FG% / 3P% / FT% row triplet. Each line shows the two raw percentages
// flanking a small bar where the winner side is amber.
export function ShootingSplits({ p1, p2, isZh }: { p1: PlayerData; p2: PlayerData; isZh: boolean }) {
  const samePeriod = comparisonPeriodsCompatible([p1, p2]);
  const rows: { label: string; v1: CompareStat; v2: CompareStat }[] = [
    { label: "FG%", v1: p1.fgPct, v2: p2.fgPct },
    { label: "3P%", v1: p1.tpPct, v2: p2.tpPct },
    { label: "FT%", v1: p1.ftPct, v2: p2.ftPct },
  ].filter((r) => r.v1 !== undefined || r.v2 !== undefined);
  if (rows.length === 0) return null;

  return (
    <div className="pt-4 mt-2 border-t border-border space-y-2.5">
      <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary/60">
        / {isZh ? "投篮分布" : "Shooting splits"}
      </p>
      {rows.map((r) => {
        const pair = compareStatPair(r.v1, r.v2);
        const fmt = (v: CompareStat) => isCompareStat(v) ? `${(v * 100).toFixed(1)}%` : "—";
        return (
          <div key={r.label}>
            <div className="flex items-center justify-between mb-1 text-xs font-mono tabular-nums">
              <span className={samePeriod && pair?.winner === 0 ? "text-accent-amber font-semibold" : "text-text-secondary"}>{fmt(r.v1)}</span>
              <span className="text-text-secondary uppercase tracking-[0.15em]">{r.label}</span>
              <span className={samePeriod && pair?.winner === 1 ? "text-accent-amber font-semibold" : "text-text-secondary"}>{fmt(r.v2)}</span>
            </div>
            {pair && (
              <div className="flex gap-1 h-1.5">
                <div className="flex-1 flex justify-end">
                  <div className={`h-full rounded-l-full ${samePeriod && pair.winner === 0 ? "bg-accent-amber/70" : "bg-accent/30"}`} style={{ width: `${pair.ratioA * 100}%` }} />
                </div>
                <div className="flex-1">
                  <div className={`h-full rounded-r-full ${samePeriod && pair.winner === 1 ? "bg-accent-amber/70" : "bg-success/30"}`} style={{ width: `${pair.ratioB * 100}%` }} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Vertical column rendering 1-3 style chips. Empty when the entry has none.
function StyleTagsCol({ styles, isZh }: { styles?: PlayStyle[]; isZh: boolean }) {
  if (!styles || styles.length === 0) {
    return <div className="bg-bg-card p-3" />;
  }
  return (
    <div className="bg-bg-card p-3 flex flex-wrap gap-1.5 items-center justify-center">
      {styles.map((s) => {
        const label = PLAY_STYLE_LABEL[s];
        return (
          <span
            key={s}
            className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20"
          >
            {isZh ? label.zh : label.en}
          </span>
        );
      })}
    </div>
  );
}

// Era-context strip: player PPG alongside the exact-season league team benchmark.
// Shows for each iconic-season player on their own side; falls back to
// no benchmark when league data is not available for that exact year.
export function EraContext({ p1, p2, isZh }: { p1: PlayerData; p2: PlayerData; isZh: boolean }) {
  const renderSide = (p: PlayerData) => {
    if (p.seasonYear === undefined) return null;
    const era = getLeagueEra(p.seasonYear);
    // The shared lookup may return a nearby year; do not silently substitute it.
    if (!era || era.year !== p.seasonYear) return null;
    return (
      <div className="bg-bg-card p-3 text-[11px] text-text-secondary leading-relaxed">
        <div className="font-mono tabular-nums">
          <span className="text-accent-amber">{displayCompareStat(p.pts, 1)}</span>
          <span className="text-text-secondary/60"> PPG</span>
          <span className="text-text-secondary/40 mx-1.5">·</span>
          <span className="text-text-secondary">
            {isZh ? "联盟球队场均得分" : "League team PPG"}: {era.ppg.toFixed(1)}
          </span>
        </div>
        <div className="text-[10px] mt-1">
          {isZh
            ? `人工整理的联盟基准 · ${era.season} · 节奏 ${era.pace.toFixed(1)} 回合/48分钟`
            : `Curated league benchmark · ${era.season} · pace ${era.pace.toFixed(1)} poss/48 min`}
        </div>
      </div>
    );
  };
  const side1 = renderSide(p1);
  const side2 = renderSide(p2);
  if (!side1 && !side2) return null;
  return (
    <div className="grid grid-cols-2 gap-px bg-border/40 border-b border-border">
      {side1 ?? <div className="bg-bg-card p-3" />}
      {side2 ?? <div className="bg-bg-card p-3" />}
    </div>
  );
}

// One accolade tile: label, both values, mini comparison bar. Winner side
// gets the accent-amber treatment; ties show in neutral text.
export function AccoladeTile({ label, v1, v2 }: { label: string; v1: CompareStat; v2: CompareStat }) {
  const pair = compareStatPair(v1, v2);
  const winner1 = pair?.winner === 0;
  const winner2 = pair?.winner === 1;
  return (
    <div className="glass-tile p-3 text-center">
      <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary/60">{label}</p>
      <div className="flex items-baseline justify-center gap-2 mt-1">
        <span className={`text-lg font-light font-mono tabular-nums ${winner1 ? "text-accent-amber" : "text-text-primary"}`}>
          {displayCompareStat(v1)}
        </span>
        <span className="text-[9px] text-text-secondary/40">vs</span>
        <span className={`text-lg font-light font-mono tabular-nums ${winner2 ? "text-accent-amber" : "text-text-primary"}`}>
          {displayCompareStat(v2)}
        </span>
      </div>
      {pair && (
        <div className="flex gap-0.5 mt-1.5 h-1">
          <div className="flex-1 flex justify-end">
            <div className={`h-full rounded-l-full ${winner1 ? "bg-accent-amber" : "bg-accent/40"}`} style={{ width: `${pair.ratioA * 100}%` }} />
          </div>
          <div className="flex-1">
            <div className={`h-full rounded-r-full ${winner2 ? "bg-accent-amber" : "bg-success/40"}`} style={{ width: `${pair.ratioB * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

// Trophy strip for iconic-season cards. Only the flags set on the entry
// render — the dataset already filters this per season (e.g. 2018 Harden
// gets MVP + ScoringTitle, no champion).
function TrophyRow({ p }: { p: PlayerData }) {
  const items: { label: string; tone: string }[] = [];
  if (p.mvp) items.push({ label: "MVP", tone: "bg-accent-amber/15 text-accent-amber border-accent-amber/30" });
  if (p.finalsMvp) items.push({ label: "FMVP", tone: "bg-accent-amber/15 text-accent-amber border-accent-amber/30" });
  if (p.champion) items.push({ label: "🏆", tone: "bg-success/15 text-success border-success/30" });
  if (p.dpoy) items.push({ label: "DPOY", tone: "bg-accent/15 text-accent border-accent/30" });
  if (p.scoringTitle) items.push({ label: "Scoring", tone: "bg-danger/10 text-danger border-danger/30" });
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-1 mt-2">
      {items.map((it) => (
        <span
          key={it.label}
          className={`text-[9px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded border ${it.tone}`}
        >
          {it.label}
        </span>
      ))}
    </div>
  );
}

const search = async (q: string, setter: (r: PlayerData[]) => void, signal: AbortSignal) => {
  if (q.length < 2) { setter([]); return; }
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&context=1`, { signal });
    if (res.ok) {
      const json = await res.json();
      if (!signal.aborted) setter(json.data || []);
    }
  } catch { /* ignore */ }
};

function useDebouncedSearch(query: string, setResults: (r: PlayerData[]) => void) {
  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => search(query, setResults, controller.signal), 300);
    return () => { clearTimeout(t); controller.abort(); };
  }, [query, setResults]);
}

// Search input + results dropdown shared by all three player slots.
// `compact` is the deliberate smaller styling for the optional 3rd slot;
// `onClear` renders the inline Remove button (3rd slot only).
function PlayerSearchBox({ player, query, results, placeholder, isZh, compact, onQuery, onPick, onClear }: {
  player: PlayerData | null;
  query: string;
  results: PlayerData[];
  placeholder: string;
  isZh: boolean;
  compact?: boolean;
  onQuery: (q: string) => void;
  onPick: (p: PlayerData) => void;
  onClear?: () => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<{ query: string; results: PlayerData[]; index: number } | null>(null);
  // Dismiss the draft, rather than its current result array: a response that
  // arrives after Escape/outside click must not reopen the same suggestions.
  // A new preset query still opens automatically, as it did before.
  const isOpen = !player && query.length >= 2 && results.length > 0 && dismissedQuery !== query;
  const activeIndex = isOpen && highlight?.query === query && highlight.results === results ? highlight.index : -1;
  const optionId = (index: number) => `${listId}-${comparisonPlayerId(results[index])}`;
  const dismiss = useCallback(() => {
    setDismissedQuery(query);
    setHighlight(null);
  }, [query]);
  const pickPlayer = (selected: PlayerData) => {
    dismiss();
    onPick(selected);
  };

  useEffect(() => {
    const outsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) dismiss();
    };
    document.addEventListener("pointerdown", outsidePointer);
    return () => document.removeEventListener("pointerdown", outsidePointer);
  }, [dismiss]);

  useEffect(() => {
    if (activeIndex >= 0) {
      listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  return (
    <div ref={rootRef} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) dismiss();
    }}>
      <input
        type="text"
        role="combobox"
        aria-label={placeholder}
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        autoComplete="off"
        value={player ? `${player.firstName} ${player.lastName}` : query}
        onFocus={() => setDismissedQuery(null)}
        onClick={() => setDismissedQuery(null)}
        onChange={(e) => {
          setDismissedQuery(null);
          setHighlight(null);
          onQuery(e.target.value);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === "Escape") {
            if (isOpen) { event.preventDefault(); event.stopPropagation(); }
            dismiss();
          } else if (event.key === "Tab") {
            dismiss();
          } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !player && query.length >= 2 && results.length > 0) {
            event.preventDefault();
            setDismissedQuery(null);
            const index = event.key === "ArrowDown"
              ? (activeIndex + 1) % results.length
              : (activeIndex < 0 ? results.length - 1 : (activeIndex - 1 + results.length) % results.length);
            setHighlight({ query, results, index });
          } else if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            pickPlayer(results[activeIndex]);
          }
        }}
        placeholder={placeholder}
        className={compact
          ? "w-full glass-tile px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/70 focus:outline-none focus:border-accent"
          : "w-full glass-tile px-4 py-3 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"}
      />
      {player && onClear && (
        <button
          onClick={onClear}
          aria-label={isZh ? "移除第三人" : "Remove third player"}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary hover:text-accent px-2 py-1 cursor-pointer"
        >
          {isZh ? "移除" : "Remove"}
        </button>
      )}
      {isOpen && (
        <div
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label={placeholder}
          className="z-50 top-full mt-1 w-full glass-tile shadow-xl max-h-48"
          // Unlayered glass-tile relative/hidden rules override Tailwind utilities.
          style={{ position: "absolute", overflowY: "auto" }}
        >
          {results.map((p, index) => (
            <button key={comparisonPlayerId(p)} id={optionId(index)} type="button" role="option"
              aria-selected={index === activeIndex} tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pickPlayer(p)}
              className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-hover text-left text-sm ${index === activeIndex ? "bg-bg-hover" : ""}`}>
              <span className="font-medium">{p.firstName} {p.lastName}</span>
              {p.isIconicSeason ? (
                <span className="text-[9px] font-mono tabular-nums px-1.5 py-0.5 rounded-full bg-accent/15 text-accent">
                  {p.season}
                </span>
              ) : p.isLegend ? (
                <span className="text-[9px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-full bg-accent-amber/15 text-accent-amber">
                  {isZh ? "传奇" : "Legend"}
                </span>
              ) : null}
              <span className="text-text-secondary text-xs ml-auto">{p.teamAbbr}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const [query1, setQuery1] = useState("");
  const [query2, setQuery2] = useState("");
  const [results1, setResults1] = useState<PlayerData[]>([]);
  const [results2, setResults2] = useState<PlayerData[]>([]);
  const [player1, setPlayer1] = useState<PlayerData | null>(null);
  const [player2, setPlayer2] = useState<PlayerData | null>(null);
  // Optional 3rd slot — when set, the page collapses the rich radar/era/
  // story sections (designed for pairwise debate) and switches to a
  // compact 3-column tile grid for headline numbers + accolades + pick.
  const [player3, setPlayer3] = useState<PlayerData | null>(null);
  const [query3, setQuery3] = useState("");
  const [results3, setResults3] = useState<PlayerData[]>([]);
  // Toggle the radar chart between regular-season per-game and playoff
  // per-game (only when both selected players carry playoff stats).
  const [radarMode, setRadarMode] = useState<"RS" | "PO">("RS");
  // Reapplying a preset is a fresh search intent, even if its text is unchanged.
  const [presetRevision, setPresetRevision] = useState(0);

  const searchParams = useSearchParams();
  const incomingQuery = searchParams.toString();
  const selectedRef = useRef<PlayerSlots>([player1, player2, player3]);
  const requestedIdsRef = useRef<PlayerIds>([null, null, null]);
  const knownPlayersRef = useRef(new Map<string, PlayerData>());
  const lookupsRef = useRef(new Map<string, PlayerLookup>());
  const attemptedIdsRef = useRef(new Set<string>());
  const generationRef = useRef(0);
  const writtenQueryRef = useRef<string | null>(null);
  const { toast } = useToast();
  // Local "who would win" pick — keyed by the comparison pair so swapping
  // players resets the badge. localStorage only; no backend tally.
  const [pick, setPick] = useState<"p1" | "p2" | null>(null);

  const applyPlayers = useCallback((players: PlayerSlots) => {
    selectedRef.current = players;
    setPlayer1(players[0]); setPlayer2(players[1]); setPlayer3(players[2]);
  }, []);

  // Keep unresolved IDs as well as displayed records. Editing one slot while
  // another loads must not silently remove the other player from the URL.
  const resolvePlayers = useCallback((ids: PlayerIds, available: PlayerSlots) => {
    const generation = ++generationRef.current;
    requestedIdsRef.current = ids;
    applyPlayers(available);
    for (const [id, lookup] of lookupsRef.current) {
      if (!ids.includes(id)) {
        lookup.controller.abort();
        lookupsRef.current.delete(id);
      }
    }
    const resolve = (id: string | null): Promise<PlayerData | null> => {
      if (!id) return Promise.resolve(null);
      const known = knownPlayersRef.current.get(id);
      if (known) return Promise.resolve(known);
      const pending = lookupsRef.current.get(id);
      if (pending) {
        attemptedIdsRef.current.add(id);
        return pending.promise;
      }
      // A failed unchanged slot must not retry on each keystroke in another.
      if (attemptedIdsRef.current.has(id)) return Promise.resolve(null);
      attemptedIdsRef.current.add(id);
      const controller = new AbortController();
      const lookup: PlayerLookup = { controller, promise: Promise.resolve(null) };
      lookup.promise = (async () => {
        try {
          const res = await fetch(`/api/search?id=${encodeURIComponent(id)}&context=1`, { signal: controller.signal });
          if (!res.ok || controller.signal.aborted) return null;
          const json = await res.json();
          if (controller.signal.aborted || !json.data || comparisonPlayerId(json.data) !== id) return null;
          knownPlayersRef.current.set(id, json.data);
          return json.data as PlayerData;
        } catch { return null; }
        finally {
          if (lookupsRef.current.get(id) === lookup) lookupsRef.current.delete(id);
        }
      })();
      lookupsRef.current.set(id, lookup);
      return lookup.promise;
    };
    void Promise.all([resolve(ids[0]), resolve(ids[1]), resolve(ids[2])]).then((players) => {
      if (generation !== generationRef.current) return;
      if (comparisonQuery(ids) !== comparisonQuery(comparisonIds(window.location.search))) return;
      applyPlayers(players);
    });
  }, [applyPlayers]);

  // Incoming navigation owns the slots. Only explicit edits write history;
  // an old selection can never reflect over a Back/Forward destination.
  useEffect(() => {
    // Ignore an obsolete Next acknowledgement after rapid local replacements.
    if (incomingQuery !== new URLSearchParams(window.location.search).toString()) return;
    if (writtenQueryRef.current === incomingQuery) {
      writtenQueryRef.current = null;
      return;
    }
    writtenQueryRef.current = null;
    attemptedIdsRef.current.clear();
    const ids = comparisonIds(incomingQuery);
    const available: PlayerSlots = ids.map(id => id ? knownPlayersRef.current.get(id) ?? null : null) as PlayerSlots;
    // A new URL replaces the old comparison and its autocomplete drafts.
    setQuery1(""); setQuery2(""); setQuery3("");
    setResults1([]); setResults2([]); setResults3([]);
    resolvePlayers(ids, available);
  }, [incomingQuery, resolvePlayers]);

  useEffect(() => () => {
    ++generationRef.current;
    for (const lookup of lookupsRef.current.values()) lookup.controller.abort();
    lookupsRef.current.clear();
  }, []);

  const commitPlayers = (players: PlayerSlots, ids: PlayerIds) => {
    players.forEach(player => {
      if (player) knownPlayersRef.current.set(comparisonPlayerId(player), player);
    });
    const next = comparisonQuery(ids);
    if (typeof window !== "undefined") {
      if (next !== new URLSearchParams(window.location.search).toString()) {
        writtenQueryRef.current = next;
        window.history.replaceState(null, "", next ? `?${next}` : window.location.pathname);
      }
      resolvePlayers(ids, players);
    } else {
      applyPlayers(players);
    }
  };
  const selectPlayer = (slot: 0 | 1 | 2, player: PlayerData | null) => {
    const players: PlayerSlots = [...selectedRef.current];
    const ids: PlayerIds = [...requestedIdsRef.current];
    players[slot] = player;
    ids[slot] = player ? comparisonPlayerId(player) : null;
    commitPlayers(players, ids);
  };

  // Restore the user's previous pick for this exact pair, if any. Setting
  // back to null is fine here — React 19's "setState in effect" rule is a
  // perf hint; the alternative (deriving from render) would need synchronous
  // localStorage access during SSR which crashes.
  useEffect(() => {
    if (!player1 || !player2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPick(null);
      return;
    }
    try {
      const key = `compare-pick:${player1.iconicId ?? player1.personId}:${player2.iconicId ?? player2.personId}`;
      const stored = localStorage.getItem(key) as "p1" | "p2" | null;
      setPick(stored);
    } catch { /* localStorage disabled */ }
  }, [player1, player2]);

  const recordPick = (side: "p1" | "p2") => {
    if (!player1 || !player2) return;
    try {
      const key = `compare-pick:${player1.iconicId ?? player1.personId}:${player2.iconicId ?? player2.personId}`;
      localStorage.setItem(key, side);
    } catch { /* ignore */ }
    setPick(side);
    const winner = side === "p1" ? player1 : player2;
    toast(isZh ? `已记录: ${winner.firstName} ${winner.lastName}` : `Saved pick: ${winner.firstName} ${winner.lastName}`, "success");
  };

  const sharePair = async () => {
    if (!player1 || !player2) return;
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    const text = `${player1.firstName} ${player1.lastName} ${isZh ? "对比" : "vs"} ${player2.firstName} ${player2.lastName}`;
    type NavWithShare = Navigator & { share?: (data: { title: string; text: string; url: string }) => Promise<void> };
    const nav = typeof navigator !== "undefined" ? (navigator as NavWithShare) : null;
    if (nav?.share) {
      try {
        await nav.share({ title: "NBA Tracker — Player Compare", text, url });
        return;
      } catch { /* user cancelled — fall through to clipboard */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast(isZh ? "链接已复制" : "Link copied", "success");
    } catch {
      toast(isZh ? "无法访问剪贴板" : "Clipboard unavailable", "warning");
    }
  };

  useDebouncedSearch(query1, setResults1);
  useDebouncedSearch(query2, setResults2);
  useDebouncedSearch(query3, setResults3);

  const headshotUrl = (id: number) => playerHeadshotUrl(id, "260x190");

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Breadcrumbs
        items={[
          { label: isZh ? "工具" : "Tools", href: "/explore" },
          { label: t.comparePage.title },
        ]}
      />

      {/* Editorial page header */}
      <div className="mb-4">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ Tool</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2 mt-1 text-balance">
          <GitCompareArrows size={20} className="text-accent-amber" />
          {t.comparePage.title}
        </h1>
        <p className="text-xs text-text-secondary mt-2">
          {isZh ? "各球员分别标注数据来源与赛季；生涯场均与单赛季数据口径不同。— 表示未知。" : "Each player is labeled with their source and season; career averages and single-season stats cover different periods. — means unknown."}
        </p>
      </div>

      {/* Player selection */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 mb-8 items-start">
        {/* Player 1 */}
        <div className="relative">
          <PlayerSearchBox
            key={presetRevision}
            player={player1}
            query={query1}
            results={results1}
            placeholder={t.comparePage.searchPlayer1}
            isZh={isZh}
            onQuery={(q) => { setQuery1(q); setResults1([]); selectPlayer(0, null); }}
            onPick={(p) => { selectPlayer(0, p); setResults1([]); setQuery1(""); }}
          />
        </div>

        {/* Swap button */}
        <div className="flex items-center justify-center md:pt-3">
          <button
            onClick={() => {
              const tempQ = query1;
              const [first, second, third] = selectedRef.current;
              const [firstId, secondId, thirdId] = requestedIdsRef.current;
              commitPlayers([second, first, third], [secondId, firstId, thirdId]);
              setQuery1(query2);
              setQuery2(tempQ);
              setResults1(results2);
              setResults2(results1);
            }}
            className="p-2.5 rounded-xl glass-tile hover:border-accent/50 transition-colors text-text-secondary hover:text-accent cursor-pointer"
            title={t.comparePage.swapPlayers}
          >
            <ArrowLeftRight size={18} />
          </button>
        </div>

        {/* Player 2 */}
        <div className="relative">
          <PlayerSearchBox
            key={presetRevision}
            player={player2}
            query={query2}
            results={results2}
            placeholder={t.comparePage.searchPlayer2}
            isZh={isZh}
            onQuery={(q) => { setQuery2(q); setResults2([]); selectPlayer(1, null); }}
            onPick={(p) => { selectPlayer(1, p); setResults2([]); setQuery2(""); }}
          />
        </div>
      </div>

      {/* Optional 3rd slot — only surfaced once the user has at least one
          of the first two picked. Adding a 3rd switches the comparison
          view into a compact 3-column tile layout. */}
      {(player1 || player2) && (
        <div className="mb-6 -mt-2">
          <div className="relative max-w-md">
            <PlayerSearchBox
              player={player3}
              query={query3}
              results={results3}
              placeholder={isZh ? "（可选）加入第 3 个球员对比" : "(optional) add a 3rd player"}
              isZh={isZh}
              compact
              onQuery={(q) => { setQuery3(q); setResults3([]); selectPlayer(2, null); }}
              onPick={(p) => { selectPlayer(2, p); setResults3([]); setQuery3(""); }}
              onClear={() => { selectPlayer(2, null); setQuery3(""); setResults3([]); }}
            />
          </div>
        </div>
      )}

      {/* Popular Matchups */}
      <div className="mb-6">
        <p className="text-xs text-text-secondary font-medium mb-2">{t.comparePage.popularMatchups}</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "LeBron vs Curry", q1: "LeBron", q2: "Curry" },
            { label: "Jokic vs Embiid", q1: "Jokic", q2: "Embiid" },
            { label: "Luka vs SGA", q1: "Luka", q2: "Gilgeous" },
            { label: "'16 LeBron vs '18 Harden", q1: "2015 LeBron", q2: "2017 Harden" },
            { label: "'62 Wilt vs '96 Jordan", q1: "1961 Wilt", q2: "1995 Jordan" },
            { label: "'16 Curry vs '17 Westbrook", q1: "2015 Curry", q2: "2016 Westbrook" },
            { label: "'19 Kawhi vs '20 LeBron", q1: "2018 Kawhi", q2: "2019 LeBron" },
            { label: "Jordan vs Kobe", q1: "Jordan", q2: "Kobe" },
            { label: "MJ '88 vs Hakeem '94", q1: "1987 Jordan", q2: "1993 Hakeem" },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                setPresetRevision(revision => revision + 1);
                if (query1 !== preset.q1) setResults1([]);
                if (query2 !== preset.q2) setResults2([]);
                setQuery1(preset.q1); setQuery2(preset.q2);
                commitPlayers([null, null, null], [null, null, null]); setQuery3(""); setResults3([]);
              }}
              className="px-3 py-1.5 glass-tile text-xs text-text-secondary hover:text-accent transition-colors cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Three-way compact view — replaces the rich pairwise comparison
          when a 3rd player is selected. The pairwise UI was designed for
          GOAT-style head-to-head debate; adding a third axis muddies the
          radar/era/story sections, so those collapse here in favor of a
          dense headline-stats + accolades + pick grid. */}
      {player1 && player2 && player3 && (
        <ThreeWayCompare p1={player1} p2={player2} p3={player3} isZh={isZh} t={t} />
      )}

      {/* Comparison display */}
      {player1 && player2 && !player3 && (
        <div className="glass-tile overflow-hidden">
          {/* Toolbar — Share + (eventual) more actions */}
          <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-border bg-bg-secondary/20">
            <button
              onClick={sharePair}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.15em] px-2.5 py-1 rounded-md text-text-secondary hover:text-accent hover:bg-bg-hover transition-colors cursor-pointer"
              aria-label={isZh ? "分享对比" : "Share comparison"}
            >
              <Share2 size={13} />
              {isZh ? "分享" : "Share"}
            </button>
          </div>
          {/* Headers — stays side-by-side (the VS framing is the point), but
              tightens below sm: smaller headshot, less padding, narrower VS
              gutter, and the city/team subline hides so two-word names don't
              wrap. teamAbbr still conveys the team on mobile. */}
          <div className="grid grid-cols-[1fr_auto_1fr] p-4 sm:p-6 border-b border-border">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-bg-secondary">
                <Image src={headshotUrl(player1.personId)} alt={`${player1.firstName} ${player1.lastName}`} width={80} height={80} unoptimized className="w-full h-full object-cover object-top" />
              </div>
              <div className="text-center">
                <p className="font-bold text-text-primary text-sm sm:text-base leading-tight">{player1.firstName} {player1.lastName}</p>
                {player1.isIconicSeason ? (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded bg-accent/15 text-accent text-xs font-mono font-bold tabular-nums">{player1.season}</span>
                ) : player1.isLegend ? (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-accent-amber/15 text-accent-amber text-xs font-bold">{isZh ? "传奇" : "Legend"}</span>
                ) : player1.position ? (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent text-xs font-bold">{player1.position}</span>
                ) : null}
                <p className="text-sm font-semibold text-text-primary mt-1">{player1.teamAbbr}</p>
                <p className="hidden sm:block text-[10px] text-text-secondary">
                  {player1.teamCity} {player1.teamName}
                  {player1.jersey && <> &middot; #{player1.jersey}</>}
                </p>
                <SourceLabel player={player1} isZh={isZh} />
                {player1.isIconicSeason && <TrophyRow p={player1} />}
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-2 px-2 sm:px-4">
              <div className="w-px h-8 bg-border" />
              <span className="text-xl font-light font-mono uppercase tracking-[0.2em] text-accent-amber">{t.common.vs}</span>
              <div className="w-px h-8 bg-border" />
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-bg-secondary">
                <Image src={headshotUrl(player2.personId)} alt={`${player2.firstName} ${player2.lastName}`} width={80} height={80} unoptimized className="w-full h-full object-cover object-top" />
              </div>
              <div className="text-center">
                <p className="font-bold text-text-primary text-sm sm:text-base leading-tight">{player2.firstName} {player2.lastName}</p>
                {player2.isIconicSeason ? (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded bg-accent/15 text-accent text-xs font-mono font-bold tabular-nums">{player2.season}</span>
                ) : player2.isLegend ? (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-accent-amber/15 text-accent-amber text-xs font-bold">{isZh ? "传奇" : "Legend"}</span>
                ) : player2.position ? (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent text-xs font-bold">{player2.position}</span>
                ) : null}
                <p className="text-sm font-semibold text-text-primary mt-1">{player2.teamAbbr}</p>
                <p className="hidden sm:block text-[10px] text-text-secondary">
                  {player2.teamCity} {player2.teamName}
                  {player2.jersey && <> &middot; #{player2.jersey}</>}
                </p>
                <SourceLabel player={player2} isZh={isZh} />
                {player2.isIconicSeason && <TrophyRow p={player2} />}
              </div>
            </div>
          </div>

          {/* Iconic-season story strip — narrative one-liners for both players */}
          {(player1.isIconicSeason || player2.isIconicSeason) && (
            <div className="grid grid-cols-2 gap-px bg-border/40 border-b border-border">
              <div className="bg-bg-card p-3 text-[11px] text-text-secondary leading-relaxed">
                {player1.isIconicSeason
                  ? (isZh && player1.storyZh ? player1.storyZh : player1.story)
                  : null}
              </div>
              <div className="bg-bg-card p-3 text-[11px] text-text-secondary leading-relaxed">
                {player2.isIconicSeason
                  ? (isZh && player2.storyZh ? player2.storyZh : player2.story)
                  : null}
              </div>
            </div>
          )}

          {/* Style-tag row — definitional qualifier ("how they won"). Only on
              iconic-season entries; the per-season tags are in iconicSeasons.ts. */}
          {(player1.styles?.length || player2.styles?.length) ? (
            <div className="grid grid-cols-2 gap-px bg-border/40 border-b border-border">
              <StyleTagsCol styles={player1.styles} isZh={isZh} />
              <StyleTagsCol styles={player2.styles} isZh={isZh} />
            </div>
          ) : null}

          {/* Era-context strip — "X scored Y in a league averaging Z (+/- N
              above era)". Only renders when both sides are iconic seasons
              (we have league averages keyed by seasonYear). */}
          {player1.seasonYear !== undefined && player2.seasonYear !== undefined && (
            <EraContext p1={player1} p2={player2} isZh={isZh} />
          )}

          {/* Radar — RS/PO toggle appears only when both players carry
              playoff per-game data (i.e. both are iconic seasons or legends
              with playoff fields curated). */}
          {(() => {
            const bothHavePlayoffs = buildRadarStats(player1, player2, "PO").length === 3;
            const mode = bothHavePlayoffs ? radarMode : "RS";
            const radarStats = buildRadarStats(player1, player2, mode);
            if (radarStats.length < 3) return null;
            return (
              <div className="px-3 py-4 sm:p-6 border-b border-border bg-bg-secondary/20">
                <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                  <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary">
                    / {isZh ? "雷达对比" : "Stat Radar"}
                    {mode === "PO" && (
                      <span className="ml-2 text-accent-amber">· {isZh ? "季后赛" : "PLAYOFFS"}</span>
                    )}
                  </h3>
                  <div className="flex items-center gap-3">
                    {bothHavePlayoffs && (
                      <div className="flex items-center gap-0.5 text-[10px] font-mono uppercase tracking-[0.15em] glass-tile p-0.5">
                        {(["RS", "PO"] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => setRadarMode(m)}
                            aria-pressed={radarMode === m}
                            aria-label={m === "RS" ? (isZh ? "RS · 常规赛" : "RS · Regular season") : (isZh ? "PO · 季后赛" : "PO · Playoffs")}
                            className={`min-h-[44px] min-w-[44px] px-2 py-1 rounded transition-colors cursor-pointer ${
                              radarMode === m
                                ? "bg-accent text-white"
                                : "text-text-secondary hover:text-text-primary"
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="hidden sm:flex items-center gap-3 text-[10px]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm bg-accent" />
                        <span className="text-text-secondary">{player1.firstName} {player1.lastName}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm bg-success" />
                        <span className="text-text-secondary">{player2.firstName} {player2.lastName}</span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center">
                  <RadarChart
                    mobileReadable
                    stats={radarStats}
                    homeLabel={`${player1.firstName} ${player1.lastName}`}
                    awayLabel={`${player2.firstName} ${player2.lastName}`}
                  />
                </div>
                <p className="text-[9px] text-text-secondary/60 text-center mt-2 font-mono uppercase tracking-[0.15em]">
                  {isZh
                    ? `仅含双方已知数据的轴 · 每轴按两人最大值归一 · ${mode === "PO" ? "季后赛场均" : "各球员标注时期的场均"}`
                    : `Complete axes only · Each axis normalized · ${mode === "PO" ? "Playoff per-game" : "Per-game for each labeled period"}`}
                </p>
              </div>
            );
          })()}

          {/* Career-accolades tile grid — only when at least one side has
              data in PLAYER_ACCOLADES. Unknown entries remain unavailable. */}
          {(player1.accolades || player2.accolades) && (
            <div className="p-6 border-b border-border">
              <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3">
                / {isZh ? "生涯成就" : "Career Accolades"}
              </h3>
              <p className="text-[10px] text-text-secondary mb-3">{honorsSourceLabel(isZh)}</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <AccoladeTile
                  label={isZh ? "总冠军" : "Rings"}
                  v1={player1.accolades?.championships}
                  v2={player2.accolades?.championships}
                />
                <AccoladeTile
                  label="MVP"
                  v1={player1.accolades?.mvps}
                  v2={player2.accolades?.mvps}
                />
                <AccoladeTile
                  label="FMVP"
                  v1={player1.accolades?.finalsMvps}
                  v2={player2.accolades?.finalsMvps}
                />
                <AccoladeTile
                  label={isZh ? "全明星" : "All-Star"}
                  v1={player1.accolades?.allStars}
                  v2={player2.accolades?.allStars}
                />
                <AccoladeTile
                  label="All-NBA"
                  v1={player1.accolades?.allNba}
                  v2={player2.accolades?.allNba}
                />
              </div>
            </div>
          )}

          {/* "Who would win" — local pick stored per pair in localStorage.
              Two buttons, big amber highlight when picked. No backend tally. */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary">
                / {isZh ? "你站谁" : "Your Pick"}
              </h3>
              {pick && (
                <span className="text-[10px] text-text-secondary">
                  {isZh ? "已记录于本设备" : "Saved on this device"}
                </span>
              )}
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <button
                onClick={() => recordPick("p1")}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg border transition-colors cursor-pointer ${
                  pick === "p1"
                    ? "bg-accent-amber/15 text-accent-amber border-accent-amber/40"
                    : "bg-bg-secondary/40 text-text-primary border-border hover:border-accent/50"
                }`}
              >
                <ThumbsUp size={14} />
                <span className="text-sm font-medium truncate">{player1.firstName} {player1.lastName}</span>
              </button>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">
                {isZh ? "或" : "or"}
              </span>
              <button
                onClick={() => recordPick("p2")}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg border transition-colors cursor-pointer ${
                  pick === "p2"
                    ? "bg-accent-amber/15 text-accent-amber border-accent-amber/40"
                    : "bg-bg-secondary/40 text-text-primary border-border hover:border-accent/50"
                }`}
              >
                <ThumbsUp size={14} />
                <span className="text-sm font-medium truncate">{player2.firstName} {player2.lastName}</span>
              </button>
            </div>
          </div>

          {/* Position comparison + separator */}
          <div className="flex items-center gap-3 px-6 py-2 bg-bg-secondary/30">
            <div className="flex-1 h-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-secondary uppercase font-medium">{t.comparePage.statsComparison}</span>
              {player1.position && player2.position && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${player1.position === player2.position ? "bg-accent/15 text-accent" : "bg-bg-hover text-text-secondary"}`}>
                  {player1.position === player2.position ? `${t.comparePage.samePosition}${player1.position}` : `${player1.position} ${t.common.vs} ${player2.position}`}
                </span>
              )}
            </div>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Stats bars: unknown pairs have values, but no comparative bars. */}
          <div className="p-6 space-y-5">
            {COMPARE_STATS.map(({ key, label, color }) => {
              const v1 = player1[key];
              const v2 = player2[key];
              const pair = compareStatPair(v1, v2);
              const comparablePeriod = comparisonPeriodsCompatible([player1, player2]);
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-lg font-bold ${comparablePeriod && pair?.winner === 0 ? color : "text-text-secondary"}`}>{displayCompareStat(v1)}</span>
                    <span className="text-xs text-text-secondary font-medium uppercase">{label}</span>
                    <span className={`text-lg font-bold ${comparablePeriod && pair?.winner === 1 ? color : "text-text-secondary"}`}>{displayCompareStat(v2)}</span>
                  </div>
                  {pair && (
                    <div className="flex gap-1 h-3">
                      <div className="flex-1 flex justify-end">
                        <div className={`h-full rounded-l-full ${comparablePeriod && pair.winner === 0 ? "bg-accent" : "bg-bg-hover"}`}
                          style={{ width: `${pair.ratioA * 100}%` }} />
                      </div>
                      <div className="flex-1">
                        <div className={`h-full rounded-r-full ${comparablePeriod && pair.winner === 1 ? "bg-accent" : "bg-bg-hover"}`}
                          style={{ width: `${pair.ratioB * 100}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <ShootingSplits p1={player1} p2={player2} isZh={isZh} />
          </div>

          {/* Winner Summary requires the full headline metric set and matching periods. */}
          <div className="px-6 py-3 bg-bg-secondary/50 border-t border-border">
            {(() => {
              const pairs = COMPARE_STATS.map(({ key }) => compareStatPair(player1[key], player2[key]));
              const complete = pairs.every(pair => pair !== null);
              const samePeriod = comparisonPeriodsCompatible([player1, player2]);
              const p1Wins = pairs.filter(pair => pair?.winner === 0).length;
              const p2Wins = pairs.filter(pair => pair?.winner === 1).length;
              const winner = complete && samePeriod ? (p1Wins > p2Wins ? player1 : p2Wins > p1Wins ? player2 : null) : null;
              return (
                <p className="text-center text-sm">
                  {!complete ? (
                    <span className="text-text-secondary">{isZh ? "数据不完整，无法判定整体领先者" : "Incomplete stats: overall comparison unavailable"}</span>
                  ) : !samePeriod ? (
                    <span className="text-text-secondary">{isZh ? "数据时期不同或未知，无法判定整体领先者" : "Different or unknown periods: overall comparison unavailable"}</span>
                  ) : winner ? (
                    <><span className="text-accent font-bold">{winner.firstName} {winner.lastName}</span> <span className="text-text-secondary">{t.comparePage.leads} {p1Wins > p2Wins ? p1Wins : p2Wins}-{p1Wins > p2Wins ? p2Wins : p1Wins} {t.comparePage.categories}</span></>
                  ) : (
                    <span className="text-text-secondary">{t.comparePage.tiedAll}</span>
                  )}
                </p>
              );
            })()}
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {COMPARE_STATS.map(({ key, label }) => {
                const pair = compareStatPair(player1[key], player2[key]);
                const comparable = pair && comparisonPeriodsCompatible([player1, player2]);
                const advantage = comparable ? (pair.winner === 0 ? player1 : pair.winner === 1 ? player2 : null) : null;
                return (
                  <span key={key} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    advantage === player1 ? "bg-accent/15 text-accent" :
                    advantage === player2 ? "bg-success/15 text-success" :
                    "bg-bg-hover text-text-secondary"
                  }`}>
                    {label}: {!comparable ? "—" : advantage ? `${advantage.lastName}` : t.common.tied}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Radar Chart */}
          <div className="px-6 pb-4">
            <h3 className="text-xs text-text-secondary font-medium uppercase mb-2 text-center">{t.comparePage.radarComparison}</h3>
            {(() => {
              const stats = COMPARE_STATS.flatMap(({ key, label }) => {
                const pair = compareStatPair(player1[key], player2[key]);
                return pair ? [{ label, v1: pair.ratioA, v2: pair.ratioB }] : [];
              });
              if (stats.length < 3) return <p className="text-center text-xs text-text-secondary">{isZh ? "雷达图需要双方完整的数据" : "Radar unavailable: complete stats required"}</p>;
              const cx = 100, cy = 100, r = 70;
              const n = stats.length;
              const angleStep = (2 * Math.PI) / n;
              const getPoint = (ratio: number, i: number) => {
                const angle = -Math.PI / 2 + i * angleStep;
                return { x: cx + r * ratio * Math.cos(angle), y: cy + r * ratio * Math.sin(angle) };
              };
              const p1Points = stats.map((s, i) => getPoint(s.v1, i));
              const p2Points = stats.map((s, i) => getPoint(s.v2, i));
              const poly1 = p1Points.map(p => `${p.x},${p.y}`).join(" ");
              const poly2 = p2Points.map(p => `${p.x},${p.y}`).join(" ");
              // Grid rings
              const rings = [0.33, 0.66, 1.0];
              return (
                <svg viewBox="0 0 200 200" className="w-full max-w-[240px] mx-auto">
                  {rings.map((ring) => (
                    <polygon key={ring} points={Array.from({ length: n }, (_, i) => {
                      const pt = getPoint(ring, i);
                      return `${pt.x},${pt.y}`;
                    }).join(" ")} fill="none" stroke="var(--border)" strokeWidth="0.5" />
                  ))}
                  {stats.map((_, i) => {
                    const pt = getPoint(1, i);
                    return <line key={i} x1={cx} y1={cy} x2={pt.x} y2={pt.y} stroke="var(--border)" strokeWidth="0.3" />;
                  })}
                  <polygon points={poly1} fill="var(--accent)" fillOpacity="0.25" stroke="var(--accent)" strokeWidth="1.5" />
                  <polygon points={poly2} fill="var(--success)" fillOpacity="0.15" stroke="var(--success)" strokeWidth="1.5" strokeDasharray="4 2" />
                  {stats.map((s, i) => {
                    const pt = getPoint(1.18, i);
                    return <text key={i} x={pt.x} y={pt.y} textAnchor="middle" dominantBaseline="central" fill="var(--text-secondary)" fontSize="8" fontWeight="500">{s.label}</text>;
                  })}
                </svg>
              );
            })()}
            <div className="flex justify-center gap-4 mt-1 text-[10px] text-text-secondary">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent" />{player1.lastName}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" />{player2.lastName}</span>
            </div>
          </div>

          {/* Visual Bar Chart */}
          <div className="px-6 pb-6">
            <svg viewBox="0 0 300 140" className="w-full max-w-md mx-auto">
              {COMPARE_STATS.map(({ key, label, barColor }, i) => {
                const v1 = player1[key];
                const v2 = player2[key];
                const pair = compareStatPair(v1, v2);
                const barW = 30;
                const gap = 100;
                const baseX = 50 + i * gap;
                const maxH = 90;
                return (
                  <g key={key}>
                    {pair && <>
                      <rect x={baseX - barW / 2 - 2} y={20 + maxH - pair.ratioA * maxH} width={barW} height={pair.ratioA * maxH}
                        rx={4} fill={barColor} opacity={0.7} />
                      <rect x={baseX + barW / 2 + 2} y={20 + maxH - pair.ratioB * maxH} width={barW} height={pair.ratioB * maxH}
                        rx={4} fill={barColor} opacity={0.35} />
                    </>}
                    <text x={baseX - 2} y={16} textAnchor="middle" fill="var(--text-secondary)" fontSize={9} fontWeight={600}>{displayCompareStat(v1)}</text>
                    <text x={baseX + barW + 2} y={16} textAnchor="middle" fill="var(--text-secondary)" fontSize={9}>{displayCompareStat(v2)}</text>
                    <text x={baseX + barW / 4} y={125} textAnchor="middle" fill="var(--text-secondary)" fontSize={10} fontWeight={500}>{label}</text>
                  </g>
                );
              })}
              <text x={10} y={135} fill="var(--text-secondary)" fontSize={8}>&#9632; {player1.lastName}</text>
              <text x={200} y={135} fill="var(--text-secondary)" fontSize={8} opacity={0.5}>&#9632; {player2.lastName}</text>
            </svg>
          </div>
        </div>
      )}

      {/* Overall Production Score */}
      {player1 && player2 && !player3 && (() => {
        // Simple production score: PTS + 1.2*REB + 1.5*AST
        const score1 = productionScore(player1);
        const score2 = productionScore(player2);
        const pair = compareStatPair(score1, score2);
        const samePeriod = comparisonPeriodsCompatible([player1, player2]);
        const shares = samePeriod ? productionShares(score1, score2) : null;
        return (
          <div className="glass-tile p-4 mt-4">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3 text-center">{t.comparePage.overallScore}</h3>
            <p className="text-[9px] text-text-secondary text-center mb-3">{t.comparePage.scoreFormula}</p>
            <div className="flex items-center gap-4">
              <div className="flex-1 text-right">
                <span className={`text-lg font-bold ${samePeriod && pair?.winner === 0 ? "text-accent" : "text-text-secondary"}`}>{displayCompareStat(score1, 1)}</span>
                <p className="text-[10px] text-text-secondary">{player1.lastName}</p>
              </div>
              <div className="w-32 h-3 bg-bg-hover rounded-full overflow-hidden flex">
                {shares && <>
                  <div className="h-full bg-accent rounded-l-full" style={{ width: `${shares[0] * 100}%` }} />
                  <div className="h-full bg-success rounded-r-full" style={{ width: `${shares[1] * 100}%` }} />
                </>}
              </div>
              <div className="flex-1">
                <span className={`text-lg font-bold ${samePeriod && pair?.winner === 1 ? "text-success" : "text-text-secondary"}`}>{displayCompareStat(score2, 1)}</span>
                <p className="text-[10px] text-text-secondary">{player2.lastName}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {!player1 && !player2 && (
        <div className="glass-tile p-12 text-center mt-6">
          <div className="w-16 h-16 rounded-2xl bg-accent-amber/10 flex items-center justify-center mx-auto mb-4">
            <GitCompareArrows size={28} className="text-accent-amber" />
          </div>
          <p className="text-base font-medium text-text-primary">{t.comparePage.selectHint}</p>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-text-secondary mt-2">{isZh ? "在上方输入两位球员的名字开始对比" : "Start by typing two player names above"}</p>
        </div>
      )}

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/h2h", label: isZh ? "球队历史交锋" : "Team head-to-head", description: isZh ? "对比两支球队的历史战绩" : "Compare two teams head-to-head", icon: Users },
          { href: "/awards-race", label: isZh ? "奖项竞争" : "Awards race", description: "MVP · DPOY · 6MOY · ROY", icon: Award },
          { href: "/by-position", label: isZh ? "同位置排行" : "Same position", description: isZh ? "按位置筛选的排名" : "Leaders grouped by G/F/C", icon: Activity },
          { href: "/milestones", label: isZh ? "生涯里程碑" : "Career milestones", description: isZh ? "现役球员冲击门槛" : "Active players chasing thresholds", icon: TrendingUp },
          { href: "/all-time-leaders", label: isZh ? "历史排行" : "All-time leaders", description: isZh ? "NBA 历史巨星" : "All-time NBA greats", icon: Crown },
        ]}
      />
    </div>
  );
}

"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { CURRENT_SEASON } from "@/lib/constants";
import { TEAM_META } from "@/lib/teams";
import { teamLogoUrl } from "@/lib/teamUrls";
import { useLocale } from "@/components/LocaleProvider";
import EmptyState from "@/components/EmptyState";
import {
  CATEGORIES,
  averageInsertIndex,
  formatBoardValue,
  leagueAverage,
  parseUpstreamBoards,
  type BoardCategory,
  type CategoryKey,
  type ScheduleBoards,
  type ScheduleCategoryKey,
  type TeamBoardRow,
  type UpstreamBoards,
  type UpstreamCategoryKey,
} from "@/lib/team-stat-board";

const STATS_API = "/api/stats";

// leaguedashteamstats rejects requests missing any of its (mostly empty)
// filter params — this is the canonical full set.
const UPSTREAM_PARAMS: Record<string, string> = {
  endpoint: "leaguedashteamstats",
  Conference: "", DateFrom: "", DateTo: "", Division: "", GameScope: "",
  GameSegment: "", LastNGames: "0", LeagueID: "00", Location: "",
  MeasureType: "Base", Month: "0", OpponentTeamID: "0", Outcome: "",
  PORound: "0", PaceAdjust: "N", PerMode: "PerGame", Period: "0",
  PlayerExperience: "", PlayerPosition: "", PlusMinus: "N", Rank: "N",
  Season: CURRENT_SEASON, SeasonSegment: "", SeasonType: "Regular Season",
  ShotClockRange: "", StarterBench: "", TeamID: "0", TwoWay: "0",
  VsConference: "", VsDivision: "",
};

function AvgMarker({ avg, category, isZh }: { avg: number; category: BoardCategory; isZh: boolean }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="h-px flex-1 bg-accent-amber/40" />
      <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-accent-amber whitespace-nowrap tabular-nums">
        {isZh ? "联盟平均" : "League avg"} {formatBoardValue(avg, category.format)}
      </span>
      <span className="h-px flex-1 bg-accent-amber/40" />
    </div>
  );
}

function BoardRow({ row, rank, barPct, category, isZh }: {
  row: TeamBoardRow;
  rank: number;
  barPct: number;
  category: BoardCategory;
  isZh: boolean;
}) {
  const meta = TEAM_META[row.tricode];
  const medalBg =
    rank === 1 ? "bg-[#FFD700]/15 ring-1 ring-[#FFD700]/40 text-[#FFD700]"
    : rank === 2 ? "bg-[#C0C0C0]/15 ring-1 ring-[#C0C0C0]/40 text-[#C0C0C0]"
    : rank === 3 ? "bg-[#CD7F32]/20 ring-1 ring-[#CD7F32]/40 text-[#CD7F32]"
    : "bg-bg-hover text-text-secondary";
  const barColor =
    rank === 1 ? "bg-[#FFD700]" : rank === 2 ? "bg-[#C0C0C0]" : rank === 3 ? "bg-[#CD7F32]" : "bg-accent/60";

  return (
    <Link
      href={`/team/${row.tricode}`}
      className={`glass-tile p-3 flex items-center gap-3 group cursor-pointer ${rank === 1 ? "bg-accent-amber/[0.04]" : ""}`}
    >
      <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold font-mono tabular-nums shrink-0 ${medalBg}`}>
        {rank}
      </span>
      <Image src={teamLogoUrl(row.teamId)} alt={row.tricode} width={32} height={32} unoptimized />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-text-primary group-hover:text-accent transition-colors truncate">
          {meta ? `${meta.city} ${meta.name}` : row.tricode}
        </p>
        <p className="text-[10px] font-mono text-text-secondary truncate">{isZh ? row.detailZh : row.detailEn}</p>
      </div>
      <div className="hidden sm:block w-24 h-1.5 bg-bg-hover rounded-full overflow-hidden shrink-0">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${barPct}%` }} />
      </div>
      <span className={`text-base font-mono tabular-nums shrink-0 min-w-[64px] text-right ${rank <= 3 ? "font-normal text-text-primary" : "font-light text-accent"}`}>
        {formatBoardValue(row.value, category.format)}
      </span>
    </Link>
  );
}

function Board({ rows, category, isZh }: { rows: TeamBoardRow[]; category: BoardCategory; isZh: boolean }) {
  const avg = leagueAverage(rows);
  const markerIdx = averageInsertIndex(rows, category.higherIsBetter, avg);
  const vals = rows.map((r) => r.value);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const span = max - min;
  // Best team gets a full bar in either sort direction; floor keeps a sliver
  // visible on the last-ranked row.
  const barPct = (v: number) =>
    span <= 0 ? 100 : Math.max(4, ((category.higherIsBetter ? v - min : max - v) / span) * 100);

  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary mb-2">
        {category.source === "schedule"
          ? (isZh ? "由赛程比分计算 · 常规赛场均" : "Computed from final scores · regular season, per game")
          : (isZh ? "数据来源 stats.nba.com · 常规赛场均" : "Source stats.nba.com · regular season, per game")}
        {!category.higherIsBetter && <> · {isZh ? "数值越低越好" : "lower is better"}</>}
      </p>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <Fragment key={r.tricode}>
            {i === markerIdx && <AvgMarker avg={avg} category={category} isZh={isZh} />}
            <BoardRow row={r} rank={i + 1} barPct={barPct(r.value)} category={category} isZh={isZh} />
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export default function TeamStatBoards({ scheduleBoards }: { scheduleBoards: ScheduleBoards }) {
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const [cat, setCat] = useState<CategoryKey>("PTS");
  const [upstream, setUpstream] = useState<UpstreamBoards | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setFailed(false);
    try {
      const qs = new URLSearchParams(UPSTREAM_PARAMS).toString();
      const res = await fetch(`${STATS_API}?${qs}`, { signal });
      if (!res.ok) throw new Error(`${res.status}`);
      const boards = parseUpstreamBoards(await res.json());
      if (!boards) throw new Error("unexpected payload");
      setUpstream(boards);
    } catch {
      if (signal?.aborted) return;
      setUpstream(null);
      setFailed(true);
    }
    setLoading(false);
  }, []);

  // load() internally calls setLoading(true) → intentional mount-time fetch.
  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const category = CATEGORIES.find((c) => c.key === cat) ?? CATEGORIES[0];
  const rows =
    category.source === "schedule"
      ? scheduleBoards[category.key as ScheduleCategoryKey]
      : upstream?.[category.key as UpstreamCategoryKey] ?? null;

  return (
    <div>
      {/* Category switcher — glass tile pill bar */}
      <div
        className="glass-tile flex flex-wrap overflow-hidden p-1 mb-4 w-fit"
        role="group"
        aria-label={isZh ? "数据类别" : "Stat category"}
      >
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            aria-pressed={cat === c.key}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
              cat === c.key ? "bg-accent text-white shadow-md" : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            }`}
          >
            {isZh ? c.zh : c.en}
          </button>
        ))}
      </div>

      {rows ? (
        <Board rows={rows} category={category} isZh={isZh} />
      ) : loading ? (
        // 30 rows ≈ the rendered board height — avoids a CLS spike when data lands.
        <div className="space-y-1.5">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="glass-tile h-14 skeleton-shimmer" />
          ))}
        </div>
      ) : failed ? (
        <EmptyState
          icon={AlertCircle}
          tone="danger"
          title={isZh ? "联盟球队数据暂时不可用" : "League team stats unavailable"}
          description={
            isZh
              ? "stats.nba.com 暂时无法访问。得分、失分与净胜分榜不受影响，可先切换查看。"
              : "stats.nba.com is unreachable right now. The points, points-allowed, and point-diff boards are unaffected — switch tabs to view them."
          }
          action={{ label: t.common.retry, onClick: () => load() }}
        />
      ) : null}
    </div>
  );
}

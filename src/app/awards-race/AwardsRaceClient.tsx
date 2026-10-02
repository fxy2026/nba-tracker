"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Trophy, Star, Shield, Sparkles, TrendingUp, Award, Crown, Target, Activity } from "lucide-react";
import { rookieCohort } from "@/lib/rookie-cohort";
import { parseLeagueLeaders, hasLeagueLeaderNumbers, formatLeagueLeaderValue, type LeagueLeaderRow } from "@/lib/league-leaders";
import { playerIndexLabel } from "@/lib/player-index-provenance";
import { CURRENT_SEASON } from "@/lib/constants";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";
import { useLocale } from "@/components/LocaleProvider";
import { playerHeadshotUrl } from "@/lib/teamUrls";

export interface MvpSeason {
  id: string;
  personId: number;
  name: string;
  season: string;
  ppg: number;
  rpg: number;
  apg: number;
  champion: boolean;
}

interface PlayerIndexRow {
  personId: number;
  firstName: string;
  lastName: string;
  draftYear: number | null;
  fromYear: string;
  toYear: string;
}

type RaceKey = "mvp" | "roy" | "dpoy" | "smoy" | "mip";
type ScoredRaceKey = Exclude<RaceKey, "smoy" | "mip">;

type RaceMeta = { key: RaceKey; label: string; icon: typeof Trophy; eyebrow: string; description: string; color: string };

function buildRaces(isZh: boolean): RaceMeta[] {
  return [
    {
      key: "mvp",
      label: "MVP",
      icon: Trophy,
      eyebrow: isZh ? "最有价值球员" : "Most Valuable",
      description: isZh
        ? "本站启发式排名：综合得分、组织与各项产出"
        : "Site heuristic combining scoring, playmaking, and production",
      color: "#FFD700",
    },
    {
      key: "roy",
      label: "ROY",
      icon: Sparkles,
      eyebrow: isZh ? "年度最佳新秀" : "Rookie of the Year",
      description: isZh ? "按产出排名的最佳一年级球员" : "Top first-year players by production",
      color: "#3B82F6",
    },
    {
      key: "dpoy",
      label: "DPOY",
      icon: Shield,
      eyebrow: isZh ? "年度最佳防守球员" : "Defensive POY",
      description: isZh ? "本站防守启发式排名：抢断、盖帽、篮板与上场时间" : "Site defensive heuristic: steals, blocks, rebounds, and minutes",
      color: "#22C55E",
    },
    {
      key: "smoy",
      label: "6MOY",
      icon: Star,
      eyebrow: isZh ? "年度最佳第六人" : "Sixth Man",
      description: isZh ? "需要可与出场场次对照的已核实首发场次" : "Requires verified starts alongside games played",
      color: "#A855F7",
    },
    {
      key: "mip",
      label: "MIP",
      icon: TrendingUp,
      eyebrow: isZh ? "进步最快球员" : "Most Improved",
      description: isZh ? "需要可比较的本赛季与上一赛季数据" : "Requires comparable current- and previous-season data",
      color: "#F59E0B",
    },
  ];
}

function scoreForRace(p: LeagueLeaderRow, race: ScoredRaceKey): number | null {
  let score: number;
  switch (race) {
    case "mvp":
      // PTS×1.0 + REB×0.7 + AST×1.0 + STL×1.5 + BLK×1.2 + EFF×0.3 + GP×0.1
      if (!hasLeagueLeaderNumbers(p, ["PTS", "REB", "AST", "STL", "BLK", "EFF", "GP"])) return null;
      score = p.PTS * 1.0 + p.REB * 0.7 + p.AST * 1.0 + p.STL * 1.5 + p.BLK * 1.2 + p.EFF * 0.3 + p.GP * 0.1;
      break;
    case "dpoy":
      if (!hasLeagueLeaderNumbers(p, ["STL", "BLK", "REB", "MIN"])) return null;
      score = p.STL * 2.5 + p.BLK * 2.5 + p.REB * 0.4 + p.MIN * 0.1;
      break;
    case "roy":
      if (!hasLeagueLeaderNumbers(p, ["PTS", "REB", "AST", "GP"])) return null;
      score = p.PTS + p.REB * 0.6 + p.AST * 0.8 + p.GP * 0.1;
  }
  return Number.isFinite(score) ? score : null;
}

export default function AwardsRaceClient({ mvpSeasons }: { mvpSeasons: MvpSeason[] }) {
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const [allPlayers, setAllPlayers] = useState<LeagueLeaderRow[]>([]);
  const [rookieIndex, setRookieIndex] = useState<{ players: PlayerIndexRow[]; provenance: unknown } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRace, setActiveRace] = useState<RaceKey>("mvp");
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [indexRetryKey, setIndexRetryKey] = useState(0);
  const [rejectedRows, setRejectedRows] = useState(0);
  const statsRequestRef = useRef<AbortController | null>(null);
  const indexRequestRef = useRef<AbortController | null>(null);
  const retry = () => { statsRequestRef.current?.abort(); setRetryKey(key => key + 1); };
  const retryIndex = () => { indexRequestRef.current?.abort(); setIndexRetryKey(key => key + 1); };

  useEffect(() => {
    const controller = new AbortController();
    statsRequestRef.current = controller;
    let active = true;
    const current = () => active && !controller.signal.aborted;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- an explicit retry owns a new request
    setLoading(true);
    setError(false);
    const timeout = setTimeout(() => {
      if (!current()) return;
      controller.abort(); setError(true); setLoading(false);
    }, 12000);
    (async () => {
      try {
        const qs = new URLSearchParams({
          endpoint: "leagueleaders",
          LeagueID: "00",
          PerMode: "PerGame",
          Scope: "S",
          Season: CURRENT_SEASON,
          SeasonType: "Regular Season",
          StatCategory: "EFF",
          limit: "100",
        });
        const res = await fetch(`/api/stats?${qs}`, { signal: controller.signal });
        if (!current()) return;
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (!current()) return;
        const parsed = parseLeagueLeaders(data);
        if (!parsed || (!parsed.rows.length && parsed.rejectedRows > 0)) throw new Error("No usable data");
        setAllPlayers(parsed.rows.slice(0, 100));
        setRejectedRows(parsed.rejectedRows);
      } catch { if (current()) setError(true); }
      finally { clearTimeout(timeout); if (current()) setLoading(false); }
    })();
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [retryKey]);

  // Fetch player index for ROY rookie filter — only the fields we need
  useEffect(() => {
    const controller = new AbortController();
    indexRequestRef.current = controller;
    let active = true;
    const current = () => active && !controller.signal.aborted;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the independently retried cohort request
    setRookieIndex(null);
    const timeout = setTimeout(() => {
      if (!current()) return;
      controller.abort(); setRookieIndex({ players: [], provenance: null });
    }, 12000);
    (async () => {
      try {
        const res = await fetch("/api/player-index", { signal: controller.signal });
        if (!current()) return;
        if (!res.ok) throw new Error("Index unavailable");
        const json = await res.json();
        if (!current()) return;
        const players = Array.isArray(json.data) ? json.data : [];
        const trimmed: PlayerIndexRow[] = players.map((p: PlayerIndexRow) => ({
          personId: p.personId,
          firstName: p.firstName,
          lastName: p.lastName,
          draftYear: p.draftYear,
          fromYear: p.fromYear,
          toYear: p.toYear,
        }));
        setRookieIndex({ players: trimmed, provenance: json.provenance });
      } catch { if (current()) setRookieIndex({ players: [], provenance: null }); }
      finally { clearTimeout(timeout); }
    })();
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [indexRetryKey]);

  const cohort = useMemo(() => rookieCohort(rookieIndex?.players ?? [], rookieIndex?.provenance, CURRENT_SEASON), [rookieIndex]);

  // Compute scored leaders for active race
  const { ranked, incomplete } = useMemo(() => {
    const scored: (LeagueLeaderRow & { _score: number })[] = [];
    // Current leaders contain neither verified starts nor a prior-season
    // comparison. These races cannot be scored from this dataset.
    if (activeRace === "smoy" || activeRace === "mip") return { ranked: scored, incomplete: false };
    const rookieIds = new Set(cohort.available ? cohort.rookieIds : []);
    let incomplete = false;
    for (const p of allPlayers) {
      if (activeRace === "roy" && !rookieIds.has(p.PLAYER_ID)) continue;
      if (!hasLeagueLeaderNumbers(p, ["GP"])) { incomplete = true; continue; }
      if (p.GP < 20) continue;
      const score = scoreForRace(p, activeRace);
      if (score === null) { incomplete = true; continue; }
      scored.push({ ...p, _score: score });
    }
    scored.sort((a, b) => b._score - a._score);
    return { ranked: scored.slice(0, 10), incomplete };
  }, [allPlayers, activeRace, cohort]);

  const topScore = ranked[0]?._score || 1;
  const races = useMemo(() => buildRaces(isZh), [isZh]);
  const activeRaceMeta = races.find((r) => r.key === activeRace)!;
  const prerequisite = activeRace === "smoy" ? {
    title: isZh ? "第六人排名暂不可用" : "6MOY ranking unavailable",
    description: isZh
      ? "此视图缺少已核实的本赛季首发场次，无法结合出场场次确定替补球员范围。场均上场时间无法证明替补身份。"
      : "Verified current-season start counts are unavailable for comparison with games played. Minutes per game cannot establish a bench-player role.",
  } : activeRace === "mip" ? {
    title: isZh ? "进步最快球员排名暂不可用" : "MIP ranking unavailable",
    description: isZh
      ? "此视图缺少同一球员可比较的本赛季与上一赛季统计。仅凭本赛季表现无法衡量进步。"
      : "This view lacks comparable current- and previous-season statistics for the same players. Current-season production alone cannot measure improvement.",
  } : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow={isZh ? `${CURRENT_SEASON} 赛季` : `${CURRENT_SEASON} Season`}
        icon={Award}
        title={isZh ? "奖项竞争" : "Awards Race"}
        subtitle={isZh ? "MVP、DPOY、ROY 本站排名；6MOY 与 MIP 所需数据" : "MVP, DPOY and ROY site rankings; 6MOY and MIP data requirements"}
      />

      {/* Race selector tabs — glass pill bar */}
      <div className="glass-tile flex flex-wrap overflow-hidden p-1 mb-6 w-fit">
        {races.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveRace(key)}
            aria-pressed={activeRace === key}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-all cursor-pointer ${
              activeRace === key
                ? "bg-accent text-white shadow-md"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {activeRace === "roy" && cohort.provenance && <p className="text-xs text-text-secondary mb-3">{playerIndexLabel(cohort.provenance, locale)} · {isZh ? "按索引首年识别；仅为启发式排名，并非官方资格认定" : "First-year index cohort; heuristic ranking, not official eligibility"}</p>}

      {/* Active race header */}
      <div className="glass-tile p-5 mb-6 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 50% 50% at 10% 0%, ${activeRaceMeta.color}66 0%, transparent 60%)` }}
        />
        <div className="relative flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: `${activeRaceMeta.color}22`, boxShadow: `inset 0 0 0 1px ${activeRaceMeta.color}44` }}
          >
            <activeRaceMeta.icon size={24} style={{ color: activeRaceMeta.color }} />
          </div>
          <div className="flex-1">
            <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {activeRaceMeta.eyebrow}</p>
            <h2 className="text-2xl font-semibold tracking-tight text-text-primary">{activeRaceMeta.label} {isZh ? "竞争" : "Race"}</h2>
            <p className="text-xs text-text-secondary mt-1 font-mono">{activeRaceMeta.description}</p>
          </div>
        </div>
      </div>

      {prerequisite ? (
        <EmptyState icon={activeRaceMeta.icon} tone="neutral"
          eyebrow={isZh ? "/ 所需数据" : "/ Data required"}
          title={prerequisite.title} description={prerequisite.description} />
      ) : activeRace === "roy" && rookieIndex !== null && !cohort.available ? (
        <EmptyState icon={Sparkles}
          title={isZh ? "本赛季新秀名单暂不可用" : "Current-season rookie cohort unavailable"}
          description={isZh
            ? `无法核实本赛季一年级球员名单，暂不生成 ROY 排名。索引赛季：${cohort.sourceSeason ?? "未注明"}。`
            : `ROY ranking is unavailable without a supported current-season first-year cohort. Index season: ${cohort.sourceSeason ?? "unspecified"}.`}
          action={{ label: t.common.retry, onClick: retryIndex }} />
      ) : loading || (activeRace === "roy" && rookieIndex === null) ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-tile h-16 skeleton-shimmer" />
          ))}
        </div>
      ) : error || (ranked.length === 0 && (incomplete || rejectedRows > 0)) ? (
        <EmptyState icon={Award} tone="danger" title={t.statsPage.failedToLoad}
          description={isZh ? "此排名所需统计暂不可用，请重试。" : "Statistics required for this ranking are unavailable. Please try again."}
          action={{ label: t.common.retry, onClick: retry }} />
      ) : ranked.length === 0 ? (
        <EmptyState
          icon={Award}
          title={isZh ? "暂无符合条件的球员" : "No qualifying players yet"}
          description={isZh ? "本站展示至少出场 20 场且有完整数据的球员；这不是 NBA 官方奖项资格规则。" : "This view requires at least 20 games and complete data; this is a site sample rule, not official NBA award eligibility."}
        />
      ) : (
        <div className="space-y-2">
          {(incomplete || rejectedRows > 0) && <p role="status" className="text-xs text-text-secondary mb-3">
            {isZh ? "部分记录或所需统计不可用；此排名仅基于可用记录。" : "Partial data: this ranking is based on available records; some records or required statistics are unavailable."}
          </p>}
          {ranked.map((p, i) => {
            const isTop3 = i < 3;
            const medalBg = i === 0
              ? "bg-[#FFD700]/15 ring-1 ring-[#FFD700]/40 text-[#FFD700]"
              : i === 1
              ? "bg-[#C0C0C0]/15 ring-1 ring-[#C0C0C0]/40 text-[#C0C0C0]"
              : i === 2
              ? "bg-[#CD7F32]/20 ring-1 ring-[#CD7F32]/40 text-[#CD7F32]"
              : "bg-bg-hover text-text-secondary";
            const barPct = topScore > 0 ? (p._score / topScore) * 100 : 0;
            const barColor = i === 0 ? "bg-[#FFD700]" : i === 1 ? "bg-[#C0C0C0]" : i === 2 ? "bg-[#CD7F32]" : "bg-accent/60";

            return (
              <Link
                key={p.PLAYER_ID}
                href={`/player/${p.PLAYER_ID}`}
                className={`glass-tile flex items-center gap-3 p-3 group cursor-pointer ${isTop3 ? "bg-accent-amber/[0.03]" : ""}`}
              >
                <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold font-mono tabular-nums shrink-0 ${medalBg}`}>
                  {i + 1}
                </span>
                <div className="w-10 h-10 rounded-full overflow-hidden bg-bg-secondary shrink-0 ring-1 ring-border">
                  <Image
                    src={playerHeadshotUrl(p.PLAYER_ID, "260x190")}
                    alt={p.PLAYER}
                    width={40}
                    height={40}
                    unoptimized
                    className="w-full h-full object-cover object-top"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-text-primary group-hover:text-accent transition-colors truncate">{p.PLAYER}</p>
                    <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">{p.TEAM ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="flex-1 h-1.5 bg-bg-hover rounded-full overflow-hidden max-w-[280px]">
                      <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${barPct}%` }} />
                    </div>
                    <span className={`text-[10px] font-mono tabular-nums font-bold ${isTop3 ? "text-text-primary" : "text-accent"}`}>
                      {p._score.toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-3 text-xs text-text-secondary font-mono tabular-nums shrink-0">
                  <span><span className="font-bold text-text-primary">{formatLeagueLeaderValue(p.PTS)}</span> <span className="text-[9px]">PPG</span></span>
                  <span>{formatLeagueLeaderValue(p.REB)} <span className="text-[9px]">RPG</span></span>
                  <span>{formatLeagueLeaderValue(p.AST)} <span className="text-[9px]">APG</span></span>
                  {activeRace === "dpoy" && <span>{formatLeagueLeaderValue(p.STL)} <span className="text-[9px]">STL</span></span>}
                  {activeRace === "dpoy" && <span>{formatLeagueLeaderValue(p.BLK)} <span className="text-[9px]">BLK</span></span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Past MVP wall — sourced from iconicSeasons.mvp = true */}
      <PastMvpWall isZh={isZh} mvps={mvpSeasons} />

      {/* Formula footer */}
      {!prerequisite && <div className="mt-8 glass-tile p-4">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-2">/ {isZh ? "方法论" : "Methodology"}</p>
        <p className="text-xs text-text-secondary leading-relaxed">
          {isZh
            ? "本站启发式排名，基于本赛季可用常规赛样本（按 EFF 最多取 100 名球员）。此视图要求至少出场 20 场。分数不代表官方投票或 NBA 奖项资格。"
            : "Site heuristic based on the available current-season regular-season sample (up to 100 players by EFF). At least 20 games are required by this view. Scores are not official voting or NBA award eligibility."}
        </p>
      </div>}

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/iconic-seasons", label: isZh ? "历史 MVP 赛季" : "Historic MVP Seasons", description: isZh ? "经典赛季 — 含每位 MVP 的当年数据线" : "Hand-curated peak campaigns — MVP seasons included", icon: Crown },
          { href: "/milestones", label: isZh ? "生涯轨迹" : "Milestones", description: isZh ? "生涯里程碑投影" : "Career milestone projections", icon: TrendingUp },
          { href: "/all-time-leaders", label: isZh ? "历史榜首" : "All-Time Leaders", description: isZh ? "历史数据领跑者" : "Career stat leaders", icon: Crown },
          { href: "/stats", label: isZh ? "联盟数据" : "League Stats", description: isZh ? "完整联盟统计" : "Full league statistics", icon: Award },
          { href: "/clutch", label: isZh ? "关键时刻" : "Clutch", description: isZh ? "关键时刻表现" : "Clutch-time performers", icon: Target },
          { href: "/rookie-watch", label: isZh ? "新秀榜" : "Rookie Watch", description: isZh ? "本届新秀表现" : "Top rookies this season", icon: Activity },
        ]}
      />
    </div>
  );
}

// Historical MVP wall — pulls from the iconic-seasons dataset and renders
// the most recent MVP campaigns as a horizontal scrollable rail. Each card
// deep-links into /compare so you can stack the current race leader against
// past winners.
function PastMvpWall({ isZh, mvps }: { isZh: boolean; mvps: MvpSeason[] }) {
  if (mvps.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">
            / {isZh ? "MVP 名人堂" : "Past MVP wall"}
          </p>
          <h3 className="text-lg font-semibold tracking-tight text-text-primary">
            {isZh ? "对照历史最高水准" : "Benchmark against history"}
          </h3>
        </div>
        <Link
          href="/iconic-seasons"
          className="text-[10px] font-mono uppercase tracking-[0.15em] text-accent hover:underline cursor-pointer"
        >
          {isZh ? "查看全部 →" : "See all →"}
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
        {mvps.map((s) => (
          <Link
            key={s.id}
            href={`/compare?p1=${s.id}`}
            className="glass-tile shrink-0 w-[180px] p-3 snap-start group cursor-pointer hover:ring-1 hover:ring-accent-amber/50 transition-all"
          >
            <div className="relative">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-bg-secondary ring-1 ring-border mx-auto">
                <Image
                  src={playerHeadshotUrl(s.personId, "260x190")}
                  alt={s.name}
                  width={56}
                  height={56}
                  unoptimized
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <span className="absolute -top-1 -right-1 text-[8px] font-mono font-bold uppercase tracking-[0.15em] bg-[#FFD700]/20 text-[#FFD700] ring-1 ring-[#FFD700]/40 px-1.5 py-0.5 rounded">
                MVP
              </span>
            </div>
            <p className="mt-2 text-xs font-semibold text-text-primary text-center truncate group-hover:text-accent transition-colors">
              {s.name}
            </p>
            <p className="text-[10px] font-mono text-text-secondary text-center">{s.season}</p>
            <div className="flex justify-center gap-2 mt-2 text-[10px] font-mono tabular-nums text-text-secondary">
              <span><span className="font-bold text-accent-amber">{s.ppg.toFixed(1)}</span> P</span>
              <span><span className="font-bold text-text-primary">{s.rpg.toFixed(1)}</span> R</span>
              <span><span className="font-bold text-text-primary">{s.apg.toFixed(1)}</span> A</span>
            </div>
            {s.champion && (
              <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-center text-accent-amber/80 mt-1">
                🏆 {isZh ? "冠军" : "Champion"}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

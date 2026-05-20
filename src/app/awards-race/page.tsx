"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Trophy, Star, Shield, Sparkles, TrendingUp, Award, Crown, Target, Activity } from "lucide-react";
import { CURRENT_SEASON } from "@/lib/constants";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";
import { useLocale } from "@/components/LocaleProvider";
import { playerHeadshotUrl } from "@/lib/teamUrls";

// Derive season start year from CURRENT_SEASON e.g. "2025-26" → 2025
const CURRENT_SEASON_START_YEAR = parseInt(CURRENT_SEASON.split("-")[0], 10);

interface PlayerIndexRow {
  personId: number;
  firstName: string;
  lastName: string;
  draftYear: number | null;
  fromYear: string;
  toYear: string;
}

interface PlayerRow {
  PLAYER_ID: number;
  PLAYER: string;
  TEAM: string;
  GP: number;
  MIN: number;
  PTS: number;
  REB: number;
  AST: number;
  STL: number;
  BLK: number;
  FG_PCT: number;
  FG3_PCT: number;
  EFF: number;
}

type RaceKey = "mvp" | "roy" | "dpoy" | "smoy" | "mip";

type RaceMeta = { key: RaceKey; label: string; icon: typeof Trophy; eyebrow: string; description: string; color: string };

function buildRaces(isZh: boolean): RaceMeta[] {
  return [
    {
      key: "mvp",
      label: "MVP",
      icon: Trophy,
      eyebrow: isZh ? "最有价值球员" : "Most Valuable",
      description: isZh
        ? "综合最佳 — 得分、组织与影响力的综合衡量"
        : "Best overall — composite of scoring, playmaking, and impact",
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
      description: isZh ? "抢断 + 盖帽 + 上场时间加权" : "Steals + blocks + minutes weighted",
      color: "#22C55E",
    },
    {
      key: "smoy",
      label: "6MOY",
      icon: Star,
      eyebrow: isZh ? "年度最佳第六人" : "Sixth Man",
      description: isZh ? "最佳替补 (首发少、影响大)" : "Best off the bench (low GS, high impact)",
      color: "#A855F7",
    },
    {
      key: "mip",
      label: "MIP",
      icon: TrendingUp,
      eyebrow: isZh ? "进步最快球员" : "Most Improved",
      description: isZh ? "每分钟效率超出预期最多" : "Highest PER/min above expected",
      color: "#F59E0B",
    },
  ];
}

function scoreForRace(p: PlayerRow, race: RaceKey): number {
  switch (race) {
    case "mvp":
      // PTS×1.0 + REB×0.7 + AST×1.0 + STL×1.5 + BLK×1.2 + EFF×0.3 + GP×0.1
      return p.PTS * 1.0 + p.REB * 0.7 + p.AST * 1.0 + p.STL * 1.5 + p.BLK * 1.2 + p.EFF * 0.3 + p.GP * 0.1;
    case "dpoy":
      return p.STL * 2.5 + p.BLK * 2.5 + p.REB * 0.4 + p.MIN * 0.1;
    case "smoy":
      return p.PTS * 0.8 + p.AST * 0.6 + p.EFF * 0.4;
    case "mip":
      return p.EFF * 0.6 + p.PTS * 0.5 + p.FG_PCT * 20;
    case "roy":
      return p.PTS + p.REB * 0.6 + p.AST * 0.8 + p.GP * 0.1;
  }
}

export default function AwardsRacePage() {
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const [allPlayers, setAllPlayers] = useState<PlayerRow[]>([]);
  const [rookieIndex, setRookieIndex] = useState<PlayerIndexRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRace, setActiveRace] = useState<RaceKey>("mvp");

  useEffect(() => {
    const controller = new AbortController();
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
        });
        const res = await fetch(`/api/stats?${qs}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        const rs = data.resultSet;
        if (!rs) throw new Error("No data");
        const headers: string[] = rs.headers;
        const parsed = rs.rowSet.slice(0, 100).map((row: unknown[]) => {
          const obj: Record<string, unknown> = {};
          headers.forEach((h, i) => { obj[h] = row[i]; });
          return obj;
        }) as unknown as PlayerRow[];
        if (!controller.signal.aborted) setAllPlayers(parsed);
      } catch { /* ignore */ }
      if (!controller.signal.aborted) setLoading(false);
    })();
    return () => controller.abort();
  }, []);

  // Fetch player index for ROY rookie filter — only the fields we need
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/player-index", { signal: controller.signal });
        if (!res.ok) return;
        const json = await res.json();
        const players = Array.isArray(json.data) ? json.data : [];
        const trimmed: PlayerIndexRow[] = players.map((p: PlayerIndexRow) => ({
          personId: p.personId,
          firstName: p.firstName,
          lastName: p.lastName,
          draftYear: p.draftYear,
          fromYear: p.fromYear,
          toYear: p.toYear,
        }));
        if (!controller.signal.aborted) setRookieIndex(trimmed);
      } catch { /* ignore — ROY tab will fall back to unfiltered */ }
    })();
    return () => controller.abort();
  }, []);

  // Build rookie eligibility lookup once. A player counts as a current-season rookie
  // if their draftYear matches CURRENT_SEASON_START_YEAR, OR if their NBA tenure
  // (fromYear..toYear) is just this season — both signals from the player index.
  const { rookieIds, rookieNameSet } = useMemo(() => {
    const ids = new Set<number>();
    const names = new Set<string>();
    for (const p of rookieIndex) {
      const fy = parseInt(p.fromYear, 10);
      const ty = parseInt(p.toYear, 10);
      const isFirstYear = !Number.isNaN(fy) && !Number.isNaN(ty)
        && fy === CURRENT_SEASON_START_YEAR && ty === CURRENT_SEASON_START_YEAR;
      const isDraftClass = p.draftYear === CURRENT_SEASON_START_YEAR;
      if (isFirstYear || isDraftClass) {
        ids.add(p.personId);
        names.add(`${p.firstName} ${p.lastName}`.trim().toLowerCase());
      }
    }
    return { rookieIds: ids, rookieNameSet: names };
  }, [rookieIndex]);

  // Compute scored leaders for active race
  const ranked = useMemo(() => {
    if (allPlayers.length === 0) return [];
    let pool = allPlayers.filter((p) => p.GP >= 20);
    if (activeRace === "smoy") {
      // Sixth Man: heuristic — high PTS but lower minutes (suggesting bench role)
      pool = pool.filter((p) => p.MIN < 28);
    }
    if (activeRace === "roy" && (rookieIds.size > 0 || rookieNameSet.size > 0)) {
      // Rookie filter: keep only players whose personId or name matches the rookie set.
      // leagueleaders rows use PLAYER_ID and PLAYER (full name).
      pool = pool.filter((p) => {
        if (rookieIds.has(p.PLAYER_ID)) return true;
        if (p.PLAYER && rookieNameSet.has(p.PLAYER.trim().toLowerCase())) return true;
        return false;
      });
    }
    const scored = pool.map((p) => ({ ...p, _score: scoreForRace(p, activeRace) }));
    scored.sort((a, b) => b._score - a._score);
    return scored.slice(0, 10);
  }, [allPlayers, activeRace, rookieIds, rookieNameSet]);

  const topScore = ranked[0]?._score || 1;
  const races = useMemo(() => buildRaces(isZh), [isZh]);
  const activeRaceMeta = races.find((r) => r.key === activeRace)!;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow={isZh ? `${CURRENT_SEASON} 赛季` : `${CURRENT_SEASON} Season`}
        icon={Award}
        title={isZh ? "奖项竞争" : "Awards Race"}
        subtitle={isZh ? "MVP · ROY · DPOY · 6MOY · MIP — 一站式呈现" : "MVP · ROY · DPOY · 6MOY · MIP — all in one place"}
      />

      {/* Race selector tabs — glass pill bar */}
      <div className="glass-tile flex flex-wrap overflow-hidden p-1 mb-6 w-fit">
        {races.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveRace(key)}
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

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-tile h-16 skeleton-shimmer" />
          ))}
        </div>
      ) : ranked.length === 0 ? (
        <EmptyState
          icon={Award}
          title={isZh ? "暂无符合条件的球员" : "No qualifying players yet"}
          description={isZh ? "至少需要出场 20 场比赛才具备奖项资格。请稍后再试。" : "Need at least 20 games played for awards eligibility. Try again later in the season."}
        />
      ) : (
        <div className="space-y-2">
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
                    src={playerHeadshotUrl(p.PLAYER_ID)}
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
                    <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">{p.TEAM}</p>
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
                  <span><span className="font-bold text-text-primary">{p.PTS.toFixed(1)}</span> <span className="text-[9px]">PPG</span></span>
                  <span>{p.REB.toFixed(1)} <span className="text-[9px]">RPG</span></span>
                  <span>{p.AST.toFixed(1)} <span className="text-[9px]">APG</span></span>
                  {activeRace === "dpoy" && <span>{p.STL.toFixed(1)} <span className="text-[9px]">STL</span></span>}
                  {activeRace === "dpoy" && <span>{p.BLK.toFixed(1)} <span className="text-[9px]">BLK</span></span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Formula footer */}
      <div className="mt-8 glass-tile p-4">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-2">/ {isZh ? "方法论" : "Methodology"}</p>
        <p className="text-xs text-text-secondary leading-relaxed">
          {t.statsPage.mvpRankingNote || (isZh
            ? "自定义综合排名 — 按类别加权场均产出。最少 20 场出场要求。数据来源于 NBA 官方统计。"
            : "Custom composite ranking — combines per-game production weighted by category. Minimum 20 GP required. Refreshed from official NBA stats.")}
        </p>
        <p className="text-[10px] text-text-secondary/50 mt-2 font-mono">
          {isZh
            ? "注: 这些为计算预测，并非官方投票。真实奖项受投票者倾向与球队故事影响。"
            : "Note: These are computed projections, not official voting. Real awards involve voter sentiment and team narrative."}
        </p>
      </div>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/iconic-seasons", label: isZh ? "历史 MVP 赛季" : "Historic MVP Seasons", description: isZh ? "34 个经典赛季 — 含每位 MVP 的当年数据线" : "34 hand-curated peak campaigns — MVP-winning seasons included", icon: Crown },
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

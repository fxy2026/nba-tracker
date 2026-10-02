import { currentSeason } from "@/lib/constants";
import { rookieCohort } from "@/lib/rookie-cohort";
import { playerIndexLabel } from "@/lib/player-index-provenance";
import { hasCompleteAverages } from "@/lib/player-profile-stats";
import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, GraduationCap, Users, Globe, TrendingUp } from "lucide-react";
import { getPlayerIndexSnapshot } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";

export const metadata: Metadata = {
  title: "Rookie Watch",
  description: "Top performing rookies and sophomores this season — ranked by per-game scoring.",
};

interface RookieRow {
  personId: number;
  firstName: string;
  lastName: string;
  teamAbbr: string;
  draftYear: number | null;
  draftRound: number | null;
  draftNumber: number | null;
  college: string;
  country: string;
  pts: number;
  reb: number;
  ast: number;
  composite: number;
}

function scoreRookie(p: { pts: number; reb: number; ast: number }) {
  return p.pts + p.reb * 1.2 + p.ast * 1.5;
}

function Card({ p, rank }: { p: RookieRow; rank: number }) {
  const isTop3 = rank < 3;
  const medalBg = rank === 0 ? "bg-[#FFD700]/15 ring-1 ring-[#FFD700]/40 text-[#FFD700]"
    : rank === 1 ? "bg-[#C0C0C0]/15 ring-1 ring-[#C0C0C0]/40 text-[#C0C0C0]"
    : rank === 2 ? "bg-[#CD7F32]/20 ring-1 ring-[#CD7F32]/40 text-[#CD7F32]"
    : "bg-bg-hover text-text-secondary";

  return (
    <Link
      href={`/player/${p.personId}`}
      className={`glass-tile p-3 flex items-center gap-3 group cursor-pointer ${isTop3 ? "bg-accent-amber/[0.03]" : ""}`}
    >
      <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold font-mono tabular-nums shrink-0 ${medalBg}`}>
        {rank + 1}
      </span>
      <PlayerHeadshot personId={p.personId} name={`${p.firstName} ${p.lastName}`} size={40} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-text-primary group-hover:text-accent transition-colors truncate">
          {p.firstName} {p.lastName}
        </p>
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
          {p.teamAbbr || "—"}
          {p.draftYear && p.draftNumber && (
            <> · #<span className="tabular-nums">{p.draftNumber}</span> in <span className="tabular-nums">{p.draftYear}</span></>
          )}
          {p.college && <> · {p.college}</>}
        </p>
      </div>
      <div className="hidden sm:flex items-center gap-4 shrink-0">
        <div className="text-right">
          <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">PPG</p>
          <p className="text-lg font-light font-mono tabular-nums text-text-primary">{p.pts.toFixed(1)}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">RPG</p>
          <p className="text-lg font-light font-mono tabular-nums text-text-secondary">{p.reb.toFixed(1)}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">APG</p>
          <p className="text-lg font-light font-mono tabular-nums text-text-secondary">{p.ast.toFixed(1)}</p>
        </div>
      </div>
      <div className="flex sm:hidden flex-col items-end shrink-0">
        <span className="text-base font-light font-mono tabular-nums text-accent-amber">{p.pts.toFixed(1)}</span>
        <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary">ppg</span>
      </div>
    </Link>
  );
}

export default async function RookieWatchPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const snapshot = await getPlayerIndexSnapshot();
  const players = snapshot.players;
  const seasonLabel = currentSeason();
  const cohort = rookieCohort(players, snapshot.provenance, seasonLabel);
  if (!cohort.available) return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <PageHeader eyebrow={seasonLabel} icon={Sparkles} title={isZh ? "新秀榜" : "Rookie Watch"} />
      <p className="text-xs text-text-secondary mb-4">{playerIndexLabel(snapshot.provenance, locale)}</p>
      <EmptyState icon={Sparkles} title={isZh ? "本赛季新秀名单暂不可用" : "Current-season rookie cohort unavailable"}
        description={isZh ? "当前来源不足以核实本赛季一年级球员，不使用历史选秀届替代排名。" : "The available source cannot establish this season's first-year cohort. Older draft classes are not substituted."} />
    </div>
  );

  const rookieIds = new Set(cohort.rookieIds);
  const sophomoreIds = new Set(cohort.sophomoreIds);

  const rookies: RookieRow[] = players
    .filter(hasCompleteAverages)
    .filter((p) => rookieIds.has(p.personId))
    .map((p) => ({
      personId: p.personId,
      firstName: p.firstName,
      lastName: p.lastName,
      teamAbbr: p.teamAbbr,
      draftYear: p.draftYear,
      draftRound: p.draftRound,
      draftNumber: p.draftNumber,
      college: p.college,
      country: p.country,
      pts: p.pts,
      reb: p.reb,
      ast: p.ast,
      composite: scoreRookie(p),
    }))
    .sort((a, b) => b.composite - a.composite)
    .slice(0, 25);

  const sophomores: RookieRow[] = players
    .filter(hasCompleteAverages)
    .filter((p) => sophomoreIds.has(p.personId))
    .map((p) => ({
      personId: p.personId,
      firstName: p.firstName,
      lastName: p.lastName,
      teamAbbr: p.teamAbbr,
      draftYear: p.draftYear,
      draftRound: p.draftRound,
      draftNumber: p.draftNumber,
      college: p.college,
      country: p.country,
      pts: p.pts,
      reb: p.reb,
      ast: p.ast,
      composite: scoreRookie(p),
    }))
    .sort((a, b) => b.composite - a.composite)
    .slice(0, 15);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow={isZh ? "球员" : "Players"}
        icon={Sparkles}
        title={isZh ? "新秀榜" : "Rookie Watch"}
        subtitle={
          isZh
            ? `${seasonLabel} 赛季索引一年级球员 · 启发式综合分数：PPG + RPG×1.2 + APG×1.5`
            : `${seasonLabel} first-year index cohort · heuristic composite: PPG + RPG×1.2 + APG×1.5`
        }
      />

      <p className="text-xs text-text-secondary mb-4">{playerIndexLabel(snapshot.provenance, locale)}</p>

      {rookies.length > 0 ? (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent-amber flex items-center gap-2">
              <Sparkles size={14} />
              {isZh ? "新秀阶梯" : "Rookie Ladder"}
            </h2>
            <span className="h-px flex-1 bg-accent-amber/30" />
            <span className="text-[10px] font-mono tabular-nums text-text-secondary">{rookies.length} {isZh ? "已排名" : "ranked"}</span>
          </div>
          <div className="space-y-2">
            {rookies.map((p, i) => <Card key={p.personId} p={p} rank={i} />)}
          </div>
        </section>
      ) : (
        <EmptyState
          icon={Sparkles}
          title={isZh ? "暂无新秀数据" : "No rookies tracked yet"}
          description={isZh ? "已识别的一年级球员暂无完整场均数据。" : "The identified first-year players do not yet have complete averages."}
        />
      )}

      {sophomores.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent flex items-center gap-2">
              <Sparkles size={14} className="text-accent" />
              {isZh ? "二年级班" : "Sophomore Class"}
            </h2>
            <span className="h-px flex-1 bg-accent/30" />
            <span className="text-[10px] font-mono tabular-nums text-text-secondary">{sophomores.length} {isZh ? "已排名" : "ranked"}</span>
          </div>
          <div className="space-y-2">
            {sophomores.map((p, i) => <Card key={p.personId} p={p} rank={i} />)}
          </div>
        </section>
      )}

      <div className="glass-tile p-4 mt-6">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-2">/ {isZh ? "方法" : "Method"}</p>
        <p className="text-xs text-text-secondary leading-relaxed">
          {isZh ? "仅使用明确标注本赛季且未过期的 NBA 球员索引。按索引首年识别一年级与二年级球员，不以选秀年份替代；仅排名三项场均数据完整者。这是启发式展示，并非 NBA 官方新秀资格或奖项排名。" : "Uses a fresh NBA index explicitly declaring the current season. First NBA year identifies first- and second-year cohorts, not draft year. Rankings require all three averages. This is a heuristic display, not official rookie eligibility or award ranking."}
        </p>
      </div>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/draft-classes", label: isZh ? "选秀届" : "Draft Classes", description: isZh ? "按选秀年份" : "Active players by draft year", icon: GraduationCap },
          { href: "/by-position", label: isZh ? "按位置榜" : "By Position", description: isZh ? "按位置分组" : "Leaders by position", icon: Users },
          { href: "/by-country", label: isZh ? "国别分布" : "By Country", description: isZh ? "按国家分组" : "Players by country", icon: Globe },
          { href: "/by-college", label: isZh ? "按大学榜" : "By College", description: isZh ? "按大学分组" : "Players by college", icon: GraduationCap },
          { href: "/milestones", label: isZh ? "生涯轨迹" : "Milestones", description: isZh ? "生涯里程碑投影" : "Career milestone projections", icon: TrendingUp },
        ]}
      />
    </div>
  );
}

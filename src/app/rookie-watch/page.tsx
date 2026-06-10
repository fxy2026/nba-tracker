import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, GraduationCap, Users, Globe, TrendingUp } from "lucide-react";
import { getPlayerIndex } from "@/lib/api";
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

// Identify the most recent draft class with non-zero stats (so the page
// actually has data to show). NBA playerIndex's pts/reb/ast fields trail
// by a season — currently-playing rookies often have 0s mid-year, so we
// surface the latest draft class that has populated numbers.
function classify(players: { draftYear: number | null; pts: number }[]): {
  rookieYear: number | null;
  sophomoreYear: number | null;
  seasonLabel: string;
} {
  // Most recent draft year that has at least one player with pts > 0
  const yearsWithStats = new Set(
    players.filter((p) => p.draftYear && p.pts > 0).map((p) => p.draftYear as number)
  );
  if (yearsWithStats.size === 0) {
    return { rookieYear: null, sophomoreYear: null, seasonLabel: "" };
  }
  const maxYear = Math.max(...yearsWithStats);
  // Convert draft year to season label: 2024 draft → 2024-25 season
  const seasonLabel = `${maxYear}-${String((maxYear + 1) % 100).padStart(2, "0")}`;
  return { rookieYear: maxYear, sophomoreYear: maxYear - 1, seasonLabel };
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
  const players = await getPlayerIndex().catch(() => []);

  if (players.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <PageHeader eyebrow={isZh ? "球员" : "Players"} icon={Sparkles} title={isZh ? "新秀榜" : "Rookie Watch"} />
        <EmptyState icon={Sparkles} title={isZh ? "暂无数据" : "No data"} description={isZh ? "无法加载球员索引。" : "Could not load player index."} />
      </div>
    );
  }

  const { rookieYear, sophomoreYear, seasonLabel } = classify(players);

  const rookies: RookieRow[] = players
    .filter((p) => p.draftYear === rookieYear && p.pts > 0)
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
    .filter((p) => p.draftYear === sophomoreYear && p.pts > 0)
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
            ? `${rookieYear ? `${rookieYear} 届选秀 (${seasonLabel} 赛季) ` : ""}综合分数排名 · PPG + RPG×1.2 + APG×1.5 · 数据为该球员近期赛季均值`
            : `${rookieYear ? `${rookieYear} draft class (${seasonLabel} season) ` : ""}ranked by composite score · PPG + RPG×1.2 + APG×1.5 · stats are most recent season averages`
        }
      />

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
          description={isZh ? "球员索引尚未提供本赛季的一年级球员。" : "The player index has not surfaced first-year players for this season."}
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
          {isZh ? (
            <>新秀按 <span className="font-mono">draftYear</span> 识别（最新选秀届有数据者）。二年级生是上一届选秀。
              <br />
              ⚠️ NBA 球员索引的场均数据滞后一个赛季 — 即“现役 2025-26 新秀”如果赛季尚未结束，其数据可能为 0 或缺失，因此榜单展示的是最近有数据的选秀届（通常是上赛季新秀）。综合得分加权篮板与助攻，强调全能表现。</>
          ) : (
            <>Rookies identified by <span className="font-mono">draftYear</span> (most recent class with stats). Sophomores
              are the prior year.
              <br />
              ⚠️ NBA&apos;s player index reports last-completed-season averages, so an in-season rookie class may show as 0
              until the season finalizes. This page surfaces the most recent class that has populated numbers. Composite
              score weights rebounds and assists for well-rounded play.</>
          )}
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

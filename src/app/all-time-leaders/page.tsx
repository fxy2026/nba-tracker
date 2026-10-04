"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Crown, TrendingUp, Sparkles, GraduationCap, Award, Users } from "lucide-react";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";
import { useLocale } from "@/components/LocaleProvider";
import { TEAM_META } from "@/lib/teams";
import { getLeaderboard, type Category } from "@/lib/allTimeLeaders";

type CategoryMeta = {
  key: Category;
  group: "average" | "total" | "career";
  label: string;
  description: string;
  fmt: (v: number) => string;
};

function buildCategories(isZh: boolean): CategoryMeta[] {
  return [
    { key: "ppg", group: "average",
      label: isZh ? "生涯场均得分" : "Career PPG",
      description: isZh ? "已收录记录中的场均得分排行" : "Scoring averages among included records",
      fmt: (v) => v.toFixed(1) },
    { key: "rpg", group: "average",
      label: isZh ? "生涯场均篮板" : "Career RPG",
      description: isZh ? "已收录记录中的场均篮板排行" : "Rebound averages among included records",
      fmt: (v) => v.toFixed(1) },
    { key: "apg", group: "average",
      label: isZh ? "生涯场均助攻" : "Career APG",
      description: isZh ? "已收录记录中的场均助攻排行" : "Assist averages among included records",
      fmt: (v) => v.toFixed(1) },
    { key: "spg", group: "average",
      label: isZh ? "生涯场均抢断" : "Career SPG",
      description: isZh ? "已收录记录中的场均抢断排行" : "Steal averages among included records",
      fmt: (v) => v.toFixed(1) },
    { key: "bpg", group: "average",
      label: isZh ? "生涯场均盖帽" : "Career BPG",
      description: isZh ? "已收录记录中的场均盖帽排行" : "Block averages among included records",
      fmt: (v) => v.toFixed(1) },
    { key: "totalPts", group: "total",
      label: isZh ? "生涯总得分" : "Career Total Points",
      description: isZh ? "已收录记录中的总得分排行" : "Scoring totals among included records",
      fmt: (v) => v.toLocaleString("en-US") },
    { key: "totalReb", group: "total",
      label: isZh ? "生涯总篮板" : "Career Total Rebounds",
      description: isZh ? "已收录记录中的总篮板排行" : "Rebound totals among included records",
      fmt: (v) => v.toLocaleString("en-US") },
    { key: "totalAst", group: "total",
      label: isZh ? "生涯总助攻" : "Career Total Assists",
      description: isZh ? "已收录记录中的总助攻排行" : "Assist totals among included records",
      fmt: (v) => v.toLocaleString("en-US") },
    { key: "tenure", group: "career",
      label: isZh ? "已收录年份跨度" : "Recorded year span",
      description: isZh ? "已收录首末年份之差加一，非实际参赛季数" : "Included end year minus start year plus one; not seasons played",
      fmt: (v) => (isZh ? `${v} 年` : `${v} years`) },
  ];
}

export default function AllTimeLeadersPage() {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const [category, setCategory] = useState<Category>("ppg");

  const categories = useMemo(() => buildCategories(isZh), [isZh]);
  const activeCat = categories.find((c) => c.key === category)!;
  const ranked = useMemo(() => getLeaderboard(category, 25), [category]);
  const topValue = ranked[0]?._value || 1;

  // JSON-LD describes only the included static reference entries shown below.
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: activeCat.label,
    description: `${activeCat.description}. ${isZh ? "精选静态参考，非完整 NBA 历史排名；无经核实的统计截止日期。" : "Curated static reference, not a complete NBA historical ranking; no verified statistics as-of date."}`,
    numberOfItems: Math.min(ranked.length, 10),
    itemListElement: ranked.slice(0, 10).map((entry, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: entry.name,
      // personId 0 = retired legend without a CDN profile; skip the URL.
      ...(entry.personId > 0
        ? { url: `https://nba.xpy.me/player/${entry.personId}` }
        : {}),
    })),
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <Breadcrumbs items={[{ label: isZh ? "历史榜单" : "All-Time Leaders" }]} />
      <PageHeader
        eyebrow={isZh ? "历史" : "History"}
        icon={Crown}
        title={isZh ? "NBA 历史排行榜" : "All-Time Leaders"}
        subtitle={isZh
          ? "精选球员的静态生涯数据参考"
          : "A curated static reference of selected players’ career statistics"}
      />

      <aside className="glass-tile p-3 mb-5 text-xs text-text-secondary leading-relaxed" aria-label={isZh ? "参考范围" : "Reference scope"}>
        <p>{isZh
          ? "精选静态参考 · 不会自动更新。各项仅对已收录的正数值排序，最多展示 25 人，并非完整 NBA 历史榜单。"
          : "Curated static reference · does not update automatically. Each category ranks only included positive values, showing up to 25 players, not a complete NBA historical leaderboard."}</p>
        <details className="mt-2">
          <summary className="cursor-pointer min-h-8 py-2 text-text-primary">{isZh ? "数据范围与限制" : "Coverage and limitations"}</summary>
          <p className="mt-2">{isZh
            ? "未记录经核实的统计截止日期或逐条来源链接。球员身份核对不代表统计数据更新。现役／退役为记录中的状态；球队代码为最具代表性的关联球队，不代表当前阵容。年份跨度为已收录末年减首年加一，不是实际参赛季数。"
            : "No verified statistics as-of date or per-record source links are recorded. Identity reconciliation does not refresh statistics. Active/retired labels are stored status; team codes show the most-associated team, not a current roster. The recorded year span is end year minus start year plus one, not seasons actually played."}</p>
        </details>
      </aside>

      {/* Category groups */}
      <div className="space-y-3 mb-6">
        {(["average", "total", "career"] as const).map((group) => {
          const items = categories.filter((c) => c.group === group);
          const groupLabel = group === "average"
            ? (isZh ? "场均数据" : "Per-Game Averages")
            : group === "total"
            ? (isZh ? "累计数据" : "Career Totals")
            : (isZh ? "已收录年份跨度" : "Recorded year span");
          return (
            <div key={group}>
              <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary/60 mb-1.5">/ {groupLabel}</p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    aria-pressed={category === c.key}
                    className={`px-3 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                      category === c.key
                        ? "bg-accent text-white shadow-md"
                        : "glass-tile text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active category header */}
      <div className="glass-tile p-4 mb-6 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-accent-amber/15 flex items-center justify-center">
          <Crown size={20} className="text-accent-amber" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {activeCat.label}</p>
          <h2 className="text-lg font-semibold text-text-primary tracking-tight">{activeCat.label}{isZh ? " 榜" : " Leaders"}</h2>
          <p className="text-xs text-text-secondary mt-0.5">{activeCat.description}</p>
        </div>
      </div>

      <div className="space-y-2">
        {ranked.map((p, i) => {
          const isTop3 = i < 3;
          const medalBg = i === 0 ? "bg-[#FFD700]/15 ring-1 ring-[#FFD700]/40 text-[#FFD700]"
            : i === 1 ? "bg-[#C0C0C0]/15 ring-1 ring-[#C0C0C0]/40 text-[#C0C0C0]"
            : i === 2 ? "bg-[#CD7F32]/20 ring-1 ring-[#CD7F32]/40 text-[#CD7F32]"
            : "bg-bg-hover text-text-secondary";
          const pct = topValue > 0 ? (p._value / topValue) * 100 : 0;
          const barColor = i === 0 ? "bg-[#FFD700]" : i === 1 ? "bg-[#C0C0C0]" : i === 2 ? "bg-[#CD7F32]" : "bg-accent/60";
          const teamColor = TEAM_META[p.team]?.primaryColor || "#94A3B8";

          const inner = (
            <>
              <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold font-mono tabular-nums shrink-0 ${medalBg}`}>
                {i + 1}
              </span>
              <PlayerHeadshot personId={p.personId} name={p.name} size={40} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-text-primary truncate">
                    {p.name}
                  </p>
                  {p.active ? (
                    <span className="text-[9px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-full bg-success/15 text-success shrink-0">
                      {isZh ? "现役" : "Active"}
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-full bg-bg-hover text-text-secondary/70 shrink-0">
                      {isZh ? "退役" : "Retired"}
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
                  <span style={{ color: teamColor }}>{p.team}</span>
                  <span className="text-text-secondary/40 mx-1">·</span>
                  <span className="tabular-nums">{p.fromYear}-{p.toYear}</span>
                  <span className="text-text-secondary/40 mx-1">·</span>
                  {isZh ? "跨度 " : "Span "}<span className="tabular-nums">{p._seasons}</span>{" "}{isZh ? "年" : "yr"}
                </p>
              </div>
              <div className="hidden sm:flex flex-col items-end shrink-0 min-w-[160px]">
                <div className="flex items-center gap-2 w-full">
                  <div className="flex-1 h-1.5 bg-bg-hover rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={`text-base font-light font-mono tabular-nums ${isTop3 ? "text-text-primary" : "text-accent-amber"} min-w-[60px] text-right`}>
                    {activeCat.fmt(p._value)}
                  </span>
                </div>
              </div>
              <div className="flex sm:hidden flex-col items-end shrink-0">
                <span className={`text-base font-light font-mono tabular-nums ${isTop3 ? "text-text-primary" : "text-accent-amber"}`}>
                  {activeCat.fmt(p._value)}
                </span>
              </div>
            </>
          );

          const cardCls = `glass-tile flex items-center gap-3 p-3 group ${isTop3 ? "bg-accent-amber/[0.03]" : ""}`;

          // Entries with a personId link to the shared player profile route.
          // Entries without one stay non-clickable.
          const href = p.personId > 0
            ? `/player/${p.personId}`
            : null;
          return href ? (
            <Link key={`${p.name}-${i}`} href={href} className={`${cardCls} cursor-pointer`}>
              {inner}
            </Link>
          ) : (
            <div key={`${p.name}-${i}`} className={cardCls}>
              {inner}
            </div>
          );
        })}
      </div>

      <div className="glass-tile p-4 mt-6">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-2">/ {isZh ? "数据说明" : "About these numbers"}</p>
        <p className="text-xs text-text-secondary leading-relaxed">
          {isZh ? (
            <>
              本页使用手工收录的静态参考记录，不保证完整性或当前准确性。
              想查看现役球员本赛季排行，前往{" "}
              <Link href="/stats" className="text-accent hover:underline">数据排行</Link>。
              累计数据看不到？切换到“累计数据”分组。
            </>
          ) : (
            <>
              This page uses manually curated static reference records, without a guarantee of completeness or current accuracy. For current-season league leaders, see{" "}
              <Link href="/stats" className="text-accent hover:underline">Stats</Link>.
              For hypothetical career-pace projections, see{" "}
              <Link href="/milestones" className="text-accent hover:underline">Career Pace Tracker</Link>.
            </>
          )}
        </p>
      </div>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/milestones", label: isZh ? "生涯轨迹追踪" : "Career Pace Tracker", description: isZh ? "基于快照均值的假设投影" : "Hypothetical projections from snapshot averages", icon: TrendingUp },
          { href: "/stats", label: isZh ? "本季排行" : "Season Leaders", description: isZh ? "现役球员本赛季数据" : "Active per-game leaders this season", icon: Crown },
          { href: "/awards-race", label: isZh ? "奖项竞争" : "Awards Race", description: "MVP · DPOY · 6MOY · MIP", icon: Award },
          { href: "/rookie-watch", label: isZh ? "新秀观察" : "Rookie Watch", description: isZh ? "顶尖一年级球员" : "Top first-year players", icon: Sparkles },
          { href: "/by-position", label: isZh ? "按位置排行" : "Leaders By Position", description: isZh ? "按 G/F/C 划分" : "Top by G/F/C", icon: Users },
          { href: "/draft-classes", label: isZh ? "选秀届" : "Draft Classes", description: isZh ? "按选秀年份分组" : "Players grouped by draft year", icon: GraduationCap },
        ]}
      />
    </div>
  );
}

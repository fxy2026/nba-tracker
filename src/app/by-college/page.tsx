import type { Metadata } from "next";
import Link from "next/link";
import { School, Globe, Users, GraduationCap, Activity, TrendingUp } from "lucide-react";
import { getPlayerIndex } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";

export const metadata: Metadata = {
  title: "Players By College",
  description: "Colleges that produce the most NBA talent — ranked by current league representation.",
};

export const revalidate = 600;

interface CollegePlayer {
  personId: number;
  firstName: string;
  lastName: string;
  teamAbbr: string;
  pts: number;
  reb: number;
  ast: number;
}

interface CollegeGroup {
  college: string;
  count: number;
  topThree: CollegePlayer[];
  bestPpg: number;
  avgPpg: number;
}

function score(p: { pts: number; reb: number; ast: number }) {
  return p.pts + p.reb * 1.2 + p.ast * 1.5;
}

export default async function ByCollegePage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const players = await getPlayerIndex().catch(() => []);

  if (players.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader eyebrow={isZh ? "球员" : "Players"} icon={School} title={isZh ? "按大学榜" : "Players By College"} />
        <EmptyState icon={School} title={isZh ? "暂无数据" : "No data"} description={isZh ? "无法加载球员索引。" : "Could not load player index."} />
      </div>
    );
  }

  const byCollege = new Map<string, CollegePlayer[]>();
  for (const p of players) {
    const c = (p.college || "").trim();
    if (!c) continue;
    const row: CollegePlayer = {
      personId: p.personId,
      firstName: p.firstName,
      lastName: p.lastName,
      teamAbbr: p.teamAbbr,
      pts: p.pts,
      reb: p.reb,
      ast: p.ast,
    };
    const arr = byCollege.get(c) || [];
    arr.push(row);
    byCollege.set(c, arr);
  }

  const groups: CollegeGroup[] = [];
  for (const [college, list] of byCollege) {
    const ranked = [...list].sort((a, b) => score(b) - score(a));
    const ppgList = list.filter((p) => p.pts > 0);
    const avgPpg = ppgList.length > 0 ? ppgList.reduce((s, p) => s + p.pts, 0) / ppgList.length : 0;
    const bestPpg = list.reduce((m, p) => p.pts > m ? p.pts : m, 0);
    groups.push({
      college,
      count: list.length,
      topThree: ranked.slice(0, 3),
      bestPpg,
      avgPpg,
    });
  }

  // Top 3+ representation
  const topColleges = groups.filter((g) => g.count >= 3).sort((a, b) => b.count - a.count);
  // Mid-tier — 2 players
  const midColleges = groups.filter((g) => g.count === 2).sort((a, b) => b.bestPpg - a.bestPpg);
  // Singletons
  const singles = groups.filter((g) => g.count === 1).sort((a, b) => b.bestPpg - a.bestPpg);

  const maxCount = topColleges[0]?.count || 1;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow={isZh ? "球员" : "Players"}
        icon={School}
        title={isZh ? "按大学榜" : "Players By College"}
        subtitle={
          isZh
            ? `代表 ${groups.length} 所院校 · ${topColleges.length} 所有 3 名以上 NBA 球员 · 场均数据为上赛季`
            : `${groups.length} schools represented · ${topColleges.length} with 3+ players in the league · per-game stats from last season`
        }
      />

      {/* Power schools — 3+ players */}
      <section className="mb-8">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent-amber flex items-center gap-2">
            <School size={14} className="text-accent-amber" />
            {isZh ? "NBA 培养院校" : "NBA Pipelines"}
          </h2>
          <span className="h-px flex-1 bg-accent-amber/30" />
          <span className="text-[10px] font-mono tabular-nums text-text-secondary">{topColleges.length} {isZh ? "所院校 · 联盟内 3+ 球员" : "schools · 3+ in NBA"}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {topColleges.map((g, i) => {
            const pct = (g.count / maxCount) * 100;
            const isTop3 = i < 3;
            return (
              <div key={g.college} className={`glass-tile p-4 ${isTop3 ? "bg-accent-amber/[0.03]" : ""}`}>
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-text-primary truncate flex items-center gap-2">
                      {i === 0 && <span className="text-[#FFD700]">🥇</span>}
                      {i === 1 && <span className="text-[#C0C0C0]">🥈</span>}
                      {i === 2 && <span className="text-[#CD7F32]">🥉</span>}
                      {g.college}
                    </p>
                    <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary/60 mt-0.5">
                      {isZh ? (
                        <><span className="tabular-nums">{g.count}</span> 现役 · 最高得分 <span className="tabular-nums">{g.bestPpg.toFixed(1)}</span> · 均值 <span className="tabular-nums">{g.avgPpg.toFixed(1)}</span> · 上赛季</>
                      ) : (
                        <><span className="tabular-nums">{g.count}</span> active · best PPG <span className="tabular-nums">{g.bestPpg.toFixed(1)}</span> · avg <span className="tabular-nums">{g.avgPpg.toFixed(1)}</span> · last season</>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-light font-mono tabular-nums text-accent">{g.count}</p>
                  </div>
                </div>
                <div className="h-1 bg-bg-hover rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <div className="space-y-1">
                  {g.topThree.map((p) => (
                    <Link
                      key={p.personId}
                      href={`/player/${p.personId}`}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg-hover transition-colors group cursor-pointer"
                    >
                      <PlayerHeadshot personId={p.personId} name={`${p.firstName} ${p.lastName}`} size={26} />
                      <span className="text-xs font-medium text-text-primary group-hover:text-accent transition-colors truncate flex-1">
                        {p.firstName} {p.lastName}
                      </span>
                      <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary shrink-0">{p.teamAbbr}</span>
                      <span className="text-[10px] font-mono tabular-nums text-accent-amber shrink-0">{p.pts.toFixed(1)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Mid — 2 players */}
      {midColleges.length > 0 && (
        <section className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent flex items-center gap-2">
              <School size={14} className="text-accent" />
              {isZh ? "双子院校" : "Tandem Schools"}
            </h2>
            <span className="h-px flex-1 bg-accent/30" />
            <span className="text-[10px] font-mono tabular-nums text-text-secondary">{midColleges.length} {isZh ? "所院校 · 联盟内 2 球员" : "schools · 2 in NBA"}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {midColleges.map((g) => (
              <div key={g.college} className="glass-tile p-3">
                <p className="text-xs font-bold text-text-primary truncate">{g.college}</p>
                <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60 mb-1.5">
                  {isZh ? "最高得分 · 上赛季" : "Best PPG · last season"} <span className="tabular-nums text-text-secondary">{g.bestPpg.toFixed(1)}</span>
                </p>
                <div className="flex flex-wrap gap-1">
                  {g.topThree.map((p) => (
                    <Link
                      key={p.personId}
                      href={`/player/${p.personId}`}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-bg-hover hover:bg-accent/15 hover:text-accent text-text-secondary transition-colors cursor-pointer"
                    >
                      {p.firstName[0]}. {p.lastName}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Singles — long tail */}
      {singles.length > 0 && (
        <section className="mb-6">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-text-secondary flex items-center gap-2">
              <School size={14} />
              {isZh ? "独苗" : "Solo Reps"}
            </h2>
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-mono tabular-nums text-text-secondary">{singles.length} {isZh ? "所院校 · 1 名现役" : "schools · 1 active"}</span>
          </div>
          <div className="glass-tile p-4">
            <div className="flex flex-wrap gap-1.5">
              {singles.slice(0, 60).map((g) => (
                <Link
                  key={g.college}
                  href={`/player/${g.topThree[0].personId}`}
                  className="text-[10px] font-mono px-2 py-1 rounded-md bg-bg-hover/60 hover:bg-accent/15 hover:text-accent text-text-secondary transition-colors cursor-pointer truncate max-w-[200px]"
                  title={`${g.college} · ${g.topThree[0].firstName} ${g.topThree[0].lastName} (${g.bestPpg.toFixed(1)} PPG)`}
                >
                  {g.college}
                </Link>
              ))}
              {singles.length > 60 && (
                <span className="text-[10px] font-mono px-2 py-1 text-text-secondary/60">+{singles.length - 60} {isZh ? "更多" : "more"}</span>
              )}
            </div>
          </div>
        </section>
      )}

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/by-country", label: isZh ? "国别分布" : "By Country", description: isZh ? "按国家分组" : "Players by country", icon: Globe },
          { href: "/by-position", label: isZh ? "按位置榜" : "By Position", description: isZh ? "按位置分组" : "Leaders by position", icon: Users },
          { href: "/draft-classes", label: isZh ? "选秀届" : "Draft Classes", description: isZh ? "按选秀年份" : "Active players by draft year", icon: GraduationCap },
          { href: "/rookie-watch", label: isZh ? "新秀榜" : "Rookie Watch", description: isZh ? "本届新秀表现" : "Top rookies this season", icon: Activity },
          { href: "/milestones", label: isZh ? "生涯轨迹" : "Milestones", description: isZh ? "生涯里程碑投影" : "Career milestone projections", icon: TrendingUp },
        ]}
      />
    </div>
  );
}

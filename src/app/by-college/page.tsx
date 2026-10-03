import type { Metadata } from "next";
import Link from "next/link";
import { School, Globe, Users, GraduationCap, Activity, TrendingUp } from "lucide-react";
import { getPlayerIndexSnapshot } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";
import { PlayerDirectorySource } from "@/components/PlayerDirectoryContext";
import { directoryStats } from "@/lib/player-directory";
import { playerIndexStat } from "@/lib/player-index-provenance";
import { collegeSourceLabel } from "@/lib/college-source";

export const metadata: Metadata = {
  title: "Schools & Background Teams",
  description: "Player groups from the NBA index college field, including schools and team backgrounds, with snapshot provenance.",
};

interface CollegePlayer {
  personId: number;
  firstName: string;
  lastName: string;
  teamAbbr: string;
  pts: number | null;
  reb: number | null;
  ast: number | null;
}

interface CollegeGroup {
  college: string;
  count: number;
  topThree: CollegePlayer[];
  bestPpg: number | null;
  avgPpg: number | null;
}

export default async function ByCollegePage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const snapshot = await getPlayerIndexSnapshot().catch(() => null);
  const players = snapshot?.players ?? [];

  if (players.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader eyebrow={isZh ? "球员" : "Players"} icon={School} title={isZh ? "学校与球队背景" : "Schools & Background Teams"} />
        <EmptyState icon={School} title={isZh ? "暂无数据" : "No data"} description={isZh ? "无法加载球员索引。" : "Could not load player index."} />
      </div>
    );
  }

  const byCollege = new Map<string, CollegePlayer[]>();
  let unspecified = 0;
  for (const p of players) {
    const c = collegeSourceLabel(p.college);
    if (!c) { unspecified++; continue; }
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
    const stats = directoryStats(list);
    const ranked = [...stats.ranked, ...stats.unranked];
    const avgPpg = stats.avgPts;
    const bestPpg = stats.bestPpg;
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
  const midColleges = groups.filter((g) => g.count === 2).sort((a, b) => (b.bestPpg ?? -1) - (a.bestPpg ?? -1));
  // Singletons
  const singles = groups.filter((g) => g.count === 1).sort((a, b) => (b.bestPpg ?? -1) - (a.bestPpg ?? -1));

  const maxCount = topColleges[0]?.count || 1;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow={isZh ? "球员" : "Players"}
        icon={School}
        title={isZh ? "学校与球队背景" : "Schools & Background Teams"}
        subtitle={
          isZh
            ? `${groups.length} 个来源分组 · ${topColleges.length} 组有至少 3 名快照球员`
            : `${groups.length} background groups · ${topColleges.length} with 3+ snapshot players`
        }
      />

      <PlayerDirectorySource provenance={snapshot?.provenance ?? null} locale={locale} />
      <p className="mb-4 text-xs text-text-secondary">{isZh
        ? "按 NBA 球员索引 COLLEGE 字段分组，可能包含学校、职业球队或其他背景；保留来源标签，不将其认定为已核实的教育经历。均值包含已知的真实零分，缺失数据不按零计算。"
        : "Groups follow the NBA index COLLEGE field, which may list schools, professional teams or other backgrounds. Source labels are not verified education histories. Averages include known zeros; missing statistics are not treated as zero."}</p>
      {unspecified > 0 && <p className="mb-4 text-xs text-text-secondary">{isZh ? `${unspecified} 名球员的来源未注明，未计入分组。` : `${unspecified} players have unspecified backgrounds and are excluded from group counts.`}</p>}

      {/* Power schools — 3+ players */}
      <section className="mb-8">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-accent-amber flex items-center gap-2">
            <School size={14} className="text-accent-amber" />
            {isZh ? "多人来源分组" : "Larger Background Groups"}
          </h2>
          <span className="h-px flex-1 bg-accent-amber/30" />
          <span className="text-[10px] font-mono tabular-nums text-text-secondary">{topColleges.length} {isZh ? "组 · 3+ 名快照球员" : "groups · 3+ snapshot players"}</span>
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
                        <><span className="tabular-nums">{g.count}</span> 名快照球员 · 最高场均 <span className="tabular-nums">{playerIndexStat(g.bestPpg)}</span> · 均值 <span className="tabular-nums">{playerIndexStat(g.avgPpg)}</span></>
                      ) : (
                        <><span className="tabular-nums">{g.count}</span> snapshot players · best PPG <span className="tabular-nums">{playerIndexStat(g.bestPpg)}</span> · avg <span className="tabular-nums">{playerIndexStat(g.avgPpg)}</span></>
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
                      <span className="text-[10px] font-mono tabular-nums text-accent-amber shrink-0">{playerIndexStat(p.pts)}</span>
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
              {isZh ? "双人来源分组" : "Two-player Groups"}
            </h2>
            <span className="h-px flex-1 bg-accent/30" />
            <span className="text-[10px] font-mono tabular-nums text-text-secondary">{midColleges.length} {isZh ? "组 · 2 名快照球员" : "groups · 2 snapshot players"}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {midColleges.map((g) => (
              <div key={g.college} className="glass-tile p-3">
                <p className="text-xs font-bold text-text-primary truncate">{g.college}</p>
                <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60 mb-1.5">
                  {isZh ? "最高场均得分" : "Best snapshot PPG"} <span className="tabular-nums text-text-secondary">{playerIndexStat(g.bestPpg)}</span>
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
            <span className="text-[10px] font-mono tabular-nums text-text-secondary">{singles.length} {isZh ? "组 · 1 名快照球员" : "groups · 1 snapshot player"}</span>
          </div>
          <div className="glass-tile p-4">
            <div className="flex flex-wrap gap-1.5">
              {singles.slice(0, 60).map((g) => (
                <Link
                  key={g.college}
                  href={`/player/${g.topThree[0].personId}`}
                  className="text-[10px] font-mono px-2 py-1 rounded-md bg-bg-hover/60 hover:bg-accent/15 hover:text-accent text-text-secondary transition-colors cursor-pointer truncate max-w-[200px]"
                  title={`${g.college} · ${g.topThree[0].firstName} ${g.topThree[0].lastName} (${playerIndexStat(g.bestPpg)} PPG)`}
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

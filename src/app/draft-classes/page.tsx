import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Activity, Users, Globe, Crown, Sparkles, ArrowRight } from "lucide-react";
import { getPlayerIndexSnapshot } from "@/lib/api";
import { directoryStats } from "@/lib/player-directory";
import { PlayerDirectorySource, UnrankedDirectoryPlayers } from "@/components/PlayerDirectoryContext";
import { playerIndexStat } from "@/lib/player-index-provenance";
import { getLocale } from "@/lib/locale";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";

export const metadata: Metadata = {
  title: "Draft Classes",
  description: "NBA player-index snapshots grouped by declared draft year, with source-season context.",
};

interface ClassPlayer {
  personId: number;
  firstName: string;
  lastName: string;
  teamAbbr: string;
  draftNumber: number | null;
  draftRound: number | null;
  pts: number;
  reb: number;
  ast: number;
}

interface ClassGroup {
  year: number;
  players: ClassPlayer[];
  totalPlayers: number;
  topThree: ClassPlayer[];
  avgPts: number | null;
  bestPpg: number | null;
  unranked: ClassPlayer[];
}

export default async function DraftClassesPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const snapshot = await getPlayerIndexSnapshot().catch(() => null);
  const players = snapshot?.players ?? [];

  if (players.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <PageHeader eyebrow={isZh ? "选秀" : "Draft"} icon={GraduationCap} title={isZh ? "选秀届" : "Draft Classes"} />
        <PlayerDirectorySource provenance={snapshot?.provenance ?? null} locale={locale} />
        <EmptyState icon={GraduationCap} title={isZh ? "暂无数据" : "No data"} description={isZh ? "无法加载球员索引。" : "Could not load player index."} />
      </div>
    );
  }

  const byYear = new Map<number, ClassPlayer[]>();
  for (const p of players) {
    if (!p.draftYear) continue;
    const row: ClassPlayer = {
      personId: p.personId,
      firstName: p.firstName,
      lastName: p.lastName,
      teamAbbr: p.teamAbbr,
      draftNumber: p.draftNumber,
      draftRound: p.draftRound,
      pts: p.pts,
      reb: p.reb,
      ast: p.ast,
    };
    const arr = byYear.get(p.draftYear) || [];
    arr.push(row);
    byYear.set(p.draftYear, arr);
  }

  const groups: ClassGroup[] = [];
  for (const [year, list] of byYear) {
    const { ranked, unranked, avgPts, bestPpg } = directoryStats(list);
    groups.push({
      year,
      players: list,
      totalPlayers: list.length,
      topThree: ranked.slice(0, 3),
      avgPts,
      bestPpg, unranked,
    });
  }
  groups.sort((a, b) => b.year - a.year);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow={isZh ? "选秀" : "Draft"}
        icon={GraduationCap}
        title={isZh ? "选秀届" : "Draft Classes"}
        subtitle={
          isZh
            ? `快照球员按已知选秀年份分组 · 共 ${groups.length} 届`
            : `Snapshot players grouped by declared draft year · ${groups.length} classes represented`
        }
      />

      <PlayerDirectorySource provenance={snapshot?.provenance ?? null} locale={locale} />
      <Link
        href="/draft/2026"
        className="glass-tile p-5 mb-4 flex items-center gap-4 group cursor-pointer ring-1 ring-accent/20"
      >
        <div className="shrink-0 w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
          <Sparkles size={22} className="text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {isZh ? "选秀档案" : "Draft archive"}</p>
          <p className="font-semibold text-text-primary group-hover:text-accent transition-colors">{isZh ? "2026 选秀 · 逐顺位结果" : "2026 Draft · pick by pick"}</p>
          <p className="text-[11px] text-text-secondary leading-snug mt-0.5">{isZh ? "单独查看 2026 选秀结果。" : "View the separate 2026 draft board."}</p>
        </div>
        <ArrowRight size={16} className="text-text-secondary group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
      </Link>

      <div className="space-y-4">
        {groups.map((g) => {
          const undrafted = g.players.filter((p) => !p.draftNumber).length;
          return (
            <section key={g.year} className="glass-tile p-5">
              <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {isZh ? "届" : "Class of"}</p>
                  <h2 className="text-3xl font-light tracking-tight text-text-primary font-mono tabular-nums">{g.year}</h2>
                </div>
                <div className="flex items-center gap-5 text-right">
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">{isZh ? "快照人数" : "In snapshot"}</p>
                    <p className="text-lg font-light font-mono tabular-nums text-text-primary">{g.totalPlayers}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">{isZh ? "已知场均均值" : "Known PPG average"}</p>
                    <p className="text-lg font-light font-mono tabular-nums text-text-secondary">{playerIndexStat(g.avgPts)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">{isZh ? "最高得分" : "Best PPG"}</p>
                    <p className="text-lg font-light font-mono tabular-nums text-accent-amber">{playerIndexStat(g.bestPpg)}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                {g.topThree.map((p, i) => {
                  const medalBg = i === 0 ? "ring-[#FFD700]/40 bg-[#FFD700]/[0.04]"
                    : i === 1 ? "ring-[#C0C0C0]/40 bg-[#C0C0C0]/[0.04]"
                    : "ring-[#CD7F32]/40 bg-[#CD7F32]/[0.04]";
                  return (
                    <Link
                      key={p.personId}
                      href={`/player/${p.personId}`}
                      className={`flex items-center gap-3 glass-tile p-3 ring-1 group cursor-pointer ${medalBg}`}
                    >
                      <PlayerHeadshot personId={p.personId} name={`${p.firstName} ${p.lastName}`} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary">
                          #{i + 1} · {p.draftNumber ? (isZh ? `顺位 ${p.draftNumber}` : `Pick ${p.draftNumber}`) : (isZh ? "顺位未注明" : "Pick unspecified")}
                        </p>
                        <p className="font-medium text-text-primary group-hover:text-accent transition-colors truncate">
                          {p.firstName} {p.lastName}
                        </p>
                        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
                          {p.teamAbbr || "—"} · <span className="tabular-nums">{playerIndexStat(p.pts)}</span>/<span className="tabular-nums">{playerIndexStat(p.reb)}</span>/<span className="tabular-nums">{playerIndexStat(p.ast)}</span>
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <UnrankedDirectoryPlayers players={g.unranked} locale={locale} />
              {undrafted > 0 && (
                <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">
                  {isZh ? (
                    <><span className="tabular-nums">{undrafted}</span> 名球员顺位未注明</>
                  ) : (
                    <><span className="tabular-nums">{undrafted}</span> player{undrafted === 1 ? "" : "s"} with an unspecified pick</>
                  )}
                </p>
              )}
            </section>
          );
        })}
      </div>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/rookie-watch", label: isZh ? "新秀榜" : "Rookie Watch", description: isZh ? "本届新秀表现" : "Top rookies this season", icon: Activity },
          { href: "/by-position", label: isZh ? "按位置榜" : "By Position", description: isZh ? "按位置分组" : "Leaders by position", icon: Users },
          { href: "/by-country", label: isZh ? "国别分布" : "By Country", description: isZh ? "按国家分组" : "Players by country", icon: Globe },
          { href: "/by-college", label: isZh ? "按大学榜" : "By College", description: isZh ? "按大学分组" : "Players by college", icon: GraduationCap },
          { href: "/all-time-leaders", label: isZh ? "历史榜首" : "All-Time Leaders", description: isZh ? "历史数据领跑者" : "Career stat leaders", icon: Crown },
        ]}
      />
    </div>
  );
}

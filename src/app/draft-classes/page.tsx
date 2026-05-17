import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { getPlayerIndex } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "Draft Classes",
  description: "Active NBA players grouped by their draft year — see how each class has held up.",
};

export const revalidate = 600;

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
  avgPts: number;
  bestPpg: number;
}

function scoreImpact(p: ClassPlayer) {
  return p.pts + p.reb * 1.2 + p.ast * 1.5;
}

export default async function DraftClassesPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const players = await getPlayerIndex().catch(() => []);

  if (players.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <PageHeader eyebrow={isZh ? "选秀" : "Draft"} icon={GraduationCap} title={isZh ? "选秀届" : "Draft Classes"} />
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
    const ranked = [...list].sort((a, b) => scoreImpact(b) - scoreImpact(a));
    const ppgList = list.filter((p) => p.pts > 0);
    const avgPts = ppgList.length > 0 ? ppgList.reduce((s, p) => s + p.pts, 0) / ppgList.length : 0;
    const bestPpg = ppgList.reduce((m, p) => p.pts > m ? p.pts : m, 0);
    groups.push({
      year,
      players: list,
      totalPlayers: list.length,
      topThree: ranked.slice(0, 3),
      avgPts,
      bestPpg,
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
            ? `现役球员按选秀年份分组 · 共 ${groups.length} 届`
            : `Active players grouped by draft year · ${groups.length} classes represented`
        }
      />

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
                    <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">{isZh ? "现役" : "Active"}</p>
                    <p className="text-lg font-light font-mono tabular-nums text-text-primary">{g.totalPlayers}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">{isZh ? "场均得分" : "Avg PPG"}</p>
                    <p className="text-lg font-light font-mono tabular-nums text-text-secondary">{g.avgPts.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">{isZh ? "最高得分" : "Best PPG"}</p>
                    <p className="text-lg font-light font-mono tabular-nums text-accent-amber">{g.bestPpg.toFixed(1)}</p>
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
                          #{i + 1} · {p.draftNumber ? (isZh ? `顺位 ${p.draftNumber}` : `Pick ${p.draftNumber}`) : (isZh ? "落选" : "Undrafted")}
                        </p>
                        <p className="font-medium text-text-primary group-hover:text-accent transition-colors truncate">
                          {p.firstName} {p.lastName}
                        </p>
                        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
                          {p.teamAbbr || "—"} · <span className="tabular-nums">{p.pts.toFixed(1)}</span>/<span className="tabular-nums">{p.reb.toFixed(1)}</span>/<span className="tabular-nums">{p.ast.toFixed(1)}</span>
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {undrafted > 0 && (
                <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">
                  {isZh ? (
                    <><span className="tabular-nums">{undrafted}</span> 名未选秀但仍现役的球员</>
                  ) : (
                    <><span className="tabular-nums">{undrafted}</span> undrafted player{undrafted === 1 ? "" : "s"} still active from this class</>
                  )}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Map as MapIcon } from "lucide-react";
import { getFullSchedule } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import { teamLogoUrl } from "@/lib/teamUrls";
import { isRegular, winPct } from "@/lib/games";
import { getLocale } from "@/lib/locale";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "Division Standings",
  description: "Each of the NBA's six divisions ranked by win percentage — Atlantic, Central, Southeast, Northwest, Pacific, and Southwest.",
};

export const revalidate = 600;

interface TeamRec {
  tricode: string;
  teamId: number;
  wins: number;
  losses: number;
  pct: number;
  conference: string;
  division: string;
}

async function compute(): Promise<TeamRec[]> {
  const schedule = await getFullSchedule().catch(() => []);
  const map = new Map<string, { tricode: string; teamId: number; wins: number; losses: number }>();
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      if (!isRegular(g.gameId)) continue;
      const homeWon = g.homeTeam.score > g.awayTeam.score;
      const push = (tri: string, teamId: number, won: boolean) => {
        const r = map.get(tri) || { tricode: tri, teamId, wins: 0, losses: 0 };
        if (won) r.wins++; else r.losses++;
        map.set(tri, r);
      };
      push(g.homeTeam.teamTricode, g.homeTeam.teamId, homeWon);
      push(g.awayTeam.teamTricode, g.awayTeam.teamId, !homeWon);
    }
  }

  const out: TeamRec[] = [];
  for (const r of map.values()) {
    const meta = TEAM_META[r.tricode];
    if (!meta) continue;
    const pct = winPct(r.wins, r.losses);
    out.push({ ...r, pct, conference: meta.conference, division: meta.division });
  }
  for (const meta of Object.values(TEAM_META)) {
    if (!out.find((o) => o.tricode === meta.tricode)) {
      out.push({ tricode: meta.tricode, teamId: meta.teamId, wins: 0, losses: 0, pct: 0, conference: meta.conference, division: meta.division });
    }
  }
  return out;
}

const DIVISION_COLORS: Record<string, { color: string; eyebrow: string }> = {
  "Atlantic":   { color: "#3B82F6", eyebrow: "East · Atlantic" },
  "Central":    { color: "#22C55E", eyebrow: "East · Central" },
  "Southeast":  { color: "#A855F7", eyebrow: "East · Southeast" },
  "Northwest":  { color: "#F59E0B", eyebrow: "West · Northwest" },
  "Pacific":    { color: "#DF1B41", eyebrow: "West · Pacific" },
  "Southwest":  { color: "#06B6D4", eyebrow: "West · Southwest" },
};

const ORDER = ["Atlantic", "Central", "Southeast", "Northwest", "Pacific", "Southwest"];

const DIVISION_ZH: Record<string, { name: string; eyebrow: string }> = {
  "Atlantic":  { name: "大西洋", eyebrow: "东部 · 大西洋" },
  "Central":   { name: "中央",   eyebrow: "东部 · 中央" },
  "Southeast": { name: "东南",   eyebrow: "东部 · 东南" },
  "Northwest": { name: "西北",   eyebrow: "西部 · 西北" },
  "Pacific":   { name: "太平洋", eyebrow: "西部 · 太平洋" },
  "Southwest": { name: "西南",   eyebrow: "西部 · 西南" },
};

export default async function DivisionsPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const teams = await compute();

  if (teams.length === 0 || teams.every((t) => t.wins + t.losses === 0)) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader eyebrow={isZh ? "联盟" : "League"} icon={MapIcon} title={isZh ? "分区排名" : "Division Standings"} />
        <EmptyState
          icon={MapIcon}
          title={isZh ? "暂无数据" : "No data"}
          description={isZh ? "比赛进行后，分区排名会显示在这里。" : "Division standings will populate once games have been played."}
        />
      </div>
    );
  }

  const grouped = new Map<string, TeamRec[]>();
  for (const t of teams) {
    const arr = grouped.get(t.division) || [];
    arr.push(t);
    grouped.set(t.division, arr);
  }
  for (const [div, list] of grouped) {
    list.sort((a, b) => b.pct - a.pct || b.wins - a.wins);
    grouped.set(div, list);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow={isZh ? "联盟" : "League"}
        icon={MapIcon}
        title={isZh ? "分区排名" : "Division Standings"}
        subtitle={isZh ? "六个分区 · 各组按胜率排序" : "Six divisions · ranked by win percentage within each group"}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {ORDER.map((division) => {
          const list = grouped.get(division) || [];
          const meta = DIVISION_COLORS[division];
          const zhMeta = DIVISION_ZH[division];
          return (
            <section key={division} className="glass-tile p-5 relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-1.5 opacity-80" style={{ background: meta.color }} />
              <div className="relative">
                <div className="mb-4">
                  <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {isZh ? zhMeta.eyebrow : meta.eyebrow}</p>
                  <h2 className="text-xl font-semibold tracking-tight" style={{ color: meta.color }}>{isZh ? zhMeta.name : division}</h2>
                </div>
                <div className="space-y-1.5">
                  {list.map((t, i) => {
                    const medalBg = i === 0 ? "bg-[#FFD700]/15 ring-1 ring-[#FFD700]/40 text-[#FFD700]"
                      : "bg-bg-hover text-text-secondary";
                    return (
                      <Link
                        key={t.tricode}
                        href={`/team/${t.tricode}`}
                        className="glass-tile p-3 flex items-center gap-3 group cursor-pointer"
                      >
                        <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold font-mono tabular-nums shrink-0 ${medalBg}`}>
                          {i + 1}
                        </span>
                        <Image src={teamLogoUrl(t.teamId)} alt={t.tricode} width={28} height={28} unoptimized />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold font-mono text-text-primary group-hover:text-accent transition-colors">{t.tricode}</p>
                          <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
                            <span className="tabular-nums">{t.wins}</span>-<span className="tabular-nums">{t.losses}</span> · <span className="tabular-nums">{(t.pct * 100).toFixed(1)}%</span>
                          </p>
                        </div>
                        <div className="w-20 h-1.5 bg-bg-hover rounded-full overflow-hidden shrink-0">
                          <div className="h-full rounded-full" style={{ width: `${t.pct * 100}%`, background: meta.color }} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

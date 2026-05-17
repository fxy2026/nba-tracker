import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Home, Plane } from "lucide-react";
import { getFullSchedule } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "Home vs Road Splits",
  description: "How each team plays at home vs on the road — fortresses and road warriors ranked.",
};

export const revalidate = 600;

interface TeamSplit {
  tricode: string;
  teamId: number;
  homeW: number;
  homeL: number;
  roadW: number;
  roadL: number;
  homePct: number;
  roadPct: number;
  diff: number;
}

async function compute(): Promise<TeamSplit[]> {
  const schedule = await getFullSchedule().catch(() => []);
  const map = new Map<string, { tricode: string; teamId: number; homeW: number; homeL: number; roadW: number; roadL: number }>();
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      if (!g.gameId.startsWith("002")) continue;
      const homeWon = g.homeTeam.score > g.awayTeam.score;
      const h = map.get(g.homeTeam.teamTricode) || { tricode: g.homeTeam.teamTricode, teamId: g.homeTeam.teamId, homeW: 0, homeL: 0, roadW: 0, roadL: 0 };
      const a = map.get(g.awayTeam.teamTricode) || { tricode: g.awayTeam.teamTricode, teamId: g.awayTeam.teamId, homeW: 0, homeL: 0, roadW: 0, roadL: 0 };
      if (homeWon) { h.homeW++; a.roadL++; } else { h.homeL++; a.roadW++; }
      map.set(g.homeTeam.teamTricode, h);
      map.set(g.awayTeam.teamTricode, a);
    }
  }

  const out: TeamSplit[] = [];
  for (const r of map.values()) {
    const homeTotal = r.homeW + r.homeL;
    const roadTotal = r.roadW + r.roadL;
    const homePct = homeTotal > 0 ? r.homeW / homeTotal : 0;
    const roadPct = roadTotal > 0 ? r.roadW / roadTotal : 0;
    out.push({ ...r, homePct, roadPct, diff: homePct - roadPct });
  }
  return out;
}

function Row({ team, value, sub, color }: { team: TeamSplit; value: string; sub: string; color: string }) {
  return (
    <Link
      href={`/team/${team.tricode}`}
      className="glass-tile p-3 flex items-center gap-3 group cursor-pointer"
    >
      <Image src={`https://cdn.nba.com/logos/nba/${team.teamId}/global/L/logo.svg`} alt={team.tricode} width={36} height={36} unoptimized />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold font-mono text-text-primary group-hover:text-accent transition-colors">{team.tricode}</p>
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">{sub}</p>
      </div>
      <span className="text-lg font-light font-mono tabular-nums shrink-0" style={{ color }}>{value}</span>
    </Link>
  );
}

export default async function HomeVsRoadPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const teams = await compute();

  if (teams.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader eyebrow={isZh ? "球队" : "Teams"} icon={Home} title={isZh ? "主客场分别" : "Home vs Road Splits"} />
        <EmptyState
          icon={Home}
          title={isZh ? "暂无数据" : "No data"}
          description={isZh ? "本赛季产生已结束比赛后，主客场数据会显示在这里。" : "Splits will populate once the season has produced finished games."}
        />
      </div>
    );
  }

  const bestHome = [...teams].sort((a, b) => b.homePct - a.homePct || (b.homeW + b.homeL) - (a.homeW + a.homeL)).slice(0, 10);
  const bestRoad = [...teams].sort((a, b) => b.roadPct - a.roadPct || (b.roadW + b.roadL) - (a.roadW + a.roadL)).slice(0, 10);
  const biggestSplit = [...teams].sort((a, b) => b.diff - a.diff).slice(0, 5);
  const flatTeams = [...teams].sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff)).slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow={isZh ? "球队" : "Teams"}
        icon={Home}
        title={isZh ? "主客场分别" : "Home vs Road Splits"}
        subtitle={isZh ? "最强主场堡垒、顶级客场战士、最大差距 — 主客场很重要" : "Best fortresses, top road warriors, biggest splits — venue matters"}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <section className="glass-tile p-5 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-success opacity-80" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-3">
              <Home size={18} className="text-success" />
              <div>
                <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {isZh ? "堡垒" : "Fortress"}</p>
                <h2 className="text-xl font-semibold text-success tracking-tight">{isZh ? "最强主场" : "Best at Home"}</h2>
              </div>
            </div>
            <div className="space-y-1.5">
              {bestHome.map((t) => (
                <Row
                  key={t.tricode}
                  team={t}
                  value={`${(t.homePct * 100).toFixed(1)}%`}
                  sub={`${t.homeW}-${t.homeL} at home · ${(t.homePct * 100).toFixed(1)}%`}
                  color="#22C55E"
                />
              ))}
            </div>
          </div>
        </section>

        <section className="glass-tile p-5 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-accent-amber opacity-80" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-3">
              <Plane size={18} className="text-accent-amber" />
              <div>
                <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {isZh ? "客场战士" : "Road Warrior"}</p>
                <h2 className="text-xl font-semibold text-accent-amber tracking-tight">{isZh ? "最强客场" : "Best on the Road"}</h2>
              </div>
            </div>
            <div className="space-y-1.5">
              {bestRoad.map((t) => (
                <Row
                  key={t.tricode}
                  team={t}
                  value={`${(t.roadPct * 100).toFixed(1)}%`}
                  sub={`${t.roadW}-${t.roadL} on road · ${(t.roadPct * 100).toFixed(1)}%`}
                  color="#F59E0B"
                />
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section className="glass-tile p-5">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-accent mb-1">/ {isZh ? "主场效应" : "Venue Effect"}</p>
          <h2 className="text-lg font-semibold tracking-tight mb-3">{isZh ? "主客差距最大" : "Biggest Home/Road Split"}</h2>
          <div className="space-y-1.5">
            {biggestSplit.map((t) => (
              <Row
                key={t.tricode}
                team={t}
                value={`+${(t.diff * 100).toFixed(1)}%`}
                sub={`Home ${(t.homePct * 100).toFixed(1)}% · Road ${(t.roadPct * 100).toFixed(1)}%`}
                color="#3B82F6"
              />
            ))}
          </div>
        </section>

        <section className="glass-tile p-5">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary mb-1">/ {isZh ? "适应客场" : "Travel-Proof"}</p>
          <h2 className="text-lg font-semibold tracking-tight mb-3">{isZh ? "最稳定" : "Most Consistent"}</h2>
          <div className="space-y-1.5">
            {flatTeams.map((t) => (
              <Row
                key={t.tricode}
                team={t}
                value={`${(Math.abs(t.diff) * 100).toFixed(1)}%`}
                sub={`Home ${(t.homePct * 100).toFixed(1)}% · Road ${(t.roadPct * 100).toFixed(1)}%`}
                color="#94A3B8"
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

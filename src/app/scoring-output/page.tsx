import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { TrendingUp, Shield } from "lucide-react";
import { getFullSchedule } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import { teamLogoUrl } from "@/lib/teamUrls";
import { isRegular } from "@/lib/games";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export const metadata: Metadata = {
  title: "Scoring Output",
  description: "Team offensive and defensive output — points scored, points allowed, and net rating per game.",
};

export const revalidate = 600;

interface TeamOutput {
  tricode: string;
  teamId: number;
  games: number;
  pf: number;     // points for total
  pa: number;     // points against total
  ppg: number;
  papg: number;
  net: number;
}

async function compute(): Promise<TeamOutput[]> {
  const schedule = await getFullSchedule().catch(() => []);
  const map = new Map<string, { tricode: string; teamId: number; games: number; pf: number; pa: number }>();
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      if (!isRegular(g.gameId)) continue;
      const h = map.get(g.homeTeam.teamTricode) || { tricode: g.homeTeam.teamTricode, teamId: g.homeTeam.teamId, games: 0, pf: 0, pa: 0 };
      const a = map.get(g.awayTeam.teamTricode) || { tricode: g.awayTeam.teamTricode, teamId: g.awayTeam.teamId, games: 0, pf: 0, pa: 0 };
      h.games++; h.pf += g.homeTeam.score; h.pa += g.awayTeam.score;
      a.games++; a.pf += g.awayTeam.score; a.pa += g.homeTeam.score;
      map.set(g.homeTeam.teamTricode, h);
      map.set(g.awayTeam.teamTricode, a);
    }
  }

  const out: TeamOutput[] = [];
  for (const r of map.values()) {
    const ppg = r.games > 0 ? r.pf / r.games : 0;
    const papg = r.games > 0 ? r.pa / r.games : 0;
    out.push({ ...r, ppg, papg, net: ppg - papg });
  }
  return out;
}

function Row({ team, value, sub, color, rank }: { team: TeamOutput; value: string; sub: string; color: string; rank: number }) {
  return (
    <Link
      href={`/team/${team.tricode}`}
      className="glass-tile p-3 flex items-center gap-3 group cursor-pointer"
    >
      <span className="w-7 h-7 flex items-center justify-center rounded-full text-xs font-mono tabular-nums shrink-0 bg-bg-hover text-text-secondary">
        {rank}
      </span>
      <Image src={teamLogoUrl(team.teamId)} alt={team.tricode} width={32} height={32} unoptimized />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold font-mono text-text-primary group-hover:text-accent transition-colors">{team.tricode}</p>
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">{sub}</p>
      </div>
      <span className="text-base font-light font-mono tabular-nums shrink-0" style={{ color }}>{value}</span>
    </Link>
  );
}

export default async function ScoringOutputPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const teams = await compute();

  if (teams.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader eyebrow={isZh ? "球队" : "Teams"} icon={TrendingUp} title={isZh ? "攻防输出" : "Scoring Output"} />
        <EmptyState
          icon={TrendingUp}
          title={isZh ? "暂无数据" : "No data"}
          description={isZh ? "记录已结束比赛后，得分数据会显示在这里。" : "Scoring data will populate once finished games are recorded."}
        />
      </div>
    );
  }

  const offense = [...teams].sort((a, b) => b.ppg - a.ppg);
  const defense = [...teams].sort((a, b) => a.papg - b.papg);
  const net = [...teams].sort((a, b) => b.net - a.net);

  const leagueAvgPpg = teams.reduce((s, t) => s + t.ppg, 0) / teams.length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow={isZh ? "球队" : "Teams"}
        icon={TrendingUp}
        title={isZh ? "攻防输出" : "Scoring Output"}
        subtitle={
          isZh
            ? `进攻、防守与每场净得分差 · 联盟均值 ${leagueAvgPpg.toFixed(1)} PPG`
            : `Offense, defense, and net point differential per game · league average ${leagueAvgPpg.toFixed(1)} PPG`
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="glass-tile p-5 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-success opacity-80" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-3">
              <TrendingUp size={18} className="text-success" />
              <div>
                <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {isZh ? "进攻" : "Offense"}</p>
                <h2 className="text-xl font-semibold text-success tracking-tight">{isZh ? "场均得分最高" : "Most Points Per Game"}</h2>
              </div>
            </div>
            <div className="space-y-1.5">
              {offense.slice(0, 15).map((t, i) => (
                <Row key={t.tricode} team={t} rank={i + 1}
                  value={t.ppg.toFixed(1)}
                  sub={`${t.pf} pts in ${t.games} games`}
                  color="#22C55E"
                />
              ))}
            </div>
          </div>
        </section>

        <section className="glass-tile p-5 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-accent opacity-80" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-3">
              <Shield size={18} className="text-accent" />
              <div>
                <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {isZh ? "防守" : "Defense"}</p>
                <h2 className="text-xl font-semibold text-accent tracking-tight">{isZh ? "场均失分最少" : "Fewest Points Allowed"}</h2>
              </div>
            </div>
            <div className="space-y-1.5">
              {defense.slice(0, 15).map((t, i) => (
                <Row key={t.tricode} team={t} rank={i + 1}
                  value={t.papg.toFixed(1)}
                  sub={`${t.pa} allowed in ${t.games} games`}
                  color="#3B82F6"
                />
              ))}
            </div>
          </div>
        </section>

        <section className="glass-tile p-5 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-accent-amber opacity-80" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-3">
              <TrendingUp size={18} className="text-accent-amber" />
              <div>
                <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {isZh ? "净值" : "Net"}</p>
                <h2 className="text-xl font-semibold text-accent-amber tracking-tight">{isZh ? "最佳净胜分" : "Best Point Differential"}</h2>
              </div>
            </div>
            <div className="space-y-1.5">
              {net.slice(0, 15).map((t, i) => (
                <Row key={t.tricode} team={t} rank={i + 1}
                  value={`${t.net >= 0 ? "+" : ""}${t.net.toFixed(1)}`}
                  sub={isZh ? `${t.ppg.toFixed(1)} 得分 · ${t.papg.toFixed(1)} 失分` : `${t.ppg.toFixed(1)} for · ${t.papg.toFixed(1)} against`}
                  color={t.net >= 0 ? "#F59E0B" : "#DF1B41"}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

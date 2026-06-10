import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { TrendingUp, TrendingDown, Activity, Crown, Repeat, Users } from "lucide-react";
import { getFullSchedule, getScheduleAge } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import { teamLogoUrl } from "@/lib/teamUrls";
import { isRegular } from "@/lib/games";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";

export const metadata: Metadata = {
  title: "Momentum",
  description: "Teams trending up or down based on last 5 vs prior 10 games — who's heating up, who's cooling off.",
};

interface MomentumRec {
  tricode: string;
  teamId: number;
  last5W: number;
  last5L: number;
  prior10W: number;
  prior10L: number;
  last5Pct: number;
  prior10Pct: number;
  delta: number;
  lastResults: boolean[]; // most recent first, true=won
}

async function compute(): Promise<MomentumRec[]> {
  const schedule = await getFullSchedule().catch(() => []);
  type Game = { date: string; won: boolean; teamId: number };
  const map = new Map<string, Game[]>();
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      if (!isRegular(g.gameId)) continue;
      const dateStr = gd.gameDate.split(" ")[0];
      const [m, d, y] = dateStr.split("/");
      const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      const homeWon = g.homeTeam.score > g.awayTeam.score;
      const pushH = map.get(g.homeTeam.teamTricode) || [];
      pushH.push({ date: iso, won: homeWon, teamId: g.homeTeam.teamId });
      map.set(g.homeTeam.teamTricode, pushH);
      const pushA = map.get(g.awayTeam.teamTricode) || [];
      pushA.push({ date: iso, won: !homeWon, teamId: g.awayTeam.teamId });
      map.set(g.awayTeam.teamTricode, pushA);
    }
  }

  const out: MomentumRec[] = [];
  for (const [tri, games] of map) {
    games.sort((a, b) => b.date.localeCompare(a.date)); // most recent first
    const last5 = games.slice(0, 5);
    const prior10 = games.slice(5, 15);
    const last5W = last5.filter((g) => g.won).length;
    const prior10W = prior10.filter((g) => g.won).length;
    const last5Pct = last5.length > 0 ? last5W / last5.length : 0;
    const prior10Pct = prior10.length > 0 ? prior10W / prior10.length : 0;
    out.push({
      tricode: tri,
      teamId: games[0].teamId,
      last5W,
      last5L: last5.length - last5W,
      prior10W,
      prior10L: prior10.length - prior10W,
      last5Pct,
      prior10Pct,
      delta: last5Pct - prior10Pct,
      lastResults: last5.map((g) => g.won),
    });
  }
  return out;
}

function FormDots({ results }: { results: boolean[] }) {
  return (
    <div className="flex items-center gap-0.5">
      {results.map((w, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full ${w ? "bg-success" : "bg-danger"}`}
          title={w ? "W" : "L"}
        />
      ))}
      {results.length === 0 && <span className="text-[9px] font-mono text-text-secondary">—</span>}
    </div>
  );
}

function Row({ r, delta, color, rank, showDirection }: { r: MomentumRec; delta: number; color: string; rank: number; showDirection: "up" | "down" }) {
  const Arrow = showDirection === "up" ? TrendingUp : TrendingDown;
  return (
    <Link
      href={`/team/${r.tricode}`}
      className="glass-tile p-3 flex items-center gap-3 group cursor-pointer"
    >
      <span className="w-7 h-7 flex items-center justify-center rounded-full text-xs font-mono tabular-nums shrink-0 bg-bg-hover text-text-secondary">
        {rank}
      </span>
      <Image src={teamLogoUrl(r.teamId)} alt={r.tricode} width={32} height={32} unoptimized />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold font-mono text-text-primary group-hover:text-accent transition-colors">{r.tricode}</p>
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
          L5 <span className="tabular-nums">{r.last5W}-{r.last5L}</span> · prior 10 <span className="tabular-nums">{r.prior10W}-{r.prior10L}</span>
        </p>
        <div className="mt-1.5">
          <FormDots results={r.lastResults} />
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Arrow size={14} style={{ color }} />
        <span className="text-base font-light font-mono tabular-nums" style={{ color }}>
          {delta > 0 ? "+" : ""}{(delta * 100).toFixed(0)}%
        </span>
      </div>
    </Link>
  );
}

export default async function MomentumPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const all = await compute();

  const breadcrumbs = <Breadcrumbs items={[{ label: isZh ? "势头" : "Momentum" }]} />;

  if (all.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        {breadcrumbs}
        <PageHeader eyebrow={isZh ? "走势" : "Trend"} icon={TrendingUp} title={isZh ? "势头" : "Momentum"} />
        <EmptyState
          icon={TrendingUp}
          title={isZh ? "暂无数据" : "No data"}
          description={isZh ? "球队打过足够比赛后，势头数据会显示。" : "Momentum will populate once teams have played enough games."}
        />
      </div>
    );
  }

  const qualified = all.filter((r) => r.last5W + r.last5L >= 3 && r.prior10W + r.prior10L >= 3);
  const heating = [...qualified].sort((a, b) => b.delta - a.delta).slice(0, 10);
  const cooling = [...qualified].sort((a, b) => a.delta - b.delta).slice(0, 10);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {breadcrumbs}
      <PageHeader
        eyebrow={isZh ? "走势" : "Trend"}
        icon={TrendingUp}
        title={isZh ? "势头" : "Momentum"}
        subtitle={
          isZh
            ? "最近 5 场 vs 之前 10 场 · 最大变动 · 状态点显示最近结果（最新在左）"
            : "Last 5 games vs the prior 10 · biggest deltas surfaced · form dots show recent results (most recent first)"
        }
        updatedAt={getScheduleAge()}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="glass-tile p-5 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-success opacity-80" />
          <div className="relative">
            <div className="mb-4">
              <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {isZh ? "上升期" : "Heating Up"}</p>
              <h2 className="text-xl font-semibold text-success tracking-tight flex items-center gap-2">
                <TrendingUp size={18} />
                {isZh ? "上升球队" : "Rising Teams"}
              </h2>
              <p className="text-xs text-text-secondary mt-1">{isZh ? "最近状态优于之前 10 场" : "Recent form better than the prior 10 games"}</p>
            </div>
            <div className="space-y-1.5">
              {heating.map((r, i) => (
                <Row key={r.tricode} r={r} rank={i + 1} delta={r.delta} color="#22C55E" showDirection="up" />
              ))}
            </div>
          </div>
        </section>

        <section className="glass-tile p-5 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-danger opacity-80" />
          <div className="relative">
            <div className="mb-4">
              <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {isZh ? "下降期" : "Cooling Off"}</p>
              <h2 className="text-xl font-semibold text-danger tracking-tight flex items-center gap-2">
                <TrendingDown size={18} />
                {isZh ? "下降球队" : "Falling Teams"}
              </h2>
              <p className="text-xs text-text-secondary mt-1">{isZh ? "最近状态弱于之前 10 场" : "Recent form worse than the prior 10 games"}</p>
            </div>
            <div className="space-y-1.5">
              {cooling.map((r, i) => (
                <Row key={r.tricode} r={r} rank={i + 1} delta={r.delta} color="#DF1B41" showDirection="down" />
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="glass-tile p-4 mt-6">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-2">/ {isZh ? "方法" : "Method"}</p>
        <p className="text-xs text-text-secondary leading-relaxed">
          {isZh
            ? "势头对比球队最近 5 场与之前 10 场的胜率。例如球队第 6-15 场是 4-6，最近 5 场 4-1，相当于 +50% 上升 — 从中游中爬出的明显热度。反之识别从强势滑向麻烦的球队。每个窗口至少 3 场才入围。"
            : "Momentum compares win percentage over a team's last 5 games to their preceding 10 games. A team that was 4-6 over games 6-15 and goes 4-1 over their last 5 swings +50% — a clear hot streak emerging from mediocrity. The reverse identifies teams sliding from strong form into trouble. Minimum 3 games in each window to qualify."}
        </p>
      </div>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/streaks", label: isZh ? "连胜连败" : "Streaks", description: isZh ? "正在燃烧或冷却的球队" : "Hot and cold teams", icon: Activity },
          { href: "/power-rankings", label: isZh ? "实力榜" : "Power Rankings", description: isZh ? "联盟实力排序" : "League-wide strength ranking", icon: TrendingUp },
          { href: "/tier-list", label: isZh ? "等级表" : "Tier List", description: isZh ? "球队按战力分档" : "Teams bucketed by tier", icon: Crown },
          { href: "/clutch-teams", label: isZh ? "关键时刻" : "Clutch Teams", description: isZh ? "焦点战与加时赛战绩" : "Close-game and OT records", icon: Repeat },
          { href: "/conference-race", label: isZh ? "分区冲刺" : "Conference Race", description: isZh ? "季后赛种子争夺" : "Playoff seeding race", icon: Users },
        ]}
      />
    </div>
  );
}

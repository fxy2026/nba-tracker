import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Crown, TrendingUp, TrendingDown, Minus, Flame, Layers, Target, Trophy } from "lucide-react";
import { getFullSchedule, getScheduleAge } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import { teamLogoUrl } from "@/lib/teamUrls";
import { isRegular } from "@/lib/games";
import { getLocale } from "@/lib/locale";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";

export const metadata: Metadata = {
  title: "Power Rankings",
  description: "Custom NBA power rankings — combines overall win %, last-10 form, and point differential.",
};

export const revalidate = 600;

interface TeamMetrics {
  tricode: string;
  teamId: number;
  wins: number;
  losses: number;
  winPct: number;
  last10Wins: number;
  last10Losses: number;
  last10Pct: number;
  pointDiff: number; // per game, last 10
  trend: "up" | "down" | "flat"; // last 5 vs prior 5
  power: number;
}

async function computeMetrics(): Promise<TeamMetrics[]> {
  const schedule = await getFullSchedule().catch(() => []);

  type GameOutcome = { date: string; won: boolean; pf: number; pa: number; teamId: number };
  const teamGames = new Map<string, GameOutcome[]>();

  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      // Only regular season games
      if (!isRegular(g.gameId)) continue;
      const dateStr = gd.gameDate.split(" ")[0];
      const [m, d, y] = dateStr.split("/");
      const isoDate = `${y}-${m}-${d}`;

      const home = g.homeTeam;
      const away = g.awayTeam;
      const homeWon = home.score > away.score;

      const push = (tri: string, won: boolean, pf: number, pa: number, teamId: number) => {
        const arr = teamGames.get(tri) || [];
        arr.push({ date: isoDate, won, pf, pa, teamId });
        teamGames.set(tri, arr);
      };

      push(home.teamTricode, homeWon, home.score, away.score, home.teamId);
      push(away.teamTricode, !homeWon, away.score, home.score, away.teamId);
    }
  }

  const metrics: TeamMetrics[] = [];
  for (const [tricode, games] of teamGames) {
    if (games.length === 0) continue;
    games.sort((a, b) => b.date.localeCompare(a.date)); // most recent first

    const total = games.length;
    const wins = games.filter((g) => g.won).length;
    const losses = total - wins;
    const winPct = total > 0 ? wins / total : 0;

    const last10 = games.slice(0, 10);
    const last10Wins = last10.filter((g) => g.won).length;
    const last10Losses = last10.length - last10Wins;
    const last10Pct = last10.length > 0 ? last10Wins / last10.length : 0;
    const pointDiff =
      last10.length > 0
        ? last10.reduce((s, g) => s + (g.pf - g.pa), 0) / last10.length
        : 0;

    // Trend: last 5 win% vs games 6-10 win%
    const last5 = games.slice(0, 5);
    const prior5 = games.slice(5, 10);
    const last5Pct = last5.length > 0 ? last5.filter((g) => g.won).length / last5.length : 0;
    const prior5Pct = prior5.length > 0 ? prior5.filter((g) => g.won).length / prior5.length : 0;
    const trendDelta = last5Pct - prior5Pct;
    const trend: TeamMetrics["trend"] = trendDelta > 0.2 ? "up" : trendDelta < -0.2 ? "down" : "flat";

    // Power score: weighted composite
    // - 35% overall win pct
    // - 35% last 10 form
    // - 30% point differential (scaled, +/- 15 maps to 0-1)
    const pdScore = Math.min(Math.max((pointDiff + 15) / 30, 0), 1);
    const power = winPct * 0.35 + last10Pct * 0.35 + pdScore * 0.3;

    metrics.push({
      tricode,
      teamId: games[0].teamId,
      wins,
      losses,
      winPct,
      last10Wins,
      last10Losses,
      last10Pct,
      pointDiff,
      trend,
      power,
    });
  }

  metrics.sort((a, b) => b.power - a.power);
  return metrics;
}

function TrendIcon({ trend, isZh }: { trend: TeamMetrics["trend"]; isZh: boolean }) {
  if (trend === "up") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.15em] text-success">
        <TrendingUp size={11} />
        {isZh ? "上升" : "Rising"}
      </span>
    );
  }
  if (trend === "down") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.15em] text-danger">
        <TrendingDown size={11} />
        {isZh ? "下降" : "Falling"}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
      <Minus size={11} />
      {isZh ? "平稳" : "Steady"}
    </span>
  );
}

function TeamRow({ m, rank, topPower, isZh }: { m: TeamMetrics; rank: number; topPower: number; isZh: boolean }) {
  const meta = TEAM_META[m.tricode];
  const teamColor = meta?.primaryColor || "#3B82F6";
  const isTop3 = rank <= 3;
  const medalBg =
    rank === 1
      ? "bg-[#FFD700]/15 ring-1 ring-[#FFD700]/40 text-[#FFD700]"
      : rank === 2
      ? "bg-[#C0C0C0]/15 ring-1 ring-[#C0C0C0]/40 text-[#C0C0C0]"
      : rank === 3
      ? "bg-[#CD7F32]/20 ring-1 ring-[#CD7F32]/40 text-[#CD7F32]"
      : "bg-bg-hover text-text-secondary";

  const powerPct = topPower > 0 ? (m.power / topPower) * 100 : 0;
  const barColor =
    rank === 1 ? "bg-[#FFD700]" : rank === 2 ? "bg-[#C0C0C0]" : rank === 3 ? "bg-[#CD7F32]" : "bg-accent/60";

  return (
    <Link
      href={`/team/${m.tricode}`}
      className={`glass-tile flex items-center gap-4 p-4 cursor-pointer group relative overflow-hidden ${
        isTop3 ? "bg-accent-amber/[0.03]" : ""
      }`}
    >
      {/* Team color side accent */}
      <div className="absolute inset-y-0 left-0 w-1 opacity-70" style={{ background: teamColor }} />

      {/* Rank */}
      <span
        className={`w-10 h-10 flex items-center justify-center rounded-full text-base font-bold font-mono tabular-nums shrink-0 ${medalBg}`}
      >
        {rank}
      </span>

      {/* Team logo + meta */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Image
          src={teamLogoUrl(m.teamId)}
          alt={m.tricode}
          width={36}
          height={36}
          unoptimized
        />
        <div className="min-w-0">
          <p className="font-bold text-text-primary group-hover:text-accent transition-colors">
            {meta ? `${meta.city} ${meta.name}` : m.tricode}
          </p>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
            <span>
              <span className="text-success tabular-nums">{m.wins}</span>
              <span className="text-text-secondary/40 mx-0.5">-</span>
              <span className="text-danger tabular-nums">{m.losses}</span>
            </span>
            <span className="text-text-secondary/40">·</span>
            <TrendIcon trend={m.trend} isZh={isZh} />
          </div>
        </div>
      </div>

      {/* Last 10 */}
      <div className="hidden sm:flex flex-col items-end shrink-0 w-20">
        <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">L10</p>
        <p className="text-sm font-mono tabular-nums">
          <span className="text-success font-bold">{m.last10Wins}</span>
          <span className="text-text-secondary/40">-</span>
          <span className="text-danger font-bold">{m.last10Losses}</span>
        </p>
      </div>

      {/* Point diff */}
      <div className="hidden sm:flex flex-col items-end shrink-0 w-20">
        <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">Net</p>
        <p
          className={`text-sm font-light font-mono tabular-nums ${
            m.pointDiff > 0 ? "text-success" : m.pointDiff < 0 ? "text-danger" : "text-text-secondary"
          }`}
        >
          {m.pointDiff > 0 ? "+" : ""}
          {m.pointDiff.toFixed(1)}
        </p>
      </div>

      {/* Power score bar */}
      <div className="flex flex-col items-end shrink-0 w-32">
        <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">Power</p>
        <div className="flex items-center gap-2 w-full">
          <div className="flex-1 h-1.5 bg-bg-hover rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} rounded-full transition-all`}
              style={{ width: `${powerPct}%` }}
            />
          </div>
          <span
            className={`text-xs font-mono tabular-nums font-bold ${
              isTop3 ? "text-text-primary" : "text-accent"
            }`}
          >
            {(m.power * 100).toFixed(0)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default async function PowerRankingsPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const metrics = await computeMetrics();

  const breadcrumbs = <Breadcrumbs items={[{ label: isZh ? "战力榜" : "Power Rankings" }]} />;

  if (metrics.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        {breadcrumbs}
        <PageHeader eyebrow={isZh ? "联盟" : "League"} icon={Crown} title={isZh ? "战力榜" : "Power Rankings"} />
        <EmptyState
          icon={Crown}
          title={isZh ? "暂无排名数据" : "No ranking data yet"}
          description={isZh ? "战力榜需要每支球队至少打完一场比赛。请在赛季稍晚再来。" : "Power rankings need at least one finished game per team. Try later in the season."}
        />
      </div>
    );
  }

  const topPower = metrics[0].power;

  // Insight strip
  const rising = metrics.filter((m) => m.trend === "up").length;
  const falling = metrics.filter((m) => m.trend === "down").length;
  const hottestPointDiff = [...metrics].sort((a, b) => b.pointDiff - a.pointDiff)[0];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {breadcrumbs}
      <PageHeader
        eyebrow={isZh ? "联盟" : "League"}
        icon={Crown}
        title={isZh ? "战力榜" : "Power Rankings"}
        subtitle={isZh ? "综合排名 · 35% 总胜率 + 35% 近10场状态 + 30% 净胜分" : "Composite ranking · 35% overall win % + 35% last-10 form + 30% point differential"}
        updatedAt={getScheduleAge()}
      />

      {/* Insight cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        <div className="glass-tile p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFD700]/15 flex items-center justify-center shrink-0">
            <Crown size={18} className="text-[#FFD700]" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">{isZh ? "总榜第1" : "#1 Overall"}</p>
            <p className="text-sm font-bold text-text-primary">
              {TEAM_META[metrics[0].tricode]?.city} {TEAM_META[metrics[0].tricode]?.name}
            </p>
            <p className="text-[10px] font-mono tabular-nums text-[#FFD700]">
              {isZh ? "战力分" : "Power score"} · {(metrics[0].power * 100).toFixed(0)}
            </p>
          </div>
        </div>
        <div className="glass-tile p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center shrink-0">
            <TrendingUp size={18} className="text-success" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">{isZh ? "上升 · 近5场" : "Rising · Last 5"}</p>
            <p className="text-2xl font-light font-mono tabular-nums text-success">{rising}</p>
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">{isZh ? "支球队上升" : "teams trending up"}</p>
          </div>
        </div>
        <div className="glass-tile p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-danger/15 flex items-center justify-center shrink-0">
            <TrendingDown size={18} className="text-danger" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">{isZh ? "下降 · 近5场" : "Falling · Last 5"}</p>
            <p className="text-2xl font-light font-mono tabular-nums text-danger">{falling}</p>
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">{isZh ? "支球队下滑" : "teams trending down"}</p>
          </div>
        </div>
      </div>

      {/* Rankings list */}
      <div className="space-y-2 mb-8">
        {metrics.map((m, i) => (
          <TeamRow key={m.tricode} m={m} rank={i + 1} topPower={topPower} isZh={isZh} />
        ))}
      </div>

      {/* Methodology */}
      <div className="glass-tile p-4 mb-4">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-2">{isZh ? "/ 计算方法" : "/ Methodology"}</p>
        <p className="text-xs text-text-secondary leading-relaxed">
          {isZh
            ? "战力分为综合得分 — 35% 全季胜率,35% 近10场胜率,30% 场均净胜分(标准化, ±15 映射至 0–1)。趋势指标对比近5场与第6-10场: 增幅 > +20% = 上升, < -20% = 下降, 否则平稳。"
            : "Power score is a composite — 35% weight on full-season win %, 35% on last-10 win %, 30% on average point differential (scaled, ±15 maps to 0–1). Trend indicator compares last 5 games to games 6–10: delta > +20% = Rising, < -20% = Falling, else Steady."}
        </p>
        <p className="text-[10px] text-text-secondary/50 mt-2 font-mono">
          {isZh ? "最佳净胜分: " : "Hottest point differential: "}<span className="text-success">{TEAM_META[hottestPointDiff.tricode]?.tricode}</span>{isZh ? " 近10场场均 " : " at "}
          <span className="font-mono tabular-nums">+{hottestPointDiff.pointDiff.toFixed(1)}</span>{isZh ? "。" : " per game over last 10."}
        </p>
      </div>

      <RelatedPages
        pages={[
          { href: "/tier-list", label: "Tier List", description: "Teams bucketed S/A/B/C/D", icon: Layers },
          { href: "/conference-race", label: "Conference Race", description: "Playoff seeding 1-15 per side", icon: Trophy },
          { href: "/streaks", label: "Streaks", description: "Active win/loss runs", icon: Flame },
          { href: "/momentum", label: "Momentum", description: "Trending up or down · L5 vs prior 10", icon: TrendingUp },
          { href: "/clutch-teams", label: "Clutch Teams", description: "Records in close games and OT", icon: Target },
          { href: "/scoring-output", label: "Scoring Output", description: "Off/def per-game rankings", icon: Crown },
        ]}
      />
    </div>
  );
}

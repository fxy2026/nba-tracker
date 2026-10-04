import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Home, Plane, ListOrdered, Users, Activity, Repeat, TrendingUp } from "lucide-react";
import { getCurrentSeasonSchedule, getRecorded2025SeasonSchedule, getScheduleAge } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import { teamLogoUrl } from "@/lib/teamUrls";
import { computeHomeRoadSplits, formatHomeRoadDifference, type TeamSplit } from "@/lib/home-road-splits";
import { RECORDED_TRAJECTORY_SEASON, trajectorySeason, trajectoryFinals, trajectoryCoverage } from "@/lib/trajectory-season";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";

type NextPageProps = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

export async function generateMetadata({ searchParams }: NextPageProps): Promise<Metadata> {
  const isZh = await getLocale() === "zh";
  const selection = trajectorySeason((await searchParams)?.season);
  return {
    title: isZh ? "主客场战绩" : "Home vs Road Splits",
    description: selection.archive
      ? (isZh ? "2025-26 已记录赛季主客场战绩与胜率，仅使用本地常规赛终场记录。" : "2025-26 recorded home and road records and win rates, from local regular-season finals only.")
      : (isZh ? `${selection.season} 赛季主客场战绩与胜率。` : `${selection.season} home and road records and win rates.`),
  };
}

function Row({ team, value, sub, color }: { team: TeamSplit; value: string; sub: string; color: string }) {
  return (
    <Link
      href={`/team/${team.tricode}`}
      className="glass-tile p-3 flex items-center gap-2 sm:gap-3 group cursor-pointer"
    >
      <Image src={teamLogoUrl(team.teamId)} alt={team.tricode} width={36} height={36} className="shrink-0" unoptimized />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold font-mono text-text-primary group-hover:text-accent transition-colors">{team.tricode}</p>
        <p className="text-xs leading-relaxed break-words text-text-secondary">{sub}</p>
      </div>
      <span className="text-base sm:text-lg font-light font-mono tabular-nums shrink-0" style={{ color }}>{value}</span>
    </Link>
  );
}

export default async function HomeVsRoadPage({ searchParams }: NextPageProps) {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const selection = trajectorySeason((await searchParams)?.season);
  const schedule = selection.archive
    ? trajectoryFinals(getRecorded2025SeasonSchedule(), selection.season)
    : await getCurrentSeasonSchedule().catch(() => []);
  const teams = computeHomeRoadSplits(schedule);
  const coverage = trajectoryCoverage(schedule);

  const bestHome = [...teams].sort((a, b) => b.homePct - a.homePct || (b.homeW + b.homeL) - (a.homeW + a.homeL)).slice(0, 10);
  const bestRoad = [...teams].sort((a, b) => b.roadPct - a.roadPct || (b.roadW + b.roadL) - (a.roadW + a.roadL)).slice(0, 10);
  const biggestSplit = [...teams].sort((a, b) => b.diff - a.diff).slice(0, 5);
  const flatTeams = [...teams].sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff)).slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow={isZh ? "球队" : "Teams"}
        icon={Home}
        title={isZh ? "主客场战绩" : "Home vs Road Splits"}
        subtitle={isZh ? "主场与客场胜率 · 按常规赛终场记录计算" : "Home and road win rates · regular-season finals"}
        action={<span className="chip font-mono">{selection.season} {isZh ? "常规赛" : "Regular season"}</span>}
        updatedAt={selection.archive ? undefined : getScheduleAge()}
      />

      <section aria-label={isZh ? "赛季与数据来源" : "Season and data source"} className="mb-5 space-y-3">
        <nav aria-label={isZh ? "选择赛季" : "Choose season"} className="flex flex-wrap gap-2">
          <Link href="/home-vs-road" prefetch={false} aria-current={!selection.archive ? "page" : undefined}
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-sm aria-[current=page]:bg-accent/10 aria-[current=page]:text-accent">
            {selection.current} · {isZh ? "当前赛季" : "Current season"}
          </Link>
          {selection.current !== RECORDED_TRAJECTORY_SEASON && <Link href={`/home-vs-road?season=${RECORDED_TRAJECTORY_SEASON}`} prefetch={false} aria-current={selection.archive ? "page" : undefined}
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-sm aria-[current=page]:bg-accent/10 aria-[current=page]:text-accent">
            {RECORDED_TRAJECTORY_SEASON} · {isZh ? "已记录赛季" : "Recorded season"}
          </Link>}
        </nav>
        {selection.invalid && <p className="text-sm text-text-secondary">{isZh ? "赛季参数无效或重复，已显示当前赛季。" : "Invalid or repeated season selection; showing the current season."}</p>}
        {selection.archive && <div className="space-y-2 text-sm text-text-secondary leading-relaxed">
          <p className="tabular-nums">{isZh
            ? `${coverage.finals.toLocaleString("en-US")} 场终场记录 · ${coverage.teams} 支球队 · 每队 ${coverage.min === coverage.max ? coverage.max : `${coverage.min}–${coverage.max}`} 场`
            : `${coverage.finals.toLocaleString("en-US")} recorded finals · ${coverage.teams} teams · ${coverage.min === coverage.max ? coverage.max : `${coverage.min}–${coverage.max}`} games per team`}</p>
          <p>{isZh ? "主客场按存档中的指定身份统计，并非实际比赛场馆。" : "Home and road follow recorded designations, not physical venues."}</p>
          <details>
            <summary className="min-h-11 cursor-pointer py-3">{isZh ? "数据来源与限制" : "Source and limits"}</summary>
            <div className="space-y-2 pb-3">
              <p>{isZh ? `${selection.season} · 本地存档中的常规赛终场记录，并非实时或近期核验的数据。` : `${selection.season} · Recorded regular-season finals from the local archive, not live or recently verified data.`}</p>
              <p>{isZh ? "主客场胜率分别使用实际记录场次计算；每队各侧为 40–42 场，并非固定 41 场。差值为主场胜率减去客场胜率，以百分点表示。" : "Each win rate uses its actual recorded game count: 40–42 games on each side per team, not a fixed 41. Differences are home minus road win rate in percentage points."}</p>
              <p>{isZh ? "仅提供战绩与胜率，不含存档技术统计。球队详情与下方链接显示各自页面的当前数据。" : "Records and win rates only; no archived box-score metrics. Team details and related links use their own current data."}</p>
            </div>
          </details>
        </div>}
        <p className="text-xs leading-relaxed text-text-secondary">{isZh ? "差值 = 主场胜率 − 客场胜率（百分点）" : "Difference = home win rate − road win rate (percentage points)"}</p>
      </section>

      {teams.length === 0 ? <EmptyState
        icon={Home}
        title={isZh ? "暂无数据" : "No data"}
        description={isZh ? "记录已结束比赛后，主客场数据会显示在这里。" : "Splits will populate once finished games are recorded."}
      /> : <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <section className="glass-tile p-5 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-success opacity-80" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-3">
              <Home size={18} className="text-success" />
              <div>
                <p className="text-xs font-mono uppercase tracking-wide text-text-secondary/60">/ {isZh ? "堡垒" : "Fortress"}</p>
                <h2 className="text-xl font-semibold text-success tracking-tight">{isZh ? "最强主场" : "Best at Home"}</h2>
              </div>
            </div>
            <div className="space-y-1.5">
              {bestHome.map((t) => (
                <Row
                  key={t.tricode}
                  team={t}
                  value={`${(t.homePct * 100).toFixed(1)}%`}
                  sub={`${isZh ? "主场" : "Home"} ${t.homeW}-${t.homeL}`}
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
                <p className="text-xs font-mono uppercase tracking-wide text-text-secondary/60">/ {isZh ? "客场战士" : "Road Warrior"}</p>
                <h2 className="text-xl font-semibold text-accent-amber tracking-tight">{isZh ? "最强客场" : "Best on the Road"}</h2>
              </div>
            </div>
            <div className="space-y-1.5">
              {bestRoad.map((t) => (
                <Row
                  key={t.tricode}
                  team={t}
                  value={`${(t.roadPct * 100).toFixed(1)}%`}
                  sub={`${isZh ? "客场" : "Road"} ${t.roadW}-${t.roadL}`}
                  color="#F59E0B"
                />
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section className="glass-tile p-5">
          <p className="text-xs font-mono uppercase tracking-wide text-accent mb-1">/ {isZh ? "主场效应" : "Venue Effect"}</p>
          <h2 className="text-lg font-semibold tracking-tight mb-3">{isZh ? "主客差距最大" : "Biggest Home/Road Split"}</h2>
          <div className="space-y-1.5">
            {biggestSplit.map((t) => (
              <Row
                key={t.tricode}
                team={t}
                value={formatHomeRoadDifference(t.diff, isZh)}
                sub={`${isZh ? "主场" : "Home"} ${(t.homePct * 100).toFixed(1)}% · ${isZh ? "客场" : "Road"} ${(t.roadPct * 100).toFixed(1)}%`}
                color="#3B82F6"
              />
            ))}
          </div>
        </section>

        <section className="glass-tile p-5">
          <p className="text-xs font-mono uppercase tracking-wide text-text-secondary mb-1">/ {isZh ? "适应客场" : "Travel-Proof"}</p>
          <h2 className="text-lg font-semibold tracking-tight mb-3">{isZh ? "最稳定" : "Most Consistent"}</h2>
          <div className="space-y-1.5">
            {flatTeams.map((t) => (
              <Row
                key={t.tricode}
                team={t}
                value={formatHomeRoadDifference(t.diff, isZh)}
                sub={`${isZh ? "主场" : "Home"} ${(t.homePct * 100).toFixed(1)}% · ${isZh ? "客场" : "Road"} ${(t.roadPct * 100).toFixed(1)}%`}
                color="#94A3B8"
              />
            ))}
          </div>
        </section>
      </div>

      </>}

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/standings", label: isZh ? "排名榜" : "Standings", description: isZh ? "完整东西部排名" : "Full conference standings", icon: ListOrdered },
          { href: "/conference-race", label: isZh ? "分区冲刺" : "Conference Race", description: isZh ? "季后赛种子争夺" : "Playoff seeding race", icon: Users },
          { href: "/streaks", label: isZh ? "连胜连败" : "Streaks", description: isZh ? "正在燃烧或冷却的球队" : "Hot and cold teams", icon: Activity },
          { href: "/clutch-teams", label: isZh ? "关键时刻" : "Clutch Teams", description: isZh ? "焦点战与加时赛战绩" : "Close-game and OT records", icon: Repeat },
          { href: "/power-rankings", label: isZh ? "实力榜" : "Power Rankings", description: isZh ? "联盟实力排序" : "League-wide strength ranking", icon: TrendingUp },
        ]}
      />
    </div>
  );
}

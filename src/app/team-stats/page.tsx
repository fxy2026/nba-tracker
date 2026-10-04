import type { Metadata } from "next";
import Link from "next/link";
import { RECORDED_TRAJECTORY_SEASON, trajectorySeason, trajectoryFinals, trajectoryCoverage } from "@/lib/trajectory-season";
import { BarChart3, TrendingUp, Crown, ListOrdered, MapPin, Activity, Users } from "lucide-react";
import { getCurrentSeasonSchedule, getRecorded2025SeasonSchedule, getScheduleAge } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import { CURRENT_SEASON } from "@/lib/constants";
import { computeStandingsRows } from "@/lib/standings-splits";
import { buildScheduleBoards } from "@/lib/team-stat-board";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";
import TeamStatBoards from "./TeamStatBoards";

type PageProps = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const selection = trajectorySeason((await searchParams)?.season);
  return {
    title: isZh ? "球队数据榜" : "Team Stat Rankings",
    description: selection.archive
      ? (isZh ? "NBA 2025-26 已记录赛季球队榜：仅提供本地常规赛终场比分计算的得分、失分和净胜分。" : "NBA 2025-26 recorded team rankings: points, points allowed, and point differential from local regular-season final scores only.")
      : isZh
      ? `NBA ${CURRENT_SEASON} 赛季球队数据榜 — 30 队的得分、失分、净胜分、命中率、三分、篮板、助攻、失误、抢断、盖帽全榜排名。`
      : `NBA ${CURRENT_SEASON} team stat rankings — all 30 teams ranked by points, points allowed, point diff, FG%, 3P%, rebounds, assists, turnovers, steals, and blocks.`,
  };
}

export default async function TeamStatsPage({ searchParams }: PageProps) {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const selection = trajectorySeason((await searchParams)?.season);
  const schedule = selection.archive
    ? trajectoryFinals(getRecorded2025SeasonSchedule(), selection.season)
    : await getCurrentSeasonSchedule().catch(() => []);
  const coverage = trajectoryCoverage(schedule);
  const scheduleBoards = buildScheduleBoards(computeStandingsRows(schedule));

  const breadcrumbs = (
    <Breadcrumbs
      items={[
        { label: isZh ? "数据" : "Stats", href: "/stats" },
        { label: isZh ? "球队榜" : "Team Rankings" },
      ]}
    />
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {breadcrumbs}
      <PageHeader
        eyebrow={isZh ? "球队" : "Teams"}
        icon={BarChart3}
        title={isZh ? "球队数据榜" : "Team Stat Rankings"}
        subtitle={
          selection.archive
            ? (isZh ? "3 项终场比分榜 · 常规赛场均" : "3 final-score boards · regular-season averages")
            : isZh
            ? "11 项类别 · 30 队全榜 · 含联盟平均线与榜首标记"
            : "11 categories · all 30 teams ranked · with league-average marker"
        }
        action={<span className="chip font-mono">{selection.season} {isZh ? "常规赛" : "Regular Season"}</span>}
        updatedAt={selection.archive ? undefined : getScheduleAge()}
      />

      <section aria-label={isZh ? "赛季与数据来源" : "Season and data source"} className="mb-5 space-y-3">
        <nav aria-label={isZh ? "选择赛季" : "Choose season"} className="flex flex-wrap gap-2">
          <Link href="/team-stats" prefetch={false} aria-current={!selection.archive ? "page" : undefined}
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-sm aria-[current=page]:bg-accent/10 aria-[current=page]:text-accent">
            {selection.current} · {isZh ? "当前赛季" : "Current season"}
          </Link>
          {selection.current !== RECORDED_TRAJECTORY_SEASON && <Link href={`/team-stats?season=${RECORDED_TRAJECTORY_SEASON}`} prefetch={false} aria-current={selection.archive ? "page" : undefined}
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-sm aria-[current=page]:bg-accent/10 aria-[current=page]:text-accent">
            {RECORDED_TRAJECTORY_SEASON} · {isZh ? "已记录赛季" : "Recorded season"}
          </Link>}
        </nav>
        {selection.invalid && <p className="text-sm text-text-secondary">{isZh ? "赛季参数无效或重复，已显示当前赛季。" : "Invalid or repeated season selection; showing the current season."}</p>}
        {selection.archive && <div className="space-y-2 text-sm text-text-secondary leading-relaxed">
          <p className="tabular-nums">{isZh
            ? `${coverage.finals.toLocaleString("en-US")} 场终场记录 · ${coverage.teams} 支球队 · 每队 ${coverage.min === coverage.max ? coverage.max : `${coverage.min}–${coverage.max}`} 场`
            : `${coverage.finals.toLocaleString("en-US")} recorded finals · ${coverage.teams} teams · ${coverage.min === coverage.max ? coverage.max : `${coverage.min}–${coverage.max}`} games per team`}</p>
          <p>{isZh ? "仅提供得分、失分和净胜分。" : "Points, points allowed, and point differential only."}</p>
          <details>
            <summary className="min-h-11 cursor-pointer py-3">{isZh ? "数据来源与限制" : "Source and limits"}</summary>
            <div className="space-y-2 pb-3">
              <p>{isZh ? `${selection.season} · 本地存档中的常规赛终场记录，并非实时或近期核验的数据。` : `${selection.season} · Recorded regular-season finals from the local archive, not live or recently verified data.`}</p>
              <p>{isZh ? "存档比分无法计算命中率、篮板、助攻、失误、抢断和盖帽。球队详情与下方链接显示各自页面的当前数据。" : "Final scores cannot provide shooting percentages, rebounds, assists, turnovers, steals, or blocks. Team details and related links use their own current data."}</p>
            </div>
          </details>
        </div>}
      </section>

      {scheduleBoards.PTS.length > 0 ? <TeamStatBoards key={selection.season} scheduleBoards={scheduleBoards} recorded={selection.archive} /> : <EmptyState
        icon={BarChart3}
        title={isZh ? "暂无数据" : "No data yet"}
        description={isZh ? "记录已结束比赛后，球队数据榜会显示在这里。" : "Team stat boards will populate once finished games are recorded."}
      />}

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/scoring-output", label: isZh ? "攻防输出" : "Scoring Output", description: isZh ? "进攻、防守与净胜分总览" : "Offense, defense, and net in one view", icon: TrendingUp },
          { href: "/power-rankings", label: isZh ? "战力榜" : "Power Rankings", description: isZh ? "联盟实力排序" : "League-wide strength ranking", icon: Crown },
          { href: "/standings", label: isZh ? "战绩榜" : "Standings", description: isZh ? "东西部战绩与分区拆分" : "Conference records with splits", icon: ListOrdered },
          { href: "/stats", label: isZh ? "球员排行榜" : "Player Leaders", description: isZh ? "联盟球员数据榜" : "League player leaderboards", icon: Users },
          { href: "/home-vs-road", label: isZh ? "主客场分别" : "Home vs Road", description: isZh ? "主场堡垒和客场战士" : "Fortresses and road warriors", icon: MapPin },
          { href: "/momentum", label: isZh ? "势头" : "Momentum", description: isZh ? "上升与下降的球队" : "Rising and falling teams", icon: Activity },
        ]}
      />
    </div>
  );
}

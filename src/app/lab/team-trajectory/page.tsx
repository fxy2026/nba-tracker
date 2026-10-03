import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { LineChart, TrendingUp, BarChart3, Trophy, Activity } from "lucide-react";
import { getCurrentSeasonSchedule, getRecorded2025SeasonSchedule, getScheduleAge } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import { computeTrajectories, maxGamesPlayed } from "@/lib/team-trajectory";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";
import EmptyState from "@/components/EmptyState";
import UpdatedPill from "@/components/UpdatedPill";
import { RECORDED_TRAJECTORY_SEASON, trajectorySeason, trajectoryFinals, trajectoryCoverage } from "@/lib/trajectory-season";

const ChartPlaceholder = () => (
  <div className="h-96 bg-bg-card rounded-xl skeleton-shimmer" />
);
const TrajectoryChart = dynamic(() => import("./TrajectoryChart"), {
  loading: ChartPlaceholder,
});

export async function generateMetadata(): Promise<Metadata> {
  const isZh = (await getLocale()) === "zh";
  return {
    title: isZh ? "球队赛季轨迹" : "Team Season Trajectory",
    description: isZh
      ? "逐场绘制全联盟 30 支球队的累计胜率与净胜分轨迹，看谁在爬升、谁在滑落。"
      : "Per-game cumulative win % and point-differential trajectory for all 30 NBA teams — see who is climbing and who is sliding.",
  };
}

export default async function TeamTrajectoryPage({ searchParams }: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const isZh = (await getLocale()) === "zh";
  const selection = trajectorySeason((await searchParams)?.season);
  const schedule = trajectoryFinals(selection.archive
    ? getRecorded2025SeasonSchedule()
    : await getCurrentSeasonSchedule(selection.current).catch(() => []), selection.season);
  const coverage = trajectoryCoverage(schedule);
  const gamesRange = coverage.min === coverage.max ? `${coverage.max}` : `${coverage.min}–${coverage.max}`;
  const trajectories = computeTrajectories(schedule);
  const maxGames = maxGamesPlayed(trajectories);

  const hasData = maxGames > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Breadcrumbs
        items={[
          { label: isZh ? "数据实验室" : "Data Lab", href: "/lab" },
          { label: isZh ? "球队赛季轨迹" : "Team Season Trajectory" },
        ]}
      />

      <PageHeader
        eyebrow={isZh ? "数据实验室" : "Data Lab"}
        icon={LineChart}
        title={isZh ? "球队赛季轨迹" : "Team Season Trajectory"}
        subtitle={
          isZh
            ? "把 30 支球队逐场叠在一张图上，追踪累计胜率与净胜分的走势"
            : "All 30 teams on one chart — track each club's running win % and point differential, game by game"
        }
      />

      <section aria-label={isZh ? "赛季与数据来源" : "Season and data source"} className="mb-5 space-y-3">
        <nav aria-label={isZh ? "选择赛季" : "Choose season"} className="flex flex-wrap gap-2">
          <Link href="/lab/team-trajectory" prefetch={false} aria-current={!selection.archive ? "page" : undefined}
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-sm aria-[current=page]:bg-accent/10 aria-[current=page]:text-accent">
            {selection.current} · {isZh ? "当前赛季" : "Current season"}
          </Link>
          {selection.current !== RECORDED_TRAJECTORY_SEASON && (
            <Link href={`/lab/team-trajectory?season=${RECORDED_TRAJECTORY_SEASON}`} prefetch={false} aria-current={selection.archive ? "page" : undefined}
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-sm aria-[current=page]:bg-accent/10 aria-[current=page]:text-accent">
              {RECORDED_TRAJECTORY_SEASON} · {isZh ? "已记录赛季" : "Recorded season"}
            </Link>
          )}
        </nav>
        {selection.invalid && <p className="text-sm text-text-secondary">{isZh ? "赛季参数无效或重复，已显示当前赛季。" : "Invalid or repeated season selection; showing the current season."}</p>}
        <p className="text-sm text-text-secondary leading-relaxed">
          {selection.archive
            ? (isZh ? `${selection.season} · 本地存档中的常规赛终场记录，并非实时或近期核验的数据。` : `${selection.season} · Recorded regular-season finals from the local archive, not live or recently verified data.`)
            : (isZh ? `${selection.season} · 当前赛程缓存中的常规赛终场记录。` : `${selection.season} · Recorded regular-season finals from the current schedule cache.`)}
        </p>
        {hasData && <p className="text-sm text-text-secondary tabular-nums">
          {isZh
            ? `${coverage.finals.toLocaleString("en-US")} 场终场记录 · ${coverage.teams} 支球队 · 每支有记录球队 ${gamesRange} 场 · UTC ${coverage.first} 至 ${coverage.last}`
            : `${coverage.finals.toLocaleString("en-US")} recorded finals · ${coverage.teams} teams · ${gamesRange} games per represented team · UTC ${coverage.first} to ${coverage.last}`}
        </p>}
        {!selection.archive && <UpdatedPill ageMs={getScheduleAge()} meaning="cache" />}
      </section>

      {hasData ? (
        <>
          <details className="mb-4 text-sm text-text-secondary">
            <summary className="min-h-11 cursor-pointer py-3">{isZh ? "使用说明" : "How to use"}</summary>
            <p className="pb-3 leading-relaxed max-w-3xl">{isZh
              ? "按比赛时间顺序累计战绩与净胜分。点击图例中的球队可高亮它的曲线；切换胜率与累计净胜分，或筛选东部和西部。仅包含所选赛季已记录的常规赛终场结果。"
              : "Results accumulate in game-time order. Select a team in the legend to spotlight its line; switch between win % and cumulative point differential, or filter by conference. Only recorded regular-season finals from the selected season are included."}</p>
          </details>
          <TrajectoryChart trajectories={trajectories} maxGames={maxGames} />
        </>
      ) : (
        <EmptyState
          icon={LineChart}
          title={isZh ? "暂无数据" : "No data yet"}
          description={
            isZh
              ? `${selection.season} 赛季暂无可用的常规赛终场记录。`
              : `No recorded regular-season finals are currently available for ${selection.season}.`
          }
        />
      )}

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          {
            href: "/standings",
            label: isZh ? "积分榜" : "Standings",
            description: isZh ? "东西部完整排名" : "Full East & West standings",
            icon: BarChart3,
          },
          {
            href: "/power-rankings",
            label: isZh ? "实力榜" : "Power Rankings",
            description: isZh ? "联盟实力排序" : "League-wide strength ranking",
            icon: TrendingUp,
          },
          {
            href: "/momentum",
            label: isZh ? "势头" : "Momentum",
            description: isZh ? "上升与下降的球队" : "Rising and falling teams",
            icon: Activity,
          },
          {
            href: "/scoring-output",
            label: isZh ? "攻防输出" : "Scoring Output",
            description: isZh ? "每场净得分差" : "Net point differential per game",
            icon: TrendingUp,
          },
          {
            href: "/best-games",
            label: isZh ? "最佳比赛" : "Best Games",
            description: isZh ? "本赛季最精彩对决" : "Season's standout matchups",
            icon: Trophy,
          },
          {
            href: "/lab",
            label: isZh ? "数据实验室" : "Data Lab",
            description: isZh ? "更多交互式数据工具" : "More interactive data tools",
            icon: LineChart,
          },
        ]}
      />
    </div>
  );
}

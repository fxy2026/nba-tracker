import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { LineChart, TrendingUp, BarChart3, Trophy, Activity } from "lucide-react";
import { getFullSchedule, getScheduleAge } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import { computeTrajectories, maxGamesPlayed } from "@/lib/team-trajectory";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";
import EmptyState from "@/components/EmptyState";

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

export default async function TeamTrajectoryPage() {
  const isZh = (await getLocale()) === "zh";
  const schedule = await getFullSchedule().catch(() => []);
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
        updatedAt={getScheduleAge()}
      />

      <p className="text-sm text-text-secondary leading-relaxed mb-5 max-w-3xl text-pretty">
        {isZh
          ? "按比赛时间顺序遍历每一场已结束的常规赛，逐场累计每支球队的战绩与净胜分。点击下方图例中的球队可高亮它的曲线、淡化其余球队；切换指标在胜率与累计净胜分之间切换；分区筛选只看东部或西部。数据全部来自赛程缓存，无需额外请求。"
          : "Walking every finished regular-season game in chronological order, this builds each team's running record and point differential one game at a time. Click a team in the legend to spotlight its line and fade the rest; toggle between win % and cumulative point differential; filter to one conference. Everything is computed from the schedule cache — no extra fetch."}
      </p>

      {hasData ? (
        <TrajectoryChart trajectories={trajectories} maxGames={maxGames} />
      ) : (
        <EmptyState
          icon={LineChart}
          title={isZh ? "暂无数据" : "No data yet"}
          description={
            isZh
              ? "等常规赛打响、有已结束的比赛后，轨迹图就会出现在这里。"
              : "Once the regular season tips off and finished games are recorded, the trajectory chart appears here."
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

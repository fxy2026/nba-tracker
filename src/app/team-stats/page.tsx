import type { Metadata } from "next";
import { BarChart3, TrendingUp, Crown, ListOrdered, MapPin, Activity, Users } from "lucide-react";
import { getFullSchedule, getScheduleAge } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import { CURRENT_SEASON } from "@/lib/constants";
import { computeStandingsRows } from "@/lib/standings-splits";
import { buildScheduleBoards } from "@/lib/team-stat-board";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";
import TeamStatBoards from "./TeamStatBoards";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const isZh = locale === "zh";
  return {
    title: isZh ? "球队数据榜" : "Team Stat Rankings",
    description: isZh
      ? `NBA ${CURRENT_SEASON} 赛季球队数据榜 — 30 队的得分、失分、净胜分、命中率、三分、篮板、助攻、失误、抢断、盖帽全榜排名。`
      : `NBA ${CURRENT_SEASON} team stat rankings — all 30 teams ranked by points, points allowed, point diff, FG%, 3P%, rebounds, assists, turnovers, steals, and blocks.`,
  };
}

export default async function TeamStatsPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const schedule = await getFullSchedule().catch(() => []);
  const scheduleBoards = buildScheduleBoards(computeStandingsRows(schedule));

  const breadcrumbs = (
    <Breadcrumbs
      items={[
        { label: isZh ? "数据" : "Stats", href: "/stats" },
        { label: isZh ? "球队榜" : "Team Rankings" },
      ]}
    />
  );

  if (scheduleBoards.PTS.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        {breadcrumbs}
        <PageHeader eyebrow={isZh ? "球队" : "Teams"} icon={BarChart3} title={isZh ? "球队数据榜" : "Team Stat Rankings"} />
        <EmptyState
          icon={BarChart3}
          title={isZh ? "暂无数据" : "No data yet"}
          description={
            isZh
              ? "记录已结束比赛后，球队数据榜会显示在这里。"
              : "Team stat boards will populate once finished games are recorded."
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {breadcrumbs}
      <PageHeader
        eyebrow={isZh ? "球队" : "Teams"}
        icon={BarChart3}
        title={isZh ? "球队数据榜" : "Team Stat Rankings"}
        subtitle={
          isZh
            ? "11 项类别 · 30 队全榜 · 含联盟平均线与榜首标记"
            : "11 categories · all 30 teams ranked · with league-average marker"
        }
        action={<span className="chip font-mono">{CURRENT_SEASON} {isZh ? "常规赛" : "Regular Season"}</span>}
        updatedAt={getScheduleAge()}
      />

      <TeamStatBoards scheduleBoards={scheduleBoards} />

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

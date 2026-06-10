import type { Metadata } from "next";
import { ScatterChart, BarChart3, Crown, Activity, Target, Users } from "lucide-react";
import { getLocale } from "@/lib/locale";
import { CURRENT_SEASON } from "@/lib/constants";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";
import ScatterExplorer from "./ScatterExplorer";

export async function generateMetadata(): Promise<Metadata> {
  const isZh = (await getLocale()) === "zh";
  return {
    title: isZh ? "全联盟散点探索器" : "League Scatter Explorer",
    description: isZh
      ? "在两两数据维度上散点对比全联盟每位合格球员 — 自选 X/Y 轴（得分、篮板、助攻、命中率、真实命中率等），球队配色，悬停看详情。"
      : "Plot every qualified player across any two stat dimensions — pick X/Y axes (points, rebounds, assists, shooting %, true shooting and more), team-colored dots, hover for details.",
  };
}

export default async function ExplorePage() {
  const isZh = (await getLocale()) === "zh";

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Breadcrumbs
        items={[
          { label: isZh ? "数据实验室" : "Data Lab", href: "/lab" },
          { label: isZh ? "全联盟散点探索器" : "League Scatter Explorer" },
        ]}
      />
      <PageHeader
        eyebrow={isZh ? "数据实验室" : "Data Lab"}
        icon={ScatterChart}
        title={isZh ? "全联盟散点探索器" : "League Scatter Explorer"}
        subtitle={
          isZh
            ? `在任意两个数据维度上散点对比每位合格球员 · ${CURRENT_SEASON} 常规赛 · 自选坐标轴，球队配色，悬停看球员`
            : `Scatter every qualified player across any two stat dimensions · ${CURRENT_SEASON} regular season · pick the axes, team-colored dots, hover for player detail`
        }
      />

      <ScatterExplorer />

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/lab", label: isZh ? "数据实验室" : "Data Lab", description: isZh ? "返回工具总览" : "Back to the tool hub", icon: BarChart3 },
          { href: "/stats", label: isZh ? "数据排行" : "Stat Leaders", description: isZh ? "现役球员本赛季排行" : "Active per-game leaders this season", icon: Crown },
          { href: "/scoring-output", label: isZh ? "攻防输出" : "Scoring Output", description: isZh ? "球队进攻与防守每场净得分" : "Team offense, defense and net rating", icon: Activity },
          { href: "/team-stats", label: isZh ? "球队数据榜" : "Team Stat Rankings", description: isZh ? "11 项类别 · 30 队全榜" : "11 categories · all 30 teams ranked", icon: Target },
          { href: "/by-position", label: isZh ? "按位置排行" : "Leaders By Position", description: isZh ? "按 G/F/C 划分" : "Top by G/F/C", icon: Users },
        ]}
      />
    </div>
  );
}

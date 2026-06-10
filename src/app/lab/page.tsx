import type { Metadata } from "next";
import Link from "next/link";
import { FlaskConical, LineChart, TrendingUp, Activity, ScatterChart } from "lucide-react";
import { getLocale } from "@/lib/locale";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const isZh = locale === "zh";
  return {
    title: isZh ? "数据实验室" : "Data Lab",
    description: isZh
      ? "NBA 深度数据可视化工具集 —— 球队赛季轨迹、球员生涯弧线与投篮热区演变、单场得分接管曲线、全联盟散点探索器。"
      : "Deep NBA data-visualization tools — team season trajectories, player career arcs with shot-zone evolution, single-game scoring takeover curves, and a league-wide scatter explorer.",
    alternates: { canonical: "/lab" },
  };
}

const TOOLS = [
  {
    href: "/lab/team-trajectory",
    icon: LineChart,
    zh: { label: "球队赛季轨迹", desc: "30 队整赛季的胜率与净胜分走势,一张图看清谁在爬升、谁在崩盘。" },
    en: { label: "Team Season Trajectory", desc: "Every team's win-pct and point-diff arc across the season — see who climbed and who collapsed." },
  },
  {
    href: "/lab/career-arc",
    icon: TrendingUp,
    zh: { label: "球员生涯弧线", desc: "任一球员逐赛季数据走势,加上可拖动的生涯投篮热区演变。" },
    en: { label: "Player Career Arc", desc: "A player's season-by-season trend plus a scrubbable career shot-zone evolution." },
  },
  {
    href: "/lab/game-impact",
    icon: Activity,
    zh: { label: "得分接管曲线", desc: "单场比赛里每位主要得分手的累计得分竞速,看谁在何时接管了比赛。" },
    en: { label: "Game Takeover Curve", desc: "Each scorer's cumulative-points race through a single game — who took over, and when." },
  },
  {
    href: "/lab/explore",
    icon: ScatterChart,
    zh: { label: "全联盟散点探索器", desc: "任选两项数据把全联盟球员打成散点图,自己找效率与产量的规律。" },
    en: { label: "League Scatter Explorer", desc: "Plot every player on any two stats — find the efficiency-vs-volume outliers yourself." },
  },
];

export default async function DataLabPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Breadcrumbs items={[{ label: isZh ? "数据实验室" : "Data Lab" }]} />
      <PageHeader
        eyebrow={isZh ? "深度数据" : "Deep Data"}
        icon={FlaskConical}
        title={isZh ? "数据实验室" : "Data Lab"}
        subtitle={isZh ? "四个交互式深度可视化工具 —— 球队、球员、比赛、全联盟" : "Four interactive deep-viz tools — teams, players, games, the whole league"}
      />

      <div className="grid sm:grid-cols-2 gap-3 mt-2">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const copy = isZh ? tool.zh : tool.en;
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className="glass-tile group p-5 rounded-xl border border-border hover:border-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 text-accent shrink-0">
                  <Icon size={20} />
                </span>
                <h2 className="text-base font-semibold text-text-primary tracking-tight group-hover:text-accent transition-colors">
                  {copy.label}
                </h2>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">{copy.desc}</p>
            </Link>
          );
        })}
      </div>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/stats", label: isZh ? "数据排行" : "Stat Leaders", description: isZh ? "联盟各项数据榜首" : "League leaders by category", icon: TrendingUp },
          { href: "/team-stats", label: isZh ? "球队数据榜" : "Team Stat Rankings", description: isZh ? "11 项类别 · 30 队全榜" : "11 categories · all 30 teams", icon: LineChart },
          { href: "/compare", label: isZh ? "球员对比" : "Compare", description: isZh ? "任意球员并排对比" : "Any players side by side", icon: ScatterChart },
          { href: "/best-of-night", label: isZh ? "今日最佳" : "Player of the Night", description: isZh ? "每个比赛日的十佳表现" : "Top performances per slate", icon: Activity },
        ]}
      />
    </div>
  );
}

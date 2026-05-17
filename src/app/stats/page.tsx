"use client";

import { useState, Suspense, lazy } from "react";
import { BarChart3, Users, Trophy, Crown, Medal, Award, TrendingUp, Target } from "lucide-react";
import { CURRENT_SEASON } from "@/lib/constants";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";
import { useLocale } from "@/components/LocaleProvider";

const PlayerLeaders = lazy(() => import("@/components/stats/PlayerLeaders"));
const TeamStandings = lazy(() => import("@/components/stats/TeamStandings"));
const AwardsSection = lazy(() => import("@/components/stats/AwardsSection"));
const MvpLadder = lazy(() => import("@/components/stats/MvpLadder"));

type Tab = "players" | "teams" | "awards" | "mvp";

function TabSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-12 bg-bg-card rounded-lg skeleton-shimmer" />
      ))}
    </div>
  );
}

const TABS = [
  { key: "players" as Tab, label: "Player Leaders", icon: Users },
  { key: "teams" as Tab, label: "Team Standings", icon: BarChart3 },
  { key: "awards" as Tab, label: "Awards", icon: Trophy },
  { key: "mvp" as Tab, label: "MVP Ladder", icon: Medal },
] as const;

export default function StatsPage() {
  const [tab, setTab] = useState<Tab>("players");
  const { locale } = useLocale();
  const isZh = locale === "zh";

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Breadcrumbs
        items={[
          { label: isZh ? "数据" : "Stats" },
          { label: isZh ? "排行榜" : "Leaderboards" },
        ]}
      />
      <PageHeader
        eyebrow="League"
        icon={Crown}
        title="Stats & Rankings"
        action={<span className="chip font-mono">{CURRENT_SEASON} Season</span>}
      />
      <div className="flex gap-1 mb-6 glass-tile p-1 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              tab === key ? "bg-accent text-white shadow-md" : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
      <Suspense fallback={<TabSkeleton />}>
        {tab === "players" && <PlayerLeaders />}
        {tab === "teams" && <TeamStandings />}
        {tab === "awards" && <AwardsSection />}
        {tab === "mvp" && <MvpLadder />}
      </Suspense>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/awards-race", label: isZh ? "奖项竞争" : "Awards race", icon: Award },
          { href: "/milestones", label: isZh ? "生涯里程碑" : "Milestones", icon: TrendingUp },
          { href: "/all-time-leaders", label: isZh ? "历史排行" : "All-time leaders", icon: Crown },
          { href: "/by-position", label: isZh ? "按位置" : "By position", icon: Users },
          { href: "/clutch", label: isZh ? "季后赛表现" : "Playoff Performers", icon: Target },
        ]}
      />
    </div>
  );
}

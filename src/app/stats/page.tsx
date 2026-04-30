"use client";

import { useState, Suspense, lazy } from "react";
import { BarChart3, Users, Trophy, Crown, Medal } from "lucide-react";

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Crown size={24} className="text-accent" />
          Stats & Rankings
        </h1>
        <span className="text-[10px] text-text-secondary px-2.5 py-1 rounded-full bg-bg-card border border-border">
          2025-26 Season
        </span>
      </div>
      <div className="flex gap-1 mb-6 bg-bg-card rounded-xl p-1 border border-border w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? "bg-accent text-white" : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
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
    </div>
  );
}

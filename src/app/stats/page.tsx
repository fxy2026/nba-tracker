"use client";

import { useState, Suspense, lazy } from "react";
import { BarChart3, Users, Trophy, Crown } from "lucide-react";

const PlayerLeaders = lazy(() => import("@/components/stats/PlayerLeaders"));
const TeamStandings = lazy(() => import("@/components/stats/TeamStandings"));
const AwardsSection = lazy(() => import("@/components/stats/AwardsSection"));

type Tab = "players" | "teams" | "awards";

function TabSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-12 bg-bg-card rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

export default function StatsPage() {
  const [tab, setTab] = useState<Tab>("players");
  const tabs = [
    { key: "players" as Tab, label: "Player Leaders", icon: Users },
    { key: "teams" as Tab, label: "Team Standings", icon: BarChart3 },
    { key: "awards" as Tab, label: "Awards", icon: Trophy },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-5 flex items-center gap-2">
        <Crown size={24} className="text-accent" />
        Stats & Rankings
      </h1>
      <div className="flex gap-1 mb-6 bg-bg-card rounded-xl p-1 border border-border w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
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
      </Suspense>
    </div>
  );
}

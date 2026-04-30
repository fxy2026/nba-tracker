import type { Metadata } from "next";
import { Search, TrendingUp, Flame } from "lucide-react";
import Link from "next/link";
import SearchInput from "@/components/SearchInput";
import PlayerHeadshot from "@/components/PlayerHeadshot";

export const metadata: Metadata = {
  title: "搜索球员",
  description: "搜索 NBA 球员，查看详细数据和职业生涯信息。",
};

const POPULAR_PLAYERS = [
  { id: 2544, name: "LeBron James", team: "LAL" },
  { id: 201142, name: "Kevin Durant", team: "PHX" },
  { id: 201939, name: "Stephen Curry", team: "GSW" },
  { id: 203507, name: "Giannis Antetokounmpo", team: "MIL" },
  { id: 203954, name: "Joel Embiid", team: "PHI" },
  { id: 1629029, name: "Luka Doncic", team: "DAL" },
  { id: 1628983, name: "Shai Gilgeous-Alexander", team: "OKC" },
  { id: 203999, name: "Nikola Jokic", team: "DEN" },
];

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Search size={24} className="text-accent" />
        Player Search
      </h1>
      <SearchInput initialQuery={q || ""} />

      {/* Quick filters */}
      <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
        {["Guard", "Forward", "Center"].map((pos) => (
          <a
            key={pos}
            href={`/search?q=${pos}`}
            className="text-xs px-3 py-1.5 bg-bg-card border border-border rounded-full hover:border-accent/50 text-text-secondary hover:text-accent transition-colors"
          >
            {pos}
          </a>
        ))}
        <span className="text-border mx-1">|</span>
        {["Lakers", "Celtics", "Warriors", "Nuggets"].map((team) => (
          <a
            key={team}
            href={`/search?q=${team}`}
            className="text-xs px-3 py-1.5 bg-bg-card border border-border rounded-full hover:border-accent/50 text-text-secondary hover:text-accent transition-colors"
          >
            {team}
          </a>
        ))}
      </div>

      {!q && (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Flame size={14} className="text-accent" />
            Popular Players
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {POPULAR_PLAYERS.map((p) => (
              <Link
                key={p.id}
                href={`/player/${p.id}`}
                className="flex items-center gap-2 bg-bg-card border border-border rounded-xl px-3 py-2.5 hover:border-accent/50 transition-colors group"
              >
                <PlayerHeadshot personId={p.id} name={p.name} size={28} />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors truncate block">{p.name}</span>
                  <span className="text-[10px] text-text-secondary">{p.team}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Search Tips */}
      <div className="mt-6 text-center space-y-1">
        <p className="text-xs text-text-secondary">
          Search by player name to view detailed stats and profiles
        </p>
        <p className="text-[10px] text-text-secondary/70">
          Tip: Use <kbd className="px-1 py-0.5 bg-bg-card border border-border rounded text-[10px]">Ctrl+K</kbd> to search from anywhere
        </p>
      </div>
    </div>
  );
}

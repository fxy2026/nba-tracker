"use client";

interface TickerGame {
  gameId: string;
  awayTricode: string;
  homeTricode: string;
  awayScore: number;
  homeScore: number;
  gameStatusText: string;
}

export default function ScoreTicker({ games }: { games: TickerGame[] }) {
  if (games.length === 0) return null;

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden mb-4">
      <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto scrollbar-hide">
        <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-medium mr-1 animate-pulse">
          LIVE
        </span>
        {games.map((g) => (
          <a
            key={g.gameId}
            href={`/game/${g.gameId}`}
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg-secondary hover:bg-bg-hover transition-colors text-xs"
          >
            <span className="font-medium text-text-primary">{g.awayTricode}</span>
            <span className="font-bold text-accent tabular-nums">{g.awayScore}</span>
            <span className="text-text-secondary">-</span>
            <span className="font-bold text-accent tabular-nums">{g.homeScore}</span>
            <span className="font-medium text-text-primary">{g.homeTricode}</span>
            <span className="text-[9px] text-text-secondary ml-0.5">{g.gameStatusText.trim()}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

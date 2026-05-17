import Link from "next/link";
import { Calendar, Trophy } from "lucide-react";
import TeamLogo from "@/components/TeamLogo";
import type { Translations } from "@/locales";

export interface RecentGame {
  gameId: string;
  date: string;
  opponent: string;
  opponentId: number;
  score: string;
  won: boolean;
  home: boolean;
}

export interface UpcomingGame {
  gameId: string;
  date: string;
  opponent: string;
  opponentId: number;
  home: boolean;
}

interface RecentProps {
  mode: "recent";
  t: Translations;
  games: RecentGame[];
}

interface UpcomingProps {
  mode: "upcoming";
  t: Translations;
  games: UpcomingGame[];
  // Pre-computed difficulty badge for the upcoming column. Computed on the
  // server so we don't pass the whole schedule across the boundary.
  difficulty?: { label: string; avgWinPct: number; colorClass: string } | null;
}

type Props = RecentProps | UpcomingProps;

/**
 * Reusable schedule column — recent finished games (with W/L + score) or
 * upcoming scheduled games. The two share the same outer glass-tile chrome
 * and divide-y row treatment; only icon, header, row content, and empty
 * state differ.
 */
export default function TeamScheduleCard(props: Props) {
  if (props.mode === "recent") {
    const { t, games } = props;
    return (
      <div className="glass-tile overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Calendar size={16} className="text-accent" />
          <h2 className="font-semibold text-sm">{t.teamPage.recentGames}</h2>
        </div>
        <div className="divide-y divide-border/50">
          {games.slice(0, 10).map((g) => (
            <Link key={g.gameId} href={`/game/${g.gameId}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-hover transition-colors">
              <span className={`text-xs font-bold w-6 ${g.won ? "text-success" : "text-danger"}`}>
                {g.won ? "W" : "L"}
              </span>
              <TeamLogo teamId={g.opponentId} tricode={g.opponent} size={20} />
              <span className="text-sm text-text-primary flex-1">
                {g.home ? "vs" : "@"} {g.opponent}
              </span>
              <span className="text-sm font-medium font-mono tabular-nums">{g.score}</span>
              <span className="text-xs text-text-secondary">{g.date.slice(5)}</span>
            </Link>
          ))}
          {games.length === 0 && (
            <p className="px-4 py-6 text-center text-text-secondary text-sm">{t.teamPage.noCompletedGames}</p>
          )}
        </div>
      </div>
    );
  }

  // upcoming
  const { t, games, difficulty } = props;
  return (
    <div className="glass-tile overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Trophy size={16} className="text-accent" />
        <h2 className="font-semibold text-sm">{t.teamPage.upcomingGames}</h2>
        {difficulty && (
          <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium ${difficulty.colorClass}`}>
            {difficulty.label} ({(difficulty.avgWinPct * 100).toFixed(0)}% opp W%)
          </span>
        )}
      </div>
      <div className="divide-y divide-border/50">
        {games.slice(0, 8).map((g) => (
          <div key={g.gameId} className="flex items-center gap-3 px-4 py-2.5">
            <span className="text-xs text-text-secondary w-6">{g.home ? "vs" : "@"}</span>
            <TeamLogo teamId={g.opponentId} tricode={g.opponent} size={20} />
            <span className="text-sm text-text-primary flex-1">{g.opponent}</span>
            <span className="text-xs text-text-secondary">{g.date.slice(5)}</span>
          </div>
        ))}
        {games.length === 0 && (
          <p className="px-4 py-6 text-center text-text-secondary text-sm">{t.teamPage.noUpcomingGames}</p>
        )}
      </div>
    </div>
  );
}

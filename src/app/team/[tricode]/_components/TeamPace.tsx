import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Translations } from "@/locales";

interface Props {
  wins: number;
  losses: number;
  w10: number;
  l10: number;
  t: Translations;
}

// "Season pace" projection — wins extrapolated to 82 GP at current rate, plus
// a hot-streak adjustment using the last-10 record on the remaining games.
// Hidden when sample is too small (< 10 GP) to avoid noise early in the season.
export default function TeamPace({ wins, losses, w10, l10, t }: Props) {
  const gp = wins + losses;
  if (gp < 10) return null;

  const winRate = wins / gp;
  const projected = Math.round(winRate * 82);

  // Last-10 rate applied to remaining games — what the season looks like
  // if recent form holds. Useful contrast to the season-long projection.
  const remaining = Math.max(82 - gp, 0);
  const recentRate = w10 + l10 > 0 ? w10 / (w10 + l10) : winRate;
  const trendProjected = Math.round(wins + recentRate * remaining);
  const delta = trendProjected - projected;

  const Icon = delta > 2 ? TrendingUp : delta < -2 ? TrendingDown : Minus;
  const trendTone =
    delta > 2 ? "text-success" : delta < -2 ? "text-danger" : "text-text-secondary";

  return (
    <div className="glass-tile p-4 mt-4 flex items-center flex-wrap gap-x-6 gap-y-2">
      <div>
        <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary/60">/ {t.teamPage.seasonPace}</p>
        <p className="text-text-primary mt-1">
          <span className="text-2xl font-light font-mono tabular-nums">{projected}</span>
          <span className="text-sm text-text-secondary ml-1.5">{t.teamPage.projectedWins}</span>
        </p>
      </div>
      <div className="h-10 w-px bg-border hidden sm:block" />
      <div className={`flex items-center gap-2 ${trendTone}`}>
        <Icon size={16} />
        <div className="text-xs">
          <p className="font-mono tabular-nums">
            {trendProjected}
            <span className="text-text-secondary ml-1">{t.teamPage.ifRecentFormHolds}</span>
          </p>
          {remaining > 0 && (
            <p className="text-[10px] text-text-secondary mt-0.5">
              {remaining} {t.teamPage.gamesRemaining}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

import type { Translations } from "@/locales";
import type { RecentGame } from "./TeamScheduleCard";

/**
 * Last-N (up to 10) games as a row of colored W/L pills, oldest-first.
 * Renders nothing when there are no completed games.
 */
export default function Last10Streak({ recentGames, t }: { recentGames: RecentGame[]; t: Translations }) {
  if (recentGames.length === 0) return null;
  return (
    <div className="glass-tile p-4 mt-6">
      <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3">{t.teamPage.lastNGames.replace("%s", String(Math.min(recentGames.length, 10)))}</h3>
      <div className="flex items-center gap-1">
        {recentGames.slice(0, 10).reverse().map((g, i) => (
          <div key={i} className={`flex-1 h-8 rounded flex items-center justify-center text-xs font-bold text-white ${g.won ? "bg-success" : "bg-danger"}`}>
            {g.won ? "W" : "L"}
          </div>
        ))}
      </div>
    </div>
  );
}

import type { BoxScoreTeam } from "@/lib/api";
import type { Translations } from "@/locales";

// Hollinger-ish Game Score, ranked across both rosters (top 5)
export default function GameLeaders({ homeTeam, awayTeam, t }: { homeTeam: BoxScoreTeam; awayTeam: BoxScoreTeam; t: Translations }) {
  const allPlayedPlayers = [
    ...awayTeam.players.filter((p) => p.played === "1").map((p) => ({ ...p, teamTricode: awayTeam.teamTricode })),
    ...homeTeam.players.filter((p) => p.played === "1").map((p) => ({ ...p, teamTricode: homeTeam.teamTricode })),
  ];
  const scored = allPlayedPlayers
    .map((p) => {
      const s = p.statistics;
      const gameScore =
        s.points +
        0.4 * s.fieldGoalsMade -
        0.7 * s.fieldGoalsAttempted +
        0.3 * s.freeThrowsMade +
        s.reboundsTotal +
        s.steals +
        s.blocks -
        0.7 * s.turnovers;
      return { name: p.nameI, teamTricode: p.teamTricode, gameScore: Math.round(gameScore * 10) / 10 };
    })
    .sort((a, b) => b.gameScore - a.gameScore)
    .slice(0, 5);

  if (scored.length === 0) return null;
  return (
    <div className="glass-tile p-4 mt-4">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <span className="w-1 h-4 bg-accent rounded-full" />
        {t.gameDetail.playerRatings}
      </h3>
      <div className="space-y-2">
        {scored.map((p, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 bg-bg-secondary rounded-lg">
            <span className={`text-sm font-bold w-6 text-center ${i === 0 ? "text-accent" : "text-text-secondary"}`}>#{i + 1}</span>
            <span className="text-sm font-medium text-text-primary flex-1">{p.name}</span>
            <span className="text-[10px] text-text-secondary">{p.teamTricode}</span>
            <span className={`text-sm font-bold font-mono tabular-nums ${i === 0 ? "text-accent" : "text-text-primary"}`}>{p.gameScore}</span>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-text-secondary mt-2">Game Score = PTS + 0.4*FG - 0.7*FGA + 0.3*FT + REB + STL + BLK - 0.7*TO</p>
    </div>
  );
}

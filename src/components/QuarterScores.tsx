import type { PeriodScore } from "@/lib/api";
import TeamLogo from "./TeamLogo";

interface Props {
  homeTeam: { teamId: number; teamTricode: string; teamCity: string; teamName: string; score: number; periods: PeriodScore[] };
  awayTeam: { teamId: number; teamTricode: string; teamCity: string; teamName: string; score: number; periods: PeriodScore[] };
}

export default function QuarterScores({ homeTeam, awayTeam }: Props) {
  const periods = Math.max(homeTeam.periods.length, awayTeam.periods.length);
  if (periods === 0) return null;

  // Compute halftime scores
  const homeHalf = homeTeam.periods.slice(0, 2).reduce((s, p) => s + p.score, 0);
  const awayHalf = awayTeam.periods.slice(0, 2).reduce((s, p) => s + p.score, 0);
  const showHalftime = periods >= 4;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-text-secondary text-xs">
            <th className="text-left py-2.5 px-3 font-medium min-w-[140px]">Team</th>
            {homeTeam.periods.map((p, i) => (
              <th key={i} className="text-center py-2.5 px-2 font-medium w-12">
                {p.periodType === "OVERTIME" ? `OT${p.period - 4}` : `Q${p.period}`}
              </th>
            ))}
            <th className="text-center py-2.5 px-3 font-bold w-14">Total</th>
          </tr>
        </thead>
        <tbody>
          {/* Away team */}
          <tr className="border-b border-border/30 hover:bg-bg-hover/30">
            <td className="py-2.5 px-3">
              <div className="flex items-center gap-2">
                <TeamLogo teamId={awayTeam.teamId} tricode={awayTeam.teamTricode} size={20} />
                <span className="font-medium text-sm">{awayTeam.teamTricode}</span>
              </div>
            </td>
            {awayTeam.periods.map((p, i) => {
              const homeQ = homeTeam.periods[i]?.score || 0;
              const won = p.score > homeQ;
              return (
                <td key={i} className={`text-center py-2.5 px-2 tabular-nums ${won ? "text-text-primary font-semibold" : "text-text-secondary"}`}>
                  {p.score}
                </td>
              );
            })}
            <td className={`text-center py-2.5 px-3 tabular-nums font-bold ${awayTeam.score > homeTeam.score ? "text-accent" : ""}`}>
              {awayTeam.score}
            </td>
          </tr>

          {/* Home team */}
          <tr className="hover:bg-bg-hover/30">
            <td className="py-2.5 px-3">
              <div className="flex items-center gap-2">
                <TeamLogo teamId={homeTeam.teamId} tricode={homeTeam.teamTricode} size={20} />
                <span className="font-medium text-sm">{homeTeam.teamTricode}</span>
              </div>
            </td>
            {homeTeam.periods.map((p, i) => {
              const awayQ = awayTeam.periods[i]?.score || 0;
              const won = p.score > awayQ;
              return (
                <td key={i} className={`text-center py-2.5 px-2 tabular-nums ${won ? "text-text-primary font-semibold" : "text-text-secondary"}`}>
                  {p.score}
                </td>
              );
            })}
            <td className={`text-center py-2.5 px-3 tabular-nums font-bold ${homeTeam.score > awayTeam.score ? "text-accent" : ""}`}>
              {homeTeam.score}
            </td>
          </tr>
        </tbody>
      </table>
      {/* Halftime score */}
      {showHalftime && (
        <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-text-secondary">
          <span>Halftime: {awayTeam.teamTricode} {awayHalf} - {homeHalf} {homeTeam.teamTricode}</span>
        </div>
      )}
    </div>
  );
}

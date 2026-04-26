import type { ScheduleGame } from "@/lib/api";
import TeamLogo from "./TeamLogo";

interface Props {
  games: ScheduleGame[];
}

interface Series {
  team1: { tricode: string; teamId: number; teamCity: string; teamName: string; wins: number; seed: number };
  team2: { tricode: string; teamId: number; teamCity: string; teamName: string; wins: number; seed: number };
  games: number;
}

export default function PlayoffsBracket({ games }: Props) {
  // Group by series (same two teams)
  const seriesMap = new Map<string, Series>();

  for (const g of games) {
    const codes = [g.homeTeam.teamTricode, g.awayTeam.teamTricode].sort();
    const key = codes.join("-");

    if (!seriesMap.has(key)) {
      seriesMap.set(key, {
        team1: { tricode: codes[0], teamId: 0, teamCity: "", teamName: "", wins: 0, seed: 0 },
        team2: { tricode: codes[1], teamId: 0, teamCity: "", teamName: "", wins: 0, seed: 0 },
        games: 0,
      });
    }

    const series = seriesMap.get(key)!;
    series.games++;

    // Determine winner
    const homeWon = g.homeTeam.score > g.awayTeam.score;
    const winner = homeWon ? g.homeTeam : g.awayTeam;

    if (winner.teamTricode === codes[0]) {
      series.team1.wins++;
      series.team1.teamId = winner.teamId;
      series.team1.teamCity = winner.teamCity;
      series.team1.teamName = winner.teamName;
      series.team1.seed = winner.seed;
    } else {
      series.team2.wins++;
      series.team2.teamId = winner.teamId;
      series.team2.teamCity = winner.teamCity;
      series.team2.teamName = winner.teamName;
      series.team2.seed = winner.seed;
    }

    // Fill in info for the other team too
    const loser = homeWon ? g.awayTeam : g.homeTeam;
    if (loser.teamTricode === codes[0] && !series.team1.teamId) {
      series.team1.teamId = loser.teamId;
      series.team1.teamCity = loser.teamCity;
      series.team1.teamName = loser.teamName;
      series.team1.seed = loser.seed;
    } else if (loser.teamTricode === codes[1] && !series.team2.teamId) {
      series.team2.teamId = loser.teamId;
      series.team2.teamCity = loser.teamCity;
      series.team2.teamName = loser.teamName;
      series.team2.seed = loser.seed;
    }
  }

  const seriesList = [...seriesMap.values()].sort((a, b) => b.games - a.games);

  if (seriesList.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span className="w-1 h-5 bg-accent rounded-full" />
        Playoff Series
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {seriesList.map((s) => {
          const t1Leading = s.team1.wins > s.team2.wins;
          const t2Leading = s.team2.wins > s.team1.wins;
          const finished = s.team1.wins === 4 || s.team2.wins === 4;
          return (
            <div
              key={`${s.team1.tricode}-${s.team2.tricode}`}
              className={`bg-bg-card rounded-xl border p-3 ${finished ? "border-accent/30" : "border-border"}`}
            >
              {/* Team 1 */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TeamLogo teamId={s.team1.teamId} tricode={s.team1.tricode} size={24} />
                  <div>
                    <span className={`text-sm font-medium ${t1Leading ? "text-text-primary" : "text-text-secondary"}`}>
                      {s.team1.tricode}
                    </span>
                    {s.team1.seed > 0 && (
                      <span className="text-xs text-text-secondary ml-1">#{s.team1.seed}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 4 }, (_, i) => (
                    <div
                      key={i}
                      className={`w-2.5 h-2.5 rounded-full ${
                        i < s.team1.wins ? "bg-accent" : "bg-bg-hover"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Team 2 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TeamLogo teamId={s.team2.teamId} tricode={s.team2.tricode} size={24} />
                  <div>
                    <span className={`text-sm font-medium ${t2Leading ? "text-text-primary" : "text-text-secondary"}`}>
                      {s.team2.tricode}
                    </span>
                    {s.team2.seed > 0 && (
                      <span className="text-xs text-text-secondary ml-1">#{s.team2.seed}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 4 }, (_, i) => (
                    <div
                      key={i}
                      className={`w-2.5 h-2.5 rounded-full ${
                        i < s.team2.wins ? "bg-accent" : "bg-bg-hover"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="mt-2 pt-2 border-t border-border/50 text-center">
                <span className="text-xs text-text-secondary">
                  {finished
                    ? `${t1Leading ? s.team1.tricode : s.team2.tricode} wins ${Math.max(s.team1.wins, s.team2.wins)}-${Math.min(s.team1.wins, s.team2.wins)}`
                    : `${t1Leading ? s.team1.tricode : t2Leading ? s.team2.tricode : "Tied"} ${t1Leading || t2Leading ? `leads ${Math.max(s.team1.wins, s.team2.wins)}-${Math.min(s.team1.wins, s.team2.wins)}` : `${s.team1.wins}-${s.team2.wins}`}`
                  }
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

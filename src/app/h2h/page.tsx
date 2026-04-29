import type { Metadata } from "next";
import { getFullSchedule, formatDate } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import TeamLogo from "@/components/TeamLogo";
import Link from "next/link";
import { Swords } from "lucide-react";

export const metadata: Metadata = {
  title: "Head-to-Head",
  description: "NBA 球队对战记录，赛季交锋历史。",
};

export const revalidate = 600;

interface PageProps {
  searchParams: Promise<{ t1?: string; t2?: string }>;
}

export default async function H2HPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const t1 = params.t1?.toUpperCase();
  const t2 = params.t2?.toUpperCase();

  const teams = Object.values(TEAM_META).sort((a, b) => a.city.localeCompare(b.city));

  // If both teams selected, compute h2h data
  let games: { gameId: string; date: string; homeTricode: string; awayTricode: string; homeScore: number; awayScore: number; homeId: number; awayId: number }[] = [];
  let t1Wins = 0, t2Wins = 0;

  if (t1 && t2 && t1 !== t2 && TEAM_META[t1] && TEAM_META[t2]) {
    const schedule = await getFullSchedule().catch(() => []);
    for (const gd of schedule) {
      for (const g of gd.games) {
        if (g.gameStatus !== 3) continue;
        const isMatch =
          (g.homeTeam.teamTricode === t1 && g.awayTeam.teamTricode === t2) ||
          (g.homeTeam.teamTricode === t2 && g.awayTeam.teamTricode === t1);
        if (!isMatch) continue;
        const dateStr = gd.gameDate.split(" ")[0];
        const [month, day, year] = dateStr.split("/");
        games.push({
          gameId: g.gameId,
          date: `${year}-${month}-${day}`,
          homeTricode: g.homeTeam.teamTricode,
          awayTricode: g.awayTeam.teamTricode,
          homeScore: g.homeTeam.score,
          awayScore: g.awayTeam.score,
          homeId: g.homeTeam.teamId,
          awayId: g.awayTeam.teamId,
        });
        if (
          (g.homeTeam.teamTricode === t1 && g.homeTeam.score > g.awayTeam.score) ||
          (g.awayTeam.teamTricode === t1 && g.awayTeam.score > g.homeTeam.score)
        ) {
          t1Wins++;
        } else {
          t2Wins++;
        }
      }
    }
    games.sort((a, b) => b.date.localeCompare(a.date));
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
        <Swords size={24} className="text-accent" />
        Head-to-Head
      </h1>
      <p className="text-sm text-text-secondary mb-6">Select two teams to see their season matchup history</p>

      {/* Team Selectors */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
        <TeamSelector teams={teams} selected={t1} paramName="t1" other={t2} />
        <span className="text-lg font-bold text-text-secondary">VS</span>
        <TeamSelector teams={teams} selected={t2} paramName="t2" other={t1} />
      </div>

      {/* Results */}
      {t1 && t2 && t1 !== t2 && TEAM_META[t1] && TEAM_META[t2] && (
        <>
          {/* Score Summary */}
          <div className="bg-bg-card rounded-xl border border-border p-6 mb-6">
            <div className="flex items-center justify-center gap-8">
              <div className="flex flex-col items-center gap-2">
                <TeamLogo teamId={TEAM_META[t1].teamId} tricode={t1} size={48} />
                <span className="font-semibold text-sm">{TEAM_META[t1].city} {TEAM_META[t1].name}</span>
                <span className={`text-3xl font-bold ${t1Wins >= t2Wins ? "text-accent" : "text-text-secondary"}`}>{t1Wins}</span>
              </div>
              <div className="text-text-secondary text-xl">-</div>
              <div className="flex flex-col items-center gap-2">
                <TeamLogo teamId={TEAM_META[t2].teamId} tricode={t2} size={48} />
                <span className="font-semibold text-sm">{TEAM_META[t2].city} {TEAM_META[t2].name}</span>
                <span className={`text-3xl font-bold ${t2Wins >= t1Wins ? "text-accent" : "text-text-secondary"}`}>{t2Wins}</span>
              </div>
            </div>
            {/* Win percentage donut */}
            {games.length > 0 && (() => {
              const total = t1Wins + t2Wins;
              const t1Pct = total > 0 ? t1Wins / total : 0.5;
              const circumference = 2 * Math.PI * 30;
              const t1Dash = t1Pct * circumference;
              const t2Dash = (1 - t1Pct) * circumference;
              return (
                <div className="flex justify-center mt-4">
                  <svg width={80} height={80} viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="30" fill="none" stroke="var(--bg-hover)" strokeWidth="8" />
                    <circle cx="40" cy="40" r="30" fill="none" stroke="var(--accent)" strokeWidth="8"
                      strokeDasharray={`${t1Dash} ${t2Dash}`}
                      strokeDashoffset={circumference / 4}
                      strokeLinecap="round"
                    />
                    <text x="40" y="40" textAnchor="middle" dominantBaseline="central" fill="var(--text-primary)" fontSize="11" fontWeight="bold">
                      {(t1Pct * 100).toFixed(0)}%
                    </text>
                  </svg>
                </div>
              );
            })()}
            {games.length === 0 && (
              <p className="text-center text-text-secondary text-sm mt-4">No completed games between these teams this season</p>
            )}
            {games.length > 0 && (() => {
              const t1Total = games.reduce((s, g) => {
                if (g.homeTricode === t1) return s + g.homeScore;
                return s + g.awayScore;
              }, 0);
              const t2Total = games.reduce((s, g) => {
                if (g.homeTricode === t2) return s + g.homeScore;
                return s + g.awayScore;
              }, 0);
              return (
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-center gap-6 text-xs text-text-secondary">
                  <span>Avg Score: {t1} {(t1Total / games.length).toFixed(1)} - {(t2Total / games.length).toFixed(1)} {t2}</span>
                  <span>{games.length} games played</span>
                </div>
              );
            })()}
          </div>

          {/* Game List */}
          {games.length > 0 && (
            <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold">Game Results</h3>
              </div>
              <div className="divide-y divide-border/50">
                {games.map((g) => {
                  const homeWon = g.homeScore > g.awayScore;
                  return (
                    <Link key={g.gameId} href={`/game/${g.gameId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-colors">
                      <span className="text-xs text-text-secondary w-20">{g.date}</span>
                      <div className="flex items-center gap-2 flex-1">
                        <TeamLogo teamId={g.awayId} tricode={g.awayTricode} size={20} />
                        <span className={`text-sm font-medium ${!homeWon ? "text-text-primary" : "text-text-secondary"}`}>{g.awayTricode}</span>
                        <span className={`text-sm font-bold tabular-nums ${!homeWon ? "text-accent" : "text-text-secondary"}`}>{g.awayScore}</span>
                      </div>
                      <span className="text-text-secondary text-xs">@</span>
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <span className={`text-sm font-bold tabular-nums ${homeWon ? "text-accent" : "text-text-secondary"}`}>{g.homeScore}</span>
                        <span className={`text-sm font-medium ${homeWon ? "text-text-primary" : "text-text-secondary"}`}>{g.homeTricode}</span>
                        <TeamLogo teamId={g.homeId} tricode={g.homeTricode} size={20} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TeamSelector({ teams, selected, paramName, other }: {
  teams: { tricode: string; city: string; name: string; teamId: number }[];
  selected?: string; paramName: string; other?: string;
}) {
  return (
    <div className="flex-1 w-full">
      <div className="flex flex-wrap gap-1.5 justify-center">
        {teams.map((t) => {
          const isSelected = selected === t.tricode;
          const otherParam = paramName === "t1" ? "t2" : "t1";
          const href = `/h2h?${paramName}=${t.tricode}${other ? `&${otherParam}=${other}` : ""}`;
          return (
            <Link
              key={t.tricode}
              href={href}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
                isSelected ? "bg-accent/20 text-accent border border-accent/30" : "bg-bg-card border border-border hover:bg-bg-hover text-text-secondary hover:text-text-primary"
              }`}
            >
              <TeamLogo teamId={t.teamId} tricode={t.tricode} size={16} />
              {t.tricode}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

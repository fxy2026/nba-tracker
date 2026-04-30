import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { TEAM_META } from "@/lib/teams";
import ExportStandings from "@/components/ExportStandings";

export const metadata: Metadata = {
  title: "排名",
  description: "NBA 东西部排名、胜率、连胜连败，实时更新。",
};

export const dynamic = "force-dynamic";

interface TeamRecord {
  tricode: string;
  teamId: number;
  teamName: string;
  teamCity: string;
  wins: number;
  losses: number;
}

const EAST_DIVISIONS = ["Atlantic", "Central", "Southeast"] as const;
const WEST_DIVISIONS = ["Northwest", "Pacific", "Southwest"] as const;

async function getStandings(): Promise<TeamRecord[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/standings`, { next: { revalidate: 600 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

function DivisionCard({ division, teams, conferenceRanks, streaks }: {
  division: string;
  teams: TeamRecord[];
  conferenceRanks: Map<string, number>;
  streaks: Map<string, string>;
}) {
  // Sort by win pct within the division
  const sorted = [...teams].sort((a, b) => {
    const wpa = a.wins / (a.wins + a.losses || 1);
    const wpb = b.wins / (b.wins + b.losses || 1);
    return wpb - wpa;
  });

  const leader = sorted[0];
  const leaderWins = leader?.wins || 0;
  const leaderLosses = leader?.losses || 0;

  return (
    <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-bg-secondary/50">
        <h3 className="text-sm font-semibold">{division}</h3>
      </div>
      <div className="divide-y divide-border/30">
        {/* Header row */}
        <div className="grid grid-cols-[auto_1fr_40px_40px_56px_40px] items-center px-4 py-2 text-[10px] uppercase text-text-secondary font-medium">
          <span className="w-5">#</span>
          <span>Team</span>
          <span className="text-center">W</span>
          <span className="text-center">L</span>
          <span className="text-center">PCT</span>
          <span className="text-center">GB</span>
        </div>
        {sorted.map((team, idx) => {
          const winPct = team.wins / (team.wins + team.losses || 1);
          const gb = idx === 0 ? "-" : (((leaderWins - leaderLosses) - (team.wins - team.losses)) / 2).toFixed(1);
          const confRank = conferenceRanks.get(team.tricode) || 99;
          const isPlayoff = confRank <= 6;
          const isPlayIn = confRank >= 7 && confRank <= 10;

          return (
            <Link
              key={team.tricode}
              href={`/team/${team.tricode}`}
              className={`grid grid-cols-[auto_1fr_40px_40px_56px_40px] items-center px-4 py-2.5 hover:bg-bg-hover transition-colors ${
                isPlayoff ? "border-l-2 border-l-accent" : isPlayIn ? "border-l-2 border-l-yellow-500" : "border-l-2 border-l-transparent"
              }`}
            >
              <span className="text-xs text-text-secondary w-5">{idx + 1}</span>
              <div className="flex items-center gap-2.5">
                <Image
                  src={`https://cdn.nba.com/logos/nba/${team.teamId}/global/L/logo.svg`}
                  alt={team.tricode}
                  width={24}
                  height={24}
                  unoptimized
                />
                <div>
                  <span className="text-sm font-medium text-text-primary">{team.teamCity} {team.teamName}</span>
                  {isPlayoff && <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-accent/10 text-accent">Playoff</span>}
                  {isPlayIn && <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-yellow-500/10 text-yellow-500">Play-In</span>}
                  {streaks.get(team.tricode) && (() => {
                    const streak = streaks.get(team.tricode)!;
                    const isWin = streak.startsWith("W");
                    return (
                      <span className={`ml-1 text-[9px] px-1 py-0.5 rounded font-medium ${isWin ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                        {streak}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <span className="text-center text-sm font-medium tabular-nums">{team.wins}</span>
              <span className="text-center text-sm text-text-secondary tabular-nums">{team.losses}</span>
              <span className="text-center text-sm tabular-nums">{winPct.toFixed(3).slice(1)}</span>
              <div className="text-center">
                <span className="text-xs text-text-secondary tabular-nums">{gb}</span>
                {idx > 0 && (() => {
                  const gbNum = ((leaderWins - leaderLosses) - (team.wins - team.losses)) / 2;
                  const maxGb = sorted.length > 1 ? ((leaderWins - leaderLosses) - (sorted[sorted.length - 1].wins - sorted[sorted.length - 1].losses)) / 2 : 1;
                  const pct = maxGb > 0 ? Math.min((gbNum / maxGb) * 100, 100) : 0;
                  return (
                    <div className="h-1 bg-bg-hover rounded-full overflow-hidden mt-0.5">
                      <div className="h-full bg-danger/40 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  );
                })()}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ConferenceTable({ title, teams }: { title: string; teams: TeamRecord[] }) {
  const leader = teams[0];
  const leaderDiff = leader ? leader.wins - leader.losses : 0;

  return (
    <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-bg-secondary/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {leader && (
          <span className="text-[10px] text-accent">Best: {leader.tricode} ({leader.wins}-{leader.losses})</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-text-secondary text-xs">
              <th className="text-center py-2.5 px-2 w-8">#</th>
              <th className="text-left py-2.5 px-3">Team</th>
              <th className="text-center py-2.5 px-2">W</th>
              <th className="text-center py-2.5 px-2">L</th>
              <th className="text-center py-2.5 px-2">PCT</th>
              <th className="text-center py-2.5 px-2">GB</th>
              <th className="text-center py-2.5 px-1">Proj</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team, i) => {
              const winPct = team.wins / (team.wins + team.losses || 1);
              const gb = i === 0 ? "-" : ((leaderDiff - (team.wins - team.losses)) / 2).toFixed(1);
              const isPlayoff = i < 6;
              const isPlayIn = i >= 6 && i < 10;
              return (
                <tr key={team.tricode} className={`border-b border-border/30 hover:bg-bg-hover transition-colors ${i === 5 ? "border-b-2 border-b-accent/30" : ""} ${i === 9 ? "border-b-2 border-b-yellow-500/30" : ""}`}>
                  <td className="text-center py-2 px-2 text-text-secondary text-xs">{i + 1}</td>
                  <td className="py-2 px-3">
                    <Link href={`/team/${team.tricode}`} className={`flex items-center gap-2 hover:text-accent transition-colors ${i >= 10 && winPct < 0.3 ? "opacity-50" : ""}`}>
                      <Image src={`https://cdn.nba.com/logos/nba/${team.teamId}/global/L/logo.svg`} alt={team.tricode} width={20} height={20} unoptimized />
                      <span className="font-medium text-text-primary">{team.tricode}</span>
                      {i === 0 && <span title="Conference leader">&#128081;</span>}
                      {isPlayoff && <span className="text-[8px] px-1 py-0.5 rounded bg-accent/10 text-accent">P</span>}
                      {isPlayIn && <span className="text-[8px] px-1 py-0.5 rounded bg-yellow-500/10 text-yellow-500">PI</span>}
                    </Link>
                  </td>
                  <td className="text-center py-2 px-2 font-medium tabular-nums">{team.wins}</td>
                  <td className="text-center py-2 px-2 text-text-secondary tabular-nums">{team.losses}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs tabular-nums w-8 text-right">{winPct.toFixed(3).slice(1)}</span>
                      <div className="flex-1 h-1.5 bg-bg-hover rounded-full overflow-hidden max-w-[60px]">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${winPct * 100}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="text-center py-2 px-2 text-text-secondary text-xs tabular-nums">
                    {gb}
                    {isPlayoff && (() => {
                      const gamesLeft = 82 - team.wins - team.losses;
                      return gamesLeft > 0 ? (
                        <span className="block text-[8px] text-text-secondary/60 mt-0.5">({gamesLeft}g left)</span>
                      ) : null;
                    })()}
                  </td>
                  <td className="text-center py-2 px-1 text-[10px] text-text-secondary/70 tabular-nums">
                    {(() => {
                      const projected = Math.round(winPct * 82);
                      return <span title="Projected final wins">&rarr; {projected}w</span>;
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function getTeamStreaks(): Promise<Map<string, string>> {
  const { getFullSchedule } = await import("@/lib/api");
  const schedule = await getFullSchedule().catch(() => []);
  // Build recent results per team (most recent first)
  const teamGames: Record<string, boolean[]> = {};
  const gameDates: { date: string; homeTricode: string; awayTricode: string; homeWon: boolean }[] = [];
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      const dateStr = gd.gameDate.split(" ")[0];
      const [month, day, year] = dateStr.split("/");
      const isoDate = `${year}-${month}-${day}`;
      gameDates.push({ date: isoDate, homeTricode: g.homeTeam.teamTricode, awayTricode: g.awayTeam.teamTricode, homeWon: g.homeTeam.score > g.awayTeam.score });
    }
  }
  gameDates.sort((a, b) => b.date.localeCompare(a.date));
  for (const g of gameDates) {
    if (!teamGames[g.homeTricode]) teamGames[g.homeTricode] = [];
    if (!teamGames[g.awayTricode]) teamGames[g.awayTricode] = [];
    teamGames[g.homeTricode].push(g.homeWon);
    teamGames[g.awayTricode].push(!g.homeWon);
  }
  const streaks = new Map<string, string>();
  for (const [tri, results] of Object.entries(teamGames)) {
    if (results.length === 0) continue;
    const first = results[0];
    let count = 0;
    for (const r of results) {
      if (r === first) count++;
      else break;
    }
    streaks.set(tri, `${first ? "W" : "L"}${count}`);
  }
  return streaks;
}

export default async function StandingsPage() {
  const [standings, streaks] = await Promise.all([getStandings(), getTeamStreaks()]);

  // Compute conference ranks
  const eastTeams = standings.filter((t) => TEAM_META[t.tricode]?.conference === "East");
  const westTeams = standings.filter((t) => TEAM_META[t.tricode]?.conference === "West");

  const conferenceRanks = new Map<string, number>();
  eastTeams.forEach((t, i) => conferenceRanks.set(t.tricode, i + 1));
  westTeams.forEach((t, i) => conferenceRanks.set(t.tricode, i + 1));

  // Group by division
  const byDivision = new Map<string, TeamRecord[]>();
  for (const team of standings) {
    const meta = TEAM_META[team.tricode];
    if (!meta) continue;
    const div = meta.division;
    if (!byDivision.has(div)) byDivision.set(div, []);
    byDivision.get(div)!.push(team);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold">Division Standings</h1>
          <p className="text-sm text-text-secondary">Top 6 in each conference highlighted for playoff eligibility</p>
        </div>
        <ExportStandings east={eastTeams} west={westTeams} />
      </div>
      {/* Conference comparison */}
      {eastTeams.length > 0 && westTeams.length > 0 && (() => {
        const eastAvgW = eastTeams.reduce((s, t) => s + t.wins, 0) / eastTeams.length;
        const westAvgW = westTeams.reduce((s, t) => s + t.wins, 0) / westTeams.length;
        const eastBest = eastTeams[0];
        const westBest = westTeams[0];
        return (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-bg-card border border-border rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-text-secondary uppercase">East Avg W</p>
                <p className="text-lg font-bold text-accent">{eastAvgW.toFixed(1)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-text-secondary">Best</p>
                <p className="text-xs font-medium text-text-primary">{eastBest.tricode} ({eastBest.wins}-{eastBest.losses})</p>
              </div>
            </div>
            <div className="bg-bg-card border border-border rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-text-secondary uppercase">West Avg W</p>
                <p className="text-lg font-bold text-accent">{westAvgW.toFixed(1)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-text-secondary">Best</p>
                <p className="text-xs font-medium text-text-primary">{westBest.tricode} ({westBest.wins}-{westBest.losses})</p>
              </div>
            </div>
          </div>
        );
      })()}
      <div className="flex items-center gap-4 text-xs text-text-secondary mb-6">
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-accent rounded" /> Playoff (1-6)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-yellow-500 rounded" /> Play-In (7-10)</span>
      </div>

      {/* Eastern Conference */}
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-accent rounded-full" />
        Eastern Conference
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {EAST_DIVISIONS.map((div) => (
          <DivisionCard
            key={div}
            division={div}
            teams={byDivision.get(div) || []}
            conferenceRanks={conferenceRanks}
            streaks={streaks}
          />
        ))}
      </div>

      {/* Western Conference */}
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-accent rounded-full" />
        Western Conference
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
        {WEST_DIVISIONS.map((div) => (
          <DivisionCard
            key={div}
            division={div}
            teams={byDivision.get(div) || []}
            conferenceRanks={conferenceRanks}
            streaks={streaks}
          />
        ))}
      </div>

      {/* Feature 4: East vs West Comparison */}
      {eastTeams.length > 0 && westTeams.length > 0 && (() => {
        const eastWins = eastTeams.reduce((s, t) => s + t.wins, 0);
        const westWins = westTeams.reduce((s, t) => s + t.wins, 0);
        const total = eastWins + westWins || 1;
        const eastPct = (eastWins / total) * 100;
        return (
          <div className="bg-bg-card rounded-xl border border-border p-4 mb-8">
            <h3 className="text-xs font-medium text-text-secondary uppercase mb-3">East vs West</h3>
            <div className="flex items-center gap-4 mb-2">
              <span className="text-sm font-bold text-accent">East {eastWins}W</span>
              <div className="flex-1 h-3 bg-bg-hover rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${eastPct}%` }} />
              </div>
              <span className="text-sm font-bold text-success">West {westWins}W</span>
            </div>
            <p className="text-[10px] text-text-secondary text-center">
              {eastWins > westWins ? `East leads by ${eastWins - westWins} wins` : westWins > eastWins ? `West leads by ${westWins - eastWins} wins` : "Tied"}
            </p>
            {(() => {
              // Inter-conference: East losses = games played vs West that East lost = West's wins against East
              // Total inter-conference games = eastLosses that come from west + eastWins that come from west
              // Since standings only has W/L totals, approximate: total games = sum of all team games / 2
              const eastTotalGames = eastTeams.reduce((s, t) => s + t.wins + t.losses, 0) / 2;
              const westTotalGames = westTeams.reduce((s, t) => s + t.wins + t.losses, 0) / 2;
              const totalGames = eastTotalGames + westTotalGames;
              // Intra-conference games: each conference plays within itself
              // Inter-conference: total games - intra games on each side
              // Rough estimate: each team plays 82 games, ~52 within conference, ~30 inter
              const eastTeamCount = eastTeams.length || 15;
              const westTeamCount = westTeams.length || 15;
              const interConferenceGames = Math.round(totalGames - (eastTeamCount * (eastTeamCount - 1)) - (westTeamCount * (westTeamCount - 1)));
              const estInterGames = Math.max(interConferenceGames, 0);
              return estInterGames > 0 ? (
                <p className="text-[10px] text-text-secondary text-center mt-1">
                  ~{Math.round(totalGames)} total games played this season ({eastTeams.length + westTeams.length} teams)
                </p>
              ) : null;
            })()}
          </div>
        );
      })()}

      {/* Full Conference Rankings */}
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span className="w-1.5 h-5 bg-accent rounded-full" />
        Full League Rankings
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConferenceTable title="Eastern Conference" teams={eastTeams} />
        <ConferenceTable title="Western Conference" teams={westTeams} />
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getFullSchedule, getPlayerIndex, formatDate } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import TeamLogo from "@/components/TeamLogo";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import { Users, Calendar, Trophy, ArrowLeft } from "lucide-react";

interface PageProps {
  params: Promise<{ tricode: string }>;
}

export default async function TeamPage({ params }: PageProps) {
  const { tricode } = await params;
  const team = TEAM_META[tricode.toUpperCase()];
  if (!team) notFound();

  const [schedule, playerIndex] = await Promise.all([
    getFullSchedule().catch(() => []),
    getPlayerIndex().catch(() => []),
  ]);

  // Compute team record and games
  const today = formatDate(new Date());
  let wins = 0, losses = 0;
  const recentGames: { gameId: string; date: string; opponent: string; opponentId: number; score: string; won: boolean; home: boolean }[] = [];
  const upcomingGames: { gameId: string; date: string; opponent: string; opponentId: number; home: boolean }[] = [];

  for (const gd of schedule) {
    for (const g of gd.games) {
      const isHome = g.homeTeam.teamTricode === team.tricode;
      const isAway = g.awayTeam.teamTricode === team.tricode;
      if (!isHome && !isAway) continue;

      const dateStr = gd.gameDate.split(" ")[0]; // "04/25/2026"
      const [month, day, year] = dateStr.split("/");
      const isoDate = `${year}-${month}-${day}`;

      if (g.gameStatus === 3) {
        const teamScore = isHome ? g.homeTeam.score : g.awayTeam.score;
        const oppScore = isHome ? g.awayTeam.score : g.homeTeam.score;
        const won = teamScore > oppScore;
        if (won) wins++; else losses++;

        const opp = isHome ? g.awayTeam : g.homeTeam;
        recentGames.push({
          gameId: g.gameId,
          date: isoDate,
          opponent: opp.teamTricode,
          opponentId: opp.teamId,
          score: `${teamScore}-${oppScore}`,
          won,
          home: isHome,
        });
      } else if (g.gameStatus === 1 && isoDate >= today) {
        const opp = isHome ? g.awayTeam : g.homeTeam;
        upcomingGames.push({
          gameId: g.gameId,
          date: isoDate,
          opponent: opp.teamTricode,
          opponentId: opp.teamId,
          home: isHome,
        });
      }
    }
  }

  // Sort recent (most recent first), upcoming (soonest first)
  recentGames.sort((a, b) => b.date.localeCompare(a.date));
  upcomingGames.sort((a, b) => a.date.localeCompare(b.date));

  // Roster
  const roster = playerIndex
    .filter((p) => p.teamAbbr === team.tricode)
    .sort((a, b) => b.pts - a.pts);

  const winPct = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : "0.0";

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Link href="/stats" className="text-sm text-text-secondary hover:text-accent transition-colors">
        <ArrowLeft size={14} className="inline mr-1" />
        Back to standings
      </Link>

      {/* Team Header */}
      <div className="bg-bg-card rounded-xl border border-border mt-4 p-6">
        <div className="flex items-center gap-5">
          <TeamLogo teamId={team.teamId} tricode={team.tricode} size={72} />
          <div>
            <h1 className="text-3xl font-bold">{team.city} <span className="text-accent">{team.name}</span></h1>
            <p className="text-text-secondary text-sm mt-1">
              {team.conference}ern Conference &middot; {team.division} Division
            </p>
          </div>
        </div>

        {/* Record */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="bg-bg-secondary rounded-lg p-4 text-center">
            <p className="text-xs text-text-secondary uppercase">Record</p>
            <p className="text-2xl font-bold mt-1">
              <span className="text-success">{wins}</span>
              <span className="text-text-secondary mx-1">-</span>
              <span className="text-danger">{losses}</span>
            </p>
          </div>
          <div className="bg-bg-secondary rounded-lg p-4 text-center">
            <p className="text-xs text-text-secondary uppercase">Win%</p>
            <p className="text-2xl font-bold text-accent mt-1">{winPct}%</p>
          </div>
          <div className="bg-bg-secondary rounded-lg p-4 text-center">
            <p className="text-xs text-text-secondary uppercase">Players</p>
            <p className="text-2xl font-bold mt-1">{roster.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Recent Games */}
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Calendar size={16} className="text-accent" />
            <h2 className="font-semibold text-sm">Recent Games</h2>
          </div>
          <div className="divide-y divide-border/50">
            {recentGames.slice(0, 10).map((g) => (
              <Link key={g.gameId} href={`/game/${g.gameId}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-hover transition-colors">
                <span className={`text-xs font-bold w-6 ${g.won ? "text-success" : "text-danger"}`}>
                  {g.won ? "W" : "L"}
                </span>
                <TeamLogo teamId={g.opponentId} tricode={g.opponent} size={20} />
                <span className="text-sm text-text-primary flex-1">
                  {g.home ? "vs" : "@"} {g.opponent}
                </span>
                <span className="text-sm font-medium tabular-nums">{g.score}</span>
                <span className="text-xs text-text-secondary">{g.date.slice(5)}</span>
              </Link>
            ))}
            {recentGames.length === 0 && (
              <p className="px-4 py-6 text-center text-text-secondary text-sm">No completed games yet</p>
            )}
          </div>
        </div>

        {/* Upcoming Games */}
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Trophy size={16} className="text-accent" />
            <h2 className="font-semibold text-sm">Upcoming Games</h2>
          </div>
          <div className="divide-y divide-border/50">
            {upcomingGames.slice(0, 8).map((g) => (
              <div key={g.gameId} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-xs text-text-secondary w-6">{g.home ? "vs" : "@"}</span>
                <TeamLogo teamId={g.opponentId} tricode={g.opponent} size={20} />
                <span className="text-sm text-text-primary flex-1">{g.opponent}</span>
                <span className="text-xs text-text-secondary">{g.date.slice(5)}</span>
              </div>
            ))}
            {upcomingGames.length === 0 && (
              <p className="px-4 py-6 text-center text-text-secondary text-sm">No upcoming games scheduled</p>
            )}
          </div>
        </div>
      </div>

      {/* Roster */}
      <div className="bg-bg-card rounded-xl border border-border overflow-hidden mt-6">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Users size={16} className="text-accent" />
          <h2 className="font-semibold text-sm">Roster</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary text-xs">
                <th className="text-left py-3 px-4">Player</th>
                <th className="text-center py-3 px-2">#</th>
                <th className="text-center py-3 px-2">Pos</th>
                <th className="text-center py-3 px-2">PPG</th>
                <th className="text-center py-3 px-2">RPG</th>
                <th className="text-center py-3 px-2">APG</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((p) => (
                <tr key={p.personId} className="border-b border-border/50 hover:bg-bg-hover transition-colors">
                  <td className="py-2.5 px-4">
                    <Link href={`/player/${p.personId}`} className="flex items-center gap-2 hover:text-accent transition-colors">
                      <PlayerHeadshot personId={p.personId} name={`${p.firstName} ${p.lastName}`} size={28} />
                      <span className="font-medium text-text-primary">{p.firstName} {p.lastName}</span>
                    </Link>
                  </td>
                  <td className="text-center py-2.5 px-2 text-text-secondary">{p.jersey || "-"}</td>
                  <td className="text-center py-2.5 px-2 text-text-secondary">{p.position || "-"}</td>
                  <td className="text-center py-2.5 px-2 font-medium text-accent">{p.pts}</td>
                  <td className="text-center py-2.5 px-2">{p.reb}</td>
                  <td className="text-center py-2.5 px-2">{p.ast}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

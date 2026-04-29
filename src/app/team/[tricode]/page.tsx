import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFullSchedule, getPlayerIndex, formatDate } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import TeamLogo from "@/components/TeamLogo";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import { Users, Calendar, Trophy, ArrowLeft } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";

// ISR: serve cached page, revalidate every 10 minutes
export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ tricode: string }> }): Promise<Metadata> {
  const { tricode } = await params;
  const team = TEAM_META[tricode.toUpperCase()];
  if (!team) return {};
  return {
    title: `${team.city} ${team.name}`,
    description: `${team.city} ${team.name} 球队主页：阵容、赛程、近期战绩一览。`,
  };
}

// Pre-render all 30 team pages at build time
export async function generateStaticParams() {
  return Object.keys(TEAM_META).map((tricode) => ({ tricode }));
}

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

  // Compute season stats
  let totalPointsScored = 0;
  let totalPointsAllowed = 0;
  let homeWins = 0, homeLosses = 0;
  let awayWins = 0, awayLosses = 0;
  let gamesPlayed = 0;

  for (const g of recentGames) {
    gamesPlayed++;
    const [scored, allowed] = g.score.split("-").map(Number);
    totalPointsScored += scored;
    totalPointsAllowed += allowed;
    if (g.home) {
      if (g.won) homeWins++; else homeLosses++;
    } else {
      if (g.won) awayWins++; else awayLosses++;
    }
  }

  const ppg = gamesPlayed > 0 ? (totalPointsScored / gamesPlayed).toFixed(1) : "0.0";
  const oppPpg = gamesPlayed > 0 ? (totalPointsAllowed / gamesPlayed).toFixed(1) : "0.0";

  // Streak calculation (based on most recent games order which is already desc)
  let streakType = "";
  let streakCount = 0;
  for (const g of recentGames) {
    const curr = g.won ? "W" : "L";
    if (streakCount === 0) {
      streakType = curr;
      streakCount = 1;
    } else if (curr === streakType) {
      streakCount++;
    } else {
      break;
    }
  }
  const streakDisplay = streakCount > 0 ? `${streakType}${streakCount}` : "-";

  // Compute longest win streak and loss streak
  let longestWinStreak = 0, longestLossStreak = 0;
  {
    let currentW = 0, currentL = 0;
    // recentGames is sorted desc by date, reverse to go chronological
    const chronological = [...recentGames].reverse();
    for (const g of chronological) {
      if (g.won) {
        currentW++;
        currentL = 0;
        if (currentW > longestWinStreak) longestWinStreak = currentW;
      } else {
        currentL++;
        currentW = 0;
        if (currentL > longestLossStreak) longestLossStreak = currentL;
      }
    }
  }

  // Compute head-to-head rivalries
  const h2hMap: Record<string, { opponent: string; opponentId: number; wins: number; losses: number }> = {};
  for (const g of recentGames) {
    if (!h2hMap[g.opponent]) {
      h2hMap[g.opponent] = { opponent: g.opponent, opponentId: g.opponentId, wins: 0, losses: 0 };
    }
    if (g.won) h2hMap[g.opponent].wins++;
    else h2hMap[g.opponent].losses++;
  }
  const rivalries = Object.values(h2hMap)
    .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
    .slice(0, 5);

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

      {/* Team color accent */}
      <div className="team-accent-bar mt-4 mb-6" style={{ background: team.primaryColor }} />

      {/* Team Header */}
      <div className="bg-bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-5">
          <TeamLogo teamId={team.teamId} tricode={team.tricode} size={72} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{team.city} <span className="text-accent">{team.name}</span></h1>
              <FavoriteButton type="team" id={team.tricode} />
            </div>
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

        {/* Season Stats */}
        {gamesPlayed > 0 && (
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mt-4">
            <div className="bg-bg-secondary rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-secondary uppercase">PPG</p>
              <p className="text-lg font-bold text-accent mt-0.5">{ppg}</p>
            </div>
            <div className="bg-bg-secondary rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-secondary uppercase">OPP PPG</p>
              <p className="text-lg font-bold mt-0.5">{oppPpg}</p>
            </div>
            <div className="bg-bg-secondary rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-secondary uppercase">Home</p>
              <p className="text-lg font-bold mt-0.5">
                <span className="text-success">{homeWins}</span>
                <span className="text-text-secondary mx-0.5">-</span>
                <span className="text-danger">{homeLosses}</span>
              </p>
            </div>
            <div className="bg-bg-secondary rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-secondary uppercase">Away</p>
              <p className="text-lg font-bold mt-0.5">
                <span className="text-success">{awayWins}</span>
                <span className="text-text-secondary mx-0.5">-</span>
                <span className="text-danger">{awayLosses}</span>
              </p>
            </div>
            <div className="bg-bg-secondary rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-secondary uppercase">Streak</p>
              <p className={`text-lg font-bold mt-0.5 ${streakType === "W" ? "text-success" : "text-danger"}`}>
                {streakDisplay}
              </p>
            </div>
            {/* Season Highs */}
            <div className="bg-bg-secondary rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-secondary uppercase">Best Streak</p>
              <p className="text-lg font-bold text-success mt-0.5">W{longestWinStreak}</p>
            </div>
            <div className="bg-bg-secondary rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-secondary uppercase">Worst Streak</p>
              <p className="text-lg font-bold text-danger mt-0.5">L{longestLossStreak}</p>
            </div>
          </div>
        )}
      </div>

      {/* Recent Opponents */}
      {recentGames.length > 0 && (
        <div className="bg-bg-card rounded-xl border border-border p-4 mt-6">
          <h3 className="text-xs font-medium text-text-secondary uppercase mb-3">Recent Opponents</h3>
          <div className="flex items-center gap-2 overflow-x-auto">
            {recentGames.slice(0, 8).map((g, i) => (
              <Link key={i} href={`/team/${g.opponent}`} className="flex flex-col items-center gap-1 shrink-0">
                <TeamLogo teamId={g.opponentId} tricode={g.opponent} size={28} />
                <span className={`text-[9px] font-bold ${g.won ? "text-success" : "text-danger"}`}>
                  {g.won ? "W" : "L"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Offense vs Defense */}
      {gamesPlayed > 0 && (
        <div className="bg-bg-card rounded-xl border border-border p-4 mt-6">
          <h3 className="text-xs font-medium text-text-secondary uppercase mb-3">Offense vs Defense</h3>
          <div className="flex items-end gap-1 h-20">
            <div className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-accent font-bold">{ppg}</span>
              <div className="w-full bg-accent/20 rounded-t" style={{ height: `${(parseFloat(ppg) / 150) * 100}%` }}>
                <div className="w-full h-full bg-accent rounded-t" />
              </div>
              <span className="text-[10px] text-text-secondary">OFF</span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-danger font-bold">{oppPpg}</span>
              <div className="w-full bg-danger/20 rounded-t" style={{ height: `${(parseFloat(oppPpg) / 150) * 100}%` }}>
                <div className="w-full h-full bg-danger rounded-t" />
              </div>
              <span className="text-[10px] text-text-secondary">DEF</span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-1">
              <span className={`text-xs font-bold ${parseFloat(ppg) > parseFloat(oppPpg) ? "text-success" : "text-danger"}`}>
                {(parseFloat(ppg) - parseFloat(oppPpg) > 0 ? "+" : "")}{(parseFloat(ppg) - parseFloat(oppPpg)).toFixed(1)}
              </span>
              <div className="w-full bg-bg-hover rounded-t" style={{ height: `${(Math.abs(parseFloat(ppg) - parseFloat(oppPpg)) / 20) * 100}%` }}>
                <div className={`w-full h-full rounded-t ${parseFloat(ppg) > parseFloat(oppPpg) ? "bg-success" : "bg-danger"}`} />
              </div>
              <span className="text-[10px] text-text-secondary">NET</span>
            </div>
          </div>
        </div>
      )}

      {/* Point Differential Chart (last 15 games) */}
      {recentGames.length > 0 && (() => {
        const last15 = recentGames.slice(0, 15).reverse();
        const diffs = last15.map((g) => {
          const [scored, allowed] = g.score.split("-").map(Number);
          return scored - allowed;
        });
        const maxAbs = Math.max(...diffs.map(Math.abs), 1);
        const barWidth = 100 / last15.length;
        const chartH = 80;
        const midY = chartH / 2;
        return (
          <div className="bg-bg-card rounded-xl border border-border p-4 mt-6">
            <h3 className="text-xs font-medium text-text-secondary uppercase mb-3">Point Differential (Last {last15.length})</h3>
            <svg viewBox={`0 0 100 ${chartH}`} className="w-full" preserveAspectRatio="none">
              <line x1="0" y1={midY} x2="100" y2={midY} stroke="var(--border)" strokeWidth="0.3" />
              {diffs.map((d, i) => {
                const barH = (Math.abs(d) / maxAbs) * (midY - 4);
                const x = i * barWidth + barWidth * 0.15;
                const w = barWidth * 0.7;
                const y = d >= 0 ? midY - barH : midY;
                return (
                  <g key={i}>
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={barH}
                      rx={0.8}
                      fill={d >= 0 ? "var(--success)" : "var(--danger)"}
                      opacity={0.8}
                    />
                    <text
                      x={x + w / 2}
                      y={d >= 0 ? y - 1.5 : y + barH + 4}
                      textAnchor="middle"
                      fill="var(--text-secondary)"
                      fontSize="3"
                    >
                      {d > 0 ? `+${d}` : d}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="flex justify-between text-[9px] text-text-secondary mt-1">
              <span>{last15[0]?.date.slice(5)}</span>
              <span>{last15[last15.length - 1]?.date.slice(5)}</span>
            </div>
          </div>
        );
      })()}

      {/* Last 10 Games W/L Streak */}
      {recentGames.length > 0 && (
        <div className="bg-bg-card rounded-xl border border-border p-4 mt-6">
          <h3 className="text-xs font-medium text-text-secondary uppercase mb-3">Last {Math.min(recentGames.length, 10)} Games</h3>
          <div className="flex items-center gap-1">
            {recentGames.slice(0, 10).reverse().map((g, i) => (
              <div key={i} className={`flex-1 h-8 rounded flex items-center justify-center text-xs font-bold text-white ${g.won ? "bg-success" : "bg-danger"}`}>
                {g.won ? "W" : "L"}
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Monthly Record */}
      {recentGames.length > 0 && (() => {
        const byMonth = new Map<string, { w: number; l: number }>();
        for (const g of recentGames) {
          const month = g.date.slice(0, 7); // "2025-04"
          const rec = byMonth.get(month) || { w: 0, l: 0 };
          if (g.won) rec.w++; else rec.l++;
          byMonth.set(month, rec);
        }
        const months = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        if (months.length < 2) return null;
        return (
          <div className="bg-bg-card rounded-xl border border-border p-4 mt-6">
            <h3 className="text-xs font-medium text-text-secondary uppercase mb-3">Monthly Record</h3>
            <div className="flex flex-wrap gap-2">
              {months.map(([month, rec]) => (
                <div key={month} className="bg-bg-secondary rounded-lg px-3 py-2 text-center">
                  <p className="text-[10px] text-text-secondary">{new Date(month + "-01").toLocaleDateString("en-US", { month: "short" })}</p>
                  <p className="text-sm font-bold">
                    <span className="text-success">{rec.w}</span>
                    <span className="text-text-secondary mx-0.5">-</span>
                    <span className="text-danger">{rec.l}</span>
                  </p>
                </div>
              ))}
            </div>
            {/* Feature 11: Win percentage sparkline */}
            {months.length >= 2 && (() => {
              const pcts = months.map(([, rec]) => rec.w / (rec.w + rec.l || 1));
              const w = 200, h = 40, pad = 4;
              const xStep = (w - pad * 2) / (pcts.length - 1);
              const points = pcts.map((p, i) => `${pad + i * xStep},${h - pad - p * (h - pad * 2)}`).join(" ");
              return (
                <div className="mt-3">
                  <p className="text-[10px] text-text-secondary mb-1">Win% Trend</p>
                  <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[240px]" preserveAspectRatio="none">
                    <line x1={pad} y1={h / 2} x2={w - pad} y2={h / 2} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3 3" />
                    <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                    {pcts.map((p, i) => (
                      <circle key={i} cx={pad + i * xStep} cy={h - pad - p * (h - pad * 2)} r="2.5" fill="var(--accent)" />
                    ))}
                  </svg>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Head-to-Head */}
      {rivalries.length > 0 && (
        <div className="bg-bg-card rounded-xl border border-border overflow-hidden mt-6">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Trophy size={16} className="text-accent" />
            <h2 className="font-semibold text-sm">Head-to-Head</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary text-xs">
                  <th className="text-left py-3 px-4">Opponent</th>
                  <th className="text-center py-3 px-2">W</th>
                  <th className="text-center py-3 px-2">L</th>
                  <th className="text-center py-3 px-2">Win%</th>
                </tr>
              </thead>
              <tbody>
                {rivalries.map((r) => (
                  <tr key={r.opponent} className="border-b border-border/50 hover:bg-bg-hover transition-colors">
                    <td className="py-2.5 px-4">
                      <Link href={`/team/${r.opponent}`} className="flex items-center gap-2 hover:text-accent transition-colors">
                        <TeamLogo teamId={r.opponentId} tricode={r.opponent} size={20} />
                        <span className="font-medium text-text-primary">{r.opponent}</span>
                      </Link>
                    </td>
                    <td className="text-center py-2.5 px-2 text-success font-medium">{r.wins}</td>
                    <td className="text-center py-2.5 px-2 text-danger font-medium">{r.losses}</td>
                    <td className="text-center py-2.5 px-2 font-medium text-accent">
                      {((r.wins / (r.wins + r.losses)) * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Feature 2: Roster Position Breakdown */}
      {roster.length > 0 && (() => {
        const posCount: Record<string, number> = { Guard: 0, Forward: 0, Center: 0 };
        for (const p of roster) {
          const pos = (p.position || "").toUpperCase();
          if (pos.includes("G")) posCount["Guard"]++;
          else if (pos.includes("F")) posCount["Forward"]++;
          else if (pos.includes("C")) posCount["Center"]++;
        }
        const total = posCount.Guard + posCount.Forward + posCount.Center;
        if (total === 0) return null;
        const colors = { Guard: "var(--accent)", Forward: "var(--success)", Center: "var(--danger)" };
        const size = 80;
        const cx = size / 2, cy = size / 2, r = 30;
        let currentAngle = -Math.PI / 2;
        const slices: { key: string; path: string; color: string }[] = [];
        for (const [label, count] of Object.entries(posCount)) {
          if (count === 0) continue;
          const angle = (count / total) * 2 * Math.PI;
          const x1 = cx + r * Math.cos(currentAngle);
          const y1 = cy + r * Math.sin(currentAngle);
          const x2 = cx + r * Math.cos(currentAngle + angle);
          const y2 = cy + r * Math.sin(currentAngle + angle);
          const largeArc = angle > Math.PI ? 1 : 0;
          slices.push({
            key: label,
            path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
            color: colors[label as keyof typeof colors],
          });
          currentAngle += angle;
        }
        return (
          <div className="bg-bg-card rounded-xl border border-border p-4 mt-6">
            <h3 className="text-xs font-medium text-text-secondary uppercase mb-3">Position Breakdown</h3>
            <div className="flex items-center gap-6">
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {slices.map(s => <path key={s.key} d={s.path} fill={s.color} opacity={0.8} />)}
              </svg>
              <div className="flex flex-wrap gap-3">
                {Object.entries(posCount).filter(([,c]) => c > 0).map(([label, count]) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: colors[label as keyof typeof colors] }} />
                    <span className="text-text-primary font-medium">{label}</span>
                    <span className="text-text-secondary">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

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

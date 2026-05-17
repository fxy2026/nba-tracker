import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ListOrdered } from "lucide-react";
import { TEAM_META } from "@/lib/teams";
import { getFullSchedule, getScheduleAge } from "@/lib/api";
import { teamLogoUrl } from "@/lib/teamUrls";
import { isRegular, winPct as calcWinPct } from "@/lib/games";
import ExportStandings from "@/components/ExportStandings";
import PageHeader from "@/components/PageHeader";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";
import type { Translations } from "@/locales";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getTranslations(locale);
  return {
    title: t.meta.standingsTitle,
    description: t.meta.standingsDesc,
  };
}

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

// Compute standings directly from the schedule (avoid SSR self-fetch which
// fails on deployed environments where baseUrl resolution is unreliable).
async function getStandings(): Promise<TeamRecord[]> {
  try {
    const dates = await getFullSchedule();
    const teamMap: Record<string, TeamRecord> = {};
    for (const gd of dates) {
      for (const g of gd.games) {
        if (g.gameStatus !== 3) continue;
        if (!isRegular(g.gameId)) continue; // regular season only
        const h = g.homeTeam;
        const a = g.awayTeam;
        if (!teamMap[h.teamTricode])
          teamMap[h.teamTricode] = { tricode: h.teamTricode, teamId: h.teamId, teamName: h.teamName, teamCity: h.teamCity, wins: 0, losses: 0 };
        if (!teamMap[a.teamTricode])
          teamMap[a.teamTricode] = { tricode: a.teamTricode, teamId: a.teamId, teamName: a.teamName, teamCity: a.teamCity, wins: 0, losses: 0 };
        if (h.score > a.score) {
          teamMap[h.teamTricode].wins++;
          teamMap[a.teamTricode].losses++;
        } else {
          teamMap[a.teamTricode].wins++;
          teamMap[h.teamTricode].losses++;
        }
      }
    }
    return Object.values(teamMap).sort((a, b) => {
      const wa = a.wins / (a.wins + a.losses || 1);
      const wb = b.wins / (b.wins + b.losses || 1);
      return wb - wa;
    });
  } catch {
    return [];
  }
}

function DivisionCard({ division, teams, conferenceRanks, streaks, t }: {
  division: string;
  teams: TeamRecord[];
  conferenceRanks: Map<string, number>;
  streaks: Map<string, string>;
  t: Translations;
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
    <div className="glass-tile overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-bg-secondary/30">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ Division</p>
        <h3 className="text-sm font-semibold text-text-primary tracking-tight mt-0.5">{division}</h3>
      </div>
      <div className="divide-y divide-border/30">
        {/* Header row */}
        <div className="grid grid-cols-[auto_1fr_40px_40px_56px_40px] items-center px-4 py-2 text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
          <span className="w-5">#</span>
          <span>{t.common.team}</span>
          <span className="text-center">{t.common.wins}</span>
          <span className="text-center">{t.common.losses}</span>
          <span className="text-center">{t.standingsPage.pct}</span>
          <span className="text-center">{t.standingsPage.gb}</span>
        </div>
        {sorted.map((team, idx) => {
          const winPct = calcWinPct(team.wins, team.losses);
          const gb = idx === 0 ? "-" : (((leaderWins - leaderLosses) - (team.wins - team.losses)) / 2).toFixed(1);
          const confRank = conferenceRanks.get(team.tricode) || 99;
          const isPlayoff = confRank <= 6;
          const isPlayIn = confRank >= 7 && confRank <= 10;

          return (
            <Link
              key={team.tricode}
              href={`/team/${team.tricode}`}
              className={`grid grid-cols-[auto_1fr_40px_40px_56px_40px] items-center px-4 py-2.5 hover:bg-bg-hover transition-colors ${
                isPlayoff ? "border-l-2 border-l-accent" : isPlayIn ? "border-l-2 border-l-accent-amber" : "border-l-2 border-l-transparent"
              }`}
            >
              <span className="text-xs text-text-secondary w-5">{idx + 1}</span>
              <div className="flex items-center gap-2.5">
                <Image
                  src={teamLogoUrl(team.teamId)}
                  alt={team.tricode}
                  width={24}
                  height={24}
                  unoptimized
                />
                <div>
                  <span className="text-sm font-medium text-text-primary">{team.teamCity} {team.teamName}</span>
                  {isPlayoff && <span className="ml-1.5 text-[11px] sm:text-[9px] px-1 py-0.5 rounded bg-accent/10 text-accent">{t.standingsPage.playoff}</span>}
                  {isPlayIn && <span className="ml-1.5 text-[11px] sm:text-[9px] px-1 py-0.5 rounded bg-accent-amber/10 text-accent-amber">{t.standingsPage.playIn}</span>}
                  {streaks.get(team.tricode) && (() => {
                    const streak = streaks.get(team.tricode)!;
                    const isWin = streak.startsWith("W");
                    return (
                      <span className={`ml-1 text-[11px] sm:text-[9px] px-1 py-0.5 rounded font-medium ${isWin ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                        {streak}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <span className="text-center text-sm font-medium font-mono tabular-nums">{team.wins}</span>
              <span className="text-center text-sm text-text-secondary font-mono tabular-nums">{team.losses}</span>
              <span className="text-center text-sm font-mono tabular-nums">{winPct.toFixed(3).slice(1)}</span>
              <div className="text-center">
                <span className="text-xs text-text-secondary font-mono tabular-nums">{gb}</span>
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

function ConferenceTable({ title, teams, t }: { title: string; teams: TeamRecord[]; t: Translations }) {
  const leader = teams[0];
  const leaderDiff = leader ? leader.wins - leader.losses : 0;

  return (
    <div className="glass-tile overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-bg-secondary/30 flex items-end justify-between">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ Conference</p>
          <h3 className="text-sm font-semibold text-text-primary tracking-tight mt-0.5">{title}</h3>
        </div>
        {leader && (
          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-accent-amber">★ {t.standingsPage.best}{leader.tricode} <span className="tabular-nums">({leader.wins}-{leader.losses})</span></span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-bg-card/95 backdrop-blur-md">
            <tr className="border-b border-border text-text-secondary text-[10px] font-mono uppercase tracking-[0.15em]">
              <th className="text-center py-2.5 px-2 w-8">#</th>
              <th className="text-left py-2.5 px-3">{t.common.team}</th>
              <th className="text-center py-2.5 px-2">{t.common.wins}</th>
              <th className="text-center py-2.5 px-2">{t.common.losses}</th>
              <th className="text-center py-2.5 px-2">{t.standingsPage.pct}</th>
              <th className="text-center py-2.5 px-2">{t.standingsPage.gb}</th>
              <th className="text-center py-2.5 px-1">{t.standingsPage.proj}</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team, i) => {
              const winPct = calcWinPct(team.wins, team.losses);
              const gb = i === 0 ? "-" : ((leaderDiff - (team.wins - team.losses)) / 2).toFixed(1);
              const isPlayoff = i < 6;
              const isPlayIn = i >= 6 && i < 10;
              const isTop3 = i < 3;
              const medalBg = i === 0 ? "bg-[#FFD700]/15 ring-1 ring-[#FFD700]/40 text-[#FFD700]"
                : i === 1 ? "bg-[#C0C0C0]/15 ring-1 ring-[#C0C0C0]/40 text-[#C0C0C0]"
                : i === 2 ? "bg-[#CD7F32]/20 ring-1 ring-[#CD7F32]/40 text-[#CD7F32]"
                : "";
              return (
                <tr key={team.tricode} className={`border-b border-border/30 hover:bg-bg-hover transition-colors ${i === 5 ? "border-b-2 border-b-accent/30" : ""} ${i === 9 ? "border-b-2 border-b-accent-amber/30" : ""}`}>
                  <td className="text-center py-2 px-2">
                    {isTop3 ? (
                      <span className={`w-6 h-6 inline-flex items-center justify-center rounded-full text-[11px] font-bold font-mono tabular-nums ${medalBg}`}>
                        {i + 1}
                      </span>
                    ) : (
                      <span className="text-text-secondary text-xs font-mono tabular-nums">{i + 1}</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <Link href={`/team/${team.tricode}`} className={`flex items-center gap-2 hover:text-accent transition-colors cursor-pointer ${i >= 10 && winPct < 0.3 ? "opacity-60" : ""}`}>
                      <Image src={teamLogoUrl(team.teamId)} alt={team.tricode} width={22} height={22} unoptimized />
                      <span className="font-semibold text-text-primary font-mono">{team.tricode}</span>
                      {i === 0 && <span title={t.standingsPage.confLeader} className="text-[#FFD700]">★</span>}
                      {isPlayoff && i !== 0 && <span className="text-[11px] sm:text-[9px] font-mono uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-accent/15 text-accent">P</span>}
                      {isPlayIn && <span className="text-[11px] sm:text-[9px] font-mono uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-accent-amber/15 text-accent-amber">PI</span>}
                    </Link>
                  </td>
                  <td className="text-center py-2 px-2 font-medium font-mono tabular-nums">{team.wins}</td>
                  <td className="text-center py-2 px-2 text-text-secondary font-mono tabular-nums">{team.losses}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono tabular-nums w-8 text-right">{winPct.toFixed(3).slice(1)}</span>
                      <div className="flex-1 h-1.5 bg-bg-hover rounded-full overflow-hidden max-w-[60px]">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${winPct * 100}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="text-center py-2 px-2 text-text-secondary text-xs font-mono tabular-nums">
                    {gb}
                    {isPlayoff && (() => {
                      const gamesLeft = 82 - team.wins - team.losses;
                      return gamesLeft > 0 ? (
                        <span className="block text-[11px] sm:text-[8px] text-text-secondary/60 mt-0.5">({gamesLeft}{t.standingsPage.gamesLeft})</span>
                      ) : null;
                    })()}
                  </td>
                  <td className="text-center py-2 px-1 text-[11px] sm:text-[10px] text-text-secondary/70 font-mono tabular-nums">
                    {(() => {
                      const projected = Math.round(winPct * 82);
                      return <span title={t.standingsPage.proj}>&rarr; {projected}w</span>;
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
  const [standings, streaks, locale] = await Promise.all([getStandings(), getTeamStreaks(), getLocale()]);
  const t = getTranslations(locale);

  // Compute conference ranks
  const eastTeams = standings.filter((t) => TEAM_META[t.tricode]?.conference === "East");
  const westTeams = standings.filter((t) => TEAM_META[t.tricode]?.conference === "West");

  const conferenceRanks = new Map<string, number>();
  let eastWins = 0, eastLosses = 0, westWins = 0, westLosses = 0;
  eastTeams.forEach((t, i) => {
    conferenceRanks.set(t.tricode, i + 1);
    eastWins += t.wins;
    eastLosses += t.losses;
  });
  westTeams.forEach((t, i) => {
    conferenceRanks.set(t.tricode, i + 1);
    westWins += t.wins;
    westLosses += t.losses;
  });
  const eastAvgW = eastTeams.length > 0 ? eastWins / eastTeams.length : 0;
  const westAvgW = westTeams.length > 0 ? westWins / westTeams.length : 0;

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
      <PageHeader
        eyebrow="League"
        icon={ListOrdered}
        title={t.standingsPage.divisionStandings}
        subtitle={t.standingsPage.top6Hint}
        updatedAt={getScheduleAge()}
        action={<ExportStandings east={eastTeams} west={westTeams} />}
      />
      {/* Conference comparison */}
      {eastTeams.length > 0 && westTeams.length > 0 && (() => {
        const eastBest = eastTeams[0];
        const westBest = westTeams[0];
        return (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="glass-tile p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-text-secondary uppercase">{t.standingsPage.eastAvgW}</p>
                <p className="text-2xl font-light font-mono tabular-nums text-accent-amber">{eastAvgW.toFixed(1)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-text-secondary">{t.standingsPage.best}</p>
                <p className="text-xs font-medium text-text-primary">{eastBest.tricode} ({eastBest.wins}-{eastBest.losses})</p>
              </div>
            </div>
            <div className="glass-tile p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-text-secondary uppercase">{t.standingsPage.westAvgW}</p>
                <p className="text-2xl font-light font-mono tabular-nums text-accent-amber">{westAvgW.toFixed(1)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-text-secondary">{t.standingsPage.best}</p>
                <p className="text-xs font-medium text-text-primary">{westBest.tricode} ({westBest.wins}-{westBest.losses})</p>
              </div>
            </div>
          </div>
        );
      })()}
      <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary mb-6">
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-accent rounded" /> {t.standingsPage.playoff} (1-6)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-accent-amber rounded" /> {t.standingsPage.playIn} (7-10)</span>
      </div>

      {/* Eastern Conference */}
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-primary flex items-center gap-2">
          <span className="w-1 h-3 bg-accent rounded-full" />
          {t.standingsPage.eastConference}
        </h2>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {EAST_DIVISIONS.map((div) => (
          <DivisionCard
            key={div}
            division={div}
            teams={byDivision.get(div) || []}
            conferenceRanks={conferenceRanks}
            streaks={streaks}
            t={t}
          />
        ))}
      </div>

      {/* Western Conference */}
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-primary flex items-center gap-2">
          <span className="w-1 h-3 bg-accent rounded-full" />
          {t.standingsPage.westConference}
        </h2>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
        {WEST_DIVISIONS.map((div) => (
          <DivisionCard
            key={div}
            division={div}
            teams={byDivision.get(div) || []}
            conferenceRanks={conferenceRanks}
            streaks={streaks}
            t={t}
          />
        ))}
      </div>

      {/* Feature 4: East vs West Comparison */}
      {eastTeams.length > 0 && westTeams.length > 0 && (() => {
        const total = eastWins + westWins || 1;
        const eastPct = (eastWins / total) * 100;
        return (
          <div className="glass-tile p-4 mb-8">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3">{t.standingsPage.eastVsWest}</h3>
            <div className="flex items-center gap-4 mb-2">
              <span className="text-sm font-bold text-accent">East {eastWins}{t.common.wins}</span>
              <div className="flex-1 h-3 bg-bg-hover rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${eastPct}%` }} />
              </div>
              <span className="text-sm font-bold text-success">West {westWins}{t.common.wins}</span>
            </div>
            <p className="text-[10px] text-text-secondary text-center">
              {eastWins > westWins ? `${t.standingsPage.eastLeads} ${eastWins - westWins} ${t.common.wins}` : westWins > eastWins ? `${t.standingsPage.westLeads} ${westWins - eastWins} ${t.common.wins}` : t.common.tied}
            </p>
            {(() => {
              // Games are double-counted (each appears in 2 teams), so divide by 2.
              const totalGames = (eastWins + eastLosses + westWins + westLosses) / 2;
              const eastTeamCount = eastTeams.length || 15;
              const westTeamCount = westTeams.length || 15;
              const interConferenceGames = Math.round(totalGames - (eastTeamCount * (eastTeamCount - 1)) - (westTeamCount * (westTeamCount - 1)));
              return interConferenceGames > 0 ? (
                <p className="text-[10px] text-text-secondary text-center mt-1">
                  {t.standingsPage.totalGames.replace("%s", String(Math.round(totalGames))).replace("%s", String(eastTeams.length + westTeams.length))}
                </p>
              ) : null;
            })()}
          </div>
        );
      })()}

      {/* Full Conference Rankings */}
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-primary flex items-center gap-2">
          <span className="w-1 h-3 bg-accent-amber rounded-full" />
          {t.standingsPage.fullRankings}
        </h2>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConferenceTable title={t.standingsPage.eastConference} teams={eastTeams} t={t} />
        <ConferenceTable title={t.standingsPage.westConference} teams={westTeams} t={t} />
      </div>
    </div>
  );
}

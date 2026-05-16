import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFullSchedule, getPlayerIndex, formatDate } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";
import TeamLogo from "@/components/TeamLogo";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import PointDiffChart from "@/components/PointDiffChart";
import { Users, Calendar, Trophy, ArrowLeft } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";

// ISR: serve cached page, revalidate every 10 minutes
export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ tricode: string }> }): Promise<Metadata> {
  const { tricode } = await params;
  const [team, locale] = [TEAM_META[tricode.toUpperCase()], await getLocale()];
  const t = getTranslations(locale);
  if (!team) return {};
  return {
    title: `${team.city} ${team.name}`,
    description: locale === "zh" ? t.teamPage.teamDesc : t.teamPage.teamDescEn,
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

  const locale = await getLocale();
  const t = getTranslations(locale);

  const [schedule, playerIndex] = await Promise.all([
    getFullSchedule().catch(() => []),
    getPlayerIndex().catch(() => []),
  ]);

  // Compute team record and games
  const today = formatDate(new Date());
  let wins = 0, losses = 0;
  let playoffWins = 0, playoffLosses = 0;
  const recentGames: { gameId: string; date: string; opponent: string; opponentId: number; score: string; won: boolean; home: boolean }[] = [];
  const upcomingGames: { gameId: string; date: string; opponent: string; opponentId: number; home: boolean }[] = [];
  // Build league-wide W/L map in the same pass (used later for conference ranking).
  const teamRecordMap: Record<string, { w: number; l: number }> = {};

  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus === 3 && g.gameId.startsWith("002")) {
        const ht = g.homeTeam.teamTricode;
        const at = g.awayTeam.teamTricode;
        if (!teamRecordMap[ht]) teamRecordMap[ht] = { w: 0, l: 0 };
        if (!teamRecordMap[at]) teamRecordMap[at] = { w: 0, l: 0 };
        if (g.homeTeam.score > g.awayTeam.score) { teamRecordMap[ht].w++; teamRecordMap[at].l++; }
        else { teamRecordMap[at].w++; teamRecordMap[ht].l++; }
      }

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
        const isRegularSeason = g.gameId.startsWith("002");
        // Only count regular season games for W/L record
        if (isRegularSeason) {
          if (won) wins++; else losses++;
        } else if (g.gameId.startsWith("004")) {
          if (won) playoffWins++; else playoffLosses++;
        }

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

  // Single pass: current streak + longest streaks + h2h rivalries
  let streakType = "";
  let streakCount = 0;
  let longestWinStreak = 0, longestLossStreak = 0;
  const h2hMap: Record<string, { opponent: string; opponentId: number; wins: number; losses: number }> = {};
  {
    // Current streak (from desc order — most recent first)
    for (const g of recentGames) {
      const curr = g.won ? "W" : "L";
      if (streakCount === 0) { streakType = curr; streakCount = 1; }
      else if (curr === streakType) streakCount++;
      else break;
    }
    // Longest streaks + h2h (chronological — reverse of desc)
    let currentW = 0, currentL = 0;
    for (let i = recentGames.length - 1; i >= 0; i--) {
      const g = recentGames[i];
      if (g.won) { currentW++; currentL = 0; if (currentW > longestWinStreak) longestWinStreak = currentW; }
      else { currentL++; currentW = 0; if (currentL > longestLossStreak) longestLossStreak = currentL; }
      if (!h2hMap[g.opponent]) h2hMap[g.opponent] = { opponent: g.opponent, opponentId: g.opponentId, wins: 0, losses: 0 };
      if (g.won) h2hMap[g.opponent].wins++; else h2hMap[g.opponent].losses++;
    }
  }
  const streakDisplay = streakCount > 0 ? `${streakType}${streakCount}` : "-";
  const rivalries = Object.values(h2hMap)
    .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
    .slice(0, 5);

  // Roster
  const roster = playerIndex
    .filter((p) => p.teamAbbr === team.tricode)
    .sort((a, b) => b.pts - a.pts);

  const winPct = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : "0.0";

  // Compute conference ranking by sorting all conference teams by win% (uses
  // teamRecordMap built in the schedule pass above — no extra iteration).
  const conferenceTeams = Object.values(TEAM_META).filter((tm) => tm.conference === team.conference);
  const conferenceRanking = conferenceTeams
    .map((tm) => {
      const rec = teamRecordMap[tm.tricode] || { w: 0, l: 0 };
      return { tricode: tm.tricode, winPct: rec.w + rec.l > 0 ? rec.w / (rec.w + rec.l) : 0 };
    })
    .sort((a, b) => b.winPct - a.winPct);
  const confRank = conferenceRanking.findIndex((tm) => tm.tricode === team.tricode) + 1;

  const last10 = recentGames.slice(0, 10);
  const w10 = last10.filter((g) => g.won).length;
  const l10 = last10.length - w10;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Link href="/stats" className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-[0.2em] text-text-secondary hover:text-accent transition-colors cursor-pointer">
        <ArrowLeft size={12} /> {t.teamPage.backToStandings}
      </Link>

      {/* ─── Team Hero — Bento with team-color tinting ────── */}
      <div
        className="glass-tile glass-tile-featured mt-6 p-6 sm:p-8 relative overflow-hidden"
        style={{ ["--team-color" as string]: team.primaryColor }}
      >
        {/* Team color radial accent on top-left */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 50% 40% at 10% 0%, ${team.primaryColor}66 0%, transparent 70%)` }}
        />
        {/* Big team logo watermark on right */}
        <div className="absolute -right-12 -top-8 opacity-10 pointer-events-none">
          <TeamLogo teamId={team.teamId} tricode={team.tricode} size={280} />
        </div>

        <div className="relative flex items-center gap-4 sm:gap-6">
          <div className="shrink-0">
            <TeamLogo teamId={team.teamId} tricode={team.tricode} size={88} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: team.primaryColor }} />
              {team.tricode} · {team.conference}ern · {team.division}
            </p>
            <h1 className="leading-[0.9] tracking-[-0.03em] mt-1.5">
              <span className="block text-sm sm:text-base font-extralight text-text-secondary">{team.city}</span>
              <span className="block text-3xl sm:text-5xl font-black text-text-primary">{team.name}</span>
            </h1>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {confRank > 0 && (
                <span className={`text-[10px] font-mono uppercase tracking-[0.15em] px-2 py-1 rounded-full font-bold ${
                  confRank <= 6 ? "bg-accent-amber/15 text-accent-amber border border-accent-amber/30" :
                  confRank <= 10 ? "bg-accent/15 text-accent border border-accent/30" :
                  "bg-bg-hover text-text-secondary border border-border"
                }`}>
                  #{confRank} {team.conference}
                </span>
              )}
              <Link href={`/schedule?team=${team.tricode}`} className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary hover:text-accent transition-colors cursor-pointer">
                → {t.teamPage.scheduleLink}
              </Link>
              <FavoriteButton type="team" id={team.tricode} />
            </div>
          </div>
        </div>

        {/* KPI strip — hairline cells, oversized numerals */}
        <div className="relative grid grid-cols-2 sm:grid-cols-5 mt-8 border-t border-border">
          <TeamKpiCell label="Record" value={
            <><span className="text-success">{wins}</span><span className="text-text-secondary/40 mx-1">–</span><span className="text-danger">{losses}</span></>
          } />
          <TeamKpiCell label="Win %" value={<span className="text-accent-amber">{winPct}%</span>} />
          <TeamKpiCell label={t.teamPage.last10} value={
            <><span className="text-success">{w10}</span><span className="text-text-secondary/40 mx-1">–</span><span className="text-danger">{l10}</span></>
          } />
          {(playoffWins + playoffLosses > 0) ? (
            <TeamKpiCell label={t.common.playoffs} value={
              <><span className="text-success">{playoffWins}</span><span className="text-text-secondary/40 mx-1">–</span><span className="text-danger">{playoffLosses}</span></>
            } />
          ) : (
            <TeamKpiCell label="Conf" value={<span className="text-text-primary">{team.conference[0]}</span>} />
          )}
          <TeamKpiCell label={t.teamPage.playersCount} value={<span className="text-text-primary">{roster.length}</span>} />
        </div>

        {/* Season Stats */}
        {gamesPlayed > 0 && (
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mt-4">
            <div className="bg-bg-secondary/60 backdrop-blur-sm rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-secondary uppercase">PPG</p>
              <p className="text-lg font-bold text-accent mt-0.5">{ppg}</p>
            </div>
            <div className="bg-bg-secondary/60 backdrop-blur-sm rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-secondary uppercase">OPP PPG</p>
              <p className="text-lg font-bold mt-0.5">{oppPpg}</p>
            </div>
            <div className="bg-bg-secondary/60 backdrop-blur-sm rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-secondary uppercase">{t.teamPage.home}</p>
              <p className="text-lg font-bold mt-0.5">
                <span className="text-success">{homeWins}</span>
                <span className="text-text-secondary mx-0.5">-</span>
                <span className="text-danger">{homeLosses}</span>
              </p>
            </div>
            <div className="bg-bg-secondary/60 backdrop-blur-sm rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-secondary uppercase">{t.teamPage.away}</p>
              <p className="text-lg font-bold mt-0.5">
                <span className="text-success">{awayWins}</span>
                <span className="text-text-secondary mx-0.5">-</span>
                <span className="text-danger">{awayLosses}</span>
              </p>
            </div>
            <div className="bg-bg-secondary/60 backdrop-blur-sm rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-secondary uppercase">{t.teamPage.streak}</p>
              <p className={`text-lg font-bold mt-0.5 ${streakType === "W" ? "text-success" : "text-danger"}`}>
                {streakDisplay}
              </p>
            </div>
            {/* Season Highs */}
            <div className="bg-bg-secondary/60 backdrop-blur-sm rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-secondary uppercase">{t.teamPage.bestStreak}</p>
              <p className="text-lg font-bold text-success mt-0.5">W{longestWinStreak}</p>
            </div>
            <div className="bg-bg-secondary/60 backdrop-blur-sm rounded-lg p-3 text-center">
              <p className="text-[10px] text-text-secondary uppercase">{t.teamPage.worstStreak}</p>
              <p className="text-lg font-bold text-danger mt-0.5">L{longestLossStreak}</p>
            </div>
          </div>
        )}
      </div>

      {/* Season Progression — wins per 10-game segment */}
      {recentGames.length >= 10 && (() => {
        const chronological = [...recentGames].reverse();
        const segments: { label: string; wins: number; total: number }[] = [];
        for (let i = 0; i < chronological.length; i += 10) {
          const chunk = chronological.slice(i, i + 10);
          const w = chunk.filter(g => g.won).length;
          const start = i + 1;
          const end = Math.min(i + 10, chronological.length);
          segments.push({ label: `${start}-${end}`, wins: w, total: chunk.length });
        }
        const maxWins = Math.max(...segments.map(s => s.total), 1);
        return (
          <div className="glass-tile p-4 mt-6">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3">{t.teamPage.seasonProgression}</h3>
            <div className="flex items-end gap-2 h-28">
              {segments.map((seg, i) => {
                const barH = (seg.wins / maxWins) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-bold text-accent">{seg.wins}W</span>
                    <div className="w-full rounded-t relative" style={{ height: `${barH}%`, minHeight: "4px" }}>
                      <div className="w-full h-full bg-accent/70 rounded-t" />
                    </div>
                    <span className="text-[9px] text-text-secondary">{seg.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* vs Division Record */}
      {recentGames.length > 0 && (() => {
        const divisionTeams = new Set(
          Object.values(TEAM_META)
            .filter((tm) => tm.division === team.division && tm.tricode !== team.tricode)
            .map((tm) => tm.tricode)
        );
        let divW = 0, divL = 0, nonDivW = 0, nonDivL = 0;
        for (const g of recentGames) {
          if (divisionTeams.has(g.opponent)) {
            if (g.won) divW++; else divL++;
          } else {
            if (g.won) nonDivW++; else nonDivL++;
          }
        }
        return (
          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="glass-tile p-4 text-center">
              <p className="text-[10px] text-text-secondary uppercase">{t.teamPage.vsDivision}</p>
              <p className="text-xl font-bold mt-1">
                <span className="text-success">{divW}</span>
                <span className="text-text-secondary mx-1">-</span>
                <span className="text-danger">{divL}</span>
              </p>
            </div>
            <div className="glass-tile p-4 text-center">
              <p className="text-[10px] text-text-secondary uppercase">{t.teamPage.vsNonDivision}</p>
              <p className="text-xl font-bold mt-1">
                <span className="text-success">{nonDivW}</span>
                <span className="text-text-secondary mx-1">-</span>
                <span className="text-danger">{nonDivL}</span>
              </p>
            </div>
          </div>
        );
      })()}

      {/* Recent Opponents */}
      {recentGames.length > 0 && (
        <div className="glass-tile p-4 mt-6">
          <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3">{t.teamPage.recentOpponents}</h3>
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
        <div className="glass-tile p-4 mt-6">
          <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3">{t.teamPage.offVsDef}</h3>
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
      {recentGames.length > 0 && (
        <PointDiffChart
          games={recentGames}
          title={`${t.teamPage.pointDiff} · ${t.teamPage.lastNGames.replace("%s", String(Math.min(recentGames.length, 15)))}`}
          teamColor={team.primaryColor}
          count={15}
        />
      )}

      {/* Last 10 Games W/L Streak */}
      {recentGames.length > 0 && (
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
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Recent Games */}
        <div className="glass-tile overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Calendar size={16} className="text-accent" />
            <h2 className="font-semibold text-sm">{t.teamPage.recentGames}</h2>
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
                <span className="text-sm font-medium font-mono tabular-nums">{g.score}</span>
                <span className="text-xs text-text-secondary">{g.date.slice(5)}</span>
              </Link>
            ))}
            {recentGames.length === 0 && (
              <p className="px-4 py-6 text-center text-text-secondary text-sm">{t.teamPage.noCompletedGames}</p>
            )}
          </div>
        </div>

        {/* Upcoming Games */}
        <div className="glass-tile overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Trophy size={16} className="text-accent" />
            <h2 className="font-semibold text-sm">{t.teamPage.upcomingGames}</h2>
            {upcomingGames.length > 0 && (() => {
              // Compute average opponent win% for schedule difficulty
              const oppRecords: Record<string, { w: number; l: number }> = {};
              for (const gd of schedule) {
                for (const g of gd.games) {
                  if (g.gameStatus !== 3) continue;
                  if (!g.gameId.startsWith("002")) continue; // regular season only
                  const ht = g.homeTeam.teamTricode;
                  const at = g.awayTeam.teamTricode;
                  if (!oppRecords[ht]) oppRecords[ht] = { w: 0, l: 0 };
                  if (!oppRecords[at]) oppRecords[at] = { w: 0, l: 0 };
                  if (g.homeTeam.score > g.awayTeam.score) { oppRecords[ht].w++; oppRecords[at].l++; }
                  else { oppRecords[at].w++; oppRecords[ht].l++; }
                }
              }
              let totalWinPct = 0, count = 0;
              for (const ug of upcomingGames.slice(0, 8)) {
                const rec = oppRecords[ug.opponent];
                if (rec && rec.w + rec.l > 0) {
                  totalWinPct += rec.w / (rec.w + rec.l);
                  count++;
                }
              }
              if (count === 0) return null;
              const avgWinPct = totalWinPct / count;
              const diffLabel = avgWinPct > 0.55 ? t.teamPage.toughSchedule : avgWinPct < 0.45 ? t.teamPage.easySchedule : t.teamPage.average;
              const diffColor = avgWinPct > 0.55 ? "text-danger bg-danger/10" : avgWinPct < 0.45 ? "text-success bg-success/10" : "text-text-secondary bg-bg-hover";
              return (
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium ${diffColor}`}>
                  {diffLabel} ({(avgWinPct * 100).toFixed(0)}% opp W%)
                </span>
              );
            })()}
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
              <p className="px-4 py-6 text-center text-text-secondary text-sm">{t.teamPage.noUpcomingGames}</p>
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
          <div className="glass-tile p-4 mt-6">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3">{t.teamPage.monthlyRecord}</h3>
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
                  <p className="text-[10px] text-text-secondary mb-1">{t.teamPage.winPctTrend}</p>
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
        <div className="glass-tile overflow-hidden mt-6">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Trophy size={16} className="text-accent" />
            <h2 className="font-semibold text-sm">{t.h2hPage.title}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary text-xs">
                  <th className="text-left py-3 px-4">{t.teamPage.opponent}</th>
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
          <div className="glass-tile p-4 mt-6">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3">{t.teamPage.positionBreakdown}</h3>
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

      {/* Top Scorers */}
      {roster.length >= 3 && (
        <div className="glass-tile p-4 mt-6">
          <h3 className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-3">{t.teamPage.topScorers}</h3>
          <div className="grid grid-cols-3 gap-3">
            {roster.slice(0, 3).map((p) => (
              <Link key={p.personId} href={`/player/${p.personId}`} className="flex flex-col items-center gap-2 bg-bg-secondary rounded-lg p-3 hover:bg-bg-hover transition-colors">
                <PlayerHeadshot personId={p.personId} name={`${p.firstName} ${p.lastName}`} size={48} />
                <span className="text-sm font-medium text-text-primary text-center">{p.firstName} {p.lastName}</span>
                <span className="text-lg font-bold text-accent">{p.pts} <span className="text-xs text-text-secondary font-normal">PPG</span></span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Roster */}
      <div className="glass-tile overflow-hidden mt-6">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Users size={16} className="text-accent" />
          <h2 className="font-semibold text-sm">{t.teamPage.roster}</h2>
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

function TeamKpiCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="relative py-4 sm:py-5 px-3 sm:px-4 [&:not(:first-child)]:before:absolute [&:not(:first-child)]:before:left-0 [&:not(:first-child)]:before:top-3 [&:not(:first-child)]:before:bottom-3 [&:not(:first-child)]:before:w-px [&:not(:first-child)]:before:bg-border [&:not(:first-child)]:before:content-['']">
      <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-text-secondary">{label}</p>
      <p className="text-2xl sm:text-3xl font-light font-mono tabular-nums mt-1.5 leading-none">
        {value}
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFullSchedule, getPlayerIndex, formatDate } from "@/lib/api";
import { TEAM_META } from "@/lib/teams";
import { teamLogoUrl } from "@/lib/teamUrls";
import { isRegular, isPlayoff, winPct as calcWinPct } from "@/lib/games";
import { conferenceRank } from "@/lib/team-rank";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";
import PointDiffChart from "@/components/PointDiffChart";
import { Users, Trophy, TrendingUp, Activity, Crown } from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import RecentVisitTracker from "@/components/RecentVisitTracker";
import RelatedPages from "@/components/RelatedPages";
import TeamHero from "./_components/TeamHero";
import TeamPace from "./_components/TeamPace";
import TeamStatsPanel from "./_components/TeamStatsPanel";
import Last10Streak from "./_components/Last10Streak";
import TeamScheduleCard, { type RecentGame, type UpcomingGame } from "./_components/TeamScheduleCard";
import TeamTrendsPanel, { type Rivalry } from "./_components/TeamTrendsPanel";
import TeamRoster from "./_components/TeamRoster";
import TeamLegends from "./_components/TeamLegends";

export async function generateMetadata({ params }: { params: Promise<{ tricode: string }> }): Promise<Metadata> {
  const { tricode } = await params;
  const [team, locale] = [TEAM_META[tricode.toUpperCase()], await getLocale()];
  const t = getTranslations(locale);
  if (!team) return {};
  return {
    title: `${team.city} ${team.name}`,
    description: locale === "zh" ? t.teamPage.teamDesc : t.teamPage.teamDescEn,
    alternates: { canonical: `/team/${team.tricode}` },
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
  const isZh = locale === "zh";

  const [schedule, playerIndex] = await Promise.all([
    getFullSchedule().catch(() => []),
    getPlayerIndex().catch(() => []),
  ]);

  // Compute team record and games
  const today = formatDate(new Date());
  let wins = 0, losses = 0;
  let playoffWins = 0, playoffLosses = 0;
  const recentGames: RecentGame[] = [];
  const upcomingGames: UpcomingGame[] = [];
  // Build league-wide W/L map in the same pass (used later for conference ranking
  // and upcoming-opponent strength-of-schedule).
  const teamRecordMap: Record<string, { w: number; l: number }> = {};

  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus === 3 && isRegular(g.gameId)) {
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
        const isRegularSeason = isRegular(g.gameId);
        // Only count regular season games for W/L record
        if (isRegularSeason) {
          if (won) wins++; else losses++;
        } else if (isPlayoff(g.gameId)) {
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
  const h2hMap: Record<string, Rivalry> = {};
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

  // Roster (sorted by PPG desc)
  const roster = playerIndex
    .filter((p) => p.teamAbbr === team.tricode)
    .sort((a, b) => b.pts - a.pts);

  const winPct = wins + losses > 0 ? (calcWinPct(wins, losses) * 100).toFixed(1) : "0.0";

  // Conference rank uses teamRecordMap built in the schedule pass above — no
  // extra iteration over the schedule.
  const confRank = conferenceRank(team, teamRecordMap);

  const last10 = recentGames.slice(0, 10);
  const w10 = last10.filter((g) => g.won).length;
  const l10 = last10.length - w10;

  // Upcoming-opponent schedule difficulty badge (average opp W%) — reuses
  // teamRecordMap so no second schedule pass needed.
  const upcomingDifficulty = (() => {
    if (upcomingGames.length === 0) return null;
    let totalWinPct = 0, count = 0;
    for (const ug of upcomingGames.slice(0, 8)) {
      const rec = teamRecordMap[ug.opponent];
      if (rec && rec.w + rec.l > 0) {
        totalWinPct += rec.w / (rec.w + rec.l);
        count++;
      }
    }
    if (count === 0) return null;
    const avgWinPct = totalWinPct / count;
    const label = avgWinPct > 0.55 ? t.teamPage.toughSchedule : avgWinPct < 0.45 ? t.teamPage.easySchedule : t.teamPage.average;
    const colorClass = avgWinPct > 0.55 ? "text-danger bg-danger/10" : avgWinPct < 0.45 ? "text-success bg-success/10" : "text-text-secondary bg-bg-hover";
    return { label, avgWinPct, colorClass };
  })();

  // JSON-LD structured data — SportsTeam schema for rich snippets
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name: `${team.city} ${team.name}`,
    sport: "Basketball",
    url: `https://nba.xpy.me/team/${team.tricode}`,
    logo: teamLogoUrl(team.teamId),
    location: {
      "@type": "Place",
      name: team.city,
      address: { "@type": "PostalAddress", addressLocality: team.city, addressCountry: "US" },
    },
    memberOf: [
      { "@type": "SportsOrganization", name: `${team.conference}ern Conference`, url: "https://www.nba.com" },
      { "@type": "SportsOrganization", name: `${team.division} Division`, url: "https://www.nba.com" },
    ],
    parentOrganization: {
      "@type": "SportsOrganization",
      name: "NBA",
      url: "https://www.nba.com",
    },
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <RecentVisitTracker
        kind="team"
        id={team.tricode}
        label={`${team.city} ${team.name}`}
      />
      <Breadcrumbs
        items={[
          { label: isZh ? "球队" : "Teams", href: "/standings" },
          { label: `${team.city} ${team.name}` },
        ]}
      />

      <TeamHero
        team={team} t={t}
        wins={wins} losses={losses} winPct={winPct} w10={w10} l10={l10}
        playoffWins={playoffWins} playoffLosses={playoffLosses}
        rosterCount={roster.length} confRank={confRank}
        gamesPlayed={gamesPlayed} ppg={ppg} oppPpg={oppPpg}
        homeWins={homeWins} homeLosses={homeLosses}
        awayWins={awayWins} awayLosses={awayLosses}
        streakType={streakType} streakDisplay={streakDisplay}
        longestWinStreak={longestWinStreak} longestLossStreak={longestLossStreak}
      />

      <TeamPace wins={wins} losses={losses} w10={w10} l10={l10} t={t} />

      <TeamStatsPanel team={team} t={t} recentGames={recentGames} gamesPlayed={gamesPlayed} ppg={ppg} oppPpg={oppPpg} />

      {/* Point Differential Chart (last 15 games) */}
      {recentGames.length > 0 && (
        <PointDiffChart
          games={recentGames}
          title={`${t.teamPage.pointDiff} · ${t.teamPage.lastNGames.replace("%s", String(Math.min(recentGames.length, 15)))}`}
          teamColor={team.primaryColor}
          count={15}
        />
      )}

      <Last10Streak recentGames={recentGames} t={t} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <TeamScheduleCard mode="recent" t={t} games={recentGames} />
        <TeamScheduleCard mode="upcoming" t={t} games={upcomingGames} difficulty={upcomingDifficulty} />
      </div>

      <TeamTrendsPanel t={t} recentGames={recentGames} rivalries={rivalries} />

      <TeamRoster roster={roster} t={t} />

      {/* Map current franchises to their historical aliases for the legacy
          tricodes that appear in our hand-curated datasets. */}
      <TeamLegends
        tricode={team.tricode}
        legacyAliases={
          team.tricode === "UTA" ? ["NOJ"]
            : team.tricode === "ATL" ? ["STL"]
            : team.tricode === "BKN" ? ["NJN"]
            : []
        }
        isZh={isZh}
      />

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/standings", label: isZh ? "完整排名" : "Full standings", icon: Trophy },
          { href: "/power-rankings", label: isZh ? "实力榜" : "Power rankings", icon: TrendingUp },
          { href: "/streaks", label: isZh ? "连胜连败" : "Streaks", icon: Activity },
          { href: "/divisions", label: isZh ? "分区对比" : "Divisions", icon: Users },
          { href: "/momentum", label: isZh ? "球队趋势" : "Team momentum", icon: Activity },
          { href: "/tier-list", label: isZh ? "球队分级" : "Tier list", icon: Crown },
        ]}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getBoxScore, getPlayerIndex, extractShots, type PlayerInfo } from "@/lib/api";
import type { PlayAction } from "@/components/PlayByPlay";
import { getSeasonRank } from "@/lib/season-ranks";
import { isPlayoff } from "@/lib/games";
import QuarterBars from "@/components/QuarterBars";
import TeamCompare from "@/components/TeamCompare";
import GameAutoRefresh from "@/components/GameAutoRefresh";
import Breadcrumbs from "@/components/Breadcrumbs";
import RecentVisitTracker from "@/components/RecentVisitTracker";
import RelatedPages from "@/components/RelatedPages";
import EmptyState from "@/components/EmptyState";
import { Users, GitCompareArrows, Trophy, Calendar, Crown, Clock } from "lucide-react";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";

import GameHero from "./_components/GameHero";
import GameStickyScore from "./_components/GameStickyScore";
import GameHeadlines from "./_components/GameHeadlines";
import GameLeaders from "./_components/GameLeaders";
import GameMeta from "./_components/GameMeta";
import StatsRadar from "./_components/StatsRadar";
import ShootingEfficiency from "./_components/ShootingEfficiency";
import BoxScoreSection from "./_components/BoxScoreSection";
import ShotChartSection from "./_components/ShotChartSection";
import PlayByPlaySection from "./_components/PlayByPlaySection";
import KeyMomentsSection from "./_components/KeyMomentsSection";
import ReplaySection from "./_components/ReplaySection";
import ScoringFlowSection from "./_components/ScoringFlowSection";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const [box, locale] = await Promise.all([getBoxScore(id), getLocale()]);
  const t = getTranslations(locale);
  if (!box) return {};
  const away = box.awayTeam;
  const home = box.homeTeam;
  const score = box.gameStatus >= 2 ? ` ${away.score}-${home.score}` : "";
  const desc =
    locale === "zh"
      ? `${away.teamCity} ${away.teamName} vs ${home.teamCity} ${home.teamName} — Box Score、投篮图、逐球回放。`
      : `${away.teamCity} ${away.teamName} vs ${home.teamCity} ${home.teamName} — ${t.gameDetail.boxScore}, ${t.gameDetail.shotChart}, ${t.gameDetail.playByPlay}.`;
  return {
    title: `${away.teamTricode} vs ${home.teamTricode}${score}`,
    description: desc,
    alternates: { canonical: `/game/${id}` },
    openGraph: {
      title: `${away.teamTricode}${score ? " " + away.score : ""} vs ${home.teamTricode}${score ? " " + home.score : ""} | NBA Tracker`,
      description: `${away.teamCity} ${away.teamName} vs ${home.teamCity} ${home.teamName}`,
    },
  };
}

export default async function GamePage({ params }: PageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const t = getTranslations(locale);

  // Box score + player index + raw PBP + season-wide rank in parallel.
  // PBP comes straight from cdn.nba.com (the only place exposing score events
  // with clocks); shots are derived from the same payload — one download, not
  // two. Season rank reads the schedule cache only — no extra fetch.
  const [boxScore, playerIndex, pbpActions, seasonRank] = await Promise.all([
    getBoxScore(id),
    getPlayerIndex().catch(() => []),
    fetch(`https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${id}.json`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", Referer: "https://www.nba.com/" },
      next: { revalidate: 60 },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.game?.actions || [])
      .catch(() => []),
    getSeasonRank(id).catch(() => null),
  ]);

  const shots = extractShots(pbpActions);

  const scoreEvents = (pbpActions as { period: number; clock: string; scoreHome: string; scoreAway: string }[])
    .filter((a) => a.scoreHome != null && a.scoreAway != null)
    .map((a) => ({
      period: a.period,
      clock: a.clock,
      scoreHome: parseInt(a.scoreHome) || 0,
      scoreAway: parseInt(a.scoreAway) || 0,
    }));

  // Trim raw CDN actions to the fields the client components actually read —
  // the full objects (~2x larger) would otherwise be serialized into the page payload.
  const slimActions: PlayAction[] = pbpActions.map((a: PlayAction) => ({
    actionNumber: a.actionNumber,
    clock: a.clock,
    period: a.period,
    teamTricode: a.teamTricode,
    actionType: a.actionType,
    subType: a.subType,
    description: a.description,
    personId: a.personId,
    playerNameI: a.playerNameI,
    shotResult: a.shotResult,
    scoreHome: a.scoreHome,
    scoreAway: a.scoreAway,
    isFieldGoal: a.isFieldGoal,
  }));

  const playerInfoMap = new Map<number, PlayerInfo>();
  for (const pi of playerIndex) playerInfoMap.set(pi.personId, pi);

  const isZh = locale === "zh";

  if (!boxScore) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Link href="/" className="text-sm text-text-secondary hover:text-accent transition-colors">
          &larr; {t.common.back}
        </Link>
        <div className="mt-6">
          <EmptyState
            icon={Clock}
            title={isZh ? "比赛尚未开始" : "Game hasn't tipped off yet"}
            description={isZh ? "比分和数据将在比赛开始后显示" : "Stats appear once the game starts"}
            action={{ href: "/", label: isZh ? "查看其他比赛" : "Other games" }}
          />
        </div>
      </div>
    );
  }

  const isFinal = boxScore.gameStatus === 3;
  const isPlayoffs = isPlayoff(boxScore.gameId);
  const dateFromCode = boxScore.gameCode.split("/")[0];
  const backDate = `${dateFromCode.slice(0, 4)}-${dateFromCode.slice(4, 6)}-${dateFromCode.slice(6, 8)}`;

  // Breadcrumbs differ for playoffs (show series + game number)
  const seriesId = isPlayoffs ? boxScore.gameId.slice(0, 9) : "";
  const gameNum = isPlayoffs ? parseInt(boxScore.gameId.charAt(9), 10) : 0;
  const breadcrumbItems = isPlayoffs
    ? [
        { label: isZh ? "季后赛" : "Playoffs", href: "/" },
        { label: `${boxScore.awayTeam.teamTricode} vs ${boxScore.homeTeam.teamTricode}`, href: `/series/${seriesId}` },
        { label: isZh ? `第 ${gameNum} 场` : `Game ${gameNum}` },
      ]
    : [
        { label: isZh ? "比赛" : "Games", href: "/" },
        { label: `${boxScore.awayTeam.teamTricode} @ ${boxScore.homeTeam.teamTricode} · ${backDate}` },
      ];

  const relatedPages = [
    { href: `/team/${boxScore.homeTeam.teamTricode}`, label: `${boxScore.homeTeam.teamTricode} ${isZh ? "球队主页" : "team page"}`, icon: Users },
    { href: `/team/${boxScore.awayTeam.teamTricode}`, label: `${boxScore.awayTeam.teamTricode} ${isZh ? "球队主页" : "team page"}`, icon: Users },
    { href: `/h2h?t1=${boxScore.homeTeam.teamTricode}&t2=${boxScore.awayTeam.teamTricode}`, label: isZh ? "历史交锋" : "Head-to-head", icon: GitCompareArrows },
    ...(isPlayoffs ? [{ href: `/series/${seriesId}`, label: isZh ? "整个系列赛" : "Full series", icon: Trophy }] : []),
    { href: `/?date=${backDate}`, label: isZh ? "当天其他比赛" : "Other games that day", icon: Calendar },
    { href: "/records", label: isZh ? "赛季纪录" : "Season records", icon: Crown },
  ];

  const allPlayers = [
    ...boxScore.awayTeam.players
      .filter((p) => p.played === "1")
      .map((p) => ({ personId: p.personId, nameI: p.nameI, teamTricode: boxScore.awayTeam.teamTricode })),
    ...boxScore.homeTeam.players
      .filter((p) => p.played === "1")
      .map((p) => ({ personId: p.personId, nameI: p.nameI, teamTricode: boxScore.homeTeam.teamTricode })),
  ];

  // JSON-LD structured data — SportsEvent schema for rich snippets
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${boxScore.awayTeam.teamCity} ${boxScore.awayTeam.teamName} vs ${boxScore.homeTeam.teamCity} ${boxScore.homeTeam.teamName}`,
    sport: "Basketball",
    startDate: boxScore.gameTimeUTC,
    eventStatus: isFinal
      ? "https://schema.org/EventCompleted"
      : boxScore.gameStatus === 2
      ? "https://schema.org/EventScheduled"
      : "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: boxScore.arena.arenaName,
      address: { "@type": "PostalAddress", addressLocality: boxScore.arena.arenaCity },
    },
    homeTeam: {
      "@type": "SportsTeam",
      name: `${boxScore.homeTeam.teamCity} ${boxScore.homeTeam.teamName}`,
      url: `https://nba.xpy.me/team/${boxScore.homeTeam.teamTricode}`,
    },
    awayTeam: {
      "@type": "SportsTeam",
      name: `${boxScore.awayTeam.teamCity} ${boxScore.awayTeam.teamName}`,
      url: `https://nba.xpy.me/team/${boxScore.awayTeam.teamTricode}`,
    },
    organizer: { "@type": "SportsOrganization", name: "NBA", url: "https://www.nba.com" },
    ...(isFinal && {
      description: `${boxScore.awayTeam.teamTricode} ${boxScore.awayTeam.score}, ${boxScore.homeTeam.teamTricode} ${boxScore.homeTeam.score} — Final`,
    }),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <RecentVisitTracker
        kind="game"
        id={id}
        label={`${boxScore.awayTeam.teamTricode} @ ${boxScore.homeTeam.teamTricode}`}
      />
      <Breadcrumbs items={breadcrumbItems} />
      <GameAutoRefresh isLive={boxScore.gameStatus === 2} />

      <GameHero boxScore={boxScore} shots={shots} isPlayoffs={isPlayoffs} t={t} />
      <div id="game-hero-sentinel" />
      <GameStickyScore
        awayTricode={boxScore.awayTeam.teamTricode}
        awayScore={boxScore.awayTeam.score}
        awayTeamId={boxScore.awayTeam.teamId}
        homeTricode={boxScore.homeTeam.teamTricode}
        homeScore={boxScore.homeTeam.score}
        homeTeamId={boxScore.homeTeam.teamId}
        statusText={boxScore.gameStatusText}
      />

      {isFinal && boxScore.homeTeam.periods?.length > 0 && (
        <QuarterBars
          homePeriods={boxScore.homeTeam.periods}
          awayPeriods={boxScore.awayTeam.periods}
          homeTricode={boxScore.homeTeam.teamTricode}
          awayTricode={boxScore.awayTeam.teamTricode}
        />
      )}
      {isFinal && <ScoringFlowSection homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} scoreEvents={scoreEvents} />}

      {isFinal && <GameMeta homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} t={t} />}

      {isFinal && <GameHeadlines homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} shots={shots} seasonRank={seasonRank} t={t} />}

      {isFinal && <GameLeaders homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} playerInfoMap={playerInfoMap} t={t} />}

      {/* Replay links — streamed (Supabase fetch is independent) */}
      <Suspense fallback={null}>
        <ReplaySection gameId={id} t={t} />
      </Suspense>

      {isFinal && (
        <div className="mt-6">
          <TeamCompare homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} />
        </div>
      )}

      {isFinal && <StatsRadar homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} t={t} />}

      {isFinal && <ShootingEfficiency homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} t={t} />}

      {isFinal && <KeyMomentsSection actions={slimActions} />}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <ShotChartSection
            shots={shots}
            homeTricode={boxScore.homeTeam.teamTricode}
            awayTricode={boxScore.awayTeam.teamTricode}
            allPlayers={allPlayers}
            t={t}
          />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <BoxScoreSection team={boxScore.awayTeam} shots={shots} playerInfoMap={playerInfoMap} t={t} />
          <BoxScoreSection team={boxScore.homeTeam} shots={shots} playerInfoMap={playerInfoMap} t={t} />
        </div>
      </div>

      <div className="mt-6">
        <PlayByPlaySection actions={slimActions} />
      </div>

      <RelatedPages eyebrow={isZh ? "继续探索" : "Keep exploring"} pages={relatedPages} />
    </div>
  );
}

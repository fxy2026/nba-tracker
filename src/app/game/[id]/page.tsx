import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getBoxScore, getPlayerIndex, getFullSchedule, extractShots, toBeijingTime, type PlayerInfo, type ScheduleGame } from "@/lib/api";
import type { PlayAction } from "@/components/PlayByPlay";
import { getSeasonRank } from "@/lib/season-ranks";
import { isPlayoff, findScheduleGame } from "@/lib/games";
import { buildRecap } from "@/lib/recap";
import TeamLogo from "@/components/TeamLogo";
import GameCountdown from "@/components/GameCountdown";
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
import GameRecap from "./_components/GameRecap";
import GamePreview from "./_components/GamePreview";
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
  if (!box) {
    // Upcoming games often have no box score yet — fall back to the schedule
    // cache so preview pages still carry real metadata before tipoff.
    const sg = findScheduleGame(await getFullSchedule().catch(() => []), id);
    if (!sg) return {};
    const a = sg.awayTeam;
    const h = sg.homeTeam;
    return {
      title: `${a.teamTricode} vs ${h.teamTricode}`,
      description:
        locale === "zh"
          ? `${a.teamCity} ${a.teamName} vs ${h.teamCity} ${h.teamName} 比赛前瞻 — 战绩对比、近期状态、交手记录与伤病情况。`
          : `${a.teamCity} ${a.teamName} vs ${h.teamCity} ${h.teamName} game preview — records, recent form, season series and injury report.`,
      alternates: { canonical: `/game/${id}` },
    };
  }
  const away = box.awayTeam;
  const home = box.homeTeam;
  const score = box.gameStatus >= 2 ? ` ${away.score}-${home.score}` : "";
  let desc =
    locale === "zh"
      ? `${away.teamCity} ${away.teamName} vs ${home.teamCity} ${home.teamName} — Box Score、投篮图、逐球回放。`
      : `${away.teamCity} ${away.teamName} vs ${home.teamCity} ${home.teamName} — ${t.gameDetail.boxScore}, ${t.gameDetail.shotChart}, ${t.gameDetail.playByPlay}.`;
  if (box.gameStatus === 1) {
    desc =
      locale === "zh"
        ? `${away.teamCity} ${away.teamName} vs ${home.teamCity} ${home.teamName} 比赛前瞻 — 战绩对比、近期状态、交手记录与伤病情况。`
        : `${away.teamCity} ${away.teamName} vs ${home.teamCity} ${home.teamName} game preview — records, recent form, season series and injury report.`;
  } else if (box.gameStatus === 3) {
    // Title + opener of the auto recap are derived from the box score alone
    // (no play-by-play), so this matches what the page renders.
    const recap = buildRecap(box, []);
    if (recap) {
      const r = locale === "zh" ? recap.zh : recap.en;
      desc = `${r.title}${locale === "zh" ? "。" : ". "}${r.paragraphs[0] || ""}`.slice(0, 180);
    }
  }
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
    // zh text-feed templating inputs (see describeAction in PlayByPlay.tsx).
    // Qualifiers are trimmed to the two the templates read — the raw array
    // carries noise like "pointsinthepaint" on most shots.
    descriptor: a.descriptor || undefined,
    qualifiers: a.qualifiers?.filter((q) => q === "fastbreak" || q === "2ndchance"),
    assistPlayerNameInitial: a.assistPlayerNameInitial || undefined,
    shotDistance: a.shotDistance || undefined,
  }));

  const playerInfoMap = new Map<number, PlayerInfo>();
  for (const pi of playerIndex) playerInfoMap.set(pi.personId, pi);

  const isZh = locale === "zh";

  if (!boxScore) {
    // No box score yet (CDN publishes it close to tipoff) — if the schedule
    // knows the game, show a full pre-game preview instead of an empty state.
    const sg = findScheduleGame(await getFullSchedule().catch(() => []), id);
    if (sg && sg.gameStatus === 1) {
      // The schedule feed carries arena fields the typed interface doesn't declare
      const arena = sg as ScheduleGame & { arenaName?: string; arenaCity?: string };
      const beijingTime = toBeijingTime(sg.gameDateTimeUTC);
      return (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Breadcrumbs
            items={[
              { label: isZh ? "比赛" : "Games", href: "/" },
              { label: `${sg.awayTeam.teamTricode} @ ${sg.homeTeam.teamTricode}` },
            ]}
          />
          <div className="glass-tile glass-tile-featured p-5 sm:p-6 mt-4">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary">
                <span>{isZh ? "未开始" : "Upcoming"}</span>
                {beijingTime && <span className="text-text-secondary/60">· {beijingTime}</span>}
              </div>
              <GameCountdown gameTimeUTC={sg.gameDateTimeUTC} />
            </div>
            <div className="flex items-center justify-center gap-6 sm:gap-10 py-4">
              <div className="flex flex-col items-center gap-2 flex-1 max-w-[180px]">
                <TeamLogo teamId={sg.awayTeam.teamId} tricode={sg.awayTeam.teamTricode} size={64} />
                <Link href={`/team/${sg.awayTeam.teamTricode}`} className="text-center hover:text-accent transition-colors">
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary">Away</p>
                  <p className="font-bold text-sm">{sg.awayTeam.teamCity}</p>
                  <p className="font-bold text-sm">{sg.awayTeam.teamName}</p>
                </Link>
              </div>
              <span className="text-3xl sm:text-4xl font-extralight text-text-secondary/30">–</span>
              <div className="flex flex-col items-center gap-2 flex-1 max-w-[180px]">
                <TeamLogo teamId={sg.homeTeam.teamId} tricode={sg.homeTeam.teamTricode} size={64} />
                <Link href={`/team/${sg.homeTeam.teamTricode}`} className="text-center hover:text-accent transition-colors">
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary">Home</p>
                  <p className="font-bold text-sm">{sg.homeTeam.teamCity}</p>
                  <p className="font-bold text-sm">{sg.homeTeam.teamName}</p>
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <Suspense fallback={<div className="h-64 glass-tile skeleton-shimmer" />}>
              <GamePreview
                home={{ tricode: sg.homeTeam.teamTricode, teamId: sg.homeTeam.teamId, teamCity: sg.homeTeam.teamCity, teamName: sg.homeTeam.teamName }}
                away={{ tricode: sg.awayTeam.teamTricode, teamId: sg.awayTeam.teamId, teamCity: sg.awayTeam.teamCity, teamName: sg.awayTeam.teamName }}
                gameTimeUTC={sg.gameDateTimeUTC}
                arenaName={arena.arenaName}
                arenaCity={arena.arenaCity}
                isZh={isZh}
              />
            </Suspense>
          </div>
          <RelatedPages
            eyebrow={isZh ? "继续探索" : "Keep exploring"}
            pages={[
              { href: `/team/${sg.homeTeam.teamTricode}`, label: `${sg.homeTeam.teamTricode} ${isZh ? "球队主页" : "team page"}`, icon: Users },
              { href: `/team/${sg.awayTeam.teamTricode}`, label: `${sg.awayTeam.teamTricode} ${isZh ? "球队主页" : "team page"}`, icon: Users },
              { href: `/h2h?t1=${sg.homeTeam.teamTricode}&t2=${sg.awayTeam.teamTricode}`, label: isZh ? "历史交锋" : "Head-to-head", icon: GitCompareArrows },
              { href: "/schedule", label: isZh ? "完整赛程" : "Full schedule", icon: Calendar },
            ]}
          />
        </div>
      );
    }
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
  const isUpcoming = boxScore.gameStatus === 1;
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

      {isFinal && <GameRecap boxScore={boxScore} actions={slimActions} isPlayoffs={isPlayoffs} isZh={isZh} />}

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

      {isUpcoming ? (
        /* Pre-game: the box score is an empty shell, so swap the stats body for the preview */
        <div className="mt-6">
          <Suspense fallback={<div className="h-64 glass-tile skeleton-shimmer" />}>
            <GamePreview
              home={{ tricode: boxScore.homeTeam.teamTricode, teamId: boxScore.homeTeam.teamId, teamCity: boxScore.homeTeam.teamCity, teamName: boxScore.homeTeam.teamName }}
              away={{ tricode: boxScore.awayTeam.teamTricode, teamId: boxScore.awayTeam.teamId, teamCity: boxScore.awayTeam.teamCity, teamName: boxScore.awayTeam.teamName }}
              gameTimeUTC={boxScore.gameTimeUTC}
              arenaName={boxScore.arena.arenaName}
              arenaCity={boxScore.arena.arenaCity}
              isZh={isZh}
            />
          </Suspense>
        </div>
      ) : (
        <>
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
            <PlayByPlaySection actions={slimActions} isLive={boxScore.gameStatus === 2} />
          </div>
        </>
      )}

      <RelatedPages eyebrow={isZh ? "继续探索" : "Keep exploring"} pages={relatedPages} />
    </div>
  );
}

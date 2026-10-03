import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { resolveArchiveGameId } from "@/lib/archive-game-alias";
import { Suspense } from "react";
import Link from "next/link";
import { getBoxScore, getPlayerIndex, getFullSchedule, toBeijingTime, type PlayerInfo, type ScoringShot } from "@/lib/api";
import { getGamePlayByPlay } from "@/lib/game-play-by-play";
import WithPlayByPlay from "./_components/WithPlayByPlay";
import { isPlayoff, findScheduleGame } from "@/lib/games";
import { buildRecap } from "@/lib/recap";
import QuarterBars from "@/components/QuarterBars";
import TeamLogo from "@/components/TeamLogo";
import TeamCompare from "@/components/TeamCompare";
import GameAutoRefresh from "@/components/GameAutoRefresh";
import Breadcrumbs from "@/components/Breadcrumbs";
import RecentVisitTracker from "@/components/RecentVisitTracker";
import RelatedPages from "@/components/RelatedPages";
import EmptyState from "@/components/EmptyState";
import { Users, GitCompareArrows, Trophy, Calendar, Crown, Clock } from "lucide-react";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";

import { isPlayerBoxQuarantined } from "@/lib/player-box-quarantine";
import { getProviderPlayerBox } from "@/lib/provider-player-archive";
import ProviderPlayerBox from "./_components/ProviderPlayerBox";
import { getRecoveredPlayerBox } from "@/lib/recovered-player-box-archive";
import RecoveredPlayerBox from "./_components/RecoveredPlayerBox";
import OfficialGameReport from "./_components/OfficialGameReport";
import { getReportedScoreSequence } from "@/lib/reported-score-sequence-archive";
import ReportedScoreSequence from "./_components/ReportedScoreSequence";
import { getOfficialPeriodScores } from "@/lib/official-period-score-archive";
import OfficialPeriodScores from "./_components/OfficialPeriodScores";
import { getVerifiedShotChart } from "@/lib/verified-shot-chart-archive";
import VerifiedShotChartSection from "./_components/VerifiedShotChartSection";
import GameHero from "./_components/GameHero";
import PreGameHero from "./_components/PreGameHero";
import GameStickyScore from "./_components/GameStickyScore";
import GameHeadlines from "./_components/GameHeadlines";
import SeasonRankBadge from "./_components/SeasonRankBadge";
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
import MatchupSection from "./_components/MatchupSection";
import ReplaySection from "./_components/ReplaySection";
import ScoringFlowSection from "./_components/ScoringFlowSection";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id: requestedId } = await params;
  const id = resolveArchiveGameId(requestedId);
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
  const { id: requestedId } = await params;
  const id = resolveArchiveGameId(requestedId);
  if (id !== requestedId) permanentRedirect(`/game/${id}`);
  const locale = await getLocale();
  const t = getTranslations(locale);

  const [boxScore, playerIndex] = await Promise.all([
    getBoxScore(id),
    getPlayerIndex().catch(() => []),
  ]);
  // Start one optional request without awaiting it on the basic data path.
  const pbp = boxScore && boxScore.gameStatus >= 2 ? getGamePlayByPlay(id) : null;

  const playerInfoMap = new Map<number, PlayerInfo>();
  for (const pi of playerIndex) playerInfoMap.set(pi.personId, pi);

  const isZh = locale === "zh";

  if (!boxScore) {
    // No box score yet (CDN publishes it close to tipoff) — if the schedule
    // knows the game, show a full pre-game preview instead of an empty state.
    const sg = findScheduleGame(await getFullSchedule().catch(() => []), id);
    if (sg && sg.gameStatus === 1) {
      const beijingTime = toBeijingTime(sg.gameDateTimeUTC);
      return (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Breadcrumbs
            items={[
              { label: isZh ? "比赛" : "Games", href: "/" },
              { label: `${sg.awayTeam.teamTricode} @ ${sg.homeTeam.teamTricode}` },
            ]}
          />
          <PreGameHero
            away={sg.awayTeam}
            home={sg.homeTeam}
            gameTimeUTC={sg.gameDateTimeUTC}
            beijingTime={beijingTime}
            isZh={isZh}
          />
          <div className="mt-6">
            <Suspense fallback={<div className="min-h-[32rem] glass-tile skeleton-shimmer" />}>
              <GamePreview
                gameId={sg.gameId}
                home={{ tricode: sg.homeTeam.teamTricode, teamId: sg.homeTeam.teamId, teamCity: sg.homeTeam.teamCity, teamName: sg.homeTeam.teamName }}
                away={{ tricode: sg.awayTeam.teamTricode, teamId: sg.awayTeam.teamId, teamCity: sg.awayTeam.teamCity, teamName: sg.awayTeam.teamName }}
                gameTimeUTC={sg.gameDateTimeUTC}
                arenaName={sg.arenaName}
                arenaCity={sg.arenaCity}
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
    if (sg && sg.gameStatus === 3) {
      // Finished game known to the (archived) schedule but whose box score is
      // unreachable since the 2026-07 cdn.nba.com block — show the final from
      // schedule data instead of a misleading "hasn't tipped off" state.
      const recoveredBox = getRecoveredPlayerBox(sg);
      const reportedSequence = getReportedScoreSequence(sg);
      const officialPeriods = getOfficialPeriodScores(sg);
      const verifiedShots = getVerifiedShotChart(sg);
      const providerBox = recoveredBox ? null : getProviderPlayerBox(sg);
      const quarantined = isPlayerBoxQuarantined(sg.gameId);
      const sgPlayoffs = isPlayoff(sg.gameId);
      const dateCode = sg.gameCode.split("/")[0];
      const sgDate = `${dateCode.slice(0, 4)}-${dateCode.slice(4, 6)}-${dateCode.slice(6, 8)}`;
      const teams = [sg.awayTeam, sg.homeTeam];
      const maxScore = Math.max(sg.awayTeam.score, sg.homeTeam.score);
      return (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Breadcrumbs
            items={[
              { label: isZh ? "比赛" : "Games", href: "/" },
              { label: `${sg.awayTeam.teamTricode} @ ${sg.homeTeam.teamTricode} · ${sgDate}` },
            ]}
          />
          <div className="glass-tile p-6 sm:p-10 mt-4">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary text-center">
              {isZh ? "终场" : "Final"} · {sgDate}
            </p>
            <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4 max-w-2xl mx-auto">
              {teams.map((team, i) => (
                <div key={team.teamTricode} className={`flex flex-col items-center gap-2 ${i === 0 ? "" : "order-3"}`}>
                  <TeamLogo teamId={team.teamId} tricode={team.teamTricode} size={64} />
                  <Link href={`/team/${team.teamTricode}`} className="text-sm font-semibold text-text-primary hover:text-accent transition-colors">
                    {team.teamCity} {team.teamName}
                  </Link>
                  <span
                    className={`text-4xl sm:text-5xl font-light font-mono tabular-nums ${team.score === maxScore ? "text-text-primary" : "text-text-secondary/60"}`}
                  >
                    {team.score}
                  </span>
                </div>
              ))}
              <span className="order-2 text-text-secondary/50 text-sm font-mono">@</span>
            </div>
            <p className="mt-8 text-xs text-text-secondary text-center max-w-md mx-auto">
              {verifiedShots
                ? (isZh ? `已恢复本场 ${verifiedShots.coverage.total} 次真实出手坐标，见下方 3D 球场。逐回合暂不可用。` : `${verifiedShots.coverage.total} verified shot locations have been recovered for the 3D court below. Play-by-play remains unavailable.`)
                : quarantined && !recoveredBox && !providerBox
                ? (isZh ? "本场补充球员数据存在身份核验问题，已暂停展示。可查看下方 NBA 官方赛后报告。" : "Supplemental player data is withheld while a player identity issue is reviewed. The NBA official final report is linked below.")
                : (recoveredBox || providerBox)
                ? (isZh ? "已恢复本场球员基础技术统计，见下表。投篮图与逐回合暂不可用。" : "Basic player stats have been recovered below. Shot charts and play-by-play remain unavailable.")
                : (isZh ? "本场比赛的详细数据（Box Score、投篮图、逐回合）暂不可用。" : "Detailed stats for this game (box score, shot chart, play-by-play) are currently unavailable.")}
            </p>
            <OfficialGameReport gameId={sg.gameId} isZh={isZh} />
          </div>
          {officialPeriods && <OfficialPeriodScores scores={officialPeriods} isZh={isZh} />}
          <VerifiedShotChartSection data={verifiedShots} isZh={isZh} />
          {reportedSequence && <ReportedScoreSequence sequence={reportedSequence} isZh={isZh} />}
          {recoveredBox && <RecoveredPlayerBox box={recoveredBox} isZh={isZh} />}
          {providerBox && <ProviderPlayerBox box={providerBox} isZh={isZh} />}
          <RelatedPages
            eyebrow={isZh ? "继续探索" : "Keep exploring"}
            pages={[
              { href: `/team/${sg.homeTeam.teamTricode}`, label: `${sg.homeTeam.teamTricode} ${isZh ? "球队主页" : "team page"}`, icon: Users },
              { href: `/team/${sg.awayTeam.teamTricode}`, label: `${sg.awayTeam.teamTricode} ${isZh ? "球队主页" : "team page"}`, icon: Users },
              ...(sgPlayoffs ? [{ href: `/series/${sg.gameId.slice(0, 9)}`, label: isZh ? "整个系列赛" : "Full series", icon: Trophy }] : []),
              { href: `/h2h?t1=${sg.homeTeam.teamTricode}&t2=${sg.awayTeam.teamTricode}`, label: isZh ? "历史交锋" : "Head-to-head", icon: GitCompareArrows },
              { href: `/?date=${sgDate}`, label: isZh ? "当天其他比赛" : "Other games that day", icon: Calendar },
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
  const verifiedShots = getVerifiedShotChart(boxScore);
  const isLive = boxScore.gameStatus === 2;
  // Leaders/headlines/shooting splits compute fine from an in-progress box
  // score, so a live viewer gets the same "who's balling" summary as a final.
  const isLiveOrFinal = boxScore.gameStatus >= 2;
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

  // Top 3 scorers per team (merged, points desc) for the matchup section —
  // chosen here so only ~6 slim rows cross the server/client boundary.
  const topScorers = isFinal
    ? [boxScore.awayTeam, boxScore.homeTeam]
        .flatMap((team) =>
          [...team.players]
            .filter((p) => p.played === "1" && p.statistics.points > 0)
            .sort((a, b) => b.statistics.points - a.statistics.points)
            .slice(0, 3)
            .map((p) => ({
              personId: p.personId,
              name: p.nameI,
              teamTricode: team.teamTricode,
              points: p.statistics.points,
            }))
        )
        .sort((a, b) => b.points - a.points)
    : [];

  // JSON-LD structured data — SportsEvent schema for rich snippets
  const eventDescription = isFinal
    ? `Final: ${boxScore.awayTeam.teamTricode} ${boxScore.awayTeam.score}, ${boxScore.homeTeam.teamTricode} ${boxScore.homeTeam.score}.`
    : isLive
    ? `Live: ${boxScore.awayTeam.teamTricode} ${boxScore.awayTeam.score} – ${boxScore.homeTeam.teamTricode} ${boxScore.homeTeam.score}, ${boxScore.gameStatusText}.`
    : `${boxScore.awayTeam.teamTricode} at ${boxScore.homeTeam.teamTricode} — ${boxScore.arena.arenaName}.`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${boxScore.awayTeam.teamCity} ${boxScore.awayTeam.teamName} vs ${boxScore.homeTeam.teamCity} ${boxScore.homeTeam.teamName}`,
    sport: "Basketball",
    startDate: boxScore.gameTimeUTC,
    // schema.org has no "in progress" value — a live game is still best
    // described as Scheduled-then-running; only completed/postponed differ.
    eventStatus: isFinal ? "https://schema.org/EventCompleted" : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    description: eventDescription,
    // The dynamic OG card — lets Google show a thumbnail in sports rich results.
    image: `https://nba.xpy.me/game/${id}/opengraph-image`,
    url: `https://nba.xpy.me/game/${id}`,
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
  };

  const renderHeadlines = (shots: ScoringShot[]) => (
    <GameHeadlines
      homeTeam={boxScore.homeTeam}
      awayTeam={boxScore.awayTeam}
      shots={shots}
      seasonRankBadges={isFinal ? (
        <Suspense fallback={null}><SeasonRankBadge gameId={id} t={t} /></Suspense>
      ) : null}
      t={t}
    />
  );

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

      {isUpcoming ? (
        <PreGameHero
          away={boxScore.awayTeam}
          home={boxScore.homeTeam}
          gameTimeUTC={boxScore.gameTimeUTC}
          beijingTime={toBeijingTime(boxScore.gameTimeUTC)}
          isZh={isZh}
        />
      ) : (
        <Suspense fallback={<GameHero boxScore={boxScore} shots={[]} isPlayoffs={isPlayoffs} t={t} />}>
          <WithPlayByPlay data={pbp!}>{({ scoringShots }) => <GameHero boxScore={boxScore} shots={scoringShots} isPlayoffs={isPlayoffs} t={t} />}</WithPlayByPlay>
        </Suspense>
      )}
      <div id="game-hero-sentinel" />
      <GameStickyScore
        awayTricode={boxScore.awayTeam.teamTricode}
        awayScore={boxScore.awayTeam.score}
        awayTeamId={boxScore.awayTeam.teamId}
        homeTricode={boxScore.homeTeam.teamTricode}
        homeScore={boxScore.homeTeam.score}
        homeTeamId={boxScore.homeTeam.teamId}
        statusText={boxScore.gameStatusText}
        isLive={isLive}
      />

      {isFinal && boxScore.homeTeam.periods?.length > 0 && (
        <QuarterBars
          homePeriods={boxScore.homeTeam.periods}
          awayPeriods={boxScore.awayTeam.periods}
          homeTricode={boxScore.homeTeam.teamTricode}
          awayTricode={boxScore.awayTeam.teamTricode}
        />
      )}

      {isFinal && <Suspense fallback={<GameRecap boxScore={boxScore} actions={[]} isPlayoffs={isPlayoffs} isZh={isZh} />}>
        <WithPlayByPlay data={pbp!}>{({ actions }) => <GameRecap boxScore={boxScore} actions={actions} isPlayoffs={isPlayoffs} isZh={isZh} />}</WithPlayByPlay>
      </Suspense>}

      {/* Leaders/headlines render for live games too — season rank is final-only
          (mid-game season ranks would mislead), so suppress it when not final. */}
      {isLiveOrFinal && (
        <Suspense fallback={renderHeadlines([])}>
          <WithPlayByPlay data={pbp!}>{({ scoringShots }) => renderHeadlines(scoringShots)}</WithPlayByPlay>
        </Suspense>
      )}

      {isLiveOrFinal && (
        <GameLeaders homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} playerInfoMap={playerInfoMap} isLive={isLive} t={t} />
      )}

      {/* Replay links — streamed (Supabase fetch is independent) */}
      <Suspense fallback={null}>
        <ReplaySection gameId={id} t={t} />
      </Suspense>

      {isFinal && (
        <div className="mt-6">
          <TeamCompare homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} />
        </div>
      )}

      {isUpcoming ? (
        /* Pre-game: the box score is an empty shell, so swap the stats body for the preview */
        <div className="mt-6">
          <Suspense fallback={<div className="h-64 glass-tile skeleton-shimmer" />}>
            <GamePreview
              gameId={boxScore.gameId}
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
          {verifiedShots && <VerifiedShotChartSection data={verifiedShots} isZh={isZh} />}
          {/* Box score + shot chart come right after the leaders — the #1 thing
              a fan wants. Deeper analytics charts follow below it. */}
          <div className={`mt-6 grid grid-cols-1 ${verifiedShots ? "lg:grid-cols-2" : "lg:grid-cols-3"} gap-6`}>
            {!verifiedShots && <div className="lg:col-span-1 space-y-6">
              <Suspense fallback={null}>
                <WithPlayByPlay data={pbp!}>{({ shots }) => (
                  <ShotChartSection
                shots={shots}
                homeTricode={boxScore.homeTeam.teamTricode}
                awayTricode={boxScore.awayTeam.teamTricode}
                allPlayers={allPlayers}
                t={t}
              />)}</WithPlayByPlay>
              </Suspense>
            </div>}
            <div className="lg:col-span-2 space-y-6">
              <Suspense fallback={<BoxScoreSection team={boxScore.awayTeam} shots={[]} playerInfoMap={playerInfoMap} t={t} />}><WithPlayByPlay data={pbp!}>{({ scoringShots }) => <BoxScoreSection team={boxScore.awayTeam} shots={scoringShots} playerInfoMap={playerInfoMap} t={t} />}</WithPlayByPlay></Suspense>
              <Suspense fallback={<BoxScoreSection team={boxScore.homeTeam} shots={[]} playerInfoMap={playerInfoMap} t={t} />}><WithPlayByPlay data={pbp!}>{({ scoringShots }) => <BoxScoreSection team={boxScore.homeTeam} shots={scoringShots} playerInfoMap={playerInfoMap} t={t} />}</WithPlayByPlay></Suspense>
            </div>
          </div>

          {isFinal && <Suspense fallback={<ScoringFlowSection homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} scoreEvents={[]} />}><WithPlayByPlay data={pbp!}>{({ scoreEvents }) => <ScoringFlowSection homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} scoreEvents={scoreEvents} />}</WithPlayByPlay></Suspense>}

          {isFinal && <GameMeta homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} t={t} />}

          {isFinal && <StatsRadar homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} t={t} />}

          {isLiveOrFinal && <ShootingEfficiency homeTeam={boxScore.homeTeam} awayTeam={boxScore.awayTeam} t={t} />}

          {isFinal && <Suspense fallback={null}><WithPlayByPlay data={pbp!}>{({ actions }) => <KeyMomentsSection actions={actions} />}</WithPlayByPlay></Suspense>}

          {isFinal && topScorers.length > 0 && (
            <div className="mt-6">
              <MatchupSection gameId={id} scorers={topScorers} />
            </div>
          )}

          <div className="mt-6">
            <Suspense fallback={null}><WithPlayByPlay data={pbp!}>{({ actions }) => <PlayByPlaySection actions={actions} isLive={isLive} />}</WithPlayByPlay></Suspense>
          </div>
        </>
      )}

      <RelatedPages eyebrow={isZh ? "继续探索" : "Keep exploring"} pages={relatedPages} />
    </div>
  );
}

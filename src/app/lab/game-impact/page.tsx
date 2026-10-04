import type { Metadata } from "next";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Activity, ArrowRight, Flame } from "lucide-react";
import { getBoxScore, getFullSchedule, getRecorded2025SeasonSchedule, getScheduleAge, toBeijingTime, type ScheduleGame } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import { getGamePlayByPlay } from "@/lib/game-play-by-play";
import { takeoverActionPoints as actionPoints, validatedTakeoverActions } from "@/lib/takeover-actions";
import { getVerifiedHistoricalScoring } from "@/lib/verified-historical-scoring";
import { buildTakeoverSeries, type TakeoverScoringEvent } from "@/lib/takeover-series";
import { TEAM_META } from "@/lib/teams";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";
import type { ScorerSeries } from "./TakeoverChart";

const ChartPlaceholder = () => <div className="h-80 glass-tile skeleton-shimmer" />;
const TakeoverChart = dynamic(() => import("./TakeoverChart"), { loading: ChartPlaceholder });

interface PageProps {
  searchParams: Promise<{ id?: string | string[] }>;
}

// Most recent FINISHED game across the full schedule, by UTC tip time.
function findLatestFinished(schedule: { games: ScheduleGame[] }[]): ScheduleGame | null {
  let best: ScheduleGame | null = null;
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      if (!best || g.gameDateTimeUTC > best.gameDateTimeUTC) best = g;
    }
  }
  return best;
}

// A handful of other recent finished games (excluding the active one) to offer
// as quick links. Newest first.
function recentFinished(schedule: { games: ScheduleGame[] }[], excludeId: string, limit: number): ScheduleGame[] {
  const all: ScheduleGame[] = [];
  for (const gd of schedule) for (const g of gd.games) if (g.gameStatus === 3 && g.gameId !== excludeId) all.push(g);
  all.sort((a, b) => (a.gameDateTimeUTC < b.gameDateTimeUTC ? 1 : -1));
  return all.slice(0, limit);
}

function teamColor(tricode: string): string {
  const c = TEAM_META[tricode]?.primaryColor || "var(--accent)";
  // Near-black primaries (BKN) would vanish on the dark canvas — fall back.
  if (/^#0{0,2}0{0,4}$/i.test(c) || c.toLowerCase() === "#000000") return "var(--text-secondary)";
  return c;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { id } = await searchParams;
  const locale = await getLocale();
  const isZh = locale === "zh";
  let matchup = "";
  const gameId = typeof id === "string" && /^\d{10}$/.test(id.trim()) ? id.trim() : "";
  const historical = gameId ? getVerifiedHistoricalScoring(gameId) : null;
  const game = historical?.game ?? (gameId ? await getBoxScore(gameId).catch(() => null) : null);
  if (game) matchup = ` — ${game.awayTeam.teamTricode} ${game.awayTeam.score} @ ${game.homeTeam.teamTricode} ${game.homeTeam.score}`;
  return {
    title: isZh ? `比赛得分接管曲线${matchup}` : `Game Takeover Curve${matchup}`,
    description: isZh
      ? "用逐球数据还原一场比赛里每位主要得分手的累计得分曲线，看谁在何时接管了比赛。"
      : "Reconstruct each scorer's cumulative-points curve from play-by-play to see who took over the game, and when.",
  };
}

export default async function GameImpactPage({ searchParams }: PageProps) {
  const { id: rawId } = await searchParams;
  const locale = await getLocale();
  const isZh = locale === "zh";

  const invalidId = rawId !== undefined && (typeof rawId !== "string" || !/^\d{10}$/.test(rawId.trim()));
  const explicitId = typeof rawId === "string" && /^\d{10}$/.test(rawId.trim()) ? rawId.trim() : "";
  const explicitHistorical = explicitId ? getVerifiedHistoricalScoring(explicitId) : null;
  // Explicit reviewed history is immutable. Do not block it on live schedule,
  // box or PBP availability; recent links are honestly the recorded season.
  const schedule = invalidId ? [] : explicitHistorical ? getRecorded2025SeasonSchedule() : await getFullSchedule().catch(() => []);

  // No-ID selection still uses the full schedule, never a pinned archive ID.
  let gameId = explicitId;
  if (!gameId && rawId === undefined) {
    const latest = findLatestFinished(schedule);
    gameId = latest?.gameId || "";
  }

  const breadcrumbs = (
    <Breadcrumbs
      items={[
        { label: isZh ? "数据实验室" : "Data Lab", href: "/lab" },
        { label: isZh ? "得分接管曲线" : "Takeover Curve" },
      ]}
    />
  );

  if (!gameId) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        {breadcrumbs}
        <PageHeader eyebrow={isZh ? "数据实验室" : "Data Lab"} icon={Activity} title={isZh ? "比赛得分接管曲线" : "Game Takeover Curve"} />
        <EmptyState
          icon={Activity}
          title={invalidId ? (isZh ? "比赛编号无效" : "Invalid game ID") : (isZh ? "暂无已结束的比赛" : "No finished games yet")}
          description={invalidId ? (isZh ? "请从比赛页面打开得分曲线。" : "Open the scoring curve from a game page.") : (isZh ? "等有比赛打完后，这里会自动选取最近一场。" : "Once a game finishes, the latest one is picked automatically.")}
          action={{ href: "/", label: isZh ? "查看比赛" : "Browse games" }}
        />
      </div>
    );
  }

  const selectedGame = schedule.flatMap(day => day.games).find(game => game.gameId === gameId);
  const historical = explicitHistorical ?? getVerifiedHistoricalScoring(gameId, selectedGame);
  const box = historical ? null : await getBoxScore(gameId).catch(() => null);

  if (!historical && !box) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        {breadcrumbs}
        <PageHeader eyebrow={isZh ? "数据实验室" : "Data Lab"} icon={Activity} title={isZh ? "比赛得分接管曲线" : "Game Takeover Curve"} />
        <EmptyState
          icon={Activity}
          tone="danger"
          title={isZh ? "本场详细数据暂不可用" : "Detailed game data unavailable"}
          description={isZh ? "目前无法核验完整得分曲线；比赛详情可能仍有基础技术统计。" : "A complete scoring curve cannot be verified right now; the game page may still have basic player stats."}
          action={{ href: `/game/${gameId}`, label: isZh ? "查看本场比赛" : "Open game details" }}
        />
      </div>
    );
  }

  // Keep the live reconciliation path and the reviewed archive distinct.
  // Both feed only the existing chart's narrow cumulative-scoring input.
  let scoringEvents: readonly TakeoverScoringEvent[];
  if (historical) scoringEvents = historical.events;
  else {
    const feed = await getGamePlayByPlay(gameId);
    scoringEvents = validatedTakeoverActions(feed.actions, box!).flatMap(action => {
      const points = actionPoints(action);
      return points && action.personId ? [{ personId: action.personId, playerName: action.playerNameI,
        teamTricode: action.teamTricode, period: action.period, points: points as 1 | 2 | 3 }] : [];
    });
  }
  const away = historical?.game.awayTeam ?? box!.awayTeam;
  const home = historical?.game.homeTeam ?? box!.homeTeam;
  const others = recentFinished(schedule, gameId, 8);
  const { scorers, quarterStarts, steps: totalSteps } = buildTakeoverSeries(scoringEvents, isZh);
  const series: ScorerSeries[] = scorers.map(scorer => ({ ...scorer, color: teamColor(scorer.teamTricode) }));

  const hasData = series.length > 0 && totalSteps > 1;
  const gameHigh = series[0]; // ranked desc
  const beijing = toBeijingTime(historical?.game.gameDateTimeUTC ?? box!.gameTimeUTC);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {breadcrumbs}
      <PageHeader
        eyebrow={isZh ? "数据实验室" : "Data Lab"}
        icon={Activity}
        title={isZh ? "比赛得分接管曲线" : "Game Takeover Curve"}
        subtitle={
          isZh
            ? "逐球还原每位主要得分手的累计得分，看谁在何时接管了比赛"
            : "Cumulative points per scorer, reconstructed play-by-play — who took over, and when"
        }
        updatedAt={historical ? null : getScheduleAge()}
      />

      {/* Game header card — links to the full game page */}
      <Link
        href={`/game/${gameId}`}
        className="glass-tile p-4 min-h-11 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 group cursor-pointer mb-5"
      >
        <div className="min-w-0">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">{isZh ? "本场比赛" : "This game"}</p>
          <p className="text-lg font-semibold text-text-primary group-hover:text-accent transition-colors whitespace-normal break-words sm:truncate">
            {away.teamCity} {away.teamName} {away.score} <span className="text-text-secondary">@</span> {home.score} {home.teamCity} {home.teamName}
          </p>
          <p className="text-[11px] font-mono text-text-secondary mt-0.5">{beijing}</p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em] text-accent">
          {isZh ? "完整比赛" : "Full game"}
          <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </span>
      </Link>

      {historical && (
        <section aria-label={isZh ? "历史逐球来源" : "Historical scoring source"} className="glass-tile p-4 mb-5 space-y-2 text-xs text-text-secondary">
          <p>{isZh ? "历史存档：" : "Historical archive: "}<a href={historical.source.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">fxy2026/nba_data · NBA stats-v3</a>
            {isZh ? "。按原始事件顺序核验 554 条记录；曲线包含 64 次运动战得分和 32 次实际罚球得分。" : ". 554 source-ordered records checked; the curve includes 64 made field goals and 32 actual made free throws."}</p>
          <p>{isZh ? "终场、各节及 21 名实际出场球员的得分已与独立保存的统计核对。" : "Final, quarter and all 21 played-player point totals reconcile with separately saved records."}{" "}
            <a href={historical.source.reportUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{isZh ? "NBA 赛后报告" : "NBA final report"}</a>{" · "}
            <a href={historical.source.officialChartsUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{isZh ? "已核验的投篮记录" : "Reviewed shot records"}</a></p>
          <p>{isZh ? `核验日期：${historical.source.verifiedOn}；原始逐球采集时间未知。` : `Verified ${historical.source.verifiedOn}; original play-by-play capture time is unknown.`}</p>
        </section>
      )}

      {hasData && gameHigh && (
        <div className="glass-tile p-3 flex items-center gap-3 mb-5">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-accent-amber/10 flex items-center justify-center">
            <Flame size={16} className="text-accent-amber" />
          </div>
          <p className="text-sm text-text-secondary">
            {isZh ? (
              <>
                本场得分王{" "}
                <Link href={`/player/${gameHigh.personId}`} className="font-semibold text-text-primary hover:text-accent transition-colors">
                  {gameHigh.name}
                </Link>{" "}
                （{gameHigh.teamTricode}）砍下 <span className="font-mono tabular-nums text-accent-amber">{gameHigh.total}</span> 分
              </>
            ) : (
              <>
                Game-high{" "}
                <span className="font-mono tabular-nums text-accent-amber">{gameHigh.total}</span> points by{" "}
                <Link href={`/player/${gameHigh.personId}`} className="font-semibold text-text-primary hover:text-accent transition-colors">
                  {gameHigh.name}
                </Link>{" "}
                ({gameHigh.teamTricode})
              </>
            )}
          </p>
        </div>
      )}

      {hasData ? (
        <TakeoverChart series={series} quarterStarts={quarterStarts} steps={totalSteps} />
      ) : (
        <EmptyState
          icon={Activity}
          title={isZh ? "得分曲线暂不可用" : "Scoring curve unavailable"}
          description={
            isZh
              ? "目前无法核验完整得分曲线。可以试试下方其他最近的比赛。"
              : "A complete scoring curve cannot be verified right now. Try one of the other recent games below."
          }
        />
      )}

      {/* Other recent finished games */}
      {others.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3">
            <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {explicitHistorical ? (isZh ? "其他历史比赛" : "Other recorded games") : (isZh ? "换一场看" : "Other recent games")}</p>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {others.map((g) => (
              <Link
                key={g.gameId}
                href={`/lab/game-impact?id=${g.gameId}`}
                className="glass-tile p-3 flex items-center justify-between gap-3 group cursor-pointer"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-text-primary group-hover:text-accent transition-colors truncate">
                    {g.awayTeam.teamTricode} {g.awayTeam.score} @ {g.homeTeam.score} {g.homeTeam.teamTricode}
                  </span>
                  <span className="block text-[10px] font-mono text-text-secondary">{toBeijingTime(g.gameDateTimeUTC)}</span>
                </span>
                <ArrowRight size={14} className="shrink-0 text-text-secondary group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/lab", label: isZh ? "数据实验室" : "Data Lab", description: isZh ? "更多互动数据工具" : "More interactive data tools", icon: Activity },
          { href: `/game/${gameId}`, label: isZh ? "本场比赛详情" : "Full game page", description: isZh ? "Box Score、投篮图、逐球回放" : "Box score, shot chart, play-by-play", icon: ArrowRight },
          ...(gameHigh ? [{ href: `/player/${gameHigh.personId}`, label: gameHigh.name, description: isZh ? "球员主页" : "Player page", icon: Flame }] : []),
        ]}
      />
    </div>
  );
}

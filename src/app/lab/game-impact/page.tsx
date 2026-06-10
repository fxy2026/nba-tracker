import type { Metadata } from "next";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Activity, ArrowRight, Flame } from "lucide-react";
import { getBoxScore, getFullSchedule, getScheduleAge, toBeijingTime, type ScheduleGame } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import { TEAM_META } from "@/lib/teams";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";
import type { ScorerSeries } from "./TakeoverChart";

const ChartPlaceholder = () => <div className="h-80 glass-tile skeleton-shimmer" />;
const TakeoverChart = dynamic(() => import("./TakeoverChart"), { loading: ChartPlaceholder });

interface PageProps {
  searchParams: Promise<{ id?: string }>;
}

// ---- raw play-by-play -------------------------------------------------------
// The shot-only getPlayByPlay() drops free throws and per-action scores, both
// of which we need for cumulative points. Mirror the game page and read the
// raw CDN action list directly. One scoring action per made shot / free throw.
interface RawAction {
  actionNumber: number;
  period: number;
  clock: string;
  actionType: string;
  shotResult?: string;
  personId: number;
  playerNameI: string;
  teamTricode: string;
}

async function fetchRawActions(gameId: string): Promise<RawAction[]> {
  return fetch(`https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${gameId}.json`, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", Referer: "https://www.nba.com/" },
    next: { revalidate: 60 },
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d?.game?.actions as RawAction[]) || [])
    .catch(() => []);
}

// Points a single scoring action is worth (0 = not a scoring action).
function actionPoints(a: RawAction): number {
  if (a.shotResult !== "Made") return 0;
  if (a.actionType === "3pt") return 3;
  if (a.actionType === "2pt") return 2;
  if (a.actionType === "freethrow") return 1;
  return 0;
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
  const box = id ? await getBoxScore(id).catch(() => null) : null;
  if (box) matchup = ` — ${box.awayTeam.teamTricode} ${box.awayTeam.score} @ ${box.homeTeam.teamTricode} ${box.homeTeam.score}`;
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

  const schedule = await getFullSchedule().catch(() => []);

  // Resolve the target game: explicit ?id, else most recent finished game.
  let gameId = rawId?.trim() || "";
  if (!gameId) {
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
          title={isZh ? "暂无已结束的比赛" : "No finished games yet"}
          description={isZh ? "等有比赛打完后，这里会自动选取最近一场。" : "Once a game finishes, the latest one is picked automatically."}
          action={{ href: "/", label: isZh ? "查看比赛" : "Browse games" }}
        />
      </div>
    );
  }

  const [box, actions] = await Promise.all([getBoxScore(gameId).catch(() => null), fetchRawActions(gameId)]);

  if (!box) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        {breadcrumbs}
        <PageHeader eyebrow={isZh ? "数据实验室" : "Data Lab"} icon={Activity} title={isZh ? "比赛得分接管曲线" : "Game Takeover Curve"} />
        <EmptyState
          icon={Activity}
          tone="danger"
          title={isZh ? "找不到这场比赛" : "Game not found"}
          description={isZh ? `没有 ID 为 ${gameId} 的比赛数据。` : `No data for game ID ${gameId}.`}
          action={{ href: "/lab/game-impact", label: isZh ? "改看最近一场" : "Show the latest game" }}
        />
      </div>
    );
  }

  const away = box.awayTeam;
  const home = box.homeTeam;
  const others = recentFinished(schedule, gameId, 8);

  // ---- build cumulative-points series from scoring actions ------------------
  // Walk the actions chronologically. Each made shot / free throw is one x-step;
  // we snapshot every tracked player's running total at that step so all series
  // share the same x-axis (the index of the scoring event).
  type Acc = { personId: number; name: string; teamTricode: string; running: number; snapshots: number[] };
  const accs = new Map<number, Acc>();
  const stepRunning = new Map<number, number>(); // personId -> running total
  // quarterStarts records the x-step at which a new quarter's first scoring play lands.
  const quarterStarts: { index: number; label: string }[] = [];
  let seenPeriod = 0;
  let step = 0; // index 0 reserved for the pre-tip 0-0 state

  // Pre-scan to find which players ever score, so each series starts at step 0.
  const scoringActions = actions.filter((a) => actionPoints(a) > 0 && a.personId);

  for (const a of scoringActions) {
    if (a.period > seenPeriod) {
      seenPeriod = a.period;
      if (a.period >= 2) {
        const label = a.period <= 4 ? (isZh ? `第${a.period}节` : `Q${a.period}`) : isZh ? `加时${a.period - 4}` : `OT${a.period - 4}`;
        quarterStarts.push({ index: step + 1, label });
      }
    }
    step++;
    const pts = actionPoints(a);
    stepRunning.set(a.personId, (stepRunning.get(a.personId) || 0) + pts);

    // Lazily create an accumulator; back-fill leading zeros to the current step.
    let acc = accs.get(a.personId);
    if (!acc) {
      acc = { personId: a.personId, name: a.playerNameI, teamTricode: a.teamTricode, running: 0, snapshots: new Array(step).fill(0) };
      accs.set(a.personId, acc);
    }
    // Snapshot EVERY tracked player at this step (those without an action this
    // step just repeat their last total), so all series have equal length.
    for (const other of accs.values()) {
      other.snapshots[step] = stepRunning.get(other.personId) || 0;
    }
  }

  const totalSteps = step + 1; // includes index 0

  // Normalize lengths (a player created late had a shorter prefill; pad tails).
  for (const acc of accs.values()) {
    while (acc.snapshots.length < totalSteps) acc.snapshots.push(acc.snapshots[acc.snapshots.length - 1] ?? 0);
  }

  // Top ~6 scorers by final total.
  const ranked = [...accs.values()].sort((a, b) => (b.snapshots[totalSteps - 1] || 0) - (a.snapshots[totalSteps - 1] || 0));
  const top = ranked.slice(0, 6);

  const series: ScorerSeries[] = top.map((acc) => ({
    personId: acc.personId,
    name: acc.name,
    teamTricode: acc.teamTricode,
    color: teamColor(acc.teamTricode),
    total: acc.snapshots[totalSteps - 1] || 0,
    points: acc.snapshots,
  }));

  const hasData = series.length > 0 && totalSteps > 1;
  const gameHigh = series[0]; // ranked desc
  const beijing = toBeijingTime(box.gameTimeUTC);

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
        updatedAt={getScheduleAge()}
      />

      {/* Game header card — links to the full game page */}
      <Link
        href={`/game/${gameId}`}
        className="glass-tile p-4 flex items-center justify-between gap-4 group cursor-pointer mb-5"
      >
        <div className="min-w-0">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">{isZh ? "本场比赛" : "This game"}</p>
          <p className="text-lg font-semibold text-text-primary group-hover:text-accent transition-colors truncate">
            {away.teamCity} {away.teamName} {away.score} <span className="text-text-secondary">@</span> {home.score} {home.teamCity} {home.teamName}
          </p>
          <p className="text-[11px] font-mono text-text-secondary mt-0.5">{beijing}</p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em] text-accent">
          {isZh ? "完整比赛" : "Full game"}
          <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </span>
      </Link>

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
          title={isZh ? "这场比赛暂无逐球数据" : "No play-by-play for this game"}
          description={
            isZh
              ? "无法重建得分曲线。可以试试下方其他最近的比赛。"
              : "Can't reconstruct the scoring curve. Try one of the other recent games below."
          }
        />
      )}

      {/* Other recent finished games */}
      {others.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3">
            <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {isZh ? "换一场看" : "Other recent games"}</p>
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

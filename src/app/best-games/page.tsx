import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Flame, Zap, Target, Clock, BookOpen, CalendarDays, Crown, type LucideIcon } from "lucide-react";
import { getFullSchedule, type ScheduleGame } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";

export const metadata: Metadata = {
  title: "Best Games",
  description: "Season's most memorable games — biggest blowouts, closest finishes, highest scoring, overtime thrillers.",
};

export const revalidate = 600;

interface GameWithMeta {
  game: ScheduleGame;
  date: string;
  totalScore: number;
  margin: number;
  isOT: boolean;
  otCount: number;
}

async function fetchAndCategorize() {
  const schedule = await getFullSchedule().catch(() => []);
  const allFinished: GameWithMeta[] = [];

  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      // Skip preseason (001) — exhibition vs international teams
      if (g.gameId.startsWith("001")) continue;
      const dateStr = gd.gameDate.split(" ")[0];
      const [m, d, y] = dateStr.split("/");
      const isoDate = `${y}-${m}-${d}`;
      const total = g.homeTeam.score + g.awayTeam.score;
      const margin = Math.abs(g.homeTeam.score - g.awayTeam.score);
      const isOT = g.gameStatusText?.toLowerCase().includes("ot") || g.gameStatusText?.includes("OT") || false;
      let otCount = 0;
      const otMatch = g.gameStatusText?.match(/(\d+)\s*ot/i);
      if (otMatch) otCount = parseInt(otMatch[1]);
      else if (isOT) otCount = 1;
      allFinished.push({ game: g, date: isoDate, totalScore: total, margin, isOT, otCount });
    }
  }

  // Top 5 each category
  const closest = [...allFinished].sort((a, b) => a.margin - b.margin).slice(0, 5);
  const blowouts = [...allFinished].sort((a, b) => b.margin - a.margin).slice(0, 5);
  const highestScoring = [...allFinished].sort((a, b) => b.totalScore - a.totalScore).slice(0, 5);
  const overtime = allFinished.filter((g) => g.isOT).sort((a, b) => b.otCount - a.otCount || b.totalScore - a.totalScore).slice(0, 5);

  return { closest, blowouts, highestScoring, overtime, totalAnalyzed: allFinished.length };
}

function GameRow({ meta, badge, badgeColor }: { meta: GameWithMeta; badge: string; badgeColor: string }) {
  const g = meta.game;
  const homeWon = g.homeTeam.score > g.awayTeam.score;
  return (
    <Link
      href={`/game/${g.gameId}`}
      className="glass-tile p-4 flex items-center gap-3 sm:gap-4 group cursor-pointer relative overflow-hidden"
    >
      {/* Big metric badge */}
      <div
        className="shrink-0 w-16 h-16 rounded-2xl flex flex-col items-center justify-center"
        style={{
          background: `${badgeColor}22`,
          boxShadow: `inset 0 0 0 1px ${badgeColor}55`,
        }}
      >
        <span className="text-2xl font-light font-mono tabular-nums leading-none" style={{ color: badgeColor }}>
          {badge}
        </span>
      </div>

      {/* Teams + score */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Image
            src={`https://cdn.nba.com/logos/nba/${g.awayTeam.teamId}/global/L/logo.svg`}
            alt={g.awayTeam.teamTricode}
            width={32}
            height={32}
            unoptimized
            className="shrink-0"
          />
          <span className={`text-sm font-bold font-mono ${!homeWon ? "text-text-primary" : "text-text-secondary"}`}>
            {g.awayTeam.teamTricode}
          </span>
          <span className={`text-2xl font-light font-mono tabular-nums leading-none ${!homeWon ? "text-accent-amber" : "text-text-secondary"}`}>
            {g.awayTeam.score}
          </span>
        </div>
        <span className="text-text-secondary/40 text-sm">·</span>
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className={`text-2xl font-light font-mono tabular-nums leading-none ${homeWon ? "text-accent-amber" : "text-text-secondary"}`}>
            {g.homeTeam.score}
          </span>
          <span className={`text-sm font-bold font-mono ${homeWon ? "text-text-primary" : "text-text-secondary"}`}>
            {g.homeTeam.teamTricode}
          </span>
          <Image
            src={`https://cdn.nba.com/logos/nba/${g.homeTeam.teamId}/global/L/logo.svg`}
            alt={g.homeTeam.teamTricode}
            width={32}
            height={32}
            unoptimized
            className="shrink-0"
          />
        </div>
      </div>

      {/* Date + OT */}
      <div className="hidden sm:flex flex-col items-end shrink-0">
        <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">{meta.date}</p>
        {meta.isOT && (
          <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-accent-amber font-bold mt-0.5">
            {meta.otCount > 0 ? `${meta.otCount}OT` : "OT"}
          </span>
        )}
      </div>
    </Link>
  );
}

function Section({
  icon: Icon,
  title,
  eyebrow,
  description,
  color,
  games,
  badgeFor,
}: {
  icon: LucideIcon;
  title: string;
  eyebrow: string;
  description: string;
  color: string;
  games: GameWithMeta[];
  badgeFor: (g: GameWithMeta) => string;
}) {
  if (games.length === 0) return null;
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {eyebrow}</p>
          <h2 className="text-base font-semibold text-text-primary tracking-tight flex items-center gap-2 mt-1">
            <Icon size={16} style={{ color }} />
            {title}
          </h2>
          <p className="text-xs text-text-secondary mt-1">{description}</p>
        </div>
      </div>
      <div className="space-y-2">
        {games.map((meta) => (
          <GameRow key={meta.game.gameId} meta={meta} badge={badgeFor(meta)} badgeColor={color} />
        ))}
      </div>
    </section>
  );
}

export default async function BestGamesPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const { closest, blowouts, highestScoring, overtime, totalAnalyzed } = await fetchAndCategorize();

  if (totalAnalyzed === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <PageHeader eyebrow={isZh ? "赛季" : "Season"} icon={Flame} title={isZh ? "最佳比赛" : "Best Games"} />
        <EmptyState
          icon={Flame}
          title={isZh ? "暂无已结束比赛" : "No finished games yet"}
          description={isZh ? "本赛季产生若干已结束比赛后，最佳比赛会显示在这里。" : "Best games will appear here once the season has produced a few finished games."}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow={isZh ? "赛季" : "Season"}
        icon={Flame}
        title={isZh ? "最佳比赛" : "Best Games"}
        subtitle={isZh
          ? `本赛季 ${totalAnalyzed} 场已结束比赛中最令人难忘的对决`
          : `Most memorable games across ${totalAnalyzed} finished games this season`}
      />

      <Section
        icon={Target}
        eyebrow={isZh ? "压哨绝杀" : "Buzzer Beaters"}
        title={isZh ? "焦点之战" : "Closest Games"}
        description={isZh ? "最小分差 — 一球胜负" : "Smallest point margin — won by a basket"}
        color="#DF1B41"
        games={closest}
        badgeFor={(g) => `+${g.margin}`}
      />

      <Section
        icon={Zap}
        eyebrow={isZh ? "屠杀场" : "Curb Stompings"}
        title={isZh ? "最大胜差" : "Biggest Blowouts"}
        description={isZh ? "最大分差 — 全面碾压" : "Largest point margins — total dominations"}
        color="#F59E0B"
        games={blowouts}
        badgeFor={(g) => `+${g.margin}`}
      />

      <Section
        icon={Flame}
        eyebrow={isZh ? "对攻战" : "Shootouts"}
        title={isZh ? "最高得分" : "Highest Scoring"}
        description={isZh ? "两队总得分超过 240+" : "Combined points exceeding 240+"}
        color="#22C55E"
        games={highestScoring}
        badgeFor={(g) => String(g.totalScore)}
      />

      {overtime.length > 0 && (
        <Section
          icon={Clock}
          eyebrow={isZh ? "额外篮球" : "Bonus Basketball"}
          title={isZh ? "加时大战" : "Overtime Thrillers"}
          description={isZh ? "需要加时才能决出胜负的比赛" : "Games that needed extra periods to settle"}
          color="#3B82F6"
          games={overtime}
          badgeFor={(g) => (g.otCount > 0 ? `${g.otCount}OT` : "OT")}
        />
      )}

      <RelatedPages
        pages={[
          { href: "/records", label: isZh ? "赛季纪录" : "Season Records", description: isZh ? "单场最高与最低" : "Single-game highs and lows", icon: BookOpen },
          { href: "/this-day", label: isZh ? "历史上的今天" : "On This Day", description: isZh ? "今日的历史比赛" : "Historical games on today's date", icon: CalendarDays },
          { href: "/game-predictor", label: isZh ? "比赛预测器" : "Game Predictor", description: isZh ? "未来 7 天胜率预测" : "Win probabilities for next 7 days", icon: Zap },
          { href: "/rivalries", label: isZh ? "宿敌对决" : "Rivalries", description: isZh ? "最胶着的队伍对位" : "Tightest team-vs-team matchups", icon: Crown },
        ]}
      />
    </div>
  );
}

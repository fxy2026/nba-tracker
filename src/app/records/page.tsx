import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Crown, Trophy, TrendingUp, Activity, Calendar, type LucideIcon } from "lucide-react";
import { getFullSchedule, getScheduleAge, type ScheduleGame } from "@/lib/api";
import { teamLogoUrl } from "@/lib/teamUrls";
import { isCountedSeason } from "@/lib/games";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";
import { getLocale } from "@/lib/locale";

export const metadata: Metadata = {
  title: "Season Records",
  description: "Single-game records across the season — highest team scores, biggest blowouts, longest overtimes, and more.",
};

export const revalidate = 600;

interface Played {
  game: ScheduleGame;
  date: string;
  homeWon: boolean;
  total: number;
  margin: number;
  otCount: number;
}

function parseIso(gd: { gameDate: string }) {
  const [m, d, y] = gd.gameDate.split(" ")[0].split("/");
  return `${y}-${m}-${d}`;
}

async function compute(): Promise<{
  byCategory: Record<string, Played[]>;
  totalGames: number;
}> {
  const schedule = await getFullSchedule().catch(() => []);
  const played: Played[] = [];
  for (const gd of schedule) {
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      // Skip preseason (001) AND All-Star weekend / rising stars (003) — both
      // include exhibition games vs international or themed teams (AUS, VIN, TMC, etc.)
      if (!isCountedSeason(g.gameId)) continue;
      const isOT = /ot/i.test(g.gameStatusText || "");
      const otMatch = (g.gameStatusText || "").match(/(\d+)\s*ot/i);
      const otCount = otMatch ? parseInt(otMatch[1]) : isOT ? 1 : 0;
      played.push({
        game: g,
        date: parseIso(gd),
        homeWon: g.homeTeam.score > g.awayTeam.score,
        total: g.homeTeam.score + g.awayTeam.score,
        margin: Math.abs(g.homeTeam.score - g.awayTeam.score),
        otCount,
      });
    }
  }

  const sortByHighestTeamScore = [...played].sort((a, b) =>
    Math.max(b.game.homeTeam.score, b.game.awayTeam.score) -
    Math.max(a.game.homeTeam.score, a.game.awayTeam.score)
  ).slice(0, 5);

  const sortByLowestTeamScore = [...played].sort((a, b) =>
    Math.min(a.game.homeTeam.score, a.game.awayTeam.score) -
    Math.min(b.game.homeTeam.score, b.game.awayTeam.score)
  ).slice(0, 5);

  const sortByHighestCombined = [...played].sort((a, b) => b.total - a.total).slice(0, 5);
  const sortByLowestCombined = [...played].sort((a, b) => a.total - b.total).slice(0, 5);
  const sortByLargestMargin = [...played].sort((a, b) => b.margin - a.margin).slice(0, 5);
  const sortBySmallestMargin = [...played].sort((a, b) => a.margin - b.margin).slice(0, 5);
  const sortByMostOT = played.filter((p) => p.otCount > 0)
    .sort((a, b) => b.otCount - a.otCount || b.total - a.total)
    .slice(0, 5);

  return {
    byCategory: {
      highestTeam: sortByHighestTeamScore,
      lowestTeam: sortByLowestTeamScore,
      highestCombined: sortByHighestCombined,
      lowestCombined: sortByLowestCombined,
      largestMargin: sortByLargestMargin,
      smallestMargin: sortBySmallestMargin,
      mostOT: sortByMostOT,
    },
    totalGames: played.length,
  };
}

function GameRow({ p, badge, badgeColor }: { p: Played; badge: string; badgeColor: string }) {
  const g = p.game;
  return (
    <Link
      href={`/game/${g.gameId}`}
      className="glass-tile p-4 flex items-center gap-3 group cursor-pointer"
    >
      <div
        className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: `${badgeColor}22`, boxShadow: `inset 0 0 0 1px ${badgeColor}55` }}
      >
        <span className="text-xl font-light font-mono tabular-nums" style={{ color: badgeColor }}>{badge}</span>
      </div>
      <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Image
            src={teamLogoUrl(g.awayTeam.teamId)}
            alt={g.awayTeam.teamTricode} width={28} height={28} unoptimized
          />
          <span className={`text-sm font-bold font-mono ${!p.homeWon ? "text-text-primary" : "text-text-secondary"}`}>{g.awayTeam.teamTricode}</span>
          <span className="text-base font-light font-mono tabular-nums text-text-secondary">{g.awayTeam.score}</span>
          <span className="text-text-secondary/40">·</span>
          <span className="text-base font-light font-mono tabular-nums text-text-secondary">{g.homeTeam.score}</span>
          <span className={`text-sm font-bold font-mono ${p.homeWon ? "text-text-primary" : "text-text-secondary"}`}>{g.homeTeam.teamTricode}</span>
          <Image
            src={teamLogoUrl(g.homeTeam.teamId)}
            alt={g.homeTeam.teamTricode} width={28} height={28} unoptimized
          />
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">{p.date}</p>
          {p.otCount > 0 && (
            <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-accent-amber font-bold">
              {p.otCount > 1 ? `${p.otCount}OT` : "OT"}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

function Section({
  icon: Icon, title, eyebrow, description, color, rows, badgeFor,
}: {
  icon: LucideIcon;
  title: string;
  eyebrow: string;
  description: string;
  color: string;
  rows: Played[];
  badgeFor: (p: Played) => string;
}) {
  if (rows.length === 0) return null;
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
        {rows.map((p) => <GameRow key={`${p.game.gameId}`} p={p} badge={badgeFor(p)} badgeColor={color} />)}
      </div>
    </section>
  );
}

export default async function RecordsPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const { byCategory, totalGames } = await compute();

  if (totalGames === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <PageHeader eyebrow="Season" icon={BookOpen} title={isZh ? "赛季纪录" : "Season Records"} />
        <EmptyState
          icon={BookOpen}
          title={isZh ? "暂无数据" : "No data yet"}
          description={isZh ? "本赛季产生已结束比赛后，纪录会显示在这里。" : "Records will populate once the season has produced finished games."}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow="Season"
        icon={BookOpen}
        title={isZh ? "赛季纪录" : "Season Records"}
        subtitle={isZh ? `本赛季单场纪录 — 最高球队得分、最大胜差、最长加时等等。共 ${totalGames} 场已完赛比赛。` : `Single-game season-high and season-low records across ${totalGames} finished games`}
        updatedAt={getScheduleAge()}
      />

      <Section
        icon={Crown}
        eyebrow={isZh ? "顶级得分" : "Top Score"}
        title={isZh ? "球队最高得分" : "Highest Team Score"}
        description={isZh ? "单队单场最高得分" : "Most points scored by a single team in one game"}
        color="#FFD700"
        rows={byCategory.highestTeam}
        badgeFor={(p) => String(Math.max(p.game.homeTeam.score, p.game.awayTeam.score))}
      />
      <Section
        icon={BookOpen}
        eyebrow={isZh ? "冷夜" : "Cold Night"}
        title={isZh ? "球队最低得分" : "Lowest Team Score"}
        description={isZh ? "单队单场最低得分" : "Fewest points by a team in a finished game"}
        color="#94A3B8"
        rows={byCategory.lowestTeam}
        badgeFor={(p) => String(Math.min(p.game.homeTeam.score, p.game.awayTeam.score))}
      />
      <Section
        icon={Crown}
        eyebrow={isZh ? "对攻战" : "Shootout"}
        title={isZh ? "两队总得分最高" : "Highest Combined Score"}
        description={isZh ? "两队总得分最高" : "Most total points scored across both teams"}
        color="#22C55E"
        rows={byCategory.highestCombined}
        badgeFor={(p) => String(p.total)}
      />
      <Section
        icon={BookOpen}
        eyebrow={isZh ? "防守战" : "Rock Fight"}
        title={isZh ? "两队总得分最低" : "Lowest Combined Score"}
        description={isZh ? "两队总得分最低 — 防守苦战" : "Fewest total points across both teams — defensive grinders"}
        color="#3B82F6"
        rows={byCategory.lowestCombined}
        badgeFor={(p) => String(p.total)}
      />
      <Section
        icon={Crown}
        eyebrow={isZh ? "屠杀" : "Beatdown"}
        title={isZh ? "最大胜差" : "Largest Margin"}
        description={isZh ? "本赛季最大胜差" : "Biggest blowouts of the season"}
        color="#F59E0B"
        rows={byCategory.largestMargin}
        badgeFor={(p) => `+${p.margin}`}
      />
      <Section
        icon={Crown}
        eyebrow={isZh ? "毫厘之差" : "Photo Finish"}
        title={isZh ? "最小胜差" : "Smallest Margin"}
        description={isZh ? "最接近的比赛 — 一球胜负" : "Closest finishes — won by a single basket"}
        color="#DF1B41"
        rows={byCategory.smallestMargin}
        badgeFor={(p) => `+${p.margin}`}
      />
      {byCategory.mostOT.length > 0 && (
        <Section
          icon={Crown}
          eyebrow="Bonus Basketball"
          title={isZh ? "最多加时" : "Most Overtimes"}
          description={isZh ? "需要加时才能决出胜负的比赛" : "Games that needed extra periods to settle"}
          color="#A855F7"
          rows={byCategory.mostOT}
          badgeFor={(p) => p.otCount > 1 ? `${p.otCount}OT` : "OT"}
        />
      )}

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/best-games", label: isZh ? "最佳比赛" : "Best Games", description: isZh ? "本赛季精彩对决" : "Top games of the season", icon: Trophy },
          { href: "/all-time-leaders", label: isZh ? "历史榜首" : "All-Time Leaders", description: isZh ? "历史数据领跑者" : "Career stat leaders", icon: Crown },
          { href: "/milestones", label: isZh ? "生涯轨迹" : "Milestones", description: isZh ? "生涯里程碑投影" : "Career milestone projections", icon: TrendingUp },
          { href: "/streaks", label: isZh ? "连胜连败" : "Streaks", description: isZh ? "球队连胜与连败" : "Win and loss streaks", icon: Activity },
          { href: "/this-day", label: isZh ? "历史上的今天" : "On This Day", description: isZh ? "历史比赛回顾" : "This day in history", icon: Calendar },
        ]}
      />
    </div>
  );
}

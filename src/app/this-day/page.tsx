import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Trophy, Crown, TrendingUp, Award, Flame, GitCompareArrows, ArrowRight } from "lucide-react";
import { getFullSchedule, getScheduleAge, type ScheduleGame } from "@/lib/api";
import { teamLogoUrl, playerHeadshotUrl } from "@/lib/teamUrls";
import { isPreseason } from "@/lib/games";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";
import { getLocale } from "@/lib/locale";
import { ICONIC_GAMES, type IconicGame } from "@/lib/iconicGames";
import { TEAM_META } from "@/lib/teams";

export const metadata: Metadata = {
  title: "On This Day",
  description: "Games that took place on today's calendar date earlier in NBA history — relive past matchups.",
};

export const revalidate = 600;

interface DayGame {
  game: ScheduleGame;
  dateLabel: string;
  yearsAgo: number;
  total: number;
  margin: number;
  isOT: boolean;
}

function parseUSDate(s: string): { y: number; m: number; d: number } | null {
  const [date] = s.split(" ");
  const parts = date.split("/");
  if (parts.length !== 3) return null;
  const m = parseInt(parts[0]);
  const d = parseInt(parts[1]);
  const y = parseInt(parts[2]);
  if (isNaN(m) || isNaN(d) || isNaN(y)) return null;
  return { y, m, d };
}

async function compute(): Promise<{ games: DayGame[]; today: string; }> {
  const schedule = await getFullSchedule().catch(() => []);
  const now = new Date();
  const todayMonth = now.getMonth() + 1;
  const todayDay = now.getDate();
  const todayYear = now.getFullYear();
  const matches: DayGame[] = [];

  for (const gd of schedule) {
    const parsed = parseUSDate(gd.gameDate);
    if (!parsed) continue;
    if (parsed.m !== todayMonth || parsed.d !== todayDay) continue;
    if (parsed.y === todayYear) continue; // not "this day in history" — that's today
    for (const g of gd.games) {
      if (g.gameStatus !== 3) continue;
      if (isPreseason(g.gameId)) continue; // skip preseason
      const isOT = /ot/i.test(g.gameStatusText || "");
      matches.push({
        game: g,
        dateLabel: `${String(parsed.m).padStart(2, "0")}/${String(parsed.d).padStart(2, "0")}/${parsed.y}`,
        yearsAgo: todayYear - parsed.y,
        total: g.homeTeam.score + g.awayTeam.score,
        margin: Math.abs(g.homeTeam.score - g.awayTeam.score),
        isOT,
      });
    }
  }

  // Sort by year desc, then by margin (closest first)
  matches.sort((a, b) => b.yearsAgo - a.yearsAgo || a.margin - b.margin);
  const todayLabel = `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][todayMonth - 1]} ${todayDay}`;
  return { games: matches, today: todayLabel };
}

export default async function ThisDayPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const { games, today } = await compute();

  // Iconic-game matches on today's MM-DD (any year). Hand-curated dataset
  // covers nights the official schedule doesn't (Wilt 100, Kobe 81, etc.)
  // and surfaces them above the auto-detected games.
  const now = new Date();
  const monthDay = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const iconicToday = ICONIC_GAMES
    .filter((g) => g.date.slice(5) === monthDay)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (games.length === 0 && iconicToday.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <PageHeader eyebrow="History" icon={CalendarDays} title={isZh ? `历史上的今天 · ${today}` : `On This Day · ${today}`} />
        <EmptyState
          icon={CalendarDays}
          title={isZh ? "暂无历史比赛" : "No archive matches"}
          description={isZh ? `当前赛程缓存中没有 ${today} 的历史比赛。NBA CDN 赛程主要包含当前赛季 — 早期赛季未完整索引。` : `The current schedule cache has no historical games for ${today}. The NBA CDN schedule mostly contains the current season — earlier seasons aren't fully indexed.`}
        />
      </div>
    );
  }

  // Group by year
  const byYear = new Map<number, DayGame[]>();
  for (const g of games) {
    const arr = byYear.get(g.yearsAgo) || [];
    arr.push(g);
    byYear.set(g.yearsAgo, arr);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow="History"
        icon={CalendarDays}
        title={isZh ? `历史上的今天 · ${today}` : `On This Day · ${today}`}
        subtitle={isZh ? `NBA 历史上同一天发生过的比赛 — 重温过往对决。共 ${games.length} 场。` : `${games.length} historical game${games.length === 1 ? "" : "s"} from past seasons on this calendar date`}
        updatedAt={getScheduleAge()}
      />

      {iconicToday.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <Flame size={14} className="text-accent-amber" />
            <h2 className="text-[10px] font-mono uppercase tracking-[0.25em] text-accent-amber">
              {isZh ? "经典之夜" : "Iconic Game On This Date"}
            </h2>
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-mono tabular-nums text-text-secondary">
              {iconicToday.length}
            </span>
          </div>
          <div className="space-y-2">
            {iconicToday.map((g) => (
              <IconicGameRow key={g.id} game={g} isZh={isZh} />
            ))}
          </div>
        </section>
      )}

      <div className="space-y-8">
        {years.map((yrs) => {
          const list = byYear.get(yrs)!;
          return (
            <section key={yrs}>
              <div className="mb-3 flex items-baseline gap-3">
                <span className="text-3xl font-light font-mono tabular-nums text-text-primary">{yrs}</span>
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-text-secondary">
                  {isZh ? "年前" : `year${yrs === 1 ? "" : "s"} ago`}
                </span>
                <span className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-mono tabular-nums text-text-secondary">{list.length} {isZh ? "场比赛" : `game${list.length === 1 ? "" : "s"}`}</span>
              </div>
              <div className="space-y-2">
                {list.map((dg) => {
                  const g = dg.game;
                  const homeWon = g.homeTeam.score > g.awayTeam.score;
                  return (
                    <Link
                      key={g.gameId}
                      href={`/game/${g.gameId}`}
                      className="glass-tile p-4 flex items-center gap-3 group cursor-pointer"
                    >
                      <div className="text-right shrink-0 hidden sm:block">
                        <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary/60">Date</p>
                        <p className="text-xs font-mono tabular-nums text-text-secondary">{dg.dateLabel}</p>
                      </div>
                      <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <Image
                            src={teamLogoUrl(g.awayTeam.teamId)}
                            alt={g.awayTeam.teamTricode} width={28} height={28} unoptimized
                          />
                          <span className={`text-sm font-bold font-mono ${!homeWon ? "text-text-primary" : "text-text-secondary"}`}>
                            {g.awayTeam.teamTricode}
                          </span>
                          <span className={`text-base font-light font-mono tabular-nums ${!homeWon ? "text-accent-amber" : "text-text-secondary"}`}>
                            {g.awayTeam.score}
                          </span>
                          <span className="text-text-secondary/40">·</span>
                          <span className={`text-base font-light font-mono tabular-nums ${homeWon ? "text-accent-amber" : "text-text-secondary"}`}>
                            {g.homeTeam.score}
                          </span>
                          <span className={`text-sm font-bold font-mono ${homeWon ? "text-text-primary" : "text-text-secondary"}`}>
                            {g.homeTeam.teamTricode}
                          </span>
                          <Image
                            src={teamLogoUrl(g.homeTeam.teamId)}
                            alt={g.homeTeam.teamTricode} width={28} height={28} unoptimized
                          />
                        </div>
                        <div className="hidden md:flex items-center gap-3 shrink-0">
                          <span className="text-[10px] font-mono tabular-nums text-text-secondary">
                            +{dg.margin} margin · {dg.total} total
                          </span>
                          {dg.isOT && (
                            <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-accent-amber font-bold">OT</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/iconic-games", label: isZh ? "经典之夜" : "Iconic Games", description: isZh ? "改变生涯的夜晚" : "Single-night iconic performances", icon: Flame },
          { href: "/iconic-seasons", label: isZh ? "经典赛季" : "Iconic Seasons", description: isZh ? "巅峰赛季快照" : "Peak-campaign snapshots", icon: Crown },
          { href: "/best-games", label: isZh ? "最佳比赛" : "Best Games", description: isZh ? "本赛季最精彩对决" : "Season highlights and standout matchups", icon: Trophy },
          { href: "/records", label: isZh ? "赛季纪录" : "Records", description: isZh ? "赛季单场纪录" : "Single-game season records", icon: Crown },
          { href: "/milestones", label: isZh ? "里程碑" : "Milestones", description: isZh ? "球员生涯关注" : "Career watch list", icon: TrendingUp },
          { href: "/all-time-leaders", label: isZh ? "历史榜单" : "All-Time Leaders", description: isZh ? "历史数据领先者" : "Career stat leaderboards", icon: Award },
        ]}
      />
    </div>
  );
}

function IconicGameRow({ game, isZh }: { game: IconicGame; isZh: boolean }) {
  const team = TEAM_META[game.team];
  const teamColor = team?.primaryColor || "#94A3B8";
  const title = isZh && game.titleZh ? game.titleZh : game.title;
  const year = game.date.slice(0, 4);
  const yearsAgo = new Date().getFullYear() - parseInt(year, 10);

  return (
    <Link
      href={game.gameId ? `/game/${game.gameId}` : `/compare?p1=${game.personId}`}
      className="glass-tile relative overflow-hidden p-3 flex items-center gap-3 group cursor-pointer hover:border-accent/40 transition-colors"
    >
      <div
        className="absolute inset-0 opacity-12 pointer-events-none"
        style={{ background: `linear-gradient(135deg, ${teamColor}55 0%, transparent 70%)` }}
      />
      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-bg-secondary border border-border shrink-0">
        <Image
          src={playerHeadshotUrl(game.personId)}
          alt={game.name}
          width={48}
          height={48}
          unoptimized
          className="w-full h-full object-cover object-top"
        />
      </div>
      <div className="relative flex-1 min-w-0">
        <p className="font-semibold text-text-primary text-sm truncate">{title}</p>
        <p className="text-[11px] text-text-secondary font-mono tabular-nums">
          <span className="text-accent-amber">{game.pts} PTS</span>
          <span className="text-text-secondary/40 mx-1.5">·</span>
          <span>{game.name}</span>
          <span className="text-text-secondary/40 mx-1.5">·</span>
          <span>{year}</span>
          <span className="text-text-secondary/40 mx-1.5">·</span>
          <span>{yearsAgo} {isZh ? "年前" : `year${yearsAgo === 1 ? "" : "s"} ago`}</span>
        </p>
      </div>
      <div className="relative shrink-0 text-text-secondary group-hover:text-accent transition-colors">
        {game.gameId ? <Trophy size={14} /> : <GitCompareArrows size={14} />}
        <ArrowRight size={11} className="inline ml-1 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}

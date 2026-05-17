import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { getFullSchedule, getScheduleAge, type ScheduleGame } from "@/lib/api";
import { teamLogoUrl } from "@/lib/teamUrls";
import { isPreseason } from "@/lib/games";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { getLocale } from "@/lib/locale";

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

  if (games.length === 0) {
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
    </div>
  );
}

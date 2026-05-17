import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Calendar, ListOrdered, Repeat } from "lucide-react";
import { getFullSchedule, getScheduleAge } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";

export const metadata: Metadata = {
  title: "Schedule Heatmap",
  description: "Game density across the season — see which nights are stacked and which are empty.",
};

export const revalidate = 600;

interface DayCell {
  date: string;     // YYYY-MM-DD
  display: string;  // MM/DD
  weekday: number;  // 0-6 (Sun-Sat)
  games: number;
  finished: number;
  isFuture: boolean;
}

function parseUSDate(s: string): { y: number; m: number; d: number } | null {
  const date = s.split(" ")[0];
  const parts = date.split("/");
  if (parts.length !== 3) return null;
  const m = parseInt(parts[0]);
  const d = parseInt(parts[1]);
  const y = parseInt(parts[2]);
  if (isNaN(m) || isNaN(d) || isNaN(y)) return null;
  return { y, m, d };
}

async function build() {
  const schedule = await getFullSchedule().catch(() => []);
  const map = new Map<string, DayCell>();
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  for (const gd of schedule) {
    const parsed = parseUSDate(gd.gameDate);
    if (!parsed) continue;
    if (gd.games.length === 0) continue;
    const iso = `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    const dateObj = new Date(parsed.y, parsed.m - 1, parsed.d);
    const cell: DayCell = map.get(iso) || {
      date: iso,
      display: `${parsed.m}/${parsed.d}`,
      weekday: dateObj.getDay(),
      games: 0,
      finished: 0,
      isFuture: iso > todayStr,
    };
    cell.games += gd.games.length;
    cell.finished += gd.games.filter((g) => g.gameStatus === 3).length;
    map.set(iso, cell);
  }

  const allDays = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  const totalGames = allDays.reduce((s, d) => s + d.games, 0);
  const finishedGames = allDays.reduce((s, d) => s + d.finished, 0);
  const maxGames = allDays.reduce((m, d) => d.games > m ? d.games : m, 0);

  // Group by month
  const byMonth = new Map<string, DayCell[]>();
  for (const d of allDays) {
    const ym = d.date.slice(0, 7);
    const arr = byMonth.get(ym) || [];
    arr.push(d);
    byMonth.set(ym, arr);
  }

  return { byMonth, totalGames, finishedGames, maxGames, totalDays: allDays.length, todayStr };
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function intensity(games: number, max: number): string {
  if (games === 0) return "bg-bg-hover/30";
  const pct = games / max;
  if (pct >= 0.85) return "bg-accent-amber/80";
  if (pct >= 0.65) return "bg-accent-amber/55";
  if (pct >= 0.45) return "bg-accent/55";
  if (pct >= 0.25) return "bg-accent/35";
  return "bg-accent/20";
}

export default async function ScheduleHeatmapPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const { byMonth, totalGames, finishedGames, maxGames, totalDays, todayStr } = await build();

  if (totalDays === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <PageHeader eyebrow={isZh ? "赛季" : "Season"} icon={Activity} title={isZh ? "赛程热力图" : "Schedule Heatmap"} />
        <EmptyState
          icon={Activity}
          title={isZh ? "暂无赛程数据" : "No schedule data"}
          description={isZh ? "无法加载本赛季赛程。" : "The season schedule could not be loaded."}
        />
      </div>
    );
  }

  const months = [...byMonth.keys()].sort();

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow={isZh ? "赛季" : "Season"}
        icon={Activity}
        title={isZh ? "赛程热力图" : "Schedule Heatmap"}
        subtitle={
          isZh
            ? `${totalGames} 场比赛跨 ${totalDays} 个日期 · 已完 ${finishedGames} · 单晚峰值 ${maxGames} 场`
            : `${totalGames} games across ${totalDays} dates · ${finishedGames} finished · peak ${maxGames} games on a single night`
        }
        updatedAt={getScheduleAge()}
      />

      <div className="space-y-6">
        {months.map((ym) => {
          const days = byMonth.get(ym)!;
          const [yr, mo] = ym.split("-");
          const monthLabel = `${MONTH_LABELS[parseInt(mo) - 1]} ${yr}`;
          const firstWeekday = days[0].weekday;
          const padding = Array.from({ length: firstWeekday });
          const monthGames = days.reduce((s, d) => s + d.games, 0);

          return (
            <section key={ym} className="glass-tile p-5">
              <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-text-primary">{monthLabel}</h2>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary tabular-nums">
                  {isZh ? `${monthGames} 场比赛 · ${days.length} 个日期` : `${monthGames} games · ${days.length} dates`}
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAY_LABELS.map((wl, i) => (
                  <span key={`wl-${i}`} className="text-[9px] font-mono uppercase text-text-secondary/60 text-center pb-1">{wl}</span>
                ))}
                {padding.map((_, i) => (
                  <div key={`pad-${i}`} />
                ))}
                {days.map((d) => {
                  const isToday = d.date === todayStr;
                  return (
                    <Link
                      key={d.date}
                      href={`/calendar?date=${d.date}`}
                      className={`relative aspect-square rounded-lg flex flex-col items-center justify-center group cursor-pointer transition-all hover:scale-110 ${intensity(d.games, maxGames)} ${isToday ? "ring-2 ring-accent" : ""}`}
                      title={`${d.display} · ${d.games} game${d.games === 1 ? "" : "s"} · ${d.finished} finished`}
                    >
                      <span className="text-[10px] font-mono tabular-nums leading-none text-text-primary group-hover:text-text-primary">
                        {d.display.split("/")[1]}
                      </span>
                      <span className="text-[8px] font-mono tabular-nums leading-none mt-0.5 text-text-primary/80">
                        {d.games}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="glass-tile p-4 mt-6 flex items-center gap-4 flex-wrap">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {isZh ? "热度" : "Intensity"}</p>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-bg-hover/30" />
          <span className="text-[9px] font-mono text-text-secondary">0</span>
          <div className="w-4 h-4 rounded bg-accent/20" />
          <div className="w-4 h-4 rounded bg-accent/35" />
          <div className="w-4 h-4 rounded bg-accent/55" />
          <div className="w-4 h-4 rounded bg-accent-amber/55" />
          <div className="w-4 h-4 rounded bg-accent-amber/80" />
          <span className="text-[9px] font-mono text-text-secondary">{maxGames}</span>
        </div>
        <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary">{isZh ? "点击任一格查看当日比赛" : "click any cell to view that date"}</span>
      </div>

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/calendar", label: isZh ? "日历" : "Calendar", description: isZh ? "按日期浏览比赛" : "Browse games by date", icon: Calendar },
          { href: "/schedule", label: isZh ? "赛程" : "Schedule", description: isZh ? "全联盟赛程一览" : "League-wide game listing", icon: ListOrdered },
          { href: "/back-to-back", label: isZh ? "背靠背" : "Back-to-Backs", description: isZh ? "连日作战赛程" : "Consecutive-day game pairs", icon: Repeat },
          { href: "/momentum", label: isZh ? "势头" : "Momentum", description: isZh ? "上升与下降的球队" : "Rising and falling teams", icon: Activity },
          { href: "/standings", label: isZh ? "排名榜" : "Standings", description: isZh ? "完整东西部排名" : "Full conference standings", icon: ListOrdered },
        ]}
      />
    </div>
  );
}

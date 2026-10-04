import { buildScheduleHeatmap, buildPlannedScheduleHeatmap } from "@/lib/schedule-heatmap";
import { homeDateUrl } from "@/lib/date-navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Calendar, ListOrdered, Repeat } from "lucide-react";
import { getCurrentSeasonSchedule, getScheduleAge, getScheduleCoverage } from "@/lib/api";
import { getLocale } from "@/lib/locale";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";
import { PlannedSnapshotNote } from "@/components/PlannedFixtures";
import { selectScheduleToolSource } from "@/lib/schedule-tools-server";
import { currentSeason } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Schedule Heatmap",
  description: "Listed NBA game density by Eastern Time date, with separately labeled partial planned fixtures.",
};

async function build() {
  const season = currentSeason();
  const schedule = await getCurrentSeasonSchedule(season).catch(() => []);
  const source = selectScheduleToolSource(schedule, getScheduleCoverage(schedule), season);
  return { source, ...(source.mode === 'planned' ? buildPlannedScheduleHeatmap(source.fixtures) : buildScheduleHeatmap(source.schedule)) };
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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
  const { source, byMonth, totalGames, finishedGames, maxGames, totalDays, todayStr } = await build();
  const planned = source.mode === "planned";

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
          planned
            ? (isZh ? `${totalGames.toLocaleString('en-US')} 场计划比赛 · ${totalDays} 个日期 · 单日峰值 ${maxGames} 场` : `${totalGames.toLocaleString('en-US')} planned fixtures · ${totalDays} dates · peak ${maxGames} games per date`)
            : isZh
            ? `${totalGames} 场比赛跨 ${totalDays} 个日期 · 已完 ${finishedGames} · 单晚峰值 ${maxGames} 场`
            : `${totalGames} games across ${totalDays} dates · ${finishedGames} finished · peak ${maxGames} games on a single night`
        }
        updatedAt={planned ? null : getScheduleAge()}
      />

      {planned && <div className="glass-tile p-4 mb-4">
        <p className="text-sm font-semibold mb-2">{isZh ? '2026-27 部分计划赛程 · 每队已分配 80 场' : '2026-27 partial planned schedule · 80 assigned games per team'}</p>
        <p className="text-sm text-text-secondary mb-2">{isZh ? '每队另有 2 场取决于杯赛结果，尚未分配；这些不是完整 82 场赛季总数。数字仅表示计划，日期过去也不代表比赛已完成。' : 'Two Cup-dependent games per team are unassigned, so these are not complete 82-game season totals. Counts describe plans; passing dates do not confirm results.'}</p>
        <PlannedSnapshotNote timeZone="America/New_York" />
      </div>}
      <p className="text-sm text-text-secondary mb-4">{isZh ? "日期按美国东部时间（America/New_York）；数量仅为已列比赛或已分配的计划比赛。零表示没有已列比赛，不代表当天确定没有比赛。" : "Dates use America/New_York (Eastern Time); counts reflect only listed games or assigned planned fixtures. A zero means no listed fixtures, not a confirmed empty date."}</p>
      <div className="space-y-6">
        {months.map((ym) => {
          const days = byMonth.get(ym)!;
          const [yr, mo] = ym.split("-");
          const monthLabel = isZh ? `${yr}年${Number(mo)}月` : `${MONTH_LABELS[parseInt(mo) - 1]} ${yr}`;
          const firstWeekday = days[0].weekday;
          const padding = Array.from({ length: firstWeekday });
          const monthGames = days.reduce((s, d) => s + d.games, 0);

          return (
            <section key={ym} className="glass-tile min-w-0 p-3 sm:p-5">
              <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-text-primary">{monthLabel}</h2>
                <span className="text-xs font-mono text-text-secondary tabular-nums">
                  {isZh ? `${monthGames} 场${planned ? "已列计划比赛" : "已列比赛"} · ${days.filter(day=>day.games>0).length} 个日期` : `${monthGames} ${planned ? "listed fixtures" : "listed games"} · ${days.filter(day=>day.games>0).length} dates`}
                </span>
              </div>
              <div className="grid min-w-0 grid-cols-7 gap-1 sm:gap-1.5">
                {WEEKDAY_LABELS.map((wl, i) => (
                  <span key={`wl-${i}`} className="text-xs font-mono text-text-secondary text-center pb-1">{isZh ? ["日", "一", "二", "三", "四", "五", "六"][i] : wl}</span>
                ))}
                {padding.map((_, i) => (
                  <div key={`pad-${i}`} />
                ))}
                {days.map((d) => {
                  const isToday = d.date === todayStr;
                  return (
                    <Link
                      key={d.date}
                      href={homeDateUrl(d.date,"America/New_York")}
                      prefetch={false}
                      className={`relative min-w-0 min-h-[52px] sm:min-h-[64px] rounded-lg flex flex-col items-center justify-center gap-1 group cursor-pointer transition-colors hover:ring-2 hover:ring-accent focus-visible:outline-2 focus-visible:outline-accent ${intensity(d.games, maxGames)} ${isToday ? "ring-2 ring-accent" : ""}`}
                      title={`${d.date} · ${d.games} ${isZh ? (planned ? "场已列计划比赛" : "场已列比赛") : (planned ? "listed planned fixtures" : "listed games")} · America/New_York`}
                      aria-label={`${d.date} · ${d.games} ${isZh ? (planned ? "场已列计划比赛" : "场已列比赛") : (planned ? "listed planned fixtures" : "listed games")} · America/New_York`}
                    >
                      <span className="text-sm font-mono tabular-nums leading-none text-text-primary group-hover:text-text-primary">
                        {d.display.split("/")[1]}
                      </span>
                      <span className="text-xs font-mono tabular-nums leading-none text-text-primary/80">
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
        <p className="text-xs font-mono text-text-secondary/60">/ {isZh ? "已列比赛数" : "Listed count"}</p>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-bg-hover/30" />
          <span className="text-xs font-mono text-text-secondary">0</span>
          <div className="w-4 h-4 rounded bg-accent/20" />
          <div className="w-4 h-4 rounded bg-accent/35" />
          <div className="w-4 h-4 rounded bg-accent/55" />
          <div className="w-4 h-4 rounded bg-accent-amber/55" />
          <div className="w-4 h-4 rounded bg-accent-amber/80" />
          <span className="text-xs font-mono text-text-secondary">{maxGames}</span>
        </div>
        <span className="text-xs font-mono text-text-secondary">{isZh ? "点击任一格查看当日比赛" : "click any cell to view that date"}</span>
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

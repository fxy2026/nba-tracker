import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Repeat, Activity, Calendar } from "lucide-react";
import { getCurrentSeasonSchedule, getScheduleAge, getScheduleCoverage } from "@/lib/api";
import { currentSeason } from "@/lib/constants";
import { calendarDateLabels } from "@/lib/calendar-date";
import { buildBackToBacks, selectScheduleToolSource } from "@/lib/schedule-tools-server";
import { TEAM_META } from "@/lib/teams";
import { teamLogoUrl } from "@/lib/teamUrls";
import { getLocale } from "@/lib/locale";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RelatedPages from "@/components/RelatedPages";
import ScheduleToolNotes from "@/components/ScheduleToolNotes";

export const metadata: Metadata = {
  title: "Back-to-Backs",
  description: "Listed consecutive-day NBA game pairs in Eastern Time, with separately labeled planned fixtures and verified results.",
};

export default async function BackToBackPage() {
  const isZh = (await getLocale()) === "zh";
  const season = currentSeason();
  const schedule = await getCurrentSeasonSchedule(season).catch(() => []);
  const source = selectScheduleToolSource(schedule, getScheduleCoverage(schedule), season);
  const planned = source.mode === "planned";
  const { totalPairs, completedCount, upcomingCount, unresolvedCount, visibleUpcoming, totals } = buildBackToBacks(source);

  if (totalPairs === 0) return <div className="max-w-5xl mx-auto px-4 py-6">
    <PageHeader eyebrow={isZh ? "赛程" : "Schedule"} icon={Repeat} title={isZh ? "背靠背" : "Back-to-Backs"} />
    <EmptyState icon={Repeat} title={isZh ? "未检测到背靠背" : "No B2Bs detected"} description={isZh ? "现有本赛季赛程数据中未找到连续两天的比赛。" : "No consecutive-day game pairs were found in the available current-season schedule."} />
  </div>;

  const ranked = [...totals].sort((a, b) => b.total - a.total || a.team.localeCompare(b.team));
  const maxCount = ranked[0]?.total || 1;
  return <div className="max-w-5xl mx-auto px-4 py-6">
    <PageHeader eyebrow={isZh ? "赛程" : "Schedule"} icon={Repeat} title={isZh ? "背靠背" : "Back-to-Backs"}
      subtitle={planned
        ? (isZh ? `${totalPairs} 组计划背靠背 · ${upcomingCount} 组第二场在今天或以后` : `${totalPairs} planned team-specific pairs · ${upcomingCount} with second dates today or later`)
        : (isZh ? `${totalPairs} 组已列背靠背 · ${completedCount} 组已确认完成 · ${upcomingCount} 组即将到来或进行中` : `${totalPairs} listed team-specific pairs · ${completedCount} confirmed complete · ${upcomingCount} upcoming or in progress`)}
      updatedAt={planned ? null : getScheduleAge()} />

    <ScheduleToolNotes planned={planned} isZh={isZh}>
      {planned && <p>{isZh ? '每队另有 2 场取决于杯赛结果，尚未分配；这些不是完整 82 场赛季总数。计划日期过去也不代表比赛已经进行。' : 'Two Cup-dependent games per team are unassigned, so these are not complete 82-game season totals. Passing planned dates do not confirm games were played.'}</p>}
      <p>{isZh ? '按美国东部时间（America/New_York）的连续两个日历日计算，每支球队分别计数。仅涉及已列比赛，不推断旅行、场馆或实际休息时长。' : 'Consecutive calendar days in America/New_York (Eastern Time), counted separately for each team. Listed fixtures only; no travel, venue or actual recovery-time inference.'}</p>
      <h2 className="text-sm font-semibold">{isZh ? '计算方法' : 'How pairs are counted'}</h2>
      <p>{isZh ? '每组包含同一球队在连续两个东部日历日的已列比赛。三天连赛可形成两组；两队连续交手会分别计入各自的组数。待定、条件性、延期或无效日期不计入。未分配的杯赛场次可能改变这些数量。' : 'Each pair contains one team’s listed games on consecutive ET dates. A three-day run can form two pairs; consecutive meetings between the same two teams count once per team. TBD, conditional, postponed and invalid dates are excluded. Unassigned Cup games may change these counts.'}</p>
      {!planned && <p>{isZh ? '只有两场都有已确认最终比分才算完成一组。胜率仅包含这些背靠背中有已确认最终比分的独立比赛，包括第二场尚未完成时的第一场；重叠组中的同一场比赛只算一次。' : 'A pair is complete only when both games have verified final scores. Win rates use unique verified final games belonging to a listed pair, including a final first game whose second game is pending. A game shared by overlapping pairs counts once.'}</p>}
    </ScheduleToolNotes>
    {!planned && unresolvedCount > 0 && <p className="text-sm text-text-secondary mb-5">{isZh ? `${unresolvedCount} 组日期已过但结果尚未确认，不计为已完成。` : `${unresolvedCount} pairs have past dates but unconfirmed results; they are not counted as complete.`}</p>}

    <div className="grid min-w-0 grid-cols-1 lg:grid-cols-2 gap-5">
      <section className="min-w-0">
        <h2 className="text-base font-semibold mb-3">{isZh ? '各队已列背靠背' : 'Listed pairs by team'}</h2>
        <p className="text-sm text-text-secondary mb-3">{isZh ? '全部 30 支球队 · 按组数排序' : 'All 30 teams · sorted by pair count'}</p>
        <div className="space-y-2">
          {ranked.map(team => <Link key={team.team} href={`/team/${team.team}`} className="glass-tile min-h-[64px] p-3 flex items-center gap-3 group">
            <Image src={teamLogoUrl(team.teamId)} alt="" width={32} height={32} unoptimized className="shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold group-hover:text-accent">{team.team} <span className="font-normal text-text-secondary">{TEAM_META[team.team].name}</span></p>
              <p className="text-xs leading-relaxed text-text-secondary">{planned
                ? (isZh ? `${team.total} 组计划背靠背` : `${team.total} planned pairs`)
                : (isZh ? `${team.completed} 组已确认完成 · ${team.upcoming} 组即将到来或进行中${team.unresolved ? ` · ${team.unresolved} 组结果待确认` : ''}` : `${team.completed} confirmed complete · ${team.upcoming} upcoming/in progress${team.unresolved ? ` · ${team.unresolved} unconfirmed` : ''}`)}</p>
              {!planned && team.verifiedGames > 0 && <p className="text-xs leading-relaxed text-text-secondary">{isZh ? `${team.wins}/${team.verifiedGames} 场已确认背靠背比赛获胜（${(team.wins / team.verifiedGames * 100).toFixed(0)}%）` : `${team.wins}/${team.verifiedGames} verified final B2B games won (${(team.wins / team.verifiedGames * 100).toFixed(0)}%)`}</p>}
              <div className="h-1 bg-bg-hover rounded-full overflow-hidden mt-2"><div className="h-full bg-accent rounded-full" style={{ width: `${team.total / maxCount * 100}%` }} /></div>
            </div>
            <span className="text-xl font-mono tabular-nums text-accent shrink-0">{team.total}</span>
          </Link>)}
        </div>
      </section>

      <section className="min-w-0">
        <h2 className="text-base font-semibold mb-3">{planned ? (isZh ? '接下来的计划背靠背' : 'Next planned pairs') : (isZh ? '即将到来或进行中的背靠背' : 'Upcoming or in-progress pairs')}</h2>
        <p className="text-sm text-text-secondary mb-3">{isZh ? `共 ${upcomingCount} 组 · 显示前 ${visibleUpcoming.length} 组` : `${upcomingCount} total · showing first ${visibleUpcoming.length}`}</p>
        <div className="space-y-2">
          {visibleUpcoming.length === 0 ? <p className="glass-tile p-4 text-sm text-text-secondary">{isZh ? '已列赛程中暂无第二场日期为今天或以后的背靠背。' : 'No listed pairs have a second date today or later.'}</p> : visibleUpcoming.map(pair => <div key={`${pair.team}-${pair.nights[0].key}`} className="glass-tile min-w-0 p-3">
            <Link href={`/team/${pair.team}`} className="inline-flex min-h-[44px] max-w-full items-center gap-2 text-sm font-semibold hover:text-accent">
              <Image src={teamLogoUrl(pair.teamId)} alt="" width={28} height={28} unoptimized />
              <span>{pair.team} · {TEAM_META[pair.team].name}</span>
            </Link>
            <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2">
              {pair.nights.map((night, index) => {
                const labels = calendarDateLabels(night.date, isZh ? 'zh-CN' : 'en-US');
                return <Link key={night.key} prefetch={false} href={night.href} className="flex min-h-[44px] min-w-0 flex-wrap items-center justify-between gap-x-2 rounded-lg bg-bg-hover/40 px-3 py-2 text-sm hover:text-accent focus-visible:outline-2 focus-visible:outline-accent" aria-label={`${pair.team} · ${night.date} · ${night.opponent} · America/New_York`}>
                  <span><span className="text-xs text-text-secondary">{isZh ? `第 ${index + 1} 场` : `Night ${index + 1}`} · </span><time dateTime={night.date}>{labels.weekday} {labels.label}</time></span>
                  <span className="font-semibold">{isZh ? '对阵' : 'vs'} {night.opponent}</span>
                </Link>;
              })}
            </div>
          </div>)}
        </div>
      </section>
    </div>
    <RelatedPages eyebrow={isZh ? "继续探索" : "Keep exploring"} pages={[
      { href: "/schedule-heatmap", label: isZh ? "赛程热力图" : "Schedule Heatmap", description: isZh ? "各日比赛密度" : "Game counts by date", icon: Activity },
      { href: "/calendar", label: isZh ? "日历" : "Calendar", description: isZh ? "按日期浏览比赛" : "Browse games by date", icon: Calendar },
      { href: "/schedule", label: isZh ? "赛程" : "Schedule", description: isZh ? "全联盟赛程一览" : "League-wide game listing", icon: Repeat },
    ]} />
  </div>;
}

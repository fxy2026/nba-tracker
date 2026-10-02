import Link from "next/link";
import type { ScheduleNavigation } from "@/lib/schedule-navigation";

export default function ScheduleEmptyNavigation({ date, navigation, isZh }: { date: string; navigation: ScheduleNavigation | null; isZh: boolean }) {
  const outside = !navigation?.availableFrom || !navigation.availableThrough || date < navigation.availableFrom || date > navigation.availableThrough;
  return (
    <>
      <p className="text-lg font-medium text-text-primary text-center">
        {date} — {outside
          ? (isZh ? "该日期的赛程数据暂不可用" : "Schedule data unavailable for this date")
          : (isZh ? "现有数据中未找到比赛" : "No games found in available data")}
      </p>
      {navigation?.availableFrom && navigation.availableThrough && (
        <p className="text-xs mt-2 text-center">{isZh ? "现有赛程覆盖日期" : "Available schedule dates"}: {navigation.availableFrom} – {navigation.availableThrough}</p>
      )}
      <div className="flex flex-wrap justify-center gap-3 my-4 text-sm">
        {navigation?.latestFinalDate && navigation.latestFinalDate !== date && (
          <Link href={`/?date=${navigation.latestFinalDate}`} className="px-4 py-2 glass-tile hover:border-accent/50 transition-colors">
            {isZh ? "最近可用赛果" : "Latest available results"} · {navigation.latestFinalDate}
          </Link>
        )}
        {navigation?.nextScheduledDate && navigation.nextScheduledDate !== date && (
          <Link href={`/?date=${navigation.nextScheduledDate}`} className="px-4 py-2 glass-tile hover:border-accent/50 transition-colors">
            {isZh ? "下一场已知赛程" : "Next known scheduled games"} · {navigation.nextScheduledDate}
          </Link>
        )}
      </div>
    </>
  );
}

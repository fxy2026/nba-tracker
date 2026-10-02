"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";
import { getRegularSeasonProgress } from "@/lib/season-calendar";
import { useLocale } from "@/components/LocaleProvider";

export default function SeasonProgress() {
  const { t, locale } = useLocale();
  const isZh = locale === "zh";
  const [now] = useState(() => Date.now());
  const { season, calendar, phase, progress, daysLeft } = getRegularSeasonProgress(new Date(now));
  const labels = {
    upcoming: isZh ? "尚未开始" : "Not started",
    regular: isZh ? "进行中" : "In progress",
    complete: isZh ? "常规赛已结束" : "Regular season complete",
    unknown: isZh ? "赛程日期待确认" : "Schedule dates unconfirmed",
  };

  return (
    <div className="glass-tile p-4 h-full flex flex-col justify-center">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="text-[10px] uppercase text-text-secondary font-semibold flex items-center gap-1">
          <Calendar size={10} />
          {season} {isZh ? "常规赛日程" : "Regular-season calendar"}
        </span>
        <div className="flex items-center gap-2">
          {daysLeft !== null && daysLeft > 0 && (
            <span className="text-[10px] text-text-secondary font-mono tabular-nums">{daysLeft}{t.seasonProgress.daysLeft}</span>
          )}
          <span className="text-[10px] font-medium text-accent">
            {labels[phase]}{progress !== null && <> &middot; <span className="font-mono tabular-nums">{progress.toFixed(0)}%</span></>}
          </span>
        </div>
      </div>
      {progress !== null && (
        <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden" role="progressbar" aria-label={isZh ? "常规赛日程时间进度" : "Regular-season calendar progress"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <div className="h-full rounded-full transition-all bg-gradient-to-r from-accent to-accent-hover" style={{ width: `${progress.toFixed(2)}%` }} />
        </div>
      )}
      {calendar && (
        <a href={calendar.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 text-[9px] text-text-secondary hover:text-accent">
          {calendar.start} – {calendar.end} · {isZh ? "美东日期 / NBA 官方赛程" : "Eastern dates / NBA official schedule"} ↗
        </a>
      )}
    </div>
  );
}

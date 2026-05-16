"use client";

import { memo } from "react";
import type { PeriodScore } from "@/lib/api";
import { useLocale } from "@/components/LocaleProvider";

interface Props {
  homePeriods: PeriodScore[];
  awayPeriods: PeriodScore[];
  homeTricode: string;
  awayTricode: string;
}

export default memo(function QuarterBars({ homePeriods, awayPeriods, homeTricode, awayTricode }: Props) {
  const { t } = useLocale();
  if (homePeriods.length === 0) return null;

  const maxScore = Math.max(
    ...homePeriods.map((p) => p.score),
    ...awayPeriods.map((p) => p.score),
    1
  );

  return (
    <div className="glass-tile p-4 mt-4">
      <div className="mb-3">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ By Quarter</p>
        <h3 className="text-sm font-semibold text-text-primary tracking-tight flex items-center gap-2 mt-1">
          <span className="w-1 h-4 bg-accent-amber rounded-full" />
          {t.quarterBars.title}
        </h3>
      </div>
      <div className="flex items-end gap-3 h-24">
        {homePeriods.map((hp, i) => {
          const ap = awayPeriods[i];
          const label = hp.period <= 4 ? `${t.playByPlayComp.quarter}${hp.period}` : `${t.playByPlayComp.overtime}${hp.period - 4}`;
          const awayWon = (ap?.score || 0) > hp.score;
          const homeWon = hp.score > (ap?.score || 0);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex items-end gap-0.5 h-16 w-full">
                {/* Away bar */}
                <div className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className={`text-[9px] font-mono tabular-nums mb-0.5 ${awayWon ? "text-accent-amber font-bold" : "text-text-secondary"}`}>{ap?.score || 0}</span>
                  <div
                    className={`w-full rounded-t transition-all ${awayWon ? "bg-accent-amber" : "bg-success/50"}`}
                    style={{ height: `${((ap?.score || 0) / maxScore) * 100}%` }}
                  />
                </div>
                {/* Home bar */}
                <div className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className={`text-[9px] font-mono tabular-nums mb-0.5 ${homeWon ? "text-accent-amber font-bold" : "text-text-secondary"}`}>{hp.score}</span>
                  <div
                    className={`w-full rounded-t transition-all ${homeWon ? "bg-accent-amber" : "bg-accent/50"}`}
                    style={{ height: `${(hp.score / maxScore) * 100}%` }}
                  />
                </div>
              </div>
              <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-text-secondary">{label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-4 mt-3 text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-success/50" />{awayTricode}</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-accent/50" />{homeTricode}</span>
      </div>
    </div>
  );
});

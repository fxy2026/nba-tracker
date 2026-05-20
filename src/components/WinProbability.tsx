"use client";

import { memo } from "react";
import { useLocale } from "@/components/LocaleProvider";
interface PeriodData {
  period: number;
  homeScore: number;
  awayScore: number;
}

interface Props {
  periods: PeriodData[];
}

export default memo(function WinProbability({ periods }: Props) {
  const { t } = useLocale();
  if (periods.length === 0) return null;

  // Compute cumulative differentials after each period
  let homeCum = 0;
  let awayCum = 0;
  const diffs: { label: string; diff: number }[] = [];

  for (const p of periods) {
    homeCum += p.homeScore;
    awayCum += p.awayScore;
    const diff = homeCum - awayCum;
    const label = p.period <= 4 ? `${t.playByPlayComp.quarter}${p.period}` : `${t.playByPlayComp.overtime}${p.period - 4}`;
    diffs.push({ label, diff });
  }

  const maxAbs = Math.max(...diffs.map((d) => Math.abs(d.diff)), 1);

  const ariaSummary = diffs.map((d) => `${d.label} ${d.diff > 0 ? "+" : ""}${d.diff}`).join(", ");

  return (
    <div className="mt-3 pt-3 border-t border-border/50" role="group" aria-label={`${t.winProb.title} — ${ariaSummary}`}>
      <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-secondary mb-2 flex items-center gap-2">
        <span className="w-1 h-3 bg-accent-amber rounded-full" />
        {t.winProb.title}
      </p>
      <div className="flex items-end gap-1.5 h-16" aria-hidden="true">
        {diffs.map((d, i) => {
          const heightPct = (Math.abs(d.diff) / maxAbs) * 100;
          const isPositive = d.diff >= 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              {/* Bar above center */}
              <div className="w-full flex flex-col items-center justify-end h-7 relative">
                {isPositive && (
                  <div
                    className="w-full rounded-t bg-success/70"
                    style={{ height: `${heightPct}%`, minHeight: d.diff !== 0 ? "3px" : "0" }}
                  />
                )}
              </div>
              {/* Center line */}
              <div className="w-full h-px bg-border/60" />
              {/* Bar below center */}
              <div className="w-full flex flex-col items-center justify-start h-7 relative">
                {!isPositive && d.diff !== 0 && (
                  <div
                    className="w-full rounded-b bg-accent/70"
                    style={{ height: `${heightPct}%`, minHeight: "3px" }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Labels */}
      <div className="flex gap-1.5 mt-1">
        {diffs.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[10px] text-text-secondary">{d.label}</span>
            <span className={`block text-[10px] font-medium ${d.diff > 0 ? "text-success" : d.diff < 0 ? "text-accent" : "text-text-secondary"}`}>
              {d.diff > 0 ? "+" : ""}{d.diff}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-text-secondary">
        <span className="text-success">{t.winProb.homeLeading}</span>
        <span className="text-accent">{t.winProb.awayLeading}</span>
      </div>
    </div>
  );
});

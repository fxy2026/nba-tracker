import type { PeriodScore } from "@/lib/api";

interface Props {
  homePeriods: PeriodScore[];
  awayPeriods: PeriodScore[];
  homeTricode: string;
  awayTricode: string;
}

export default function QuarterBars({ homePeriods, awayPeriods, homeTricode, awayTricode }: Props) {
  if (homePeriods.length === 0) return null;

  const maxScore = Math.max(
    ...homePeriods.map((p) => p.score),
    ...awayPeriods.map((p) => p.score),
    1
  );

  return (
    <div className="bg-bg-card rounded-xl border border-border p-4 mt-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-accent rounded-full" />
        Points by Quarter
      </h3>
      <div className="flex items-end gap-3 h-24">
        {homePeriods.map((hp, i) => {
          const ap = awayPeriods[i];
          const label = hp.period <= 4 ? `Q${hp.period}` : `OT${hp.period - 4}`;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex items-end gap-0.5 h-16 w-full">
                {/* Away bar */}
                <div className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className="text-[9px] text-text-secondary mb-0.5">{ap?.score || 0}</span>
                  <div
                    className="w-full bg-success/60 rounded-t"
                    style={{ height: `${((ap?.score || 0) / maxScore) * 100}%` }}
                  />
                </div>
                {/* Home bar */}
                <div className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className="text-[9px] text-text-secondary mb-0.5">{hp.score}</span>
                  <div
                    className="w-full bg-accent/60 rounded-t"
                    style={{ height: `${(hp.score / maxScore) * 100}%` }}
                  />
                </div>
              </div>
              <span className="text-[10px] text-text-secondary">{label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-text-secondary">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-success/60" />{awayTricode}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-accent/60" />{homeTricode}</span>
      </div>
    </div>
  );
}

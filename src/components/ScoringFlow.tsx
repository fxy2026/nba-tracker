import type { PeriodScore } from "@/lib/api";

interface Props {
  homePeriods: PeriodScore[];
  awayPeriods: PeriodScore[];
  homeTricode: string;
  awayTricode: string;
}

export default function ScoringFlow({ homePeriods, awayPeriods, homeTricode, awayTricode }: Props) {
  if (homePeriods.length === 0) return null;

  // Build cumulative score data
  const data: { label: string; home: number; away: number }[] = [];
  let hTotal = 0, aTotal = 0;
  data.push({ label: "Start", home: 0, away: 0 });

  for (let i = 0; i < homePeriods.length; i++) {
    hTotal += homePeriods[i].score;
    aTotal += awayPeriods[i]?.score || 0;
    const period = homePeriods[i].period;
    const label = period <= 4 ? `Q${period}` : `OT${period - 4}`;
    data.push({ label, home: hTotal, away: aTotal });
  }

  const maxScore = Math.max(...data.map((d) => Math.max(d.home, d.away)), 1);
  const w = 400, h = 140, pad = { top: 16, right: 40, bottom: 24, left: 36 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const toX = (i: number) => pad.left + (i / (data.length - 1)) * plotW;
  const toY = (v: number) => pad.top + plotH - (v / maxScore) * plotH;

  const homeLine = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(d.home)}`).join(" ");
  const awayLine = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(d.away)}`).join(" ");

  return (
    <div className="bg-bg-card rounded-xl border border-border p-4 mt-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-accent rounded-full" />
        Scoring Flow
      </h3>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = pad.top + plotH * (1 - ratio);
          const val = Math.round(maxScore * ratio);
          return (
            <g key={ratio}>
              <line x1={pad.left} y1={y} x2={w - pad.right} y2={y} stroke="var(--border)" strokeWidth={0.5} />
              <text x={pad.left - 4} y={y} textAnchor="end" dominantBaseline="central" fill="var(--text-secondary)" fontSize={8}>{val}</text>
            </g>
          );
        })}
        {/* Area fills */}
        <path d={`${homeLine} L${toX(data.length - 1)},${toY(0)} L${toX(0)},${toY(0)} Z`} fill="var(--accent)" fillOpacity={0.06} />
        <path d={`${awayLine} L${toX(data.length - 1)},${toY(0)} L${toX(0)},${toY(0)} Z`} fill="var(--success)" fillOpacity={0.06} />
        {/* Lines */}
        <path d={homeLine} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
        <path d={awayLine} fill="none" stroke="var(--success)" strokeWidth={2} strokeLinejoin="round" />
        {/* Dots + labels */}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(d.home)} r={3} fill="var(--accent)" />
            <circle cx={toX(i)} cy={toY(d.away)} r={3} fill="var(--success)" />
            <text x={toX(i)} y={h - 6} textAnchor="middle" fill="var(--text-secondary)" fontSize={9}>{d.label}</text>
          </g>
        ))}
        {/* End labels */}
        <text x={w - pad.right + 4} y={toY(data[data.length - 1].home)} dominantBaseline="central" fill="var(--accent)" fontSize={9} fontWeight={600}>{homeTricode}</text>
        <text x={w - pad.right + 4} y={toY(data[data.length - 1].away)} dominantBaseline="central" fill="var(--success)" fontSize={9} fontWeight={600}>{awayTricode}</text>
      </svg>
    </div>
  );
}

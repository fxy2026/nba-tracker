import { memo } from "react";

interface RadarChartProps {
  stats: { label: string; home: number; away: number; max: number }[];
  homeLabel: string;
  awayLabel: string;
}

export default memo(function RadarChart({ stats, homeLabel, awayLabel }: RadarChartProps) {
  const cx = 150, cy = 150, r = 110;
  const n = stats.length;

  // Precompute trig once per axis — used by rings, axis lines, dots, labels.
  const cos: number[] = new Array(n);
  const sin: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    cos[i] = Math.cos(angle);
    sin[i] = Math.sin(angle);
  }

  const rings = [0.25, 0.5, 0.75, 1];
  const gridRings = rings.map((scale) => {
    const parts: string[] = [];
    for (let i = 0; i < n; i++) parts.push(`${cx + r * scale * cos[i]},${cy + r * scale * sin[i]}`);
    return parts.join(" ");
  });

  // Axis lines + data dots + label positions, all derived from cos/sin arrays.
  const axes: { x2: number; y2: number }[] = new Array(n);
  const homePoints: { x: number; y: number }[] = new Array(n);
  const awayPoints: { x: number; y: number }[] = new Array(n);
  const labelPoints: { x: number; y: number }[] = new Array(n);
  for (let i = 0; i < n; i++) {
    axes[i] = { x2: cx + r * cos[i], y2: cy + r * sin[i] };
    const hRatio = Math.min(stats[i].home / stats[i].max, 1);
    const aRatio = Math.min(stats[i].away / stats[i].max, 1);
    homePoints[i] = { x: cx + r * hRatio * cos[i], y: cy + r * hRatio * sin[i] };
    awayPoints[i] = { x: cx + r * aRatio * cos[i], y: cy + r * aRatio * sin[i] };
    labelPoints[i] = { x: cx + (r + 22) * cos[i], y: cy + (r + 22) * sin[i] };
  }
  const homePolygon = homePoints.map((p) => `${p.x},${p.y}`).join(" ");
  const awayPolygon = awayPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="w-full max-w-[320px]">
      <svg viewBox="0 0 300 300" className="w-full">
        {/* Grid rings */}
        {gridRings.map((pts, i) => (
          <polygon key={i} points={pts} fill="none" stroke="var(--border)" strokeWidth={0.5} opacity={0.6} />
        ))}
        {/* Axis lines */}
        {axes.map((a, i) => (
          <line key={i} x1={cx} y1={cy} x2={a.x2} y2={a.y2} stroke="var(--border)" strokeWidth={0.5} opacity={0.4} />
        ))}
        {/* Away team polygon */}
        <polygon points={awayPolygon} fill="var(--success)" fillOpacity={0.15} stroke="var(--success)" strokeWidth={1.5} />
        {/* Home team polygon */}
        <polygon points={homePolygon} fill="var(--accent)" fillOpacity={0.15} stroke="var(--accent)" strokeWidth={1.5} />
        {/* Dots */}
        {homePoints.map((p, i) => (
          <circle key={`h${i}`} cx={p.x} cy={p.y} r={3} fill="var(--accent)" />
        ))}
        {awayPoints.map((p, i) => (
          <circle key={`a${i}`} cx={p.x} cy={p.y} r={3} fill="var(--success)" />
        ))}
        {/* Labels */}
        {stats.map((s, i) => (
          <text key={i} x={labelPoints[i].x} y={labelPoints[i].y} textAnchor="middle" dominantBaseline="central"
            fill="var(--text-secondary)" fontSize={10} fontWeight={500}>
            {s.label}
          </text>
        ))}
      </svg>
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-accent" />
          <span className="text-text-secondary">{homeLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-success" />
          <span className="text-text-secondary">{awayLabel}</span>
        </div>
      </div>
    </div>
  );
});

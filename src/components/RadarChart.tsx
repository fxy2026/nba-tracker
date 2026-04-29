interface RadarChartProps {
  stats: { label: string; home: number; away: number; max: number }[];
  homeLabel: string;
  awayLabel: string;
}

export default function RadarChart({ stats, homeLabel, awayLabel }: RadarChartProps) {
  const cx = 150, cy = 150, r = 110;
  const n = stats.length;

  const getPoint = (i: number, value: number, max: number) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    const ratio = Math.min(value / max, 1);
    return {
      x: cx + r * ratio * Math.cos(angle),
      y: cy + r * ratio * Math.sin(angle),
    };
  };

  const getLabelPoint = (i: number) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return {
      x: cx + (r + 22) * Math.cos(angle),
      y: cy + (r + 22) * Math.sin(angle),
    };
  };

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1];
  const gridRings = rings.map((scale) => {
    const points = Array.from({ length: n }, (_, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      return `${cx + r * scale * Math.cos(angle)},${cy + r * scale * Math.sin(angle)}`;
    });
    return points.join(" ");
  });

  // Axis lines
  const axes = Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return { x2: cx + r * Math.cos(angle), y2: cy + r * Math.sin(angle) };
  });

  // Data polygons
  const homePoints = stats.map((s, i) => getPoint(i, s.home, s.max));
  const awayPoints = stats.map((s, i) => getPoint(i, s.away, s.max));
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
        {stats.map((s, i) => {
          const lp = getLabelPoint(i);
          return (
            <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="central"
              fill="var(--text-secondary)" fontSize={10} fontWeight={500}>
              {s.label}
            </text>
          );
        })}
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
}

// Connector: bracket lines connecting two feeder rounds to one target round.
// Drawn as full-cell SVG with viewBox 0 0 100 100 so it stretches to fit any size.
export function Connector({
  side,
  highlight,
}: {
  side: "left" | "right";
  highlight?: boolean;
}) {
  const enterX = side === "left" ? 5 : 95;
  const turnX = side === "left" ? 50 : 50;
  const exitX = side === "left" ? 95 : 5;
  const strokeColor = highlight ? "#FFD700" : "rgba(148,163,184,0.45)";
  const strokeW = highlight ? 2 : 1.5;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      <path
        d={`M ${enterX} 25 L ${turnX} 25 L ${turnX} 50 M ${enterX} 75 L ${turnX} 75 L ${turnX} 50 M ${turnX} 50 L ${exitX} 50`}
        fill="none"
        strokeWidth={strokeW}
        vectorEffect="non-scaling-stroke"
        stroke={strokeColor}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface RoundLabelProps {
  label: string;
  sub: string;
  color: string;
  count: number;
}

export function RoundLabel({ label, sub, color, count }: RoundLabelProps) {
  return (
    <div className="text-center pb-2 mb-2 border-b border-border/40">
      <p className="text-[8px] font-mono uppercase tracking-[0.25em] text-text-secondary/50">/ {sub}</p>
      <p className="text-xs font-bold font-mono uppercase tracking-[0.18em] mt-0.5" style={{ color }}>{label}</p>
      <p className="text-[9px] font-mono tabular-nums text-text-secondary/60 mt-0.5">{count} series</p>
    </div>
  );
}

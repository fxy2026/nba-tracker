import type { ReportedScoreRow } from "./reported-score-sequence";

/** The only facts the interactive chart receives. No archive, identity or evidence payload. */
export interface ReportedScoreChartProps {
  rows: ReportedScoreRow[];
  homeTricode: string;
  awayTricode: string;
  sourceUrl: string;
  isZh: boolean;
}

export interface ReportedScorePoint extends ReportedScoreRow {
  sourceIndex: number;
  elapsedSeconds: number;
}

/** Plot printed clocks without replacing, rounding, deduplicating or sorting them. */
export function reportedScorePoints(rows: readonly ReportedScoreRow[]): ReportedScorePoint[] {
  return rows.map((row, sourceIndex) => {
    const match = /^(?:(\d{2}):([0-5]\d)|:([0-5]\d\.\d))$/.exec(row.clockAsPrinted);
    const remaining = match ? Number(match[1] || 0) * 60 + Number(match[2] || match[3]) : NaN;
    if (!Number.isInteger(row.period) || row.period < 1 || row.period > 4 || !Number.isFinite(remaining) || remaining > 720) {
      throw new Error("Reported score chart requires a verified regulation clock");
    }
    return { ...row, sourceIndex, elapsedSeconds: row.period * 720 - remaining };
  });
}

export type ScorePeriod = 0 | 1 | 2 | 3 | 4;

export function scoreChartDomain(period: ScorePeriod): [number, number] {
  return period === 0 ? [0, 2880] : [(period - 1) * 720, period * 720];
}

export function scoreChartPointsForPeriod(points: readonly ReportedScorePoint[], period: ScorePeriod) {
  return period === 0 ? points : points.filter(point => point.period === period);
}

/** Select a real row, including overlapping/duplicate clocks, by its plotted position. */
export function nearestReportedScorePoint(
  points: readonly ReportedScorePoint[], x: number, y: number,
  width: number, height: number, domain: readonly [number, number], maxScore: number,
): number | null {
  if (!points.length || !Number.isFinite(x) || !Number.isFinite(y) || width <= 0 || height <= 0 || maxScore <= 0) return null;
  let nearest = points[0].sourceIndex;
  let bestDistance = Infinity;
  for (const point of points) {
    const pointX = (point.elapsedSeconds - domain[0]) / (domain[1] - domain[0]) * width;
    const homeY = height * (1 - point.homeScore / maxScore);
    const awayY = height * (1 - point.awayScore / maxScore);
    const distance = (pointX - x) ** 2 + Math.min((homeY - y) ** 2, (awayY - y) ** 2);
    // Ties retain source order. The row slider/buttons reach every exact overlap.
    if (distance < bestDistance) { bestDistance = distance; nearest = point.sourceIndex; }
  }
  return nearest;
}

export function moveReportedScoreSelection(points: readonly ReportedScorePoint[], sourceIndex: number, delta: number): number | null {
  if (!points.length) return null;
  const current = Math.max(0, points.findIndex(point => point.sourceIndex === sourceIndex));
  return points[Math.max(0, Math.min(points.length - 1, current + delta))].sourceIndex;
}

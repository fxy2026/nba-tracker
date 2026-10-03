import { summarizeCourtShots, type CourtShot, type VerifiedShotChart } from "@/lib/court-shots";
import { TEAM_META } from "@/lib/teams";
import { courtToSvg } from "./court-geometry";

export type CourtSide = "away" | "home";
export type CourtFocus = "full" | CourtSide;
export interface ComparisonFilters { awayPlayer: string; homePlayer: string; period: string; result: string }
export const EMPTY_COMPARISON_FILTERS: ComparisonFilters = { awayPlayer: "all", homePlayer: "all", period: "all", result: "all" };
export const FULL_COURT = { length: 94, width: 50, basket: 5.25, padding: 3, scale: 10 } as const;

/**
 * Standardized comparison, NOT reconstructed attacking direction. The source is
 * basket-relative. In feet on a 94 × 50 court:
 * away = (5.25 + y, 25 - x), home = (88.75 - y, 25 + x).
 * This rigid rotation preserves every coordinate and distance, including x/y=0,
 * negative y and beyond-half-court shots. No clamping, jitter or half clipping.
 */
export function comparisonFeet(x: number, y: number, side: CourtSide): [number, number] {
  return side === "away" ? [5.25 + y, 25 - x] : [88.75 - y, 25 + x];
}
export function comparisonToSvg(x: number, y: number, side: CourtSide): [number, number] {
  return comparisonFeet(x, y, side).map(value => (value + FULL_COURT.padding) * FULL_COURT.scale) as [number, number];
}
export function projectComparisonShot(shot: CourtShot, awayId: number, focus: CourtFocus): [number, number] {
  return focus === "full" ? comparisonToSvg(shot.xFeet, shot.yFeet, shot.teamId === awayId ? "away" : "home") : courtToSvg(shot.xFeet, shot.yFeet);
}
/** Extend the display for genuine outliers rather than moving or hiding them. */
export function comparisonViewBox(points: readonly [number, number][], focus: CourtFocus) {
  const base = focus === "full" ? [0, 0, 1000, 560] : [0, -9, 540, 519];
  const x = Math.min(base[0], ...points.map(p => p[0] - 10));
  const y = Math.min(base[1], ...points.map(p => p[1] - 10));
  const right = Math.max(base[2], ...points.map(p => p[0] + 10));
  const bottom = Math.max(base[3], ...points.map(p => p[1] + 10));
  return { x, y, width: right - x, height: bottom - y };
}
export function compareCourtShots(data: VerifiedShotChart, filters: ComparisonFilters) {
  const teams = ["away", "home"] as const;
  const rows = teams.map(side => {
    const selectedPlayer = filters[side === "away" ? "awayPlayer" : "homePlayer"];
    const eligible = data.shots.filter(shot => shot.teamId === data[side].teamId
      && (selectedPlayer === "all" || String(shot.personId) === selectedPlayer)
      && (filters.period === "all" || String(shot.period) === filters.period));
    return { side, summary: summarizeCourtShots(eligible), shots: eligible.filter(shot => filters.result === "all" || shot.result === filters.result) };
  });
  const visible = new Set(rows.flatMap(row => row.shots.map(shot => shot.eventId)));
  return { away: rows[0], home: rows[1], shots: data.shots.filter(shot => visible.has(shot.eventId)) };
}
/** Dark Spurs ink remains legible on maple; otherwise use existing team colors. */
export function comparisonColor(tricode: string, side: CourtSide): string {
  return tricode === "SAS" ? "#34434c" : TEAM_META[tricode]?.primaryColor ?? (side === "away" ? "#256f9d" : "#a94149");
}
/** One keyboard stop for the chart; exact overlaps remain reachable with arrows. */
export function keyboardShotId(shots: readonly CourtShot[], selectedId: number | null, key: string): number | null | undefined {
  if (key === "Escape") return null;
  if (!shots.length) return undefined;
  const index = shots.findIndex(shot => shot.eventId === selectedId);
  if (key === "Home") return shots[0].eventId;
  if (key === "End") return shots[shots.length - 1].eventId;
  if (key === "ArrowRight" || key === "ArrowDown" || key === "Enter" || key === " ") return shots[Math.min(index + 1, shots.length - 1)].eventId;
  if (key === "ArrowLeft" || key === "ArrowUp") return shots[Math.max(0, index - 1)].eventId;
  return undefined;
}

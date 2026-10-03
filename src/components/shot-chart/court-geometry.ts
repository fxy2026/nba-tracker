import type { CourtShot } from "@/lib/court-shots";

// The NBA legacy chart is basket-relative. Do not clamp, jitter, flip, or infer
// coordinates from shot distance. Both teams share this one-basket orientation.
export const COURT = { left: -25, right: 25, baseline: -5.25, midcourt: 41.75, hoopHeight: 10, freeThrow: 13.75, laneHalfWidth: 8, threeRadius: 23.75, cornerThree: 22 } as const;
export const FLOOR = { left: -27, right: 27, back: -7.25, front: 43.75 } as const;
export interface CourtLine { points: [number, number][]; dashed?: boolean }
export function arc(cx: number, cy: number, radius: number, start: number, end: number, steps = 64): [number, number][] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = start + (end - start) * i / steps;
    return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius];
  });
}
export function courtLines(): CourtLine[] {
  const c = COURT;
  const join = Math.sqrt(c.threeRadius ** 2 - c.cornerThree ** 2);
  const angle = Math.acos(c.cornerThree / c.threeRadius);
  return [
    { points: [[c.left,c.baseline],[c.right,c.baseline],[c.right,c.midcourt],[c.left,c.midcourt],[c.left,c.baseline]] },
    { points: [[-8,c.baseline],[-8,c.freeThrow],[8,c.freeThrow],[8,c.baseline]] },
    { points: [[-6,c.baseline],[-6,c.freeThrow],[6,c.freeThrow],[6,c.baseline]] },
    { points: arc(0,c.freeThrow,6,0,Math.PI) },
    { points: arc(0,c.freeThrow,6,Math.PI,2*Math.PI), dashed: true },
    { points: [[-22,c.baseline],[-22,join]] },
    { points: [[22,c.baseline],[22,join]] },
    { points: arc(0,0,c.threeRadius,angle,Math.PI-angle) },
    { points: arc(0,0,4,0,Math.PI) },
    { points: arc(0,c.midcourt,6,Math.PI,2*Math.PI) },
    { points: arc(0,c.midcourt,2,Math.PI,2*Math.PI) },
  ];
}
export function courtToSvg(xFeet: number, yFeet: number): [number, number] {
  return [(xFeet - FLOOR.left) * 10, (yFeet - FLOOR.back) * 10];
}
export interface ShotFilters { teamId: string; personId: string; period: string; result: string }
export const EMPTY_FILTERS: ShotFilters = { teamId: "all", personId: "all", period: "all", result: "all" };
export function filterCourtShots(shots: readonly CourtShot[], filters: ShotFilters): CourtShot[] {
  return shots.filter((s) => (filters.teamId === "all" || String(s.teamId) === filters.teamId)
    && (filters.personId === "all" || String(s.personId) === filters.personId)
    && (filters.period === "all" || String(s.period) === filters.period)
    && (filters.result === "all" || s.result === filters.result));
}
export interface ProjectedShot { eventId: number; x: number; y: number; visible: boolean }
export function nearestShot(points: readonly ProjectedShot[], x: number, y: number, radius = 22): number | null {
  let nearest: number | null = null;
  let distance = radius ** 2;
  for (const p of points) {
    const d = (p.x-x)**2 + (p.y-y)**2;
    if (p.visible && d <= distance) { nearest = p.eventId; distance = d; }
  }
  return nearest;
}

export function formatCourtClock(clock: string): string {
  const match = /^PT(\d+)M(\d+(?:\.\d+)?)S$/.exec(clock);
  if (!match) return clock;
  const [whole, fraction=""] = match[2].split(".");
  const decimals = fraction.replace(/0+$/, "");
  return `${Number(match[1])}:${whole.padStart(2,"0")}${decimals?`.${decimals}`:""}`;
}

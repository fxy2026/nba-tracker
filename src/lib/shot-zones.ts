// NBA Shot Zone Classification (10-zone, matches Hupu/NBA standard layout)
// Court: x = 0-100 along 94ft, y = 0-100 along 50ft
// Basket at approximately (5.59, 50) for near-side

export type ShotZone =
  | "Restricted Area"      // within 4ft of basket
  | "Paint"                // paint (non-RA), inside the key
  | "Mid-Range (Left)"     // left side, between paint and 3pt line
  | "Mid-Range (Center)"   // center, between FT line and 3pt arc
  | "Mid-Range (Right)"    // right side, between paint and 3pt line
  | "Corner 3 (Left)"      // left corner beyond 3pt line
  | "Corner 3 (Right)"     // right corner beyond 3pt line
  | "Above Break 3 (Left)" // left wing beyond 3pt arc
  | "Above Break 3 (Center)" // top of key beyond 3pt arc
  | "Above Break 3 (Right)"; // right wing beyond 3pt arc

export interface ZoneStats {
  zone: ShotZone;
  made: number;
  total: number;
  pct: number; // 0-100
}

// Basket position in percentage coordinates
const BASKET_X = 5.59;
const BASKET_Y = 50;

// Court dimensions: 94ft x 50ft
const COURT_LENGTH = 94;
const COURT_WIDTH = 50;

// Convert percentage coords to feet from basket
function distFtFromBasket(x: number, y: number): number {
  const dx = ((x - BASKET_X) / 100) * COURT_LENGTH;
  const dy = ((y - BASKET_Y) / 100) * COURT_WIDTH;
  return Math.sqrt(dx * dx + dy * dy);
}

// Thresholds (feet)
const RESTRICTED_FT = 4;
const THREE_PT_FT = 23.75;
const CORNER_3_FT = 22;

// Paint: 16ft wide (8ft each side of basket), extends to free-throw line (15ft from basket)
const PAINT_HALF_WIDTH_PCT = (8 / COURT_WIDTH) * 100; // 8ft = 16% of court width
const PAINT_DEPTH_FT = 15; // free-throw line distance from basket

// Corner 3 extends 14ft from baseline. Basket is 5.25ft from baseline → 8.75ft from basket
const CORNER_DEPTH_FT = 14 - 5.25; // = 8.75ft from basket

// Angle from basket: 0° = straight ahead, 90° = sideline
function angleDeg(x: number, y: number): number {
  const dx = ((x - BASKET_X) / 100) * COURT_LENGTH;
  const dy = ((y - BASKET_Y) / 100) * COURT_WIDTH;
  if (dx === 0 && dy === 0) return 0;
  return Math.atan2(Math.abs(dy), dx) * (180 / Math.PI);
}

export function classifyShotZone(shot: { x: number; y: number; shotDistance: number }): ShotZone {
  const dist = shot.shotDistance > 0 ? shot.shotDistance : distFtFromBasket(shot.x, shot.y);
  const isLeft = shot.y < BASKET_Y;
  const baselineDist = ((shot.x - BASKET_X) / 100) * COURT_LENGTH; // feet from basket along court
  const lateralDist = Math.abs(((shot.y - BASKET_Y) / 100) * COURT_WIDTH); // feet from center

  // 1. Restricted Area (within 4ft)
  if (dist <= RESTRICTED_FT) {
    return "Restricted Area";
  }

  // 2. Paint (non-RA): inside the key rectangle (8ft wide each side, 15ft deep)
  if (lateralDist <= 8 && baselineDist <= PAINT_DEPTH_FT && baselineDist >= 0) {
    return "Paint";
  }

  // 3. Three-point territory
  // Corner 3: close to baseline AND beyond corner 3 distance
  const isCornerArea = baselineDist <= CORNER_DEPTH_FT;
  if (isCornerArea && dist >= CORNER_3_FT) {
    return isLeft ? "Corner 3 (Left)" : "Corner 3 (Right)";
  }
  // Above-break 3: beyond the standard 3pt arc
  if (dist > THREE_PT_FT) {
    const angle = angleDeg(shot.x, shot.y);
    if (angle >= 55) return isLeft ? "Above Break 3 (Left)" : "Above Break 3 (Right)";
    return "Above Break 3 (Center)";
  }

  // 4. Mid-range (between paint/RA and 3pt line)
  const angle = angleDeg(shot.x, shot.y);
  if (angle >= 55) return isLeft ? "Mid-Range (Left)" : "Mid-Range (Right)";
  return "Mid-Range (Center)";
}

// Aggregate shot data into per-zone stats
export function aggregateZoneStats(
  shots: { x: number; y: number; shotDistance: number; shotResult: string }[]
): ZoneStats[] {
  if (shots.length === 0) return [];

  const map = new Map<ShotZone, { made: number; total: number }>();

  for (const shot of shots) {
    const zone = classifyShotZone(shot);
    const entry = map.get(zone) || { made: 0, total: 0 };
    entry.total++;
    if (shot.shotResult === "Made") entry.made++;
    map.set(zone, entry);
  }

  return Array.from(map.entries()).map(([zone, { made, total }]) => ({
    zone,
    made,
    total,
    pct: (made / total) * 100,
  }));
}

// Map a shooting percentage to a color relative to league average
// Blue (cold, below avg) → Orange (neutral, at avg) → Red (hot, above avg)
export function getZoneColor(pct: number, leagueAvg: number): string {
  const diff = pct - leagueAvg;
  const clamped = Math.max(-20, Math.min(20, diff));
  const t = (clamped + 20) / 40; // 0 (cold) to 1 (hot)

  if (t <= 0.5) {
    const s = t * 2;
    const r = Math.round(59 + s * (245 - 59));
    const g = Math.round(130 + s * (158 - 130));
    const b = Math.round(246 + s * (11 - 246));
    return `rgb(${r},${g},${b})`;
  } else {
    const s = (t - 0.5) * 2;
    const r = Math.round(245 + s * (239 - 245));
    const g = Math.round(158 + s * (68 - 158));
    const b = Math.round(11 + s * (68 - 11));
    return `rgb(${r},${g},${b})`;
  }
}

// NBA Shot Zone Classification (14-zone standard)
// Court: x = 0-100 along 94ft, y = 0-100 along 50ft
// Basket at approximately (5.59, 50) for near-side

export type ShotZone =
  | "Restricted Area"
  | "Paint (Left)"
  | "Paint (Right)"
  | "Mid-Range (Left)"
  | "Mid-Range (Left Center)"
  | "Mid-Range (Center)"
  | "Mid-Range (Right Center)"
  | "Mid-Range (Right)"
  | "Corner 3 (Left)"
  | "Corner 3 (Right)"
  | "Above Break 3 (Left)"
  | "Above Break 3 (Left Center)"
  | "Above Break 3 (Center)"
  | "Above Break 3 (Right Center)"
  | "Above Break 3 (Right)";

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

// Lateral angle from basket (0 = straight ahead, 90 = sideline)
function angleDeg(x: number, y: number): number {
  const dx = ((x - BASKET_X) / 100) * COURT_LENGTH;
  const dy = ((y - BASKET_Y) / 100) * COURT_WIDTH;
  if (dx === 0 && dy === 0) return 0;
  return Math.atan2(Math.abs(dy), dx) * (180 / Math.PI);
}

// Thresholds (feet)
const RESTRICTED_FT = 4;
const PAINT_FT = 14;
const THREE_PT_FT = 23.75;
const CORNER_3_FT = 22;
const CORNER_ANGLE_THRESHOLD = 60; // corner 3s have high angle (near sideline)

export function classifyShotZone(shot: { x: number; y: number; shotDistance: number }): ShotZone {
  const dist = shot.shotDistance > 0 ? shot.shotDistance : distFtFromBasket(shot.x, shot.y);
  const angle = angleDeg(shot.x, shot.y);
  const isLeft = shot.y < BASKET_Y;

  // 1. Restricted Area (within 4ft)
  if (dist <= RESTRICTED_FT) {
    return "Restricted Area";
  }

  // 2. Paint (4-14ft)
  if (dist <= PAINT_FT) {
    return isLeft ? "Paint (Left)" : "Paint (Right)";
  }

  // 3. Three-point territory
  // Corner 3: high angle + distance >= corner threshold
  const isCorner3 = angle >= CORNER_ANGLE_THRESHOLD && dist >= CORNER_3_FT;
  // Above-break 3: distance > standard 3pt line
  const isAboveBreak3 = dist > THREE_PT_FT;

  if (isCorner3 || isAboveBreak3) {
    if (isCorner3 && !isAboveBreak3) {
      // True corner 3 (shorter distance, high angle)
      return isLeft ? "Corner 3 (Left)" : "Corner 3 (Right)";
    }
    // Corner vs wing: corners are near the baseline (< 14ft from basket along x)
    const baselineDist = ((shot.x - BASKET_X) / 100) * COURT_LENGTH;
    if (baselineDist <= 14 && angle >= CORNER_ANGLE_THRESHOLD) {
      return isLeft ? "Corner 3 (Left)" : "Corner 3 (Right)";
    }
    // Above-the-break 3s — split into 5 zones by angle
    if (angle >= 45) return isLeft ? "Above Break 3 (Left)" : "Above Break 3 (Right)";
    if (angle >= 25) return isLeft ? "Above Break 3 (Left Center)" : "Above Break 3 (Right Center)";
    return "Above Break 3 (Center)";
  }

  // 4. Mid-range (between paint and 3pt line)
  if (angle >= 60) return isLeft ? "Mid-Range (Left)" : "Mid-Range (Right)";
  if (angle >= 30) return isLeft ? "Mid-Range (Left Center)" : "Mid-Range (Right Center)";
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
// Returns hex color: red (hot) when above avg, blue (cold) when below
export function getZoneColor(pct: number, leagueAvg: number): string {
  const diff = pct - leagueAvg;
  // Clamp to [-20, +20] range for color mapping
  const clamped = Math.max(-20, Math.min(20, diff));
  const t = (clamped + 20) / 40; // 0 (cold) to 1 (hot)

  // Interpolate: blue (#3b82f6) → gray (#6b7280) → red (#ef4444)
  if (t <= 0.5) {
    const s = t * 2; // 0-1 within cold-to-neutral
    const r = Math.round(59 + s * (107 - 59));
    const g = Math.round(130 + s * (114 - 130));
    const b = Math.round(246 + s * (128 - 246));
    return `rgb(${r},${g},${b})`;
  } else {
    const s = (t - 0.5) * 2; // 0-1 within neutral-to-hot
    const r = Math.round(107 + s * (239 - 107));
    const g = Math.round(114 + s * (68 - 114));
    const b = Math.round(128 + s * (68 - 128));
    return `rgb(${r},${g},${b})`;
  }
}

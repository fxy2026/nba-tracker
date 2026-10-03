// Client-safe, minimal display types. This module never imports an archive.
// Coordinates are feet relative to the basket, as supplied by NBA legacy
// positions: positive x is right, positive y points toward midcourt. They are
// normalized to one basket, not a claim about the original attacking end.
export interface CourtShot {
  eventId: number;
  personId: number;
  playerName: string;
  teamId: number;
  teamTricode: string;
  period: number;
  clock: string;
  result: "Made" | "Missed";
  value: 2 | 3;
  xFeet: number;
  yFeet: number;
}

export interface CourtShotTeam {
  teamId: number;
  teamTricode: string;
  score: number;
}

export interface VerifiedShotChart {
  gameId: string;
  coordinateSystem: "nba-legacy-basket-feet";
  home: CourtShotTeam;
  away: CourtShotTeam;
  shots: CourtShot[];
  coverage: { mapped: number; total: number; complete: true };
  source: { label: "NBA official game charts"; url: string; retrievedAt: string };
}

/** The source's explicit value is authoritative, never distance or prose. */
export function summarizeCourtShots(shots: readonly CourtShot[]) {
  let made = 0, twosMade = 0, twosAttempted = 0, threesMade = 0, threesAttempted = 0;
  for (const shot of shots) {
    const hit = shot.result === "Made";
    if (hit) made++;
    if (shot.value === 3) { threesAttempted++; if (hit) threesMade++; }
    else { twosAttempted++; if (hit) twosMade++; }
  }
  return { made, attempted: shots.length, twosMade, twosAttempted, threesMade, threesAttempted };
}

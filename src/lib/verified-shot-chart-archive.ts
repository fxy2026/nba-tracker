// Server-only data boundary. Import court-shots for client display types, never
// this module: the factual archive and integrity pin must stay on the server.
import { createHash } from "node:crypto";
import rawFacts from "@/data/verified-shot-charts/0022500961.json";
import type { CourtShot, CourtShotTeam, VerifiedShotChart } from "./court-shots";

interface CurrentShotTeam extends CourtShotTeam {
  statistics?: {
    fieldGoalsMade?: unknown;
    fieldGoalsAttempted?: unknown;
    threePointersMade?: unknown;
    threePointersAttempted?: unknown;
  };
}

export interface ShotChartGameIdentity {
  gameId: string;
  gameStatus: number;
  gameCode: string;
  gameDateTimeUTC?: string;
  gameTimeUTC?: string;
  homeTeam: CurrentShotTeam;
  awayTeam: CurrentShotTeam;
}

const reviewed = {
  gameId: "0022500961",
  gameCode: "20260313/MEMDET",
  gameTimeUTC: "2026-03-13T23:30:00Z",
  home: { teamId: 1610612765, teamTricode: "DET", score: 126 },
  away: { teamId: 1610612763, teamTricode: "MEM", score: 110 },
  factsSha256: "00dbdba6cd68f72513fe80dcdbd44c1b7588bf9c1df14d38bd4a66fd65aadaff",
  source: {
    label: "NBA official game charts" as const,
    url: "https://www.nba.com/game/mem-vs-det-0022500961/game-charts",
    retrievedAt: "2026-10-03T05:08:18.649Z",
  },
} as const;

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const positiveId = (value: unknown): value is number => count(value) && value > 0;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const sameTeam = (actual: unknown, expected: CourtShotTeam) => object(actual) &&
  actual.teamId === expected.teamId && actual.teamTricode === expected.teamTricode && actual.score === expected.score;

// A schedule has no shooting statistics. When a current box does provide them,
// a revision must not contradict the archived chart beside that box. Undefined
// values remain unknown; null, strings and conflicting counts are not zero.
function currentShootingMatches(team: CurrentShotTeam, expected: readonly number[]): boolean {
  if (team.statistics === undefined) return true;
  if (!object(team.statistics)) return false;
  return (["fieldGoalsMade", "fieldGoalsAttempted", "threePointersMade", "threePointersAttempted"] as const)
    .every((key, index) => team.statistics![key] === undefined || team.statistics![key] === expected[index]);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

interface PlayerEvidence {
  personId: number;
  name: string;
  teamId: number;
  teamTricode: string;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
}

/** Fail closed on source edits, mismatched games, identities or shot totals. */
export function validateReviewedShotChart(raw: unknown, game: ShotChartGameIdentity): VerifiedShotChart | null {
  try {
    if (game.gameId !== reviewed.gameId || game.gameStatus !== 3 ||
      !sameTeam(game.homeTeam, reviewed.home) || !sameTeam(game.awayTeam, reviewed.away) ||
      !currentShootingMatches(game.homeTeam, [50, 92, 12, 35]) ||
      !currentShootingMatches(game.awayTeam, [38, 89, 15, 41]) ||
      game.gameCode !== reviewed.gameCode ||
      (game.gameDateTimeUTC === undefined && game.gameTimeUTC === undefined) ||
      (game.gameDateTimeUTC !== undefined && game.gameDateTimeUTC !== reviewed.gameTimeUTC) ||
      (game.gameTimeUTC !== undefined && game.gameTimeUTC !== reviewed.gameTimeUTC)) return null;
    if (!object(raw) || raw.schemaVersion !== 1 || !object(raw.game) ||
      raw.game.gameId !== reviewed.gameId || raw.game.gameStatus !== 3 ||
      raw.game.gameCode !== reviewed.gameCode || raw.game.gameTimeUTC !== reviewed.gameTimeUTC ||
      !sameTeam(raw.game.homeTeam, reviewed.home) || !sameTeam(raw.game.awayTeam, reviewed.away) ||
      !Array.isArray(raw.players) || !Array.isArray(raw.shots) || raw.shots.length !== 181 ||
      createHash("sha256").update(canonicalJson(raw)).digest("hex") !== reviewed.factsSha256) return null;

    const players = new Map<number, PlayerEvidence>();
    for (const row of raw.players) {
      if (!object(row) || !positiveId(row.personId) || players.has(row.personId) ||
        typeof row.name !== "string" || !row.name.trim() || !positiveId(row.teamId) || typeof row.teamTricode !== "string" ||
        ![reviewed.home, reviewed.away].some(team => team.teamId === row.teamId && team.teamTricode === row.teamTricode) ||
        ![row.fieldGoalsMade, row.fieldGoalsAttempted, row.threePointersMade, row.threePointersAttempted].every(count)) return null;
      players.set(row.personId, row as unknown as PlayerEvidence);
    }

    const shots: CourtShot[] = [];
    const events = new Set<number>();
    for (const row of raw.shots) {
      if (!object(row) || !positiveId(row.actionNumber) || events.has(row.actionNumber) ||
        !positiveId(row.personId) || !positiveId(row.period) || row.period > 4 ||
        typeof row.clock !== "string" || !/^PT(?:0\d|1[0-2])M[0-5]\d(?:\.\d+)?S$/.test(row.clock) ||
        (row.shotResult !== "Made" && row.shotResult !== "Missed") || (row.shotValue !== 2 && row.shotValue !== 3) ||
        !finite(row.xLegacy) || !finite(row.yLegacy) || Math.abs(row.xLegacy) > 250 || row.yLegacy < -52.5 || row.yLegacy > 887.5) return null;
      const player = players.get(row.personId);
      if (!player || row.teamId !== player.teamId || row.teamTricode !== player.teamTricode) return null;
      events.add(row.actionNumber);
      shots.push({
        eventId: row.actionNumber, personId: player.personId, playerName: player.name,
        teamId: player.teamId, teamTricode: player.teamTricode, period: row.period, clock: row.clock,
        result: row.shotResult, value: row.shotValue,
        // Official hanaV3 scale is exactly legacy units / 10. Do not infer a
        // location from distance/text, mirror by team/quarter, or clamp points.
        xFeet: row.xLegacy / 10, yFeet: row.yLegacy / 10,
      });
    }
    for (const player of players.values()) {
      const rows = shots.filter(shot => shot.personId === player.personId);
      if (rows.length !== player.fieldGoalsAttempted || rows.filter(shot => shot.result === "Made").length !== player.fieldGoalsMade ||
        rows.filter(shot => shot.value === 3).length !== player.threePointersAttempted ||
        rows.filter(shot => shot.value === 3 && shot.result === "Made").length !== player.threePointersMade) return null;
    }
    for (const [team, attempted, made, threeAttempted, threeMade] of [
      [reviewed.home, 92, 50, 35, 12], [reviewed.away, 89, 38, 41, 15],
    ] as const) {
      const rows = shots.filter(shot => shot.teamId === team.teamId);
      if (rows.length !== attempted || rows.filter(shot => shot.result === "Made").length !== made ||
        rows.filter(shot => shot.value === 3).length !== threeAttempted ||
        rows.filter(shot => shot.value === 3 && shot.result === "Made").length !== threeMade) return null;
    }
    return {
      gameId: reviewed.gameId, coordinateSystem: "nba-legacy-basket-feet",
      home: { ...reviewed.home }, away: { ...reviewed.away }, shots,
      coverage: { mapped: shots.length, total: 181, complete: true }, source: { ...reviewed.source },
    };
  } catch { return null; }
}

export function getVerifiedShotChart(game: ShotChartGameIdentity): VerifiedShotChart | null {
  return validateReviewedShotChart(rawFacts, game);
}

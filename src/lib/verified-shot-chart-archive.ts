// Server-only data boundary. Import court-shots for client display types, never
// this module: the factual archives and integrity pins must stay on the server.
import { createHash } from "node:crypto";
import memDet from "@/data/verified-shot-charts/0022500961.json";
import nykSas from "@/data/verified-shot-charts/0042500405.json";
import lalHou from "@/data/verified-shot-charts/0042500173.json";
import finalsGame1 from "@/data/verified-shot-charts/0042500401.json";
import finalsGame2 from "@/data/verified-shot-charts/0042500402.json";
import finalsGame3 from "@/data/verified-shot-charts/0042500403.json";
import finalsGame4 from "@/data/verified-shot-charts/0042500404.json";
import { reviewedShotGames } from "./verified-shot-chart-allowlist";
import type { CourtShot, CourtShotTeam, VerifiedShotChart } from "./court-shots";

type ShootingKey = "fieldGoalsMade" | "fieldGoalsAttempted" | "threePointersMade" | "threePointersAttempted";
const shootingKeys: readonly ShootingKey[] = ["fieldGoalsMade", "fieldGoalsAttempted", "threePointersMade", "threePointersAttempted"];
interface CurrentShotTeam extends CourtShotTeam {
  statistics?: Partial<Record<ShootingKey | "freeThrowsMade" | "points", unknown>>;
  periods?: unknown;
  players?: unknown;
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
interface ReviewedPeriod { readonly shooting: readonly number[]; readonly freeThrowsMade: number; readonly points: number }
interface ReviewedTeam extends CourtShotTeam {
  readonly shooting: readonly number[];
  readonly freeThrowsMade: number;
  readonly periods: readonly ReviewedPeriod[];
}
const archives: Record<keyof typeof reviewedShotGames, unknown> = {
  "0022500961": memDet, "0042500405": nykSas, "0042500173": lalHou,
  "0042500401": finalsGame1, "0042500402": finalsGame2, "0042500403": finalsGame3, "0042500404": finalsGame4,
};
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const positiveId = (value: unknown): value is number => count(value) && value > 0;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const sameTeam = (actual: unknown, expected: CourtShotTeam) => object(actual) &&
  actual.teamId === expected.teamId && actual.teamTricode === expected.teamTricode && actual.score === expected.score;

// A schedule does not provide box statistics. Genuinely absent fields stay
// unknown. Defined nulls, strings and conflicting counts must fail closed.
function currentShootingMatches(statistics: unknown, expected: readonly number[]): boolean {
  if (statistics === undefined) return true;
  return object(statistics) && shootingKeys.every((key, index) => statistics[key] === undefined || statistics[key] === expected[index]);
}
function currentTeamMatches(actual: CurrentShotTeam, expected: ReviewedTeam): boolean {
  if (!sameTeam(actual, expected) || !currentShootingMatches(actual.statistics, expected.shooting)) return false;
  if (actual.statistics !== undefined && (actual.statistics.freeThrowsMade !== undefined && actual.statistics.freeThrowsMade !== expected.freeThrowsMade ||
    actual.statistics.points !== undefined && actual.statistics.points !== expected.score)) return false;
  if (actual.periods === undefined) return true;
  if (!Array.isArray(actual.periods)) return false;
  if (actual.periods.length === 0) return true; // Normal API empty-array unknown contract.
  return actual.periods.length === expected.periods.length && actual.periods.every((row, index) => object(row) &&
    row.period === index + 1 && row.score === expected.periods[index].points &&
    (row.periodType === undefined || row.periodType === (index < 4 ? "REGULAR" : "OVERTIME")));
}
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
interface PlayerEvidence {
  personId: number; name: string; teamId: number; teamTricode: string;
  fieldGoalsMade: number; fieldGoalsAttempted: number; threePointersMade: number; threePointersAttempted: number;
}
function currentPlayersMatch(actual: CurrentShotTeam, players: ReadonlyMap<number, PlayerEvidence>): boolean {
  if (actual.players === undefined) return true;
  if (!Array.isArray(actual.players)) return false;
  const ids = new Set<number>();
  for (const row of actual.players) {
    if (!object(row) || !positiveId(row.personId) || ids.has(row.personId)) return false;
    const expected = players.get(row.personId);
    if (!expected || expected.teamId !== actual.teamId ||
      (row.name !== undefined && row.name !== expected.name) ||
      (row.teamId !== undefined && row.teamId !== expected.teamId) ||
      (row.teamTricode !== undefined && row.teamTricode !== expected.teamTricode) ||
      !currentShootingMatches(row.statistics, shootingKeys.map(key => expected[key]))) return false;
    ids.add(row.personId);
  }
  return true;
}
/** Validate the source ISO clock, including fractional boundary seconds. */
export function reviewedShotClockSeconds(clock: unknown, period: number): number | null {
  if (typeof clock !== "string" || !Number.isSafeInteger(period) || period < 1 || period > 5) return null;
  const match = /^PT(\d{2})M([0-5]\d(?:\.\d+)?)S$/.exec(clock);
  if (!match) return null;
  const seconds = Number(match[1]) * 60 + Number(match[2]);
  return Number.isFinite(seconds) && seconds <= (period > 4 ? 300 : 720) ? seconds : null;
}
function shootingMatches(rows: readonly CourtShot[], expected: readonly number[]): boolean {
  const actual = [rows.filter(shot => shot.result === "Made").length, rows.length,
    rows.filter(shot => shot.value === 3 && shot.result === "Made").length, rows.filter(shot => shot.value === 3).length];
  return actual.every((value, index) => value === expected[index]);
}
/** Fail closed on source edits, mismatched games, identities, periods or totals. */
export function validateReviewedShotChart(raw: unknown, game: ShotChartGameIdentity): VerifiedShotChart | null {
  try {
    if (!object(game) || !Object.hasOwn(reviewedShotGames, game.gameId)) return null;
    const reviewed = reviewedShotGames[game.gameId as keyof typeof reviewedShotGames];
    const total = reviewed.home.shooting[1] + reviewed.away.shooting[1];
    if (game.gameStatus !== 3 || !currentTeamMatches(game.homeTeam, reviewed.home) || !currentTeamMatches(game.awayTeam, reviewed.away) ||
      game.gameCode !== reviewed.gameCode || (game.gameDateTimeUTC === undefined && game.gameTimeUTC === undefined) ||
      (game.gameDateTimeUTC !== undefined && game.gameDateTimeUTC !== reviewed.gameTimeUTC) ||
      (game.gameTimeUTC !== undefined && game.gameTimeUTC !== reviewed.gameTimeUTC)) return null;
    if (!object(raw) || raw.schemaVersion !== 1 || !object(raw.game) ||
      raw.game.gameId !== reviewed.gameId || raw.game.gameStatus !== 3 ||
      raw.game.gameCode !== reviewed.gameCode || raw.game.gameTimeUTC !== reviewed.gameTimeUTC ||
      !sameTeam(raw.game.homeTeam, reviewed.home) || !sameTeam(raw.game.awayTeam, reviewed.away) ||
      !Array.isArray(raw.players) || !Array.isArray(raw.shots) || raw.shots.length !== total ||
      createHash("sha256").update(canonicalJson(raw)).digest("hex") !== reviewed.factsSha256) return null;
    const players = new Map<number, PlayerEvidence>();
    for (const row of raw.players) {
      if (!object(row) || !positiveId(row.personId) || players.has(row.personId) ||
        typeof row.name !== "string" || !row.name.trim() || !positiveId(row.teamId) || typeof row.teamTricode !== "string" ||
        ![reviewed.home, reviewed.away].some(team => team.teamId === row.teamId && team.teamTricode === row.teamTricode) ||
        !shootingKeys.every(key => count(row[key]))) return null;
      players.set(row.personId, row as unknown as PlayerEvidence);
    }
    if (!currentPlayersMatch(game.homeTeam, players) || !currentPlayersMatch(game.awayTeam, players)) return null;
    const shots: CourtShot[] = [];
    const events = new Set<number>();
    let lastPeriod = 0, lastSeconds = 720;
    for (const row of raw.shots) {
      if (!object(row) || !positiveId(row.actionNumber) || events.has(row.actionNumber) ||
        !positiveId(row.personId) || !positiveId(row.period) || row.period > reviewed.home.periods.length ||
        typeof row.clock !== "string" ||
        (row.shotResult !== "Made" && row.shotResult !== "Missed") || (row.shotValue !== 2 && row.shotValue !== 3) ||
        !finite(row.xLegacy) || !finite(row.yLegacy) || Math.abs(row.xLegacy) > 250 || row.yLegacy < -52.5 || row.yLegacy > 887.5) return null;
      const seconds = reviewedShotClockSeconds(row.clock, row.period);
      if (seconds === null || row.period < lastPeriod || (row.period === lastPeriod && seconds > lastSeconds)) return null;
      lastPeriod = row.period; lastSeconds = seconds;
      const player = players.get(row.personId);
      if (!player || row.teamId !== player.teamId || row.teamTricode !== player.teamTricode) return null;
      events.add(row.actionNumber);
      shots.push({ eventId: row.actionNumber, personId: player.personId, playerName: player.name,
        teamId: player.teamId, teamTricode: player.teamTricode, period: row.period, clock: row.clock,
        result: row.shotResult, value: row.shotValue,
        // Exact hanaV3 legacy scale. Never infer, mirror, clamp or jitter.
        xFeet: row.xLegacy / 10, yFeet: row.yLegacy / 10 });
    }
    for (const player of players.values()) {
      if (!shootingMatches(shots.filter(shot => shot.personId === player.personId), shootingKeys.map(key => player[key]))) return null;
    }
    for (const team of [reviewed.home, reviewed.away]) {
      const rows = shots.filter(shot => shot.teamId === team.teamId);
      if (!shootingMatches(rows, team.shooting) || team.periods.reduce((sum, period) => sum + period.points, 0) !== team.score ||
        team.periods.reduce((sum, period) => sum + period.freeThrowsMade, 0) !== team.freeThrowsMade) return null;
      for (const [index, period] of team.periods.entries()) {
        const periodShots = rows.filter(shot => shot.period === index + 1);
        if (!shootingMatches(periodShots, period.shooting) ||
          periodShots.reduce((sum, shot) => sum + (shot.result === "Made" ? shot.value : 0), 0) + period.freeThrowsMade !== period.points) return null;
      }
    }
    const displayTeam = ({ teamId, teamTricode, score }: CourtShotTeam) => ({ teamId, teamTricode, score });
    return { gameId: reviewed.gameId, coordinateSystem: "nba-legacy-basket-feet",
      home: displayTeam(reviewed.home), away: displayTeam(reviewed.away), shots,
      coverage: { mapped: shots.length, total, complete: true }, source: { ...reviewed.source } };
  } catch { return null; }
}
export function getVerifiedShotChart(game: ShotChartGameIdentity): VerifiedShotChart | null {
  if (!game || !Object.hasOwn(archives, game.gameId)) return null;
  return validateReviewedShotChart(archives[game.gameId as keyof typeof archives], game);
}

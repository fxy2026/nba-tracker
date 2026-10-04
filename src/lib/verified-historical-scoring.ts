// Server-only boundary: raw factual bytes, filesystem reads and integrity pins
// never enter the chart's client bundle. This is not a CDN PBP/BoxScore adapter.
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { getRecorded2025SeasonSchedule, type ScheduleGame } from "./api";
import { validateRecoveredPlayerBox } from "./recovered-player-box";
import { validateReviewedShotChart } from "./verified-shot-chart-archive";
import { validateOfficialPeriodScores } from "./official-period-score-validation";
import { HISTORICAL_SCORING_GAME_ID, historicalScoringColumns, historicalScoringFiles, historicalScoringSource } from "./verified-historical-scoring-allowlist";
import type { TakeoverScoringEvent } from "./takeover-series";

export interface HistoricalScoringEvent extends TakeoverScoringEvent {
  eventId: string;
  sourceOrder: number;
  sourceActionNumber: number;
  clock: string;
  scoreHome: number;
  scoreAway: number;
  outcomeBasis: "source-field-goal-result" | "explicit-free-throw-description-and-score-delta";
}
export interface VerifiedHistoricalScoring {
  kind: "verified-historical-scoring";
  game: ScheduleGame;
  events: HistoricalScoringEvent[];
  coverage: {
    sourceRows: 554; fieldGoalAttempts: 173; freeThrowAttempts: 47; freeThrowMakes: 32;
    scoreObservations: 110; scoringEvents: 96; playedPlayers: 21;
    actors: { player: 491; team: 48; opaqueReplay: 6; none: 9 };
  };
  source: typeof historicalScoringSource & { sourceUrl: string; reportUrl: string; officialChartsUrl: string };
}
export interface HistoricalScoringReferences {
  game: ScheduleGame;
  box: unknown;
  shots: unknown;
  periods: unknown;
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, expected: readonly string[]) => Object.keys(v).length === expected.length && expected.every(k => Object.hasOwn(v, k));
const integer = (s: string) => /^\d+$/.test(s) && Number.isSafeInteger(Number(s)) ? Number(s) : null;
function seconds(clock: string): number | null {
  const match = /^PT(\d{2})M([0-5]\d(?:\.\d+)?)S$/.exec(clock);
  if (!match) return null;
  const value = Number(match[1]) * 60 + Number(match[2]);
  return Number.isFinite(value) && value <= 720 ? value : null;
}
function reviewedIdentity(game: ScheduleGame): boolean {
  return !!game && game.gameId === HISTORICAL_SCORING_GAME_ID && game.gameStatus === 3 &&
    game.gameCode === "20260613/NYKSAS" && game.gameDateTimeUTC === "2026-06-14T00:30:00Z" &&
    game.homeTeam?.teamId === 1610612759 && game.homeTeam.teamTricode === "SAS" && game.homeTeam.score === 90 &&
    game.awayTeam?.teamId === 1610612752 && game.awayTeam.teamTricode === "NYK" && game.awayTeam.score === 94;
}
const statKeys = ["fieldGoalsMade", "fieldGoalsAttempted", "threePointersMade", "threePointersAttempted", "freeThrowsMade", "freeThrowsAttempted", "points"] as const;
type Shooting = Record<typeof statKeys[number], number>;
const zeroShooting = (): Shooting => ({ fieldGoalsMade: 0, fieldGoalsAttempted: 0, threePointersMade: 0, threePointersAttempted: 0, freeThrowsMade: 0, freeThrowsAttempted: 0, points: 0 });
const sourceTypes: Record<string, number> = { period: 8, "Jump Ball": 4, "Missed Shot": 109, Rebound: 125, Turnover: 27, "": 25, Foul: 43, "Made Shot": 64, "Free Throw": 47, Substitution: 77, Timeout: 13, Violation: 5, "Instant Replay": 6, Heave: 1 };

/** Structural/reconciliation gate after byte verification. Exported separately
 * so corruption tests exercise each invariant, not only the enclosing hash. */
export function validateHistoricalScoringFacts(raw: unknown, refs: HistoricalScoringReferences): VerifiedHistoricalScoring | null {
  try {
    const { game } = refs;
    if (!reviewedIdentity(game) || !object(raw) || !keys(raw, ["schemaVersion", "kind", "gameId", "source", "columns", "rows"]) ||
      raw.schemaVersion !== 1 || raw.kind !== "reviewed-stats-v3-game-actions" || raw.gameId !== game.gameId ||
      !object(raw.source) || !keys(raw.source, Object.keys(historicalScoringSource)) ||
      Object.entries(historicalScoringSource).some(([key, value]) => (raw.source as Record<string, unknown>)[key] !== value) ||
      !Array.isArray(raw.columns) || raw.columns.length !== historicalScoringColumns.length ||
      raw.columns.some((value, index) => value !== historicalScoringColumns[index]) || !Array.isArray(raw.rows) || raw.rows.length !== 554) return null;
    const box = validateRecoveredPlayerBox(refs.box, game);
    const shots = validateReviewedShotChart(refs.shots, game);
    const periods = validateOfficialPeriodScores(refs.periods, game);
    if (!box || box.playedCoverage || box.players.length !== 21 || !shots || shots.shots.length !== 173 || !periods ||
      periods.home.periodPoints.length !== 4 || periods.away.periodPoints.length !== 4 ||
      !object(refs.shots) || !Array.isArray(refs.shots.players) || !Array.isArray(refs.shots.shots)) return null;
    type Player = { personId: number; name: string; teamId: number; teamTricode: string };
    const roster = new Map<number, Player>();
    for (const player of refs.shots.players) {
      if (!object(player) || typeof player.personId !== "number" || typeof player.name !== "string" ||
        typeof player.teamId !== "number" || typeof player.teamTricode !== "string" || roster.has(player.personId)) return null;
      roster.set(player.personId, player as unknown as Player);
    }
    if (roster.size !== 30) return null;
    const played = new Map<number, { player: Player; expected: Shooting; actual: Shooting }>();
    for (const line of box.players) {
      const matches = [...roster.values()].filter(p => p.name === line.name && p.teamTricode === line.team);
      if (matches.length !== 1 || played.has(matches[0].personId) || statKeys.some(key => !Number.isSafeInteger(line[key]) || (line[key] as number) < 0)) return null;
      played.set(matches[0].personId, { player: matches[0], expected: Object.fromEntries(statKeys.map(key => [key, line[key]])) as Shooting, actual: zeroShooting() });
    }
    const events: HistoricalScoringEvent[] = [];
    const actors = { player: 0, team: 0, opaqueReplay: 0, none: 0 };
    const typeCounts: Record<string, number> = Object.create(null);
    const rowsPerPeriod = [0, 0, 0, 0], starts = [0, 0, 0, 0], ends = [0, 0, 0, 0];
    const periodHome = [0, 0, 0, 0], periodAway = [0, 0, 0, 0];
    let previousPeriod = 1, previousSeconds = 720, home = 0, away = 0, observations = 0, fg = 0, ft = 0, ftm = 0;
    for (const [index, cells] of raw.rows.entries()) {
      if (!Array.isArray(cells) || cells.length !== historicalScoringColumns.length || cells.some(v => typeof v !== "string")) return null;
      const row = Object.fromEntries(historicalScoringColumns.map((key, i) => [key, cells[i]])) as Record<typeof historicalScoringColumns[number], string>;
      const order = index + 1, actionNumber = integer(row.actionNumber), period = integer(row.period), teamId = integer(row.teamId), personId = integer(row.personId), remaining = seconds(row.clock);
      if (row.gameId !== "42500405" || row.actionId !== String(order) || actionNumber === null || actionNumber <= 0 ||
        period === null || period < 1 || period > 4 || remaining === null || period < previousPeriod || period > previousPeriod + 1 ||
        (period === previousPeriod && remaining > previousSeconds) || teamId === null || personId === null ||
        !Object.hasOwn(sourceTypes, row.actionType) || !["0", "1"].includes(row.isFieldGoal) ||
        !["0", "1"].includes(row.videoAvailable) || integer(row.pointsTotal) === null) return null;
      previousPeriod = period; previousSeconds = remaining; rowsPerPeriod[period - 1]++;
      typeCounts[row.actionType] = (typeCounts[row.actionType] ?? 0) + 1;
      const team = teamId === game.homeTeam.teamId ? game.homeTeam : teamId === game.awayTeam.teamId ? game.awayTeam : null;
      if ((team && (row.teamTricode !== team.teamTricode || !["", team.teamTricode === "SAS" ? "h" : "v"].includes(row.location))) ||
        (!team && (teamId !== 0 || row.teamTricode !== "" || !["", "h", "v"].includes(row.location)))) return null;
      const known = played.get(personId);
      if (known) {
        if (!team || known.player.teamId !== teamId || known.player.teamTricode !== row.teamTricode) return null;
        actors.player++;
      } else if (personId === 0) {
        if (team || !["period", "Heave"].includes(row.actionType) || row.location !== (row.actionType === "Heave" ? "h" : "")) return null;
        actors.none++;
      } else if (personId === game.homeTeam.teamId || personId === game.awayTeam.teamId) {
        // In this source team actors live in personId, while raw teamId is 0.
        if (teamId !== 0 || row.location !== (personId === game.homeTeam.teamId ? "h" : "v") ||
          !["Rebound", "Timeout", "Turnover"].includes(row.actionType)) return null;
        actors.team++;
      } else if (row.actionType === "Instant Replay" && teamId === 0 && row.location === "" && !roster.has(personId)) {
        // These small integers have no verified player/reference semantics.
        actors.opaqueReplay++;
      } else return null;
      const scoreHome = row.scoreHome === "" ? null : integer(row.scoreHome);
      const scoreAway = row.scoreAway === "" ? null : integer(row.scoreAway);
      if ((row.scoreHome !== "" && scoreHome === null) || (row.scoreAway !== "" && scoreAway === null) ||
        (scoreHome === null) !== (scoreAway === null)) return null;
      const isFG = row.isFieldGoal === "1", isFT = row.actionType === "Free Throw";
      let points = 0;
      let outcomeBasis: HistoricalScoringEvent["outcomeBasis"] = "source-field-goal-result";
      if (isFG) {
        if (!known || !team || !["Made Shot", "Missed Shot"].includes(row.actionType) || !["2", "3"].includes(row.shotValue) ||
          row.shotResult !== (row.actionType === "Made Shot" ? "Made" : "Missed")) return null;
        const original = refs.shots.shots[fg];
        if (!object(original)) return null;
        for (const key of ["actionNumber", "personId", "teamId", "teamTricode", "period", "clock", "shotResult", "xLegacy", "yLegacy", "shotValue"] as const) {
          const value = ["teamTricode", "clock", "shotResult"].includes(key) ? row[key] : Number(row[key]);
          if (original[key] !== value) return null;
        }
        fg++;
        const made = row.shotResult === "Made", three = row.shotValue === "3";
        known.actual.fieldGoalsAttempted++; known.actual.fieldGoalsMade += Number(made);
        known.actual.threePointersAttempted += Number(three); known.actual.threePointersMade += Number(three && made);
        points = made ? Number(row.shotValue) : 0;
      } else if (isFT) {
        if (!known || !team || row.shotValue !== "0" || row.shotResult !== "") return null;
        const missed = row.description.startsWith("MISS ");
        const description = missed ? row.description.slice(5) : row.description;
        if (!description.startsWith(`${row.playerName} Free Throw`)) return null;
        const suffix = description.slice(row.playerName.length);
        const match = /^ Free Throw(?: Flagrant)? ([1-3]) of ([1-3])(?: \((\d+) PTS\))?$/.exec(suffix);
        if (!match || Number(match[1]) > Number(match[2]) || (missed ? match[3] !== undefined : match[3] === undefined)) return null;
        points = missed ? 0 : 1;
        if (!missed && Number(match[3]) !== known.actual.points + 1) return null;
        ft++; ftm += points; known.actual.freeThrowsAttempted++; known.actual.freeThrowsMade += points;
        outcomeBasis = "explicit-free-throw-description-and-score-delta";
      } else {
        // Paired block rows retain the attempted shot's raw value, even though
        // isFieldGoal=0 and shotResult is blank. They score no points.
        const block = row.actionType === "" && !!known && /^.+ BLOCK \(\d+ BLK\)$/.test(row.description);
        if (row.shotResult !== "" || (block ? !["2", "3"].includes(row.shotValue) : row.shotValue !== "0") ||
          ["Made Shot", "Missed Shot"].includes(row.actionType)) return null;
      }
      if (points) {
        if (!known || !team || scoreHome === null || scoreAway === null) return null;
        known.actual.points += points;
        if (teamId === game.homeTeam.teamId) { home += points; periodHome[period - 1] += points; }
        else { away += points; periodAway[period - 1] += points; }
        events.push({ eventId: `nbastatsv3:${game.gameId}:${order}`, sourceOrder: order, sourceActionNumber: actionNumber,
          clock: row.clock, period, personId, playerName: known.player.name, teamTricode: team.teamTricode, points: points as 1 | 2 | 3,
          scoreHome, scoreAway, outcomeBasis });
      }
      // A blank pair stays absent. Every actual observation must agree with
      // explicit events, including replay checkpoints: no silent corrections.
      if (scoreHome !== null && scoreAway !== null) {
        observations++;
        if (scoreHome !== home || scoreAway !== away || Number(row.pointsTotal) !== home + away) return null;
      }
      if (row.actionType === "period") {
        if (scoreHome === null || scoreAway === null || !["start", "end"].includes(row.subType)) return null;
        const start = row.subType === "start";
        if (remaining !== (start ? 720 : 0) || (start && rowsPerPeriod[period - 1] !== 1)) return null;
        (start ? starts : ends)[period - 1]++;
        const expectedHome = periods.home.periodPoints.slice(0, start ? period - 1 : period).reduce((a, b) => a + b, 0);
        const expectedAway = periods.away.periodPoints.slice(0, start ? period - 1 : period).reduce((a, b) => a + b, 0);
        if (scoreHome !== expectedHome || scoreAway !== expectedAway) return null;
      }
    }
    if (home !== game.homeTeam.score || away !== game.awayTeam.score || fg !== 173 || ft !== 47 || ftm !== 32 || observations !== 110 || events.length !== 96 ||
      Object.entries(sourceTypes).some(([type, count]) => typeCounts[type] !== count) ||
      rowsPerPeriod.some((count, i) => count !== [127, 129, 142, 156][i]) || starts.some(n => n !== 1) || ends.some(n => n !== 1) ||
      periodHome.some((n, i) => n !== periods.home.periodPoints[i]) || periodAway.some((n, i) => n !== periods.away.periodPoints[i]) ||
      actors.player !== 491 || actors.team !== 48 || actors.opaqueReplay !== 6 || actors.none !== 9 ||
      [...played.values()].some(({ actual, expected }) => statKeys.some(key => actual[key] !== expected[key]))) return null;
    return {
      kind: "verified-historical-scoring", game, events,
      coverage: { sourceRows: 554, fieldGoalAttempts: 173, freeThrowAttempts: 47, freeThrowMakes: 32, scoreObservations: 110, scoringEvents: 96, playedPlayers: 21,
        actors: { player: 491, team: 48, opaqueReplay: 6, none: 9 } },
      source: { ...historicalScoringSource,
        sourceUrl: `${historicalScoringSource.repository}/blob/${historicalScoringSource.commit}/${historicalScoringSource.archivePath}`,
        reportUrl: box.reportUrl, officialChartsUrl: shots.source.url },
    };
  } catch { return null; }
}

/** The reviewed raw byte hash is checked BEFORE JSON.parse. Do not replace
 * this with JSON module imports or a hash of bundler-transformed objects. */
export function decodeReviewedHistoricalJson(bytes: Buffer, key: keyof typeof historicalScoringFiles): unknown | null {
  try {
    if (bytes.length > 200_000 || createHash("sha256").update(bytes).digest("hex") !== historicalScoringFiles[key].sha256) return null;
    return JSON.parse(bytes.toString("utf8"));
  } catch { return null; }
}
function readReviewedFile(key: keyof typeof historicalScoringFiles): unknown | null {
  const path = join(process.cwd(), historicalScoringFiles[key].path);
  if (statSync(path).size > 200_000) return null;
  return decodeReviewedHistoricalJson(readFileSync(path), key);
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
let verified: VerifiedHistoricalScoring | null = null;
/** Explicit allowlist check precedes all filesystem/schedule work. Optional
 * current identity must still agree even after the immutable result is cached. */
export function getVerifiedHistoricalScoring(gameId: string, selectedGame?: ScheduleGame): VerifiedHistoricalScoring | null {
  if (gameId !== HISTORICAL_SCORING_GAME_ID || (selectedGame !== undefined && !reviewedIdentity(selectedGame))) return null;
  if (verified) return verified;
  try {
    const game = getRecorded2025SeasonSchedule().flatMap(day => day.games).find(row => row.gameId === gameId);
    if (!game || !reviewedIdentity(game)) return null;
    const result = validateHistoricalScoringFacts(readReviewedFile("facts"), {
      game: structuredClone(game), box: readReviewedFile("box"), shots: readReviewedFile("shots"), periods: readReviewedFile("periods"),
    });
    if (result) verified = freeze(result);
    return verified;
  } catch { return null; }
}

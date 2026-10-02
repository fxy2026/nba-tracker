import { TEAM_META } from "./teams";

export interface RecoveryManifestGame {
  nbaGameId: string;
  providerMatchId: string;
  season: string;
  gameDate: string;
  home: { tricode: string; score: number };
  away: { tricode: string; score: number };
}

export interface RecoveryManifest {
  version: 1;
  games: RecoveryManifestGame[];
}

export type RecoveryManifestResult =
  | { ok: true; manifest: RecoveryManifest }
  | { ok: false; errors: string[] };

const MAX_GAMES = 100;
// Match the canonical NBA season-ID form already used by lib/games.ts.
const NBA_GAME_ID = /^00[1-6]\d{7}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// JSON-shaped own data only: do not consult prototypes or execute accessors.
function record(value: unknown, keys: readonly string[], path: string, errors: string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    errors.push(`${path} must be a plain object`);
    return null;
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some(key => typeof key !== "string" || !keys.includes(key))) {
    errors.push(`${path} must contain only the required fields: ${keys.join(", ")}`);
    return null;
  }
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) {
      errors.push(`${path}.${key} must be an own data field`);
      return null;
    }
    result[key] = descriptor.value;
  }
  return result;
}

function calendarYear(value: unknown): number | null {
  if (typeof value !== "string" || value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1] ? year : null;
}

function team(value: unknown, path: string, errors: string[]): RecoveryManifestGame["home"] | null {
  const row = record(value, ["tricode", "score"], path, errors);
  if (!row) return null;
  let valid = true;
  if (typeof row.tricode !== "string" || !Object.prototype.hasOwnProperty.call(TEAM_META, row.tricode)) {
    errors.push(`${path}.tricode must be a known NBA team`);
    valid = false;
  }
  if (typeof row.score !== "number" || !Number.isSafeInteger(row.score) || row.score < 0) {
    errors.push(`${path}.score must be a nonnegative safe integer`);
    valid = false;
  }
  return valid ? { tricode: row.tricode as string, score: row.score as number } : null;
}

/** Offline validation only. A valid manifest grants no permission or quota. */
export function parseRecoveryManifest(raw: unknown): RecoveryManifestResult {
  const errors: string[] = [];
  try {
    const root = record(raw, ["version", "games"], "manifest", errors);
    if (!root) return { ok: false, errors };
    if (root.version !== 1) errors.push("manifest.version must be 1");
    if (!Array.isArray(root.games) || Object.getPrototypeOf(root.games) !== Array.prototype
      || root.games.length < 1 || root.games.length > MAX_GAMES) {
      errors.push(`manifest.games must be an array of 1 to ${MAX_GAMES} games`);
      return { ok: false, errors };
    }
    // Reject holes, named/symbol properties, and getters on array entries too.
    if (Reflect.ownKeys(root.games).length !== root.games.length + 1) {
      errors.push("manifest.games must be a dense data array without extra fields");
      return { ok: false, errors };
    }
    const games: RecoveryManifestGame[] = [];
    const nbaIds = new Set<string>();
    const providerIds = new Set<string>();
    for (let index = 0; index < root.games.length; index++) {
      const path = `manifest.games[${index}]`;
      const descriptor = Object.getOwnPropertyDescriptor(root.games, String(index));
      if (!descriptor || !("value" in descriptor)) {
        errors.push(`${path} must be an own data entry`);
        continue;
      }
      const row = record(descriptor.value, ["nbaGameId", "providerMatchId", "season", "gameDate", "home", "away"], path, errors);
      if (!row) continue;
      const before = errors.length;
      const nbaId = typeof row.nbaGameId === "string" && row.nbaGameId.length === 10 && NBA_GAME_ID.test(row.nbaGameId) ? row.nbaGameId : null;
      if (!nbaId) errors.push(`${path}.nbaGameId must be a canonical 10-digit NBA ID`);
      else if (nbaIds.has(nbaId)) errors.push(`${path}.nbaGameId is duplicated`);
      else nbaIds.add(nbaId);

      const providerId = typeof row.providerMatchId === "string" && row.providerMatchId.length === 36 && UUID.test(row.providerMatchId) ? row.providerMatchId.toLowerCase() : null;
      if (!providerId) errors.push(`${path}.providerMatchId must be a valid UUID`);
      else if (providerIds.has(providerId)) errors.push(`${path}.providerMatchId is duplicated`);
      else providerIds.add(providerId);

      let startYear: number | null = null;
      if (typeof row.season === "string" && row.season.length === 7 && /^\d{4}-\d{2}$/.test(row.season)) {
        const start = Number(row.season.slice(0, 4));
        if (start >= 1 && start < 9999 && row.season.slice(5) === String((start + 1) % 100).padStart(2, "0")) startYear = start;
      }
      if (startYear === null) errors.push(`${path}.season must be consecutive years in YYYY-YY format`);
      else if (nbaId && nbaId.slice(3, 5) !== String(startYear % 100).padStart(2, "0")) errors.push(`${path}.season must match the NBA ID's start-year digits`);
      const dateYear = calendarYear(row.gameDate);
      if (dateYear === null) errors.push(`${path}.gameDate must be an actual YYYY-MM-DD calendar date`);
      else if (startYear !== null && dateYear !== startYear && dateYear !== startYear + 1) errors.push(`${path}.gameDate must be in the season's start or following year`);

      const home = team(row.home, `${path}.home`, errors);
      const away = team(row.away, `${path}.away`, errors);
      if (home && away) {
        if (home.tricode === away.tricode) errors.push(`${path} must have different home and away teams`);
        if (home.score === away.score) errors.push(`${path} must have unequal final scores`);
      }
      if (errors.length === before && nbaId && providerId && home && away) {
        games.push({ nbaGameId: nbaId, providerMatchId: providerId, season: row.season as string, gameDate: row.gameDate as string, home, away });
      }
    }
    return errors.length ? { ok: false, errors } : { ok: true, manifest: { version: 1, games } };
  } catch {
    // Exotic/revoked proxies are not JSON input and must fail closed as well.
    return { ok: false, errors: [...errors, "manifest must contain ordinary JSON data"] };
  }
}

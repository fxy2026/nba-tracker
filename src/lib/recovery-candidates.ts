import { parseRecoveryManifest, type RecoveryManifestGame } from "./recovery-manifest";
import { TEAM_META } from "./teams";

export type RecoveryTarget = Omit<RecoveryManifestGame, "providerMatchId"> & { lookupDates: string[] };
export interface RecoveryListPage { requestedDate: string; body: unknown }
export type RecoveryCandidateResult = { ok: true; game: RecoveryManifestGame } | { ok: false; reason: string };

const DAY_MS = 86400000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALIDATION_UUID = "00000000-0000-4000-8000-000000000001";
const reject = (reason: string): RecoveryCandidateResult => ({ ok: false, reason });
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)
  && Reflect.ownKeys(v).every(k => typeof k === "string" && "value" in Object.getOwnPropertyDescriptor(v, k)!);
const dataArray = (v: unknown): v is unknown[] => Array.isArray(v) && v.length <= 100 && Object.getPrototypeOf(v) === Array.prototype
  && Reflect.ownKeys(v).length === v.length + 1 && Array.from({ length: v.length }, (_, i) => Object.getOwnPropertyDescriptor(v, String(i))).every(d => d && "value" in d);
const count = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const normalizeName = (v: string) => v.trim().replace(/\s+/g, " ").toLowerCase();

function dateOnly(value: unknown): number | null {
  if (typeof value !== "string" || value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}
function utcTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  const canonical = new Date(time).toISOString();
  return canonical === value || canonical.replace(".000Z", "Z") === value ? time : null;
}

// Full names establish identity. Short names only cross-check known canonical
// codes/documented aliases; unknown short names never supply or guess a team.
const shortAliases: Record<string, string> = { GS: "GSW", NO: "NOP", NY: "NYK", SA: "SAS", UTAH: "UTA", WSH: "WAS" };
function teamIdentity(raw: Record<string, unknown>): string | null {
  if (!text(raw.name) || !(raw.short_name === null || text(raw.short_name))) return null;
  const name = normalizeName(raw.name);
  const found = Object.values(TEAM_META).filter(t => name === normalizeName(`${t.city} ${t.name}`)
    || (t.tricode === "LAC" && name === "los angeles clippers"));
  if (found.length !== 1) return null;
  if (typeof raw.short_name === "string") {
    const short = raw.short_name.trim().toUpperCase();
    const known = Object.prototype.hasOwnProperty.call(TEAM_META, short) ? short
      : Object.prototype.hasOwnProperty.call(shortAliases, short) ? shortAliases[short] : null;
    if (known && known !== found[0].tricode) return null;
  }
  return found[0].tricode;
}

/** Resolve from supplied complete pages only. No requests, clocks, credentials,
 * tip-off inference, current-player-team lookup, or first-candidate selection.
 */
export function resolveRecoveryCandidate(target: unknown, pages: unknown): RecoveryCandidateResult {
  try {
    const targetKeys = ["nbaGameId", "season", "gameDate", "home", "away", "lookupDates"];
    if (!object(target) || Reflect.ownKeys(target).length !== targetKeys.length || !targetKeys.every(k => Object.prototype.hasOwnProperty.call(target, k))) return reject("invalid-target");
    const projection = { nbaGameId: target.nbaGameId, season: target.season, gameDate: target.gameDate, home: target.home, away: target.away };
    // This UUID is only a schema-validation sentinel; it is never returned.
    const validatedTarget = parseRecoveryManifest({ version: 1, games: [{ ...projection, providerMatchId: VALIDATION_UUID }] });
    if (!validatedTarget.ok) return reject("invalid-target-identity");
    const requested = validatedTarget.manifest.games[0];
    const gameDay = dateOnly(requested.gameDate)!;
    if (!dataArray(target.lookupDates) || target.lookupDates.length < 1 || target.lookupDates.length > 2) return reject("invalid-lookup-dates");
    const lookupDates = new Set<string>();
    for (const value of target.lookupDates) {
      const date = dateOnly(value);
      if (date === null || typeof value !== "string" || Math.abs(date - gameDay) > DAY_MS || lookupDates.has(value)) return reject("invalid-lookup-dates");
      lookupDates.add(value);
    }
    if (!lookupDates.has(requested.gameDate)) return reject("lookup-must-include-game-date");
    if (!dataArray(pages) || pages.length !== lookupDates.size) return reject("incomplete-date-pages");
    const seenDates = new Set<string>();
    const identities = new Map<string, string>();
    const matches = new Set<string>();
    for (const page of pages) {
      if (!object(page) || typeof page.requestedDate !== "string" || !lookupDates.has(page.requestedDate) || seenDates.has(page.requestedDate)) return reject("unexpected-or-duplicate-date-page");
      seenDates.add(page.requestedDate);
      if (!object(page.body)) return reject("malformed-list-envelope");
      const { data, meta, pagination } = page.body;
      if (!dataArray(data) || !object(meta) || !object(meta.date_window) || meta.date_window.date !== page.requestedDate
        || !object(pagination) || !count(pagination.total) || pagination.total > 100
        || !count(pagination.limit) || pagination.limit < 1 || pagination.limit > 100 || pagination.offset !== 0
        || data.length !== pagination.total || pagination.total > pagination.limit) return reject("incomplete-or-mismatched-list-page");
      const window = meta.date_window;
      const pageDay = dateOnly(page.requestedDate)!;
      if ((window.timezone !== undefined && window.timezone !== "UTC")
        || (window.start_utc !== undefined && utcTimestamp(window.start_utc) !== pageDay)
        || (window.end_utc !== undefined && utcTimestamp(window.end_utc) !== pageDay + DAY_MS)) return reject("mismatched-date-window");
      const pageIds = new Set<string>();
      for (const value of data) {
        if (!object(value) || typeof value.id !== "string" || value.id.length !== 36 || !UUID.test(value.id)
          || !text(value.sport) || !text(value.league) || !text(value.status)
          || !object(value.home) || !object(value.away) || !text(value.home.name) || !text(value.away.name)
          || !(value.home.short_name === null || text(value.home.short_name)) || !(value.away.short_name === null || text(value.away.short_name))
          || !object(value.score) || !(value.score.home === null || count(value.score.home)) || !(value.score.away === null || count(value.score.away))) return reject("malformed-match-row");
        const kickoff = utcTimestamp(value.kickoff_utc);
        if (kickoff === null || !lookupDates.has(new Date(kickoff).toISOString().slice(0, 10))) return reject("invalid-or-outside-lookup-kickoff-date");
        const isNBA = value.sport === "basketball" && value.league === "NBA";
        const home = isNBA ? teamIdentity(value.home) : normalizeName(value.home.name);
        const away = isNBA ? teamIdentity(value.away) : normalizeName(value.away.name);
        if (!home || !away || home === away) return reject("invalid-team-identity");
        if (value.status === "finished" && (!count(value.score.home) || !count(value.score.away) || value.score.home === value.score.away)) return reject("invalid-finished-score");
        const id = value.id.toLowerCase();
        if (pageIds.has(id)) return reject("duplicate-match-uuid-within-page");
        pageIds.add(id);
        // Ignore time-of-day, but conflicting date/team/score/status identities
        // for one UUID are ambiguous even when returned on separate pages.
        const identity = JSON.stringify([value.sport, value.league, value.status, home, away, value.score.home, value.score.away, new Date(kickoff).toISOString().slice(0, 10)]);
        const previous = identities.get(id);
        if (previous !== undefined && previous !== identity) return reject("contradictory-match-uuid");
        identities.set(id, identity);
        if (isNBA && value.status === "finished" && home === requested.home.tricode && away === requested.away.tricode
          && value.score.home === requested.home.score && value.score.away === requested.away.score) matches.add(id);
      }
    }
    if (seenDates.size !== lookupDates.size) return reject("incomplete-date-pages");
    if (matches.size === 0) return reject("no-matching-finished-game");
    if (matches.size !== 1) return reject("ambiguous-matching-games");
    const providerMatchId = matches.values().next().value;
    const result = parseRecoveryManifest({ version: 1, games: [{ ...projection, providerMatchId }] });
    return result.ok ? { ok: true, game: result.manifest.games[0] } : reject("invalid-resolved-manifest");
  } catch {
    return reject("invalid-candidate-input");
  }
}

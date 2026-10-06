import { TEAM_META } from "./teams";
import { ESPN_TEAM_TRICODES } from "./espn-scoreboard";
import type { ScheduleGame } from "./nba-contracts";

export type EspnBoxIdentity = Pick<ScheduleGame, "gameId" | "gameStatus" | "gameCode" | "gameDateTimeUTC" | "homeTeam" | "awayTeam">;
interface EspnBoxTeam { tricode: string; teamId: number; espnTeamId: string; score: number }
export interface EspnPlayerLine {
  espnAthleteId: string;
  nbaPlayerId: null;
  name: string;
  team: string;
  minutesRounded: number | null;
  points: number;
  rebounds: number | null;
  assists: number | null;
  fieldGoalsMade: number | null;
  fieldGoalsAttempted: number | null;
  threePointersMade: number | null;
  threePointersAttempted: number | null;
  freeThrowsMade: number | null;
  freeThrowsAttempted: number | null;
  offensiveRebounds: number | null;
  defensiveRebounds: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  fouls: number | null;
  plusMinus: number | null;
  starter: boolean | null;
}
export interface EspnPlayerBox {
  version: 1;
  provider: "ESPN";
  coverage: "source-boxscore";
  game: {
    nbaGameId: string; espnEventId: string; season: "2025-26"; seasonType: "Regular Season";
    gameDate: string; gameCode: string; gameTimeUTC: string; home: EspnBoxTeam; away: EspnBoxTeam;
  };
  retrievedAt: string;
  source: { url: string; apiUrl: string; rawSha256: string; archived: true };
  players: EspnPlayerLine[];
  excluded: { dnp: number; participationUnverified: number };
}
export interface EspnBoxCapture { eventId: string; retrievedAt: string; rawSha256: string }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).length === keys.length && Object.keys(v).every(key => keys.includes(key));
const count = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const nullable = (v: unknown) => v === null || count(v);
const id = (v: unknown): v is string => typeof v === "string" && /^[1-9]\d{0,11}$/.test(v);
const sha = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const iso = (v: unknown): v is string => typeof v === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(v)
  && Number.isFinite(Date.parse(v)) && new Date(`${v.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) === v.slice(0, 10);
const fields = ["minutesRounded", "rebounds", "assists", "fieldGoalsMade", "fieldGoalsAttempted", "threePointersMade", "threePointersAttempted", "freeThrowsMade", "freeThrowsAttempted", "offensiveRebounds", "defensiveRebounds", "steals", "blocks", "turnovers", "fouls"] as const;
const sourceUrl = (eventId: string) => `https://www.espn.com/nba/boxscore/_/gameId/${eventId}`;
export const espnBoxApiUrl = (eventId: string) => `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${eventId}`;
const etDate = (date: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date));
function validIdentity(game: EspnBoxIdentity): boolean {
  if (!object(game) || typeof game.gameId !== "string" || !/^00225\d{5}$/.test(game.gameId) || game.gameStatus !== 3 || !iso(game.gameDateTimeUTC)
    || !object(game.homeTeam) || !object(game.awayTeam)) return false;
  const home = game.homeTeam, away = game.awayTeam;
  return [home, away].every(t => typeof t.teamTricode === "string" && Object.hasOwn(TEAM_META, t.teamTricode)
    && TEAM_META[t.teamTricode].teamId === t.teamId && count(t.score))
    && home.teamTricode !== away.teamTricode && home.score !== away.score
    && [home.teamId, away.teamId].includes(1610612755)
    && game.gameCode === `${etDate(game.gameDateTimeUTC).replaceAll("-", "")}/${away.teamTricode}${home.teamTricode}`;
}
function validTeam(actual: unknown, expected: EspnBoxIdentity["homeTeam"]): actual is EspnBoxTeam {
  return object(actual) && exact(actual, ["tricode", "teamId", "espnTeamId", "score"]) && actual.tricode === expected.teamTricode && actual.teamId === expected.teamId
    && actual.score === expected.score && id(actual.espnTeamId) && ESPN_TEAM_TRICODES[actual.espnTeamId] === expected.teamTricode;
}
/** A distinct ESPN contract. It never becomes an NBA BoxScore or NBA player ID. */
export function validateEspnPlayerBox(raw: unknown, game: EspnBoxIdentity): EspnPlayerBox | null {
  if (!validIdentity(game) || !object(raw) || !exact(raw, ["version", "provider", "coverage", "game", "retrievedAt", "source", "players", "excluded"]) || raw.version !== 1 || raw.provider !== "ESPN" || raw.coverage !== "source-boxscore"
    || !object(raw.game) || !exact(raw.game, ["nbaGameId", "espnEventId", "season", "seasonType", "gameDate", "gameCode", "gameTimeUTC", "home", "away"]) || raw.game.nbaGameId !== game.gameId || !id(raw.game.espnEventId)
    || raw.game.season !== "2025-26" || raw.game.seasonType !== "Regular Season" || raw.game.gameCode !== game.gameCode
    || raw.game.gameTimeUTC !== game.gameDateTimeUTC || raw.game.gameDate !== etDate(game.gameDateTimeUTC)
    || !validTeam(raw.game.home, game.homeTeam) || !validTeam(raw.game.away, game.awayTeam)
    || !iso(raw.retrievedAt) || !object(raw.source) || !exact(raw.source, ["url", "apiUrl", "rawSha256", "archived"]) || raw.source.archived !== true || !sha(raw.source.rawSha256)
    || raw.source.url !== sourceUrl(raw.game.espnEventId) || raw.source.apiUrl !== espnBoxApiUrl(raw.game.espnEventId)
    || !Array.isArray(raw.players) || raw.players.length < 10 || raw.players.length > 50
    || !object(raw.excluded) || !exact(raw.excluded, ["dnp", "participationUnverified"]) || !count(raw.excluded.dnp) || !count(raw.excluded.participationUnverified)
    || raw.players.length + raw.excluded.dnp + raw.excluded.participationUnverified > 50) return null;
  const seen = new Set<string>();
  for (const p of raw.players) {
    if (!object(p) || !exact(p, ["espnAthleteId", "nbaPlayerId", "name", "team", "points", "plusMinus", "starter", ...fields]) || !id(p.espnAthleteId) || seen.has(p.espnAthleteId) || p.nbaPlayerId !== null
      || typeof p.name !== "string" || p.name !== p.name.trim() || !p.name || p.name.length > 100
      || typeof p.team !== "string" || ![game.homeTeam.teamTricode, game.awayTeam.teamTricode].includes(p.team)
      || !count(p.points) || !fields.every(key => nullable(p[key])) || p.minutesRounded === null
      || !(p.plusMinus === null || typeof p.plusMinus === "number" && Number.isSafeInteger(p.plusMinus))
      || !(p.starter === null || typeof p.starter === "boolean")) return null;
    seen.add(p.espnAthleteId);
    for (const [made, attempts] of [["fieldGoalsMade", "fieldGoalsAttempted"], ["threePointersMade", "threePointersAttempted"], ["freeThrowsMade", "freeThrowsAttempted"]]) {
      if (count(p[made]) && count(p[attempts]) && p[made] > p[attempts]) return null;
    }
    if (count(p.fieldGoalsMade) && count(p.threePointersMade) && p.threePointersMade > p.fieldGoalsMade
      || count(p.fieldGoalsAttempted) && count(p.threePointersAttempted) && p.threePointersAttempted > p.fieldGoalsAttempted
      || count(p.fieldGoalsMade) && count(p.threePointersMade) && count(p.freeThrowsMade) && 2 * p.fieldGoalsMade + p.threePointersMade + p.freeThrowsMade !== p.points
      || count(p.rebounds) && count(p.offensiveRebounds) && count(p.defensiveRebounds) && p.offensiveRebounds + p.defensiveRebounds !== p.rebounds) return null;
  }
  for (const team of [game.homeTeam, game.awayTeam]) {
    if (raw.players.filter(p => p.team === team.teamTricode).reduce((sum, p) => sum + p.points, 0) !== team.score) return null;
  }
  // Explicit projection prevents unrelated source fields from crossing into UI.
  return { version: 1, provider: "ESPN", coverage: "source-boxscore", game: raw.game as unknown as EspnPlayerBox["game"],
    retrievedAt: raw.retrievedAt, source: raw.source as unknown as EspnPlayerBox["source"],
    players: raw.players as EspnPlayerLine[], excluded: { dnp: raw.excluded.dnp, participationUnverified: raw.excluded.participationUnverified } };
}
function value(raw: unknown, signed = false): number | null | undefined {
  if (raw === undefined || raw === null || raw === "--" || raw === "-" || raw === "") return null;
  if (typeof raw !== "string" || !(signed ? /^[+-]?\d+$/ : /^\d+$/).test(raw)) return undefined;
  const result = Number(raw);
  return Number.isSafeInteger(result) ? result : undefined;
}
function pair(raw: unknown): [number | null, number | null] | null {
  if (raw == null || raw === "--" || raw === "-") return [null, null];
  if (typeof raw !== "string" || !/^\d+-\d+$/.test(raw)) return null;
  const [made, attempts] = raw.split("-").map(Number);
  return count(made) && count(attempts) && made <= attempts ? [made, attempts] : null;
}
/** Offline source parser; transport binds the source bytes to capture.rawSha256. */
export function parseEspnPlayerBox(raw: unknown, game: EspnBoxIdentity, capture: EspnBoxCapture): EspnPlayerBox | null {
  if (!validIdentity(game) || !id(capture.eventId) || !iso(capture.retrievedAt) || !sha(capture.rawSha256)
    || !object(raw) || !object(raw.header) || !object(raw.boxscore)) return null;
  const h = raw.header, eventId = capture.eventId;
  if (h.id !== eventId || h.uid !== `s:40~l:46~e:${eventId}` || !object(h.league) || h.league.id !== "46" || h.league.uid !== "s:40~l:46" || h.league.slug !== "nba"
    || !object(h.season) || h.season.year !== 2026 || h.season.type !== 2 || !Array.isArray(h.competitions) || h.competitions.length !== 1) return null;
  const competition = h.competitions[0];
  if (!object(competition) || competition.id !== eventId || competition.uid !== `s:40~l:46~e:${eventId}~c:${eventId}`
    || !iso(competition.date) || Date.parse(competition.date) !== Date.parse(game.gameDateTimeUTC)
    || !object(competition.status) || !object(competition.status.type) || competition.status.type.completed !== true || competition.status.type.state !== "post"
    || !Array.isArray(competition.competitors) || competition.competitors.length !== 2
    || competition.boxscoreSource !== "full" || !Array.isArray(raw.boxscore.players) || raw.boxscore.players.length !== 2) return null;
  const teams = new Map<string, EspnBoxTeam>();
  const sides: Partial<Record<"home" | "away", EspnBoxTeam>> = {};
  for (const c of competition.competitors) {
    if (!object(c) || !id(c.id) || c.uid !== `s:40~l:46~t:${c.id}` || !object(c.team) || c.team.id !== c.id || c.team.uid !== c.uid
      || typeof c.homeAway !== "string" || !["home", "away"].includes(c.homeAway) || teams.has(c.id)) return null;
    const side = c.homeAway as "home" | "away", expected = side === "home" ? game.homeTeam : game.awayTeam;
    const t = { tricode: ESPN_TEAM_TRICODES[c.id], teamId: expected.teamId, espnTeamId: c.id, score: value(c.score) };
    if (sides[side] || !validTeam(t, expected)) return null;
    teams.set(c.id, t); sides[side] = t;
  }
  if (!sides.home || !sides.away) return null;
  const players: EspnPlayerLine[] = [], seen = new Set<string>(), processedTeams = new Set<string>();
  const excluded = { dnp: 0, participationUnverified: 0 };
  for (const group of raw.boxscore.players) {
    if (!object(group) || !object(group.team) || !id(group.team.id) || group.team.uid !== `s:40~l:46~t:${group.team.id}`
      || !teams.has(group.team.id) || processedTeams.has(group.team.id) || !Array.isArray(group.statistics) || group.statistics.length !== 1) return null;
    processedTeams.add(group.team.id);
    const table = group.statistics[0], team = teams.get(group.team.id)!;
    if (!object(table) || !Array.isArray(table.keys) || !table.keys.every(k => typeof k === "string") || new Set(table.keys).size !== table.keys.length
      || !Array.isArray(table.athletes) || table.athletes.length > 25 || !table.keys.includes("minutes") || !table.keys.includes("points")) return null;
    for (const row of table.athletes) {
      if (!object(row) || !object(row.athlete) || !id(row.athlete.id) || row.athlete.uid !== `s:40~l:46~a:${row.athlete.id}` || seen.has(row.athlete.id)
        || typeof row.athlete.displayName !== "string" || typeof row.didNotPlay !== "boolean" || !Array.isArray(row.stats)
        || !(row.starter === undefined || typeof row.starter === "boolean")) return null;
      seen.add(row.athlete.id);
      if (row.didNotPlay) {
        // A contradictory DNP with actual numeric stats is not silently erased.
        if (row.stats.length !== 0) return null;
        excluded.dnp++; continue;
      }
      if (row.stats.length !== table.keys.length) return null;
      const stats = Object.fromEntries((table.keys as string[]).map((key, index) => [key, (row.stats as unknown[])[index]]));
      const minutes = value(stats.minutes);
      if (minutes === undefined) return null;
      if (minutes === null) {
        if (Object.entries(stats).some(([key, v]) => key !== "minutes" && !(v === "0" || v === "+0" || v === "0-0" || v === "--" || v === "-" || v === null))) return null;
        excluded.participationUnverified++; continue;
      }
      const fg = pair(stats["fieldGoalsMade-fieldGoalsAttempted"]), three = pair(stats["threePointFieldGoalsMade-threePointFieldGoalsAttempted"]), ft = pair(stats["freeThrowsMade-freeThrowsAttempted"]);
      if (!fg || !three || !ft) return null;
      const line = { espnAthleteId: row.athlete.id, nbaPlayerId: null, name: row.athlete.displayName.trim(), team: team.tricode, minutesRounded: minutes,
        points: value(stats.points), rebounds: value(stats.rebounds), assists: value(stats.assists), steals: value(stats.steals), blocks: value(stats.blocks),
        offensiveRebounds: value(stats.offensiveRebounds), defensiveRebounds: value(stats.defensiveRebounds), turnovers: value(stats.turnovers), fouls: value(stats.fouls),
        plusMinus: value(stats.plusMinus, true), starter: row.starter ?? null,
        fieldGoalsMade: fg[0], fieldGoalsAttempted: fg[1], threePointersMade: three[0], threePointersAttempted: three[1], freeThrowsMade: ft[0], freeThrowsAttempted: ft[1] };
      players.push(line as EspnPlayerLine); // Full strict validation below rejects undefined/malformed values.
    }
  }
  return validateEspnPlayerBox({ version: 1, provider: "ESPN", coverage: "source-boxscore",
    game: { nbaGameId: game.gameId, espnEventId: eventId, season: "2025-26", seasonType: "Regular Season", gameDate: etDate(game.gameDateTimeUTC),
      gameCode: game.gameCode, gameTimeUTC: game.gameDateTimeUTC, home: sides.home, away: sides.away },
    retrievedAt: capture.retrievedAt, source: { url: sourceUrl(eventId), apiUrl: espnBoxApiUrl(eventId), rawSha256: capture.rawSha256, archived: true }, players, excluded }, game);
}

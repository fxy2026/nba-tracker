import "server-only";
// Server-only navigation enrichment. Never import the baked schedule into a client component.
// A matching final schedule entry guarantees the existing /game/[id] final-summary
// fallback. It does not guarantee a full box score, shot chart or play-by-play.
import reviewedTimes from "@/data/player-game-log-link-evidence.json";
import schedule from "@/data/schedule-2025-26.json";
import { ESPN_TEAM_TRICODES } from "./espn-scoreboard";
import { TEAM_META } from "./teams";
import type { PlayerGameLogData, PlayerLogRow } from "./player-game-log-data";

type Identity = Pick<PlayerGameLogData, "season" | "seasonType">;
type ScheduleGame = typeof schedule.dates[number]["games"][number];
const games: ScheduleGame[] = schedule.dates.flatMap(day => day.games);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const etDate = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)) : null;
const score = (value: unknown) => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null;
const prefix = ({ season, seasonType }: Identity) => `${seasonType === "Playoffs" ? "004" : seasonType === "Pre Season" ? "001" : "002"}${season.slice(2, 4)}`;

function candidates(row: PlayerLogRow, identity: Identity, available: ScheduleGame[]) {
  if (identity.season.slice(0, 4) !== schedule.seasonYear) return [];
  const home = row.home ? row.team : row.opponent, away = row.home ? row.opponent : row.team;
  return available.filter(game => new RegExp(`^${prefix(identity)}\\d{5}$`).test(game.gameId)
    && game.gameStatus === 3 && game.homeTeam.teamTricode === home && game.awayTeam.teamTricode === away
    && game.homeTeam.teamId === TEAM_META[home]?.teamId && game.awayTeam.teamId === TEAM_META[away]?.teamId
    && game.gameCode === `${row.date.replaceAll("-", "")}/${away}${home}` && etDate(game.gameDateTimeUTC) === row.date);
}
export function resolveEspnPlayerLogGame(event: unknown, row: PlayerLogRow, identity: Identity, available: ScheduleGame[] = games): string | null {
  if (!object(event) || !object(event.team) || !object(event.opponent) || event.leagueAbbreviation !== "NBA"
    || event.id !== row.id.slice(5) || row.id !== `espn:${event.id}` || etDate(event.gameDate) !== row.date
    || event.atVs !== (row.home ? "vs" : "@") || event.gameResult !== row.wl
    || event.team.id !== (row.home ? event.homeTeamId : event.awayTeamId)
    || event.opponent.id !== (row.home ? event.awayTeamId : event.homeTeamId)
    || typeof event.homeTeamId !== "string" || typeof event.awayTeamId !== "string") return null;
  const home = ESPN_TEAM_TRICODES[event.homeTeamId], away = ESPN_TEAM_TRICODES[event.awayTeamId];
  if (home !== (row.home ? row.team : row.opponent) || away !== (row.home ? row.opponent : row.team)) return null;
  const matches = candidates(row, identity, available);
  if (matches.length !== 1) return null;
  const game = matches[0], homeScore = score(event.homeTeamScore), awayScore = score(event.awayTeamScore);
  if (homeScore === null || awayScore === null || homeScore === awayScore || game.homeTeam.score !== homeScore || game.awayTeam.score !== awayScore
    || row.wl !== ((row.home ? homeScore > awayScore : awayScore > homeScore) ? "W" : "L")) return null;
  const espnTime = Date.parse(String(event.gameDate)), nbaTime = Date.parse(game.gameDateTimeUTC);
  const reviewed = reviewedTimes.some(item => item.season === identity.season && item.seasonType === identity.seasonType && item.espnId === event.id && item.nbaId === game.gameId && item.home === home && item.away === away
    && item.homeScore === homeScore && item.awayScore === awayScore && Date.parse(item.espnUTC) === espnTime && Date.parse(item.nbaUTC) === nbaTime);
  return Number.isFinite(espnTime) && (espnTime === nbaTime || reviewed) ? game.gameId : null;
}
export function withEspnPlayerLogGamePages(data: PlayerGameLogData, raw: unknown): PlayerGameLogData {
  const events = object(raw) && object(raw.events) ? raw.events : {};
  return { ...data, rows: data.rows.map(row => ({ ...row, internalGameId: resolveEspnPlayerLogGame(events[row.id.slice(5)], row, data) })) };
}
export function withNbaPlayerLogGamePages(data: PlayerGameLogData): PlayerGameLogData {
  return { ...data, rows: data.rows.map(row => {
    const matches = candidates(row, data, games);
    const game = matches.length === 1 && matches[0].gameId === row.nbaGameId ? matches[0] : null;
    const result = game && game.homeTeam.score !== game.awayTeam.score ? ((row.home ? game.homeTeam.score > game.awayTeam.score : game.awayTeam.score > game.homeTeam.score) ? "W" : "L") : null;
    return { ...row, internalGameId: game && (row.wl === null || row.wl === result) ? game.gameId : null };
  }) };
}

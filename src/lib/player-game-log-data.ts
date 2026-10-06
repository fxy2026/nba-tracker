/** Player-scoped game logs. Missing source fields stay null, including minutes. */
export type PlayerLogSeasonType = "Regular Season" | "Playoffs" | "Pre Season";
export const PLAYER_LOG_STATS = ["min", "pts", "reb", "ast", "stl", "blk", "fgm", "fga", "fg3m", "fg3a", "ftm", "fta", "oreb", "dreb", "tov", "pf", "plusMinus"] as const;
export type PlayerLogStat = typeof PLAYER_LOG_STATS[number];
export interface PlayerLogSupplementSource { provider: "StatMuse"; url: string; retrievedAt: string; }
export interface PlayerLogAssistReview extends PlayerLogSupplementSource {
  sourceValue: 5;
  reviewedValue: 4;
  basis: "season-total-reconciliation";
}
export interface PlayerLogRow extends Record<PlayerLogStat, number | null> {
  id: string;
  nbaGameId: string | null;
  /** Verified available on-site final summary; separate from a provider NBA ID. */
  internalGameId?: string | null;
  date: string;
  team: string;
  opponent: string;
  home: boolean;
  wl: "W" | "L" | null;
  sourceUrl: string;
  sourceProvider?: "ESPN" | "StatMuse";
  /** Original ESPN abbreviations retained beside the reviewed historical identity. */
  historicalIdentity?: { sourceTeam: string; sourceOpponent: string };
  assistReview?: PlayerLogAssistReview;
}
export interface PlayerGameLogData {
  playerId: number;
  season: string;
  seasonType: PlayerLogSeasonType;
  rows: PlayerLogRow[];
  source: { provider: "NBA Stats" | "ESPN" | "ESPN + StatMuse" | "Reviewed box scores"; url: string; retrievedAt: string; archived: boolean; reviewed?: boolean; supplement?: PlayerLogSupplementSource };
  refreshNotice?: "review-conflict";
  coverage: "source-season" | "partial-source";
  expectedGames?: number;
}
export function validLogSeason(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  return year >= 1946 && year <= 2100 && value.slice(5) === String((year + 1) % 100).padStart(2, "0");
}
export function validLogDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const safeUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password && (["www.nba.com", "stats.nba.com", "www.espn.com", "statsdmz.nba.com"].includes(u.hostname) || u.hostname === "www.statmuse.com" && u.pathname === "/nba/player/lebron-james-1780/game-log" && /^\?seasonYear=20\d{2}$/.test(u.search)); } catch { return false; }
};
export function normalizePlayerGameLog(raw: unknown, identity: Pick<PlayerGameLogData, "playerId" | "season" | "seasonType">): PlayerGameLogData | null {
  if (!object(raw) || raw.playerId !== identity.playerId || raw.season !== identity.season || raw.seasonType !== identity.seasonType
    || !Number.isSafeInteger(raw.playerId) || Number(raw.playerId) <= 0 || !validLogSeason(raw.season)
    || !["Regular Season", "Playoffs", "Pre Season"].includes(String(raw.seasonType)) || !Array.isArray(raw.rows) || raw.rows.length > 120
    || !object(raw.source) || !["NBA Stats", "ESPN", "ESPN + StatMuse", "Reviewed box scores"].includes(String(raw.source.provider))
    || !safeUrl(raw.source.url) || typeof raw.source.retrievedAt !== "string" || !Number.isFinite(Date.parse(raw.source.retrievedAt))
    || typeof raw.source.archived !== "boolean" || !["source-season", "partial-source"].includes(String(raw.coverage))) return null;
  if (raw.expectedGames !== undefined && (!Number.isSafeInteger(raw.expectedGames) || Number(raw.expectedGames) < raw.rows.length || Number(raw.expectedGames) > 120)) return null;
  const validSupplement = (value: unknown) => object(value) && value.provider === "StatMuse"
    && value.url === `https://www.statmuse.com/nba/player/lebron-james-1780/game-log?seasonYear=${Number(identity.season.slice(0, 4)) + 1}`
    && typeof value.retrievedAt === "string" && Number.isFinite(Date.parse(value.retrievedAt)) && identity.playerId === 2544;
  if (raw.source.reviewed !== undefined && typeof raw.source.reviewed !== "boolean"
    || raw.source.supplement !== undefined && !validSupplement(raw.source.supplement)
    || raw.source.provider === "ESPN + StatMuse" && !validSupplement(raw.source.supplement)
    || raw.refreshNotice !== undefined && raw.refreshNotice !== "review-conflict") return null;
  if (raw.rows.some(row => object(row) && (row.sourceProvider === "StatMuse" || row.assistReview !== undefined))
    && raw.source.provider !== "ESPN + StatMuse") return null;
  const seen = new Set<string>();
  const prefix = `${identity.seasonType === "Playoffs" ? "004" : identity.seasonType === "Pre Season" ? "001" : "002"}${identity.season.slice(2, 4)}`;
  for (const row of raw.rows) {
    if (!object(row) || typeof row.id !== "string" || !row.id || seen.has(row.id) || !validLogDate(row.date)
      || typeof row.team !== "string" || !/^[A-Z]{2,4}$/.test(row.team) || typeof row.opponent !== "string" || !/^[A-Z]{2,4}$/.test(row.opponent)
      || row.date < `${identity.season.slice(0, 4)}-07-01` || row.date > `${Number(identity.season.slice(0, 4)) + 1}-10-31`
      || row.team === row.opponent || typeof row.home !== "boolean" || !["W", "L", null].includes(row.wl as string | null)
      || !safeUrl(row.sourceUrl) || !(row.nbaGameId === null || (typeof row.nbaGameId === "string" && new RegExp(`^${prefix}\\d{5}$`).test(row.nbaGameId)))) return null;
    if (row.internalGameId !== undefined && row.internalGameId !== null && (typeof row.internalGameId !== "string" || !new RegExp(`^${prefix}\\d{5}$`).test(row.internalGameId) || (row.nbaGameId !== null && row.nbaGameId !== row.internalGameId))) return null;
    if (row.sourceProvider !== undefined && !["ESPN", "StatMuse"].includes(String(row.sourceProvider))) return null;
    if (row.sourceProvider === "StatMuse" && (identity.playerId !== 2544 || identity.seasonType === "Pre Season"
      || row.id !== `statmuse:lebron-${identity.season}-${identity.seasonType === "Playoffs" ? "playoffs" : "regular"}-${row.date}`
      || row.sourceUrl !== (raw.source.supplement as Record<string, unknown> | undefined)?.url || row.nbaGameId === null || row.internalGameId != null)) return null;
    if (row.historicalIdentity !== undefined && (!object(row.historicalIdentity) || identity.playerId !== 2544 || !row.id.startsWith("espn:")
      || typeof row.historicalIdentity.sourceTeam !== "string" || !/^[A-Z]{2,4}$/.test(row.historicalIdentity.sourceTeam)
      || typeof row.historicalIdentity.sourceOpponent !== "string" || !/^[A-Z]{2,4}$/.test(row.historicalIdentity.sourceOpponent))) return null;
    if (row.assistReview !== undefined && (!validSupplement(row.assistReview) || !object(row.assistReview)
      || identity.season !== "2013-14" || identity.seasonType !== "Regular Season" || row.id !== "espn:400489766"
      || row.date !== "2014-03-03" || row.team !== "MIA" || row.opponent !== "CHA" || row.home !== true
      || row.assistReview.sourceValue !== 5 || row.assistReview.reviewedValue !== 4 || row.ast !== 4 || row.assistReview.basis !== "season-total-reconciliation")) return null;
    for (const key of PLAYER_LOG_STATS) {
      const value = row[key];
      if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || (key !== "plusMinus" && value < 0)
        || (key !== "min" && !Number.isSafeInteger(value)))) return null;
    }
    for (const [made, attempts] of [["fgm", "fga"], ["fg3m", "fg3a"], ["ftm", "fta"]] as const) {
      if (row[made] !== null && row[attempts] !== null && Number(row[made]) > Number(row[attempts])) return null;
    }
    if (row.fgm !== null && row.fg3m !== null && row.ftm !== null && row.pts !== null && Number(row.fgm) * 2 + Number(row.fg3m) + Number(row.ftm) !== row.pts) return null;
    if (row.oreb !== null && row.dreb !== null && row.reb !== null && Number(row.oreb) + Number(row.dreb) !== row.reb) return null;
    seen.add(row.id);
  }
  return { ...(raw as unknown as PlayerGameLogData), rows: [...raw.rows as PlayerLogRow[]].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)) };
}

const NBA_FIELDS: Record<PlayerLogStat, string> = { min: "MIN", pts: "PTS", reb: "REB", ast: "AST", stl: "STL", blk: "BLK", fgm: "FGM", fga: "FGA", fg3m: "FG3M", fg3a: "FG3A", ftm: "FTM", fta: "FTA", oreb: "OREB", dreb: "DREB", tov: "TOV", pf: "PF", plusMinus: "PLUS_MINUS" };
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
function nbaDate(raw: unknown): string | null {
  if (validLogDate(raw)) return raw;
  if (typeof raw !== "string") return null;
  const m = /^([A-Z]{3})\s+(\d{1,2}),\s*(\d{4})$/i.exec(raw.trim());
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toUpperCase()) + 1;
  const result = `${m[3]}-${String(month).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return validLogDate(result) ? result : null;
}
export function parseNbaPlayerGameLog(raw: unknown, identity: Pick<PlayerGameLogData, "playerId" | "season" | "seasonType">, retrievedAt: string): PlayerGameLogData | null {
  if (!object(raw) || !Array.isArray(raw.resultSets)) return null;
  const tables = raw.resultSets.filter(rs => object(rs) && rs.name === "PlayerGameLog");
  if (tables.length !== 1) return null;
  const table = tables[0] as Record<string, unknown>;
  if (!Array.isArray(table.headers) || !table.headers.every(h => typeof h === "string") || new Set(table.headers).size !== table.headers.length || !Array.isArray(table.rowSet)) return null;
  const headers = table.headers as string[];
  const gameKey = headers.includes("Game_ID") ? "Game_ID" : "GAME_ID";
  if (![gameKey, "GAME_DATE", "MATCHUP"].every(key => headers.includes(key)) || !(headers.includes("PLAYER_ID") || headers.includes("Player_ID"))) return null;
  const playerKey = headers.includes("Player_ID") ? "Player_ID" : "PLAYER_ID";
  const rows: PlayerLogRow[] = [];
  for (const values of table.rowSet) {
    if (!Array.isArray(values) || values.length !== headers.length) return null;
    const row = Object.fromEntries(headers.map((key, index) => [key, values[index]]));
    if (row[playerKey] !== identity.playerId) return null;
    const gameId = row[gameKey];
    const date = nbaDate(row.GAME_DATE);
    const matchup = typeof row.MATCHUP === "string" ? /^([A-Z]{2,4}) (vs\.|@) ([A-Z]{2,4})$/.exec(row.MATCHUP) : null;
    if (typeof gameId !== "string" || !date || !matchup) return null;
    const stats = Object.fromEntries(PLAYER_LOG_STATS.map(key => [key, row[NBA_FIELDS[key]] ?? null])) as Record<PlayerLogStat, number | null>;
    rows.push({ id: `nba:${gameId}`, nbaGameId: gameId, date, team: matchup[1], opponent: matchup[3], home: matchup[2] === "vs.", wl: row.WL ?? null, sourceUrl: `https://www.nba.com/game/${gameId}/box-score`, ...stats });
  }
  return normalizePlayerGameLog({ ...identity, rows, source: { provider: "NBA Stats", url: `https://www.nba.com/stats/player/${identity.playerId}/boxscores-traditional?Season=${identity.season}&SeasonType=${encodeURIComponent(identity.seasonType)}`, retrievedAt, archived: false }, coverage: "source-season" }, identity);
}

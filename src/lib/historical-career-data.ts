import { isCareerSeason, isIsoTimestamp } from "./player-career-provenance";

export const HISTORICAL_CAREER_TOTAL_KEYS = ["GP", "MIN", "PTS", "REB", "AST", "STL", "BLK", "FGM", "FGA", "FG3M", "FG3A", "FTM", "FTA", "OREB", "DREB", "TOV", "PF", "PLUS_MINUS", "GS"] as const;
export type HistoricalCareerTotalKey = typeof HISTORICAL_CAREER_TOTAL_KEYS[number];
export type HistoricalCareerTotals = Record<HistoricalCareerTotalKey, number | null>;
export type HistoricalCareerSeasonType = "Regular Season" | "Playoffs";
export interface HistoricalCareerRow {
  nbaPlayerId: number;
  season: string;
  seasonType: HistoricalCareerSeasonType;
  teamAbbreviation: string;
  totals: HistoricalCareerTotals;
  sourceId: string;
  sourceUrl: string;
  sourceStatus: "secondary_source";
  retrievedAt: string;
}
export interface HistoricalCareerSource { id: string; publisher: string; url: string; retrievedAt: string }
export interface HistoricalCareerDispute {
  season: string; seasonType: HistoricalCareerSeasonType; field: HistoricalCareerTotalKey;
  observations: { sourceId: string; value: number }[];
}
export interface HistoricalCareerData {
  playerId: number;
  playerName: string;
  retrievedAt: string;
  rows: HistoricalCareerRow[];
  sources: HistoricalCareerSource[];
  disputes: HistoricalCareerDispute[];
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const timestamp = (value: unknown): value is string => isIsoTimestamp(value) || (typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)
  && Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString() === value.replace("Z", ".000Z"));
const statMuseUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.origin === "https://www.statmuse.com" && url.pathname.startsWith("/nba/") && !url.username && !url.password;
  } catch { return false; }
};

/** Project only checked public totals and attribution; never trust stored averages. */
export function normalizeHistoricalCareerData(raw: unknown, playerId: number): HistoricalCareerData | null {
  if (!record(raw) || raw.schemaVersion !== 1 || !record(raw.player)
    || raw.player.nbaPlayerId !== playerId || !Number.isSafeInteger(playerId) || playerId < 1
    || typeof raw.player.name !== "string" || !raw.player.name.trim()
    || !timestamp(raw.retrievedAt) || !Array.isArray(raw.rows) || !raw.rows.length
    || raw.officialNbaVerified === true || !Array.isArray(raw.sources) || !Array.isArray(raw.disputes)) return null;
  const sources: HistoricalCareerSource[] = [];
  for (const source of raw.sources) {
    if (!record(source) || typeof source.id !== "string" || !source.id || sources.some(row => row.id === source.id)
      || typeof source.publisher !== "string" || !source.publisher.trim() || !timestamp(source.retrievedAt)
      || typeof source.url !== "string" || source.officialNbaVerified === true
      || new Date(source.retrievedAt).getTime() > new Date(raw.retrievedAt).getTime()) return null;
    try {
      const url = new URL(source.url);
      if (url.username || url.password || !["https://www.statmuse.com", "https://history.basketballmonster.com"].includes(url.origin)) return null;
    } catch { return null; }
    sources.push({ id: source.id, publisher: source.publisher, url: source.url, retrievedAt: source.retrievedAt });
  }
  const rows: HistoricalCareerRow[] = [];
  const identities = new Set<string>();
  for (const candidate of raw.rows) {
    if (!record(candidate) || candidate.nbaPlayerId !== playerId || !isCareerSeason(candidate.season)
      || (candidate.seasonType !== "Regular Season" && candidate.seasonType !== "Playoffs")
      || typeof candidate.teamAbbreviation !== "string" || !/^[A-Z]{2,4}$/.test(candidate.teamAbbreviation)
      || candidate.sourceStatus !== "secondary_source" || typeof candidate.sourceId !== "string" || !candidate.sourceId
      || !statMuseUrl(candidate.sourceUrl) || !timestamp(candidate.retrievedAt) || candidate.officialNbaVerified === true
      || new Date(candidate.retrievedAt).getTime() > new Date(raw.retrievedAt).getTime() || !record(candidate.totals)) return null;
    if (!sources.some(source => source.id === candidate.sourceId && source.url === candidate.sourceUrl && source.retrievedAt === candidate.retrievedAt)) return null;
    const identity = `${candidate.seasonType}:${candidate.season}`;
    // Each row is a whole season. Team splits must be consolidated upstream,
    // with an explicit aggregate label, rather than double-counted with TOT.
    if (identities.has(identity)) return null;
    identities.add(identity);
    const totals = {} as HistoricalCareerTotals;
    for (const key of HISTORICAL_CAREER_TOTAL_KEYS) {
      const value = candidate.totals[key];
      if (value !== null && (typeof value !== "number" || !Number.isSafeInteger(value) || (key !== "PLUS_MINUS" && value < 0))) return null;
      totals[key] = value as number | null;
    }
    if (totals.GP === null || totals.GP <= 0) return null;
    for (const [made, attempted] of [["FGM", "FGA"], ["FG3M", "FG3A"], ["FTM", "FTA"], ["GS", "GP"], ["FG3M", "FGM"], ["FG3A", "FGA"]] as const) {
      if (totals[made] !== null && totals[attempted] !== null && totals[made] > totals[attempted]) return null;
    }
    if (totals.OREB !== null && totals.DREB !== null && totals.REB !== null && totals.OREB + totals.DREB !== totals.REB) return null;
    if (totals.FGM !== null && totals.FG3M !== null && totals.FTM !== null && totals.PTS !== null
      && 2 * totals.FGM + totals.FG3M + totals.FTM !== totals.PTS) return null;
    rows.push({ nbaPlayerId: playerId, season: candidate.season, seasonType: candidate.seasonType,
      teamAbbreviation: candidate.teamAbbreviation, totals, sourceId: candidate.sourceId,
      sourceUrl: candidate.sourceUrl, sourceStatus: "secondary_source", retrievedAt: candidate.retrievedAt });
  }
  const disputes: HistoricalCareerDispute[] = [];
  for (const dispute of raw.disputes) {
    if (!record(dispute) || typeof dispute.field !== "string" || !dispute.field.startsWith("totals.")
      || !Array.isArray(dispute.observations) || dispute.observations.length < 2 || dispute.resolution !== "quarantined_null") return null;
    const field = dispute.field.slice(7) as HistoricalCareerTotalKey;
    const row = rows.find(row => row.season === dispute.season && row.seasonType === dispute.seasonType);
    if (!row || !HISTORICAL_CAREER_TOTAL_KEYS.includes(field) || row.totals[field] !== null) return null;
    const observations: HistoricalCareerDispute["observations"] = [];
    for (const observation of dispute.observations) {
      if (!record(observation) || typeof observation.sourceId !== "string" || !sources.some(source => source.id === observation.sourceId)
        || typeof observation.value !== "number" || !Number.isSafeInteger(observation.value)) return null;
      observations.push({ sourceId: observation.sourceId, value: observation.value });
    }
    disputes.push({ season: row.season, seasonType: row.seasonType, field, observations });
  }
  return { playerId, playerName: raw.player.name, retrievedAt: raw.retrievedAt, rows, sources, disputes };
}

/** Missing values stay missing, including career aggregates with any gap. */
export function sumHistoricalCareerTotals(rows: readonly HistoricalCareerRow[]): HistoricalCareerTotals {
  return Object.fromEntries(HISTORICAL_CAREER_TOTAL_KEYS.map(key => [key,
    !rows.length || rows.some(row => row.totals[key] === null) ? null : rows.reduce((sum, row) => sum + row.totals[key]!, 0),
  ])) as HistoricalCareerTotals;
}
export function historicalCareerAverage(totals: HistoricalCareerTotals, key: HistoricalCareerTotalKey): number | null {
  return totals[key] === null || totals.GP === null || totals.GP <= 0 ? null : totals[key] / totals.GP;
}
export function historicalCareerPercentage(totals: HistoricalCareerTotals, kind: "FG" | "FG3" | "FT"): number | null {
  const made = totals[`${kind}M`];
  const attempts = totals[`${kind}A`];
  return made === null || attempts === null || attempts <= 0 ? null : made / attempts * 100;
}

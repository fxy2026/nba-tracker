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
  teamName?: string;
  eraUnavailableFields?: HistoricalCareerTotalKey[];
  totals: HistoricalCareerTotals;
  sourceId: string;
  sourceUrl: string;
  sourceStatus: "secondary_source";
  retrievedAt: string;
}
export interface HistoricalCareerSource { id: string; publisher: string; url: string; retrievedAt: string; verifiedScope?: string; scope?: "playoffs-and-historical-team-labels" }
const HISTORICAL_CAREER_PERCENTAGE_KEYS = ["FG_PCT", "FG3_PCT", "FT_PCT"] as const;
type HistoricalCareerPercentageKey = typeof HISTORICAL_CAREER_PERCENTAGE_KEYS[number];
export interface HistoricalCareerDispute {
  season: string; seasonType: HistoricalCareerSeasonType; field: HistoricalCareerTotalKey | HistoricalCareerPercentageKey;
  resolution: "quarantined_null" | "selected_secondary_consensus";
  observations: { sourceId: string; value: number }[];
}
export interface HistoricalCareerData {
  playerId: number;
  playerName: string;
  retrievedAt: string;
  rows: HistoricalCareerRow[];
  sources: HistoricalCareerSource[];
  disputes: HistoricalCareerDispute[];
  retrievalPrecision?: "approximate-minute" | "day";
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const timestamp = (value: unknown): value is string => isIsoTimestamp(value) || (typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)
  && Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString() === value.replace("Z", ".000Z"));
const calendarDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(new Date(`${value}T00:00:00.000Z`).getTime()) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
const statMuseUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.origin === "https://www.statmuse.com" && url.pathname.startsWith("/nba/") && !url.username && !url.password;
  } catch { return false; }
};

/** Project only checked public totals and attribution; never trust stored averages. */
export function normalizeHistoricalCareerData(raw: unknown, playerId: number): HistoricalCareerData | null {
  if (!record(raw)) return null;
  // Date-only evidence is explicit. Never invent collection seconds or permit
  // an unmarked date to silently weaken the existing timestamp contract.
  const retrievalTimestamp = raw.retrievalTimePrecision === "day" ? calendarDate : timestamp;
  if (raw.schemaVersion !== 1 || !record(raw.player)
    || raw.player.nbaPlayerId !== playerId || !Number.isSafeInteger(playerId) || playerId < 1
    || typeof raw.player.name !== "string" || !raw.player.name.trim()
    || !retrievalTimestamp(raw.retrievedAt) || !Array.isArray(raw.rows) || !raw.rows.length
    || raw.officialNbaVerified === true || !Array.isArray(raw.sources) || !Array.isArray(raw.disputes)) return null;
  const sources: HistoricalCareerSource[] = [];
  for (const source of raw.sources) {
    if (!record(source) || typeof source.id !== "string" || !source.id || sources.some(row => row.id === source.id)
      || typeof source.publisher !== "string" || !source.publisher.trim() || !retrievalTimestamp(source.retrievedAt)
      || typeof source.url !== "string"
      || new Date(source.retrievedAt).getTime() > new Date(raw.retrievedAt).getTime()) return null;
    try {
      const url = new URL(source.url);
      const partialOfficial = playerId === 977 && source.url === "https://www.nba.com/lakers/history/alumni/kobe-bryant"
        && source.role === "partial_official_corroboration" && source.officialNbaVerified === true
        && source.verifiedScope === "Only season GP, FGM, FGA, FG3M, FG3A totals independently compared. This does not verify every selected row field.";
      const apbrScope = playerId === 76375 && source.url === "https://apbr.org/wilt.html"
        && source.id === "apbr_playoff_totals" && source.role === "corroboration" && source.officialNbaVerified === false;
      if (url.username || url.password || (!partialOfficial && !apbrScope
        && (source.officialNbaVerified === true || !["https://www.statmuse.com", "https://history.basketballmonster.com", "https://basketball.realgm.com"].includes(url.origin)))) return null;
    } catch { return null; }
    sources.push({ id: source.id, publisher: source.publisher, url: source.url, retrievedAt: source.retrievedAt,
      ...(source.officialNbaVerified === true ? { verifiedScope: source.verifiedScope as string } : {}),
      ...(source.url === "https://apbr.org/wilt.html" ? { scope: "playoffs-and-historical-team-labels" as const } : {}) });
  }
  const rows: HistoricalCareerRow[] = [];
  const identities = new Set<string>();
  for (const candidate of raw.rows) {
    if (!record(candidate) || candidate.nbaPlayerId !== playerId || !isCareerSeason(candidate.season)
      || (candidate.seasonType !== "Regular Season" && candidate.seasonType !== "Playoffs")
      || typeof candidate.teamAbbreviation !== "string" || !/^[A-Z]{2,4}$/.test(candidate.teamAbbreviation)
      || candidate.sourceStatus !== "secondary_source" || typeof candidate.sourceId !== "string" || !candidate.sourceId
      || !statMuseUrl(candidate.sourceUrl) || !retrievalTimestamp(candidate.retrievedAt) || candidate.officialNbaVerified === true
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
    if (candidate.teamName !== undefined && (typeof candidate.teamName !== "string" || !candidate.teamName.trim() || candidate.teamName.length > 100)) return null;
    const eraUnavailableFields: HistoricalCareerTotalKey[] = [];
    if (candidate.eraUnavailableFields !== undefined) {
      if (!Array.isArray(candidate.eraUnavailableFields)) return null;
      for (const value of candidate.eraUnavailableFields) {
        if (value === "percentages.FG3_PCT") {
          if (totals.FG3M !== null || totals.FG3A !== null) return null;
          continue;
        }
        if (typeof value !== "string" || !value.startsWith("totals.")) return null;
        const key = value.slice(7) as HistoricalCareerTotalKey;
        if (!["STL", "BLK", "OREB", "DREB", "TOV", "FG3M", "FG3A"].includes(key)
          || totals[key] !== null || eraUnavailableFields.includes(key)) return null;
        eraUnavailableFields.push(key);
      }
    }
    rows.push({ nbaPlayerId: playerId, season: candidate.season, seasonType: candidate.seasonType,
      teamAbbreviation: candidate.teamAbbreviation,
      ...(typeof candidate.teamName === "string" ? { teamName: candidate.teamName } : {}),
      ...(eraUnavailableFields.length ? { eraUnavailableFields } : {}), totals, sourceId: candidate.sourceId,
      sourceUrl: candidate.sourceUrl, sourceStatus: "secondary_source", retrievedAt: candidate.retrievedAt });
  }
  const disputes: HistoricalCareerDispute[] = [];
  for (const dispute of raw.disputes) {
    if (!record(dispute) || typeof dispute.field !== "string"
      || !Array.isArray(dispute.observations) || dispute.observations.length < 2
      || (dispute.resolution !== "quarantined_null" && dispute.resolution !== "selected_secondary_consensus")) return null;
    const [group, key, extra] = dispute.field.split(".");
    if (extra !== undefined) return null;
    const isTotal = group === "totals" && HISTORICAL_CAREER_TOTAL_KEYS.includes(key as HistoricalCareerTotalKey);
    const isPercentage = group === "percentages" && HISTORICAL_CAREER_PERCENTAGE_KEYS.includes(key as HistoricalCareerPercentageKey);
    if (!isTotal && !isPercentage) return null;
    const field = key as HistoricalCareerDispute["field"];
    const row = rows.find(row => row.season === dispute.season && row.seasonType === dispute.seasonType);
    const rawRow = raw.rows.find(candidate => record(candidate) && candidate.season === dispute.season && candidate.seasonType === dispute.seasonType);
    if (!row || !record(rawRow)) return null;
    const canonicalValue = isTotal ? row.totals[field as HistoricalCareerTotalKey]
      : record(rawRow.percentages) ? rawRow.percentages[field] : undefined;
    if (dispute.resolution === "quarantined_null" ? canonicalValue !== null
      : typeof canonicalValue !== "number" || !Number.isFinite(canonicalValue)
        || (isPercentage && (canonicalValue < 0 || canonicalValue > 1))) return null;
    if (dispute.resolution === "quarantined_null" && isPercentage) {
      const kind = field === "FG_PCT" ? "FG" : field === "FG3_PCT" ? "FG3" : "FT";
      if (historicalCareerPercentage(row.totals, kind) !== null) return null;
    }
    const observations: HistoricalCareerDispute["observations"] = [];
    for (const observation of dispute.observations) {
      if (!record(observation) || typeof observation.sourceId !== "string" || !sources.some(source => source.id === observation.sourceId)
        || observations.some(previous => previous.sourceId === observation.sourceId)
        || typeof observation.value !== "number" || !Number.isFinite(observation.value)
        || (field !== "PLUS_MINUS" && observation.value < 0)
        || (isPercentage ? observation.value > 1 : field !== "MIN" && !Number.isSafeInteger(observation.value))) return null;
      observations.push({ sourceId: observation.sourceId, value: observation.value });
    }
    if (new Set(observations.map(observation => observation.value)).size < 2) return null;
    if (dispute.resolution === "selected_secondary_consensus") {
      // Fractional corroborating minutes may round to the selected whole-minute
      // total. Other counts and displayed source percentages must agree exactly.
      const agrees = (value: number) => field === "MIN" ? Math.abs(value - (canonicalValue as number)) <= 0.5 : value === canonicalValue;
      if (!observations.some(observation => observation.sourceId === row.sourceId && observation.value === canonicalValue)
        || observations.filter(observation => agrees(observation.value)).length < 2) return null;
    }
    disputes.push({ season: row.season, seasonType: row.seasonType, field, resolution: dispute.resolution, observations });
  }
  return { playerId, playerName: raw.player.name, retrievedAt: raw.retrievedAt, rows, sources, disputes,
    ...(raw.retrievalTimePrecision === "day" ? { retrievalPrecision: "day" as const } : {}) };
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

/** Coverage counts describe recorded fields, never a full-career rate denominator. */
export function historicalCareerEraCoverage(rows: readonly HistoricalCareerRow[]) {
  return HISTORICAL_CAREER_TOTAL_KEYS.filter(key => rows.some(row => row.eraUnavailableFields?.includes(key))).map(key => {
    const recorded = rows.filter(row => row.totals[key] !== null);
    return { key, recordedSeasons: recorded.length, totalSeasons: rows.length,
      recordedGames: recorded.length ? recorded.reduce((sum, row) => sum + row.totals.GP!, 0) : null };
  });
}

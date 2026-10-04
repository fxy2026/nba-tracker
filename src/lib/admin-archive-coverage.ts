import manifest from "@/data/admin-archive-coverage.json";

export interface CoverageDates { first: string; last: string }
export type CoverageSection<T> = { status: "available"; data: T } | { status: "unavailable"; data: null };
export interface IdentityCoverage { source: "nba-common-all-players"; playerIds: number; sourceRetrievedOn: CoverageDates }
export interface NbaCareerCoverage { source: "nba-com-reviewed"; players: number; regularSeasonRows: number; sourceCapturedOn: CoverageDates }
export interface SecondaryCareerCoverage {
  source: "secondary-source-reviewed"; players: number; seasonTypeRows: number; regularSeasonRows: number; playoffRows: number;
  officialNbaVerified: false; sourceRetrievedOn: CoverageDates;
}
export interface ShotArchiveCoverage {
  source: "third-party-shot-archive"; players: number; packs: number; seasons: number; firstSeason: string; lastSeason: string;
  playerSeasonTypeEntries: number; acceptedAttempts: number; quarantinedRows: number; packsWithControlMismatches: number;
  sourceCapturedOn: null; localVerifiedOn: CoverageDates;
}
export interface AdminArchiveCoverage {
  identities: CoverageSection<IdentityCoverage>;
  nbaCareers: CoverageSection<NbaCareerCoverage>;
  secondaryCareers: CoverageSection<SecondaryCareerCoverage>;
  shots: CoverageSection<ShotArchiveCoverage>;
}

type RecordValue = Record<string, unknown>;
function object(value: unknown): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Missing coverage metadata");
  return value as RecordValue;
}
function count(raw: RecordValue, key: string): number {
  const value = raw[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid coverage count");
  return value;
}
function dates(raw: unknown): CoverageDates {
  const value = object(raw);
  const day = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!day(value.first) || !day(value.last) || value.first > value.last) throw new Error("Invalid coverage date");
  return { first: value.first, last: value.last };
}
function season(raw: unknown): string {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}$/.test(raw) || String(Number(raw.slice(0, 4)) + 1).slice(-2) !== raw.slice(-2)) throw new Error("Invalid coverage season");
  return raw;
}
function section<T>(root: RecordValue, key: string, source: string, project: (value: RecordValue) => T): CoverageSection<T> {
  try {
    const value = object(root[key]);
    if (value.source !== source || typeof value.inputsSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.inputsSha256)) throw new Error("Unrecognized coverage metadata");
    return { status: "available", data: project(value) };
  } catch { return { status: "unavailable", data: null }; }
}

/** Project independently available metadata sections. Integrity/consistency is
 * checked offline by admin-archive-coverage.test.ts against reviewed inputs.
 * No shot packs, career evidence, providers or database are loaded per request. */
export function parseAdminArchiveCoverage(raw: unknown): AdminArchiveCoverage {
  let root: RecordValue = {};
  try { const value = object(raw); if (value.schemaVersion === 1) root = value; } catch { /* All sections unavailable. */ }
  return {
    identities: section(root, "identities", "nba-common-all-players", value => ({ source: "nba-common-all-players", playerIds: count(value, "playerIds"), sourceRetrievedOn: dates(value.sourceRetrievedOn) })),
    nbaCareers: section(root, "nbaCareers", "nba-com-reviewed", value => ({ source: "nba-com-reviewed", players: count(value, "players"), regularSeasonRows: count(value, "regularSeasonRows"), sourceCapturedOn: dates(value.sourceCapturedOn) })),
    secondaryCareers: section(root, "secondaryCareers", "secondary-source-reviewed", value => {
      const regularSeasonRows = count(value, "regularSeasonRows"), playoffRows = count(value, "playoffRows"), seasonTypeRows = count(value, "seasonTypeRows");
      if (value.officialNbaVerified !== false || regularSeasonRows + playoffRows !== seasonTypeRows) throw new Error("Invalid secondary-source coverage");
      return { source: "secondary-source-reviewed", players: count(value, "players"), seasonTypeRows, regularSeasonRows, playoffRows, officialNbaVerified: false, sourceRetrievedOn: dates(value.sourceRetrievedOn) };
    }),
    shots: section(root, "shots", "third-party-shot-archive", value => {
      const firstSeason = season(value.firstSeason), lastSeason = season(value.lastSeason), seasons = count(value, "seasons"), packs = count(value, "packs"), packsWithControlMismatches = count(value, "packsWithControlMismatches");
      if (firstSeason > lastSeason || seasons < 1 || seasons > Number(lastSeason.slice(0, 4)) - Number(firstSeason.slice(0, 4)) + 1 || packs < seasons || packs > seasons * 2 || packsWithControlMismatches > packs || value.sourceCapturedOn !== null) throw new Error("Invalid shot coverage");
      return { source: "third-party-shot-archive", players: count(value, "players"), packs, seasons, firstSeason, lastSeason, playerSeasonTypeEntries: count(value, "playerSeasonTypeEntries"), acceptedAttempts: count(value, "acceptedAttempts"), quarantinedRows: count(value, "quarantinedRows"), packsWithControlMismatches, sourceCapturedOn: null, localVerifiedOn: dates(value.localVerifiedOn) };
    }),
  };
}

export function getAdminArchiveCoverage(): AdminArchiveCoverage { return parseAdminArchiveCoverage(manifest); }

import { normalizeCareerShooting, type CareerShootingRates } from "./career-shooting";
import { normalizeCareerProvenance, type PlayerCareerProvenance } from "./player-career-provenance";
// Career row from /api/player's careerSeasons — the SeasonTotalsRegularSeason
// result set, or the ESPN fallback (same field names). Shooting-volume
// columns can be absent on very old seasons, so they stay optional.
export interface CareerSeasonRow {
  SEASON_ID: string;
  TEAM_ABBREVIATION: string;
  GP: number;
  MIN: number;
  PTS: number;
  REB: number;
  AST: number;
  STL: number;
  BLK: number;
  FG_PCT: number | null;
  FG3_PCT: number | null;
  FT_PCT: number | null;
  FGA?: number | null;
  FG3A?: number | null;
  FTA?: number | null;
}

export interface PlayerCareerData {
  careerSeasons: CareerSeasonRow[];
  careerShooting?: CareerShootingRates;
  // Older cached responses may have no attribution. Never guess their source.
  provenance?: PlayerCareerProvenance;
}


// Validate only fields consumed by the existing career table/derived panels.
// Null shooting percentages/volumes stay unknown; never fill absent stats.
export function normalizePlayerCareerData(raw: unknown): PlayerCareerData | null {
  if (!raw || typeof raw !== "object" || !("careerSeasons" in raw) || !Array.isArray(raw.careerSeasons)) return null;
  const nonnegative = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  const rows = raw.careerSeasons;
  const valid = rows.every((row: unknown) => {
    if (!row || typeof row !== "object") return false;
    const r = row as Record<string, unknown>;
    if (typeof r.SEASON_ID !== "string" || !/^\d{4}-\d{2}$/.test(r.SEASON_ID) || typeof r.TEAM_ABBREVIATION !== "string") return false;
    if (!["GP", "MIN", "PTS", "REB", "AST", "STL", "BLK"].every(k => nonnegative(r[k]))) return false;
    if (!["FG_PCT", "FG3_PCT", "FT_PCT"].every(k => r[k] === null || (nonnegative(r[k]) && (r[k] as number) <= 1))) return false;
    return ["FGA", "FG3A", "FTA"].every(k => r[k] == null || nonnegative(r[k]));
  });
  if (!valid) return null;
  const rates = "careerShooting" in raw ? normalizeCareerShooting(raw.careerShooting) : null;
  const provenance = "provenance" in raw ? normalizeCareerProvenance(raw.provenance) : null;
  // Missing legacy metadata is allowed; malformed declared metadata must not
  // replace a last-good snapshot or be silently presented as unattributed data.
  if ("provenance" in raw && !provenance) return null;
  if (provenance?.source === "espn" && rates) return null; // No mixed-provider snapshot.
  return {
    careerSeasons: rows as CareerSeasonRow[],
    ...(rates ? { careerShooting: rates } : {}),
    ...(provenance ? { provenance } : {}),
  };
}

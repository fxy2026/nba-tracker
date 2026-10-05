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
  FGM?: number | null;
  FG3M?: number | null;
  FTM?: number | null;
  GS?: number | null;
  TOV?: number | null;
  PF?: number | null;
  OREB?: number | null;
  DREB?: number | null;
}

export interface CareerAverage {
  source: "nba-browser-overall";
  GP: number; MIN: number; PTS: number; REB: number; AST: number; STL: number; BLK: number;
}
export interface PlayerCareerData {
  careerSeasons: CareerSeasonRow[];
  careerShooting?: CareerShootingRates;
  careerAverage?: CareerAverage;
  // True only for a fixed dated archive; live success omits this field.
  stale?: true;
  // Older cached responses may have no attribution. Never guess their source.
  provenance?: PlayerCareerProvenance;
}


// Validate every field consumed by the career and selected-season panels.
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
    if (!["FGA", "FG3A", "FTA", "FGM", "FG3M", "FTM", "TOV", "PF", "OREB", "DREB"].every(k => r[k] == null || nonnegative(r[k]))) return false;
    if (r.GS != null && (!Number.isSafeInteger(r.GS) || (r.GS as number) < 0 || (r.GS as number) > (r.GP as number))) return false;
    return ["FG", "FG3", "FT"].every(kind => r[`${kind}M`] == null || r[`${kind}A`] == null || (r[`${kind}M`] as number) <= (r[`${kind}A`] as number));
  });
  if (!valid) return null;
  const rates = "careerShooting" in raw ? normalizeCareerShooting(raw.careerShooting) : null;
  const provenance = "provenance" in raw ? normalizeCareerProvenance(raw.provenance) : null;
  // Missing legacy metadata is allowed; malformed declared metadata must not
  // replace a last-good snapshot or be silently presented as unattributed data.
  if ("provenance" in raw && !provenance) return null;
  if (provenance?.source === "espn" && rates) return null; // No mixed-provider snapshot.
  const archived = provenance?.source === "nba-com";
  let careerAverage: CareerAverage | undefined;
  if ("careerAverage" in raw) {
    if (!archived || !raw.careerAverage || typeof raw.careerAverage !== "object") return null;
    const avg = raw.careerAverage as Record<string, unknown>;
    if (avg.source !== "nba-browser-overall" || !Number.isSafeInteger(avg.GP) || (avg.GP as number) <= 0
      || !["MIN", "PTS", "REB", "AST", "STL", "BLK"].every(key => nonnegative(avg[key]))) return null;
    careerAverage = { source: "nba-browser-overall", GP: avg.GP as number, MIN: avg.MIN as number,
      PTS: avg.PTS as number, REB: avg.REB as number, AST: avg.AST as number, STL: avg.STL as number, BLK: avg.BLK as number };
  }
  if ((archived && (!("stale" in raw) || raw.stale !== true)) || (!archived && "stale" in raw && raw.stale !== false)) return null;
  if (rates?.source === "nba-browser-overall" && !archived) return null;
  if (archived) {
    if (!rates || rates.source !== "nba-browser-overall" || !careerAverage) return null;
    const seasons = [...new Set((rows as CareerSeasonRow[]).map(row => row.SEASON_ID))].sort();
    const coverage = provenance.coverage;
    if (coverage.rowCount !== rows.length || coverage.seasonCount !== seasons.length
      || coverage.firstSeason !== seasons[0] || coverage.lastSeason !== seasons.at(-1)) return null;
  }
  return {
    careerSeasons: rows as CareerSeasonRow[],
    ...(rates ? { careerShooting: rates } : {}),
    ...(careerAverage ? { careerAverage } : {}),
    ...(provenance ? { provenance } : {}),
    ...(archived ? { stale: true as const } : {}),
  };
}

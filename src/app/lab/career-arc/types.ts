// Per-season career row, as returned (already parsed) by /api/player's
// careerSeasons[] — the SeasonTotalsRegularSeason result set from
// stats.nba.com, or the ESPN fallback (same field names). Numeric fields can
// be null/missing for very old seasons, so everything past the season id is
// optional + nullable; the chart/scrubber degrade gracefully.
export interface CareerSeason {
  SEASON_ID: string;
  TEAM_ABBREVIATION: string;
  GP?: number | null;
  MIN?: number | null;
  PTS?: number | null;
  REB?: number | null;
  AST?: number | null;
  STL?: number | null;
  BLK?: number | null;
  FG_PCT?: number | null;
  FG3_PCT?: number | null;
  FT_PCT?: number | null;
}

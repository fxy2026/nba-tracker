import type { CareerSeasonRow } from "./player-career-data";
import { historicalCareerAverage, historicalCareerPercentage, type HistoricalCareerRow } from "./historical-career-data";

export const SEASON_STAT_KEYS = ["GP", "MIN", "PTS", "REB", "AST", "STL", "BLK", "GS", "TOV", "PF", "OREB", "DREB", "FGM", "FGA", "FG3M", "FG3A", "FTM", "FTA"] as const;
export type SeasonStatKey = typeof SEASON_STAT_KEYS[number];
export interface PlayerSeasonStatsRow {
  season: string;
  team: string;
  teamName?: string;
  stats: Record<SeasonStatKey, number | null>;
  percentages: Record<"FG" | "FG3" | "FT", number | null>;
}

/** API season rows are already per game; GP and GS remain season counts. */
export function careerSeasonStats(row: CareerSeasonRow): PlayerSeasonStatsRow {
  return {
    season: row.SEASON_ID,
    team: row.TEAM_ABBREVIATION,
    stats: Object.fromEntries(SEASON_STAT_KEYS.map(key => [key, row[key] ?? null])) as PlayerSeasonStatsRow["stats"],
    percentages: Object.fromEntries((["FG", "FG3", "FT"] as const).map(kind => {
      const rate = row[`${kind}_PCT`];
      return [kind, rate === null || row[`${kind}A`] === 0 ? null : rate * 100];
    })) as PlayerSeasonStatsRow["percentages"],
  };
}

/** Historical archives contain totals, not the API's per-game values. */
export function historicalSeasonStats(row: HistoricalCareerRow): PlayerSeasonStatsRow {
  return {
    season: row.season,
    team: row.teamAbbreviation,
    ...(row.teamName ? { teamName: row.teamName } : {}),
    stats: Object.fromEntries(SEASON_STAT_KEYS.map(key => [key,
      key === "GP" || key === "GS" ? row.totals[key] : historicalCareerAverage(row.totals, key),
    ])) as PlayerSeasonStatsRow["stats"],
    percentages: { FG: historicalCareerPercentage(row.totals, "FG"), FG3: historicalCareerPercentage(row.totals, "FG3"), FT: historicalCareerPercentage(row.totals, "FT") },
  };
}

/** Keep team splits intact. Prefer a provided whole-season row, never invent one. */
export function selectPlayerSeason(rows: readonly PlayerSeasonStatsRow[], season?: string, team?: string) {
  const seasons = [...new Set(rows.map(row => row.season))].sort().reverse();
  const selectedSeason = season && seasons.includes(season) ? season : seasons[0];
  const teams = rows.filter(row => row.season === selectedSeason);
  const row = teams.find(row => row.team === team) ?? teams.find(row => row.team === "TOT") ?? teams[0];
  return { seasons, teams, row };
}

import { careerAggregationRows } from "./career-shooting";
import type { PlayerCareerData } from "./player-career-data";

/** A fresh response may correct numbers/team splits, but must not lose seasons. */
export function containsCareerSeasons(candidate: PlayerCareerData, previous: PlayerCareerData): boolean {
  const seasons = new Set(candidate.careerSeasons.map(row => row.SEASON_ID));
  return previous.careerSeasons.every(row => seasons.has(row.SEASON_ID));
}

/** Archives also establish a minimum observed game count for each season. */
export function coversArchivedCareer(candidate: PlayerCareerData, archive: PlayerCareerData): boolean {
  if (!containsCareerSeasons(candidate, archive)) return false;
  const proposed = careerAggregationRows(candidate.careerSeasons);
  const observed = careerAggregationRows(archive.careerSeasons);
  if (!proposed || !observed) return false;
  const games = new Map<string, number>();
  for (const row of proposed) games.set(row.SEASON_ID, (games.get(row.SEASON_ID) ?? 0) + row.GP);
  const minimum = new Map<string, number>();
  for (const row of observed) minimum.set(row.SEASON_ID, (minimum.get(row.SEASON_ID) ?? 0) + row.GP);
  return [...minimum].every(([season, count]) => (games.get(season) ?? -1) >= count);
}

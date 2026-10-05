import { getPlayerGameLogArchive, getPlayerLogArchiveSeasons } from "./player-game-log-archive";
import { validLogSeason } from "./player-game-log-data";
/** Registry years describe possible seasons, not guaranteed log availability. */
export async function getPlayerGameLogProfile(playerId: number, years?: { from: number; to: number } | null, preferredSeason?: string | null) {
  const known = getPlayerLogArchiveSeasons(playerId);
  const seasons = new Set(known);
  if (years && Number.isInteger(years.from) && Number.isInteger(years.to) && years.from >= 1946 && years.to >= years.from && years.to - years.from < 80) {
    for (let year = years.from; year <= years.to; year++) seasons.add(`${year}-${String((year + 1) % 100).padStart(2, "0")}`);
  }
  const sorted = [...seasons].sort().reverse();
  const season = known[0] ?? (validLogSeason(preferredSeason) ? preferredSeason : sorted[0]);
  if (season) seasons.add(season);
  const initialData = season ? await getPlayerGameLogArchive(playerId, season, "Regular Season") : null;
  return { seasons: [...seasons].sort().reverse(), initialData, defaultSeason: season };
}

import "server-only";
import { getSeasonHeatmapCatalog, isSeasonHeatmapIdentity } from "./verified-season-heatmap-archive";
import { getHistoricalShotCatalog, loadHistoricalCourtArchive } from "./historical-shot-archive";
import type { SeasonHeatmapCatalogEntry, SeasonHeatmapArchiveResource } from "./season-heatmap";

/** Court-aligned counts come only from source BASIC/AREA groups. Official controls stay separate. */
export async function loadPlayerSeasonHeatmapArchive(identity: unknown): Promise<SeasonHeatmapArchiveResource> {
  if (!isSeasonHeatmapIdentity(identity)) return { status: "unavailable" };
  return loadHistoricalCourtArchive(identity);
}

/** Publish only observed player-seasons. A gap is unavailable, never a zero-attempt season. */
export async function getPlayerSeasonHeatmapCatalog(playerId: number): Promise<readonly SeasonHeatmapCatalogEntry[]> {
  const official = getSeasonHeatmapCatalog(playerId);
  if (!Number.isSafeInteger(playerId) || playerId <= 0) return official;
  let historical: readonly SeasonHeatmapCatalogEntry[];
  try { historical = await getHistoricalShotCatalog(playerId); } catch { return official; }
  const entries = new Map([...historical, ...official].map(entry => [`${entry.season}:${entry.seasonType}`, entry]));
  return Object.freeze([...entries.values()].sort((a, b) => b.season.localeCompare(a.season) || (a.seasonType === "Regular Season" ? -1 : 1)));
}

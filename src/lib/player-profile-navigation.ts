import type { HeatmapIdentity, SeasonHeatmapCatalogEntry } from "./season-heatmap";
export type PlayerProfileQuery = Record<string, string | string[] | undefined>;
/** Only an actually catalogued season/type becomes a deep link. Missing is not zero. */
export function playerShootingSelection(playerId: number, catalog: readonly SeasonHeatmapCatalogEntry[], query: PlayerProfileQuery = {}): HeatmapIdentity | null {
  const entries = catalog.filter(entry => entry.playerId === playerId && entry.availability === "available");
  const season = typeof query.season === "string" ? query.season : null;
  const seasonType = query.seasonType === "Playoffs" || query.seasonType === "Regular Season" ? query.seasonType : null;
  const chosen = entries.find(entry => season === entry.season && (!seasonType || seasonType === entry.seasonType)) ?? entries[0];
  return chosen ? { playerId, season: chosen.season, seasonType: chosen.seasonType } : null;
}
export function canonicalPlayerArchiveHref(playerId: number, catalog: readonly SeasonHeatmapCatalogEntry[], query: PlayerProfileQuery = {}): string {
  const selected = playerShootingSelection(playerId, catalog, query);
  const params = new URLSearchParams();
  if (selected && typeof query.season === "string" && query.season === selected.season) {
    params.set("season", selected.season);
    params.set("seasonType", selected.seasonType);
  }
  return `/player/${playerId}${params.size ? `?${params}` : ""}#shooting`;
}

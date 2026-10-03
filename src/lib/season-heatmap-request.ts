import { decodeSeasonHeatmapResource } from "./season-heatmap-client";
import { SEASON_HEATMAP_COURT_GEOMETRY_VERSION } from "./season-heatmap-court-zones";
import type { HeatmapIdentity, SeasonHeatmapArchiveResource } from "./season-heatmap";

/** Geometry is part of the HTTP identity, so old cached distance-zone responses cannot leak into the new default. */
export function courtSeasonHeatmapUrl(identity: HeatmapIdentity): string {
  const query = new URLSearchParams({ playerId: String(identity.playerId), season: identity.season, seasonType: identity.seasonType, geometry: SEASON_HEATMAP_COURT_GEOMETRY_VERSION });
  return `/api/player-season-heatmap?${query}`;
}
export function decodeCourtSeasonHeatmapResource(value: unknown, expected: HeatmapIdentity): SeasonHeatmapArchiveResource {
  const result = decodeSeasonHeatmapResource(value, expected);
  return result.status === "ready" && result.data.geometryVersion !== SEASON_HEATMAP_COURT_GEOMETRY_VERSION ? { status: "error" } : result;
}

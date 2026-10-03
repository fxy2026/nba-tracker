import type { HeatmapIdentity } from "./season-heatmap";
import { SHOT_MAP_GEOMETRY_VERSION } from "./season-shot-map";

export function seasonShotMapUrl(identity: HeatmapIdentity): string {
  return `/api/player-season-shot-map?${new URLSearchParams({ playerId: String(identity.playerId), season: identity.season, seasonType: identity.seasonType, geometry: SHOT_MAP_GEOMETRY_VERSION })}`;
}

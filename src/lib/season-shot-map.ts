import type { HeatmapArchiveBenchmark, HeatmapArchiveMetadata, HeatmapIdentity } from "./season-heatmap";

/** Versioned spatial identity. Coordinates are NBA LOC_X/LOC_Y in tenths of a foot. */
export const SHOT_MAP_GEOMETRY_VERSION = "nba-shot-hex-v1" as const;
export const SHOT_MAP_MAX_DTO_BYTES = 128 * 1024;
export const SHOT_MAP_FRAME = Object.freeze({ xMin: -250, xMax: 250, yMin: -52.5, yMax: 417.5, unitsPerFoot: 10 });
export const SHOT_MAP_RESOLUTIONS = [{ id: "fine", radius: 25 }, { id: "coarse", radius: 40 }] as const;
export const SHOT_MAP_RESIDUAL_REASONS = ["missing-coordinate", "nonfinite-coordinate", "invalid-coordinate", "out-of-court", "backcourt", "coordinate-shot-type-conflict"] as const;
export type ShotMapResolutionId = (typeof SHOT_MAP_RESOLUTIONS)[number]["id"];
export type ShotMapResidualReason = (typeof SHOT_MAP_RESIDUAL_REASONS)[number];
export interface ShotMapCounts { fgm: number; fga: number; fg3m: number; fg3a: number }
export interface ShotMapBin extends ShotMapCounts {
  q: number;
  r: number;
  /** Exact weighted counts in this cell, same source season/type, including this player. */
  league: ShotMapCounts;
}
export interface ShotMapResolution {
  id: ShotMapResolutionId;
  radius: 25 | 40;
  bins: ShotMapBin[];
}
/** One player/season only. Neither original shot rows nor the complete league grid are transported. */
export interface SeasonShotMapDTO extends HeatmapIdentity {
  schemaVersion: "nba-spatial-v1";
  geometryVersion: typeof SHOT_MAP_GEOMETRY_VERSION;
  totals: ShotMapCounts;
  plotted: ShotMapCounts;
  residuals: Array<ShotMapCounts & { reason: ShotMapResidualReason }>;
  resolutions: ShotMapResolution[];
  source: { url: string; capturedAtUtc: string };
  archive: HeatmapArchiveMetadata;
  reference: {
    kind: "same-season-type-cell-archive-counts";
    includesPlayer: true;
    minPlayerAttempts: 5;
    minLeagueAttempts: 20;
    scope: HeatmapArchiveBenchmark;
  };
}
export type SeasonShotMapResource = { status: "ready"; data: SeasonShotMapDTO } | { status: "error" } | { status: "unavailable" };

/** Pointy-top axial lattice, with the rim at (0, 0). Never infer a shot's point value from its cell. */
export function shotMapBinCenter(bin: Pick<ShotMapBin, "q" | "r">, radius: number): { x: number; y: number } {
  return { x: radius * Math.sqrt(3) * (bin.q + bin.r / 2), y: radius * 1.5 * bin.r };
}

/** Separating-axis test for an actual hex footprint against the half-court rectangle. */
export function shotMapCellIntersectsFrame(bin: Pick<ShotMapBin, "q" | "r">, radius: number): boolean {
  const center = shotMapBinCenter(bin, radius);
  const hex = Array.from({ length: 6 }, (_, i) => {
    const angle = (30 + i * 60) * Math.PI / 180;
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
  });
  const frame = [{ x: SHOT_MAP_FRAME.xMin, y: SHOT_MAP_FRAME.yMin }, { x: SHOT_MAP_FRAME.xMin, y: SHOT_MAP_FRAME.yMax }, { x: SHOT_MAP_FRAME.xMax, y: SHOT_MAP_FRAME.yMin }, { x: SHOT_MAP_FRAME.xMax, y: SHOT_MAP_FRAME.yMax }];
  return [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0.5, y: Math.sqrt(3) / 2 }, { x: 0.5, y: -Math.sqrt(3) / 2 }].every(axis => {
    const a = hex.map(point => point.x * axis.x + point.y * axis.y), b = frame.map(point => point.x * axis.x + point.y * axis.y);
    return Math.max(...a) + 1e-9 >= Math.min(...b) && Math.max(...b) + 1e-9 >= Math.min(...a);
  });
}

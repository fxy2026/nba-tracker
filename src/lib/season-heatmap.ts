import type { Advanced14ZoneId } from "./season-heatmap-geometry";

export type HeatmapSeasonType = "Regular Season" | "Playoffs";
export interface HeatmapIdentity {
  playerId: number;
  season: string;
  seasonType: HeatmapSeasonType;
}
export interface HeatmapCounts { fgm: number; fga: number }
export interface HeatmapShootingCounts extends HeatmapCounts {
  fg3m: number | null;
  fg3a: number | null;
}
export interface HeatmapSourceReference {
  url: string;
  capturedAtUtc: string | null;
  observedAtWindowUtc: [string, string] | null;
  evidencePath: string;
  evidenceSha256: string;
}
export interface HeatmapSourceTotals extends HeatmapIdentity, HeatmapShootingCounts {
  fgPctDisplay: string | null;
  source: HeatmapSourceReference;
}
export interface HeatmapBenchmarkProvenance {
  kind: "nba-chart-displayed-la";
  sourceLabel: "LA - League Average";
  chartIdentity: HeatmapIdentity;
  sourceUrl: string;
  // Chart context is known. Benchmark filtering and its own scope are not verified.
  independentlyVerifiedScope: null;
  leagueFgm: null;
  leagueFga: null;
  methodology: null;
  recomputed: false;
  displayDecimalPlaces: 1;
}
export interface HeatmapCandidateRow extends HeatmapCounts {
  sourceZoneId: string;
  sourceOrder: number;
  fgPctDisplay: string | null;
  distributionPctDisplay: string | null;
  leagueAveragePctDisplay: string | null;
  sourceTraditionalScaleValue: number | null;
  sourceExtendedScaleValue: number | null;
}
export interface HeatmapZoneCandidate extends HeatmapCandidateRow {
  id: Advanced14ZoneId;
  pathD: string;
  labelGroupTranslate: [number, number];
}
export interface HeatmapResidualCandidate extends HeatmapCandidateRow {
  id: "backcourt" | "unclassified";
  // A residual's apparent aggregate 3P difference is not shot-type evidence.
  shotType: "unknown";
}
/** Private server-side interchange. No raw source file is part of a renderer DTO. */
export interface SeasonHeatmapCandidate extends HeatmapIdentity {
  schemaVersion: 1;
  kind: "player-season-advanced14-aggregate-candidate";
  publicationStatus: "private-unenabled";
  geometryVersion: "nba-advanced14-svg-v1";
  classification: HeatmapIdentity & {
    version: "nba-advanced14-source-labels-v1";
    geometryVersion: "nba-advanced14-svg-v1";
    basis: "source-displayed-scales";
  };
  source: HeatmapSourceReference;
  benchmark: HeatmapBenchmarkProvenance | null;
  zones: HeatmapZoneCandidate[];
  residuals: HeatmapResidualCandidate[];
  sourceOverall: HeatmapSourceTotals;
  independentCareerTotals: HeatmapSourceTotals | null;
  // This schema imports aggregates only. A visible table count is not durable points.
  rawPointCoverage: { status: "not-captured"; durableCount: 0; sourceObservedCount: number | null };
  review: { status: "pending" | "passed"; evidenceSha256: string; reportSha256: string | null };
}
export interface HeatmapReconciliation {
  normalZones: HeatmapCounts;
  residuals: HeatmapCounts;
  combined: HeatmapCounts;
  normal24Plus: HeatmapCounts;
  threePointRemainder: HeatmapCounts | null;
  residualShotTypesVerified: false;
  sourceOverallMatches: true;
  independentCareerTotalsMatches: true | null;
  aggregateCoverage: "full-season-reconciled" | "source-overall-only";
}
export interface SeasonHeatmapDisplayRow extends HeatmapCounts {
  id: Advanced14ZoneId | "backcourt" | "unclassified";
  sourceZoneId: string;
  fgPct: number | null;
  fgPctDisplay: string | null;
  // Source display is preserved separately even when source says 0.0 for no attempts.
  sourceFgPctDisplay: string | null;
  attemptShare: number;
  attemptShareDisplay: string | null;
  status: "has-attempts" | "no-attempts";
  leagueAverage: { displayedPct: string; provenance: "source-displayed-unverified-scope" } | null;
}
/** Safe, explicit projection for a future renderer. Contains neither evidence nor raw points. */
export interface SeasonHeatmapRendererDTO extends HeatmapIdentity {
  geometryVersion: "nba-advanced14-svg-v1";
  status: "private-preview-only" | "verified-aggregate";
  source?: {
    url: string;
    capturedAtUtc: string | null;
    observedAtWindowUtc: [string, string] | null;
  };
  zones: SeasonHeatmapDisplayRow[];
  residuals: SeasonHeatmapDisplayRow[];
  totals: HeatmapCounts;
  coverage: {
    aggregate: HeatmapReconciliation["aggregateCoverage"];
    rawPoints: "not-captured";
    normalZoneAttempts: number;
    residualAttempts: number;
    seasonAttemptDenominator: number;
  };
  benchmark: {
    kind: "source-displayed-unverified-scope";
    independentlyVerifiedScope: null;
    leagueFgm: null;
    leagueFga: null;
  } | null;
}

export type SeasonHeatmapArchiveResource =
  | { status: "ready"; data: SeasonHeatmapRendererDTO }
  | { status: "unavailable" }
  | { status: "error" };

export interface SeasonHeatmapCatalogEntry extends HeatmapIdentity {
  availability: "available";
}

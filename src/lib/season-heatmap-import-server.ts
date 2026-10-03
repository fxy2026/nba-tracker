import "server-only";
import { advanced14Geometry, SEASON_HEATMAP_CLASSIFICATION_VERSION, SEASON_HEATMAP_GEOMETRY_VERSION } from "./season-heatmap-geometry";
import { evidenceSha256, validateSeasonHeatmapCandidate } from "./season-heatmap-server";
import type { CandidateValidation } from "./season-heatmap-server";
import type { HeatmapIdentity, HeatmapSourceTotals, SeasonHeatmapCandidate } from "./season-heatmap";

export interface VisibleHeatmapImportOptions {
  expectedIdentity: HeatmapIdentity;
  expectedEvidenceSha256: string;
  evidencePath: string;
  sourceOverall: HeatmapSourceTotals;
  independentCareerTotals: HeatmapSourceTotals | null;
  sourceObservedPointCount: number | null;
  // The caller supplies an independently reviewed hash, never inferred from the source.
  reviewReportSha256?: string;
}
/** Offline, non-mutating import helper. No filesystem, fetch, API, runtime registration, or publish. */
export function importVisibleAdvanced14Evidence(bytes: string | Buffer, options: VisibleHeatmapImportOptions): CandidateValidation {
  const hash = evidenceSha256(bytes);
  if (hash !== options.expectedEvidenceSha256) return { ok: false, error: "Evidence byte hash differs from frozen source" };
  try {
    const raw = JSON.parse(bytes.toString());
    if (raw.schemaVersion !== 1 || raw.publicationStatus !== "not-approved-not-runtime-data" ||
      !["read-only-official-NBA-visible-advanced-14-zone-pilot", "read-only-official-NBA-historical-advanced-zone-pilot"].includes(raw.kind) ||
      raw.player?.nbaId !== options.expectedIdentity.playerId || raw.season !== options.expectedIdentity.season || raw.seasonType !== options.expectedIdentity.seasonType ||
      raw.source?.contextMeasure !== "FGA" || raw.source.selectedChart !== "SHOT ZONES" || raw.source.selectedZoneMode !== "ADVANCED" ||
      raw.source.selectedColorScale !== "TRADITIONAL" ||
      typeof raw.player.name !== "string" || !raw.player.name.trim() ||
      raw.source.heading !== `FGA for ${raw.player.name} during the ${raw.season} ${raw.seasonType}` ||
      raw.svg?.viewBox !== "0 0 540 570" || raw.svg.allZonePathTransform !== "scale(0.835)" || !Array.isArray(raw.zones)) {
      return { ok: false, error: "Unsupported source capture or mismatched scope/geometry" };
    }
    const id = options.expectedIdentity;
    const convertRow = (r: Record<string, unknown>) => ({
      sourceZoneId: r.sourceZoneId, sourceOrder: r.sourceOrder, fgm: r.FGM, fga: r.FGA,
      fgPctDisplay: r.FG_PCT_display, distributionPctDisplay: r.distributionPct_display,
      leagueAveragePctDisplay: r.leagueAverageFG_PCT_display ?? null,
      sourceTraditionalScaleValue: r.sourceTraditionalScaleValue ?? null,
      sourceExtendedScaleValue: r.sourceExtendedScaleValue ?? null,
    });
    // Source order changes across seasons; stable identity is the exact named source ID.
    const zones = raw.zones.map((r: Record<string, unknown>) => ({
      ...convertRow(r), id: advanced14Geometry.find(g => g.sourceZoneId === r.sourceZoneId)?.id,
      pathD: r.pathD, labelGroupTranslate: r.labelGroupTranslate,
    }));
    const residuals = (raw.residualCategories ?? []).map((r: Record<string, unknown>) => ({
      ...convertRow(r), id: r.sourceZoneId === "Back Court(BC) | Back Court Shot" ? "backcourt" : r.sourceZoneId === "null | null" ? "unclassified" : null,
      shotType: "unknown",
      // Never copy degenerate paths or non-finite source transforms for residuals.
    }));
    const candidate = {
      schemaVersion: 1, kind: "player-season-advanced14-aggregate-candidate", publicationStatus: "private-unenabled", ...id,
      geometryVersion: SEASON_HEATMAP_GEOMETRY_VERSION,
      classification: { ...id, version: SEASON_HEATMAP_CLASSIFICATION_VERSION, geometryVersion: SEASON_HEATMAP_GEOMETRY_VERSION, basis: "source-displayed-scales" },
      source: {
        url: raw.source.url, capturedAtUtc: raw.source.exactRetrievedAtUtc,
        observedAtWindowUtc: raw.source.renderedDomReadAtWindowUtc ?? raw.source.zoneDomReadAtWindowUtc ?? null,
        evidencePath: options.evidencePath, evidenceSha256: hash,
      },
      benchmark: {
        kind: "nba-chart-displayed-la", sourceLabel: "LA - League Average", chartIdentity: { ...id }, sourceUrl: raw.source.url,
        independentlyVerifiedScope: null, leagueFgm: null, leagueFga: null, methodology: null, recomputed: false, displayDecimalPlaces: 1,
      },
      zones, residuals, sourceOverall: options.sourceOverall, independentCareerTotals: options.independentCareerTotals,
      rawPointCoverage: { status: "not-captured", durableCount: 0, sourceObservedCount: options.sourceObservedPointCount },
      review: { status: options.reviewReportSha256 ? "passed" : "pending", evidenceSha256: hash, reportSha256: options.reviewReportSha256 ?? null },
    };
    return validateSeasonHeatmapCandidate(candidate, id);
  } catch {
    return { ok: false, error: "Malformed visible advanced-zone evidence" };
  }
}

/** Useful when a consumer wants a candidate only, while retaining structured errors above. */
export function validatedCandidateOrNull(result: CandidateValidation): SeasonHeatmapCandidate | null {
  return result.ok ? result.value : null;
}

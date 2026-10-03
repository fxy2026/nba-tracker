import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SeasonHeatmapExplorer from "../SeasonHeatmapExplorer";
import { advanced14Geometry } from "@/lib/season-heatmap-geometry";
import type { SeasonHeatmapDisplayRow, SeasonHeatmapRendererDTO } from "@/lib/season-heatmap";
import { datasetKey, HEATMAP_COLORS, referenceDifference, zoneColor } from "./season-heatmap-display";

// Invented test-only values. No captured player data is tracked in this UI patch.
function fixture(): SeasonHeatmapRendererDTO {
  const zones: SeasonHeatmapDisplayRow[] = advanced14Geometry.map(g => ({ id: g.id, sourceZoneId: g.sourceZoneId, fgm: 10, fga: 20, fgPct: .5, fgPctDisplay: "50.0", sourceFgPctDisplay: "50.0", attemptShare: 20 / 294, attemptShareDisplay: "6.8", status: "has-attempts", leagueAverage: { displayedPct: "40.0", provenance: "source-displayed-unverified-scope" } }));
  return { playerId: 999999, season: "2001-02", seasonType: "Regular Season", geometryVersion: "nba-advanced14-svg-v1", status: "private-preview-only", zones,
    residuals: [{ ...zones[0], id: "backcourt", sourceZoneId: "Back Court | Back Court Shot", fgm: 3, fga: 12, fgPct: .25, fgPctDisplay: "25.0", attemptShare: 12 / 294, attemptShareDisplay: "4.1", leagueAverage: null }, { ...zones[0], id: "unclassified", sourceZoneId: "null | null", fgm: 1, fga: 2, fgPct: .5, attemptShare: 2 / 294, attemptShareDisplay: "0.7", leagueAverage: null }],
    totals: { fgm: 144, fga: 294 }, coverage: { aggregate: "full-season-reconciled", rawPoints: "not-captured", normalZoneAttempts: 280, residualAttempts: 14, seasonAttemptDenominator: 294 },
    benchmark: { kind: "source-displayed-unverified-scope", independentlyVerifiedScope: null, leagueFgm: null, leagueFga: null } };
}
function render(data = fixture(), locale: "en" | "zh" = "en") { return renderToStaticMarkup(<SeasonHeatmapExplorer player={{ id: data.playerId, name: "Test Player" }} datasets={[{ playerId: data.playerId, season: data.season, seasonType: data.seasonType, availability: "available" }]} resources={{ [datasetKey(data)]: { status: "ready", data } }} locale={locale} />); }
function archiveFixture(): SeasonHeatmapRendererDTO {
  const data = fixture();
  data.status = "archive-summary"; data.coverage.aggregate = "archive-source-only";
  data.source = { url: "https://raw.githubusercontent.com/fxy2026/nba_data/e829d4678be1e075f99e5d41a1c5f97089be446b/datasets/shotdetail_2001.tar.xz", capturedAtUtc: "2026-10-03T09:45:03Z", observedAtWindowUtc: null };
  data.archive = { fg3m: 2, fg3a: 4, shotBearingGames: 35, officialGp: 36, coverageStatus: "official-shooting-totals-match", sourceCoverage: { from: "2001-10-01", to: "2002-06-30" }, metadataObservedAtUtc: "2026-10-03T10:47:00Z", officialControl: { ...data.totals, fg3m: 2, fg3a: 4, url: "https://www.nba.com/stats/player/999999/career?PerMode=Totals", capturedAtUtc: "2026-10-02T03:21:09Z" } };
  data.benchmark = { kind: "weighted-archive-counts-not-official-displayed-LA", season: data.season, seasonType: data.seasonType, from: "2001-10-01", to: "2002-06-30", shotBearingGames: 1230, leagueFgm: 1440, leagueFga: 2940 };
  for (const row of [...data.zones, ...data.residuals]) { row.fg3m = 0; row.fg3a = 0; row.leagueAverage = { provenance: "weighted-archive-counts-not-official-displayed-LA", displayedPct: "40.0", leagueFgm: 40, leagueFga: 100 }; }
  Object.assign(data.residuals[0], { fg3m: 2, fg3a: 4 });
  return data;
}
describe("season heatmap display rules", () => {
  it.each([["43.0", "40.0", 3, "near"], ["37.0", "40.0", -3, "near"], ["43.1", "40.0", 3.1, "above"], ["36.9", "40.0", -3.1, "below"], ["56.3", "53.3", 3, "near"], ["53.3", "56.3", -3, "near"]] as const)("compares displayed tenths exactly: %s vs %s", (fg, la, difference, color) => {
    const data = fixture(), row = { ...data.zones[0], fgPctDisplay: fg, leagueAverage: { ...data.zones[0].leagueAverage!, displayedPct: la } };
    expect(referenceDifference(row, data.benchmark)).toBe(difference); expect(zoneColor(row, "reference", data.benchmark)).toBe(HEATMAP_COLORS[color]);
  });
  it("does not manufacture a reference for missing benchmark or LA", () => {
    const data = fixture(), row = data.zones[0];
    expect(referenceDifference(row, null)).toBeNull(); expect(zoneColor(row, "reference", null)).toBe(HEATMAP_COLORS.neutral);
    expect(zoneColor({ ...row, leagueAverage: null }, "reference", data.benchmark)).toBe(HEATMAP_COLORS.neutral);
    expect(zoneColor(row, "percentage", null)).toBe(HEATMAP_COLORS.near); expect(zoneColor(row, "volume", null)).toBe(HEATMAP_COLORS.near);
  });
  it("renders no-attempt rates as absent and volume as zero", () => {
    const data = fixture(); Object.assign(data.zones[0], { fgm: 0, fga: 0, fgPct: null, fgPctDisplay: null, attemptShare: 0, attemptShareDisplay: "0.0", status: "no-attempts" });
    for (const mode of ["reference", "percentage", "volume"] as const) expect(zoneColor(data.zones[0], mode, data.benchmark)).toBe(HEATMAP_COLORS.neutral);
    const html = render(data); expect(html).toContain("Center · under 8 ft: —, 0 / 0; Season shot share 0.0%"); expect(html).not.toContain("NaN");
  });
  it("is independent of source zone array order", () => {
    const data = fixture(); data.zones.forEach((z, i) => { z.fgPctDisplay = `${i + 10}.0`; });
    const court = (html: string) => html.match(/<svg[\s\S]*?<\/svg>/)?.[0];
    const before = court(render(data)); data.zones.reverse(); expect(court(render(data))).toBe(before);
  });
  it.each(["en", "zh"] as const)("keeps all 14 mapped zones and both residuals with full denominators (%s)", locale => {
    const html = render(fixture(), locale), svg = html.match(/<svg[\s\S]*?<\/svg>/)![0];
    expect((svg.match(/data-zone-id=/g) ?? [])).toHaveLength(14); expect((svg.match(/data-zone-label=/g) ?? [])).toHaveLength(14);
    expect(svg).not.toContain('data-zone-id="backcourt"'); expect(svg).not.toContain('data-zone-id="unclassified"'); expect(svg).not.toContain('d="M0,0"');
    expect(html).toContain('data-list-zone="backcourt"'); expect(html).toContain('data-list-zone="unclassified"'); expect(html).toContain("144 / 294"); expect(html).toContain("= 294");
    expect(html).toContain("0.7%"); expect(html).toContain("3/12*"); expect(html).toContain("1/2*");
  });
  it("provides exactly 14 keyboard-accessible SVG regions and a button list", () => {
    const html = render(), svg = html.match(/<svg[\s\S]*?<\/svg>/)![0];
    expect((svg.match(/role="button"/g) ?? [])).toHaveLength(14); expect((svg.match(/tabindex="0"/g) ?? [])).toHaveLength(14);
    expect((html.match(/data-list-zone=/g) ?? [])).toHaveLength(16); expect(html).toContain('aria-live="polite"'); expect(html).toContain("All zone statistics");
  });
  it("never horizontally transforms glyphs", () => {
    const svg = render().match(/<svg[\s\S]*?<\/svg>/)![0];
    expect(svg).not.toMatch(/textLength|lengthAdjust|scaleX/); expect(svg).not.toMatch(/<text[^>]*transform=/);
    const labels = [...svg.matchAll(/<g data-zone-label=[\s\S]*?<\/g>/g)]; expect(labels).toHaveLength(14); for (const label of labels) expect(label[0]).not.toContain("transform=");
  });
  it("uses a single coherent path per region with no warp, clipping strips or underpaint", () => {
    const svg = render().match(/<svg[\s\S]*?<\/svg>/)![0];
    expect(svg).not.toMatch(/data-display-underpaint|clipPath|matrix\(|transform=/);
    expect((svg.match(/data-zone-fill=/g) ?? [])).toHaveLength(14);
    expect((svg.match(/data-corner-leader=/g) ?? [])).toHaveLength(2);
    expect(svg).toContain('data-display-geometry="coherent-advanced14-illustration-v2"');
    expect(svg).toContain('data-court-markings="true"');
  });
  it("rejects a ready result under the wrong selection identity", () => {
    const data = fixture(), html = renderToStaticMarkup(<SeasonHeatmapExplorer player={{ id: 999999, name: "Test Player" }} datasets={[{ ...data, season: "2002-03", availability: "available" }]} resources={{ [datasetKey({ ...data, season: "2002-03" })]: { status: "ready", data } }} />);
    expect(html).toContain("does not match"); expect(html).not.toContain("data-zone-id");
  });
  it("does not imply availability when metadata is absent", () => {
    const data = fixture(), html = renderToStaticMarkup(<SeasonHeatmapExplorer player={{ id: data.playerId, name: "Test Player" }} datasets={[]} resources={{ [datasetKey(data)]: { status: "ready", data } }} />);
    expect(html).toContain("No season datasets"); expect(html).not.toContain("data-zone-id");
  });
  it.each(["loading", "error", "unavailable"] as const)("keeps an unloaded public %s header source-neutral", status => {
    const data = fixture();
    for (const locale of ["en", "zh"] as const) {
      const html = renderToStaticMarkup(<SeasonHeatmapExplorer player={{ id: data.playerId, name: "Test Player" }} datasets={[{ ...data, availability: "available" }]} resources={{ [datasetKey(data)]: { status } }} publication="verified" locale={locale} />);
      expect(html).toContain(locale === "en" ? "SHOT ARCHIVE" : "投篮档案");
      expect(html).toContain('data-season-heatmap="unresolved-archive"');
      expect(html).not.toContain('data-season-heatmap="verified-aggregate"');
      expect(html).not.toContain("OFFICIAL AGGREGATES"); expect(html).not.toContain("官方汇总");
      expect(html).not.toContain("data-zone-id");
    }
  });
  it("retains the private and benchmark limitations in both languages", () => {
    expect(render()).toContain("PRIVATE PREVIEW"); expect(render()).toContain("not independently verified"); expect(render()).toContain("±3 percentage-point");
    expect(render(fixture(), "zh")).toContain("私人预览"); expect(render(fixture(), "zh")).toContain("尚未独立核验");
  });
});

describe("archive-summary display rules", () => {
  it.each(["en", "zh"] as const)("retains the same 14 schematic regions and non-spatial residuals (%s)", locale => {
    const html = render(archiveFixture(), locale), svg = html.match(/<svg[\s\S]*?<\/svg>/)![0];
    expect((svg.match(/data-zone-id=/g) ?? [])).toHaveLength(14);
    expect((svg.match(/data-zone-label=/g) ?? [])).toHaveLength(14);
    expect(svg).not.toContain('data-zone-id="backcourt"');
    expect(html).toContain('data-list-zone="backcourt"'); expect(html).toContain('data-list-zone="unclassified"');
    expect(html).toContain('data-season-heatmap="archive-summary"');
    expect(html).not.toContain("Full-season aggregates reconciled"); expect(html).not.toContain("全赛季汇总已对账");
    expect(html).not.toContain("OFFICIAL AGGREGATES"); expect(html).not.toContain("官方汇总");
  });
  it("shows weighted benchmark provenance, actual dates, explicit 3P and distinct GP counts", () => {
    const html = render(archiveFixture());
    for (const text of ["Archive league reference", "league zone makes ÷ attempts", "not independently verified", "Archive 3P made / attempts: 2 / 4", "Shot-bearing games: 35", "Official GP: 36", "zero-attempt games may be absent", "explicit SHOT_TYPE", "never 24+ ft.", "Archive-wide game dates: 2001-10-01", "Original download: 2026-10-03", "Source metadata observed: 2026-10-03", "League reference period: 2001-02", "1440 / 2940", "four shooting totals match"]) expect(html).toContain(text);
    expect(html).not.toContain("Reference colors compare NBA-displayed LA");
  });
  it("discloses mismatched controls and unreconciled archive counts without implying official completeness", () => {
    const data = archiveFixture(); data.archive!.coverageStatus = "official-shooting-totals-mismatch";
    expect(render(data)).toContain("Archive totals differ from the official control");
    expect(render(data)).toContain("missing shots are not invented");
    Object.assign(data.archive!, { coverageStatus: "not-officially-reconciled", officialControl: null, officialGp: null });
    expect(render(data)).toContain("Official GP: unavailable");
    expect(render(data)).toContain("have not been reconciled to official season totals");
  });
  it("never compares archive colors using an official displayed-LA label", () => {
    const data = archiveFixture();
    expect(referenceDifference(data.zones[0], data.benchmark)).toBe(10);
    expect(zoneColor(data.zones[0], "reference", data.benchmark)).toBe(HEATMAP_COLORS.above);
    data.zones[0].leagueAverage = { displayedPct: "40.0", provenance: "source-displayed-unverified-scope" };
    expect(referenceDifference(data.zones[0], data.benchmark)).toBeNull();
    expect(zoneColor(data.zones[0], "reference", data.benchmark)).toBe(HEATMAP_COLORS.neutral);
  });
  it("keeps genuine archive zero-attempt zones neutral with absent FG%", () => {
    const data = archiveFixture(); Object.assign(data.zones[0], { fgm: 0, fga: 0, fg3m: 0, fg3a: 0, fgPct: null, fgPctDisplay: null, attemptShare: 0, attemptShareDisplay: "0.0", status: "no-attempts" });
    expect(render(data)).toContain("Center · under 8 ft: —, 0 / 0; Archive shot share 0.0%");
    for (const mode of ["reference", "percentage", "volume"] as const) expect(zoneColor(data.zones[0], mode, data.benchmark)).toBe(HEATMAP_COLORS.neutral);
  });
});

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("server-only", () => ({}));
import SeasonHeatmapExplorer from "../SeasonHeatmapExplorer";
import { loadPlayerSeasonHeatmapArchive } from "@/lib/season-heatmap-catalog-server";
import { loadSeasonHeatmapArchive } from "@/lib/verified-season-heatmap-archive";
import { decodeSeasonHeatmapResource } from "@/lib/season-heatmap-client";
import type { HeatmapIdentity, SeasonHeatmapRendererDTO } from "@/lib/season-heatmap";
import { datasetKey } from "./season-heatmap-display";

const identity: HeatmapIdentity = { playerId: 201939, season: "2015-16", seasonType: "Regular Season" };
async function fixture() {
  const result = await loadPlayerSeasonHeatmapArchive(identity);
  if (result.status !== "ready") throw new Error("Expected historical Curry archive");
  return structuredClone(result.data);
}
function render(data: SeasonHeatmapRendererDTO, locale: "en" | "zh" = "en") {
  return renderToStaticMarkup(<SeasonHeatmapExplorer player={{ id: identity.playerId, name: "Stephen Curry" }} datasets={[{ ...identity, availability: "available" }]} resources={{ [datasetKey(identity)]: { status: "ready", data } }} locale={locale} publication="verified" />);
}

describe("court-aligned archive explorer", () => {
  it.each(["en", "zh"] as const)("renders 12 actual court categories and preserves the source/control separation (%s)", async locale => {
    const data = await fixture(), html = render(data, locale), svg = html.match(/<svg[\s\S]*?<\/svg>/)![0];
    expect(data.geometryVersion).toBe("nba-court-basic12-v1");
    expect(decodeSeasonHeatmapResource({ status: "ready", data }, identity)).toEqual({ status: "ready", data });
    expect((svg.match(/data-zone-id=/g) ?? [])).toHaveLength(12);
    expect((svg.match(/data-zone-label=/g) ?? [])).toHaveLength(12);
    expect((svg.match(/role="button"/g) ?? [])).toHaveLength(12);
    expect((html.match(/data-list-zone=/g) ?? [])).toHaveLength(12 + data.residuals.length);
    expect(svg).not.toContain('data-zone-id="backcourt"');
    expect(html).toContain('data-list-zone="backcourt"');
    expect(html).toContain("804 / 1596"); expect(html).toContain("401 / 884");
    expect(html).toContain("805 / 1598 FG"); expect(html).toContain("402 / 886 3P");
    expect(html).toContain('data-archive-coverage="official-shooting-totals-mismatch"');
    expect(html).toContain('data-archive-shortfall="true"');
    expect(html).toContain(locale === "en" ? "1 made field goal and 2 attempts; 1 made three-pointer and 2 three-point attempts" : "少 1 次投篮命中、2 次出手；其中三分少 1 次命中、2 次出手");
    expect(html).toContain(locale === "en" ? "internal direction dividers are illustrative" : "内部方向分界为示意");
    expect(html).not.toContain("Full-season aggregates reconciled"); expect(html).not.toContain("全赛季汇总已对账");
    expect(html).not.toContain("OFFICIAL AGGREGATES"); expect(html).not.toContain("官方汇总");
    expect(html).not.toContain("14 mapped zones"); expect(html).not.toContain("14 个映射分区");
  });
  it("keeps original source dates and the immutable official source-chart control independent", async () => {
    const data = await fixture(), html = render(data);
    expect(data.totals).toEqual({ fgm: 804, fga: 1596 });
    expect(data.archive).toMatchObject({ fg3m: 401, fg3a: 884, officialControl: { fgm: 805, fga: 1598, fg3m: 402, fg3a: 886 } });
    expect(loadSeasonHeatmapArchive(identity)).toMatchObject({ status: "ready", data: { geometryVersion: "nba-advanced14-svg-v1", status: "verified-aggregate", totals: { fgm: 805, fga: 1598 } } });
    for (const text of ["Archive-wide game dates: 2015-10-27", "2016-04-13", "Original download: 2026-10-03", "Source metadata observed: 2026-10-03", "League reference period: 2015-16", "missing shots are not invented", "explicit SHOT_TYPE"]) expect(html).toContain(text);
    expect(html).toContain("= 1596");
  });
  it("shows classification conflicts outside the court and retains their contribution to totals", async () => {
    // Synthetic transfer tests presentation without asserting an observed Curry conflict.
    const data = await fixture(), row = data.zones[0];
    const conflict = { ...row, id: "classification-conflict" as const, sourceZoneId: "Source classification / explicit shot type conflict", fgm: 1, fga: 1, fg3m: 0, fg3a: 0, fgPct: 1, fgPctDisplay: "100.0", sourceFgPctDisplay: "100.0", attemptShare: 1 / data.totals.fga, attemptShareDisplay: "0.1", leagueAverage: null };
    row.fgm--; row.fga--; row.fgPct = row.fgm / row.fga; row.fgPctDisplay = (100 * row.fgPct).toFixed(1); row.sourceFgPctDisplay = row.fgPctDisplay; row.attemptShare = row.fga / data.totals.fga; row.attemptShareDisplay = (100 * row.attemptShare).toFixed(1);
    data.residuals.push(conflict); data.coverage.normalZoneAttempts--; data.coverage.residualAttempts++;
    const html = render(data), svg = html.match(/<svg[\s\S]*?<\/svg>/)![0];
    expect(svg).not.toContain('data-zone-id="classification-conflict"');
    expect(html).toContain('data-list-zone="classification-conflict"');
    expect(html).toContain("Source classification conflict"); expect(html).toContain("1/1*");
    expect(html).toContain("804 / 1596"); expect(html).toContain("= 1596");
  });
  it.each(["loading", "error", "unavailable"] as const)("keeps %s source-neutral without invented zero counts", status => {
    for (const locale of ["en", "zh"] as const) {
      const html = renderToStaticMarkup(<SeasonHeatmapExplorer player={{ id: identity.playerId, name: "Stephen Curry" }} datasets={[{ ...identity, availability: "available" }]} resources={{ [datasetKey(identity)]: { status } }} locale={locale} publication="verified" />);
      expect(html).toContain('data-season-heatmap="unresolved-archive"');
      expect(html).toContain(locale === "en" ? "SHOT ARCHIVE" : "投篮档案");
      expect(html).not.toContain("OFFICIAL AGGREGATES"); expect(html).not.toContain("官方汇总");
      expect(html).not.toContain("data-zone-id"); expect(html).not.toContain("0 / 0"); expect(html).not.toContain("Official shooting-total control");
    }
  });
});

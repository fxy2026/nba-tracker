import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
import { advanced14Geometry, advanced14DisplayGeometry, seasonHeatmapCourt } from "./season-heatmap-geometry";
import { displayPositions } from "@/components/season-heatmap/season-heatmap-display";
import SeasonHeatmapCourt from "@/components/season-heatmap/SeasonHeatmapCourt";
import { loadSeasonHeatmapArchive } from "./verified-season-heatmap-archive";

function arcEdges(path: string): string[] {
  let current = [0, 0];
  const arcs: string[] = [];
  for (const match of path.matchAll(/([MLHVAZ])([^MLHVAZ]*)/g)) {
    const values = match[2].split(/[ ,]+/).filter(Boolean).map(Number);
    if (match[1] === "M" || match[1] === "L") current = values;
    if (match[1] === "H") current = [values[0], current[1]];
    if (match[1] === "V") current = [current[0], values[0]];
    if (match[1] === "A") {
      const end = values.slice(5);
      arcs.push(`${values[0]}:${[current.join(","), end.join(",")].sort().join("|")}`);
      current = end;
    }
  }
  return arcs;
}
async function mask(pathD: string) {
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="490" viewBox="0 0 600 490"><path d="${pathD}" fill="white"/></svg>`)).ensureAlpha().raw().toBuffer();
}

describe("coherent renderer-only advanced-14 geometry", () => {
  it("retains all 14 evidence identities without replacing immutable source paths", () => {
    expect(advanced14DisplayGeometry.map(g => [g.id, g.sourceZoneId])).toEqual(advanced14Geometry.map(g => [g.id, g.sourceZoneId]));
    expect(advanced14Geometry[0].pathD).toBe("M220,3A96,96,0,1,0,380,3Z");
    expect(advanced14DisplayGeometry.every(g => g.pathD !== advanced14Geometry.find(source => source.id === g.id)?.pathD)).toBe(true);
  });
  it("reuses every internal circular boundary exactly twice with identical endpoints and radii", () => {
    const counts = new Map<string, number>();
    for (const geometry of advanced14DisplayGeometry) for (const edge of arcEdges(geometry.pathD)) counts.set(edge, (counts.get(edge) ?? 0) + 1);
    expect(counts.size).toBe(15);
    expect([...counts.values()].every(count => count === 2)).toBe(true);
  });
  it("covers the full court without gaps or area overlaps, including former strip seams", async () => {
    const masks = await Promise.all(advanced14DisplayGeometry.map(g => mask(g.pathD)));
    let uncovered = 0, overlaps = 0;
    for (let y = 1; y < 489; y++) for (let x = 1; x < 599; x++) {
      const alpha = masks.reduce((sum, pixels) => sum + pixels[(y * 600 + x) * 4 + 3], 0);
      // A few alpha levels of rasterizer antialiasing are allowed at shared edges.
      if (alpha < 240) uncovered++;
      if (alpha > 270) overlaps++;
    }
    expect({ uncovered, overlaps }).toEqual({ uncovered: 0, overlaps: 0 });
  });
  it("places every in-court label anchor inside its actual SVG hit path", async () => {
    for (const geometry of advanced14DisplayGeometry) {
      const [x, y] = displayPositions[geometry.id];
      if (y < 0) continue; // Two deliberately anchored baseline-corner callouts.
      const pixels = await mask(geometry.pathD);
      for (const labelY of [y - 8, y + 16]) expect(pixels[(Math.round(labelY) * 600 + x) * 4 + 3], `${geometry.id} at ${x},${labelY}`).toBe(255);
    }
  });
  it.each(["2025-26", "2015-16"])("preserves official %s counts and all three mode hit regions", season => {
    const result = loadSeasonHeatmapArchive({ playerId: 201939, season, seasonType: "Regular Season" });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Official fixture is unavailable");
    const data = result.data;
    expect(data.totals).toEqual(season === "2025-26" ? { fgm: 374, fga: 799 } : { fgm: 805, fga: 1598 });
    const before = JSON.stringify(data);
    for (const mode of ["reference", "percentage", "volume"] as const) {
      const svg = renderToStaticMarkup(<SeasonHeatmapCourt data={data} mode={mode} locale="zh" selectedId={null} onSelect={() => {}} detailsId="details" />);
      expect(svg).toContain(`viewBox="${seasonHeatmapCourt.viewBox}"`);
      expect((svg.match(/data-zone-fill=/g) ?? []).length).toBe(14);
      for (const geometry of advanced14DisplayGeometry) expect(svg).toContain(`data-zone-fill="${geometry.id}" d="${geometry.pathD}"`);
      expect(svg).not.toMatch(/clipPath|transform=|textLength|lengthAdjust|underpaint/);
    }
    expect(JSON.stringify(data)).toBe(before);
  });
});

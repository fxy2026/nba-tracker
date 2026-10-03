import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { courtBasicDimensions as d, courtBasicGeometry, courtBasicMarkings, courtBasicCornerY } from "./season-heatmap-court-geometry";
import { courtBasic12Zones } from "./season-heatmap-court-zones";

describe("court-aligned twelve-zone display geometry", () => {
  it("uses real NBA half-court proportions and separate source-category IDs", () => {
    expect(d.width / d.unitsPerFoot).toBe(50); expect(d.height / d.unitsPerFoot).toBe(47);
    expect(d.hoopY / d.unitsPerFoot).toBe(5.25); expect(d.freeThrowY / d.unitsPerFoot).toBe(19);
    expect((d.paintRight - d.paintLeft) / d.unitsPerFoot).toBe(16);
    expect(d.restrictedRadius / d.unitsPerFoot).toBe(4); expect(d.threePointRadius / d.unitsPerFoot).toBe(23.75);
    expect((d.hoopX - d.cornerLeft) / d.unitsPerFoot).toBe(22);
    expect(courtBasicGeometry.map(z => z.id)).toEqual(courtBasic12Zones.map(z => z.id));
    expect(d.directionBoundariesVerified).toBe(false);
    expect(courtBasicCornerY).toBeCloseTo(63 + Math.sqrt(285 ** 2 - 264 ** 2), 5);
    expect(courtBasicMarkings.restricted).toBe("M252,48V63A48,48,0,0,0,348,63V48");
  });
  it("partitions the playing surface without opaque overlaps or holes", async () => {
    const masks = await Promise.all(courtBasicGeometry.map(g => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="564"><path d="${g.pathD}" fill="white" fill-rule="evenodd"/></svg>`)).ensureAlpha().raw().toBuffer()));
    let holes = 0, overlaps = 0;
    for (let i = 3; i < masks[0].length; i += 4) {
      const sum = masks.reduce((s, b) => s + b[i], 0);
      if (sum < 245) holes++;
      if (sum > 265) overlaps++;
    }
    // Antialias junctions can vary by a fraction of a pixel; no spatial gaps allowed.
    expect(holes).toBeLessThan(12); expect(overlaps).toBeLessThan(12);
    const hits = (x: number, y: number) => masks.flatMap((m, i) => m[(y * 600 + x) * 4 + 3] > 250 ? [courtBasicGeometry[i].id] : []);
    expect(hits(300, 80)).toEqual(["restricted-area"]);
    expect(hits(300, 30)).toEqual(["paint-non-ra"]);
    expect(hits(300, 160)).toEqual(["paint-non-ra"]);
    expect(hits(300, 240)).toEqual(["midrange-center"]);
    expect(hits(300, 360)).toEqual(["above-break-three-center"]);
    expect(hits(18, 63)).toEqual(["corner-three-left"]);
    expect(hits(582, 63)).toEqual(["corner-three-right"]);
  });
});

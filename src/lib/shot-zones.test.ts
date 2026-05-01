import { describe, it, expect } from "vitest";
import { classifyShotZone, aggregateZoneStats, getZoneColor } from "./shot-zones";
import type { ShotZone } from "./shot-zones";

describe("classifyShotZone", () => {
  it("classifies a layup as Restricted Area", () => {
    expect(classifyShotZone({ x: 6, y: 50, shotDistance: 1 })).toBe("Restricted Area");
  });

  it("classifies a 3-foot shot as Restricted Area", () => {
    expect(classifyShotZone({ x: 8, y: 48, shotDistance: 3 })).toBe("Restricted Area");
  });

  it("classifies a 10-foot shot in the paint as Paint", () => {
    expect(classifyShotZone({ x: 12, y: 50, shotDistance: 10 })).toBe("Paint");
  });

  it("classifies a shot at the FT line as Paint", () => {
    expect(classifyShotZone({ x: 20, y: 50, shotDistance: 14 })).toBe("Paint");
  });

  it("classifies a shot outside paint left as Mid-Range (Left)", () => {
    // High angle to the left, between paint and 3pt
    expect(classifyShotZone({ x: 8, y: 22, shotDistance: 17 })).toBe("Mid-Range (Left)");
  });

  it("classifies a shot outside paint right as Mid-Range (Right)", () => {
    expect(classifyShotZone({ x: 8, y: 78, shotDistance: 17 })).toBe("Mid-Range (Right)");
  });

  it("classifies a shot at the elbow as Mid-Range (Center)", () => {
    // Moderate angle, between paint and 3pt
    expect(classifyShotZone({ x: 22, y: 50, shotDistance: 16 })).toBe("Mid-Range (Center)");
  });

  it("classifies a left corner 3 as Corner 3 (Left)", () => {
    expect(classifyShotZone({ x: 6, y: 6, shotDistance: 23 })).toBe("Corner 3 (Left)");
  });

  it("classifies a right corner 3 as Corner 3 (Right)", () => {
    expect(classifyShotZone({ x: 6, y: 94, shotDistance: 23 })).toBe("Corner 3 (Right)");
  });

  it("classifies a left wing 3 as Above Break 3 (Left)", () => {
    expect(classifyShotZone({ x: 22, y: 5, shotDistance: 26 })).toBe("Above Break 3 (Left)");
  });

  it("classifies a top-of-key 3 as Above Break 3 (Center)", () => {
    expect(classifyShotZone({ x: 32, y: 50, shotDistance: 25 })).toBe("Above Break 3 (Center)");
  });

  it("classifies a right wing 3 as Above Break 3 (Right)", () => {
    expect(classifyShotZone({ x: 22, y: 95, shotDistance: 26 })).toBe("Above Break 3 (Right)");
  });

  it("uses distance calculation when shotDistance is 0", () => {
    expect(classifyShotZone({ x: 6, y: 50, shotDistance: 0 })).toBe("Restricted Area");
  });
});

describe("aggregateZoneStats", () => {
  const makeShot = (zone: ShotZone, made: boolean) => {
    const coords: Record<string, { x: number; y: number; shotDistance: number }> = {
      "Restricted Area": { x: 6, y: 50, shotDistance: 2 },
      "Paint": { x: 12, y: 50, shotDistance: 10 },
      "Mid-Range (Center)": { x: 22, y: 50, shotDistance: 15 },
      "Above Break 3 (Center)": { x: 32, y: 50, shotDistance: 25 },
      "Corner 3 (Left)": { x: 6, y: 6, shotDistance: 23 },
    };
    const c = coords[zone] || coords["Restricted Area"];
    return { ...c, shotResult: made ? "Made" : "Missed" };
  };

  it("returns stats for each zone that has shots", () => {
    const shots = [
      makeShot("Restricted Area", true),
      makeShot("Restricted Area", true),
      makeShot("Restricted Area", false),
      makeShot("Above Break 3 (Center)", true),
      makeShot("Above Break 3 (Center)", false),
      makeShot("Above Break 3 (Center)", false),
    ];
    const stats = aggregateZoneStats(shots);
    const ra = stats.find((s) => s.zone === "Restricted Area");
    const three = stats.find((s) => s.zone === "Above Break 3 (Center)");

    expect(ra).toBeDefined();
    expect(ra!.made).toBe(2);
    expect(ra!.total).toBe(3);
    expect(ra!.pct).toBeCloseTo(66.67, 1);

    expect(three).toBeDefined();
    expect(three!.made).toBe(1);
    expect(three!.total).toBe(3);
    expect(three!.pct).toBeCloseTo(33.33, 1);
  });

  it("omits zones with zero shots", () => {
    const shots = [makeShot("Restricted Area", true)];
    const stats = aggregateZoneStats(shots);
    expect(stats.length).toBe(1);
    expect(stats[0].zone).toBe("Restricted Area");
  });

  it("returns empty array for no shots", () => {
    expect(aggregateZoneStats([])).toEqual([]);
  });
});

describe("getZoneColor", () => {
  it("returns red-ish color when well above league average", () => {
    const color = getZoneColor(65, 45);
    const match = color.match(/rgb\((\d+),(\d+),(\d+)\)/);
    expect(match).not.toBeNull();
    const [, r, , b] = match!.map(Number);
    expect(r).toBeGreaterThan(b);
  });

  it("returns blue-ish color when well below league average", () => {
    const color = getZoneColor(25, 45);
    const match = color.match(/rgb\((\d+),(\d+),(\d+)\)/);
    expect(match).not.toBeNull();
    const [, r, , b] = match!.map(Number);
    expect(b).toBeGreaterThan(r);
  });

  it("returns orange-ish color when near league average", () => {
    const color = getZoneColor(45, 45);
    const match = color.match(/rgb\((\d+),(\d+),(\d+)\)/);
    expect(match).not.toBeNull();
    const [, r, g, b] = match!.map(Number);
    expect(r).toBeGreaterThan(b);
    expect(g).toBeGreaterThan(b);
  });

  it("hot color is different from cold color", () => {
    const hot = getZoneColor(70, 45);
    const cold = getZoneColor(20, 45);
    expect(hot).not.toBe(cold);
  });
});

import { describe, it, expect } from "vitest";
import { classifyShotZone, aggregateZoneStats, getZoneColor } from "./shot-zones";
import type { ShotZone } from "./shot-zones";

describe("classifyShotZone", () => {
  // NBA court: basket at ~(5.59, 50) in percentage coords
  // x = 0-100 along 94ft length, y = 0-100 along 50ft width

  it("classifies a layup at the rim as Restricted Area", () => {
    expect(classifyShotZone({ x: 6, y: 50, shotDistance: 1 })).toBe("Restricted Area");
  });

  it("classifies a 3-foot shot as Restricted Area", () => {
    expect(classifyShotZone({ x: 8, y: 48, shotDistance: 3 })).toBe("Restricted Area");
  });

  it("classifies a 10-foot left-side shot as Paint (Left)", () => {
    expect(classifyShotZone({ x: 12, y: 35, shotDistance: 10 })).toBe("Paint (Left)");
  });

  it("classifies a 10-foot right-side shot as Paint (Right)", () => {
    expect(classifyShotZone({ x: 12, y: 65, shotDistance: 10 })).toBe("Paint (Right)");
  });

  it("classifies a 17-foot left baseline shot as Mid-Range (Left)", () => {
    // High angle, left side, between paint and 3pt line
    expect(classifyShotZone({ x: 8, y: 22, shotDistance: 17 })).toBe("Mid-Range (Left)");
  });

  it("classifies an 18-foot elbow shot as Mid-Range (Left Center)", () => {
    expect(classifyShotZone({ x: 20, y: 30, shotDistance: 18 })).toBe("Mid-Range (Left Center)");
  });

  it("classifies a 15-foot free-throw area shot as Mid-Range (Center)", () => {
    expect(classifyShotZone({ x: 22, y: 50, shotDistance: 15 })).toBe("Mid-Range (Center)");
  });

  it("classifies a left corner 3 as Corner 3 (Left)", () => {
    // Corner 3: close to baseline (x near basket), far from center (y near sideline), > 22ft
    expect(classifyShotZone({ x: 6, y: 6, shotDistance: 23 })).toBe("Corner 3 (Left)");
  });

  it("classifies a right corner 3 as Corner 3 (Right)", () => {
    expect(classifyShotZone({ x: 6, y: 94, shotDistance: 23 })).toBe("Corner 3 (Right)");
  });

  it("classifies a left wing 3 as Above Break 3 (Left)", () => {
    // Wing shot: past baseline (x far from basket), extreme sideline (y near 0)
    // angle needs to be >= 72° → y must be far from center
    // x=22 → baselineDist=15.4ft > 14 (not corner), angle ~51° ≥ 45° → Left
    expect(classifyShotZone({ x: 22, y: 5, shotDistance: 26 })).toBe("Above Break 3 (Left)");
  });

  it("classifies a top-of-key 3 as Above Break 3 (Center)", () => {
    expect(classifyShotZone({ x: 32, y: 50, shotDistance: 25 })).toBe("Above Break 3 (Center)");
  });

  it("classifies a right wing 3 as Above Break 3 (Right)", () => {
    expect(classifyShotZone({ x: 22, y: 95, shotDistance: 26 })).toBe("Above Break 3 (Right)");
  });

  it("uses distance calculation when shotDistance is 0", () => {
    // At basket, should be Restricted Area even with shotDistance=0
    expect(classifyShotZone({ x: 6, y: 50, shotDistance: 0 })).toBe("Restricted Area");
  });
});

describe("aggregateZoneStats", () => {
  const makeShot = (zone: ShotZone, made: boolean) => {
    // Map zones to rough coordinates
    const coords: Record<string, { x: number; y: number; shotDistance: number }> = {
      "Restricted Area": { x: 6, y: 50, shotDistance: 2 },
      "Paint (Left)": { x: 12, y: 35, shotDistance: 10 },
      "Mid-Range (Center)": { x: 22, y: 50, shotDistance: 15 },
      "Above Break 3 (Center)": { x: 32, y: 50, shotDistance: 25 },
      "Corner 3 (Left)": { x: 6, y: 6, shotDistance: 23 },
    };
    const c = coords[zone] || coords["Restricted Area"];
    return {
      ...c,
      shotResult: made ? "Made" as const : "Missed" as const,
      actionType: c.shotDistance > 22 ? "3pt" as const : "2pt" as const,
      personId: 1, teamTricode: "LAL", period: 1,
      description: "", subType: "",
    };
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
  it("returns hot color when pct is well above league average", () => {
    const color = getZoneColor(60, 45);
    // Should be a reddish/hot tone
    expect(color).toMatch(/^#|^rgb/);
  });

  it("returns cold color when pct is well below league average", () => {
    const color = getZoneColor(25, 45);
    expect(color).toMatch(/^#|^rgb/);
  });

  it("returns neutral color when pct equals league average", () => {
    const color = getZoneColor(45, 45);
    expect(color).toMatch(/^#|^rgb/);
  });

  it("hot color is different from cold color", () => {
    const hot = getZoneColor(70, 45);
    const cold = getZoneColor(20, 45);
    expect(hot).not.toBe(cold);
  });
});

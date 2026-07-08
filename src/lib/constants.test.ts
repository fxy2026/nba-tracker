import { describe, it, expect } from "vitest";
import { currentSeason, CURRENT_SEASON } from "./constants";

describe("currentSeason", () => {
  it("returns 2025-26 on the last day of September 2026 (UTC)", () => {
    expect(currentSeason(new Date("2026-09-30T23:59:59Z"))).toBe("2025-26");
  });

  it("rolls over to 2026-27 on October 1, 2026 (UTC)", () => {
    expect(currentSeason(new Date("2026-10-01T00:00:00Z"))).toBe("2026-27");
  });

  it("returns the in-progress season in January", () => {
    expect(currentSeason(new Date("2026-01-15T12:00:00Z"))).toBe("2025-26");
  });

  it("returns the in-progress season in June (playoffs window)", () => {
    expect(currentSeason(new Date("2026-06-15T12:00:00Z"))).toBe("2025-26");
  });

  it("returns the just-finished season in July (offseason)", () => {
    expect(currentSeason(new Date("2026-07-08T12:00:00Z"))).toBe("2025-26");
  });

  it("pads the ending year to two digits", () => {
    expect(currentSeason(new Date("2029-11-01T00:00:00Z"))).toBe("2029-30");
  });

  it("CURRENT_SEASON is derived and formatted YYYY-YY", () => {
    expect(CURRENT_SEASON).toBe(currentSeason());
    expect(CURRENT_SEASON).toMatch(/^\d{4}-\d{2}$/);
  });
});

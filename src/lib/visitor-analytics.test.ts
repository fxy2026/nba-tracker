import { describe, expect, it } from "vitest";
import { ANALYTICS_PATH_KEYS, analyticsDay, analyticsRange, normalizeAnalyticsPath } from "./visitor-analytics";

describe("privacy-safe finite analytics routes", () => {
  it.each(["/admin", "/api/admin", "/_next/static/app.js", "/offline", "/secret", "/search?q=private", "/#private", "https://example.test/", "//example.test/", "/player/%31", "/player/12\\34", "/news\n", "/" + "x".repeat(200)])("rejects %s", value => expect(normalizeAnalyticsPath(value)).toBeNull());
  it.each([["/", "/"], ["/news/", "/news"], ["/player/201939", "/player/[id]"], ["/player/201939/gamelog", "/player/[id]/gamelog"], ["/game/0042500405", "/game/[id]"], ["/team/LAL", "/team/[tricode]"]])("normalizes %s", (value, expected) => expect(normalizeAnalyticsPath(value)).toBe(expected));
  it("every key is bounded/idempotent, no raw identifiers needed", () => {
    expect(new Set(ANALYTICS_PATH_KEYS).size).toBe(ANALYTICS_PATH_KEYS.length);
    for (const key of ANALYTICS_PATH_KEYS) expect(normalizeAnalyticsPath(key)).toBe(key);
  });
});
it("Shanghai midnight and inclusive ranges are exact", () => {
  expect(analyticsDay(new Date("2026-10-04T15:59:59Z"))).toBe("2026-10-04");
  expect(analyticsDay(new Date("2026-10-04T16:00:00Z"))).toBe("2026-10-05");
  expect(analyticsRange(7, new Date("2026-10-04T16:00:00Z"))).toEqual({ days: 7, from: "2026-09-29", to: "2026-10-05" });
  expect(analyticsRange(30, new Date("2026-03-01T00:00:00Z"))).toEqual({ days: 30, from: "2026-01-31", to: "2026-03-01" });
});

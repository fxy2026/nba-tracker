import { describe, expect, it } from "vitest";
import { formatDate, getGameStatusDisplay, getPlayerHeadshotUrl, parseMinutes, toBeijingTime } from "./nba-display";

describe("client-safe NBA presentation compatibility", () => {
  it.each([
    ["2026-01-01T04:59:59Z", "2025-12-31"],
    ["2026-01-01T05:00:00Z", "2026-01-01"],
    ["2026-07-01T03:59:59Z", "2026-06-30"],
    ["2026-07-01T04:00:00Z", "2026-07-01"],
    ["2026-03-08T06:59:59Z", "2026-03-08"],
    ["2026-03-08T07:00:00Z", "2026-03-08"],
  ])("keeps the NBA Eastern date for %s", (utc, date) => expect(formatDate(new Date(utc))).toBe(date));
  it("preserves Beijing display locale, date rollover and blank input", () => {
    expect(toBeijingTime("2026-03-13T23:30:00Z")).toBe("3/14 07:30");
    expect(toBeijingTime("")).toBe("");
  });
  it.each([["", "-"], ["PT00M00.00S", "-"], ["PT33M50.90S", "33:50"], ["PT3M5.00S", "3:05"], ["12:34", "12:34"]])("preserves minutes formatting %s", (input, output) => expect(parseMinutes(input)).toBe(output));
  it.each([[3, "Final/OT", "Final"], [2, " Q4 2:00 ", "Q4 2:00"], [2, "", "Live"], [1, " ", "Scheduled"], [1, "TBD", "TBD"]])("preserves game status %s/%s", (status, text, expected) => expect(getGameStatusDisplay(status, text)).toBe(expected));
  it("preserves exact player headshot URLs", () => {
    expect(getPlayerHeadshotUrl(1631105)).toBe("https://cdn.nba.com/headshots/nba/latest/1040x760/1631105.png");
    expect(getPlayerHeadshotUrl(0)).toBe("https://cdn.nba.com/headshots/nba/latest/1040x760/0.png");
  });
  it("preserves the existing api.ts exports for server callers", async () => {
    const api = await import("./api");
    expect(api.formatDate).toBe(formatDate); expect(api.toBeijingTime).toBe(toBeijingTime);
    expect(api.parseMinutes).toBe(parseMinutes); expect(api.getGameStatusDisplay).toBe(getGameStatusDisplay);
    expect(api.getPlayerHeadshotUrl).toBe(getPlayerHeadshotUrl);
  });
});

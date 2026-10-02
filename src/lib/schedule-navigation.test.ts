import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getScheduleDayView, selectedDateFromUrl } from "./schedule-navigation";
import type { ScheduleDate, ScheduleGame } from "./api";
import ScheduleEmptyNavigation from "@/components/ScheduleEmptyNavigation";
const now = Date.parse("2026-10-02T12:00:00Z");
function game(gameId: string, utc: string, status = 3, extra = {}): ScheduleGame {
  return { gameId, gameDateTimeUTC: utc, gameStatus: status, gameStatusText: status === 3 ? "Final" : "7:00 PM ET", gameCode: "", homeTeam: {}, awayTeam: {}, ...extra } as ScheduleGame;
}
const schedule = (games: ScheduleGame[]): ScheduleDate[] => [{ gameDate: "unused", games }];
const final = game("9401810012", "2026-06-14T00:30:00Z");

describe("one-pass schedule navigation", () => {
  it.each([["America/New_York", "2026-06-13"], ["Asia/Shanghai", "2026-06-14"], ["Pacific/Kiritimati", "2026-06-14"]])("preserves synthetic history in %s", (tz, date) => {
    const view = getScheduleDayView(schedule([final, final]), date, tz, now);
    expect(view.games).toEqual([final]);
    expect(view.navigation).toEqual({ availableFrom: date, availableThrough: date, latestFinalDate: date, nextScheduledDate: null });
  });
  it("preserves first duplicate ID and includes known preseason/Cup games", () => {
    const preseason = game("0012600001", "2026-10-03T23:00:00Z", 1);
    const cup = game("0062600001", "2026-12-15T23:00:00Z", 1);
    const view = getScheduleDayView(schedule([final, { ...final, gameStatus: 1 }, preseason, cup]), "2026-10-04", "Asia/Shanghai", now);
    expect(view.games).toEqual([preseason]);
    expect(view.navigation.nextScheduledDate).toBe("2026-10-04");
    expect(view.navigation.availableThrough).toBe("2026-12-16");
  });
  it("does not invent upcoming games from past scheduled or TBD/conditional placeholders", () => {
    const games = [final, game("old", "2026-01-01T00:00:00Z", 1), game("conditional", "2026-10-03T00:00:00Z", 1, { ifNecessary: true, gameStatusText: "TBD" }), game("tbd", "2026-10-04T00:00:00Z", 1, { gameStatusText: "TBD" }), game("maybe", "2026-10-05T00:00:00Z", 1, { ifNecessary: true })];
    expect(getScheduleDayView(schedule(games), "2026-10-02", "UTC", now).navigation.nextScheduledDate).toBeNull();
  });
  it("skips invalid and timezone-less timestamps without losing a later valid duplicate", () => {
    const view = getScheduleDayView(schedule([game(final.gameId, "bad"), game("empty", ""), game("ambiguous", "2026-06-14T00:30:00"), final]), "2026-06-14", "UTC", now);
    expect(view.games).toEqual([final]);
    expect(view.navigation.availableFrom).toBe("2026-06-14");
  });
  it("never calls an in-progress or future-dated result the latest final", () => {
    const view = getScheduleDayView(schedule([final, game("live", "2026-10-02T11:00:00Z", 2), game("future", "2026-10-03T00:00:00Z", 3)]), "2026-10-02", "UTC", now);
    expect(view.navigation.latestFinalDate).toBe("2026-06-14");
  });
  it.each([
    ["2026-01-01T00:30:00Z", "America/New_York", "2025-12-31"],
    ["2026-03-08T06:59:00Z", "America/New_York", "2026-03-08"],
    ["2026-03-08T07:01:00Z", "America/New_York", "2026-03-08"],
    ["2026-01-31T12:30:00Z", "Pacific/Kiritimati", "2026-02-01"],
  ])("handles local date boundaries for %s", (utc, tz, expected) => {
    expect(getScheduleDayView(schedule([game("sample", utc)]), expected, tz, now).games).toHaveLength(1);
  });
  it("returns unknown coverage for an empty source", () => {
    expect(getScheduleDayView([], "2026-10-02", "UTC", now).navigation).toEqual({ availableFrom: null, availableThrough: null, latestFinalDate: null, nextScheduledDate: null });
  });
});

describe("coverage-aware empty state", () => {
  const navigation = getScheduleDayView(schedule([final]), "2026-10-02", "UTC", now).navigation;
  it("links available history and never invents a next game", () => {
    const html = renderToStaticMarkup(createElement(ScheduleEmptyNavigation, { date: "2026-10-02", navigation, isZh: false }));
    expect(html).toContain("Schedule data unavailable");
    expect(html).toContain('/?date=2026-06-14');
    expect(html).toContain("Latest available results");
    expect(html).not.toContain("Next known");
  });
  it("shows a known next date and bilingual attribution", () => {
    const html = renderToStaticMarkup(createElement(ScheduleEmptyNavigation, { date: "2026-10-02", navigation: { ...navigation, nextScheduledDate: "2026-10-04" }, isZh: true }));
    expect(html).toContain('/?date=2026-10-04');
    expect(html).toContain("下一场已知赛程");
  });
  it("renders no stale links when metadata is cleared", () => {
    const html = renderToStaticMarkup(createElement(ScheduleEmptyNavigation, { date: "2026-10-02", navigation: null, isZh: false }));
    expect(html).not.toContain('href=');
  });
});

it("resolves explicit, Back/Forward and bare Home dates without reusing stale state", () => {
  const today = "2026-10-02";
  expect(["2026-06-14", "2026-10-04", "2026-06-14", null].map((date) => selectedDateFromUrl(date, today))).toEqual(["2026-06-14", "2026-10-04", "2026-06-14", today]);
  expect(selectedDateFromUrl("2026-02-31", today)).toBe(today);
  expect(selectedDateFromUrl("bad", today)).toBe(today);
});

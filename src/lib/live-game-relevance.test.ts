import { expect, it } from "vitest";
import { hasRecentLiveGame } from "./live-game-relevance";

const game = (gameDateTimeUTC: string, gameStatus = 2) => ({ gameDateTimeUTC, gameStatus });
const now = new Date("2026-03-02T05:10:00Z");

it.each(["2026-03-02T02:30:00Z", "2026-03-02T05:05:00Z", "2026-03-02T10:30:00+08:00"])("accepts ET today/yesterday independently of the timestamp's offset (%s)", tipoff => {
  expect(hasRecentLiveGame([game(tipoff)], now)).toBe(true);
});

it.each(["2026-03-01T04:59:59Z", "2026-03-03T01:00:00Z", "", "invalid", "2026-03-02T02:30:00"])("rejects old, future or unqualified/unknown timestamps (%s)", tipoff => {
  expect(hasRecentLiveGame([game(tipoff)], now)).toBe(false);
});

it.each([1, 3])("never treats status %s as live", status => {
  expect(hasRecentLiveGame([game("2026-03-02T02:30:00Z", status)], now)).toBe(false);
});

it("handles mixed and empty lists", () => {
  expect(hasRecentLiveGame([], now)).toBe(false);
  expect(hasRecentLiveGame([game("invalid"), game("2026-03-02T02:30:00Z")], now)).toBe(true);
});

it.each([
  ["2026-03-09T04:10:00Z", "2026-03-08T05:00:00Z", "2026-03-08T04:59:59Z"],
  ["2026-11-02T05:10:00Z", "2026-11-01T04:00:00Z", "2026-11-01T03:59:59Z"],
])("uses the previous ET calendar date across DST (%s)", (clock, yesterdayStart, older) => {
  expect(hasRecentLiveGame([game(yesterdayStart)], new Date(clock))).toBe(true);
  expect(hasRecentLiveGame([game(older)], new Date(clock))).toBe(false);
});

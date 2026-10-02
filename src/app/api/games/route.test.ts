import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { getFullSchedule, getGamesByDate, getTodayScoreboard } = vi.hoisted(() => ({ getFullSchedule: vi.fn(), getGamesByDate: vi.fn(), getTodayScoreboard: vi.fn() }));
vi.mock("@/lib/api", () => ({ getFullSchedule, getGamesByDate, getTodayScoreboard, formatDate: () => "2026-10-02" }));
import { GET } from "./route";
const game = { gameId: "9401810012", gameStatus: 3, gameStatusText: "Final", gameDateTimeUTC: "2026-06-14T00:30:00Z", homeTeam: {}, awayTeam: {} };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-02T12:00:00Z")); vi.clearAllMocks(); getFullSchedule.mockResolvedValue([{ gameDate: "", games: [game] }]); getGamesByDate.mockResolvedValue([]); getTodayScoreboard.mockResolvedValue([]); });
afterEach(() => vi.useRealTimers());
it("adds empty-state navigation with exactly one existing schedule read", async () => {
  const response = await GET(new NextRequest("https://example.test/api/games?date=2026-10-03&tz=Asia/Shanghai"));
  expect(await response.json()).toMatchObject({ data: [], navigation: { latestFinalDate: "2026-06-14", nextScheduledDate: null } });
  expect(getFullSchedule).toHaveBeenCalledTimes(1);
  expect(getGamesByDate).not.toHaveBeenCalled();
  expect(response.headers.get("Cache-Control")).toContain("s-maxage=300");
});
it("keeps nonempty response compatible and preserves synthetic IDs", async () => {
  const response = await GET(new NextRequest("https://example.test/api/games?date=2026-06-13&tz=America/New_York"));
  expect(await response.json()).toEqual({ data: [game] });
});
it("does not add schedule work for callers without timezone", async () => {
  const response = await GET(new NextRequest("https://example.test/api/games?date=2026-06-13"));
  expect(await response.json()).toEqual({ data: [] });
  expect(getFullSchedule).not.toHaveBeenCalled();
});
it("does not cache failures or fabricate navigation", async () => {
  getFullSchedule.mockRejectedValue(new Error("offline"));
  const response = await GET(new NextRequest("https://example.test/api/games?date=2026-06-13&tz=UTC"));
  expect(response.status).toBe(500);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).not.toHaveProperty("navigation");
});

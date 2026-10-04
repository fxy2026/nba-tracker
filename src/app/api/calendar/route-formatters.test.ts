import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { ScheduleDate } from "@/lib/api";
vi.mock("server-only", () => ({}));
const source = vi.hoisted(() => ({ schedule: vi.fn<() => Promise<ScheduleDate[]>>() }));
vi.mock("@/lib/api", async original => ({ ...await original<typeof import("@/lib/api")>(), getFullSchedule: source.schedule }));
import { GET } from "./route";
beforeEach(() => { vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }); source.schedule.mockReset(); });
const NativeDateTimeFormat = Intl.DateTimeFormat;
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });
const team = { teamId: 1, teamTricode: "BOS", teamCity: "Boston", teamName: "Celtics", teamSlug: "", score: 10, wins: 0, losses: 0, seed: 0 };
const dates = (utc: string[]): ScheduleDate[] => [{ gameDate: "03/08/2026 00:00:00", games: utc.map((gameDateTimeUTC, i) => ({ gameId: `002260000${i}`, gameDateTimeUTC, gameCode: "test", gameStatus: 3, gameStatusText: "Final", homeTeam: team, awayTeam: { ...team, teamTricode: "LAL" } })) }];
it.each([
  ["America/New_York", "2026-03", ["2026-03-08T04:59:00Z", "2026-03-08T05:00:00Z", "2026-03-08T06:59:00Z", "2026-03-08T07:00:00Z"], [["2026-03-07", 1], ["2026-03-08", 3]]],
  ["America/New_York", "2026-11", ["2026-11-01T03:59:00Z", "2026-11-01T04:00:00Z", "2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z"], [["2026-11-01", 3]]],
  ["Asia/Shanghai", "2026-03", ["2026-03-07T15:59:00Z", "2026-03-07T16:00:00Z"], [["2026-03-07", 1], ["2026-03-08", 1]]],
  ["Pacific/Auckland", "2026-04", ["2026-04-04T10:59:00Z", "2026-04-04T11:00:00Z", "2026-04-04T13:59:00Z", "2026-04-04T14:01:00Z"], [["2026-04-04", 1], ["2026-04-05", 3]]],
] as const)("groups actual nonempty calendar rows across day/DST boundaries in %s, %s", async (tz, month, utc, expected) => {
  source.schedule.mockResolvedValue(dates([...utc]));
  const constructor = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (...args: Parameters<typeof Intl.DateTimeFormat>) { return new NativeDateTimeFormat(...args); });
  const response = await GET(new NextRequest(`https://example.test/api/calendar?month=${month}&tz=${encodeURIComponent(tz)}`));
  expect(response.status).toBe(200); const body = await response.json();
  expect(body.data.map((day: { date: string; gameCount: number }) => [day.date, day.gameCount])).toEqual(expected);
  expect(source.schedule).toHaveBeenCalledTimes(1);
  expect(constructor.mock.calls.length).toBeLessThanOrEqual(3); // zone validation, recorded rows, optional planned snapshot
  expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=600, stale-while-revalidate=1200");
});
it("rejects invalid timezone before loading the schedule", async () => {
  const response = await GET(new NextRequest("https://example.test/api/calendar?month=2026-03&tz=Invalid%2FZone"));
  expect(response.status).toBe(400); expect(await response.json()).toEqual({ error: "Invalid timezone" });
  expect(source.schedule).not.toHaveBeenCalled();
});

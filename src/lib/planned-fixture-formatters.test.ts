import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getPlannedFixtureView, getPlannedSeasonFixtures } from "./planned-fixtures-server";
import { normalizePlannedFixtureView, PLANNED_SEASON, PLANNED_SNAPSHOT_DATE } from "./planned-fixtures";
const NativeDateTimeFormat = Intl.DateTimeFormat;
afterEach(() => { vi.restoreAllMocks(); });
it.each(["America/New_York", "Asia/Shanghai", "Pacific/Auckland"])("uses one formatter for complete planned selection and one for validation (%s)", timeZone => {
  const constructor = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (...args: Parameters<typeof Intl.DateTimeFormat>) { return new NativeDateTimeFormat(...args); });
  const query = { mode: "month" as const, month: "2026-11", timeZone };
  const view = getPlannedFixtureView(query, [], null);
  expect(view.state).toBe("snapshot"); expect(view.fixtures.length).toBeGreaterThan(0);
  expect(constructor).toHaveBeenCalledTimes(1);
  expect(normalizePlannedFixtureView(view, query)).toBe(view);
  expect(constructor).toHaveBeenCalledTimes(2);
});
it("does not construct a formatter on canonical, outside-snapshot, fully filtered or empty-validation branches", () => {
  const constructor = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (...args: Parameters<typeof Intl.DateTimeFormat>) { return new NativeDateTimeFormat(...args); });
  const query = { mode: "day" as const, date: "2026-10-27", timeZone: "Invalid/Zone" };
  expect(getPlannedFixtureView(query, [], null, true).state).toBe("canonical");
  expect(getPlannedFixtureView({ ...query, date: "2025-10-27" }, [], null).state).toBe("outside-snapshot");
  const dates = [...new Set(getPlannedSeasonFixtures(PLANNED_SEASON, [], null)!.map(f => f.dateET))];
  expect(getPlannedFixtureView(query, [], null, false, dates).fixtures).toEqual([]);
  expect(getPlannedFixtureView({ ...query, team: "ZZZ" }, [], null).fixtures).toEqual([]);
  const empty = { state: "snapshot", snapshotDate: PLANNED_SNAPSHOT_DATE, season: PLANNED_SEASON, timeZone: query.timeZone, fixtures: [], nextAvailableDate: null };
  expect(normalizePlannedFixtureView(empty, query)).toBe(empty);
  expect(constructor).not.toHaveBeenCalled();
});

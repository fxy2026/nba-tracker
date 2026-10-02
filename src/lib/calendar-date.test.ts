import { afterEach, describe, expect, it } from "vitest";
import { offsetCalendarDate, calendarDateLabels } from "./calendar-date";
const originalTz = process.env.TZ;
afterEach(() => { if (originalTz === undefined) delete process.env.TZ; else process.env.TZ = originalTz; });
describe.each(["Pacific/Kiritimati", "Etc/GMT+12", "America/New_York", "UTC"])("date-only arithmetic in %s", (tz) => {
  it("keeps keys and labels independent of local instant conversion", () => {
    process.env.TZ = tz;
    expect(offsetCalendarDate("2026-10-02", 0)).toBe("2026-10-02");
    expect(offsetCalendarDate("2026-10-02", -1)).toBe("2026-10-01");
    expect(offsetCalendarDate("2026-10-02", 1)).toBe("2026-10-03");
    expect(calendarDateLabels("2026-10-02", "en-US")).toEqual({ label: "10/2", weekday: "Fri" });
  });
  it("crosses month/year/leap-day/DST boundaries without skipped or repeated dates", () => {
    process.env.TZ = tz;
    expect(offsetCalendarDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(offsetCalendarDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(offsetCalendarDate("2028-02-28", 1)).toBe("2028-02-29");
    expect(offsetCalendarDate("2028-02-29", 1)).toBe("2028-03-01");
    expect(offsetCalendarDate("2026-03-08", 1)).toBe("2026-03-09");
    expect(offsetCalendarDate("2026-11-01", 1)).toBe("2026-11-02");
  });
});
it("rejects invalid date keys rather than silently rolling them to another month", () => {
  expect(() => offsetCalendarDate("2026-02-31", 1)).toThrow(RangeError);
});

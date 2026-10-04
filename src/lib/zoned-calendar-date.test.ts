import { afterEach, expect, it, vi } from "vitest";
import { createZonedCalendarDate } from "./zoned-calendar-date";
import { fixtureDateInZone } from "./planned-fixtures";
const NativeDateTimeFormat = Intl.DateTimeFormat;
afterEach(() => { vi.restoreAllMocks(); });
it.each([
  ["America/New_York", "2026-03-08T04:59:00Z", "2026-03-07"],
  ["America/New_York", "2026-03-08T05:00:00Z", "2026-03-08"],
  ["America/New_York", "2026-03-08T06:59:00Z", "2026-03-08"],
  ["America/New_York", "2026-03-08T07:00:00Z", "2026-03-08"],
  ["America/New_York", "2026-11-01T03:59:00Z", "2026-10-31"],
  ["America/New_York", "2026-11-01T04:00:00Z", "2026-11-01"],
  ["America/New_York", "2026-11-01T05:30:00Z", "2026-11-01"],
  ["America/New_York", "2026-11-01T06:30:00Z", "2026-11-01"],
  ["Asia/Shanghai", "2026-03-07T15:59:00Z", "2026-03-07"],
  ["Asia/Shanghai", "2026-03-07T16:00:00Z", "2026-03-08"],
  ["Pacific/Auckland", "2026-04-04T10:59:00Z", "2026-04-04"],
  ["Pacific/Auckland", "2026-04-04T11:00:00Z", "2026-04-05"],
  ["Pacific/Auckland", "2026-04-04T13:59:00Z", "2026-04-05"],
  ["Pacific/Auckland", "2026-04-04T14:01:00Z", "2026-04-05"],
])("preserves calendar day for %s at %s", (zone, utc, expected) => {
  expect(createZonedCalendarDate(zone)(utc)).toBe(expected);
  expect(fixtureDateInZone(utc, zone)).toBe(expected);
});
it("creates lazily, reuses within one operation and never shares mutable formatter state between operations", () => {
  const constructor = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (...args: Parameters<typeof Intl.DateTimeFormat>) { return new NativeDateTimeFormat(...args); });
  const et = createZonedCalendarDate("America/New_York"), shanghai = createZonedCalendarDate("Asia/Shanghai"), nextEt = createZonedCalendarDate("America/New_York");
  expect(constructor).not.toHaveBeenCalled();
  const utc = "2026-03-08T04:59:00Z";
  for (let i = 0; i < 10; i++) { expect(et(utc)).toBe("2026-03-07"); expect(shanghai(utc)).toBe("2026-03-08"); }
  expect(constructor).toHaveBeenCalledTimes(2);
  expect(nextEt(utc)).toBe("2026-03-07"); expect(constructor).toHaveBeenCalledTimes(3);
});
it("preserves invalid zone and invalid instant failures only when formatting is attempted", () => {
  let format!: (utc: string) => string;
  expect(() => { format = createZonedCalendarDate("Invalid/Zone"); }).not.toThrow();
  expect(() => format("2026-03-08T04:59:00Z")).toThrow(RangeError);
  expect(() => createZonedCalendarDate("UTC")("not-a-date")).toThrow(RangeError);
});

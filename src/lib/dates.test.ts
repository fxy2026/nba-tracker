import { describe, it, expect } from "vitest";
import { formatGameDate, formatRelative } from "./dates";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatGameDate", () => {
  const d = new Date(Date.UTC(2026, 0, 15)); // Jan 15 2026 (UTC)
  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  };

  it("maps 'zh' to the zh-CN locale tag", () => {
    expect(formatGameDate(d, "zh", opts)).toBe(d.toLocaleDateString("zh-CN", opts));
  });

  it("maps 'en' to the en-US locale tag", () => {
    expect(formatGameDate(d, "en", opts)).toBe(d.toLocaleDateString("en-US", opts));
  });

  it("maps any non-'zh' locale to en-US", () => {
    expect(formatGameDate(d, "fr", opts)).toBe(d.toLocaleDateString("en-US", opts));
  });

  it("accepts an ISO string as well as a Date", () => {
    expect(formatGameDate("2026-01-15T00:00:00Z", "en", opts)).toBe(
      d.toLocaleDateString("en-US", opts)
    );
  });

  it("returns '' for an invalid date string", () => {
    expect(formatGameDate("not-a-date", "en")).toBe("");
    expect(formatGameDate("", "zh")).toBe("");
  });

  it("uses {year, month:short, day} as the default option set", () => {
    expect(formatGameDate(d, "en")).toBe(
      d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    );
  });
});

describe("formatRelative — 'ago' variant (NewsFeed)", () => {
  it("floors sub-minute elapsed to 1 minute", () => {
    expect(formatRelative(0, "en", "ago")).toBe("1m ago");
    expect(formatRelative(0, "zh", "ago")).toBe("1 分钟前");
    expect(formatRelative(20_000, "en", "ago")).toBe("1m ago");
  });

  it("formats minutes", () => {
    expect(formatRelative(5 * MIN, "en", "ago")).toBe("5m ago");
    expect(formatRelative(5 * MIN, "zh", "ago")).toBe("5 分钟前");
  });

  it("formats hours (rounded up the ladder)", () => {
    expect(formatRelative(3 * HOUR, "en", "ago")).toBe("3h ago");
    expect(formatRelative(3 * HOUR, "zh", "ago")).toBe("3 小时前");
  });

  it("formats days", () => {
    expect(formatRelative(3 * DAY, "en", "ago")).toBe("3d ago");
    expect(formatRelative(3 * DAY, "zh", "ago")).toBe("3 天前");
  });

  it("returns '' beyond 7 days so the caller can show an absolute date", () => {
    expect(formatRelative(10 * DAY, "en", "ago")).toBe("");
    expect(formatRelative(10 * DAY, "zh", "ago")).toBe("");
  });
});

describe("formatRelative — 'freshness' variant (UpdatedPill)", () => {
  it("shows 'just now' under a minute", () => {
    expect(formatRelative(30_000, "en", "freshness")).toBe("Just now");
    expect(formatRelative(30_000, "zh", "freshness")).toBe("刚刚更新");
  });

  it("floors minutes", () => {
    expect(formatRelative(5 * MIN + 59_000, "en", "freshness")).toBe("5m ago");
    expect(formatRelative(5 * MIN, "zh", "freshness")).toBe("5 分钟前");
  });

  it("floors hours", () => {
    expect(formatRelative(3 * HOUR + 59 * MIN, "en", "freshness")).toBe("3h ago");
    expect(formatRelative(3 * HOUR, "zh", "freshness")).toBe("3 小时前");
  });

  it("shows 'stale' beyond a day", () => {
    expect(formatRelative(2 * DAY, "en", "freshness")).toBe("Stale");
    expect(formatRelative(2 * DAY, "zh", "freshness")).toBe("数据较旧");
  });
});

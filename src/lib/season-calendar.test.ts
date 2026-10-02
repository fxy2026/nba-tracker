import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getTranslations } from "@/locales";
import { getRegularSeasonProgress } from "./season-calendar";
import SeasonProgress from "@/components/SeasonProgress";
const state = vi.hoisted(() => ({ locale: "en" as "en" | "zh" }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: state.locale, t: getTranslations(state.locale) }) }));
afterEach(() => vi.useRealTimers());
const at = (iso: string) => getRegularSeasonProgress(new Date(iso));

describe("season-bound published regular calendar", () => {
  it("shows the2026-27 regular season as upcoming0%, not last season's100%", () => {
    expect(at("2026-10-02T12:00:00Z")).toMatchObject({ season: "2026-27", phase: "upcoming", progress: 0, daysLeft: 18, calendar: { start: "2026-10-20", end: "2027-04-11" } });
  });
  it("rolls season identity without reusing the previous season's boundaries", () => {
    expect(at("2026-09-30T23:59:59Z")).toMatchObject({ season: "2025-26", phase: "complete", progress: 100 });
    expect(at("2026-10-01T00:00:00Z")).toMatchObject({ season: "2026-27", phase: "upcoming", progress: 0 });
  });
  it("uses Eastern calendar start/end boundaries and includes the last scheduled day", () => {
    expect(at("2026-10-20T03:59:59Z").phase).toBe("upcoming");
    expect(at("2026-10-20T04:00:00Z")).toMatchObject({ phase: "regular", progress: 0 });
    expect(at("2027-04-12T03:59:59Z")).toMatchObject({ phase: "regular", daysLeft: 1 });
    expect(at("2027-04-12T03:59:59Z").progress).toBeLessThan(100);
    expect(at("2027-04-12T04:00:00Z")).toMatchObject({ phase: "complete", progress: 100, daysLeft: 0 });
  });
  it("does not guess a future schedule or playoffs finish", () => {
    expect(at("2027-10-02T12:00:00Z")).toEqual({ season: "2027-28", calendar: null, phase: "unknown", progress: null, daysLeft: null });
    expect(at("2027-06-01T12:00:00Z").phase).toBe("complete"); // only the regular calendar is complete
  });
  it.each(["2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z"])("keeps progress stable during the repeated Eastern DST hour %s", (iso) => {
    expect(at(iso).progress).toBe(at("2026-11-01T12:00:00Z").progress);
  });
});

it.each(["en", "zh"] as const)("renders scoped progress and source attribution in %s", (locale) => {
  state.locale = locale; vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
  const html = renderToStaticMarkup(createElement(SeasonProgress));
  expect(html).toContain("2026-27"); expect(html).toContain('aria-valuenow="0"');
  expect(html).not.toContain("100%"); expect(html).not.toContain("2025-10-21");
  expect(html).toContain("https://pr.nba.com/2026-27-nba-regular-season-schedule/");
  expect(html).toContain(locale === "zh" ? "常规赛日程" : "Regular-season calendar");
  const text = html.replace(/<[^>]+>/g, "");
  expect(text).toContain(locale === "zh" ? "18天后开赛" : "18 days until start");
  expect(text).not.toContain("18天后结束");
});
it("renders unknown future dates without a fake percentage or progressbar", () => {
  state.locale = "en"; vi.useFakeTimers(); vi.setSystemTime(new Date("2027-10-02T12:00:00Z"));
  const html = renderToStaticMarkup(createElement(SeasonProgress));
  expect(html).toContain("Schedule dates unconfirmed");
  expect(html).not.toContain('role="progressbar"'); expect(html).not.toContain("100%");
});

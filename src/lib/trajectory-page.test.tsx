import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getTranslations } from "@/locales";
const { current, recorded, locale } = vi.hoisted(() => ({ current: vi.fn(), recorded: vi.fn(), locale: vi.fn() }));
vi.mock("@/lib/api", async importOriginal => {
  const api = await importOriginal<typeof import("./api")>();
  return { ...api, getCurrentSeasonSchedule: current, getRecorded2025SeasonSchedule: recorded, getScheduleAge: () => 1000 };
});
vi.mock("@/lib/locale", () => ({ getLocale: locale }));
const clientLocale = vi.hoisted(() => ({ value: "en" }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: clientLocale.value, t: getTranslations(clientLocale.value as "en" | "zh") }) }));
vi.mock("next/dynamic", () => ({ default: () => (props: unknown) => createElement("div", { "data-chart": JSON.stringify(props) }) }));
import Page from "@/app/lab/team-trajectory/page";
async function render(season?: string | string[]) { return renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ season }) })); }
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-03T12:00:00Z"));
  vi.clearAllMocks(); locale.mockResolvedValue("en"); clientLocale.value = "en"; current.mockResolvedValue([]);
  const api = await vi.importActual<typeof import("./api")>("./api"); recorded.mockImplementation(api.getRecorded2025SeasonSchedule);
});
afterEach(() => vi.useRealTimers());
it("keeps current default empty, offers archive, and hides chart instructions", async () => {
  const html = await render(); expect(html).toContain("2026-27"); expect(html).toContain("No data yet");
  expect(html).toContain("?season=2025-26"); expect(html).toContain("min-h-11"); expect(html).toContain("Schedule cache loaded");
  expect(html).not.toContain("How to use"); expect(html).not.toContain("data-chart");
  expect(current).toHaveBeenCalledWith("2026-27"); expect(recorded).not.toHaveBeenCalled();
});
it.each(["en", "zh"])("renders explicit archive with source, actual coverage and return link in %s", async language => {
  locale.mockResolvedValue(language); clientLocale.value = language; const html = await render("2025-26");
  expect(html).toContain("1,230"); expect(html).toContain("82"); expect(html).toContain("2025-10-21"); expect(html).toContain("2026-04-13");
  expect(html).toContain('href="/lab/team-trajectory"'); expect(html).toContain('aria-current="page"'); expect(html).toContain("data-chart");
  expect(html).toContain("<details"); expect(html).not.toContain("<details open"); expect(html).not.toContain("Schedule cache loaded"); expect(html).not.toContain("赛程缓存载入于");
  expect(html).toContain(language === "en" ? "not live or recently verified" : "并非实时或近期核验");
  expect(html).toContain(language === "en" ? "How to use" : "使用说明");
  expect(current).not.toHaveBeenCalled(); expect(recorded).toHaveBeenCalledOnce();
});
it.each(["2024-25", ["2025-26", "2025-26"]])("shows honest current fallback for %j", async value => {
  const html = await render(value); expect(html).toContain("Invalid or repeated"); expect(html).toContain("No data yet"); expect(recorded).not.toHaveBeenCalled();
});

it.each(["en", "zh"])("labels a warm current empty schedule as cache age in %s", async language => {
  locale.mockResolvedValue(language); clientLocale.value = language;
  const html = await render();
  expect(html).toContain(language === "zh" ? "赛程缓存载入于 刚刚" : "Schedule cache loaded just now");
  expect(html).not.toContain("刚刚更新");
  expect(html).not.toContain('title="Data freshness"');
  expect(html).toContain(language === "zh" ? "并非 NBA 来源的更新时间" : "not when the NBA source was updated");
});

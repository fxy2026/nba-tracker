import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getTranslations } from "@/locales";
const { current, recorded, locale, age } = vi.hoisted(() => ({ current: vi.fn(), recorded: vi.fn(), locale: vi.fn(), age: vi.fn() }));
vi.mock("@/lib/api", async original => ({ ...await original<typeof import("./api")>(), getCurrentSeasonSchedule: current, getRecorded2025SeasonSchedule: recorded, getScheduleAge: age }));
vi.mock("@/lib/locale", () => ({ getLocale: locale }));
const client = vi.hoisted(() => ({ locale: "en" as "en" | "zh" }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: client.locale, t: getTranslations(client.locale) }) }));
vi.mock("@/components/ToastProvider", () => ({ useToast: () => ({ toast: vi.fn() }) }));
import Page, { generateMetadata } from "@/app/standings/page";
async function render(season?: string | string[]) { return renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ season }) })); }
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-04T12:00:00Z")); vi.clearAllMocks();
  locale.mockResolvedValue("en"); client.locale = "en"; current.mockResolvedValue([]); age.mockReturnValue(1000);
  const api = await vi.importActual<typeof import("./api")>("./api"); recorded.mockImplementation(api.getRecorded2025SeasonSchedule);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it.each(["en", "zh"] as const)("renders recorded mobile disclosures and desktop tables without live claims or calls in %s", async language => {
  locale.mockResolvedValue(language); client.locale = language;
  const fetch = vi.fn(() => { throw new Error("No provider calls for archive"); }); vi.stubGlobal("fetch", fetch);
  const html = await render("2025-26");
  const teamHeader = language === "zh" ? "球队" : "Team";
  const mobileHeaders = [...html.matchAll(/<div aria-hidden="true"[^>]*><span>([^<]*)<\/span>/g)];
  const desktopHeaders = [...html.matchAll(/<thead><tr[^>]*><th[^>]*>([^<]*)<\/th>/g)];
  const divisionHeaders = [...html.matchAll(/<span class="w-5">#<\/span><span>([^<]*)<\/span>/g)];
  expect(mobileHeaders.map(match => match[1])).toEqual(Array(2).fill(teamHeader));
  expect(desktopHeaders.map(match => match[1])).toEqual(Array(2).fill(teamHeader));
  expect(divisionHeaders.map(match => match[1])).toEqual(Array(6).fill(teamHeader));
  const eastLabel = language === "zh" ? "东部每队平均胜场" : "East wins per team";
  const westLabel = language === "zh" ? "西部每队平均胜场" : "West wins per team";
  expect(html).toMatch(new RegExp(`>${eastLabel}</p><p[^>]*>40\\.6</p>`));
  expect(html).toMatch(new RegExp(`>${westLabel}</p><p[^>]*>41\\.4</p>`));
  if (language === "zh") expect(html).toContain("30 支球队");
  expect(html).toContain("2025-26"); expect(html).toContain("1,230"); expect(html).toContain("82");
  expect(html).toContain('href="/standings"'); expect(html).toContain('aria-current="page"'); expect(html).toContain("min-h-11");
  expect(html).toMatch(language === "en" ? /local/i : /本地/);
  expect(html).toContain(language === "en" ? "not live or recently verified" : "并非实时或近期核验");
  expect(html).toContain(language === "en" ? "official NBA tiebreakers are not applied" : "未应用 NBA 官方同胜率排名规则");
  expect(html).toContain(language === "en" ? "not physical venues" : "并非实际比赛场馆");
  expect(html).toContain("40–42");
  expect(html).toContain(language === "en" ? "their own current data" : "各自页面的当前数据");
  expect(html).toContain(language === "en" ? "not current form" : "并非近期状态");
  const source = html.match(/<details>([\s\S]*?)<\/details>/)![1];
  expect(source).toContain(language === "en" ? "Source and standings notes" : "数据来源与排名说明");
  expect(source).toContain(language === "en" ? "not live or recently verified" : "并非实时或近期核验");
  expect(html).not.toMatch(/Schedule cache loaded|赛程缓存载入于|Data freshness|刚刚更新/);
  const details = [...html.matchAll(/<details\b[^>]*data-team="([A-Z]+)"[^>]*>([\s\S]*?)<\/details>/g)];
  expect(details).toHaveLength(30); expect(new Set(details.map(d => d[1])).size).toBe(30);
  for (const detail of details) {
    expect(detail[0]).not.toMatch(/<details\b[^>]*\bopen(?:\s|=|>)/);
    const summary = detail[2].match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/)![1];
    expect(detail[2].match(/<summary\b[^>]*>/)![0]).toContain("min-h-11");
    expect(detail[2].match(/<summary\b[^>]*>/)![0]).toContain("focus-visible:outline");
    expect(summary).not.toMatch(/<a\b|<button\b/); expect(summary).toContain(detail[1]);
    expect(detail[2]).toContain(`href="/team/${detail[1]}"`);
    expect(detail[2]).toContain(language === "en" ? "Home" : "主场");
    expect(detail[2]).toContain(language === "en" ? "Road" : "客场");
  }
  expect(html.match(/<table\b/g)).toHaveLength(2);
  const bodies = [...html.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)];
  expect(bodies).toHaveLength(2);
  for (const body of bodies) expect(body[1].match(/<tr\b/g)).toHaveLength(15);
  expect(html).toContain("grid grid-cols-1 sm:grid-cols-2");
  expect(html).toContain("hidden md:block overflow-x-auto table-scroll-x");
  expect(html).not.toMatch(/border-l-accent|border-b-accent|border-b-accent-amber/);
  expect(html).not.toContain(getTranslations(language).standingsPage.top6Hint);
  expect(html.match(/<details\b/g)?.length).toBeGreaterThan(30);
  expect(html).not.toMatch(/>P<|>PI<|>★|Playoff \(1-6\)|Play-In \(7-10\)/);
  expect(current).not.toHaveBeenCalled(); expect(age).not.toHaveBeenCalled(); expect(recorded).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled();
});
it.each(["", "2024-25", "2026-26", ["2025-26"], ["2025-26", "2026-27"]])("keeps malformed season %j on current empty state", async value => {
  const html = await render(value);
  expect(html).toContain("Invalid or repeated"); expect(html).toContain("No usable completed regular-season records are available for 2026-27.");
  expect(html).not.toMatch(/<table\b|data-team=/); expect(current).toHaveBeenCalledExactlyOnceWith("2026-27"); expect(recorded).not.toHaveBeenCalled();
});
it("explicit current uses current schedule and keeps the archive escape", async () => {
  const html = await render("2026-27"); expect(html).toContain("?season=2025-26"); expect(html).not.toContain("Invalid or repeated");
  expect(current).toHaveBeenCalledExactlyOnceWith("2026-27"); expect(recorded).not.toHaveBeenCalled();
});

it.each(["en", "zh"] as const)("qualifies current position highlights with official results in empty and populated %s views", async language => {
  locale.mockResolvedValue(language); client.locale = language;
  const caveat = language === "zh" ? "各联盟前六名位置高亮提示 · 最终季后赛资格以官方结果为准" : "Top six positions per conference highlighted · playoff qualification is subject to official results";
  const empty = await render("2026-27");
  expect(empty).toContain(caveat);
  expect(empty).not.toContain(getTranslations(language).standingsPage.top6Hint);
  const api = await vi.importActual<typeof import("./api")>("./api");
  current.mockResolvedValue(api.getRecorded2025SeasonSchedule());
  const populated = await render("2026-27");
  expect(populated).toContain(caveat);
  expect(populated).not.toContain(getTranslations(language).standingsPage.top6Hint);
  expect(populated).toMatch(/>P</); expect(populated).toMatch(/>PI</);
  expect(recorded).not.toHaveBeenCalled();
});

it.each(["en", "zh"] as const)("keeps metadata tied to selected season and archive source in %s", async language => {
  locale.mockResolvedValue(language);
  const archive = await generateMetadata({ searchParams: Promise.resolve({ season: "2025-26" }) });
  expect(archive.title).toContain("2025-26"); expect(archive.description).toContain("2025-26");
  expect(archive.description).toContain(language === "en" ? "local finals" : "本地终场");
  expect(archive.description).toContain(language === "en" ? "official NBA tiebreakers" : "官方同胜率排名规则");
  const currentMetadata = await generateMetadata({});
  expect(currentMetadata.title).toContain("2026-27"); expect(currentMetadata.description).toContain("2026-27");
  const invalid = await generateMetadata({ searchParams: Promise.resolve({ season: ["2025-26", "2026-27"] }) });
  expect(invalid).toEqual(currentMetadata);
});
it.each(["en", "zh"] as const)("keeps archive-empty season escape above empty state without current calls in %s", async language => {
  locale.mockResolvedValue(language); client.locale = language; recorded.mockReturnValue([]);
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const html = await render("2025-26");
  const empty = language === "en" ? "No usable completed regular-season records are available for 2025-26." : "当前没有可用于计算 2025-26 赛季排名的已结束常规赛记录。";
  expect(html).toContain(empty); expect(html).toContain('href="/standings"');
  expect(html.indexOf('href="/standings"')).toBeLessThan(html.indexOf(empty));
  expect(html).not.toMatch(/<table\b|data-team=|Schedule cache loaded|赛程缓存载入于/);
  expect(recorded).toHaveBeenCalledOnce(); expect(current).not.toHaveBeenCalled(); expect(age).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});

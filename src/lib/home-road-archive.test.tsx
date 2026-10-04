import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getTranslations } from "@/locales";
import { trajectoryCoverage, trajectoryFinals } from "./trajectory-season";
import { computeHomeRoadSplits, formatHomeRoadDifference } from "./home-road-splits";
const { current, recorded, locale, age } = vi.hoisted(() => ({ current: vi.fn(), recorded: vi.fn(), locale: vi.fn(), age: vi.fn() }));
vi.mock("@/lib/api", async importOriginal => ({
  ...await importOriginal<typeof import("./api")>(),
  getCurrentSeasonSchedule: current, getRecorded2025SeasonSchedule: recorded, getScheduleAge: age,
}));
vi.mock("@/lib/locale", () => ({ getLocale: locale }));
const clientLocale = vi.hoisted(() => ({ value: "en" }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: clientLocale.value, t: getTranslations(clientLocale.value as "en" | "zh") }) }));
import Page, { generateMetadata } from "@/app/home-vs-road/page";
async function render(season?: string | string[]) { return renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ season }) })); }
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-04T12:00:00Z")); vi.clearAllMocks();
  locale.mockResolvedValue("en"); clientLocale.value = "en"; current.mockResolvedValue([]); age.mockReturnValue(1000);
  const api = await vi.importActual<typeof import("./api")>("./api"); recorded.mockImplementation(api.getRecorded2025SeasonSchedule);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it.each(["en", "zh"])("preserves a current empty page and 44px season escape in %s", async language => {
  locale.mockResolvedValue(language); clientLocale.value = language;
  const html = await render(); expect(html).toContain("2026-27"); expect(html).toContain("?season=2025-26");
  expect(html).toContain(language === "en" ? "No data" : "暂无数据");
  expect(html).toContain("min-h-11"); expect(current).toHaveBeenCalledOnce(); expect(current).toHaveBeenCalledWith();
  expect(recorded).not.toHaveBeenCalled(); expect(age).toHaveBeenCalledOnce();
  expect(html).toContain(language === "en" ? "Schedule cache loaded just now" : "赛程缓存载入于 刚刚");
  expect(html).not.toContain("刚刚更新"); expect(html).not.toContain('title="Data freshness"');
});
it.each(["en", "zh"])("renders recorded splits and honest limits without live calls in %s", async language => {
  locale.mockResolvedValue(language); clientLocale.value = language; const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const html = await render("2025-26");
  expect(html).toContain("1,230"); expect(html).toContain("30"); expect(html).toContain("82"); expect(html).toContain("40–42");
  expect(html).toContain(language === "en" ? "not physical venues" : "并非实际比赛场馆");
  expect(html).toContain(language === "en" ? "not live or recently verified" : "并非实时或近期核验");
  expect(html).toContain(language === "en" ? "their own current data" : "各自页面的当前数据");
  expect(html).toContain(language === "en" ? "percentage points" : "百分点");
  expect(html).toContain("<details>"); expect(html).not.toContain("<details open"); expect(html).toContain("text-xs leading-relaxed break-words");
  expect(html).toContain('href="/home-vs-road"'); expect(html).toContain('aria-current="page"');
  expect(html).not.toContain("Schedule cache loaded"); expect(html).not.toContain("赛程缓存载入于");
  if (language === "zh") { expect(html).not.toContain("at home"); expect(html).not.toContain("on road"); expect(html).not.toContain("Home "); expect(html).not.toContain("Road "); }
  expect(current).not.toHaveBeenCalled(); expect(age).not.toHaveBeenCalled(); expect(recorded).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled();
});
it.each(["", "2024-25", "2026-26", ["2025-26"], ["2025-26", "2026-27"]])("keeps malformed or repeated %j current", async season => {
  const html = await render(season); expect(html).toContain("Invalid or repeated"); expect(html).toContain("No data");
  expect(current).toHaveBeenCalledOnce(); expect(recorded).not.toHaveBeenCalled();
});
it("keeps explicit current selection and unchanged aggregation with actual unequal denominators", async () => {
  const api = await vi.importActual<typeof import("./api")>("./api");
  const sample = api.getRecorded2025SeasonSchedule()[0].games[0];
  const game = (id: string, hs: number, as: number, reverse = false, status = 3) => ({
    ...sample, gameId: id, gameStatus: status,
    homeTeam: { ...(reverse ? sample.awayTeam : sample.homeTeam), score: hs },
    awayTeam: { ...(reverse ? sample.homeTeam : sample.awayTeam), score: as },
  });
  const schedule = [{ gameDate: "10/21/2026", games: [
    game("0022600001", 110, 100), game("0022600002", 90, 100), game("0022600003", 110, 100, true),
    game("0022600004", 100, 90, false, 1), game("0042600001", 100, 90),
  ] }];
  const rows = computeHomeRoadSplits(schedule); const row = rows.find(r => r.tricode === sample.homeTeam.teamTricode)!;
  expect(row).toMatchObject({ homeW: 1, homeL: 1, roadW: 0, roadL: 1, homePct: 0.5, roadPct: 0, diff: 0.5 });
  expect(rows.find(r => r.tricode === sample.awayTeam.teamTricode)).toMatchObject({ homeW: 1, homeL: 0, roadW: 1, roadL: 1, diff: 0.5 });
  current.mockResolvedValue(schedule); const html = await render("2026-27");
  expect(html).toContain("50.0%"); expect(html).toContain("+50.0 pp"); expect(html).not.toContain("Invalid or repeated");
  expect(current).toHaveBeenCalledWith(); expect(recorded).not.toHaveBeenCalled();
});
it("proves all 30 team records, conservation, variable side counts, filtering and local immutability", async () => {
  const api = await vi.importActual<typeof import("./api")>("./api");
  const fetch = vi.fn(() => { throw new Error("Unexpected upstream"); }); vi.stubGlobal("fetch", fetch);
  const cacheAge = api.getScheduleAge(); const raw = api.getRecorded2025SeasonSchedule(); const before = JSON.stringify(raw);
  const finals = trajectoryFinals(raw, "2025-26"), games = finals.flatMap(d => d.games), rows = computeHomeRoadSplits(finals);
  expect(trajectoryCoverage(finals)).toMatchObject({ finals: 1230, teams: 30, min: 82, max: 82 });
  expect(new Set(games.map(g => g.gameId)).size).toBe(1230); expect(rows).toHaveLength(30);
  const sides: number[] = [];
  for (const row of rows) {
    const home = games.filter(g => g.homeTeam.teamTricode === row.tricode), road = games.filter(g => g.awayTeam.teamTricode === row.tricode);
    const hw = home.filter(g => g.homeTeam.score > g.awayTeam.score).length;
    const rw = road.filter(g => g.awayTeam.score > g.homeTeam.score).length;
    expect(row.homeW).toBe(hw); expect(row.homeL).toBe(home.length - hw);
    expect(row.roadW).toBe(rw); expect(row.roadL).toBe(road.length - rw);
    expect(home.length + road.length).toBe(82); expect(row.homePct).toBe(hw / home.length); expect(row.roadPct).toBe(rw / road.length);
    expect(row.diff).toBe(hw / home.length - rw / road.length);
    expect(home.length).toBeGreaterThanOrEqual(40); expect(home.length).toBeLessThanOrEqual(42);
    expect(road.length).toBeGreaterThanOrEqual(40); expect(road.length).toBeLessThanOrEqual(42); sides.push(home.length, road.length);
  }
  expect(Math.min(...sides)).toBe(40); expect(Math.max(...sides)).toBe(42);
  const total = (key: "homeW" | "homeL" | "roadW" | "roadL") => rows.reduce((s, r) => s + r[key], 0);
  expect(total("homeW")).toBe(total("roadL")); expect(total("homeL")).toBe(total("roadW"));
  expect(total("homeW") + total("roadW")).toBe(1230); expect(total("homeL") + total("roadL")).toBe(1230);
  const sample = games[0]; const mixed = [...raw, { gameDate: "10/21/2026", games: [
    { ...sample, gameId: "0022600001" }, { ...sample, gameId: "0022509998", gameStatus: 1 },
    { ...sample, gameId: "0022509997", gameStatus: 2 }, { ...sample, gameId: "0012509999" },
    { ...sample, gameId: "0062509999" }, { ...sample, gameId: "0042509999" },
    { ...sample, gameId: "0052509999" }, { ...sample, gameId: "0022509996", awayTeam: { ...sample.awayTeam, teamTricode: "EXH" } },
  ] }];
  expect(computeHomeRoadSplits(trajectoryFinals(mixed, "2025-26"))).toEqual(rows);
  expect(JSON.stringify(raw)).toBe(before); expect(api.getScheduleAge()).toBe(cacheAge); expect(fetch).not.toHaveBeenCalled();
});
it.each([[0.125, "+12.5 pp"], [-0.125, "-12.5 pp"], [0, "0.0 pp"], [-0.00001, "0.0 pp"]])("formats signed percentage-point difference %s", (diff, expected) => {
  expect(formatHomeRoadDifference(diff as number)).toBe(expected);
  expect(formatHomeRoadDifference(diff as number, true)).toBe((expected as string).replace("pp", "百分点"));
});
it.each(["en", "zh"])("keeps metadata source and season explicit in %s", async language => {
  locale.mockResolvedValue(language);
  const metadata = await generateMetadata({ searchParams: Promise.resolve({ season: "2025-26" }) });
  expect(metadata.description).toContain("2025-26"); expect(metadata.description).toContain(language === "en" ? "local regular-season finals" : "本地常规赛终场");
});

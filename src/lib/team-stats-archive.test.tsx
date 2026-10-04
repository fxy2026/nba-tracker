import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getTranslations } from "@/locales";
import { trajectoryFinals } from "./trajectory-season";
import { computeStandingsRows } from "./standings-splits";
import { buildScheduleBoards } from "./team-stat-board";
const { current, recorded, locale, effects } = vi.hoisted(() => ({ current: vi.fn(), recorded: vi.fn(), locale: vi.fn(), effects: [] as (() => unknown)[] }));
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(), useEffect: (effect: () => unknown) => { effects.push(effect); } }));
vi.mock("@/lib/api", async importOriginal => {
  const api = await importOriginal<typeof import("./api")>();
  return { ...api, getCurrentSeasonSchedule: current, getRecorded2025SeasonSchedule: recorded, getScheduleAge: () => 1000 };
});
vi.mock("@/lib/locale", () => ({ getLocale: locale }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: "en", t: getTranslations("en") }) }));
import Page, { generateMetadata } from "@/app/team-stats/page";
import Boards from "@/app/team-stats/TeamStatBoards";
async function render(season?: string | string[]) { return renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ season }) })); }
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
  vi.clearAllMocks(); effects.length = 0; locale.mockResolvedValue("en"); current.mockResolvedValue([]);
  const api = await vi.importActual<typeof import("./api")>("./api"); recorded.mockImplementation(api.getRecorded2025SeasonSchedule);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("keeps current default and its empty state, with an accessible archive escape", async () => {
  const html = await render(); expect(html).toContain("2026-27"); expect(html).toContain("No data yet");
  expect(html).toContain("?season=2025-26"); expect(html).toContain("min-h-11");
  expect(current).toHaveBeenCalledOnce(); expect(current).toHaveBeenCalledWith(); expect(recorded).not.toHaveBeenCalled();
});
it.each(["en", "zh"])("shows honest recorded coverage and source limits in %s", async language => {
  locale.mockResolvedValue(language); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const html = await render("2025-26"); effects.forEach(effect => effect());
  expect(html).toContain("1,230"); expect(html).toContain("30"); expect(html).toContain("82");
  expect(html).toContain('href="/team-stats"'); expect(html).toContain('aria-current="page"');
  expect(html).toContain(language === "en" ? "not live or recently verified" : "并非实时或近期核验");
  expect(html).toContain(language === "en" ? "Final scores cannot provide" : "存档比分无法计算");
  expect(html).toContain("<details>"); expect(html).not.toContain("<details open");
  expect(html).not.toContain("Cache loaded"); expect(html).not.toContain("11 categories");
  expect((html.match(/aria-pressed=/g) ?? [])).toHaveLength(3);
  expect(current).not.toHaveBeenCalled(); expect(recorded).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled();
});
it.each(["", "2024-25", "2026-26", ["2025-26"], ["2025-26", "2026-27"]])("falls back to current for malformed %j", async value => {
  const html = await render(value); expect(html).toContain("Invalid or repeated"); expect(html).toContain("No data yet"); expect(recorded).not.toHaveBeenCalled(); expect(current).toHaveBeenCalledOnce();
});
it("retains eleven current categories and the original current-season upstream request", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 }); vi.stubGlobal("fetch", fetch);
  const html = renderToStaticMarkup(createElement(Boards, { scheduleBoards: { PTS: [], OPP_PTS: [], NET: [] } }));
  effects.forEach(effect => effect());
  expect((html.match(/aria-pressed=/g) ?? [])).toHaveLength(11); expect(fetch).toHaveBeenCalledOnce();
  const query = new URL(fetch.mock.calls[0][0], "https://local.test").searchParams;
  expect(query.get("Season")).toBe("2026-27"); expect(query.get("SeasonType")).toBe("Regular Season");
  expect(query.get("endpoint")).toBe("leaguedashteamstats");
});
it("derives all three boards exactly from immutable local finals, without network or cache writes", async () => {
  const api = await vi.importActual<typeof import("./api")>("./api");
  const fetch = vi.fn(() => { throw new Error("Unexpected upstream"); }); vi.stubGlobal("fetch", fetch);
  const age = api.getScheduleAge(); const raw = api.getRecorded2025SeasonSchedule(); const before = JSON.stringify(raw);
  const games = trajectoryFinals(raw, "2025-26").flatMap(day => day.games);
  const boards = buildScheduleBoards(computeStandingsRows(trajectoryFinals(raw, "2025-26")));
  expect(Object.keys(boards)).toEqual(["PTS", "OPP_PTS", "NET"]); expect(games).toHaveLength(1230);
  for (const row of boards.PTS) {
    const played = games.filter(g => [g.homeTeam.teamTricode, g.awayTeam.teamTricode].includes(row.tricode));
    const points = played.reduce((sum, g) => sum + (g.homeTeam.teamTricode === row.tricode ? g.homeTeam.score : g.awayTeam.score), 0);
    const allowed = played.reduce((sum, g) => sum + (g.homeTeam.teamTricode === row.tricode ? g.awayTeam.score : g.homeTeam.score), 0);
    expect(played).toHaveLength(82); expect(row.value).toBe(points / 82);
    expect(boards.OPP_PTS.find(r => r.tricode === row.tricode)?.value).toBe(allowed / 82);
    expect(boards.NET.find(r => r.tricode === row.tricode)?.value).toBe(points / 82 - allowed / 82);
  }
  for (const key of ["PTS", "OPP_PTS", "NET"] as const) {
    expect(boards[key]).toHaveLength(30);
    expect(boards[key].every((row, i, rows) => i === 0 || (key === "OPP_PTS" ? rows[i - 1].value <= row.value : rows[i - 1].value >= row.value))).toBe(true);
  }
  expect(JSON.stringify(raw)).toBe(before); expect(api.getScheduleAge()).toBe(age); expect(fetch).not.toHaveBeenCalled();
});

it("keeps recorded metadata season- and source-specific", async () => {
  const metadata = await generateMetadata({ searchParams: Promise.resolve({ season: "2025-26" }) });
  expect(metadata.description).toContain("2025-26 recorded"); expect(metadata.description).not.toContain("FG%");
});

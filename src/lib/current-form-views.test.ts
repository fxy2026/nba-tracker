import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { scheduleForSeason } from "./games";
import { getTranslations } from "@/locales";
import type { ScheduleDate, ScheduleGame } from "./api";
const { current, full, locale } = vi.hoisted(() => ({ current: vi.fn(), full: vi.fn(), locale: vi.fn() }));
vi.mock("@/lib/api", () => ({ getCurrentSeasonSchedule: current, getFullSchedule: full, getScheduleAge: () => null, formatDate: () => "2026-11-25" }));
vi.mock("@/lib/locale", () => ({ getLocale: locale }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: "en", t: getTranslations("en") }) }));
vi.mock("next/dynamic", () => ({ default: () => (props: unknown) => createElement("div", { "data-trajectory": JSON.stringify(props) }) }));
function day(date: string, id: string, status = 3, reverse = false): ScheduleDate {
  const team = { teamName: "", teamCity: "", teamSlug: "", wins: 0, losses: 0, seed: 0 };
  const home = { ...team, teamId: 1610612738, teamTricode: "BOS", score: 100 };
  const away = { ...team, teamId: 1610612752, teamTricode: "NYK", score: 90 };
  const game = { gameId: id, gameStatus: status, gameStatusText: "Final", gameCode: "", gameDateTimeUTC: `${date}T12:00:00Z`, homeTeam: reverse ? away : home, awayTeam: reverse ? home : away } as ScheduleGame;
  return { gameDate: `${date.slice(5,7)}/${date.slice(8,10)}/${date.slice(0,4)} 00:00:00`, games: [game] };
}
const archive = Array.from({ length: 10 }, (_, n) => day(`2026-01-${String(n+1).padStart(2,"0")}`, `00225000${String(n).padStart(2,"0")}`));
const first = [day("2026-11-10", "0022600001")];
const games = Array.from({ length: 8 }, (_, n) => day(`2026-11-${10+n}`, `00226000${String(n).padStart(2,"0")}`, 3, n % 2 === 0));
const pages = [
  ["momentum", () => import("@/app/momentum/page"), /No data/],
  ["streaks", () => import("@/app/streaks/page"), /No streak data/],
  ["back-to-back", () => import("@/app/back-to-back/page"), /No B2Bs detected/],
  ["h2h", () => import("@/app/h2h/page"), /No completed matchup data/],
  ["rivalries", () => import("@/app/rivalries/page"), /No data/],
  ["schedule-heatmap", () => import("@/app/schedule-heatmap/page"), /No schedule data/],
  ["trajectory", () => import("@/app/lab/team-trajectory/page"), /No data yet/],
] as const;
async function render(load: typeof pages[number][1], data: ScheduleDate[]) {
  current.mockResolvedValue(scheduleForSeason(data, "2026-27"));
  const { default: Page } = await load();
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ t1: "BOS", t2: "NYK" }) }));
}
beforeEach(() => { current.mockReset(); full.mockReset(); full.mockImplementation(() => { throw new Error("Unscoped schedule consumer"); }); locale.mockResolvedValue("en"); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-25T12:00:00Z")); });
afterEach(() => vi.useRealTimers());
for (const [name, load, empty] of pages) describe(name, () => {
  it("does not reuse archive-only results as current data", async () => {
    const html = await render(load, archive); expect(html).toMatch(empty); expect(html).not.toContain('/game/00225'); expect(current).toHaveBeenCalledOnce(); expect(full).not.toHaveBeenCalled();
  });
  it("keeps the first current game without filling its history from the archive", async () => {
    const clean = await render(load, first); const mixed = await render(load, [...archive, ...first]); expect(mixed).toBe(clean);
    if (name === "momentum") expect(clean).toContain("At least 8 recorded");
    if (name === "h2h") expect(clean).toContain('/game/0022600001');
    if (name === "trajectory") expect(clean).toContain('&quot;game&quot;:1');
  });
  it("uses a populated current sample identically with and without older games", async () => {
    const data = [...archive, ...games]; const before = JSON.stringify(data);
    const clean = await render(load, games); expect(await render(load, data)).toBe(clean); expect(clean).not.toMatch(empty);
    expect(JSON.stringify(data)).toBe(before); expect(full).not.toHaveBeenCalled();
  });
});
it("B2B retains future current-season pairs and fixes date-only comparison in positive-offset TZ", async () => {
  const future = [day("2026-12-01", "0022600100", 1), day("2026-12-02", "0022600101", 1)];
  const html = await render(pages[2][1], [...archive, ...future]);
  expect(html).toContain('/game/0022600100'); expect(html).toContain('/game/0022600101'); expect(html).not.toContain('/game/00225');
});
it("H2H retains both venue orientations and current playoffs/Cup while excluding preseason and pending", async () => {
  const data = [day("2026-11-10", "0022600001"), day("2026-11-11", "0042600001", 3, true), day("2026-11-12", "0062600001"), day("2026-11-13", "0012600001"), day("2026-11-14", "0022600002", 1)];
  const html = await render(pages[3][1], data);
  for (const id of ["0022600001", "0042600001", "0062600001"]) expect(html).toContain(`/game/${id}`);
  for (const id of ["0012600001", "0022600002"]) expect(html).not.toContain(`/game/${id}`);
});
it("heatmap keeps scheduled/preseason/Cup/playoff dates while excluding archive season", async () => {
  const data = [day("2026-10-03", "0012600001", 1), day("2026-12-15", "0062600001", 1), day("2027-04-20", "0042600001", 2)];
  const html = await render(pages[5][1], [...archive, ...data]);
  for (const date of ["2026-10-03", "2026-12-15", "2027-04-20"]) expect(html).toContain(date);
  expect(html).not.toContain("2026-01-01");
});
it("rivalry repeated-meeting threshold cannot be supplied by a prior-season game", async () => {
  const html = await render(pages[4][1], [...archive, ...first]); expect(html).toContain("0 played at least twice this season");
});
it.each([0, 4, 6])("regular-only view %s retains its game-type/status exclusions", async index => {
  const extra = [day("2026-11-20", "0012600009"), day("2026-11-21", "0042600009"), day("2026-11-22", "0062600009"), day("2026-11-23", "0022600009", 1)];
  expect(await render(pages[index][1], [...games, ...extra])).toBe(await render(pages[index][1], games));
});
it("streaks count current playoff finals but not Cup/preseason/pending results", async () => {
  const finals = [...first, day("2026-11-11", "0042600001")];
  const extra = [day("2026-11-12", "0062600001"), day("2026-11-13", "0012600001"), day("2026-11-14", "0022600002", 1)];
  const html = await render(pages[1][1], [...archive, ...finals, ...extra]);
  expect(html).toBe(await render(pages[1][1], finals)); expect(html.replace(/<[^>]+>/g, "")).toContain("2 W in a row");
});
it("H2H invalid or identical selections never fetch a schedule", async () => {
  const { default: Page } = await import("@/app/h2h/page");
  await Page({ searchParams: Promise.resolve({ t1: "BOS", t2: "BOS" }) });
  await Page({ searchParams: Promise.resolve({ t1: "BOS", t2: "INVALID" }) });
  expect(current).not.toHaveBeenCalled();
});
it("B2B excludes preseason and malformed date labels", async () => {
  const data = [day("2026-10-03", "0012600001", 1), day("2026-10-04", "0012600002", 1), { ...first[0], gameDate: "02/31/2026" }];
  expect(await render(pages[2][1], data)).toContain("No B2Bs detected");
});
it("Chinese H2H empty state reports missing data rather than inventing a zero-zero record", async () => {
  locale.mockResolvedValue("zh"); const html = await render(pages[3][1], archive);
  expect(html).toContain("暂无本赛季两队已完成交锋的数据");
  expect(html.match(/tabular-nums[^>]*>—<\/span>/g)).toHaveLength(2);
});

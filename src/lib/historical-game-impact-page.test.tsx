import { isValidElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ box: vi.fn(), schedule: vi.fn(), pbp: vi.fn(), locale: "en" }));
vi.mock("@/lib/api", async original => ({ ...await original<typeof import("./api")>(), getBoxScore: m.box, getFullSchedule: m.schedule, getScheduleAge: () => 123 }));
vi.mock("@/lib/game-play-by-play", async original => ({ ...await original<typeof import("./game-play-by-play")>(), getGamePlayByPlay: m.pbp }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => m.locale }));
vi.mock("next/dynamic", () => ({ default: () => function DynamicChart() { return null; } }));
import Page, { generateMetadata } from "@/app/lab/game-impact/page";
import { getRecorded2025SeasonSchedule } from "./api";
function nodes(node: ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return isValidElement<{ children?: ReactNode }>(node) ? [node as React.ReactElement<Record<string, unknown>>, ...nodes(node.props.children)] : [];
}
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return text(node.props.children);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}
const recorded = getRecorded2025SeasonSchedule();
const game = recorded.flatMap(day => day.games).find(game => game.gameId === "0042500405")!;
beforeEach(() => { vi.clearAllMocks(); m.locale = "en"; m.box.mockResolvedValue(null); m.schedule.mockResolvedValue(recorded); m.pbp.mockResolvedValue({ actions: [] }); });
afterEach(() => vi.unstubAllGlobals());
const page = (id?: string | string[]) => Page({ searchParams: Promise.resolve(id === undefined ? {} : { id }) });

it.each(["en", "zh"])("explicit reviewed game renders actual complete chart with zero provider/schedule calls (%s)", async locale => {
  m.locale = locale;
  const fetch = vi.fn(() => { throw new Error("Provider forbidden for archived game"); }); vi.stubGlobal("fetch", fetch);
  m.schedule.mockReturnValue(new Promise(() => {}));
  const tree = await page("0042500405"); const all = nodes(tree);
  const chart = all.find(n => Array.isArray(n.props.series));
  expect(chart?.props.steps).toBe(97);
  expect((chart?.props.series as { total: number }[]).map(s => s.total)).toEqual([45, 25, 19, 14, 14, 13]);
  expect(chart?.props.quarterStarts).toEqual([18, 39, 69].map((index, i) => ({ index, label: locale === "zh" ? `第${i + 2}节` : `Q${i + 2}` })));
  expect(m.schedule).not.toHaveBeenCalled(); expect(m.box).not.toHaveBeenCalled(); expect(m.pbp).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  expect(text(tree)).toContain("New York Knicks 94 @ 90 San Antonio Spurs");
  expect(text(tree)).toContain(locale === "zh" ? "原始逐球采集时间未知" : "original play-by-play capture time is unknown");
  expect(text(tree)).toContain(locale === "zh" ? "其他历史比赛" : "Other recorded games");
  expect(all.some(n => n.props.href === "https://github.com/fxy2026/nba_data/blob/e829d4678be1e075f99e5d41a1c5f97089be446b/datasets/nbastatsv3_po_2025.tar.xz")).toBe(true);
  expect(all.some(n => n.props.href === "/game/0042500405")).toBe(true);
  expect(all.some(n => n.props.updatedAt === null)).toBe(true);
  const header = all.find(n => n.props.href === "/game/0042500405" && String(n.props.className).includes("glass-tile"));
  expect(String(header?.props.className)).toContain("flex-col"); expect(String(header?.props.className)).toContain("min-h-11");
  expect(all.some(n => n.props.title === "Detailed game data unavailable" || n.props.title === "Scoring curve unavailable")).toBe(false);
});
it.each(["en", "zh"])("metadata uses the same zero-provider historical identity (%s)", async locale => {
  m.locale = locale;
  const metadata = await generateMetadata({ searchParams: Promise.resolve({ id: " 0042500405 " }) });
  expect(metadata.title).toContain("NYK 94 @ SAS 90"); expect(m.box).not.toHaveBeenCalled(); expect(m.schedule).not.toHaveBeenCalled(); expect(m.pbp).not.toHaveBeenCalled();
});
it("no-ID default still asks the full schedule, then takes the local selected game branch", async () => {
  const all = nodes(await page());
  expect(m.schedule).toHaveBeenCalledTimes(1); expect(m.box).not.toHaveBeenCalled(); expect(m.pbp).not.toHaveBeenCalled();
  expect(all.find(n => Array.isArray(n.props.series))?.props.steps).toBe(97);
});
it("a newer finished game remains the default, instead of pinning G5", async () => {
  const newer = { ...structuredClone(game), gameId: "0022600017", gameDateTimeUTC: "2026-10-24T00:00:00Z" };
  m.schedule.mockResolvedValue([{ gameDate: "10/23/2026 00:00:00", games: [game, newer] }]);
  const all = nodes(await page());
  expect(m.box).toHaveBeenCalledExactlyOnceWith(newer.gameId); expect(m.pbp).not.toHaveBeenCalled();
  expect(all.some(n => Array.isArray(n.props.series))).toBe(false);
  expect(all.some(n => (n.props.action as {href?:string})?.href === `/game/${newer.gameId}`)).toBe(true);
});
it("a newer scheduled game does not replace the latest finished target", async () => {
  const future = { ...structuredClone(game), gameId: "0022600017", gameStatus: 1, gameDateTimeUTC: "2026-10-24T00:00:00Z" };
  m.schedule.mockResolvedValue([{ gameDate: "10/23/2026 00:00:00", games: [game, future] }]);
  const all = nodes(await page()); expect(all.find(n => Array.isArray(n.props.series))?.props.steps).toBe(97); expect(m.box).not.toHaveBeenCalled();
});
it("a conflicting selected schedule identity does not acquire the archived curve", async () => {
  const changed = structuredClone(game); changed.homeTeam.score++;
  m.schedule.mockResolvedValue([{ gameDate: "06/13/2026 00:00:00", games: [changed] }]);
  const all = nodes(await page()); expect(all.some(n => Array.isArray(n.props.series))).toBe(false); expect(m.box).toHaveBeenCalledExactlyOnceWith(game.gameId);
});
it.each(["0042500404", "0042500204", "0042500312", "0022600017"])("uncovered ID %s retains existing live/unavailable path", async id => {
  const all = nodes(await page(id)); expect(m.schedule).toHaveBeenCalledTimes(1); expect(m.box).toHaveBeenCalledExactlyOnceWith(id); expect(m.pbp).not.toHaveBeenCalled();
  expect(all.some(n => n.props.title === "Detailed game data unavailable")).toBe(true); expect(all.some(n => Array.isArray(n.props.series))).toBe(false);
});
it.each(["bad", "", ["0042500405", "0042500404"]])("invalid explicit ID remains network-free: %s", async id => {
  const all = nodes(await page(id)); expect(all.some(n => n.props.title === "Invalid game ID")).toBe(true);
  expect(m.schedule).not.toHaveBeenCalled(); expect(m.box).not.toHaveBeenCalled(); expect(m.pbp).not.toHaveBeenCalled();
});
it("empty default schedule remains no-finished-games, rather than falling back to G5", async () => {
  m.schedule.mockResolvedValue([]); const all = nodes(await page());
  expect(all.some(n => n.props.title === "No finished games yet")).toBe(true); expect(m.box).not.toHaveBeenCalled(); expect(m.pbp).not.toHaveBeenCalled();
});

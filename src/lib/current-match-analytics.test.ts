import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { scheduleForSeason } from "./games";
import { getTranslations } from "@/locales";
import type { ScheduleDate, ScheduleGame } from "./api";

const { getCurrentSeasonSchedule, getFullSchedule } = vi.hoisted(() => ({ getCurrentSeasonSchedule: vi.fn(), getFullSchedule: vi.fn() }));
vi.mock("@/lib/api", () => ({ getCurrentSeasonSchedule, getFullSchedule, getScheduleAge: () => null }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => "en" }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: "en", t: getTranslations("en") }) }));
function game(gameId: string, homeScore: number, awayScore: number, extra: Partial<ScheduleGame> = {}): ScheduleGame {
  const team = { teamName: "", teamCity: "", teamSlug: "", wins: 0, losses: 0, seed: 0 };
  return { gameId, gameStatus: 3, gameStatusText: "Final/OT", gameCode: "", gameDateTimeUTC: "2026-10-21T00:00:00Z",
    homeTeam: { ...team, teamId: 1610612738, teamTricode: "BOS", score: homeScore },
    awayTeam: { ...team, teamId: 1610612752, teamTricode: "NYK", score: awayScore }, ...extra };
}
const archive: ScheduleDate[] = [{ gameDate: "01/01/2026 00:00:00", games: [1, 2, 3].map((n) => game(`00225${String(n).padStart(5, "0")}`, 150, 149)) }];
const current: ScheduleDate[] = [{ gameDate: "10/21/2026 00:00:00", games: [game("0022600001", 90, 93)] }];
const pages = [
  ["scoring output", () => import("@/app/scoring-output/page")],
  ["home vs road", () => import("@/app/home-vs-road/page")],
  ["clutch teams", () => import("@/app/clutch-teams/page")],
  ["season records", () => import("@/app/records/page")],
  ["best games", () => import("@/app/best-games/page")],
] as const;
beforeEach(() => {
  getCurrentSeasonSchedule.mockReset(); getFullSchedule.mockReset();
  getFullSchedule.mockImplementation(() => { throw new Error("Current analytics used mixed-season feed"); });
});
for (const [name, load] of pages) {
  describe(name, () => {
    it("shows unavailable/empty data when only archived finals exist", async () => {
      getCurrentSeasonSchedule.mockResolvedValue(scheduleForSeason(archive, "2026-27"));
      const { default: Page } = await load();
      const html = renderToStaticMarkup(await Page());
      expect(html).toMatch(/No data|No close-game data|No games|No finished games/);
      expect(html).not.toContain('/game/0022500001');
      expect(getCurrentSeasonSchedule).toHaveBeenCalledOnce(); expect(getFullSchedule).not.toHaveBeenCalled();
    });
    it("uses the first current-season result without archive wins, averages or records", async () => {
      getCurrentSeasonSchedule.mockResolvedValue(scheduleForSeason([...archive, ...current], "2026-27"));
      const { default: Page } = await load();
      const html = renderToStaticMarkup(await Page());
      const text = html.replace(/<[^>]+>/g, "");
      expect(text).toContain("BOS"); expect(text).toContain("NYK");
      if (name === "scoring output") {
        expect(text).toContain("90.0"); expect(text).toContain("93.0"); expect(text).not.toContain("135.0");
      } else if (name === "home vs road") {
        expect(text).toContain("0-1 at home"); expect(text).toContain("1-0 on road"); expect(text).not.toContain("3-1 at home");
      } else if (name === "clutch teams") {
        expect(text).toContain("0-1 in OT"); expect(text).toContain("1-0 in OT"); expect(text).not.toContain("3-1 in OT");
      } else {
        expect(html).toContain('/game/0022600001'); expect(html).not.toContain('/game/0022500001');
        expect(text).not.toContain("150"); expect(text).not.toContain("149");
      }
      expect(getCurrentSeasonSchedule).toHaveBeenCalledOnce(); expect(getFullSchedule).not.toHaveBeenCalled();
      expect(archive[0].games).toHaveLength(3);
    });
    it("keeps existing exclusions for current preseason and unfinished games", async () => {
      const nonQualifying = [{ gameDate: "10/21/2026 00:00:00", games: [game("0012600001", 150, 149), game("0022600001", 0, 0, { gameStatus: 1, gameStatusText: "7:00 PM" })] }];
      getCurrentSeasonSchedule.mockResolvedValue(scheduleForSeason([...archive, ...nonQualifying], "2026-27"));
      const { default: Page } = await load();
      expect(renderToStaticMarkup(await Page())).toMatch(/No data|No close-game data|No games|No finished games/);
    });
  });
}
for (const [name, load] of pages.slice(3)) {
  it(`${name} preserves existing current-season playoff/Cup eligibility`, async () => {
    const supported = [{ gameDate: "05/01/2027 00:00:00", games: [game("0042600101", 100, 103), game("0062600001", 101, 102)] }];
    getCurrentSeasonSchedule.mockResolvedValue(scheduleForSeason([...archive, ...supported], "2026-27"));
    const { default: Page } = await load();
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain('/game/0042600101');
    if (name === "season records") expect(html).not.toContain('/game/0062600001');
    else expect(html).toContain('/game/0062600001');
    expect(html).not.toContain('/game/0022500001');
  });
}

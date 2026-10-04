import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { scheduleForSeason } from "./games";
import { getTranslations } from "@/locales";
import type { ScheduleDate, ScheduleGame } from "./api";

const { getCurrentSeasonSchedule, getFullSchedule } = vi.hoisted(() => ({
  getCurrentSeasonSchedule: vi.fn(), getFullSchedule: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ getCurrentSeasonSchedule, getFullSchedule, getScheduleAge: () => null }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => "en" }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: "en", t: getTranslations("en") }) }));

function game(id: string, homeScore: number, awayScore: number): ScheduleGame {
  const team = { teamName: "", teamCity: "", teamSlug: "", wins: 0, losses: 0, seed: 0 };
  return { gameId: id, gameStatus: 3, gameStatusText: "Final", gameCode: "", gameDateTimeUTC: "2026-10-21T00:00:00Z",
    homeTeam: { ...team, teamId: 1610612738, teamTricode: "BOS", score: homeScore },
    awayTeam: { ...team, teamId: 1610612752, teamTricode: "NYK", score: awayScore },
  };
}
const archive: ScheduleDate[] = [{ gameDate: "01/01/2026 00:00:00", games: [game("0022500001", 150, 80), game("0022500002", 150, 80)] }];
const current: ScheduleDate[] = [{ gameDate: "10/21/2026 00:00:00", games: [game("0022600001", 90, 100)] }];
const pages = [
  ["power rankings", () => import("@/app/power-rankings/page")],
  ["conference race", () => import("@/app/conference-race/page")],
  ["team stats", () => import("@/app/team-stats/page")],
  ["divisions", () => import("@/app/divisions/page")],
  ["tier list", () => import("@/app/tier-list/page")],
] as const;

beforeEach(() => {
  getCurrentSeasonSchedule.mockReset(); getFullSchedule.mockReset();
  getFullSchedule.mockImplementation(() => { throw new Error("Current dashboard used mixed-season feed"); });
});

for (const [name, load] of pages) {
  describe(name, () => {
    it("shows an empty state when only archived finished games exist", async () => {
      getCurrentSeasonSchedule.mockResolvedValue(scheduleForSeason(archive, "2026-27"));
      const { default: Page } = await load();
      const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
      expect(html).toMatch(/No data|No ranking data/);
      expect(getCurrentSeasonSchedule).toHaveBeenCalledOnce();
      expect(getFullSchedule).not.toHaveBeenCalled();
    });
    it("uses only the first new-season game, without old wins or averages", async () => {
      getCurrentSeasonSchedule.mockResolvedValue(scheduleForSeason([...archive, ...current], "2026-27"));
      const { default: Page } = await load();
      const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
      const text = html.replace(/<[^>]+>/g, "");
      expect(text).toMatch(/BOS|Boston Celtics/); expect(text).toMatch(/NYK|New York Knicks/);
      if (name === "team stats") {
        expect(text).toContain("90.0"); expect(text).not.toContain("130.0");
      } else {
        expect(text).toContain("0-1"); expect(text).not.toContain("2-1");
      }
      expect(getCurrentSeasonSchedule).toHaveBeenCalledOnce();
      expect(getFullSchedule).not.toHaveBeenCalled();
    });
  });
}

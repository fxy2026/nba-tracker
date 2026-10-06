import { isValidElement, type ReactNode } from "react";
import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ schedule: vi.fn(async () => []), players: vi.fn(async () => ({ players: [], provenance: { source: "bundled-archive", season: "2025-26", stale: true, retrievedAt: null } })) }));
vi.mock("@/lib/api", async original => ({ ...await original<typeof import("./api")>(), getCurrentSeasonSchedule: mocks.schedule, getPlayerIndexSnapshot: mocks.players, getScheduleAge: () => null }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => "en" }));
import Page, { generateMetadata } from "@/app/team/[tricode]/page";
import TeamArchiveCoverage from "@/app/team/[tricode]/_components/TeamArchiveCoverage";
import TeamHero from "@/app/team/[tricode]/_components/TeamHero";
import SixersSeasonArchive from "@/app/team/[tricode]/_components/SixersSeasonArchive";
import { TEAM_META } from "./teams";
import { currentSeason } from "./constants";
function propsOf(node: ReactNode, type: unknown): Record<string, unknown>[] {
  if (Array.isArray(node)) return node.flatMap(child => propsOf(child, type));
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [...(node.type === type ? [node.props] : []), ...propsOf(node.props.children as ReactNode, type)];
}
it("every current team route uses the same card, separately from current team values", async () => {
  const requests = vi.fn(() => { throw new Error("Unexpected network request"); }); vi.stubGlobal("fetch", requests);
  try {
    for (const team of Object.keys(TEAM_META)) {
      const page = await Page({ params: Promise.resolve({ tricode: team }) });
      expect(propsOf(page, TeamArchiveCoverage)).toEqual([expect.objectContaining({ coverage: expect.objectContaining({ season: "2025-26", regular: expect.objectContaining({ team, expectedGames: 82 }) }) })]);
      expect(propsOf(page, TeamHero)).toEqual([expect.objectContaining({ season: currentSeason(), wins: 0, losses: 0, gamesPlayed: 0 })]);
      expect((await generateMetadata({ params: Promise.resolve({ tricode: team }) })).alternates?.canonical).toBe(`/team/${team}`);
    }
    expect(requests).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
it("preserves the PHI historical route without inserting the completed-season card", async () => {
  mocks.schedule.mockClear(); mocks.players.mockClear();
  const page = await Page({ params: Promise.resolve({ tricode: "PHI" }), searchParams: Promise.resolve({ season: "2024-25" }) });
  expect(propsOf(page, TeamArchiveCoverage)).toEqual([]);
  expect(propsOf(page, SixersSeasonArchive)).toHaveLength(1);
  expect(mocks.schedule).not.toHaveBeenCalled(); expect(mocks.players).not.toHaveBeenCalled();
});

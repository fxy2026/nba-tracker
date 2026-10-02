import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getTranslations } from "@/locales";
import { gameSeasonKey, scheduleForGameSeason } from "./games";
import type { ScheduleDate, ScheduleGame } from "./api";
import archiveSchedule from "@/data/schedule-2025-26.json";
import archiveGameSeasons from "@/data/archive-game-seasons.json";

const { getFullSchedule } = vi.hoisted(() => ({ getFullSchedule: vi.fn() }));
vi.mock("@/lib/api", () => ({ getFullSchedule, toBeijingTime: (value: string) => value }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: "en", t: getTranslations("en") }) }));

function game(id: string, homeScore: number, awayScore: number): ScheduleGame {
  const team = { teamName: "", teamCity: "", teamSlug: "", wins: 0, losses: 0, seed: 0 };
  return { gameId: id, gameStatus: 3, gameStatusText: "Final", gameCode: "", gameDateTimeUTC: `20${id.slice(3, 5)}-12-01T00:00:00Z`,
    homeTeam: { ...team, teamId: 1610612738, teamTricode: "BOS", score: homeScore },
    awayTeam: { ...team, teamId: 1610612752, teamTricode: "NYK", score: awayScore },
  };
}
const archived: ScheduleDate = { gameDate: "01/01/2026 00:00:00", games: [game("0022500001", 120, 100), game("0022500002", 130, 110)] };
const current: ScheduleDate = { gameDate: "01/01/2027 00:00:00", games: [game("0022600001", 90, 100)] };
const merged = [archived, current];

beforeEach(() => {
  vi.resetModules(); getFullSchedule.mockReset().mockResolvedValue(merged);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ injuries: [] })));
});
afterEach(() => vi.unstubAllGlobals());

describe("target-game season selection", () => {
  it("uses the historical game's encoded season, not today's or January's calendar year", () => {
    expect(gameSeasonKey("0022500001")).toBe("25");
    expect(scheduleForGameSeason(merged, "0022500999")).toEqual([archived]);
    expect(scheduleForGameSeason(merged, "0022600999")).toEqual([current]);
    expect(merged).toHaveLength(2);
  });
  it("preserves verified synthetic archive IDs using explicit archive provenance", () => {
    const synthetic = { ...game("9401810012", 110, 100), gameDateTimeUTC: "2026-01-01T00:00:00Z" };
    const dates = [{ ...archived, games: [...archived.games, synthetic] }, current];
    expect(gameSeasonKey(synthetic.gameId)).toBe("25");
    expect(scheduleForGameSeason(dates, synthetic.gameId)[0].games).toHaveLength(3);
    expect(scheduleForGameSeason(dates, "0022500999")[0].games).toContainEqual(synthetic);
    expect(gameSeasonKey("9999999999")).toBeNull();
  });
  it("returns no guessed season for unsupported or malformed IDs", () => {
    expect(gameSeasonKey("1522600001")).toBeNull();
    expect(gameSeasonKey("__proto__")).toBeNull();
    expect(scheduleForGameSeason(merged, "bad-id")).toEqual([]);
  });
});

describe("game preview season context", () => {
  async function render(gameId: string) {
    const { default: Preview } = await import("@/app/game/[id]/_components/GamePreview");
    return renderToStaticMarkup(await Preview({ gameId,
      home: { tricode: "BOS", teamId: 1610612738, teamCity: "Boston", teamName: "Celtics" },
      away: { tricode: "NYK", teamId: 1610612752, teamCity: "New York", teamName: "Knicks" },
      gameTimeUTC: "2027-01-02T00:00:00Z", isZh: false,
    }));
  }
  it("keeps archived records, recent form and season meetings on a historical preview", async () => {
    const html = await render("0022500999");
    expect(html).toContain('/game/0022500001'); expect(html).toContain('/game/0022500002');
    expect(html).not.toContain('/game/0022600001');
    expect(html.replace(/<[^>]+>/g, "")).toContain("2-0");
  });
  it("excludes archive records and meetings from the new-season preview", async () => {
    const html = await render("0022600999");
    expect(html).toContain('/game/0022600001'); expect(html).not.toContain('/game/0022500001');
    expect(html.replace(/<[^>]+>/g, "")).toContain("0-1");
    expect(html.replace(/<[^>]+>/g, "")).not.toContain("2-1");
  });
  it("does not invent new-season form when only an archive is available", async () => {
    getFullSchedule.mockResolvedValue([archived]);
    const html = await render("0022600999");
    expect(html).not.toContain('/game/0022500001'); expect(html).toContain("No games yet");
  });
});

describe("season ranks across merged seasons", () => {
  it("ranks each season independently and preserves dense ties within that season", async () => {
    const { buildSeasonRanks } = await import("./season-ranks");
    const schedule = [
      { ...archived, games: [game("0022500001", 120, 100), game("0022500002", 130, 110), game("0042500101", 125, 115)] },
      { ...current, games: [game("0022600001", 300, 290)] },
    ];
    const ranks = buildSeasonRanks(schedule);
    expect(ranks.get("0022500002")).toMatchObject({ totalPointsRank: 1, totalGames: 3 });
    expect(ranks.get("0042500101")).toMatchObject({ totalPointsRank: 1, totalGames: 3 });
    expect(ranks.get("0022500001")).toMatchObject({ totalPointsRank: 2, totalGames: 3 });
    expect(ranks.get("0022600001")).toMatchObject({ totalPointsRank: 1, totalGames: 1 });
  });
  it("keeps synthetic archive finals in their own season's ranks", async () => {
    const { buildSeasonRanks } = await import("./season-ranks");
    const synthetic = { ...game("9401810012", 160, 150), gameDateTimeUTC: "2026-01-01T00:00:00Z" };
    const ranks = buildSeasonRanks([{ ...archived, games: [...archived.games, synthetic] }, current]);
    expect(ranks.get(synthetic.gameId)).toMatchObject({ totalPointsRank: 1, totalGames: 3 });
    expect(ranks.get("0022500002")).toMatchObject({ totalPointsRank: 2, totalGames: 3 });
    expect(ranks.get("0022600001")).toMatchObject({ totalGames: 1 });
  });
  it("preserves the actual archived final-game rank population and provenance", async () => {
    const { buildSeasonRanks } = await import("./season-ranks");
    const dates = archiveSchedule.dates as unknown as ScheduleDate[];
    const finals = dates.flatMap((date) => date.games).filter((game) =>
      game.gameStatus === 3 && game.homeTeam.score + game.awayTeam.score > 0);
    const synthetic = finals.filter((game) => game.gameId.startsWith("9"));
    expect(synthetic).toHaveLength(68);
    expect(Object.keys(archiveGameSeasons).sort()).toEqual(synthetic.map((game) => game.gameId).sort());
    const ranks = buildSeasonRanks(dates);
    expect(ranks.size).toBe(finals.length);
    for (const game of synthetic) expect(ranks.get(game.gameId)?.totalGames).toBe(finals.length);
  });
  it("omits unfinished/zero-score games and non-season IDs", async () => {
    const { buildSeasonRanks } = await import("./season-ranks");
    const schedule = [{ ...current, games: [
      { ...game("0022600001", 1, 0), gameStatus: 2 },
      game("0022600002", 0, 0), game("1522600001", 200, 190),
    ] }];
    expect(buildSeasonRanks(schedule).size).toBe(0);
  });
  it("serves both historical and new-season ranks from one shared cached build", async () => {
    const { getSeasonRank } = await import("./season-ranks");
    const [old, latest] = await Promise.all([getSeasonRank("0022500001"), getSeasonRank("0022600001")]);
    expect(old?.totalGames).toBe(2); expect(latest?.totalGames).toBe(1);
    await getSeasonRank("0022500002");
    expect(getFullSchedule).toHaveBeenCalledOnce();
  });
});

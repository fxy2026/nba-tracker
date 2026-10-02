import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { getFullSchedule } = vi.hoisted(() => ({ getFullSchedule: vi.fn() }));
vi.mock("@/lib/api", () => ({ getFullSchedule, formatDate: () => "2026-10-01" }));
import { GET } from "./route";
const game = (gameId: string, gameStatus = 3) => ({gameId,gameStatus,homeTeam:{score:100},awayTeam:{score:90}});
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
afterEach(() => vi.useRealTimers());
it("returns one season and explicit metadata using one schedule fetch", async () => {
  getFullSchedule.mockResolvedValue([{gameDate:"04/20/2026",games:[game("0042400101"),game("0042500101"),game("0042600101",1)]}]);
  const response = await GET(); const data = await response.json();
  expect(data.playoffSeason).toBe("2025-26");
  expect(data.playoffs.map((g: {gameId:string}) => g.gameId)).toEqual(["0042500101"]);
  expect(getFullSchedule).toHaveBeenCalledTimes(1);
  expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=120, stale-while-revalidate=300");
});
it("preserves graceful source failure with no fabricated season", async () => {
  getFullSchedule.mockRejectedValue(new Error("offline"));
  expect(await (await GET()).json()).toEqual({recent:[],playoffs:[],playoffSeason:null});
});

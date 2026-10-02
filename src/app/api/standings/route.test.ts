import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScheduleDate } from "@/lib/api";

const { getCurrentSeasonSchedule } = vi.hoisted(() => ({ getCurrentSeasonSchedule: vi.fn() }));
vi.mock("@/lib/api", () => ({ getCurrentSeasonSchedule }));

function schedule(homeScore: number): ScheduleDate[] {
  return [{ gameDate: "10/01/2026 00:00:00", games: [{
    gameId: "0022600001", gameStatus: 3,
    homeTeam: { teamTricode: "BOS", teamId: 1, teamName: "Celtics", teamCity: "Boston", score: homeScore },
    awayTeam: { teamTricode: "NYK", teamId: 2, teamName: "Knicks", teamCity: "New York", score: 100 },
  }] }] as ScheduleDate[];
}

beforeEach(() => { vi.resetModules(); getCurrentSeasonSchedule.mockReset(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("standings cache season boundaries", () => {
  it("does not reuse a fresh previous-season cache after October 1", async () => {
    vi.setSystemTime(new Date("2026-09-30T23:59:59Z"));
    getCurrentSeasonSchedule.mockResolvedValueOnce(schedule(110)).mockResolvedValueOnce(schedule(90));
    const { GET } = await import("./route");
    expect((await (await GET()).json()).data.find((t: { tricode: string }) => t.tricode === "BOS").wins).toBe(1);
    vi.setSystemTime(new Date("2026-10-01T00:00:01Z"));
    const next = await (await GET()).json();
    expect(next.data.find((t: { tricode: string }) => t.tricode === "BOS")).toMatchObject({ wins: 0, losses: 1 });
    expect(getCurrentSeasonSchedule.mock.calls).toEqual([["2025-26"], ["2026-27"]]);
    await GET();
    expect(getCurrentSeasonSchedule).toHaveBeenCalledTimes(2);
  });
  it("does not share an in-flight previous-season computation with the new season", async () => {
    vi.setSystemTime(new Date("2026-09-30T23:59:59Z"));
    let resolve!: (value: ScheduleDate[]) => void;
    getCurrentSeasonSchedule.mockImplementationOnce(() => new Promise<ScheduleDate[]>((done) => { resolve = done; }))
      .mockResolvedValueOnce(schedule(90));
    const { GET } = await import("./route");
    const old = GET();
    vi.setSystemTime(new Date("2026-10-01T00:00:01Z"));
    const next = await (await GET()).json();
    expect(next.data.find((t: { tricode: string }) => t.tricode === "BOS").losses).toBe(1);
    resolve(schedule(110));
    await old;
    expect(getCurrentSeasonSchedule.mock.calls).toEqual([["2025-26"], ["2026-27"]]);
  });
});

describe('standings final-score safety',()=>{
 it.each([100,NaN,Infinity,-1,100.5,null,undefined])('invalid final %s cannot fabricate a win alongside a valid game',async invalid=>{
  vi.setSystemTime(new Date('2026-10-02T00:00:00Z'));
  const valid=schedule(110);const bad=schedule(invalid as number);getCurrentSeasonSchedule.mockResolvedValue([...valid,...bad]);
  const{GET}=await import('./route');const data=await(await GET()).json();
  expect(data.data.find((t:{tricode:string})=>t.tricode==='BOS')).toMatchObject({wins:1,losses:0});
  expect(data.data.find((t:{tricode:string})=>t.tricode==='NYK')).toMatchObject({wins:0,losses:1});
 });
});

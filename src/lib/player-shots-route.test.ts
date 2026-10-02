import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ stats: vi.fn(), schedule: vi.fn(), pbp: vi.fn() }));
vi.mock("@/lib/statsProxy", () => ({ STATS_BASE: "https://stats.nba.com/stats", fetchStats: mocks.stats }));
vi.mock("@/lib/api", () => ({ getCurrentSeasonSchedule: mocks.schedule, getPlayByPlaySnapshot: mocks.pbp }));
vi.mock("@/lib/constants", () => ({ CURRENT_SEASON: "2026-27" }));
import { GET } from "@/app/api/player-shots/route";

const request = (query: string) => new NextRequest(`http://localhost/api/player-shots?${query}`);
const ok = (payload: unknown) => ({ ok: true, json: async () => payload });
const log = (ids: unknown[] = [], header = "Game_ID") => ({ resultSets: [{ name: "PlayerGameLog", headers: [header, "GAME_DATE"], rowSet: ids.map((id,index) => [id,new Date(Date.UTC(2026,0,index+1)).toISOString().slice(0,10)]) }] });
const query = "playerId=2544&team=LAL&season=2025-26";
const shot = { personId: 2544, actionType: "2pt", shotResult: "Made", x: 10, y: 20, shotDistance: 5 };
const game = (gameId: string, status = 3, home = "LAL", away = "BOS") => ({ gameId, gameStatus: status, homeTeam: { teamTricode: home }, awayTeam: { teamTricode: away } });

beforeEach(() => {
  mocks.stats.mockReset(); mocks.schedule.mockReset(); mocks.pbp.mockReset();
  mocks.schedule.mockResolvedValue([]); mocks.pbp.mockResolvedValue({shots:[shot],available:true,stale:false});
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected external fetch"); }));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("player shot season routing and unavailable game logs", () => {
  it("forwards the exact explicit historical season and filters player field goals", async () => {
    mocks.stats.mockResolvedValue(ok(log(["0022500340"])));
    mocks.pbp.mockResolvedValue({shots:[shot, { ...shot, personId: 1 }, { ...shot, actionType: "freethrow" }],available:true,stale:false});
    const res = await GET(request(query));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ shots: [shot], gamesLoaded: 1, totalGames: 1 });
    const url = new URL(mocks.stats.mock.calls[0][0]);
    expect(url.pathname).toBe("/stats/playergamelog");
    expect(Object.fromEntries(url.searchParams)).toEqual({ PlayerID: "2544", Season: "2025-26", SeasonType: "Regular Season" });
    expect(mocks.stats).toHaveBeenCalledTimes(1); expect(mocks.schedule).not.toHaveBeenCalled();
    expect(mocks.pbp).toHaveBeenCalledExactlyOnceWith("0022500340", { final: true });
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=600");
  });

  it("keeps omitted season on the current schedule fast path", async () => {
    mocks.schedule.mockResolvedValue([{ gameDate: "10/21/2026", games: [game("0022600001"), game("0022600002", 1), game("0022600003", 3, "ATL", "DEN"), game("0042600001")] }]);
    const res = await GET(request("playerId=2544&team=LAL"));
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ shots: [shot], gamesLoaded: 1, totalGames: 1 });
    expect(mocks.schedule).toHaveBeenCalledExactlyOnceWith(); expect(mocks.stats).not.toHaveBeenCalled();
    expect(mocks.pbp).toHaveBeenCalledExactlyOnceWith("0022600001", { final: true });
  });

  it("keeps explicit current season and TOT on the team-agnostic game-log path", async () => {
    mocks.stats.mockResolvedValue(ok(log(["0022600001"])));
    const res = await GET(request("playerId=2544&team=TOT&season=2026-27&seasonType=playoffs"));
    expect(res.status).toBe(200); expect(mocks.schedule).not.toHaveBeenCalled();
    expect(new URL(mocks.stats.mock.calls[0][0]).searchParams.get("Season")).toBe("2026-27");
    expect(new URL(mocks.stats.mock.calls[0][0]).searchParams.get("SeasonType")).toBe("Playoffs");
    expect(mocks.pbp).toHaveBeenCalledExactlyOnceWith("0022600001", { final: false });
  });

  it.each(["Game_ID", "GAME_ID"])("recognizes validated empty history using %s without loading PBP", async header => {
    mocks.stats.mockResolvedValue(ok(log([], header)));
    const res = await GET(request(query));
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ shots: [], gamesLoaded: 0, totalGames: 0 });
    expect(mocks.stats).toHaveBeenCalledTimes(1); expect(mocks.pbp).not.toHaveBeenCalled();
  });

  it.each([
    null, {}, { resultSets: [] }, { resultSets: {} }, { resultSets: [{ rowSet: [] }] },
    { resultSets: [{ headers: [], rowSet: [] }] }, { resultSets: [{ headers: ["Game_ID"], rowSet: {} }] },
    { resultSets: [{ headers: ["Game_ID", "Game_ID"], rowSet: [] }] },
    { resultSets: [{ headers: ["Game_ID", 1], rowSet: [] }] },
    { resultSets: [{ headers: ["Game_ID", "PTS"], rowSet: [["0022500340"]] }] },
    log([null]), log([22500340]), log(["junk"]), log(["0022500340", "bad"]),
  ])("does not cache malformed historical response %# as an empty season", async payload => {
    mocks.stats.mockResolvedValue(ok(payload));
    const res = await GET(request(query));
    expect(res.status).toBe(503); expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "Player game log unavailable" });
    expect(mocks.pbp).not.toHaveBeenCalled(); expect(mocks.schedule).not.toHaveBeenCalled();
    expect(mocks.stats).toHaveBeenCalledTimes(1);
  });

  it.each(["null", "403", "network", "json"])("returns uncached unavailable for %s, then allows recovery on the next request", async failure => {
    if (failure === "null") mocks.stats.mockResolvedValueOnce(null);
    if (failure === "403") mocks.stats.mockResolvedValueOnce({ ok: false, status: 403 });
    if (failure === "network") mocks.stats.mockRejectedValueOnce(new Error("offline"));
    if (failure === "json") mocks.stats.mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError("malformed"); } });
    mocks.stats.mockResolvedValueOnce(ok(log(["0022500340"])));
    const failed = await GET(request(query));
    expect(failed.status).toBe(503); expect(failed.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.pbp).not.toHaveBeenCalled();
    const recovered = await GET(request(query));
    expect(recovered.status).toBe(200); expect((await recovered.json()).shots).toEqual([shot]);
    expect(mocks.stats).toHaveBeenCalledTimes(2); expect(mocks.pbp).toHaveBeenCalledTimes(1);
  });

  it.each(["first", "second"])("does not present a partial all-season result when the %s game log fails", async failed => {
    if (failed === "first") mocks.stats.mockResolvedValueOnce(null);
    else mocks.stats.mockResolvedValueOnce(ok(log(["0022500340"]))).mockResolvedValueOnce({ ok: false, status: 403 });
    const res = await GET(request(`${query}&seasonType=all`));
    expect(res.status).toBe(503); expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.pbp).not.toHaveBeenCalled(); expect(mocks.stats).toHaveBeenCalledTimes(failed === "first" ? 1 : 2);
  });

  it("queries exactly regular and playoffs for all, accepting one genuinely empty result", async () => {
    mocks.stats.mockResolvedValueOnce(ok(log(["0022500340"]))).mockResolvedValueOnce(ok(log([])));
    const res = await GET(request(`${query}&seasonType=all`));
    expect(res.status).toBe(200); expect((await res.json()).totalGames).toBe(1);
    expect(mocks.stats.mock.calls.map(([url]) => new URL(url).searchParams.get("SeasonType"))).toEqual(["Regular Season", "Playoffs"]);
    expect(mocks.pbp).toHaveBeenCalledTimes(1);
  });

  it.each([
    "team=LAL", "playerId=2544", "playerId=2544junk&team=LAL", "playerId=0&team=LAL",
    "playerId=-1&team=LAL", "playerId=1.5&team=LAL", "playerId=9007199254740992&team=LAL",
    "playerId=2544&team=LAL&seasonType=", "playerId=2544&team=LAL&seasonType=invalid",
    "playerId=2544&team=LAL&season=", "playerId=2544&team=LAL&season=2025",
    "playerId=2544&team=LAL&season=2025-2026", "playerId=2544&team=LAL&season=2025-27",
    "playerId=2544&team=LAL&season=abcd-ef",
  ])("rejects invalid inputs before any data call: %s", async params => {
    const res = await GET(request(params)); expect(res.status).toBe(400);
    expect(mocks.stats).not.toHaveBeenCalled(); expect(mocks.pbp).not.toHaveBeenCalled(); expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it("retains the 30-game PBP fanout cap", async () => {
    const ids = Array.from({ length: 35 }, (_, i) => `00225${String(i).padStart(5, "0")}`);
    mocks.stats.mockResolvedValue(ok(log(ids)));
    const res = await GET(request(query)); const data = await res.json();
    expect(res.status).toBe(200); expect(data.totalGames).toBe(35); expect(data.gamesLoaded).toBe(30);
    expect(mocks.pbp.mock.calls.map(([id]) => id)).toEqual(ids.slice(-30)); expect(mocks.stats).toHaveBeenCalledTimes(1);
  });
});

it.each(['unavailable','throw','stale'])('failed PBP %s does not become cached successful empty or partial season',async failure=>{
 mocks.stats.mockResolvedValue(ok(log(['0022500340','0022500341'])));
 mocks.pbp.mockResolvedValueOnce({shots:[shot],available:true,stale:false});
 if(failure==='throw')mocks.pbp.mockRejectedValueOnce(new Error('offline'));
 else mocks.pbp.mockResolvedValueOnce({shots:failure==='stale'?[shot]:[],available:false,stale:failure==='stale'});
 const response=await GET(request(query));expect(response.status).toBe(503);expect(response.headers.get('Cache-Control')).toBe('no-store');expect(await response.json()).toEqual({error:'Player shot data unavailable'});
 mocks.pbp.mockResolvedValue({shots:[shot],available:true,stale:false});const retry=await GET(request(query));expect(retry.status).toBe(200);expect((await retry.json()).gamesLoaded).toBe(2);
});
it('successful game feeds with no shots by selected player remain legitimate empty',async()=>{
 mocks.stats.mockResolvedValue(ok(log(['0022500340'])));mocks.pbp.mockResolvedValue({shots:[{...shot,personId:1}],available:true,stale:false});const response=await GET(request(query));expect(response.status).toBe(200);expect(await response.json()).toEqual({shots:[],gamesLoaded:1,totalGames:1});
});
it('descending game log still selects the most recent30 by date, not the oldest30',async()=>{
 const ids=Array.from({length:35},(_,i)=>`00225${String(i).padStart(5,'0')}`);
 const rows=ids.map((id,i)=>[id,new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10)]).reverse();
 mocks.stats.mockResolvedValue(ok({resultSets:[{headers:['Game_ID','GAME_DATE'],rowSet:rows}]}));
 const response=await GET(request(query));expect(response.status).toBe(200);expect(mocks.pbp.mock.calls.map(([id])=>id)).toEqual(ids.slice(5));expect((await response.json()).totalGames).toBe(35);
});
it('all-season responses merge by date and deduplicate repeated game identities',async()=>{
 const payload=(rows:string[][])=>ok({resultSets:[{headers:['Game_ID','GAME_DATE'],rowSet:rows}]});
 mocks.stats.mockResolvedValueOnce(payload([['0022500002','JAN 02, 2026'],['0022500001','OCT 21, 2025']])).mockResolvedValueOnce(payload([['0042500405','JUN 13, 2026'],['0022500001','OCT 21, 2025']]));
 const response=await GET(request(query+'&seasonType=all'));expect(response.status).toBe(200);expect(mocks.pbp.mock.calls.map(([id])=>id)).toEqual(['0022500001','0022500002','0042500405']);expect((await response.json()).totalGames).toBe(3);
});
it.each(['missing','invalid','conflict'])('bad game-log date %s is unavailable before any PBP request',async kind=>{
 const body=kind==='missing'?{headers:['Game_ID'],rowSet:[['0022500001']]}:kind==='invalid'?{headers:['Game_ID','GAME_DATE'],rowSet:[['0022500001','FEB 30, 2026']]}:{headers:['Game_ID','GAME_DATE'],rowSet:[['0022500001','2026-01-01'],['0022500001','2026-01-02']]};mocks.stats.mockResolvedValue(ok({resultSets:[body]}));
 const response=await GET(request(query));expect(response.status).toBe(503);expect(response.headers.get('Cache-Control')).toBe('no-store');expect(mocks.pbp).not.toHaveBeenCalled();
});
it('current schedule also sorts by actual schedule day and removes duplicates',async()=>{
 mocks.schedule.mockResolvedValue([{gameDate:'11/03/2026',games:[game('0022600003')]},{gameDate:'10/21/2026',games:[game('0022600001'),game('0022600001')]}]);const response=await GET(request('playerId=2544&team=LAL'));expect(response.status).toBe(200);expect(mocks.pbp.mock.calls.map(([id])=>id)).toEqual(['0022600001','0022600003']);expect((await response.json()).totalGames).toBe(2);
});
it('a failed first batch stops later PBP requests instead of spending all30',async()=>{
 mocks.stats.mockResolvedValue(ok(log(Array.from({length:12},(_,i)=>`00225${String(i).padStart(5,'0')}`))));mocks.pbp.mockResolvedValue({shots:[],available:false,stale:false});const response=await GET(request(query));expect(response.status).toBe(503);expect(mocks.pbp).toHaveBeenCalledTimes(5);
});

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createPlayerCareerLoader, CAREER_FAILURE_COOLDOWN_MS, CAREER_SUCCESS_TTL_MS } from "./player-career-cache";
import { normalizePlayerCareerData } from "./player-career-data";
const row = { SEASON_ID: "2025-26", TEAM_ABBREVIATION: "LAL", GP: 70, MIN: 30, PTS: 20, REB: 5, AST: 6, STL: 1, BLK: 0, FG_PCT: .5, FG3_PCT: null, FT_PCT: .8 };
const data = { careerSeasons: [row] };
const ok = (body: unknown = data) => ({ ok: true, json: async () => body }) as Response;
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
it("accepts zero and nullable optional shooting fields without filling values", () => {
  const raw={careerSeasons:[{...row,PTS:0,FGA:null}]}; expect(normalizePlayerCareerData(raw)).toEqual(raw);
});
it.each([null,{}, {careerSeasons:null}, {careerSeasons:[{...row,PTS:null}]}, {careerSeasons:[{...row,PTS:NaN}]}])("rejects unavailable or malformed payload %j", raw => expect(normalizePlayerCareerData(raw)).toBeNull());
it("keeps valid source empty distinct from unavailable", async () => {
  const fetcher=vi.fn().mockResolvedValue(ok({careerSeasons:[]})); const load=createPlayerCareerLoader(fetcher);
  expect(await load('/one')).toEqual({data:{careerSeasons:[]},unavailable:false,stale:false}); expect(await load('/one')).toHaveProperty('unavailable',false); expect(fetcher).toHaveBeenCalledTimes(1);
});
it("shares inflight work and accepts slow valid response after the former10s cutoff", async () => {
  const fetcher=vi.fn(()=>new Promise<Response>(resolve=>setTimeout(()=>resolve(ok()),12000)));
  const load=createPlayerCareerLoader(fetcher); const a=load('/one');const b=load('/one');expect(a).toBe(b);
  await vi.advanceTimersByTimeAsync(12000); expect(await a).toEqual({data,unavailable:false,stale:false});expect(fetcher).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});
it("failure cooldown avoids duplicate requests but permits subsequent explicit recovery", async () => {
  const fetcher=vi.fn().mockResolvedValueOnce({ok:false,status:503}).mockResolvedValue(ok()); const load=createPlayerCareerLoader(fetcher);
  expect(await load('/one')).toEqual({data:null,unavailable:true,stale:false});await load('/one',true);expect(fetcher).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(CAREER_FAILURE_COOLDOWN_MS);expect(await load('/one',true)).toHaveProperty('data',data);expect(fetcher).toHaveBeenCalledTimes(2);
});
it("a legacy cached HTTP200 null is not pinned as success", async () => {
  const fetcher=vi.fn().mockResolvedValueOnce(ok({careerSeasons:null})).mockResolvedValue(ok());const load=createPlayerCareerLoader(fetcher);
  expect(await load('/one')).toHaveProperty('unavailable',true);await vi.advanceTimersByTimeAsync(CAREER_FAILURE_COOLDOWN_MS);expect(await load('/one')).toHaveProperty('data',data);
});
it("preserves last validated data after failed or malformed refresh and recovers", async () => {
  const fetcher=vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok({careerSeasons:'bad'})).mockResolvedValue(ok({careerSeasons:[{...row,PTS:22}]})); const load=createPlayerCareerLoader(fetcher);
  await load('/one');await vi.advanceTimersByTimeAsync(CAREER_SUCCESS_TTL_MS);expect(await load('/one')).toEqual({data,unavailable:true,stale:true});
  await vi.advanceTimersByTimeAsync(CAREER_FAILURE_COOLDOWN_MS);expect((await load('/one')).data?.careerSeasons[0].PTS).toBe(22);
});
it.each(['response','body'])("18s deadline cancels stalled %s and cleans timer", async stage => {
  const fetcher=vi.fn((_url,options)=>{const signal=options!.signal!;const stall=()=>new Promise<never>((_r,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('abort','AbortError'))));return stage==='response'?stall():Promise.resolve({ok:true,json:stall} as unknown as Response);});
  const load=createPlayerCareerLoader(fetcher);const p=load('/one');await vi.advanceTimersByTimeAsync(18000);expect(await p).toHaveProperty('unavailable',true);expect(vi.getTimerCount()).toBe(0);
});
it("does not poll after failure or success",async()=>{const fetcher=vi.fn().mockResolvedValue(ok());const load=createPlayerCareerLoader(fetcher);await load('/one');await vi.advanceTimersByTimeAsync(86400000);expect(fetcher).toHaveBeenCalledTimes(1);});
it("notifies both mounted career consumers when either triggers recovery",async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce({ok:false,status:503}).mockResolvedValue(ok());const load=createPlayerCareerLoader(fetcher);
  const table=vi.fn(),advanced=vi.fn();const unsub=load.subscribe('/one',table);load.subscribe('/one',advanced);
  await load('/one');expect(table).toHaveBeenLastCalledWith({data:null,unavailable:true,stale:false});
  await vi.advanceTimersByTimeAsync(CAREER_FAILURE_COOLDOWN_MS);await load('/one',true);
  expect(table).toHaveBeenLastCalledWith({data,unavailable:false,stale:false});expect(advanced).toHaveBeenLastCalledWith({data,unavailable:false,stale:false});
  unsub();await load('/one',true);expect(table).toHaveBeenCalledTimes(2);expect(advanced).toHaveBeenCalledTimes(3);
});

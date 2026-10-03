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
it('empty refresh preserves last-good rows for both consumers, cooldown, and later recovery', async () => {
  const fresh = {careerSeasons:[{...row,PTS:22}]};
  const fetcher = vi.fn().mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok({careerSeasons:[]})).mockResolvedValue(ok(fresh));
  const load = createPlayerCareerLoader(fetcher);
  const table = vi.fn(), advanced = vi.fn(); load.subscribe('/one',table);load.subscribe('/one',advanced);
  await load('/one'); await vi.advanceTimersByTimeAsync(CAREER_SUCCESS_TTL_MS);
  const a = load('/one'), b = load('/one',true); expect(a).toBe(b);
  expect(await a).toEqual({data,unavailable:true,stale:true});
  expect(table).toHaveBeenLastCalledWith({data,unavailable:true,stale:true});
  expect(advanced).toHaveBeenLastCalledWith({data,unavailable:true,stale:true});
  expect(await load('/one',true)).toEqual({data,unavailable:true,stale:true}); expect(fetcher).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(CAREER_FAILURE_COOLDOWN_MS);
  expect(await load('/one',true)).toEqual({data:fresh,unavailable:false,stale:false});
  expect(table).toHaveBeenLastCalledWith({data:fresh,unavailable:false,stale:false});
  expect(advanced).toHaveBeenLastCalledWith({data:fresh,unavailable:false,stale:false});
});
it('zero-valued known career rows are retained across empty refresh',async()=>{
  const zero={careerSeasons:[{...row,GP:0,MIN:0,PTS:0,REB:0,AST:0,STL:0,BLK:0}]};
  const fetcher=vi.fn().mockResolvedValueOnce(ok(zero)).mockResolvedValue(ok({careerSeasons:[]}));const load=createPlayerCareerLoader(fetcher);
  await load('/one');expect(await load('/one',true)).toEqual({data:zero,unavailable:true,stale:true});
});
it('another player valid empty response cannot borrow retained rows',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(ok()).mockResolvedValue(ok({careerSeasons:[]}));const load=createPlayerCareerLoader(fetcher);
  await load('/one');expect(await load('/two')).toEqual({data:{careerSeasons:[]},unavailable:false,stale:false});
});
it('an initially empty career can recover on explicit retry',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(ok({careerSeasons:[]})).mockResolvedValue(ok());const load=createPlayerCareerLoader(fetcher);
  await load('/one');expect(await load('/one',true)).toEqual({data,unavailable:false,stale:false});
});

it('retains the complete last-good snapshot and source when a nonempty refresh loses a season', async () => {
  const history = {
    careerSeasons: [{ ...row, SEASON_ID: '2024-25' }, row],
    careerShooting: { source: 'nba-career-totals', FG_PCT: .48, FG3_PCT: null, FT_PCT: .79 },
  };
  const recovered = { ...history, careerSeasons: [history.careerSeasons[0], { ...row, GP: 72, PTS: 21 }] };
  const fetcher = vi.fn().mockResolvedValueOnce(ok(history))
    .mockResolvedValueOnce(ok({ careerSeasons: [{ ...row, PTS: 99 }] }))
    .mockResolvedValue(ok(recovered));
  const load = createPlayerCareerLoader(fetcher);
  const table = vi.fn(), advanced = vi.fn();
  load.subscribe('/one', table); load.subscribe('/one', advanced);

  const accepted = await load('/one');
  await vi.advanceTimersByTimeAsync(CAREER_SUCCESS_TTL_MS);
  const retained = { data: history, unavailable: true, stale: true };
  const refresh = load('/one');
  expect(load('/one', true)).toBe(refresh);
  expect(await refresh).toEqual(retained);
  // Do not merge the new partial data into the old provider snapshot.
  expect((await refresh).data).toBe(accepted.data);
  expect(table).toHaveBeenLastCalledWith(retained);
  expect(advanced).toHaveBeenLastCalledWith(retained);
  expect(await load('/one')).toEqual(retained);
  expect(fetcher).toHaveBeenCalledTimes(2);

  // A rejected refresh expires the cache: a normal mount can recover after
  // the failure cooldown, rather than treating the truncated data as fresh.
  await vi.advanceTimersByTimeAsync(CAREER_FAILURE_COOLDOWN_MS);
  expect(await load('/one')).toEqual({ data: recovered, unavailable: false, stale: false });
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('detects missing season identities even when the row count stays the same', async () => {
  const history = { careerSeasons: [{ ...row, SEASON_ID: '2024-25' }, row] };
  const replacement = { careerSeasons: [row, { ...row, SEASON_ID: '2026-27' }] };
  const fetcher = vi.fn().mockResolvedValueOnce(ok(history)).mockResolvedValue(ok(replacement));
  const load = createPlayerCareerLoader(fetcher);
  await load('/one');
  expect(await load('/one', true)).toEqual({ data: history, unavailable: true, stale: true });
});

it('accepts current-season corrections, new seasons, and provider team-split changes with complete season coverage', async () => {
  const history = { careerSeasons: [
    { ...row, SEASON_ID: '2024-25', TEAM_ABBREVIATION: 'TOT' },
    { ...row, SEASON_ID: '2024-25', TEAM_ABBREVIATION: 'LAL' },
    { ...row, SEASON_ID: '2024-25', TEAM_ABBREVIATION: 'NYK' },
    row,
  ] };
  const updated = { careerSeasons: [
    { ...row, SEASON_ID: '2024-25', TEAM_ABBREVIATION: 'TOT' },
    { ...row, GP: 69, PTS: 21 },
  ] };
  const extended = { careerSeasons: [...updated.careerSeasons, { ...row, SEASON_ID: '2026-27', GP: 1 }] };
  const fetcher = vi.fn().mockResolvedValueOnce(ok(history)).mockResolvedValueOnce(ok(updated)).mockResolvedValue(ok(extended));
  const load = createPlayerCareerLoader(fetcher);
  await load('/one');
  expect(await load('/one', true)).toEqual({ data: updated, unavailable: false, stale: false });
  expect(await load('/one', true)).toEqual({ data: extended, unavailable: false, stale: false });
});

it('keeps season coverage scoped to the exact player and request contract', async () => {
  const history = { careerSeasons: [{ ...row, SEASON_ID: '2024-25' }, row] };
  const fetcher = vi.fn().mockResolvedValueOnce(ok(history)).mockResolvedValue(ok(data));
  const load = createPlayerCareerLoader(fetcher);
  const regular = '/api/player?id=2544&context=2&seasonType=Regular+Season';
  await load(regular);
  // Career currently returns regular-season rows only. If a separate contract
  // is introduced, its URL must not inherit another season type's coverage.
  expect(await load('/api/player?id=2544&context=2&seasonType=Playoffs'))
    .toEqual({ data, unavailable: false, stale: false });
  expect(await load('/api/player?id=201939&context=2&seasonType=Regular+Season'))
    .toEqual({ data, unavailable: false, stale: false });
});

import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import {createRecoveryProviderClient} from './recovery-provider-client';
import {RECOVERY_DAILY_LIMIT} from './recovery-run-budget';
const id='5ce3b301-7023-433a-b8d1-ce8ee1b306be',key='TEST_ONLY_NOT_A_REAL_KEY';
const config=(fetcher:typeof fetch,maxRequests=2)=>({apiKey:key,maxRequests,expiresAt:'2026-10-03T00:00:00Z',fetcher});
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-02T03:17:00Z'));});afterEach(()=>vi.useRealTimers());
it('missing configuration never reads/fetches a provider',async()=>{const f=vi.fn();const c=createRecoveryProviderClient({...config(f),apiKey:''});expect(await c.getStats(id)).toHaveProperty('reason','not-configured');expect(f).not.toHaveBeenCalled();});
it('fixed host/header and redirect policy keep credentials out of URLs',async()=>{const f=vi.fn().mockResolvedValue(new Response('{}'));const c=createRecoveryProviderClient(config(f));await c.getStats(id);expect(f).toHaveBeenCalledWith(`https://api.bigballsdata.com/v1/stored/matches/${id}/stats`,expect.objectContaining({headers:{'x-api-key':key,Accept:'application/json'},redirect:'error'}));expect(f.mock.calls[0][0]).not.toContain(key);});
it('concurrent calls reserve before await and cannot exceed job allocation',async()=>{const f=vi.fn().mockImplementation(async()=>new Response('{}'));const c=createRecoveryProviderClient(config(f,2));const r=await Promise.all([c.getStats(id),c.getStats(id),c.getStats(id)]);expect(f).toHaveBeenCalledTimes(2);expect(r[2].ok).toBe(false);expect(c.requestsMade).toBe(2);});
it.each([401,402,403,404,429,500])('HTTP%s stops batch without retry/refund or upgrade',async status=>{const f=vi.fn().mockResolvedValue(new Response('do not expose',{status}));const c=createRecoveryProviderClient(config(f));expect(await c.getStats(id)).toMatchObject({ok:false,httpStatus:status});await c.getStats(id);expect(f).toHaveBeenCalledTimes(1);expect(c.requestsMade).toBe(1);});
it('exhausted providerheader stops nextrequest even below local allocation',async()=>{const f=vi.fn().mockResolvedValue(new Response('{}',{headers:{'x-ratelimit-remaining':'0'}}));const c=createRecoveryProviderClient(config(f));expect((await c.getStats(id)).ok).toBe(true);expect((await c.getStats(id)).ok).toBe(false);expect(f).toHaveBeenCalledTimes(1);});
it('network errors never reveal credential-bearing exception messages',async()=>{const f=vi.fn().mockRejectedValue(new Error(key));const c=createRecoveryProviderClient(config(f));expect(JSON.stringify(await c.getStats(id))).not.toContain(key);expect(c.requestsMade).toBe(1);});
it.each(['headers','body'])('8s deadline bounds even noncooperative%s andcleans timer',async stage=>{const f=vi.fn().mockImplementation(()=>stage==='headers'?new Promise(()=>{}):Promise.resolve({status:200,headers:new Headers(),text:()=>new Promise(()=>{})}));const c=createRecoveryProviderClient(config(f));const p=c.getStats(id);await vi.advanceTimersByTimeAsync(8000);expect((await p).ok).toBe(false);expect(c.requestsMade).toBe(1);expect(vi.getTimerCount()).toBe(0);});
it('day boundary aborts inflight and never resets samejob allowance',async()=>{vi.setSystemTime(new Date('2026-10-02T23:59:59Z'));const f=vi.fn().mockImplementation(()=>new Promise(()=>{}));const c=createRecoveryProviderClient(config(f));const p=c.getStats(id);await vi.advanceTimersByTimeAsync(1000);expect((await p).ok).toBe(false);expect((await c.getStats(id)).ok).toBe(false);expect(f).toHaveBeenCalledTimes(1);});
it('two-minute batch deadline stops future work without polling',async()=>{const f=vi.fn().mockResolvedValue(new Response('{}'));const c=createRecoveryProviderClient(config(f));await vi.advanceTimersByTimeAsync(120000);expect((await c.getStats(id)).ok).toBe(false);expect(f).not.toHaveBeenCalled();});
it('untrusted IDs cannot redirect requests',async()=>{const f=vi.fn();const c=createRecoveryProviderClient(config(f));expect((await c.getStats('../../other?key=secret')).ok).toBe(false);expect(f).not.toHaveBeenCalled();});

it('accepts an explicit 100-call allowance below the approved daily cap',()=>{
  const f=vi.fn();
  expect(()=>createRecoveryProviderClient(config(f,100))).not.toThrow();
  expect(f).not.toHaveBeenCalled();
});
it('reserves at most the approved 230 calls even when all requests start concurrently',async()=>{
  expect(RECOVERY_DAILY_LIMIT).toBe(230);
  const f=vi.fn().mockImplementation(async()=>new Response('{}'));
  const c=createRecoveryProviderClient(config(f,RECOVERY_DAILY_LIMIT));
  const results=await Promise.all(Array.from({length:RECOVERY_DAILY_LIMIT+1},()=>c.getStats(id)));
  expect(results.filter(result=>result.ok)).toHaveLength(RECOVERY_DAILY_LIMIT);
  expect(results[RECOVERY_DAILY_LIMIT]).toMatchObject({ok:false,reason:'budget-or-deadline-exhausted'});
  expect(f).toHaveBeenCalledTimes(RECOVERY_DAILY_LIMIT);
  expect(c.requestsMade).toBe(RECOVERY_DAILY_LIMIT);
  expect(vi.getTimerCount()).toBe(0);
});
it.each([-1,0.5,NaN,Infinity,RECOVERY_DAILY_LIMIT+1,250])('rejects invalid or over-cap allowance %s before fetching',maxRequests=>{
  const f=vi.fn();
  expect(()=>createRecoveryProviderClient(config(f,maxRequests))).toThrow('Invalid bounded provider allowance');
  expect(f).not.toHaveBeenCalled();
});
it('a zero allocation is valid but makes no provider requests',async()=>{
  const f=vi.fn();
  const c=createRecoveryProviderClient(config(f,0));
  expect(await c.getStats(id)).toMatchObject({ok:false,reason:'budget-or-deadline-exhausted'});
  expect(c.requestsMade).toBe(0);
  expect(f).not.toHaveBeenCalled();
});

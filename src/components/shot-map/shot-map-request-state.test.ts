import { afterEach, describe, expect, it, vi } from 'vitest';
import { retainSelection, startSeasonRequest } from './shot-map-request-state';
const identity={playerId:201939,season:'2025-26',seasonType:'Regular Season' as const};
const url=()=>'/api/player-season-shot-map';
const decode=(value:unknown)=>value as {status:'ready';data:{season:string}}|{status:'unavailable'}|{status:'error'};
function deferred<T>() {let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
describe('selection request lifecycle',()=>{
 it('ignores stale transport completion after rapid switching and unmount',async()=>{
  const old=deferred<Response>(),fresh=deferred<Response>(),fetch=vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);vi.stubGlobal('fetch',fetch);
  const first=vi.fn(),second=vi.fn();const cancel=startSeasonRequest(identity,url,decode,first);cancel();
  startSeasonRequest({...identity,season:'2015-16'},url,decode,second);
  fresh.resolve(new Response(JSON.stringify({status:'ready',data:{season:'2015-16'}})));await vi.waitFor(()=>expect(second).toHaveBeenLastCalledWith({status:'ready',data:{season:'2015-16'}}));
  old.resolve(new Response(JSON.stringify({status:'ready',data:{season:'2025-26'}})));await new Promise(resolve=>setTimeout(resolve,0));
  expect(first.mock.calls).toEqual([[{status:'loading'}]]);expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
 });
 it('times out once and ignores a later response, then retries without HTTP cache',async()=>{
  vi.useFakeTimers();const old=deferred<Response>();vi.stubGlobal('fetch',vi.fn().mockReturnValue(old.promise));const update=vi.fn();
  startSeasonRequest(identity,url,decode,update);await vi.advanceTimersByTimeAsync(8000);expect(update).toHaveBeenLastCalledWith({status:'error'});
  old.resolve(new Response(JSON.stringify({status:'ready',data:{season:'2025-26'}})));await vi.advanceTimersByTimeAsync(1);expect(update).toHaveBeenCalledTimes(2);
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'ready',data:{season:'2025-26'}}))));const retry=vi.fn();startSeasonRequest(identity,url,decode,retry,true);await vi.advanceTimersByTimeAsync(1);
  expect(fetch).toHaveBeenCalledWith(url(),expect.objectContaining({cache:'no-store'}));expect(retry).toHaveBeenLastCalledWith({status:'ready',data:{season:'2025-26'}});
 });
 it.each([[404,'unavailable','unavailable'],[500,'ready','error'],[200,'error','error'],[200,'unavailable','error']] as const)('does not turn HTTP %s / %s into valid data',async(status,state,expected)=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({status:state}),{status})));const update=vi.fn();startSeasonRequest(identity,url,decode,update);await vi.waitFor(()=>expect(update).toHaveBeenLastCalledWith({status:expected}));
 });
 it('bounds caches to eight selections and refreshes replacement order',()=>{
  const map=new Map<string,number>();for(let i=0;i<20;i++)retainSelection(map,String(i),i);expect(map.size).toBe(8);expect([...map.keys()]).toEqual(['12','13','14','15','16','17','18','19']);retainSelection(map,'12',120);retainSelection(map,'20',20);expect(map.has('12')).toBe(true);expect(map.has('13')).toBe(false);
 });
});

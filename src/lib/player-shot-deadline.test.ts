import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {PLAYER_SHOT_REQUEST_TIMEOUT_MS,requestPlayerShotData} from './player-shot-request';
import {getGamePlayByPlay,EMPTY_PLAY_BY_PLAY} from './game-play-by-play';
beforeEach(()=>vi.useFakeTimers());afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
const data={shots:[],gamesLoaded:0,totalGames:0};
it.each(['fetch','body'])('shot deadline settles a noncooperative %s, aborts and cleans timer',async stage=>{
 let signal!:AbortSignal;const never=()=>new Promise<never>(()=>{});
 vi.stubGlobal('fetch',vi.fn((_url,opts)=>{signal=opts.signal;return stage==='fetch'?never():Promise.resolve({ok:true,json:never});}));
 const outcome=requestPlayerShotData('/api/player-shots',new AbortController().signal).catch(error=>error);
 await vi.advanceTimersByTimeAsync(PLAYER_SHOT_REQUEST_TIMEOUT_MS);expect(await outcome).toBeInstanceOf(Error);expect(signal.aborted).toBe(true);expect(vi.getTimerCount()).toBe(0);
});
it('a legitimate slow aggregation is not cut off at the old9-secondcareerlimit',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:()=>new Promise(resolve=>setTimeout(()=>resolve(data),64000))})));
 const result=requestPlayerShotData('/shots',new AbortController().signal);await vi.advanceTimersByTimeAsync(64000);expect(await result).toEqual(data);expect(vi.getTimerCount()).toBe(0);
});
it('supersede cancellation settles despite a noncooperative body',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:()=>new Promise(()=>{})})));const c=new AbortController();const result=requestPlayerShotData('/shots',c.signal).catch(error=>error);await Promise.resolve();c.abort();expect(await result).toBeInstanceOf(DOMException);expect(vi.getTimerCount()).toBe(0);
});
it.each(['fetch','body'])('PBP8seconddeadline also settles noncooperative%s',async stage=>{
 let signal!:AbortSignal;const never=()=>new Promise<never>(()=>{});vi.stubGlobal('fetch',vi.fn((_url,opts)=>{signal=opts.signal;return stage==='fetch'?never():Promise.resolve({ok:true,json:never});}));
 const result=getGamePlayByPlay('0022500961');await vi.advanceTimersByTimeAsync(8000);expect(await result).toBe(EMPTY_PLAY_BY_PLAY);expect(signal.aborted).toBe(true);expect(vi.getTimerCount()).toBe(0);
});
it('successful shot response preserves null rejection and realzero coordinates',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({shots:[{x:0,y:0,shotDistance:0,shotResult:'Made'}],gamesLoaded:1,totalGames:1})})));expect((await requestPlayerShotData('/shots',new AbortController().signal)).shots[0].x).toBe(0);expect(vi.getTimerCount()).toBe(0);});

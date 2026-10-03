import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const hooks=vi.hoisted(()=>({index:0,slots:[] as unknown[],effects:[] as (()=>void)[],load:vi.fn()}));
vi.mock('./player-career-cache',()=>({createPlayerCareerLoader:()=>Object.assign(hooks.load,{subscribe:()=>()=>{},seed:()=>{},read:()=>null})}));
vi.mock('react',()=>({
 useRef:(initial:unknown)=>{const i=hooks.index++;if(!(i in hooks.slots))hooks.slots[i]={current:initial};return hooks.slots[i];},
 useState:(initial:unknown)=>{const i=hooks.index++;if(!(i in hooks.slots))hooks.slots[i]=initial;return[hooks.slots[i],(v:unknown)=>{hooks.slots[i]=typeof v==='function'?v(hooks.slots[i]):v;}];},
 useEffect:(run:()=>void|(()=>void),deps:unknown[])=>{const i=hooks.index++;const old=hooks.slots[i] as {deps:unknown[];cleanup?:()=>void}|undefined;if(!old||deps.some((v,n)=>!Object.is(v,old.deps[n])))hooks.effects.push(()=>{old?.cleanup?.();hooks.slots[i]={deps,cleanup:run()};});},
}));
import {usePlayerCareer} from './usePlayerCareer';
// Deterministic test harness, not a rendered production component.
// eslint-disable-next-line react-hooks/immutability
function RenderHook(id=2544){hooks.index=0;const value=usePlayerCareer(id,'Name','LAL');hooks.effects.splice(0).forEach(f=>f());return value;}
function unmount(){hooks.slots.forEach(x=>(x as {cleanup?:()=>void}|undefined)?.cleanup?.());}
const good={data:{careerSeasons:[]},unavailable:false,stale:false};
beforeEach(()=>{hooks.index=0;hooks.slots=[];hooks.effects=[];hooks.load.mockReset();});
afterEach(unmount);
it('uses versioned URL and exposes successful empty data',async()=>{hooks.load.mockResolvedValue(good);RenderHook();await Promise.resolve();expect(RenderHook().data).toEqual(good.data);expect(hooks.load).toHaveBeenCalledWith('/api/player?id=2544&context=2&name=Name&team=LAL',false);});
it('navigation immediately hides previous-player data and ignores old completion',async()=>{let finishOld!:(v:typeof good)=>void;hooks.load.mockImplementationOnce(()=>new Promise(r=>{finishOld=r;})).mockResolvedValue(good);RenderHook();expect(RenderHook(201939).data).toBeNull();await Promise.resolve();finishOld({...good,data:{careerSeasons:[{SEASON_ID:'old'}] as never[]}});await Promise.resolve();expect(RenderHook(201939).data).toEqual(good.data);});
it('unmounted consumer ignores completion',async()=>{let finish!:(v:typeof good)=>void;hooks.load.mockImplementation(()=>new Promise(r=>{finish=r;}));RenderHook();unmount();const old=hooks.slots[0];finish(good);await Promise.resolve();expect(hooks.slots[0]).toBe(old);});
it('explicit retry requests refresh then replaces unavailable with recovered data',async()=>{hooks.load.mockResolvedValueOnce({data:null,unavailable:true,stale:false}).mockResolvedValue(good);RenderHook();await Promise.resolve();const failed=RenderHook();expect(failed.error).toBe(true);failed.retry();RenderHook();await Promise.resolve();expect(RenderHook().error).toBe(false);expect(hooks.load).toHaveBeenLastCalledWith(expect.any(String),true);});

it('retry does not force requests for a later player URL',async()=>{hooks.load.mockResolvedValue(good);RenderHook();await Promise.resolve();RenderHook().retry();RenderHook();await Promise.resolve();RenderHook(201939);expect(hooks.load).toHaveBeenLastCalledWith(expect.stringContaining('id=201939'),false);});

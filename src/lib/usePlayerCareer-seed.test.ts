import { expect, it, vi } from 'vitest';
import type { PlayerCareerData } from './player-career-data';
const runtime=vi.hoisted(()=>({index:0,slots:[] as unknown[],effects:[] as (()=>(()=>void)|void)[]}));
vi.mock('react',()=>({
 useRef:(initial:unknown)=>{const i=runtime.index++;if(!(i in runtime.slots))runtime.slots[i]={current:initial};return runtime.slots[i];},
 useState:(initial:unknown)=>{const i=runtime.index++;const slots=runtime.slots;if(!(i in slots))slots[i]=initial;return[slots[i],(v:unknown)=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},
 useEffect:(run:()=>(()=>void)|void,deps:unknown[])=>{const i=runtime.index++;const old=runtime.slots[i] as unknown[]|undefined;if(!old||deps.some((v,n)=>!Object.is(v,old[n])))runtime.effects.push(run);runtime.slots[i]=deps;},
}));
import { usePlayerCareer } from './usePlayerCareer';
import { normalizePlayerCareerData } from './player-career-data';
import archive from '@/data/player-career-archives/2544-2026-10-03.json';
const seed=normalizePlayerCareerData(archive.data)!;
// Deterministic effect replay fixture, not a React DOM/browser StrictMode test.
it('initial rows precede effects; concurrent consumers and StrictMode effect replay share one request',async()=>{
 let finish!:(r:Response)=>void;const fetcher=vi.fn(()=>new Promise<Response>(r=>{finish=r;}));vi.stubGlobal('fetch',fetcher);
 const a:unknown[]=[],b:unknown[]=[];
 const RenderHook=(slots:unknown[],id=2544,initial?:PlayerCareerData)=>{runtime.slots=slots;runtime.index=0;return usePlayerCareer(id,'seed replay','LAL',initial);};
 const first=RenderHook(a,2544,seed);expect(first.data).toEqual(seed);expect(first.loading).toBe(true);expect(first.error).toBe(false);expect(fetcher).not.toHaveBeenCalled();
 const setupA=runtime.effects.shift()!;const cleanupA=setupA();cleanupA?.();const cleanupReplay=setupA();
 expect(RenderHook(b,2544,seed).data).toEqual(seed);const cleanupB=runtime.effects.shift()!();expect(fetcher).toHaveBeenCalledTimes(1);
 // Navigation must hide old identity immediately even before its effect commits.
 expect(RenderHook(a,201939,seed).data).toBeNull();runtime.effects=[];cleanupReplay?.();
 finish({ok:false,status:503} as Response);await new Promise(r=>setTimeout(r,0));
 expect(RenderHook(b,2544,seed)).toMatchObject({data:seed,loading:false,error:true,stale:true});cleanupB?.();vi.unstubAllGlobals();
});

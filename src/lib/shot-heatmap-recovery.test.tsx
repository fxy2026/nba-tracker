import { isValidElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import en from '@/locales/en';
const hooks=vi.hoisted(()=>({index:0,slots:[] as unknown[],effects:[] as (()=>void)[]}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),
 useState:(initial:unknown)=>{const i=hooks.index++;if(!(i in hooks.slots))hooks.slots[i]=initial;return[hooks.slots[i],(v:unknown)=>{hooks.slots[i]=typeof v==='function'?v(hooks.slots[i]):v;}];},
 useRef:(initial:unknown)=>{const i=hooks.index++;if(!(i in hooks.slots))hooks.slots[i]={current:initial};return hooks.slots[i];},
 useMemo:(fn:()=>unknown)=>fn(),useCallback:(fn:unknown)=>fn,
 useEffect:(run:()=>void|(()=>void),deps:unknown[])=>{const i=hooks.index++;const old=hooks.slots[i] as {deps:unknown[];cleanup?:()=>void}|undefined;
 // Callback identity is not modeled by this small deterministic hook harness.
 if(!old||deps.slice(0,2).some((v,n)=>!Object.is(v,old.deps[n])))hooks.effects.push(()=>{old?.cleanup?.();hooks.slots[i]={deps,cleanup:run()};});},
}));
vi.mock('@/components/LocaleProvider',()=>({useLocale:()=>({locale:'en',t:en})}));
import ShotHeatmap from '@/components/ShotHeatmap';
function draw(){hooks.index=0;const node=ShotHeatmap({playerId:2544,teamTricode:'LAL',fromYear:'2024',toYear:'2025'});hooks.effects.splice(0).forEach(f=>f());return node;}
function find(node:ReactNode,type:string):Record<string,unknown>[] {if(Array.isArray(node))return node.flatMap(n=>find(n,type));if(!isValidElement<Record<string,unknown>>(node))return[];return[...(node.type===type?[node.props]:[]),...find(node.props.children as ReactNode,type)];}
const shots=(made:boolean)=>({shots:[{x:0,y:5,shotDistance:5,shotResult:made?'Made':'Missed'}],gamesLoaded:1,totalGames:1});
const response=(data:unknown)=>({ok:true,json:async()=>data});
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
function unmount(){hooks.slots.forEach(x=>(x as {cleanup?:()=>void}|undefined)?.cleanup?.());}
beforeEach(()=>{hooks.slots=[];hooks.effects=[];hooks.index=0;vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-02T00:00:00Z'));});
afterEach(()=>{unmount();vi.unstubAllGlobals();vi.useRealTimers();});
it('actual default selector requests its archived season, not current season',async()=>{const fetcher=vi.fn().mockResolvedValue(response(shots(true)));vi.stubGlobal('fetch',fetcher);draw();await flush();expect(fetcher.mock.calls[0][0]).toContain('season=2025-26');expect(find(draw(),'select')[0].value).toBe('2025-26');});
it('superseded body cannot overwrite the newly selected season',async()=>{let oldBody!:(v:unknown)=>void;const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:()=>new Promise(r=>{oldBody=r;})}).mockResolvedValueOnce(response(shots(true)));vi.stubGlobal('fetch',fetcher);draw();await flush();const select=find(draw(),'select')[0];(select.onChange as (e:unknown)=>void)({target:{value:'2024-25'}});draw();await flush();oldBody(shots(false));await flush();const svg=find(draw(),'svg').find(p=>p.role==='img')!;expect(svg['aria-label']).toContain('2024-25');expect(svg['aria-label']).toContain('100.0%');expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);});
it('nullresponse exposes manualretry and subsequentvaliddatarecovers',async()=>{const fetcher=vi.fn().mockResolvedValueOnce(response(null)).mockResolvedValueOnce(response(shots(true)));vi.stubGlobal('fetch',fetcher);draw();await flush();const retry=find(draw(),'button').find(p=>p.children==='Retry')!;expect(retry).toBeDefined();(retry.onClick as ()=>void)();await flush();expect(find(draw(),'svg').some(p=>p.role==='img')).toBe(true);expect(fetcher).toHaveBeenCalledTimes(2);});
it('unmount aborts request without applying late data',async()=>{let body!:(v:unknown)=>void;const fetcher=vi.fn().mockResolvedValue({ok:true,json:()=>new Promise(r=>{body=r;})});vi.stubGlobal('fetch',fetcher);draw();await flush();unmount();const before=[...hooks.slots];body(shots(true));await flush();expect(hooks.slots).toEqual(before);expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);});

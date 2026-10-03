import { isValidElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import en from '@/locales/en';
import zh from '@/locales/zh';
import { PLAYER_SHOT_REQUEST_TIMEOUT_MS } from './player-shot-request';
const hooks=vi.hoisted(()=>({index:0,slots:[] as unknown[],effects:[] as (()=>void)[],locale:'en'}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),
 useState:(initial:unknown)=>{const i=hooks.index++;if(!(i in hooks.slots))hooks.slots[i]=initial;return[hooks.slots[i],(v:unknown)=>{hooks.slots[i]=typeof v==='function'?v(hooks.slots[i]):v;}];},
 useRef:(initial:unknown)=>{const i=hooks.index++;if(!(i in hooks.slots))hooks.slots[i]={current:initial};return hooks.slots[i];},
 useMemo:(fn:()=>unknown)=>fn(),useCallback:(fn:unknown)=>fn,
 useEffect:(run:()=>void|(()=>void),deps:unknown[])=>{const i=hooks.index++;const old=hooks.slots[i] as {deps:unknown[];cleanup?:()=>void}|undefined;
 // Callback identity is not modeled by this small deterministic hook harness.
 if(!old||deps.slice(0,2).some((v,n)=>!Object.is(v,old.deps[n])))hooks.effects.push(()=>{old?.cleanup?.();hooks.slots[i]={deps,cleanup:run()};});},
}));
vi.mock('@/components/LocaleProvider',()=>({useLocale:()=>({locale:hooks.locale,t:hooks.locale==='zh'?zh:en})}));
import ShotHeatmap from '@/components/ShotHeatmap';
import Select from '@/components/ui/Select';
import { AbsoluteShotLegend, ShotSampleCoverage } from '@/components/ShotSampleContext';
function draw(){hooks.index=0;const node=ShotHeatmap({playerId:2544,teamTricode:'LAL',fromYear:'2024',toYear:'2025'});hooks.effects.splice(0).forEach(f=>f());return node;}
function find(node:ReactNode,type:unknown):Record<string,unknown>[] {if(Array.isArray(node))return node.flatMap(n=>find(n,type));if(!isValidElement<Record<string,unknown>>(node))return[];return[...(node.type===type?[node.props]:[]),...find(node.props.children as ReactNode,type)];}
const shots=(made:boolean)=>({shots:[{x:0,y:5,shotDistance:5,shotResult:made?'Made':'Missed'}],gamesLoaded:1,totalGames:1});
const response=(data:unknown)=>({ok:true,json:async()=>data});
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function unmount(){hooks.slots.forEach(x=>(x as {cleanup?:()=>void}|undefined)?.cleanup?.());}
beforeEach(()=>{hooks.slots=[];hooks.effects=[];hooks.index=0;hooks.locale='en';vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-02T00:00:00Z'));});
afterEach(()=>{unmount();vi.unstubAllGlobals();vi.useRealTimers();});
it('actual default selector requests its archived season, not current season',async()=>{const fetcher=vi.fn().mockResolvedValue(response(shots(true)));vi.stubGlobal('fetch',fetcher);draw();await flush();expect(fetcher.mock.calls[0][0]).toContain('season=2025-26');expect(find(draw(),Select)[0].value).toBe('2025-26');});
it.each(['en','zh'])('shared season selector keeps archive options and a same-value live request (%s)',async locale=>{
 hooks.locale=locale;const fetcher=vi.fn().mockImplementation(()=>new Promise(()=>{}));vi.stubGlobal('fetch',fetcher);draw();await flush();
 const tree=draw(),select=find(tree,Select)[0];
 expect(select['aria-label']).toBe(locale==='en'?'Season':'选择赛季');
 expect(select.options).toEqual([{value:'2025-26',label:'2025-26'},{value:'2024-25',label:'2024-25'}]);
 expect(find(tree,'select')).toHaveLength(0);
 (select.onValueChange as (value:string)=>void)('2025-26');draw();await flush();
 expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0][1].signal.aborted).toBe(false);
});
it('superseded body cannot overwrite the newly selected season',async()=>{let oldBody!:(v:unknown)=>void;const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:()=>new Promise(r=>{oldBody=r;})}).mockResolvedValueOnce(response(shots(true)));vi.stubGlobal('fetch',fetcher);draw();await flush();const select=find(draw(),Select)[0];(select.onValueChange as (value:string)=>void)('2024-25');draw();await flush();oldBody(shots(false));await flush();const svg=find(draw(),'svg').find(p=>p.role==='img')!;expect(svg['aria-label']).toContain('2024-25');expect(svg['aria-label']).toContain('100.0%');expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);});
it('nullresponse exposes manualretry and subsequentvaliddatarecovers',async()=>{const fetcher=vi.fn().mockResolvedValueOnce(response(null)).mockResolvedValueOnce(response(shots(true)));vi.stubGlobal('fetch',fetcher);draw();await flush();const retry=find(draw(),'button').find(p=>p.children==='Retry')!;expect(retry).toBeDefined();(retry.onClick as ()=>void)();await flush();expect(find(draw(),'svg').some(p=>p.role==='img')).toBe(true);expect(fetcher).toHaveBeenCalledTimes(2);});
it('unmount aborts request without applying late data',async()=>{let body!:(v:unknown)=>void;const fetcher=vi.fn().mockResolvedValue({ok:true,json:()=>new Promise(r=>{body=r;})});vi.stubGlobal('fetch',fetcher);draw();await flush();unmount();const before=[...hooks.slots];body(shots(true));await flush();expect(hooks.slots).toEqual(before);expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);});

it.each(['fetch','body'])('noncooperative %s stops loading at75 seconds and exposes manual retry',async stage=>{
 const never=()=>new Promise<never>(()=>{});
 const fetcher=vi.fn().mockImplementation(()=>stage==='fetch'?never():Promise.resolve({ok:true,json:never}));
 vi.stubGlobal('fetch',fetcher);draw();await flush();
 expect(find(draw(),'div').some(p=>p.children==='Loading...')).toBe(true);
 await vi.advanceTimersByTimeAsync(PLAYER_SHOT_REQUEST_TIMEOUT_MS-1);
 expect(find(draw(),'button').some(p=>p.children==='Retry')).toBe(false);
 await vi.advanceTimersByTimeAsync(1);await flush();
 const tree=draw();expect(find(tree,'div').some(p=>p.children==='Loading...')).toBe(false);
 expect(find(tree,'button').some(p=>p.children==='Retry')).toBe(true);
 expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);expect(fetcher).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});
it('timeout keeps Chinese retry text and a manual retry recovers without late-body overwrite',async()=>{
 hooks.locale='zh';let lateBody!:(value:unknown)=>void;
 const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:()=>new Promise(resolve=>{lateBody=resolve;})}).mockResolvedValueOnce(response(shots(true)));
 vi.stubGlobal('fetch',fetcher);draw();await flush();await vi.advanceTimersByTimeAsync(PLAYER_SHOT_REQUEST_TIMEOUT_MS);await flush();
 const retry=find(draw(),'button').find(p=>p.children===zh.common.retry);expect(retry).toBeDefined();
 (retry!.onClick as ()=>void)();await flush();
 lateBody(shots(false));await flush();
 const tree=draw(),svg=find(tree,'svg').find(p=>p.role==='img')!;
 expect(svg['aria-label']).toContain('100.0%');expect(find(tree,'button').some(p=>p.children===zh.common.retry)).toBe(false);
 expect(fetcher).toHaveBeenCalledTimes(2);expect(vi.getTimerCount()).toBe(0);
});
it('a valid64-second aggregation still renders without premature retry',async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:()=>new Promise(resolve=>setTimeout(()=>resolve(shots(true)),64000))});
 vi.stubGlobal('fetch',fetcher);draw();await flush();await vi.advanceTimersByTimeAsync(64000);await flush();
 const tree=draw();expect(find(tree,'svg').some(p=>p.role==='img')).toBe(true);expect(find(tree,'button').some(p=>p.children==='Retry')).toBe(false);
 expect(fetcher).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});
it('season supersession cancels the old deadline, keeps the new result and ignores a late body',async()=>{
 let oldBody!:(value:unknown)=>void;
 const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:()=>new Promise(resolve=>{oldBody=resolve;})}).mockResolvedValueOnce(response(shots(true)));
 vi.stubGlobal('fetch',fetcher);draw();await flush();await vi.advanceTimersByTimeAsync(1000);
 (find(draw(),Select)[0].onValueChange as (value:string)=>void)('2024-25');draw();await flush();
 expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);expect(vi.getTimerCount()).toBe(0);
 await vi.advanceTimersByTimeAsync(PLAYER_SHOT_REQUEST_TIMEOUT_MS);oldBody(shots(false));await flush();
 const tree=draw(),svg=find(tree,'svg').find(p=>p.role==='img')!;
 expect(svg['aria-label']).toContain('2024-25');expect(svg['aria-label']).toContain('100.0%');
 expect(find(tree,'button').some(p=>p.children==='Retry')).toBe(false);expect(fetcher).toHaveBeenCalledTimes(2);
});
it.each(['fetch','body'])('unmount settles and clears a noncooperative %s deadline without state updates',async stage=>{
 let finish!:(value:unknown)=>void;
 const pending=new Promise(resolve=>{finish=resolve;});
 const fetcher=vi.fn().mockImplementation(()=>stage==='fetch'?pending:Promise.resolve({ok:true,json:()=>pending}));
 vi.stubGlobal('fetch',fetcher);draw();await flush();expect(vi.getTimerCount()).toBe(1);
 unmount();const before=[...hooks.slots];await flush();
 expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);expect(vi.getTimerCount()).toBe(0);
 finish(stage==='fetch'?response(shots(true)):shots(true));await flush();await vi.advanceTimersByTimeAsync(PLAYER_SHOT_REQUEST_TIMEOUT_MS);
 expect(hooks.slots).toEqual(before);expect(fetcher).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});

it('the actual heatmap uses the numeric sample legend and exact request coverage, even at30/30',async()=>{
 const fetcher=vi.fn().mockResolvedValue(response({...shots(true),gamesLoaded:30,totalGames:30}));vi.stubGlobal('fetch',fetcher);draw();await flush();
 const tree=draw();expect(find(tree,AbsoluteShotLegend)).toHaveLength(1);
 const coverage=find(tree,ShotSampleCoverage)[0];expect(coverage.requestUrl).toBe(fetcher.mock.calls[0][0]);expect(coverage.games).toEqual({loaded:30,total:30});
 const svg=find(tree,'svg').find(p=>p.role==='img')!;expect(svg['aria-label']).toContain('available-game sample');expect(svg['aria-label']).toContain('100.0%');
});

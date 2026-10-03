import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import en from '@/locales/en';

type Effect = { run: () => void | (() => void); deps?: readonly unknown[]; cleanup?: () => void };
type Hook =
  | { kind: 'state'; value: unknown; set: (value: unknown) => void }
  | { kind: 'ref'; value: { current: unknown } }
  | { kind: 'effect'; value: Effect }
  | { kind: 'callback'; fn: unknown; deps: readonly unknown[] };
const runtime = vi.hoisted(() => ({
  hooks: [] as Hook[], cursor: 0, effects: [] as { index: number; effect: Effect; old?: Effect }[],
  locale: 'en', dirty: true, mounted: true, lateSetters: 0, query: '', autoAcknowledge: true, career:{} as Record<string,unknown>, retry:vi.fn(), props:{playerId:2544,playerName:'LeBron James',teamTricode:'LAL'},
}));

// Execute the component's actual effects with React's commit ordering: all
// changed cleanups, then all setups, then a rerender. Refs and setters persist.
// This is an effect/handler fixture, not a substitute for the live browser repro.
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useId: () => 'linked-test',
  useMemo:(fn:()=>unknown)=>fn(),
  useState: (initial: unknown) => {
    const index = runtime.cursor++;
    let slot = runtime.hooks[index];
    if (!slot) {
      const state: Extract<Hook, { kind: 'state' }> = {
        kind: 'state', value: typeof initial === 'function' ? initial() : initial,
        set(value) {
          if (!runtime.mounted) { runtime.lateSetters++; return; }
          const next = typeof value === 'function' ? value(state.value) : value;
          if (!Object.is(next, state.value)) { state.value = next; runtime.dirty = true; }
        },
      };
      runtime.hooks[index] = slot = state;
    }
    if (slot.kind !== 'state') throw new Error('Hook order changed');
    return [slot.value, slot.set];
  },
  useRef: (initial: unknown) => {
    const index = runtime.cursor++;
    runtime.hooks[index] ??= { kind: 'ref', value: { current: initial } };
    const slot = runtime.hooks[index];
    if (slot.kind !== 'ref') throw new Error('Hook order changed');
    return slot.value;
  },
  useCallback: (fn: unknown, deps: readonly unknown[]) => {
    const index = runtime.cursor++;
    const old = runtime.hooks[index];
    if (!old || old.kind !== 'callback' || deps.some((d, i) => !Object.is(d, old.deps[i]))) {
      runtime.hooks[index] = { kind: 'callback', fn, deps };
    }
    return (runtime.hooks[index] as Extract<Hook, { kind: 'callback' }>).fn;
  },
  useEffect: (run: Effect['run'], deps?: readonly unknown[]) => {
    const index = runtime.cursor++;
    const slot = runtime.hooks[index];
    const old = slot?.kind === 'effect' ? slot.value : undefined;
    if (!old || !deps || deps.length !== old.deps?.length || deps.some((d, i) => !Object.is(d, old.deps?.[i]))) {
      runtime.effects.push({ index, effect: { run, deps }, old });
    }
  },
}));

vi.mock('@/lib/usePlayerCareer',()=>({usePlayerCareer:()=>runtime.career}));
vi.mock('@/components/LocaleProvider',()=>({useLocale:()=>({locale:runtime.locale,t:en})}));
import CareerArc from '@/app/lab/career-arc/CareerArc';
import CareerTrendChart from '@/app/lab/career-arc/CareerTrendChart';
import CareerSeasonHeatmap from '@/app/lab/career-arc/CareerSeasonHeatmap';
import CareerArchiveCourt from '@/app/lab/career-arc/CareerArchiveCourt';
import { loadPlayerSeasonHeatmapArchive } from '@/lib/season-heatmap-catalog-server';
import { decodeCourtSeasonHeatmapResource } from '@/lib/season-heatmap-request';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('server-only', () => ({}));
let tree: ReactNode, linkedTree: ReactNode;
let fetcher: ReturnType<typeof vi.fn>;
let parentHooks: Hook[] = [], childHooks: Hook[] = [], childKey: string | null = null;
const row = { SEASON_ID:'2015-16', TEAM_ABBREVIATION:'GSW', GP:79, MIN:34, PTS:30, REB:5, AST:6, STL:1, BLK:0, FG_PCT:.5, FG3_PCT:.45, FT_PCT:.9 };
let ready: Awaited<ReturnType<typeof loadPlayerSeasonHeatmapArchive>>;
function nodes(node:ReactNode):ReactElement<Record<string,unknown>>[] { if(Array.isArray(node)) return node.flatMap(nodes); if(!isValidElement<{children?:ReactNode}>(node)) return []; return [node as ReactElement<Record<string,unknown>>, ...nodes(node.props.children)]; }
function text(node:ReactNode):string { if(Array.isArray(node))return node.map(text).join('');if(typeof node==='string'||typeof node==='number')return String(node);return isValidElement<{children?:ReactNode}>(node)?text(node.props.children):''; }
function cleanup(hooks: Hook[]) { for(const h of hooks) if(h.kind==='effect')h.value.cleanup?.(); }
function renderScope(hooks: Hook[], render: () => ReactNode) {
 runtime.hooks=hooks; runtime.cursor=0;runtime.effects=[]; const result=render();
 const effects=runtime.effects;for(const e of effects)e.old?.cleanup?.();for(const e of effects){runtime.hooks[e.index]={kind:'effect',value:e.effect};e.effect.cleanup=e.effect.run()||undefined;}return result;
}
function flush() { for(let n=0;runtime.dirty;n++) {
 if(n>30)throw Error('Render loop');runtime.dirty=false;
 tree=renderScope(parentHooks,()=>CareerArc(runtime.props));
 const linked=nodes(tree).find(node=>node.type===CareerSeasonHeatmap);
 if(!linked){cleanup(childHooks);childHooks=[];childKey=null;linkedTree=null;continue;}
 const session=CareerSeasonHeatmap(linked.props as unknown as Parameters<typeof CareerSeasonHeatmap>[0]);
 if(session.key!==childKey){cleanup(childHooks);childHooks=[];childKey=session.key;}
 linkedTree=renderScope(childHooks,()=> (session.type as (props:unknown)=>ReactNode)(session.props));
 }}
async function settle(){for(let i=0;i<12;i++){await Promise.resolve();flush();}}
function select(index:number){const trend=nodes(tree).find(n=>n.type===CareerTrendChart)!;(trend.props.onSelectIndex as(index:number)=>void)(index);flush();}
function unmount(){runtime.mounted=false;cleanup(parentHooks);cleanup(childHooks);}
const response=(value: unknown,status=200)=>({ok:status===200,status,json:async()=>value});
const body=()=>nodes(linkedTree).find(n=>n.type===CareerArchiveCourt);
beforeEach(async()=>{
 ready=await loadPlayerSeasonHeatmapArchive({playerId:201939,season:'2015-16',seasonType:'Regular Season'});
 if(ready.status!=='ready')throw Error('Missing local archive fixture');
 vi.useFakeTimers(); parentHooks=[];childHooks=[];childKey=null;
 runtime.props={playerId:201939,playerName:'Stephen Curry',teamTricode:'GSW'};
 Object.assign(runtime,{locale:'en',dirty:true,mounted:true,lateSetters:0,career:{data:{careerSeasons:[{...row,SEASON_ID:'2003-04'},row]},loading:false,error:false,stale:false,retry:runtime.retry}});
 runtime.retry.mockClear();fetcher=vi.fn().mockResolvedValue(response(ready));vi.stubGlobal('fetch',fetcher);
});
afterEach(()=>{unmount();vi.useRealTimers();vi.unstubAllGlobals();});
it('uses one exact court archive request, no sample or spatial fanout and preserves the single career selector',async()=>{
 flush();await settle();expect(fetcher).toHaveBeenCalledOnce();const url=new URL(fetcher.mock.calls[0][0],'http://local');
 expect(url.pathname).toBe('/api/player-season-heatmap');expect(Object.fromEntries(url.searchParams)).toEqual({playerId:'201939',season:'2015-16',seasonType:'Regular Season',geometry:'nba-court-basic12-v1'});
 expect(body()?.props.data).toEqual(ready.status==='ready'?ready.data:null);
 expect(nodes(tree).filter(n=>n.type==='input'&&n.props.type==='range')).toHaveLength(1);
 expect(nodes(linkedTree).some(n=>n.type==='select')).toBe(false);
});
it('loading has no court or invented zero percentages',()=>{fetcher.mockImplementation(()=>new Promise(()=>{}));flush();expect(body()).toBeUndefined();expect(text(linkedTree)).not.toContain('0%');expect(text(linkedTree)).not.toContain('0 / 0');});
it.each(['2003-04','2004-05'])('missing %s remains unavailable without fallback',async season=>{
 runtime.career={...runtime.career,data:{careerSeasons:[{...row,SEASON_ID:season}]}};fetcher.mockResolvedValue(response({status:'unavailable'},404));flush();await settle();
 expect(body()).toBeUndefined();expect(text(linkedTree)).toContain('Missing seasons remain unavailable');expect(fetcher).toHaveBeenCalledOnce();
});
it('late old-season body is ignored after scrubber selection and old transport is aborted',async()=>{
 let oldBody!:(value:unknown)=>void;fetcher.mockResolvedValueOnce({ok:true,status:200,json:()=>new Promise(resolve=>oldBody=resolve)});flush();await settle();const signal=fetcher.mock.calls[0][1].signal;
 fetcher.mockResolvedValue(response({status:'unavailable'},404));select(0);expect(body()).toBeUndefined();await settle();oldBody(ready);await settle();expect(signal.aborted).toBe(true);expect(body()).toBeUndefined();expect(text(linkedTree)).toContain('2003-04');
});
it('player identity changes synchronously remove previous court and reject mismatched response',async()=>{
 flush();await settle();expect(body()).toBeDefined();runtime.props={...runtime.props,playerId:2544};runtime.dirty=true;flush();expect(body()).toBeUndefined();await settle();expect(body()).toBeUndefined();expect(nodes(linkedTree).some(n=>n.props.role==='alert')).toBe(true);
});
it('unmount aborts request and suppresses late body state updates',async()=>{
 let oldBody!:(value:unknown)=>void;fetcher.mockResolvedValueOnce({ok:true,status:200,json:()=>new Promise(resolve=>oldBody=resolve)});flush();await settle();const signal=fetcher.mock.calls[0][1].signal;unmount();oldBody(ready);await settle();expect(signal.aborted).toBe(true);expect(runtime.lateSetters).toBe(0);
});
it('8-second archive deadline settles, retry bypasses cache, and late body cannot overwrite it',async()=>{
 let oldBody!:(value:unknown)=>void;fetcher.mockResolvedValueOnce({ok:true,status:200,json:()=>new Promise(resolve=>oldBody=resolve)});flush();await settle();await vi.advanceTimersByTimeAsync(8000);await settle();expect(body()).toBeUndefined();
 const retry=nodes(linkedTree).find(n=>n.type==='button')!;(retry.props.onClick as()=>void)();flush();await settle();expect(body()).toBeDefined();expect(fetcher.mock.calls[1][1].cache).toBe('no-store');oldBody({status:'unavailable'});await settle();expect(body()).toBeDefined();expect(vi.getTimerCount()).toBe(0);
});
it('court taps show the selected validated archive zone and preserve source/control/residual context',async()=>{
 flush();await settle();const first=body()!;const data=first.props.data as Extract<typeof ready,{status:'ready'}>['data'];
 (first.props.onSelect as(id:string)=>void)(data.zones[0].id);flush();expect(body()?.props.selectedId).toBe(data.zones[0].id);
 const html=renderToStaticMarkup(body()!);for(const text of ['data-shot-map-view="zones"','data-archive-shortfall="true"','804 / 1596','805 / 1598 FG','Archive-wide game dates','Source metadata observed','data-list-zone="backcourt"'])expect(html).toContain(text);
 expect(html).not.toContain('Full-season aggregates reconciled');
});
it('a missing team or traded season does not block the player-season archive',async()=>{
 runtime.props.teamTricode='';runtime.career={...runtime.career,data:{careerSeasons:[{...row,TEAM_ABBREVIATION:'TOT'}]}};flush();await settle();expect(body()).toBeDefined();expect(fetcher.mock.calls[0][0]).not.toContain('team');
});
it('career recovery remains delegated to the shared career retry',async()=>{runtime.career={...runtime.career,error:true,stale:true};flush();await settle();const button=nodes(tree).find(n=>n.type==='button'&&text(n)==='Retry')!;(button.props.onClick as()=>void)();expect(runtime.retry).toHaveBeenCalledOnce();});
it('rejects archived data carrying legacy distance geometry',()=>{
 if(ready.status!=='ready')throw Error('fixture');expect(decodeCourtSeasonHeatmapResource({...ready,data:{...ready.data,geometryVersion:'nba-advanced14-svg-v1'}},{playerId:201939,season:'2015-16',seasonType:'Regular Season'})).toEqual({status:'error'});
});

it('locale changes translate archive context without another request or selection owner',async()=>{
 flush();await settle();runtime.locale='zh';runtime.dirty=true;flush();await settle();expect(fetcher).toHaveBeenCalledOnce();
 const html=renderToStaticMarkup(body()!);expect(html).toContain('官方投篮总数核验来源');expect(html).toContain('档案较官方核验值少');expect(html).toContain('未映射');expect(text(linkedTree)).toContain('常规赛');
});

it('failed archive requests have retry and no invented zero court',async()=>{fetcher.mockRejectedValue(new Error('unavailable'));flush();await settle();expect(body()).toBeUndefined();expect(nodes(linkedTree).some(n=>n.props.role==='alert')).toBe(true);expect(nodes(linkedTree).some(n=>n.type==='button')).toBe(true);expect(text(linkedTree)).not.toContain('0%');});
it('mobile scrubber buttons and range retain 44px targets',()=>{flush();for(const n of nodes(tree).filter(n=>n.type==='input'||n.props['aria-label']==='Previous season'||n.props['aria-label']==='Next season'))expect(n.props.className).toContain('min-h-11');});
it('details start closed, open on zone selection, and dismiss with Close or Escape',async()=>{
 flush();await settle();expect(renderToStaticMarkup(body()!)).not.toContain('<aside');
 const data=body()!.props.data as Extract<typeof ready,{status:'ready'}>['data'];
 (body()!.props.onSelect as(id:string)=>void)(data.zones[0].id);flush();
 expect(renderToStaticMarkup(body()!)).toContain('<aside');
 let content=CareerArchiveCourt(body()!.props as unknown as Parameters<typeof CareerArchiveCourt>[0]);
 const close=nodes(content).find(n=>n.type==='button'&&n.props['aria-label']==='Close details')!;(close.props.onClick as()=>void)();flush();expect(renderToStaticMarkup(body()!)).not.toContain('<aside');
 (body()!.props.onSelect as(id:string)=>void)(data.zones[0].id);flush();content=CareerArchiveCourt(body()!.props as unknown as Parameters<typeof CareerArchiveCourt>[0]);
 const container=nodes(content).find(n=>n.props['data-click-details']==='true')!;
 const stopPropagation=vi.fn();(container.props.onKeyDown as(event:unknown)=>void)({key:'Escape',stopPropagation});flush();expect(stopPropagation).toHaveBeenCalledOnce();expect(renderToStaticMarkup(body()!)).not.toContain('<aside');
});
it('selecting another season clears an open detail without waiting for the next result',async()=>{
 flush();await settle();const data=body()!.props.data as Extract<typeof ready,{status:'ready'}>['data'];(body()!.props.onSelect as(id:string)=>void)(data.zones[0].id);flush();
 fetcher.mockResolvedValue(response({status:'unavailable'},404));select(0);expect(body()).toBeUndefined();await settle();
 fetcher.mockResolvedValue(response(ready));select(1);await settle();expect(body()!.props.selectedId).toBeNull();
});
it.each([false,true])('only an explicit zone selection reveals offscreen details, reduced motion=%s',async reduced=>{
 flush();await settle();expect(renderToStaticMarkup(body()!)).not.toContain('All zone statistics');expect(renderToStaticMarkup(body()!)).toContain('Archive sources, coverage');
 const panel={getBoundingClientRect:()=>({top:900,bottom:1200}),scrollIntoView:vi.fn()},focus=vi.fn();
 const querySelector=vi.fn((selector:string)=>selector==='[data-heatmap-details="true"]'?panel:{focus});
 const root=nodes(linkedTree).find(n=>n.type==='section')!.props.ref as {current:unknown};root.current={querySelector};
 vi.stubGlobal('window',{innerHeight:700,matchMedia:()=>({matches:reduced})});
 expect(panel.scrollIntoView).not.toHaveBeenCalled();
 const data=body()!.props.data as Extract<typeof ready,{status:'ready'}>['data'];(body()!.props.onSelect as(id:string)=>void)(data.zones[0].id);flush();
 expect(panel.scrollIntoView).toHaveBeenLastCalledWith({block:'nearest',behavior:reduced?'instant':'auto'});
 runtime.locale='zh';runtime.dirty=true;flush();expect(panel.scrollIntoView).toHaveBeenCalledOnce();
 (body()!.props.onDismissDetails as()=>void)();flush();expect(focus).toHaveBeenCalledOnce();expect(panel.scrollIntoView).toHaveBeenCalledOnce();
});

it('reuses the canonical warm court and five-band legend without spatial data or old mode controls',async()=>{
 flush();await settle();const html=renderToStaticMarkup(body()!);
 expect(html).toContain('data-shot-map-view="zones"');expect(html).not.toContain('data-spatial-geometry');expect(html).not.toContain('data-bin-id');
 expect((html.match(/data-zone-legend-band=/g)||[])).toHaveLength(5);expect((html.match(/data-zone-id=/g)||[])).toHaveLength(12);
 expect(html).toContain('var(--map-zone-');expect(html).not.toContain('aria-label="Color mode"');expect(html).not.toContain('All zone statistics');
 expect(html.indexOf('<svg')).toBeLessThan(html.indexOf('<details'));
 expect(html.indexOf('data-archive-shortfall')).toBeGreaterThan(html.indexOf('<details'));
 expect(html.indexOf('data-archive-coverage')).toBeLessThan(html.indexOf('<svg'));
 expect(fetcher).toHaveBeenCalledOnce();
});

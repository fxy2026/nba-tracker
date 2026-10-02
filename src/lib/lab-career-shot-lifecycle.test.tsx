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
  dirty: true, mounted: true, lateSetters: 0, query: '', autoAcknowledge: true, career:{} as Record<string,unknown>, retry:vi.fn(), props:{playerId:2544,playerName:'LeBron James',teamTricode:'LAL'},
}));

// Execute the component's actual effects with React's commit ordering: all
// changed cleanups, then all setups, then a rerender. Refs and setters persist.
// This is an effect/handler fixture, not a substitute for the live browser repro.
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
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
vi.mock('@/components/LocaleProvider',()=>({useLocale:()=>({locale:'en',t:en})}));
import CareerArc from '@/app/lab/career-arc/CareerArc';
import CareerTrendChart from '@/app/lab/career-arc/CareerTrendChart';
import CareerCourt from '@/app/lab/career-arc/CareerCourt';
let tree:ReactNode;let fetcher:ReturnType<typeof vi.fn>;
const row={SEASON_ID:'2025-26',TEAM_ABBREVIATION:'LAL',GP:70,MIN:30,PTS:20,REB:5,AST:6,STL:1,BLK:0,FG_PCT:.5,FG3_PCT:null,FT_PCT:.8};
function nodes(node:ReactNode):ReactElement<Record<string,unknown>>[]{if(Array.isArray(node))return node.flatMap(nodes);if(!isValidElement<{children?:ReactNode}>(node))return[];return[node as ReactElement<Record<string,unknown>>,...nodes(node.props.children)];}
function text(node:ReactNode):string{if(Array.isArray(node))return node.map(text).join('');if(typeof node==='string'||typeof node==='number')return String(node);return isValidElement<{children?:ReactNode}>(node)?text(node.props.children):'';}
function flush(){for(let n=0;runtime.dirty;n++){if(n>30)throw Error('Render loop');runtime.dirty=false;runtime.cursor=0;runtime.effects=[];tree=CareerArc(runtime.props);const effects=runtime.effects;for(const e of effects)e.old?.cleanup?.();for(const e of effects){runtime.hooks[e.index]={kind:'effect',value:e.effect};e.effect.cleanup=e.effect.run()||undefined;}}}
async function settle(){for(let i=0;i<12;i++){await Promise.resolve();flush();}}
function select(index:number){const trend=nodes(tree).find(n=>n.type===CareerTrendChart)!;(trend.props.onSelectIndex as(index:number)=>void)(index);flush();}
function unmount(){runtime.mounted=false;for(const h of runtime.hooks)if(h.kind==='effect')h.value.cleanup?.();}
const response=(shots:unknown)=>({ok:true,json:async()=>({shots,gamesLoaded:1,totalGames:1})});
const made=[{x:0,y:0,shotDistance:0,shotResult:'Made'}];
beforeEach(()=>{vi.useFakeTimers();runtime.props={playerId:2544,playerName:'LeBron James',teamTricode:'LAL'};Object.assign(runtime,{hooks:[],cursor:0,effects:[],dirty:true,mounted:true,lateSetters:0,career:{data:{careerSeasons:[{...row,SEASON_ID:'2024-25'},row]},loading:false,error:false,stale:false,retry:runtime.retry}});runtime.retry.mockClear();fetcher=vi.fn().mockResolvedValue(response(made));vi.stubGlobal('fetch',fetcher);});
afterEach(()=>{unmount();vi.useRealTimers();vi.unstubAllGlobals();});
it('latest historical season uses the shared explicit-season URL and preserves0 coordinates',async()=>{flush();await settle();expect(fetcher.mock.calls[0][0]).toContain('season=2025-26');expect(fetcher.mock.calls[0][0]).toContain('context=4');expect(nodes(tree).find(n=>n.type===CareerCourt)?.props.overallPct).toBe(100);});
it('late old-season JSON cannot replace newly selected season',async()=>{let oldBody!:(value:unknown)=>void;fetcher.mockResolvedValueOnce({ok:true,json:()=>new Promise(resolve=>oldBody=resolve)});flush();await settle();const oldSignal=fetcher.mock.calls[0][1].signal;select(0);await settle();expect(oldSignal.aborted).toBe(true);oldBody({shots:[{...made[0],shotResult:'Missed'}],gamesLoaded:1,totalGames:1});await settle();const court=nodes(tree).find(n=>n.type===CareerCourt)!;expect(court.props.seasonLabel).toBe('2024-25');expect(court.props.overallPct).toBe(100);});
it('malformed shots fail visibly while genuine empty has no inventedsource explanation',async()=>{fetcher.mockResolvedValueOnce(response(null));flush();await settle();expect(text(tree)).toContain('Failed to load shot data');select(0);fetcher.mockResolvedValue(response([]));await settle();});
it('a genuine empty response says no field-goal records without inventingpoints',async()=>{fetcher.mockResolvedValue(response([]));flush();await settle();expect(text(tree)).toContain('No field-goal shot records');expect(nodes(tree).find(n=>n.type===CareerCourt)).toBeUndefined();});
it('career recovery uses shared Retry without a second career fetch in this component',async()=>{runtime.career={...runtime.career,error:true,stale:true};flush();await settle();const button=nodes(tree).find(n=>n.type==='button'&&text(n)==='Retry')!;(button.props.onClick as()=>void)();expect(runtime.retry).toHaveBeenCalledOnce();expect(fetcher.mock.calls.every(([url])=>String(url).startsWith('/api/player-shots?'))).toBe(true);});
it('unmount cancels shots and suppresses noncooperative late response',async()=>{let resolve!:(value:unknown)=>void;fetcher.mockImplementation(()=>new Promise(done=>resolve=done));flush();const signal=fetcher.mock.calls[0][1].signal;unmount();resolve(response(made));await settle();expect(signal.aborted).toBe(true);expect(runtime.lateSetters).toBe(0);});

it('75-secondshotdeadline clears loading, permits retry, and ignores late old body',async()=>{let oldBody!:(value:unknown)=>void;fetcher.mockResolvedValueOnce({ok:true,json:()=>new Promise(resolve=>oldBody=resolve)});flush();await settle();await vi.advanceTimersByTimeAsync(75000);await settle();expect(text(tree)).toContain('Failed to load shot data');expect(text(tree)).not.toContain('Loading shots');const retry=nodes(tree).find(n=>n.type==='button'&&text(n)==='Retry shot data')!;(retry.props.onClick as()=>void)();await settle();oldBody({shots:[{...made[0],shotResult:'Missed'}],gamesLoaded:1,totalGames:1});await settle();expect(nodes(tree).find(n=>n.type===CareerCourt)?.props.overallPct).toBe(100);expect(vi.getTimerCount()).toBe(0);});
it('missing team cancels pending shot work and settles loading instead of hanging',async()=>{fetcher.mockImplementation(()=>new Promise(()=>{}));flush();await settle();const signal=fetcher.mock.calls[0][1].signal;runtime.props.teamTricode='';runtime.career={...runtime.career,data:{careerSeasons:[{...row,TEAM_ABBREVIATION:''}]}};runtime.dirty=true;flush();await settle();expect(signal.aborted).toBe(true);expect(text(tree)).not.toContain('Loading shots');expect(text(tree)).toContain('No shot data for this season');expect(vi.getTimerCount()).toBe(0);});

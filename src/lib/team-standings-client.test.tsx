import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import en from '@/locales/en';
import zh from '@/locales/zh';
import snapshot from '@/data/season-2025-26-final.json';

type Effect = { run: () => void | (() => void); deps?: readonly unknown[]; cleanup?: () => void };
type Hook =
  | { kind: 'state'; value: unknown; set: (value: unknown) => void }
  | { kind: 'ref'; value: { current: unknown } }
  | { kind: 'effect'; value: Effect }
  | { kind: 'callback'; fn: unknown; deps: readonly unknown[] };
const runtime = vi.hoisted(() => ({
  hooks: [] as Hook[], cursor: 0, effects: [] as { index: number; effect: Effect; old?: Effect }[],
  dirty: true, mounted: true, lateSetters: 0, query: '', autoAcknowledge: true, locale:'en',
}));

// Execute the component's actual effects with React's commit ordering: all
// changed cleanups, then all setups, then a rerender. Refs and setters persist.
// This is an effect/handler fixture, not a substitute for the live browser repro.
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useMemo: (fn:()=>unknown) => fn(),
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
vi.mock('@/components/LocaleProvider',()=>({useLocale:()=>({locale:runtime.locale,t:runtime.locale==='zh'?zh:en})}));
import TeamStandings from '@/components/stats/TeamStandings';
let tree:ReactNode;let fetcher:ReturnType<typeof vi.fn>;
function nodes(node:ReactNode):ReactElement<Record<string,unknown>>[]{if(Array.isArray(node))return node.flatMap(nodes);if(!isValidElement<{children?:ReactNode}>(node))return[];return[node as ReactElement<Record<string,unknown>>,...nodes(node.props.children)];}
function text(node:ReactNode):string{if(Array.isArray(node))return node.map(text).join(' ');if(typeof node==='string'||typeof node==='number')return String(node);return isValidElement<{children?:ReactNode}>(node)?text(node.props.children):'';}
function flush(){for(let n=0;runtime.dirty;n++){if(n>30)throw Error('Render loop');runtime.dirty=false;runtime.cursor=0;runtime.effects=[];tree=TeamStandings();const effects=runtime.effects;for(const e of effects)e.old?.cleanup?.();for(const e of effects){runtime.hooks[e.index]={kind:'effect',value:e.effect};e.effect.cleanup=e.effect.run()||undefined;}}}
async function settle(){for(let i=0;i<12;i++){await Promise.resolve();flush();}}
function retry(){const node=nodes(tree).find(n=>n.type==='button'&&text(n)===(runtime.locale==='zh'?'重试':'Retry'));expect(node).toBeDefined();(node!.props.onClick as()=>void)();flush();}
function unmount(){runtime.mounted=false;for(const h of runtime.hooks)if(h.kind==='effect')h.value.cleanup?.();}
const response=(data:unknown)=>({ok:true,json:async()=>data});
const good={data:snapshot.teams,archived:true,season:snapshot.season};
beforeEach(()=>{vi.useFakeTimers();Object.assign(runtime,{hooks:[],cursor:0,effects:[],dirty:true,mounted:true,lateSetters:0,locale:'en'});fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);});
afterEach(()=>{unmount();vi.useRealTimers();vi.unstubAllGlobals();});
it('actual table renders correct GB and original archive season',async()=>{fetcher.mockResolvedValue(response(good));flush();await settle();expect(text(tree)).toContain('2025-26');const row=nodes(tree).find(n=>n.type==='tr'&&text(n).includes('Boston'));expect(row).toBeDefined();expect(text(row)).toContain('8.0');});
it.each(['http','network','json','shape'])('failed %s is visible and manual retry recovers',async kind=>{if(kind==='network')fetcher.mockRejectedValueOnce(Error('offline'));else if(kind==='http')fetcher.mockResolvedValueOnce({ok:false});else if(kind==='json')fetcher.mockResolvedValueOnce({ok:true,json:async()=>{throw Error('badjson')}});else fetcher.mockResolvedValueOnce(response({data:null}));fetcher.mockResolvedValueOnce(response(good));flush();await settle();expect(text(tree)).toContain('temporarily unavailable');expect(nodes(tree).some(n=>n.type==='table')).toBe(false);retry();await settle();expect(text(tree)).not.toContain('temporarily unavailable');expect(nodes(tree).some(n=>n.type==='table')).toBe(true);expect(fetcher).toHaveBeenCalledTimes(2);});
it.each(['en','zh'])('valid empty has explicit non-error message %s',async locale=>{runtime.locale=locale;fetcher.mockResolvedValue(response({data:[]}));flush();await settle();expect(text(tree)).toContain(locale==='zh'?'暂无可用的已完赛排名数据':'No finished-game standings');expect(nodes(tree).some(n=>n.props.role==='alert')).toBe(false);});
it('deadline includes body and late old response cannot replace successful retry',async()=>{let oldBody!:(value:unknown)=>void;fetcher.mockResolvedValueOnce({ok:true,json:()=>new Promise(resolve=>oldBody=resolve)}).mockResolvedValueOnce(response(good));flush();await settle();await vi.advanceTimersByTimeAsync(18000);await settle();expect(text(tree)).toContain('temporarily unavailable');retry();await settle();oldBody({data:[]});await settle();expect(nodes(tree).some(n=>n.type==='table')).toBe(true);expect(text(tree)).not.toContain('No finished-game');expect(vi.getTimerCount()).toBe(0);});
it('unmount aborts and suppresses noncooperative fetch completion',async()=>{let finish!:(value:unknown)=>void;fetcher.mockImplementation(()=>new Promise(resolve=>finish=resolve));flush();const signal=fetcher.mock.calls[0][1].signal;unmount();finish(response(good));await settle();expect(signal.aborted).toBe(true);expect(runtime.lateSetters).toBe(0);expect(vi.getTimerCount()).toBe(0);});

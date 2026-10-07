import { isValidElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Effect = { run: () => void | (() => void); deps?: readonly unknown[]; cleanup?: () => void };
type Hook =
  | { kind: 'state'; value: unknown; set: (value: unknown) => void }
  | { kind: 'ref'; value: { current: unknown } }
  | { kind: 'effect'; value: Effect }
  | { kind: 'callback'; fn: unknown; deps: readonly unknown[] }
  | { kind: 'memo'; value: unknown; deps: readonly unknown[] }
  | { kind: 'id'; value: string };
const runtime = vi.hoisted(() => ({
  hooks: [] as Hook[], cursor: 0, effects: [] as { index: number; effect: Effect; old?: Effect }[],
  dirty: true, mounted: true, lateSetters: 0, locale: 'en',
}));

vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
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
  useMemo: (calculate: () => unknown, deps: readonly unknown[]) => {
    const index = runtime.cursor++;
    const old = runtime.hooks[index];
    if (!old || old.kind !== 'memo' || deps.length !== old.deps.length || deps.some((d, i) => !Object.is(d, old.deps[i]))) {
      runtime.hooks[index] = { kind: 'memo', value: calculate(), deps };
    }
    return (runtime.hooks[index] as Extract<Hook, { kind: 'memo' }>).value;
  },
  useId: () => {
    const index = runtime.cursor++;
    runtime.hooks[index] ??= { kind: 'id', value: `palette-${index}` };
    return (runtime.hooks[index] as Extract<Hook, { kind: 'id' }>).value;
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


import en from '@/locales/en';
import zh from '@/locales/zh';
import { CURRENT_SEASON } from '@/lib/constants';
import type { ScheduleBoards } from '@/lib/team-stat-board';
vi.mock('@/components/LocaleProvider', () => ({ useLocale: () => ({ locale: runtime.locale, t: runtime.locale === 'zh' ? zh : en }) }));
import TeamStatBoards from './TeamStatBoards';

type Props = Record<string, unknown>;
let tree: ReactNode;
let renderComponent: () => ReactNode;
let fetcher: ReturnType<typeof vi.fn>;
const scheduleBoards: ScheduleBoards = {
  PTS: [{ teamId: 1610612747, tricode: 'LAL', value: 112, detailEn: '2 GP', detailZh: '2 场' }],
  OPP_PTS: [], NET: [],
};
// Synthetic provider envelopes, not captured upstream responses.
const fields = ['TEAM_ID', 'GP', 'FGM', 'FGA', 'FG_PCT', 'FG3M', 'FG3A', 'FG3_PCT', 'FTM', 'FTA', 'FT_PCT', 'OREB', 'DREB', 'REB', 'AST', 'TOV', 'STL', 'BLK'];
const payload = (teamId = 1610612747) => ({ resultSets: [{ headers: fields, rowSet: [[teamId, 2, 40, 80, 0.5, 12, 30, 0.4, 20, 25, 0.8, 10, 30, 40, 25, 10, 7, 5]] }] });
const response = (teamId = 1610612747) => ({ ok: true, json: async () => payload(teamId) });
function nodes(node: ReactNode): { type: unknown; props: Props }[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [{ type: node.type, props: node.props }, ...nodes(node.props.children as ReactNode)];
}
function flush() {
  for (let runs = 0; runtime.dirty; runs++) {
    if (runs > 40) throw new Error('Effects did not settle');
    runtime.cursor = 0; runtime.dirty = false; runtime.effects = [];
    tree = renderComponent();
    const effects = runtime.effects;
    for (const pending of effects) pending.old?.cleanup?.();
    for (const pending of effects) {
      const cleanup = pending.effect.run();
      runtime.hooks[pending.index] = { kind: 'effect', value: { ...pending.effect, cleanup: cleanup || undefined } };
    }
  }
}
async function settle() { for (let i = 0; i < 10; i++) { await Promise.resolve(); flush(); } }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function mount(recorded = false) { renderComponent = () => TeamStatBoards({ scheduleBoards, recorded }); flush(); }
function unmount() { for (const h of runtime.hooks) if (h.kind === 'effect') h.value.cleanup?.(); runtime.mounted = false; }
function click(label: string) { const button = nodes(tree).find(n => n.type === 'button' && n.props.children === label)!; expect(button).toBeDefined(); (button.props.onClick as () => void)(); flush(); }
function retry() { const action = nodes(tree).find(n => n.props.action)?.props.action as { onClick: () => void }; expect(action).toBeDefined(); action.onClick(); flush(); }
const loading = () => nodes(tree).some(n => String(n.props.className).includes('skeleton-shimmer'));
const failed = () => nodes(tree).some(n => n.props.title === 'League team stats unavailable');
const boardRows = () => nodes(tree).find(n => n.props.rows)?.props.rows;
const signal = (call = 0): AbortSignal | undefined => fetcher.mock.calls[call][1]?.signal;
async function advance(ms: number) { await vi.advanceTimersByTimeAsync(ms); await settle(); }

beforeEach(() => {
  vi.useFakeTimers();
  runtime.hooks = []; runtime.cursor = 0; runtime.effects = []; runtime.dirty = true;
  runtime.mounted = true; runtime.lateSetters = 0; runtime.locale = 'en';
  fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
});
afterEach(() => { unmount(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('TeamStatBoards owned requests', () => {
  it('ends a stalled fetch at twelve seconds while schedule boards remain available', async () => {
    fetcher.mockImplementation(() => new Promise(() => {})); mount();
    expect(boardRows()).toEqual(scheduleBoards.PTS);
    click('FG%'); expect(loading()).toBe(true);
    await advance(11999); expect(failed()).toBe(false);
    await advance(1); expect(failed()).toBe(true); expect(loading()).toBe(false);
    expect(signal()?.aborted).toBe(true);
    click('Points'); expect(boardRows()).toEqual(scheduleBoards.PTS);
    expect(fetcher).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
  it('times out a stalled body and ignores it after a successful retry', async () => {
    const body = deferred<ReturnType<typeof payload>>();
    fetcher.mockResolvedValueOnce({ ok: true, json: () => body.promise }).mockResolvedValueOnce(response(1610612738));
    mount(); click('FG%'); await settle(); await advance(12000);
    expect(failed()).toBe(true); retry(); await settle();
    expect(boardRows()).toEqual(expect.arrayContaining([expect.objectContaining({ tricode: 'BOS' })]));
    body.resolve(payload()); await settle();
    expect(boardRows()).toEqual(expect.arrayContaining([expect.objectContaining({ tricode: 'BOS' })]));
    expect(fetcher).toHaveBeenCalledTimes(2); expect(vi.getTimerCount()).toBe(0);
  });
  it('owns and cancels the retry request when unmounted', async () => {
    const body = deferred<ReturnType<typeof payload>>();
    fetcher.mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce({ ok: true, json: () => body.promise });
    mount(); click('FG%'); await settle(); expect(failed()).toBe(true);
    retry(); await settle(); expect(signal(1)).toBeDefined();
    unmount(); expect(signal(1)?.aborted).toBe(true);
    body.resolve(payload()); await settle();
    expect(runtime.lateSetters).toBe(0); expect(vi.getTimerCount()).toBe(0);
  });
  it('ignores a successful body after the initial request is unmounted', async () => {
    const body = deferred<ReturnType<typeof payload>>();
    fetcher.mockResolvedValueOnce({ ok: true, json: () => body.promise });
    mount(); click('FG%'); await settle(); unmount();
    body.resolve(payload()); await settle();
    expect(signal()?.aborted).toBe(true); expect(runtime.lateSetters).toBe(0); expect(vi.getTimerCount()).toBe(0);
  });
  it('ignores the old body during effect cleanup and replay', async () => {
    const oldBody = deferred<ReturnType<typeof payload>>(), newBody = deferred<ReturnType<typeof payload>>();
    fetcher.mockResolvedValueOnce({ ok: true, json: () => oldBody.promise }).mockResolvedValueOnce({ ok: true, json: () => newBody.promise });
    mount(); click('FG%'); await settle();
    // Mimic Strict Mode's setup-cleanup-setup while preserving state.
    for (const hook of runtime.hooks) if (hook.kind === 'effect') {
      hook.value.cleanup?.(); const cleanup = hook.value.run(); hook.value.cleanup = cleanup || undefined;
    }
    await settle(); expect(signal()?.aborted).toBe(true);
    oldBody.resolve(payload()); await settle(); expect(loading()).toBe(true);
    newBody.resolve(payload(1610612738)); await settle();
    expect(boardRows()).toEqual(expect.arrayContaining([expect.objectContaining({ tricode: 'BOS' })]));
    expect(vi.getTimerCount()).toBe(0);
  });
  it('accepts a slow valid body before its deadline and keeps all upstream categories in one request', async () => {
    const body = deferred<ReturnType<typeof payload>>();
    fetcher.mockResolvedValueOnce({ ok: true, json: () => body.promise });
    mount(); click('FG%'); await settle(); await advance(11000);
    body.resolve(payload()); await settle();
    expect(boardRows()).toEqual(expect.arrayContaining([expect.objectContaining({ tricode: 'LAL', value: 0.5 })]));
    click('Rebounds'); expect(boardRows()).toEqual(expect.arrayContaining([expect.objectContaining({ tricode: 'LAL', value: 40 })]));
    click('Rebounds'); expect(fetcher).toHaveBeenCalledOnce(); expect(signal()?.aborted).toBe(false); expect(vi.getTimerCount()).toBe(0);
    const query = new URL(fetcher.mock.calls[0][0], 'https://local.test').searchParams;
    expect(query.get('Season')).toBe(CURRENT_SEASON); expect(query.get('SeasonType')).toBe('Regular Season');
    expect(query.get('endpoint')).toBe('leaguedashteamstats');
  });
  it.each([{ ok: false, status: 503 }, { ok: true, json: async () => ({ invalid: true }) }])('keeps parse and HTTP errors recoverable', async badResponse => {
    fetcher.mockResolvedValueOnce(badResponse).mockResolvedValueOnce(response());
    mount(); click('FG%'); await settle(); expect(failed()).toBe(true);
    retry(); expect(loading()).toBe(true); await settle();
    expect(failed()).toBe(false); expect(boardRows()).toEqual(expect.arrayContaining([expect.objectContaining({ tricode: 'LAL' })]));
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not request upstream data or start timers for recorded boards', async () => {
    mount(true); await settle();
    expect(nodes(tree).filter(n => n.type === 'button')).toHaveLength(3);
    expect(boardRows()).toEqual(scheduleBoards.PTS);
    expect(fetcher).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
});


describe('TeamStatBoards late-response and retry races', () => {
  it('does not parse a late fetch response after its timeout and newer retry succeeds', async () => {
    const oldFetch = deferred<{ ok: boolean; json: () => Promise<ReturnType<typeof payload>> }>();
    const oldJson = vi.fn(async () => payload());
    fetcher.mockImplementationOnce(() => oldFetch.promise).mockResolvedValueOnce(response(1610612738));
    mount(); click('FG%'); await advance(12000); expect(failed()).toBe(true);
    retry(); await settle();
    oldFetch.resolve({ ok: true, json: oldJson }); await settle();
    expect(oldJson).not.toHaveBeenCalled();
    expect(boardRows()).toEqual(expect.arrayContaining([expect.objectContaining({ tricode: 'BOS' })]));
    expect(loading()).toBe(false); expect(failed()).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
  it('gives a stalled retry its own full deadline', async () => {
    fetcher.mockResolvedValueOnce({ ok: false, status: 503 }).mockImplementationOnce(() => new Promise(() => {}));
    mount(); click('FG%'); await settle(); expect(failed()).toBe(true);
    await advance(5000); retry(); await settle();
    await advance(11999); expect(loading()).toBe(true); expect(failed()).toBe(false);
    await advance(1); expect(failed()).toBe(true); expect(loading()).toBe(false);
    expect(signal(1)?.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
  it('a stale rejected body cannot erase the successful retry', async () => {
    let rejectOld!: (reason: Error) => void;
    const body = new Promise<ReturnType<typeof payload>>((_, reject) => { rejectOld = reject; });
    fetcher.mockResolvedValueOnce({ ok: true, json: () => body }).mockResolvedValueOnce(response(1610612738));
    mount(); click('FG%'); await settle(); await advance(12000); retry(); await settle();
    rejectOld(new Error('late rejected body')); await settle();
    expect(boardRows()).toEqual(expect.arrayContaining([expect.objectContaining({ tricode: 'BOS' })]));
    expect(failed()).toBe(false); expect(loading()).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
});

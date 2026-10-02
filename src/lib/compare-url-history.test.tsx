import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/locales/en';

type Effect = { run: () => void | (() => void); deps?: readonly unknown[]; cleanup?: () => void };
type Hook =
  | { kind: 'state'; value: unknown; set: (value: unknown) => void }
  | { kind: 'ref'; value: { current: unknown } }
  | { kind: 'effect'; value: Effect }
  | { kind: 'callback'; fn: unknown; deps: readonly unknown[] };
const runtime = vi.hoisted(() => ({
  hooks: [] as Hook[], cursor: 0, effects: [] as { index: number; effect: Effect; old?: Effect }[],
  dirty: true, mounted: true, lateSetters: 0, query: '', autoAcknowledge: true,
}));

// Execute the component's actual effects with React's commit ordering: all
// changed cleanups, then all setups, then a rerender. Refs and setters persist.
// This is an effect/handler fixture, not a substitute for the live browser repro.
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
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(runtime.query) }));
vi.mock('@/components/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en', t: en }) }));
vi.mock('@/components/ToastProvider', () => ({ useToast: () => ({ toast: vi.fn() }) }));
import CompareClient, { type PlayerData } from '@/app/compare/CompareClient';

type BoxProps = {
  player: PlayerData | null; query: string; results: PlayerData[]; compact?: boolean;
  onPick: (p: PlayerData) => void; onQuery: (q: string) => void; onClear?: () => void;
};
const base = { teamAbbr: 'CHI', teamName: 'Bulls', teamCity: 'Chicago', jersey: '', position: '', pts: 30, reb: 6, ast: 5 };
const wilt: PlayerData = { ...base, personId: 76375, firstName: 'Wilt', lastName: 'Chamberlain', iconicId: '76375-1961', isIconicSeason: true, season: '1961-62' };
const jordan: PlayerData = { ...base, personId: 893, firstName: 'Michael', lastName: 'Jordan', iconicId: '893-1995', isIconicSeason: true, season: '1995-96' };
const curry: PlayerData = { ...base, personId: 201939, firstName: 'Stephen', lastName: 'Curry', indexProvenance: { source: 'bundled-archive', season: '2025-26', stale: true, retrievedAt: null } };
const currySeason: PlayerData = { ...curry, iconicId: '201939-2015', isIconicSeason: true, season: '2015-16', story: 'The complete selected record' };
const records = new Map([wilt, jordan, curry, currySeason].map(p => [p.iconicId ?? String(p.personId), p]));
const pairA = 'p1=76375-1961&p2=893-1995';
const pairB = 'p1=893-1995&p2=76375-1961';
let tree: ReactNode;
let history: string[];
let historyIndex: number;
let actualURL: URL;
let replace: ReturnType<typeof vi.fn>;
let fetcher: ReturnType<typeof vi.fn>;

function nodes(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [node as ReactElement<Record<string, unknown>>, ...nodes(node.props.children)];
}
function boxes(): BoxProps[] {
  return nodes(tree).filter(n => typeof n.type === 'function' && n.type.name === 'PlayerSearchBox').map(n => n.props as unknown as BoxProps);
}
const ids = () => boxes().map(b => b.player?.iconicId ?? b.player?.personId ?? null);
function flush() {
  for (let renders = 0; runtime.dirty; renders++) {
    if (renders > 40) throw new Error('Effects did not settle');
    runtime.dirty = false; runtime.cursor = 0; runtime.effects = [];
    tree = CompareClient();
    const effects = runtime.effects;
    for (const pending of effects) pending.old?.cleanup?.();
    for (const pending of effects) {
      const cleanup = pending.effect.run();
      runtime.hooks[pending.index] = { kind: 'effect', value: { ...pending.effect, cleanup: cleanup || undefined } };
    }
  }
}
async function settle() {
  for (let i = 0; i < 10; i++) { await Promise.resolve(); flush(); }
}
function acknowledge(query = actualURL.search.slice(1)) { runtime.query = query; runtime.dirty = true; flush(); }
function moveTo(query: string) {
  actualURL = new URL(`/compare${query ? `?${query}` : ''}`, 'https://example.test');
  acknowledge();
}
function navigate(query: string) {
  history.splice(historyIndex + 1); history.push(query); historyIndex++;
  moveTo(query);
}
function back() { expect(historyIndex).toBeGreaterThan(0); moveTo(history[--historyIndex]); }
function forward() { expect(historyIndex).toBeLessThan(history.length - 1); moveTo(history[++historyIndex]); }
function pick(slot: number, player: PlayerData) { boxes()[slot].onPick(player); flush(); }
function type(slot: number, query: string) { boxes()[slot].onQuery(query); flush(); }
function swap() {
  const button = nodes(tree).find(n => n.type === 'button' && n.props.title === en.comparePage.swapPlayers);
  (button!.props.onClick as () => void)(); flush();
}
function preset(label: string) {
  const button = nodes(tree).find(n => n.type === 'button' && n.props.children === label);
  (button!.props.onClick as () => void)(); flush();
}
function response(player: PlayerData | null) { return { ok: true, json: async () => ({ data: player }) }; }
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
function mount(query = '') {
  history = [query]; historyIndex = 0;
  actualURL = new URL(`/compare${query ? `?${query}` : ''}`, 'https://example.test');
  runtime.query = query; flush();
}
function unmount() {
  if (!runtime.mounted) return;
  for (const slot of runtime.hooks) if (slot.kind === 'effect') slot.value.cleanup?.();
  runtime.mounted = false;
}
function replayEffects() {
  const effects = runtime.hooks.filter((h): h is Extract<Hook, { kind: 'effect' }> => h.kind === 'effect');
  for (const slot of effects) slot.value.cleanup?.();
  for (const slot of effects) slot.value.cleanup = slot.value.run() || undefined;
  flush();
}

beforeEach(() => {
  runtime.hooks = []; runtime.cursor = 0; runtime.effects = []; runtime.dirty = true;
  runtime.mounted = true; runtime.lateSetters = 0; runtime.query = ''; runtime.autoAcknowledge = true;
  vi.useFakeTimers();
  replace = vi.fn((_state: unknown, _title: string, url: string) => {
    actualURL = new URL(url, actualURL); history[historyIndex] = actualURL.search.slice(1);
    if (runtime.autoAcknowledge) { runtime.query = actualURL.search.slice(1); runtime.dirty = true; }
  });
  vi.stubGlobal('window', { get location() { return actualURL; }, history: { replaceState: replace } });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
  fetcher = vi.fn(async (url: string) => response(records.get(new URL(url, 'https://example.test').searchParams.get('id') ?? '') ?? null));
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => { unmount(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Compare URL navigation and real selection handlers', () => {
  it('hydrates an initial mixed-source pair without rewriting the incoming URL', async () => {
    mount('p1=76375-1961&p2=201939'); await settle();
    expect(ids().slice(0, 2)).toEqual(['76375-1961', 201939]);
    expect(replace).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('restores Back and Forward instead of replacing the earlier comparison', async () => {
    mount(pairA); await settle();
    navigate(''); await settle();
    expect(ids()).toEqual([null, null]);
    pick(0, jordan); pick(1, wilt); await settle();
    expect(history).toEqual([pairA, pairB]);
    back(); await settle();
    expect(ids().slice(0, 2)).toEqual(['76375-1961', '893-1995']);
    expect(history).toEqual([pairA, pairB]);
    forward(); await settle();
    expect(ids().slice(0, 2)).toEqual(['893-1995', '76375-1961']);
    expect(replace).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledTimes(2); // cached records, no navigation fanout
  });

  it('restores pair to triple to pair to bare queries, including absent slots', async () => {
    mount(pairA); await settle();
    navigate(`${pairA}&p3=201939-2015`); await settle();
    expect(ids()).toEqual(['76375-1961', '893-1995', '201939-2015']);
    back(); await settle(); expect(ids()).toEqual(['76375-1961', '893-1995', null]);
    forward(); await settle(); expect(boxes()[2].player).toEqual(currySeason);
    navigate('p2=201939'); await settle(); expect(ids()).toEqual([null, 201939, null]);
    navigate(''); await settle(); expect(ids()).toEqual([null, null]);
    expect(replace).not.toHaveBeenCalled();
  });

  it('preserves swap, full onSelect records, third-player removal and typed drafts', async () => {
    mount(pairA); await settle();
    swap(); await settle(); expect(actualURL.search).toBe(`?${pairB}`);
    pick(2, currySeason); await settle(); expect(boxes()[2].player).toEqual(currySeason);
    boxes()[2].onClear!(); flush(); await settle(); expect(ids()).toEqual(['893-1995', '76375-1961', null]);
    type(0, 'Curry'); await settle();
    expect(boxes()[0].query).toBe('Curry'); expect(actualURL.search).toBe('?p2=76375-1961');
    expect(fetcher).toHaveBeenCalledTimes(2);
    preset('LeBron vs Curry'); await settle();
    expect(actualURL.search).toBe(''); expect(boxes().map(b => b.query)).toEqual(['LeBron', 'Curry']);
  });

  it('ignores obsolete acknowledgements after two rapid local edits', async () => {
    mount(); await settle(); runtime.autoAcknowledge = false;
    const initialBoxes = boxes();
    initialBoxes[0].onPick(wilt); initialBoxes[1].onPick(jordan); flush();
    expect(actualURL.search).toBe(`?${pairA}`);
    acknowledge('p1=76375-1961'); await settle();
    expect(ids().slice(0, 2)).toEqual(['76375-1961', '893-1995']);
    acknowledge(pairA); await settle();
    expect(ids().slice(0, 2)).toEqual(['76375-1961', '893-1995']);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not substitute career records for the same player’s iconic season', async () => {
    mount('p1=201939'); await settle();
    navigate('p1=201939-2015'); await settle();
    expect(boxes()[0].player).toEqual(currySeason);
    expect(fetcher).toHaveBeenCalledTimes(2);
    back(); await settle(); expect(boxes()[0].player).toEqual(curry);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('Compare pending lookup and effect cleanup', () => {
  it('ignores a superseded response even when fetch ignores its abort signal', async () => {
    const old = deferred<ReturnType<typeof response>>();
    fetcher.mockImplementation((url: string) => url.includes('76375') ? old.promise : Promise.resolve(response(curry)));
    mount('p1=76375-1961');
    const signal = fetcher.mock.calls[0][1].signal as AbortSignal;
    navigate('p1=201939'); await settle(); expect(signal.aborted).toBe(true);
    old.resolve(response(wilt)); await settle();
    expect(boxes()[0].player).toEqual(curry); expect(actualURL.search).toBe('?p1=201939');
    expect(replace).not.toHaveBeenCalled();
  });

  it('ignores a superseded body that resolves after navigation', async () => {
    const body = deferred<{ data: PlayerData }>();
    fetcher.mockImplementation((url: string) => Promise.resolve(url.includes('76375') ? { ok: true, json: () => body.promise } : response(curry)));
    mount('p1=76375-1961'); await settle();
    navigate('p1=201939'); await settle(); body.resolve({ data: wilt }); await settle();
    expect(boxes()[0].player).toEqual(curry); expect(replace).not.toHaveBeenCalled();
  });

  it('keeps another unresolved slot while a user replaces the first player', async () => {
    const left = deferred<ReturnType<typeof response>>(); const right = deferred<ReturnType<typeof response>>();
    fetcher.mockImplementation((url: string) => url.includes('76375') ? left.promise : right.promise);
    mount(pairA); pick(0, currySeason); await settle();
    expect(actualURL.search).toBe('?p1=201939-2015&p2=893-1995');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    expect(fetcher.mock.calls[1][1].signal.aborted).toBe(false);
    right.resolve(response(jordan)); left.resolve(response(wilt)); await settle();
    expect(ids().slice(0, 2)).toEqual(['201939-2015', '893-1995']);
  });

  it('swaps unresolved IDs and reuses their in-flight lookups', async () => {
    const left = deferred<ReturnType<typeof response>>(); const right = deferred<ReturnType<typeof response>>();
    fetcher.mockImplementation((url: string) => url.includes('76375') ? left.promise : right.promise);
    mount(pairA); swap(); await settle();
    expect(actualURL.search).toBe(`?${pairB}`); expect(fetcher).toHaveBeenCalledTimes(2);
    left.resolve(response(wilt)); right.resolve(response(jordan)); await settle();
    expect(ids().slice(0, 2)).toEqual(['893-1995', '76375-1961']);
  });

  it('clears pending slots without allowing their late results to return', async () => {
    const pending = deferred<ReturnType<typeof response>>(); fetcher.mockReturnValue(pending.promise);
    mount('p1=76375-1961'); type(0, 'Curry'); await settle();
    pending.resolve(response(wilt)); await settle();
    expect(boxes()[0].player).toBeNull(); expect(boxes()[0].query).toBe('Curry'); expect(actualURL.search).toBe('');
  });

  it('preserves an unavailable requested ID instead of replacing it with stale players', async () => {
    mount(pairA); await settle(); fetcher.mockResolvedValue({ ok: false });
    navigate('p1=999999'); await settle();
    expect(ids()).toEqual([null, null]); expect(actualURL.search).toBe('?p1=999999');
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([
    ['76375-1961', curry],
    ['893-bad', { ...jordan, iconicId: undefined, isIconicSeason: false, isLegend: true }],
  ])('rejects a different identity or career fallback for requested %s', async (requested, returned) => {
    fetcher.mockResolvedValue(response(returned)); mount(`p1=${requested}`); await settle();
    expect(ids()).toEqual([null, null]); expect(actualURL.search).toBe(`?p1=${requested}`);
  });

  it('does not retry an unchanged failed slot on other-slot edits, but can recover on navigation', async () => {
    const recovered = { ...curry, personId: 999999 };
    fetcher.mockResolvedValue({ ok: false });
    mount('p2=999999'); await settle();
    type(0, 'Cu'); await settle(); type(0, 'Curr'); await settle();
    pick(0, currySeason); await settle();
    expect(actualURL.search).toBe('?p1=201939-2015&p2=999999');
    expect(fetcher).toHaveBeenCalledTimes(1);
    navigate(''); await settle();
    fetcher.mockResolvedValue(response(recovered));
    navigate('p2=999999'); await settle();
    expect(boxes()[1].player).toEqual(recovered);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('counts a retained in-flight lookup as attempted after external navigation', async () => {
    const pending = deferred<{ ok: boolean }>();
    fetcher.mockImplementation((url: string) => url.includes('999999') ? pending.promise : Promise.resolve(response(jordan)));
    mount('p1=999999');
    navigate('p1=999999&p2=893-1995'); await settle();
    expect(fetcher).toHaveBeenCalledTimes(2);
    pending.resolve({ ok: false }); await settle();
    type(1, 'Curry'); await settle(); pick(1, curry); await settle();
    expect(actualURL.search).toBe('?p1=999999&p2=201939');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('restarts mount hydration after StrictMode cleanup rather than skipping it', async () => {
    const pending = deferred<ReturnType<typeof response>>(); fetcher.mockReturnValue(pending.promise);
    mount('p1=76375-1961'); replayEffects();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    pending.resolve(response(wilt)); await settle(); expect(boxes()[0].player).toEqual(wilt);
  });

  it('does not commit a deferred response after unmount', async () => {
    const pending = deferred<ReturnType<typeof response>>(); fetcher.mockReturnValue(pending.promise);
    mount('p1=76375-1961'); unmount(); pending.resolve(response(wilt));
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(runtime.lateSetters).toBe(0); expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('does not restore stale autocomplete results after incoming navigation', async () => {
    const body = deferred<{ data: PlayerData[] }>();
    fetcher.mockImplementation((url: string) => Promise.resolve(url.includes('?q=') ? { ok: true, json: () => body.promise } : response(jordan)));
    mount(); await settle(); type(0, 'Wilt'); vi.advanceTimersByTime(300); await settle();
    navigate('p1=893-1995'); await settle(); body.resolve({ data: [wilt] }); await settle();
    expect(boxes()[0].query).toBe(''); expect(boxes()[0].results).toEqual([]); expect(boxes()[0].player).toEqual(jordan);
  });
});

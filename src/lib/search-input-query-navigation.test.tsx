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
  dirty: true, mounted: true, lateSetters: 0,
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
  useId: () => 'player-search-test',
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
  useLayoutEffect: (run: Effect['run'], deps?: readonly unknown[]) => {
    const index = runtime.cursor++;
    const slot = runtime.hooks[index];
    const old = slot?.kind === 'effect' ? slot.value : undefined;
    if (!old || !deps || deps.length !== old.deps?.length || deps.some((d, i) => !Object.is(d, old.deps?.[i]))) {
      runtime.effects.push({ index, effect: { run, deps }, old });
    }
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

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: (href: string) => { window.location.href = href; } }) }));
vi.mock('@/components/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en', t: en }) }));
import SearchInput from '@/components/SearchInput';

const curry = { id: 201939, name: 'Stephen Curry', aliases: [], sources: ['player-index'], href: '/player/201939', teamAbbr: 'GSW', teamLabel: 'Golden State Warriors', position: 'G', shotCoverage: null, indexProvenance: { source: 'bundled-archive', season: '2025-26', stale: true, retrievedAt: null } };
const lebron = { ...curry, id: 2544, name: 'LeBron James', href: '/player/2544' };
const jordan = { ...curry, id: 893, name: 'Michael Jordan', href: '/player/893', indexProvenance: null };
const archiveOnly = { ...curry, id: 767, name: 'Manute Bol', href: '/player/767', indexProvenance: null, shotCoverage: { firstSeason: '1996-97', lastSeason: '1996-97', datasetCount: 1 } };
type Row = typeof curry | typeof jordan | typeof archiveOnly;
let tree: ReactNode;
let committedQuery: string;
let variant: "page" | "home";
let url: URL;
let history: string[];
let historyIndex: number;
let fetcher: ReturnType<typeof vi.fn>;
let storage: Map<string, string>;
let writeHistory: ReturnType<typeof vi.fn>;
const listeners = new Map<string, Set<(e: unknown) => void>>();

function nodes(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [node as ReactElement<Record<string, unknown>>, ...nodes(node.props.children)];
}
const input = () => nodes(tree).find(n => n.type === 'input')!;
const query = () => input().props.value;
const links = () => nodes(tree).filter(n => typeof n.props.href === 'string');
const destinations = () => links().map(n => n.props.href);
const loading = () => nodes(tree).some(n => String(n.props.className).includes('animate-spin'));
function flush() {
  for (let renders = 0; runtime.dirty; renders++) {
    if (renders > 40) throw new Error('Effects did not settle');
    runtime.dirty = false; runtime.cursor = 0; runtime.effects = [];
    tree = SearchInput({ initialQuery: committedQuery, variant });
    const effects = runtime.effects;
    for (const pending of effects) pending.old?.cleanup?.();
    for (const pending of effects) {
      const cleanup = pending.effect.run();
      runtime.hooks[pending.index] = { kind: 'effect', value: { ...pending.effect, cleanup: cleanup || undefined } };
    }
  }
}
async function settle() { for (let i = 0; i < 10; i++) { await Promise.resolve(); flush(); } }
async function advance(ms = 250) { await vi.advanceTimersByTimeAsync(ms); await settle(); }
function moveTo(value: string) {
  url = new URL(value ? `/search?q=${encodeURIComponent(value)}` : '/search', 'https://example.test');
  committedQuery = value; runtime.dirty = true; flush();
}
function navigate(value: string) { history.splice(historyIndex + 1); history.push(value); historyIndex++; moveTo(value); }
function back() { expect(historyIndex).toBeGreaterThan(0); moveTo(history[--historyIndex]); }
function forward() { expect(historyIndex).toBeLessThan(history.length - 1); moveTo(history[++historyIndex]); }
function mount(value = '') { history = [value]; historyIndex = 0; moveTo(value); }
function type(value: string) { (input().props.onChange as (e: unknown) => void)({ target: { value } }); flush(); }
function clear() {
  const button = nodes(tree).find(n => n.type === 'button' && n.props['aria-label'] === 'Clear search')!;
  (button.props.onClick as () => void)(); flush();
}
function key(value: string) { const preventDefault = vi.fn(); (input().props.onKeyDown as (e: unknown) => void)({ key: value, preventDefault }); flush(); return preventDefault; }
function response(rows: Row[]) { return { ok: true, json: async () => ({ data: rows }) }; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function signal(call = 0): AbortSignal { return fetcher.mock.calls[call][1].signal; }
function unmount() { if (!runtime.mounted) return; for (const slot of runtime.hooks) if (slot.kind === 'effect') slot.value.cleanup?.(); runtime.mounted = false; }
function replayEffects() {
  const effects = runtime.hooks.filter((h): h is Extract<Hook, { kind: 'effect' }> => h.kind === 'effect');
  for (const slot of effects) slot.value.cleanup?.();
  for (const slot of effects) slot.value.cleanup = slot.value.run() || undefined;
  flush();
}

beforeEach(() => {
  runtime.hooks = []; runtime.cursor = 0; runtime.effects = []; runtime.dirty = true;
  runtime.mounted = true; runtime.lateSetters = 0; committedQuery = ''; variant = 'page'; listeners.clear();
  vi.useFakeTimers();
  storage = new Map();
  writeHistory = vi.fn();
  vi.stubGlobal('window', { location: { get href() { return url.href; }, set href(value: string) { url = new URL(value, url); } }, history: { replaceState: writeHistory, pushState: writeHistory } });
  vi.stubGlobal('document', { addEventListener: (name: string, fn: (e: unknown) => void) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name)!.add(fn); }, removeEventListener: (name: string, fn: (e: unknown) => void) => listeners.get(name)?.delete(fn) });
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
  fetcher = vi.fn(async (request: string) => response(new URL(request, 'https://example.test').searchParams.get('q') === 'Curry' ? [curry] : [lebron]));
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => { unmount(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('SearchInput committed URL queries and local drafts', () => {
  it('adopts a same-route global search query after an empty initial page', async () => {
    mount(); expect(query()).toBe(''); expect(fetcher).not.toHaveBeenCalled();
    navigate('Curry'); expect(query()).toBe('Curry');
    await advance(); expect(destinations()).toEqual(['/player/201939']);
    expect(fetcher).toHaveBeenCalledTimes(1); expect(writeHistory).not.toHaveBeenCalled();
  });
  it('restores Back and Forward queries and clears an absent query', async () => {
    mount(); navigate('Curry'); await advance(); navigate('James'); await advance();
    expect(destinations()).toEqual(['/player/2544']);
    back(); expect(query()).toBe('Curry'); expect(destinations()).toEqual([]); await advance();
    expect(destinations()).toEqual(['/player/201939']);
    back(); expect(query()).toBe(''); expect(destinations()).toEqual([]); await advance();
    forward(); expect(query()).toBe('Curry'); await advance();
    expect(destinations()).toEqual(['/player/201939']); expect(history).toEqual(['', 'Curry', 'James']);
    expect(writeHistory).not.toHaveBeenCalled();
  });
  it('keeps typing drafts across unrelated rerenders and debounces only the latest draft', async () => {
    mount('Curry'); await advance(); type('J'); await advance(100); type('Ja'); await advance(100); type('James');
    runtime.dirty = true; flush(); expect(query()).toBe('James'); expect(url.searchParams.get('q')).toBe('Curry');
    await advance(249); expect(fetcher).toHaveBeenCalledTimes(1); await advance(1);
    expect(destinations()).toEqual(['/player/2544']); expect(fetcher).toHaveBeenCalledTimes(2);
    expect(writeHistory).not.toHaveBeenCalled();
  });
  it('restarts a lookup when an external URL commits the same text as the current draft', async () => {
    const pending = deferred<ReturnType<typeof response>>();
    fetcher.mockImplementationOnce(() => pending.promise);
    mount(); type('Curry'); await advance(); navigate('Curry'); expect(signal().aborted).toBe(true);
    await advance(); expect(destinations()).toEqual(['/player/201939']); expect(fetcher).toHaveBeenCalledTimes(2);
    pending.resolve(response([lebron])); await settle(); expect(destinations()).toEqual(['/player/201939']);
  });
  it('collapses rapid external query changes before debounce into one current request', async () => {
    mount('Curry'); navigate('Jordan'); navigate('James'); await advance();
    expect(query()).toBe('James'); expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toContain('q=James'); expect(destinations()).toEqual(['/player/2544']);
  });
  it('clears a draft without rewriting the URL or reviving the committed query', async () => {
    mount('Curry'); await advance(); clear(); runtime.dirty = true; flush(); await advance();
    expect(query()).toBe(''); expect(destinations()).toEqual([]); expect(url.searchParams.get('q')).toBe('Curry');
    expect(fetcher).toHaveBeenCalledTimes(1); expect(writeHistory).not.toHaveBeenCalled();
    navigate('James'); await advance(); back(); await advance(); expect(query()).toBe('Curry');
  });
});

describe('SearchInput stale responses and cancellation', () => {
  it('ignores a superseded fetch even if it resolves after abort', async () => {
    const old = deferred<ReturnType<typeof response>>(); fetcher.mockImplementationOnce(() => old.promise);
    mount('Curry'); await advance(); navigate('James'); expect(signal().aborted).toBe(true); await advance();
    old.resolve(response([curry])); await settle();
    expect(query()).toBe('James'); expect(destinations()).toEqual(['/player/2544']);
    expect(JSON.parse(storage.get('nba-search-history')!)).toEqual(['James']);
  });
  it('ignores an obsolete JSON body and cannot turn off the newer loading indicator', async () => {
    const oldBody = deferred<{ data: Row[] }>(); const current = deferred<ReturnType<typeof response>>();
    fetcher.mockImplementationOnce(async () => ({ ok: true, json: () => oldBody.promise })).mockImplementationOnce(() => current.promise);
    mount('Curry'); await advance(); navigate('James'); await advance(); expect(loading()).toBe(true);
    oldBody.resolve({ data: [curry] }); await settle(); expect(loading()).toBe(true); expect(destinations()).toEqual([]);
    current.resolve(response([lebron])); await settle(); expect(loading()).toBe(false); expect(destinations()).toEqual(['/player/2544']);
  });
  it('clearing cancels an active body and never reopens results from its late completion', async () => {
    const body = deferred<{ data: Row[] }>(); fetcher.mockImplementationOnce(async () => ({ ok: true, json: () => body.promise }));
    mount('Curry'); await advance(); clear(); expect(signal().aborted).toBe(true);
    body.resolve({ data: [curry] }); await settle(); expect(query()).toBe(''); expect(destinations()).toEqual([]);
    expect(storage.has('nba-search-history')).toBe(false); expect(loading()).toBe(false);
  });
  it('drops below the search threshold without leaving a pending request', async () => {
    const old = deferred<ReturnType<typeof response>>(); fetcher.mockImplementationOnce(() => old.promise);
    mount('Curry'); await advance(); type('C'); expect(signal().aborted).toBe(true); await advance();
    old.resolve(response([curry])); await settle(); expect(query()).toBe('C'); expect(destinations()).toEqual([]); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('keeps the eight-second deadline active until JSON body completion', async () => {
    const body = deferred<{ data: Row[] }>(); fetcher.mockImplementationOnce(async () => ({ ok: true, json: () => body.promise }));
    mount('Curry'); await advance(); await advance(7999); expect(signal().aborted).toBe(false); expect(loading()).toBe(true);
    await advance(1); expect(signal().aborted).toBe(true); expect(loading()).toBe(false);
    body.resolve({ data: [curry] }); await settle(); expect(destinations()).toEqual([]); expect(storage.has('nba-search-history')).toBe(false);
  });
  it('cleans up deadline timers after successful, failed and aborted requests', async () => {
    mount('Curry'); await advance(); expect(vi.getTimerCount()).toBe(0);
    fetcher.mockResolvedValueOnce({ ok: false }); type('James'); await advance(); expect(vi.getTimerCount()).toBe(0); expect(loading()).toBe(false);
    fetcher.mockRejectedValueOnce(new Error('offline')); type('Jordan'); await advance(); expect(vi.getTimerCount()).toBe(0); expect(loading()).toBe(false);
    const old = deferred<ReturnType<typeof response>>(); fetcher.mockImplementationOnce(() => old.promise);
    type('Curry'); await advance(); clear(); expect(vi.getTimerCount()).toBe(0);
    old.resolve(response([curry])); await settle(); expect(destinations()).toEqual([]);
  });
  it('does not update state after unmount even when a body ignores its aborted signal', async () => {
    const body = deferred<{ data: Row[] }>(); fetcher.mockImplementationOnce(async () => ({ ok: true, json: () => body.promise }));
    mount('Curry'); await advance(); unmount(); expect(signal().aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
    body.resolve({ data: [curry] }); await settle(); expect(runtime.lateSetters).toBe(0); expect(storage.has('nba-search-history')).toBe(false);
  });
  it('supports StrictMode effect replay without duplicate requests or late state changes', async () => {
    mount('Curry'); replayEffects(); await advance(); expect(fetcher).toHaveBeenCalledTimes(1);
    expect(destinations()).toEqual(['/player/201939']); unmount(); expect(vi.getTimerCount()).toBe(0); expect(runtime.lateSetters).toBe(0);
  });
});

describe('SearchInput existing result and history handlers', () => {
  it.each([
    [curry, '/player/201939'], [jordan, '/player/893'], [archiveOnly, '/player/767'],
  ] as const)('uses canonical click and Enter destinations %#', async (row, href) => {
    fetcher.mockResolvedValue(response([row])); mount('Curry'); await advance();
    expect(destinations()).toEqual([href]);
    (links()[0].props.onClick as () => void)(); flush(); expect(destinations()).toEqual([]);
    (input().props.onFocus as () => void)(); flush();
    key('ArrowDown'); expect(key('Enter')).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe(new URL(href, 'https://example.test').href);
  });
  it('history selection uses the same current-query request lifecycle', async () => {
    storage.set('nba-search-history', JSON.stringify(['Curry'])); mount();
    (input().props.onFocus as () => void)(); flush();
    const chip = nodes(tree).find(n => n.type === 'button' && n.props.children === 'Curry')!;
    const preventDefault = vi.fn(); (chip.props.onMouseDown as (e: unknown) => void)({ preventDefault }); flush();
    expect(preventDefault).toHaveBeenCalledTimes(1);
    (chip.props.onClick as () => void)(); flush(); expect(query()).toBe('Curry'); await advance();
    expect(destinations()).toEqual(['/player/201939']);
  });
  it('valid empty results finish loading and show no-result content', async () => {
    fetcher.mockResolvedValue(response([])); mount('Unknown'); await advance();
    expect(loading()).toBe(false); expect(destinations()).toEqual([]);
    expect(nodes(tree).some(n => n.props.children === en.searchPage.noResults)).toBe(true);
  });
});


describe('homepage player search keyboard, disclosure and errors', () => {
  it('uses a bounded homepage endpoint and accepts a one-digit NBA ID', async () => {
    variant = 'home'; fetcher.mockResolvedValue(response([{ ...curry, id: 2, name: 'Small ID fixture' }])); mount();
    expect(input().props.autoFocus).toBe(false); type('2'); await advance();
    expect(fetcher.mock.calls[0][0]).toBe('/api/players/search?q=2&limit=8');
    expect(destinations()).toEqual(['/player/2']);
    expect(key('Enter')).toHaveBeenCalledTimes(1); expect(window.location.href).toContain('/player/2');
  });
  it('wraps arrow navigation, discloses the active option, and Escape preserves the query', async () => {
    fetcher.mockResolvedValue(response([curry, jordan])); mount('Curry'); await advance();
    key('ArrowUp'); expect(input().props['aria-activedescendant']).toBe('player-search-test-players-893');
    key('ArrowDown'); expect(input().props['aria-activedescendant']).toBe('player-search-test-players-201939');
    key('ArrowDown'); key('ArrowDown'); expect(input().props['aria-activedescendant']).toBe('player-search-test-players-201939');
    key('Escape'); expect(destinations()).toEqual([]); expect(query()).toBe('Curry'); expect(input().props['aria-expanded']).toBe(false);
    key('ArrowDown'); expect(destinations()).toEqual(['/player/201939', '/player/893']);
    expect(input().props['aria-activedescendant']).toBe('player-search-test-players-201939');
    key('Tab'); expect(destinations()).toEqual([]);
  });
  it('does not interpret an IME composition Enter as choosing a player', async () => {
    mount('Curry'); await advance(); key('ArrowDown');
    const preventDefault = vi.fn(); (input().props.onKeyDown as (event: unknown) => void)({ key: 'Enter', nativeEvent: { isComposing: true }, preventDefault }); flush();
    expect(preventDefault).not.toHaveBeenCalled(); expect(url.pathname).toBe('/search');
  });
  it('an Escape during loading stops late results from reopening the dropdown', async () => {
    const pending = deferred<ReturnType<typeof response>>(); fetcher.mockImplementationOnce(() => pending.promise);
    mount('Curry'); await advance(); key('Escape'); pending.resolve(response([curry])); await settle();
    expect(destinations()).toEqual([]); expect(query()).toBe('Curry');
    (input().props.onFocus as () => void)(); flush(); expect(destinations()).toEqual(['/player/201939']);
  });
  it('outside pointer or focus dismissal also prevents a pending request from reopening', async () => {
    const pending = deferred<ReturnType<typeof response>>(); fetcher.mockImplementationOnce(() => pending.promise);
    mount('Curry'); await advance();
    const root = nodes(tree).find(n => n.props['data-player-search'])!;
    (root.props.ref as { current: unknown }).current = { contains: () => false };
    for (const listener of listeners.get('pointerdown') ?? []) listener({ target: {} }); flush();
    pending.resolve(response([curry])); await settle(); expect(destinations()).toEqual([]);
    (input().props.onFocus as () => void)(); flush(); expect(destinations()).toEqual(['/player/201939']);
    for (const listener of listeners.get('focusin') ?? []) listener({ target: {} }); flush(); expect(destinations()).toEqual([]);
  });
  it('a no-match response is explicit, remains dismissible and reopens on focus', async () => {
    fetcher.mockResolvedValue(response([])); mount('Missing'); await advance();
    expect(nodes(tree).some(n => n.props.children === en.searchPage.noResults)).toBe(true);
    key('Escape'); (input().props.onFocus as () => void)(); flush();
    expect(nodes(tree).some(n => n.props.children === en.searchPage.noResults)).toBe(true);
  });
  it('network failures provide a retry without discarding the query', async () => {
    fetcher.mockRejectedValueOnce(new Error('offline')); mount('Curry'); await advance();
    expect(query()).toBe('Curry'); expect(nodes(tree).some(n => n.props.children === 'Search is temporarily unavailable')).toBe(true);
    const retry = nodes(tree).find(n => n.type === 'button' && n.props.children === 'Try again')!;
    (retry.props.onClick as () => void)(); flush(); await advance();
    expect(destinations()).toEqual(['/player/201939']); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('malformed and invalid-identity responses are unavailable, never a misleading no-match', async () => {
    fetcher.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: -1, name: 'Invalid' }] }) });
    mount('Curry'); await advance(); expect(destinations()).toEqual([]);
    expect(nodes(tree).some(n => n.props.children === 'Search is temporarily unavailable')).toBe(true);
    expect(nodes(tree).some(n => n.props.children === en.searchPage.noResults)).toBe(false);
  });
  it('corrupt browser history is ignored and no history is read into server state', async () => {
    storage.set('nba-search-history', JSON.stringify({ bad: true })); mount();
    (input().props.onFocus as () => void)(); flush(); expect(query()).toBe('');
    expect(nodes(tree).some(n => n.props.children === 'Start with a name or player ID')).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('deduplicates repeated IDs without merging distinct namesakes', async () => {
    fetcher.mockResolvedValue(response([curry, curry, { ...curry, id: 111 }])); mount('Curry'); await advance();
    expect(destinations()).toEqual(['/player/201939', '/player/111']);
  });
  it('form submission keeps the dedicated search page for a query without a selected player', async () => {
    variant = 'home'; mount(); type('Michael Jordan');
    const form = nodes(tree).find(n => n.type === 'form')!; const preventDefault = vi.fn();
    (form.props.onSubmit as (event: unknown) => void)({ preventDefault }); flush();
    expect(preventDefault).toHaveBeenCalledTimes(1); expect(url.pathname).toBe('/search'); expect(url.searchParams.get('q')).toBe('Michael Jordan');
  });
});

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
vi.mock('@/components/LocaleProvider', () => ({ useLocale: () => ({ locale: runtime.locale, t: runtime.locale === 'zh' ? zh : en }) }));
import ClutchPage from '@/app/clutch/page';

type Props = Record<string, unknown>;
type Row = { PLAYER_ID: number; RANK: number; PLAYER: string; TEAM: string; GP: number; MIN: number; PTS: number; REB: number; AST: number; STL: number; BLK: number; FG_PCT: number; FG3_PCT: number; EFF: number };
// Synthetic provider envelopes: these are contract fixtures, not captured live responses.
const base: Row = { PLAYER_ID: 1, RANK: 1, PLAYER: 'Points Leader', TEAM: 'BOS', GP: 82, MIN: 35, PTS: 40, REB: 1, AST: 5, STL: 1, BLK: 0.5, FG_PCT: 0.47, FG3_PCT: 0.3, EFF: 30 };
const reb = { ...base, PLAYER_ID: 2, PLAYER: 'Rebounds Leader', PTS: 5, REB: 20 };
let renderComponent: () => ReactNode;
let tree: ReactNode;
let fetcher: ReturnType<typeof vi.fn>;
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
function payload(rows: Row[]) { const headers = Object.keys(base) as (keyof Row)[]; return { resultSet: { headers, rowSet: rows.map(r => headers.map(h => r[h])) } }; }
const response = (rows: Row[]) => ({ ok: true, json: async () => payload(rows) });
const hasText = (text: string) => nodes(tree).some(n => n.props.children === text || n.props.title === text);

function click(label: string) { const button = nodes(tree).find(n => n.type === 'button' && n.props.children === label)!; expect(button).toBeDefined(); (button.props.onClick as () => void)(); flush(); }
function mount(component: () => ReactNode) { renderComponent = component; flush(); }

beforeEach(() => {
  vi.useFakeTimers();
  runtime.hooks = []; runtime.cursor = 0; runtime.effects = []; runtime.dirty = true;
  runtime.mounted = true; runtime.lateSetters = 0;
  runtime.locale = 'en';
  fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
});
afterEach(() => { for (const h of runtime.hooks) if (h.kind === 'effect') h.value.cleanup?.(); runtime.mounted = false; vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const signal = (call = 0): AbortSignal => fetcher.mock.calls[call][1].signal;
const loading = () => nodes(tree).some(n => n.props.role === 'status' && n.props['aria-label'] === (runtime.locale === 'zh' ? zh.common.loading : en.common.loading));
const table = () => nodes(tree).find(n => n.type === 'table');
const retry = () => click(runtime.locale === 'zh' ? zh.common.retry : en.common.retry);
async function advance(ms: number) { await vi.advanceTimersByTimeAsync(ms); await settle(); }
function renderWithoutEffects() {
  runtime.cursor = 0; runtime.effects = [];
  tree = renderComponent();
}

// Synthetic provider envelopes test component behavior; no fixture is claimed to be live NBA data.
describe('Playoff Performers request ownership', () => {
  it('does not relabel a previous category even in the render before the next effect', async () => {
    const pending = deferred<ReturnType<typeof response>>();
    fetcher.mockResolvedValueOnce(response([base])).mockReturnValueOnce(pending.promise);
    mount(ClutchPage); await settle(); expect(hasText('Points Leader')).toBe(true);
    const button = nodes(tree).find(n => n.type === 'button' && n.props.children === en.clutchPage.scoring)!;
    (button.props.onClick as () => void)();
    renderWithoutEffects(); expect(table()).toBeUndefined(); expect(hasText('Points Leader')).toBe(false);
    flush();
  });
  it('a failed category never leaves previous players or overview cards under the new heading', async () => {
    fetcher.mockResolvedValueOnce(response([base])).mockResolvedValueOnce({ ok: false, status: 504 });
    mount(ClutchPage); await settle(); click(en.clutchPage.playmaking); await settle();
    expect(hasText(en.clutchPage.failedToLoad)).toBe(true); expect(table()).toBeUndefined();
    expect(hasText('Points Leader')).toBe(false); expect(hasText(en.clutchPage.topScorer)).toBe(false);
  });
  it('retries the same exact season, phase and category after failure', async () => {
    fetcher.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response([base]));
    mount(ClutchPage); await settle(); retry(); await settle();
    expect(table()).toBeDefined(); expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toBe(fetcher.mock.calls[0][0]);
    const params = new URL(fetcher.mock.calls[1][0], 'http://localhost').searchParams;
    expect(Object.fromEntries(params)).toMatchObject({ endpoint: 'leagueleaders', Season: CURRENT_SEASON, SeasonType: 'Playoffs', PerMode: 'PerGame', StatCategory: 'EFF', limit: '25' });
  });
  it('deadline ends a stalled fetch and allows a fresh retry without late overwrite', async () => {
    const pending = deferred<ReturnType<typeof response>>();
    fetcher.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response([reb]));
    mount(ClutchPage); await advance(11999); expect(table()).toBeUndefined(); expect(hasText(en.clutchPage.failedToLoad)).toBe(false);
    await advance(1); expect(hasText(en.clutchPage.failedToLoad)).toBe(true); expect(signal().aborted).toBe(true);
    retry(); await settle(); pending.resolve(response([base])); await settle();
    expect(hasText('Rebounds Leader')).toBe(true); expect(hasText('Points Leader')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('deadline covers a stalled JSON body after successful headers', async () => {
    const body = deferred<ReturnType<typeof payload>>();
    fetcher.mockResolvedValueOnce({ ok: true, json: () => body.promise });
    mount(ClutchPage); await settle(); await advance(12000);
    expect(hasText(en.clutchPage.failedToLoad)).toBe(true); expect(table()).toBeUndefined(); expect(signal().aborted).toBe(true);
    body.resolve(payload([base])); await settle(); expect(table()).toBeUndefined();
  });
  it('late old-category JSON cannot replace a newer result', async () => {
    const body = deferred<ReturnType<typeof payload>>();
    fetcher.mockResolvedValueOnce({ ok: true, json: () => body.promise }).mockResolvedValueOnce(response([reb]));
    mount(ClutchPage); await settle(); click(en.clutchPage.playmaking); await settle();
    body.resolve(payload([base])); await settle();
    expect(signal().aborted).toBe(true); expect(hasText('Rebounds Leader')).toBe(true); expect(hasText('Points Leader')).toBe(false);
  });
  it('late old-category completion cannot stop newer loading', async () => {
    const first = deferred<ReturnType<typeof response>>(), second = deferred<ReturnType<typeof response>>();
    fetcher.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    mount(ClutchPage); click(en.clutchPage.playmaking); first.resolve(response([base])); await settle();
    expect(loading()).toBe(true); expect(table()).toBeUndefined();
    second.resolve(response([reb])); await settle(); expect(loading()).toBe(false); expect(table()).toBeDefined();
  });
  it('clicking the selected category repeatedly does not cancel its request', async () => {
    const pending = deferred<ReturnType<typeof response>>(); fetcher.mockReturnValueOnce(pending.promise);
    mount(ClutchPage); click(en.clutchPage.efficiency); click(en.clutchPage.efficiency);
    expect(signal().aborted).toBe(false); expect(fetcher).toHaveBeenCalledTimes(1);
    pending.resolve(response([base])); await settle(); expect(table()).toBeDefined();
  });
  it('repeated retry clicks in one event batch start one owned replacement', async () => {
    const pending = deferred<ReturnType<typeof response>>();
    fetcher.mockRejectedValueOnce(new Error('offline')).mockReturnValueOnce(pending.promise);
    mount(ClutchPage); await settle();
    const button = nodes(tree).find(n => n.type === 'button' && n.props.children === en.common.retry)!;
    expect(button).toBeDefined(); (button.props.onClick as () => void)(); (button.props.onClick as () => void)(); flush();
    expect(fetcher).toHaveBeenCalledTimes(2); expect(signal(1).aborted).toBe(false);
    pending.resolve(response([base])); await settle(); expect(table()).toBeDefined();
  });
  it('unmount aborts pending body and clears the deadline with no late setters', async () => {
    const body = deferred<ReturnType<typeof payload>>(); fetcher.mockResolvedValueOnce({ ok: true, json: () => body.promise });
    mount(ClutchPage); await settle();
    for (const h of runtime.hooks) if (h.kind === 'effect') h.value.cleanup?.(); runtime.mounted = false;
    expect(signal().aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
    body.resolve(payload([base])); await settle(); await advance(12000); expect(runtime.lateSetters).toBe(0);
  });
});

describe('Playoff Performers payloads and honest scope', () => {
  it.each([null, {}, { resultSet: {} }, { resultSet: { headers: ['PLAYER_ID', 'PLAYER', 'PLAYER'], rowSet: [] } }, { resultSet: { headers: ['PLAYER_ID', 'PLAYER'], rowSet: [null] } }])('malformed payload %j is an error, never valid empty or a crash', async raw => {
    fetcher.mockResolvedValueOnce({ ok: true, json: async () => raw }); mount(ClutchPage); await settle();
    expect(hasText(en.clutchPage.failedToLoad)).toBe(true); expect(hasText(en.clutchPage.noData)).toBe(false); expect(table()).toBeUndefined();
  });
  it('valid empty stays distinct from provider failure and keeps retry available', async () => {
    fetcher.mockResolvedValueOnce(response([])).mockResolvedValueOnce(response([base])); mount(ClutchPage); await settle();
    expect(hasText(en.clutchPage.noData)).toBe(true); expect(hasText(en.clutchPage.failedToLoad)).toBe(false); expect(table()).toBeUndefined();
    retry(); await settle(); expect(table()).toBeDefined();
  });
  it('invalid numeric values stay unavailable while genuine zero and negative efficiency survive', async () => {
    fetcher.mockResolvedValueOnce(response([{ ...base, EFF: -2, PTS: '30', AST: {}, STL: 0, GP: NaN, FG_PCT: Infinity } as unknown as Row]));
    mount(ClutchPage); await settle();
    expect(hasText('Points Leader')).toBe(true); expect(hasText('—')).toBe(true); expect(hasText('0.0')).toBe(true); expect(hasText('-2.0')).toBe(true);
    expect(nodes(tree).every(n => !String((n.props.style as { width?: string })?.width).match(/NaN|Infinity|^-/))).toBe(true);
    expect(nodes(tree).some(n => n.props.role === 'status')).toBe(true);
  });
  it('missing selected values do not produce zero-width numeric bars', async () => {
    fetcher.mockResolvedValueOnce(response([{ ...base, EFF: null } as unknown as Row])); mount(ClutchPage); await settle();
    expect(hasText('—')).toBe(true); expect(nodes(tree).filter(n => n.props.style && (n.props.style as { width?: string }).width)).toHaveLength(0);
  });
  it('invalid percentages remain unavailable and known zero renders 0.0%', async () => {
    fetcher.mockResolvedValue(response([{ ...base, FG_PCT: '0.5' } as unknown as Row, { ...reb, FG_PCT: 0 }]));
    mount(ClutchPage); await settle(); click(en.clutchPage.fgPct); await settle();
    expect(hasText('—')).toBe(true); expect(hasText('0.0%')).toBe(true); expect(hasText('50.0%')).toBe(false);
  });
  it('retains original ranks, ties, source order and gaps after rejecting invalid identities', async () => {
    const raw = payload([{ ...base, RANK: 2 }, { ...reb, RANK: 2 }, { ...base, PLAYER_ID: 3, RANK: 5, PLAYER: 'Fifth' }]);
    raw.resultSet.rowSet.unshift(['not a row'] as unknown as (string | number)[]);
    fetcher.mockResolvedValueOnce({ ok: true, json: async () => raw }); mount(ClutchPage); await settle();
    const rows = nodes(tree).filter(n => n.type === 'tr').slice(1);
    expect(rows.map(n => nodes(n.props.children as ReactNode).find(x => x.type === 'span')?.props.children)).toEqual([2, 2, 5]);
  });
  it('missing rank is unavailable rather than array position', async () => {
    fetcher.mockResolvedValueOnce(response([{ ...base, RANK: null } as unknown as Row])); mount(ClutchPage); await settle();
    const row = nodes(tree).filter(n => n.type === 'tr')[1];
    expect(nodes(row.props.children as ReactNode).find(n => n.type === 'span')?.props.children).toBe('—');
  });
  it('duplicate player IDs fail closed instead of merging team splits', async () => {
    fetcher.mockResolvedValueOnce(response([base, { ...base, TEAM: 'TOT' }])); mount(ClutchPage); await settle();
    expect(hasText(en.clutchPage.failedToLoad)).toBe(true); expect(table()).toBeUndefined();
  });
  it('non-team source codes are plain text, while known teams retain valid links', async () => {
    fetcher.mockResolvedValueOnce(response([{ ...base, TEAM: 'TOT' }, reb])); mount(ClutchPage); await settle();
    expect(hasText('TOT')).toBe(true); expect(nodes(tree).some(n => n.props.href === '/team/TOT')).toBe(false);
    expect(nodes(tree).some(n => n.props.href === '/team/BOS')).toBe(true);
  });
  it.each(['en', 'zh'])('does not turn a category-limited subset into league-wide overview leaders (%s)', async locale => {
    runtime.locale = locale; const t = locale === 'zh' ? zh : en;
    fetcher.mockResolvedValueOnce(response([base, reb])); mount(ClutchPage); await settle();
    expect(hasText(t.clutchPage.topScorer)).toBe(false); expect(hasText(t.clutchPage.topPlaymaker)).toBe(false); expect(hasText(t.clutchPage.mostGames)).toBe(false);
    expect(nodes(tree).some(n => n.props.eyebrow === `${CURRENT_SEASON} ${t.clutchPage.eyebrowSuffix}`)).toBe(true);
  });
});

import { isValidElement, Suspense, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Effect = { run: () => void | (() => void); deps?: readonly unknown[]; cleanup?: () => void };
type Hook = { kind: 'state'; value: unknown; set: (value: unknown) => void } | { kind: 'effect'; value: Effect };
const runtime = vi.hoisted(() => ({
  hooks: [] as Hook[], cursor: 0, effects: [] as { index: number; effect: Effect; old?: Effect }[],
  dirty: true, mounted: true, lateSetters: 0, locale: 'en', zone: 'Asia/Shanghai', url: '/calendar?month=2026-10',
}));
// Match React's dependency comparison, post-render cleanup and state equality.
// The real request effect, URL helpers and payload normalizers remain unchanged.
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
  useEffect: (run: Effect['run'], deps?: readonly unknown[]) => {
    const index = runtime.cursor++;
    const old = runtime.hooks[index]?.kind === 'effect' ? (runtime.hooks[index] as Extract<Hook, { kind: 'effect' }>).value : undefined;
    if (!old || !deps || deps.length !== old.deps?.length || deps.some((d, i) => !Object.is(d, old.deps?.[i]))) {
      runtime.effects.push({ index, effect: { run, deps }, old });
    }
  },
}));
import en from '@/locales/en';
import zh from '@/locales/zh';
vi.mock('@/components/LocaleProvider', () => ({ useLocale: () => ({ locale: runtime.locale, t: runtime.locale === 'zh' ? zh : en }) }));
vi.mock('@/lib/timezone', () => ({ localTz: () => runtime.zone }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URL(runtime.url, 'https://example.test').searchParams }));
import Page from '@/app/calendar/page';
import Panel, { PlannedFixtureSection } from '@/components/PlannedFixtures';
import type { PlannedFixture, PlannedFixtureView } from '@/lib/planned-fixtures';

type Props = Record<string, unknown>;
type Reply = { ok: boolean; json: () => Promise<unknown> };
let component: () => ReactNode;
let tree: ReactNode;
let fetcher: ReturnType<typeof vi.fn>;
function nodes(node: ReactNode): { type: unknown; props: Props }[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [{ type: node.type, props: node.props }, ...nodes(node.props.children as ReactNode), ...nodes(node.props.action as ReactNode)];
}
function flush() {
  for (let runs = 0; runtime.dirty; runs++) {
    if (runs > 30) throw new Error('Effects did not settle');
    runtime.cursor = 0; runtime.dirty = false; runtime.effects = [];
    tree = component();
    for (const pending of runtime.effects) pending.old?.cleanup?.();
    for (const pending of runtime.effects) {
      const cleanup = pending.effect.run();
      runtime.hooks[pending.index] = { kind: 'effect', value: { ...pending.effect, cleanup: cleanup || undefined } };
    }
  }
}
async function settle() { for (let i = 0; i < 12; i++) { await Promise.resolve(); flush(); } }
function mount(render: () => ReactNode) { component = render; flush(); }
function rerender() { runtime.dirty = true; flush(); }
function unmount() { for (const hook of runtime.hooks) if (hook.kind === 'effect') hook.value.cleanup?.(); runtime.mounted = false; }
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const response = (payload: unknown): Reply => ({ ok: true, json: async () => payload });
const signal = (call = 0): AbortSignal => fetcher.mock.calls[call][1].signal;
const loading = () => nodes(tree).some(node => node.props.role === 'status' || String(node.props.className).includes('skeleton-shimmer'));
const button = (label: string) => nodes(tree).find(node => node.type === 'button' && (node.props['aria-label'] === label || node.props.children === label));
function click(label: string) { const target = button(label); expect(target).toBeDefined(); (target!.props.onClick as () => void)(); flush(); }
const fixture = (number: number, away = 'LAL', home = 'BOS'): PlannedFixture => ({
  key: `nba-pdf:2026-08-13:by-date:${number}`, officialGameId: null, currentStatus: null, scores: null,
  sourceNumber: number, sourcePages: { byDate: 1, awayTeam: 1, homeTeam: 1 }, dateET: '2026-10-20', timeET: '7:00 PM',
  tipoffUTC: '2026-10-20T23:00:00Z', awayTricode: away, homeTricode: home, relationship: 'at', venue: null,
});
// Synthetic contract records only. No source collection or generated data edits.
const planned = (team = 'LAL', number = 1): PlannedFixtureView => ({ state: 'snapshot', snapshotDate: '2026-08-13', season: '2026-27', timeZone: runtime.zone, fixtures: [fixture(number, team, 'NYK')], nextAvailableDate: null });
const displayedView = () => nodes(tree).find(node => node.type === PlannedFixtureSection)?.props.view as PlannedFixtureView | undefined;
const calendar = (date: string) => ({ data: [{ date, gameCount: 1, games: [{ gameId: '0022500001', homeTricode: 'BOS', awayTricode: 'NYK', gameStatus: 3, homeScore: 100, awayScore: 90 }] }] });
const dateCount = (date: string) => nodes(tree).find(node => node.props.href === `/?date=${date}`)?.props['aria-label'];
const calendarContent = () => {
  const page = Page();
  expect(page.type).toBe(Suspense);
  const child = page.props.children as ReactElement;
  return (child.type as () => ReactNode)();
};

beforeEach(() => {
  runtime.hooks = []; runtime.cursor = 0; runtime.effects = []; runtime.dirty = true; runtime.mounted = true; runtime.lateSetters = 0;
  runtime.locale = 'en'; runtime.zone = 'Asia/Shanghai'; runtime.url = '/calendar?month=2026-10';
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));
  fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('window', {
    get location() { return new URL(runtime.url, 'https://example.test'); },
    history: { replaceState: vi.fn((_state: unknown, _unused: string, href: string) => { runtime.url = href; runtime.dirty = true; }) },
  });
});
afterEach(() => { unmount(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('calendar request ownership', () => {
  it('issues one timezone-resolved request and no new request on unchanged month or locale rerender', async () => {
    fetcher.mockResolvedValue(response(calendar('2026-10-20'))); mount(calendarContent); await settle();
    expect(fetcher).toHaveBeenCalledExactlyOnceWith('/api/calendar?month=2026-10&tz=Asia%2FShanghai', { signal: expect.any(AbortSignal) });
    runtime.locale = 'zh'; rerender(); await settle();
    runtime.url = '/calendar?month=2026-10&tag=new'; rerender(); await settle();
    expect(fetcher).toHaveBeenCalledTimes(1); expect(signal().aborted).toBe(false); expect(loading()).toBe(false);
  });
  it('three rapid Next clicks request only the latest URL month after the batched render', async () => {
    fetcher.mockResolvedValue(response(calendar('2027-01-02'))); mount(calendarContent);
    const next = button('Next month')!.props.onClick as () => void;
    next(); next(); next(); flush(); await settle();
    expect(runtime.url).toBe('/calendar?month=2027-01'); expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toBe('/api/calendar?month=2027-01&tz=Asia%2FShanghai');
    expect(signal().aborted).toBe(true); expect(dateCount('2027-01-02')).toContain('1 listed games');
  });
  it('late JSON cannot replace the new month or end its loading state', async () => {
    const old = deferred<unknown>(), latest = deferred<unknown>();
    fetcher.mockResolvedValueOnce({ ok: true, json: () => old.promise }).mockResolvedValueOnce({ ok: true, json: () => latest.promise });
    mount(calendarContent); await settle(); click('Next month'); await settle();
    old.resolve(calendar('2026-10-20')); await settle();
    expect(signal().aborted).toBe(true); expect(loading()).toBe(true); expect(dateCount('2026-10-20')).toBeUndefined();
    latest.resolve(calendar('2026-11-02')); await settle(); expect(loading()).toBe(false); expect(dateCount('2026-11-02')).toContain('1 listed games');
  });
  it('a late failure cannot replace a newer successful month', async () => {
    const old = deferred<Reply>();
    fetcher.mockImplementationOnce(() => old.promise).mockResolvedValueOnce(response(calendar('2026-11-02')));
    mount(calendarContent); click('Next month'); await settle(); old.reject(new Error('old failure')); await settle();
    expect(dateCount('2026-11-02')).toContain('1 listed games'); expect(nodes(tree).some(node => node.props.role === 'alert')).toBe(false);
  });
  it('Retry shows loading, removes repeat actions, and recovers the selected month', async () => {
    const retried = deferred<Reply>(); fetcher.mockResolvedValueOnce({ ok: false }).mockImplementationOnce(() => retried.promise);
    mount(calendarContent); await settle(); click('Retry');
    expect(loading()).toBe(true); expect(button('Retry')).toBeUndefined(); expect(fetcher).toHaveBeenCalledTimes(2);
    retried.resolve(response(calendar('2026-10-20'))); await settle(); expect(loading()).toBe(false); expect(dateCount('2026-10-20')).toContain('1 listed games');
  });
  it('returning to the same month does not revive its canceled earlier request', async () => {
    const first = deferred<Reply>(), middle = deferred<Reply>();
    fetcher.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => middle.promise).mockResolvedValueOnce(response(calendar('2026-10-21')));
    mount(calendarContent); click('Next month'); click('Previous month'); await settle();
    first.resolve(response(calendar('2026-10-20'))); middle.resolve(response(calendar('2026-11-02'))); await settle();
    expect(fetcher).toHaveBeenCalledTimes(3); expect(signal(0).aborted).toBe(true); expect(signal(1).aborted).toBe(true);
    expect(dateCount('2026-10-21')).toContain('1 listed games'); expect(dateCount('2026-10-20')).toContain('0 listed games');
  });
  it('unmount aborts a pending JSON body without a late state setter', async () => {
    const body = deferred<unknown>(); fetcher.mockResolvedValue({ ok: true, json: () => body.promise });
    mount(calendarContent); await settle(); unmount(); body.resolve(calendar('2026-10-20')); await settle();
    expect(signal().aborted).toBe(true); expect(runtime.lateSetters).toBe(0);
  });
});

describe('planned schedule team request ownership', () => {
  it('does not refetch unchanged team, compact or locale rerenders', async () => {
    let compact = false; fetcher.mockResolvedValue(response(planned())); mount(() => Panel({ team: 'LAL', compact })); await settle();
    compact = true; runtime.locale = 'zh'; rerender(); await settle();
    expect(fetcher).toHaveBeenCalledTimes(1); expect(signal().aborted).toBe(false); expect(displayedView()?.fixtures[0].awayTricode).toBe('LAL');
  });
  it('team changes abort pending JSON and keep loading until the new team resolves', async () => {
    let team = 'LAL'; const old = deferred<unknown>(), latest = deferred<Reply>();
    fetcher.mockResolvedValueOnce({ ok: true, json: () => old.promise }).mockImplementationOnce(() => latest.promise);
    mount(() => Panel({ team })); await settle(); team = 'BOS'; rerender();
    old.resolve(planned('LAL')); await settle(); expect(loading()).toBe(true); expect(displayedView()).toBeUndefined();
    latest.resolve(response(planned('BOS', 2))); await settle(); expect(displayedView()?.fixtures[0].awayTricode).toBe('BOS'); expect(signal().aborted).toBe(true);
  });
  it('changing team during Retry hides the error and a late retry cannot replace its data', async () => {
    let team = 'LAL'; const old = deferred<Reply>();
    fetcher.mockResolvedValueOnce({ ok: false }).mockImplementationOnce(() => old.promise).mockResolvedValueOnce(response(planned('BOS', 2)));
    mount(() => Panel({ team })); await settle(); click('Retry'); team = 'BOS'; rerender(); await settle();
    old.resolve(response(planned('LAL'))); await settle(); expect(displayedView()?.fixtures[0].awayTricode).toBe('BOS'); expect(signal(1).aborted).toBe(true);
  });
  it.each(['en', 'zh'])('Retry reports loading and cannot issue a second retry while pending (%s)', async locale => {
    runtime.locale = locale; const pending = deferred<Reply>();
    fetcher.mockResolvedValueOnce({ ok: false }).mockImplementation(() => pending.promise);
    mount(() => Panel({ team: 'LAL' })); await settle(); click(locale === 'zh' ? '重试' : 'Retry');
    // A still-visible Retry action accepts another user click in the next event.
    const repeat = button(locale === 'zh' ? '重试' : 'Retry');
    if (repeat) { (repeat.props.onClick as () => void)(); flush(); }
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(loading()).toBe(true); expect(button(locale === 'zh' ? '重试' : 'Retry')).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2); expect(signal(1).aborted).toBe(false);
    pending.resolve(response(planned())); await settle(); expect(loading()).toBe(false); expect(displayedView()?.fixtures[0].awayTricode).toBe('LAL');
  });
  it('successful empty fallback and wrong-team payload are distinct, recoverable states', async () => {
    fetcher.mockResolvedValueOnce(response(planned('BOS'))).mockResolvedValueOnce(response({ ...planned(), state: 'canonical', fixtures: [] }));
    mount(() => Panel({ team: 'LAL', fallback: 'Canonical fallback' })); await settle(); expect(button('Retry')).toBeDefined();
    click('Retry'); await settle(); expect(tree).toBe('Canonical fallback'); expect(loading()).toBe(false);
  });
  it('a failed retry leaves loading and makes a later retry available', async () => {
    const retry = deferred<Reply>();
    fetcher.mockResolvedValueOnce({ ok: false }).mockImplementationOnce(() => retry.promise).mockResolvedValueOnce(response(planned()));
    mount(() => Panel({ team: 'LAL' })); await settle(); click('Retry'); expect(loading()).toBe(true);
    retry.reject(new Error('request unavailable')); await settle();
    expect(loading()).toBe(false); expect(button('Retry')).toBeDefined();
    click('Retry'); await settle(); expect(fetcher).toHaveBeenCalledTimes(3); expect(displayedView()?.fixtures[0].awayTricode).toBe('LAL');
  });
  it('returning to the same team never revives its canceled request', async () => {
    let team = 'LAL'; const old = deferred<Reply>(), middle = deferred<Reply>();
    fetcher.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => middle.promise).mockResolvedValueOnce(response(planned('LAL', 3)));
    mount(() => Panel({ team })); team = 'BOS'; rerender(); team = 'LAL'; rerender(); await settle();
    old.resolve(response(planned('LAL', 1))); middle.resolve(response(planned('BOS', 2))); await settle();
    expect(displayedView()?.fixtures[0].sourceNumber).toBe(3); expect(signal(0).aborted).toBe(true); expect(signal(1).aborted).toBe(true);
  });
  it.each(['error', 'success'])('returning to a team hides its retained %s while the replacement is pending', async previous => {
    let team = 'LAL'; const middle = deferred<Reply>(), latest = deferred<Reply>();
    fetcher.mockResolvedValueOnce(previous === 'error' ? { ok: false } : response(planned('LAL', 1)))
      .mockImplementationOnce(() => middle.promise).mockImplementationOnce(() => latest.promise);
    mount(() => Panel({ team })); await settle(); team = 'BOS'; rerender(); team = 'LAL'; rerender();
    expect(loading()).toBe(true); expect(button('Retry')).toBeUndefined(); expect(displayedView()).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(3); expect(signal(1).aborted).toBe(true); expect(signal(2).aborted).toBe(false);
    middle.resolve(response(planned('BOS', 2))); await settle(); expect(loading()).toBe(true);
    latest.resolve(response(planned('LAL', 3))); await settle(); expect(loading()).toBe(false); expect(displayedView()?.fixtures[0].sourceNumber).toBe(3);
  });
  it('a local-day change aborts the older request and scopes the replacement to the new date', async () => {
    const old = deferred<Reply>(); fetcher.mockImplementationOnce(() => old.promise).mockResolvedValueOnce(response(planned('LAL', 2)));
    mount(() => Panel({ team: 'LAL' })); vi.setSystemTime(new Date('2026-10-08T12:00:00Z')); rerender(); await settle();
    expect(fetcher.mock.calls[1][0]).toContain('from=2026-10-08');
    old.resolve(response(planned('LAL', 1))); await settle(); expect(displayedView()?.fixtures[0].sourceNumber).toBe(2); expect(signal().aborted).toBe(true);
  });
  it('unmount cancels a retry and prevents a late failure from setting state', async () => {
    const retry = deferred<Reply>(); fetcher.mockResolvedValueOnce({ ok: false }).mockImplementationOnce(() => retry.promise);
    mount(() => Panel({ team: 'LAL' })); await settle(); click('Retry'); unmount(); retry.reject(new Error('late')); await settle();
    expect(signal(1).aborted).toBe(true); expect(runtime.lateSetters).toBe(0);
  });
});

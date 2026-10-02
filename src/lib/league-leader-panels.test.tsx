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
import PlayerLeaders from '@/components/stats/PlayerLeaders';
import MvpLadder from '@/components/stats/MvpLadder';
import AwardsRaceClient from '@/app/awards-race/AwardsRaceClient';
import { metadata as awardsMetadata } from '@/app/awards-race/layout';

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
const destination = (id: number) => nodes(tree).some(n => n.props.href === `/player/${id}`);
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

function retry() { const action = nodes(tree).find(n => n.props.action)?.props.action as { onClick: () => void }; expect(action).toBeDefined(); action.onClick(); flush(); }
function season(value: string) { const select = nodes(tree).find(n => n.type === 'select')!; (select.props.onChange as (event: unknown) => void)({ target: { value } }); flush(); }
function race(value: string) { const button = nodes(tree).find(n => n.type === 'button' && Array.isArray(n.props.children) && n.props.children.includes(value))!; (button.props.onClick as () => void)(); flush(); }
const loading = () => nodes(tree).some(n => String(n.props.className).includes('skeleton-shimmer'));
const signal = (call = 0): AbortSignal => fetcher.mock.calls[call][1].signal;
async function advance(ms: number) { await vi.advanceTimersByTimeAsync(ms); await settle(); }
const awards = () => AwardsRaceClient({ mvpSeasons: [] });
const currentIndex = (id = 1) => ({ ok: true, json: async () => ({ data: [{ personId: id, firstName: 'Rookie', lastName: 'One', fromYear: CURRENT_SEASON.slice(0, 4), toYear: CURRENT_SEASON.slice(0, 4), draftYear: null }], provenance: { source: 'nba-cdn', season: CURRENT_SEASON, stale: false, retrievedAt: null } }) });

describe('PlayerLeaders request ownership and safe numeric rendering', () => {
  it('a retried Points request cannot overwrite a newer Rebs response', async () => {
    const old = deferred<ReturnType<typeof response>>();
    fetcher.mockResolvedValueOnce({ ok: false, status: 504 }).mockImplementationOnce(() => old.promise).mockResolvedValueOnce(response([reb]));
    mount(PlayerLeaders); await settle(); retry(); expect(signal(1).aborted).toBe(false);
    click('Rebs'); await settle(); expect(signal(1).aborted).toBe(true); expect(hasText('Rebounds Leader')).toBe(true);
    old.resolve(response([base])); await settle();
    expect(hasText('Rebounds Leader')).toBe(true); expect(hasText('Points Leader')).toBe(false);
    expect(fetcher.mock.calls[2][0]).toContain('StatCategory=REB'); expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('late JSON from a previous season cannot overwrite a newer result or loading state', async () => {
    const oldBody = deferred<ReturnType<typeof payload>>(), newBody = deferred<ReturnType<typeof payload>>();
    fetcher.mockResolvedValueOnce({ ok: true, json: () => oldBody.promise }).mockResolvedValueOnce({ ok: true, json: () => newBody.promise });
    mount(PlayerLeaders); await settle(); season('Playoffs'); await settle(); expect(signal().aborted).toBe(true);
    oldBody.resolve(payload([base])); await settle(); expect(loading()).toBe(true); expect(hasText('Points Leader')).toBe(false);
    newBody.resolve(payload([reb])); await settle(); expect(hasText('Rebounds Leader')).toBe(true); expect(loading()).toBe(false);
    expect(fetcher.mock.calls[1][0]).toContain('SeasonType=Playoffs'); expect(fetcher.mock.calls[1][0]).toContain(`Season=${CURRENT_SEASON}`);
  });
  it('clicking the already selected category or season does not cancel its live request', async () => {
    const pending = deferred<ReturnType<typeof response>>(); fetcher.mockImplementationOnce(() => pending.promise);
    mount(PlayerLeaders); click('Points'); season('Regular Season'); expect(signal().aborted).toBe(false);
    pending.resolve(response([base])); await settle(); expect(hasText('Points Leader')).toBe(true); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('null selected values render dashes and preserve usable rows and optional null fields', async () => {
    fetcher.mockResolvedValue(response([{ ...base, PTS: null, MIN: null, FG_PCT: null, FG3_PCT: null } as unknown as Row, reb]));
    mount(PlayerLeaders); await settle(); expect(hasText('Points Leader')).toBe(true); expect(hasText('Rebounds Leader')).toBe(true); expect(hasText('—')).toBe(true);
    expect(hasText('NaN')).toBe(false); expect(nodes(tree).every(n => !String((n.props.style as { width?: string })?.width).includes('NaN'))).toBe(true);
  });
  it('unknown percentages remain dashes while genuine zeros stay zero', async () => {
    fetcher.mockResolvedValue(response([{ ...base, FG3_PCT: null, PTS: 0, REB: 0, AST: 0, STL: 0, BLK: 0 } as unknown as Row]));
    mount(PlayerLeaders); await settle(); click('3P%'); await settle(); expect(hasText('—')).toBe(true); expect(hasText('0.0')).toBe(true); expect(hasText('0.0%')).toBe(false);
    expect(fetcher.mock.calls[1][0]).toContain('StatCategory=FG3_PCT');
  });
});

describe('source errors, valid empty responses and manual recovery', () => {
  it.each([PlayerLeaders, MvpLadder, awards])('duplicate source IDs make the whole response unavailable in panel %#', async component => {
    fetcher.mockImplementation(async (url: string) => url.includes('/api/player-index') ? currentIndex() : response([base, { ...base, TEAM: 'TOT' }]));
    mount(component); await settle(); expect(hasText(en.statsPage.failedToLoad)).toBe(true); expect(hasText('Points Leader')).toBe(false);
  });
  it.each([PlayerLeaders, MvpLadder])('HTTP/JSON/schema failures expose retry and recover for panel %#', async component => {
    for (const failure of ['http', 'json', 'shape']) {
      if (runtime.hooks.length) { for (const h of runtime.hooks) if (h.kind === 'effect') h.value.cleanup?.(); runtime.hooks = []; runtime.dirty = true; }
      fetcher.mockReset().mockResolvedValueOnce({ ok: failure !== 'http', status: 504, json: async () => { if (failure === 'json') throw new Error('bad body'); return {}; } }).mockResolvedValueOnce(response([base]));
      mount(component); await settle(); expect(hasText(en.statsPage.failedToLoad)).toBe(true); expect(hasText(en.statsPage.noMvpTitle)).toBe(false);
      retry(); await settle(); expect(hasText('Points Leader')).toBe(true); expect(hasText(en.statsPage.failedToLoad)).toBe(false); expect(fetcher).toHaveBeenCalledTimes(2);
    }
  });
  it('Awards stats failure and retry do not refetch a successful rookie index', async () => {
    let statsCalls = 0;
    fetcher.mockImplementation(async (url: string) => url.includes('/api/player-index') ? currentIndex() : ++statsCalls === 1 ? { ok: false } : response([base]));
    mount(awards); await settle(); expect(hasText(en.statsPage.failedToLoad)).toBe(true); expect(hasText('No qualifying players yet')).toBe(false);
    retry(); await settle(); expect(destination(1)).toBe(true); expect(fetcher.mock.calls.filter(c => c[0].includes('/api/player-index'))).toHaveLength(1); expect(statsCalls).toBe(2);
  });
  it.each([PlayerLeaders, MvpLadder, awards])('valid empty data remains distinct from source errors in panel %#', async component => {
    fetcher.mockImplementation(async (url: string) => url.includes('/api/player-index') ? currentIndex() : response([]));
    mount(component); await settle(); expect(hasText(en.statsPage.failedToLoad)).toBe(false); expect(nodes(tree).some(n => n.props.action)).toBe(false); expect(loading()).toBe(false);
  });
  it.each([PlayerLeaders, MvpLadder, awards])('a wholly invalid nonempty response is unavailable in panel %#', async component => {
    fetcher.mockImplementation(async (url: string) => url.includes('/api/player-index') ? currentIndex() : response([{ ...base, PLAYER_ID: 0 }]));
    mount(component); await settle(); expect(hasText(en.statsPage.failedToLoad)).toBe(true); expect(nodes(tree).some(n => n.props.action)).toBe(true);
  });
});

describe('honest partial data and original source ranks', () => {
  const partialNotice = () => nodes(tree).filter(n => n.props.role === 'status').map(n => n.props.children).join(' ');
  it.each([
    [PlayerLeaders, 'en'], [PlayerLeaders, 'zh'], [MvpLadder, 'en'], [MvpLadder, 'zh'], [awards, 'en'], [awards, 'zh'],
  ] as const)('mixed usable/rejected records disclose partial data in panel %#', async (component, locale) => {
    runtime.locale = locale;
    fetcher.mockImplementation(async (url: string) => url.includes('/api/player-index') ? currentIndex(2) : response([{ ...base, PLAYER_ID: 0 }, { ...reb, RANK: 7 }]));
    mount(component); await settle(); expect(hasText('Rebounds Leader')).toBe(true); expect(partialNotice()).toContain(locale === 'zh' ? '部分' : 'Partial data');
    expect(hasText(en.statsPage.failedToLoad)).toBe(false);
  });
  it.each([PlayerLeaders, MvpLadder, awards])('mixed missing used statistics are disclosed without erasing usable players in panel %#', async component => {
    fetcher.mockImplementation(async (url: string) => url.includes('/api/player-index') ? currentIndex(2) : response([{ ...base, PTS: null } as unknown as Row, reb]));
    mount(component); await settle(); expect(hasText('Rebounds Leader')).toBe(true); expect(partialNotice()).toContain('Partial data');
  });
  it.each([PlayerLeaders, MvpLadder, awards])('unused optional null fields alone do not imply an incomplete ranking in panel %#', async component => {
    fetcher.mockImplementation(async (url: string) => url.includes('/api/player-index') ? currentIndex() : response([{ ...base, MIN: null, FG_PCT: null, FG3_PCT: null } as unknown as Row]));
    mount(component); await settle(); expect(hasText('Points Leader')).toBe(true); expect(partialNotice()).toBe('');
  });
  it('PlayerLeaders preserves nullable original rank and source order without assigning a replacement gold medal', async () => {
    fetcher.mockResolvedValue(response([{ ...base, PLAYER_ID: 0 }, { ...base, RANK: 7 }, { ...reb, RANK: null } as unknown as Row]));
    mount(PlayerLeaders); await settle();
    const names = nodes(tree).filter(n => n.type === 'span' && ['Points Leader', 'Rebounds Leader'].includes(String(n.props.children))).map(n => n.props.children);
    expect(names).toEqual(['Points Leader', 'Rebounds Leader']); expect(nodes(tree).some(n => n.props.children === 7)).toBe(true); expect(hasText('—')).toBe(true);
    expect(nodes(tree).some(n => String(n.props.className).includes('ring-[#FFD700]'))).toBe(false);
    expect(partialNotice()).toContain('original ranks');
  });
});

describe('formula inputs and rookie eligibility', () => {
  it.each([undefined, null, NaN, Infinity, -1])('unknown or invalid GP %s never produces an MVP candidate or NaN score', async gp => {
    fetcher.mockResolvedValue(response([{ ...base, GP: gp } as unknown as Row])); mount(MvpLadder); await settle();
    expect(destination(1)).toBe(false); expect(hasText('NaN')).toBe(false); expect(hasText(en.statsPage.failedToLoad)).toBe(true);
  });
  it('missing formula fields exclude only those rows, while unused optional fields and TOT remain valid', async () => {
    fetcher.mockResolvedValue(response([{ ...base, REB: null } as unknown as Row, { ...reb, TEAM: 'TOT', MIN: null, FG_PCT: null, FG3_PCT: null } as unknown as Row]));
    mount(MvpLadder); await settle(); expect(destination(1)).toBe(false); expect(destination(2)).toBe(true); expect(hasText('TOT')).toBe(true); expect(hasText(en.statsPage.failedToLoad)).toBe(false);
  });
  it('known GP below the existing minimum keeps the qualification message', async () => {
    fetcher.mockResolvedValue(response([{ ...base, GP: 39 }])); mount(MvpLadder); await settle(); expect(hasText(en.statsPage.noMvpTitle)).toBe(true); expect(hasText(en.statsPage.failedToLoad)).toBe(false);
  });
  it('a valid zero composite score never generates a NaN/Infinity progress width', async () => {
    fetcher.mockResolvedValue(response([{ ...base, GP: 60, PTS: 0, REB: 0, AST: 0, STL: 0, BLK: 0, EFF: -20 }]));
    mount(MvpLadder); await settle(); expect(destination(1)).toBe(true); expect(hasText('0.0')).toBe(true);
    expect(nodes(tree).every(n => !/NaN|Infinity/.test(String((n.props.style as { width?: string })?.width)))).toBe(true);
  });
  it.each(['MVP', 'DPOY', 'ROY'])('each supported race excludes unavailable required values before scoring: %s', async label => {
    const field: Record<string, keyof Row> = { MVP: 'EFF', DPOY: 'BLK', ROY: 'AST' };
    const invalid = { ...base, MIN: 25, [field[label]]: null } as unknown as Row;
    fetcher.mockImplementation(async (url: string) => url.includes('/api/player-index') ? currentIndex() : response([invalid]));
    mount(awards); await settle(); race(label); expect(destination(1)).toBe(false); expect(hasText(en.statsPage.failedToLoad)).toBe(true); expect(hasText('NaN')).toBe(false);
  });
  it('DPOY can rank with its required inputs when unused scoring fields are null', async () => {
    fetcher.mockImplementation(async (url: string) => url.includes('/api/player-index') ? currentIndex() : response([{ ...base, PTS: null, AST: null, EFF: null, FG_PCT: null, FG3_PCT: null } as unknown as Row]));
    mount(awards); await settle(); race('DPOY'); expect(destination(1)).toBe(true); expect(hasText('—')).toBe(true);
  });
  it('ROY remains restricted to exact validated cohort IDs', async () => {
    fetcher.mockImplementation(async (url: string) => url.includes('/api/player-index') ? currentIndex(2) : response([base, reb]));
    mount(awards); await settle(); race('ROY'); expect(destination(2)).toBe(true); expect(destination(1)).toBe(false);
  });
  it('a failed rookie source can recover independently without new stats requests', async () => {
    let indexCalls = 0;
    fetcher.mockImplementation(async (url: string) => url.includes('/api/player-index') ? ++indexCalls === 1 ? { ok: false } : currentIndex() : response([base]));
    mount(awards); await settle(); race('ROY'); expect(hasText('Current-season rookie cohort unavailable')).toBe(true); expect(destination(1)).toBe(false);
    retry(); await settle(); expect(destination(1)).toBe(true); expect(fetcher.mock.calls.filter(c => c[0].includes('/api/stats?'))).toHaveLength(1); expect(indexCalls).toBe(2);
  });
});

describe('Awards prerequisites and supported heuristic scope', () => {
  const unavailableTitle = (label: string) => runtime.locale === 'zh'
    ? label === '6MOY' ? '第六人排名暂不可用' : '进步最快球员排名暂不可用'
    : `${label} ranking unavailable`;
  function expectPrerequisite(label: string) {
    const message = nodes(tree).find(n => n.props.title === unavailableTitle(label));
    expect(message).toBeDefined();
    expect(message?.props.tone).toBe('neutral');
    expect(message?.props.action).toBeUndefined();
    expect(nodes(tree).some(n => n.props.action)).toBe(false);
    expect(nodes(tree).some(n => typeof n.props.href === 'string' && n.props.href.startsWith('/player/'))).toBe(false);
    expect(loading()).toBe(false);
    expect(hasText(en.statsPage.failedToLoad)).toBe(false);
    expect(hasText('No qualifying players yet')).toBe(false);
    expect(nodes(tree).some(n => typeof n.props.children === 'string' && n.props.children.includes('Site heuristic based on'))).toBe(false);
    return message!.props.description;
  }

  it.each([
    ['6MOY', 'en'], ['MIP', 'en'], ['6MOY', 'zh'], ['MIP', 'zh'],
  ])('keeps %s selectable with a specific %s explanation and no score or retry', async (label, locale) => {
    runtime.locale = locale;
    fetcher.mockImplementation(async (url: string) => url.includes('/api/player-index') ? currentIndex() : response([{ ...base, MIN: 25 }]));
    mount(awards); await settle(); race(label);
    const description = expectPrerequisite(label);
    expect(description).toBe(locale === 'zh'
      ? label === '6MOY'
        ? '此视图缺少已核实的本赛季首发场次，无法结合出场场次确定替补球员范围。场均上场时间无法证明替补身份。'
        : '此视图缺少同一球员可比较的本赛季与上一赛季统计。仅凭本赛季表现无法衡量进步。'
      : label === '6MOY'
        ? 'Verified current-season start counts are unavailable for comparison with games played. Minutes per game cannot establish a bench-player role.'
        : 'This view lacks comparable current- and previous-season statistics for the same players. Current-season production alone cannot measure improvement.');
    const selected = nodes(tree).find(n => n.type === 'button' && Array.isArray(n.props.children) && n.props.children.includes(label));
    expect(selected?.props['aria-pressed']).toBe(true); expect(selected?.props.disabled).not.toBe(true);
    expect(hasText('47.0')).toBe(false); expect(hasText('47.4')).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each(['6MOY', 'MIP'])('shows %s prerequisites before a pending body and after its late success', async label => {
    const body = deferred<ReturnType<typeof payload>>();
    fetcher.mockImplementation(async (url: string) => url.includes('/api/player-index') ? currentIndex() : { ok: true, json: () => body.promise });
    mount(awards); await settle(); expect(loading()).toBe(true);
    race(label); expectPrerequisite(label);
    body.resolve(payload([{ ...base, MIN: 25 }])); await settle(); expectPrerequisite(label);
    race('MVP'); expect(destination(1)).toBe(true); expect(hasText('65.0')).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each(['6MOY', 'MIP'])('shows %s prerequisites after timeout and ignores a noncooperative late body', async label => {
    const body = deferred<ReturnType<typeof payload>>();
    fetcher.mockImplementation(async (url: string) => url.includes('/api/player-index') ? currentIndex() : { ok: true, json: () => body.promise });
    mount(awards); await settle(); race(label); await advance(12000); expectPrerequisite(label);
    body.resolve(payload([base])); await settle(); expectPrerequisite(label);
    race('MVP'); expect(hasText(en.statsPage.failedToLoad)).toBe(true); expect(destination(1)).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each(['6MOY', 'MIP'].flatMap(label => ['failed', 'malformed', 'empty', 'rejected'].map(state => [label, state])))('preserves %s prerequisites with a %s response', async (label, state) => {
    const results = {
      failed: { ok: false },
      malformed: { ok: true, json: async () => ({ resultSet: null }) },
      empty: response([]),
      rejected: response([{ ...base, PLAYER_ID: 0 }]),
    };
    fetcher.mockImplementation(async (url: string) => url.includes('/api/player-index') ? currentIndex() : results[state as keyof typeof results]);
    mount(awards); await settle(); race(label); expectPrerequisite(label);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each(['6MOY', 'MIP'])('does not enable %s from low minutes, extreme production or unvalidated extra fields', async label => {
    const rows = [0, 27.9, 28, 48].map((MIN, index) => ({ ...base, PLAYER_ID: index + 1, MIN, PTS: 100, EFF: 999 }));
    const valid = payload(rows);
    const raw = { resultSet: {
      headers: [...valid.resultSet.headers, 'GS', 'PREVIOUS_SEASON_EFF'],
      rowSet: valid.resultSet.rowSet.map(row => [...row, 0, 0]),
    } };
    fetcher.mockImplementation(async (url: string) => url.includes('/api/player-index') ? currentIndex() : { ok: true, json: async () => raw });
    mount(awards); await settle(); race(label); expectPrerequisite(label);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each(['en', 'zh'])('keeps MVP/DPOY as disclosed site heuristics in %s without tab requests', async locale => {
    runtime.locale = locale;
    fetcher.mockImplementation(async (url: string) => url.includes('/api/player-index') ? currentIndex() : response([base]));
    mount(awards); await settle(); expect(destination(1)).toBe(true); expect(hasText('65.0')).toBe(true);
    const methodology = locale === 'zh'
      ? '本站启发式排名，基于本赛季可用常规赛样本（按 EFF 最多取 100 名球员）。此视图要求至少出场 20 场。分数不代表官方投票或 NBA 奖项资格。'
      : 'Site heuristic based on the available current-season regular-season sample (up to 100 players by EFF). At least 20 games are required by this view. Scores are not official voting or NBA award eligibility.';
    expect(hasText(methodology)).toBe(true);
    race('6MOY'); expectPrerequisite('6MOY'); expect(hasText(methodology)).toBe(false);
    race('MIP'); expectPrerequisite('MIP'); expect(hasText(methodology)).toBe(false);
    race('DPOY'); expect(destination(1)).toBe(true); expect(hasText('7.7')).toBe(true); expect(hasText(methodology)).toBe(true);
    race('ROY'); expect(destination(1)).toBe(true);
    race('MVP'); expect(destination(1)).toBe(true); expect(hasText('65.0')).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('metadata distinguishes supported site rankings from unavailable prerequisites', () => {
    expect(awardsMetadata.description).toContain('Site-computed MVP, DPOY and ROY');
    expect(awardsMetadata.description).toContain('Sixth Man and Most Improved rankings remain unavailable');
    expect(awardsMetadata.openGraph?.description).toContain('6MOY and MIP data requirements');
    expect(JSON.stringify(awardsMetadata)).not.toMatch(/Live tracking of every|auto-updated leaderboards|derived from the official NBA player index/);
  });
});

describe('request deadlines, body cancellation and unmount', () => {
  it.each([PlayerLeaders, MvpLadder, awards])('StrictMode cleanup/replay leaves only the replay request able to commit in panel %#', async component => {
    const old = deferred<ReturnType<typeof response>>(); let statsCalls = 0;
    fetcher.mockImplementation((url: string) => url.includes('/api/player-index') ? Promise.resolve(currentIndex()) : ++statsCalls === 1 ? old.promise : Promise.resolve(response([reb])));
    mount(component);
    const effects = runtime.hooks.filter((h): h is Extract<Hook, { kind: 'effect' }> => h.kind === 'effect');
    for (const h of effects) h.value.cleanup?.();
    for (const h of effects) h.value.cleanup = h.value.run() || undefined;
    await settle(); expect(signal().aborted).toBe(true); expect(hasText('Rebounds Leader')).toBe(true);
    old.resolve(response([base])); await settle(); expect(hasText('Points Leader')).toBe(false); expect(statsCalls).toBe(2); expect(vi.getTimerCount()).toBe(0);
  });
  it.each([PlayerLeaders, MvpLadder, awards])('keeps body deadline and ignores late completion after retry in panel %#', async component => {
    const body = deferred<ReturnType<typeof payload>>(); let count = 0;
    fetcher.mockImplementation(async (url: string) => url.includes('/api/player-index') ? currentIndex() : ++count === 1 ? { ok: true, json: () => body.promise } : response([reb]));
    mount(component); await settle(); await advance(11999); expect(loading()).toBe(true); expect(signal().aborted).toBe(false);
    await advance(1); expect(hasText(en.statsPage.failedToLoad)).toBe(true); expect(signal().aborted).toBe(true); expect(count).toBe(1);
    retry(); await settle(); expect(hasText('Rebounds Leader')).toBe(true);
    body.resolve(payload([base])); await settle(); expect(hasText('Rebounds Leader')).toBe(true); expect(hasText('Points Leader')).toBe(false); expect(count).toBe(2); expect(vi.getTimerCount()).toBe(0);
  });
  it('allows a slow valid body after ten seconds before the twelve-second deadline', async () => {
    const body = deferred<ReturnType<typeof payload>>(); fetcher.mockResolvedValue({ ok: true, json: () => body.promise });
    mount(PlayerLeaders); await settle(); await advance(10001); body.resolve(payload([base])); await settle();
    expect(hasText('Points Leader')).toBe(true); expect(signal().aborted).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
  it.each([PlayerLeaders, MvpLadder, awards])('unmount prevents delayed body updates and clears timers in panel %#', async component => {
    const body = deferred<ReturnType<typeof payload>>(); fetcher.mockImplementation(async (url: string) => url.includes('/api/player-index') ? currentIndex() : { ok: true, json: () => body.promise });
    mount(component); await settle(); for (const h of runtime.hooks) if (h.kind === 'effect') h.value.cleanup?.(); runtime.mounted = false;
    body.resolve(payload([base])); await settle(); expect(runtime.lateSetters).toBe(0); expect(signal().aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
  it('the rookie index body timeout fails closed and does not poll', async () => {
    const body = deferred<Awaited<ReturnType<ReturnType<typeof currentIndex>['json']>>>();
    fetcher.mockImplementation(async (url: string) => url.includes('/api/player-index') ? { ok: true, json: () => body.promise } : response([base]));
    mount(awards); await settle(); race('ROY'); expect(loading()).toBe(true); await advance(12000);
    expect(hasText('Current-season rookie cohort unavailable')).toBe(true); expect(fetcher).toHaveBeenCalledTimes(2);
    body.resolve(await currentIndex().json()); await settle(); expect(destination(1)).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
});

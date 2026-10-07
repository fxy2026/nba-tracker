import { isValidElement, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeatmapIdentity, SeasonHeatmapArchiveResource } from '@/lib/season-heatmap';
import type { SeasonShotMapResource } from '@/lib/season-shot-map';

type Effect = { deps: readonly unknown[]; cleanup?: () => void };
type Instance = { type: unknown; slots: unknown[]; index: number };
const runtime = vi.hoisted(() => ({
  current: null as Instance | null,
  instances: new Map<string, Instance>(),
  effects: [] as (() => void)[],
}));

// Deterministic component lifecycle, following the existing profile interaction
// suites. This tests request ownership, not browser rendering or React scheduling.
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const instance = runtime.current!, index = instance.index++;
    if (!(index in instance.slots)) instance.slots[index] = typeof initial === 'function' ? initial() : initial;
    return [instance.slots[index], (value: unknown) => {
      instance.slots[index] = typeof value === 'function' ? value(instance.slots[index]) : value;
    }];
  },
  useRef: (initial: unknown) => {
    const instance = runtime.current!, index = instance.index++;
    return instance.slots[index] ?? (instance.slots[index] = { current: initial });
  },
  useEffect: (run: () => void | (() => void), deps: readonly unknown[]) => {
    const instance = runtime.current!, index = instance.index++, prior = instance.slots[index] as Effect | undefined;
    if (!prior || deps.length !== prior.deps.length || deps.some((value, i) => !Object.is(value, prior.deps[i]))) {
      runtime.effects.push(() => {
        prior?.cleanup?.();
        instance.slots[index] = { deps, cleanup: run() };
      });
    }
  },
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));

// These status-only transport fixtures deliberately contain no basketball stats.
// Decoder validation has its own suites; the actual URL builders, cancellation,
// timeout, cache and selection logic remain active here.
vi.mock('@/lib/season-heatmap-request', async original => ({
  ...await original<typeof import('@/lib/season-heatmap-request')>(),
  decodeCourtSeasonHeatmapResource: (value: unknown) => value as SeasonHeatmapArchiveResource,
}));
vi.mock('@/lib/season-shot-map-client', () => ({
  decodeSeasonShotMapResource: (value: unknown) => value as SeasonShotMapResource,
}));

import RefinedShotExplorer from '../shot-map/RefinedShotExplorer';
import PlayerSeasonHeatmap from './PlayerSeasonHeatmap';

type Props = Parameters<typeof PlayerSeasonHeatmap>[0];
type View = Parameters<typeof RefinedShotExplorer>[0];
type Pending = { url: string; signal: AbortSignal; cache: RequestCache; resolve: (value: Response) => void };
const a: HeatmapIdentity = { playerId: 201939, season: '2025-26', seasonType: 'Regular Season' };
const b: HeatmapIdentity = { ...a, season: '2015-16' };
const playoffs: HeatmapIdentity = { ...b, seasonType: 'Playoffs' };
const ready = (identity: HeatmapIdentity) => ({ status: 'ready', data: identity }) as SeasonHeatmapArchiveResource;
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
let url: URL, pending: Pending[], fetcher: ReturnType<typeof vi.fn>, props: Props;

function cleanup(instance: Instance) {
  for (const slot of instance.slots) (slot as Effect | undefined)?.cleanup?.();
}
function render(): View {
  const seen = new Set<string>();
  let node = PlayerSeasonHeatmap(props) as ReactElement;
  let path = 'root';
  while (isValidElement(node) && node.type !== RefinedShotExplorer) {
    path += `:${node.key ?? ''}`;
    let instance = runtime.instances.get(path);
    if (instance && instance.type !== node.type) { cleanup(instance); instance = undefined; }
    if (!instance) { instance = { type: node.type, slots: [], index: 0 }; runtime.instances.set(path, instance); }
    seen.add(path); instance.index = 0; runtime.current = instance;
    node = (node.type as (props: unknown) => ReactElement)(node.props);
    runtime.current = null;
  }
  for (const [key, instance] of runtime.instances) {
    if (!seen.has(key)) { cleanup(instance); runtime.instances.delete(key); }
  }
  runtime.effects.splice(0).forEach(run => run());
  expect(node.type).toBe(RefinedShotExplorer);
  return node.props as View;
}
function request(index: number, resource: 'aggregate' | 'spatial') {
  const entry = pending[index];
  expect(entry, `Request ${index} exists`).toBeDefined();
  expect(new URL(entry.url, url).pathname).toBe(resource === 'aggregate' ? '/api/player-season-heatmap' : '/api/player-season-shot-map');
  return entry;
}
async function answer(entry: Pending, status: 'ready' | 'error' | 'unavailable', identity = a) {
  entry.resolve({ ok: status === 'ready', status: status === 'ready' ? 200 : status === 'unavailable' ? 404 : 503,
    json: async () => status === 'ready' ? ready(identity) : { status } } as Response);
  await settle();
}
function choose(identity: HeatmapIdentity) {
  render().onChoose(identity);
  render();
  return render();
}
function retry() {
  render().onRetry();
  render();
  return render();
}

beforeEach(() => {
  runtime.instances.forEach(cleanup); runtime.instances.clear(); runtime.effects = [];
  url = new URL('https://nba.xpy.me/player/201939?panel=shooting'); pending = [];
  props = { player: { id: a.playerId, name: 'Lifecycle test' }, locale: 'en',
    datasets: [a, b, playoffs].map(identity => ({ ...identity, availability: 'available' })),
    initialSelection: a, initialResource: ready(a) };
  fetcher = vi.fn((input: string, options: RequestInit) => new Promise<Response>(resolve => {
    pending.push({ url: input, signal: options.signal!, cache: options.cache!, resolve });
  }));
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('window', {
    location: { get href() { return url.href; }, get pathname() { return url.pathname; }, get search() { return url.search; }, get hash() { return url.hash; } },
    history: { pushState: (_state: unknown, _title: string, href: string) => { url = new URL(href, url); } },
    dispatchEvent: vi.fn(),
  });
});
afterEach(() => {
  runtime.instances.forEach(cleanup); runtime.instances.clear(); runtime.effects = [];
  vi.unstubAllGlobals(); vi.useRealTimers();
});

describe.each(['en', 'zh'] as const)('independent shooting recovery in %s', locale => {
  it('retries a failed spatial request without refetching or clearing a ready aggregate', async () => {
    props.locale = locale;
    render(); await answer(request(0, 'spatial'), 'error');
    const before = render(); expect(before.aggregate.status).toBe('ready'); expect(before.spatial.status).toBe('error');
    const recovering = retry();
    expect(pending).toHaveLength(2);
    const recovery = request(1, 'spatial'); expect(recovery.cache).toBe('no-store');
    expect(recovering.aggregate).toBe(before.aggregate); expect(recovering.spatial.status).toBe('loading');
    await answer(recovery, 'ready');
    expect(render().spatial.status).toBe('ready'); expect(render().aggregate).toBe(before.aggregate);
  });
  it('retries an aggregate error without refetching or clearing ready spatial data', async () => {
    props.locale = locale; props.initialResource = { status: 'error' };
    render(); await answer(request(0, 'spatial'), 'ready');
    const before = render(); expect(before.aggregate.status).toBe('error');
    const recovering = retry();
    expect(pending).toHaveLength(2); expect(request(1, 'aggregate').cache).toBe('no-store');
    expect(recovering.spatial).toBe(before.spatial); expect(recovering.aggregate.status).toBe('loading');
    await answer(pending[1], 'ready'); expect(render().aggregate.status).toBe('ready');
  });
});

it('does not abort an already-pending sibling request while retrying an aggregate error', async () => {
  props.initialResource = { status: 'error' };
  render(); const spatial = request(0, 'spatial');
  const recovering = retry();
  expect(pending).toHaveLength(2); expect(request(1, 'aggregate').cache).toBe('no-store');
  expect(spatial.signal.aborted).toBe(false); expect(recovering.spatial.status).toBe('loading');
  await answer(spatial, 'ready'); await answer(pending[1], 'ready');
  expect(render().spatial.status).toBe('ready'); expect(render().aggregate.status).toBe('ready');
});

it('does not abort an already-pending aggregate while retrying a spatial error', async () => {
  render(); await answer(request(0, 'spatial'), 'ready');
  choose(b);
  const aggregate = request(1, 'aggregate');
  await answer(request(2, 'spatial'), 'error', b);
  const recovering = retry();
  expect(pending).toHaveLength(4); expect(request(3, 'spatial').cache).toBe('no-store');
  expect(aggregate.signal.aborted).toBe(false); expect(recovering.aggregate.status).toBe('loading');
  await answer(aggregate, 'ready', b); await answer(pending[3], 'ready', b);
  expect(render().aggregate).toEqual(ready(b)); expect(render().spatial).toEqual(ready(b));
});

it('does not recheck an unavailable sibling resource when the other resource fails', async () => {
  props.initialResource = { status: 'unavailable' };
  render(); await answer(request(0, 'spatial'), 'error');
  expect(retry().aggregate.status).toBe('unavailable');
  expect(pending).toHaveLength(2); expect(request(1, 'spatial').cache).toBe('no-store');
});

it('retries both failed resources once and ignores retry callbacks while both are loading', async () => {
  props.initialResource = { status: 'error' };
  render(); await answer(request(0, 'spatial'), 'error');
  const view = retry(); expect(pending).toHaveLength(3);
  expect(view.aggregate.status).toBe('loading'); expect(view.spatial.status).toBe('loading');
  expect(request(1, 'aggregate').cache).toBe('no-store'); expect(request(2, 'spatial').cache).toBe('no-store');
  retry(); expect(pending).toHaveLength(3);
  expect(pending[1].signal.aborted).toBe(false); expect(pending[2].signal.aborted).toBe(false);
  await answer(pending[1], 'ready'); await answer(pending[2], 'ready');
});

it('keeps failed spatial retries from turning previously usable Zones into another error', async () => {
  render(); await answer(request(0, 'spatial'), 'error');
  retry();
  for (const entry of pending.slice(1)) await answer(entry, 'error');
  expect(render().spatial.status).toBe('error'); expect(render().aggregate.status).toBe('ready');
});

it('scopes recovery to the current season/type, ignores old responses, and reuses successful revisits', async () => {
  render(); await answer(request(0, 'spatial'), 'ready');
  choose(b);
  const oldAggregate = request(1, 'aggregate'), oldSpatial = request(2, 'spatial');
  choose(playoffs);
  expect(oldAggregate.signal.aborted).toBe(true); expect(oldSpatial.signal.aborted).toBe(true);
  await answer(request(3, 'aggregate'), 'ready', playoffs); await answer(request(4, 'spatial'), 'error', playoffs);
  const recovering = retry();
  expect(pending).toHaveLength(6); expect(recovering.aggregate.status).toBe('ready');
  const recovery = request(5, 'spatial');
  expect(new URL(recovery.url, url).searchParams.get('seasonType')).toBe('Playoffs');
  await answer(recovery, 'ready', playoffs);
  await answer(oldAggregate, 'ready', b); await answer(oldSpatial, 'ready', b);
  expect(render().selection).toEqual(playoffs);
  expect(render().spatial).toEqual(ready(playoffs));
  choose(a); expect(render().aggregate).toEqual(ready(a)); expect(render().spatial).toEqual(ready(a));
  choose(playoffs); expect(render().spatial).toEqual(ready(playoffs)); expect(pending).toHaveLength(6);
});

it('aborts an old player request and never exposes it in the replacement session', async () => {
  render(); const old = request(0, 'spatial');
  const other = { ...a, playerId: 977 };
  props = { ...props, player: { id: 977, name: 'Other lifecycle test' }, initialSelection: other,
    initialResource: ready(other), datasets: [{ ...other, availability: 'available' }] };
  url = new URL('https://nba.xpy.me/player/977?panel=shooting');
  render(); expect(old.signal.aborted).toBe(true);
  await answer(old, 'ready', a); expect(render().spatial.status).toBe('loading');
  await answer(request(1, 'spatial'), 'ready', other);
  expect(render().selection).toEqual(other); expect(render().spatial).toEqual(ready(other));
});

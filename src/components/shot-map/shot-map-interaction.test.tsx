import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import type { HeatmapIdentity, SeasonHeatmapDisplayRow, SeasonHeatmapRendererDTO } from '@/lib/season-heatmap';
import type { SeasonShotMapDTO, ShotMapBin } from '@/lib/season-shot-map';
import { loadHistoricalShotMap } from '@/lib/historical-shot-spatial';
import { loadHistoricalCourtArchive } from '@/lib/historical-shot-archive';
import { zoneName } from '../season-heatmap/season-heatmap-display';
import RefinedShotExplorer from './RefinedShotExplorer';
import { binKey } from './ShotMapCourt';
import { axialCenter, displayPct, fgRate, projectShot, SHOT_MAP_ZONE_PALETTE } from './shot-map-display';

// Exercise the real rendered component and event handlers without a browser.
// Hook state belongs to a live component path/key, and unmounted keys are removed
// so returning to an earlier selection cannot resurrect its previous details.
const hooks = vi.hoisted(() => ({
  scopes: new Map<string, unknown[]>(),
  live: new Set<string>(),
  scope: '',
  index: 0,
  nextId: 0,
  effects: [] as (() => void)[],
  refs: new Map<string, { ref: { current: unknown }; instance: unknown }>(),
  liveRefs: new Set<string>(),
}));
vi.mock('server-only', () => ({}));
vi.mock('react', async original => {
  const react = await original<typeof import('react')>();
  const slot = (initial: () => unknown) => {
    const values = hooks.scopes.get(hooks.scope)!;
    const index = hooks.index++;
    if (!(index in values)) values[index] = initial();
    return { values, index };
  };
  return {
    ...react,
    useState: (initial: unknown) => {
      const { values, index } = slot(() => typeof initial === 'function' ? initial() : initial);
      return [values[index], (value: unknown) => {
        values[index] = typeof value === 'function' ? value(values[index]) : value;
      }];
    },
    useId: () => {
      const { values, index } = slot(() => `:test-${++hooks.nextId}:`);
      return values[index];
    },
    useRef: (initial: unknown) => {
      const { values, index } = slot(() => ({ current: initial }));
      return values[index];
    },
    useEffect: (effect: () => void | (() => void), dependencies?: readonly unknown[]) => {
      const { values, index } = slot(() => undefined);
      const previous = values[index] as EffectState | undefined;
      if (!previous || !dependencies || !previous.dependencies || dependencies.length !== previous.dependencies.length || dependencies.some((value, index) => !Object.is(value, previous.dependencies![index]))) {
        const next: EffectState = { kind: 'effect', dependencies };
        values[index] = next;
        hooks.effects.push(() => {
          previous?.cleanup?.();
          const cleanup = effect();
          if (typeof cleanup === 'function') next.cleanup = cleanup;
        });
      }
    },
  };
});

type ExplorerProps = Parameters<typeof RefinedShotExplorer>[0];
interface HostProps { children?: ReactNode; [key: string]: unknown }
interface EffectState { kind: 'effect'; dependencies?: readonly unknown[]; cleanup?: () => void }
interface HostInstance { focus: ReturnType<typeof vi.fn>; scrollIntoView: ReturnType<typeof vi.fn> }
function resolve(node: ReactNode, path: string): ReactNode {
  if (Array.isArray(node)) return node.map((child, index) => resolve(child, `${path}/${isValidElement(child) && child.key !== null ? child.key : index}`));
  if (!isValidElement<HostProps>(node)) return node;
  if (typeof node.type === 'function') {
    // Shared Select owns its popup behavior; this suite exercises its controlled
    // onValueChange boundary, just as the parent receives it from the filter.
    if (typeof node.props.onValueChange === 'function' && Array.isArray(node.props.options)) return node;
    const scope = `${path}/${node.type.name}:${node.key ?? ''}`;
    hooks.live.add(scope);
    if (!hooks.scopes.has(scope)) hooks.scopes.set(scope, []);
    hooks.scope = scope;
    hooks.index = 0;
    const component = node.type as (props: HostProps) => ReactNode;
    return resolve(component(node.props), scope);
  }
  // Minimal host refs support post-commit reveal and dismissal focus effects.
  const hostPath = `${path}/${String(node.type)}`;
  const ref = node.props.ref as { current: unknown } | undefined;
  if (ref) {
    hooks.liveRefs.add(hostPath);
    const previous = hooks.refs.get(hostPath);
    if (previous && previous.ref !== ref) previous.ref.current = null;
    const instance = previous?.ref === ref ? previous.instance : { focus: vi.fn(), scrollIntoView: vi.fn() };
    ref.current = instance;
    hooks.refs.set(hostPath, { ref, instance });
  }
  return cloneElement(node, undefined, resolve(node.props.children, hostPath));
}
function elements(node: ReactNode, predicate: string | ((node: ReactElement<HostProps>) => boolean)): ReactElement<HostProps>[] {
  if (Array.isArray(node)) return node.flatMap(child => elements(child, predicate));
  if (!isValidElement<HostProps>(node)) return [];
  const match = typeof predicate === 'string' ? node.type === predicate : predicate(node);
  return [...(match ? [node] : []), ...elements(node.props.children, predicate)];
}
function text(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  return isValidElement<HostProps>(node) ? text(node.props.children) : '';
}
function fire(node: ReactElement<HostProps>, handler: string, event: unknown = {}) {
  const callback = node.props[handler];
  expect(callback, `${handler} must be available`).toBeTypeOf('function');
  (callback as (event: unknown) => void)(event);
}
function court(tree: ReactNode) {
  const result = elements(tree, node => node.type === 'svg' && !!node.props['data-shot-map-view']);
  expect(result).toHaveLength(1);
  return result[0];
}
function liveStatus(tree: ReactNode) {
  const result = elements(tree, node => node.props['aria-live'] === 'polite');
  expect(result).toHaveLength(1);
  expect(result[0].props['aria-atomic']).toBe('true');
  expect(result[0].props.className).toMatch(/srOnly/);
  return result[0];
}
function button(tree: ReactNode, label: string) {
  const result = elements(tree, 'button').find(node => node.props['aria-label'] === label || text(node) === label);
  expect(result, `button ${label}`).toBeDefined();
  return result!;
}
function key(tree: ReactNode, value: string) {
  const event = { key: value, preventDefault: vi.fn(), stopPropagation: vi.fn() };
  fire(court(tree), 'onKeyDown', event);
  return event;
}
function position(bin: ShotMapBin) { return projectShot(...axialCenter(bin.q, bin.r, 25)); }
function clickBin(tree: ReactNode, bin: ShotMapBin) {
  const [x, y] = position(bin);
  fire(court(tree), 'onClick', {
    clientX: x + 370, clientY: y + 220,
    currentTarget: { getBoundingClientRect: () => ({ left: 100, top: 200, width: 540, height: 510 }) },
  });
}
function detailValue(tree: ReactNode, label: string) {
  const aside = elements(tree, 'aside');
  expect(aside).toHaveLength(1);
  const row = elements(aside[0], 'div').find(node => elements(node, 'dt').length === 1 && text(elements(node, 'dt')[0]) === label);
  expect(row, `detail row ${label}`).toBeDefined();
  return text(elements(row, 'dd')[0]);
}
function host(node: ReactElement<HostProps>) { return (node.props.ref as { current: HostInstance }).current; }
function expectDetailReveal(aside: ReactElement<HostProps>) {
  expect(host(aside).scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest' });
  expect(host(aside).focus).not.toHaveBeenCalled();
}
function expectBinDetails(tree: ReactNode, bin: ShotMapBin, locale: 'en' | 'zh') {
  const aside = elements(tree, 'aside');
  expect(aside).toHaveLength(1);
  expectDetailReveal(aside[0]);
  expect(aside[0].props['aria-label']).toBe(locale === 'en' ? 'Shot details' : '投篮详情');
  expect(detailValue(tree, locale === 'en' ? 'Made / attempts' : '命中 / 出手')).toBe(`${bin.fgm} / ${bin.fga}`);
  expect(detailValue(tree, locale === 'en' ? '3P made / attempts' : '三分命中 / 出手')).toBe(`${bin.fg3m} / ${bin.fg3a}`);
  expect(detailValue(tree, locale === 'en' ? 'Same-cell league archive' : '同格联盟档案')).toContain(`${bin.league.fgm} / ${bin.league.fga}`);
  expect(text(aside)).toContain(displayPct(fgRate(bin)));
  expect(court(tree).props['aria-controls']).toBe(aside[0].props.id);
  expect(text(liveStatus(tree)).replace(/\s+/g, '')).toContain(`${bin.fgm}/${bin.fga}`);
}
function expectZoneDetails(tree: ReactNode, row: SeasonHeatmapDisplayRow, locale: 'en' | 'zh') {
  const aside = elements(tree, 'aside');
  expect(aside).toHaveLength(1);
  expectDetailReveal(aside[0]);
  expect(text(elements(aside[0], 'h3')[0])).toBe(zoneName(row.id, locale));
  expect(detailValue(tree, locale === 'en' ? 'Made / attempts' : '命中 / 出手')).toBe(`${row.fgm} / ${row.fga}`);
  expect(text(aside)).toContain(displayPct(fgRate(row)));
  expect(text(liveStatus(tree))).toContain(zoneName(row.id, locale));
  expect(text(liveStatus(tree)).replace(/\s+/g, '')).toContain(`${row.fgm}/${row.fga}`);
}
let data: SeasonShotMapDTO, zones: SeasonHeatmapRendererDTO, bins: readonly ShotMapBin[];
beforeAll(async () => {
  const identity = { playerId: 201939, season: '2025-26', seasonType: 'Regular Season' as const };
  const spatial = await loadHistoricalShotMap(identity);
  const aggregate = await loadHistoricalCourtArchive(identity);
  if (spatial.status !== 'ready' || aggregate.status !== 'ready') throw new Error('Real source fixture unavailable');
  data = spatial.data;
  zones = aggregate.data;
  bins = data.resolutions.find(resolution => resolution.id === 'fine')!.bins;
});
beforeEach(() => {
  hooks.scopes.clear(); hooks.live.clear(); hooks.scope = ''; hooks.index = 0; hooks.nextId = 0;
  hooks.effects = []; hooks.refs.clear(); hooks.liveRefs.clear();
});
function mount(overrides: Partial<ExplorerProps> = {}) {
  let props: ExplorerProps = {
    player: { id: 201939, name: 'Stephen Curry' }, locale: 'en',
    datasets: ['2025-26', '2015-16'].map(season => ({ ...data, season, availability: 'available' as const })),
    selection: { playerId: data.playerId, season: data.season, seasonType: data.seasonType },
    spatial: { status: 'ready', data }, aggregate: { status: 'ready', data: zones },
    onChoose: selection => setIdentity(selection), onRetry: vi.fn(), ...overrides,
  };
  // Keep the same valid cell/zone IDs in each identity. Otherwise a missing bin
  // could hide a failure to reset local selection and make this a false pass.
  function setIdentity(selection: HeatmapIdentity) {
    props = { ...props, selection, player: { ...props.player, id: selection.playerId },
      spatial: { status: 'ready', data: { ...data, ...selection } },
      aggregate: { status: 'ready', data: { ...zones, ...selection } },
    };
  }
  function render() {
    hooks.live.clear(); hooks.liveRefs.clear();
    const tree = resolve(<RefinedShotExplorer {...props} />, 'root');
    for (const [scope, values] of hooks.scopes) if (!hooks.live.has(scope)) {
      for (const value of values) if (value && typeof value === 'object' && 'kind' in value && value.kind === 'effect') (value as EffectState).cleanup?.();
      hooks.scopes.delete(scope);
    }
    for (const [path, mounted] of hooks.refs) if (!hooks.liveRefs.has(path)) {
      mounted.ref.current = null;
      hooks.refs.delete(path);
    }
    for (const effect of hooks.effects.splice(0)) effect();
    return tree;
  }
  return { render, setIdentity, get selection() { return props.selection; } };
}

const locales = ['en', 'zh'] as const;
const spatialViews = ['hex', 'density'] as const;
describe.each(locales)('click-first shot details (%s)', locale => {
  it.each(['hex', 'density', 'zones'] as const)('starts with a bare %s court and a mounted empty announcement', view => {
    const app = mount({ locale, initialView: view });
    const tree = app.render();
    expect(elements(tree, 'aside')).toHaveLength(0);
    expect(text(liveStatus(tree))).toBe('');
    expect(court(tree).props['aria-controls']).toBeUndefined();
    expect(elements(tree, node => node.props['aria-label'] === (locale === 'en' ? 'Season' : '赛季'))).toHaveLength(1);
    for (const label of ['Choose a shot location', 'Previous location', 'Next location', '选择投篮位置', '上一个位置', '下一个位置']) {
      expect(elements(tree, node => node.props['aria-label'] === label)).toHaveLength(0);
    }
    expect(text(tree)).not.toContain(locale === 'en' ? 'Start with a spot' : '从一处投篮开始');
  });

  it.each(spatialViews)('opens exact %s counts on a cell click, then dismisses and restores court focus', view => {
    const app = mount({ locale, initialView: view });
    let tree = app.render();
    const bin = bins.find(item => { const [x, y] = position(item); return x > -240 && x < 240 && y > 0 && y < 470; })!;
    clickBin(tree, bin);
    tree = app.render();
    expectBinDetails(tree, bin, locale);
    expect(host(court(tree)).focus).not.toHaveBeenCalled();
    const detail = host(elements(tree, 'aside')[0]);
    expect(detail.scrollIntoView).toHaveBeenCalledOnce();
    app.render();
    expect(detail.scrollIntoView).toHaveBeenCalledOnce();
    const close = button(tree, locale === 'en' ? 'Close details' : '关闭详情');
    expect(close.props.title).toBe(locale === 'en' ? 'Close details' : '关闭详情');
    const ref = court(tree).props.ref as { current: { focus: ReturnType<typeof vi.fn> } };
    fire(close, 'onClick');
    tree = app.render();
    expect(elements(tree, 'aside')).toHaveLength(0);
    expect(court(tree).props['aria-controls']).toBeUndefined();
    expect(ref.current.focus).toHaveBeenCalledOnce();
    expect(ref.current.focus).toHaveBeenLastCalledWith({preventScroll:true});
    expect(host(court(tree)).scrollIntoView).toHaveBeenLastCalledWith({block:'nearest'});
    expect(text(liveStatus(tree))).toBe('');
    clickBin(tree, bin);
    tree = app.render();
    expectBinDetails(tree, bin, locale);
    const escape = { key: 'Escape', preventDefault: vi.fn() };
    fire(elements(tree, 'aside')[0], 'onKeyDown', escape);
    expect(escape.preventDefault).toHaveBeenCalledOnce();
    expect(elements(app.render(), 'aside')).toHaveLength(0);
    expect(ref.current.focus).toHaveBeenCalledTimes(2);
  });

  it.each(spatialViews)('ignores empty %s court clicks and keeps navigation keys predictable', view => {
    const app = mount({ locale, initialView: view });
    let tree = app.render();
    const candidates = Array.from({ length: 81 }, (_, index) => [-200 + index % 9 * 50, 25 + Math.floor(index / 9) * 25]);
    const empty = candidates.find(([x, y]) => bins.every(bin => Math.hypot(position(bin)[0] - x, position(bin)[1] - y) > 30));
    expect(empty).toBeDefined();
    for (const [x, y] of [empty!, [-270, 0]]) {
      fire(court(tree), 'onClick', {
        clientX: x + 370, clientY: y + 220,
        currentTarget: { getBoundingClientRect: () => ({ left: 100, top: 200, width: 540, height: 510 }) },
      });
      tree = app.render();
      expect(elements(tree, 'aside')).toHaveLength(0);
    }
    expect(key(tree, 'Tab').preventDefault).not.toHaveBeenCalled();
    key(tree, 'End');
    for (const unchanged of ['Tab', 'Enter', ' ']) {
      tree = app.render();
      const event = key(tree, unchanged);
      if (unchanged === 'Tab') expect(event.preventDefault).not.toHaveBeenCalled();
      expectBinDetails(app.render(), bins[bins.length - 1], locale);
    }
  });

  it.each(spatialViews)('supports Enter, Space, Home, End and Escape in %s', view => {
    const app = mount({ locale, initialView: view });
    for (const activation of ['Enter', ' ', 'Home', 'End']) {
      const event = key(app.render(), activation);
      expect(event.preventDefault).toHaveBeenCalledOnce();
      const tree = app.render();
      expectBinDetails(tree, activation === 'End' ? bins[bins.length - 1] : bins[0], locale);
      key(tree, 'Escape');
      const cleared = app.render();
      expect(elements(cleared, 'aside')).toHaveLength(0);
      expect(text(liveStatus(cleared))).toBe('');
    }
  });

  it.each(spatialViews)('moves through real neighboring %s cells with all four arrows', view => {
    const app = mount({ locale, initialView: view });
    const bin = bins.find(item => {
      const [x, y] = position(item);
      return x > -200 && x < 200 && y > 100 && y < 350 &&
        bins.some(other => position(other)[0] < x) && bins.some(other => position(other)[0] > x) &&
        bins.some(other => position(other)[1] < y) && bins.some(other => position(other)[1] > y);
    })!;
    expect(bin).toBeDefined();
    for (const [arrow, axis, sign] of [['ArrowLeft', 0, -1], ['ArrowRight', 0, 1], ['ArrowUp', 1, -1], ['ArrowDown', 1, 1]] as const) {
      clickBin(app.render(), bin);
      const before = app.render();
      const event = key(before, arrow);
      expect(event.preventDefault).toHaveBeenCalledOnce();
      const tree = app.render();
      // The SVG exposes the exact selected source-cell count in its focus ring.
      const focusRing = elements(court(tree), node => node.type === 'g' && node.key === 'selected')[0];
      expect(focusRing).toBeDefined();
      const polygon = elements(focusRing, 'polygon')[0];
      const points = String(polygon.props.points).split(' ').map(point => point.split(',').map(Number));
      const center = points.reduce((total, point) => [total[0] + point[0] / 6, total[1] + point[1] / 6], [0, 0]);
      const selected = bins.find(item => position(item).every((value, index) => Math.abs(value - center[index]) < 0.1))!;
      expect(selected).toBeDefined();
      expect(binKey(selected)).not.toBe(binKey(bin));
      expect((position(selected)[axis] - position(bin)[axis]) * sign).toBeGreaterThan(0);
      expectBinDetails(tree, selected, locale);
    }
  });

  it('opens zones with pointer, Enter and Space, preserves the zone list and clears with Escape', () => {
    const app = mount({ locale, initialView: 'zones' });
    let tree = app.render();
    const paths = elements(tree, node => node.type === 'path' && !!node.props['data-zone-id']);
    expect(paths).toHaveLength(12);
    for (const [index, activation] of ['click', 'Enter', ' '].entries()) {
      const path = elements(tree, node => node.type === 'path' && !!node.props['data-zone-id'])[index];
      const row = zones.zones.find(item => item.id === path.props['data-zone-id'])!;
      const event = { key: activation, preventDefault: vi.fn(), stopPropagation: vi.fn() };
      fire(path, activation === 'click' ? 'onClick' : 'onKeyDown', event);
      if (activation === 'click') expect(event.stopPropagation).toHaveBeenCalledOnce();
      else expect(event.preventDefault).toHaveBeenCalledOnce();
      tree = app.render();
      expectZoneDetails(tree, row, locale);
      expect(host(court(tree)).focus).not.toHaveBeenCalled();
      expect(elements(tree, node => node.props['data-zone-id'] === row.id)[0].props['aria-pressed']).toBe(true);
      key(tree, 'Escape');
      tree = app.render();
      expect(elements(tree, 'aside')).toHaveLength(0);
      expect(elements(tree, node => node.props['data-zone-id'] === row.id)[0].props['aria-pressed']).toBe(false);
    }
    expect(text(elements(tree, 'summary'))).toContain(locale === 'en' ? 'All zone statistics' : '全部分区统计');
    const row = zones.zones[0];
    const alternate = elements(tree, 'button').find(node => text(node).startsWith(zoneName(row.id, locale)))!;
    fire(alternate, 'onClick');
    expectZoneDetails(app.render(), row, locale);
  });

  it('closes tapped zone details and returns to the court without a default focus jump',()=>{
    const app=mount({locale,initialView:'zones'});
    let tree=app.render();
    const path=elements(tree,node=>!!node.props['data-zone-id'])[0];
    fire(path,'onClick',{stopPropagation:vi.fn()});
    tree=app.render();
    expect(elements(tree,'aside')).toHaveLength(1);
    const courtHost=host(court(tree));
    fire(button(tree,locale==='en'?'Close details':'关闭详情'),'onClick');
    tree=app.render();
    expect(elements(tree,'aside')).toHaveLength(0);
    expect(courtHost.focus).toHaveBeenLastCalledWith({preventScroll:true});
    expect(courtHost.scrollIntoView).toHaveBeenLastCalledWith({block:'nearest'});
    expect(elements(tree,node=>Boolean(node.props['data-zone-id']&&node.props['aria-pressed']))).toHaveLength(0);
  });

  it.each(['player', 'league', 'both', 'neither', 'zero'] as const)('labels %s small samples once, separately from zone color', sample => {
    const row: SeasonHeatmapDisplayRow = {
      ...zones.zones.find(zone => zone.id === 'midrange-center')!,
      fgm: sample === 'zero' ? 0 : sample === 'player' || sample === 'both' ? 8 : 50,
      fga: sample === 'zero' ? 0 : sample === 'player' || sample === 'both' ? 17 : 100,
      leagueAverage: { provenance: 'weighted-archive-counts-not-official-displayed-LA', displayedPct: '40.0', leagueFgm: sample === 'league' || sample === 'both' ? 4 : 40, leagueFga: sample === 'league' || sample === 'both' ? 10 : 100 },
    };
    const app = mount({ locale, initialView: 'zones', aggregate: { status: 'ready', data: { ...zones, zones: zones.zones.map(zone => zone.id === row.id ? row : zone) } } });
    let tree = app.render();
    const path = elements(tree, node => node.props['data-zone-id'] === row.id)[0];
    expect(path.props.fill).toBe(sample === 'zero' ? 'var(--map-zone-neutral, #d7d8d4)' : `var(--map-zone-above, ${SHOT_MAP_ZONE_PALETTE.above})`);
    fire(path, 'onClick', { stopPropagation: vi.fn() });
    tree = app.render();
    expectZoneDetails(tree, row, locale);
    const aside = elements(tree, 'aside')[0];
    const low = sample === 'player' || sample === 'league' || sample === 'both';
    expect(elements(aside, node => node.type === 'span' && text(node) === (locale === 'en' ? 'Small sample' : '小样本'))).toHaveLength(low ? 1 : 0);
    if (sample === 'player' || sample === 'both') expect(text(aside)).toContain(locale === 'en' ? 'Fewer than 25 player attempts' : '球员少于 25 次出手');
    if (sample === 'league' || sample === 'both') expect(text(aside)).toContain(locale === 'en' ? 'Fewer than 20 league reference attempts' : '联盟参考少于 20 次出手');
    if (low) expect(text(aside)).toContain(locale === 'en' ? 'small samples are uncertain' : '小样本波动较大');
    expect(text(aside)).not.toContain(locale === 'en' ? 'shown in gray' : '使用灰色');
  });

  it('clears both zone and spatial selections when switching between their views', () => {
    const app = mount({ locale, initialView: 'zones' });
    let tree = app.render();
    const path = elements(tree, node => node.type === 'path' && !!node.props['data-zone-id'])[0];
    fire(path, 'onClick', { stopPropagation: vi.fn() });
    tree = app.render();
    expect(elements(tree, 'aside')).toHaveLength(1);
    fire(button(tree, locale === 'en' ? 'Hexagons' : '六边形'), 'onClick');
    tree = app.render();
    expect(elements(tree, 'aside')).toHaveLength(0);
    key(tree, 'Enter');
    tree = app.render();
    expectBinDetails(tree, bins[0], locale);
    fire(button(tree, locale === 'en' ? 'Zones' : '球场分区'), 'onClick');
    tree = app.render();
    expect(elements(tree, 'aside')).toHaveLength(0);
    expect(text(liveStatus(tree))).toBe('');
    expect(elements(tree, node => node.type === 'path' && node.props['aria-pressed'] === true)).toHaveLength(0);
  });

  it.each(['season', 'player', 'type', 'mode'] as const)('remounts details for %s changes and does not resurrect them on return', change => {
    const app = mount({ locale });
    const original = app.selection;
    key(app.render(), 'Enter');
    expectBinDetails(app.render(), bins[0], locale);
    const choose = (back: boolean) => {
      const tree = app.render();
      if (change === 'season') {
        const season = elements(tree, node => node.props['aria-label'] === (locale === 'en' ? 'Season' : '赛季'))[0];
        const value = back ? original.season : '2015-16';
        if (season.props.onValueChange) fire(season, 'onValueChange', value);
        else fire(season, 'onChange', { target: { value } });
      } else if (change === 'type') {
        fire(button(tree, back ? locale === 'en' ? 'Regular season' : '常规赛' : locale === 'en' ? 'Playoffs' : '季后赛'), 'onClick');
      } else if (change === 'player') {
        app.setIdentity({ ...original, playerId: back ? original.playerId : 2544 });
      } else {
        fire(button(tree, back ? locale === 'en' ? 'Hexagons' : '六边形' : locale === 'en' ? 'Frequency' : '出手密度'), 'onClick');
      }
    };
    choose(false);
    let tree = app.render();
    expect(elements(tree, 'aside')).toHaveLength(0);
    expect(text(liveStatus(tree))).toBe('');
    key(tree, 'Enter');
    expectBinDetails(app.render(), bins[0], locale);
    choose(true);
    tree = app.render();
    expect(elements(tree, 'aside')).toHaveLength(0);
    expect(text(liveStatus(tree))).toBe('');
    key(tree, 'Enter');
    expectBinDetails(app.render(), bins[0], locale);
  });
});

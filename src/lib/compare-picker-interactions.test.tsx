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
  dirty: true,
}));

// Exercise the real picker handlers/effects, with persistent hook state and
// cleanup-before-setup ordering. DOM containment and scrolling are explicit
// fixtures; this does not claim browser layout or native focus integration.
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useId: () => 'compare-picker-test',
  useState: (initial: unknown) => {
    const index = runtime.cursor++;
    let slot = runtime.hooks[index];
    if (!slot) {
      const state: Extract<Hook, { kind: 'state' }> = {
        kind: 'state', value: typeof initial === 'function' ? initial() : initial,
        set(value) {
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
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('@/components/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en', t: en }) }));
vi.mock('@/components/ToastProvider', () => ({ useToast: () => ({ toast: vi.fn() }) }));
import CompareClient, { type PlayerData } from '@/app/compare/CompareClient';

type BoxProps = {
  player: PlayerData | null; query: string; results: PlayerData[]; placeholder: string;
  isZh: boolean; compact?: boolean; onPick: (p: PlayerData) => void;
  onQuery: (q: string) => void; onClear?: () => void;
};
type Element = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [node as Element, ...nodes(node.props.children)];
}

const curry: PlayerData = { personId: 201939, firstName: 'Stephen', lastName: 'Curry', teamAbbr: 'GSW', teamName: 'Warriors', teamCity: 'Golden State', jersey: '30', position: 'G', pts: 25, reb: 4, ast: 6 };
const season: PlayerData = { ...curry, iconicId: '201939-2015', isIconicSeason: true, season: '2015-16' };
const seth: PlayerData = { ...curry, personId: 203552, firstName: 'Seth' };
class Target { constructor(readonly inside: boolean) {} }
const inside = new Target(true);
const outside = new Target(false);
const contains = (target: unknown) => target instanceof Target && target.inside;
const scroll = vi.fn();
const focus = vi.fn();
let props: BoxProps;
let renderPicker: (props: BoxProps) => ReactNode;
let tree: ReactNode;
let listeners: Map<string, Set<(event: unknown) => void>>;

function reset() { runtime.hooks = []; runtime.cursor = 0; runtime.effects = []; runtime.dirty = true; }
function flush() {
  for (let renders = 0; runtime.dirty; renders++) {
    if (renders > 30) throw new Error('Effects did not settle');
    runtime.dirty = false; runtime.cursor = 0; runtime.effects = [];
    tree = renderPicker(props);
    for (const node of nodes(tree)) {
      const ref = node.props.ref as { current: unknown } | ((value: unknown) => void) | undefined;
      const value = { contains, focus, scrollIntoView: scroll, querySelector: () => ({ scrollIntoView: scroll }) };
      if (typeof ref === 'function') ref(value);
      else if (ref) ref.current = value;
    }
    const effects = runtime.effects;
    for (const pending of effects) pending.old?.cleanup?.();
    for (const pending of effects) {
      const cleanup = pending.effect.run();
      runtime.hooks[pending.index] = { kind: 'effect', value: { ...pending.effect, cleanup: cleanup || undefined } };
    }
  }
}
function update(next: Partial<BoxProps>) { props = { ...props, ...next }; runtime.dirty = true; flush(); }
function input() { return nodes(tree).find(n => n.type === 'input')!; }
function options() { return nodes(tree).filter(n => n.type === 'button' && n.props.children !== 'Remove' && n.props.children !== '移除'); }
function call(node: Element, handler: string, event: unknown = {}) { (node.props[handler] as ((e: unknown) => void) | undefined)?.(event); flush(); }
function key(key: string, extra: Record<string, unknown> = {}) {
  const event = { key, preventDefault: vi.fn(), stopPropagation: vi.fn(), nativeEvent: { isComposing: false }, ...extra };
  call(input(), 'onKeyDown', event); return event;
}
function point(target: Target) {
  for (const listener of listeners.get('pointerdown') ?? []) listener({ target });
  flush();
}
function blur(target: Target | null) {
  const owner = nodes(tree).find(n => typeof n.props.onBlur === 'function') ?? input();
  call(owner, 'onBlur', { currentTarget: { contains }, relatedTarget: target });
}
function unmount() {
  for (const slot of runtime.hooks) if (slot.kind === 'effect') slot.value.cleanup?.();
}

beforeEach(() => {
  reset(); listeners = new Map(); scroll.mockClear(); focus.mockClear();
  vi.stubGlobal('Node', Target);
  vi.stubGlobal('document', {
    addEventListener: (type: string, callback: (event: unknown) => void) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type)!.add(callback); },
    removeEventListener: (type: string, callback: (event: unknown) => void) => { listeners.get(type)?.delete(callback); },
  });
  const page = CompareClient();
  const box = nodes(page).find(n => typeof n.type === 'function' && n.type.name === 'PlayerSearchBox')!;
  renderPicker = box.type as (props: BoxProps) => ReactNode;
  reset();
  props = { player: null, query: 'Curry', results: [seth, curry, season], placeholder: 'Search player 1...', isZh: false, onPick: vi.fn(), onQuery: vi.fn() };
  flush();
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); });

describe('Compare picker dismissal and keyboard interaction', () => {
  it('Escape closes suggestions and preserves the draft until focus reopens them', () => {
    expect(options()).toHaveLength(3);
    key('Escape');
    expect(options()).toHaveLength(0);
    expect(input().props.value).toBe('Curry');
    expect(props.onQuery).not.toHaveBeenCalled();
    update({ results: [curry, season] });
    expect(options()).toHaveLength(0);
    call(input(), 'onFocus');
    expect(options()).toHaveLength(2);
  });

  it('outside pointer clicks dismiss but inside clicks keep suggestions usable', () => {
    point(inside); expect(options()).toHaveLength(3);
    point(outside); expect(options()).toHaveLength(0);
    expect(props.onPick).not.toHaveBeenCalled();
  });

  it('outside dismissal during a pending search also suppresses its late results', () => {
    update({ results: [] }); point(outside); update({ results: [curry] });
    expect(options()).toHaveLength(0);
    call(input(), 'onFocus'); expect(options()).toHaveLength(1);
  });

  it('Escape during a pending search suppresses late results until the input is clicked', () => {
    update({ results: [] }); key('Escape'); update({ results: [curry] });
    expect(options()).toHaveLength(0);
    call(input(), 'onClick'); expect(options()).toHaveLength(1);
  });

  it('Tab and focus leaving the picker dismiss without preventing normal navigation', () => {
    const tab = key('Tab'); expect(tab.preventDefault).not.toHaveBeenCalled();
    expect(options()).toHaveLength(0);
    call(input(), 'onFocus'); blur(inside); expect(options()).toHaveLength(3);
    blur(outside); expect(options()).toHaveLength(0);
    call(input(), 'onFocus'); blur(null); expect(options()).toHaveLength(0);
  });

  it('ArrowDown and Enter select the full highlighted iconic-season record', () => {
    key('ArrowDown'); key('ArrowDown'); key('ArrowDown');
    const enter = key('Enter');
    expect(enter.preventDefault).toHaveBeenCalled();
    expect(props.onPick).toHaveBeenCalledExactlyOnceWith(season);
    expect(options()).toHaveLength(0);
  });

  it('up/down wrap, reopen after Escape, and scroll the highlighted result into view', () => {
    key('ArrowUp'); expect(options()[2].props['aria-selected']).toBe(true);
    key('ArrowDown'); expect(options()[0].props['aria-selected']).toBe(true);
    key('ArrowUp'); expect(options()[2].props['aria-selected']).toBe(true);
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
    key('Escape'); key('ArrowDown'); expect(options()[0].props['aria-selected']).toBe(true);
  });

  it('Enter alone and IME composition never pick a player or dismiss the popup', () => {
    const enter = key('Enter'); expect(enter.preventDefault).not.toHaveBeenCalled();
    key('ArrowDown'); key('Enter', { nativeEvent: { isComposing: true } });
    key('Escape', { nativeEvent: { isComposing: true } });
    key('Enter', { keyCode: 229 });
    expect(props.onPick).not.toHaveBeenCalled(); expect(options()).toHaveLength(3);
  });

  it('query and result changes reset the active selection instead of selecting stale rows', () => {
    key('ArrowDown');
    update({ query: 'James', results: [] }); key('Enter');
    update({ results: [season] }); key('Enter');
    expect(props.onPick).not.toHaveBeenCalled();
    key('ArrowDown'); update({ results: [curry] }); key('Enter');
    expect(props.onPick).not.toHaveBeenCalled();
    expect(input().props['aria-activedescendant']).toBeUndefined();
  });

  it('provides named combobox/listbox semantics and distinct career/season option identities', () => {
    expect(input().props.role).toBe('combobox');
    expect(input().props['aria-label']).toBe(props.placeholder);
    expect(input().props['aria-expanded']).toBe(true);
    const list = nodes(tree).find(n => n.props.role === 'listbox')!;
    expect(input().props['aria-controls']).toBe(list.props.id);
    expect(options().every(n => n.props.role === 'option' && n.props.tabIndex === -1)).toBe(true);
    expect(new Set(options().map(n => n.key)).size).toBe(3);
    expect(new Set(options().map(n => n.props.id)).size).toBe(3);
    key('ArrowDown'); expect(input().props['aria-activedescendant']).toBe(options()[0].props.id);
    key('Escape'); expect(input().props['aria-expanded']).toBe(false);
    expect(input().props['aria-activedescendant']).toBeUndefined();
  });

  it.each([false, true])('mouse selection remains available for compact=%s', compact => {
    update({ compact });
    const mouse = { preventDefault: vi.fn() };
    call(options()[2], 'onMouseDown', mouse);
    expect(mouse.preventDefault).toHaveBeenCalled();
    call(options()[2], 'onClick');
    expect(props.onPick).toHaveBeenCalledExactlyOnceWith(season);
    expect(options()).toHaveLength(0);
  });

  it('keeps new preset drafts discoverable after dismissing a previous query', () => {
    key('Escape'); update({ query: 'Jordan', results: [curry] });
    expect(options()).toHaveLength(1);
  });

  it('editing the draft reopens its suggestions and clears the old highlight', () => {
    key('ArrowDown'); key('Escape');
    call(input(), 'onChange', { target: { value: 'Curry' } });
    expect(props.onQuery).toHaveBeenCalledExactlyOnceWith('Curry');
    expect(options()).toHaveLength(3);
    expect(input().props['aria-activedescendant']).toBeUndefined();
  });

  it('hides short queries and selected players, and cleans up outside listeners', () => {
    update({ query: 'C' }); expect(options()).toHaveLength(0);
    update({ query: 'Curry', player: curry }); expect(options()).toHaveLength(0);
    unmount(); expect(listeners.get('pointerdown')?.size ?? 0).toBe(0);
  });
});

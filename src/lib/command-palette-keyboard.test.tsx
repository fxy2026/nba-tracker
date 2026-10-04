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
  dirty: true, mounted: true, lateSetters: 0,
}));

const context = vi.hoisted(() => ({ locale: 'en', path: '/search', router: { push: vi.fn() } }));
vi.mock('react-dom', () => ({ createPortal: (node: ReactNode) => node }));
vi.mock('next/navigation', () => ({ usePathname: () => context.path, useRouter: () => context.router }));
vi.mock('@/components/LocaleProvider', () => ({ useLocale: () => ({ locale: context.locale }) }));
import CommandPalette, { type PaletteGroup } from '@/components/CommandPalette';

type Props = Record<string, unknown>;
type Key = { key: string; keyCode: number; target: FixtureNode; shiftKey: boolean; isComposing: boolean; defaultPrevented: boolean; preventDefault: ReturnType<typeof vi.fn> };
class FixtureNode {
  children: FixtureNode[] = [];
  props: Props = {};
  offsetParent: object | null = {};
  style = { overflow: '' };
  constructor(public tag: string, public name = '') {}
  contains(target: unknown): boolean { return this === target || this.children.some(child => child.contains(target)); }
  hasAttribute(name: string) { return this.props[name] !== undefined && this.props[name] !== false; }
  focus() { doc.activeElement = this; }
  querySelectorAll(): FixtureNode[] { return this.children.flatMap(child => [child, ...child.querySelectorAll()]).filter(child => ['input', 'button', 'a'].includes(child.tag)); }
}
let tree: ReactNode;
let open: boolean;
let groups: PaletteGroup[];
let close: ReturnType<typeof vi.fn<() => void>>;
let doc: { activeElement: FixtureNode | null; body: FixtureNode; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
let trigger: FixtureNode;
let outside: FixtureNode;
let hosts: Map<string, FixtureNode>;
let listeners: Set<(event: Key) => void>;
let nativeDestinations: string[];

// Commit refs to a small DOM fixture before passive effects, reusing the actual
// component's host nodes and handlers. Native Enter is simulated only after the
// registered document handler leaves its default action unprevented.
function commitHosts(node: ReactNode, position = 'root'): FixtureNode[] {
  if (Array.isArray(node)) return node.flatMap((child, i) => commitHosts(child, `${position}.${i}`));
  if (!isValidElement<Props>(node)) return [];
  const tag = typeof node.type === 'string' ? node.type : typeof node.props.href === 'string' ? 'a' : 'icon';
  const key = typeof node.props.href === 'string' ? `a:${node.props.href}`
    : ['input', 'button'].includes(tag) ? `${tag}:${node.props['aria-label'] ?? position}` : `${tag}:${position}`;
  let host = hosts.get(key);
  if (!host) { host = new FixtureNode(tag, key); hosts.set(key, host); }
  host.props = node.props; host.children = commitHosts(node.props.children as ReactNode, `${position}.child`);
  const ref = node.props.ref;
  if (ref && typeof ref === 'object' && 'current' in ref) (ref as { current: unknown }).current = host;
  return [host];
}
function flush() {
  for (let renders = 0; runtime.dirty; renders++) {
    if (renders > 40) throw new Error('Effects did not settle');
    runtime.dirty = false; runtime.cursor = 0; runtime.effects = [];
    tree = CommandPalette({ open, onClose: close, groups });
    doc.body.children = [trigger, ...commitHosts(tree), outside];
    // Removing a focused native control falls back to body unless its handler
    // explicitly moves focus to a surviving element before this commit.
    if (doc.activeElement && !doc.body.contains(doc.activeElement)) doc.activeElement = doc.body;
    const effects = runtime.effects;
    for (const pending of effects) pending.old?.cleanup?.();
    for (const pending of effects) {
      const cleanup = pending.effect.run();
      runtime.hooks[pending.index] = { kind: 'effect', value: { ...pending.effect, cleanup: cleanup || undefined } };
    }
  }
}
const visibleHosts = () => doc.body.querySelectorAll();
const input = () => visibleHosts().find(n => n.props.role === 'combobox')!;
const closeButton = () => visibleHosts().find(n => n.tag === 'button' && String(n.props['aria-label']).includes('Esc'))!;
const clearButton = () => visibleHosts().find(n => n.props['aria-label'] === 'Clear search' || n.props['aria-label'] === '清除搜索')!;
const links = () => visibleHosts().filter(n => n.tag === 'a');
const activeHref = () => links().find(n => n.props['aria-selected'])?.props.href;
function setOpen(value: boolean) { open = value; runtime.dirty = true; flush(); }
async function timers() { await vi.advanceTimersByTimeAsync(0); flush(); }
async function show() { setOpen(true); await timers(); }
async function type(value: string) { (input().props.onChange as (event: unknown) => void)({ target: { value } }); flush(); await timers(); }
function key(target: FixtureNode, value: string, options: Partial<Pick<Key, 'shiftKey' | 'isComposing' | 'keyCode' | 'defaultPrevented'>> = {}) {
  target.focus();
  const event: Key = { key: value, keyCode: 0, target, shiftKey: false, isComposing: false, defaultPrevented: false, preventDefault: vi.fn(), ...options };
  event.preventDefault.mockImplementation(() => { event.defaultPrevented = true; });
  for (const listener of [...listeners]) listener(event);
  flush(); return event;
}
function enter(target: FixtureNode) {
  const event = key(target, 'Enter');
  if (!event.defaultPrevented) {
    (target.props.onClick as (() => void) | undefined)?.();
    if (target.tag === 'a') nativeDestinations.push(String(target.props.href));
    flush();
  }
  return event;
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
  runtime.mounted = true; runtime.lateSetters = 0;
  vi.useFakeTimers(); context.locale = 'en'; context.path = '/search'; context.router.push.mockReset();
  trigger = new FixtureNode('button', 'More'); outside = new FixtureNode('button', 'outside');
  hosts = new Map(); listeners = new Set(); nativeDestinations = [];
  doc = {
    activeElement: trigger, body: new FixtureNode('body'),
    addEventListener: vi.fn((name: string, listener: (e: Key) => void) => { if (name === 'keydown') listeners.add(listener); }),
    removeEventListener: vi.fn((name: string, listener: (e: Key) => void) => { if (name === 'keydown') listeners.delete(listener); }),
  };
  doc.body.style.overflow = 'auto';
  vi.stubGlobal('document', doc); vi.stubGlobal('window', {}); vi.stubGlobal('Node', FixtureNode);
  groups = [{ title: 'Common', color: '#123456', items: [{ href: '/compare', label: 'Compare players' }, { href: '/standings', label: 'Standings' }, { href: '/favorites', label: 'Favorites' }] }];
  open = false; close = vi.fn(() => { open = false; runtime.dirty = true; }); flush();
});
afterEach(() => { unmount(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('CommandPalette preserves focused native controls', () => {
  it.each(['en', 'zh'])('Enter on Close closes in place without navigating in %s', async locale => {
    context.locale = locale; await show();
    const event = enter(closeButton());
    expect(event.defaultPrevented).toBe(false); expect(close).toHaveBeenCalledTimes(1);
    expect(context.router.push).not.toHaveBeenCalled(); expect(open).toBe(false); expect(doc.activeElement).toBe(trigger);
  });
  it.each(['en', 'zh'])('Enter on Clear clears its query and keeps the dialog open in %s', async locale => {
    context.locale = locale; await show(); await type('Stand');
    expect(activeHref()).toBe('/standings'); const event = enter(clearButton()); await timers();
    expect(event.defaultPrevented).toBe(false); expect(input().props.value).toBe(''); expect(links()).toHaveLength(3);
    expect(context.router.push).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled(); expect(open).toBe(true);
    expect(doc.activeElement).toBe(input());
  });
  it('Enter on a focused non-selected result activates that link instead of the highlighted result', async () => {
    await show(); expect(activeHref()).toBe('/compare');
    const event = enter(links()[2]);
    expect(event.defaultPrevented).toBe(false); expect(nativeDestinations).toEqual(['/favorites']);
    expect(context.router.push).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledTimes(1);
  });
  it('arrow keys on buttons and links do not change the combobox selection', async () => {
    await show();
    for (const target of [closeButton(), links()[1]]) {
      expect(key(target, 'ArrowDown').defaultPrevented).toBe(false);
      expect(key(target, 'ArrowUp').defaultPrevented).toBe(false);
    }
    expect(activeHref()).toBe('/compare'); expect(context.router.push).not.toHaveBeenCalled();
  });
});

describe('CommandPalette combobox result selection', () => {
  it('arrows select a result and Enter navigates exactly once', async () => {
    await show(); expect(doc.activeElement).toBe(input());
    expect(key(input(), 'ArrowDown').defaultPrevented).toBe(true); expect(activeHref()).toBe('/standings');
    key(input(), 'ArrowDown'); expect(activeHref()).toBe('/favorites'); key(input(), 'ArrowUp'); expect(activeHref()).toBe('/standings');
    expect(key(input(), 'Enter').defaultPrevented).toBe(true);
    expect(context.router.push).toHaveBeenCalledExactlyOnceWith('/standings'); expect(close).toHaveBeenCalledTimes(1);
  });
  it('clamps selection and does not navigate an empty result list', async () => {
    await show(); key(input(), 'ArrowUp'); expect(activeHref()).toBe('/compare');
    for (let i = 0; i < 5; i++) key(input(), 'ArrowDown'); expect(activeHref()).toBe('/favorites');
    await type('no such page'); key(input(), 'ArrowDown'); key(input(), 'ArrowUp'); key(input(), 'Enter');
    expect(links()).toEqual([]); expect(input().props['aria-activedescendant']).toBeUndefined();
    expect(context.router.push).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
  });
  it.each([{ isComposing: true }, { keyCode: 229 }])('does not navigate, close or move selection during IME input %j', async composition => {
    await show();
    for (const value of ['Enter', 'ArrowDown', 'ArrowUp', 'Escape']) expect(key(input(), value, composition).defaultPrevented).toBe(false);
    expect(activeHref()).toBe('/compare'); expect(context.router.push).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
  });
  it('respects keys already handled by a child control', async () => {
    await show(); const event = key(input(), 'Enter', { defaultPrevented: true });
    expect(event.preventDefault).not.toHaveBeenCalled(); expect(context.router.push).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
  });
});

describe('CommandPalette dialog scope and lifecycle', () => {
  it('Escape closes from a dialog control and restores the trigger', async () => {
    await show(); const event = key(links()[1], 'Escape');
    expect(event.defaultPrevented).toBe(true); expect(close).toHaveBeenCalledTimes(1);
    expect(doc.activeElement).toBe(trigger); expect(doc.body.style.overflow).toBe('auto'); expect(listeners.size).toBe(0);
  });
  it('does not intercept Escape, Enter, arrows or Tab from outside its dialog', async () => {
    await show();
    for (const value of ['Escape', 'Enter', 'ArrowDown', 'ArrowUp', 'Tab']) {
      expect(key(outside, value).defaultPrevented).toBe(false); expect(doc.activeElement).toBe(outside);
    }
    expect(close).not.toHaveBeenCalled(); expect(context.router.push).not.toHaveBeenCalled(); expect(open).toBe(true);
  });
  it('wraps Tab within the dialog and leaves interior Tab to native focus movement', async () => {
    await show(); const first = input(), last = links()[2];
    expect(key(first, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true); expect(doc.activeElement).toBe(last);
    expect(key(last, 'Tab').defaultPrevented).toBe(true); expect(doc.activeElement).toBe(first);
    expect(key(closeButton(), 'Tab').defaultPrevented).toBe(false);
  });
  it('cleans up listeners and pending focus work across repeated open/close cycles', async () => {
    for (let i = 0; i < 4; i++) {
      await show(); expect(listeners.size).toBe(1); expect(doc.body.style.overflow).toBe('hidden');
      setOpen(false); expect(listeners.size).toBe(0); expect(doc.body.style.overflow).toBe('auto'); expect(doc.activeElement).toBe(trigger);
    }
    setOpen(true); setOpen(false); await timers();
    expect(listeners.size).toBe(0); expect(doc.activeElement).toBe(trigger); expect(vi.getTimerCount()).toBe(0);
    key(outside, 'Enter'); expect(context.router.push).not.toHaveBeenCalled();
  });
  it('cancels focus timers and restores scroll/focus when unmounted while open', async () => {
    setOpen(true); unmount(); await timers();
    expect(runtime.lateSetters).toBe(0); expect(listeners.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
    expect(doc.body.style.overflow).toBe('auto'); expect(doc.activeElement).toBe(trigger);
  });
  it('survives StrictMode effect replay with one listener and one eventual navigation', async () => {
    setOpen(true); replayEffects(); await timers();
    expect(listeners.size).toBe(1); expect(doc.activeElement).toBe(input()); expect(doc.body.style.overflow).toBe('hidden');
    key(input(), 'Enter'); expect(context.router.push).toHaveBeenCalledExactlyOnceWith('/compare'); expect(close).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0); expect(doc.body.style.overflow).toBe('auto'); expect(doc.activeElement).toBe(trigger);
  });
});

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

// Actual effect + key handler regression: touch users can browse before invoking the keyboard.
it('phone opening focuses the panel, traps Shift+Tab, then restores the trigger on close', async () => {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
  await show();
  const panel = doc.activeElement!;
  expect(panel.props.tabIndex).toBe(-1);
  expect(panel).not.toBe(input());
  const event = key(panel, 'Tab', { shiftKey: true });
  expect(event.defaultPrevented).toBe(true);
  expect(doc.activeElement).toBe(links().at(-1));
  key(doc.activeElement!, 'Escape');
  expect(open).toBe(false);
  expect(doc.activeElement).toBe(trigger);
});
it('phone dialog follows the visual viewport through keyboard open and dismissal', async () => {
  const events = new Map<string, () => void>();
  const viewport = { offsetTop: 0, height: 680,
    addEventListener: vi.fn((name: string, fn: () => void) => events.set(name, fn)),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('window', { matchMedia: () => ({ matches: true }), visualViewport: viewport, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  await show();
  const overlay = [...hosts.values()].find(host => host.props.role === 'dialog')!;
  expect(overlay.style).toMatchObject({ top: '0px', height: '680px', bottom: 'auto' });
  viewport.height = 300; viewport.offsetTop = 90; events.get('resize')!();
  expect(overlay.style).toMatchObject({ top: '90px', height: '300px' });
  viewport.height = 680; viewport.offsetTop = 0; events.get('scroll')!();
  expect(overlay.style).toMatchObject({ top: '0px', height: '680px' });
  setOpen(false);
  expect(viewport.removeEventListener).toHaveBeenCalledTimes(2);
});

it.each(['en', 'zh'])('shows a count-free page-search prompt in %s', async locale => {
  context.locale = locale;
  await show();
  expect(input().props.placeholder).toBe(locale === 'zh' ? '搜索页面...' : 'Search pages...');
});

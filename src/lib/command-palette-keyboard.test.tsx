import { cloneElement, isValidElement, type ReactNode } from 'react';
import en from '@/locales/en';
import zh from '@/locales/zh';
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
  hooks: [] as Hook[], cursor: 0, effects: [] as { index: number; effect: Effect; old?: Effect; hooks: Hook[] }[],
  dirty: true, mounted: true, lateSetters: 0,
}));

const context = vi.hoisted(() => ({ locale: 'en', path: '/search', router: { push: vi.fn() } }));
vi.mock('react-dom', () => ({ createPortal: (node: ReactNode) => node }));
vi.mock('next/navigation', () => ({ usePathname: () => context.path, useRouter: () => context.router }));
vi.mock('@/components/LocaleProvider', () => ({ useLocale: () => ({ locale: context.locale, t: context.locale === 'zh' ? zh : en }) }));
import CommandPalette, { type PaletteGroup } from '@/components/CommandPalette';
import Navbar from '@/components/Navbar';
import MobileNav from '@/components/MobileNav';

type Props = Record<string, unknown>;
type Key = { key: string; keyCode: number; target: FixtureNode; shiftKey: boolean; isComposing: boolean; defaultPrevented: boolean; preventDefault: ReturnType<typeof vi.fn> };
class FixtureNode {
  children: FixtureNode[] = [];
  props: Props = {};
  offsetParent: object | null = {};
  style = { overflow: '' };
  scrollTop = 0;
  constructor(public tag: string, public name = '') {}
  contains(target: unknown): boolean { return this === target || this.children.some(child => child.contains(target)); }
  hasAttribute(name: string) { return this.props[name] !== undefined && this.props[name] !== false; }
  get isConnected() { return doc.body.contains(this); }
  focus() { doc.activeElement = this; }
  querySelectorAll(): FixtureNode[] { return this.children.flatMap(child => [child, ...child.querySelectorAll()]).filter(child => ['input', 'button', 'a'].includes(child.tag)); }
}
let tree: ReactNode;
let open: boolean;
let groups: PaletteGroup[];
let close: ReturnType<typeof vi.fn<() => void>>;
let doc: { activeElement: FixtureNode | null; body: FixtureNode; documentElement: { scrollTop: number }; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
let trigger: FixtureNode;
let outside: FixtureNode;
let hosts: Map<string, FixtureNode>;
let listeners: Set<(event: Key) => void>;
let nativeDestinations: string[];
let triggerAttached: boolean;
let composedOwners: boolean;
let componentHooks: Map<string, Hook[]>;
let historyListeners: Set<() => void>;
let historyEntries: string[];
let historyIndex: number;
let win: {
  location: URL;
  history: {
    pushState: ReturnType<typeof vi.fn<(state: unknown, unused: string, href: string) => void>>;
    replaceState: ReturnType<typeof vi.fn<(state: unknown, unused: string, href: string) => void>>;
    back: () => void; forward: () => void;
  };
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};

// Commit refs to a small DOM fixture before passive effects, reusing the actual
// component's host nodes and handlers. Native Enter is simulated only after the
// registered document handler leaves its default action unprevented.
function commitHosts(node: ReactNode, position = 'root'): FixtureNode[] {
  if (Array.isArray(node)) return node.flatMap((child, i) => commitHosts(child, `${position}.${i}`));
  if (!isValidElement<Props>(node)) return [];
  const tag = typeof node.type === 'string' ? node.type : typeof node.props.href === 'string' ? 'a' : 'icon';
  const identity = typeof node.props.href === 'string' ? `a:${node.props.href}`
    : ['input', 'button'].includes(tag) ? `${tag}:${node.props['aria-label'] ?? position}` : `${tag}:${position}`;
  const key = composedOwners ? `${position.split(':')[0]}:${identity}` : identity;
  let host = hosts.get(key);
  if (!host) { host = new FixtureNode(tag, key); hosts.set(key, host); }
  host.props = node.props; host.children = commitHosts(node.props.children as ReactNode, `${position}.child`);
  const ref = node.props.ref;
  if (ref && typeof ref === 'object' && 'current' in ref) (ref as { current: unknown }).current = host;
  return [host];
}
function renderInstance(key: string, render: () => ReactNode) {
  let hooks = componentHooks.get(key);
  if (!hooks) { hooks = []; componentHooks.set(key, hooks); }
  runtime.hooks = hooks; runtime.cursor = 0;
  return render();
}
function resolvePalettes(node: ReactNode, position: string): ReactNode {
  if (Array.isArray(node)) return node.map((child, i) => resolvePalettes(child, `${position}.${i}`));
  if (!isValidElement<Props>(node)) return node;
  if (node.type === CommandPalette) {
    return renderInstance(`${position}:palette`, () => CommandPalette(node.props as unknown as Parameters<typeof CommandPalette>[0]));
  }
  return cloneElement(node, {}, resolvePalettes(node.props.children as ReactNode, `${position}.child`));
}
const hookSets = () => composedOwners ? [...componentHooks.values()] : [runtime.hooks];
function flush() {
  for (let renders = 0; runtime.dirty; renders++) {
    if (renders > 40) throw new Error('Effects did not settle');
    runtime.dirty = false; runtime.cursor = 0; runtime.effects = [];
    if (composedOwners) {
      // Match RootLayout's two persistent navigation owners. Their real state
      // setters supply each palette's open/onClose props; no test-owned boolean.
      const desktop = resolvePalettes(renderInstance('desktop', Navbar), 'desktop');
      const mobile = resolvePalettes(renderInstance('mobile', MobileNav), 'mobile');
      tree = [desktop, mobile];
      doc.body.children = [...commitHosts(desktop, 'desktop:root'), ...commitHosts(mobile, 'mobile:root'), outside];
    } else {
      tree = CommandPalette({ open, onClose: close, groups });
      doc.body.children = [...(triggerAttached ? [trigger] : []), ...commitHosts(tree), outside];
    }
    // Removing a focused native control falls back to body unless its handler
    // explicitly moves focus to a surviving element before this commit.
    if (doc.activeElement && !doc.body.contains(doc.activeElement)) doc.activeElement = doc.body;
    const effects = runtime.effects;
    for (const pending of effects) pending.old?.cleanup?.();
    for (const pending of effects) {
      const cleanup = pending.effect.run();
      pending.hooks[pending.index] = { kind: 'effect', value: { ...pending.effect, cleanup: cleanup || undefined } };
    }
  }
}
const visibleHosts = () => doc.body.querySelectorAll();
const input = () => visibleHosts().find(n => n.props.role === 'combobox')!;
const closeButton = () => visibleHosts().find(n => n.tag === 'button' && String(n.props['aria-label']).includes('Esc'))!;
const clearButton = () => visibleHosts().find(n => n.props['aria-label'] === 'Clear search' || n.props['aria-label'] === '清除搜索')!;
const links = () => visibleHosts().filter(n => n.tag === 'a');
const activeHref = () => links().find(n => n.props['aria-selected'])?.props.href;
// A client navigation updates location and rerenders the same mounted layout;
// Back/Forward then dispatch popstate without discarding any component hooks.
function setLocation(href: string) {
  win.location = new URL(href, 'https://example.test');
  context.path = win.location.pathname;
  runtime.dirty = true;
}
function travel(delta: number, dispatchPopstate = true) {
  const next = historyIndex + delta;
  if (next < 0 || next >= historyEntries.length) return;
  historyIndex = next; setLocation(historyEntries[next]);
  if (dispatchPopstate) for (const listener of [...historyListeners]) listener();
  flush();
}
function clientNavigate(href: string) { win.history.pushState(null, '', href); flush(); }
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
  for (const hooks of hookSets()) for (const slot of hooks) if (slot.kind === 'effect') slot.value.cleanup?.();
  runtime.mounted = false;
}
function replayEffects() {
  const effects = hookSets().flat().filter((h): h is Extract<Hook, { kind: 'effect' }> => h.kind === 'effect');
  for (const slot of effects) slot.value.cleanup?.();
  for (const slot of effects) slot.value.cleanup = slot.value.run() || undefined;
  flush();
}

beforeEach(() => {
  runtime.hooks = []; runtime.cursor = 0; runtime.effects = []; runtime.dirty = true;
  runtime.mounted = true; runtime.lateSetters = 0; composedOwners = false; componentHooks = new Map();
  vi.useFakeTimers(); context.locale = 'en'; context.path = '/search'; context.router.push.mockReset();
  trigger = new FixtureNode('button', 'More'); outside = new FixtureNode('button', 'outside');
  hosts = new Map(); listeners = new Set(); nativeDestinations = []; triggerAttached = true;
  historyListeners = new Set(); historyEntries = ['/search']; historyIndex = 0;
  win = {
    location: new URL('/search', 'https://example.test'),
    history: {
      pushState: vi.fn((_state: unknown, _unused: string, href: string) => {
        historyEntries.splice(historyIndex + 1); historyEntries.push(href); historyIndex++;
        setLocation(href);
      }),
      replaceState: vi.fn((_state: unknown, _unused: string, href: string) => {
        historyEntries[historyIndex] = href; setLocation(href);
      }),
      back: () => travel(-1), forward: () => travel(1),
    },
    addEventListener: vi.fn((name: string, listener: () => void) => { if (name === 'popstate') historyListeners.add(listener); }),
    removeEventListener: vi.fn((name: string, listener: () => void) => { if (name === 'popstate') historyListeners.delete(listener); }),
  };
  doc = {
    activeElement: trigger, body: new FixtureNode('body'), documentElement: { scrollTop: 0 },
    addEventListener: vi.fn((name: string, listener: (e: Key) => void) => { if (name === 'keydown') listeners.add(listener); }),
    removeEventListener: vi.fn((name: string, listener: (e: Key) => void) => { if (name === 'keydown') listeners.delete(listener); }),
  };
  doc.body.style.overflow = 'auto';
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { callback(); return 0; });
  vi.stubGlobal('document', doc); vi.stubGlobal('window', win); vi.stubGlobal('Node', FixtureNode);
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
    expect(runtime.lateSetters).toBe(0); expect(listeners.size).toBe(0); expect(historyListeners.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
    expect(doc.body.style.overflow).toBe('auto'); expect(doc.activeElement).toBe(trigger);
  });
  it('survives StrictMode effect replay with one listener and one eventual navigation', async () => {
    setOpen(true); replayEffects(); await timers();
    expect(listeners.size).toBe(1); expect(historyListeners.size).toBe(1); expect(doc.activeElement).toBe(input()); expect(doc.body.style.overflow).toBe('hidden');
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
      runtime.effects.push({ index, effect: { run, deps }, old, hooks: runtime.hooks });
    }
  },
}));

// Actual effect + key handler regression: touch users can browse before invoking the keyboard.
it('phone opening focuses the panel, traps Shift+Tab, then restores the trigger on close', async () => {
  vi.stubGlobal('window', { ...win, matchMedia: () => ({ matches: true }) });
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
  vi.stubGlobal('window', { ...win, matchMedia: () => ({ matches: true }), visualViewport: viewport });
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


describe('CommandPalette persistent-layout history dismissal', () => {
  it.each([
    ['/schedule-heatmap', '/back-to-back'],
    ['/standings?season=2023-24', '/standings?season=2024-25'],
  ])('closes on Back and Forward without changing either destination: %s → %s', async (first, second) => {
    clientNavigate(first); clientNavigate(second);
    const initialHooks = runtime.hooks;
    const entries = [...historyEntries];
    const pushes = win.history.pushState.mock.calls.length;
    await show(); await type('Stand');
    expect(historyListeners.size).toBe(1);
    win.history.back();
    expect(open).toBe(false); expect(tree).toBeNull(); expect(close).toHaveBeenCalledTimes(1);
    expect(`${win.location.pathname}${win.location.search}`).toBe(first);
    expect(doc.body.style.overflow).toBe('auto'); expect(doc.activeElement).toBe(trigger);
    expect(historyListeners.size).toBe(0); expect(listeners.size).toBe(0);
    await show();
    expect(input().props.value).toBe(''); expect(activeHref()).toBe('/compare');
    win.history.forward();
    expect(open).toBe(false); expect(tree).toBeNull(); expect(close).toHaveBeenCalledTimes(2);
    expect(`${win.location.pathname}${win.location.search}`).toBe(second);
    expect(runtime.hooks).toBe(initialHooks); // No full-document/unmount reset.
    expect(historyEntries).toEqual(entries); expect(win.history.pushState).toHaveBeenCalledTimes(pushes);
    expect(win.history.replaceState).not.toHaveBeenCalled(); expect(context.router.push).not.toHaveBeenCalled();
    expect(doc.body.style.overflow).toBe('auto'); expect(historyListeners.size).toBe(0);
    await show(); expect(historyListeners.size).toBe(1); expect(input().props.value).toBe('');
    enter(closeButton()); expect(historyListeners.size).toBe(0); expect(doc.activeElement).toBe(trigger);
  });
  it('removes its history listener on ordinary Close, Escape, backdrop and result click', async () => {
    for (const dismiss of ['close', 'escape', 'backdrop', 'result']) {
      await show(); expect(historyListeners.size).toBe(1);
      if (dismiss === 'close') enter(closeButton());
      else if (dismiss === 'escape') key(input(), 'Escape');
      else {
        const host = dismiss === 'result' ? links()[1] : [...hosts.values()].find(node => node.props.role === 'dialog')!;
        (host.props.onClick as () => void)(); flush();
      }
      expect(open).toBe(false); expect(historyListeners.size).toBe(0); expect(listeners.size).toBe(0);
      expect(doc.activeElement).toBe(trigger); expect(doc.body.style.overflow).toBe('auto');
    }
  });
  it('does not retain duplicate history handlers through effect replay, rerender or rapid close', async () => {
    clientNavigate('/schedule-heatmap'); clientNavigate('/back-to-back');
    setOpen(true); replayEffects(); await timers();
    expect(historyListeners.size).toBe(1);
    // Parent callback identity changes can restart only the current listener.
    close = vi.fn(() => { open = false; runtime.dirty = true; }); runtime.dirty = true; flush();
    expect(historyListeners.size).toBe(1);
    win.history.back(); expect(close).toHaveBeenCalledTimes(1); expect(historyListeners.size).toBe(0);
    setOpen(true); setOpen(false); await timers();
    expect(historyListeners.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
    win.history.forward(); expect(close).toHaveBeenCalledTimes(1);
    await show(); unmount(); expect(historyListeners.size).toBe(0); expect(listeners.size).toBe(0);
  });
  it('does not restore focus to a trigger detached by the history destination', async () => {
    clientNavigate('/schedule-heatmap'); clientNavigate('/back-to-back'); await show();
    const restoreFocus = vi.spyOn(trigger, 'focus');
    triggerAttached = false;
    win.history.back();
    expect(restoreFocus).not.toHaveBeenCalled(); expect(doc.activeElement).toBe(doc.body);
    expect(open).toBe(false); expect(doc.body.style.overflow).toBe('auto');
  });
});


// The first history fixture proved only that a synthetic popstate closed an
// externally controlled palette. These regressions retain the actual Navbar
// and MobileNav state owners as the shared RootLayout does, and exercise a
// committed usePathname change independently of native callback delivery.
function mountNavigationOwners(href: string) {
  unmount(); runtime.mounted = true; composedOwners = true;
  runtime.hooks = []; componentHooks = new Map();
  setLocation(href); flush();
}
function navMore(owner: 'desktop' | 'mobile') {
  const name = owner === 'desktop' ? 'Main navigation' : 'Mobile navigation';
  const nav = [...hosts.values()].find(node => node.isConnected && node.props['aria-label'] === name)!;
  return nav.querySelectorAll().find(node => node.props['aria-haspopup'] === 'dialog' && String(node.props['aria-label']).includes(context.locale === 'zh' ? '更多' : 'More'))!;
}
const visibleDialogs = () => [...hosts.values()].filter(node => node.isConnected && node.props.role === 'dialog');
async function openOwner(owner: 'desktop' | 'mobile') {
  const button = navMore(owner); button.focus(); (button.props.onClick as () => void)(); flush(); await timers();
  expect(visibleDialogs()).toHaveLength(1); expect(navMore(owner).props['aria-expanded']).toBe(true);
  return button;
}

describe.each(['desktop', 'mobile'] as const)('shared root-layout %s palette route commits', owner => {
  it.each(['en', 'zh'])('dismisses different-path Back/Forward on the committed pathname even without popstate (%s)', async locale => {
    context.locale = locale; mountNavigationOwners('/schedule-heatmap');
    clientNavigate('/schedule-heatmap'); clientNavigate('/back-to-back');
    const retainedInstances = new Map(componentHooks);
    const entries = [...historyEntries], pushes = win.history.pushState.mock.calls.length;
    const button = await openOwner(owner); await type('heatmap');
    travel(-1, false); // Router context commit is independent from a native event.
    expect(context.path).toBe('/schedule-heatmap'); expect(visibleDialogs()).toHaveLength(0);
    expect(navMore(owner).props['aria-expanded']).toBe(false); expect(doc.activeElement).toBe(button);
    expect(doc.body.style.overflow).toBe('auto'); expect(historyListeners.size).toBe(0);
    await timers(); expect(visibleDialogs()).toHaveLength(0);
    travel(1, false); // Returning to the opening path must not resurrect the menu.
    expect(context.path).toBe('/back-to-back'); expect(visibleDialogs()).toHaveLength(0);
    travel(-1, false); await openOwner(owner);
    expect(input().props.value).toBe('');
    travel(1, false);
    expect(context.path).toBe('/back-to-back'); expect(visibleDialogs()).toHaveLength(0);
    for (const [key, hooks] of retainedInstances) expect(componentHooks.get(key)).toBe(hooks);
    expect(historyEntries).toEqual(entries); expect(win.history.pushState).toHaveBeenCalledTimes(pushes);
    expect(win.history.replaceState).not.toHaveBeenCalled(); expect(context.router.push).not.toHaveBeenCalled();
    expect(historyListeners.size).toBe(0); expect(doc.body.style.overflow).toBe('auto');
    await openOwner(owner); enter(closeButton()); expect(visibleDialogs()).toHaveLength(0);
  });
  it('retains query-only native traversal cleanup with both owners mounted', async () => {
    mountNavigationOwners('/standings?season=2023-24');
    clientNavigate('/standings?season=2023-24'); clientNavigate('/standings?season=2024-25');
    await openOwner(owner); win.history.back();
    expect(win.location.search).toBe('?season=2023-24'); expect(visibleDialogs()).toHaveLength(0);
    expect(navMore(owner).props['aria-expanded']).toBe(false); expect(historyListeners.size).toBe(0);
    await openOwner(owner); win.history.forward();
    expect(win.location.search).toBe('?season=2024-25'); expect(visibleDialogs()).toHaveLength(0);
    expect(doc.body.style.overflow).toBe('auto'); expect(context.router.push).not.toHaveBeenCalled();
  });
  it('does not close on same-path rerenders, callback replacement or StrictMode effect replay', async () => {
    mountNavigationOwners('/back-to-back'); const button = await openOwner(owner);
    await type('heatmap'); runtime.dirty = true; flush();
    expect(visibleDialogs()).toHaveLength(1); expect(input().props.value).toBe('heatmap');
    replayEffects(); await timers();
    expect(visibleDialogs()).toHaveLength(1); expect(historyListeners.size).toBe(1);
    key(input(), 'Escape'); expect(visibleDialogs()).toHaveLength(0); expect(doc.activeElement).toBe(button);
    expect(historyListeners.size).toBe(0); expect(doc.body.style.overflow).toBe('auto');
  });
});

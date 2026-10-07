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
  useId: () => 'navbar-search-test',
  useMemo: (fn: () => unknown) => fn(),
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

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/LocaleProvider', () => ({ useLocale: () => ({ locale: 'en', t: en }) }));
vi.mock('react-dom', () => ({ createPortal: (node: ReactNode) => node }));
vi.mock('@/components/ThemeToggle', () => ({ default: () => null }));
vi.mock('@/components/LocaleToggle', () => ({ default: () => null }));
vi.mock('@/components/CommandPalette', () => ({ default: () => null }));
vi.mock('@/lib/useMoreGroups', () => ({ useMoreGroups: () => [] }));
import Navbar from '@/components/Navbar';

let tree: ReactNode;
const listeners = new Map<string, Set<(event: unknown) => void>>();
function nodes(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [node as ReactElement<Record<string, unknown>>, ...nodes(node.props.children)];
}
function flush() {
  for (let renders = 0; runtime.dirty; renders++) {
    if (renders > 40) throw new Error('Effects did not settle');
    runtime.dirty = false; runtime.cursor = 0; runtime.effects = [];
    tree = Navbar();
    const effects = runtime.effects;
    for (const pending of effects) pending.old?.cleanup?.();
    for (const pending of effects) {
      const cleanup = pending.effect.run();
      runtime.hooks[pending.index] = { kind: 'effect', value: { ...pending.effect, cleanup: cleanup || undefined } };
    }
  }
}
function input() { return nodes(tree).find(node => node.type === 'input'); }
function open() {
  (nodes(tree).find(node => node.props['aria-label'] === 'Open search')!.props.onClick as () => void)(); flush();
}
function blur() { (input()!.props.onBlur as () => void)(); flush(); }
function focus() { (input()!.props.onFocus as (() => void) | undefined)?.(); flush(); }
function type(value: string) { (input()!.props.onChange as (event: unknown) => void)({ target: { value } }); flush(); }
function advance(ms: number) { vi.advanceTimersByTime(ms); flush(); }
function key(key: string, metaKey = false) {
  for (const listener of listeners.get('keydown') ?? []) listener({ key, metaKey, preventDefault: vi.fn() });
  flush();
}
function unmount() {
  if (!runtime.mounted) return;
  for (const slot of runtime.hooks) if (slot.kind === 'effect') slot.value.cleanup?.();
  runtime.mounted = false;
}
beforeEach(() => {
  runtime.hooks = []; runtime.cursor = 0; runtime.effects = []; runtime.dirty = true;
  runtime.mounted = true; runtime.lateSetters = 0; listeners.clear();
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request'); }));
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { callback(); return 0; });
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal('document', {
    body: { scrollTop: 0, style: { overflow: '' } }, documentElement: { scrollTop: 0 }, activeElement: null,
    addEventListener: (name: string, listener: (event: unknown) => void) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name)!.add(listener); },
    removeEventListener: (name: string, listener: (event: unknown) => void) => listeners.get(name)?.delete(listener),
  });
  flush();
});
afterEach(() => {
  unmount(); expect(fetch).not.toHaveBeenCalled();
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
});

describe('header search delayed blur lifecycle', () => {
  it('keeps the empty input open after the user refocuses before the delayed close', () => {
    open(); blur(); advance(50); focus(); advance(100);
    expect(input()).toBeDefined(); expect(input()!.props.value).toBe('');
  });
  it('preserves new typing after an empty-query blur', () => {
    open(); blur(); advance(50); focus(); type('Curry'); advance(100);
    expect(input()?.props.value).toBe('Curry');
  });
  it('cancels an old close when Escape is followed by a new opening', () => {
    open(); blur(); advance(50); key('Escape'); expect(input()).toBeUndefined();
    open(); advance(100); expect(input()).toBeDefined();
  });
  it('keeps the normal delayed close for an empty input that stays blurred', () => {
    open(); blur(); advance(149); expect(input()).toBeDefined();
    advance(1); expect(input()).toBeUndefined();
  });
  it('retains a nonempty input on blur', () => {
    open(); type('Curry'); blur(); advance(150); expect(input()?.props.value).toBe('Curry');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('repeated blur/refocus only permits the latest blur to close the input', () => {
    open(); blur(); advance(50); focus(); advance(10); blur();
    advance(90); expect(input()).toBeDefined();
    advance(59); expect(input()).toBeDefined(); advance(1); expect(input()).toBeUndefined();
  });
  it('clears a pending blur timer on unmount without late state changes', () => {
    open(); blur(); unmount(); expect(vi.getTimerCount()).toBe(0);
    advance(150); expect(runtime.lateSetters).toBe(0);
  });
});

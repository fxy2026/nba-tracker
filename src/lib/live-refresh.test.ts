import { test, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import { startLiveRefresh } from './live-refresh';

const cleanups: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });

function setup({ visible = true, online = true } = {}) {
  const document = Object.assign(new EventTarget(), { visibilityState: visible ? 'visible' : 'hidden' });
  const window = new EventTarget();
  const navigator = { onLine: online };
  const timers = new Map<number, () => void>();
  let nextId = 0;
  const restores: (() => void)[] = [];
  for (const [key, value] of Object.entries({ document, window, navigator,
    setInterval: (callback: () => void) => { const id = ++nextId; timers.set(id, callback); return id; },
    clearInterval: (id: number) => timers.delete(id),
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    restores.push(() => previous ? Object.defineProperty(globalThis, key, previous) : Reflect.deleteProperty(globalThis, key));
  }
  let refreshes = 0;
  const remaining = { current: 30 };
  const countdowns: number[] = [];
  const cleanup = startLiveRefresh({ interval: 30, remaining,
    onCountdown: (value) => countdowns.push(value), onRefresh: () => refreshes++,
  });
  cleanups.push(() => { cleanup(); for (const restore of restores) restore(); });
  return { timers, remaining, countdowns, cleanup,
    refreshes: () => refreshes,
    tick: (count = 1) => { for (let i = 0; i < count; i++) for (const cb of [...timers.values()]) cb(); },
    visible: (value: boolean) => { document.visibilityState = value ? 'visible' : 'hidden'; document.dispatchEvent(new Event('visibilitychange')); },
    online: (value: boolean) => { navigator.onLine = value; window.dispatchEvent(new Event(value ? 'online' : 'offline')); },
  };
}

test('keeps 30-second polling without an extra initial refresh', () => {
  const s = setup(); assert.equal(s.refreshes(), 0); s.tick(29);
  assert.equal(s.refreshes(), 0); s.tick(); assert.equal(s.refreshes(), 1);
  assert.equal(s.remaining.current, 30);
});
test('hidden tabs stop and foreground refreshes exactly once', () => {
  const s = setup(); s.tick(15); s.visible(false); s.tick(300);
  assert.equal(s.timers.size, 0); assert.equal(s.refreshes(), 0);
  s.visible(true); s.visible(true); s.online(true);
  assert.equal(s.refreshes(), 1); assert.equal(s.timers.size, 1);
  s.tick(30); assert.equal(s.refreshes(), 2);
});
test('initially hidden tabs wait until visible', () => {
  const s = setup({ visible: false }); s.tick(300); assert.equal(s.refreshes(), 0);
  s.visible(true); assert.equal(s.refreshes(), 1); assert.equal(s.timers.size, 1);
});
test('offline tabs do not resume on visibility until online', () => {
  const s = setup(); s.online(false); s.visible(false); s.visible(true); s.tick(60);
  assert.equal(s.refreshes(), 0); assert.equal(s.timers.size, 0);
  s.online(true); s.online(true); assert.equal(s.refreshes(), 1); assert.equal(s.timers.size, 1);
});
test('reconnecting while hidden waits until foreground', () => {
  const s = setup({ visible: false, online: false }); s.online(true);
  assert.equal(s.refreshes(), 0); s.visible(true); assert.equal(s.refreshes(), 1);
});
test('manual countdown reset retains a full interval', () => {
  const s = setup(); s.tick(20); s.remaining.current = 30; s.tick(29);
  assert.equal(s.refreshes(), 0); s.tick(); assert.equal(s.refreshes(), 1);
});
test('cleanup removes timer and listeners, including remount-like events', () => {
  const s = setup(); s.cleanup(); s.visible(false); s.visible(true); s.online(false); s.online(true); s.tick(60);
  assert.equal(s.timers.size, 0); assert.equal(s.refreshes(), 0);
});

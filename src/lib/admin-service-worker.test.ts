import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

function setup() {
  const listeners = new Map<string, (event: unknown) => void>();
  const fetch = vi.fn().mockResolvedValue({ ok: false });
  const caches = { match: vi.fn(), open: vi.fn() };
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    self: { location: { origin: 'https://nba.xpy.me' }, addEventListener: (name: string, fn: (event: unknown) => void) => listeners.set(name, fn) },
    URL, fetch, caches, Response,
  });
  return { handler: listeners.get('fetch')!, fetch, caches };
}

describe('administrative navigation cache boundary', () => {
  it.each(['/admin', '/admin/', '/admin/reports', '/admin?days=7', '/api/admin/stats'])('does not intercept %s even when older cached HTML exists', (path) => {
    const { handler, fetch, caches } = setup();
    const respondWith = vi.fn();
    handler({ request: { method: 'GET', url: `https://nba.xpy.me${path}`, mode: 'navigate' }, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(caches.match).not.toHaveBeenCalled();
  });
  it.each(['/','/player/893', '/administrator'])('preserves public navigation handling for %s', async (path) => {
    const { handler, fetch } = setup();
    const respondWith = vi.fn();
    handler({ request: { method: 'GET', url: `https://nba.xpy.me${path}`, mode: 'navigate' }, respondWith, waitUntil: vi.fn() });
    expect(respondWith).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledOnce();
    await respondWith.mock.calls[0][0];
  });
});

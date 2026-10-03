import { createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getTranslations } from '@/locales';
vi.mock('server-only', () => ({}));
const runtime = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0, effects: [] as { run: () => void | (() => void); deps: unknown[] }[], locale: 'en' }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useState: (initial: unknown) => {
  const index = runtime.cursor++; if (!(index in runtime.values)) runtime.values[index] = typeof initial === 'function' ? initial() : initial;
  return [runtime.values[index], (value: unknown) => { runtime.values[index] = typeof value === 'function' ? value(runtime.values[index]) : value; }];
}, useEffect: (run: () => void | (() => void), deps: unknown[]) => runtime.effects.push({ run, deps }) }));
vi.mock('@/components/LocaleProvider', () => ({ useLocale: () => ({ locale: runtime.locale, t: getTranslations(runtime.locale as 'en' | 'zh') }) }));
vi.mock('@/lib/timezone', () => ({ localTz: () => 'Asia/Shanghai' }));
import Panel, { PlannedFixtureSection } from '@/components/PlannedFixtures';
import { getPlannedFixtureView } from './planned-fixtures-server';
const result = (team = 'LAL') => getPlannedFixtureView({ mode: 'upcoming', team, from: '2026-10-03', limit: 8, timeZone: 'Asia/Shanghai' }, [], null);
function render(team = 'LAL') { runtime.cursor = 0; runtime.effects = []; const tree = Panel({ team }); return { tree, html: renderToStaticMarkup(tree) }; }
function elements(node: ReactNode): Record<string, unknown>[] { if (Array.isArray(node)) return node.flatMap(elements); if (!isValidElement<Record<string, unknown>>(node)) return []; return [node.props, ...elements(node.props.children as ReactNode)]; }
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const effect = () => runtime.effects.find(e => e.deps.length === 5)!.run();
beforeEach(() => { runtime.values = []; runtime.locale = 'en'; vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-03T12:00:00Z')); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it.each(['en', 'zh'])('renders source-scoped, score-free mobile planned fixtures in %s', locale => {
  runtime.locale = locale;
  const html = renderToStaticMarkup(createElement(PlannedFixtureSection, { view: result() }));
  expect(html).toContain(locale === 'zh' ? '2026 年 8 月 13 日' : 'August 13, 2026');
  expect(html).toContain(locale === 'zh' ? '可能变更' : 'subject to change');
  expect(html).toContain('Asia/Shanghai'); expect(html).toContain('min-h-[44px]');
  expect(html).toContain('NBA-Regular-Season-Schedule-By-Date.pdf');
  expect(html).not.toContain('href="/game/'); expect(html).not.toMatch(/0–0|0-0|Final|LIVE|Updated/);
});
it('preserves all six alternate venues and the three neutral-site matchups', () => {
  const all = ['2026-10', '2026-11', '2027-01', '2027-02'].flatMap(month => getPlannedFixtureView({ mode: 'month', month, timeZone: 'America/New_York' }, [], null).fixtures);
  const venueFixtures = all.filter(f => f.venue); expect(venueFixtures).toHaveLength(6);
  expect(venueFixtures.filter(f => f.relationship === 'vs')).toHaveLength(3);
  for (const fixture of venueFixtures) {
    const html = renderToStaticMarkup(createElement(PlannedFixtureSection, { view: { ...result(), fixtures: [fixture] } }));
    expect(html).toContain(fixture.venue!.name); expect(html).toContain(fixture.venue!.city);
    if (fixture.relationship === 'vs') expect(html).toContain('neutral site');
  }
});
it('keeps truthful next-date navigation in the requested timezone', () => {
  const view = getPlannedFixtureView({ mode: 'day', date: '2026-10-03', timeZone: 'Asia/Shanghai' }, [], null);
  const html = renderToStaticMarkup(createElement(PlannedFixtureSection, { view }));
  expect(html).toContain('date=2026-10-21&amp;tz=Asia%2FShanghai');
  expect(html).not.toMatch(/season.*unavailable|No season/i);
});
it('waits for browser timezone and sends only an eight-row request', async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json(result()));
  expect(render().html).toContain('Loading published'); expect(fetch).not.toHaveBeenCalled();
  runtime.effects[0].run(); render(); effect(); await settle();
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('from=2026-10-03&tz=Asia%2FShanghai&limit=8&team=LAL');
  expect(render().html).toContain('2026-27 planned schedule');
});
it('hides old team data immediately and ignores a late superseded response', async () => {
  let finish!: (r: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce(Response.json(result('BOS')));
  render(); runtime.effects[0].run(); render(); const cleanup = effect();
  expect(render('BOS').html).toContain('Loading published'); if (typeof cleanup === 'function') cleanup(); effect(); await settle();
  finish(Response.json(result('LAL'))); await settle();
  const html = render('BOS').html; expect(html).toContain('2026-27 planned schedule');
  expect(elements(render('BOS').tree).length).toBeGreaterThan(0);
  expect((runtime.values[1] as { key: string }).key).toContain('BOS:');
});
it('aborts on unmount and does not commit a delayed JSON body', async () => {
  let body!: (value: unknown) => void;
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: () => new Promise(resolve => { body = resolve; }) } as Response);
  render(); runtime.effects[0].run(); render(); const cleanup = effect(); await settle();
  if (typeof cleanup === 'function') cleanup(); body(result()); await settle();
  expect((runtime.values[1] as { key: string }).key).toBe('');
  expect((vi.mocked(fetch).mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true);
});
it('reports failed/malformed responses and Retry recovers', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ fixtures: [] })).mockResolvedValueOnce(Response.json(result()));
  render(); runtime.effects[0].run(); render(); effect(); await settle();
  let current = render(); expect(current.html).toContain('could not be loaded');
  const retry = elements(current.tree).find(node => node.children === 'Retry')!; (retry.onClick as () => void)();
  render(); effect(); await settle(); current = render(); expect(current.html).toContain('2026-27 planned schedule');
});

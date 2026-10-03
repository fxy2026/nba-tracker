import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import en from '@/locales/en';
import zh from '@/locales/zh';
const runtime = vi.hoisted(() => ({ cursor: 0, slots: [] as unknown[], locale: 'en' }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useState: (initial: unknown) => { const i = runtime.cursor++; return [i in runtime.slots ? runtime.slots[i] : initial, vi.fn()]; }, useEffect: () => {}, useLayoutEffect: () => {}, useRef: (initial: unknown) => ({ current: initial }), useId: () => 'search-test' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/LocaleProvider', () => ({ useLocale: () => ({ locale: runtime.locale, t: runtime.locale === 'zh' ? zh : en }) }));
vi.mock('react-dom', () => ({ createPortal: (node: ReactNode) => node }));
import SearchInput from '@/components/SearchInput';
const row = { id: 202681, name: 'Kyrie Irving', aliases: [], sources: ['player-index'], href: '/player/202681', teamAbbr: 'DAL', teamLabel: 'Dallas Mavericks', position: 'G', shotCoverage: null, indexProvenance: { source: 'bundled-archive', season: '2025-26', stale: true, retrievedAt: null } };
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => { vi.stubGlobal('document', { body: {} }); runtime.cursor = 0; runtime.locale = 'en'; runtime.slots = ['Kyrie', [row], false, true, true]; });
it.each(['en', 'zh'])('search preserves source context without presenting identity metadata as current stats in %s', locale => {
  runtime.locale = locale; const result = renderToStaticMarkup(SearchInput({}));
  expect(result).toContain('2025-26'); expect(result).toContain(locale === 'zh' ? '存档快照' : 'archived snapshot'); expect(result).not.toContain('PPG'); expect(result).not.toContain('0.0');
});
it('registry-only identities do not infer a team, current status, career stats or retirement', () => {
  runtime.slots[1] = [{ ...row, teamLabel: null, teamAbbr: null, position: null, indexProvenance: null, sources: ['all-time-registry'] }];
  const result = renderToStaticMarkup(SearchInput({}));
  expect(result).toContain('NBA player index'); expect(result).not.toContain('2025-26'); expect(result).not.toContain('Mavericks'); expect(result).not.toContain('retired');
});
it('archive-only results state the actual shot coverage without calling it career coverage', () => {
  runtime.slots[1] = [{ ...row, indexProvenance: null, teamLabel: null, position: null, shotCoverage: { firstSeason: '1996-97', lastSeason: '1997-98', datasetCount: 2 } }];
  const result = renderToStaticMarkup(SearchInput({}));
  expect(result).toContain('1996-97–1997-98'); expect(result).toContain('shot archive'); expect(result).not.toContain('career');
});

it('known NBA season-start years distinguish namesakes without claiming retirement dates', () => {
  runtime.slots[1] = [{ ...row, id: 121, name: 'Patrick Ewing', teamLabel: null, position: null, indexProvenance: null, sourceYears: { from: 1985, to: 2001 } }];
  const result = renderToStaticMarkup(SearchInput({}));
  expect(result).toContain('1985–2001 · NBA season starts'); expect(result).toContain('ID 121'); expect(result).not.toContain('retired');
});

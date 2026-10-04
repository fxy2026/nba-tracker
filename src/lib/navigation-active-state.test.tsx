import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/locales/en';
import zh from '@/locales/zh';

const state = vi.hoisted(() => ({ url: '/', locale: 'en', cursor: 0, values: [] as unknown[] }));
vi.mock('next/navigation', () => ({
  // Match usePathname's documented query-free value while exercising queried URLs.
  usePathname: () => new URL(state.url, 'https://example.test').pathname,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/components/LocaleProvider', () => ({ useLocale: () => ({ locale: state.locale, t: state.locale === 'zh' ? zh : en }) }));
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = state.cursor++;
    if (!(index in state.values)) state.values[index] = typeof initial === 'function' ? initial() : initial;
    return [state.values[index], (next: unknown) => { state.values[index] = typeof next === 'function' ? next(state.values[index]) : next; }];
  },
  useEffect: () => {},
  useRef: (value: unknown) => ({ current: value }),
  useMemo: (calculate: () => unknown) => calculate(),
}));
import Navbar from '@/components/Navbar';
import MobileNav from '@/components/MobileNav';
import CommandPalette, { type PaletteGroup } from '@/components/CommandPalette';

function nodes(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [node as ReactElement<Record<string, unknown>>, ...nodes(node.props.children)];
}
const primaryHrefs = ['/', '/calendar', '/stats', '/news', '/standings'];
const menuGroups = nodes(MobileNav()).find(node => node.type === CommandPalette)!.props.groups as PaletteGroup[];
const menuHrefs = menuGroups.flatMap(group => group.items.map(item => item.href));
const secondaryHrefs = menuHrefs.filter(href => !primaryHrefs.includes(href));
const unknownHrefs = ['/missing', '/standings/detail', '/calendar/detail', '/stats/detail', '/news/detail', '/lab/explore/detail', '/player/2544'];
const hasClass = (node: ReactElement<Record<string, unknown>>, token: string) => String(node.props.className).split(/\s+/).includes(token);
const hasAccent = (node: ReactElement<Record<string, unknown>>) => hasClass(node, 'text-accent');

beforeEach(() => { state.url = '/'; state.locale = 'en'; state.cursor = 0; state.values = []; });

for (const [label, Component] of [['mobile', MobileNav], ['desktop', Navbar]] as const) {
  function render() { state.cursor = 0; return nodes(Component()); }
  function primary(all: ReturnType<typeof nodes>) { return all.filter(node => primaryHrefs.includes(String(node.key)) && node.props.href === node.key); }
  function more(all: ReturnType<typeof nodes>) { return all.find(node => node.props['aria-haspopup'] === 'dialog' && String(node.props['aria-label']).includes(state.locale === 'zh' ? '更多' : 'More'))!; }

  describe(`${label} closed navigation visual state`, () => {
    it.each(primaryHrefs.flatMap(href => [href, `${href}?season=2024-25`]))('only the primary destination is visually active at %s', url => {
      state.url = url;
      const all = render(), links = primary(all), button = more(all);
      const pathname = new URL(url, 'https://example.test').pathname;
      expect(links.filter(hasAccent).map(link => link.props.href)).toEqual([pathname]);
      expect(hasAccent(button)).toBe(false);
      expect(button.props['aria-expanded']).toBe(false);
      expect(button.props['aria-current']).toBeUndefined();
      if (label === 'mobile') {
        expect(links.filter(link => link.props['aria-current'] === 'page').map(link => link.props.href)).toEqual([pathname]);
        expect(nodes(button.props.children as ReactNode).some(node => hasClass(node, 'bg-accent'))).toBe(false);
        expect(nodes(button.props.children as ReactNode).some(node => hasClass(node, 'font-bold'))).toBe(false);
      } else {
        expect(hasClass(button, 'bg-accent/15')).toBe(false);
        expect(hasClass(button, 'hover:text-text-primary')).toBe(true);
        expect(hasClass(button, 'hover:bg-bg-hover')).toBe(true);
      }
    });
    it.each(secondaryHrefs.flatMap(href => [href, `${href}?season=2024-25`]))('keeps the existing exact secondary match active at %s', url => {
      state.url = url; const all = render();
      expect(primary(all).filter(hasAccent)).toHaveLength(0);
      expect(hasAccent(more(all))).toBe(true);
      expect(more(all).props['aria-current']).toBeUndefined();
    });
    it.each(unknownHrefs)('does not broaden exact matching for %s', url => {
      state.url = url; const all = render();
      expect(primary(all).filter(hasAccent)).toHaveLength(0);
      expect(hasAccent(more(all))).toBe(false);
    });
    it.each(['en', 'zh'])('retains Standings in the full searchable palette and preserves open styling in %s', locale => {
      state.locale = locale; state.url = '/standings?season=2024-25';
      let all = render();
      const palette = () => all.find(node => node.type === CommandPalette)!;
      const groups = palette().props.groups as PaletteGroup[];
      expect(groups.flatMap(group => group.items.map(item => item.href))).toEqual(menuHrefs);
      const standings = groups.flatMap(group => group.items).filter(item => item.href === '/standings');
      expect(standings).toHaveLength(1);
      expect(standings[0].label).toBe((locale === 'zh' ? zh : en).nav.standings);
      expect(standings[0].keywords).toContain('standings');
      (more(all).props.onClick as () => void)(); all = render();
      expect(more(all).props['aria-expanded']).toBe(true); expect(palette().props.open).toBe(true);
      // Mobile has always highlighted an open menu; desktop uses route state.
      expect(hasAccent(more(all))).toBe(label === 'mobile');
      (palette().props.onClose as () => void)(); all = render();
      expect(more(all).props['aria-expanded']).toBe(false); expect(hasAccent(more(all))).toBe(false);
      expect(primary(all).filter(hasAccent).map(link => link.props.href)).toEqual(['/standings']);
    });
  });
}

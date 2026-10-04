import { isValidElement, type ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
const runtime = vi.hoisted(() => ({ locale: 'en', players: [] as Record<string, unknown>[] }));
vi.mock('@/lib/api', () => ({ getPlayerIndexSnapshot: async () => ({ players: runtime.players, provenance: null }) }));
vi.mock('@/lib/locale', () => ({ getLocale: async () => runtime.locale }));
import PositionPage from '@/app/by-position/page';
import CollegePage from '@/app/by-college/page';
type Node = { type: unknown; props: Record<string, unknown> };
function nodes(tree: ReactNode): Node[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(tree)) return [];
  return [tree, ...nodes(tree.props.children as ReactNode)];
}
function text(tree: ReactNode): string {
  if (Array.isArray(tree)) return tree.map(text).join('');
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  return isValidElement<{ children?: ReactNode }>(tree) ? text(tree.props.children) : '';
}
const player = { personId: 1, firstName: 'Shai', lastName: 'Gilgeous-Alexander', teamAbbr: 'OKC', position: 'G', height: '6-6', college: 'Kentucky', pts: 30, reb: 5, ast: 6 };
beforeEach(() => { runtime.locale = 'en'; runtime.players = [player]; });
it.each(['en', 'zh'])('separates full position identity from mobile stats in %s', async locale => {
  runtime.locale = locale;
  const all = nodes(await PositionPage({ searchParams: Promise.resolve({}) }));
  const link = all.find(node => node.props.href === '/player/1')!;
  expect(link.props.className).toContain('grid-cols-[1.75rem_2.25rem_minmax(0,1fr)]');
  expect(link.props.className).toContain('sm:flex');
  const children = nodes(link.props.children as ReactNode);
  const name = children.find(node => node.type === 'p' && text(node.props.children as ReactNode) === 'Shai Gilgeous-Alexander')!;
  expect(name.props.className).toContain('whitespace-normal break-words');
  expect(name.props.className).not.toMatch(/(?:^|\s)truncate(?:\s|$)/);
  const stats = children.find(node => String(node.props.className).includes('col-start-2 col-span-2'))!;
  expect(text(stats.props.children as ReactNode)).toBe('P/R/A30.0/5.0/6.0');
});
it.each(['en', 'zh'])('makes paired and all 78 singleton destinations readable in %s', async locale => {
  runtime.locale = locale;
  runtime.players = [player, { ...player, personId: 2, firstName: 'Karl-Anthony', lastName: 'Towns' },
    ...Array.from({ length: 78 }, (_, i) => ({ ...player, personId: i + 3, firstName: `Player${i}`, lastName: 'Full-Name', college: `Long Background School or Professional Team ${i}` }))];
  const all = nodes(await CollegePage());
  const links = all.filter(node => String(node.props.href ?? '').startsWith('/player/'));
  expect(links).toHaveLength(80);
  for (const p of runtime.players) {
    const link = links.find(node => node.props.href === `/player/${p.personId}`)!;
    expect(text(link.props.children as ReactNode)).toContain(`${p.firstName} ${p.lastName}`);
    expect(link.props.className).toContain('min-h-11');
    expect(link.props.className).not.toMatch(/(?:^|\s)truncate(?:\s|$)/);
    if (Number(p.personId) >= 3) expect(text(link.props.children as ReactNode)).toContain(p.college);
  }
  const details = all.find(node => node.type === 'details')!;
  expect(nodes(details.props.children as ReactNode).filter(node => node.props.href)).toHaveLength(18);
  const summary = nodes(details.props.children as ReactNode).find(node => node.type === 'summary')!;
  expect(summary.props.className).toContain('min-h-11');
  expect(text(summary.props.children as ReactNode)).toBe(locale === 'zh' ? '查看其余 18 个来源分组' : 'Show remaining 18 background groups');
});

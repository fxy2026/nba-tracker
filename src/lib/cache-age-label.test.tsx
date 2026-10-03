import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
const context = vi.hoisted(() => ({ locale: 'en' }));
vi.mock('@/components/LocaleProvider', () => ({ useLocale: () => ({ locale: context.locale }) }));
import UpdatedPill from '@/components/UpdatedPill';
it.each(['en', 'zh'])('team cache age is visibly distinguished from source freshness in %s', locale => {
  context.locale = locale;
  const html = renderToStaticMarkup(createElement(UpdatedPill, { ageMs: 60_000, meaning: 'cache' }));
  expect(html).toContain(locale === 'zh' ? '缓存载入于' : 'Cache loaded');
  expect(html).toContain(locale === 'zh' ? '并非 NBA 来源的更新时间' : 'not when the NBA source was updated');
  expect(html).not.toContain('title="Data freshness"');
  expect(readFileSync('src/app/team/[tricode]/_components/TeamHero.tsx', 'utf8')).toContain('meaning="cache"');
});
it('other existing uses retain their current semantics', () => {
  context.locale = 'en';
  const html = renderToStaticMarkup(createElement(UpdatedPill, { ageMs: 60_000 }));
  expect(html).toContain('title="Data freshness"'); expect(html).not.toContain('Cache loaded');
});

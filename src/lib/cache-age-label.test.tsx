import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { formatCacheAge } from "./dates";
const context = vi.hoisted(() => ({ locale: "en" }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: context.locale }) }));
import UpdatedPill from "@/components/UpdatedPill";
import PageHeader from "@/components/PageHeader";

it.each(["en", "zh"])("cache elapsed buckets never claim freshness in %s", locale => {
  context.locale = locale;
  const cases: [number, string, string][] = [
    [0, "just now", "刚刚"],
    [59_999, "just now", "刚刚"],
    [60_000, "1m ago", "1 分钟前"],
    [3_599_999, "59m ago", "59 分钟前"],
    [3_600_000, "1h ago", "1 小时前"],
    [86_399_999, "23h ago", "23 小时前"],
    [86_400_000, "1d ago", "1 天前"],
    [9 * 86_400_000, "9d ago", "9 天前"],
  ];
  for (const [ageMs, en, zh] of cases) {
    const label = locale === "zh" ? zh : en;
    expect(formatCacheAge(ageMs, locale)).toBe(label);
    const html = renderToStaticMarkup(createElement(UpdatedPill, { ageMs, meaning: "cache" }));
    expect(html).toContain((locale === "zh" ? "赛程缓存载入于 " : "Schedule cache loaded ") + label);
    expect(html).toContain(locale === "zh" ? "并非 NBA 来源的更新时间" : "not when the NBA source was updated");
    expect(html).not.toMatch(/刚刚更新|数据较旧|Stale|Data freshness/);
  }
  expect(renderToStaticMarkup(createElement(UpdatedPill, { ageMs: null, meaning: "cache" }))).toBe("");
  expect(readFileSync("src/app/team/[tricode]/_components/TeamHero.tsx", "utf8")).toContain('meaning="cache"');
});

it.each(["en", "zh"])("PageHeader explicitly uses cache semantics and omits absent ages in %s", locale => {
  context.locale = locale;
  const html = renderToStaticMarkup(createElement(PageHeader, { title: "Heading", updatedAt: 0 }));
  expect(html).toContain(locale === "zh" ? "赛程缓存载入于 刚刚" : "Schedule cache loaded just now");
  for (const updatedAt of [undefined, null]) {
    const absent = renderToStaticMarkup(createElement(PageHeader, { title: "Heading", updatedAt }));
    expect(absent).not.toMatch(/Schedule cache loaded|赛程缓存载入于|Data freshness/);
  }
});

it.each(["en", "zh"])("default source pill retains its existing semantics in %s", locale => {
  context.locale = locale;
  const html = renderToStaticMarkup(createElement(UpdatedPill, { ageMs: 0 }));
  expect(html).toContain(locale === "zh" ? "刚刚更新" : "Just now");
  expect(html).toContain(locale === "zh" ? 'title="数据更新时间"' : 'title="Data freshness"');
  expect(renderToStaticMarkup(createElement(UpdatedPill, { ageMs: 86_400_000 }))).toContain(locale === "zh" ? "数据较旧" : "Stale");
  expect(html).not.toMatch(/Schedule cache loaded|赛程缓存载入于/);
});

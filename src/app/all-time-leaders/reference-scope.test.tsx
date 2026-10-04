import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { ALL_TIME_LEADERS, getLeaderboard, type Category } from "@/lib/allTimeLeaders";
import { metadata } from "./layout";

const state = vi.hoisted(() => ({ locale: "en", category: "ppg" as string }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: () => [state.category, vi.fn()],
}));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: state.locale }) }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children) }));
vi.mock("@/components/PlayerHeadshot", () => ({ default: () => null }));
vi.mock("@/components/PageHeader", () => ({ default: ({ title, subtitle }: { title: string; subtitle: string }) => createElement("header", {}, title, subtitle) }));
vi.mock("@/components/Breadcrumbs", () => ({ default: () => null }));
vi.mock("@/components/RelatedPages", () => ({ default: () => null }));
import Page from "./page";

const categories: Category[] = ["ppg", "rpg", "apg", "spg", "bpg", "totalPts", "totalReb", "totalAst", "tenure"];
const render = () => renderToStaticMarkup(createElement(Page));
beforeEach(() => { state.locale = "en"; state.category = "ppg"; });

it.each(["en", "zh"])("shows compact scope and native expandable limitations in %s", locale => {
  state.locale = locale;
  const html = render();
  expect(html).toContain(locale === "zh" ? "精选静态参考 · 不会自动更新" : "Curated static reference · does not update automatically");
  expect(html).toContain(locale === "zh" ? "最多展示 25 人" : "showing up to 25 players");
  expect(html).toContain(locale === "zh" ? "未记录经核实的统计截止日期或逐条来源链接" : "No verified statistics as-of date or per-record source links");
  expect(html).toContain(locale === "zh" ? "现役／退役为记录中的状态" : "Active/retired labels are stored status");
  expect(html).toContain(locale === "zh" ? "不代表当前阵容" : "not a current roster");
  expect(html).toContain("<details");
  expect(html).toContain("<summary");
  expect(html).not.toMatch(/<details[^>]* open/);
  expect(html).not.toMatch(/current through|numbers update as they keep playing|截至 2025-26|随比赛持续更新|NBA 官方历史统计|2026-10-03/);
});

it.each(["en", "zh"])("scopes every category and its structured data in %s", locale => {
  state.locale = locale;
  for (const category of categories) {
    state.category = category;
    const html = render();
    const json = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]);
    expect(json.description).toContain(locale === "zh" ? "精选静态参考，非完整 NBA 历史排名" : "Curated static reference, not a complete NBA historical ranking");
    expect(json.description).toContain(locale === "zh" ? "已收录" : category === "tenure" ? "Included" : "included records");
    expect(json.numberOfItems).toBe(json.itemListElement.length);
    expect(json.itemListElement.map((p: { name: string }) => p.name)).toEqual(getLeaderboard(category).slice(0, 10).map(p => p.name));
  }
});

it.each(["en", "zh"])("labels inclusive year span without claiming actual seasons in %s", locale => {
  state.locale = locale;
  state.category = "tenure";
  const html = render();
  expect(html).toContain(locale === "zh" ? "已收录年份跨度" : "Recorded year span");
  expect(html).toContain(locale === "zh" ? "非实际参赛季数" : "not seasons played");
  expect(html).toContain(locale === "zh" ? "跨度 " : "Span ");
  expect(html).not.toMatch(/Most NBA seasons played|Longest Careers|效力 NBA 赛季数最多/);
  const lebron = getLeaderboard("tenure").find(p => p.personId === 2544)!;
  expect(lebron._value).toBe(24); // Preserve the existing inclusive span, not a season count.
  expect(lebron._seasons).toBe(lebron.toYear - lebron.fromYear + 1);
});

it("uses static, limited metadata without official-index or freshness claims", () => {
  const value = JSON.stringify(metadata);
  expect(value).toContain("Curated static");
  expect(value).toContain("included records");
  expect(value).toContain("No automatic updates or verified statistics as-of date");
  expect(value).not.toMatch(/official NBA player index|Hall-of-Fame caliber|2025-26|2026-10-03/);
});

it("preserves every reference row and all eleven category rankings from the audited baseline", () => {
  const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  expect(ALL_TIME_LEADERS).toHaveLength(57);
  expect(hash(ALL_TIME_LEADERS)).toBe("d78e8daa5256daa493f060358071321b058e86d374f39c4863e3adf6edf8d403");
  const all: Category[] = ["ppg", "rpg", "apg", "spg", "bpg", "totalPts", "totalReb", "totalAst", "totalStl", "totalBlk", "tenure"];
  expect(hash(all.map(c => getLeaderboard(c)))).toBe("582da45a5561932754f29fac15f4a97b1cc96dbc4ca65897857cc321e68f0e2f");
});

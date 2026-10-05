import { readFileSync } from "node:fs";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/LocaleProvider";
import type { VerifiedShotChart } from "@/lib/court-shots";

type ChartProps = { data: VerifiedShotChart };
type DynamicOptions = { loading?: ComponentType; ssr?: boolean };
const lazy = vi.hoisted(() => ({
  options: {} as DynamicOptions,
  component: undefined as ComponentType<ChartProps> | undefined,
  pending: undefined as Promise<void> | undefined,
  loads: 0,
  props: [] as ChartProps[],
}));

// Exercise the real child and loading component with a controlled import state.
// This is a boundary/behavior regression, not proof of the emitted chunk graph.
vi.mock("next/dynamic", async () => {
  const { createElement } = await import("react");
  return {
    default: (loader: () => Promise<{ default: ComponentType<ChartProps> }>, options: DynamicOptions) => {
      lazy.options = options;
      return function DynamicChart(props: ChartProps) {
        lazy.props.push(props);
        if (!lazy.pending) {
          lazy.loads++;
          lazy.pending = loader().then(module => { lazy.component = module.default; });
        }
        return lazy.component
          ? createElement(lazy.component, props)
          : options.loading ? createElement(options.loading) : null;
      };
    },
  };
});
import VerifiedShotChartSection from "./VerifiedShotChartSection";

// Deliberately synthetic display data: these tests make no archive coverage claim.
const data: VerifiedShotChart = {
  gameId: "section-test",
  coordinateSystem: "nba-legacy-basket-feet",
  home: { teamId: 1, teamTricode: "BOS", score: 2 },
  away: { teamId: 2, teamTricode: "LAL", score: 0 },
  shots: [
    { eventId: 10, personId: 101, playerName: "Home Test Player", teamId: 1, teamTricode: "BOS", period: 1, clock: "PT10M00.00S", result: "Made", value: 2, xFeet: 0, yFeet: 2 },
    { eventId: 20, personId: 202, playerName: "Away Test Player", teamId: 2, teamTricode: "LAL", period: 1, clock: "PT09M00.00S", result: "Missed", value: 3, xFeet: -22, yFeet: 0 },
  ],
  coverage: { mapped: 2, total: 2, complete: true },
  source: { label: "NBA official game charts", url: "https://example.com/test-game-charts", retrievedAt: "2026-10-05T00:00:00Z" },
};
const skeleton = '<div class="h-[28rem] rounded-2xl bg-bg-secondary skeleton-shimmer"></div>';
const copy = {
  en: {
    title: "Shot chart",
    unavailable: "Verified shot locations are not available for this game yet. The court chart appears when its coordinate data has been verified.",
    player: "Player", period: "Period",
  },
  zh: {
    title: "投篮分布",
    unavailable: "本场真实出手坐标暂不可用。球场图将在坐标数据完成核验后展示。",
    player: "球员", period: "节次",
  },
};

function render(locale: "en" | "zh", chart: VerifiedShotChart | null) {
  return renderToStaticMarkup(
    <LocaleProvider initialLocale={locale}>
      <VerifiedShotChartSection data={chart} isZh={locale === "zh"} />
    </LocaleProvider>,
  );
}
function expectSection(html: string, locale: "en" | "zh") {
  expect(html).toContain('<section id="shot-chart" aria-labelledby="shot-chart-title" class="mt-6 glass-tile p-4 sm:p-6">');
  expect(html).toContain('<h2 id="shot-chart-title" class="text-lg font-semibold mb-4 flex items-center gap-2">');
  expect(html).toContain(copy[locale].title);
}

beforeEach(() => {
  lazy.component = undefined;
  lazy.pending = undefined;
  lazy.loads = 0;
  lazy.props = [];
});
afterEach(async () => { await lazy.pending; });

describe("verified shot chart client boundary", () => {
  it("keeps the chart in a top-level client dynamic import without eager runtime dependencies", () => {
    const source = readFileSync(new URL("./VerifiedShotChartSection.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/^\s*["']use client["'];/);
    expect(source).toMatch(/const ShotChartExplorer = dynamic\(\(\) => import\(["']@\/components\/ShotChartExplorer["']\),/);
    expect(source.indexOf("const ShotChartExplorer = dynamic")).toBeLessThan(source.indexOf("export default function"));
    const runtimeImports = [...source.matchAll(/^import (?!type\b).*? from ["']([^"']+)["'];/gm)].map(match => match[1]);
    expect(runtimeImports).toEqual(["next/dynamic"]);
    expect(source).toContain('import type { VerifiedShotChart } from "@/lib/court-shots"');
    expect(source).not.toMatch(/IntersectionObserver|ssr:\s*false/);
  });

  it("retains default SSR and the exact 28rem loading placeholder", () => {
    expect(lazy.options.ssr).toBeUndefined();
    expect(lazy.options.loading).toBeTypeOf("function");
    expect(renderToStaticMarkup(createElement(lazy.options.loading!))).toBe(skeleton);
  });

  it.each(["en", "zh"] as const)("renders %s unavailable content without requesting or rendering the chart", locale => {
    const html = render(locale, null);
    expectSection(html, locale);
    expect(html).toContain(`<p class="text-sm text-text-secondary py-5">${copy[locale].unavailable}</p>`);
    expect(html).not.toContain("skeleton-shimmer");
    expect(html).not.toContain("data-shot-id=");
    expect(lazy.loads).toBe(0);
    expect(lazy.props).toEqual([]);
  });

  it.each(["en", "zh"] as const)("preserves %s anchors and layout while the chart import is pending", locale => {
    const html = render(locale, data);
    expectSection(html, locale);
    expect(html).toContain(skeleton);
    expect(html).not.toContain(copy[locale].unavailable);
    expect(lazy.loads).toBe(1);
    expect(lazy.props[0]).toEqual({ data });
    expect(lazy.props[0].data).toBe(data);
  });

  it.each(["en", "zh"] as const)("renders the real ready chart, all points and localized controls in %s", async locale => {
    const before = JSON.stringify(data);
    render(locale, data);
    await lazy.pending;
    const html = render(locale, data);
    expectSection(html, locale);
    expect(html).not.toContain("skeleton-shimmer");
    expect(html).not.toContain(copy[locale].unavailable);
    expect(html.match(/data-shot-id=/g)).toHaveLength(data.shots.length);
    for (const shot of data.shots) expect(html).toContain(`data-shot-id="${shot.eventId}"`);
    for (const team of ["LAL", "BOS"]) expect(html).toContain(`aria-label="${team} ${copy[locale].player}"`);
    expect(html).toContain(`aria-label="${copy[locale].period}"`);
    expect(html).toContain('data-court-focus="full"');
    expect(html).toContain(data.source.url);
    expect(JSON.stringify(data)).toBe(before);
    expect(lazy.loads).toBe(1);
  });

  it("keeps the data condition and passes new data unchanged after ready → unavailable → ready", async () => {
    render("en", data);
    await lazy.pending;
    expect(render("en", data)).toContain('data-shot-id="10"');
    const calls = lazy.props.length;
    expect(render("zh", null)).toContain(copy.zh.unavailable);
    expect(lazy.props).toHaveLength(calls);
    const next = { ...data, gameId: "second-section-test", shots: data.shots.map(shot => ({ ...shot, eventId: shot.eventId + 1 })) };
    const html = render("zh", next);
    expect(html).toContain('data-shot-id="11"');
    expect(html).not.toContain('data-shot-id="10"');
    expect(lazy.props.at(-1)?.data).toBe(next);
    expect(lazy.loads).toBe(1);
  });
});

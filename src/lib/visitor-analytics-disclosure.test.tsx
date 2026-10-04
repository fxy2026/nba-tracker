import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Link from "next/link";
import { afterEach, expect, it, vi } from "vitest";
import { getTranslations } from "@/locales";

const state = vi.hoisted(() => ({ locale: "en" as "en" | "zh" }));
vi.mock("@/lib/locale", () => ({ getLocale: async () => state.locale }));
vi.mock("@/components/LocaleProvider", () => ({
  useLocale: () => ({ locale: state.locale, t: getTranslations(state.locale) }),
}));
const vitals = vi.hoisted(() => ({ register: vi.fn() }));
vi.mock("next/web-vitals", () => ({ useReportWebVitals: vitals.register }));
import AboutPage from "@/app/about/page";
import SiteFooter from "@/components/SiteFooter";
import WebVitalsReporter from "@/components/WebVitalsReporter";
import CloudflareAnalytics from "@/components/CloudflareAnalytics";

type Props = { children?: ReactNode; id?: string; href?: string; className?: string; prefetch?: boolean; onClick?: unknown; onNavigate?: unknown };
function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it.each(["en", "zh"] as const)("renders an anchored, conditional disclosure in %s", async locale => {
  state.locale = locale;
  const sections = nodes(await AboutPage()).filter(node => node.props.id === "visitor-statistics");
  expect(sections).toHaveLength(1);
  expect(sections[0].props.className).toContain("scroll-mt-24");
  const html = renderToStaticMarkup(sections[0]);
  for (const text of locale === "en" ? [
    "When enabled", "Page views are not a count of unique people", "private Supabase tables",
    "no analytics cookies or persistent browser identifier by default", "Do Not Track", "Global Privacy Control",
    "about 48 hours", "90 days", "may delay", "logs and backups have separate retention policies",
    "Cloudflare Web Analytics", "latest 50 metrics", "browser local storage", "does not upload",
  ] : [
    "启用后", "浏览量不等于独立访客人数", "非公开数据库表", "默认不设置统计 Cookie 或持久浏览器标识",
    "Do Not Track", "Global Privacy Control", "约 48 小时", "90 天", "可能延迟删除",
    "日志和备份不适用", "Cloudflare Web Analytics", "最近 50 条指标", "浏览器本地", "不向后端上传",
  ]) expect(html).toContain(text);
  expect(html).not.toMatch(/<script|<iframe|sb_secret_|service_role|ANALYTICS_SUPABASE/);
});

it.each(["en", "zh"] as const)("links the privacy anchor from both footer layouts in %s", locale => {
  state.locale = locale;
  const footer = SiteFooter();
  const links = nodes(footer).filter(node => node.props.href === "/about#visitor-statistics");
  expect(links).toHaveLength(2);
  for (const link of links) {
    expect(link.type).toBe("a");
    expect(link.props.onClick).toBeUndefined();
    expect(link.props.onNavigate).toBeUndefined();
    expect(link.props.prefetch).toBeUndefined();
  }
  const label = locale === "en" ? "Visit statistics & privacy" : "访问统计与隐私";
  expect(links.map(node => node.props.children)).toEqual([label, label]);
  const mobile = links.find(node => node.props.className?.includes("sm:hidden"))!;
  expect(mobile.props.className).toContain("min-h-11");
  expect(mobile.props.className).toContain("mb-20");
  const desktop = nodes(footer).find(node => node.type === "footer")!;
  expect(desktop.props.className).toContain("hidden sm:block");
  expect(nodes(desktop).filter(node => node.props.href === "/about#visitor-statistics")).toHaveLength(1);
  expect(renderToStaticMarkup(footer).match(/href="\/about#visitor-statistics"/g)).toHaveLength(2);
  expect(nodes(footer).filter(node => node.type === Link).length).toBeGreaterThan(30);
  expect(nodes(footer).find(node => node.props.href === "/about")?.type).toBe(Link);
});

it.each(["en", "zh"] as const)("keeps native privacy targets stable across repeated navigation and locale changes from %s", locale => {
  // This verifies rendered-anchor/URL contracts, not browser scrolling. Native
  // anchors deliberately bypass Next's cached canonical URL concatenation.
  for (const start of [
    "/about", "/about#visitor-statistics", "/about#visitor-statistics#visitor-statistics",
    "/about?source=footer#other-section", "/", "/calendar?date=2026-10-04", "/player/201939#career",
  ]) {
    let current = new URL(start, "https://nba.example");
    for (const nextLocale of [locale, locale === "en" ? "zh" : "en", locale] as const) {
      state.locale = nextLocale;
      const links = nodes(SiteFooter()).filter(node => node.props.href === "/about#visitor-statistics");
      expect(links).toHaveLength(2);
      for (const link of links) {
        expect(link.type).toBe("a");
        expect(link.props.children).toBe(nextLocale === "en" ? "Visit statistics & privacy" : "访问统计与隐私");
        for (let click = 0; click < 3; click++) {
          current = new URL(link.props.href!, current);
          expect(current.href).toBe("https://nba.example/about#visitor-statistics");
          expect(current.hash).toBe("#visitor-statistics");
        }
      }
    }
  }
});

it("keeps WebVitals diagnostics local with the disclosed 50-entry path buffer", () => {
  let stored: string | null = null;
  const localStorage = { getItem: vi.fn(() => stored), setItem: vi.fn((_key: string, value: string) => { stored = value; }) };
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("window", { location: { pathname: "/player/201939", search: "?private=excluded" } });
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  WebVitalsReporter();
  const report = vitals.register.mock.calls.at(-1)![0];
  for (let i = 0; i < 55; i++) report({ name: "LCP", value: i, id: String(i), delta: 1, rating: "good" });
  const entries = JSON.parse(stored!);
  expect(entries).toHaveLength(50);
  expect(entries[0]).toMatchObject({ id: "54", path: "/player/201939" });
  expect(entries.at(-1)).toMatchObject({ id: "5" });
  expect(stored).not.toContain("private=excluded");
  expect(localStorage.setItem).toHaveBeenCalledWith("nba-tracker-vitals", expect.any(String));
  expect(log).toHaveBeenCalledTimes(55); expect(fetch).not.toHaveBeenCalled();
});

it("keeps the existing Cloudflare beacon production-only and separate", () => {
  vi.stubEnv("NODE_ENV", "development");
  expect(CloudflareAnalytics()).toBeNull();
  vi.stubEnv("NODE_ENV", "production");
  const html = renderToStaticMarkup(createElement(CloudflareAnalytics));
  expect(html).toContain("https://static.cloudflareinsights.com/beacon.min.js");
  expect(html).toContain("data-cf-beacon");
  expect(html).not.toContain("/api/analytics/pageview");
});

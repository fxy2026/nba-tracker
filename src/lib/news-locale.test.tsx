import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "@/locales/types";

const runtime = vi.hoisted(() => ({ cookie: undefined as string | undefined }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => runtime.cookie === undefined ? undefined : { value: runtime.cookie } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import NewsPage, { generateMetadata } from "@/app/news/page";
import { getLocale } from "./locale";
import { LocaleProvider } from "@/components/LocaleProvider";
import LocaleToggle from "@/components/LocaleToggle";

const fetchMock = vi.fn();
beforeEach(() => {
  runtime.cookie = undefined;
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ articles: [] }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); });
async function html(locale: Locale) {
  return renderToStaticMarkup(<LocaleProvider initialLocale={locale}><LocaleToggle />{await NewsPage()}</LocaleProvider>);
}

describe("server news locale matches provider and language controls", () => {
  it.each(["en", "zh"] as const)("localizes heading, metadata, related links and empty feed in %s", async locale => {
    runtime.cookie = locale;
    expect(await getLocale()).toBe(locale);
    const rendered = await html(locale);
    const title = locale === "en" ? "League News" : "联盟资讯";
    expect((await generateMetadata()).title).toBe(title);
    expect(rendered).toContain(title);
    expect(rendered).toContain(locale === "en" ? "No news right now" : "暂无资讯");
    expect(rendered).toContain(locale === "en" ? "The ESPN news feed is temporarily unavailable. Please try again later." : "ESPN 资讯源暂时不可用,请稍后再试。");
    expect(rendered).toContain(locale === "en" ? "Keep exploring" : "继续探索");
    expect(rendered).toContain(locale === "en" ? "切换到中文" : "Switch to English");
    expect(rendered).not.toContain(locale === "en" ? "暂无资讯" : "No news right now");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(["en", "zh"] as const)("keeps populated feed controls in the server's %s locale", async locale => {
    runtime.cookie = locale;
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ articles: [
      { id: 1, headline: "Original ESPN headline", type: "Story", categories: [{ type: "team", description: "Boston Celtics" }] },
      { id: 2, headline: "Original recap", type: "Recap" },
    ] }) });
    const rendered = await html(locale);
    expect(rendered).toContain("Original ESPN headline");
    expect(rendered).toContain(locale === "en" ? "Source: ESPN (English)" : "来源: ESPN (英文原文)");
    expect(rendered).toContain(locale === "en" ? "items" : "条资讯");
    expect(rendered).toContain(locale === "en" ? "News category" : "资讯分类");
    expect(rendered).toContain(locale === "en" ? "Filter by team" : "球队筛选");
    expect(rendered).toContain(locale === "en" ? "League News" : "联盟资讯");
    expect(rendered).not.toContain(locale === "en" ? "暂无资讯" : "No news right now");
  });
  it.each([undefined, "invalid"])("uses the same Chinese fallback for cookie %s", async cookie => {
    runtime.cookie = cookie;
    const locale = await getLocale(); expect(locale).toBe("zh");
    expect(await html(locale)).toContain("暂无资讯");
  });
  it.each(["en", "zh"] as const)("localizes a failed fetch without external requests in %s", async locale => {
    runtime.cookie = locale; fetchMock.mockRejectedValue(new Error("Mock offline"));
    expect(await html(locale)).toContain(locale === "en" ? "No news right now" : "暂无资讯");
  });
});

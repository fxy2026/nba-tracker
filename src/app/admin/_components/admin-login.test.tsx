import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getTranslations } from "@/locales";

const state = vi.hoisted(() => ({ locale: "en" as "en" | "zh" }));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: state.locale, t: getTranslations(state.locale) }) }));
import AdminPage from "../page";
import styles from "../admin.module.css";

const css = readFileSync(new URL("../admin.module.css", import.meta.url), "utf8");
const mobile = css.split("@media (max-width: 639px) {")[1].split("@media (prefers-reduced-motion")[0];
function rule(source: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = source.match(new RegExp(`${escaped} \\{([^}]+)\\}`))?.[1];
  expect(body, `Missing CSS rule ${selector}`).toBeDefined();
  return body!;
}

describe("compact admin login presentation", () => {
  it.each(["en", "zh"] as const)("retains labeled credentials, navigation and security instructions in %s", locale => {
    state.locale = locale;
    const html = renderToStaticMarkup(createElement(AdminPage));
    const t = getTranslations(locale);
    expect(html).toContain('href="/"');
    expect(html).toContain(locale === "zh" ? "返回网站" : "Back to site");
    expect(html).toContain(`<div class="${styles.loginFormHeader}">`);
    expect(html).toContain(t.admin.login);
    expect(html).toContain(locale === "zh" ? "输入管理密码以访问后台。" : "Enter your admin password.");
    expect(html).toContain('for="admin-password"');
    expect(html).toContain('id="admin-password"');
    expect(html).toContain('type="password"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('required=""');
    expect(html).toContain('type="submit"');
    expect(html).toContain(locale === "zh" ? "不写入浏览器存储" : "isn&#x27;t written to browser storage");
    expect(html).toContain(locale === "zh" ? "刷新或退出登录后需重新验证" : "Refreshing or signing out clears");
    if (locale === "en") expect(html).toContain("Your site. <br/>A clearer view.");
  });

  it("keeps desktop composition while sharing the phone header row and removing the forced title break", () => {
    expect(rule(css, ".login")).toContain("grid-template-columns: 1fr 1fr");
    expect(rule(css, ".loginTitle")).toContain("clamp(36px,5vw,52px)");
    expect(rule(mobile, ".loginIntro")).toContain("grid-template-columns: minmax(0,1fr) auto");
    expect(rule(mobile, ".loginLink")).toContain("grid-row: 1");
    expect(rule(mobile, ".loginLink")).toContain("grid-column: 2");
    expect(rule(mobile, ".loginTitle br")).toContain("display: none");
    expect(rule(mobile, ".loginFormHeader")).toContain("grid-template-columns: 44px minmax(0,1fr)");
  });

  it("preserves touch targets, zoom-safe input text, focus styling and ordinary document scrolling", () => {
    expect(rule(css, ".button, .iconButton, .primaryButton, .dangerButton")).toContain("min-height: 44px");
    expect(rule(css, ".input")).toContain("min-height: 46px");
    expect(rule(mobile, ".input")).toContain("font-size: 16px");
    expect(css).toContain('.login :is(button, a, input):focus-visible');
    for (const selector of [".login", ".loginForm"]) {
      expect(rule(mobile, selector)).not.toMatch(/(?:^|;)\s*(?:height|max-height|overflow(?:-y)?)\s*:/);
    }
    expect(mobile).not.toMatch(/\.login(?:Fine|Intro \.subtitle)[^}]*display:\s*none/);
    expect(rule(mobile, ".loginForm .error")).toContain("margin: 0");
  });

  it("does not ship the retired replay-management layout", () => {
    expect(css).not.toMatch(/\.(?:dateControls|quickDates|replayGrid|gameList|gameTop|gameMatchup|gameScore|replayItem(?:Info|Title|Url|Actions)?|replayForm|formGrid)\b/);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./season-heatmap.module.css", import.meta.url), "utf8");

describe("heatmap application theme integration", () => {
  it("inherits the app's surface, text and control tokens with readable light fallbacks", () => {
    const root = css.match(/^\.explorer \{([^\n]+)\}/m)?.[1];
    expect(root).toContain("--heat-text: var(--text-primary, #0f172a)");
    expect(root).toContain("--heat-muted: var(--text-secondary, #475569)");
    expect(root).toContain("--heat-surface: var(--bg-card, #ffffff)");
    expect(root).toContain("--heat-control: var(--bg-secondary, #eef2f7)");
    expect(root).toContain("background: var(--heat-surface)");
    expect(root).not.toContain("color-scheme: dark");
  });
  it("follows the same light-theme attribute as the application for native controls", () => {
    expect(css).toContain('color-scheme: light;');
    expect(css).toContain(':global(html:not([data-theme="light"])) .explorer { color-scheme: dark; }');
    expect(css).not.toMatch(/(?:color|background(?:-color)?|border-color)\s*:\s*#[\da-f]+/i);
  });
  it("uses theme-aware selected and focus states", () => {
    expect(css).toContain(".segment button[aria-pressed='true'] { background: var(--heat-surface); color: var(--heat-text)");
    expect(css).toContain(".modeSelector button[aria-pressed='true'] { border-color: var(--heat-accent)");
    expect(css).toContain("outline: 2px solid var(--heat-accent)");
  });
});

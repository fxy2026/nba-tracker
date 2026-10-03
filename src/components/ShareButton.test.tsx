import { readFileSync } from "node:fs";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTranslations } from "@/locales";

// Run the real component handlers with deterministic hook lifecycles. All browser
// sharing/clipboard APIs are mocks; these tests never send or copy real content.
const runtime = vi.hoisted(() => ({
  index: 0, slots: [] as unknown[], effects: [] as (() => void)[],
  locale: "en" as "en" | "zh", toast: vi.fn(), updates: vi.fn(),
}));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  memo: (component: unknown) => component,
  useState: (initial: unknown) => {
    const index = runtime.index++;
    if (!(index in runtime.slots)) runtime.slots[index] = initial;
    return [runtime.slots[index], (value: unknown) => {
      runtime.updates(value);
      runtime.slots[index] = typeof value === "function" ? value(runtime.slots[index]) : value;
    }];
  },
  useRef: (initial: unknown) => {
    const index = runtime.index++;
    return runtime.slots[index] ?? (runtime.slots[index] = { current: initial });
  },
  useEffect: (run: () => void | (() => void), deps: unknown[]) => {
    const index = runtime.index++;
    const previous = runtime.slots[index] as { deps: unknown[]; cleanup?: () => void } | undefined;
    if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
      runtime.effects.push(() => { previous?.cleanup?.(); runtime.slots[index] = { deps, cleanup: run() }; });
    }
  },
}));
vi.mock("@/components/LocaleProvider", () => ({ useLocale: () => ({ locale: runtime.locale, t: getTranslations(runtime.locale) }) }));
vi.mock("@/components/ToastProvider", () => ({ useToast: () => ({ toast: runtime.toast }) }));
import ShareButton from "./ShareButton";

type Button = {
  onClick: () => Promise<void>;
  disabled: boolean;
  "aria-busy": boolean;
  "aria-label": string;
  title: string;
  type: string;
  children: ReactNode;
};
const payload = "Stephen Curry · https://nba.xpy.me/player/201939";
const writeText = vi.fn();
function render(props: Partial<ComponentProps<typeof ShareButton>> = {}) {
  runtime.index = 0;
  const tree = ShareButton({ text: payload, ...props }) as ReactElement<Button>;
  runtime.effects.splice(0).forEach(run => run());
  return { button: tree.props, html: () => renderToStaticMarkup(tree) };
}
function unmount() { runtime.slots.forEach(slot => (slot as { cleanup?: () => void } | undefined)?.cleanup?.()); }
function deferred() {
  let resolve!: () => void, reject!: (error: unknown) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  runtime.index = 0; runtime.slots = []; runtime.effects = []; runtime.locale = "en";
  runtime.toast.mockReset(); runtime.updates.mockReset(); writeText.mockReset().mockResolvedValue(undefined);
  vi.useFakeTimers();
  vi.stubGlobal("navigator", { clipboard: { writeText } });
});
afterEach(() => { unmount(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("native sharing and cancellation", () => {
  it.each([new DOMException("Share dismissed", "AbortError"), { name: "AbortError" }])("returns silently for cancellation %j without copying or success feedback", async error => {
    const share = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });
    await render().button.onClick();
    expect(share).toHaveBeenCalledExactlyOnceWith({ text: payload });
    expect(writeText).not.toHaveBeenCalled(); expect(runtime.toast).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0); expect(render().button.disabled).toBe(false);
    await render().button.onClick(); expect(share).toHaveBeenCalledTimes(2);
  });
  it("returns after native share success without copying or claiming a clipboard success", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });
    await render().button.onClick();
    expect(share).toHaveBeenCalledExactlyOnceWith({ text: payload });
    expect(writeText).not.toHaveBeenCalled(); expect(runtime.toast).not.toHaveBeenCalled();
    expect(render().button.disabled).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
  it.each([new Error("Share unavailable"), new DOMException("Permission denied", "NotAllowedError"), null])("keeps clipboard fallback for genuine native failure %j", async error => {
    vi.stubGlobal("navigator", { share: vi.fn().mockRejectedValue(error), clipboard: { writeText } });
    await render().button.onClick();
    expect(writeText).toHaveBeenCalledExactlyOnceWith(payload);
    expect(runtime.toast).toHaveBeenCalledExactlyOnceWith("Copied!");
    expect(render().button.disabled).toBe(false);
  });
  it("keeps fallback when native sharing throws synchronously", async () => {
    vi.stubGlobal("navigator", { share: () => { throw new Error("Unavailable"); }, clipboard: { writeText } });
    await render().button.onClick(); expect(writeText).toHaveBeenCalledExactlyOnceWith(payload);
  });
});

describe("in-flight interaction guard", () => {
  it("blocks immediate repeated taps and stays busy through native-to-clipboard fallback", async () => {
    const native = deferred(), clipboard = deferred();
    const share = vi.fn().mockReturnValue(native.promise);
    writeText.mockReturnValue(clipboard.promise);
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });
    const first = render().button;
    const pending = first.onClick(); await first.onClick();
    expect(share).toHaveBeenCalledTimes(1);
    expect(render().button).toMatchObject({ disabled: true, "aria-busy": true });
    native.reject(new Error("Native unavailable"));
    await Promise.resolve(); await Promise.resolve();
    await render().button.onClick(); expect(writeText).toHaveBeenCalledTimes(1);
    expect(render().button.disabled).toBe(true);
    clipboard.resolve(); await pending;
    expect(render().button).toMatchObject({ disabled: false, "aria-busy": false });
    await render().button.onClick(); expect(share).toHaveBeenCalledTimes(2);
  });
  it("also blocks repeated direct clipboard attempts and releases the guard after failure", async () => {
    const clipboard = deferred(); writeText.mockReturnValueOnce(clipboard.promise);
    const button = render().button;
    const pending = button.onClick(); await button.onClick(); await render().button.onClick();
    expect(writeText).toHaveBeenCalledTimes(1); expect(render().button.disabled).toBe(true);
    clipboard.reject(new Error("Clipboard denied")); await pending;
    expect(render().button.disabled).toBe(false); expect(runtime.toast).not.toHaveBeenCalled();
    await render().button.onClick(); expect(writeText).toHaveBeenCalledTimes(2);
    expect(runtime.toast).toHaveBeenCalledExactlyOnceWith("Copied!");
  });
});

describe("clipboard feedback lifecycle", () => {
  it.each(["en", "zh"] as const)("copies the exact payload and clears localized feedback after two seconds in %s", async locale => {
    runtime.locale = locale; await render().button.onClick();
    expect(writeText).toHaveBeenCalledExactlyOnceWith(payload);
    const label = locale === "zh" ? "已复制！" : "Copied!";
    expect(runtime.toast).toHaveBeenCalledExactlyOnceWith(label); expect(render().html()).toContain(label);
    vi.advanceTimersByTime(1999); expect(render().html()).toContain(label);
    vi.advanceTimersByTime(1); expect(render().html()).not.toContain(label); expect(vi.getTimerCount()).toBe(0);
  });
  it("replaces the copied-state timer so a second success gets its full two seconds", async () => {
    await render().button.onClick(); vi.advanceTimersByTime(1000); await render().button.onClick();
    expect(vi.getTimerCount()).toBe(1); vi.advanceTimersByTime(1000); expect(render().html()).toContain("Copied!");
    vi.advanceTimersByTime(1000); expect(render().html()).not.toContain("Copied!");
  });
  it.each(["missing", "denied"])("handles a %s clipboard without success feedback or a stuck busy state", async failure => {
    if (failure === "missing") vi.stubGlobal("navigator", {});
    else writeText.mockRejectedValue(new Error("Clipboard denied"));
    await expect(render().button.onClick()).resolves.toBeUndefined();
    expect(render().button.disabled).toBe(false); expect(runtime.toast).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cleans up its copied-state timer on unmount", async () => {
    await render().button.onClick(); expect(vi.getTimerCount()).toBe(1);
    unmount(); runtime.updates.mockClear(); vi.runAllTimers();
    expect(vi.getTimerCount()).toBe(0); expect(runtime.updates).not.toHaveBeenCalled();
  });
  it.each(["success", "error", "cancel"])("ignores late native %s after unmount without clipboard fallback or state writes", async outcome => {
    const native = deferred(); vi.stubGlobal("navigator", { share: () => native.promise, clipboard: { writeText } });
    const oldButton = render().button; const pending = oldButton.onClick();
    unmount(); runtime.updates.mockClear();
    if (outcome === "success") native.resolve();
    else native.reject(new DOMException("Late result", outcome === "cancel" ? "AbortError" : "NotAllowedError"));
    await pending; await oldButton.onClick();
    expect(writeText).not.toHaveBeenCalled(); expect(runtime.toast).not.toHaveBeenCalled();
    expect(runtime.updates).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it.each(["success", "error"])("ignores late clipboard %s after unmount", async outcome => {
    const clipboard = deferred(); writeText.mockReturnValue(clipboard.promise);
    const pending = render().button.onClick(); unmount(); runtime.updates.mockClear();
    if (outcome === "success") clipboard.resolve(); else clipboard.reject(new Error("Late denial"));
    await pending; expect(runtime.toast).not.toHaveBeenCalled(); expect(runtime.updates).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("localized accessible sharing subjects", () => {
  it.each([
    ["en", undefined, "Share game result"], ["zh", undefined, "分享比赛结果"],
    ["en", "game", "Share game result"], ["zh", "game", "分享比赛结果"],
    ["en", "player", "Share player profile"], ["zh", "player", "分享球员主页"],
    ["en", "team", "Share team page"], ["zh", "team", "分享球队页面"],
    ["en", "quiz", "Share quiz score"], ["zh", "quiz", "分享答题成绩"],
  ] as const)("uses %s / %s correctly without changing its touch target", (locale, subject, label) => {
    runtime.locale = locale; const view = render({ subject });
    expect(view.button).toMatchObject({ type: "button", title: label, "aria-label": label });
    const html = view.html();
    expect(html).toContain(`aria-label="${label}"`); expect(html).toContain("min-h-[44px] min-w-[44px]");
    expect(html).toContain('aria-hidden="true"');
  });
  it.each([
    ["src/app/player/[id]/page.tsx", "player"],
    ["src/components/player/ArchivedPlayerProfile.tsx", "player"],
    ["src/app/team/[tricode]/_components/TeamHero.tsx", "team"],
    ["src/app/quiz/page.tsx", "quiz"],
  ])("wires the subject on %s", (path, subject) => {
    const source = readFileSync(path, "utf8");
    expect(source.match(/<ShareButton\b/g)).toHaveLength(1);
    expect(source).toContain(`<ShareButton subject="${subject}" text=`);
  });
  it("preserves default game usage", () => {
    expect(readFileSync("src/app/game/[id]/_components/GameHero.tsx", "utf8")).toContain("<ShareButton text={shareText} />");
  });
});

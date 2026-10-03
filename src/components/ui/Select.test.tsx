import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Select, { type SelectProps } from "./Select";

// Actual component-handler tests. Layout, native focus and touch still need browser QA.
const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0, effects: [] as (() => void | (() => void))[], layoutEffects: [] as (() => void | (() => void))[] }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useId: () => "select-test",
  useLayoutEffect: (effect: () => void | (() => void)) => { hooks.layoutEffects.push(effect); },
  useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
  useRef: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = { current: initial };
    return hooks.values[index];
  },
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (next: unknown) => { hooks.values[index] = typeof next === "function" ? next(hooks.values[index]) : next; }];
  },
}));
vi.mock("react-dom", () => ({ createPortal: (node: ReactNode) => node }));

type ElementProps = Record<string, unknown> & { children?: ReactNode; onClick?: () => void; onKeyDown?: (event: unknown) => void };
function elements(node: ReactNode): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
let value = "a";
const changed = vi.fn((next: string) => { value = next; });
const options = [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta", disabled: true }, { value: "c", label: "Charlie" }, { value: "d", label: "Delta" }, { value: "e", label: "Charles" }];
function render(extra: Partial<SelectProps> = {}) {
  hooks.cursor = 0;
  hooks.effects = [];
  hooks.layoutEffects = [];
  const nodes = elements(Select({ value, onValueChange: changed, options, "aria-label": "Player", ...extra }));
  const trigger = nodes.find(node => node.props.role === "combobox")!.props;
  return {
    trigger,
    options: nodes.filter(node => node.props.role === "option").map(node => node.props),
    key: (key: string) => { const preventDefault = vi.fn(); const stopPropagation = vi.fn(); trigger.onKeyDown!({ key, preventDefault, stopPropagation }); return { preventDefault, stopPropagation }; },
  };
}
beforeEach(() => {
  hooks.values = []; hooks.cursor = 0; hooks.effects = []; value = "a"; changed.mockClear();
  vi.stubGlobal("document", { body: {}, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

describe("shared Select component handlers", () => {
  it("opens a labelled listbox and preserves selection until Enter", () => {
    let view = render();
    expect(view.trigger["aria-label"]).toBe("Player");
    expect(view.trigger.type).toBe("button");
    expect(view.trigger["aria-expanded"]).toBe(false);
    view.key("ArrowDown");
    view = render();
    expect(view.trigger["aria-expanded"]).toBe(true);
    expect(view.trigger["aria-controls"]).toBe("select-test-options");
    view.key("ArrowDown");
    expect(render().trigger["aria-activedescendant"]).toBe("select-test-options-2");
    expect(changed).not.toHaveBeenCalled();
    render().key("Enter");
    expect(changed).toHaveBeenCalledWith("c");
    expect(render().trigger["aria-expanded"]).toBe(false);
  });
  it("supports Home, End, Escape and untrapped Tab", () => {
    render().key("End");
    expect(render().trigger["aria-activedescendant"]).toBe("select-test-options-4");
    render().key("Home");
    expect(render().trigger["aria-activedescendant"]).toBe("select-test-options-0");
    render().key("Escape");
    expect(render().trigger["aria-expanded"]).toBe(false);
    expect(changed).not.toHaveBeenCalled();
    render().key(" ");
    expect(render().key("Tab").preventDefault).not.toHaveBeenCalled();
    expect(render().trigger["aria-expanded"]).toBe(false);
  });
  it("supports typeahead prefixes and repeated-character cycling", () => {
    render().key("c");
    expect(render().trigger["aria-activedescendant"]).toBe("select-test-options-2");
    render().key("c");
    expect(render().trigger["aria-activedescendant"]).toBe("select-test-options-4");
    render().key("Escape");
    render().key("d"); render().key("e");
    expect(render().trigger["aria-activedescendant"]).toBe("select-test-options-3");
    render().key("Enter");
    expect(value).toBe("d");
  });
  it("skips disabled choices, avoids duplicate callbacks and restores trigger focus", () => {
    const focus = vi.fn();
    render();
    (hooks.values[0] as { current: unknown }).current = { focus };
    render().trigger.onClick!();
    render().options[1].onClick!();
    expect(changed).not.toHaveBeenCalled();
    expect(render().trigger["aria-expanded"]).toBe(true);
    render().options[0].onClick!();
    expect(changed).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    render().trigger.onClick!();
    render().options[3].onClick!();
    expect(value).toBe("d");
  });
  it("dismisses outside pointer/focus events without stealing outside focus", () => {
    const focus = vi.fn();
    render().trigger.onClick!();
    render();
    (hooks.values[0] as { current: unknown }).current = { contains: () => false, focus };
    hooks.effects[0]();
    const listener = vi.mocked(document.addEventListener).mock.calls.find(call => call[0] === "pointerdown")![1] as (event: unknown) => void;
    listener({ target: {} });
    expect(render().trigger["aria-expanded"]).toBe(false);
    expect(focus).not.toHaveBeenCalled();
  });
  it("handles unavailable and unknown controlled values", () => {
    render({ disabled: true }).trigger.onClick!();
    expect(render({ disabled: true }).trigger["aria-expanded"]).toBe(false);
    expect(render({ options: [] }).trigger.disabled).toBe(true);
    value = "historical";
    render().key("ArrowDown");
    expect(render().trigger["aria-activedescendant"]).toBe("select-test-options-0");
  });
  it.each(["disabled", "empty", "all-disabled"])("does not reopen after an open control becomes %s and later recovers", kind => {
    render().key("ArrowDown");
    const unavailable = kind === "disabled" ? { disabled: true } : { options: kind === "empty" ? [] : options.map(option => ({ ...option, disabled: true })) };
    expect(render(unavailable).trigger["aria-expanded"]).toBe(false);
    expect(render().trigger["aria-expanded"]).toBe(false);
    expect(changed).not.toHaveBeenCalled();
  });
  it("closes when options or the controlled value change, preventing a stale index from committing", () => {
    render().key("End");
    const reversed = [...options].reverse();
    expect(render({ options: reversed }).trigger["aria-expanded"]).toBe(false);
    render({ options: reversed }).key("Enter");
    expect(changed).not.toHaveBeenCalled();
    expect(render({ options: reversed }).trigger["aria-activedescendant"]).toBe("select-test-options-4");
    value = "d";
    expect(render({ options: reversed }).trigger["aria-expanded"]).toBe(false);
  });
  it("keeps an open choice for equivalent newly allocated option arrays", () => {
    render().key("End");
    expect(render({ options: options.map(option => ({ ...option })) }).trigger["aria-expanded"]).toBe(true);
    render().key("Enter");
    expect(value).toBe("e");
  });
  it("starts a fresh typeahead query after choices change and dismiss the popup", () => {
    render().key("c");
    const nextOptions = options.slice(0, 4);
    render({ options: nextOptions });
    render({ options: nextOptions }).key("d");
    expect(render({ options: nextOptions }).trigger["aria-activedescendant"]).toBe("select-test-options-3");
  });
  it("measures wrapped labels at the final width and handles window resize targets", () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const viewport = { innerWidth: 1280, innerHeight: 720, addEventListener: (name: string, callback: (event: unknown) => void) => listeners.set(name, callback), removeEventListener: vi.fn() };
    vi.stubGlobal("window", viewport);
    render().key("ArrowDown");
    render();
    (hooks.values[0] as { current: unknown }).current = { getBoundingClientRect: () => ({ left: 100, top: 650, bottom: 694, width: 110 }) };
    const popup = { style: { width: "" }, get scrollHeight() { return this.style.width === "184px" ? 130 : 90; } };
    (hooks.values[1] as { current: unknown }).current = popup;
    hooks.layoutEffects[0]();
    expect(popup.style.width).toBe("184px");
    expect(hooks.values[5]).toMatchObject({ top: 512, maxHeight: 132, width: 184 });
    expect(() => listeners.get("resize")!({ target: viewport })).not.toThrow();
  });
});

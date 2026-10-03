import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Select, { type SelectProps } from "./Select";

// Actual component-handler tests. Layout, native focus and touch still need browser QA.
const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0, effects: [] as (() => void | (() => void))[] }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useId: () => "select-test",
  useLayoutEffect: () => {},
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
});

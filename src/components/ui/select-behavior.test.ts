import { describe, expect, it } from "vitest";
import { findTypeaheadOption, nextEnabledOption, positionSelectPopup } from "./select-behavior";

const options = [
  { value: "all", label: "All players" },
  { value: "1", label: "Stephen Curry" },
  { value: "2", label: "Steve Kerr", disabled: true },
  { value: "3", label: "Shaquille O’Neal" },
  { value: "4", label: "LeBron James" },
];

describe("shared select keyboard and placement rules", () => {
  it("skips disabled options and stops at the ends", () => {
    expect(nextEnabledOption(options, 1, 1)).toBe(3);
    expect(nextEnabledOption(options, 3, -1)).toBe(1);
    expect(nextEnabledOption(options, 4, 1)).toBe(4);
    expect(nextEnabledOption(options, 0, -1)).toBe(0);
    expect(nextEnabledOption(options, -1, 1)).toBe(0);
    expect(nextEnabledOption(options, options.length, -1)).toBe(4);
    expect(nextEnabledOption([{ value: "a", label: "A", disabled: true }], -1, 1)).toBe(-1);
  });
  it("supports prefix search, cycling, disabled choices and missing values", () => {
    expect(findTypeaheadOption(options, "s", 0)).toBe(1);
    expect(findTypeaheadOption(options, "S", 1)).toBe(3);
    expect(findTypeaheadOption(options, "s", 3)).toBe(1);
    expect(findTypeaheadOption(options, "ste", 1, true)).toBe(1);
    expect(findTypeaheadOption(options, "Steve", 1)).toBe(-1);
    expect(findTypeaheadOption(options, "all", -1)).toBe(0);
    expect(findTypeaheadOption([], "s", -1)).toBe(-1);
  });
  it("bounds long lists and flips above near the viewport bottom", () => {
    const viewport = { left: 0, top: 0, width: 1280, height: 720 };
    expect(positionSelectPopup({ left: 100, top: 100, bottom: 144, width: 110 }, viewport, 900)).toEqual({ left: 100, top: 150, width: 184, maxHeight: 320 });
    expect(positionSelectPopup({ left: 1200, top: 650, bottom: 694, width: 200 }, viewport, 900)).toEqual({ left: 1072, top: 324, width: 200, maxHeight: 320 });
  });
  it("respects narrow and zoomed mobile viewports, including short screens", () => {
    for (const viewport of [
      { left: 0, top: 0, width: 320, height: 568 },
      { left: 140, top: 90, width: 220, height: 300 },
      { left: 0, top: 0, width: 180, height: 150 },
    ]) {
      const position = positionSelectPopup({ left: viewport.left + 130, top: viewport.top + 90, bottom: viewport.top + 134, width: 300 }, viewport, 900);
      expect(position.left).toBeGreaterThanOrEqual(viewport.left + 8);
      expect(position.left + position.width).toBeLessThanOrEqual(viewport.left + viewport.width - 8);
      expect(position.top).toBeGreaterThanOrEqual(viewport.top + 8);
      expect(position.top + position.maxHeight).toBeLessThanOrEqual(viewport.top + viewport.height - 8);
    }
  });
});

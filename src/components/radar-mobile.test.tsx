import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import RadarChart from "./RadarChart";

it.each([3, 4, 5])("opts in to readable phone labels and wrapping names without changing %i-axis values", count => {
  const stats = ["PPG", "RPG", "APG", "SPG", "BPG"].slice(0, count).map((label, index) => ({
    label, home: index + 1, away: index + 2, max: index + 3,
  }));
  const props = { stats, homeLabel: "Shai Gilgeous-Alexander", awayLabel: "Giannis Antetokounmpo" };
  const standard = renderToStaticMarkup(createElement(RadarChart, props));
  const mobile = renderToStaticMarkup(createElement(RadarChart, { ...props, mobileReadable: true }));
  // The shared game radar keeps its existing presentation by default.
  expect(standard).not.toContain("text-[14px]");
  expect(standard).not.toContain("grid-cols-2");
  expect(mobile.match(/text-\[14px\] sm:text-\[10px\]/g)).toHaveLength(count);
  expect(mobile).toContain("grid grid-cols-2");
  expect(mobile).toContain("min-w-0 break-words");
  expect(mobile).toContain(props.homeLabel);
  expect(mobile).toContain(props.awayLabel);
  for (const tag of ["polygon", "line", "circle"]) {
    expect(mobile.match(new RegExp(`<${tag}[^>]+>`, "g"))).toEqual(standard.match(new RegExp(`<${tag}[^>]+>`, "g")));
  }
  expect(mobile.match(/aria-label="[^"]+"/)?.[0]).toBe(standard.match(/aria-label="[^"]+"/)?.[0]);
  expect(mobile).not.toMatch(/NaN|Infinity/);
});

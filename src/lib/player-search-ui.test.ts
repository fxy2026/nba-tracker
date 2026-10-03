import { expect, it } from "vitest";
import { canSearchPlayers, isPlayerSearchResult, playerNameMatch } from "./player-search-ui";

it("requires a meaningful name query but permits every positive one-digit NBA ID", () => {
  for (const query of ["", " ", "C"]) expect(canSearchPlayers(query)).toBe(false);
  for (const query of ["Curry", "乔丹", "2", " 2544 "]) expect(canSearchPlayers(query)).toBe(true);
});
it("validates identity fields before rendering safe canonical routes", () => {
  expect(isPlayerSearchResult({ id: 2544, name: "LeBron James" })).toBe(true);
  for (const row of [null, {}, { id: 0, name: "A" }, { id: 1.2, name: "A" }, { id: "2544", name: "A" }, { id: 1, name: "" }]) expect(isPlayerSearchResult(row)).toBe(false);
});
it.each([
  ["Nikola Jokić", "jokic", "Jokić"], ["Luka Dončić", "Don", "Don"], ["Stephen Curry", "curry", "Curry"],
])("highlights %s without rewriting the original spelling", (name, query, expected) => {
  const match = playerNameMatch(name, query); expect(match).not.toBeNull(); expect(name.slice(match!.start, match!.end)).toBe(expected);
});
it("does not invent a display-name match for a nickname or empty input", () => {
  expect(playerNameMatch("Michael Jordan", "乔丹")).toBeNull(); expect(playerNameMatch("Michael Jordan", "")).toBeNull();
});

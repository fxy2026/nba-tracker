import { describe, expect, it } from "vitest";
import { playerPanelFromLocation, playerPanelHref, playerSeasonHref } from "./player-mobile-navigation";
import { playerShootingSelection } from "./player-profile-navigation";
const catalog = [
  { playerId: 977, season: "2015-16", seasonType: "Regular Season" as const, availability: "available" as const },
  { playerId: 977, season: "2009-10", seasonType: "Playoffs" as const, availability: "available" as const },
];
describe("profile panel URL contract", () => {
  it("supports query links, legacy anchors, bounded archive tabs and safe fallback", () => {
    expect(playerPanelFromLocation("?panel=honors")).toBe("honors");
    expect(playerPanelFromLocation("?panel=data", "#shooting")).toBe("shooting");
    expect(playerPanelFromLocation("?panel=games", "", ["data", "career"])).toBe("data");
    expect(playerPanelFromLocation("?panel=https://evil.test")).toBe("data");
  });
  it("retains season/type across tabs, clears obsolete anchors, and retains panel across seasons", () => {
    const a = playerPanelHref("/player/977?season=2009-10&seasonType=Playoffs#shooting", "honors");
    expect(a).toBe("/player/977?season=2009-10&seasonType=Playoffs&panel=honors");
    expect(playerSeasonHref(a, "2015-16", "Regular Season")).toBe("/player/977?season=2015-16&seasonType=Regular+Season&panel=honors");
  });
  it("uses identical catalog validation for invalid URL pairs on server and client", () => {
    expect(playerShootingSelection(977, catalog, { season: "1900-01", seasonType: "Playoffs" })).toEqual({ playerId: 977, season: "2015-16", seasonType: "Regular Season" });
    expect(playerShootingSelection(977, catalog, { season: "2009-10", seasonType: "Playoffs" })).toEqual({ playerId: 977, season: "2009-10", seasonType: "Playoffs" });
  });
});

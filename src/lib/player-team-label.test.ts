import { describe, expect, it } from "vitest";
import { playerIndexTeamLabel } from "./player-index-provenance";

describe("playerIndexTeamLabel", () => {
  it.each(["en", "zh"])("preserves a known team in %s", locale => {
    expect(playerIndexTeamLabel({ teamCity: "Los Angeles", teamName: "Lakers" }, locale)).toBe("Los Angeles Lakers");
  });
  it.each([
    { teamCity: null, teamName: null },
    { teamCity: undefined, teamName: undefined },
    { teamCity: "  ", teamName: "\t" },
    {},
  ])("uses localized source-aware wording for missing teams", player => {
    expect(playerIndexTeamLabel(player, "en")).toBe("Team not listed in this snapshot");
    expect(playerIndexTeamLabel(player, "zh")).toBe("此快照未列出球队");
  });
  it.each([
    [{ teamCity: "  Los Angeles  ", teamName: null }, "Los Angeles"],
    [{ teamCity: undefined, teamName: " Lakers " }, "Lakers"],
  ] as const)("retains the available name without adding null or whitespace", (player, label) => {
    expect(playerIndexTeamLabel(player, "en")).toBe(label);
  });
});

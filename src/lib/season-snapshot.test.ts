import { describe, it, expect } from "vitest";
import { standingsPayload, type SeasonSnapshot, type SnapshotTeam } from "./season-snapshot";

const SNAPSHOT: SeasonSnapshot = {
  season: "2025-26",
  generatedAt: "2026-07-08T00:00:00.000Z",
  teams: [
    { tricode: "OKC", teamId: 1610612760, teamName: "Thunder", teamCity: "Oklahoma City", wins: 68, losses: 14 },
    { tricode: "BOS", teamId: 1610612738, teamName: "Celtics", teamCity: "Boston", wins: 61, losses: 21 },
  ],
  finishedGames: [],
};

describe("standingsPayload", () => {
  it("passes live standings through with no archive markers", () => {
    const live: SnapshotTeam[] = [
      { tricode: "DEN", teamId: 1610612743, teamName: "Nuggets", teamCity: "Denver", wins: 1, losses: 0 },
    ];
    const payload = standingsPayload(live, SNAPSHOT);
    expect(payload).toEqual({ data: live });
    expect("archived" in payload).toBe(false);
    expect("season" in payload).toBe(false);
  });

  it("serves snapshot teams with archived + season when live is empty", () => {
    const payload = standingsPayload([], SNAPSHOT);
    expect(payload).toEqual({ data: SNAPSHOT.teams, archived: true, season: "2025-26" });
  });
});

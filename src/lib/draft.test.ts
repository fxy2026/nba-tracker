import { describe, it, expect } from "vitest";
import { projectDraft, espnAbbrToTricode } from "@/lib/draft";

const FIXTURE = {
  positions: [
    { id: "3", displayName: "Guard", abbreviation: "G" },
    { id: "7", displayName: "Forward", abbreviation: "F" },
    { id: "9", displayName: "Center", abbreviation: "C" },
  ],
  teams: [
    { id: "1", abbreviation: "ATL", displayName: "Atlanta Hawks" },
    { id: "9", abbreviation: "GS", displayName: "Golden State Warriors" },
  ],
  picks: [
    {
      pick: 1, overall: 1, round: 1, traded: false, teamId: "1",
      athlete: {
        displayName: "AJ Dybantsa",
        position: { id: "7" },
        team: { location: "BYU" },
        headshot: { href: "https://a.espncdn.com/headshots/aj.png" },
        link: "https://www.espn.com/nba/player/_/id/5142718/aj-dybantsa",
      },
    },
    {
      pick: 2, overall: 2, round: 1, traded: true, teamId: "9",
      athlete: {
        displayName: "Traded Guy",
        position: { id: "3" },
        team: { location: "Duke" },
      },
    },
    {
      pick: 28, overall: 58, round: 2, traded: false, teamId: "99",
      athlete: { displayName: "Late Pick" },
    },
  ],
};

describe("projectDraft", () => {
  it("resolves teamId -> teams[] abbreviation", () => {
    const picks = projectDraft(FIXTURE);
    expect(picks).toHaveLength(3);
    expect(picks[0].teamAbbr).toBe("ATL");
    expect(picks[1].teamAbbr).toBe("GS");
  });

  it("reads college from athlete.team.location and position from the positions map", () => {
    const [p1] = projectDraft(FIXTURE);
    expect(p1.college).toBe("BYU");
    expect(p1.position).toBe("F");
    expect(p1.playerName).toBe("AJ Dybantsa");
    expect(p1.headshot).toBe("https://a.espncdn.com/headshots/aj.png");
    expect(p1.espnLink).toContain("espn.com");
  });

  it("still projects a traded pick, degrading missing fields to empty strings", () => {
    const traded = projectDraft(FIXTURE)[1];
    expect(traded.overall).toBe(2);
    expect(traded.playerName).toBe("Traded Guy");
    expect(traded.position).toBe("G");
    expect(traded.headshot).toBe("");
    expect(traded.espnLink).toBe("");
  });

  it("degrades unknown teamId and missing athlete fields to empty strings", () => {
    const late = projectDraft(FIXTURE)[2];
    expect(late.overall).toBe(58);
    expect(late.teamId).toBe("99");
    expect(late.teamAbbr).toBe("");
    expect(late.position).toBe("");
    expect(late.college).toBe("");
    expect(late.headshot).toBe("");
  });

  it("returns [] for non-object or malformed input", () => {
    expect(projectDraft(null)).toEqual([]);
    expect(projectDraft({})).toEqual([]);
    expect(projectDraft({ picks: "nope" })).toEqual([]);
  });
});

describe("espnAbbrToTricode", () => {
  it("maps the 6 divergent ESPN abbreviations to our tricodes", () => {
    expect(espnAbbrToTricode("GS")).toBe("GSW");
    expect(espnAbbrToTricode("NO")).toBe("NOP");
    expect(espnAbbrToTricode("NY")).toBe("NYK");
    expect(espnAbbrToTricode("SA")).toBe("SAS");
    expect(espnAbbrToTricode("UTAH")).toBe("UTA");
    expect(espnAbbrToTricode("WSH")).toBe("WAS");
  });
  it("is identity for abbreviations that already match", () => {
    expect(espnAbbrToTricode("ATL")).toBe("ATL");
    expect(espnAbbrToTricode("BOS")).toBe("BOS");
  });
});

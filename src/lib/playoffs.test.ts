import { describe, it, expect } from "vitest";
import { parseGameId, getConference, winnerOf, winnerOrCandidates, projectFutureSeries } from "./playoffs";
import type { Series, SeriesTeam } from "./playoffs";

const t = (tricode: string, wins = 0): SeriesTeam => ({
  tricode,
  teamId: 1,
  teamCity: tricode,
  teamName: tricode,
  wins,
  seed: 1,
});

const mk = (
  round: number,
  seriesIndex: number,
  conference: Series["conference"],
  a: SeriesTeam,
  b: SeriesTeam,
): Series => ({
  id: `r${round}s${seriesIndex}`,
  gameIdSample: "",
  team1: a,
  team2: b,
  totalGames: a.wins + b.wins,
  conference,
  round,
  seriesIndex,
  results: [],
});

describe("parseGameId", () => {
  it("parses round, seriesIndex, and game from a playoff gameId", () => {
    expect(parseGameId("0042500201")).toEqual({ round: 2, seriesIndex: 0, game: 1 });
  });

  it("returns zeros for a regular-season gameId", () => {
    expect(parseGameId("0022400500")).toEqual({ round: 0, seriesIndex: 0, game: 0 });
  });

  it("returns zeros for a too-short gameId", () => {
    expect(parseGameId("004250020")).toEqual({ round: 0, seriesIndex: 0, game: 0 });
  });
});

describe("getConference", () => {
  it("returns East for two East teams", () => {
    expect(getConference("BOS", "MIA")).toBe("East");
  });

  it("returns West for two West teams", () => {
    expect(getConference("LAL", "DEN")).toBe("West");
  });

  it("returns Finals for cross-conference matchups", () => {
    expect(getConference("BOS", "LAL")).toBe("Finals");
  });

  it("falls back to East for unknown tricodes", () => {
    expect(getConference("XXX", "BOS")).toBe("East");
  });
});

describe("winnerOf", () => {
  it("returns team1 when it has 4 wins", () => {
    expect(winnerOf(mk(1, 0, "East", t("BOS", 4), t("MIA", 1)))?.tricode).toBe("BOS");
  });

  it("returns team2 when it has 4 wins", () => {
    expect(winnerOf(mk(1, 0, "East", t("BOS", 0), t("MIA", 4)))?.tricode).toBe("MIA");
  });

  it("returns null for an undecided 3-2 series", () => {
    expect(winnerOf(mk(1, 0, "East", t("BOS", 3), t("MIA", 2)))).toBeNull();
  });
});

describe("winnerOrCandidates", () => {
  it("returns no winner and no candidates for undefined", () => {
    expect(winnerOrCandidates(undefined)).toEqual({ winner: null, candidates: [] });
  });

  it("returns both teams as candidates for an undecided series", () => {
    const s = mk(1, 0, "East", t("BOS", 2), t("MIA", 1));
    const { winner, candidates } = winnerOrCandidates(s);
    expect(winner).toBeNull();
    expect(candidates.map((c) => c.tricode)).toEqual(["BOS", "MIA"]);
  });

  it("excludes a TBD side with empty tricode", () => {
    const s = mk(2, 0, "East", t("", 0), t("MIA", 0));
    expect(winnerOrCandidates(s).candidates.map((c) => c.tricode)).toEqual(["MIA"]);
  });
});

describe("projectFutureSeries", () => {
  const decided = (idx: number, conf: "East" | "West", winner: string, loser: string) =>
    mk(1, idx, conf, t(winner, 4), t(loser, 1));

  const fullR1 = () => [
    decided(0, "East", "ATL", "E1L"),
    decided(1, "East", "BOS", "E2L"),
    decided(2, "East", "CHA", "E3L"),
    decided(3, "East", "DET", "E4L"),
    decided(4, "West", "UTA", "W1L"),
    decided(5, "West", "GSW", "W2L"),
    decided(6, "West", "LAC", "W3L"),
    decided(7, "West", "DEN", "W4L"),
  ];

  it("projects exactly the 4 R2 series from 8 decided R1 series, with correct pairings", () => {
    const out = projectFutureSeries(fullR1());
    expect(out.length).toBe(12);

    const r2 = out.filter((s) => s.round === 2);
    expect(r2.length).toBe(4);
    expect(r2.every((s) => s.isProjected)).toBe(true);

    const pair = (idx: number) => {
      const s = r2.find((x) => x.seriesIndex === idx)!;
      return [s.team1.tricode, s.team2.tricode];
    };
    expect(pair(0)).toEqual(["ATL", "DET"]);
    expect(pair(1)).toEqual(["BOS", "CHA"]);
    expect(pair(2)).toEqual(["DEN", "UTA"]);
    expect(pair(3)).toEqual(["GSW", "LAC"]);
  });

  it("orders projected teams by tricode sort even when feeder B's winner sorts first", () => {
    const out = projectFutureSeries(fullR1());
    const r22 = out.find((s) => s.round === 2 && s.seriesIndex === 2)!;
    expect(r22.team1.tricode).toBe("DEN");
    expect(r22.team2.tricode).toBe("UTA");
  });

  it("does not project R3 or Finals from projected R2 series (no winners yet)", () => {
    const out = projectFutureSeries(fullR1());
    expect(out.some((s) => s.round === 3)).toBe(false);
    expect(out.some((s) => s.round === 4)).toBe(false);
  });

  it("projects a partial R2 when only one feeder is decided", () => {
    const actual = [
      decided(0, "East", "ATL", "E1L"),
      mk(1, 3, "East", t("MIL", 2), t("NYK", 1)),
    ];
    const out = projectFutureSeries(actual);
    const r20 = out.find((s) => s.round === 2 && s.seriesIndex === 0)!;
    expect(r20.isProjected).toBe(true);
    expect(r20.team1.tricode).toBe("ATL");
    expect(r20.team2.tricode).toBe("");
    expect(r20.team1Candidates).toBeUndefined();
    expect(r20.team2Candidates!.map((c) => c.tricode)).toEqual(["MIL", "NYK"]);
  });

  it("puts the known team on the right when only feeder B is decided", () => {
    const actual = [
      mk(1, 0, "East", t("MIL", 1), t("NYK", 1)),
      decided(3, "East", "DET", "E4L"),
    ];
    const out = projectFutureSeries(actual);
    const r20 = out.find((s) => s.round === 2 && s.seriesIndex === 0)!;
    expect(r20.team1.tricode).toBe("");
    expect(r20.team2.tricode).toBe("DET");
    expect(r20.team1Candidates!.map((c) => c.tricode)).toEqual(["MIL", "NYK"]);
    expect(r20.team2Candidates).toBeUndefined();
  });

  it("cascades to a partial R3 from an actual decided R2 plus an in-progress R2", () => {
    const actual = [
      ...fullR1(),
      mk(2, 0, "East", t("ATL", 4), t("DET", 2)),
      mk(2, 1, "East", t("BOS", 2), t("CHA", 1)),
    ];
    const out = projectFutureSeries(actual);
    const r30 = out.find((s) => s.round === 3 && s.seriesIndex === 0)!;
    expect(r30.isProjected).toBe(true);
    expect(r30.team1.tricode).toBe("ATL");
    expect(r30.team2.tricode).toBe("");
    expect(r30.team2Candidates!.map((c) => c.tricode)).toEqual(["BOS", "CHA"]);
    expect(out.some((s) => s.round === 4)).toBe(false);
  });

  it("does not duplicate an actual R2 series already in the input", () => {
    const actualR2 = mk(2, 0, "East", t("ATL", 1), t("DET", 0));
    const out = projectFutureSeries([...fullR1(), actualR2]);
    const r20s = out.filter((s) => s.round === 2 && s.seriesIndex === 0);
    expect(r20s.length).toBe(1);
    expect(r20s[0]).toBe(actualR2);
    expect(r20s[0].isProjected).toBeUndefined();
  });

  it("projects nothing when both feeders are unfinished", () => {
    const actual = [
      mk(1, 0, "East", t("ATL", 2), t("MIA", 1)),
      mk(1, 3, "East", t("MIL", 1), t("NYK", 1)),
    ];
    const out = projectFutureSeries(actual);
    expect(out.length).toBe(2);
    expect(out.some((s) => s.round > 1)).toBe(false);
  });

  it("does not mutate the input array", () => {
    const actual = fullR1();
    const snapshot = [...actual];
    const out = projectFutureSeries(actual);
    expect(out).not.toBe(actual);
    expect(actual).toEqual(snapshot);
    expect(actual.length).toBe(8);
  });
});

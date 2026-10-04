import { describe, expect, it } from "vitest";
import archive from "@/data/playerindex-2025-26.json";
import { hasCompleteAverages, knownAverage, profileStatContext } from "./player-profile-stats";

describe("profile averages", () => {
  it.each([null, undefined, NaN, Infinity, -1, "0", ""])("treats %s as unknown rather than zero", value => expect(knownAverage(value)).toBeNull());
  it.each([0, 1.4, 30])("keeps real average %s", value => expect(knownAverage(value)).toBe(value));
  it("requires all three averages while keeping zeros", () => {
    expect(hasCompleteAverages({ pts: 0, reb: 0, ast: 0 })).toBe(true);
    expect(hasCompleteAverages({ pts: 10, reb: null, ast: 5 })).toBe(false);
  });
  it("does not invent a comparison for missing subject values or an absent subject", () => {
    expect(profileStatContext([{ personId: 1, pts: null, reb: null, ast: null }], 1, "pts", null)).toBeNull();
    expect(profileStatContext([], 1, "pts", 10)).toBeNull();
    expect(profileStatContext([{ personId: 2, pts: 20, reb: 5, ast: 2 }], 1, "pts", 10)).toBeNull();
  });
  it("uses per-metric counts, keeps recorded zero REB/AST, and requires positive PPG", () => {
    const players = [
      { personId: 1, pts: 10, reb: 0, ast: 2 },
      { personId: 2, pts: 20, reb: 10, ast: null },
      { personId: 3, pts: 15, reb: null, ast: 3 },
      { personId: 4, pts: 30, reb: undefined, ast: 0 },
      { personId: 5, pts: 0, reb: 20, ast: 20 },
      { personId: 6, pts: null, reb: 20, ast: 20 },
    ];
    expect(profileStatContext(players, 1, "pts", 10)).toMatchObject({ rank: 4, percentile: 0, cohortSize: 4, sampleAvg: 18.75 });
    expect(profileStatContext(players, 1, "reb", 0)).toEqual({ rank: 2, percentile: 0, cohortSize: 2, sampleAvg: 5, delta: -100 });
    expect(profileStatContext(players, 1, "ast", 2)).toMatchObject({ rank: 2, percentile: 33, cohortSize: 3, sampleAvg: 5 / 3 });
    expect(profileStatContext(players, 3, "reb", null)).toBeNull();
    expect(profileStatContext(players, 5, "reb", 20)).toBeNull();
    expect(profileStatContext(players, 6, "ast", 20)).toBeNull();
  });
  it("preserves ordinary untied ranks, percentiles, equal-weighted means and deltas", () => {
    const players = [
      { personId: 1, pts: 10, reb: 1, ast: 2 },
      { personId: 2, pts: 20, reb: 2, ast: 3 },
      { personId: 3, pts: 30, reb: 3, ast: 4 },
    ];
    expect(players.map(player => profileStatContext(players, player.personId, "pts", player.pts))).toEqual([
      { rank: 3, percentile: 0, cohortSize: 3, sampleAvg: 20, delta: -50 },
      { rank: 2, percentile: 33, cohortSize: 3, sampleAvg: 20, delta: 0 },
      { rank: 1, percentile: 67, cohortSize: 3, sampleAvg: 20, delta: 50 },
    ]);
  });
  it("gives top, middle and bottom ties identical competition ranks and strict-below percentiles under permutation", () => {
    const players = [30, 30, 20, 20, 10, 10].map((pts, index) => ({ personId: index + 1, pts, reb: pts, ast: pts }));
    const permutations = [players, [...players].reverse(), [players[3], players[1], players[5], players[0], players[4], players[2]]];
    for (const reordered of permutations) {
      for (const stat of ["pts", "reb", "ast"] as const) {
        for (const player of players) {
          const rank = player.pts === 30 ? 1 : player.pts === 20 ? 3 : 5;
          const percentile = player.pts === 30 ? 67 : player.pts === 20 ? 33 : 0;
          expect(profileStatContext(reordered, player.personId, stat, player[stat])).toEqual({ rank, percentile, cohortSize: 6, sampleAvg: 20, delta: (player.pts - 20) / 20 * 100 });
        }
      }
    }
  });
  it("uses the recorded subject value for ranking, as before, even if the caller supplies a different display value", () => {
    const players = [{ personId: 1, pts: 10, reb: 0, ast: 0 }, { personId: 2, pts: 20, reb: 0, ast: 0 }];
    expect(profileStatContext(players, 1, "pts", 30)).toEqual({ rank: 2, percentile: 0, cohortSize: 2, sampleAvg: 15, delta: 100 });
  });
  it("handles one-player, all-tied, all-zero and all-unknown boundaries without dividing by zero", () => {
    const player = { personId: 1, pts: 10, reb: 0, ast: 0 };
    expect(profileStatContext([player], 1, "pts", 10)).toEqual({ rank: 1, percentile: 0, cohortSize: 1, sampleAvg: 10, delta: 0 });
    const tied = [player, { ...player, personId: 2 }, { ...player, personId: 3 }];
    for (const subject of tied) {
      expect(profileStatContext(tied, subject.personId, "pts", 10)).toEqual({ rank: 1, percentile: 0, cohortSize: 3, sampleAvg: 10, delta: 0 });
      expect(profileStatContext(tied, subject.personId, "reb", 0)).toEqual({ rank: 1, percentile: 0, cohortSize: 3, sampleAvg: 0, delta: null });
    }
    expect(profileStatContext([{ ...player, pts: 0 }], 1, "pts", 0)).toBeNull();
    expect(profileStatContext([{ ...player, pts: null }], 1, "pts", null)).toBeNull();
  });
  it("keeps the bundled sample and Cade mean intact while fixing the Brunson/Durant tie", () => {
    const players = archive.resultSets[0].rowSet.map(row => ({ personId: row[0] as number, pts: row[22], reb: row[23], ast: row[24] }));
    expect(players).toHaveLength(587);
    const cade = profileStatContext(players, 1630595, "pts", 23.9)!;
    expect(cade).toMatchObject({ rank: 21, percentile: 96, cohortSize: 578 });
    expect(cade.sampleAvg).toBeCloseTo(9.2211072664, 9);
    for (const reordered of [players, [...players].reverse()]) {
      const brunson = profileStatContext(reordered, 1628973, "pts", 26);
      const durant = profileStatContext(reordered, 201142, "pts", 26);
      expect(brunson).toMatchObject({ rank: 14, percentile: 97, cohortSize: 578 });
      expect(durant).toEqual(brunson);
    }
  });
});

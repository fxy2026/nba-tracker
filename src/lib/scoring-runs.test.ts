import { describe, expect, it } from "vitest";
import { getScoringRuns, readScorePair } from "./scoring-runs";
import type { PlayAction } from "@/components/PlayByPlay";
function action(home: string, away: string, extra: Partial<PlayAction> = {}): PlayAction {
  return { actionNumber: 1, period: 1, clock: "PT10M00.00S", teamTricode: "DET", actionType: "2pt", subType: "", description: "", personId: 1, playerNameI: "A. Player", shotResult: "Made", scoreHome: home, scoreAway: away, isFieldGoal: 1, ...extra };
}
const baseline = action("0", "0", { actionType: "period", shotResult: undefined, isFieldGoal: 0, clock: "PT12M00.00S" });
const homeRun = [action("2", "0"), action("4", "0"), action("6", "0"), action("8", "0", { clock: "PT06M00.00S" })];

describe("verified unanswered scoring runs", () => {
  it("counts each newest delta once, not repeated differences since the start", () => {
    expect(getScoringRuns([baseline, ...homeRun])).toEqual([{ teamTricode: "DET", points: 8, period: 1, clock: "PT06M00.00S", scoreHome: 8, scoreAway: 0 }]);
  });
  it("preserves the first scored basket after a real baseline", () => {
    const events = [baseline, action("3", "0", { actionType: "3pt" }), action("6", "0", { actionType: "3pt" }), action("8", "0")];
    expect(getScoringRuns(events)[0].points).toBe(8);
  });
  it("counts a made free throw as1, a2-point shot as2 and a3-pointer as3", () => {
    const events = [baseline, action("1", "0", { actionType: "freethrow" }), action("3", "0"), action("6", "0", { actionType: "3pt" }), action("8", "0")];
    expect(getScoringRuns(events)[0].points).toBe(8);
  });
  it("does not let opponent misses or same-score events switch or inflate the run", () => {
    const miss = action("2", "0", { teamTricode: "MEM", shotResult: "Missed" });
    const timeout = action("4", "0", { actionType: "timeout", shotResult: undefined });
    expect(getScoringRuns([baseline, homeRun[0], miss, homeRun[1], timeout, ...homeRun.slice(2)])[0].points).toBe(8);
  });
  it("closes a run when the opponent scores and uses the prior run's actual end score/time", () => {
    const events = [baseline, ...homeRun, action("8", "2", { teamTricode: "MEM", clock: "PT05M00.00S" }), action("8", "5", { teamTricode: "MEM", actionType: "3pt", clock: "PT04M00.00S" }), action("8", "8", { teamTricode: "MEM", actionType: "3pt", clock: "PT03M00.00S" })];
    expect(getScoringRuns(events)).toEqual([
      { teamTricode: "DET", points: 8, period: 1, clock: "PT06M00.00S", scoreHome: 8, scoreAway: 0 },
      { teamTricode: "MEM", points: 8, period: 1, clock: "PT03M00.00S", scoreHome: 8, scoreAway: 8 },
    ]);
  });
  it("does not combine runs separated by an opponent score", () => {
    expect(getScoringRuns([baseline, action("2", "0"), action("4", "0"), action("4", "2", { teamTricode: "MEM" }), action("6", "2"), action("8", "2")])).toEqual([]);
  });
  it("continues across a quarter transition without scoring from the boundary event", () => {
    const events = [baseline, action("2", "0"), action("4", "0", { clock: "PT00M01.00S" }), action("4", "0", { period: 2, clock: "PT12M00.00S", actionType: "period", shotResult: undefined }), action("6", "0", { period: 2 }), action("8", "0", { period: 2, clock: "PT09M00.00S" })];
    expect(getScoringRuns(events)[0]).toMatchObject({ points: 8, period: 2, clock: "PT09M00.00S" });
  });
  it("orders same-clock free throws by action number without lexical clock assumptions", () => {
    const events = [baseline,
      action("3", "0", { actionNumber: 4, actionType: "freethrow", clock: "PT9M00.00S" }),
      action("1", "0", { actionNumber: 2, actionType: "freethrow", clock: "PT9M00.00S" }),
      action("2", "0", { actionNumber: 3, actionType: "freethrow", clock: "PT9M00.00S" }),
      action("5", "0", { actionNumber: 5, clock: "PT8M00.00S" }),
      action("8", "0", { actionNumber: 6, actionType: "3pt", clock: "PT7M00.00S" }),
    ];
    expect(getScoringRuns(events)[0].points).toBe(8);
  });
  it("orders a late-inserted event by its actual period/clock rather than global action ID", () => {
    const events = [baseline,
      action("2", "0", { actionNumber: 2, clock: "PT11M00.00S" }),
      action("6", "0", { actionNumber: 4, clock: "PT09M00.00S" }),
      action("4", "0", { actionNumber: 99, clock: "PT10M00.00S" }),
      action("8", "0", { actionNumber: 5, clock: "PT08M00.00S" }),
    ];
    expect(getScoringRuns(events)[0].points).toBe(8);
  });
  it("does not infer an opening0-0 when the feed starts partway through a game", () => {
    expect(getScoringRuns([action("100", "90")])).toEqual([]);
    expect(getScoringRuns(homeRun)).toEqual([]); // Only6 verified points after the first snapshot.
  });
  it.each([["", ""], ["20", ""], ["N/A", "0"]])("breaks certainty at missing/invalid scores %s,%s", (home, away) => {
    expect(getScoringRuns([baseline, ...homeRun.slice(0, 2), action(home, away), ...homeRun.slice(2)])).toEqual([]);
  });
  it("does not treat a score jump or mismatched action value as a made basket", () => {
    expect(getScoringRuns([baseline, action("8", "0"), action("10", "0")])).toEqual([]);
    expect(getScoringRuns([baseline, action("2", "0", { actionType: "3pt" }), ...homeRun.slice(1)])).toEqual([]);
  });
  it("withholds run claims when a retrospective score correction revokes points", () => {
    expect(getScoringRuns([baseline, ...homeRun, action("7", "0", { clock: "PT05M00.00S" })])).toEqual([]);
  });
  it("does not count duplicate score snapshots", () => {
    expect(getScoringRuns([baseline, ...homeRun.flatMap((a) => [a, a])])[0].points).toBe(8);
  });
});
it("validates paired scores without treating blank values as zero", () => {
  expect(readScorePair(baseline)).toEqual({ scoreHome: 0, scoreAway: 0 });
  expect(readScorePair(action("", "0"))).toBeNull();
  expect(readScorePair(action("2points", "0"))).toBeNull();
  expect(readScorePair(action("9007199254740992", "0"))).toBeNull();
});

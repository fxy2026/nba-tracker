import { describe, expect, it } from "vitest";
import { compareStatPair, displayCompareStat, isCompareStat, productionScore, productionShares, uniqueStatLeader } from "./compare-stat-values";

describe("comparison numeric boundaries", () => {
  it.each([null, undefined, NaN, Infinity, -1])("never compares or scores unavailable/malformed value %s", missing => {
    expect(isCompareStat(missing)).toBe(false);
    expect(displayCompareStat(missing)).toBe("—");
    expect(compareStatPair(missing, 20)).toBeNull();
    expect(compareStatPair(20, missing)).toBeNull();
    expect(uniqueStatLeader([missing, 20, 10])).toBe(-1);
    expect(productionScore({ pts: 20, reb: missing, ast: 2 })).toBeNull();
    expect(productionShares(missing, 20)).toBeNull();
  });
  it("retains real zero and avoids zero-denominator coordinates", () => {
    expect(displayCompareStat(0, 1)).toBe("0.0");
    expect(compareStatPair(0, 0)).toMatchObject({ ratioA: 0, ratioB: 0, winner: -1 });
    expect(productionScore({ pts: 0, reb: 0, ast: 0 })).toBe(0);
    expect(productionShares(0, 0)).toBeNull();
    expect(productionShares(0, 40)).toEqual([0, 1]);
    expect(uniqueStatLeader([0, 0, 1])).toBe(2);
  });
  it("retains complete production and leader calculations", () => {
    expect(productionScore({ pts: 20, reb: 5, ast: 6 })).toBe(35);
    expect(uniqueStatLeader([20, 15, 10])).toBe(0);
    expect(uniqueStatLeader([20, 20, 10])).toBe(-1);
    expect(compareStatPair(20, 10)).toMatchObject({ ratioA: 1, ratioB: 0.5, winner: 0 });
    expect(productionShares(30, 10)).toEqual([0.75, 0.25]);
  });
});

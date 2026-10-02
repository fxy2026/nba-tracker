import { describe, expect, it } from "vitest";
import { parseLeagueLeaders, hasLeagueLeaderNumbers, formatLeagueLeaderValue } from "./league-leaders";

// Synthetic fixtures exercise the existing envelope contract; no live payload
// is asserted to contain these malformed values.
const headers = ["PLAYER_ID", "PLAYER", "TEAM", "RANK", "GP", "PTS", "REB", "AST", "STL", "BLK", "EFF", "MIN", "FG_PCT", "FG3_PCT"];
const row = [201939, "Stephen Curry", "TOT", 1, 82, 30, 5, 6, 1, 0.5, 25, 34, 0.5, 0.4];
const envelope = (rows: unknown[] = [row], columns: unknown = headers) => ({ resultSet: { headers: columns, rowSet: rows } });
const changed = (field: string, value: unknown) => row.map((v, i) => headers[i] === field ? value : v);

describe("leagueleaders envelope and source identities", () => {
  it("retains names, exact source IDs, TOT, rank ties and row order", () => {
    const next = [...row]; next[0] = 2544; next[1] = "LeBron James";
    const parsed = parseLeagueLeaders(envelope([row, next]));
    expect(parsed?.rows.map(p => [p.PLAYER_ID, p.PLAYER, p.TEAM, p.RANK])).toEqual([[201939, "Stephen Curry", "TOT", 1], [2544, "LeBron James", "TOT", 1]]);
    expect(parsed?.rejectedRows).toBe(0);
  });
  it("preserves valid empty rows separately from malformed envelopes", () => {
    expect(parseLeagueLeaders(envelope([]))).toEqual({ rows: [], rejectedRows: 0 });
  });
  it.each([null, {}, [], { resultSet: null }, { resultSet: {} }, { resultSets: [] }, { resultSet: { headers, rowSet: null } }])("rejects malformed envelope %j", raw => {
    expect(parseLeagueLeaders(raw)).toBeNull();
  });
  it.each([null, [], ["PLAYER"], ["PLAYER_ID"], ["PLAYER_ID", "PLAYER", "PLAYER"], ["PLAYER_ID", "PLAYER", 123], ["PLAYER_ID", "PLAYER", ""]])("rejects ambiguous or missing identity headers %j", columns => {
    expect(parseLeagueLeaders(envelope([], columns))).toBeNull();
  });
  it("rejects only invalid identities/row shapes and preserves other usable rows", () => {
    const invalidName = changed("PLAYER", "  "); invalidName[0] = 2;
    const parsed = parseLeagueLeaders(envelope([null, {}, [], changed("PLAYER_ID", 0), changed("PLAYER_ID", "201939"), invalidName, row]));
    expect(parsed?.rows).toHaveLength(1); expect(parsed?.rejectedRows).toBe(6);
  });
  it.each(["TOT", "GSW", "LAL"])("fails closed on duplicate IDs without choosing or merging %s team rows", team => {
    expect(parseLeagueLeaders(envelope([row, changed("TEAM", team)]))).toBeNull();
  });
  it("a duplicate ID remains ambiguous even if one name is invalid", () => {
    expect(parseLeagueLeaders(envelope([row, changed("PLAYER", "")]))).toBeNull();
  });
  it("keeps an entirely rejected nonempty response distinguishable from valid empty", () => {
    expect(parseLeagueLeaders(envelope([null]))).toEqual({ rows: [], rejectedRows: 1 });
  });
  it("does not use arbitrary headers as object properties", () => {
    const parsed = parseLeagueLeaders(envelope([[1, "Known Player", { injected: true }]], ["PLAYER_ID", "PLAYER", "__proto__"]));
    expect(parsed?.rows[0].PLAYER).toBe("Known Player"); expect(parsed?.rows[0]).not.toHaveProperty("injected");
  });
});

describe("nullable numeric cells and calculation requirements", () => {
  it.each([null, undefined, "", "30", "--", true, NaN, Infinity, -Infinity, -1])("does not turn unknown/invalid PTS %s into zero", value => {
    expect(parseLeagueLeaders(envelope([changed("PTS", value)]))?.rows[0].PTS).toBeNull();
  });
  it("preserves true zero values and negative EFF without guessing other fields", () => {
    const parsed = parseLeagueLeaders(envelope([[1, "Zero", "TOT", 0, 0, 0, 0, 0, 0, 0, -2, 0, 0, 0]]))!.rows[0];
    expect(parsed).toMatchObject({ GP: 0, PTS: 0, REB: 0, EFF: -2, FG_PCT: 0, FG3_PCT: 0 });
    expect(formatLeagueLeaderValue(parsed.PTS)).toBe("0.0"); expect(formatLeagueLeaderValue(parsed.FG_PCT, true)).toBe("0.0%");
  });
  it("optional absent columns/cells become null without dropping a valid identity", () => {
    const parsed = parseLeagueLeaders(envelope([[1, "Sparse"]], ["PLAYER_ID", "PLAYER"]))!;
    expect(parsed.rows[0]).toMatchObject({ PTS: null, GP: null, FG3_PCT: null, TEAM: null }); expect(parsed.rejectedRows).toBe(0);
  });
  it.each([1.5, -1, Number.MAX_SAFE_INTEGER + 1, null])("unknown/invalid GP %s cannot satisfy a score requirement", gp => {
    const parsed = parseLeagueLeaders(envelope([changed("GP", gp)]))!.rows[0];
    expect(parsed.GP).toBeNull(); expect(hasLeagueLeaderNumbers(parsed, ["GP", "PTS"])).toBe(false);
  });
  it.each([null, "50%", -0.1, 1.1, NaN])("missing/invalid percentage %s stays unavailable", pct => {
    const parsed = parseLeagueLeaders(envelope([changed("FG3_PCT", pct)]))!.rows[0];
    expect(parsed.FG3_PCT).toBeNull(); expect(formatLeagueLeaderValue(parsed.FG3_PCT, true)).toBe("—");
    expect(hasLeagueLeaderNumbers(parsed, ["GP", "PTS", "REB", "AST", "STL", "BLK", "EFF"])).toBe(true);
  });
  it("requires only requested fields, preserving rows with optional null shooting data", () => {
    const parsed = parseLeagueLeaders(envelope([changed("FG_PCT", null)]))!.rows[0];
    expect(hasLeagueLeaderNumbers(parsed, ["PTS", "REB"])).toBe(true);
    expect(hasLeagueLeaderNumbers(parsed, ["PTS", "FG_PCT"])).toBe(false);
    expect(formatLeagueLeaderValue(null)).toBe("—"); expect(formatLeagueLeaderValue(Infinity)).toBe("—");
  });
});

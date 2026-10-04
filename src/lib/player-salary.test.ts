import { describe, expect, it } from "vitest";
import { parseSalaryContracts, resolveSalaryPlayer } from "./player-salary";

const player = { id: 101, first_name: "Arin", last_name: "Vale", team: { id: 11, abbreviation: "AAA" } };
const other = { ...player, id: 202, first_name: "Milo" };
const payload = (data: unknown) => ({ data });
const resolve = (rows: unknown, name = "Arin Vale", team: string | null = "AAA") => resolveSalaryPlayer(payload(rows), name, team);
const expectedIdentity = { id: 101, teamId: 11, teamAbbr: "AAA" };
const contract = (extra: Record<string, unknown> = {}) => ({ player_id: 101, season: 2025, base_salary: 12_000_000, cap_hit: 13_000_000, ...extra });
const expectedContract = { season: 2025, base_salary: 12_000_000, cap_hit: 13_000_000 };
const parse = (rows: unknown, id = 101) => parseSalaryContracts(payload(rows), id);
const invalidIds = [undefined, null, "101", "", true, false, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, {}, []];

describe("salary search identity", () => {
  it.each(["AAA", null])("finds the exact full name after an unrelated first result, with team %s", team => {
    expect(resolve([other, player], "Arin Vale", team)).toEqual(expectedIdentity);
    expect(resolve([other], "Arin Vale", team)).toBeNull();
  });
  it("folds accents, case and whitespace without changing the selected provider ID", () => {
    expect(resolve([{ ...player, first_name: "  ÁRIN ", last_name: " Vále ", team: { id: 11, abbreviation: "aaa" } }], " arin   vale ", " aaa ")).toEqual(expectedIdentity);
  });
  it.each(["Arin", "Vale", "Arin Vale Jr.", "Arin Vale II", "Arin Vale III", "A. Vale", "Vale Arin", "Arin Val", ""])('does not collapse partial names, aliases or suffixes: "%s"', name => {
    expect(resolve([player], name)).toBeNull();
  });
  it.each(["Jr.", "II", "III"])("matches suffix %s only when present in the full requested name", suffix => {
    expect(resolve([{ ...player, last_name: `Vale ${suffix}` }], `Arin Vale ${suffix}`)).toEqual(expectedIdentity);
    expect(resolve([{ ...player, last_name: `Vale ${suffix}` }])).toBeNull();
  });
  it.each(["BBB", "", "  ", "AAAA", "A1A"])("never falls back when supplied team %j does not match", team => {
    expect(resolve([player], "Arin Vale", team)).toBeNull();
  });
  it.each(invalidIds)("rejects malformed same-name player ID %j", id => {
    expect(resolve([{ ...player, id }])).toBeNull();
    expect(resolve([player, { ...player, id }])).toBeNull();
  });
  it.each(invalidIds)("rejects malformed team ID %j", id => {
    expect(resolve([{ ...player, team: { ...player.team, id } }])).toBeNull();
  });
  it.each([undefined, null, "AAA", [], {}, { id: 11 }, { id: 11, abbreviation: "" }, { id: 11, abbreviation: 1 }])("rejects incomplete/malformed team %j, even without a team constraint", team => {
    expect(resolve([{ ...player, team }], "Arin Vale", null)).toBeNull();
  });
  it("requires one distinct player ID, but permits identical repeated rows", () => {
    expect(resolve([player, { ...player }])).toEqual(expectedIdentity);
    expect(resolve([player, { ...player, id: 202 }])).toBeNull();
    expect(resolve([player, { ...player, id: 202 }], "Arin Vale", null)).toBeNull();
  });
  it("lets a supplied team distinguish different same-name identities", () => {
    const namesake = { ...player, id: 202, team: { id: 22, abbreviation: "BBB" } };
    expect(resolve([namesake, player])).toEqual(expectedIdentity);
    expect(resolve([namesake, player], "Arin Vale", null)).toBeNull();
  });
  it.each([
    { team: { id: 22, abbreviation: "AAA" } },
    { team: { id: 11, abbreviation: "BBB" } },
    { team: { id: 22, abbreviation: "BBB" } },
    { team: null }, { first_name: "Other" }, { last_name: undefined },
  ])("rejects duplicate-ID conflicts even when team filtering would hide them: %j", extra => {
    expect(resolve([player, { ...player, ...extra }])).toBeNull();
  });
  it.each([22, "11", null, undefined])("rejects a conflicting or invalid supplied team_id %j", team_id => {
    expect(resolve([{ ...player, team_id }])).toBeNull();
  });
  it("accepts agreeing direct and nested team identities", () => {
    expect(resolve([{ ...player, team_id: 11 }])).toEqual(expectedIdentity);
  });
  it("ignores unrelated malformed rows without throwing away an independently valid identity", () => {
    expect(resolve([null, [], false, "row", {}, { first_name: 1 }, player])).toEqual(expectedIdentity);
  });
  it.each([null, [], {}, { data: null }, { data: {} }, { data: [] }, { data: "row" }])("fails closed on malformed or empty search payload %j", data => {
    expect(resolveSalaryPlayer(data, "Arin Vale", "AAA")).toBeNull();
  });
});

describe("salary contract identity and values", () => {
  it("accepts direct, nested and agreeing dual identities and sorts numeric seasons newest first", () => {
    expect(parse([
      contract({ season: 2024 }),
      { player: { id: 101 }, season: 2026, base_salary: 0, cap_hit: 0 },
      contract({ player: { id: 101 } }),
      contract({ player_id: 202 }),
    ])).toEqual([
      { season: 2026, base_salary: 0, cap_hit: 0 }, expectedContract, { ...expectedContract, season: 2024 },
    ]);
  });
  it.each([
    { player_id: 202, player: { id: 101 } },
    { player_id: 101, player: { id: 202 } },
    { player_id: undefined }, { player_id: null }, { player_id: 101, player: { id: null } },
    { player_id: 101, player: "101" }, { player_id: 101, player: [] },
  ])("rejects conflicting, missing or invalid supplied IDs %j", extra => {
    expect(parse([contract(extra)])).toEqual([]);
  });
  it.each(invalidIds)("never rescues malformed direct ID %j with a matching nested ID (or vice versa)", id => {
    expect(parse([contract({ player_id: id, player: { id: 101 } })])).toEqual([]);
    expect(parse([contract({ player: { id } })])).toEqual([]);
  });
  it.each([{}, { player: {} }, { player: null }, { player: { name: "Arin Vale" } }])("rejects absent player identity %j even when name matches", identity => {
    expect(parse([{ ...expectedContract, ...identity }])).toEqual([]);
  });
  it("allows an absent nested relation when a valid direct identity is present", () => {
    expect(parse([contract({ player: null })])).toEqual([expectedContract]);
    expect(parse([contract({ player: {} })])).toEqual([expectedContract]);
  });
  it.each(invalidIds)("rejects invalid requested player ID %j", id => {
    expect(parseSalaryContracts(payload([contract({ player_id: id })]), id as number)).toEqual([]);
  });
  it.each([undefined, null, "2025", "", false, true, 0, -1, 1945, 2025.5, 9999, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER, {}, []])("omits contracts with invalid numeric season %j", season => {
    expect(parse([contract({ season }), contract()])).toEqual([expectedContract]);
  });
  it.each([undefined, null, "", "13000000", false, true, -1, NaN, Infinity, -Infinity, {}, []])("preserves unknown money %j as null without discarding other known amounts", amount => {
    expect(parse([contract({ base_salary: amount })])).toEqual([{ ...expectedContract, base_salary: null }]);
    expect(parse([contract({ cap_hit: amount })])).toEqual([{ ...expectedContract, cap_hit: null }]);
  });
  it("keeps absent money null and genuine zero numeric, including fractional valid amounts", () => {
    expect(parse([{ player_id: 101, season: 2025 }])).toEqual([{ season: 2025, base_salary: null, cap_hit: null }]);
    expect(parse([contract({ base_salary: 0, cap_hit: 0.5 })])).toEqual([{ season: 2025, base_salary: 0, cap_hit: 0.5 }]);
  });
  it("skips malformed unrelated rows instead of dropping independently verified contracts", () => {
    expect(parse([null, [], {}, "row", false, contract()])).toEqual([expectedContract]);
  });
  it.each([null, [], {}, { data: null }, { data: {} }, { data: [] }, { data: "row" }])("fails closed on malformed or empty contract payload %j", data => {
    expect(parseSalaryContracts(data, 101)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { parsePlayerMeasurements } from "./player-measurements";

const headers = ["PLAYER_ID", "PLAYER_NAME", "WINGSPAN", "STANDING_REACH", "BODY_FAT_PCT", "HAND_LENGTH", "HAND_WIDTH", "HEIGHT_WO_SHOES"];
const row = (id: unknown = 201939, wingspan: unknown = 75.5) => [id, "Player Name", wingspan, 97, 5.7, 8.5, 9, 74.25];
const payload = (rows: unknown[] = [row()], columns: unknown = headers) => ({ resultSets: [{ headers: columns, rowSet: rows }] });
const expected = { wingspan: 75.5, standingReach: 97, bodyFat: 5.7, handLength: 8.5, handWidth: 9, heightNoShoes: 74.25 };

describe("player-specific combine measurements", () => {
  it("selects the requested PLAYER_ID in the second row, never the first row or class average", () => {
    expect(parsePlayerMeasurements(payload([row(1, 91), row(), row(2, 86)]), 201939)).toEqual(expected);
  });
  it("uses validated header positions rather than fixed cell offsets", () => {
    expect(parsePlayerMeasurements(payload([row().reverse()], [...headers].reverse()), 201939)).toEqual(expected);
  });
  it("accepts an unambiguous canonical decimal PLAYER_ID string", () => {
    expect(parsePlayerMeasurements(payload([row("201939")]), 201939)).toEqual(expected);
  });
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid requested identity %s", id => {
    expect(parsePlayerMeasurements(payload([row(id)]), id)).toBeNull();
  });
  it("withholds measurements for a different ID even if the player's name matches", () => {
    expect(parsePlayerMeasurements(payload([row(123)]), 201939)).toBeNull();
  });
  it.each([undefined, null, "", " ", "0201939", "201939.0", "2.01939e5", true, 0, -1, 201939.5, Infinity, {}, []])("rejects missing or malformed response identity %j", id => {
    const cells = row(); cells[0] = id;
    expect(parsePlayerMeasurements(payload([cells]), 201939)).toBeNull();
  });
  it("fails closed on duplicate matching IDs, including numeric/string duplicates and an empty duplicate", () => {
    for (const duplicate of [row(), row("201939"), [201939, "Player Name", null, null, null, null, null, null]]) {
      expect(parsePlayerMeasurements(payload([row(1), row(), duplicate]), 201939)).toBeNull();
    }
  });
  it("withholds the result if a malformed class row could conceal another match", () => {
    for (const malformed of [null, {}, "row", [], row().slice(0, -1), [...row(), "extra"], row(null)]) {
      expect(parsePlayerMeasurements(payload([row(), malformed]), 201939)).toBeNull();
    }
  });
  it.each([
    null, [], {}, { resultSets: null }, { resultSets: {} }, { resultSets: [] },
    { resultSets: [null] }, { resultSets: [{ headers, rowSet: null }] },
    { resultSets: [{ headers, rowSet: {} }] }, { resultSets: [{ headers, rowSet: [] }] },
  ])("fails closed on malformed or empty payload %j", input => {
    expect(parsePlayerMeasurements(input, 201939)).toBeNull();
  });
  it("does not choose arbitrarily among multiple result sets", () => {
    expect(parsePlayerMeasurements({ resultSets: [...payload().resultSets, ...payload().resultSets] }, 201939)).toBeNull();
  });
  it.each([null, {}, [], ["WINGSPAN"], ["player_id", "WINGSPAN"], [" PLAYER_ID", "WINGSPAN"], ["PLAYER_ID", 1], ["PLAYER_ID", null], ["PLAYER_ID", ""], ["PLAYER_ID", "PLAYER_ID"], ["PLAYER_ID", "WINGSPAN", "WINGSPAN"], ["PLAYER_ID", , "WINGSPAN"]])("rejects missing, malformed or duplicate headers %j", columns => {
    const cells = Array.isArray(columns) ? columns.map((_, i) => i === 0 ? 201939 : 75) : [];
    expect(parsePlayerMeasurements(payload([cells], columns), 201939)).toBeNull();
  });
  it("preserves absent measurement columns as unknown when another measurement is valid", () => {
    expect(parsePlayerMeasurements(payload([[201939, 75.5]], ["PLAYER_ID", "WINGSPAN"]), 201939)).toEqual({
      wingspan: 75.5, standingReach: null, bodyFat: null, handLength: null, handWidth: null, heightNoShoes: null,
    });
  });
  it.each([null, undefined, "", "75.5", "75 inches", true, false, 0, -3, NaN, Infinity, -Infinity, {}, []])("does not coerce invalid measurement %j into a number or zero", value => {
    const cells = row(); cells[2] = value;
    expect(parsePlayerMeasurements(payload([cells]), 201939)).toEqual({ ...expected, wingspan: null });
  });
  it("validates each numeric measurement field and percentage bounds", () => {
    expect(parsePlayerMeasurements(payload([[201939, "Player Name", null, NaN, 100, -1, "9", 74.25]]), 201939)).toEqual({
      wingspan: null, standingReach: null, bodyFat: null, handLength: null, handWidth: null, heightNoShoes: 74.25,
    });
    expect(parsePlayerMeasurements(payload([[201939, "Player Name", 75, 97, 101, 8, 9, 74]]), 201939)?.bodyFat).toBeNull();
  });
  it("hides the tile when the matching player has no meaningful measurements", () => {
    expect(parsePlayerMeasurements(payload([[201939, "Player Name", null, 0, null, null, null, null]]), 201939)).toBeNull();
    expect(parsePlayerMeasurements(payload([[201939]], ["PLAYER_ID"]), 201939)).toBeNull();
  });
});

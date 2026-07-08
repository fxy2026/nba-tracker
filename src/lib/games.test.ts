import { describe, it, expect } from "vitest";
import {
  isPreseason,
  isRegular,
  isAllStar,
  isPlayoff,
  isPlayIn,
  isCup,
  isSummerLeague,
  isCountedSeason,
} from "./games";

describe("gameId prefix predicates", () => {
  it("classifies each game type by prefix", () => {
    expect(isPreseason("0012500001")).toBe(true);
    expect(isRegular("0022500001")).toBe(true);
    expect(isAllStar("0032500001")).toBe(true);
    expect(isPlayoff("0042500405")).toBe(true);
    expect(isPlayIn("0052500001")).toBe(true);
    expect(isCup("0062500001")).toBe(true);
  });

  it("isSummerLeague matches the 13/14/15/16 slates", () => {
    expect(isSummerLeague("1322600001")).toBe(true);
    expect(isSummerLeague("1422600001")).toBe(true);
    expect(isSummerLeague("1522600001")).toBe(true);
    expect(isSummerLeague("1622600001")).toBe(true);
    expect(isSummerLeague("0022500001")).toBe(false);
    expect(isSummerLeague("1222600001")).toBe(false);
    expect(isSummerLeague("1722600001")).toBe(false);
  });

  it("isCup only matches the 006 in-season-tournament prefix", () => {
    expect(isCup("0062500001")).toBe(true);
    expect(isCup("0022500001")).toBe(false);
  });
});

describe("isCountedSeason allowlist", () => {
  it("counts regular season, playoffs, and play-in", () => {
    expect(isCountedSeason("0022500001")).toBe(true);
    expect(isCountedSeason("0042500405")).toBe(true);
    expect(isCountedSeason("0052500001")).toBe(true);
  });

  it("excludes preseason and all-star exhibitions", () => {
    expect(isCountedSeason("0012500001")).toBe(false);
    expect(isCountedSeason("0032500001")).toBe(false);
  });

  it("excludes summer league and NBA Cup slates", () => {
    expect(isCountedSeason("1522600001")).toBe(false);
    expect(isCountedSeason("0062500001")).toBe(false);
  });
});
